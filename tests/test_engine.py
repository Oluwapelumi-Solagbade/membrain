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
    assert ev["level"] == "BASELINE" and ev["intake"] and ev["next_action"] == "first_session"


def _intake(**kw):
    p = {"id": "X", "age": 68, "education": "secondary", "language": "en"}
    return evaluate(p, [dict({"session_id": "i0", "date": "2026-11-14", "type": "intake", "concern": "c", "red_flags": []}, **kw)])["latest"]


@pytest.mark.parametrize("kw,why", [
    ({"activities_taken_over": ["money", "medicines"]}, "2 everyday activities now done by someone else"),
    ({"iqcode": 3.6}, "informant questionnaire above cutoff"),
    ({"reporter": "primary_care"}, "concern raised by a healthcare professional"),
])
def test_significant_concern_goes_to_review_before_any_testing(kw, why):
    ev = _intake(**kw)
    assert ev["level"] == "CLINICIAN_REVIEW" and ev["next_action"] == "review_task" and "primary_care" in ev["pathways"]
    assert why in ev["reasons"][0] and "without waiting for testing" in ev["reasons"][0]


def test_minor_concern_waits_for_first_check_in():
    for kw in ({"activities_taken_over": ["money"]}, {"iqcode": 3.2}, {"reporter": "self"}, {"reporter": "family"}):
        assert _intake(**kw)["level"] == "BASELINE"


def test_red_flags_still_outrank_a_review_concern():
    ev = _intake(red_flags=["recent_fall_head_injury"], activities_taken_over=["money", "cooking"], reporter="primary_care")
    assert ev["level"] == "URGENT" and ev["next_action"] == "urgent_review_task"


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


def test_synthetic_cohort_matches_uae_who_prevalence():
    import numpy as np
    from membrain.simulate import generate_cohort
    from membrain.uae_data import UAE_INDICATORS as U
    c = generate_cohort(1500, seed=3)
    checks = {"obesity": lambda x: x["bmi"] >= 30, "insufficient_activity": lambda x: x["activity_min_week"] < 150,
              "current_smoking": lambda x: x["smoker"]}
    for k, f in checks.items():
        for s in "FM":
            v = 100 * np.mean([f(p["context"]) for p in c if p["sex"] == s])
            assert abs(v - U[k][s]) < 5, (k, s, v, U[k][s])


def test_dossier_carries_the_attributed_concern_and_what_is_missing():
    from membrain.dossier import build_dossier
    p = {"id": "X", "age": 69, "education": "primary", "language": "ar", "dialect": "Emirati", "entry_route": "family",
         "informant": None, "context": {},
         "intake": {"reporter": "self", "at": "2026-11-14", "confirmed": {
             "narrative": "I keep forgetting appointments. My wife now pays the bills.", "domains": ["memory"],
             "red_flags": [], "confounders": [], "onset": "months", "timeline": [["money", "wife"]]}},
         "sessions": [{"session_id": "i0", "date": "2026-11-14", "type": "intake", "concern": "x", "reporter": "self",
                       "activities_taken_over": ["money"], "red_flags": []}]}
    c = build_dossier(p, evaluate(p, p["sessions"]))["concern"]
    assert c["raised_by"] == "The person themselves" and c["in_their_words"].startswith("I keep forgetting")
    assert c["what_changed"] == ["Memory"] and c["who_now_does_what"] == ["Managing money / bills: now wife"]
    assert "not a clinical finding" in c["attribution"]
    assert {"An informant account (family member or household helper)", "Informant questionnaire (IQCODE-16)",
            "A scored check-in", "Blood pressure and HbA1c"} <= set(c["missing"])
    assert "When the change started" not in c["missing"]


def test_dossier_concern_for_routine_screening_says_so():
    from membrain.dossier import concern_summary
    c = concern_summary({"id": "X", "entry_route": "programme", "sessions": [
        {"session_id": "i0", "date": "2026-11-14", "type": "intake", "concern": "routine programme screening", "red_flags": []}]})
    assert c["in_their_words"] is None and "No specific concern (routine programme screening)" in c["missing"]
