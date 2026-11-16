"""The Telegram bot, driven through a fake Telegram API: the conversation, the hand-over to the same code as
POST /concerns, and the webhook's secret check."""
import asyncio

import pytest
from fastapi.testclient import TestClient

import api.telegram as TG
from api.main import DB, app
from api.telegram import Bot, NoVoice

CHAT = 4242


class FakeTelegram:
    def __init__(self):
        self.calls, self._id = [], 100

    async def __call__(self, method, params):
        self.calls.append((method, params))
        self._id += 1
        return {"message_id": self._id} if method == "sendMessage" else {}

    def sent(self):
        return [p for m, p in self.calls if m == "sendMessage"]

    def last(self):
        return self.sent()[-1]

    def buttons(self, params=None):
        p = params or self.last()
        return [b for row in p.get("reply_markup", {}).get("inline_keyboard", []) for b in row]


def run(bot, update):
    asyncio.run(bot.handle(update))


def text(t, chat=CHAT, lang="en", chat_type="private"):
    return {"message": {"chat": {"id": chat, "type": chat_type}, "from": {"id": 1, "language_code": lang}, "text": t}}


def press(data, message_id, chat=CHAT):
    return {"callback_query": {"id": "cq", "data": data, "from": {"id": 1}, "message": {"chat": {"id": chat}, "message_id": message_id}}}


def make_bot(**kw):
    tg = FakeTelegram()
    bot = Bot(api=tg, today=lambda: "2026-11-16", **kw)
    return bot, tg


def review_id(bot):
    return bot.chats[CHAT].review_msg


def test_start_offers_who_noticed_and_a_language_switch():
    bot, tg = make_bot()
    run(bot, text("/start"))
    data = [b["callback_data"] for b in tg.buttons()]
    assert data == ["who:self", "who:family", "who:helper", "who:professional", "who:coordinator", "lang:ar"]
    assert "I don't diagnose" in tg.last()["text"]


def test_arabic_phone_starts_in_arabic():
    bot, tg = make_bot()
    run(bot, text("/start", lang="ar-AE"))
    assert "أنا لا أشخّص" in tg.last()["text"]
    assert tg.buttons()[-1]["callback_data"] == "lang:en"


def test_family_concern_reaches_the_clinician_queue():
    bot, tg = make_bot()
    run(bot, text("/start"))
    run(bot, press("who:family", 101))
    assert "what have you noticed?" in tg.last()["text"]
    run(bot, text("For the last few months my father keeps forgetting things and repeats the same question. "
                  "My brother now pays his bills."))
    rv = tg.last()
    assert "Here is what I picked out" in rv["text"] and "Memory" in rv["text"]
    data = [b["callback_data"] for b in tg.buttons(rv)]
    assert "t:domain:memory" in data and "ok" in data and "more" in data
    run(bot, press("ok", review_id(bot)))
    out = tg.last()["text"]
    assert "A clinician will review this within 21 days" in out
    assert "An everyday activity is now done by someone else" in out
    pid = bot.chats[CHAT].last_case
    p = DB["participants"][pid]
    assert p["entry_route"] == "family" and p["sessions"][0]["channel"] == "telegram"
    assert any(t["participant_id"] == pid and t["level"] == "CLINICIAN_REVIEW" for t in DB["tasks"].values())
    run(bot, text("/status"))
    assert pid in tg.last()["text"] and "waiting for a clinician" in tg.last()["text"]


def test_red_flags_warn_first_and_cannot_be_unticked():
    bot, tg = make_bot()
    run(bot, text("/start", lang="ar"))
    run(bot, press("who:family", 101))
    run(bot, text("أبوي طاح أمس في الحمام وضرب راسه، ومن يومها نعسان ومتلخبط وكلامه ثقيل."))
    msgs = tg.sent()
    assert "٩٩٨" in msgs[-2]["text"]                                  # the urgent warning comes before the read-back
    assert not any(b["callback_data"].startswith("t:red_flag") for b in tg.buttons())
    run(bot, press("t:red_flag:recent_fall_head_injury", review_id(bot)))
    answer = [p for m, p in tg.calls if m == "answerCallbackQuery"][-1]
    assert "الطبيب" in answer["text"]                                 # told why it stays
    run(bot, press("ok", review_id(bot)))
    assert "يُرجى طلب المساعدة الآن" in tg.last()["text"]
    assert DB["participants"][bot.chats[CHAT].last_case]["intake"]["confirmed"]["red_flags"]


