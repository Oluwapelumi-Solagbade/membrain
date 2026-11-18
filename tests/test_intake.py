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
    assert gates["urgent_recall"] and gates["latency_p95_s"]
    # The rules emit nothing to drop, so the unsupported-field gate is not measured (n/a), never a vacuous pass.
    assert res["unsupported_items"] == "0/0" and res["unsupported_rate"] is None and gates["unsupported_rate"] is None


def test_unsupported_gate_scores_when_items_were_checked():
    from navai.evaluate import load, run_rules, score
    gold = load("test")
    preds, lat = run_rules(gold)
    gates = {g["metric"]: g["pass"] for g in score(gold, preds, lat, unsupported=0, items=100)["gates"]}
    assert gates["unsupported_rate"] is True
    gates = {g["metric"]: g["pass"] for g in score(gold, preds, lat, unsupported=2, items=100)["gates"]}
    assert gates["unsupported_rate"] is False


def test_api_falls_back_to_rules_without_medgemma(monkeypatch):
    monkeypatch.delenv("MEDGEMMA_URL", raising=False)
    c = TestClient(app)
    r = c.post("/api/intake/extract", json={"text": "Since yesterday his speech is slurred.", "lang": "en"}).json()
    assert r["engine"] == "rules" and r["urgent"]
    assert c.post("/api/referral/draft", json={"confirmed": {"narrative": "x", "domains": ["memory"]}}).status_code in (401, 403)
    d = c.post("/api/referral/draft", json={"confirmed": {"narrative": "x", "domains": ["memory"]}}, headers={"X-Role": "clinician"}).json()
    assert d["engine"] == "template" and d["sentences"][-1].endswith("No diagnosis has been made.") and d["fallback_reason"]


def test_api_uses_model_but_keeps_rule_red_flags(monkeypatch):
    import api.navai as N
    monkeypatch.setattr(N, "_llm", lambda m, max_tokens=700, task="intake": '{"domains": [{"key": "memory", "evidence": "forgets"}], "red_flags": []}')
    r = TestClient(app).post("/api/intake/extract", json={"text": "He forgets things and fell yesterday.", "lang": "en"}).json()
    k = I.summary_keys(r)
    assert k["domains"] == ["memory"] and "recent_fall_head_injury" in k["red_flags"] and r["urgent"]
    monkeypatch.setattr(N, "_llm", lambda m, max_tokens=300, task="draft": "He forgets things. He has dementia. No diagnosis has been made.")
    d = TestClient(app).post("/api/referral/draft", json={"confirmed": {"narrative": "He forgets things.", "domains": ["memory"]}},
                             headers={"X-Role": "clinician"}).json()
    assert "He has dementia." not in d["sentences"] and len(d["removed"]) == 1 and d["removed"][0]["reasons"]


def test_medgemma_is_used_only_for_the_tasks_allowed(monkeypatch):
    import api.navai as N
    monkeypatch.setenv("MEDGEMMA_URL", "http://127.0.0.1:9")   # nothing listens there
    monkeypatch.setenv("MEDGEMMA_TASKS", "draft")
    assert N._task_on("draft") and not N._task_on("intake")
    calls = []
    monkeypatch.setattr(N.httpx, "post", lambda *a, **k: calls.append(a) or (_ for _ in ()).throw(N.httpx.ConnectError("x")))
    r = TestClient(app).post("/api/intake/extract", json={"text": "He forgets things.", "lang": "en"}).json()
    assert r["engine"] == "rules" and not calls                  # intake never reaches MedGemma
    d = TestClient(app).post("/api/referral/draft", json={"confirmed": {"narrative": "He forgets things.", "domains": ["memory"]}},
                             headers={"X-Role": "clinician"}).json()
    assert calls and d["engine"] == "template" and "did not answer" in d["fallback_reason"]


def test_draft_for_a_case_uses_only_that_case(monkeypatch):
    import api.navai as N
    seen = {}
    def fake(m, max_tokens=400, task="draft"):
        seen["facts"] = m[-1]["content"]
        return "A family member reports changes in memory. The patient clearly has Alzheimer's disease. No diagnosis has been made."
    monkeypatch.setattr(N, "_llm", fake)
    c = TestClient(app)
    case = c.post("/concerns", json={"reporter": "family", "lang": "en", "narrative": "Mum forgets and my sister pays her bills now.",
                                     "domains": ["memory"], "date": "2026-11-17", "timeline": [["money", "sister"]]}).json()
    pid = case["participant"]["id"]
    d = c.post(f"/api/referral/draft/{pid}", headers={"X-Role": "clinician"}).json()
    assert d["engine"] != "template" and any("Alzheimer" in r["text"] for r in d["removed"])
    assert not any("Alzheimer" in s for s in d["sentences"]) and d["facts"]["reporter"] == "family"
    assert "Changes noticed in: memory" in seen["facts"] and "Mum" not in seen["facts"]   # facts only, never the free text or names
    assert seen["facts"].startswith("Reported by: a family member")                      # the model knows who reported it
    assert c.post("/api/referral/draft/NOPE", headers={"X-Role": "clinician"}).status_code == 404


