"""Self-hosted speech recognition: MemBrain's Gulf Arabic Whisper (LoRA fine-tune, merged and converted to
CTranslate2 int8 by asr/export_model.py), served in-country next to the API.

Off unless WHISPER_MODEL is set to a local folder or a Hugging Face repo id (a private repo needs HF_TOKEN).
ASR_PREFER_LOCAL=1 makes the app use it by default; otherwise Azure stays the default and the local model can be
chosen with ?asr=local. Audio is transcribed in memory and never written to disk or kept.
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


@router.get("/config")
def asr_config():
    on = bool(os.getenv("WHISPER_MODEL"))
    return {"enabled": on, "prefer": on and os.getenv("ASR_PREFER_LOCAL") == "1",
            "engine": "membrain-whisper-gulf" if on else None, "label": os.getenv("WHISPER_LABEL", "MemBrain Gulf Whisper (in-country)")}


@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...), lang: str = Form("ar")):
    if not os.getenv("WHISPER_MODEL"):
        raise HTTPException(503, "Self-hosted speech model not configured")
    data = await audio.read()
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(413 if data else 400, "Audio missing or too long")
    m = _model()
    t = time.perf_counter()
    try:
        pcm = decode(data)
    except Exception as e:
        raise HTTPException(422, f"Could not decode audio: {type(e).__name__}")
    if len(pcm) > MAX_SECONDS * 16000:
        raise HTTPException(413, "Audio too long")
    try:
        segs, info = m.transcribe(pcm, language="ar" if lang == "ar" else "en", task="transcribe",
                                  beam_size=int(os.getenv("WHISPER_BEAM", "1")), vad_filter=True, condition_on_previous_text=False,
                                  max_new_tokens=int(os.getenv("WHISPER_MAX_NEW_TOKENS", "200")))
        segs = list(segs)
    except Exception as e:
        raise HTTPException(500, f"Speech model error: {type(e).__name__}")
    return {"text": " ".join(s.text.strip() for s in segs).strip(), "engine": "membrain-whisper-gulf", "language": info.language,
            "duration_s": round(info.duration, 1), "latency_ms": round((time.perf_counter() - t) * 1000)}
