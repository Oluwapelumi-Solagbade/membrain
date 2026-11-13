# Assumptions and limitations

## Assumptions
1. **Psychometric parameters are placeholders.** Test–retest reliabilities (0.70–0.82 by domain, 0.88 composite), practice gains, inter-domain correlation (0.5) and norm means and SDs in `membrain/config.py` are illustrative. Phase A re-estimates them.
2. **Published anchors.** We use published figures where they exist: Arabic RUDAS (cutoff ≤ 22, 83% sensitivity and 85% specificity for dementia, Lebanese adults 65+), Arabic IQCODE-16 (cutoff > 3.34), and PHQ-2 and GAD-2 cutoffs of ≥ 3. None of these is validated for MCI, for ages 50–64, for Gulf dialects or for digital delivery.
3. **Synthetic cohort.** The parameters are in `membrain/simulate.py` (`ASSUMPTIONS`):
   - dialect mix
   - education mix
   - status prevalence rising with age (about 85% normal, 11% MCI, 4% dementia overall)
   - latent decline rates
   - depression (12%) and its effect on scores
   - sleep, illness and noisy-session rates
   - an ASR penalty on fluency by dialect (worst for Egyptian, and for no formal education)
4. **Usual-care comparator.** One education-blind screen at week 0 and week 52, plus an assumed 16-week referral wait.
5. **Reference standard in simulation.** The truth label is "impaired at entry, or true latent decline of 0.5 SD or more in 12 months". In Phase B it is specialist neuropsychological assessment.

## Limitations
- **Simulated metrics are not evidence.** They show that the pipeline, thresholds and safety logic behave as intended under stated assumptions.
- **Items need review.** Arabic items are drafts that need native-speaker review per dialect (Emirati and Gulf, Levantine, Egyptian) and cultural review before Phase A. Fluency lexicons are small, so unrecognised words go to human audit.
- **Speech recognition in the hosted demo.** The browser's speech recognition is not dialect-tuned. The pilot benchmarks open and commercial Arabic ASR, all hosted in-country, and chooses on worst-subgroup word error rate.
- **Microphone in the hosted demo.** The hosted preview cannot use the microphone (iframe sandbox). Running locally enables the full voice path.
- **Drawing and praxis tasks are not automated.** In the pilot they are clinician-scored.
- **Voice features stay exploratory.** None drive alerts.
- **No real integrations yet.** Clinical record and wearable data are simulated; no real connectors are built yet. HIE integration is partner-led and needs accreditation.
- **Persistence is in memory.** There is no production identity provider yet.
- **Regulatory class is unconfirmed.** No clinical claims are made until EDE classification advice is received.
