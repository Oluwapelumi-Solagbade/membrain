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
    c = TestClient(app)
    assert c.get("/api/asr/config").json() == {"enabled": False, "prefer": False, "engine": None, "label": "MemBrain Gulf Whisper (in-country)"}
    r = c.post("/api/asr/transcribe", files={"audio": ("a.webm", b"x", "audio/webm")}, data={"lang": "ar"})
    assert r.status_code == 503