def test_draft_that_puts_the_report_in_the_wrong_mouth_is_removed():
    c = {"reporter": "helper", "domains": ["memory"], "narrative": ""}
    assert not I.verify_sentence("The patient reports problems with memory.", c)["ok"]
    assert I.verify_sentence("A household helper reports problems with memory.", c)["ok"]
    assert I.verify_sentence("Please assess the patient.", c)["ok"]
    assert I.verify_sentence("The patient reports problems with memory.", dict(c, reporter="self"))["ok"]


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


# Standard Arabic (written for these tests; the gold sets are mostly Gulf dialect). MemBrain itself now speaks
# Modern Standard Arabic, so people answering it may write that way too.
MSA = [
    ("منذ حوالي سنتين أصبحت أمي تنسى كثيرًا، وأحيانًا تكرر السؤال نفسه، ولم تعد ترغب في الخروج كما كانت. وأختي الآن تدفع الفواتير عنها.",
     {"memory", "executive", "mood"}, "years", {("money", "sister")}),
    ("لاحظت في الأشهر الأخيرة أن والدي لا يتذكر مواعيده، وأصبح ابني يقوده إلى كل مكان بعد أن تاه في الطريق.",
     {"memory", "orientation"}, "months", {("driving", "son")}),
    ("منذ ثلاثة أشهر تجد والدتي صعوبة في إيجاد الكلمات ولا تستطيع متابعة الحديث.", {"language"}, "months", set()),
    ("منذ عدة أسابيع تتولى ابنتي إدارة أمور أمي المالية لأنها لم تعد قادرة على التعامل مع المال.",
     {"executive"}, "weeks", {("money", "daughter")}),
    ("أصبح زوجي سريع الغضب وعدوانيًا، ولا ينام في الليل.", {"behaviour", "sleep"}, None, set()),
]


def test_standard_arabic_accounts_are_read():
    for text, domains, onset, timeline in MSA:
        k = keys(text, "ar")
        assert domains <= set(k["domains"]), (text, k)
        assert k["onset"] == onset, (text, k)
        assert timeline <= set(k["timeline"]), (text, k)


def test_standard_arabic_red_flags_and_what_is_not_one():
    assert "recent_fall_head_injury" in keys("سقط أبي أمس في الحمام وأصيب في رأسه.", "ar")["red_flags"]
    assert "safety_risk" in keys("ترك والدي الغاز مشتعلًا مرتين هذا الشهر.", "ar")["red_flags"]
    assert "new_neuro_symptoms" in keys("عنده ضعف في يده اليمنى منذ الصباح.", "ar")["red_flags"]
    hearing = keys("يعاني والدي من ضعف في السمع.", "ar")
    assert hearing["red_flags"] == [] and "hearing" in hearing["confounders"]   # weak hearing is not a stroke sign
    assert "memory" not in keys("لا توجد مشكلة في ذاكرته، لكنه حزين.", "ar")["domains"]


def test_medgemma_loaded_in_the_space_is_used_for_drafting_only(monkeypatch):
    import api.medgemma_local as ML
    calls = []
    monkeypatch.setattr(ML, "complete", lambda m, n=400: calls.append(n) or "A family member reports changes in memory. No diagnosis has been made.")
    monkeypatch.setenv("MEDGEMMA_TASKS", "draft")
    monkeypatch.delenv("MEDGEMMA_URL", raising=False)
    c = TestClient(app)
    assert c.post("/api/intake/extract", json={"text": "He forgets things.", "lang": "en"}).json()["engine"] == "rules" and not calls
    d = c.post("/api/referral/draft", json={"confirmed": {"narrative": "x", "domains": ["memory"], "reporter": "family"}},
               headers={"X-Role": "clinician"}).json()
    assert calls and d["engine"] != "template" and d["sentences"][0].startswith("A family member")
    # a GPU error (allowance used up) falls back to the template and says why
    def boom(m, n=400):
        raise RuntimeError("quota")
    monkeypatch.setattr(ML, "complete", boom)
    d = c.post("/api/referral/draft", json={"confirmed": {"narrative": "x", "domains": ["memory"]}}, headers={"X-Role": "clinician"}).json()
    assert d["engine"] == "template" and "did not answer" in d["fallback_reason"]


