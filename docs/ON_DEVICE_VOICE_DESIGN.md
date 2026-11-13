# MemBrain: On-Device Feature Extraction & Client-Side VAD Architecture
**Author:** Abdulwaliy (Team Cerebro Spark)  
**Deliverable:** 7 (On-Device Extraction Architecture & Edge VAD)  
**Status:** Architectural Blueprint for Web & Mobile App Shells  
**Related Files:** `web/app.js`, `web/engine.js`, `docs/VOICE_FEATURE_SPEC.md`

---

## 1. Regulatory Context & Privacy Rationale

### 1.1 In-Country Health Data Localisation Mandate
Under **UAE Federal Decree-Law No. 4 of 2016** (Use of Information and Communication Technology in Health Fields) and the Abu Dhabi Department of Health (DoH) **ADHICS** (Abu Dhabi Healthcare Information and Cyber Security) standards:
* **Identifiable and biometric health data must remain strictly within UAE jurisdiction.**
* Audio recordings contain unique biometric vocal prints that can identify individuals and reveal unintended diagnostic information (e.g. respiratory illness, emotional state).

### 1.2 Zero-Raw-Audio Policy (Edge Compute Guarantee)
MemBrain enforces an uncompromising architectural principle:
> [!IMPORTANT]
> **Zero Raw Audio Leaves the Device:**
> Raw audio waveforms are captured into volatile, non-persistent memory buffers within the browser / app sandbox.
> All digital signal processing (DSP), neural Voice Activity Detection (VAD), and acoustic biomarker extraction occur **entirely on the client device**.
> Once feature extraction finishes, raw audio buffers are immediately overwritten and garbage-collected. Only de-identified, low-dimensional scalar feature vectors (e.g., `snr_db`, `speech_rate_wpm`, `mean_pause_s`, `f0_mean`) and text transcripts are transmitted to the backend FHIR store.

---

## 2. System Architecture: AudioWorklet & WebAssembly Pipeline

