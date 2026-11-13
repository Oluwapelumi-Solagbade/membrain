# MemBrain: protecting brain health earlier

**Team Cerebro Spark** · Future Health Digital Innovation Challenge · Population Health, Challenge 08

MemBrain is a bilingual (Arabic dialects and English), voice-first cognitive and functional check-in for adults aged 50–75. People are enrolled through a health programme or clinic. MemBrain builds a personal baseline, separates meaningful change from normal variation using practice-adjusted reliable-change statistics, and adds mood, sleep, metabolic, lifestyle, family-history and (optionally) genomic context with consent for each data type. Anything abnormal, fast-changing or high-risk goes to a clinician before any conclusion reaches the person.

> **MemBrain identifies risk and change. It never diagnoses.** All data in this repository is synthetic.

## What works today

| Component | Where | Status |
|---|---|---|
| Scoring engine: transcript scoring (AR/EN), education- and age-stratified norms | `membrain/scoring.py` | Working, tested |
| Change detection: multi-session baseline, practice-adjusted RCI, exploratory EWMA | `membrain/change.py` | Working, tested |
| Triage: 4 levels, confounder rules, alert fusion, explanations | `membrain/triage.py` | Working, tested |
| Item bank: 3 equated alternate forms of original RUDAS-type tasks | `membrain/items.py` | Draft; needs native-speaker review |
| Prevention engine + plain-language messages (AR/EN) | `membrain/prevention.py` | Working |
| FHIR R4 mapping (Patient, Consent, Observation, RiskAssessment, Task) | `membrain/fhir.py` | Validated against `fhir.resources` R4B |
| Synthetic cohort + all requirement-6 metrics, by subgroup | `membrain/simulate.py`, `membrain/validation.py` | Working |
| REST API with role checks and audit log | `api/main.py` | Working (in-memory store) |
| Web prototype: participant app, clinician dashboard, validation, architecture | `web/` | Working; also published as a hosted demo |
| Python/JavaScript parity (87 golden cases, 457 session evaluations, 0 mismatches) | `web/parity_test.js` | Passing |

## Quick start

```bash
pip install -r requirements.txt
make test          # 23 Python tests + JS parity check
make web           # regenerate golden vectors, validation run, and web/dist/index.html
make api           # http://localhost:8000/docs
```

Open `web/dist/index.html` in Chrome for the full demo. Opened locally, the microphone, live speech recognition and on-device voice features all work. The hosted preview blocks the microphone, so there you type answers or use the sample answers.

## Repository map

```
membrain/      engine (config, items, scoring, change, triage, prevention, fhir, dossier, simulate, validation, personas)
api/           FastAPI service
web/           engine.js (port of the engine), app.js (UI), index.html, build -> dist/index.html
tests/         pytest suite + golden_vectors.json
scripts/       export_golden.py, export_web_data.py, build_web.py, quick_val.py
docs/          technical documentation, assumptions and limitations, data sources, team plan, demo script
```

## Key documents

- [Technical documentation](docs/TECHNICAL_DOCUMENTATION.md)
- [Assumptions and limitations](docs/ASSUMPTIONS_LIMITATIONS.md)
- [Data sources plan](docs/DATA_SOURCES.md)
- [Team plan to 20 November](docs/TEAM_PLAN.md)
- [Demo video script](docs/DEMO_SCRIPT.md)
