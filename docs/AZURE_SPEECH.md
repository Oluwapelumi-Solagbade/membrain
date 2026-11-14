# Azure AI Speech (UAE North) integration

Original guide: Abdulwaliy. Reviewed and implemented on 14 November. This file replaces the earlier `docs/AZURE_SPEECH_README.md`.

## What is implemented

| Part | File |
|---|---|
| Token broker: the key stays on the server, the browser gets a ~10-minute token; rate limit and token caching | `api/speech.py` |
| `GET /api/speech/config` (enabled, region, dialect → locale map) and `GET /api/speech/token` | `api/speech.py` |
| Browser streaming to `uaenorth`: one microphone stream is shared by Azure transcription and the on-device acoustic features | `web/app.js` (`Rec`, `initSpeech`) |
| Automatic fallback: Azure → browser recognition → typed or sample answers. The active engine is shown to the user and saved with each session. | `web/app.js` |
| Speech SDK 1.53.0 (MIT, redistributable) served from our own App Service, with a pinned CDN fallback | `web/vendor/` |
| Deployment of the API and web app to App Service in UAE North | `scripts/deploy_azure.sh`, `docs/DEPLOY_AZURE.md` |
| Tests: disabled without a key; token brokered; key never returned; rate limit | `tests/test_speech.py` |

## Dialect → locale

| Participant dialect | Locale |
|---|---|
| Emirati, other Arabic | `ar-AE` |
| Other Gulf | `ar-SA` |
| Egyptian | `ar-EG` |
| Levantine | `ar-LB` |
| English | `en-GB` |

Check every locale against Azure's current speech-to-text language list before the pilot.

## Corrections to the original guide (do not reuse these claims)

1. **Error-rate figures (14.1%, 15.4% and 34.8% WER) are removed.** No source was given. We will report our own error rate per dialect, age and education group, measured on consented recordings. Until then, we make no accuracy claim.
2. **Law citation.** As far as we know, Federal Law No. 4 of 2016 concerns medical liability. The health-data localisation law is Federal Law No. 2 of 2019 on the use of ICT in health fields. Confirm with the partner's legal team before citing either.
3. **"Zero hallucinations" is removed.** All speech recognition makes errors. Our scoring tolerates them (normalised matching, a lexicon, human audit of a sample of transcripts).
4. **"Audio never leaves Dubai" must be backed by Microsoft's own data-residency and retention statement for the Speech service.** Cite that page, and confirm logging and data collection are turned off on the resource.
5. **`ar-XA` is removed.** It is not used for speech-to-text.
6. **Free-tier limits** (hours per month, concurrent streams) and prices change. Check Azure's pricing page on the day we cite them.

## Key handling

- The key exists **only** as an App Service application setting, or in a local `.env` file that git ignores. It is never put in the repo, the web page, WhatsApp or a document.
- The key has already been shared in chat. Before deploying, **use Key 2 and regenerate Key 1**: Azure portal → the Speech resource → Keys and Endpoint → Regenerate Key 1.
