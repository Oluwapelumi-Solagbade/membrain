"""Enrolment from the site's enrolment screen: identity in the vault only, consent per data type, the informant's role
(never their name) on the record, the red-flag screen before any testing, and the phone number linked to sign-in."""
import pytest
from fastapi.testclient import TestClient

import api.auth as A
from api.main import DB, VAULT, app

c = TestClient(app)


@pytest.fixture(autouse=True)
def strict(monkeypatch):
    monkeypatch.setenv("ALLOW_ROLE_HEADER", "0")
    A._fails.clear()


def staff():
    tok = c.post("/auth/clinician/login", json={"email": "coordinator@membrain.ae", "password": A._demo_password()}).json()["token"]
    return {"Authorization": f"Bearer {tok}"}


def body(**kw):
    b = {"age": 64, "sex": "F", "education": "primary", "language": "ar", "dialect": "Emirati", "date": "2026-11-14",
         "identity": {"full_name": "Test Mariam", "national_id": "784-1960-0000000-0", "phone": "050 765 4321", "preferred_channel": "whatsapp"},
         "informant": {"name": "Test Daughter", "relation": "daughter", "phone": "0501112222"},
         "informant_profile": {"type": "family", "relation": "daughter", "timeline": [{"activity_key": "money", "change": "stopped paying bills", "when": "this year"}]},
         "concern": {"route": "family", "text": "repeats questions, missed bills", "onset": "months", "red_flags": []},
         "consent": {"voice_features": True, "clinical_record": True, "family_history": True, "caregiver_involvement": True, "genomics": False},
         "context": {"sbp": 150, "dbp": 90, "hba1c": 6.9, "family_history_dementia": True}, "emirate": "Abu Dhabi", "funding": "thiqa", "iqcode": 3.6}
    return b | kw


def test_enrolment_keeps_identity_in_the_vault_and_links_the_phone_to_sign_in():
    r = c.post("/participants", headers=staff(), json=body())
    assert r.status_code == 200, r.text
    j = r.json()
    pid, case = j["id"], j["case"]
    assert j["phone_linked"] is True
    rec = DB["participants"][pid]
    assert "Test Mariam" not in str(rec) and "Test Daughter" not in str(rec) and "784-1960" not in str(rec)
    assert VAULT[pid]["identity"]["full_name"] == "Test Mariam"
    assert rec["informant"]["relation"] == "daughter" and rec["pending_iqcode"] == 3.6 and rec["enrolled"] is True
    assert rec["sessions"][0]["reported_concern"]["activities_taken_over"] == ["money"]
    assert case["participant"]["id"] == pid and case["risk_context"]["count"] >= 2   # blood pressure and HbA1c
    # the person signs in with the number given at enrolment and lands on their own record
    s = c.post("/auth/patient/start", json={"phone": "+971507654321"}).json()
    assert s["known"] is True
    me = c.post("/auth/patient/verify", json={"challenge_id": s["challenge_id"], "code": s["demo_code"]}).json()
    assert me["user"]["pid"] == pid


def test_a_red_flag_at_enrolment_opens_an_urgent_review():
    j = c.post("/participants", headers=staff(), json=body(identity=None, informant=None,
               concern={"route": "family", "text": "sudden confusion since this morning", "onset": "days", "red_flags": ["sudden_onset"]})).json()
    assert j["case"]["latest"]["level"] == "URGENT"
    assert any(t["participant_id"] == j["id"] and t["level"] == "URGENT" and t["status"] == "open" for t in DB["tasks"].values())


def test_consent_decides_what_is_kept():
    j = c.post("/participants", headers=staff(), json=body(identity=None, consent={"clinical_record": False, "family_history": False, "genomics": True},
               apoe="e3/e4", informant_profile={"type": "household_helper", "relation": "household_helper", "consented": False})).json()
    rec = DB["participants"][j["id"]]
    assert rec["context"]["sbp"] is None and rec["context"]["hba1c"] is None and rec["context"]["family_history_dementia"] is None
    assert rec["informant"] is None                       # a helper who has not agreed is not involved
    assert rec["genomics"]["apoe"] == "e3/e4"             # imported only because genomics was consented


def test_enrolment_is_for_staff_and_for_ages_50_to_75():
    assert c.post("/participants", json=body()).status_code == 401
    assert c.post("/participants", headers=staff(), json=body(age=45)).status_code == 422


def test_a_check_in_gets_its_own_message_even_with_a_later_report_on_the_record():
    """Reports carry real dates and check-ins the demo's; the person must hear about the check-in they just did, not
    about a later report (here an urgent one, which the clinician handles through its own task)."""
    h = staff()
    pid = c.post("/participants", headers=h, json=body(identity=None, iqcode=None, concern=None)).json()["id"]
    later = {"reporter": "family", "lang": "ar", "narrative": "fell and hit his head", "domains": ["memory"], "onset": "days",
             "timeline": [], "red_flags": ["recent_fall_head_injury"], "confounders": [], "date": "2026-11-20"}
    assert c.post(f"/participants/{pid}/concerns", headers=h, json=later).json()["latest"]["level"] == "URGENT"
    from tests.test_api import _answers
    r = c.post(f"/participants/{pid}/sessions", headers=h, json={"date": "2026-11-14", "form": "A", "lang": "ar", "transcripts": _answers("A", "ar"),
               "audio": {"snr_db": 25, "clipping": 0, "speech_ratio": 0.5, "duration_s": 30}})
    assert r.status_code == 200 and r.json()["message"]["key"] == "BASELINE" and r.json()["level"] == "BASELINE"
