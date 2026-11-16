# MemBrain: technical documentation

Version: engine 0.4.0 · navigator nav-0.1.0 · norms synthetic-2026.11 · item bank ib-0.2.0 · Team Cerebro Spark

## 1. Problem and scope

Cognitive change in mid-to-late life is gradual and easily put down to ageing. One-off scores are distorted by language, education, culture, hearing, vision, mood and unfamiliarity with digital tools. The context that would explain a change (metabolic, sleep, mood, family history, wearables) sits in separate systems. MemBrain is the longitudinal front end that brings these together for a health programme or clinic (for example the IFHAS screening programme, Healthy Longevity Medicine Centres, or primary care networks). It flags risk and change and routes the person to the right care. It does not diagnose.

## 2. System overview

```
Participant app (voice-first, AR/EN, offline queue)   Caregiver mode   Clinician dashboard
          │                                                                   ▲
          ▼                                                                   │
Assessment & speech: item bank + form scheduler · audio quality gate · ASR · feature extraction
          │
          ▼
Analytics: stratified norms → personal baseline → practice-adjusted RCI → confounder rules → alert fusion + explanation
          │                                         │
          ▼                                         ▼
Clinical workflow: Task queue · actions · referral dossier · clinician-approved messages     Prevention engine (versioned rules)
          │
          ▼
Data & trust layer (in-country): FHIR R4 store · per-signal Consent · identity vault · OAuth2/SMART · audit log · KMS
```

The prototype implements the analytics, workflow, prevention, FHIR mapping and validation layers end to end. It also includes a working participant app and clinician dashboard. Persistence is in memory. The pilot replaces it with PostgreSQL and a HAPI FHIR or managed FHIR store in an in-country region.

**Enrolment.** A coordinator or clinician enrols the person in 6 steps:
1. Identity, stored only in the separate identity vault.
2. Profile: years of schooling map to a norm group; dialect; sensory aids; comfort with phones.
3. Consent for each of 8 data types, read aloud in Arabic or English.
4. Informant, with an optional IQCODE-16.
5. Health context and known conditions.
6. Session plan (baseline 1 today, baseline 2 at 2 weeks, follow-up at 12 weeks, then every 6 months).

Clinicians can re-identify someone for follow-up only by giving a reason, and every re-identification is audited. Withdrawing consent removes the affected data downstream. On-device versus cloud responsibilities are set out in `ARCHITECTURE_DEVICE_CLOUD.md`.

## 3. Assessment (requirement 1)

**Tasks.** These are original items covering RUDAS-type domains. They are not copies of licensed instruments, so the prototype has no licensing blocker.

| Domain | Task | Score | Scored from |
|---|---|---|---|
| Word learning | 10 culturally familiar words, repeated back | 0–10 | ASR transcript, normalised matching |
| Delayed recall | Same words after ~5 minutes | 0–10 | ASR transcript |
| Fluency | Animals / fruits and vegetables / market items, 60 s | 0–30 | Lexicon-validated unique words; others go to human audit |
| Story recall | Local short story, 12 idea units | 0–12 | Keyword-unit matching |
| Everyday judgement | Smoke in kitchen / lost in mall / phone scam | 0–4 | Rubric elements, clinician-audited sample |

**Alternate forms.** There are three forms (A, B, C), assigned in a Latin-square rotation per participant to limit practice effects. Equating is tested in Phase A.

**Arabic processing.** The engine removes diacritics and tatweel, unifies alef, taa marbuta and alif maqsura, and strips clitics (و، ال، بال، فال). Matching works the same way in Python and JavaScript.

**Stratified norms.** Expected raw scores depend on education band (none, primary, secondary, tertiary) and age. A composite of weighted domain z-scores is restandardised to unit variance. Raw scores are always stored, so norms can be revised without retesting anyone.

**Accessibility.**
- Spoken instructions with captions, and a "repeat instruction" control on every screen.
- No typing required.
- Larger text, high contrast and slower speech options.
- Caregiver-assisted mode that records the helper's role.
- A pre-session check for hearing, vision and room noise.
- Phone and WhatsApp fallback channels, kept as separate baselines and never pooled.

## 4. Longitudinal change detection (requirement 2)

**Baseline.** The baseline is built from the first 2 clean valid sessions. A session is clean if it has no mood, illness or assisted flag; if needed the engine relaxes this after 3 sessions. Each channel has its own baseline.

