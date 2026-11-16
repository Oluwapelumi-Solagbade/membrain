"""Navigator intake: extraction, grounding of model output, referral verifier and API fallback."""
import hashlib
import json
import pathlib

from fastapi.testclient import TestClient

from api.main import app
from membrain import intake as I
from membrain.navigator import match_services

ROOT = pathlib.Path(__file__).resolve().parents[1]


def keys(text, lang):
    return I.summary_keys(I.extract_rules(text, lang))


def test_spans_point_at_the_words():
    t = "For about a year Dad keeps asking the same questions. My brother now does all the driving."
    r = I.extract_rules(t, "en")
    for f in r["fields"]:
        for (a, b), ev in zip(f["spans"], f["evidence"]):
            assert t[a:b] == ev
    k = keys(t, "en")
    assert "memory" in k["domains"] and k["onset"] == "years" and ("driving", "brother") in k["timeline"]


def test_negation_and_arabic_normalisation():
    assert "recent_fall_head_injury" not in keys("No falls, no new medicines.", "en")["red_flags"]
    assert "new_medication" not in keys("No falls, no new medicines.", "en")["confounders"]
    # hamza / taa marbuta variants and diacritics still match
    assert "memory" in keys("صارَت تَنسى وايد", "ar")["domains"]
    assert "memory" not in keys("ما فيه مشكلة في ذاكرته ولا تصرفاته", "ar")["domains"]


def test_red_flags_are_urgent_and_never_removed_by_the_model():
    t = "أبوي طاح أمس وضرب راسه"
    rules = I.extract_rules(t, "ar")
    assert rules["urgent"] and "recent_fall_head_injury" in I.summary_keys(rules)["red_flags"]
    llm = I.ground_llm_output('{"domains": [], "red_flags": []}', t, "ar")
    merged = I.merge_safety(llm, rules)
    assert merged["urgent"] and "recent_fall_head_injury" in I.summary_keys(merged)["red_flags"]


def test_model_output_without_a_real_quote_is_dropped():
    t = "Mum forgets appointments."
    raw = json.dumps({"domains": [{"key": "memory", "evidence": "forgets appointments"},
                                  {"key": "mood", "evidence": "she is very depressed"},
                                  {"key": "dementia", "evidence": "forgets"}],
                      "onset": {"value": "years", "evidence": "for two years"}})
    r = I.ground_llm_output("Here you go: " + raw, t, "en")
    k = I.summary_keys(r)
    assert k["domains"] == ["memory"] and k["onset"] is None
    assert r["grounding"]["unsupported"] == 3 and r["grounding"]["invalid_key"] == 1
    assert I.ground_llm_output("not json", t, "en")["grounding"]["parse_error"]


def test_template_draft_is_fully_grounded_and_never_diagnoses():
    c = {"narrative": "Dad keeps misplacing his wallet. The maid now keeps his medicines.", "domains": ["memory"],
         "red_flags": [], "confounders": [], "onset": "months", "timeline": [("medicines", "helper")],
         "quotes": ["Dad keeps misplacing his wallet"], "checkin": {"level": "CLINICIAN_REVIEW", "reasons": ["Composite fell by 1.4 SD"]}}
    d = I.draft_referral(c)
    v = I.verify_referral(d, c)
    assert v["grounded"] and v["n"] == len(d)
    assert "No diagnosis has been made." in d[-1]["text"]


def test_verifier_blocks_hallucinations():
    c = {"narrative": "He forgets names.", "domains": ["memory"], "red_flags": [], "confounders": [], "onset": "months", "timeline": []}
    bad = {"He probably has Alzheimer disease.": "diagnostic", "Memory loss for 3 years.": "number",
           "He also had a fall.": "fall", "In their words: “he hit his wife”.": "quote"}
    for s, why in bad.items():
        r = I.verify_sentence(s, c)
        assert not r["ok"], s
        assert any(why in x for x in r["reasons"]), (s, r["reasons"])
    assert I.verify_sentence("No falls were reported.", c)["ok"]
    assert I.verify_sentence("No diagnosis has been made.", c)["ok"]


def test_held_out_test_set_is_frozen():
    g = ROOT / "navai" / "gold"
    want = (g / "test.sha256").read_text().split()[0]
    assert hashlib.sha256((g / "test.jsonl").read_bytes()).hexdigest() == want


