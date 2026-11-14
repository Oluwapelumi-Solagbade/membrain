"""MemBrain evidence pack: robustness, operating-point sweep, ablation, decision curves,
prevalence sensitivity, subgroup fairness and Phase B sample size.

All results come from the SYNTHETIC cohort (membrain/simulate.py ASSUMPTIONS). They show how
the engine behaves under stated assumptions and how each design choice contributes. They are
NOT clinical accuracy estimates.

Usage:  python scripts/evidence_pack.py            (about 3 minutes on 2 cores)
Writes: docs/evidence/*.png, docs/evidence/evidence_summary.json, web/evidence.js
"""
from __future__ import annotations

import copy
import json
import math
import pathlib
import sys
from concurrent.futures import ProcessPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402

from membrain import config as C  # noqa: E402
from membrain.simulate import generate_cohort  # noqa: E402
from membrain.validation import analyse  # noqa: E402

OUT = ROOT / "docs" / "evidence"
OUT.mkdir(parents=True, exist_ok=True)
ALL_DOMAINS = list(C.DOMAINS)
CHOSEN = {"RCI_CHECK": -1.645, "TRIGGER_DOMAINS": ["memory_delayed"], "LOW_BASELINE_Z": -1.5, "BASELINE_SESSIONS": 2}


# ------------------------------------------------------------------ helpers
class Overrides:
    """Temporarily override engine config (restored afterwards)."""

    def __init__(self, values: dict | None):
        self.values = values or {}

    def __enter__(self):
        self.saved = {k: copy.deepcopy(getattr(C, k)) for k in self.values if k != "PRACTICE_ZERO"}
        if "PRACTICE_ZERO" in self.values:
            self.saved["DOMAINS"] = copy.deepcopy(C.DOMAINS)
        for k, v in self.values.items():
            if k == "PRACTICE_ZERO":
                for d in C.DOMAINS:
                    C.DOMAINS[d]["practice"] = 0.0
            else:
                setattr(C, k, copy.deepcopy(v))

    def __exit__(self, *a):
        for k, v in self.saved.items():
            if k == "DOMAINS":
                C.DOMAINS.clear(); C.DOMAINS.update(v)
            else:
                setattr(C, k, v)


def metrics(summary: dict) -> dict:
    o = summary["overall"]; mb = o["membrain"]; uc = o["usual_care"]; ch = o["change_detection"]
    n = mb["n"]; edu = summary["subgroups"]["education"]
    none = edu.get("none")
    return {
        "n": n, "prevalence": summary["prevalence"]["impaired"],
        "sensitivity": mb["sensitivity"][0], "specificity": mb["specificity"][0], "ppv": mb["ppv"][0],
        "sens_ci": mb["sensitivity"][1:], "spec_ci": mb["specificity"][1:],
        "referrals_per_confirmed": mb["referrals_per_confirmed"],
        "false_referrals_per_1000": round(1000 * mb["fp"] / n, 1), "alerts_per_1000": round(1000 * (mb["tp"] + mb["fp"]) / n, 1),
        "uc_sensitivity": uc["sensitivity"][0], "uc_specificity": uc["specificity"][0], "uc_ppv": uc["ppv"][0],
        "uc_false_referrals_per_1000": round(1000 * uc["fp"] / n, 1), "uc_referrals_per_confirmed": uc["referrals_per_confirmed"],
        "change_sensitivity": ch["sensitivity"][0], "change_specificity": ch["specificity"][0],
        "completion": o["completion_unaided"], "icc": o["test_retest_icc"],
        "fp_entry_noedu_stratified": round(1 - none["baseline_stratified"]["specificity"][0], 3) if none else None,
        "fp_entry_noedu_naive": round(1 - none["baseline_naive"]["specificity"][0], 3) if none else None,
        "sens_noedu": none["membrain"]["sensitivity"][0] if none else None,
        "time_to_assessment_weeks": summary["time_to_assessment_weeks"]["membrain_median"],
        "repeats_per_100": round(100 * summary["workload"]["check_again_repeats"] / n, 1),
        "tp": mb["tp"], "fp": mb["fp"], "fn": mb["fn"], "tn": mb["tn"],
        "uc_tp": uc["tp"], "uc_fp": uc["fp"], "uc_fn": uc["fn"], "uc_tn": uc["tn"],
    }


def run_protocol(args):
    """Protocol-level change: affects scheduling too, so applied before generation."""
    over, n, seed = args
    with Overrides(over):
        return metrics(analyse(generate_cohort(n, seed=seed))["summary"])


