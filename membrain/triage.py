"""Rule-based alert fusion and triage (release 1: no black box).

Levels (ascending urgency):
  BASELINE          building the personal baseline
  STABLE            within reliable-change range
  CHECK_AGAIN       one unconfirmed change, a confounder, or an invalid session
  CLINICIAN_REVIEW  change confirmed on repeat, change + independent signal,
                    or low entry score vs stratified norms
  URGENT            large/rapid decline, new informant-reported functional
                    loss, or a safety concern

Reports (no test, never scored): a concern ("intake"), raised again later as a follow-up, and the family
questionnaire ("informant"). A follow-up concern is compared with everything reported before it: newly reported
memory/thinking areas or activities newly taken over by someone else go to clinician review. A report with nothing
new keeps the case at its previous level ("carried"); a carried level never opens a second review task.

Safety rules:
  * No alert from a single unconfirmed signal.
  * The engine never writes a diagnosis; it creates a review Task.
  * Anything >= CLINICIAN_REVIEW is held until a clinician has reviewed it;
    the participant only hears "your clinic will contact you".
"""
from __future__ import annotations

from datetime import date

from . import config as C
from .change import composite_rci, domain_rcis, slope_per_year
from .scoring import z_profile

LEVELS = ["BASELINE", "STABLE", "CHECK_AGAIN", "CLINICIAN_REVIEW", "URGENT"]
DOMAIN_LABEL = {
    "memory_immediate": ("Word learning", "تعلّم الكلمات"),
    "memory_delayed": ("Delayed word recall", "تذكّر الكلمات لاحقاً"),
    "fluency": ("Word generation (fluency)", "طلاقة الكلمات"),
    "story_recall": ("Story recall", "تذكّر القصة"),
    "judgement": ("Everyday judgement", "الحكم في المواقف اليومية"),
}


def _d(s: str) -> date:
    return date.fromisoformat(s[:10])


def _max(a: str, b: str) -> str:
    return a if LEVELS.index(a) >= LEVELS.index(b) else b


REPORTS = ("intake", "informant")


def _new(items: list, seen: list) -> list:
    out = []
    for x in items:
        if x not in seen and x not in out:
            out.append(x)
    return out


def audio_gate(audio: dict | None) -> list[str]:
    if not audio:
        return []
    fails = []
    if audio.get("snr_db", 99) < C.AUDIO_MIN_SNR_DB:
        fails.append("background noise too high")
    if audio.get("clipping", 0) > C.AUDIO_MAX_CLIPPING:
        fails.append("recording too loud (clipping)")
    if audio.get("speech_ratio", 1) < C.AUDIO_MIN_SPEECH_RATIO:
        fails.append("too little speech detected")
    if audio.get("duration_s", 99) < C.AUDIO_MIN_DURATION_S:
        fails.append("recording too short")
    return fails


def confounders(s: dict) -> list[dict]:
    out = []
    if (s.get("phq2") or 0) >= C.PHQ2_CUTOFF or (s.get("gad2") or 0) >= C.GAD2_CUTOFF:
        out.append({"code": "mood", "label": "Low mood or anxiety screen positive",
                    "action": "Hold cognitive alert, offer mental-health pathway, repeat later",
                    "detail": {"phq2": s.get("phq2"), "gad2": s.get("gad2")}})
    sh = s.get("sleep_hours")
    if (sh is not None and sh < C.SLEEP_HOURS_LOW) or s.get("poor_sleep_self"):
        out.append({"code": "sleep", "label": "Poor sleep in the past week",
                    "action": "Note and repeat after sleep improves", "detail": {"sleep_hours": sh}})
    if s.get("acute_illness") or s.get("new_medication"):
        out.append({"code": "illness_medication", "label": "Acute illness or new medication",
                    "action": "Repeat after 2-4 weeks",
                    "detail": {"acute_illness": bool(s.get("acute_illness")), "new_medication": bool(s.get("new_medication"))}})
    pc = s.get("precheck") or {}
    if pc.get("hearing_ok") is False or pc.get("vision_ok") is False:
        out.append({"code": "sensory", "label": "Hearing or vision difficulty at pre-check",
                    "action": "Repeat with accommodation (volume, slower pace, large text)", "detail": pc})
    if s.get("assisted"):
        out.append({"code": "assisted", "label": "Session completed with a helper",
                    "action": "Cannot confirm change alone; repeat unassisted if possible", "detail": {"helper_role": s.get("helper_role")}})
    return out


