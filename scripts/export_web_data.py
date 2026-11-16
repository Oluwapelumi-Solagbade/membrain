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
from membrain.prevention import ALWAYS, MESSAGES, RULES, prevention_plan, risk_context  # noqa: E402
from membrain.simulate import ASSUMPTIONS, generate_cohort  # noqa: E402
from membrain.triage import evaluate  # noqa: E402
from membrain.validation import analyse  # noqa: E402
from membrain import navigator as NAV  # noqa: E402
from membrain import genomics as GX  # noqa: E402
from membrain import intake as IN  # noqa: E402

N = int(sys.argv[1]) if len(sys.argv) > 1 else 2000


def _navai():
    """Measured Navigator AI results (rules on the held-out set; MedGemma once the cluster run is committed)."""
    d = ROOT / "docs" / "navai"
    keep = ("n", "gates", "urgent_recall_cases", "urgent_recall_wilson_lower95", "red_flag_false_alarms", "onset_exact",
            "confounder_f1", "timeline_cases", "by_language", "unsupported_items")
    out = {}
    f = d / "RESULTS_rules_test.json"
    if f.exists():
        r = json.loads(f.read_text(encoding="utf-8")); out["rules"] = {k: r.get(k) for k in keep}
    f = d / "RESULTS_medgemma_summary.json"
    if f.exists():   # measured on the FZJ cluster (full per-item JSON stays on the cluster)
        m = json.loads(f.read_text(encoding="utf-8")); t = m["sets"]["test"]
        out["medgemma"] = {"model": m["model"], "date": m["date"], "n": t["n"], "gates": t["medgemma_gates"],
                           "combined_gates": t["combined_gates"], "urgent": t["urgent"], "drafting": t["drafting"],
                           "dropped_by_grounding": t["dropped_by_grounding"]}
    f = d / "RESULTS_medgemma.json"
    if f.exists():
        m = json.loads(f.read_text(encoding="utf-8")); t = m["sets"].get("test")
        if t:
            out["medgemma"] = {"model": m["model"], "date": m["date"], **{k: t["medgemma"].get(k) for k in keep},
                               "combined_gates": t["medgemma_plus_rule_red_flags"]["gates"], "drafting": t["drafting"]}
    return out
cfg = {k: getattr(C, k) for k in dir(C) if k.isupper()}
ps = personas()
for p in ps:
    ev = evaluate(p, p["sessions"])
    ctx = dict(p["context"], education=p["education"])
    p["prevention"] = {"en": prevention_plan(ctx, "en"), "ar": prevention_plan(ctx, "ar")}
    p["risk_context"] = risk_context(ctx)
    p["fhir_example"] = bundle(p, p["sessions"], ev["history"])
res = analyse(generate_cohort(N, seed=7))
_log = NAV.simulate_pathways(160, seed=3)
data = {"config": cfg, "items": {"WORD_LISTS": I.WORD_LISTS, "FLUENCY": I.FLUENCY, "STORIES": I.STORIES,
                                 "JUDGEMENT": I.JUDGEMENT, "FLUENCY_LEXICON": I.FLUENCY_LEXICON,
                                 "ITEM_BANK_VERSION": I.ITEM_BANK_VERSION},
        "personas": ps, "messages": MESSAGES,
        "prevention_rules": [{"id": r[0], "evidence": r[2], "en": r[3], "ar": r[4]} for r in RULES],
        "navigator": {"version": NAV.NAVIGATOR_VERSION, "directory": NAV.directory(), "pathways": NAV.PATHWAYS,
                      "states": NAV.STATES, "transitions": NAV.TRANSITIONS, "needs_reason": sorted(NAV.NEEDS_REASON),
                      "closed": sorted(NAV.CLOSED), "pack": NAV.PACK, "funding": NAV.FUNDING_LABEL, "languages": NAV.LANG_LABEL,
                      "stale_after_days": NAV.STALE_AFTER_DAYS, "assumptions": NAV.PATHWAY_ASSUMPTIONS,
                      "synthetic_log": {"referrals": _log[0], "people": _log[1]},
                      "synthetic_metrics": NAV.programme_metrics(*_log)},
        "genomics_cases": [{"person": c, "expected": {k: v for k, v in GX.genomic_context(c).items() if k in ("available", "apoe4_copies", "recommendations", "flags", "participant_disclosure_allowed", "counselling")}}
                           for c in [{"id": "g%d" % i, "age": a, "consent": {"genomics": cons}, "context": {"family_history_dementia": fh},
                                      "genomics": ({"apoe": ap, "counselling": st} if ap else {})}
                                     for i, (a, cons, fh, ap, st) in enumerate([(70, True, True, "e3/e4", "offered"), (55, True, False, "e3/e4", "not_offered"),
                                                                                 (66, True, False, "e4/e4", "completed_wants_result"), (66, False, True, "e4/e4", "offered"),
                                                                                 (61, True, True, "e3/e3", "offered"), (72, True, False, None, None)])]],
        "intake": {k: getattr(IN, k) for k in ("INTAKE_VERSION", "REVIEW_BELOW", "DOMAINS", "RED_FLAGS", "CONFOUNDERS", "ACTIVITIES", "WHO",
                                                "ONSET", "LEX", "ACT_LEX", "WHO_LEX", "TAKEOVER", "NEG_CLAUSE", "NOT_A_HIT", "AR_PREFIX", "CLAUSE", "SENT",
                                                "DRAFT_DOMAIN", "DRAFT_RF", "DRAFT_CF", "DRAFT_ACT", "DRAFT_WHO", "DRAFT_REPORTER", "LEVEL_TXT", "VOCAB", "BLOCKED")}
        | {"NEG": {k: sorted(v) for k, v in IN.NEG.items()}},
        "navai": _navai(),
        "prevention_always": {"en": ALWAYS[0], "ar": ALWAYS[1]},
        "validation": {"n": N, "seed": 7, "assumptions": ASSUMPTIONS, "summary": res["summary"]}}
(ROOT / "web" / "data.js").write_text("window.MB_DATA = " + json.dumps(data, ensure_ascii=False, default=str) + ";\n")
(ROOT / "docs" / "validation_summary.json").write_text(json.dumps(data["validation"], indent=1, default=str))
print("ok", N, len(ps))