def run_eval_ablation(args):
    """Engine-only change on identical data: applied after generation."""
    name, over, edu_blind, n, seed = args
    cohort = generate_cohort(n, seed=seed)
    if edu_blind:
        for p in cohort:
            p["eval_education"] = C.NAIVE_NORM_EDUCATION
    with Overrides(over):
        s = analyse(cohort)["summary"]
    m = metrics(s)
    m["name"] = name
    m["no_confounder_alerts"] = s["confounder_rule_ablation"]["alerts_without_rules"]
    m["no_confounder_false"] = s["confounder_rule_ablation"]["false_alerts_without_rules"]
    return m


def net_benefit(sens, spec, prev, pt):
    return sens * prev - (1 - spec) * (1 - prev) * pt / (1 - pt)


def ppv_at(sens, spec, prev):
    return sens * prev / (sens * prev + (1 - spec) * (1 - prev))


def buderer(sens, spec, prev, half_width=0.07, z=1.96):
    n_sens = z * z * sens * (1 - sens) / half_width ** 2 / prev
    n_spec = z * z * spec * (1 - spec) / half_width ** 2 / (1 - prev)
    return math.ceil(n_sens), math.ceil(n_spec)


# ------------------------------------------------------------------ main
def main():
    ev = {"synthetic": True, "engine_version": C.ENGINE_VERSION,
          "note": "Synthetic cohort under stated assumptions; demonstrates engine behaviour, not clinical accuracy."}
    with ProcessPoolExecutor(max_workers=2) as ex:
        # 1. robustness across seeds (n=2000 each)
        seeds = list(range(101, 111))
        rob = list(ex.map(run_protocol, [(None, 2000, s) for s in seeds]))
        keys = ["sensitivity", "specificity", "ppv", "referrals_per_confirmed", "false_referrals_per_1000", "uc_sensitivity",
                "uc_specificity", "uc_ppv", "uc_referrals_per_confirmed", "change_sensitivity", "change_specificity", "completion",
                "icc", "fp_entry_noedu_stratified", "fp_entry_noedu_naive", "sens_noedu", "time_to_assessment_weeks", "repeats_per_100"]
        ev["robustness"] = {"seeds": seeds, "n_per_seed": 2000, "runs": rob,
                            "summary": {k: {"mean": round(float(np.mean([r[k] for r in rob])), 3),
                                            "sd": round(float(np.std([r[k] for r in rob], ddof=1)), 3),
                                            "min": round(float(min(r[k] for r in rob)), 3), "max": round(float(max(r[k] for r in rob)), 3)}
                                        for k in keys}}
        print("robustness done")

        # 2. operating-point sweep (n=1000, seed 11)
        grid = []
        for rci in (-1.282, -1.645, -1.96, -2.326):
            for trig_name, trig in (("composite only", []), ("composite + delayed recall", ["memory_delayed"]), ("any domain", ALL_DOMAINS)):
                for low in (-1.0, -1.5, -2.0):
                    for k in (2, 3):
                        grid.append(({"RCI_CHECK": rci, "TRIGGER_DOMAINS": trig, "LOW_BASELINE_Z": low, "BASELINE_SESSIONS": k},
                                     {"rci": rci, "trigger": trig_name, "low_baseline": low, "baseline_k": k}))
        res = list(ex.map(run_protocol, [(g[0], 1000, 11) for g in grid]))
        sweep = [{**g[1], **{k: r[k] for k in ("sensitivity", "specificity", "ppv", "false_referrals_per_1000", "referrals_per_confirmed",
                                               "change_sensitivity", "repeats_per_100", "sens_noedu")},
                  "chosen": g[0] == CHOSEN} for g, r in zip(grid, res)]
        # Pareto front: maximise sensitivity, minimise false referrals
        for s in sweep:
            s["pareto"] = not any(o["sensitivity"] >= s["sensitivity"] and o["false_referrals_per_1000"] <= s["false_referrals_per_1000"]
                                  and (o["sensitivity"] > s["sensitivity"] or o["false_referrals_per_1000"] < s["false_referrals_per_1000"]) for o in sweep)
        ev["sweep"] = {"n": 1000, "seed": 11, "configs": sweep}
        print("sweep done")

        # 2b. are the better-looking settings robust? Re-test on 5 fresh cohorts (n=2000) against the chosen default
        chosen = next(s for s in sweep if s["chosen"])
        cands = sorted([s for s in sweep if s["pareto"] and s["false_referrals_per_1000"] <= chosen["false_referrals_per_1000"]],
                       key=lambda s: -s["sensitivity"])[:2]
        trig_map = {"composite only": [], "composite + delayed recall": ["memory_delayed"], "any domain": ALL_DOMAINS}
        to_over = lambda s: {"RCI_CHECK": s["rci"], "TRIGGER_DOMAINS": trig_map[s["trigger"]], "LOW_BASELINE_Z": s["low_baseline"], "BASELINE_SESSIONS": s["baseline_k"]}
        checks = []
        for label, cfg in [("Chosen default", CHOSEN)] + [(f"Candidate {i + 1}", to_over(c)) for i, c in enumerate(cands)]:
            rr = list(ex.map(run_protocol, [(cfg, 2000, sd) for sd in range(201, 206)]))
            checks.append({"label": label, "config": {k: (v if k != "TRIGGER_DOMAINS" else ("composite + delayed recall" if v == ["memory_delayed"] else "composite only" if not v else "any domain")) for k, v in cfg.items()},
                           **{k: round(float(np.mean([r[k] for r in rr])), 3) for k in ("sensitivity", "specificity", "ppv", "false_referrals_per_1000",
                                                                                        "change_sensitivity", "time_to_assessment_weeks", "sens_noedu", "repeats_per_100")}})
        ev["candidate_check"] = {"seeds": list(range(201, 206)), "n_per_seed": 2000, "rows": checks}
        print("candidate check done")

        # 3. ablation on identical data (n=2000, seed 7)
        abl_specs = [
            ("Full MemBrain", None, False),
            ("No education/age-stratified norms", None, True),
            ("No practice-effect adjustment", {"PRACTICE_ZERO": True}, False),
            ("Single-session baseline (k=1)", {"BASELINE_SESSIONS": 1}, False),
            ("No confirmation on repeat", {"REQUIRE_CONFIRMATION": False}, False),
            ("Any domain can trigger", {"TRIGGER_DOMAINS": ALL_DOMAINS}, False),
        ]
        abl = list(ex.map(run_eval_ablation, [(nm, ov, eb, 2000, 7) for nm, ov, eb in abl_specs]))
    full = abl[0]
    abl.append({**full, "name": "No confounder rules", "false_referrals_per_1000": round(1000 * full["no_confounder_false"] / full["n"], 1),
                "alerts_per_1000": round(1000 * full["no_confounder_alerts"] / full["n"], 1), "derived": True})
    ev["ablation"] = {"n": 2000, "seed": 7, "rows": abl}
    print("ablation done")

    # 4. decision curve + 5. prevalence + 6. sample size (from robustness means)
    R = ev["robustness"]["summary"]
    prev = float(np.mean([r["prevalence"] for r in rob]))
    pts = [round(x, 3) for x in np.arange(0.05, 0.41, 0.01)]
    ev["decision_curve"] = {"prevalence": round(prev, 3), "pt": pts,
                            "membrain": [round(net_benefit(R["sensitivity"]["mean"], R["specificity"]["mean"], prev, p), 4) for p in pts],
                            "usual_care": [round(net_benefit(R["uc_sensitivity"]["mean"], R["uc_specificity"]["mean"], prev, p), 4) for p in pts],
                            "refer_all": [round(net_benefit(1, 0, prev, p), 4) for p in pts], "refer_none": [0.0 for _ in pts]}
    ev["prevalence_sensitivity"] = [{"setting": s, "prevalence": pv,
                                     "membrain_ppv": round(ppv_at(R["sensitivity"]["mean"], R["specificity"]["mean"], pv), 3),
                                     "usual_care_ppv": round(ppv_at(R["uc_sensitivity"]["mean"], R["uc_specificity"]["mean"], pv), 3)}
                                    for s, pv in (("Community outreach", 0.05), ("Screening programme, 50–75", round(prev, 3)), ("Memory clinic referrals", 0.30))]
    ns, nsp = buderer(R["sensitivity"]["mean"], R["specificity"]["mean"], prev)
    ev["sample_size"] = {"method": "Buderer (1996), 95% CI half-width 0.07", "expected_sensitivity": R["sensitivity"]["mean"],
                         "expected_specificity": R["specificity"]["mean"], "prevalence": round(prev, 3),
                         "n_for_sensitivity": ns, "n_for_specificity": nsp, "n_required": max(ns, nsp),
                         "per_subgroup_note": "Subgroup estimates (dialect, age, education) need either this n per stratum or enrichment "
                                              "sampling; final sizes set with the biostatistician."}
    # 7. subgroup fairness with CIs (seed 7, n=2000)
    full_summary = analyse(generate_cohort(2000, seed=7))["summary"]
    fair = {}
    for key, groups in full_summary["subgroups"].items():
        fair[key] = [{"group": g, "n": b["n"], "sensitivity": b["membrain"]["sensitivity"], "specificity": b["membrain"]["specificity"],
                      "naive_fp_entry": round(1 - b["baseline_naive"]["specificity"][0], 3),
                      "stratified_fp_entry": round(1 - b["baseline_stratified"]["specificity"][0], 3)} for g, b in groups.items()]
    ev["fairness"] = fair

    (OUT / "evidence_summary.json").write_text(json.dumps(ev, indent=1, default=str))
    (ROOT / "web" / "evidence.js").write_text("window.MB_EVIDENCE = " + json.dumps(ev, default=str) + ";\n")
    figures(ev)
    print("written", OUT)