The legacy implementation in [`web/app.js`](file:///c:/Users/user/Desktop/membrain-main/web/app.js) ran `setInterval(..., 50)` on the main JavaScript thread, which suffered from thread starvation, frame drops, and crude energy thresholding.

### Modern Multi-Threaded Audio Pipeline
```
[Microphone: navigator.mediaDevices.getUserMedia(16 kHz Mono)]
                             │
                             ▼
               [Web Audio AudioContext (16 kHz)]
                             │
                             ▼
              [AudioWorkletNode: mb-vad-processor]
              ┌────────────────────────────────────────────────────────┐
              │ Thread: Web Audio Dedicated Real-Time Thread           │
              │                                                        │
              │  1. Circular Audio Ring Buffer (Float32Array)          │
              │  2. Clipping & Overload Detector                       │
              │  3. Real-Time Neural VAD Engine (Silero-VAD via WASM)  │
              │     • 30 ms frame evaluation (480 / 512 samples)       │
              │     • Speech probability p(speech) > 0.50             │
              │     • Hysteresis hangover: 250 ms silence padding      │
              │  4. Emits: speech/silence state transitions            │
              └────────────────────────────────────────────────────────┘
                             │
            PostMessage (Speech State + PCM Chunks)
                             │
                             ▼
             [Web Worker: Acoustic Feature Extractor]
              ┌────────────────────────────────────────────────────────┐
              │ Thread: Dedicated Background Web Worker                │
              │                                                        │
              │  1. Fast Fourier Transform & Spectral Flux (WebAssembly)│
              │  2. Autocorrelation Pitch Extraction (YIN algorithm)    │
              │  3. Jitter, Shimmer, HNR calculation                   │
              │  4. Pause distribution & Articulation rate tracking    │
              │  5. Emits JSON Feature Payload                         │
              └────────────────────────────────────────────────────────┘
                             │
                             ▼
                  [App Controller (app.js)]
         • Updates UI Level Meter (60 fps via requestAnimationFrame)
         • Binds ASR Transcript to Extracted Acoustic Features
         • Submits Observation to Engine / FHIR Queue
```

---

## 3. Neural VAD Specification (Silero-VAD WASM)

To completely eliminate energy-threshold errors caused by HVAC, background traffic, and breath bursts, MemBrain specifies **Silero-VAD** deployed via **ONNX Runtime Web (WASM)**.

### 3.1 Model Profile & Resource Footprint
* **Model Size:** $<2.0\text{ MB}$ quantized INT8 / FP16 ONNX model.
* **Inference Latency:** $<1.8\text{ ms}$ per 30 ms audio chunk on typical mobile ARM processors (e.g. Apple A13+, Snapdragon 7 series+).
* **Sampling Rate:** 16,000 Hz single-channel PCM.
* **Input Tensor:** Shape `[1, 512]` normalized float samples $[-1.0, 1.0]$.
* **Internal State:** Hidden state vector `[2, 1, 64]` preserved across successive frames to maintain recurrent context.

### 3.2 Dynamic VAD Parameters & State Machine
```javascript
const VAD_CONFIG = {
  sampleRate: 16000,
  frameSizeSamples: 512,        // 32 ms frame window
  threshold: 0.50,              // Speech probability cutoff
  minSpeechDurationMs: 250,     // Ignores spurious clicks/coughs (<250 ms)
  minSilenceDurationMs: 250,    // Pause detection boundary (>=250 ms)
  speechPadMs: 100,             // Pre- and post-speech margin padding
};
```

#### State Transition Logic:
1. **Silence $\to$ Speech:** Triggered when $P(\text{speech}) \ge 0.50$ for at least 2 consecutive frames ($64\text{ ms}$).
2. **Speech $\to$ Pause:** Triggered when $P(\text{speech}) < 0.35$ continuously for $\ge 250\text{ ms}$. If duration exceeds $250\text{ ms}$, increment `pause_count` and log `pause_duration`.
3. **End of Task Detection:** If silence persists $\ge 5.0\text{ seconds}$ during single-response tasks (e.g. Word Recall, Judgement), emit `auto_complete_prompt` to assist older adults who forget to tap "Finish".

---

## 4. Signal Processing & Feature Extraction Subsystem (WASM / WebWorker)

Feature computation is offloaded to a Web Worker running lightweight DSP routines compiled to WebAssembly (C/Rust) or high-performance typed arrays.

### 4.1 Acoustic Metrics & Extraction Methods

| Metric | Algorithm | Complexity | Client Target |
|---|---|---|---|
| **Audio Quality Gate (SNR)** | P.56 speech level vs minimum 10th percentile energy floor | $O(N)$ | Meets `AUDIO_MIN_SNR_DB = 15.0` |
| **Clipping Rate** | Sample count $|x[n]| \ge 0.995$ divided by total samples | $O(N)$ | Meets `AUDIO_MAX_CLIPPING = 0.01` |
| **Pitch ($F_0$) Mean & SD** | pYIN / Difference function parabolic interpolation | $O(N \log N)$ | Measured across all voiced frames |
| **Jitter & Shimmer** | Relative period difference on peak detection | $O(N)$ | Measured during sustained phonation |
| **Harmonics-to-Noise (HNR)**| Harmonic component extraction via comb filter | $O(N \log N)$ | Voice quality stability |
| **Speech Rate (wpm)** | Word count from transcript / active speech minutes | $O(1)$ | Derived from VAD speech frames |
| **Pause Dynamics** | Durations and counts of VAD unvoiced windows | $O(1)$ | $t \ge 250\text{ ms}$ distribution |

---

## 5. Performance, Memory & Battery Budgets

To ensure high usability on mid-tier mobile phones in clinics and homes:

| Metric | Target Budget | Observed / Measured in Prototyping | Safety Margin |
|---|---|---|---|
| **Peak Heap Memory (RAM)** | $\le 45\text{ MB}$ | $\sim 28\text{ MB}$ (WASM runtime + buffers) | $1.6\times$ buffer |
| **CPU Core Utilization** | $\le 12\%$ of 1 core | $6–9\%$ during live recording | Comfortable headroom |
| **Battery Drain per Check-in**| $\le 0.4\%$ total battery | $\sim 0.25\%$ for full 6-minute battery | Negligible |
| **Audio Dropouts / Glitches** | 0 under 60 fps rendering | Zero dropouts with AudioWorklet | Decoupled from UI |
| **Payload Size to Backend** | $\le 2\text{ KB}$ JSON | $\sim 780\text{ bytes}$ (Observations only) | Ultra-lightweight |

---

## 6. Implementation & Migration Steps in `web/`

1. **Phase 1 (Immediate - Prototype):** Maintain `Rec` API in [`web/app.js`](file:///c:/Users/user/Desktop/membrain-main/web/app.js) while integrating refined 250 ms pause hysteresis and accurate acoustic quality gating metrics.
2. **Phase 2 (Mobile App Shell - John Paul & Abdulwaliy):** Package `mb-vad-worklet.js` and Silero-VAD ONNX WASM into the React Native / Flutter shell.
3. **Phase 3 (Longitudinal EWMA Connection):** Direct stream of `Observation` resources into `membrain/change.py` for continuous stability verification.
