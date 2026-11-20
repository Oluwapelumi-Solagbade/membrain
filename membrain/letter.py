"""A complete referral letter for specialist memory assessment, in the usual layout of a memory-service referral.

Sections follow what memory services ask referrers for (e.g. NICE NG97 and UK memory-service referral forms, and the
UAE referral requirements: identification, reason and urgency, history, functional impact, risk, cognitive testing,
mood, physical health and vascular risk, medicines, investigations, consent, referrer):

  header, patient details, reason for referral, history of the presenting concern, everyday function, safety and
  urgent signs, cognitive screening results, mood/sleep/other factors, physical health and risk factors, medicines,
  investigations to complete, consent and information sharing, requested from the service, notes, referrer.

Every line comes from the record. MedGemma writes only the "reason for referral" sentences, and only those that pass
the fact check (membrain/intake.verify_referral) are used; everything else is filled in by the rules, so the letter is
complete whether or not MedGemma answers. What the record does not hold is written as "not recorded", never guessed.
"""
from __future__ import annotations

from datetime import date

from . import config as C
from .prevention import risk_context

LEVEL_URGENCY = {
    "URGENT": ("URGENT", "please see within 3 days"),
    "CLINICIAN_REVIEW": ("Soon", "please see within 21 days"),
    "CHECK_AGAIN": ("Routine", "repeat check-in in 2 to 4 weeks; referral at the clinician's discretion"),
}
LEVEL_WORDS = {"URGENT": "urgent review", "CLINICIAN_REVIEW": "clinician review", "CHECK_AGAIN": "check again",
               "STABLE": "stable", "BASELINE": "building baseline"}
SEX = {"M": "Male", "F": "Female"}
SCHOOLING = {"none": "No formal schooling", "primary": "Primary school", "secondary": "Secondary school",
             "tertiary": "College or university"}
FUNDING = {"thiqa": "Thiqa", "enhanced": "Enhanced insurance", "basic": "Basic insurance", "self": "Self-pay"}
LANG = {"ar": "Arabic", "en": "English"}
CONSENT = {"voice_features": "voice features", "wearables": "wearable data", "clinical_record": "clinical record",
           "family_history": "family history", "genomics": "genomic results", "raw_audio": "raw audio"}
RISK = {"hypertension": "high blood pressure", "diabetes": "diabetes-range HbA1c", "ldl": "raised LDL cholesterol",
        "physical_inactivity": "physical inactivity", "smoking": "smoking", "obesity": "obesity", "hearing_loss": "hearing loss",
        "vision_loss": "vision loss", "depression": "depression", "social_isolation": "social isolation",
        "low_education": "fewer years of schooling", "alcohol": "alcohol", "air_pollution": "air pollution",
        "tbi": "head injury"}


def _d(s) -> str:
    try:
        return date.fromisoformat(str(s)[:10]).strftime("%d %b %Y")
    except (TypeError, ValueError):
        return str(s or "not recorded")


