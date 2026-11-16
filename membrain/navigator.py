"""MemBrain Navigator layer: from alert to completed care.

* Service directory (partner-maintained, with verification dates)
* Matching: clinically appropriate pathway FIRST, then accessibility
  (language, location, eligibility/funding). Funding never suppresses a
  clinically appropriate referral; if nothing is accessible, a pathway gap
  is recorded and escalated.
* Closed-loop referral tracking with an explicit state machine.
* Bilingual next-steps pack for the participant and care partner.
* Programme metrics (aggregated, de-identified).

All directory entries in this repository are SYNTHETIC placeholders, named
generically so they cannot be mistaken for real providers.
"""
from __future__ import annotations

import math

import statistics
from datetime import date, timedelta

import numpy as np

NAVIGATOR_VERSION = "nav-0.1.0"
STALE_AFTER_DAYS = 90

PATHWAYS = {
    "urgent_clinical_assessment": "Urgent clinical assessment (emergency protocol)",
    "memory_clinic": "Memory / geriatric / neurology service",
    "mental_health": "Mental health assessment",
    "primary_care": "Primary care assessment (reversible causes)",
    "primary_care_urgent": "Primary care, urgent safety review",
    "audiology": "Hearing assessment",
    "optometry": "Vision assessment",
    "sleep": "Sleep assessment",
    "caregiver_support": "Caregiver support",
}

# --- referral state machine ------------------------------------------------
STATES = ["recommended", "sent", "accepted", "declined", "appointment_offered", "attended", "missed",
          "assessment_completed", "follow_up_documented", "lost_to_follow_up", "no_accessible_service", "cancelled"]
TRANSITIONS = {
    "recommended": ["sent", "no_accessible_service", "cancelled"],
    "sent": ["accepted", "declined"],
    "accepted": ["appointment_offered"],
    "appointment_offered": ["attended", "missed"],
    "missed": ["appointment_offered", "lost_to_follow_up"],
    "attended": ["assessment_completed"],
    "assessment_completed": ["follow_up_documented"],
    "declined": ["recommended", "cancelled"],             # re-route to another service
    "no_accessible_service": ["recommended", "cancelled"],  # after escalation
    "lost_to_follow_up": ["recommended"],
    "follow_up_documented": [],
    "cancelled": [],
}
CLOSED = {"follow_up_documented", "cancelled"}
NEEDS_REASON = {"declined", "missed", "lost_to_follow_up", "no_accessible_service", "cancelled"}
FHIR_STATUS = {"recommended": "draft", "sent": "active", "accepted": "active", "appointment_offered": "active",
               "attended": "active", "missed": "on-hold", "declined": "revoked", "assessment_completed": "completed",
               "follow_up_documented": "completed", "lost_to_follow_up": "on-hold", "no_accessible_service": "on-hold",
               "cancelled": "revoked"}


def advance(ref: dict, new_state: str, on: str, reason: str = "", by: str = "coordinator") -> dict:
    cur = ref["state"]
    if new_state not in TRANSITIONS[cur]:
        raise ValueError(f"cannot move referral from '{cur}' to '{new_state}'")
    if new_state in NEEDS_REASON and not reason:
        raise ValueError(f"'{new_state}' needs a reason")
    ref["state"] = new_state
    ref["history"].append({"state": new_state, "date": on, "reason": reason, "by": by})
    return ref


def new_referral(rid: str, pid: str, pathway: str, service_id: str | None, urgency: str, on: str,
                 reason: str, by: str = "clinician", entry_route: str = "programme") -> dict:
    return {"id": rid, "participant_id": pid, "pathway": pathway, "service_id": service_id, "urgency": urgency,
            "reason": reason, "entry_route": entry_route, "state": "recommended",
            "history": [{"state": "recommended", "date": on, "reason": reason, "by": by}]}


def is_unresolved(ref: dict) -> bool:
    return ref["state"] not in CLOSED


def _r(x: float, d: int) -> float:
    """Round half up, exactly as JavaScript's Math.round(x * 10**d) / 10**d (Python's round() is half-to-even)."""
    f = 10 ** d
    return math.floor(x * f + 0.5) / f


CONCERN_LEVELS = ("CHECK_AGAIN", "CLINICIAN_REVIEW", "URGENT")


