"""MemBrain on Telegram: the website's concern chat as a bot, in English and Modern Standard Arabic.

The conversation is the same as site/components/concern: who noticed the change, the concern in their own words
(typed or as a voice note), a read-back of what the intake extractor picked out with the words it came from, a
chance to untick anything wrong, then the triage outcome. A confirmed concern goes through the same code as
POST /concerns, so it lands in the clinician queue like one raised on the website.

Two ways to receive updates, both inside the API process so concerns reach the same store the dashboard reads:
  - webhook (production): set TELEGRAM_WEBHOOK_URL=https://<host>/telegram/webhook; it is registered at startup.
  - polling (local dev): set only TELEGRAM_BOT_TOKEN; the API polls Telegram while it runs.
The bot token lives only in the server environment. What is stored with a concern is what the person confirmed:
no name, phone number or Telegram account. Conversation state is in memory, like the rest of the demo API.
"""
from __future__ import annotations

import asyncio
import contextlib
import hashlib
import html
import logging
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime
from typing import Awaitable, Callable
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request

from membrain import config as C
from membrain.intake import extract_rules

log = logging.getLogger("membrain.telegram")
logging.getLogger("httpx").setLevel(logging.WARNING)   # httpx logs request URLs, and Telegram's carry the token

router = APIRouter(prefix="/telegram", tags=["telegram"])

REPORTERS = ["self", "family", "helper", "professional", "coordinator"]
UAE = ZoneInfo("Asia/Dubai")


