"""Synthetic cohort generator (NO real participant data).

Purpose: exercise the full validation pipeline end-to-end before Phase A,
and stress-test thresholds. All parameters are assumptions, listed in
ASSUMPTIONS below and in docs/ASSUMPTIONS.md. Results describe the
behaviour of the engine under these assumptions, NOT clinical accuracy.
"""
from __future__ import annotations

import math
from datetime import date, timedelta

import numpy as np

from . import config as C
from .items import form_for_session
from .scoring import expected_raw
from .triage import evaluate_history

ASSUMPTIONS = {
    "dialect_mix": {"Emirati": 0.30, "Other Gulf": 0.15, "Levantine": 0.15, "Egyptian": 0.15, "English": 0.25},
    "education_mix": {"none": 0.10, "primary": 0.20, "secondary": 0.40, "tertiary": 0.30},
    "status_prevalence_age50_75": {"normal": 0.85, "mci": 0.11, "dementia": 0.04},
    "latent_mean_z": {"normal": 0.0, "mci": -1.1, "dementia": -2.2},
    "annual_decline_z": {"normal": (-0.03, 0.05), "mci_progressor": (-0.6, 0.2), "dementia": (-0.9, 0.3)},
    "mci_progressor_share": 0.5,
    "normal_incident_decline_per_year": 0.04,
    "depression_prevalence": 0.12, "depression_active_per_session": 0.5, "depression_effect_z": -0.35,
    "poor_sleep_per_session": 0.15, "poor_sleep_effect_z": -0.15,
    "illness_per_session": 0.05, "illness_effect_z": -0.35,
    "noisy_audio_per_session": 0.06,
    "asr_bias_raw_fluency": {"Emirati": 0.0, "Other Gulf": -0.2, "Levantine": -0.3, "Egyptian": -0.6, "English": 0.0},
    "schedule_weeks": [0, 2, 12, 26, 52],
    "repeat_after_check_again_weeks": 3,
    "meaningful_decline_threshold_z": -0.5,
    "usual_care": "single screen at week 0 and 52, education-blind norms, composite z <= -1.5 -> referral",
}
A = ASSUMPTIONS


def _pick(rng, d: dict):
    keys = list(d)
    return keys[rng.choice(len(keys), p=np.array(list(d.values())) / sum(d.values()))]


def make_participant(rng, i: int) -> dict:
    age = float(rng.uniform(50, 75))
    dialect = _pick(rng, A["dialect_mix"])
    edu = _pick(rng, A["education_mix"])
    p_dem = 0.01 + 0.06 * (age - 50) / 25
    p_mci = 0.07 + 0.08 * (age - 50) / 25
    u = rng.random()
    status = "dementia" if u < p_dem else "mci" if u < p_dem + p_mci else "normal"
    theta0 = rng.normal(A["latent_mean_z"][status], math.sqrt(0.5) if status == "normal" else 0.55)
    if status == "normal":
        m, s = A["annual_decline_z"]["normal"]
        incident = rng.random() < A["normal_incident_decline_per_year"]
        rate = rng.normal(-0.7, 0.2) if incident else rng.normal(m, s)
        onset_week = float(rng.uniform(0, 40)) if incident else None
    elif status == "mci":
        prog = rng.random() < A["mci_progressor_share"]
        m, s = A["annual_decline_z"]["mci_progressor"] if prog else A["annual_decline_z"]["normal"]
        rate, onset_week = rng.normal(m, s), 0.0 if prog else None
    else:
        m, s = A["annual_decline_z"]["dementia"]
        rate, onset_week = rng.normal(m, s), 0.0
    ctx = {
        "sbp": float(rng.normal(132, 16)), "dbp": float(rng.normal(82, 10)), "hba1c": float(max(4.8, rng.normal(6.1, 1.0))),
        "ldl": float(max(1.0, rng.normal(3.0, 0.8))), "bmi": float(rng.normal(29, 5)),
        "activity_min_week": float(max(0, rng.normal(110, 80))), "smoker": bool(rng.random() < 0.18),
        "hearing_difficulty": bool(rng.random() < 0.08 + 0.3 * (age - 50) / 25),
        "vision_difficulty": bool(rng.random() < 0.10), "social_isolation": bool(rng.random() < 0.12),
        "family_history_dementia": bool(rng.random() < 0.15), "sleep_hours": float(rng.normal(6.5, 1.0)),
        "education": edu,
    }
    return {"id": f"SYN{i:05d}", "age": round(age, 1), "age_band": "50-59" if age < 60 else "60-69" if age < 70 else "70-75",
            "sex": "F" if rng.random() < 0.5 else "M", "education": edu, "dialect": dialect,
            "language": "en" if dialect == "English" else "ar", "context": ctx,
            "consent": {"voice_features": True, "wearables": rng.random() < 0.6, "clinical_record": True,
                        "family_history": True, "genomics": False, "raw_audio": rng.random() < 0.5},
            "_truth": {"status": status, "theta0": float(theta0), "rate_per_year": float(rate), "onset_week": onset_week,
                       "depressed": bool(rng.random() < A["depression_prevalence"]),
                       "unique": {d: float(rng.normal(0, math.sqrt(max(0.01, C.DOMAINS[d]["r"] - 0.5)))) for d in C.DOMAINS}}}


