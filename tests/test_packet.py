"""Clinician review packet: rules always; Med42 (when on) only through the grounding checks."""
import json

from fastapi.testclient import TestClient

from api import med42
from api.main import DB, app
from membrain import packet as PK
from membrain.dossier import build_dossier
from membrain.triage import evaluate

c = TestClient(app)
CL = {"X-Role": "clinician"}


def _fs(pid="MB-1187"):
    p = DB["participants"][pid]
    ev = evaluate(p, p["sessions"])
    return PK.facts(p, ev, build_dossier(p, ev))


def test_rules_packet_for_staff_only_and_med42_off_by_default():
    assert c.post("/participants/MB-1187/review-packet").status_code in (401, 403)
    assert c.post("/participants/MB-1187/review-packet", headers={"X-Role": "participant"}).status_code in (401, 403)
    r = c.post("/participants/MB-1187/review-packet", headers=CL).json()
    assert r["engine"] == "rules" and "switched off" in r["fallback_reason"]
    checks = {x["check"] for x in r["rule_out"]}
    assert {"thyroid", "b12_folate", "medication", "blood_pressure", "glucose"} <= checks     # BP 151, HbA1c 6.9
    assert r["summary"] and r["gaps"] and all(f["id"].startswith("F") for f in r["facts"])
    assert any(a["action"] == "review_packet_drafted" for a in DB["audit"])


def test_med42_answer_is_kept_only_where_grounded(monkeypatch):
    fs = _fs()
    good = {"summary": [{"text": "Delayed word recall fell from 5.0 to 4 with blood pressure 151/90.", "facts": ["F3", "F7"]},
                        {"text": "This looks like early Alzheimer's disease.", "facts": ["F3"]},          # diagnosis: dropped
                        {"text": "Recall fell to 2 of 10.", "facts": ["F3"]},                               # number not in facts
                        {"text": "Memory is worse.", "facts": ["F99"]}],                                    # fact does not exist
            "rule_out": [{"check": "blood_pressure", "why": "Systolic 151 is raised.", "facts": ["F7"]},
                         {"check": "brain_mri", "why": "Imaging.", "facts": []}],                           # not in the fixed list
            "ask": [{"q": "Has anyone noticed changes in managing medicines?", "facts": []},
                    {"q": "Should we start donepezil 5 mg?", "facts": []}]}                               # treatment: dropped
    __import__("api.packet").packet._HITS.clear()
    monkeypatch.setattr(med42, "available", lambda: True)
    monkeypatch.setattr(med42, "complete", lambda m, max_tokens=700: "Here you go:\n" + json.dumps(good))
    r = c.post("/participants/MB-1187/review-packet", headers=CL).json()
    assert r["engine"] == "Med42-v2-8B" and r["removed"] == 5 and r["kept"] == 3
    assert [s["text"] for s in r["summary"]] == ["Delayed word recall fell from 5.0 to 4 with blood pressure 151/90."]
    assert r["rule_out"][0]["check"] == "blood_pressure" and "thyroid" in {x["check"] for x in r["rule_out"]}  # routine kept
    assert len(r["ask"]) == 1


def test_med42_failure_or_garbage_falls_back_to_rules(monkeypatch):
    __import__("api.packet").packet._HITS.clear()
    monkeypatch.setattr(med42, "available", lambda: True)
    monkeypatch.setattr(med42, "complete", lambda m, max_tokens=700: "I cannot help with that.")
    r = c.post("/participants/MB-1187/review-packet", headers=CL).json()
    assert r["engine"] == "rules" and "failed the checks" in r["fallback_reason"]
    monkeypatch.setattr(med42, "complete", lambda m, max_tokens=700: None)
    assert c.post("/participants/MB-1187/review-packet", headers=CL).json()["fallback_reason"] == "Med42 unavailable"


def test_med42_never_sees_names_from_the_concern():
    p = {"id": "X", "sessions": [], "context": {}}
    d = {"participant": {"age": 70}, "concern": {"raised_by": "Family member", "in_their_words": "My father Ahmed Al Mansoori forgets, call 0501234567"}}
    text = " ".join(f["text"] for f in PK.facts(p, {}, d))
    assert "Mansoori" not in text and "0501234567" not in text
