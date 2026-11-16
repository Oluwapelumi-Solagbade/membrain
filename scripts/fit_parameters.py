"""Fit MemBrain's statistical parameters from real check-in data (Phase 2), and check that the fitting recovers
known values on the synthetic cohort.

What it estimates (the values that are placeholders in membrain/config.py today):
  * norms per domain: mean raw score by education band at age 50, points lost per decade, residual SD
    (fitted on FIRST sessions of the reference sample, so no practice effect is mixed in)
  * test-retest reliability r per domain and for the composite: ICC(3,1) (consistency) on norm-referenced
    z-scores between the first two sessions, 1-6 weeks apart, in people who are stable
  * practice gain per domain: mean raw improvement from session 1 to session 2 in those same pairs
  * average inter-domain correlation (used for the composite's spread)

Every estimate comes with a bootstrap 95% CI (resampling participants) and the n it rests on. The script never
edits config.py: it prints the proposed values next to the current ones for the clinical team to approve.

    python scripts/fit_parameters.py --synthetic 4000      # recovery check on the simulator
    python scripts/fit_parameters.py --data phase2.jsonl   # real data (one JSON object per session)

Input fields per session: participant_id, age, education (none|primary|secondary|tertiary), session_index,
week (or date), raw {domain: score}, and optionally reference_normal (bool, from the independent clinical
reference), phq2, gad2, sleep_hours, acute_illness, audio.snr_db, assisted, channel.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
from datetime import date

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from membrain import config as C  # noqa: E402

BANDS = C.EDUCATION_BANDS
DOMS = list(C.DOMAINS)


def clean(s: dict) -> bool:
    """Same exclusions the engine applies: confounders and poor audio make a session unfit for calibration."""
    if not s.get("raw") or s.get("assisted"):
        return False
    if (s.get("phq2") or 0) >= C.PHQ2_CUTOFF or (s.get("gad2") or 0) >= C.GAD2_CUTOFF:
        return False
    if s.get("sleep_hours") is not None and s["sleep_hours"] < C.SLEEP_HOURS_LOW:
        return False
    if s.get("acute_illness"):
        return False
    if (s.get("audio") or {}).get("snr_db", 99) < C.AUDIO_MIN_SNR_DB:
        return False
    pc = s.get("precheck") or {}
    if pc.get("hearing_ok") is False or pc.get("vision_ok") is False or pc.get("noise_ok") is False:
        return False
    return (s.get("channel") or "app") == "app"


def week_of(s: dict) -> float:
    if s.get("week") is not None:
        return float(s["week"])
    return (date.fromisoformat(s["date"][:10]) - date(2000, 1, 1)).days / 7


def from_synthetic(n: int, seed: int) -> list[dict]:
    from membrain.simulate import generate_cohort
    rows = []
    for p in generate_cohort(n, seed=seed):
        for i, s in enumerate(p["sessions"]):
            rows.append({**s, "participant_id": p["id"], "age": p["age"] + s.get("week", 0) / 52, "education": p["education"],
                         "session_index": i, "reference_normal": p["_truth"]["status"] == "normal"})
    return rows


# ---------------------------------------------------------------- estimators
def fit_norms(first: list[dict]) -> dict:
    """OLS per domain: raw ~ education band + decades over 50. Returns config-shaped norms."""
    X = np.array([[1.0 if r["education"] == b else 0.0 for b in BANDS] + [max(0.0, (r["age"] - 50) / 10)] for r in first])
    out = {}
    for d in DOMS:
        y = np.array([r["raw"][d] for r in first], dtype=float)
        beta, *_ = np.linalg.lstsq(X, y, rcond=None)
        resid = y - X @ beta
        out[d] = {"mean": {b: float(beta[i]) for i, b in enumerate(BANDS)}, "age_per_decade": float(-beta[-1]),
                  "sd": float(np.sqrt(resid @ resid / max(1, len(y) - X.shape[1])))}
    return out


def z_of(r: dict, d: str, norms: dict) -> float:
    n = norms[d]
    return (r["raw"][d] - (n["mean"][r["education"]] - n["age_per_decade"] * max(0.0, (r["age"] - 50) / 10))) / n["sd"]


def composite(r: dict, norms: dict) -> float:
    w = {d: C.DOMAINS[d]["weight"] for d in DOMS}
    return sum(w[d] * z_of(r, d, norms) for d in DOMS) / sum(w.values())


def icc_3_1(x: np.ndarray, y: np.ndarray) -> float:
    """Two-way mixed, consistency, single measures: practice (a shift for everyone) is not counted as error,
    because the RCI removes practice separately."""
    m = np.column_stack([x, y]); n, k = m.shape
    gm = m.mean()
    msr = k * ((m.mean(1) - gm) ** 2).sum() / (n - 1)
    sse = ((m - m.mean(1, keepdims=True) - m.mean(0, keepdims=True) + gm) ** 2).sum()
    mse = sse / ((n - 1) * (k - 1))
    return float((msr - mse) / (msr + (k - 1) * mse))


def estimate(rows: list[dict]) -> dict:
    by_p: dict[str, list[dict]] = {}
    for r in rows:
        by_p.setdefault(r["participant_id"], []).append(r)
    ref = {p: sorted(v, key=lambda r: r["session_index"]) for p, v in by_p.items()
           if all(r.get("reference_normal", True) for r in v)}
    first = [v[0] for v in ref.values() if v and clean(v[0]) and v[0]["session_index"] == 0]
    norms = fit_norms(first)
    pairs = []
    for v in ref.values():
        if len(v) >= 2 and v[0]["session_index"] == 0 and v[1]["session_index"] == 1 and clean(v[0]) and clean(v[1]) \
                and 1 <= week_of(v[1]) - week_of(v[0]) <= 6:
            pairs.append((v[0], v[1]))
    rel, prac = {}, {}
    for d in DOMS:
        a = np.array([z_of(p0, d, norms) for p0, _ in pairs]); b = np.array([z_of(p1, d, norms) for _, p1 in pairs])
        rel[d] = icc_3_1(a, b)
        prac[d] = float(np.mean([p1["raw"][d] - p0["raw"][d] for p0, p1 in pairs]))
    ca = np.array([composite(p0, norms) for p0, _ in pairs]); cb = np.array([composite(p1, norms) for _, p1 in pairs])
    zs = np.array([[z_of(r, d, norms) for d in DOMS] for r in first])
    cm = np.corrcoef(zs.T); inter = float(cm[np.triu_indices(len(DOMS), 1)].mean())
    return {"norms": norms, "r": rel, "practice": prac, "composite_r": icc_3_1(ca, cb), "inter_domain_r": inter,
            "n_reference_people": len(ref), "n_first_sessions": len(first), "n_retest_pairs": len(pairs)}


def bootstrap(rows: list[dict], n_boot: int, seed: int) -> dict:
    """95% CIs by resampling participants (so a person's sessions stay together)."""
    rng = np.random.default_rng(seed)
    by_p: dict[str, list[dict]] = {}
    for r in rows:
        by_p.setdefault(r["participant_id"], []).append(r)
    ids = list(by_p)
    samples = []
    for b in range(n_boot):
        pick = rng.integers(0, len(ids), len(ids))
        rs = []
        for j, i in enumerate(pick):
            rs += [{**r, "participant_id": f"{ids[i]}#{j}"} for r in by_p[ids[i]]]
        samples.append(estimate(rs))

    def ci(get):
        v = np.array([get(s) for s in samples])
        return [round(float(np.percentile(v, 2.5)), 3), round(float(np.percentile(v, 97.5)), 3)]
    out = {"r": {d: ci(lambda s, d=d: s["r"][d]) for d in DOMS}, "practice": {d: ci(lambda s, d=d: s["practice"][d]) for d in DOMS},
           "composite_r": ci(lambda s: s["composite_r"]), "sd": {d: ci(lambda s, d=d: s["norms"][d]["sd"]) for d in DOMS},
           "age_per_decade": {d: ci(lambda s, d=d: s["norms"][d]["age_per_decade"]) for d in DOMS},
           "mean": {d: {b: ci(lambda s, d=d, b=b: s["norms"][d]["mean"][b]) for b in BANDS} for d in DOMS}}
    return out


def report(est: dict, cis: dict | None) -> str:
    f = lambda x: f"{x:.2f}"
    c = lambda path: (" [" + " – ".join(f(v) for v in path) + "]") if path else ""
    L = [f"Reference people: {est['n_reference_people']} · first sessions used for norms: {est['n_first_sessions']} · "
         f"retest pairs (1–6 weeks, clean, stable): {est['n_retest_pairs']}", "",
         "| Domain | r now | r fitted [95% CI] | practice now | practice fitted [95% CI] | SD now | SD fitted | age/decade now | fitted |",
         "|---|---|---|---|---|---|---|---|---|"]
    for d in DOMS:
        L.append(f"| {d} | {C.DOMAINS[d]['r']} | {f(est['r'][d])}{c(cis and cis['r'][d])} | {C.DOMAINS[d]['practice']} | "
                 f"{f(est['practice'][d])}{c(cis and cis['practice'][d])} | {C.NORMS[d]['sd']} | {f(est['norms'][d]['sd'])}{c(cis and cis['sd'][d])} | "
                 f"{C.NORMS[d]['age_per_decade']} | {f(est['norms'][d]['age_per_decade'])}{c(cis and cis['age_per_decade'][d])} |")
    L += ["", f"Composite r: now {C.COMPOSITE_R}, fitted {f(est['composite_r'])}{c(cis and cis['composite_r'])}. "
              f"Inter-domain r: now {C.INTER_DOMAIN_R}, fitted {f(est['inter_domain_r'])}.", "",
          "| Domain | " + " | ".join(f"mean {b} now → fitted" for b in BANDS) + " |", "|---|" + "---|" * len(BANDS)]
    for d in DOMS:
        L.append(f"| {d} | " + " | ".join(f"{C.NORMS[d]['mean'][b]} → {f(est['norms'][d]['mean'][b])}" for b in BANDS) + " |")
    L += ["", "Reliability is estimated on whole-point scores, as the app records them. Coarse scales lose reliability to rounding "
              "(on the 0–4 judgement scale a latent r of 0.70 becomes about 0.58), so fitted values are the ones to use."]
    return "\n".join(L)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", help="JSONL, one session per line")
    ap.add_argument("--synthetic", type=int, help="recovery check: simulate this many people")
    ap.add_argument("--seed", type=int, default=21)
    ap.add_argument("--boot", type=int, default=200)
    ap.add_argument("--out", help="write the estimates and CIs as JSON here")
    a = ap.parse_args(argv)
    rows = from_synthetic(a.synthetic, a.seed) if a.synthetic else \
        [json.loads(x) for x in pathlib.Path(a.data).read_text(encoding="utf-8").splitlines() if x.strip()]
    est = estimate(rows)
    cis = bootstrap(rows, a.boot, a.seed) if a.boot else None
    print(report(est, cis))
    if a.out:
        pathlib.Path(a.out).write_text(json.dumps({"estimates": est, "ci95": cis}, indent=1), encoding="utf-8")
    return est, cis


if __name__ == "__main__":
    main()
