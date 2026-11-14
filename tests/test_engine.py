import json
import pathlib

import pytest

from membrain import config as C
from membrain.change import ewma_chart, rci
from membrain.fhir import bundle
from membrain.personas import personas
from membrain.scoring import composite_z, score_session_transcripts
from membrain.triage import evaluate

GOLDEN = pathlib.Path(__file__).parent / "golden_vectors.json"


def by_name():
    return {p["display_name"]["en"]: p for p in personas()}


@pytest.mark.parametrize("name,level", [("Fatima", "STABLE"), ("Ahmed", "CLINICIAN_REVIEW"), ("Mariam", "CHECK_AGAIN"),
                                        ("Khalid", "URGENT"), ("John", "STABLE"), ("Aisha", "BASELINE"), ("Saeed", "CHECK_AGAIN")])
def test_persona_levels(name, level):
    p = by_name()[name]
    assert evaluate(p, p["sessions"])["latest"]["level"] == level


def test_rci_no_change_is_zero_after_practice():
    r = rci(10.5, 2, [10, 10], [0, 1], 2.0, 0.8, 0.5)
    # expected gain: g(2)=1.0 minus mean(g(0),g(1))=0.25 -> 0.75; observed 0.5
    assert r["expected_practice"] == 0.75
    assert r["rci"] < 0


def test_education_stratification_protects_low_education():
    fat = by_name()["Fatima"]
    raw = fat["sessions"][0]["raw"]
    assert composite_z(raw, "none", fat["age"]) > C.LOW_BASELINE_Z
    assert composite_z(raw, C.NAIVE_NORM_EDUCATION, fat["age"]) <= C.LOW_BASELINE_Z


def test_mood_holds_cognitive_alert():
    ev = evaluate(by_name()["Mariam"], by_name()["Mariam"]["sessions"])["latest"]
    assert ev["level"] == "CHECK_AGAIN" and "mental_health" in ev["pathways"]


def test_noisy_session_not_scored():
    h = evaluate(by_name()["John"], by_name()["John"]["sessions"])["history"]
    assert h[2]["valid"] is False and "noise" in h[2]["reasons"][0]


def test_alerts_carry_explanations_and_are_held():
    for p in personas():
        ev = evaluate(p, p["sessions"])["latest"]
        if ev["level"] in ("CLINICIAN_REVIEW", "URGENT"):
            assert ev["drivers"] and ev["reasons"] and ev["held_for_clinician"]


def test_arabic_transcript_scoring():
    r = score_session_transcripts({"memory_immediate": "جَمَل، الشباك، برتقال وقهوة والقمر",
                                   "fluency": "كلب قطة جمل حصان الحصان أسد دب"}, "A", "ar")
    assert r["raw"]["memory_immediate"] == 5
    assert r["raw"]["fluency"] == 6 and r["detail"]["fluency"]["repeats"] == 1


def test_english_story_scoring():
    r = score_session_transcripts({"story_recall": "Fatima went to the market in Al Ain on Friday and bought dates"}, "A", "en")
    assert r["raw"]["story_recall"] >= 5


def test_ewma_is_exploratory():
    assert ewma_chart([1, 1, 1, 1, 0.2, 0.1])["exploratory"] is True


def test_fhir_bundle_validates():
    R4B = pytest.importorskip("fhir.resources.R4B.bundle")
    p = by_name()["Khalid"]
    b = bundle(p, p["sessions"], evaluate(p, p["sessions"])["history"])
    R4B.Bundle.model_validate(b) if hasattr(R4B.Bundle, "model_validate") else R4B.Bundle.parse_obj(b)
    types = {e["resource"]["resourceType"] for e in b["entry"]}
    assert {"Patient", "Consent", "Observation", "RiskAssessment", "Task"} <= types
    assert "Condition" not in types  # system never writes diagnoses


def test_golden_vectors_match():
    """Same vectors are replayed by the JS engine in web/ (parity check)."""
    if not GOLDEN.exists():
        pytest.skip("run scripts/export_golden.py")
    for case in json.loads(GOLDEN.read_text()):
        hist = evaluate(case["participant"], case["sessions"])["history"]
        assert [h["level"] for h in hist] == case["expected_levels"]


def test_red_flags_go_urgent_before_any_testing():
    p = {"id": "X", "age": 70, "education": "primary", "language": "ar"}
    ev = evaluate(p, [{"session_id": "i0", "date": "2026-11-14", "type": "intake", "concern": "family noticed confusion",
                       "red_flags": ["sudden_onset", "fluctuating_confusion"]}])["latest"]
    assert ev["level"] == "URGENT" and "urgent_clinical_assessment" in ev["pathways"]


def test_intake_without_red_flags_is_not_an_alert():
    p = {"id": "X", "age": 70, "education": "primary", "language": "ar"}
    ev = evaluate(p, [{"session_id": "i0", "date": "2026-11-14", "type": "intake", "concern": "memory complaints", "red_flags": []}])["latest"]
    assert ev["level"] == "BASELINE" and ev["intake"]


def test_very_low_first_visit_goes_to_review_without_waiting():
    from membrain.personas import _raw
    p = {"id": "X", "age": 72, "education": "secondary", "language": "en"}
    s = [{"session_id": "s0", "date": "2026-11-14", "form": "A", "raw": _raw("secondary", 72, -2.6, 0)}]
    ev = evaluate(p, s)["latest"]
    assert ev["level"] == "CLINICIAN_REVIEW" and "first visit" in ev["reasons"][-1]


def test_evidence_overrides_restore_config():
    import importlib.util, pathlib
    spec = importlib.util.spec_from_file_location("ev", pathlib.Path(__file__).parents[1] / "scripts" / "evidence_pack.py")
    ev = importlib.util.module_from_spec(spec); spec.loader.exec_module(ev)
    before = (C.RCI_CHECK, C.DOMAINS["fluency"]["practice"], C.REQUIRE_CONFIRMATION)
    with ev.Overrides({"RCI_CHECK": -3.0, "PRACTICE_ZERO": True, "REQUIRE_CONFIRMATION": False}):
        assert C.RCI_CHECK == -3.0 and C.DOMAINS["fluency"]["practice"] == 0.0 and not C.REQUIRE_CONFIRMATION
    assert (C.RCI_CHECK, C.DOMAINS["fluency"]["practice"], C.REQUIRE_CONFIRMATION) == before
