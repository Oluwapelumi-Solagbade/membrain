"""Live statistics on what real visitors have done in the demo (never the synthetic people's made-up history).

Mapped to the challenge's validation criterion: completion, test-retest reliability, meaningful change, false-referral
burden (how often a clinician disagreed with a flag), time from concern to clinical assessment, and the same numbers by
language, age and schooling. Sensitivity and specificity need a reference diagnosis for each person (a clinician's
assessment in the pilot), so they are reported as "not measurable yet" rather than guessed.

Every number is recomputed from the stored records on each request, so it moves as people use the demo.
"""
from __future__ import annotations

from datetime import date, datetime
from statistics import median

import numpy as np
from fastapi import APIRouter, Depends, HTTPException

from api import store
from api.auth import Principal, principal
from membrain.triage import evaluate

router = APIRouter(prefix="/live", tags=["live"])

REPORT_TYPES = ("intake", "informant")
FLAG = ("CLINICIAN_REVIEW", "URGENT")
AGREED = ("confirm_concern", "refer", "order_investigations")
MIN_PAIRS = 5   # below this, reliability is shown as "needs more data"


def _icc_3_1(x: np.ndarray, y: np.ndarray) -> float:
    m = np.column_stack([x, y]); n, k = m.shape
    gm = m.mean()
    msr = k * ((m.mean(1) - gm) ** 2).sum() / (n - 1)
    sse = ((m - m.mean(1, keepdims=True) - m.mean(0, keepdims=True) + gm) ** 2).sum()
    mse = sse / ((n - 1) * (k - 1))
    return float((msr - mse) / (msr + (k - 1) * mse)) if (msr + (k - 1) * mse) else float("nan")


def _d(s: str | None) -> date | None:
    try:
        return datetime.fromisoformat(str(s)[:10]).date() if s else None
    except ValueError:
        return None


def _age_band(age) -> str:
    if age is None:
        return "not given"
    a = int(age)
    return "under 50" if a < 50 else "50-59" if a < 60 else "60-69" if a < 70 else "70+"


def _seg() -> dict:
    return {"people": 0, "checkins": 0, "scored": 0, "flagged_people": 0}