**Reliable change (practice-adjusted).** For score X at session *n*, against a baseline mean over *k* sessions:

```
RCI = [(X_n − X̄_baseline) − (g(n) − mean g(baseline))] / SE_diff
SE_diff = SD·√(1−r) · √(1 + 1/k)          g(i) = practice gain per session · min(i, 3)
```

The engine computes this for the composite and for each domain, using each test's reliability *r* and expected practice gain (both re-estimated in Phase A). Every alert shows a 90% range for the true change.

| Level | Trigger | Action |
|---|---|---|
| Stable | Composite RCI > −1.645 and delayed-recall RCI > −1.96 | Reassurance, prevention plan, routine repeat (6 months) |
| Check again | One decline signal, or a decline with a confounder, or an invalid recording | Alternate-form repeat in 2–4 weeks |
| Clinician review | A significant concern at intake, before any testing: two or more everyday activities now done by someone else, an informant questionnaire above the cutoff, or a concern raised by a healthcare professional; a very low first-visit score (≤ −2.0 for age and education, no waiting for baseline); the same decline signal confirmed on the next session; or decline plus an informant functional flag; or entry composite ≤ −1.5 for age and education | Review Task, 21-day target |
| Urgent review | Red flags for an acute presentation at intake (sudden onset, fluctuating confusion, new neurological symptoms, fall or head injury, rapid worsening, safety risk), which follow the emergency protocol with no testing first; composite RCI ≤ −2.576 or a drop of ≥ 1.5 SD within 120 days; new informant-reported functional loss (IQCODE above 3.34 and rising ≥ 0.3); safety concern | Review Task, 3-day target, clinician call |

**Design decisions found through simulation.**
- Only the composite and delayed recall can trigger alerts on their own. Coarse scales such as judgement (0–4) are shown as context. Allowing every domain to trigger, and accepting any signal as confirmation, doubled false referrals in the synthetic cohort (specificity 0.76 → 0.90 after the change).
- Confirmation requires the *same* signal to persist on the repeat session.

**Voice features (exploratory).** Speech rate, pause count, mean pause length, type–token ratio and word count are computed on the device from the audio stream; raw audio never leaves the device. Per-person EWMA control charts (`change.ewma_chart`) track them, but they never drive alerts until they meet pre-set accuracy and stability criteria in each language and dialect subgroup. This caution matches the current evidence. A January 2026 preprint (Dadgostar et al., medRxiv, doi:10.64898/2026.01.15.26344226; not peer-reviewed) reports eGeMAPS acoustic features separating plasma p-tau217/APOE-defined risk groups in 49 cognitively unimpaired adults. However, it used English speakers recorded in a sound booth and no external test set, and its feature selection appears tuned on the same cross-validation that reports accuracy. It supports collecting eGeMAPS-type features under consent; it does not support using them for triage.

## 5. Integrated risk context (requirement 3)

Each signal needs its own consent: voice features, raw audio, wearables, clinical record, family history, genomics, caregiver involvement, model training. Each is stored as a FHIR `Consent` resource and can be withdrawn on its own.

The clinician sees BP, HbA1c, LDL, BMI, activity, sleep, PHQ-2, GAD-2, IQCODE-16 and family history, each with its source. The dossier lists which of the 14 modifiable risk factors from the 2024 Lancet Commission are present. MemBrain deliberately computes no combined probability. Genomic results (existing APOE results only) are shown only if genomics consent is on. They add clinician context, a suggestion for closer monitoring, an anti-amyloid treatment-safety flag and research eligibility, but **never change triage**. They reach the person only after counselling, and only if they choose to know (see `GENOMICS.md`).

## 6. Prevention and timely care (requirement 4)

- **Prevention.** Clinician-authored, versioned rules turn context into up to 5 actions per person, in Arabic or English, with cultural adaptations (walking after Maghrib, mall walking in summer, shisha and medwakh, majlis, Quran memorisation). Each rule links to its evidence. No AI writes free-text medical advice.
- **Pathways.** Memory clinic, geriatrics or neurology; mental health; primary care; urgent safety review.
- **Reversible causes.** The dossier suggests checks for TSH, B12, folate, FBC, HbA1c, renal function, anticholinergic burden, PHQ-9, STOP-BANG, and hearing and vision.
- **Referral dossier.** A one-page summary that opens with the concern: who raised it, their own words, what changed and since when, who now does which activity, and what information is still missing. It is labelled as the reporter's account until a clinician confirms it. Then come trend, drivers, confounders, risk context and limitations. It is also available as a FHIR bundle.

