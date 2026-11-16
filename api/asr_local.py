"""Server-side speech recognition for recorded answers ("record, then transcribe"), always in-country.

Engines, in order:
  1. MemBrain's Gulf Arabic Whisper (LoRA fine-tune, merged and converted to CTranslate2 int8 by
     asr/export_model.py), if WHISPER_MODEL is set to a folder or a Hugging Face repo id (private repo: HF_TOKEN).
  2. Azure AI Speech, short-audio REST API, in AZURE_SPEECH_REGION (uaenorth), if AZURE_SPEECH_KEY is set.
     Answers up to 60 seconds.
ASR_PREFER_LOCAL=1 makes the earlier prototype use this endpoint by default (it otherwise streams to Azure itself).
Audio is decoded and transcribed in memory; it is never written to disk or kept.
"""
from __future__ import annotations

import io
import os
import threading
import time

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

router = APIRouter(prefix="/api/asr", tags=["speech"])
_MODEL = {"m": None, "err": None}
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


def _model():
    if _MODEL["m"] is None and _MODEL["err"] is None:
        with _LOCK:
            if _MODEL["m"] is None and _MODEL["err"] is None:
                try:
                    from faster_whisper import WhisperModel
                    _MODEL["m"] = WhisperModel(os.environ["WHISPER_MODEL"], device=os.getenv("WHISPER_DEVICE", "cpu"),
                                               compute_type=os.getenv("WHISPER_COMPUTE", "int8"),
                                               cpu_threads=int(os.getenv("WHISPER_THREADS", "4")))
                except Exception as e:   # missing package, bad path, no access
                    _MODEL["err"] = f"{type(e).__name__}: {e}"[:300]
    if _MODEL["m"] is None:
        raise HTTPException(503, "Self-hosted speech model unavailable: " + (_MODEL["err"] or "not configured"))
    return _MODEL["m"]


AZURE_MAX_SECONDS = 60
AZURE_LOCALE = {"ar": "ar-AE", "en": "en-GB"}


def _engine() -> str | None:
    if os.getenv("WHISPER_MODEL"):
        return "membrain-whisper-gulf"
    if os.getenv("AZURE_SPEECH_KEY"):
        return "azure-uaenorth"
    return None


@router.get("/config")
def asr_config():
    eng = _engine()
    label = {"membrain-whisper-gulf": os.getenv("WHISPER_LABEL", "MemBrain Gulf Whisper (in-country)"),
             "azure-uaenorth": f"Azure AI Speech, {os.getenv('AZURE_SPEECH_REGION', 'uaenorth')} (in-country)"}.get(eng, "MemBrain Gulf Whisper (in-country)")
    return {"enabled": eng is not None, "prefer": eng == "membrain-whisper-gulf" and os.getenv("ASR_PREFER_LOCAL") == "1",
            "engine": eng, "label": label}


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
    eng = _engine()
    if not eng:
        raise HTTPException(503, "No server speech engine configured")
    data = await audio.read()
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(413 if data else 400, "Audio missing or too long")
    try:
        pcm = decode(data)
    except Exception as e:
        raise HTTPException(422, f"Could not decode audio: {type(e).__name__}")
    if len(pcm) > MAX_SECONDS * 16000:
        raise HTTPException(413, "Audio too long")
    if eng == "azure-uaenorth":
        if len(pcm) > AZURE_MAX_SECONDS * 16000:
            raise HTTPException(413, f"Please keep each recording under {AZURE_MAX_SECONDS} seconds")
        return _azure(pcm, lang)
    m = _model()
    t = time.perf_counter()
    try:
        segs, info = m.transcribe(pcm, language="ar" if lang == "ar" else "en", task="transcribe",
                                  beam_size=int(os.getenv("WHISPER_BEAM", "1")), vad_filter=True, condition_on_previous_text=False,
                                  max_new_tokens=int(os.getenv("WHISPER_MAX_NEW_TOKENS", "200")))
        segs = list(segs)
    except Exception as e:
        raise HTTPException(500, f"Speech model error: {type(e).__name__}")
    return {"text": " ".join(s.text.strip() for s in segs).strip(), "engine": "membrain-whisper-gulf", "language": info.language,
            "duration_s": round(info.duration, 1), "latency_ms": round((time.perf_counter() - t) * 1000)}