def test_rules_meet_the_safety_gates_on_the_held_out_set():
    from navai.evaluate import load, run_rules, score
    gold = load("test")
    res = score(gold, *run_rules(gold))
    gates = {g["metric"]: g["pass"] for g in res["gates"]}
    assert gates["urgent_recall"] and gates["unsupported_rate"] and gates["latency_p95_s"]


def test_api_falls_back_to_rules_without_medgemma(monkeypatch):
    monkeypatch.delenv("MEDGEMMA_URL", raising=False)
    c = TestClient(app)
    r = c.post("/api/intake/extract", json={"text": "Since yesterday his speech is slurred.", "lang": "en"}).json()
    assert r["engine"] == "rules" and r["urgent"]
    d = c.post("/api/referral/draft", json={"confirmed": {"narrative": "x", "domains": ["memory"]}}).json()
    assert d["engine"] == "template" and d["sentences"][-1].endswith("No diagnosis has been made.")


def test_api_uses_model_but_keeps_rule_red_flags(monkeypatch):
    import api.navai as N
    monkeypatch.setattr(N, "_llm", lambda m, max_tokens=700: '{"domains": [{"key": "memory", "evidence": "forgets"}], "red_flags": []}')
    r = TestClient(app).post("/api/intake/extract", json={"text": "He forgets things and fell yesterday.", "lang": "en"}).json()
    k = I.summary_keys(r)
    assert k["domains"] == ["memory"] and "recent_fall_head_injury" in k["red_flags"] and r["urgent"]
    monkeypatch.setattr(N, "_llm", lambda m, max_tokens=300: "He forgets things. He has dementia. No diagnosis has been made.")
    d = TestClient(app).post("/api/referral/draft", json={"confirmed": {"narrative": "He forgets things.", "domains": ["memory"]}}).json()
    assert "He has dementia." not in d["sentences"] and len(d["removed"]) == 1


def test_service_not_accepting_referrals_is_shown_but_not_preselected():
    m = match_services("memory_clinic", {"language": "ar", "funding": "enhanced", "emirate": "Dubai"})
    svc3 = next(s for s in m["services"] if s["id"] == "SVC-03")
    assert not svc3["accessible"] and "not accepting referrals" in svc3["barriers"]


def _intake(rc, flags=()):
    from membrain.triage import evaluate
    p = {"id": "X", "age": 66, "education": "secondary", "language": "en", "dialect": "English"}
    return evaluate(p, [{"session_id": "i0", "date": "2026-11-14", "type": "intake", "concern": "x", "red_flags": list(flags),
                         "reported_concern": rc}])["latest"]


def test_significant_reported_concern_goes_to_review_without_baseline():
    ev = _intake({"reporter": "family", "domains": ["memory"], "activities_taken_over": ["money"]})
    assert ev["level"] == "CLINICIAN_REVIEW" and "not clinically verified" in ev["reasons"][0]
    assert _intake({"reporter": "professional", "domains": ["orientation"], "activities_taken_over": []})["level"] == "CLINICIAN_REVIEW"
    # mood/sleep only, or a memory worry with no loss of independence, waits for the check-in
    assert _intake({"reporter": "self", "domains": ["mood"], "activities_taken_over": ["cooking"]})["level"] == "BASELINE"
    assert _intake({"reporter": "family", "domains": ["memory"], "activities_taken_over": []})["level"] == "BASELINE"
    # red flags still win
    assert _intake({"reporter": "family", "domains": ["memory"], "activities_taken_over": ["money"]}, ["sudden_onset"])["level"] == "URGENT"


def test_draft_names_the_reporter():
    c = {"narrative": "I forget names.", "domains": ["memory"], "reporter": "self"}
    assert I.draft_referral(c)[0]["text"].startswith("The participant reports")


def test_reasoning_blocks_are_removed_before_reading_or_checking():
    t = "Mum forgets appointments."
    raw = '<unused94>thought\nThe user wants... memory, dementia likely.<unused95>{"domains": [{"key": "memory", "evidence": "forgets appointments"}]}'
    r = I.ground_llm_output(raw, t, "en")
    assert I.summary_keys(r)["domains"] == ["memory"] and r["grounding"]["thinking"]
    cut = I.ground_llm_output("<unused94>thought\nThe user wants me to extract", t, "en")   # ran out before answering
    assert cut["grounding"]["thinking"] and cut["grounding"]["parse_error"] and not cut["fields"]
    v = I.verify_referral("<unused94>thought\nprobably dementia<unused95>A family member reports changes in memory. No diagnosis has been made.",
                          {"narrative": t, "domains": ["memory"]})
    assert v["grounded"] and v["n"] == 2
