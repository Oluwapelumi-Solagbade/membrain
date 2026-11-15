"""Write tests/intake_golden.json: Python outputs that web/parity_test.js must reproduce exactly."""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from membrain import intake as I  # noqa: E402
from navai.evaluate import load  # noqa: E402
from navai.medgemma_eval import confirmed_from_gold  # noqa: E402

cases = []
for g in load("dev") + load("test"):
    r = I.extract_rules(g["text"], g["lang"])
    c = confirmed_from_gold(g)
    c["timeline"] = [list(x) for x in c["timeline"]]
    d = I.draft_referral(c)
    cases.append({"id": g["id"], "text": g["text"], "lang": g["lang"], "extract": r, "confirmed": c, "draft": d,
                  "verify": I.verify_referral(d, c), "quotes": I.quotes_from(r, g["text"])})
c0 = cases[0]["confirmed"]
adversarial = ["A family member reports memory loss over 2 years. He probably has early Alzheimer disease.",
               "He also had a fall. No falls were reported. The family describes rapid worsening and new medication.",
               "Latest MemBrain check-in: urgent review. Consider dementia. No diagnosis has been made.",
               "In their words: “he keeps asking the same questions”. He was admitted to hospital last week."]
c0 = dict(c0, checkin={"level": "CLINICIAN_REVIEW", "reasons": ["Composite fell by 1.4 SD from baseline; memory 2 points lower"]})
adversarial.append("Latest MemBrain check-in: clinician review. Composite fell by 1.4 SD from baseline; memory 2 points lower. He fell 3 times.")
adv = [{"text": t, "confirmed": c0, "verify": I.verify_referral(t, c0)} for t in adversarial]
(ROOT / "tests" / "intake_golden.json").write_text(json.dumps({"cases": cases, "adversarial": adv}, ensure_ascii=False), encoding="utf-8")
print("intake golden:", len(cases), "cases,", len(adv), "adversarial")
