import pytest
from fastapi.testclient import TestClient

from api.main import app
from membrain import navigator as N

c = TestClient(app)
CL = {"X-Role": "clinician"}


def test_state_machine_blocks_illegal_jumps_and_requires_reasons():
    r = N.new_referral("R1", "P", "memory_clinic", "SVC-01", "routine", "2026-11-01", "concern")
    with pytest.raises(ValueError):
        N.advance(r, "attended", "2026-11-02")
    N.advance(r, "sent", "2026-11-02")
    with pytest.raises(ValueError):
        N.advance(r, "declined", "2026-11-03")  # reason required
    N.advance(r, "declined", "2026-11-03", "outside catchment")
    assert N.is_unresolved(r)


def test_funding_never_removes_the_clinical_pathway():
    m = N.match_services("memory_clinic", {"language": "tl", "funding": "basic", "emirate": "Abu Dhabi"})
    assert m["services"], "clinically appropriate services must still be listed"
    assert m["gap"] and m["gap_action"]


def test_matching_prefers_accessible_services():
    m = N.match_services("memory_clinic", {"language": "ar", "funding": "basic", "emirate": "Abu Dhabi"})
    assert m["services"][0]["accessible"] and m["services"][0]["id"] == "SVC-02"


def test_next_steps_pack_bilingual_and_says_not_a_diagnosis():
    r = N.new_referral("R1", "P", "memory_clinic", "SVC-01", "routine", "2026-11-01", "concern")
    en = N.next_steps_pack(r, N.directory()[0], "en")
    ar = N.next_steps_pack(r, N.directory()[0], "ar")
    assert "NOT a diagnosis" in en["sections"][0] and "ليس تشخيصاً" in ar["sections"][0]


def test_api_closed_loop():
    ref = c.post("/participants/MB-1041/referrals", headers=CL,
                 json={"pathway": "audiology", "service_id": "SVC-08", "reason": "hearing difficulty", "date": "2026-11-14"}).json()
    rid = ref["id"]
    for st in ["sent", "accepted", "appointment_offered", "attended", "assessment_completed", "follow_up_documented"]:
        assert c.post(f"/referrals/{rid}/status", headers=CL, json={"state": st, "date": "2026-11-20"}).status_code == 200
    assert rid not in [x["id"] for x in c.get("/referrals?unresolved_only=true", headers=CL).json()]
    bad = c.post(f"/referrals/{rid}/status", headers=CL, json={"state": "sent", "date": "2026-11-21"})
    assert bad.status_code == 422


def test_programme_metrics_and_fhir_service_request():
    m = c.get("/programme/metrics", headers=CL).json()
    assert m["referrals"] >= 4 and "by_entry_route" in m
    b = c.get("/participants/MB-1322/fhir", headers=CL).json()
    assert any(e["resource"]["resourceType"] == "ServiceRequest" for e in b["entry"])


def test_simulated_pathways_metrics():
    refs, people = N.simulate_pathways(80, seed=1)
    m = N.programme_metrics(refs, people)
    assert 0 < m["completion_rate"] <= 1 and m["pathway_gaps"] >= 0