def test_a_failed_medgemma_load_never_stops_the_server(monkeypatch):
    import builtins
    import api.medgemma_local as ML
    real = builtins.__import__
    monkeypatch.setattr(builtins, "__import__", lambda n, *a, **k: (_ for _ in ()).throw(ImportError("no torch")) if n == "torch" else real(n, *a, **k))
    monkeypatch.setattr(ML, "complete", None)
    assert ML.load() is False and ML.status["error"].startswith("ImportError") and ML.complete is None
    assert TestClient(app).get("/api/referral/engine").json()["local"]["loaded"] is False


def test_second_reader_runs_only_when_rules_find_nothing_and_keeps_only_grounded_items(monkeypatch):
    import api.navai as N
    N._SR_HITS.clear()
    calls = []
    def fake(m, max_tokens=300, task="second_read"):
        calls.append(task)
        return ('{"items": [{"kind": "health", "key": "blood_pressure", "quote": "blood pressure"},'
                ' {"kind": "domain", "key": "memory", "quote": "he forgets everything"},'        # not in the text: dropped
                ' {"kind": "health", "key": "cancer", "quote": "pressure"},'                    # key not allowed: dropped
                ' {"kind": "red_flag", "key": "sudden_onset", "quote": "drastic change"}]}')
    monkeypatch.setattr(N, "_llm", fake)
    c = TestClient(app)
    r = c.post("/api/intake/second-read", json={"text": "I noticed a drastic change in the patient's blood pressure", "lang": "en"}).json()
    assert calls == ["second_read"] and r["dropped"] == 2
    assert {(i["kind"], i["key"]) for i in r["items"]} == {("health", "blood_pressure"), ("red_flag", "sudden_onset")}
    # the rules found something: MedGemma is not asked at all
    r2 = c.post("/api/intake/second-read", json={"text": "Mum keeps forgetting appointments", "lang": "en"}).json()
    assert r2["engine"] == "rules" and calls == ["second_read"]
    # MedGemma off or failing: the chat simply carries on
    monkeypatch.setattr(N, "_llm", lambda m, max_tokens=300, task="second_read": None)
    assert c.post("/api/intake/second-read", json={"text": "His kidneys are not good", "lang": "en"}).json()["items"] == []


def test_second_reader_is_rate_limited(monkeypatch):
    import api.navai as N
    N._SR_HITS.clear()
    monkeypatch.setattr(N, "_llm", lambda m, max_tokens=300, task="second_read": '{"items": []}')
    c = TestClient(app)
    out = [c.post("/api/intake/second-read", json={"text": "His kidneys are not good", "lang": "en"},
                  headers={"x-forwarded-for": "10.7.7.7"}).json() for _ in range(6)]
    assert out[-1]["reason"] == "busy"


def test_second_reader_arabic_quote_is_grounded_after_normalisation(monkeypatch):
    import api.navai as N
    items, dropped = N.ground_second_read('{"items": [{"kind": "health", "key": "blood_sugar", "quote": "السكري"}]}',
                                          "أبوي عنده السكرى من زمان", "ar")   # ى / ي spelt differently
    assert items and items[0]["label"] == "السكر / السكري" and dropped == 0


def test_mixed_arabic_english_concern_is_read_in_both_languages():
    t = "أبوي صار ينسى الدوا وايد، ويعيد نفس السؤال كل يوم من شهرين، and last week he got lost on the way to the mosque"
    r = I.extract_rules(t, "ar")
    k = I.summary_keys(r)
    assert k["domains"] == ["memory", "orientation"] and k["onset"] == "months"
    assert r["frequency"]["value"] == "daily" and r["severity"]["value"] == "marked"
    assert any("got lost" in e for f in r["fields"] for e in f["evidence"])
    assert I.summary_keys(I.extract_rules("My mother ما تتذكر appointments, got lost أمس in the mall"))["domains"] == ["memory", "orientation"]


def test_frequency_and_severity_are_extracted_and_checked():
    r = I.extract_rules("He repeats himself sometimes, but not a lot", "en")
    assert r["frequency"]["value"] == "sometimes" and r["severity"]["value"] == "mild"    # "not a lot" is mild, not "a lot"
    assert I.extract_rules("Once he forgot the stove", "en")["frequency"] is None          # "once" meaning "when"
    c = {"reporter": "family", "domains": ["memory"], "narrative": ""}
    assert not I.verify_sentence("He forgets every day.", c)["ok"]                      # unconfirmed frequency is removed
    assert I.verify_sentence("He forgets every day.", dict(c, frequency="daily"))["ok"]
