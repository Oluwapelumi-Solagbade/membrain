# Genomics in MemBrain: what it does and what it doesn't

The challenge asks us to integrate "family-history and genomic information" where authorised. MemBrain does this as **context and safety**, never as a trigger.

## Principles
1. **Existing results only.** Genotypes come in through the partner, for example from a national genome programme. MemBrain does no sequencing and collects no samples. The partner's data-sharing terms must be confirmed before the pilot.
2. **Separate consent.** Without genomics consent, nothing is processed or shown (`genomic_context()` returns "not available").
3. **Never changes triage.** APOE e4 raises risk, but most carriers never develop dementia. Using it to trigger alerts would add false referrals, anxiety and discrimination risk. A test enforces this (`test_genomics_never_changes_triage`).
4. **Clinician-mediated disclosure.** The participant app shows nothing about genetics. Results are shared in a genetic-counselling session, and only if the person chooses to know. Counselling follows a fixed sequence: not offered → offered → counselled, wants the result / counselled, does not want it / declined counselling.
5. **Ancestry honesty.** A polygenic score, if present, always shows the warning that it comes from mostly European-ancestry studies and is not validated in Gulf or Arab populations.

## What it does

| Output | Rule | Why |
|---|---|---|
| Clinician context | APOE genotype, number of e4 copies, source and date, family history | A fuller preventive picture; no combined score |
| Vascular-risk focus | Any e4 carrier | Lifestyle risk reduction benefits carriers as well as non-carriers |
| Closer monitoring (suggested) | e4/e4, or one e4 + first-degree family history + age 60 or over | Shorter check-in intervals. **What counts as a decline does not change.** |
| Treatment-safety flag | e4/e4 | Higher ARIA risk with anti-amyloid therapy; the genotype must be known before that decision |
| Research eligibility | Any e4 carrier | Prevention trials only with separate research consent |

## Where it lives
- Engine: `membrain/genomics.py`, with the browser port `web/genomics.js` (parity-checked).
- API: `GET /participants/{id}/genomics` (clinician), `POST …/genomics/counselling`, `GET /me/{id}/genomics` (participant view, hidden until counselled).
- FHIR: a genomic `Observation` with the counselling state as an extension. It will be mapped to the HL7 Genomics Reporting Implementation Guide with the partner.
- Demo: Khalid (MB-1322) has a synthetic e3/e4 record. Enrolment can import a genotype when genomics consent is ticked.