def true_theta(p: dict, week: float) -> float:
    t = p["_truth"]
    if t["onset_week"] is None:
        return t["theta0"] + t["rate_per_year"] * week / 52
    return t["theta0"] + t["rate_per_year"] * max(0.0, week - t["onset_week"]) / 52


def make_session(rng, p: dict, week: float, idx: int, start: date, seed: int) -> dict:
    t = p["_truth"]
    age, edu = p["age"] + week / 52, p["education"]
    hard = (edu == "none") + (age > 70) + p["context"]["hearing_difficulty"] + (t["status"] == "dementia")
    s = {"session_id": f"{p['id']}-{idx}", "date": (start + timedelta(weeks=week)).isoformat(),
         "week": week, "channel": "app", "form": form_for_session(idx, seed)}
    s["completed_unaided"] = bool(rng.random() < 1 / (1 + math.exp(-(3.2 - 0.9 * hard))))
    s["assisted"] = not s["completed_unaided"] and rng.random() < 0.8
    if not s["completed_unaided"] and not s["assisted"]:
        s["raw"] = None
        s["incomplete"] = True
        return s
    eff = 0.0
    dep_active = t["depressed"] and rng.random() < A["depression_active_per_session"]
    s["phq2"] = int(rng.integers(3, 7)) if dep_active else int(rng.integers(0, 3))
    s["gad2"] = int(rng.integers(3, 7)) if (dep_active and rng.random() < 0.6) else int(rng.integers(0, 3))
    eff += A["depression_effect_z"] if dep_active else 0
    if rng.random() < A["poor_sleep_per_session"]:
        s["sleep_hours"] = float(rng.uniform(3.5, 5.4)); eff += A["poor_sleep_effect_z"]
    else:
        s["sleep_hours"] = float(rng.uniform(5.6, 8.5))
    if rng.random() < A["illness_per_session"]:
        s["acute_illness"] = True; eff += A["illness_effect_z"]
    hear_fail = p["context"]["hearing_difficulty"] and rng.random() < 0.3
    s["precheck"] = {"hearing_ok": not hear_fail, "vision_ok": True, "noise_ok": True}
    eff += -0.25 if hear_fail else 0
    noisy = rng.random() < A["noisy_audio_per_session"]
    s["audio"] = {"snr_db": float(rng.uniform(5, 14) if noisy else rng.uniform(18, 35)), "clipping": 0.0,
                  "speech_ratio": 0.6, "duration_s": 30.0}
    theta = true_theta(p, week) + eff
    raw = {}
    for d, prm in C.DOMAINS.items():
        z = theta + t["unique"][d] + rng.normal(0, math.sqrt(1 - prm["r"]))
        val = expected_raw(d, edu, age) + C.NORMS[d]["sd"] * z + prm["practice"] * min(idx, C.PRACTICE_SATURATION)
        if d == "fluency":
            val += A["asr_bias_raw_fluency"][p["dialect"]] * (1.5 if edu == "none" else 1.0)
        raw[d] = int(np.clip(round(val), 0, prm["max"]))
    s["raw"] = raw
    # exploratory voice features (not alert-driving)
    s["voice_features"] = {"speech_rate_wpm": float(120 + 12 * theta + rng.normal(0, 8)),
                           "pause_ratio": float(np.clip(0.25 - 0.03 * theta + rng.normal(0, 0.03), 0.05, 0.8)),
                           "type_token_ratio": float(np.clip(0.55 + 0.03 * theta + rng.normal(0, 0.04), 0.2, 0.9))}
    return s


def informant_iqcode(rng, p: dict, week: float) -> float:
    base = {"normal": 3.0, "mci": 3.3, "dementia": 3.7}[p["_truth"]["status"]]
    decline = min(0.0, true_theta(p, week) - p["_truth"]["theta0"])
    return float(np.clip(base - 0.35 * decline + rng.normal(0, 0.12), 1, 5))


def simulate_participant(rng, p: dict, start: date, seed: int) -> list[dict]:
    sessions, idx = [], 0
    pending = list(A["schedule_weeks"])
    done_weeks = set()
    while pending:
        wk = pending.pop(0)
        if wk in done_weeks or wk > 56:
            continue
        done_weeks.add(wk)
        s = make_session(rng, p, wk, idx, start, seed)
        if wk in (0, 52):
            s["iqcode"] = round(informant_iqcode(rng, p, wk), 2)
        sessions.append(s)
        idx += 1
        ev = evaluate_history(p, [x for x in sessions if not x.get("incomplete")]) if s.get("raw") else []
        if ev and ev[-1]["level"] == "CHECK_AGAIN":
            pending.append(wk + A["repeat_after_check_again_weeks"])
            pending.sort()
        if ev and ev[-1]["level"] in ("CLINICIAN_REVIEW", "URGENT") and wk > 2:
            # referred: further monitoring happens in the care pathway
            pending = [w for w in pending if w <= wk]
    return sessions


def generate_cohort(n: int = 1500, seed: int = 7) -> list[dict]:
    rng = np.random.default_rng(seed)
    cohort = []
    start = date(2027, 1, 4)
    for i in range(n):
        p = make_participant(rng, i)
        p["sessions"] = simulate_participant(rng, p, start + timedelta(days=int(rng.integers(0, 60))), i)
        cohort.append(p)
    return cohort
