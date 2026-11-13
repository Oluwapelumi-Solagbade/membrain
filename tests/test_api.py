from fastapi.testclient import TestClient

from api.main import app

c = TestClient(app)
CL = {"X-Role": "clinician"}


def test_health():
    assert c.get("/health").json()["status"] == "ok"


def test_queue_sorted_urgent_first():
    q = c.get("/queue", headers=CL).json()
    assert q and q[0]["level"] == "URGENT"


def test_participant_cannot_see_queue():
    assert c.get("/queue", headers={"X-Role": "participant"}).status_code == 403


def test_enrol_and_transcript_session_flow():
    pid = c.post("/participants", headers={"X-Role": "coordinator"},
                 json={"age": 63, "education": "secondary", "language": "en", "consent": {"voice_features": True}}).json()["id"]
    tr = {"memory_immediate": "camel window orange teacher river coffee", "memory_delayed": "camel orange river coffee",
          "fluency": "dog cat camel horse goat sheep cow lion tiger elephant bird falcon eagle fish shark whale",
          "story_recall": "Fatima went with her grandson to the market in Al Ain on Friday, bought dates and a blue scarf, flat tyre, police helped",
          "judgement": "turn off the stove, get out and call 997"}
    r = c.post(f"/participants/{pid}/sessions", json={"date": "2026-11-01", "transcripts": tr,
                                                       "audio": {"snr_db": 25, "clipping": 0, "speech_ratio": 0.5, "duration_s": 30}}).json()
    assert r["message"]["key"] == "BASELINE"
    ev = c.get(f"/participants/{pid}/evaluation", headers=CL).json()
    assert ev["latest"]["level"] == "BASELINE"


def test_dismiss_requires_reason():
    tid = c.get("/queue", headers=CL).json()[0]["id"]
    assert c.post(f"/tasks/{tid}/action", headers=CL, json={"action": "dismiss"}).status_code == 422


def test_fhir_export():
    b = c.get("/participants/MB-1187/fhir", headers=CL).json()
    assert b["resourceType"] == "Bundle"
