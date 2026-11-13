"""Longitudinal change detection.

Release 1 (alert-driving): practice-adjusted Reliable Change Index
(Jacobson & Truax 1991; Chelune et al. 1993 practice adjustment) against a
multi-session personal baseline.

Exploratory only (never alert-driving until validated per subgroup):
per-person EWMA control charts on repeated voice features.
"""
from __future__ import annotations

import math

from . import config as C
from .scoring import composite_sd


def practice_gain(session_index: int, per_session: float) -> float:
    return per_session * min(session_index, C.PRACTICE_SATURATION)


def composite_practice_per_session() -> float:
    w = {d: C.DOMAINS[d]["weight"] for d in C.DOMAINS}
    z = sum(w[d] * C.DOMAINS[d]["practice"] / C.NORMS[d]["sd"] for d in C.DOMAINS) / sum(w.values())
    return z / composite_sd()


def rci(current: float, current_idx: int, baseline_vals: list[float], baseline_idx: list[int],
        sd: float, r: float, practice_per_session: float) -> dict:
    """Practice-adjusted RCI vs the mean of k baseline sessions.

    SEM = SD*sqrt(1-r); the baseline mean carries SEM^2/k error, so
    SE_diff = SEM*sqrt(1 + 1/k).
    """
    k = len(baseline_vals)
    base = sum(baseline_vals) / k
    exp_gain = practice_gain(current_idx, practice_per_session) - \
        sum(practice_gain(i, practice_per_session) for i in baseline_idx) / k
    sem = sd * math.sqrt(1 - r)
    se_diff = sem * math.sqrt(1 + 1 / k)
    value = ((current - base) - exp_gain) / se_diff
    return {"rci": round(value, 3), "baseline": round(base, 3), "current": round(current, 3),
            "observed_change": round(current - base, 3), "expected_practice": round(exp_gain, 3),
            "se_diff": round(se_diff, 3), "k_baseline": k}


def domain_rcis(raw: dict, idx: int, base_raws: list[dict], base_idx: list[int]) -> dict:
    out = {}
    for d, p in C.DOMAINS.items():
        out[d] = rci(raw[d], idx, [b[d] for b in base_raws], base_idx,
                     C.NORMS[d]["sd"], p["r"], p["practice"])
    return out


def composite_rci(z: float, idx: int, base_z: list[float], base_idx: list[int]) -> dict:
    return rci(z, idx, base_z, base_idx, 1.0, C.COMPOSITE_R, composite_practice_per_session())


def slope_per_year(days: list[float], values: list[float]) -> float | None:
    if len(days) < 3:
        return None
    n = len(days)
    mx, my = sum(days) / n, sum(values) / n
    sxx = sum((x - mx) ** 2 for x in days)
    if sxx == 0:
        return None
    return round(sum((x - mx) * (y - my) for x, y in zip(days, values)) / sxx * 365.25, 3)


def ewma_chart(values: list[float], lam: float = 0.3, L: float = 2.7, min_n: int = 4) -> dict:
    """Per-person EWMA on a repeated feature. EXPLORATORY: never drives alerts."""
    if len(values) < min_n:
        return {"status": "insufficient_history", "n": len(values), "exploratory": True}
    ref = values[:min_n - 1]
    mu = sum(ref) / len(ref)
    sd = (sum((v - mu) ** 2 for v in ref) / max(1, len(ref) - 1)) ** 0.5 or 1e-6
    z, flags = mu, []
    for i, v in enumerate(values[min_n - 1:], start=min_n - 1):
        z = lam * v + (1 - lam) * z
        lim = L * sd * math.sqrt(lam / (2 - lam) * (1 - (1 - lam) ** (2 * (i - min_n + 2))))
        if abs(z - mu) > lim:
            flags.append(i)
    return {"status": "signal" if flags else "in_control", "flag_indices": flags,
            "centre": round(mu, 3), "exploratory": True}
