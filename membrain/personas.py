"""Scripted demo personas: one per triage pathway (synthetic, not real people)."""
from __future__ import annotations

from datetime import date, timedelta

from . import config as C
from .items import form_for_session
from .scoring import expected_raw


def _raw(edu: str, age: float, z: float, idx: int, dz: dict | None = None) -> dict:
    out = {}
    for d, prm in C.DOMAINS.items():
        v = expected_raw(d, edu, age) + C.NORMS[d]["sd"] * (z + (dz or {}).get(d, 0)) + prm["practice"] * min(idx, C.PRACTICE_SATURATION)
        out[d] = int(max(0, min(prm["max"], round(v))))
    return out


def _sessions(pid: str, edu: str, age: float, plan: list[tuple], start=date(2026, 3, 1)) -> list[dict]:
    out = []
    for i, (week, z, extra) in enumerate(plan):
        extra = dict(extra or {})
        dz = extra.pop("dz", None)
        s = {"session_id": f"{pid}-s{i}", "date": (start + timedelta(weeks=week)).isoformat(), "week": week,
             "channel": extra.pop("channel", "app"), "form": form_for_session(i, hash(pid) % 3),
             "audio": {"snr_db": 24.0, "clipping": 0.0, "speech_ratio": 0.55, "duration_s": 40.0},
             "precheck": {"hearing_ok": True, "vision_ok": True, "noise_ok": True},
             "phq2": 1, "gad2": 1, "sleep_hours": 7.0}
        s["raw"] = None if z is None else _raw(edu, age, z, i, dz)
        s.update(extra)
        out.append(s)
    return out


def personas() -> list[dict]:
    P = []

    def add(pid, name_en, name_ar, age, sex, edu, dialect, story, plan, ctx, consent=None):
        lang = "en" if dialect == "English" else "ar"
        P.append({"id": pid, "display_name": {"en": name_en, "ar": name_ar}, "age": age,
                  "age_band": "50-59" if age < 60 else "60-69" if age < 70 else "70-75", "sex": sex,
                  "education": edu, "dialect": dialect, "language": lang, "story": story, "context": ctx,
                  "consent": consent or {"voice_features": True, "wearables": True, "clinical_record": True,
                                         "family_history": True, "genomics": False, "raw_audio": False},
                  "sessions": _sessions(pid, edu, age, plan)})

    add("MB-1041", "Fatima", "فاطمة", 68, "F", "none", "Emirati",
        "No formal schooling. Raw scores look low, so an education-blind tool would refer her. "
        "Against people of her own age and education, and against her own baseline, she is stable.",
        [(0, -0.3, None), (3, -0.2, None), (14, -0.25, None), (27, -0.3, None)],
        {"sbp": 142, "dbp": 86, "hba1c": 7.4, "ldl": 3.2, "bmi": 31, "activity_min_week": 60, "sleep_hours": 6.5,
         "hearing_difficulty": True, "hearing_aid": False, "family_history_dementia": False, "social_isolation": False})
    add("MB-1187", "Ahmed", "أحمد", 72, "M", "primary", "Egyptian",
        "Stable baseline, then a drop in delayed recall and story recall that persists on an alternate-form repeat 3 weeks later. "
        "No mood, sleep or illness explanation. Confirmed change, so a clinician review task is created.",
        [(0, 0.0, None), (2, 0.1, None), (26, -0.35, {"dz": {"memory_delayed": -0.9, "story_recall": -0.4}}),
         (29, -0.4, {"dz": {"memory_delayed": -1.0, "story_recall": -0.5}})],
        {"sbp": 151, "dbp": 90, "hba1c": 6.9, "ldl": 3.6, "bmi": 28, "activity_min_week": 40, "sleep_hours": 6.8,
         "smoker": True, "family_history_dementia": True, "consent_genomic": False})
    add("MB-1203", "Mariam", "مريم", 61, "F", "secondary", "Levantine",
        "Scores dipped beyond the reliable-change range, but her mood screen is positive and she slept under 5 hours. "
        "The cognitive alert is held; she gets support information and a mental-health pathway offer, and a repeat in 3 weeks.",
        [(0, 0.2, None), (2, 0.3, None), (26, -0.6, {"phq2": 5, "gad2": 4, "sleep_hours": 4.6})],
        {"sbp": 124, "dbp": 78, "hba1c": 5.6, "ldl": 2.6, "bmi": 26, "activity_min_week": 90, "sleep_hours": 5.0,
         "mood_positive": True, "social_isolation": True})
    add("MB-1322", "Khalid", "خالد", 74, "M", "tertiary", "Emirati",
        "Large, rapid decline within 3 months plus his daughter reports new difficulty managing money and getting lost driving "
        "(informant questionnaire rose above cutoff). Urgent review: clinician contact within days.",
        [(0, 0.5, {"iqcode": 3.05}), (2, 0.6, None), (12, -1.4, {"iqcode": 3.72, "dz": {"memory_delayed": -0.6}})],
        {"sbp": 138, "dbp": 84, "hba1c": 6.2, "ldl": 2.9, "bmi": 27, "activity_min_week": 150, "sleep_hours": 7.0,
         "family_history_dementia": True, "consent_genomic": True, "apoe4": "1 copy (research result)"},
        {"voice_features": True, "wearables": True, "clinical_record": True, "family_history": True, "genomics": True, "raw_audio": True})
    add("MB-1409", "John", "جون", 58, "M", "tertiary", "English",
        "One session was recorded next to a TV: the audio quality gate rejected it and asked him to repeat in a quiet room. "
        "The repeat was valid and stable.",
        [(0, 0.4, None), (2, 0.5, None), (26, 0.3, {"audio": {"snr_db": 8.5, "clipping": 0.0, "speech_ratio": 0.4, "duration_s": 35}}),
         (27, 0.45, None)],
        {"sbp": 128, "dbp": 82, "hba1c": 5.9, "ldl": 3.4, "bmi": 30, "activity_min_week": 200, "sleep_hours": 6.9})
    add("MB-1455", "Aisha", "عائشة", 55, "F", "secondary", "Other Gulf",
        "Newly enrolled through the IFHAS screening programme. First session done; building her personal baseline.",
        [(0, 0.1, None)],
        {"sbp": 118, "dbp": 74, "hba1c": 5.4, "ldl": 2.4, "bmi": 24, "activity_min_week": 160, "sleep_hours": 7.2})
    add("MB-1510", "Saeed", "سعيد", 70, "M", "none", "Emirati",
        "Completed with his son's help (assisted mode). A drop in an assisted session cannot confirm change alone, "
        "so the engine asks for an unassisted repeat with accommodations.",
        [(0, -0.2, {"assisted": True, "helper_role": "son"}), (3, -0.1, None), (16, -0.1, None),
         (28, -0.55, {"assisted": True, "helper_role": "son", "precheck": {"hearing_ok": False, "vision_ok": True, "noise_ok": True}})],
        {"sbp": 135, "dbp": 80, "hba1c": 6.6, "ldl": 2.8, "bmi": 29, "activity_min_week": 70, "sleep_hours": 6.0,
         "hearing_difficulty": True, "vision_difficulty": True})
    return P
