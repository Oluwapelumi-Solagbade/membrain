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
                 json={"age": 63, "education": "secondary", "language": "en", "consent": {"voice_features": True}}).json()
    pid, form = pid["id"], pid["first_form"]
    from membrain.items import FLUENCY_LEXICON, JUDGEMENT, STORIES, WORD_LISTS
    w = WORD_LISTS[form]["en"]
    tr = {"memory_immediate": " ".join(w[:6]), "memory_delayed": " ".join(w[:4]),
          "fluency": " ".join(FLUENCY_LEXICON[form]["en"].split()[:16]),
          "story_recall": STORIES[form]["en"], "judgement": " ".join(r[0] for r in JUDGEMENT[form]["rubric"]["en"][:3])}
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


def test_identity_kept_out_of_analytics_and_reid_is_audited():
    body = {"age": 66, "education": "primary", "language": "ar",
            "identity": {"full_name": "Test Person", "national_id": "784-0000-0000000-0", "phone": "+971500000000", "preferred_channel": "whatsapp"},
            "informant": {"name": "Daughter", "relation": "daughter"},
            "consent": {"voice_features": True, "caregiver_involvement": True}}
    pid = c.post("/participants", headers={"X-Role": "coordinator"}, json=body).json()["id"]
    ev_list = c.get("/participants", headers=CL).json()
    assert "Test Person" not in str(ev_list)
    assert c.post(f"/participants/{pid}/reidentify", headers=CL, json={}).status_code == 422
    r = c.post(f"/participants/{pid}/reidentify", headers=CL, json={"reason": "arrange follow-up call"})
    assert r.json()["identity"]["full_name"] == "Test Person"
    assert any(a["action"] == "reidentify" and a["target"] == pid for a in c.get("/audit", headers=CL).json())


def test_consent_withdrawal_purges_voice_features():
    pid = "MB-1322"
    c.patch(f"/participants/{pid}/consent", headers=CL, json={"voice_features": False})
    from api.main import DB
    assert all(s.get("voice_features") is None for s in DB["participants"][pid]["sessions"])
