# MemBrain — Azure CLI Task & Integration Record

**Contributor:** Abdulwaliy Oyekunle   
**Branch:** `Abdulwaliy_membrain`  
**Target:** Microsoft Azure AI Speech (UAE North - Dubai) Integration & Deliverable 7 Deployment  
**Timestamp:** November 14–15, 2026  

---

## 1. Executive Summary

Since initiating the Azure CLI task, the repository was reconciled with upstream developments (`origin/main`), live Azure authentication was established, Key 2 was integrated and verified against the Dubai (`uaenorth`) Cognitive Services datacenter, automated test suites achieved 100% pass rates, and deployment automation scripts for Windows and Linux were authored, tested, and pushed to GitHub.

---

## 2. Azure CLI Installation & Device Authentication

1. **Binary Detection & Environment Setup:**
   - Azure CLI `v2.92.0` was installed via Windows MSI.
   - Identified binary path at `C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\wbin\az.cmd`.
   - Verified that the installer properly configured the Windows System `PATH`.

2. **Interactive OAuth Device Sign-In:**
   - Initiated non-interactive background authentication via `az login --use-device-code`.
   - Signed in with the device-code flow.
   - Authenticated subscription details:
     - **User:** team Azure account (redacted)
     - **Tenant ID:** (redacted) (`Default Directory`)
     - **Subscription:** `Azure subscription 1` (redacted)
     - **Account State:** `Enabled`

---

## 3. Credential Security & Live STS Verification

1. **Key Migration & Protection:**
   - Switched from exposed Key 1 to **Key 2** (`[REDACTED_AZURE_KEY_2]`).
   - Stored Key 2 strictly within local `.env`.
   - Enforced `.gitignore` policies ensuring `.env` is never staged or committed.
   - Advised user to click **Regenerate Key 1** in Azure Portal to revoke the exposed key.

2. **Live UAE North Cognitive Services Verification:**
   - Probed the STS token endpoint at `https://uaenorth.api.cognitive.microsoft.com/sts/v1.0/issueToken` with Key 2.
   - Received **HTTP 200 OK** and a valid 774-character ephemeral JWT token valid for 600 seconds.
   - Probed the local FastAPI token broker endpoint (`/api/speech/token` and `/api/speech/config`):
     - Confirmed `enabled: true`, region `uaenorth`.
     - Confirmed dialect locale mappings:
       - Emirati / Other Arabic &rarr; `ar-AE`
       - Gulf &rarr; `ar-SA`
       - Egyptian &rarr; `ar-EG`
       - Levantine &rarr; `ar-LB`
       - English &rarr; `en-GB`

---

## 4. Upstream Synchronization & Conflict Resolution

Branch `Abdulwaliy_membrain` was merged with `origin/main` to combine Deliverable 7 with the team's Navigator layer, referral management, and identity vault:

| File | Nature of Conflict | Resolution Applied |
| :--- | :--- | :--- |
| `.env.example` | Key documentation format | Merged comments explaining both local `.env` and App Service application settings. |
| `.gitignore` | Ignore rules | Preserved `.env`, added `*.msi` and `DEPLOY_AZURE.md`. |
| `api/main.py` | Import collisions | Preserved `import pathlib` to mount `_DIST` static files and merged the `speech_router`. |
| `scripts/build_web.py` | Encoding and asset copying | Maintained Windows UTF-8 fix (`encoding="utf-8"`) and added Speech SDK vendor copying. |
| `tests/test_api.py` | Test suite overlap | Combined speech token tests with identity vault and consent tests. |
| `web/app.js` | Frontend audio recording | Adopted `origin/main`'s unified `Rec` object with continuous Azure Speech recognition and browser fallback. |
| `web/dist/index.html` | Generated artifact | Rebuilt cleanly using `scripts/build_web.py` (479 KB). |

---

## 5. Automated Verification & Parity Testing

Before staging commits, the entire validation pipeline was executed:

