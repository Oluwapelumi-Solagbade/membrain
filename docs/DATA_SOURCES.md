# Data sources plan (owner: Oluwapelumi, with Jeremiah and Abdulwaliy)

**Rule for the challenge: synthetic data or openly licensed data only. No identifiable patient data.**

Access terms and timelines below are from our knowledge and must be checked on each provider's site before applying. Credentialed datasets usually take days to weeks to approve, so apply on day 1 or treat them as post-challenge.

## What the prototype needs, mapped to sources

| Need | Use now (before 20 Nov) | Apply for (Phase A/B or if approved in time) |
|---|---|---|
| Cognitive scores and trajectories | Our synthetic cohort generator (`membrain/simulate.py`) | NACC Uniform Data Set; ADNI; OASIS-3 (data-use agreements) |
| Speech in people with impairment (English) | – | DementiaBank (Pitt corpus) and ADReSS / ADReSSo challenge sets via TalkBank membership. Use for the offline exploratory voice-feature analysis on the FZJ cluster. |
| Arabic dialect speech (ASR benchmark, not clinical) | Mozilla Common Voice Arabic (CC0) | MGB-2/MGB-3 (Arabic broadcast, includes dialects), QASR, MASC. Check each licence for research use. |
| Normative and local context | Published papers (Arabic RUDAS, Arabic IQCODE, MoCA norms for Qatar and Saudi Arabia) | Partner-collected Phase A norms (UAE) |
| Population risk-factor prevalence (simulation priors) | UAE / Abu Dhabi published health statistics; Abu Dhabi open data portal (data.abudhabi) for population structure | – |
| Wearable sleep and activity | Synthetic daily summaries | Partner devices in the pilot |

## Priority conditions (from the team list) → engine inputs

- **P1** (MCI, AD, VCI or VaD, PD, depression, anxiety, sleep apnoea, insomnia, HTN, T2D, stroke/TIA). Simulated as latent cognitive status, the mood confounder (PHQ-2/GAD-2), sleep inputs, and BP and HbA1c context. Sleep apnoea → STOP-BANG in the dossier.
- **P2** (dyslipidaemia, CVD, AF, CKD, hypothyroidism, B12, folate, anaemia, hearing, vision, medication effects, delirium). These populate the reversible-cause checklist and context fields. Delirium (acute change) maps to the urgent pathway.
- **P3** (frailty, sarcopenia, OA, pain, TBI, inactivity, isolation, obesity, smoking, alcohol). Lifestyle and context inputs feed the prevention rules and the modifiable-factor count.

## ML work on the FZJ cluster (Oluwapelumi and Abdulwaliy)

1. Run `scripts/quick_val.py` across seeds and parameter grids, a sensitivity analysis on the thresholds (RCI cut, trigger domains, baseline k). Report the false-referral and sensitivity trade-off curve and decision-curve net benefit. Output: one figure plus a table for the submission.
2. If DementiaBank or ADReSS access arrives: extract the same voice features we compute on the device (speech rate, pauses, TTR) with openSMILE or Praat, then fit a cross-validated logistic baseline. Report AUC with a clear "exploratory, English-only" label.
3. Optional: run Whisper-large-v3 against Common Voice Arabic to report WER per dialect tag. This demonstrates the worst-subgroup selection method.