## 6b. Navigator layer: from alert to completed care

See `NAVIGATOR.md`. It covers:
- concern-led entry
- the red-flag screen before any testing
- household-helper informants with separate consent
- a functional change timeline
- a service directory with verification dates
- matching that puts the clinical pathway first and records pathway gaps
- closed-loop referral tracking (7 states, plus reasons for declined, missed or lost referrals)
- a next-steps pack in Arabic and English
- programme metrics by entry route, language, funding, sex and age

Each referral is stored as a FHIR `ServiceRequest`.

**Entry and AI (see `NAVIGATOR_AI.md`).**
- **Two doors.** The app opens on a choice between raising a concern ("I've noticed a change in memory or thinking": in yourself, someone you love, or a patient) and the voice check-in. Whoever raises the concern is recorded with it. Both lead into the same loop.
- **Family intake.** A narrative is turned into facts that quote their source words, carry a confidence, are read back aloud and are confirmed by a person. The always-on rules extractor runs in the browser. MedGemma 4B runs behind `/api/intake/extract` when an in-country model server is configured.
- **Safety rules on model output.** A model field without a real quote is dropped, and red flags are the union with the rules.
- **Referral reasons.** These are drafted from confirmed facts and checked sentence by sentence by a deterministic verifier.
- **Held-out results for the rules extractor** (30 frozen narratives): it passes the measurable safety gates (12/12 urgent cases, p95 latency 2 ms; the unsupported-field gate is n/a for rules, which quote the narrative by construction) but not yet the accuracy gates (domain F1 0.85 against a 0.90 target). MedGemma is measured on the same set on the FZJ cluster.

## 7. Safety and human oversight (requirement 5)

1. Results at review level are **held**. The participant hears only "your clinic will contact you. This is not a diagnosis."
2. Every alert lists its drivers (input, RCI, threshold, change), the confounders checked, and a 90% uncertainty range.
3. The system never creates a FHIR `Condition` resource; only clinicians do. A test enforces this.
4. Dismissing an alert requires a reason. Every view, export and action is written to an audit log.
5. A positive mood screen triggers support messaging and a mental-health pathway offer, and the cognitive alert is held.
6. Regulatory route: the pilot runs under ethics approval as research with no clinical claims, while we seek written classification advice from the Emirates Drug Establishment (Federal Decree-Law 38 of 2024). Design controls follow IEC 62304 and ISO 14971 from day one: versioned engine, norms and items; golden-vector regression tests; requirements traceability.

## 8. Validation (requirement 6)

`membrain/validation.py` computes every required metric overall and by dialect, age band and education.

Below is a synthetic run with n = 2,000 people, 10,766 sessions and 12 months of follow-up. It shows the pipeline working, **not clinical accuracy**; assumptions are in `ASSUMPTIONS_LIMITATIONS.md`.

| Metric | MemBrain | Usual care (education-blind annual screen) |
|---|---|---|
| Sessions completed unaided | 92% | – |
| Test–retest ICC(2,1), 2 weeks | 0.86 | – |
| Sensitivity (impaired or meaningful decline) | 83% (95% CI 79–87) | 61% |
| Specificity | 89% (88–91) | 87% |
| PPV at 14% prevalence | 58% | 46% |
| Referrals per confirmed finding | 1.74 | 2.20 |
| Meaningful change detected (sens / spec) | 64% / 95% | – |
| Median time to clinical assessment* | 8 weeks | 16 weeks |
| False-positive rate at entry, no formal education | 7% | 44% |

\*Assumes a 3-week review target for MemBrain and a 16-week referral wait for usual care.

**Stability and design evidence** (`EVIDENCE_PACK.md`). Across 10 independent synthetic cohorts, sensitivity is 82% ± 1.4 points and specificity 90% ± 0.7.
- Ablation shows that confirmation on repeat and stratified norms remove the most false referrals.
- A 72-setting sweep, re-tested on fresh cohorts, shows that our default was not over-fitted: stricter settings halve false referrals but detect far less change.
- A decision curve shows net benefit over usual care at all thresholds from 5% to 40%.
- Small-subgroup estimates (for example, no formal education: 72%–96% across cohorts) are unstable, so Phase A enriches these strata.

