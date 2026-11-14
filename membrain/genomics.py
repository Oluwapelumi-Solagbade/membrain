"""Consent-gated genomic context (requirement 3: "including ... genomic information").

Design rules (see docs/GENOMICS.md):
  * Only EXISTING results enter (e.g. from a national genome programme via the partner).
    MemBrain does no sequencing and collects no samples.
  * Genomics NEVER changes a triage level or an alert threshold. APOE e4 raises risk but most
    carriers never develop dementia; using it to trigger referrals would add false referrals,
    anxiety and discrimination risk.
  * It may: add clinician context, suggest closer monitoring of vascular risk and shorter
    check-in intervals, flag treatment-safety relevance (ARIA with anti-amyloid therapy),
    and flag research eligibility, each with its reason.
  * Polygenic scores are shown only with an ancestry-validity warning; they are not validated
    in Gulf populations.
  * The participant sees nothing until genetic counselling is recorded AND they chose to know.
"""
from __future__ import annotations

GENOMICS_VERSION = "gx-0.1.0"
COUNSELLING_STATES = ["not_offered", "offered", "completed_wants_result", "completed_declines_result", "declined_counselling"]
TRANSITIONS = {
    "not_offered": ["offered"],
    "offered": ["completed_wants_result", "completed_declines_result", "declined_counselling"],
    "completed_wants_result": [], "completed_declines_result": [], "declined_counselling": ["offered"],
}
VALID_APOE = {"e2/e2", "e2/e3", "e2/e4", "e3/e3", "e3/e4", "e4/e4"}


def apoe4_copies(genotype: str | None) -> int | None:
    if not genotype or genotype not in VALID_APOE:
        return None
    return genotype.count("e4")


def advance_counselling(state: str, new: str) -> str:
    if new not in TRANSITIONS.get(state, []):
        raise ValueError(f"cannot move counselling from '{state}' to '{new}'")
    return new


def genomic_context(person: dict) -> dict:
    """Clinician-facing genomic context. Returns {'available': False, ...} when not consented or absent."""
    consent = bool((person.get("consent") or {}).get("genomics"))
    g = person.get("genomics") or {}
    if not consent:
        return {"available": False, "reason": "No genomics consent: genomic data is not processed or shown."}
    if not g:
        return {"available": False, "reason": "Consented, but no existing genomic result has been received."}
    copies = apoe4_copies(g.get("apoe"))
    ctx = person.get("context") or {}
    fh = bool(ctx.get("family_history_dementia"))
    age = person.get("age") or 0
    recs, flags = [], []
    if copies is not None and copies >= 1:
        recs.append({"id": "vascular_risk_focus",
                     "text": "Prioritise blood pressure, glucose, lipids, hearing and activity. Lifestyle risk reduction benefits APOE e4 carriers as well as non-carriers (FINGER trial).",
                     "reason": f"APOE e4 x{copies}"})
    if copies == 2 or (copies == 1 and fh and age >= 60):
        recs.append({"id": "monitoring_interval",
                     "text": "Consider 3-monthly instead of 6-monthly check-ins. This changes how closely we watch; it never changes what counts as a decline.",
                     "reason": "APOE e4 homozygous" if copies == 2 else "APOE e4 + first-degree family history + age 60 or over"})
    if copies == 2:
        flags.append({"id": "aria_risk",
                      "text": "If anti-amyloid therapy is ever considered, APOE e4 homozygotes have a substantially higher risk of ARIA (amyloid-related imaging abnormalities). The genotype must be known before that decision.",
                      "severity": "treatment_safety"})
    if copies is not None and copies >= 1:
        flags.append({"id": "research_eligibility",
                      "text": "May be eligible for prevention research (for example genomics-led prevention trials with the partner). Offer only with separate research consent.",
                      "severity": "information"})
    prs = g.get("prs")
    prs_out = None
    if prs:
        prs_out = {"percentile": prs.get("percentile"), "reference_ancestry": prs.get("reference_ancestry", "European"),
                   "warning": "Polygenic score derived from mostly European-ancestry studies; not validated in Gulf or Arab populations. "
                              "Shown for research context only; do not use for individual decisions."}
    state = g.get("counselling", "not_offered")
    return {
        "available": True, "version": GENOMICS_VERSION, "source": g.get("source", "partner programme"),
        "test": "APOE genotype", "apoe": g.get("apoe"), "apoe4_copies": copies, "result_date": g.get("date"),
        "family_history_dementia": fh, "recommendations": recs, "flags": flags, "prs": prs_out,
        "counselling": state,
        "participant_disclosure_allowed": state == "completed_wants_result",
        "affects_triage": False,
        "limits": [
            "Genotype is not a diagnosis and does not predict who will develop dementia.",
            "Genomic data never changes alert levels or thresholds in MemBrain.",
            "Results are shared with the participant only after genetic counselling and only if they choose to know.",
        ],
    }


def fhir_observation(person: dict) -> dict | None:
    """Genomic result as an Observation (custom code system in the prototype; mapped to the
    HL7 Genomics Reporting IG with the partner before the pilot)."""
    gc = genomic_context(person)
    if not gc.get("available"):
        return None
    cs = "https://fhir.membrain.health/CodeSystem"
    return {"resourceType": "Observation", "id": f"{person['id']}-apoe", "status": "final",
            "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "laboratory"}]}],
            "code": {"coding": [{"system": f"{cs}/genomics", "code": "APOE-genotype", "display": "APOE genotype"}], "text": "APOE genotype"},
            "subject": {"reference": f"Patient/{person['id']}"}, "effectiveDateTime": gc.get("result_date"),
            "valueString": gc.get("apoe"),
            "note": [{"text": "Existing result imported with genomics consent. Disclosure to participant only after counselling. "
                              "Not used for triage."}],
            "extension": [{"url": f"{cs}/ext/counselling-state", "valueCode": gc["counselling"]}]}
