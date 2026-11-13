"""FHIR R4 mapping (see docs/ARCHITECTURE.md, data model table).

Analytics resources reference a pseudonymous Patient; direct identifiers
live in a separate identity vault and never appear here. Condition
resources are never produced by the system (clinician-only).
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta

from . import config as C

CS = "https://fhir.membrain.health/CodeSystem"
LEVEL_PROB = {"BASELINE": "low", "STABLE": "low", "CHECK_AGAIN": "moderate",
              "CLINICIAN_REVIEW": "high", "URGENT": "high"}
CONSENT_SCOPES = ["voice_features", "raw_audio", "wearables", "clinical_record", "family_history",
                  "genomics", "caregiver_involvement", "model_training"]


def _id() -> str:
    return str(uuid.uuid4())


def _cc(system: str, code: str, display: str) -> dict:
    return {"coding": [{"system": system, "code": code, "display": display}], "text": display}


def patient(p: dict) -> dict:
    return {"resourceType": "Patient", "id": p["id"],
            "identifier": [{"system": f"{CS.replace('CodeSystem', 'NamingSystem')}/pseudonym", "value": p["id"]}],
            "gender": {"F": "female", "M": "male"}.get(p.get("sex"), "unknown"),
            "communication": [{"language": _cc("urn:ietf:bcp:47", "ar" if p["language"] == "ar" else "en",
                                                "Arabic" if p["language"] == "ar" else "English"), "preferred": True}],
            "extension": [{"url": f"{CS}/ext/education-band", "valueCode": p["education"]},
                          {"url": f"{CS}/ext/age-band", "valueString": p.get("age_band", "")},
                          {"url": f"{CS}/ext/dialect", "valueString": p.get("dialect", "")}]}


def consents(p: dict) -> list[dict]:
    out = []
    for scope in CONSENT_SCOPES:
        granted = bool((p.get("consent") or {}).get(scope))
        out.append({"resourceType": "Consent", "id": _id(), "status": "active" if granted else "inactive",
                    "scope": _cc("http://terminology.hl7.org/CodeSystem/consentscope", "patient-privacy", "Privacy Consent"),
                    "category": [_cc(f"{CS}/consent-signal", scope, scope.replace("_", " "))],
                    "patient": {"reference": f"Patient/{p['id']}"},
                    "policyRule": _cc("http://terminology.hl7.org/CodeSystem/v3-ActCode", "OPTIN" if granted else "OPTOUT",
                                      "opt-in" if granted else "opt-out"),
                    "provision": {"type": "permit" if granted else "deny"}})
    return out


def session_observations(p: dict, s: dict, ev: dict) -> list[dict]:
    obs = []
    if not s.get("raw"):
        return obs
    comps = [{"code": _cc(f"{CS}/cognitive-domain", d, d.replace("_", " ")),
              "valueInteger": int(v)} for d, v in s["raw"].items()]
    o = {"resourceType": "Observation", "id": _id(), "status": "final",
         "category": [_cc("http://terminology.hl7.org/CodeSystem/observation-category", "survey", "Survey")],
         "code": _cc(f"{CS}/digital-marker", "membrain-checkin", "MemBrain voice check-in (raw domain scores)"),
         "subject": {"reference": f"Patient/{p['id']}"}, "effectiveDateTime": s["date"][:10],
         "component": comps,
         "note": [{"text": f"form={s.get('form')} channel={s.get('channel', 'app')} assisted={bool(s.get('assisted'))} "
                           f"engine={C.ENGINE_VERSION} norms={C.NORMS_VERSION}"}]}
    if ev.get("z"):
        o["component"].append({"code": _cc(f"{CS}/digital-marker", "composite-z", "Education-stratified composite z"),
                               "valueQuantity": {"value": ev["z"]["composite"], "unit": "z"}})
    obs.append(o)
    if s.get("voice_features"):
        obs.append({"resourceType": "Observation", "id": _id(), "status": "preliminary",
                    "code": _cc(f"{CS}/digital-marker", "voice-features", "Exploratory voice features (not used for alerts)"),
                    "subject": {"reference": f"Patient/{p['id']}"}, "effectiveDateTime": s["date"][:10],
                    "component": [{"code": _cc(f"{CS}/voice-feature", k, k), "valueQuantity": {"value": float(v)}}
                                  for k, v in s["voice_features"].items()]})
    for name, code in (("phq2", "55757-9"), ("gad2", "69725-0")):
        if s.get(name) is not None:
            obs.append({"resourceType": "Observation", "id": _id(), "status": "final",
                        "code": _cc("http://loinc.org", code, name.upper() + " total score"),
                        "subject": {"reference": f"Patient/{p['id']}"}, "effectiveDateTime": s["date"][:10],
                        "valueInteger": int(s[name])})
    return obs


def risk_assessment(p: dict, ev: dict, basis: list[dict]) -> dict:
    return {"resourceType": "RiskAssessment", "id": _id(), "status": "preliminary",
            "subject": {"reference": f"Patient/{p['id']}"}, "occurrenceDateTime": ev["date"],
            "method": _cc(f"{CS}/method", "rci-rules-" + C.ENGINE_VERSION, "Practice-adjusted RCI + confounder rules"),
            "basis": [{"reference": f"Observation/{b['id']}"} for b in basis],
            "prediction": [{"outcome": _cc(f"{CS}/triage-level", ev["level"], ev["level"].replace("_", " ").title()),
                            "qualitativeRisk": _cc("http://terminology.hl7.org/CodeSystem/risk-probability",
                                                   LEVEL_PROB[ev["level"]], LEVEL_PROB[ev["level"]].title()),
                            "rationale": "; ".join(ev["reasons"])[:1000]}],
            "note": [{"text": "Risk/change identification only. Not a diagnosis. " + ev.get("uncertainty", "")}]}


def review_task(p: dict, ev: dict, ra: dict) -> dict:
    urgent = ev["level"] == "URGENT"
    return {"resourceType": "Task", "id": _id(), "status": "requested", "intent": "order",
            "priority": "urgent" if urgent else "routine",
            "code": _cc(f"{CS}/task", "clinician-review", "Clinician review of MemBrain alert"),
            "for": {"reference": f"Patient/{p['id']}"}, "focus": {"reference": f"RiskAssessment/{ra['id']}"},
            "authoredOn": ev["date"],
            "restriction": {"period": {"end": (date.fromisoformat(ev["date"]) + timedelta(days=C.REVIEW_TARGET_DAYS[ev["level"]])).isoformat()}},
            "note": [{"text": f"Review target: {C.REVIEW_TARGET_DAYS[ev['level']]} days"}]}


def bundle(p: dict, sessions: list[dict], evals: list[dict]) -> dict:
    entries = [patient(p)] + consents(p)
    by_id = {s.get("session_id"): s for s in sessions}
    for ev in evals:
        s = by_id.get(ev["session_id"])
        if s is None:
            continue
        obs = session_observations(p, s, ev)
        entries += obs
        if ev.get("valid") and ev["level"] != "BASELINE":
            ra = risk_assessment(p, ev, obs[:1])
            entries.append(ra)
            if ev["level"] in ("CLINICIAN_REVIEW", "URGENT"):
                entries.append(review_task(p, ev, ra))
    return {"resourceType": "Bundle", "id": _id(), "type": "collection",
            "entry": [{"fullUrl": f"urn:uuid:{e['id']}", "resource": e} for e in entries]}
