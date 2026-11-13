"""One-page referral dossier for the receiving clinician."""
from __future__ import annotations

from .prevention import risk_context
from .triage import DOMAIN_LABEL

PATHWAY_LABEL = {"memory_clinic": "Memory clinic / geriatrics / neurology", "mental_health": "Mental health services",
                 "primary_care": "Primary care", "primary_care_urgent": "Primary care (urgent safety review)"}


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
        "trend": trend, "domains": domains,
        "confounders_checked": latest.get("confounders", []) if latest else [],
        "risk_context": risk_context(ctx),
        "limitations": [
            "Thresholds and norms are provisional until validated in the local population.",
            "Voice features are exploratory and did not contribute to this alert.",
            "Scores from different channels (app / phone / WhatsApp) are not pooled.",
        ],
    }
