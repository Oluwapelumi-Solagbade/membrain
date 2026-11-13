"""Validation metrics required by the challenge (requirement 6).

Works identically on synthetic data now and on Phase A/B study data later:
it only needs participants with sessions, engine evaluations and a
reference-standard label (specialist assessment in Phase B).
"""
from __future__ import annotations

import math
from collections import defaultdict

import numpy as np

from . import config as C
from .scoring import composite_z
from .simulate import A, true_theta
from .triage import evaluate_history

ALERT = ("CLINICIAN_REVIEW", "URGENT")


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float | None, float | None, float | None]:
    if n == 0:
        return None, None, None
    p = k / n
    den = 1 + z * z / n
    c = (p + z * z / (2 * n)) / den
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return round(p, 3), round(max(0, c - h), 3), round(min(1, c + h), 3)


def diag(pred: list[bool], truth: list[bool]) -> dict:
    tp = sum(p and t for p, t in zip(pred, truth)); fp = sum(p and not t for p, t in zip(pred, truth))
    fn = sum((not p) and t for p, t in zip(pred, truth)); tn = sum((not p) and (not t) for p, t in zip(pred, truth))
    return {"n": len(pred), "tp": tp, "fp": fp, "fn": fn, "tn": tn,
            "sensitivity": wilson(tp, tp + fn), "specificity": wilson(tn, tn + fp),
            "ppv": wilson(tp, tp + fp), "npv": wilson(tn, tn + fn),
            "referrals_per_confirmed": round((tp + fp) / tp, 2) if tp else None,
            "false_referrals": fp}


def icc_2_1(x: np.ndarray, y: np.ndarray) -> float | None:
    """Two-way random, absolute agreement, single measures (Shrout & Fleiss)."""
    if len(x) < 5:
        return None
    m = np.column_stack([x, y]); n, k = m.shape
    gm = m.mean()
    msr = k * ((m.mean(1) - gm) ** 2).sum() / (n - 1)
    msc = n * ((m.mean(0) - gm) ** 2).sum() / (k - 1)
    sse = ((m - m.mean(1, keepdims=True) - m.mean(0, keepdims=True) + gm) ** 2).sum()
    mse = sse / ((n - 1) * (k - 1))
    return round(float((msr - mse) / (msr + (k - 1) * mse + k * (msc - mse) / n)), 3)


def label(p: dict) -> dict:
    t = p["_truth"]
    d52 = true_theta(p, 52) - t["theta0"]
    crossing = None
    if d52 <= A["meaningful_decline_threshold_z"]:
        for w in np.arange(0, 52.5, 0.5):
            if true_theta(p, float(w)) - t["theta0"] <= A["meaningful_decline_threshold_z"]:
                crossing = float(w); break
    impaired = t["status"] in ("mci", "dementia")
    return {"impaired": impaired, "decline": d52 <= A["meaningful_decline_threshold_z"],
            "relevant": impaired or d52 <= A["meaningful_decline_threshold_z"], "crossing_week": crossing}


def strip_confounders(sessions: list[dict]) -> list[dict]:
    keep = ("session_id", "date", "week", "channel", "form", "raw", "audio", "iqcode")
    return [{k: s[k] for k in keep if k in s} for s in sessions]


def analyse(cohort: list[dict]) -> dict:
    rows = []
    for p in cohort:
        valid_sessions = [s for s in p["sessions"] if not s.get("incomplete")]
        evs = evaluate_history(p, valid_sessions) if valid_sessions else []
        lab = label(p)
        flagged = [e for e in evs if e["level"] in ALERT]
        first_flag_week = None
        if flagged:
            sid = flagged[0]["session_id"]
            first_flag_week = next(s["week"] for s in valid_sessions if s["session_id"] == sid)
        change_flag = any(e["level"] in ALERT and "rci" in e for e in evs)
        baseline_flag = any(e["level"] in ALERT and "baseline_composite_z" in e for e in evs)
        abl = evaluate_history(p, strip_confounders(valid_sessions)) if valid_sessions else []
        # usual care: education-blind single screen at week 0 and 52
        uc = False
        for s in p["sessions"]:
            if s["week"] in (0, 52) and s.get("raw"):
                if composite_z(s["raw"], C.NAIVE_NORM_EDUCATION, p["age"]) <= C.LOW_BASELINE_Z:
                    uc = True
        uc_week = next((s["week"] for s in p["sessions"] if s["week"] in (0, 52) and s.get("raw")
                        and composite_z(s["raw"], C.NAIVE_NORM_EDUCATION, p["age"]) <= C.LOW_BASELINE_Z), None)
        w0 = next((s for s in p["sessions"] if s["week"] == 0), None)
        w2 = next((s for s in p["sessions"] if s["week"] == 2), None)
        rows.append({
            "id": p["id"], "dialect": p["dialect"], "age_band": p["age_band"], "education": p["education"],
            "status": p["_truth"]["status"], **lab,
            "n_sessions": len(p["sessions"]),
            "completion_unaided": float(np.mean([s.get("completed_unaided", False) for s in p["sessions"]])),
            "completed_any": float(np.mean([not s.get("incomplete") for s in p["sessions"]])),
            "flag": bool(flagged), "change_flag": change_flag, "baseline_flag": baseline_flag,
            "first_flag_week": first_flag_week,
            "flag_weeks": [next(s["week"] for s in valid_sessions if s["session_id"] == e["session_id"]) for e in flagged],
            "n_check_again": sum(e["level"] == "CHECK_AGAIN" for e in evs),
            "flag_no_confounder_rules": any(e["level"] in ALERT for e in abl),
            "usual_care_flag": uc, "usual_care_week": uc_week,
            "rt_pair": (composite_z(w0["raw"], p["education"], p["age"]), composite_z(w2["raw"], p["education"], p["age"]))
            if (w0 and w2 and w0.get("raw") and w2.get("raw") and p["_truth"]["status"] == "normal"
                and not w0.get("assisted") and not w2.get("assisted")
                and (w0.get("phq2", 0) < 3 and w2.get("phq2", 0) < 3)) else None,
            "naive_baseline_low": bool(w0 and w0.get("raw") and composite_z(w0["raw"], C.NAIVE_NORM_EDUCATION, p["age"]) <= C.LOW_BASELINE_Z),
            "speech_rate": (w0 or {}).get("voice_features", {}).get("speech_rate_wpm") if w0 else None,
        })
    return {"rows": rows, "summary": summarise(rows)}


