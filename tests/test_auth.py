"""Sign-in: clinicians by email and password, patients by phone and one-time code, and what each may then touch.
These run with the old X-Role header switched off, as the deployed API does."""
import pytest
from fastapi.testclient import TestClient

import api.auth as A
from api.main import DB, app

c = TestClient(app)


@pytest.fixture(autouse=True)
def strict(monkeypatch):
    monkeypatch.setenv("ALLOW_ROLE_HEADER", "0")
    A._fails.clear()
    yield
    A._fails.clear()


def bearer(tok):
    return {"Authorization": f"Bearer {tok}"}


def clinician():
    r = c.post("/auth/clinician/login", json={"email": "Dr.Demo@membrain.ae ", "password": A._demo_password()})
    assert r.status_code == 200
    return r.json()["token"]


def patient(phone, claim=None):
    s = c.post("/auth/patient/start", json={"phone": phone}).json()
    body = {"challenge_id": s["challenge_id"], "code": s["demo_code"]}
    if claim:
        body["claim"] = claim
    r = c.post("/auth/patient/verify", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_nothing_clinical_without_signing_in():
    assert c.get("/cases").status_code == 401
    assert c.get("/cases", headers={"X-Role": "clinician"}).status_code == 401   # the header no longer counts
    assert c.get("/queue").status_code == 401


def test_clinician_sign_in_and_out():
    assert c.post("/auth/clinician/login", json={"email": "dr.demo@membrain.ae", "password": "wrong"}).status_code == 401
    tok = clinician()
    assert len(c.get("/cases", headers=bearer(tok)).json()) >= 7
    me = c.get("/auth/me", headers=bearer(tok)).json()
    assert me["role"] == "clinician" and "password" not in me
    c.post("/auth/logout", headers=bearer(tok))
    assert c.get("/cases", headers=bearer(tok)).status_code == 401
    assert any(a["action"] == "sign_in" and a["actor"] == "u-clin-1" for a in DB["audit"])


def test_passwords_are_stored_hashed_and_guessing_is_slowed():
    stored = A.USERS["dr.demo@membrain.ae"]["password"]
    assert A._demo_password() not in stored and stored.startswith("pbkdf2_sha256$")
    for _ in range(5):
        c.post("/auth/clinician/login", json={"email": "dr.demo@membrain.ae", "password": "guess"})
    assert c.post("/auth/clinician/login", json={"email": "dr.demo@membrain.ae", "password": A._demo_password()}).status_code == 429


def test_patient_sees_and_changes_only_their_own_record():
    s = patient("050 000 1041")
    assert s["user"]["pid"] == "MB-1041" and s["user"]["phone"].endswith("1041")
    h = bearer(s["token"])
    cases = c.get("/cases", headers=h).json()
    assert [x["participant"]["id"] for x in cases] == ["MB-1041"]
    assert c.get("/cases/MB-1187", headers=h).status_code == 403
    assert c.get("/queue", headers=h).status_code == 403
    body = {"date": "2026-11-20", "form": "A", "lang": "ar", "transcripts": {"memory_immediate": "جمل"}}
    assert c.post("/participants/MB-1187/sessions", json=body, headers=h).status_code == 403
    assert c.post("/participants/MB-1041/sessions", json=body, headers=h).status_code == 200
    c.post("/demo/reset")


def test_wrong_codes_run_out():
    s = c.post("/auth/patient/start", json={"phone": "+971500001187"}).json()
    wrong = "000000" if s["demo_code"] != "000000" else "111111"
    for _ in range(4):
        assert c.post("/auth/patient/verify", json={"challenge_id": s["challenge_id"], "code": wrong}).status_code == 401
    assert c.post("/auth/patient/verify", json={"challenge_id": s["challenge_id"], "code": wrong}).status_code == 410
    assert c.post("/auth/patient/verify", json={"challenge_id": s["challenge_id"], "code": s["demo_code"]}).status_code == 410
    assert c.post("/auth/patient/start", json={"phone": "12"}).status_code == 422


def test_a_new_number_gets_its_own_record_or_claims_a_concern():
    fresh = patient("+971 55 123 4567")["user"]["pid"]
    assert fresh.startswith("MB-P") and DB["participants"][fresh]["age"] is None
    case = c.post("/concerns", json={"reporter": "self", "lang": "ar", "narrative": "أنسى المواعيد كثيرًا",
                                     "domains": ["memory"], "date": "2026-11-16"}).json()
    pid, tok = case["participant"]["id"], case["claim_token"]
    assert patient("+971 56 765 4321", claim={"pid": pid, "token": "forged"})["user"]["pid"] != pid
    assert patient("+971 52 222 3333", claim={"pid": pid, "token": tok})["user"]["pid"] == pid
    # Signing in again with the same number returns to the same record.
    assert patient("0522223333")["user"]["pid"] == pid


def staff(email):
    r = c.post("/auth/clinician/login", json={"email": email, "password": A._demo_password()})
    assert r.status_code == 200, r.text
    return r.json()


def test_each_hospital_sees_only_its_own_patients():
    abu_dhabi, al_ain = staff("dr.demo@membrain.ae"), staff("dr.alain@membrain.ae")
    coord = staff("coordinator@membrain.ae")
    assert abu_dhabi["user"]["hospital_id"] == "SVC-01" and al_ain["user"]["hospital_id"] == "SVC-02"
    seen = lambda s: {x["participant"]["id"] for x in c.get("/cases", headers=bearer(s["token"])).json()}  # noqa: E731
    ad, aa, co = seen(abu_dhabi), seen(al_ain), seen(coord)
    assert "MB-1041" in ad and "MB-1041" not in aa          # Fatima is under the Abu Dhabi memory clinic
    assert "MB-1187" in aa and "MB-1187" not in ad          # Ahmed is under Al Ain
    assert {"MB-1041", "MB-1187", "MB-1409"} <= co          # the programme coordinator sees every hospital
    h = bearer(al_ain["token"])
    for path in ("/cases/MB-1041", "/participants/MB-1041/dossier", "/participants/MB-1041/evaluation",
                 "/participants/MB-1041/moca", "/participants/MB-1041/family-message/suggest"):
        assert c.get(path, headers=h).status_code == 403, path
    assert c.post("/participants/MB-1041/review-packet?use_model=false", headers=h).status_code == 403
    assert c.post("/participants/MB-1041/referrals", headers=h, json={"pathway": "memory_clinic", "reason": "x", "date": "2026-11-19"}).status_code == 403
    assert all(t["participant_id"] not in ad - aa for t in c.get("/queue", headers=h).json())
    assert all(ref["participant_id"] != "MB-1041" for ref in c.get("/referrals", headers=h).json())
    assert c.get("/cases/MB-1041", headers=bearer(abu_dhabi["token"])).status_code == 200


def test_a_case_no_hospital_has_taken_on_can_be_claimed_once():
    abu_dhabi, al_ain = staff("dr.demo@membrain.ae"), staff("dr.alain@membrain.ae")
    pid = patient("0551234987")["user"]["pid"]                       # a new record, under no hospital yet
    assert c.get(f"/cases/{pid}", headers=bearer(al_ain["token"])).status_code == 200
    assert c.post(f"/participants/{pid}/hospital", json={"hospital_id": "SVC-01"}, headers=bearer(al_ain["token"])).status_code == 403
    r = c.post(f"/participants/{pid}/hospital", json={"hospital_id": "SVC-02"}, headers=bearer(al_ain["token"]))
    assert r.status_code == 200 and r.json()["participant"]["assigned_hospital"]["id"] == "SVC-02"
    assert c.get(f"/cases/{pid}", headers=bearer(abu_dhabi["token"])).status_code == 403
    assert c.post(f"/participants/{pid}/hospital", json={"hospital_id": "SVC-01"}, headers=bearer(abu_dhabi["token"])).status_code == 403
    coord = staff("coordinator@membrain.ae")                            # only the coordinator moves someone between hospitals
    assert c.post(f"/participants/{pid}/hospital", json={"hospital_id": "SVC-01"}, headers=bearer(coord["token"])).status_code == 200
    assert c.get(f"/cases/{pid}", headers=bearer(abu_dhabi["token"])).status_code == 200
