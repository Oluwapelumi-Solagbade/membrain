"""Clinician-entered MoCA: the reference that the home check-in is validated against.

A certified clinician gives the official Arabic (or English) MoCA on paper or on the licensed app, then types the scores
here: the seven section scores (or only the total), the education point, the version and who gave it. MemBrain never
shows, copies or administers MoCA content; it stores scores only.

What the scores are used for:
- the case view shows them beside the home check-ins (and the referral summary carries them);
- Live data compares each clinic MoCA with the person's nearest home check-in (within 30 days): rank correlation,
  how well the home score separates people below the MoCA cut-off (AUC), and agreement between a home flag and a
  MoCA below the cut-off. These are agreement with a screening test, not accuracy against a diagnosis.
The MoCA never changes a triage result. Cut-off 26 is the standard one, used in the Arabic validation (Rahman and
El Gaafary 2009); the local cut-off is set in the pilot (MOCA_CUT).
"""
from __future__ import annotations

import os
from datetime import date, datetime, timezone

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth import Principal, principal

router = APIRouter(tags=["moca"])

# Section names and maxima of MoCA 8.x (scores only; no test content)
SECTIONS = {"visuospatial": 5, "naming": 3, "attention": 6, "language": 3, "abstraction": 2, "delayed_recall": 5, "orientation": 6}
VERSIONS = ("Arabic MoCA 8.1", "Arabic MoCA 8.2", "Arabic MoCA 8.3", "Arabic MoCA 7.1", "English MoCA 8.1", "English MoCA 8.2",
            "English MoCA 8.3", "Other")
CUT = int(os.environ.get("MOCA_CUT", "26"))
WINDOW_DAYS = 30
MIN_PAIRS = 5
FLAG = ("CLINICIAN_REVIEW", "URGENT")


