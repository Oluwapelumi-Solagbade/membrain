"""The family's next step: written in plain language, approved by a clinician, and only then shown to the family.

Clinicians get a suggested message in English and Arabic built from the case (latest result, open review, referral and
service), edit it and approve it. The family (signed in to their own record) sees only approved messages, plus the
referral's progress in plain words. Until a clinician approves one, the family sees that the case is being reviewed.
Never a diagnosis; nothing reaches the family without a clinician's approval.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth import Principal, principal
from membrain import navigator as NAV

router = APIRouter(tags=["family"])

STATE_TEXT = {
    "recommended": ("A referral has been recommended by your clinician.", "أوصى طبيبك بإحالة."),
    "sent": ("The referral has been sent to the service.", "أُرسلت الإحالة إلى الجهة المختصة."),
    "accepted": ("The service has accepted the referral.", "قبلت الجهة المختصة الإحالة."),
    "declined": ("That service could not accept it; your clinician is arranging another.", "تعذّر على تلك الجهة قبولها، ويرتّب طبيبك جهة أخرى."),
    "appointment_offered": ("An appointment has been offered.", "عُرض عليكم موعد."),
    "attended": ("The appointment took place.", "تمّ حضور الموعد."),
    "missed": ("The appointment was missed; the clinic will contact you to rebook.", "فات الموعد، وستتواصل معكم العيادة لحجز موعد جديد."),
    "assessment_completed": ("The assessment is complete.", "اكتمل التقييم."),
    "follow_up_documented": ("The follow-up plan has been recorded.", "سُجّلت خطة المتابعة."),
    "lost_to_follow_up": ("We could not reach you; please contact the clinic.", "لم نتمكّن من التواصل معكم، يُرجى الاتصال بالعيادة."),
    "no_accessible_service": ("No suitable service was available yet; your clinician will advise.", "لا تتوفر جهة مناسبة بعد، وسيرشدكم طبيبك."),
    "cancelled": ("The referral was cancelled.", "أُلغيت الإحالة."),
}
WAITING = ("A clinician is reviewing what you shared. Your next step will appear here once they have approved it.",
           "يراجع الطبيب ما شاركتموه. ستظهر خطوتكم التالية هنا بعد أن يعتمدها.")


def suggest(p: dict, latest: dict | None, task: dict | None) -> dict:
    """A plain-language draft for the clinician to edit and approve (never shown to the family as is)."""
    level = (latest or {}).get("level")
    scored = any(x.get("raw") is not None and x.get("type") not in ("intake", "informant") for x in p.get("sessions") or [])
    ref = next((r for r in reversed(p.get("referrals") or []) if NAV.is_unresolved(r)), None)
    svc = {s["id"]: s for s in NAV.directory()}.get((ref or {}).get("service_id"))
    name = (svc or {}).get("name", "").replace(" (synthetic)", "")
    if level == "URGENT":
        en = ("Please seek urgent medical help today. If there is sudden weakness, confusion, trouble speaking or a fall with a "
              "head injury, call 998 now. Our team will also contact you.")
        ar = ("يُرجى طلب مساعدة طبية عاجلة اليوم. إذا ظهر ضعف مفاجئ أو تشوّش أو صعوبة في الكلام أو سقوط مع إصابة في الرأس، "
              "فاتصلوا بالرقم 998 فورًا. وسيتواصل معكم فريقنا أيضًا.")
    elif ref:
        en = (f"A clinician has looked at what you shared and has asked for an assessment{f' at {name}' if name else ''}. "
              f"They will contact you to arrange it. This is a check, not a diagnosis. Meanwhile, keep doing the usual "
              f"daily activities and tell us if anything changes.")
        ar = (f"اطّلع الطبيب على ما شاركتموه وطلب إجراء تقييم{f' في {name}' if name else ''}. سيتواصلون معكم لترتيب الموعد. "
              f"هذا فحص وليس تشخيصًا. وفي الأثناء استمروا في الأنشطة اليومية المعتادة وأخبرونا بأي تغيّر.")
    elif level == "CLINICIAN_REVIEW" or (task and task.get("status") != "closed"):
        en = ("A clinician has looked at what you shared and will contact you to talk about the next steps. This is not a "
              "diagnosis. Meanwhile, if not done yet, the short spoken check-in helps them.")
        ar = ("اطّلع الطبيب على ما شاركتموه وسيتواصل معكم للحديث عن الخطوات التالية. هذا ليس تشخيصًا. وفي الأثناء، "
              "إن لم يُجرَ بعد، فإن الفحص الصوتي القصير يساعد الطبيب.")
    elif not scored:
        en = ("Thank you for telling us. The next step is a short spoken check-in (about six minutes) in Arabic or English, "
              "so we have a starting point to compare with later. This is not a diagnosis.")
        ar = ("شكرًا لإخبارنا. الخطوة التالية فحص صوتي قصير (نحو ست دقائق) بالعربية أو الإنجليزية، ليكون نقطة بداية "
              "نقارن بها لاحقًا. هذا ليس تشخيصًا.")
    elif level == "CHECK_AGAIN":
        en = ("A clinician has looked at the results. The next step is a short repeat check-in in 2 to 4 weeks, so we can "
              "compare it with the last one. This is not a diagnosis. Tell us sooner if anything changes.")
        ar = ("اطّلع الطبيب على النتائج. الخطوة التالية فحص قصير متكرّر بعد أسبوعين إلى أربعة أسابيع لنقارنه بالأخير. "
              "هذا ليس تشخيصًا. أخبرونا قبل ذلك إذا حدث أي تغيّر.")
    else:
        en = ("Thank you. Nothing needs to change now. Please do the next check-in in about six months, and contact us "
              "earlier if you notice a new change.")
        ar = ("شكرًا لكم. لا يلزم تغيير شيء الآن. يُرجى إجراء الفحص التالي بعد نحو ستة أشهر، والتواصل معنا قبل ذلك إذا "
              "لاحظتم تغيّرًا جديدًا.")
    return {"en": en, "ar": ar, "based_on": {"level": level, "referral_state": (ref or {}).get("state"), "service": name or None}}


class FamilyMessageIn(BaseModel):
    en: str = Field("", max_length=1200)
    ar: str = Field("", max_length=1200)


def _staff(who: Principal):
    if who.role not in ("clinician", "coordinator"):
        raise HTTPException(401 if who.role == "anonymous" else 403, "Please sign in as a clinician.")


@router.get("/participants/{pid}/family-message/suggest")
def suggest_message(pid: str, who: Principal = Depends(principal)):
    _staff(who)
    from api.main import own
    own(who, pid)
    from api.main import DB, _task_for
    from membrain.triage import evaluate
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    ev = evaluate(p, p["sessions"]) if p.get("sessions") else {"latest": None}
    return {**suggest(p, ev["latest"], _task_for(p, ev["latest"])), "approved": p.get("family_messages", [])}


@router.post("/participants/{pid}/family-message")
def approve_message(pid: str, body: FamilyMessageIn, who: Principal = Depends(principal)):
    _staff(who)
    from api.main import own
    own(who, pid)
    from api.main import DB, audit
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    if len(body.en.strip()) < 10 and len(body.ar.strip()) < 10:
        raise HTTPException(422, "Write the message in English, Arabic or both.")
    m = {"ts": datetime.now(timezone.utc).isoformat(), "by": who.actor, "en": body.en.strip(), "ar": body.ar.strip()}
    p.setdefault("family_messages", []).append(m)
    audit(who.actor, "family_message_approved", pid, {"languages": [k for k in ("en", "ar") if m[k]]})
    return m


@router.get("/me/{pid}/next-step")
def my_next_step(pid: str, lang: str = "ar", who: Principal = Depends(principal)):
    """For the person or family signed in to this record: only clinician-approved words, and the referral's progress."""
    from api.main import DB, own
    own(who, pid)
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    i = 1 if lang == "ar" else 0
    msgs = p.get("family_messages") or []
    last = msgs[-1] if msgs else None
    text = (last.get(lang) or last.get("en") or last.get("ar")) if last else None
    progress = []
    for r in p.get("referrals") or []:
        progress.append({"service": ({s["id"]: s for s in NAV.directory()}.get(r.get("service_id")) or {}).get("name", "").replace(" (synthetic)", "") or None,
                         "steps": [{"date": h.get("date"), "text": STATE_TEXT.get(h["state"], (h["state"], h["state"]))[i]} for h in r.get("history") or []]})
    return {"status": "approved" if last else "waiting", "text": text or WAITING[i], "approved_at": (last or {}).get("ts"),
            "referrals": progress}