def build(p: dict, ev: dict, dossier: dict, *, reason: list[str] | None = None, service: dict | None = None,
          referrer: dict | None = None, today: date | None = None) -> dict:
    today = today or date.today()
    pt = dossier.get("participant") or {}
    c = dossier.get("concern") or {}
    a = dossier.get("alert") or {}
    ctx = p.get("context") or {}
    sections: list[tuple[str, list[str]]] = []

    level = a.get("level")
    urg, urg_note = LEVEL_URGENCY.get(level, ("Routine", "at the service's usual waiting time"))
    svc = (service or {}).get("name") or (p.get("assigned_hospital") or {}).get("name") or "Memory assessment service"
    svc = svc.replace(" (synthetic)", "")
    ref = referrer or {}
    sections.append(("REFERRAL FOR SPECIALIST MEMORY ASSESSMENT", [
        f"To: {svc}",
        f"From: {ref.get('name') or 'Referring clinician'}" + (f", {ref['title']}" if ref.get("title") else "")
        + (f", {ref['org'].replace(' (synthetic)', '')}" if ref.get("org") else ""),
        f"Date: {today.strftime('%d %b %Y')}",
        f"Urgency: {urg} ({urg_note})",
        f"MemBrain reference: {p.get('id')}",
    ]))

    name = (p.get("display_name") or {}).get("en")
    det = [f"Name: {name}" if name else "Name: on the attached identification (pseudonymised in MemBrain)",
           f"Age: {pt.get('age') or p.get('age') or 'not recorded'}" + (f"; sex: {SEX.get(p.get('sex'), p.get('sex'))}" if p.get("sex") else ""),
           "Preferred language: " + (LANG.get(p.get("language"), p.get("language") or "not recorded"))
           + (f" ({p['dialect']} dialect)" if p.get("dialect") else "")
           + (f"; also speaks {', '.join(LANG.get(x, x) for x in p.get('languages', []) if x != p.get('language'))}"
              if len(p.get("languages") or []) > 1 else ""),
           f"Schooling: {SCHOOLING.get(p.get('education'), p.get('education') or 'not recorded')}",
           "Lives in: " + ", ".join(x for x in (p.get("area"), p.get("emirate")) if x) if (p.get("area") or p.get("emirate")) else "Lives in: not recorded",
           f"Funding: {FUNDING.get(p.get('funding'), p.get('funding') or 'not recorded')}"]
    phone = p.get("phone") or (p.get("identity") or {}).get("phone") or ((p.get("intake") or {}).get("phone"))
    email = p.get("email") or (p.get("identity") or {}).get("email") or ((p.get("intake") or {}).get("email"))
    if phone or email:
        det.append("Contact for appointments: " + ", ".join(x for x in (phone, email) if x))
    inf = p.get("informant")
    if inf:
        det.append(f"Informant: {inf.get('relation') or inf.get('type') or 'family member'}"
                   + (" (consented to share)" if inf.get("consented") else ""))
    sections.append(("PATIENT DETAILS", det))

    rs = [s.strip() for s in (reason or []) if s and s.strip()]
    if not rs:
        doms = ", ".join(c.get("what_changed") or []) or "memory or thinking"
        rs = [f"{c.get('raised_by') or 'The family'} reported changes in {doms.lower()}."]
        if level in ("URGENT", "CLINICIAN_REVIEW"):
            rs.append(f"The latest MemBrain check-in was flagged for {LEVEL_WORDS[level]}: "
                      + "; ".join((a.get("reasons") or [])[:2]) + ".")
        rs.append("No diagnosis has been made.")
    sections.append(("REASON FOR REFERRAL", rs))

    h = [c.get("attribution") or "Reported by: not recorded."]
    if c.get("in_their_words"):
        h.append(f"In their words: “{c['in_their_words'].strip()}”")
    h.append("Areas affected: " + (", ".join(c.get("what_changed") or []) or "not specified"))
    h.append(f"Onset: {c.get('onset') or 'not recorded'}")
    h.append(f"How often: {c.get('how_often') or 'not recorded'}; how much: {c.get('how_much') or 'not recorded'}")
    if c.get("date"):
        h.append(f"Concern raised: {_d(c['date'])}")
    sections.append(("HISTORY OF THE PRESENTING CONCERN", h))

    f = [f"Task taken over: {w}" for w in c.get("who_now_does_what") or []] or ["No task reported as taken over by others."]
    inf_s = [s for s in p.get("sessions") or [] if s.get("iqcode") is not None or s.get("faq") is not None]
    for s in inf_s[-2:]:
        if s.get("iqcode") is not None:
            f.append(f"IQCODE-16 (informant), {_d(s.get('date'))}: {s['iqcode']} (cut-off {C.IQCODE_CUTOFF}; "
                     f"{'above' if s['iqcode'] > C.IQCODE_CUTOFF else 'not above'} the cut-off)")
        if s.get("faq") is not None:
            f.append(f"Functional Activities Questionnaire, {_d(s.get('date'))}: {s['faq']} of 30 (impaired from {C.FAQ_CUTOFF})")
    if not inf_s:
        f.append("Informant questionnaire (IQCODE-16 or FAQ): not yet done.")
    sections.append(("EVERYDAY FUNCTION (INSTRUMENTAL ACTIVITIES)", f))

    rf = c.get("red_flags_reported") or []
    sf = ["Urgent signs reported: " + (", ".join(rf) if rf else "none reported")]
    risky = [w for w in c.get("who_now_does_what") or [] if any(k in w.lower() for k in ("driv", "money", "medic", "cook", "stove"))]
    sf.append("Safety-relevant tasks: " + ("; ".join(risky) if risky else "none reported; please ask about driving, "
                                                                          "medicines, money and cooking"))
    sections.append(("SAFETY AND URGENT SIGNS", sf))

    cog = []
    valid = [e for e in (ev or {}).get("history", []) if e.get("valid") and e.get("z") and not e.get("intake") and not e.get("informant_report")]
    if valid:
        cog.append(f"MemBrain spoken check-ins: {len(valid)} valid, {_d(valid[0]['date'])} to {_d(valid[-1]['date'])}; "
                   f"latest result {LEVEL_WORDS.get(valid[-1]['level'], valid[-1]['level'])}.")
        for r in a.get("reasons") or []:
            cog.append(f"Flag reason: {r}")
        for d in dossier.get("domains") or []:
            mark = " (reliable decline)" if d.get("rci") is not None and d["rci"] <= -1.96 else ""
            cog.append(f"{d['domain']}: {d['baseline']} at baseline, {d['current']} now{mark}")
        ci = a.get("change_interval_90")
        if ci:
            cog.append(f"Overall change (90% interval): {ci[0]} to {ci[1]} SD")
        cog.append("Scores are against provisional age- and schooling-adjusted norms; alternate forms are used to limit practice effects.")
    else:
        cog.append("MemBrain spoken check-in: no valid check-in yet.")
    for m in dossier.get("clinic_assessments") or []:
        secs = m.get("sections") or {}
        cog.append(f"Clinic MoCA ({m['test']}), {_d(m['date'])}: {m['total']}/30"
                   + (" including the education point" if m.get("education_point") else "")
                   + f"; {'below' if m.get('below_cut') else 'at or above'} the cut-off of {m['cut']}"
                   + (". Sections: " + ", ".join(f"{k.replace('_', ' ')} {v}" for k, v in secs.items()) if secs else ""))
    if not dossier.get("clinic_assessments"):
        cog.append("Clinic MoCA: not yet done.")
    sections.append(("COGNITIVE SCREENING RESULTS", cog))

    last = next((s for s in reversed(p.get("sessions") or []) if s.get("type") not in ("intake", "informant") and s.get("raw") is not None), None)
    mood = []
    if last and last.get("phq2") is not None:
        mood.append(f"PHQ-2: {last['phq2']} of 6 ({'positive' if last['phq2'] >= C.PHQ2_CUTOFF else 'negative'} screen)")
    if last and last.get("gad2") is not None:
        mood.append(f"GAD-2: {last['gad2']} of 6 ({'positive' if last['gad2'] >= C.GAD2_CUTOFF else 'negative'} screen)")
    sh = (last or {}).get("sleep_hours") or ctx.get("sleep_hours")
    if sh is not None:
        mood.append(f"Sleep: {sh} hours a night")
    mood.append("Other factors reported: " + (", ".join(c.get("confounders_reported") or []) or "none reported"))
    sections.append(("MOOD, SLEEP AND OTHER FACTORS", mood))

    rc = risk_context(dict(ctx, education=p.get("education")))
    ph = []
    if ctx.get("sbp") is not None:
        ph.append(f"Blood pressure: {ctx['sbp']}/{ctx.get('dbp', '?')} mmHg")
    for k, lab, unit in (("hba1c", "HbA1c", "%"), ("ldl", "LDL cholesterol", " mmol/L"), ("bmi", "BMI", "")):
        if ctx.get(k) is not None:
            ph.append(f"{lab}: {ctx[k]}{unit}")
    if ctx.get("activity_min_week") is not None:
        ph.append(f"Physical activity: {ctx['activity_min_week']} minutes a week")
    if ctx.get("smoker") is not None:
        ph.append("Smoking: " + ("yes" if ctx["smoker"] else "no"))
    if ctx.get("hearing_difficulty") is not None:
        ph.append("Hearing difficulty: " + ("yes" + (", no hearing aid" if ctx.get("hearing_aid") is False else "") if ctx["hearing_difficulty"] else "no"))
    if not ph:
        ph.append("Blood pressure, HbA1c and other measures: not recorded.")
    ph.append("Modifiable risk factors present (Lancet Commission 2024): "
              + (", ".join(RISK.get(x, x) for x in rc["modifiable_factors_present"]) or "none recorded")
              + f" ({rc['count']} of {rc['of']})")
    if rc.get("family_history_dementia") is not None:
        ph.append("Family history of memory illness in a parent or sibling: " + ("yes" if rc["family_history_dementia"] else "no"))
    sections.append(("PHYSICAL HEALTH AND RISK FACTORS", ph))

    meds = p.get("medications") or ctx.get("medications")
    sections.append(("CURRENT MEDICINES", [", ".join(meds) if isinstance(meds, list) and meds else
                                           "Not recorded in MemBrain: please reconcile from the clinical record, "
                                           "including anticholinergic and sedative medicines."]))

    inv = list(rc.get("reversible_cause_checks") or ["TSH", "Vitamin B12", "Folate", "Full blood count", "HbA1c",
                                                     "Renal function", "Medication review"])
    sections.append(("INVESTIGATIONS TO COMPLETE (REVERSIBLE CAUSES)", [
        ", ".join(inv) + ".",
        "Results already in MemBrain are listed above; others are not yet recorded.",
        "Brain imaging at the specialist's discretion."]))

    cons = p.get("consent") or {}
    given = [CONSENT.get(k, k) for k, v in cons.items() if v]
    sections.append(("CONSENT AND INFORMATION SHARING", [
        "Consent to share: " + (", ".join(given) if given else "not recorded; please confirm before sharing"),
        "Genomic results, if any, are shared only with a clinician and disclosed only with counselling."]))

    sections.append(("REQUESTED FROM THE SERVICE", [
        "Specialist memory assessment to establish the cause of the reported change and advise on management.",
        "Please confirm receipt; MemBrain tracks this referral until an assessment and follow-up plan are recorded "
        "(21-day target)."]))

    sections.append(("NOTES", [
        "MemBrain is a screening and navigation tool. Its results are a signal for clinical assessment, not a diagnosis.",
        *(dossier.get("limitations") or [])]))

    sections.append(("REFERRING CLINICIAN", [
        f"{ref.get('name') or ''}" + (f", {ref['title']}" if ref.get("title") else ""),
        "Signature: ____________________"]))

    PLAIN = ("REFERRAL FOR SPECIALIST MEMORY ASSESSMENT", "REFERRING CLINICIAN")
    parts = []
    for t, lines in sections:
        if t == "REASON FOR REFERRAL":
            body = " ".join(x if x.rstrip().endswith((".", "!", "?")) else x + "." for x in lines)
        elif t in PLAIN:
            body = "\n".join(lines)
        else:
            body = "\n".join("- " + x for x in lines)
        parts.append(f"{t}\n{body}")
    text = "\n\n".join(parts)
    return {"sections": [{"title": t, "lines": ls} for t, ls in sections], "text": text}
