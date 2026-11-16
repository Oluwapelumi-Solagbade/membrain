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
