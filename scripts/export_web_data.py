"""Export config, items, personas and validation results for the web demo (single source of truth)."""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from membrain import config as C  # noqa: E402
from membrain import items as I  # noqa: E402
from membrain.dossier import build_dossier  # noqa: E402
from membrain.fhir import bundle  # noqa: E402
from membrain.personas import personas  # noqa: E402
from membrain.prevention import MESSAGES, prevention_plan, risk_context  # noqa: E402
from membrain.simulate import ASSUMPTIONS, generate_cohort  # noqa: E402
from membrain.triage import evaluate  # noqa: E402
from membrain.validation import analyse  # noqa: E402

N = int(sys.argv[1]) if len(sys.argv) > 1 else 2000
cfg = {k: getattr(C, k) for k in dir(C) if k.isupper()}
ps = personas()
for p in ps:
    ev = evaluate(p, p["sessions"])
    ctx = dict(p["context"], education=p["education"])
    p["prevention"] = {"en": prevention_plan(ctx, "en"), "ar": prevention_plan(ctx, "ar")}
    p["risk_context"] = risk_context(ctx)
    p["fhir_example"] = bundle(p, p["sessions"], ev["history"])
res = analyse(generate_cohort(N, seed=7))
data = {"config": cfg, "items": {"WORD_LISTS": I.WORD_LISTS, "FLUENCY": I.FLUENCY, "STORIES": I.STORIES,
                                 "JUDGEMENT": I.JUDGEMENT, "FLUENCY_LEXICON": I.FLUENCY_LEXICON,
                                 "ITEM_BANK_VERSION": I.ITEM_BANK_VERSION},
        "personas": ps, "messages": MESSAGES,
        "validation": {"n": N, "seed": 7, "assumptions": ASSUMPTIONS, "summary": res["summary"]}}
(ROOT / "web" / "data.js").write_text("window.MB_DATA = " + json.dumps(data, ensure_ascii=False, default=str) + ";\n")
(ROOT / "docs" / "validation_summary.json").write_text(json.dumps(data["validation"], indent=1, default=str))
print("ok", N, len(ps))