def evaluate_history(participant: dict, sessions: list[dict]) -> list[dict]:
    """Evaluate every session in order; returns one evaluation per session."""
    edu, age = participant["education"], participant["age"]
    sessions = sorted(sessions, key=lambda s: s["date"])
    evals: list[dict] = []
    baseline: dict[str, list[tuple[int, dict, float, dict]]] = {}  # channel -> [(idx, raw, z, s)]
    channel_idx: dict[str, int] = {}
    last_post_baseline: dict[str, dict] = {}
    prev_iq = None
    prev_faq, prev_faq_date = None, None
    seen = {"first": None, "domains": [], "activities": [], "red_flags": []}   # everything reported so far
    hist_days, hist_z = [], []
    t0 = _d(sessions[0]["date"]) if sessions else None

    for s in sessions:
        ch = s.get("channel", "app")
        idx = channel_idx.get(ch, 0)
        if s.get("type") not in REPORTS:
            channel_idx[ch] = idx + 1
        ev = {"session_id": s.get("session_id"), "date": s["date"][:10], "channel": ch, "form": s.get("form"),
              "session_index": idx, "level": "BASELINE", "reasons": [], "drivers": [], "confounders": [],
              "pathways": [], "valid": True, "engine_version": C.ENGINE_VERSION}

        # 1. informant / safety signals (independent of the test session quality)
        iq = s.get("iqcode")
        functional_flag = iq is not None and iq > C.IQCODE_CUTOFF
        new_loss = functional_flag and prev_iq is not None and iq - prev_iq >= C.IQCODE_RISE
        iq_before = prev_iq
        if iq is not None:
            prev_iq = iq
        fq = s.get("faq")
        faq_flag = fq is not None and fq >= C.FAQ_CUTOFF
        faq_new_loss = faq_flag and prev_faq is not None and fq - prev_faq >= C.FAQ_RISE
        faq_before, faq_before_date = prev_faq, prev_faq_date
        if fq is not None:
            prev_faq, prev_faq_date = fq, s["date"][:10]
        functional_flag = functional_flag or faq_flag
        flags = [f for f in (s.get("red_flags") or []) if f in C.RED_FLAGS]
        if flags:
            ev["level"] = "URGENT"
            ev["reasons"].append("Red flags for an acute presentation: " + "; ".join(C.RED_FLAGS[f] for f in flags) +
                                 ". Follow the emergency protocol; do not wait for repeat testing")
            ev["drivers"].append({"input": "Red-flag screen", "value": len(flags), "threshold": 1})
            ev["pathways"].append("urgent_clinical_assessment")
            ev["red_flags"] = flags
        if s.get("safety_concern"):
            ev["level"] = "URGENT"
            ev["reasons"].append("Informant reported a safety concern")
            ev["pathways"].append("primary_care_urgent")
        if new_loss:
            ev["level"] = "URGENT"
            ev["reasons"].append(f"New functional loss reported by informant (IQCODE {iq_before:.2f} -> {iq:.2f}, above cutoff {C.IQCODE_CUTOFF})")
            ev["drivers"].append({"input": "Informant questionnaire (IQCODE-16)", "value": iq, "threshold": C.IQCODE_CUTOFF})
            ev["pathways"].append("memory_clinic")
        if faq_new_loss:
            ev["level"] = "URGENT"
            ev["reasons"].append(f"New functional loss reported by family (FAQ {faq_before} -> {fq} of {C.FAQ_MAX} since "
                                 f"{faq_before_date}, at or above cutoff {C.FAQ_CUTOFF}); needs a professional clinical evaluation")
            ev["drivers"].append({"input": "Family questionnaire (FAQ)", "value": fq, "threshold": C.FAQ_CUTOFF,
                                  "change": fq - faq_before})
            ev["pathways"].append("memory_clinic")

        # reports: a concern (the first one, or a follow-up) and the family questionnaire; never scored
        if s.get("type") in REPORTS:
            prev_ev = evals[-1] if evals else None
            ev["valid"] = False
            own = ev["level"]          # BASELINE, or URGENT from the signals above
            why_review = None
            if s.get("type") == "intake":
                ev["intake"] = True
                rc = s.get("reported_concern") or {}
                doms, acts = list(rc.get("domains") or []), list(rc.get("activities_taken_over") or [])
                first = seen["first"] is None
                new_doms = [] if first else _new(doms, seen["domains"])
                new_acts = [] if first else _new(acts, seen["activities"])
                new_flags = [] if first else _new(ev.get("red_flags") or [], seen["red_flags"])
                ev["concern_change"] = {"first": first, "since": seen["first"], "reporter": rc.get("reporter"),
                                        "domains": doms, "activities": acts, "new_domains": new_doms,
                                        "new_activities": new_acts, "new_red_flags": new_flags}
                who = C.REPORTER_LABEL.get(rc.get("reporter"), "the reporter")
                if first:
                    cog = [d for d in doms if d in C.CONCERN_COGNITIVE_DOMAINS]
                    n_act = len(acts)
                    if own == "BASELINE" and cog and (n_act >= C.CONCERN_REVIEW_MIN_ACTIVITIES or rc.get("reporter") == "professional"):
                        own = "CLINICIAN_REVIEW"
                        why = (f"{n_act} everyday activit{'y' if n_act == 1 else 'ies'} now done by someone else" if n_act
                               else "concern raised by a healthcare professional")
                        ev["reasons"].append(f"Significant reported concern ({', '.join(C.CONCERN_DOMAIN_LABEL[d] for d in cog)}; {why}); "
                                             f"clinician review without waiting for a baseline. Reported by {who}, not clinically verified")
                        ev["drivers"].append({"input": "Reported loss of everyday independence", "value": n_act,
                                              "threshold": C.CONCERN_REVIEW_MIN_ACTIVITIES})
                        ev["pathways"].append("primary_care")
                        why_review = "clinician_review_task"
                    elif own == "BASELINE":
                        ev["reasons"].append(("Intake recorded: " if not evals else "Concern recorded: ") + (s.get("concern") or "concern documented") +
                                             "; no red flags." + (" First check-in to follow" if not evals else ""))
                else:
                    cog_all = [d for d in seen["domains"] + doms if d in C.CONCERN_COGNITIVE_DOMAINS]
                    cog_new = [d for d in new_doms if d in C.CONCERN_COGNITIVE_DOMAINS]
                    if own == "BASELINE" and cog_all and (cog_new or new_acts):
                        own = "CLINICIAN_REVIEW"
                        parts = (["newly reported: " + ", ".join(C.CONCERN_DOMAIN_LABEL[d] for d in cog_new)] if cog_new else []) + \
                            ([f"{len(new_acts)} more everyday activit{'y' if len(new_acts) == 1 else 'ies'} now done by someone else"] if new_acts else [])
                        ev["reasons"].append(f"Concern has spread since it was first reported on {seen['first']} ({'; '.join(parts)}); "
                                             f"clinician review. Reported by {who}, not clinically verified")
                        ev["drivers"].append({"input": "Change in the reported concern since first reported",
                                              "value": len(cog_new) + len(new_acts), "threshold": 1})
                        ev["pathways"].append("primary_care")
                        why_review = "review_task"
                    elif own == "BASELINE":
                        ev["reasons"].append("Follow-up concern recorded; no new memory or thinking change and no new activities "
                                             f"taken over since it was first reported on {seen['first']}")
                seen["domains"] += new_doms if not first else _new(doms, [])
                seen["activities"] += new_acts if not first else _new(acts, [])
                seen["red_flags"] += new_flags if not first else _new(ev.get("red_flags") or [], [])
                seen["first"] = seen["first"] or s["date"][:10]
            else:
                ev["informant_report"] = True
                ev["informant"] = {"instrument": "FAQ", "score": fq, "max": C.FAQ_MAX, "cutoff": C.FAQ_CUTOFF,
                                   "previous": faq_before, "previous_date": faq_before_date,
                                   "change": None if fq is None or faq_before is None else fq - faq_before,
                                   "at_or_above_cutoff": faq_flag}
                if own == "BASELINE" and faq_flag and (faq_before is None or faq_before < C.FAQ_CUTOFF):
                    own = "CLINICIAN_REVIEW"
                    ev["reasons"].append(f"Family questionnaire at or above cutoff (FAQ {fq} of {C.FAQ_MAX}, cutoff {C.FAQ_CUTOFF}); "
                                         "needs a professional clinical evaluation. A screening result, not a diagnosis")
                    ev["drivers"].append({"input": "Family questionnaire (FAQ)", "value": fq, "threshold": C.FAQ_CUTOFF})
                    ev["pathways"].append("primary_care")
                    why_review = "review_task"
                elif own == "BASELINE" and fq is not None:
                    ev["reasons"].append(f"Family questionnaire recorded (FAQ {fq} of {C.FAQ_MAX}"
                                         + (f"; {faq_before} on {faq_before_date}" if faq_before is not None else "")
                                         + ("; still at or above cutoff, no new loss)" if faq_flag else f"; below cutoff {C.FAQ_CUTOFF})"))
            base = prev_ev["level"] if prev_ev else "BASELINE"
            ev["carried"] = LEVELS.index(own) < LEVELS.index(base)
            ev["level"] = _max(own, base)
            if ev["carried"]:
                ev["reasons"].append(f"Level unchanged from the previous result ({base}, {prev_ev['date']})")
                ev["next_action"] = prev_ev.get("next_action")
            elif own == "URGENT":
                ev["next_action"] = "urgent_review_task"
            else:
                ev["next_action"] = why_review or ("first_session" if not prev_ev else prev_ev.get("next_action"))
            evals.append(ev)
            continue

        # 2. quality gate
        gate = audio_gate(s.get("audio"))
        if gate or s.get("raw") is None:
            ev["valid"] = False
            ev["level"] = _max(ev["level"], "CHECK_AGAIN")
            ev["reasons"].append("Session not scored: " + (", ".join(gate) or "incomplete"))
            ev["next_action"] = "repeat_soon"
            evals.append(ev)
            continue

        raw = s["raw"]
        zp = z_profile(raw, edu, age)
        ev["z"] = zp
        conf = confounders(s)
        ev["confounders"] = conf
        conf_codes = {c["code"] for c in conf}
        if "mood" in conf_codes:
            ev["pathways"].append("mental_health")
        hist_days.append((_d(s["date"]) - t0).days)
        hist_z.append(zp["composite"])

        # 3. baseline building (clean sessions preferred; same channel only)
        bl = baseline.setdefault(ch, [])
        clean = not (conf_codes & {"mood", "illness_medication", "assisted"})
        if len(bl) < C.BASELINE_SESSIONS:
            if clean or idx >= C.BASELINE_MAX_SESSIONS - 1:
                bl.append((idx, raw, zp["composite"], s))
            ev["level"] = _max(ev["level"], "BASELINE")
            ev["reasons"].append(f"Building personal baseline ({len(bl)}/{C.BASELINE_SESSIONS} sessions, channel: {ch})")
            if len(hist_z) == 1 and zp["composite"] <= C.FIRST_VISIT_REVIEW_Z:
                ev["level"] = _max(ev["level"], "CLINICIAN_REVIEW")
                ev["reasons"].append(f"Very low score at first visit for age and education (composite z {zp['composite']:.2f} <= "
                                     f"{C.FIRST_VISIT_REVIEW_Z}); clinician review without waiting for a baseline")
                ev["drivers"].append({"input": "First-visit composite (education-stratified)", "value": round(zp["composite"], 2),
                                      "threshold": C.FIRST_VISIT_REVIEW_Z})
                ev["pathways"].append("memory_clinic")
            if len(bl) == C.BASELINE_SESSIONS:
                bz = sum(b[2] for b in bl) / len(bl)
                ev["baseline_composite_z"] = round(bz, 3)
                if bz <= C.LOW_BASELINE_Z:
                    ev["level"] = _max(ev["level"], "CLINICIAN_REVIEW")
                    ev["reasons"].append(f"Baseline score below expected range for age and education (composite z {bz:.2f} <= {C.LOW_BASELINE_Z})")
                    ev["drivers"].append({"input": "Baseline composite (education-stratified)", "value": round(bz, 2), "threshold": C.LOW_BASELINE_Z})
                    ev["pathways"].append("memory_clinic")
            if functional_flag and ev["level"] in ("BASELINE",):
                ev["reasons"].append("Informant questionnaire above cutoff; clinician to be informed")
                ev["level"] = "CLINICIAN_REVIEW"
                ev["pathways"].append("primary_care")
            ev["next_action"] = "baseline_next"
            if ev["level"] in ("BASELINE",) and "mood" in conf_codes:
                ev["reasons"].append("Mood screen positive: support information shown, mental-health pathway offered")
            evals.append(ev)
            continue

        # 4. reliable change vs baseline
        ev["level"] = _max(ev["level"], "STABLE")
        b_idx = [b[0] for b in bl]
        crci = composite_rci(zp["composite"], idx, [b[2] for b in bl], b_idx)
        drci = domain_rcis(raw, idx, [b[1] for b in bl], b_idx)
        ev["rci"] = {"composite": crci, "domains": drci}
        ev["change_interval_90"] = [round(crci["observed_change"] - crci["expected_practice"] - 1.645 * crci["se_diff"], 2),
                                    round(crci["observed_change"] - crci["expected_practice"] + 1.645 * crci["se_diff"], 2)]
        dom_declines = [d for d, r in drci.items() if r["rci"] <= C.RCI_DOMAIN_CHECK]
        decline_keys = ({"composite"} if crci["rci"] <= C.RCI_CHECK else set()) | \
            {d for d in dom_declines if d in C.TRIGGER_DOMAINS}
        decline = bool(decline_keys)
        days_since_bl = (_d(s["date"]) - _d(bl[-1][3]["date"])).days
        large = crci["rci"] <= C.RCI_LARGE or (days_since_bl <= 120 and crci["baseline"] - zp["composite"] >= C.RAPID_DROP_Z)
        ev["slope_per_year"] = slope_per_year(hist_days, hist_z)

        if crci["rci"] <= C.RCI_CHECK:
            ev["drivers"].append({"input": "Overall score (composite)", "value": crci["rci"], "threshold": C.RCI_CHECK,
                                  "change": crci["observed_change"], "metric": "RCI"})
        for d in dom_declines:
            ev["drivers"].append({"input": DOMAIN_LABEL[d][0], "value": drci[d]["rci"], "threshold": C.RCI_DOMAIN_CHECK,
                                  "change": drci[d]["observed_change"], "metric": "RCI"})

        prev = last_post_baseline.get(ch)
        # confirmation requires the SAME signal to persist on the repeat session
        prev_decline = bool(prev and (prev.get("_decline_keys", set()) & decline_keys))
        ev["_decline_keys"] = decline_keys
        ev["decline_signals"] = sorted(decline_keys)

        if large and decline:
            ev["level"] = _max(ev["level"], "URGENT")
            ev["reasons"].append("Large or rapid decline from personal baseline")
            ev["pathways"] += ["memory_clinic"] + (["mental_health"] if "mood" in conf_codes else [])
            if conf:
                ev["reasons"].append("Confounders present and shown to clinician, but size of change requires prompt review")
        elif decline and (prev_decline or not C.REQUIRE_CONFIRMATION) and "assisted" not in conf_codes:
            ev["level"] = _max(ev["level"], "CLINICIAN_REVIEW")
            ev["reasons"].append("Decline confirmed on repeat with an alternate form")
            ev["pathways"].append("memory_clinic")
        elif decline and functional_flag and not (conf_codes & {"mood", "illness_medication", "sensory"}):
            ev["level"] = _max(ev["level"], "CLINICIAN_REVIEW")
            ev["reasons"].append("Decline plus an independent informant-reported functional signal")
            ev["pathways"].append("memory_clinic")
        elif decline:
            ev["level"] = _max(ev["level"], "CHECK_AGAIN")
            if conf:
                ev["reasons"].append("Change beyond measurement noise, but possible explanation present: " +
                                     ", ".join(c["label"].lower() for c in conf))
            else:
                ev["reasons"].append("One result beyond the reliable-change range; repeat with an alternate form to confirm")
        else:
            if conf:
                ev["reasons"].append("Within reliable-change range; context factors noted: " +
                                     ", ".join(c["code"] for c in conf))
            else:
                ev["reasons"].append("Within reliable-change range of personal baseline")
            if functional_flag:
                ev["level"] = _max(ev["level"], "CHECK_AGAIN")
                ev["reasons"].append("Informant questionnaire above cutoff without measured decline; repeat and inform clinician")
        if "mood" in conf_codes and ev["level"] in ("STABLE", "CHECK_AGAIN"):
            ev["reasons"].append("Mood screen positive: support information shown, mental-health pathway offered")

        ev["next_action"] = {"STABLE": "routine", "CHECK_AGAIN": "repeat_2_4_weeks",
                             "CLINICIAN_REVIEW": "review_task", "URGENT": "urgent_review_task"}[ev["level"]]
        last_post_baseline[ch] = ev
        evals.append(ev)

    for ev in evals:
        ev["pathways"] = sorted(set(ev["pathways"]))
        ev["held_for_clinician"] = ev["level"] in ("CLINICIAN_REVIEW", "URGENT")
        ev["uncertainty"] = (
            "This is a screening signal of change, not a diagnosis. Scores vary from day to day; "
            "the 90% range shows how much the true change could differ from what was measured. "
            "Thresholds are provisional until validated in the local population (Phase 2)."
        )
    return evals


def public_eval(ev: dict) -> dict:
    return {k: v for k, v in ev.items() if not k.startswith("_")}


def evaluate(participant: dict, sessions: list[dict]) -> dict:
    hist = [public_eval(e) for e in evaluate_history(participant, sessions)]
    return {"participant_id": participant["id"], "latest": hist[-1] if hist else None, "history": hist}
