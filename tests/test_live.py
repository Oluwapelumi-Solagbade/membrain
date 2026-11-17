"""Live data: what real visitors add is kept apart from the synthetic people, survives a restart, and feeds live stats."""
import json

from fastapi.testclient import TestClient

from api import store
from api.main import DB, app
from membrain.personas import personas
from tests.test_api import _answers

c = TestClient(app)
CL = {"X-Role": "clinician"}


def _person_with_two_checkins(day1="2026-11-16", day2="2026-11-30"):
    case = c.post("/concerns", json={"reporter": "family", "lang": "en", "narrative": "Dad forgets and the maid gives his medicines now.",
                                     "domains": ["memory"], "date": day1}).json()
    pid = case["participant"]["id"]
    assert c.patch(f"/participants/{pid}/profile", json={"age": 71, "education": "primary"}).status_code == 200
    for d, f in ((day1, "A"), (day2, "B")):
        r = c.post(f"/participants/{pid}/sessions", json={"date": d, "form": f, "lang": "en", "transcripts": _answers(f, "en"),
                                                          "phq2": 0, "gad2": 0, "sleep_hours": 7})
        assert r.status_code == 200
    return pid


def test_live_stats_count_only_what_visitors_did_and_need_a_clinician():
    assert c.get("/live/stats").status_code in (401, 403)
    before = c.get("/live/stats", headers=CL).json()
    pid = _person_with_two_checkins()
    s = c.get("/live/stats", headers=CL).json()
    assert s["people"] == before["people"] + 1 and s["new_records"] == before["new_records"] + 1
    assert s["concerns"] == before["concerns"] + 1 and s["checkins"] == before["checkins"] + 2
    assert s["completion"]["scored"] == before["completion"]["scored"] + 2
    assert s["reliability"]["pairs"] == before["reliability"]["pairs"] + 1
    assert s["reporters"]["family"] >= 1
    assert any(r["group"] == "70+" for r in s["segments"]["age"])
    assert "sensitivity" in s["not_measurable_yet"]
    # the synthetic people's made-up history is never counted
    synthetic_sessions = sum(len(p["sessions"]) for p in personas())
    assert s["checkins"] + s["concerns"] + s["family_questionnaires"] < synthetic_sessions + 50
    assert pid in DB["participants"]


def test_snapshot_survives_a_restart_and_a_demo_reset():
    pid = _person_with_two_checkins("2026-10-01", "2026-10-20")
    extra = c.post("/participants/MB-1041/sessions", json={"date": "2026-11-17", "form": "C", "lang": "ar", "transcripts": _answers("C", "ar")})
    assert extra.status_code == 200
    snap = json.loads(json.dumps(store.snapshot(DB), default=str))   # what would be written to the dataset
    assert pid in snap["participants"] and "MB-1041" in snap["added_to_synthetic"]
    assert "MB-1187" not in snap["participants"]                      # synthetic people are not copied

    # a restart: fresh synthetic data, then the saved snapshot on top
    fresh = {"participants": {p["id"]: p for p in personas()}, "tasks": {}, "audit": []}
    n_before = len(fresh["participants"]["MB-1041"]["sessions"])
    store.merge(fresh, snap)
    assert pid in fresh["participants"] and len(fresh["participants"][pid]["sessions"]) == 3
    assert len(fresh["participants"]["MB-1041"]["sessions"]) > n_before

    # a demo reset restores the synthetic people but keeps what visitors added
    assert c.post("/demo/reset").status_code == 200
    assert pid in DB["participants"]


