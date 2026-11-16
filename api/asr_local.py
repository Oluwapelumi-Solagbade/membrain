"""Server-side speech recognition for recorded answers ("record, then transcribe"), on MemBrain's own server
(in the UAE in production; SERVER_IN_UAE says whether this server is).

Engines, in order:
  1. MemBrain's Gulf Arabic Whisper (LoRA fine-tune, merged and converted to CTranslate2 int8 by
     asr/export_model.py), if WHISPER_MODEL is set to a folder or a Hugging Face repo id (private repo: HF_TOKEN).
  2. Azure AI Speech, short-audio REST API, in AZURE_SPEECH_REGION (uaenorth), if AZURE_SPEECH_KEY is set.
     Answers up to 60 seconds.
ASR_PREFER_LOCAL=1 makes the earlier prototype use this endpoint by default (it otherwise streams to Azure itself).
Audio is decoded and transcribed in memory; it is never written to disk or kept.
"""
from __future__ import annotations

import asyncio
import io
import os
import threading
import time

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

router = APIRouter(prefix="/api/asr", tags=["speech"])
_MODEL: dict = {"m": None, "err": None, "err_at": 0.0}
_LOCK = threading.Lock()
MAX_BYTES = 6 * 1024 * 1024        # about 3 minutes of compressed speech
MAX_SECONDS = 180


def decode(data: bytes):
    """Any browser format (WebM/Opus, Ogg, MP4/AAC, WAV) -> 16 kHz mono float32, in memory."""
    import av
    import numpy as np
    chunks = []
    with av.open(io.BytesIO(data), mode="r") as c:
        rs = av.AudioResampler(format="s16", layout="mono", rate=16000)
        for frame in c.decode(audio=0):
            for f in rs.resample(frame) or []:
                chunks.append(f.to_ndarray().reshape(-1))
        for f in rs.resample(None) or []:
            chunks.append(f.to_ndarray().reshape(-1))
    if not chunks:
        raise ValueError("no audio")
    return np.concatenate(chunks).astype(np.float32) / 32768.0


RETRY_AFTER_S = float(os.getenv("WHISPER_RETRY_S", "30"))     # a failed load is retried after this, not never
LOAD_WAIT_S = float(os.getenv("WHISPER_LOAD_WAIT_S", "25"))   # how long a request waits for a model still loading
BUSY_WAIT_S = float(os.getenv("WHISPER_BUSY_WAIT_S", "90"))   # how long a request queues behind others
# Transcriptions run one at a time by default: on a small CPU host, two at once each take twice as long and both may time out.
_RUN = threading.BoundedSemaphore(max(1, int(os.getenv("WHISPER_CONCURRENCY", "1"))))


def _cooling() -> bool:
    return _MODEL["err"] is not None and time.monotonic() - _MODEL["err_at"] < RETRY_AFTER_S


def _unavailable() -> HTTPException:
    return HTTPException(503, "Self-hosted speech model unavailable: " + (_MODEL["err"] or "not configured"),
                         headers={"Retry-After": str(int(RETRY_AFTER_S))})


def _model(wait: float | None = None):
    """The loaded Whisper model. Blocking: call it from a worker thread, never on the server's event loop.
    Waits up to `wait` seconds (default LOAD_WAIT_S; -1 = as long as it takes) for a load already under way.
    A failed load (network blip, missing token) is retried after RETRY_AFTER_S instead of breaking dictation until restart."""
    if _MODEL["m"] is not None:
        return _MODEL["m"]
    if _cooling():
        raise _unavailable()
    if not _LOCK.acquire(timeout=LOAD_WAIT_S if wait is None else wait):
        raise HTTPException(503, "The speech model is still starting. Please try again in a minute.", headers={"Retry-After": "30"})
    try:
        if _MODEL["m"] is None and not _cooling():
            try:
                from faster_whisper import WhisperModel
                _MODEL["m"] = WhisperModel(os.environ["WHISPER_MODEL"], device=os.getenv("WHISPER_DEVICE", "cpu"),
                                           compute_type=os.getenv("WHISPER_COMPUTE", "int8"),
                                           cpu_threads=int(os.getenv("WHISPER_THREADS", "4")))
                _MODEL["err"] = None
            except Exception as e:   # missing package, bad path, no access, download interrupted
                _MODEL["err"], _MODEL["err_at"] = f"{type(e).__name__}: {e}"[:300], time.monotonic()
    finally:
        _LOCK.release()
    if _MODEL["m"] is None:
        raise _unavailable()
    return _MODEL["m"]


def state() -> str:
    """'ready', 'loading', 'error' (retrying soon) or 'idle' (not loaded yet)."""
    if _MODEL["m"] is not None:
        return "ready"
    if _LOCK.locked():
        return "loading"
    return "error" if _MODEL["err"] else "idle"