1. **Python Unit & Integration Tests (`pytest`):**
   - **46 / 46 passed (100%)**
   - Tests covered:
     - `tests/test_api.py` (9 tests)
     - `tests/test_engine.py` (20 tests)
     - `tests/test_navigator.py` (7 tests)
     - `tests/test_speech.py` (4 tests)
     - `tests/test_voice_and_asr.py` (6 tests)
2. **JavaScript Parity Verification (`node web/parity_test.js`):**
   - **90 test cases, 461 session evaluations, 0 mismatches**.
   - Verified that client-side JS scoring engine matches Python reference implementation identically across all persona trajectories.

---

## 6. Deployment Automation & Quota Diagnostics

1. **Authored Deployment Scripts:**
   - Created native Windows PowerShell deployment script: [`scripts/deploy_azure.ps1`](scripts/deploy_azure.ps1).
   - Validated bash script: [`scripts/deploy_azure.sh`](scripts/deploy_azure.sh).
   - Created [`.azureignore`](.azureignore) to exclude `.git`, `.venv`, installer `.msi`, and `.pdf` files from upload packages.
   - Updated [`requirements.txt`](requirements.txt) to include `python-dotenv>=1.0` and `scipy>=1.11` to prevent deployment build failures.

2. **Azure App Service Quota Diagnostics:**
   - Attempted deployment via `az webapp up` to `membrain-cerebrospark` in `uaenorth`.
   - **Diagnostic Result:** Azure CLI reported:
     ```text
     ERROR: Operation cannot be completed without additional quota.
     Current Limit (B1 App Service instances): 0, Amount required: 1.
     ```
   - **Root Cause:** The subscription policy is `FreeTrial_2014-09-01` with `spendingLimit: "On"`. In Azure Free Trial accounts, Microsoft restricts App Service instance compute quota to `0` in `uaenorth` until upgraded or requested.
   - **Speech Service Independence:** The Speech Service (`membrain-speech-dubai`) in `uaenorth` is **NOT** affected by this quota; it remains active, operational, and free.

---

## 7. How the System Operates Online

| Deployment Target | Hosting Cost | Arabic Speech Recognition | Acoustic DSP Features | Longitudinal Engine & Navigator |
| :--- | :---: | :---: | :---: | :---: |
| **GitHub Pages** (Standalone) | **$0 / Free** | In-Browser Web Speech API (`ar-AE` / `en-GB`) | Yes (Web Audio API) | Full (Client-side JS) |
| **Free Cloud Proxy** (Render / Worker) | **$0 / Free** | **Azure AI Speech Dubai (`uaenorth`)** | Yes (Web Audio API) | Full |
| **Local / Presentation Tunnel** | **$0 / Free** | **Azure AI Speech Dubai (`uaenorth`)** | Yes (Web Audio API) | Full |
| **Azure App Service Direct** | Free Credits | **Azure AI Speech Dubai (`uaenorth`)** | Yes (Web Audio API) | Full |

### How to Run Locally Right Now:
```powershell
python -m uvicorn api.main:app --port 8000
```
Open `http://localhost:8000` in Chrome to test live streaming to Azure Dubai.

---

## 8. Git Commit Log (Branch `Abdulwaliy_membrain`)

- `1fbdf77` — `chore: add .azureignore for lean Azure deployment package`
- `48282fe` — `fix(deps): add python-dotenv and scipy to requirements.txt for Azure build`
- `5af89df` — `feat(deploy): add PowerShell Azure deployment script for Windows`
- `6908b88` — `Merge origin/main into Abdulwaliy_membrain: integrate Azure Speech Dubai, Navigator, and voice DSP`
- `9cb64e1` — `feat(speech): integrate Microsoft Azure Speech Dubai (uaenorth) streaming & token proxy`
- `3e84d73` — `docs: add Microsoft Azure Speech Dubai integration guide and update repo map`
- `17204a9` — `feat(voice-asr): add openSMILE/Praat feature spec, on-device VAD design, and Arabic ASR dialect benchmark`

All commits have been pushed and verified on GitHub remote [`origin/Abdulwaliy_membrain`](https://github.com/Oluwapelumi-Solagbade/membrain/tree/Abdulwaliy_membrain).
