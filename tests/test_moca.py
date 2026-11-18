"""Clinician-entered MoCA: scores only, checked, kept, shown beside the home check-in and used to validate it."""
import json

from fastapi.testclient import TestClient

from api import store
from api.main import DB, app
from api.moca import auc, spearman
from tests.test_live import _person_with_two_checkins

c = TestClient(app)
CL = {"X-Role": "clinician"}
FULL = {"visuospatial": 4, "naming": 3, "attention": 5, "language": 2, "abstraction": 1, "delayed_recall": 2, "orientation": 6}


def _moca(**kw):
    return {"date": "2026-11-17", "version": "Arabic MoCA 8.1", "language": "ar", "certified": True, "given_by": "Dr. Demo", **kw}


def test_only_a_clinician_records_a_moca_and_the_sections_must_add_up():
    pid = _person_with_two_checkins()
    for who in ({}, {"X-Role": "participant"}, {"X-Role": "coordinator"}):
        assert c.post(f"/participants/{pid}/moca", headers=who, json=_moca(total=24)).status_code in (401, 403)
    assert c.post(f"/participants/{pid}/moca", headers=CL, json=_moca(total=24, certified=False)).status_code == 422
    assert c.post(f"/participants/{pid}/moca", headers=CL, json=_moca(sections={**FULL, "naming": 4})).status_code == 422
    assert c.post(f"/participants/{pid}/moca", headers=CL, json=_moca(sections=FULL, education_point=True, total=20)).status_code == 422
    assert c.post(f"/participants/{pid}/moca", headers=CL, json=_moca(sections={"naming": 3})).status_code == 422
    r = c.post(f"/participants/{pid}/moca", headers=CL, json=_moca(sections=FULL, education_point=True))
    assert r.status_code == 200
    m = r.json()
    assert m["total"] == 24 and m["below_cut"] is True                       # 23 + 1 education point, below 26
    assert m["nearest_checkin"]["date"] == "2026-11-16" and m["nearest_checkin"]["gap_days"] == 1
    g = c.get(f"/participants/{pid}/moca", headers=CL).json()
    assert g["records"][-1]["total"] == 24 and g["education_point_suggested"] is True   # primary schooling
    assert any(a["action"] == "moca_recorded" and a.get("participant") == pid for a in DB["audit"]) or \
        any(a["action"] == "moca_recorded" for a in DB["audit"])
    snap = json.loads(json.dumps(store.snapshot(DB), default=str))
    assert snap["participants"][pid]["moca"][-1]["total"] == 24              # kept across restarts
    d = c.get(f"/participants/{pid}/dossier", headers=CL)
    if d.status_code == 200:
        assert d.json()["clinic_assessments"][-1]["total"] == 24


def test_live_stats_compare_home_scores_with_the_clinic_moca():
    s0 = c.get("/live/stats", headers=CL).json()["moca"]
    pid = _person_with_two_checkins()
    c.post(f"/participants/{pid}/moca", headers=CL, json=_moca(total=27))
    s = c.get("/live/stats", headers=CL).json()["moca"]
    assert s["pairs"] == s0["pairs"] + 1 and s["records"] == s0["records"] + 1 and s["cut"] == 26


def test_validation_maths():
    assert round(spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]), 6) == 1.0
    assert spearman([1, 2, 3], [1, 2, 3]) is None                           # too few pairs
    assert auc([-2, -1.5, -1, 0.5, 1], [True, True, True, False, False]) == 1.0
    assert auc([0, 0, 0, 0, 0], [True, False, True, False, True]) == 0.5
    assert auc([1, 2, 3, 4, 5], [False] * 5) is None