**Study plan.**
- Phase A (feasibility and reliability): stratified by dialect, age band and education, with sessions at baseline, about 2 weeks and about 12 weeks. Includes a paper-versus-digital mode-equivalence subsample and ASR word error rate by subgroup.
- Phase B (accuracy): memory clinic and primary care, with a specialist reference standard.
- A biostatistician sets sample sizes. Decision-curve analysis compares net benefit with usual care.

## 9. Data model

| Data | FHIR R4 resource |
|---|---|
| Pseudonymous person | Patient (identifiers in a separate vault) |
| Consent per signal | Consent |
| Session scores, composite z, voice features | Observation (custom code system; LOINC for PHQ-2 55757-9, GAD-2 69725-0) |
| Change and triage output | RiskAssessment (basis → Observations) |
| Review work item | Task (priority, review target) |
| Referral | ServiceRequest (pilot) |
| Diagnosis | Condition, written by clinicians only |

## 9b. Speech recognition

Azure AI Speech runs in the UAE North region. The server holds the key and gives the browser a short-lived token; the browser then streams audio to the in-country endpoint, using a locale chosen from the person's dialect. One microphone stream also feeds the on-device acoustic features.

If Azure is unavailable, the app falls back to browser speech recognition, and then to typed answers. The engine used is recorded with every session, so accuracy can be analysed by engine and subgroup. Details are in `AZURE_SPEECH.md` and `DEPLOY_AZURE.md`.

For an in-country, self-hosted option we adapted an existing open Gulf-Arabic Whisper model to Emirati speech with a small LoRA adapter. On a held-out Emirati test set (103 clips, topics never seen in training), word error rate fell from 49.5% to 41.2% (−8.3 points, 95% CI −16.9 to −1.2, p = 0.011). Task-word recall did not improve on its 19 words, so the production recogniser is chosen on task-word recall and worst-subgroup error from consented recordings. Method and results are in `asr/README.md` and `docs/asr/BENCHMARK_RESULTS.md`.

## 10. Security and privacy

- **Hosting:** in-country cloud region, with no foreign processing of health data, in line with the ICT Health Law localisation rules.
- **Encryption:** TLS in transit, KMS-managed keys at rest.
- **Separation:** an identity vault holds identifiers; analytics use pseudonymous IDs only.
- **Access:** OAuth2, OIDC and SMART scopes, with clinicians limited to assigned, consented patients.
- **Data minimisation:** voice is reduced to features on the device.
- **Audit and assurance:** an immutable audit log, a DPIA, a penetration test and an incident plan before enrolment. ADHICS controls are mapped with the partner.

## 11. Engineering quality

- 39 pytest tests cover persona pathways, RCI arithmetic, education fairness, mood hold, the audio gate, explanations, Arabic scoring, FHIR validation, API role checks, identity-vault separation, consent withdrawal, the red-flag and first-visit routes, the referral state machine, accessibility matching, FHIR ServiceRequest, and the speech token broker (the key is never returned; rate limiting works).
- The Python and JavaScript engines agree on all 90 golden cases (461 session evaluations) and on all 15 Navigator programme metrics.
- `make all` rebuilds data, the demo and tests from one source of truth (`membrain/config.py`).

## 12. Roadmap after the challenge

| Months | Work |
|---|---|
| 0–3 | Ethics approval, partner MoU, native-speaker item review per dialect, ASR benchmark on consented recordings, in-country deployment |
| 3–9 | Phase A (feasibility and reliability), local norms, mode equivalence |
| 9–18 | Phase B (diagnostic accuracy, change detection), EDE classification, HIE integration with the partner |
| Later | Validated voice biomarkers, passive monitoring, genomics module (M42 / IROS) |

## 13. Business model

MemBrain is sold business-to-business to health programmes, longevity centres and primary care networks, on a per-enrolled-person annual licence covering the app, engine, dashboard and reporting. The value case rests on fewer unnecessary specialist referrals (1.74 against 2.2 referrals per confirmed finding in simulation), earlier assessment, and a structured dataset for population brain-health planning.