# ------------------------------------------------------------------ figures
TEAL, ORANGE, BLUE, INK, MUTED, GRID = "#0b8a7a", "#c0761a", "#4b5fc0", "#1d2a2e", "#5f6b6e", "#e8e3d8"


def _style(ax, title, xlabel=None, ylabel=None):
    ax.set_title(title, loc="left", fontsize=12, fontweight="bold", color=INK, pad=10)
    if xlabel: ax.set_xlabel(xlabel, color=MUTED, fontsize=10)
    if ylabel: ax.set_ylabel(ylabel, color=MUTED, fontsize=10)
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    for s in ("left", "bottom"): ax.spines[s].set_color("#c9c3b6")
    ax.tick_params(colors=MUTED, labelsize=9)
    ax.grid(True, color=GRID, linewidth=0.8); ax.set_axisbelow(True)


def figures(ev):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams.update({"font.family": "Inter", "figure.dpi": 100, "savefig.dpi": 200})
    foot = "Synthetic cohort under stated assumptions. Shows engine behaviour, not clinical accuracy."

    # A. operating-point sweep
    sw = ev["sweep"]["configs"]
    fig, ax = plt.subplots(figsize=(8, 5))
    marks = {"composite only": "o", "composite + delayed recall": "s", "any domain": "^"}
    for trig, m in marks.items():
        xs = [s["false_referrals_per_1000"] for s in sw if s["trigger"] == trig]
        ys = [s["sensitivity"] for s in sw if s["trigger"] == trig]
        ax.scatter(xs, ys, marker=m, s=42, color=BLUE if trig == "any domain" else TEAL if "delayed" in trig else ORANGE,
                   alpha=0.75, edgecolor="white", linewidth=1.2, label=trig, zorder=3)
    front = sorted([s for s in sw if s["pareto"]], key=lambda s: s["false_referrals_per_1000"])
    ax.plot([s["false_referrals_per_1000"] for s in front], [s["sensitivity"] for s in front], color=INK, lw=1.2, ls="--", zorder=2, label="best trade-off")
    ch = next(s for s in sw if s["chosen"])
    ax.scatter([ch["false_referrals_per_1000"]], [ch["sensitivity"]], s=220, facecolor="none", edgecolor=INK, linewidth=2, zorder=4)
    ax.annotate("chosen operating point", (ch["false_referrals_per_1000"], ch["sensitivity"]), xytext=(12, -22),
                textcoords="offset points", fontsize=9, color=INK, arrowprops=dict(arrowstyle="-", color=INK, lw=0.8))
    _style(ax, "Sensitivity vs false referrals across 72 engine settings", "False referrals per 1,000 screened", "Sensitivity")
    ax.legend(frameon=False, fontsize=9, loc="lower right")
    fig.text(0.01, 0.01, foot, fontsize=8, color=MUTED); fig.tight_layout(rect=(0, 0.03, 1, 1))
    fig.savefig(OUT / "operating_point_sweep.png"); plt.close(fig)

    # B. ablation
    ab = ev["ablation"]["rows"]
    fig, axs = plt.subplots(1, 2, figsize=(10, 4.4), sharey=True)
    names = [a["name"] for a in ab][::-1]
    for ax, key, lab, col in ((axs[0], "sensitivity", "Sensitivity", TEAL), (axs[1], "false_referrals_per_1000", "False referrals per 1,000", ORANGE)):
        vals = [a[key] for a in ab][::-1]
        ax.barh(names, vals, color=[INK if n == "Full MemBrain" else col for n in names], height=0.6)
        for i, v in enumerate(vals):
            ax.text(v, i, f"  {v:.0%}" if key == "sensitivity" else f"  {v:.0f}", va="center", fontsize=9, color=INK)
        _style(ax, lab)
        ax.set_xlim(0, max(vals) * 1.25); ax.grid(axis="y", visible=False)
    fig.suptitle("What each design choice contributes (same synthetic data, n = 2,000)", x=0.01, ha="left", fontsize=12, fontweight="bold", color=INK)
    fig.text(0.01, 0.01, foot, fontsize=8, color=MUTED); fig.tight_layout(rect=(0, 0.03, 1, 0.95))
    fig.savefig(OUT / "ablation.png"); plt.close(fig)

    # C. decision curve
    dc = ev["decision_curve"]
    fig, ax = plt.subplots(figsize=(8, 4.6))
    ax.plot(dc["pt"], dc["membrain"], color=TEAL, lw=2.2, label="MemBrain")
    ax.plot(dc["pt"], dc["usual_care"], color=ORANGE, lw=2.2, label="Usual care (annual, education-blind)")
    ax.plot(dc["pt"], dc["refer_all"], color=BLUE, lw=1.5, ls="--", label="Refer everyone")
    ax.plot(dc["pt"], dc["refer_none"], color=MUTED, lw=1.2, label="Refer no one")
    ax.set_ylim(-0.05, max(dc["membrain"]) * 1.25)
    _style(ax, "Decision curve: net benefit across referral thresholds", "Threshold probability for referral", "Net benefit")
    ax.legend(frameon=False, fontsize=9)
    fig.text(0.01, 0.01, foot + f" Prevalence {dc['prevalence']:.0%}.", fontsize=8, color=MUTED); fig.tight_layout(rect=(0, 0.03, 1, 1))
    fig.savefig(OUT / "decision_curve.png"); plt.close(fig)

    # D. robustness
    runs = ev["robustness"]["runs"]
    fig, ax = plt.subplots(figsize=(8, 4.2))
    cats = [("Sensitivity", "sensitivity", "uc_sensitivity"), ("Specificity", "specificity", "uc_specificity"), ("PPV", "ppv", "uc_ppv")]
    for i, (lab, k1, k2) in enumerate(cats):
        for j, (k, col) in enumerate(((k1, TEAL), (k2, ORANGE))):
            ys = [r[k] for r in runs]; x = i + (j - 0.5) * 0.3
            ax.scatter([x + (np.random.default_rng(i * 10 + j).random(len(ys)) - 0.5) * 0.08], [ys], color=col, s=26, alpha=0.8, edgecolor="white", linewidth=0.8, zorder=3)
            ax.hlines(np.mean(ys), x - 0.1, x + 0.1, color=INK, lw=2, zorder=4)
    ax.set_xticks(range(3)); ax.set_xticklabels([c[0] for c in cats])
    ax.scatter([], [], color=TEAL, label="MemBrain"); ax.scatter([], [], color=ORANGE, label="Usual care")
    _style(ax, "Stable across 10 independent synthetic cohorts (n = 2,000 each)", None, "Value")
    ax.legend(frameon=False, fontsize=9, loc="lower right")
    fig.text(0.01, 0.01, foot, fontsize=8, color=MUTED); fig.tight_layout(rect=(0, 0.03, 1, 1))
    fig.savefig(OUT / "robustness.png"); plt.close(fig)

    # E. fairness forest (education + dialect)
    rows = [("Education", r) for r in ev["fairness"]["education"]] + [("Dialect", r) for r in ev["fairness"]["dialect"]] + \
           [("Age", r) for r in ev["fairness"]["age_band"]]
    labels = {"none": "No formal education", "primary": "Primary", "secondary": "Secondary", "tertiary": "Tertiary"}
    fig, axs = plt.subplots(1, 2, figsize=(10, 5.2), sharey=True)
    ylab = [f"{cat}: {labels.get(r['group'], r['group'])}" for cat, r in rows][::-1]
    for ax, key, title, col in ((axs[0], "sensitivity", "Sensitivity (95% CI)", TEAL), (axs[1], "specificity", "Specificity (95% CI)", BLUE)):
        for i, (_, r) in enumerate(rows[::-1]):
            p, lo, hi = r[key]
            ax.plot([lo, hi], [i, i], color=col, lw=2); ax.scatter([p], [i], color=col, s=36, zorder=3, edgecolor="white", linewidth=1)
        ax.set_yticks(range(len(ylab))); ax.set_yticklabels(ylab, fontsize=9); ax.set_xlim(0.4, 1.0)
        _style(ax, title)
    fig.suptitle("Performance by subgroup: gaps are reported, not hidden", x=0.01, ha="left", fontsize=12, fontweight="bold", color=INK)
    fig.text(0.01, 0.01, foot, fontsize=8, color=MUTED); fig.tight_layout(rect=(0, 0.03, 1, 0.95))
    fig.savefig(OUT / "subgroup_forest.png"); plt.close(fig)


if __name__ == "__main__":
    main()