def test_save_writes_a_local_copy_when_configured(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.delenv("STORE_REPO", raising=False)
    _person_with_two_checkins("2026-09-01", "2026-09-15")
    store._save_now()
    saved = json.loads((tmp_path / "snapshot.json").read_text("utf-8"))
    assert saved["version"] == store.VERSION and saved["participants"]
    assert store.status()["enabled"] and not store.status()["permanent"]


def test_ai_letters_are_measured_drafts_edits_and_approvals(monkeypatch):
    import api.navai as N
    monkeypatch.setattr(N, "_llm", lambda m, max_tokens=400, task="draft":
                        "A household helper reports changes in memory. The patient has dementia. No diagnosis has been made.")
    before = c.get("/live/stats", headers=CL).json()["letters"]
    case = c.post("/concerns", json={"reporter": "helper", "lang": "en", "narrative": "He forgets his medicines; I give them now.",
                                     "domains": ["memory"], "date": "2026-11-17", "timeline": [["medicines", "helper"]]}).json()
    pid = case["participant"]["id"]
    d = c.post(f"/api/referral/draft/{pid}", headers=CL).json()
    assert d["engine"] != "template" and len(d["removed"]) == 1
    text = " ".join(d["sentences"])
    assert c.post(f"/api/referral/draft/{pid}/approve", json={"draft": text, "final": text, "engine": d["engine"]}).status_code in (401, 403)
    same = c.post(f"/api/referral/draft/{pid}/approve", headers=CL, json={"draft": text, "final": text, "engine": d["engine"]}).json()
    edited = c.post(f"/api/referral/draft/{pid}/approve", headers=CL,
                    json={"draft": text, "final": text + " Please see within four weeks.", "engine": d["engine"]}).json()
    assert same["unchanged"] and same["similarity"] == 1.0 and not edited["unchanged"] and 0.5 < edited["similarity"] < 1
    L = c.get("/live/stats", headers=CL).json()["letters"]
    assert L["by_medgemma"] == before["by_medgemma"] + 1 and L["sentences_removed"] >= before["sentences_removed"] + 1
    assert L["approved_medgemma"] == before["approved_medgemma"] + 2 and L["accepted_unchanged"] == before["accepted_unchanged"] + 1
    assert 0 < L["removed_share"] <= 1 and L["median_similarity"] is not None


def _route(span=4, form="A", date="2026-11-17"):
    trials = [{"length": n, "correct": n <= span, "steps_correct": n if n <= span else n - 2, "ms": 900 * n} for n in range(3, span + 2)]
    return {"task": "souq_route", "version": "sr-0.1", "form": form, "date": date, "lang": "ar", "span": span, "trials": trials}


def test_souq_route_is_saved_shown_as_exploratory_and_never_changes_triage():
    before = c.get("/cases/MB-1041", headers=CL).json()["latest"]["level"]
    r = c.post("/participants/MB-1041/exploratory", headers=CL, json=_route(span=2)).json()   # a very low span
    assert r["saved"] and r["span"] == 2 and 0 < r["accuracy"] <= 1 and r["ms_per_step"] > 0
    case = c.get("/cases/MB-1041", headers=CL).json()
    assert case["latest"]["level"] == before                                                # triage untouched
    assert case["participant"]["exploratory"][-1]["task"] == "souq_route"
    snap = json.loads(json.dumps(store.snapshot(DB), default=str))
    assert snap["added_to_synthetic"]["MB-1041"]["exploratory"]                             # survives a restart
    fresh = {"participants": {p["id"]: p for p in personas()}, "tasks": {}, "audit": []}
    store.merge(fresh, snap)
    assert fresh["participants"]["MB-1041"]["exploratory"][-1]["span"] == 2
    s = c.get("/live/stats", headers=CL).json()["souq_route"]
    assert s["done"] >= 1 and s["median_span"] is not None


def test_souq_route_rejects_bad_input_and_other_peoples_records():
    assert c.post("/participants/MB-1041/exploratory", headers=CL, json=_route() | {"task": "something_else"}).status_code == 422
    assert c.post("/participants/MB-1041/exploratory", headers=CL, json=_route() | {"span": 42}).status_code == 422
    assert c.post("/participants/NOPE/exploratory", headers=CL, json=_route()).status_code == 404