def concern_date(p: dict, history: list[dict] | None = None) -> str | None:
    """When the concern started, for 'days from first concern to clinician review': the intake date if someone
    raised a concern, otherwise the first session where the engine flagged one. Never the enrolment date."""
    for s in p.get("sessions") or []:
        if s.get("type") == "intake":
            return str(s["date"])[:10]
    for h in history or []:
        if h.get("level") in CONCERN_LEVELS:
            return str(h["date"])[:10]
    return None


# --- service directory -------------------------------------------------------
def directory() -> list[dict]:
    S = []

    # capacity: new referrals the service can take per month, and whether it is accepting now (synthetic values)
    CAP = {"SVC-01": (20, True), "SVC-02": (14, True), "SVC-03": (10, False), "SVC-04": (120, True), "SVC-05": (60, True),
           "SVC-06": (25, True), "SVC-07": (18, True), "SVC-08": (40, True), "SVC-09": (35, True), "SVC-10": (8, True),
           "SVC-11": (None, True), "SVC-12": (None, True), "SVC-13": (30, True)}

    def add(i, name, pathways, emirate, area, langs, funding, wait, verified, notes, referral="Clinician referral letter"):
        cap, accepting = CAP[i]
        S.append({"id": i, "name": name + " (synthetic)", "pathways": pathways, "emirate": emirate, "area": area,
                  "languages": langs, "funding": funding, "wait_weeks": wait, "last_verified": verified,
                  "capacity_per_month": cap, "accepting_referrals": accepting,
                  "referral_process": referral, "notes": notes, "synthetic": True})

    add("SVC-01", "Memory Clinic — Abu Dhabi City", ["memory_clinic"], "Abu Dhabi", "Abu Dhabi City", ["ar", "en"],
        ["thiqa", "enhanced"], 6, "2026-10-20", "Neuropsychology on site; brings informant")
    add("SVC-02", "Geriatric Service — Al Ain", ["memory_clinic", "caregiver_support"], "Abu Dhabi", "Al Ain", ["ar", "en", "ur"],
        ["thiqa", "enhanced", "basic"], 4, "2026-10-02", "Home-visit option for frail patients")
    add("SVC-03", "Neurology Outpatients — Dubai", ["memory_clinic"], "Dubai", "Dubai", ["ar", "en", "hi"],
        ["enhanced", "self_pay"], 9, "2026-07-01", "Imaging same campus")
    add("SVC-04", "Primary Care Centre — Khalifa City", ["primary_care", "primary_care_urgent"], "Abu Dhabi", "Abu Dhabi City",
        ["ar", "en", "tl", "ml"], ["thiqa", "enhanced", "basic", "self_pay"], 1, "2026-11-01", "Bloods and medication review")
    add("SVC-05", "Primary Care Centre — Al Dhafra", ["primary_care", "primary_care_urgent"], "Abu Dhabi", "Al Dhafra",
        ["ar", "en"], ["thiqa", "basic"], 2, "2026-09-15", "")
    add("SVC-06", "Community Mental Health — Abu Dhabi", ["mental_health"], "Abu Dhabi", "Abu Dhabi City", ["ar", "en"],
        ["thiqa", "enhanced", "basic"], 3, "2026-10-28", "Older-adult clinic Tuesdays")
    add("SVC-07", "Mental Health Clinic — Dubai", ["mental_health"], "Dubai", "Dubai", ["ar", "en", "hi", "ur"],
        ["enhanced", "self_pay"], 2, "2026-06-11", "")
    add("SVC-08", "Audiology Unit — Abu Dhabi", ["audiology"], "Abu Dhabi", "Abu Dhabi City", ["ar", "en"],
        ["thiqa", "enhanced", "self_pay"], 2, "2026-10-10", "Hearing-aid fitting")
    add("SVC-09", "Eye Clinic — Al Ain", ["optometry"], "Abu Dhabi", "Al Ain", ["ar", "en"], ["thiqa", "enhanced", "basic"], 3,
        "2026-09-30", "")
    add("SVC-10", "Sleep Clinic — Abu Dhabi", ["sleep"], "Abu Dhabi", "Abu Dhabi City", ["ar", "en"], ["thiqa", "enhanced"], 8,
        "2026-08-14", "Home sleep testing available")
    add("SVC-11", "Emergency Department — Abu Dhabi", ["urgent_clinical_assessment"], "Abu Dhabi", "Abu Dhabi City",
        ["ar", "en", "ur", "hi", "tl"], ["thiqa", "enhanced", "basic", "self_pay"], 0, "2026-11-10",
        "Emergency protocol: same day", referral="Call ahead; send summary")
    add("SVC-12", "Emergency Department — Al Ain", ["urgent_clinical_assessment"], "Abu Dhabi", "Al Ain",
        ["ar", "en", "ur"], ["thiqa", "enhanced", "basic", "self_pay"], 0, "2026-11-09",
        "Emergency protocol: same day", referral="Call ahead; send summary")
    add("SVC-13", "Family Caregiver Programme — Abu Dhabi", ["caregiver_support"], "Abu Dhabi", "Abu Dhabi City",
        ["ar", "en"], ["thiqa", "enhanced", "basic", "self_pay"], 1, "2026-10-05", "Group sessions in Arabic and English")
    return S


