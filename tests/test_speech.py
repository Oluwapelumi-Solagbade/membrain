import httpx
from fastapi.testclient import TestClient

import api.speech as sp
from api.main import app

c = TestClient(app)


def test_config_reports_disabled_without_key(monkeypatch):
    monkeypatch.delenv("AZURE_SPEECH_KEY", raising=False)
    r = c.get("/api/speech/config").json()
    assert r["enabled"] is False and r["locales"]["Emirati"] == "ar-AE"


def test_token_503_without_key(monkeypatch):
    monkeypatch.delenv("AZURE_SPEECH_KEY", raising=False)
    assert c.get("/api/speech/token").status_code == 503


def test_token_brokered_and_key_never_returned(monkeypatch):
    monkeypatch.setenv("AZURE_SPEECH_KEY", "secret-key-123")
    sp._cache.clear(); sp._hits.clear()

    class FakeResp:
        status_code = 200
        text = "short-lived-token"

    class FakeClient:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, headers):
            assert "uaenorth" in url and headers["Ocp-Apim-Subscription-Key"] == "secret-key-123"
            return FakeResp()

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    r = c.get("/api/speech/token")
    assert r.status_code == 200 and r.json()["token"] == "short-lived-token"
    assert "secret-key-123" not in r.text


def test_rate_limit(monkeypatch):
    monkeypatch.setenv("AZURE_SPEECH_KEY", "k")
    monkeypatch.setattr(sp, "RATE_LIMIT", 2)
    sp._hits.clear(); sp._cache["token"] = (__import__("time").time(), "t")
    codes = [c.get("/api/speech/token").status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_self_hosted_asr_is_off_unless_configured(monkeypatch):
    from fastapi.testclient import TestClient
    from api.main import app
    monkeypatch.delenv("WHISPER_MODEL", raising=False)
    monkeypatch.delenv("AZURE_SPEECH_KEY", raising=False)
    c = TestClient(app)
    assert c.get("/api/asr/config").json()["enabled"] is False
    r = c.post("/api/asr/transcribe", files={"audio": ("a.webm", b"x", "audio/webm")}, data={"lang": "ar"})
    assert r.status_code == 503



def test_recorded_answers_fall_back_to_azure_uae_north(monkeypatch):
    """Without our Whisper model, /api/asr/transcribe sends the decoded audio (WAV, 16 kHz) to Azure in UAE North."""
    import io, subprocess, tempfile, wave, pathlib
    import httpx
    import numpy as np
    from fastapi.testclient import TestClient
    from api.main import app
    monkeypatch.delenv("WHISPER_MODEL", raising=False)
    monkeypatch.setenv("AZURE_SPEECH_KEY", "test-key")
    monkeypatch.setenv("AZURE_SPEECH_REGION", "uaenorth")
    seen = {}

    class R:
        status_code = 200
        def raise_for_status(self): pass
        def json(self): return {"RecognitionStatus": "Success", "DisplayText": "أبوي صار ينسى"}

    def fake_post(url, content=None, timeout=None, headers=None):
        seen.update(url=url, headers=headers)
        with wave.open(io.BytesIO(content)) as w:
            seen["rate"], seen["frames"] = w.getframerate(), w.getnframes()
        return R()
    monkeypatch.setattr(httpx, "post", fake_post)
    d = pathlib.Path(tempfile.mkdtemp())
    import soundfile as sf
    sf.write(d / "a.wav", (0.2 * np.sin(2 * np.pi * 220 * np.arange(32000) / 16000)).astype("float32"), 16000)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(d / "a.wav"), "-c:a", "libopus", str(d / "a.webm")], check=True)
    c = TestClient(app)
    cfg = c.get("/api/asr/config").json()
    assert cfg["enabled"] and cfg["engine"] == "azure-uaenorth" and cfg["prefer"] is False
    r = c.post("/api/asr/transcribe", files={"audio": ("a.webm", (d / "a.webm").read_bytes(), "audio/webm")}, data={"lang": "ar"})
    assert r.status_code == 200 and r.json()["text"] == "أبوي صار ينسى" and r.json()["engine"] == "azure-uaenorth"
    assert seen["url"].startswith("https://uaenorth.stt.speech.microsoft.com/") and "language=ar-AE" in seen["url"]
    assert seen["rate"] == 16000 and 1.8 * 16000 < seen["frames"] < 2.2 * 16000
    assert seen["headers"]["Ocp-Apim-Subscription-Key"] == "test-key"


def test_preload_is_a_no_op_without_a_model(monkeypatch):
    import threading
    import api.asr_local as A
    monkeypatch.delenv("WHISPER_MODEL", raising=False)
    n = threading.active_count()
    A.preload()
    assert threading.active_count() == n