def test_unticking_a_fact_keeps_it_out_of_the_record():
    bot, tg = make_bot()
    run(bot, text("/start"))
    run(bot, press("who:self", 101))
    run(bot, text("For the last few months I keep forgetting appointments. My wife now pays our bills."))
    for b in tg.buttons():
        if b["callback_data"].startswith("t:domain:"):
            run(bot, press(b["callback_data"], review_id(bot)))
    body = bot.concern_body(bot.chats[CHAT])
    assert body["domains"] == [] and body["timeline"]
    run(bot, press("ok", review_id(bot)))
    assert "Next step: a short spoken check-in" in tg.last()["text"]  # no cognitive change confirmed: no early review


def test_writing_before_choosing_asks_who_then_reads_it():
    bot, tg = make_bot()
    run(bot, text("My mum keeps forgetting things lately and my sister now handles her medicines."))
    assert "who noticed the change" in tg.last()["text"]
    assert not any(b["callback_data"].startswith("lang:") for b in tg.buttons())
    run(bot, press("who:family", 101))
    assert "Here is what I picked out" in tg.last()["text"]


def test_adding_more_reads_everything_together_and_freezes_the_old_read_back():
    bot, tg = make_bot()
    run(bot, text("/start"))
    run(bot, press("who:family", 101))
    run(bot, text("He keeps forgetting things."))
    first = review_id(bot)
    run(bot, press("more", first))
    assert "Add whatever you'd like" in tg.last()["text"]
    edits = [p for m, p in tg.calls if m == "editMessageText" and p["message_id"] == first]
    assert edits and edits[-1]["reply_markup"] == {"inline_keyboard": []}
    run(bot, text("His son now drives him everywhere since he got lost."))
    assert len(bot.chats[CHAT].messages) == 2 and review_id(bot) != first
    run(bot, press("ok", first))                                      # an old read-back's button does nothing
    assert bot.chats[CHAT].step == "review"


def test_voice_notes():
    bot, tg = make_bot()
    run(bot, text("/start"))
    run(bot, press("who:family", 101))
    voice = {"message": {"chat": {"id": CHAT, "type": "private"}, "from": {"id": 1}, "voice": {"file_id": "f", "duration": 9}}}
    run(bot, voice)
    assert "Voice notes aren't switched on" in tg.last()["text"]

    async def off(v, lang):
        raise NoVoice()

    bot.transcribe = off
    run(bot, voice)
    assert "Voice notes aren't switched on" in tg.last()["text"]

    async def heard(v, lang):
        return "She keeps forgetting things and my daughter now does her shopping."

    bot.transcribe = heard
    run(bot, voice)
    sent = tg.sent()
    assert "I heard:" in sent[-2]["text"] and "Here is what I picked out" in sent[-1]["text"]


def test_group_chats_are_ignored():
    bot, tg = make_bot()
    run(bot, text("/start", chat_type="group"))
    assert tg.calls == []


def test_language_command_switches():
    bot, tg = make_bot()
    run(bot, text("/start"))
    run(bot, text("/language"))
    assert "مرحبًا" in tg.last()["text"]
    run(bot, press("lang:en", 102))
    edit = [p for m, p in tg.calls if m == "editMessageText"][-1]
    assert edit["text"].startswith("Hello") and bot.chats[CHAT].lang == "en"


def test_webhook_checks_the_secret(monkeypatch):
    c = TestClient(app)
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    assert c.post("/telegram/webhook", json={}).status_code == 404       # no bot configured
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123:test")
    seen = []

    async def handle(u):
        seen.append(u)

    monkeypatch.setattr(TG.BOT, "handle", handle)
    assert c.post("/telegram/webhook", json={"update_id": 1}).status_code == 403
    assert c.post("/telegram/webhook", json={"update_id": 1}, headers={"X-Telegram-Bot-Api-Secret-Token": "nope"}).status_code == 403
    r = c.post("/telegram/webhook", json={"update_id": 2}, headers={"X-Telegram-Bot-Api-Secret-Token": TG.webhook_secret()})
    assert r.status_code == 200 and seen == [{"update_id": 2}]
    s = c.get("/telegram/status").json()
    assert s["configured"] and "123:test" not in str(s)


@pytest.fixture(autouse=True)
def _fresh():
    from api.main import _seed
    _seed()
    yield
