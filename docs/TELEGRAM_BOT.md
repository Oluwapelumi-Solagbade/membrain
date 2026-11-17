# MemBrain on Telegram

The bot is the website's "Raise a concern" chat (`/concern/`), on Telegram, in English and Modern Standard Arabic (people can write to it in any dialect). A family member, a helper, a doctor or the person themselves describes a change in memory or thinking. MemBrain reads it back with the words each fact came from. They untick anything wrong, and the confirmed concern goes to the same triage as the website (`POST /concerns`). It lands in the clinician queue at `/clinician/`.

Code: [`api/telegram.py`](../api/telegram.py). Tests: [`tests/test_telegram.py`](../tests/test_telegram.py).

## The conversation

1. **/start**: a short introduction, then "who noticed the change?" with five buttons (myself, family, helper, doctor or nurse, programme coordinator) and a language switch. A phone set to Arabic starts in Arabic.
2. **The concern in their own words.** They type it or send a voice note. A voice note is turned into text, shown back as "I heard: …", then read like typed text.
3. **The read-back.** The intake extractor (`membrain/intake.py`, the same rules as the website) lists:
   - what has changed;
   - when it started;
   - who now does what;
   - things that can affect memory.

   Each fact quotes the words it came from, and each has a ✅/⬜ button to untick it. Possible urgent signs come first, in a separate message that says to call 998. Urgent signs cannot be unticked, because a clinician checks them.
4. **That's right** sends it on. **Add more detail** lets them write more, and everything is read together.
5. **The outcome.** One of three, decided by the triage engine on the server:
   - get help now (urgent: 998, clinician follow-up within 3 days);
   - clinician review within 21 days, with the reason;
   - the spoken check-in as the next step.

   They also get a reference number.
6. **Reporting again.** If the same chat reports again later, the bot asks whether it is about the same person as the earlier reference. If yes, it is added to that record as a dated follow-up (`POST /participants/{id}/concerns` does the same on the website). The triage engine compares it with everything reported before: a newly reported memory or thinking change, or an activity newly taken over by someone else, goes to clinician review; nothing new keeps the earlier level and does not open a second review.

Commands: `/new` (start again), `/language` (Arabic or English), `/status` (whether a clinician has picked up the last concern), `/help`. The bot only talks in private chats and ignores groups.

**What is stored:** only what the person confirmed, under a pseudonymous `MB-C…` reference, with `channel: "telegram"`. No name, phone number or Telegram ID is stored with the concern. The bot's own conversation state (chat → language, step, last reference) is in memory, like the rest of the demo API, and goes when the app restarts.

## Set it up

### 1. Create the bot (once, in Telegram)
1. Open a chat with **@BotFather** and send `/newbot`.
2. Give it a name (`MemBrain`) and a username ending in `bot` (for example `membrain_uae_bot`).
3. BotFather replies with a **token**. Treat it like a password: it controls the bot. Don't paste it in chat or commit it.
4. Optional, in BotFather: `/setuserpic` with `site/public/brand/` artwork.

The bot sets its own command menu (English and Arabic) and description when the API starts.

### 2. Run it locally
Put the token in `.env` at the repository root (git-ignored), then start the API:

```bash
echo 'TELEGRAM_BOT_TOKEN=paste-your-token-here' >> .env
```

```bash
uv run --no-project --with-requirements requirements.txt uvicorn api.main:app --port 8010
```

The log shows `Telegram bot @<username> running (polling)`. Message the bot on your phone. The concern then appears in the clinician view of the same server (`http://localhost:8010/clinician/`, or the dev site at `http://localhost:3100/clinician/?api=http://localhost:8010`).

Locally there is no public URL, so the API polls Telegram. Polling clears any webhook, so use a **separate test bot** for local work if the deployed bot is live.

### 3. Deploy (Azure)
Both deploy scripts, `scripts/deploy_containerapp.sh` (Container Apps, which works on the Free Trial) and `scripts/deploy_azure.sh` (App Service), now ask for the Telegram token after the Speech key, at a hidden prompt (press Enter to skip). It sets:

| App setting | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | the token |
| `TELEGRAM_WEBHOOK_URL` | `https://<app address>/telegram/webhook` |

When `TELEGRAM_WEBHOOK_URL` is set, the API registers the webhook at startup instead of polling. Telegram signs every webhook call with a secret derived from the token (or `TELEGRAM_WEBHOOK_SECRET` if you set one). Calls without it get 403.

Both scripts print the result at the end; to check later:

```bash
curl -s https://<app address>/telegram/status
```

It should say `{"configured":true,"mode":"webhook",...}`. It never shows the token.

### Voice notes
Voice notes work when the server has speech recognition. Without it, the bot asks the person to type instead.
- the self-hosted Gulf Arabic Whisper model (`WHISPER_MODEL`) when it is set; otherwise
- Azure Speech (`AZURE_SPEECH_KEY`, region `uaenorth`, Arabic `ar-AE`, English `en-GB`). This uses its short-audio API, which takes up to 60 seconds, the voice-note limit here.

Audio is handled in memory and never written to disk or kept.

## Limits (demo)
- State is in memory: a restart forgets conversations and the demo cases, as with the rest of the API. A pilot needs the persistent store.
- One process: run a single worker or replica. Polling with two would answer every message twice, and each replica has its own in-memory cases. On Container Apps, `az containerapp update --name membrain --resource-group membrain-rg --min-replicas 1 --max-replicas 1` keeps one copy running.
- The Arabic needs native-speaker review before any pilot, as the rest of MemBrain's Arabic does.
- Telegram is a third-party service: messages pass through Telegram's servers before reaching the in-country API. That is a data-residency question for the pilot's governance review, separate from where MemBrain stores the record.
