"""One-page referral dossier for the receiving clinician."""
from __future__ import annotations

from . import config as C
from . import intake as IN
from .genomics import genomic_context
from .prevention import risk_context
from .triage import DOMAIN_LABEL

PATHWAY_LABEL = {"memory_clinic": "Memory clinic / geriatrics / neurology", "mental_health": "Mental health services",
                 "primary_care": "Primary care", "primary_care_urgent": "Primary care (urgent safety review)"}
# Who raised the concern. Intake records the reporter (config.REPORTER_LABEL keys: self, family, helper, professional,
# coordinator); older records and the navigator use the entry route (household_helper, primary_care, programme).
REPORTER_LABEL = {"family": "Family member", "self": "The person themselves", "helper": "Household helper",
                  "household_helper": "Household helper", "professional": "Healthcare professional",
                  "primary_care": "Healthcare professional", "coordinator": "Programme coordinator",
                  "programme": "Programme screening (no specific concern)"}


def concern_summary(p: dict) -> dict:
    """The concern that started the journey, attributed to whoever reported it, plus what is still missing.

    Mirrored in site/lib/workspace/concern.ts; keep the two in step.
    """
    sessions = p.get("sessions") or []
    ik_s = next((s for s in sessions if s.get("type") == "intake"), None) or {}
    ik = p.get("intake") or {}
    c = ik.get("confirmed") or {}
    rc = ik_s.get("reported_concern") or {}
    route = ik.get("reporter") or rc.get("reporter") or ik_s.get("reporter") or p.get("entry_route")
    raised_by = REPORTER_LABEL.get(route, route or "Not recorded")
    text = c.get("narrative") or ik_s.get("concern")
    if text == "routine programme screening":
        text = None
    onset = c.get("onset") or ik_s.get("onset")
    freq, sev = c.get("frequency") or ik_s.get("frequency"), c.get("severity") or ik_s.get("severity")
    inf = p.get("informant")
    if c.get("timeline"):
        who = [f"{IN.ACTIVITIES.get(a, a)}: now {IN.WHO.get(w, w)}" for a, w in c["timeline"]]
    else:
        who = [f"{t['activity']}: now {t.get('who_took_over') or 'someone else'}" + (f" ({t['when']})" if t.get("when") else "")
               + (f"; reason given: {t['why']}" if t.get("why") else "") for t in (inf or {}).get("timeline") or []]
    missing = []
    if not text:
        missing.append("No specific concern (routine programme screening)" if route in (None, "programme")
                       else "The concern in the reporter's own words")
    if not onset or onset == "none":
        missing.append("When the change started")
    if text and not freq:
        missing.append("How often it happens")
    if not inf:
        missing.append("An informant account (family member or household helper)")
    if not any(s.get("iqcode") is not None or s.get("faq") is not None for s in sessions) and p.get("pending_iqcode") is None:
        missing.append("Family questionnaire (FAQ or IQCODE-16)")
    if not any(s.get("type") not in ("intake", "informant") and s.get("raw") is not None for s in sessions):
        missing.append("A scored check-in")
    ctx = p.get("context") or {}
    if ctx.get("sbp") is None and ctx.get("hba1c") is None:
        missing.append("Blood pressure and HbA1c")
    return {
        "raised_by": raised_by, "date": (ik.get("at") or ik_s.get("date") or "")[:10] or None,
        "in_their_words": text, "onset": IN.ONSET.get(onset) if onset else None,
        "how_often": IN.FREQUENCY.get(freq) if freq else None, "how_much": IN.SEVERITY.get(sev) if sev else None,
        "what_changed": [IN.DOMAINS.get(d, d) for d in c.get("domains") or rc.get("domains") or []],
        "who_now_does_what": who,
        "red_flags_reported": [C.RED_FLAGS.get(f, f) for f in ik_s.get("red_flags") or []],
        "confounders_reported": [IN.CONFOUNDERS.get(f, f) for f in c.get("confounders") or []],
        "informant": {"type": inf.get("type"), "relation": inf.get("relation")} if inf else None,
        "attribution": f"Reported by: {raised_by}. This is their account, not a clinical finding, until a clinician confirms it.",
        "missing": missing,
    }


def build_dossier(p: dict, evaluation: dict) -> dict:
    hist = evaluation["history"]
    latest = evaluation["latest"]
    trend = [{"date": e["date"], "composite_z": e.get("z", {}).get("composite"), "level": e["level"],
              "form": e.get("form"), "channel": e.get("channel"), "valid": e["valid"]} for e in hist]
    domains = []
    if latest and latest.get("rci"):
        for d, r in latest["rci"]["domains"].items():
            domains.append({"domain": DOMAIN_LABEL[d][0], "baseline": r["baseline"], "current": r["current"],
                            "rci": r["rci"], "expected_practice": r["expected_practice"]})
    ctx = dict(p.get("context") or {}, education=p.get("education"))
    return {
        "title": "MemBrain referral summary (screening signal, not a diagnosis)",
        "participant": {"pseudonym": p["id"], "age": p.get("age"), "education_band": p.get("education"),
                        "language": p.get("language"), "dialect": p.get("dialect")},
        "alert": {"level": latest["level"] if latest else None, "date": latest["date"] if latest else None,
                  "reasons": latest["reasons"] if latest else [], "drivers": latest["drivers"] if latest else [],
                  "change_interval_90": latest.get("change_interval_90") if latest else None,
                  "suggested_pathways": [PATHWAY_LABEL.get(x, x) for x in (latest or {}).get("pathways", [])]},
        "concern": concern_summary(p),
        "trend": trend, "domains": domains,
        "clinic_assessments": [{"test": m["version"], "date": m["date"], "total": m["total"], "out_of": 30,
                                "education_point": m["education_point"], "sections": m.get("sections"),
                                "below_cut": m["below_cut"], "cut": m["cut"]} for m in p.get("moca") or []],
        "confounders_checked": latest.get("confounders", []) if latest else [],
        "risk_context": risk_context(ctx),
        "genomics": genomic_context(p),
        "limitations": [
            "Thresholds and norms are provisional until validated in the local population.",
            "Voice features are exploratory and did not contribute to this alert.",
            "Scores from different channels (app / phone / WhatsApp) are not pooled.",
            "The concern is the reporter's account; it is not verified until a clinician confirms it.",
        ],
    }
