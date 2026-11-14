# UAE data used in MemBrain

We were asked to use data from the UAE itself. Below is what is openly available, how we use it, and what has to come from partners. No identifiable patient data is used anywhere.

## 1. UAE health statistics (calibrate the synthetic cohort)

Source: **WHO Global Health Observatory**, the official OData API, country code ARE. Retrieved 15 Nov 2026. These are national estimates (most are WHO-modelled), not individual records.

| Risk factor | WHO indicator | Year, ages | Both sexes | Women | Men |
|---|---|---|---|---|---|
| Hypertension | NCD_HYP_PREVALENCE_C | 2019, 30–79 | 31.6% (UI 25.1–38.5) | 23.1% | 34.6% |
| Diabetes | NCD_DIABETES_PREVALENCE_CRUDE | 2022, 30+ | 24.3% (17.2–32.2) | 23.7% | 24.6% |
| Obesity (BMI ≥ 30) | NCD_BMI_30C | 2024, 18+ | 30.3% (25.7–35.2) | 34.9% | 28.0% |
| Insufficient physical activity | NCD_PAC | 2022, 18+ | 64.0% (52.0–75.2) | 71.4% | 61.3% |
| Current tobacco smoking | M_Est_smk_curr | 2025 estimate, 15+ | 10.9% | 2.5% | 15.1% |

**How we use them.** `membrain/uae_data.py` draws each synthetic person's hypertension, diabetes, BMI, activity and smoking from these sex-specific UAE rates. Hypertension and diabetes are given a modest age gradient around age 62. A test checks the simulated prevalences stay within 5 points of the WHO figures. The cognition part of the simulation is untouched (separate random stream), so all validation numbers are unchanged.

**Limits.** These are adult-wide rates. Age-specific rates for 50–75-year-olds should come from the UAE National Health Survey or partner programme data (for example IFHAS screening).

## 2. UAE speech data (speech recognition testing and fine-tuning)

| Dataset (Hugging Face) | Content | Licence | Use |
|---|---|---|---|
| `eabayed/EmiratiDialictShowsAudioTranscription` | 443 transcribed Emirati clips: TV, podcasts, YouTube | AFL-3.0 | Fine-tune and held-out test, split by category |
| `otozz/gulf_train_set` / `gulf_test_set` | MASC Gulf partition | CC-BY-4.0 | Extra Gulf training data |
| `MBZUAI/MIXAT` | Emirati Arabic–English code-switching (MBZUAI, Abu Dhabi) | Unclear / non-commercial | Not used until the licence is confirmed |
| `oi-uae/EmiratiAudioDataset-20H` | About 20 h of Emirati audio | Gated, licence not stated | Not used until the licence is confirmed |

Existing model used as the starting point: `otozz/whisper-small-dialect_gulf` (Apache-2.0). See `asr/README.md`.

## 3. Language data
- `tiiuae/alyah-emirati-benchmark` (TII, Abu Dhabi): an Emirati-dialect benchmark for language models. It is relevant if a language model is ever used to rephrase approved messages; this would let us test that its Emirati wording is appropriate.

## 4. What only partners can provide (Phase A/B)
- **Local cognitive norms** by age and education for 50–75-year-olds in the UAE. None are public. This is the core of Phase A.
- **Longitudinal repeated-testing data** to replace our placeholder reliability and practice-effect values.
- **Clinical-record context** (blood pressure, HbA1c, lipids, diagnoses) through the partner's integration, with consent.
- **Existing genomic results** through the partner, for example from a national genome programme, with genomics consent.
