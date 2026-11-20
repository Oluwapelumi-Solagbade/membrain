"""Spoken instructions made on the server, so every device can hear them.

Browsers speak with their own voices, and many have none for Arabic (Chrome on most computers) or none at all (the
Android app's WebView). The site asks here first and plays the audio; when this is off it falls back to the browser.

Engines, in order:
- Azure AI Speech, UAE North (ar-AE-FatimaNeural / en-GB-SoniaNeural) when AZURE_SPEECH_KEY is set;
- Piper (open source, self-hosted on this server's CPU): ar_JO-kareem-medium with Arabic diacritisation, and
  en_GB-alba-medium; voices are downloaded once from rhasspy/piper-voices.
Only the instruction text is sent; nothing the person says goes through here. Answers are cached by text.
"""
from __future__ import annotations

import io
import logging
import os
import threading
import time
import wave
from collections import OrderedDict, defaultdict, deque
from xml.sax.saxutils import escape

import httpx
from fastapi import APIRouter, HTTPException, Query, Request, Response

log = logging.getLogger("membrain.tts")
router = APIRouter(prefix="/api/speech/tts", tags=["speech"])

AZURE_VOICE = {"ar": os.getenv("AZURE_TTS_VOICE_AR", "ar-AE-FatimaNeural"), "en": os.getenv("AZURE_TTS_VOICE_EN", "en-GB-SoniaNeural")}
PIPER_VOICE = {"ar": os.getenv("PIPER_VOICE_AR", "ar_JO-kareem-medium"), "en": os.getenv("PIPER_VOICE_EN", "en_GB-alba-medium")}
MAX_CHARS = 700
PER_MIN = int(os.getenv("TTS_PER_MINUTE", "60"))

_cache: OrderedDict[tuple, tuple[bytes, str]] = OrderedDict()
_hits: dict[str, deque] = defaultdict(deque)
_voices: dict[str, object] = {}
_lock = threading.Lock()
status = {"piper": "off", "error": None}


def _azure_key() -> str:
    return os.getenv("AZURE_SPEECH_KEY", "")


def piper_on() -> bool:
    return os.getenv("PIPER_TTS", "0") == "1"   # on in the demo Space (deploy/hf-space/app.py)


def engine() -> str | None:
    if _azure_key():
        return "azure"
    if piper_on() and status["piper"] != "failed":
        return "piper"
    return None


def _voice_path(name: str) -> tuple[str, str]:
    """ar_JO-kareem-medium -> ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx (+ .json), downloaded once."""
    local = os.getenv("PIPER_DIR")
    if local and os.path.exists(os.path.join(local, name + ".onnx")):
        return os.path.join(local, name + ".onnx"), os.path.join(local, name + ".onnx.json")
    from huggingface_hub import hf_hub_download
    locale, speaker, quality = name.split("-")
    base = f"{locale.split('_')[0]}/{locale}/{speaker}/{quality}/{name}"
    onnx = hf_hub_download("rhasspy/piper-voices", base + ".onnx")
    cfg = hf_hub_download("rhasspy/piper-voices", base + ".onnx.json")
    return onnx, cfg


def _piper(lang: str):
    if lang in _voices:
        return _voices[lang]
    with _lock:
        if lang not in _voices:
            from piper import PiperVoice
            onnx, cfg = _voice_path(PIPER_VOICE[lang])
            _voices[lang] = PiperVoice.load(onnx, config_path=cfg)
            status["piper"] = "ready"
    return _voices[lang]


def preload() -> None:
    """Fetch and load both voices in the background at start-up, so the first instruction is not slow."""
    if engine() != "piper":
        return

    def run():
        try:
            status["piper"] = "loading"
            for lang in ("ar", "en"):
                _piper(lang)
            log.info("Piper voices ready")
        except Exception as e:   # never stop the demo for a voice: the browser speaks instead
            status.update(piper="failed", error=f"{type(e).__name__}: {str(e)[:160]}")
            log.warning("Piper not available: %s", status["error"])
    threading.Thread(target=run, daemon=True).start()


def _piper_wav(text: str, lang: str, slow: bool) -> bytes:
    v = _piper(lang)
    buf = io.BytesIO()
    syn = None
    if slow:
        try:
            from piper import SynthesisConfig
            syn = SynthesisConfig(length_scale=1.3)
        except ImportError:
            syn = None
    with wave.open(buf, "wb") as w:
        v.synthesize_wav(text, w, syn_config=syn) if syn else v.synthesize_wav(text, w)
    return buf.getvalue()


def _azure_mp3(text: str, lang: str, slow: bool) -> bytes:
    region = os.getenv("AZURE_SPEECH_REGION", "uaenorth")
    voice = AZURE_VOICE[lang]
    loc = "-".join(voice.split("-")[:2])
    ssml = (f"<speak version='1.0' xml:lang='{loc}'><voice name='{voice}'><prosody rate='{'-25%' if slow else '-5%'}'>"
            f"{escape(text)}</prosody></voice></speak>")
    r = httpx.post(f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1", content=ssml.encode(),
                   headers={"Ocp-Apim-Subscription-Key": _azure_key(), "Content-Type": "application/ssml+xml",
                            "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "membrain"},
                   timeout=15)
    r.raise_for_status()
    return r.content


@router.get("/config")
def tts_config():
    e = engine()
    return {"enabled": e is not None and (e == "azure" or status["piper"] in ("ready", "loading", "off")),
            "engine": e, "state": status["piper"] if e == "piper" else ("ready" if e else "off"),
            "voices": AZURE_VOICE if e == "azure" else PIPER_VOICE if e == "piper" else None}


@router.get("")
def tts(request: Request, text: str = Query(..., min_length=1, max_length=MAX_CHARS), lang: str = Query("en", pattern="^(ar|en)$"),
        slow: bool = False):
    e = engine()
    if e is None:
        raise HTTPException(503, "Server speech is off")
    key = (e, lang, slow, text)
    if key in _cache:
        _cache.move_to_end(key)
        data, mime = _cache[key]
    else:
        ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0].strip()
        q, now = _hits[ip], time.time()
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= PER_MIN:
            raise HTTPException(429, "Too many requests; the device voice is used instead")
        q.append(now)
        try:
            data, mime = (_azure_mp3(text, lang, slow), "audio/mpeg") if e == "azure" else (_piper_wav(text, lang, slow), "audio/wav")
        except Exception as ex:
            log.warning("TTS failed (%s): %s", e, ex)
            raise HTTPException(503, "Server speech failed; the device voice is used instead")
        if not data:   # Azure answers 200 with no audio for text it cannot say in that voice: never keep or send silence
            raise HTTPException(503, "Server speech returned no audio; the device voice is used instead")
        _cache[key] = (data, mime)
        while len(_cache) > 400:
            _cache.popitem(last=False)
    return Response(data, media_type=mime, headers={"Cache-Control": "public, max-age=86400"})
