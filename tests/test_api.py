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


def test_concern_from_a_professional_maps_to_primary_care_route():
    body = {"reporter": "professional", "lang": "en", "narrative": "GP noticed a decline in memory at the last visit.",
            "domains": ["memory"], "date": "2026-11-14"}
    case = c.post("/concerns", json=body).json()
    assert case["participant"]["entry_route"] == "primary_care" and case["latest"]["level"] == "CLINICIAN_REVIEW"
    assert case["concern"]["raised_by"] == "Healthcare professional"
    assert c.post("/concerns", json=body | {"reporter": "primary_care"}).status_code == 422


def _answers(form, lang):
    from membrain.items import FLUENCY_LEXICON, JUDGEMENT, STORIES, WORD_LISTS
    w = WORD_LISTS[form][lang]
    return {"memory_immediate": " ".join(w[:7]), "memory_delayed": " ".join(w[:6]),
            "fluency": " ".join(FLUENCY_LEXICON[form][lang].split()[:16]),
            "story_recall": STORIES[form][lang], "judgement": " ".join(r[0] for r in JUDGEMENT[form]["rubric"][lang][:3])}


def test_check_in_after_a_concern_needs_age_and_schooling_then_scores_with_the_form_used():
    case = c.post("/concerns", json={"reporter": "self", "lang": "en", "narrative": "I keep forgetting appointments lately.",
                                     "domains": ["memory"], "date": "2026-11-16"}).json()
    pid = case["participant"]["id"]
    body = {"date": "2026-11-16", "form": "C", "lang": "en", "transcripts": _answers("C", "en"), "phq2": 0, "gad2": 0,
            "sleep_hours": 7.5, "input_mode": "typed (demo)"}
    assert c.post(f"/participants/{pid}/sessions", json=body).status_code == 409
    assert c.patch(f"/participants/{pid}/profile", json={"age": 66, "education": "secondary"}).status_code == 200
    r = c.post(f"/participants/{pid}/sessions", json=body).json()
    assert r["level"] == "BASELINE" and r["message"]["key"] == "BASELINE"
    s = c.get(f"/cases/{pid}", headers=CL).json()["participant"]["sessions"][-1]
    assert s["form"] == "C" and s["lang"] == "en" and s["raw"]["memory_immediate"] == 7


def test_check_in_scores_in_the_language_it_was_done_in():
    body = {"date": "2026-12-20", "form": "A", "lang": "en", "transcripts": _answers("A", "en")}
    r = c.post("/participants/MB-1041/sessions", json=body)   # Fatima enrolled in Arabic, did this one in English
    assert r.status_code == 200
    s = c.get("/cases/MB-1041", headers=CL).json()["participant"]["sessions"][-1]
    assert s["raw"]["memory_immediate"] == 7 and s["lang"] == "en"
    assert c.patch("/participants/MB-1041/profile", json={"age": 50, "education": "none"}).status_code == 409
    c.post("/demo/reset")


def test_a_later_check_in_does_not_close_a_review_the_concern_opened():
    case = c.post("/concerns", json={"reporter": "family", "lang": "en", "narrative": "Mum keeps forgetting and my sister now pays her bills.",
                                     "domains": ["memory"], "timeline": [["money", "sister"]], "date": "2026-11-14"}).json()
    pid = case["participant"]["id"]
    assert case["task"]["level"] == "CLINICIAN_REVIEW"
    c.patch(f"/participants/{pid}/profile", json={"age": 70, "education": "primary"})
    c.post(f"/participants/{pid}/sessions", json={"date": "2026-11-15", "form": "A", "lang": "en", "transcripts": _answers("A", "en")})
    after = c.get(f"/cases/{pid}", headers=CL).json()
    assert after["latest"]["level"] != "CLINICIAN_REVIEW"            # the check-in itself looks fine...
    assert after["task"]["level"] == "CLINICIAN_REVIEW" and after["task"]["status"] == "open"   # ...the review stays open
    assert any(t["participant_id"] == pid for t in c.get("/queue", headers=CL).json())
    tid = after["task"]["id"]
    c.post(f"/tasks/{tid}/action", headers=CL, json={"action": "dismiss", "note": "Reviewed with the family"})
    assert c.get(f"/cases/{pid}", headers=CL).json()["task"]["status"] == "closed"
    c.post("/demo/reset")
