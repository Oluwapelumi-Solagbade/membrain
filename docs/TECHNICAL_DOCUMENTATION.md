# MemBrain: technical documentation

Version: engine 0.3.0 · norms synthetic-2026.11 · item bank ib-0.2.0 · Team Cerebro Spark

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
| Clinician review | The same decline signal confirmed on the next session; or decline plus an informant functional flag; or entry composite ≤ −1.5 for age and education | Review Task, 21-day target |
| Urgent review | Composite RCI ≤ −2.576 or a drop of ≥ 1.5 SD within 120 days; new informant-reported functional loss (IQCODE above 3.34 and rising ≥ 0.3); safety concern | Review Task, 3-day target, clinician call |

**Design decisions found through simulation.**
- Only the composite and delayed recall can trigger alerts on their own. Coarse scales such as judgement (0–4) are shown as context. Allowing every domain to trigger, and accepting any signal as confirmation, doubled false referrals in the synthetic cohort (specificity 0.76 → 0.90 after the change).
- Confirmation requires the *same* signal to persist on the repeat session.

**Voice features (exploratory).** Speech rate, pause count, mean pause length, type–token ratio and word count are computed on the device from the audio stream; raw audio never leaves the device. Per-person EWMA control charts (`change.ewma_chart`) track them, but they never drive alerts until they meet pre-set accuracy and stability criteria in each language and dialect subgroup.

## 5. Integrated risk context (requirement 3)

Each signal needs its own consent: voice features, raw audio, wearables, clinical record, family history, genomics, caregiver involvement, model training. Each is stored as a FHIR `Consent` resource and can be withdrawn on its own.

The clinician sees BP, HbA1c, LDL, BMI, activity, sleep, PHQ-2, GAD-2, IQCODE-16 and family history, each with its source. The dossier lists which of the 14 modifiable risk factors from the 2024 Lancet Commission are present. MemBrain deliberately computes no combined probability. APOE or other genomic results are shown only if genomics consent is on, and they are disclosed to the person only through clinical counselling.

## 6. Prevention and timely care (requirement 4)

- **Prevention.** Clinician-authored, versioned rules turn context into up to 5 actions per person, in Arabic or English, with cultural adaptations (walking after Maghrib, mall walking in summer, shisha and medwakh, majlis, Quran memorisation). Each rule links to its evidence. No AI writes free-text medical advice.
- **Pathways.** Memory clinic, geriatrics or neurology; mental health; primary care; urgent safety review.
- **Reversible causes.** The dossier suggests checks for TSH, B12, folate, FBC, HbA1c, renal function, anticholinergic burden, PHQ-9, STOP-BANG, and hearing and vision.
- **Referral dossier.** A one-page summary with trend, drivers, confounders, risk context and limitations. It is also available as a FHIR bundle.

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
| Sensitivity (impaired or meaningful decline) | 83% (95% CI 78–87) | 61% |
| Specificity | 90% (89–92) | 87% |
| PPV at 14% prevalence | 59% | 46% |
| Referrals per confirmed finding | 1.68 | 2.20 |
| Meaningful change detected (sens / spec) | 64% / 95% | – |
| Median time to clinical assessment* | 8 weeks | 16 weeks |
| False-positive rate at entry, no formal education | 7% | 44% |

\*Assumes a 3-week review target for MemBrain and a 16-week referral wait for usual care.

The run also surfaces a real gap: sensitivity is 67% for people with no formal education against 81–88% for other groups. MemBrain reports this rather than hiding it, and it is the first target for local norm work in Phase A.

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

## 10. Security and privacy

- **Hosting:** in-country cloud region, with no foreign processing of health data, in line with the ICT Health Law localisation rules.
- **Encryption:** TLS in transit, KMS-managed keys at rest.
- **Separation:** an identity vault holds identifiers; analytics use pseudonymous IDs only.
- **Access:** OAuth2, OIDC and SMART scopes, with clinicians limited to assigned, consented patients.
- **Data minimisation:** voice is reduced to features on the device.
- **Audit and assurance:** an immutable audit log, a DPIA, a penetration test and an incident plan before enrolment. ADHICS controls are mapped with the partner.

## 11. Engineering quality

- 23 pytest tests cover persona pathways, RCI arithmetic, education fairness, mood hold, the audio gate, explanations, Arabic scoring, FHIR validation and API role checks.
- The Python and JavaScript engines agree on all 87 golden cases (457 session evaluations).
- `make all` rebuilds data, the demo and tests from one source of truth (`membrain/config.py`).

## 12. Roadmap after the challenge

| Months | Work |
|---|---|
| 0–3 | Ethics approval, partner MoU, native-speaker item review per dialect, ASR benchmark on consented recordings, in-country deployment |
| 3–9 | Phase A (feasibility and reliability), local norms, mode equivalence |
| 9–18 | Phase B (diagnostic accuracy, change detection), EDE classification, HIE integration with the partner |
| Later | Validated voice biomarkers, passive monitoring, genomics module (M42 / IROS) |

## 13. Business model

MemBrain is sold business-to-business to health programmes, longevity centres and primary care networks, on a per-enrolled-person annual licence covering the app, engine, dashboard and reporting. The value case rests on fewer unnecessary specialist referrals (1.68 against 2.2 referrals per confirmed finding in simulation), earlier assessment, and a structured dataset for population brain-health planning.
