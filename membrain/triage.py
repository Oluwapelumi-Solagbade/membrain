"""Rule-based alert fusion and triage (release 1: no black box).

Levels (ascending urgency):
  BASELINE          building the personal baseline
  STABLE            within reliable-change range
  CHECK_AGAIN       one unconfirmed change, a confounder, or an invalid session
  CLINICIAN_REVIEW  change confirmed on repeat, change + independent signal,
                    or low entry score vs stratified norms
  URGENT            large/rapid decline, new informant-reported functional
                    loss, or a safety concern

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
    hist_days, hist_z = [], []
    t0 = _d(sessions[0]["date"]) if sessions else None

    for s in sessions:
        ch = s.get("channel", "app")
        idx = channel_idx.get(ch, 0)
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
        if s.get("safety_concern"):
            ev["level"] = "URGENT"
            ev["reasons"].append("Informant reported a safety concern")
            ev["pathways"].append("primary_care_urgent")
        if new_loss:
            ev["level"] = "URGENT"
            ev["reasons"].append(f"New functional loss reported by informant (IQCODE {iq_before:.2f} -> {iq:.2f}, above cutoff {C.IQCODE_CUTOFF})")
            ev["drivers"].append({"input": "Informant questionnaire (IQCODE-16)", "value": iq, "threshold": C.IQCODE_CUTOFF})
            ev["pathways"].append("memory_clinic")

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
        elif decline and prev_decline and "assisted" not in conf_codes:
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
            "Thresholds are provisional until validated in the local population (Phase A/B)."
        )
    return evals


def public_eval(ev: dict) -> dict:
    return {k: v for k, v in ev.items() if not k.startswith("_")}


def evaluate(participant: dict, sessions: list[dict]) -> dict:
    hist = [public_eval(e) for e in evaluate_history(participant, sessions)]
    return {"participant_id": participant["id"], "latest": hist[-1] if hist else None, "history": hist}