def whisper_text(pcm, lang: str) -> tuple[str, object, int]:
    """Transcribe 16 kHz mono audio with our Whisper model. Blocking (the model decodes as its segments are read),
    so run it in a worker thread. Returns (text, info, latency_ms)."""
    m = _model()
    if not _RUN.acquire(timeout=BUSY_WAIT_S):
        raise HTTPException(503, "Speech recognition is busy. Please try again in a moment.", headers={"Retry-After": "10"})
    try:
        t = time.perf_counter()
        segs, info = m.transcribe(pcm, language="ar" if lang == "ar" else "en", task="transcribe",
                                  beam_size=int(os.getenv("WHISPER_BEAM", "1")), vad_filter=True, condition_on_previous_text=False,
                                  max_new_tokens=int(os.getenv("WHISPER_MAX_NEW_TOKENS", "200")))
        text = " ".join(s.text.strip() for s in segs).strip()
        return text, info, round((time.perf_counter() - t) * 1000)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Speech model error: {type(e).__name__}")
    finally:
        _RUN.release()


AZURE_MAX_SECONDS = 60
AZURE_LOCALE = {"ar": "ar-AE", "en": "en-GB"}


def _engine() -> str | None:
    if os.getenv("WHISPER_MODEL"):
        return "membrain-whisper-gulf"
    if os.getenv("AZURE_SPEECH_KEY"):
        return "azure-uaenorth"
    return None


def preload():
    """Fetch and load the Whisper model in the background at server start, so the first recorded answer does not
    wait for the download (about 250 MB). Off with ASR_PRELOAD=0."""
    if os.getenv("WHISPER_MODEL") and os.getenv("ASR_PRELOAD", "1") != "0":
        def _go():
            try:
                _model(wait=-1)
            except HTTPException:
                pass   # reported on the first request; Azure or typing still work meanwhile
        threading.Thread(target=_go, daemon=True).start()


@router.get("/config")
def asr_config():
    eng = _engine()
    # Only say "in the UAE" when the operator confirms this server runs there (SERVER_IN_UAE=1, e.g. Azure UAE North).
    # A demo host elsewhere (Hugging Face Spaces) leaves it off, and the site then words its privacy notes honestly.
    in_uae = os.getenv("SERVER_IN_UAE", "0") == "1"
    where = " (in-country)" if in_uae else ""
    label = {"membrain-whisper-gulf": os.getenv("WHISPER_LABEL", "MemBrain Gulf Whisper" + where),
             "azure-uaenorth": f"Azure AI Speech, {os.getenv('AZURE_SPEECH_REGION', 'uaenorth')} (in-country)"}.get(eng, "MemBrain Gulf Whisper" + where)
    return {"enabled": eng is not None, "prefer": eng == "membrain-whisper-gulf" and os.getenv("ASR_PREFER_LOCAL") == "1",
            "engine": eng, "label": label, "in_uae": in_uae,
            "state": state() if eng == "membrain-whisper-gulf" else ("ready" if eng else "off")}


def _wav(pcm) -> bytes:
    import wave

    import numpy as np
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)
        w.writeframes((np.clip(pcm, -1, 1) * 32767).astype("<i2").tobytes())
    return buf.getvalue()


def _azure(pcm, lang: str) -> dict:
    import httpx
    region = os.getenv("AZURE_SPEECH_REGION", "uaenorth")
    url = (f"https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1"
           f"?language={AZURE_LOCALE.get(lang, 'ar-AE')}&format=simple")
    t = time.perf_counter()
    try:
        r = httpx.post(url, content=_wav(pcm), timeout=30.0, headers={
            "Ocp-Apim-Subscription-Key": os.environ["AZURE_SPEECH_KEY"], "Accept": "application/json",
            "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000"})
        r.raise_for_status()
        j = r.json()
    except Exception as e:
        raise HTTPException(502, f"Speech service error: {type(e).__name__}")
    return {"text": (j.get("DisplayText") or "").strip(), "engine": "azure-uaenorth", "language": AZURE_LOCALE.get(lang, "ar-AE"),
            "duration_s": round(len(pcm) / 16000, 1), "latency_ms": round((time.perf_counter() - t) * 1000),
            "status": j.get("RecognitionStatus")}


@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...), lang: str = Form("ar")):
    if not _engine():
        raise HTTPException(503, "No server speech engine configured")
    data = await audio.read()
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(413 if data else 400, "Audio missing or too long")
    # Decoding and recognition take seconds of CPU: do them in a worker thread so the server keeps answering everyone else
    # (page loads, other people's recordings, the host's health check) meanwhile.
    return await asyncio.to_thread(_transcribe, data, lang)


def _transcribe(data: bytes, lang: str) -> dict:
    eng = _engine()
    try:
        pcm = decode(data)
    except Exception as e:
        raise HTTPException(422, f"Could not decode audio: {type(e).__name__}")
    if len(pcm) > MAX_SECONDS * 16000:
        raise HTTPException(413, "Audio too long")
    if eng == "membrain-whisper-gulf" and _MODEL["m"] is None and os.getenv("AZURE_SPEECH_KEY") and (_LOCK.locked() or _cooling()):
        eng = "azure-uaenorth"   # our model is loading or briefly unavailable: answer with Azure (also in the UAE) this once
    if eng == "azure-uaenorth":
        if len(pcm) > AZURE_MAX_SECONDS * 16000:
            raise HTTPException(413, f"Please keep each recording under {AZURE_MAX_SECONDS} seconds")
        return _azure(pcm, lang)
    text, info, ms = whisper_text(pcm, lang)
    return {"text": text, "engine": "membrain-whisper-gulf", "language": info.language,
            "duration_s": round(info.duration, 1), "latency_ms": ms}