def test_asr_config_does_not_claim_uae_unless_told(monkeypatch):
    from fastapi.testclient import TestClient
    from api.main import app
    c = TestClient(app)
    monkeypatch.delenv("SERVER_IN_UAE", raising=False)
    assert c.get("/api/asr/config").json()["in_uae"] is False
    monkeypatch.setenv("SERVER_IN_UAE", "1")
    assert c.get("/api/asr/config").json()["in_uae"] is True


class _SlowModel:
    """Stands in for Whisper: like faster-whisper, it does its work while the segments are read."""
    def __init__(self, seconds):
        self.seconds = seconds

    def transcribe(self, pcm, **kw):
        import time
        from types import SimpleNamespace

        def segs():
            time.sleep(self.seconds)
            yield SimpleNamespace(text=" مرحبا ")
        return segs(), SimpleNamespace(language="ar", duration=1.0)


def test_a_slow_transcription_does_not_hold_up_other_requests(monkeypatch):
    """Recognition runs in a worker thread: while one answer is transcribed, the server still answers everyone else
    (before, one recording froze the whole demo server, health checks included, and the host restarted it)."""
    import asyncio
    import numpy as np
    import api.asr_local as A
    monkeypatch.setenv("WHISPER_MODEL", "fake"); monkeypatch.delenv("AZURE_SPEECH_KEY", raising=False)
    monkeypatch.setattr(A, "decode", lambda data: np.zeros(16000, dtype=np.float32))
    monkeypatch.setitem(A._MODEL, "m", _SlowModel(3.0))

    async def go():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as ac:
            rec = asyncio.create_task(ac.post("/api/asr/transcribe", files={"audio": ("a.webm", b"x", "audio/webm")}, data={"lang": "ar"}))
            await asyncio.sleep(0.2)
            h = await ac.get("/health")
            answered_while_busy = not rec.done()   # the health check came back while the recording was still being transcribed
            r = await rec
            return h, answered_while_busy, r

    h, answered_while_busy, r = asyncio.run(go())
    assert h.status_code == 200 and answered_while_busy
    assert r.status_code == 200 and r.json()["text"] == "مرحبا"


def test_a_failed_model_load_is_retried_instead_of_breaking_speech_until_restart(monkeypatch):
    import sys
    from types import SimpleNamespace
    import api.asr_local as A
    monkeypatch.setenv("WHISPER_MODEL", "fake")
    monkeypatch.setitem(A._MODEL, "m", None); monkeypatch.setitem(A._MODEL, "err", None)
    calls = {"n": 0}

    def flaky(*a, **k):
        calls["n"] += 1
        if calls["n"] == 1:
            raise OSError("download interrupted")
        return _SlowModel(0)

    monkeypatch.setitem(sys.modules, "faster_whisper", SimpleNamespace(WhisperModel=flaky))
    monkeypatch.setattr(A, "RETRY_AFTER_S", 0.2)
    import pytest
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as e:
        A._model()
    assert e.value.status_code == 503 and A.state() == "error"
    with pytest.raises(HTTPException):
        A._model()                      # inside the cool-down: no hammering the model hub
    assert calls["n"] == 1
    import time
    time.sleep(0.25)
    assert isinstance(A._model(), _SlowModel) and A.state() == "ready" and calls["n"] == 2


def test_mixed_arabic_english_is_decoded_piece_by_piece(monkeypatch):
    """Pieces split at pauses keep their own language; the page's language is the default; same-language neighbours merge."""
    import numpy as np
    import api.asr_local as A

    class Seg:
        def __init__(self, text):
            self.text = text

    class FakeModel:
        def detect_language(self, audio=None, **k):
            en = float(audio.mean()) > 0          # stand-in: positive samples "sound English"
            return ("en" if en else "ar"), 0.9, [("en", 0.9 if en else 0.05), ("ar", 0.05 if en else 0.9)]

        def transcribe(self, audio, language=None, **k):
            return [Seg(f"[{language}:{len(audio) // 16000}s]")], None

    sec = 16000
    pcm = np.concatenate([-np.ones(3 * sec), np.zeros(sec // 2), -np.ones(2 * sec), np.zeros(sec // 2), np.ones(3 * sec)]).astype("float32")
    pieces = [(0, 3 * sec), (int(3.5 * sec), int(5.5 * sec)), (6 * sec, 9 * sec)]   # Arabic, Arabic, English
    monkeypatch.setattr(A, "_model", lambda: FakeModel())
    monkeypatch.setattr(A, "_split", lambda p: pieces)
    text, info, _ = A.whisper_text(pcm, "ar")
    assert text == "[ar:5s] [en:3s]" and info.language == "ar+en"   # two Arabic pieces merged, English kept as English
    monkeypatch.setattr(A, "_split", lambda p: [(0, 3 * sec)])
    text, info, _ = A.whisper_text(pcm[: 3 * sec], "ar")
    assert info.language == "ar"                                     # plain Arabic stays Arabic
    monkeypatch.setattr(A, "MIXED", False)
    text, info, _ = A.whisper_text(pcm, "ar")
    assert info.language == "ar"                                     # switch off with ASR_MIXED=0