class MocaIn(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    version: str = Field(..., max_length=40)
    language: str = Field("ar", pattern="^(ar|en)$")
    total: int | None = Field(None, ge=0, le=30)
    sections: dict[str, int] | None = None
    education_point: bool = False
    certified: bool = Field(..., description="The person who gave it holds MoCA certification")
    given_by: str = Field("", max_length=80)
    notes: str = Field("", max_length=400)


def score(body: MocaIn) -> dict:
    """Check the entry and work out the total (sections + education point, capped at 30)."""
    if body.version not in VERSIONS:
        raise HTTPException(422, "Choose the MoCA version from the list.")
    if not body.certified:
        raise HTTPException(422, "Only a MoCA given by a certified person can be recorded as the reference.")
    secs = None
    if body.sections:
        unknown = set(body.sections) - set(SECTIONS)
        if unknown:
            raise HTTPException(422, f"Unknown section: {', '.join(sorted(unknown))}")
        for k, v in body.sections.items():
            if not 0 <= v <= SECTIONS[k]:
                raise HTTPException(422, f"{k.replace('_', ' ').capitalize()} is scored 0 to {SECTIONS[k]}.")
        if len(body.sections) == len(SECTIONS):
            secs = dict(body.sections)
        elif body.total is None:
            raise HTTPException(422, "Enter all seven sections, or the total.")
    if secs:
        total = min(30, sum(secs.values()) + (1 if body.education_point else 0))
        if body.total is not None and body.total != total:
            raise HTTPException(422, f"The sections add up to {total} (with the education point), not {body.total}.")
    elif body.total is not None:
        total = body.total
    else:
        raise HTTPException(422, "Enter the total, or all seven sections.")
    if date.fromisoformat(body.date) > date.today():
        raise HTTPException(422, "The date is in the future.")
    return {"date": body.date, "version": body.version, "language": body.language, "total": total, "sections": secs,
            "education_point": body.education_point, "below_cut": total < CUT, "cut": CUT,
            "given_by": body.given_by.strip(), "notes": body.notes.strip()}


def suggested_education_point(band: str | None) -> bool:
    # MoCA rule: one point for 12 years of schooling or fewer
    return band in ("none", "primary", "secondary")


def _staff(who: Principal):
    if who.role not in ("clinician", "coordinator"):
        raise HTTPException(401 if who.role == "anonymous" else 403, "Please sign in as a clinician.")


@router.get("/participants/{pid}/moca")
def list_moca(pid: str, who: Principal = Depends(principal)):
    _staff(who)
    from api.main import DB
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    return {"records": p.get("moca", []), "sections": SECTIONS, "versions": VERSIONS, "cut": CUT,
            "education_point_suggested": suggested_education_point(p.get("education")),
            "nearest_checkin": [_nearest(p, m) for m in p.get("moca", [])]}


@router.post("/participants/{pid}/moca")
def add_moca(pid: str, body: MocaIn, who: Principal = Depends(principal)):
    if who.role != "clinician":
        raise HTTPException(401 if who.role == "anonymous" else 403, "Only a clinician can record a MoCA.")
    from api.main import DB, audit
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    rec = {**score(body), "ts": datetime.now(timezone.utc).isoformat(), "entered_by": who.actor}
    p.setdefault("moca", []).append(rec)
    audit(who.actor, "moca_recorded", pid, {"total": rec["total"], "version": rec["version"], "sections": bool(rec["sections"])})
    return {**rec, "nearest_checkin": _nearest(p, rec)}


# ---- validation against the home check-in ---------------------------------------------------------------------------

def _d(s):
    try:
        return date.fromisoformat(str(s)[:10])
    except (TypeError, ValueError):
        return None


def _nearest(p: dict, m: dict, hist: list | None = None) -> dict | None:
    """The valid home check-in closest in time to this MoCA, within 30 days."""
    if hist is None:
        from membrain.triage import evaluate
        hist = evaluate(p, p["sessions"])["history"] if p.get("sessions") else []
    md = _d(m["date"])
    best = None
    for h in hist:
        hd = _d(h.get("date"))
        if not (h.get("valid") and h.get("z") and hd and md):
            continue
        gap = abs((hd - md).days)
        if gap <= WINDOW_DAYS and (best is None or gap < best["gap_days"]):
            best = {"date": h["date"], "gap_days": gap, "composite_z": h["z"]["composite"],
                    "memory_delayed_z": h["z"]["domains"].get("memory_delayed"), "level": h["level"]}
    return best


def _rank(a: np.ndarray) -> np.ndarray:
    order = a.argsort()
    r = np.empty(len(a), float)
    r[order] = np.arange(len(a), dtype=float)
    for v in np.unique(a):   # average ranks for ties
        idx = a == v
        r[idx] = r[idx].mean()
    return r


def spearman(x, y) -> float | None:
    x, y = np.asarray(x, float), np.asarray(y, float)
    if len(x) < MIN_PAIRS or x.std() == 0 or y.std() == 0:
        return None
    rx, ry = _rank(x), _rank(y)
    return float(np.corrcoef(rx, ry)[0, 1])


def auc(scores, positive) -> float | None:
    """Probability that a person below the MoCA cut-off has a lower home score than one above it."""
    s, pos = np.asarray(scores, float), np.asarray(positive, bool)
    a, b = s[pos], s[~pos]
    if len(s) < MIN_PAIRS or not len(a) or not len(b):
        return None
    wins = sum((x < y) + 0.5 * (x == y) for x in a for y in b)
    return float(wins / (len(a) * len(b)))


def validation(db: dict) -> dict:
    from membrain.triage import evaluate
    rows = []
    records = people = 0
    for p in db["participants"].values():
        ms = p.get("moca") or []
        if not ms:
            continue
        people += 1
        records += len(ms)
        hist = evaluate(p, p["sessions"])["history"] if p.get("sessions") else []
        for m in ms:
            n = _nearest(p, m, hist)
            if n:
                rows.append((m, n))
    tot = [m["total"] for m, _ in rows]
    comp = [n["composite_z"] for _, n in rows]
    below = [m["below_cut"] for m, _ in rows]
    rec = [(m["sections"]["delayed_recall"], n["memory_delayed_z"]) for m, n in rows
           if m.get("sections") and n.get("memory_delayed_z") is not None]
    flagged = [n["level"] in FLAG for _, n in rows]
    tp = sum(1 for f, b in zip(flagged, below) if f and b)
    fn = sum(1 for f, b in zip(flagged, below) if not f and b)
    tn = sum(1 for f, b in zip(flagged, below) if not f and not b)
    fp = sum(1 for f, b in zip(flagged, below) if f and not b)
    enough = len(rows) >= MIN_PAIRS
    rho = spearman(comp, tot)
    rho_rec = spearman([b for _, b in rec], [a for a, _ in rec])
    a = auc(comp, below)
    return {
        "records": records, "people": people, "pairs": len(rows), "window_days": WINDOW_DAYS, "cut": CUT, "min_pairs": MIN_PAIRS,
        "below_cut": sum(below),
        "median_gap_days": float(np.median([n["gap_days"] for _, n in rows])) if rows else None,
        "spearman_total": round(rho, 3) if rho is not None else None,
        "spearman_delayed_recall": round(rho_rec, 3) if rho_rec is not None else None, "recall_pairs": len(rec),
        "auc_below_cut": round(a, 3) if a is not None else None,
        "agreement": {"flag_and_below": tp, "no_flag_but_below": fn, "no_flag_and_above": tn, "flag_but_above": fp,
                      "sensitivity": round(tp / (tp + fn), 3) if enough and tp + fn else None,
                      "specificity": round(tn / (tn + fp), 3) if enough and tn + fp else None},
    }