FUNDING_LABEL = {"thiqa": "Government entitlement (Thiqa)", "enhanced": "Enhanced / employer insurance",
                 "basic": "Basic insurance", "self_pay": "Self-pay"}
LANG_LABEL = {"ar": "Arabic", "en": "English", "ur": "Urdu", "hi": "Hindi", "tl": "Tagalog", "ml": "Malayalam"}


def match_services(pathway: str, person: dict, services: list[dict] | None = None, today: str = "2026-11-14") -> dict:
    """Clinically appropriate services first; accessibility is shown, never used to drop the pathway."""
    services = services if services is not None else directory()
    t = date.fromisoformat(today)
    langs = set(person.get("languages") or [person.get("language", "ar")])
    funding = person.get("funding")
    emirate = person.get("emirate")
    out = []
    for s in services:
        if pathway not in s["pathways"]:
            continue
        lang_ok = bool(langs & set(s["languages"]))
        fund_ok = funding is None or funding in s["funding"]
        stale = (t - date.fromisoformat(s["last_verified"])).days > STALE_AFTER_DAYS
        barriers = ([] if lang_ok else ["language"]) + ([] if fund_ok else ["funding"]) + \
            ([] if s.get("accepting_referrals", True) else ["not accepting referrals"])
        score = (2 if lang_ok else 0) + (2 if fund_ok else 0) + (1 if emirate and s["emirate"] == emirate else 0) - s["wait_weeks"] / 10
        out.append({**s, "accessible": not barriers, "barriers": barriers, "stale": stale, "score": _r(score, 2)})
    out.sort(key=lambda x: (-x["accessible"], -x["score"]))
    gap = not any(x["accessible"] for x in out)
    return {"pathway": pathway, "services": out, "gap": gap,
            "gap_action": "Record pathway gap, explain options to the person, escalate to responsible clinical team" if gap else None}


# --- next-steps pack ---------------------------------------------------------
PACK = {
    "en": {
        "title": "Your next steps",
        "established": "What this check has shown: a change or concern that a specialist should look at. It is NOT a diagnosis.",
        "not_established": "What it has not shown: what is causing it. Many causes can be treated, such as low vitamins, thyroid problems, low mood, poor sleep, hearing problems or medicines.",
        "bring": "Please bring: your Emirates ID and insurance card, a list of all medicines (or the boxes), glasses and hearing aids, and if possible a family member who knows you well.",
        "independence": "Keep doing what you can: daily walks, regular meals and sleep, prayer and family visits, and use a calendar or phone reminders.",
        "urgent": "Get urgent help (ambulance 998) if there is sudden confusion, new weakness or speech difficulty, a fall with a head injury, or if the person goes missing or is unsafe.",
        "carer": "Care partners: you are not alone. Ask the clinic about caregiver support groups and respite.",
    },
    "ar": {
        "title": "خطواتك التالية",
        "established": "ما أظهره هذا الفحص: تغيّر أو قلق ينبغي أن يراه طبيب مختص. هذا ليس تشخيصاً.",
        "not_established": "ما لم يُظهره: سبب هذا التغيّر. كثير من الأسباب قابلة للعلاج، مثل نقص الفيتامينات أو مشاكل الغدة الدرقية أو الحزن أو قلة النوم أو ضعف السمع أو بعض الأدوية.",
        "bring": "يرجى إحضار: الهوية الإماراتية وبطاقة التأمين، وقائمة بجميع الأدوية (أو علبها)، والنظارة وسماعة الأذن، وإن أمكن أحد أفراد العائلة الذي يعرفك جيداً.",
        "independence": "استمر فيما تستطيع فعله: المشي اليومي، ومواعيد ثابتة للأكل والنوم، والصلاة وزيارات العائلة، واستخدم التقويم أو تذكيرات الهاتف.",
        "urgent": "اطلب المساعدة العاجلة (الإسعاف 998) عند حدوث تشوش مفاجئ، أو ضعف جديد أو صعوبة في الكلام، أو سقوط مع إصابة في الرأس، أو إذا تاه الشخص أو لم يكن آمناً.",
        "carer": "إلى أفراد العائلة: لستم وحدكم. اسألوا العيادة عن مجموعات دعم مقدّمي الرعاية والرعاية المؤقتة.",
    },
}


