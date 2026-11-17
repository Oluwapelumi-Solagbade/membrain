"""Follow-up concerns and the family questionnaire (engine 0.5.0): the same person reported on again over time, and a
family member's questionnaire repeated at intervals. Run with the X-Role header off, as deployed."""
import pytest
from fastapi.testclient import TestClient

import api.auth as A
import api.main as M
from api.main import DB, app

c = TestClient(app)


@pytest.fixture(autouse=True)
def strict(monkeypatch):
    monkeypatch.setenv("ALLOW_ROLE_HEADER", "0")
    A._fails.clear()


def bearer(tok):
    return {"Authorization": f"Bearer {tok}"}


def clinician():
    return bearer(c.post("/auth/clinician/login", json={"email": "dr.demo@membrain.ae", "password": A._demo_password()}).json()["token"])


def patient(phone):
    s = c.post("/auth/patient/start", json={"phone": phone}).json()
    return c.post("/auth/patient/verify", json={"challenge_id": s["challenge_id"], "code": s["demo_code"]}).json()


def concern(**kw):
    body = {"reporter": "family", "lang": "en", "narrative": "She forgets names", "domains": ["memory"], "onset": "months",
            "timeline": [], "red_flags": [], "confounders": [], "date": "2026-11-01"}
    return body | kw


def tasks(pid):
    return [t for t in DB["tasks"].values() if t["participant_id"] == pid]


def test_a_concern_that_spreads_goes_to_review_and_nothing_new_opens_no_second_task():
    pid = c.post("/concerns", json=concern()).json()["participant"]["id"]
    assert tasks(pid) == []                                     # memory only, nothing taken over yet
    doc = clinician()
    r = c.post(f"/participants/{pid}/concerns", headers=doc, json=concern(date="2026-11-08", narrative="Same as before"))
    assert r.status_code == 200
    last = r.json()["latest"]
    assert last["concern_change"]["new_domains"] == [] and last["level"] == "BASELINE" and tasks(pid) == []
    r = c.post(f"/participants/{pid}/concerns", headers=doc, json=concern(
        date="2026-11-15", narrative="Now her daughter gives her the medicines and she loses words",
        domains=["memory", "language"], timeline=[["medicines", "daughter"]]))
    case = r.json()
    ch = case["latest"]["concern_change"]
    assert ch["new_domains"] == ["language"] and ch["new_activities"] == ["medicines"] and ch["since"] == "2026-11-01"
    assert case["latest"]["level"] == "CLINICIAN_REVIEW" and "spread since it was first reported on 2026-11-01" in case["latest"]["reasons"][0]
    assert len(tasks(pid)) == 1 and case["task"]["status"] == "open"
    # the same again a week later: nothing new, so the level is carried and no second task opens
    r = c.post(f"/participants/{pid}/concerns", headers=doc, json=concern(
        date="2026-11-22", narrative="No change", domains=["memory", "language"], timeline=[["medicines", "daughter"]]))
    assert r.json()["latest"]["carried"] is True and r.json()["latest"]["level"] == "CLINICIAN_REVIEW"
    assert len(tasks(pid)) == 1
    assert sum(1 for s in DB["participants"][pid]["sessions"] if s["type"] == "intake") == 4


def test_family_questionnaire_scores_holds_and_never_shows_the_family_a_score():
    doc = clinician()
    pid = c.post("/concerns", json=concern()).json()["participant"]["id"]
    low = {k: 0 for k in M.C.FAQ_ITEMS} | {"bills": 2, "remembering": 2}
    r = c.post(f"/participants/{pid}/informant", headers=doc, json={"date": "2026-11-02", "respondent": "child", "answers": low, "lang": "en"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert "score" not in j and "cannot diagnose" in j["message"]
    assert j["case"]["latest"]["informant"]["score"] == 4 and j["held_for_clinician"] is False
    high = {k: 1 for k in M.C.FAQ_ITEMS}                         # 10: at or above the cutoff of 9, a rise of 6
    j = c.post(f"/participants/{pid}/informant", headers=doc, json={"date": "2026-11-20", "respondent": "child", "answers": high, "lang": "ar"}).json()
    inf = j["case"]["latest"]["informant"]
    assert inf == {"instrument": "FAQ", "score": 10, "max": 30, "cutoff": 9, "previous": 4, "previous_date": "2026-11-02",
                   "change": 6, "at_or_above_cutoff": True}
    assert j["case"]["latest"]["level"] == "URGENT" and j["held_for_clinician"] is True and "تشخيص" in j["message"]
    assert "Family questionnaire (FAQ or IQCODE-16)" not in j["case"]["concern"]["missing"]


def test_questionnaire_must_be_complete_and_valid():
    doc = clinician()
    pid = c.post("/concerns", json=concern()).json()["participant"]["id"]
    part = {k: 0 for k in M.C.FAQ_ITEMS[:5]}
    assert c.post(f"/participants/{pid}/informant", headers=doc, json={"date": "2026-11-02", "respondent": "child", "answers": part}).status_code == 422
    bad = {k: 0 for k in M.C.FAQ_ITEMS} | {"bills": 4}
    assert c.post(f"/participants/{pid}/informant", headers=doc, json={"date": "2026-11-02", "respondent": "child", "answers": bad}).status_code == 422


def test_reports_need_sign_in_and_a_patient_may_only_report_on_their_own_record():
    pid = c.post("/concerns", json=concern()).json()["participant"]["id"]
    assert c.post(f"/participants/{pid}/concerns", json=concern(date="2026-11-09")).status_code == 401
    me = patient(A.demo_phone("MB-1041"))
    h = bearer(me["token"])
    assert c.post(f"/participants/{pid}/concerns", headers=h, json=concern(date="2026-11-09")).status_code == 403
    mine = me["user"]["pid"]
    r = c.post(f"/participants/{mine}/concerns", headers=h, json=concern(date="2026-11-30", reporter="self"))
    assert r.status_code == 200 and r.json()["participant"]["id"] == mine
    answers = {k: 0 for k in M.C.FAQ_ITEMS}
    r = c.post(f"/participants/{mine}/informant", headers=h, json={"date": "2026-11-30", "respondent": "spouse", "answers": answers})
    assert r.status_code == 200 and "case" not in r.json() and "score" not in r.text   # the family sees a message, not a score
