"""Server voices for spoken instructions: off unless configured; Azure or Piper; cached; never blocks the check-in."""
from fastapi.testclient import TestClient

from api import tts
from api.main import app

c = TestClient(app)


def test_off_by_default_so_the_device_voice_is_used(monkeypatch):
    monkeypatch.delenv("AZURE_SPEECH_KEY", raising=False)
    monkeypatch.delenv("PIPER_TTS", raising=False)
    assert c.get("/api/speech/tts/config").json()["enabled"] is False
    assert c.get("/api/speech/tts", params={"text": "Hello", "lang": "en"}).status_code == 503


def test_azure_voice_when_the_key_is_set_and_answers_are_cached(monkeypatch):
    calls = []
    monkeypatch.setenv("AZURE_SPEECH_KEY", "test-key")
    monkeypatch.setattr(tts, "_azure_mp3", lambda text, lang, slow: calls.append((text, lang)) or b"ID3fake")
    cfg = c.get("/api/speech/tts/config").json()
    assert cfg["enabled"] and cfg["engine"] == "azure" and cfg["voices"]["ar"] == "ar-AE-FatimaNeural"
    for _ in range(3):
        r = c.get("/api/speech/tts", params={"text": "اسمع هذه الكلمات", "lang": "ar"})
        assert r.status_code == 200 and r.headers["content-type"] == "audio/mpeg" and r.content == b"ID3fake"
    assert len(calls) == 1
    assert c.get("/api/speech/tts", params={"text": "x" * 800, "lang": "en"}).status_code == 422


def test_a_failing_voice_answers_503_so_the_site_falls_back(monkeypatch):
    monkeypatch.delenv("AZURE_SPEECH_KEY", raising=False)
    monkeypatch.setenv("PIPER_TTS", "1")
    monkeypatch.setattr(tts, "_piper_wav", lambda *a: (_ for _ in ()).throw(RuntimeError("no voice")))
    assert c.get("/api/speech/tts", params={"text": "Hello there", "lang": "en"}).status_code == 503