def next_steps_pack(ref: dict, service: dict | None, lang: str = "en") -> dict:
    t = PACK[lang]
    where = (f"{service['name']}, {service['area']}. {service['referral_process']}. Expected wait about {service['wait_weeks']} weeks."
             if service and lang == "en" else
             f"{service['name']}، {service['area']}. مدة الانتظار المتوقعة حوالي {service['wait_weeks']} أسابيع."
             if service else ("The clinic will call you to arrange the service." if lang == "en" else "ستتصل بك العيادة لترتيب الموعد."))
    return {"title": t["title"], "sections": [t["established"], t["not_established"], where, t["bring"], t["independence"],
                                              t["urgent"], t["carer"]], "clinician_approved_template": NAVIGATOR_VERSION}


# --- programme metrics -------------------------------------------------------
def _days(a: str, b: str) -> int:
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def state_date(ref: dict, state: str) -> str | None:
    return next((h["date"] for h in ref["history"] if h["state"] == state), None)


def programme_metrics(refs: list[dict], people: dict, today: str = "2026-11-14") -> dict:
    sent = [r for r in refs if state_date(r, "sent")]
    done = [r for r in refs if state_date(r, "assessment_completed")]
    accepted = [r for r in sent if state_date(r, "accepted")]
    t_concern_review = [_days(r["concern_date"], r["history"][0]["date"]) for r in refs if r.get("concern_date")]
    t_ref_assess = [_days(state_date(r, "sent"), state_date(r, "assessment_completed")) for r in done if state_date(r, "sent")]
    unresolved = [r for r in refs if is_unresolved(r)]
    reasons: dict = {}
    for r in refs:
        if r["state"] in NEEDS_REASON | {"missed"}:
            reasons[r["state"]] = reasons.get(r["state"], 0) + 1

    def by(key):
        g: dict = {}
        for r in sent:
            k = people.get(r["participant_id"], {}).get(key, "unknown") if key != "entry_route" else r.get("entry_route", "unknown")
            d = g.setdefault(k, {"sent": 0, "completed": 0})
            d["sent"] += 1
            d["completed"] += 1 if state_date(r, "assessment_completed") else 0
        return {k: {**v, "completion": _r(v["completed"] / v["sent"], 3) if v["sent"] else None} for k, v in sorted(g.items())}

    overdue = [r for r in unresolved if r["state"] in ("sent", "recommended") and _days(r["history"][-1]["date"], today) > 14]
    return {
        "referrals": len(refs), "sent": len(sent), "accepted_rate": _r(len(accepted) / len(sent), 3) if sent else None,
        "completion_rate": _r(len(done) / len(sent), 3) if sent else None,
        "median_days_concern_to_review": statistics.median(t_concern_review) if t_concern_review else None,
        "median_days_referral_to_assessment": statistics.median(t_ref_assess) if t_ref_assess else None,
        "unresolved": len(unresolved), "overdue": len(overdue), "non_completion_reasons": reasons,
        "pathway_gaps": sum(1 for r in refs if any(h["state"] == "no_accessible_service" for h in r["history"])),
        "by_entry_route": by("entry_route"), "by_language": by("language"), "by_funding": by("funding"),
        "by_sex": by("sex"), "by_age_band": by("age_band"),
    }