def ar_digits(n: int) -> str:
    return str(n).translate(str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩"))


# ---------------------------------------------------------------------------------------------------- words
# Same wording as site/components/concern/copy.ts where the two say the same thing. The Arabic is Modern Standard
# Arabic (people may write to it in any dialect); it needs
# native-speaker review before any pilot, as the rest of MemBrain's Arabic does.
T = {
    "en": {
        "intro": "Hello. I'm <b>MemBrain</b>. I'll help you describe a change in memory or thinking, so the right clinician can look at it.\n\n"
                 "I don't diagnose, and nothing is decided automatically. First, who noticed the change?",
        "reporter": {"self": "Myself", "family": "A family member", "helper": "A household helper",
                     "professional": "A doctor or nurse", "coordinator": "A programme coordinator"},
        "switch": "عربي",
        "askSelf": "Thank you. In your own words, what have you noticed in yourself? It helps to say when it started, "
                   "and whether someone now does things you used to do.\n\nType it, or send a voice note.",
        "askOther": "Thank you. In your own words, what have you noticed? It helps to say when it started, "
                    "and whether someone now does things the person used to do.\n\nType it, or send a voice note.",
        "askMore": "Of course. Add whatever you'd like and I'll look at everything together.",
        "whoFirst": "Thank you. Before I read it, who noticed the change?",
        "tooShort": "Could you say a little more? A sentence or two is enough.",
        "heard": "I heard:",
        "noVoice": "Voice notes aren't switched on here yet. Please type it instead.",
        "voiceFailed": "Sorry, I couldn't make out that voice note. Could you try again, or type it?",
        "voiceLong": "That voice note is a bit long for me. Please keep it under a minute, or type it.",
        "picked": "Here is what I picked out. Each fact shows the words it came from. Tap anything that's wrong to untick it.",
        "pickedFrozen": "Here is what you confirmed.",
        "pickedNone": "I couldn't pick out a specific change yet. You can add more detail, or carry on and a clinician will ask you.",
        "urgent": "Possible urgent signs",
        "changed": "What has changed",
        "started": "When it started",
        "who": "Who now does what",
        "affect": "Things that can affect memory",
        "nowDoneBy": "now done by",
        "check": "please check",
        "urgentLocked": "A clinician checks these, so they can't be removed here.",
        "urgentNow": "⚠️ <b>Some of what you said may need urgent care.</b>\n"
                     "If the person is unwell right now, call <b>998</b>. No memory testing will happen until a clinician has looked at this.",
        "right": "That's right",
        "addMore": "Add more detail",
        "urgentOutcome": "Please get help now",
        "urgentOutcomeBody": lambda d: "What you described can be a sign of a medical problem that needs care today, not only a memory problem. "
                                       f"If the person is unwell, call 998 or go to the nearest emergency department. A clinician is alerted to follow up within {d} days.",
        "reviewOutcome": lambda d: f"A clinician will review this within {d} days",
        "reviewOutcomeBody": "You don't need to wait for any test first. This is why:",
        "reviewOutcomeAfter": "The first spoken check-in can still go ahead in the meantime.",
        "routineOutcome": "Next step: a short spoken check-in",
        "routineOutcomeBody": "Nothing you described needs urgent care or an early review. The next step is a six-minute check-in, "
                              "spoken in your own dialect. A clinician sees your summary alongside it.",
        "reasonActs": lambda n: "An everyday activity is now done by someone else" if n == 1 else f"{n} everyday activities are now done by someone else",
        "reasonPro": "The concern comes from a doctor or nurse",
        "reference": "Reference",
        "stored": "What you confirmed is kept under this reference, with no name, phone number or Telegram account attached. "
                  "MemBrain does not diagnose. In an emergency, call 998.",
        "restart": "Raise another concern",
        "saveFailed": "Sorry, I couldn't pass this on just now. Please try again in a moment.",
        "retry": "Try again",
        "done": "This concern has been passed on. Send /new to raise another one.",
        "help": "I help you describe a change in someone's memory or thinking, so a clinician can review it. I don't diagnose.\n\n"
                "/new  start a new concern\n/language  switch to Arabic\n/status  what happened to your last concern\n\n"
                "In an emergency, call 998.",
        "status": lambda ref, s: f"Your last concern, <b>{ref}</b>: {s}",
        "statusNone": "You haven't raised a concern here yet. Send /new to start.",
        "st": {"open": "waiting for a clinician.", "in_progress": "a clinician is looking at it.", "closed": "a clinician has reviewed it.",
               "routine": "no early review was needed; the next step is the spoken check-in."},
    },
    "ar": {
        "intro": "مرحبًا. أنا <b>MemBrain</b>. سأساعدك على وصف التغيّر في الذاكرة أو التفكير، ليطّلع عليه الطبيب المناسب.\n\n"
                 "أنا لا أشخّص، ولا يُتّخذ أي قرار بشكل تلقائي. أولًا، من الذي لاحظ التغيّر؟",
        "reporter": {"self": "أنا نفسي", "family": "أحد أفراد العائلة", "helper": "العاملة أو المساعد في المنزل",
                     "professional": "طبيب أو ممرض", "coordinator": "منسق البرنامج"},
        "switch": "English",
        "askSelf": "شكرًا لك. صِف بكلماتك ما لاحظته في نفسك. من المفيد أن تذكر متى بدأ، وهل أصبح أحد يقوم بأمور كنت تقوم بها بنفسك.\n\nاكتبه، أو أرسل رسالة صوتية.",
        "askOther": "شكرًا لك. صِف بكلماتك ما لاحظته. من المفيد أن تذكر متى بدأ، وهل أصبح أحد يقوم بأمور كان الشخص يقوم بها بنفسه.\n\nاكتبه، أو أرسل رسالة صوتية.",
        "askMore": "بالتأكيد. أضف ما تريد، وسأقرأ الكلام كله معًا.",
        "whoFirst": "شكرًا لك. قبل أن أقرأه، من الذي لاحظ التغيّر؟",
        "tooShort": "هل يمكنك أن توضّح أكثر قليلًا؟ تكفي جملة أو جملتان.",
        "heard": "سمعتُ:",
        "noVoice": "الرسائل الصوتية غير مفعّلة هنا بعد. يُرجى كتابة الرسالة.",
        "voiceFailed": "عذرًا، لم أتمكّن من فهم الرسالة الصوتية. حاول مرة أخرى، أو اكتب رسالتك.",
        "voiceLong": "الرسالة الصوتية طويلة بعض الشيء. اجعلها أقل من دقيقة، أو اكتب رسالتك.",
        "picked": "هذا ما فهمته. تظهر مع كل معلومة الكلمات التي جاءت منها. اضغط على أي شيء غير صحيح لإلغائه.",
        "pickedFrozen": "هذا ما أكّدته.",
        "pickedNone": "لم أتمكّن من تحديد تغيّر معيّن بعد. يمكنك إضافة تفاصيل أكثر، أو المتابعة وسيسألك الطبيب.",
        "urgent": "علامات قد تكون عاجلة",
        "changed": "ما الذي تغيّر",
        "started": "متى بدأ",
        "who": "من يقوم بماذا الآن",
        "affect": "أمور قد تؤثر في الذاكرة",
        "nowDoneBy": "يقوم بها الآن",
        "check": "للتأكيد",
        "urgentLocked": "يتحقّق الطبيب من هذه العلامات، لذلك لا يمكن إزالتها من هنا.",
        "urgentNow": "⚠️ <b>قد يحتاج بعض ما ذكرته إلى رعاية عاجلة.</b>\n"
                     "إذا كان الشخص متعبًا الآن، فاتصل على <b>٩٩٨</b>. لن يُجرى أي فحص للذاكرة قبل أن يطّلع الطبيب على الحالة.",
        "right": "نعم، هذا صحيح",
        "addMore": "أريد إضافة تفاصيل",
        "urgentOutcome": "يُرجى طلب المساعدة الآن",
        "urgentOutcomeBody": lambda d: "ما وصفته قد يكون علامة على مشكلة صحية تحتاج إلى رعاية اليوم، وليس مشكلة في الذاكرة فقط. "
                                       f"إذا كان الشخص متعبًا، فاتصل على ٩٩٨ أو توجّه إلى أقرب قسم طوارئ. وسيُنبَّه طبيب لمتابعة الحالة خلال {ar_digits(d)} أيام.",
        "reviewOutcome": lambda d: f"سيراجع الطبيب الحالة خلال {ar_digits(d)} يومًا",
        "reviewOutcomeBody": "لا حاجة إلى انتظار أي فحص قبل ذلك. والسبب:",
        "reviewOutcomeAfter": "ويمكن إجراء الفحص الصوتي الأول في الوقت نفسه.",
        "routineOutcome": "الخطوة التالية: فحص صوتي قصير",
        "routineOutcomeBody": "لا شيء فيما ذكرته يحتاج إلى رعاية عاجلة أو مراجعة مبكرة. الخطوة التالية فحص مدته ست دقائق، ويطّلع الطبيب على ملخّصك معه.",
        "reasonActs": lambda n: "أصبح شخص آخر يقوم بنشاط يومي عنه" if n == 1 else f"أصبح شخص آخر يقوم بـ{ar_digits(n)} من الأنشطة اليومية",
        "reasonPro": "جاء القلق من طبيب أو ممرض",
        "reference": "الرقم المرجعي",
        "stored": "ما أكّدته محفوظ تحت هذا الرقم، دون اسم أو رقم هاتف أو حساب تيليجرام. MemBrain لا يشخّص. في حالات الطوارئ، اتصل على ٩٩٨.",
        "restart": "أبلغ عن تغيّر آخر",
        "saveFailed": "عذرًا، لم أتمكّن من إرساله الآن. حاول مرة أخرى بعد قليل.",
        "retry": "حاول مرة أخرى",
        "done": "أُرسل هذا البلاغ. أرسل /new للإبلاغ عن أمر آخر.",
        "help": "أساعدك على وصف تغيّر في ذاكرة شخص أو تفكيره، ليراجعه طبيب. أنا لا أشخّص.\n\n"
                "/new  بلاغ جديد\n/language  التحويل إلى الإنجليزية\n/status  ماذا حدث لآخر بلاغ\n\n"
                "في حالات الطوارئ، اتصل على ٩٩٨.",
        "status": lambda ref, s: f"آخر بلاغ لك، <b>{ref}</b>: {s}",
        "statusNone": "لم تُبلغ عن أي أمر هنا بعد. أرسل /new للبدء.",
        "st": {"open": "بانتظار الطبيب.", "in_progress": "يطّلع عليه الطبيب الآن.", "closed": "راجعه الطبيب.",
               "routine": "لم تكن هناك حاجة إلى مراجعة مبكرة؛ الخطوة التالية هي الفحص الصوتي."},
    },
}

# Labels for what the extractor finds (site/lib/labels.ts).
LABEL = {
    "domain": {
        "memory": ("Memory", "الذاكرة"), "language": ("Finding words and following conversation", "إيجاد الكلمات ومتابعة الكلام"),
        "orientation": ("Knowing the time, place or people", "معرفة الوقت والمكان والناس"),
        "executive": ("Money, planning and decisions", "الأمور المالية والتخطيط والقرارات"), "daily_function": ("Daily activities", "الأنشطة اليومية"),
        "mood": ("Mood", "المزاج"), "behaviour": ("Behaviour or personality", "السلوك أو الطباع"), "sleep": ("Sleep", "النوم")},
    "red_flag": {
        "sudden_onset": ("A sudden change", "تغيّر مفاجئ"), "fluctuating_confusion": ("Confusion that comes and goes", "تشوّش يظهر ويختفي خلال اليوم"),
        "new_neuro_symptoms": ("New weakness, facial droop, slurred speech or a severe headache", "ضعف جديد أو ميلان في الوجه أو ثقل في الكلام أو صداع شديد"),
        "recent_fall_head_injury": ("A recent fall or head injury", "سقوط أو إصابة في الرأس مؤخرًا"),
        "rapid_deterioration": ("Getting worse quickly", "تدهور سريع"),
        "safety_risk": ("A safety risk at home (wandering, gas or stove left on)", "خطر على السلامة في المنزل (التيه، أو ترك الغاز مشتعلًا)")},
    "confounder": {
        "new_medication": ("A new or changed medicine", "دواء جديد أو تغيير في الدواء"),
        "recent_illness": ("A recent illness or hospital stay", "مرض أو دخول مستشفى مؤخرًا"),
        "hearing": ("Difficulty hearing", "ضعف في السمع"), "bereavement": ("A recent loss of someone close", "فقدان شخص عزيز مؤخرًا")},
    "activity": {
        "money": ("Money and bills", "المال والفواتير"), "medicines": ("Medicines", "الأدوية"), "cooking": ("Cooking", "الطبخ"),
        "shopping": ("Shopping", "التسوّق"), "driving": ("Driving or getting around", "القيادة والتنقّل"), "phone": ("Using the phone", "استخدام الهاتف"),
        "appointments": ("Remembering appointments", "تذكّر المواعيد"), "household": ("Household tasks", "الأعمال المنزلية"),
        "prayer": ("Prayer times and routines", "أوقات الصلاة والروتين")},
    "who": {
        "son": ("the son", "الابن"), "daughter": ("the daughter", "البنت"), "wife": ("the wife", "الزوجة"), "husband": ("the husband", "الزوج"),
        "brother": ("the brother", "الأخ"), "sister": ("the sister", "الأخت"), "driver": ("the driver", "السائق"),
        "helper": ("the household helper", "العاملة المنزلية"), "informant": ("the person telling us", "الشخص الذي يخبرنا"),
        "other": ("another relative", "قريب آخر")},
    "onset": {"days": ("Over the last few days", "منذ أيام"), "weeks": ("Over recent weeks", "منذ أسابيع"),
              "months": ("Over recent months", "منذ أشهر"), "years": ("For a year or more", "منذ سنة أو أكثر")},
}


def lbl(kind: str, key: str, lang: str, fallback: str | None = None) -> str:
    pair = LABEL[kind].get(key)
    return pair[1 if lang == "ar" else 0] if pair else (fallback or key)


# ---------------------------------------------------------------------------------------------------- state
@dataclass
class Chat:
    lang: str = "en"
    step: str = "who"                 # who -> describe -> review -> done
    reporter: str | None = None
    messages: list[str] = field(default_factory=list)
    result: dict | None = None
    ok: dict[str, bool] = field(default_factory=dict)
    review_msg: int | None = None     # the read-back message, so a new message can freeze its buttons
    last_case: str | None = None


Api = Callable[[str, dict], Awaitable[dict]]
Transcribe = Callable[[dict, str], Awaitable[str | None]]


class NoVoice(Exception):
    """Speech recognition is not configured on this server."""


class VoiceTooLong(Exception):
    pass


def _today() -> str:
    return datetime.now(UAE).date().isoformat()


def _default_save(body: dict) -> dict:
    from api.main import ConcernIn, create_concern   # late import: api.main includes this router
    return create_concern(ConcernIn(**body))


def _default_task_status(pid: str) -> str | None:
    from api.main import DB
    for t in DB["tasks"].values():
        if t["participant_id"] == pid:
            return t["status"]
    return None


class Bot:
    """The conversation. Transport-free: `api(method, params)` calls Telegram, so tests pass a fake."""

    def __init__(self, api: Api, transcribe: Transcribe | None = None, save: Callable[[dict], dict] = _default_save,
                 task_status: Callable[[str], str | None] = _default_task_status, today: Callable[[], str] = _today):
        self.api, self.transcribe, self.save, self.task_status, self.today = api, transcribe, save, task_status, today
        self.chats: dict[int, Chat] = {}
        self._locks: dict[int, asyncio.Lock] = {}

    # ---- entry point
    async def handle(self, update: dict) -> None:
        if cq := update.get("callback_query"):
            chat_id = cq["message"]["chat"]["id"]
            async with self._locks.setdefault(chat_id, asyncio.Lock()):
                await self._callback(chat_id, cq)
        elif msg := update.get("message"):
            if msg.get("chat", {}).get("type") != "private":
                return                       # concerns are private: the bot only talks one to one
            chat_id = msg["chat"]["id"]
            async with self._locks.setdefault(chat_id, asyncio.Lock()):
                await self._message(chat_id, msg)

    def _chat(self, chat_id: int, user: dict | None = None) -> Chat:
        if chat_id not in self.chats:
            code = (user or {}).get("language_code") or ""
            self.chats[chat_id] = Chat(lang="ar" if code.startswith("ar") else "en")
        return self.chats[chat_id]

    async def _send(self, chat_id: int, text: str, keyboard: list | None = None) -> dict:
        p = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
        if keyboard is not None:
            p["reply_markup"] = {"inline_keyboard": keyboard}
        return await self.api("sendMessage", p)

    async def _edit(self, chat_id: int, message_id: int, text: str, keyboard: list | None = None) -> None:
        p = {"chat_id": chat_id, "message_id": message_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True,
             "reply_markup": {"inline_keyboard": keyboard or []}}
        try:
            await self.api("editMessageText", p)
        except TelegramError as e:           # "message is not modified" and edits of old messages are harmless
            log.info("edit skipped: %s", e)

    # ---- messages
    async def _message(self, chat_id: int, msg: dict) -> None:
        text = (msg.get("text") or "").strip()
        user = msg.get("from")
        if text.startswith("/"):
            cmd = text.split()[0].split("@")[0].lower()
            if cmd in ("/start", "/new", "/cancel"):
                return await self._start(chat_id, user)
            c = self._chat(chat_id, user)
            if cmd in ("/language", "/lang", "/arabic", "/english"):
                c.lang = {"/arabic": "ar", "/english": "en"}.get(cmd, "en" if c.lang == "ar" else "ar")
                return await self._start(chat_id, user, keep_lang=True)
            if cmd == "/status":
                return await self._status(chat_id)
            return await self._send(chat_id, T[c.lang]["help"])

        c = self._chat(chat_id, user)
        if msg.get("voice") or msg.get("audio"):
            text = await self._voice(chat_id, c, msg.get("voice") or msg.get("audio"))
            if not text:
                return
        if not text:
            return
        if c.step == "done":
            return await self._send(chat_id, T[c.lang]["done"], [[{"text": T[c.lang]["restart"], "callback_data": "new"}]])
        if len(text) < 3:
            return await self._send(chat_id, T[c.lang]["tooShort"])
        await self._freeze_review(chat_id, c)
        c.messages.append(text)
        if c.step == "who" or not c.reporter:
            c.step = "who"
            return await self._send(chat_id, T[c.lang]["whoFirst"], self._who_keyboard(c, with_switch=False))
        await self._review(chat_id, c)

    async def _voice(self, chat_id: int, c: Chat, voice: dict) -> str | None:
        t = T[c.lang]
        if not self.transcribe:
            await self._send(chat_id, t["noVoice"])
            return None
        await self.api("sendChatAction", {"chat_id": chat_id, "action": "typing"})
        try:
            said = await self.transcribe(voice, c.lang)
        except NoVoice:
            await self._send(chat_id, t["noVoice"])
            return None
        except VoiceTooLong:
            await self._send(chat_id, t["voiceLong"])
            return None
        except Exception as e:
            log.warning("voice note not transcribed: %s", type(e).__name__)
            said = None
        if not said:
            await self._send(chat_id, t["voiceFailed"])
            return None
        await self._send(chat_id, f"{t['heard']} <i>«{html.escape(said)}»</i>")
        return said

    async def _start(self, chat_id: int, user: dict | None, keep_lang: bool = False) -> None:
        old = self.chats.get(chat_id)
        if old:
            await self._freeze_review(chat_id, old)
        lang = old.lang if (old and keep_lang) else None
        self.chats.pop(chat_id, None)
        c = self._chat(chat_id, user)
        if lang:
            c.lang = lang
        if old:
            c.last_case = old.last_case
        await self._send(chat_id, T[c.lang]["intro"], self._who_keyboard(c))

    def _who_keyboard(self, c: Chat, with_switch: bool = True) -> list:
        rows = [[{"text": T[c.lang]["reporter"][r], "callback_data": f"who:{r}"}] for r in REPORTERS]
        if with_switch:
            rows.append([{"text": "🌐 " + T[c.lang]["switch"], "callback_data": "lang:" + ("en" if c.lang == "ar" else "ar")}])
        return rows

    async def _status(self, chat_id: int) -> None:
        c = self._chat(chat_id)
        t = T[c.lang]
        if not c.last_case:
            return await self._send(chat_id, t["statusNone"])
        st = self.task_status(c.last_case) or "routine"
        await self._send(chat_id, t["status"](c.last_case, t["st"].get(st, t["st"]["open"])))

    # ---- buttons
    async def _callback(self, chat_id: int, cq: dict) -> None:
        data = cq.get("data") or ""
        mid = cq["message"]["message_id"]
        c = self._chat(chat_id, cq.get("from"))
        notice = None
        if data == "new":
            with contextlib.suppress(TelegramError):   # keep the outcome as it was; just take its button away
                await self.api("editMessageReplyMarkup", {"chat_id": chat_id, "message_id": mid, "reply_markup": {"inline_keyboard": []}})
            await self._start(chat_id, cq.get("from"), keep_lang=True)
        elif data.startswith("lang:"):
            c.lang = "ar" if data == "lang:ar" else "en"
            await self._edit(chat_id, mid, T[c.lang]["intro"], self._who_keyboard(c))
        elif data.startswith("who:") and c.step == "who" and data[4:] in REPORTERS:
            c.reporter = data[4:]
            t = T[c.lang]
            intro = t["intro"] if not c.messages else t["whoFirst"]
            await self._edit(chat_id, mid, f"{intro}\n\n✓ <b>{html.escape(t['reporter'][c.reporter])}</b>")
            if c.messages:                   # they wrote first; read it now
                await self._review(chat_id, c)
            else:
                c.step = "describe"
                await self._send(chat_id, t["askSelf"] if c.reporter == "self" else t["askOther"])
        elif data.startswith("t:") and c.step == "review" and mid == c.review_msg:
            key = data[2:]
            if key in c.ok:
                c.ok[key] = not c.ok[key]
                await self._edit(chat_id, mid, self._review_text(c), self._review_keyboard(c))
            else:
                notice = T[c.lang]["urgentLocked"]
        elif data == "more" and c.step == "review" and mid == c.review_msg:
            await self._freeze_review(chat_id, c)
            c.step = "describe"
            await self._send(chat_id, T[c.lang]["askMore"])
        elif data in ("ok", "retry") and c.step == "review" and mid == c.review_msg:
            await self._confirm(chat_id, c)
        p = {"callback_query_id": cq["id"]}
        if notice:
            p["text"] = notice
        try:
            await self.api("answerCallbackQuery", p)
        except TelegramError:
            pass

    # ---- the read-back
    async def _review(self, chat_id: int, c: Chat) -> None:
        joined = "\n".join(c.messages)
        r = extract_rules(joined)
        c.result, c.step = r, "review"
        c.ok = {}
        for f in r["fields"]:
            if f["kind"] != "red_flag":
                c.ok[f"{f['kind']}:{f['key']}"] = not f["needs_confirmation"]
        if r.get("onset"):
            c.ok["onset"] = True
        for i, _ in enumerate(r["timeline"]):
            c.ok[f"tl:{i}"] = True
        if r["urgent"]:
            await self._send(chat_id, T[c.lang]["urgentNow"])
        sent = await self._send(chat_id, self._review_text(c), self._review_keyboard(c))
        c.review_msg = sent.get("message_id")

    async def _freeze_review(self, chat_id: int, c: Chat) -> None:
        if c.review_msg and c.result is not None:
            await self._edit(chat_id, c.review_msg, self._review_text(c, frozen=True))
        c.review_msg = None

    def _review_text(self, c: Chat, frozen: bool = False) -> str:
        r, L, t = c.result or {}, c.lang, T[c.lang]
        fields = r.get("fields", [])

        def quote(f) -> str:
            ev = next((e for e in f.get("evidence") or [] if e.strip()), "")
            ev = ev if len(ev) <= 70 else ev[:67] + "…"
            return f" <i>«{html.escape(ev)}»</i>" if ev else ""

        def tick(key: str) -> str:
            return "✅" if c.ok.get(key) else "⬜"

        if frozen:
            out = [t["pickedFrozen"]]
        elif not fields and not r.get("onset") and not r.get("timeline"):
            out = [t["pickedNone"]]
        else:
            out = [t["picked"]]
        flags = [f for f in fields if f["kind"] == "red_flag"]
        if flags:
            out.append(f"\n⚠️ <b>{t['urgent']}</b>")
            out += [f"• {html.escape(lbl('red_flag', f['key'], L, f['label']))}{quote(f)}" for f in flags]
        groups = [("domain", t["changed"]), ("confounder", t["affect"])]
        doms = [f for f in fields if f["kind"] == "domain" and (not frozen or c.ok.get(f"domain:{f['key']}"))]
        if doms:
            out.append(f"\n<b>{groups[0][1]}</b>")
            for f in doms:
                k = f"domain:{f['key']}"
                chk = f" ({t['check']})" if f["needs_confirmation"] and not frozen else ""
                out.append(f"{'•' if frozen else tick(k)} {html.escape(lbl('domain', f['key'], L, f['label']))}{chk}{quote(f)}")
        on = r.get("onset")
        if on and (not frozen or c.ok.get("onset")):
            out.append(f"\n<b>{t['started']}</b>")
            out.append(f"{'•' if frozen else tick('onset')} {html.escape(lbl('onset', on['value'], L, on.get('label')))}")
        tl = [(i, x) for i, x in enumerate(r.get("timeline", [])) if not frozen or c.ok.get(f"tl:{i}")]
        if tl:
            out.append(f"\n<b>{t['who']}</b>")
            for i, x in tl:
                act = lbl("activity", x["activity"], L, x.get("activity_label"))
                who = lbl("who", x["who_took_over"], L, x.get("who_label"))
                out.append(f"{'•' if frozen else tick(f'tl:{i}')} {html.escape(act)}: {t['nowDoneBy']} {html.escape(who)}")
        cfs = [f for f in fields if f["kind"] == "confounder" and (not frozen or c.ok.get(f"confounder:{f['key']}"))]
        if cfs:
            out.append(f"\n<b>{groups[1][1]}</b>")
            for f in cfs:
                k = f"confounder:{f['key']}"
                out.append(f"{'•' if frozen else tick(k)} {html.escape(lbl('confounder', f['key'], L, f['label']))}{quote(f)}")
        return "\n".join(out)

    def _review_keyboard(self, c: Chat) -> list:
        r, L, t = c.result or {}, c.lang, T[c.lang]
        rows = []
        for f in r.get("fields", []):
            if f["kind"] != "red_flag":
                k = f"{f['kind']}:{f['key']}"
                rows.append([{"text": f"{'✅' if c.ok.get(k) else '⬜'} {lbl(f['kind'], f['key'], L, f['label'])}", "callback_data": f"t:{k}"}])
        if r.get("onset"):
            rows.append([{"text": f"{'✅' if c.ok.get('onset') else '⬜'} {lbl('onset', r['onset']['value'], L)}", "callback_data": "t:onset"}])
        for i, x in enumerate(r.get("timeline", [])):
            rows.append([{"text": f"{'✅' if c.ok.get(f'tl:{i}') else '⬜'} {lbl('activity', x['activity'], L)} → {lbl('who', x['who_took_over'], L)}",
                          "callback_data": f"t:tl:{i}"}])
        rows.append([{"text": t["right"], "callback_data": "ok"}, {"text": t["addMore"], "callback_data": "more"}])
        return rows

    # ---- confirm and hand over
    def concern_body(self, c: Chat) -> dict:
        r = c.result or {"fields": [], "timeline": [], "onset": None}
        on = r.get("onset")
        tl = [[x["activity"], x["who_took_over"]] for i, x in enumerate(r["timeline"]) if c.ok.get(f"tl:{i}")]
        return {
            "reporter": c.reporter or "family", "lang": r.get("lang", c.lang), "narrative": "\n".join(c.messages)[:4000],
            "domains": [f["key"] for f in r["fields"] if f["kind"] == "domain" and c.ok.get(f"domain:{f['key']}")],
            "onset": on["value"] if on and c.ok.get("onset") else None, "timeline": tl,
            "red_flags": [f["key"] for f in r["fields"] if f["kind"] == "red_flag"],
            "confounders": [f["key"] for f in r["fields"] if f["kind"] == "confounder" and c.ok.get(f"confounder:{f['key']}")],
            "date": self.today(), "channel": "telegram",
        }

    async def _confirm(self, chat_id: int, c: Chat) -> None:
        body = self.concern_body(c)
        try:
            case = await asyncio.to_thread(self.save, body)
        except Exception as e:
            log.exception("concern not saved: %s", type(e).__name__)
            await self._send(chat_id, T[c.lang]["saveFailed"], [[{"text": T[c.lang]["retry"], "callback_data": "retry"}]])
            return
        await self._freeze_review(chat_id, c)
        c.step, c.last_case = "done", case["participant"]["id"]
        await self._send(chat_id, self._outcome_text(c, body, case), [[{"text": T[c.lang]["restart"], "callback_data": "new"}]])

    def _outcome_text(self, c: Chat, body: dict, case: dict) -> str:
        t, level = T[c.lang], (case.get("latest") or {}).get("level")
        days = C.REVIEW_TARGET_DAYS
        if level == "URGENT":
            out = [f"🚨 <b>{t['urgentOutcome']}</b>", t["urgentOutcomeBody"](days["URGENT"])]
        elif level == "CLINICIAN_REVIEW":
            thinking = any(d in C.CONCERN_COGNITIVE_DOMAINS for d in body["domains"])
            acts = {a for a, _ in body["timeline"]}
            reasons = []
            if thinking and len(acts) >= C.CONCERN_REVIEW_MIN_ACTIVITIES:
                reasons.append(t["reasonActs"](len(acts)))
            if thinking and body["reporter"] == "professional":
                reasons.append(t["reasonPro"])
            out = [f"🩺 <b>{t['reviewOutcome'](days['CLINICIAN_REVIEW'])}</b>", t["reviewOutcomeBody"]]
            out += [f"• {r}" for r in reasons]
            out.append(t["reviewOutcomeAfter"])
        else:
            out = [f"🗣 <b>{t['routineOutcome']}</b>", t["routineOutcomeBody"]]
        out += ["", f"{t['reference']}: <code>{case['participant']['id']}</code>", f"<i>{t['stored']}</i>"]
        return "\n".join(out)


# ---------------------------------------------------------------------------------------------------- transport
class TelegramError(Exception):
    pass


def _token() -> str | None:
    return os.getenv("TELEGRAM_BOT_TOKEN") or None


def webhook_secret() -> str:
    """Telegram sends this back on every webhook call, so only Telegram can post updates. Derived from the token
    unless TELEGRAM_WEBHOOK_SECRET is set."""
    s = os.getenv("TELEGRAM_WEBHOOK_SECRET")
    if s:
        return s
    tok = _token() or ""
    return hashlib.sha256(("membrain-webhook:" + tok).encode()).hexdigest()[:48]


_http: dict[str, httpx.AsyncClient] = {}


def _client() -> httpx.AsyncClient:
    if "c" not in _http or _http["c"].is_closed:
        _http["c"] = httpx.AsyncClient(timeout=httpx.Timeout(40.0, connect=10.0))
    return _http["c"]


async def call(method: str, params: dict | None = None, timeout: float | None = None) -> dict:
    tok = _token()
    if not tok:
        raise TelegramError("TELEGRAM_BOT_TOKEN is not set")
    try:
        r = await _client().post(f"https://api.telegram.org/bot{tok}/{method}", json=params or {},
                                 **({"timeout": timeout} if timeout else {}))
        data = r.json()
    except (httpx.HTTPError, ValueError) as e:
        raise TelegramError(f"{method}: {type(e).__name__}") from None   # never echo the URL: it carries the token
    if not data.get("ok"):
        raise TelegramError(f"{method}: {data.get('description', 'failed')}")
    return data.get("result") or {}


MAX_VOICE_SECONDS = 60


async def transcribe(voice: dict, lang: str) -> str | None:
    """A voice note -> text. The self-hosted Gulf Whisper model when it is configured, otherwise Azure Speech's
    short-audio API (Telegram voice notes are Ogg/Opus, which it accepts). Audio is handled in memory, never kept."""
    whisper, azure_key = os.getenv("WHISPER_MODEL"), os.getenv("AZURE_SPEECH_KEY")
    if not whisper and not azure_key:
        raise NoVoice()
    if (voice.get("duration") or 0) > MAX_VOICE_SECONDS:
        raise VoiceTooLong()
    f = await call("getFile", {"file_id": voice["file_id"]})
    r = await _client().get(f"https://api.telegram.org/file/bot{_token()}/{f['file_path']}")
    if r.status_code != 200:
        return None
    audio = r.content
    if whisper:
        from api.asr_local import _model, decode
        pcm = await asyncio.to_thread(decode, audio)
        segs, _ = await asyncio.to_thread(_model().transcribe, pcm, language=lang, task="transcribe", beam_size=1, vad_filter=True)
        return " ".join(s.text.strip() for s in segs).strip() or None
    region = os.getenv("AZURE_SPEECH_REGION", "uaenorth")
    locale = "ar-AE" if lang == "ar" else "en-GB"
    r = await _client().post(
        f"https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1",
        params={"language": locale, "format": "simple"}, content=audio,
        headers={"Ocp-Apim-Subscription-Key": azure_key, "Content-Type": "audio/ogg; codecs=opus"})
    if r.status_code != 200:
        log.warning("Azure speech returned %s", r.status_code)
        return None
    d = r.json()
    return (d.get("DisplayText") or "").strip() if d.get("RecognitionStatus") == "Success" else None


BOT = Bot(api=call, transcribe=transcribe)


async def _handle_safely(update: dict) -> None:
    try:
        await BOT.handle(update)
    except Exception:
        log.exception("telegram update %s failed", update.get("update_id"))


@router.post("/webhook", include_in_schema=False)
async def webhook(request: Request, background: BackgroundTasks,
                  x_telegram_bot_api_secret_token: str | None = Header(None)):
    if not _token():
        raise HTTPException(404)
    if x_telegram_bot_api_secret_token != webhook_secret():
        raise HTTPException(403)
    background.add_task(_handle_safely, await request.json())   # answer Telegram at once; work after
    return {"ok": True}


@router.get("/status")
def telegram_status():
    """Whether the bot is configured on this server (never shows the token)."""
    return {"configured": bool(_token()), "mode": _mode(), "voice": bool(os.getenv("WHISPER_MODEL") or os.getenv("AZURE_SPEECH_KEY"))}


def _mode() -> str | None:
    if not _token():
        return None
    return "webhook" if os.getenv("TELEGRAM_WEBHOOK_URL") else "polling"


COMMANDS = {
    "en": [("new", "Raise a new concern"), ("language", "عربي / English"), ("status", "What happened to my last concern"), ("help", "How this works")],
    "ar": [("new", "بلاغ جديد"), ("language", "English / عربي"), ("status", "ماذا حدث لآخر بلاغ"), ("help", "كيف يعمل")],
}


async def _setup_profile() -> None:
    for lang, cmds in COMMANDS.items():
        p = {"commands": [{"command": c, "description": d} for c, d in cmds]}
        if lang == "ar":
            p["language_code"] = "ar"
        await call("setMyCommands", p)
    await call("setMyDescription", {"description": "MemBrain helps families describe a change in memory or thinking, in Arabic or English, "
                                                   "so a clinician can review it. It does not diagnose. In an emergency, call 998."})
    await call("setMyShortDescription", {"short_description": "Describe a change in memory or thinking. A clinician reviews every case."})


async def _poll(stop: asyncio.Event) -> None:
    await call("deleteWebhook", {"drop_pending_updates": False})
    offset = None
    while not stop.is_set():
        try:
            updates = await call("getUpdates", {"timeout": 25, "offset": offset, "allowed_updates": ["message", "callback_query"]}, timeout=35)
        except TelegramError as e:
            log.warning("telegram polling: %s", e)
            await asyncio.sleep(3)
            continue
        for u in updates or []:
            offset = u["update_id"] + 1
            asyncio.create_task(_handle_safely(u))


@contextlib.asynccontextmanager
async def running():
    """Start the bot with the API: register the webhook, or poll when there is no public URL. No token, no bot."""
    mode, stop, task = _mode(), asyncio.Event(), None
    try:
        if mode:
            try:
                await _setup_profile()
                if mode == "webhook":
                    await call("setWebhook", {"url": os.environ["TELEGRAM_WEBHOOK_URL"], "secret_token": webhook_secret(),
                                              "allowed_updates": ["message", "callback_query"]})
                else:
                    task = asyncio.create_task(_poll(stop))
                me = await call("getMe")
                log.warning("Telegram bot @%s running (%s)", me.get("username"), mode)
            except TelegramError as e:
                log.error("Telegram bot not started: %s", e)
        yield
    finally:
        stop.set()
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await task
        if "c" in _http:
            await _http.pop("c").aclose()


if __name__ == "__main__":
    # python -m api.telegram whoami | webhook-info   (reads TELEGRAM_BOT_TOKEN from the environment)
    async def _cli(cmd: str):
        if cmd == "whoami":
            print(await call("getMe"))
        elif cmd == "webhook-info":
            info = await call("getWebhookInfo")
            print({k: v for k, v in info.items() if k != "url"} | {"url": info.get("url", "")})
        else:
            print(__doc__)
    asyncio.run(_cli(sys.argv[1] if len(sys.argv) > 1 else "help"))
