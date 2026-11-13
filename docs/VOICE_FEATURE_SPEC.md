# MemBrain: Acoustic Feature Specification & Biomarker Protocol
**Author:** Abdulwaliy (Team Cerebro Spark)  
**Deliverable:** 7 (Signal Processing & Acoustic Feature Spec)  
**Status:** Complete Specification for Phase A Benchmarking & FZJ Cluster Analysis  
**Dependencies:** `membrain/change.py`, `membrain/config.py`, `web/app.js`

---

## 1. Executive Summary & Clinical Rationale

Cognitive decline in prodromal states (Mild Cognitive Impairment — MCI) and early-stage neurodegenerative disorders (Alzheimer's disease, Frontotemporal dementia, Vascular cognitive impairment) manifests in subtle acoustic, prosodic, and temporal disruptions before broad semantic or lexical failures emerge:
1. **Articulatory slowing & hesitation:** Prolongation of silent pauses between lexical chunks, reduced articulation rate, and hesitation within complex phrase boundaries.
2. **Prosodic flattening & fundamental frequency ($F_0$) dynamics:** Decreased standard deviation of pitch ($F_0$ SD), reduced pitch range (monotone inflection), and atypical boundary tone contours.
3. **Phonatory instability & vocal quality:** Elevations in cycle-to-cycle perturbation measures—**Jitter** (frequency instability) and **Shimmer** (amplitude instability)—alongside a reduction in **Harmonics-to-Noise Ratio (HNR)** due to subtle laryngeal motor control degradation.
4. **Spectral envelope shifts:** Centralization of formant frequencies ($F_1, F_2$) corresponding to restricted vowel space area (VSA) and acoustic centralization ratio (VAI).

### Clinical Boundary Condition
> [!IMPORTANT]
> **Exploratory Safety Rule:** In accordance with the MemBrain safety architecture (`docs/TECHNICAL_DOCUMENTATION.md` Section 4), **voice biomarkers are strictly exploratory**. They are tracked longitudinally using per-person Exponentially Weighted Moving Average (EWMA) control charts (`membrain.change.ewma_chart`), but **never drive autonomous clinical triage or referral alerts** on their own until prospective subgroup validation in Phase A confirms stability, absence of demographic bias, and high test-retest reliability ($r \ge 0.80$).

---

## 2. Critique & Replacement of Legacy Browser VAD

The baseline web prototype (`web/app.js`, `Rec.stop()`) deployed a simplistic, energy-based threshold for voice activity detection:
$$\text{Speech Frame} \iff \text{RMS}_{\text{frame}} > \text{Floor}_{\text{noise}} + 10\text{ dB}$$

### Critical Failure Modes of the Legacy Implementation:
* **Acoustic Noise Confounding:** Sensitivity to environmental acoustics (HVAC hum, fan rumble, ceiling fans, distance from mobile mic) artificially inflates speech duration and degrades pause counts.
* **Low-Energy Consonant Clipping:** Unvoiced fricatives (/s/, /ʃ/, /f/, /x/) and weak stops (/t/, /k/, /q/) in Arabic fall below the $+10\text{ dB}$ threshold, artificially fragmenting utterances into spurious micro-pauses.
* **Lack of Voicing Discrimination:** Breaths, coughs, and throat clearing are misclassified as speech.
* **No Acoustic Normalization:** A loud speaker or closer mouth-to-microphone distance shifts metrics unpredictably between sessions.

---

## 3. Standardized Feature Set: openSMILE eGeMAPSv02 & Praat Alignment

MemBrain adopts the **extended Geneva Minimalistic Acoustic Parameter Set (eGeMAPSv02)** (Eyben et al., 2016), standardizing on 88 low-level acoustic descriptors (LLDs) and functional statistics, paired with equivalent **Praat** deterministic algorithms.

### 3.1 Primary Acoustic Parameter Matrix

| Biomarker Domain | Feature Identifier | Extraction Engine | Calculation / Mathematical Definition | Neurological / Cognitive Relevance |
|---|---|---|---|---|
| **Temporal / Prosody** | `articulation_rate` | Praat / openSMILE | $\frac{N_{\text{syllables}}}{T_{\text{phonation}}}$ (syllables / sec of voiced speech) | Articulatory coordination; slowed in MCI and subcortical impairment. |
| **Temporal / Prosody** | `speech_rate_wpm` | Hybrid ASR + VAD | $\frac{N_{\text{words}}}{T_{\text{total\_speech\_min}}}$ (words / min) | Global processing speed and lexical retrieval latency. |
| **Pause Dynamics** | `pause_count` | Neural VAD | Count of unvoiced segments with duration $t > 250\text{ ms}$ | Lexical search difficulty, working memory retrieval stalls. |
| **Pause Dynamics** | `mean_pause_duration` | Neural VAD | $\frac{1}{M}\sum_{i=1}^{M} t_{\text{pause}, i}$ (seconds) | Prolonged hesitation during discourse or naming tasks. |
| **Pause Dynamics** | `pause_to_speech_ratio` | Neural VAD | $\frac{T_{\text{total\_pause}}}{T_{\text{total\_speech}}}$ | Temporal fragmentation of speech; early marker of executive burden. |
| **Pitch ($F_0$) Dynamics** | `f0_mean` | openSMILE / Praat | Mean fundamental frequency across voiced frames ($Hz$ / semitones) | Baseline vocal register; gender and anatomical anchor. |
| **Pitch ($F_0$) Dynamics** | `f0_std_semitones` | openSMILE / Praat | $12 \times \log_2\left(\frac{F_0}{F_{0,\text{ref}}}\right)$ Standard Deviation | Prosodic expressiveness; pitch flattening / monotone speech. |
| **Pitch ($F_0$) Dynamics** | `f0_range_q25_q75` | openSMILE / Praat | Interquartile range of $F_0$ distribution | Dynamic intonation variability across utterances. |
| **Vocal Perturbation** | `jitter_local` | Praat / openSMILE | $\frac{\frac{1}{N-1}\sum_{i=1}^{N-1} |T_i - T_{i+1}|}{\frac{1}{N}\sum_{i=1}^{N} T_i}$ (cycle-to-cycle pitch period variation) | Laryngeal micro-instability and neuromuscular control. |
| **Vocal Perturbation** | `shimmer_local` | Praat / openSMILE | $\frac{\frac{1}{N-1}\sum_{i=1}^{N-1} |A_i - A_{i+1}|}{\frac{1}{N}\sum_{i=1}^{N} A_i}$ (cycle-to-cycle peak amplitude variation) | Subglottal pressure irregularity and vocal cord adduction stability. |
| **Glottal Noise** | `hnr_db` | Praat / openSMILE | $10 \cdot \log_{10}\left(\frac{\text{Energy}_{\text{harmonic}}}{\text{Energy}_{\text{noise}}}\right)$ | Dysphonia, incomplete vocal fold closure, breathiness. |
| **Formant Dispersion** | `formants_f1_f2` | Praat / openSMILE | 1st & 2nd formant center frequencies via Burg algorithm | Vowel articulation precision; vowel space centralization (VSA collapse). |
| **Spectral Energy** | `spectral_slope_0_500` | openSMILE | Linear regression slope of power spectrum $0–500\text{ Hz}$ | Vocal effort, spectral tilt, and glottal flow roll-off. |
| **Spectral Energy** | `hammarberg_index` | openSMILE | $\text{Peak}_{0-2000\text{ Hz}} - \text{Peak}_{2000-5000\text{ Hz}}$ (dB) | Spectral balance and breathy voice quality. |
| **Spectral Dynamics** | `mfcc_1_4` | openSMILE | First 4 Mel-Frequency Cepstral Coefficients | Vocal tract shape configuration and spectral timbre. |

---

## 4. Signal Processing Framing & Mathematical Specifications

### 4.1 Audio Preprocessing Pipeline
```
[Raw Audio: 16 kHz, 16-bit Mono PCM]
                 │
                 ▼
[High-Pass Filter: Butterworth 4th-order, fc = 70 Hz] (Strip DC offset & handling rumble)
                 │
                 ▼
[Pre-emphasis Filter: y(t) = x(t) - 0.97 x(t-1)] (Boost high frequencies for formant/spectral analysis)
                 │
                 ▼
[Framing: 25 ms window length (400 samples), 10 ms step size (160 samples), Hann window]
                 │
                 ▼
[Parallel Feature Extraction: Pitch (YIN/AC) + Formants (Burg LPC) + Energy + Spectral LLDs]
```

### 4.2 Praat Algorithm Mapping (Reference Implementation)
For cluster processing on the FZJ cluster (`scripts/extract_voice_features.py`) or TalkBank / Common Voice evaluations:

```praat
# Praat Script Snippet: Pitch, Jitter, Shimmer, HNR Extraction
sound = Read from file: audio_path$
# Pitch via Autocorrelation (ac)
pitch = To Pitch (ac): 0.0, 75, 15, "no", 0.03, 0.45, 0.01, 0.35, 0.14, 500
f0_mean = Get mean: 0, 0, "Hertz"
f0_std = Get standard deviation: 0, 0, "Hertz"

# Harmonicity (Harmonics-to-Noise Ratio)
harmonicity = To Harmonicity (cc): 0.01, 75, 0.1, 4.5
hnr_mean = Get mean: 0, 0

# Jitter & Shimmer via PointProcess
pointProcess = To PointProcess (periodic, cc): 75, 500
jitter_local = Get jitter (local): 0, 0, 0.0001, 0.02, 1.3
shimmer_local = Get shimmer (local): 0, 0, 0.0001, 0.02, 1.3, 1.6

# Formants via Burg algorithm
formants = To Formant (burg): 0.0, 5, 5500, 0.025, 50
f1_mean = Get mean: 1, 0, 0, "Hertz"
f2_mean = Get mean: 2, 0, 0, "Hertz"
```

### 4.3 openSMILE Configuration Mapping
The cluster extraction pipeline utilizes openSMILE CLI with the standard `gemaps/v02/eGeMAPSv02.conf` config:
```bash
SMILExtract -C gemaps/v02/eGeMAPSv02.conf \
            -I sample.wav \
            -O features.csv \
            -instname "MB-SESSION"
```

---

## 5. Longitudinal Tracking via EWMA Control Charts

Acoustic biomarkers exhibit high inter-subject variance (due to vocal tract length, sex, smoking history, baseline speaking habits) but **tight intra-subject stability over time** in healthy individuals.

### 5.1 Formulation in `membrain/change.py`
For an acoustic feature $Y$ (e.g. `mean_pause_duration`, `f0_std_semitones`):
1. **Personal Baseline:** The reference mean $\mu$ and standard deviation $\sigma$ are established over the first $k \ge 3$ valid sessions.
2. **EWMA Smoothing Parameter:** $\lambda = 0.30$.
3. **Control Limits:** Two-sided limits with multiplier $L = 2.70$ (providing $99.3\%$ empirical in-control coverage):
   $$Z_t = \lambda Y_t + (1 - \lambda) Z_{t-1}, \quad Z_0 = \mu$$
   $$\text{UCL}_t / \text{LCL}_t = \mu \pm L \cdot \sigma \sqrt{\frac{\lambda}{2 - \lambda} \left[1 - (1 - \lambda)^{2t}\right]}$$
4. **Trigger Output:** If $Z_t$ violates control limits, a flag is logged in the clinician dossier under `exploratory_voice_signals`.

---

## 6. Integration Checklist for Team Plan
* [x] **Acoustic feature matrix specified** (openSMILE eGeMAPSv02 & Praat parity).
* [x] **Temporal and pause thresholds formalized** ($250\text{ ms}$ silence cutoff for true pauses).
* [x] **Longitudinal EWMA control chart mapped** (`change.ewma_chart`).
* [x] **Python extraction script delivered** (`scripts/extract_voice_features.py`).
* [ ] **Cluster run on FZJ cluster** (Oluwapelumi + Abdulwaliy on TalkBank/Common Voice).
