"""Navigator AI evaluation: score an intake extractor against a gold set and check the release gates.

    python -m navai.evaluate --set dev            # rules extractor on the development set
    python -m navai.evaluate --set test --write   # held-out test set; writes docs/navai/RESULTS_rules.json

The same metrics are used for MedGemma (navai/medgemma_eval.py) so the two are directly comparable.
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import statistics
import time

from membrain import intake as I

ROOT = pathlib.Path(__file__).resolve().parents[1]
GOLD = ROOT / "navai" / "gold"

# Release gates from the Navigator technical documentation.
GATES = [("domain_macro_f1", ">=", 0.90, "Concern-domain macro F1"),
         ("worst_language_f1", ">=", 0.85, "Macro F1 in the worst language"),
         ("timeline_exact", ">=", 0.80, "Delegation timeline exact match"),
         ("urgent_recall", ">=", 0.99, "Urgent red-flag recall (any red flag)"),
         ("unsupported_rate", "<", 0.01, "Unsupported field rate"),
         ("latency_p95_s", "<", 5.0, "p95 latency (seconds)")]


def load(name: str) -> list[dict]:
    return [json.loads(x) for x in (GOLD / f"{name}.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()]


def _f1(tp, fp, fn):
    p = tp / (tp + fp) if tp + fp else (1.0 if not fn else 0.0)
    r = tp / (tp + fn) if tp + fn else 1.0
    return 0.0 if p + r == 0 else 2 * p * r / (p + r)


def wilson_lower(k: int, n: int, z: float = 1.96) -> float | None:
    if n == 0:
        return None
    ph = k / n
    return (ph + z * z / (2 * n) - z * math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n))) / (1 + z * z / n)


def score(gold: list[dict], preds: list[dict], latencies: list[float], unsupported: int = 0, items: int = 0) -> dict:
    by_lang = {}
    for lang in sorted({g["lang"] for g in gold}) + ["all"]:
        gs = [(g, p) for g, p in zip(gold, preds) if lang == "all" or g["lang"] == lang]
        per = {}
        for k in I.DOMAINS:
            tp = sum(1 for g, p in gs if k in g["domains"] and k in p["domains"])
            fp = sum(1 for g, p in gs if k not in g["domains"] and k in p["domains"])
            fn = sum(1 for g, p in gs if k in g["domains"] and k not in p["domains"])
            if tp + fp + fn:
                per[k] = round(_f1(tp, fp, fn), 3)
        by_lang[lang] = {"n": len(gs), "domain_macro_f1": round(statistics.mean(per.values()), 3) if per else None, "per_domain": per}
    all_ = list(zip(gold, preds))
    rf_cases = [(g, p) for g, p in all_ if g["red_flags"]]
    rf_hit = sum(1 for g, p in rf_cases if p["red_flags"])
    rf_false = sum(1 for g, p in all_ if not g["red_flags"] and p["red_flags"])
    flag_tp = sum(len(set(g["red_flags"]) & set(p["red_flags"])) for g, p in all_)
    flag_n = sum(len(g["red_flags"]) for g, _ in all_)
    tl_cases = [(g, p) for g, p in all_ if g["timeline"] or p["timeline"]]
    tl_exact = sum(1 for g, p in tl_cases if sorted(map(tuple, g["timeline"])) == sorted(map(tuple, p["timeline"])))
    on_exact = sum(1 for g, p in all_ if g["onset"] == p["onset"])
    cf = [(set(g["confounders"]), set(p["confounders"])) for g, p in all_]
    cf_f1 = _f1(sum(len(a & b) for a, b in cf), sum(len(b - a) for a, b in cf), sum(len(a - b) for a, b in cf))
    lat = sorted(latencies)
    p95 = lat[min(len(lat) - 1, math.ceil(0.95 * len(lat)) - 1)] if lat else None
    res = {"n": len(gold), "domain_macro_f1": by_lang["all"]["domain_macro_f1"],
           "worst_language_f1": min(v["domain_macro_f1"] for k, v in by_lang.items() if k != "all"),
           "by_language": by_lang,
           "urgent_recall": round(rf_hit / len(rf_cases), 3) if rf_cases else None,
           "urgent_recall_cases": f"{rf_hit}/{len(rf_cases)}",
           "urgent_recall_wilson_lower95": round(wilson_lower(rf_hit, len(rf_cases)), 3) if rf_cases else None,
           "red_flag_false_alarms": f"{rf_false}/{len(all_) - len(rf_cases)}",
           "red_flag_type_recall": round(flag_tp / flag_n, 3) if flag_n else None,
           "timeline_exact": round(tl_exact / len(tl_cases), 3) if tl_cases else None, "timeline_cases": f"{tl_exact}/{len(tl_cases)}",
           "onset_exact": round(on_exact / len(all_), 3), "confounder_f1": round(cf_f1, 3),
           "unsupported_rate": round(unsupported / items, 4) if items else 0.0, "unsupported_items": f"{unsupported}/{items}",
           "latency_p95_s": round(p95, 3) if p95 is not None else None}
    res["gates"] = [{"metric": m, "label": lab, "target": f"{op} {t}", "value": res[m],
                     "pass": (res[m] is not None and (res[m] >= t if op == ">=" else res[m] < t))} for m, op, t, lab in GATES]
    return res


def errors(gold, preds):
    out = []
    for g, p in zip(gold, preds):
        d = {}
        for k in ("domains", "red_flags", "confounders"):
            miss, extra = sorted(set(g[k]) - set(p[k])), sorted(set(p[k]) - set(g[k]))
            if miss or extra:
                d[k] = {"missed": miss, "extra": extra}
        if g["onset"] != p["onset"]:
            d["onset"] = {"gold": g["onset"], "pred": p["onset"]}
        if sorted(map(tuple, g["timeline"])) != sorted(map(tuple, p["timeline"])):
            d["timeline"] = {"gold": g["timeline"], "pred": [list(x) for x in p["timeline"]]}
        if d:
            out.append({"id": g["id"], **d})
    return out


def run_rules(gold):
    preds, lat = [], []
    for g in gold:
        t = time.perf_counter()
        r = I.extract_rules(g["text"], g["lang"])
        lat.append(time.perf_counter() - t)
        k = I.summary_keys(r)
        k["timeline"] = [list(x) for x in k["timeline"]]
        preds.append(k)
    return preds, lat


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", default="dev")
    ap.add_argument("--errors", action="store_true")
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args(argv)
    gold = load(a.set)
    preds, lat = run_rules(gold)
    res = score(gold, preds, lat)
    res.update({"engine": "rules", "version": I.INTAKE_VERSION, "set": a.set})
    print(json.dumps({k: v for k, v in res.items() if k not in ("by_language",)}, indent=1, ensure_ascii=False))
    if a.errors:
        print(json.dumps(errors(gold, preds), indent=1, ensure_ascii=False))
    if a.write:
        out = ROOT / "docs" / "navai"; out.mkdir(parents=True, exist_ok=True)
        res["errors"] = errors(gold, preds)
        (out / f"RESULTS_rules_{a.set}.json").write_text(json.dumps(res, indent=1, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