def _block(rows: list[dict]) -> dict:
    pairs = [r["rt_pair"] for r in rows if r["rt_pair"]]
    icc = icc_2_1(np.array([a for a, _ in pairs]), np.array([b for _, b in pairs])) if pairs else None
    practice = round(float(np.mean([b - a for a, b in pairs])), 3) if pairs else None
    return {
        "n": len(rows),
        "completion_unaided": round(float(np.mean([r["completion_unaided"] for r in rows])), 3) if rows else None,
        "test_retest_icc": icc, "practice_effect_z": practice, "n_retest_pairs": len(pairs),
        "membrain": diag([r["flag"] for r in rows], [r["relevant"] for r in rows]),
        "usual_care": diag([r["usual_care_flag"] for r in rows], [r["relevant"] for r in rows]),
        "baseline_stratified": diag([r["baseline_flag"] for r in rows], [r["impaired"] for r in rows]),
        "baseline_naive": diag([r["naive_baseline_low"] for r in rows], [r["impaired"] for r in rows]),
        "change_detection": diag([r["change_flag"] for r in rows if not r["impaired"] or r["decline"]],
                                 [r["decline"] for r in rows if not r["impaired"] or r["decline"]]),
    }


def summarise(rows: list[dict]) -> dict:
    out = {"overall": _block(rows), "subgroups": {}}
    for key in ("dialect", "age_band", "education"):
        groups = defaultdict(list)
        for r in rows:
            groups[r[key]].append(r)
        out["subgroups"][key] = {g: _block(v) for g, v in sorted(groups.items())}
    # time to detection (true decliners)
    lag_mb, lag_uc = [], []
    for r in rows:
        if r["decline"] and r["crossing_week"] is not None:
            if r["flag_weeks"]:
                after = [w for w in r["flag_weeks"] if w >= r["crossing_week"]] or [r["flag_weeks"][-1]]
                lag_mb.append(max(0.0, after[0] - r["crossing_week"]) + C.REVIEW_TARGET_DAYS["CLINICIAN_REVIEW"] / 7)
            if r["usual_care_week"] is not None:
                lag_uc.append(max(0.0, r["usual_care_week"] - r["crossing_week"]) + 16)  # assumed 16-week referral wait
    out["time_to_assessment_weeks"] = {
        "membrain_median": round(float(np.median(lag_mb)), 1) if lag_mb else None, "membrain_n": len(lag_mb),
        "decliners_total": sum(1 for r in rows if r["decline"] and r["crossing_week"] is not None),
        "usual_care_median": round(float(np.median(lag_uc)), 1) if lag_uc else None, "usual_care_n": len(lag_uc),
        "assumptions": "MemBrain: flag + 3-week review target. Usual care: annual screen + 16-week referral wait (assumption).",
    }
    out["confounder_rule_ablation"] = {
        "alerts_with_rules": sum(r["flag"] for r in rows),
        "alerts_without_rules": sum(r["flag_no_confounder_rules"] for r in rows),
        "false_alerts_with_rules": sum(r["flag"] and not r["relevant"] for r in rows),
        "false_alerts_without_rules": sum(r["flag_no_confounder_rules"] and not r["relevant"] for r in rows),
    }
    out["workload"] = {"check_again_repeats": sum(r["n_check_again"] for r in rows),
                       "sessions_total": sum(r["n_sessions"] for r in rows)}
    try:
        from sklearn.metrics import roc_auc_score
        sr = [(r["speech_rate"], r["impaired"]) for r in rows if r["speech_rate"] is not None]
        out["exploratory_voice"] = {"speech_rate_auc_impairment": round(float(roc_auc_score([t for _, t in sr], [-v for v, _ in sr])), 3),
                                    "note": "Exploratory only; not used for alerts."}
    except Exception:
        pass
    out["prevalence"] = {"impaired": round(float(np.mean([r["impaired"] for r in rows])), 3),
                         "decline_12m": round(float(np.mean([r["decline"] for r in rows])), 3)}
    return out