# --- synthetic pathway log (to exercise the dashboard; NOT real data) -------
PATHWAY_ASSUMPTIONS = {
    "acceptance": 0.88, "appointment_attended": 0.82, "rebook_after_missed": 0.6,
    "assessment_after_attend": 0.95, "follow_up_documented": 0.85, "gap_rate_low_funding": 0.25,
    "concern_to_review_days": (4, 21), "notes": "Synthetic journeys to demonstrate closed-loop tracking and metrics.",
}


def simulate_pathways(n: int = 160, seed: int = 3, today: str = "2026-11-14") -> tuple[list[dict], dict]:
    rng = np.random.default_rng(seed)
    svc = directory()
    A = PATHWAY_ASSUMPTIONS
    refs, people = [], {}
    end = date.fromisoformat(today)
    for i in range(n):
        pid = f"SYN-P{i:04d}"
        lang = rng.choice(["ar", "en", "ur", "tl"], p=[0.55, 0.3, 0.1, 0.05])
        funding = rng.choice(["thiqa", "enhanced", "basic", "self_pay"], p=[0.35, 0.35, 0.22, 0.08])
        sex = rng.choice(["F", "M"])
        age_band = rng.choice(["50-59", "60-69", "70-75"], p=[0.3, 0.4, 0.3])
        entry = rng.choice(["programme", "primary_care", "family", "household_helper"], p=[0.45, 0.3, 0.18, 0.07])
        people[pid] = {"language": str(lang), "funding": str(funding), "sex": str(sex), "age_band": str(age_band)}
        pathway = rng.choice(["memory_clinic", "primary_care", "mental_health", "urgent_clinical_assessment"], p=[0.45, 0.3, 0.2, 0.05])
        start = end - timedelta(days=int(rng.integers(10, 200)))
        concern = start - timedelta(days=int(rng.integers(*A["concern_to_review_days"])))
        m = match_services(str(pathway), {"language": str(lang), "languages": [str(lang)], "funding": str(funding), "emirate": "Abu Dhabi"}, svc)
        r = new_referral(f"REF-S{i:04d}", pid, str(pathway), None, "urgent" if pathway == "urgent_clinical_assessment" else "routine",
                         start.isoformat(), "synthetic", entry_route=str(entry))
        r["concern_date"] = concern.isoformat()
        r["synthetic"] = True
        d = start

        def step(days, state, reason=""):
            nonlocal d
            d = d + timedelta(days=int(days))
            if d > end:
                return False
            advance(r, state, d.isoformat(), reason)
            return True

        if m["gap"] and rng.random() < 0.8:
            step(1, "no_accessible_service", "no service in language or funding route")
            refs.append(r)
            continue
        r["service_id"] = (m["services"][0] if m["services"] else {}).get("id")
        wait = (m["services"][0]["wait_weeks"] if m["services"] else 4) * 7
        if not step(rng.integers(0, 4), "sent"):
            refs.append(r); continue
        if rng.random() > A["acceptance"]:
            step(rng.integers(2, 10), "declined", "outside eligibility criteria"); refs.append(r); continue
        if not step(rng.integers(1, 7), "accepted") or not step(rng.integers(1, 5), "appointment_offered"):
            refs.append(r); continue
        attend = rng.random() < A["appointment_attended"]
        if not step(max(0, wait + rng.integers(-7, 14)), "attended" if attend else "missed", "" if attend else "did not attend"):
            refs.append(r); continue
        if r["state"] == "missed":
            if rng.random() < A["rebook_after_missed"]:
                if step(rng.integers(3, 10), "appointment_offered") and step(rng.integers(7, 30), "attended"):
                    pass
            else:
                step(rng.integers(10, 30), "lost_to_follow_up", "could not be reached")
        if r["state"] == "attended" and rng.random() < A["assessment_after_attend"]:
            if step(rng.integers(0, 14), "assessment_completed") and rng.random() < A["follow_up_documented"]:
                step(rng.integers(1, 10), "follow_up_documented")
        refs.append(r)
    return refs, people
