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


def test_parser_tolerates_how_llama_models_write_json():
    fs = _fs()
    raw = ('Sure! Here is the packet:\n```json\n{"Summary": "Delayed word recall fell from 5.0 to 4 (F3).", '
           '"Reversible causes": [{"key": "Blood_Pressure", "reason": "BP 151/90 is raised [F7]", "fact_ids": [7]}], '
           '"Questions": ["Has anyone noticed changes in managing medicines?"]}\n```\nLet me know if you need more.')
    pk, kept, removed = PK.verify(raw, fs)
    assert pk and kept == 3 and removed == 0
    assert pk["summary"][0]["text"] == "Delayed word recall fell from 5.0 to 4." and pk["summary"][0]["facts"] == ["F3"]
    assert pk["rule_out"][0]["check"] == "blood_pressure" and pk["rule_out"][0]["why"] == "BP 151/90 is raised"
    assert PK.verify('{"summary": [{"text": "x", "facts": ["F1"]}]} {"other": 1}', fs)[0]   # first object only
    assert PK.verify("no json here", fs) == (None, 0, 0)


def test_med42s_real_mistakes_on_the_live_space_are_caught():
    """From Med42's first live answer (18 Nov): a made-up language, 4.0 for 4, every check listed, wrong facts cited."""
    fs = _fs()
    assert "speaks Arabic" in fs[0]["text"]
    raw = ('{"summary": [{"text": "Delayed word recall fell from 5.0 to 4.0, a reliable decline.", "facts": ["F3"]},'
           '{"text": "Spanish is the primary language.", "facts": []}],'
           '"rule_out": [{"check": "thyroid", "why": "to rule out thyroid dysfunction", "facts": ["F7"]},'
           '{"check": "depression", "why": "to rule out depression", "facts": ["F4", "F5"]},'
           '{"check": "blood_pressure", "why": "Blood pressure is 151/90.", "facts": ["F7"]},'
           '{"check": "glucose", "why": "HbA1c is 6.9%.", "facts": ["F8"]}], "ask": []}')
    pk, kept, removed = PK.verify(raw, fs)
    assert [s["text"] for s in pk["summary"]] == ["Delayed word recall fell from 5.0 to 4.0, a reliable decline."]
    assert [r["check"] for r in pk["rule_out"]] == ["blood_pressure", "glucose"]    # thyroid on BP and depression on PHQ 1/6 dropped
    assert removed == 3


R1187 = ('{ "summary":[{"text":"Delayed word recall declined from 5.0 to 4, a reliable decline, and confirmed on repeat with an alternate form.","facts":["F3"]},'
         '{"text":"Blood pressure is elevated at 151/90 mmHg.","facts":["F7"]}],\n'
         '"rule_out":[{"check":"diabetes","why":"Elevated HbA1c may contribute to memory decline.","facts":["F8"]},'
         '{"check":"hypertension","why":"Elevated blood pressure may contribute to memory decline.","facts":["F7"]},'
         '{"check":"smoking","why":"Smoking may harm vascular health.","facts":["F9"]},'
         '{"check":"depression","why":"Mild depressive symptoms.","facts":["F4"]},'
         '{"check":"anxiety","why":"Mild anxiety symptoms.","facts:["F5"]}],\n'
         '"ask":[{"q":"Has there been any change in sleep patterns or quality?","facts":["F6"]},{"q":"Has the patient exp')


def test_broken_or_cut_off_answers_from_the_live_space_are_salvaged():
    """Med42's second live answer (18 Nov): a missing quote in one item and the answer cut off mid-question."""
    pk, kept, removed = PK.verify(R1187, _fs())
    assert len(pk["summary"]) == 2
    assert pk["rule_out"] == []   # names map to the list, but "may contribute to memory decline" is a causal claim
    assert [a["q"] for a in pk["ask"]] == ["Has there been any change in sleep patterns or quality?"]
    assert removed == 6   # 2 causal reasons, smoking, depression on PHQ 1/6, the broken item, the cut-off question
    alias = PK.parse('{"rule_out":[{"check":"Hypertension","why":"x","facts":["F7"]},{"check":"diabetes","why":"x","facts":["F8"]}]}')
    assert [r["check"] for r in alias["rule_out"]] == ["blood_pressure", "glucose"]


R1322_SUMMARY = ('{"summary":[{"text":"Significant memory decline noted with IQCODE increasing from 3.05 to 3.72, indicating a large or '
                 'rapid decline from personal baseline. Reliable declines in word learning, delayed word recall, word generation, story '
                 'recall, and everyday judgement observed. No significant depression or anxiety reported (PHQ-2 and GAD-2 both 1 of 6). '
                 'Sleep is adequate at 7 hours a night. Blood pressure and HbA1c within normal limits. Family history of memory illness noted.", '
                 '"facts":["F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15"]}], "rule_out": [], "ask": []}')


def test_long_summaries_are_checked_sentence_by_sentence_and_wrong_judgements_dropped():
    """Med42's live answers (18 Nov): BP 138/84 and HbA1c 6.2% called normal; PHQ-2 of 1 called mild depressive symptoms."""
    fs = _fs("MB-1322")
    pk, kept, removed = PK.verify(R1322_SUMMARY, fs)
    texts = [s["text"] for s in pk["summary"]]
    assert not any("within normal limits" in t for t in texts) and len(texts) == 4 and removed >= 2
    fs = _fs()
    raw = ('{"summary":[{"text":"Mild depressive and anxiety symptoms reported with PHQ-2 and GAD-2 scores of 1.","facts":["F4","F5"]},'
           '{"text":"Smoking is reported, which may contribute to the decline in memory scores.","facts":["F9"]},'
           '{"text":"Blood pressure is elevated at 151/90 mmHg.","facts":["F7"]}]}')
    pk, kept, removed = PK.verify(raw, fs)
    assert [s["text"] for s in pk["summary"]] == ["Blood pressure is elevated at 151/90 mmHg."] and removed == 2


def test_good_parts_are_kept_when_the_summary_fails():
    raw = '{"summary":[{"text":"Unclear.","facts":[]}],"rule_out":[{"check":"blood_pressure","why":"Systolic 151.","facts":["F7"]}]}'
    pk, kept, removed = PK.verify(raw, _fs())
    assert pk and not pk["summary"] and kept == 1
    rules = PK.rules_packet(_fs(), {"concern": {}})
    assert PK.merge(pk, rules)["summary"] == rules["summary"]


def test_third_live_round_reasons_must_be_reasons_and_cite_their_own_facts():
    """Med42's live answers (18 Nov, third round)."""
    fs = _fs("MB-1322")
    assert not PK.supports("sleep", fs[11]["text"])                       # "Sleep reported ...: 7.0 hours" is not a sleep problem
    raw = ('{"summary":[],"rule_out":[{"check":"sleep","why":"7 hours a night, adequate.","facts":["F12"]}],"ask":[]}')
    assert PK.verify(raw, fs)[0] is None
    pk, _, _ = PK.verify(R1322_SUMMARY, fs)
    assert pk["summary"][0]["facts"] == ["F4"]                              # IQCODE sentence cites only the IQCODE fact
    fs = _fs()
    raw = ('{"rule_out":[{"check":"blood_pressure","why":"Elevated blood pressure may contribute to memory decline.","facts":["F7"]},'
           '{"check":"glucose","why":"HbA1c is 6.9%, in the diabetes range.","facts":["F8"]}]}')
    pk, kept, removed = PK.verify(raw, fs)
    assert [r["check"] for r in pk["rule_out"]] == ["glucose"] and removed == 1
    assert PK._blocked("Anxiety can cause memory decline and poor sleep.")