def compute(db: dict) -> dict:
    people = []
    for p in db["participants"].values():
        live = store.live_sessions(p)
        if live:
            people.append((p, live))

    concerns = checkins = scored = informant = 0
    not_scored_reasons: dict[str, int] = {}
    reporters: dict[str, int] = {}
    pairs: list[tuple[float, float, int]] = []
    latest_levels: dict[str, int] = {}
    seg = {"language": {}, "age": {}, "schooling": {}}
    concern_then_checkin = [0, 0]

    for p, live in people:
        live_ids = {s.get("session_id") for s in live}
        hist = evaluate(p, p["sessions"])["history"]
        live_hist = [h for h in hist if h.get("session_id") in live_ids]
        lang = (next((s.get("lang") for s in live if s.get("lang")), None) or p.get("language") or "unknown")
        keys = {"language": {"ar": "Arabic", "en": "English"}.get(lang, lang), "age": _age_band(p.get("age")),
                "schooling": p.get("education") or "not given"}
        for dim, k in keys.items():
            seg[dim].setdefault(k, _seg())["people"] += 1

        p_checkins = 0
        for s in live:
            t = s.get("type")
            if t == "intake":
                concerns += 1
                rep = (s.get("reported_concern") or {}).get("reporter") or "unknown"
                reporters[rep] = reporters.get(rep, 0) + 1
            elif t == "informant":
                informant += 1
            else:
                checkins += 1; p_checkins += 1
                for dim, k in keys.items():
                    seg[dim][k]["checkins"] += 1
        for h in live_hist:
            if h.get("intake") or h.get("informant_report"):
                continue
            if h.get("valid"):
                scored += 1
                for dim, k in keys.items():
                    seg[dim][k]["scored"] += 1
            else:
                why = next((r.replace("Session not scored: ", "") for r in h.get("reasons", []) if r.startswith("Session not scored")), "other")
                not_scored_reasons[why] = not_scored_reasons.get(why, 0) + 1
        if any(s.get("type") == "intake" for s in live):
            concern_then_checkin[1] += 1
            concern_then_checkin[0] += 1 if p_checkins else 0

        # test-retest: the person's first two valid LIVE check-ins (both done by a real visitor)
        valid = [h for h in live_hist if h.get("valid") and h.get("z")]
        if len(valid) >= 2:
            a, b = valid[0], valid[1]
            gap = (_d(b["date"]) - _d(a["date"])).days if _d(a["date"]) and _d(b["date"]) else 0
            pairs.append((a["z"]["composite"], b["z"]["composite"], gap))
        if live_hist:
            lv = live_hist[-1]["level"]
            latest_levels[lv] = latest_levels.get(lv, 0) + 1
            if any(h["level"] in FLAG for h in live_hist):   # sent to a clinician at any point
                for dim, k in keys.items():
                    seg[dim][k]["flagged_people"] += 1

    # reliability
    rel: dict = {"pairs": len(pairs), "min_pairs": MIN_PAIRS}
    if len(pairs) >= 2:
        x = np.array([a for a, _, _ in pairs]); y = np.array([b for _, b, _ in pairs])
        rel["mean_change_z"] = round(float((y - x).mean()), 3)
        rel["median_days_apart"] = int(median(g for *_, g in pairs))
    if len(pairs) >= MIN_PAIRS:
        rel["icc_3_1"] = round(_icc_3_1(x, y), 3)
        rel["pearson_r"] = round(float(np.corrcoef(x, y)[0, 1]), 3)

    # clinician review of flags raised at runtime
    live_pids = {p["id"] for p, _ in people}
    tasks = [t for t in db["tasks"].values() if t.get("participant_id") in live_pids and t.get("created")]
    agreed = sum(1 for t in tasks if any(a.get("action") in AGREED for a in t.get("actions", [])))
    dismissed = sum(1 for t in tasks if any(a.get("action") == "dismiss" for a in t.get("actions", [])))
    waits = []
    for t in tasks:
        first = next((a for a in t.get("actions", []) if a.get("ts")), None)
        if first and _d(t["created"]):
            waits.append(max(0, (_d(first["ts"]) - _d(t["created"])).days))
    review = {"flags": len(tasks), "reviewed": agreed + dismissed, "agreed": agreed, "dismissed": dismissed,
              "open": sum(1 for t in tasks if t.get("status") != "closed"),
              "false_referral_share": round(dismissed / (agreed + dismissed), 3) if agreed + dismissed else None,
              "median_days_to_first_action": median(waits) if waits else None}

    # concern -> clinical assessment (Navigator referral states)
    to_ref, to_seen = [], []
    for p, _ in people:
        for ref in p.get("referrals", []):
            cd = _d(ref.get("concern_date"))
            hist = ref.get("history") or []
            rec = next((_d(h.get("date")) for h in hist if h.get("state") == "recommended"), None) or _d(ref.get("created"))
            seen = next((_d(h.get("date")) for h in hist if h.get("state") in ("attended", "assessment_completed")), None)
            if cd and rec:
                to_ref.append((rec - cd).days)
            if cd and seen:
                to_seen.append((seen - cd).days)
    timing = {"referrals": len(to_ref), "median_days_concern_to_referral": median(to_ref) if to_ref else None,
              "assessed": len(to_seen), "median_days_concern_to_assessment": median(to_seen) if to_seen else None}

    # AI drafting of referral letters, measured from the audit log (drafts and clinician approvals)
    drafts = [a["detail"] for a in db["audit"] if a.get("action") == "referral_drafted"]
    approvals = [a["detail"] for a in db["audit"] if a.get("action") == "referral_letter_approved"]
    md = [d for d in drafts if d.get("engine") == "medgemma"]
    checked = sum(d.get("checked") or 0 for d in md)
    removed = sum(d.get("removed") or 0 for d in md)
    lat = [d["latency_ms"] for d in md if d.get("latency_ms") is not None]
    ma = [x for x in approvals if x.get("engine") == "medgemma"]
    letters = {
        "drafts": len(drafts), "by_medgemma": len(md), "template_fallbacks": len(drafts) - len(md),
        "sentences_checked": checked, "sentences_removed": removed,
        "removed_share": round(removed / checked, 3) if checked else None,
        "median_seconds": round(median(lat) / 1000, 1) if lat else None,
        "approved": len(approvals), "approved_medgemma": len(ma),
        "accepted_unchanged": sum(1 for x in ma if x.get("unchanged")),
        "accepted_unchanged_share": round(sum(1 for x in ma if x.get("unchanged")) / len(ma), 3) if ma else None,
        "median_similarity": round(median(x["similarity"] for x in ma), 3) if ma else None,
    }

    reads = [a["detail"] for a in db["audit"] if a.get("action") == "second_read"]
    rlat = [r["latency_ms"] for r in reads if r.get("latency_ms") is not None]
    second_reader = {"reads": len(reads), "with_suggestions": sum(1 for r in reads if r.get("items")),
                     "suggestions": sum(r.get("items") or 0 for r in reads), "dropped_ungrounded": sum(r.get("dropped") or 0 for r in reads),
                     "median_seconds": round(median(rlat) / 1000, 1) if rlat else None}

    routes = [x for p in db["participants"].values() for x in p.get("exploratory", []) if x.get("task") == "souq_route"]
    route_pairs = []
    for p in db["participants"].values():
        r = [x for x in p.get("exploratory", []) if x.get("task") == "souq_route"]
        if len(r) >= 2:
            route_pairs.append((r[0]["span"], r[1]["span"]))
    souq_route = {"done": len(routes), "people": sum(1 for p in db["participants"].values() if any(x.get("task") == "souq_route" for x in p.get("exploratory", []))),
                  "median_span": median(x["span"] for x in routes) if routes else None,
                  "median_accuracy": round(median(x["accuracy"] for x in routes if x.get("accuracy") is not None), 3) if routes else None,
                  "repeat_pairs": len(route_pairs),
                  "icc_3_1": round(_icc_3_1(np.array([a for a, _ in route_pairs], float), np.array([b for _, b in route_pairs], float)), 3)
                  if len(route_pairs) >= MIN_PAIRS else None}

    def rows(d: dict) -> list[dict]:
        out = []
        for k, v in sorted(d.items(), key=lambda kv: -kv[1]["people"]):
            out.append({"group": k, **v, "completion": round(v["scored"] / v["checkins"], 3) if v["checkins"] else None,
                        "flagged_share": round(v["flagged_people"] / v["people"], 3) if v["people"] else None})
        return out

    return {
        "store": store.status(),
        "people": len(people),
        "new_records": sum(1 for p, _ in people if not store.is_seed(p["id"])),
        "concerns": concerns, "reporters": reporters, "checkins": checkins, "family_questionnaires": informant,
        "completion": {"scored": scored, "submitted": checkins, "rate": round(scored / checkins, 3) if checkins else None,
                       "not_scored": not_scored_reasons,
                       "concern_then_checkin": {"people": concern_then_checkin[1], "did_checkin": concern_then_checkin[0]}},
        "reliability": rel,
        "latest_levels": latest_levels,
        "review": review,
        "timing": timing,
        "letters": letters,
        "second_reader": second_reader,
        "souq_route": souq_route,
        "segments": {k: rows(v) for k, v in seg.items()},
        "not_measurable_yet": ["sensitivity", "specificity"],
    }


@router.get("/stats")
def live_stats(who: Principal = Depends(principal)):
    if who.role not in ("clinician", "coordinator"):
        raise HTTPException(401 if who.role == "anonymous" else 403, "Please sign in as a clinician or coordinator.")
    from api.main import DB
    return compute(DB)
