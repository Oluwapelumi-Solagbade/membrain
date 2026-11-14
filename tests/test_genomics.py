import copy

import pytest
from fastapi.testclient import TestClient

from api.main import app
from membrain import genomics as GX
from membrain.personas import personas
from membrain.triage import evaluate

c = TestClient(app)
CL = {"X-Role": "clinician"}


def khalid():
    return next(p for p in personas() if p["id"] == "MB-1322")


def test_no_consent_no_processing():
    p = khalid(); p["consent"]["genomics"] = False
    assert GX.genomic_context(p)["available"] is False


def test_genomics_never_changes_triage():
    p = khalid()
    with_g = [h["level"] for h in evaluate(p, p["sessions"])["history"]]
    q = copy.deepcopy(p); q["genomics"] = {"apoe": "e4/e4"}
    assert [h["level"] for h in evaluate(q, q["sessions"])["history"]] == with_g
    assert GX.genomic_context(q)["affects_triage"] is False


def test_homozygous_flags_aria_and_monitoring():
    p = khalid(); p["genomics"]["apoe"] = "e4/e4"
    g = GX.genomic_context(p)
    assert any(f["id"] == "aria_risk" for f in g["flags"])
    assert any(r["id"] == "monitoring_interval" for r in g["recommendations"])


def test_prs_carries_ancestry_warning():
    assert "not validated" in GX.genomic_context(khalid())["prs"]["warning"]


def test_disclosure_only_after_counselling_and_choice():
    p = khalid()
    assert GX.genomic_context(p)["participant_disclosure_allowed"] is False
    with pytest.raises(ValueError):
        GX.advance_counselling("not_offered", "completed_wants_result")
    p["genomics"]["counselling"] = GX.advance_counselling("offered", "completed_declines_result")
    assert GX.genomic_context(p)["participant_disclosure_allowed"] is False


def test_api_participant_view_hidden_until_counselled():
    assert c.get("/me/MB-1322/genomics").json()["shown"] is False
    r = c.post("/participants/MB-1322/genomics/counselling", headers=CL, json={"state": "completed_wants_result"})
    assert r.status_code == 200
    assert c.get("/me/MB-1322/genomics").json()["shown"] is True


def test_fhir_includes_genomic_observation():
    b = c.get("/participants/MB-1322/fhir", headers=CL).json()
    assert any(e["resource"].get("id", "").endswith("-apoe") for e in b["entry"])
