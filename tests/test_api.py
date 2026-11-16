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


def test_azure_speech_token_endpoint():
    r = c.get("/api/speech/token")
    # If key is configured, it returns 200 with token and region
    if r.status_code == 200:
        data = r.json()
        assert "token" in data
        assert data["region"] == "uaenorth"
        assert len(data["token"]) > 20
    else:
        # If running in environment without key, it gracefully returns 503
        assert r.status_code in (503, 502)


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


def test_cases_carry_evaluation_task_and_concern():
    cases = c.get("/cases", headers=CL).json()
    by = {x["participant"]["id"]: x for x in cases}
    assert by["MB-1322"]["latest"]["level"] == "URGENT"
    assert by["MB-1322"]["task"]["status"] in ("open", "in_progress", "closed")
    assert "missing" in by["MB-1322"]["concern"]
    assert c.get("/cases", headers={"X-Role": "participant"}).status_code == 403
    full = c.get("/cases/MB-1187", headers=CL).json()
    assert full["dossier"] and full["latest"]["level"] == "CLINICIAN_REVIEW"


def test_concern_from_chat_opens_review_task():
    body = {"reporter": "family", "lang": "en", "narrative": "Dad keeps asking the same questions. My brother drives him and pays his bills.",
            "domains": ["memory"], "onset": "years", "timeline": [["driving", "brother"], ["money", "brother"]],
            "red_flags": [], "confounders": [], "date": "2026-11-14"}
    case = c.post("/concerns", json=body).json()
    pid = case["participant"]["id"]
    assert case["latest"]["level"] == "CLINICIAN_REVIEW"
    assert any(t["participant_id"] == pid for t in c.get("/queue", headers=CL).json())
    assert any(a["action"] == "concern_raised" and a["target"] == pid for a in c.get("/audit", headers=CL).json())
    assert c.get(f"/cases/{pid}", headers=CL).json()["concern"]["in_their_words"].startswith("Dad keeps")


def test_concern_with_red_flag_is_urgent_and_bad_reporter_rejected():
    body = {"reporter": "family", "lang": "ar", "narrative": "أبوي طاح أمس وضرب راسه", "red_flags": ["recent_fall_head_injury"], "date": "2026-11-14"}
    assert c.post("/concerns", json=body).json()["latest"]["level"] == "URGENT"
    assert c.post("/concerns", json=body | {"reporter": "stranger"}).status_code == 422
