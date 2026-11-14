# What runs on the device and what runs in the cloud

Draft for Jeremiah's architecture diagram (meeting 14 Nov). Diagram source: `docs/architecture_device_cloud.mmd`; rendered image: `docs/architecture_device_cloud.png`.

## The rule

**Anything that is raw and identifying stays on the device. Anything that needs the whole history, other people's data, or clinician access runs in the in-country cloud. Nothing leaves the UAE.**

## Component split

| Component | Where | Why |
|---|---|---|
| Spoken prompts (pre-recorded by native speakers), captions, UI | Device | Works offline; no data sent |
| Pre-session check (volume, room noise, hearing and vision self-check) | Device | Immediate feedback to the person |
| Audio capture, 16 kHz mono | Device | Raw voice is the most identifying signal |
| Audio quality gate (SNR, clipping, speech ratio, duration) | Device | Ask for a repeat before the person leaves |
| Acoustic features: speech rate, pauses, pitch, loudness (openSMILE eGeMAPS subset) | Device | Only numbers leave the phone, not the voice |
| Offline queue and resumable sessions | Device | Patchy connectivity, low-end Android |
| Speech-to-text (ASR) for scoring recall, fluency and story tasks | **Cloud, in-country** (pilot) → device later | Dialect-aware models are too large for low-end phones today. Audio is sent encrypted, transcribed and then deleted, unless raw-audio consent was given. |
| Transcript scoring (word matching, fluency lexicon, story units) | Cloud | Versioned item bank and scoring rules, auditable |
| Linguistic features (lexical diversity, idea density, word-finding hesitations) | Cloud | Needs the transcript and Arabic NLP (CAMeL Tools) |
| Norms, baseline, reliable change, confounder rules, triage | Cloud | Needs the full history and versioned norms. The same engine also runs in the browser for the demo (parity-tested). |
| Prevention rules and participant messages | Cloud, cached on device | Clinician-approved, versioned content |
| Clinician dashboard, review tasks, referral dossier | Cloud | Role-based access, audit |
| Identity vault (name, Emirates ID, phone, informant) | Cloud, separate store with its own keys | Re-identification for follow-up only, with a reason, audited |
| FHIR R4 store, consent service, audit log, key management | Cloud | Interoperability and governance |
| Model training and research analysis (threshold sweeps, voice-biomarker studies) | Research environment on pseudonymised data. Synthetic data only outside the UAE until the partner and authorities approve. | Data residency |

## Speech stack: what we use for what

Whisper and openSMILE are not alternatives. They do different jobs:

| Job | Tool | Notes |
|---|---|---|
| Turn speech into words (needed to score word recall, fluency, story recall) | ASR. Candidates: Whisper-large-v3 or turbo, self-hosted in-country; an Arabic-specialised open model; a commercial Arabic ASR hosted in the UAE as a benchmark | The concern with Whisper is not the model. It is sending audio to a foreign API, so we **self-host** the open weights in-country. Choose on **worst-subgroup word error rate** (dialect × age × education) using our own consented recordings. |
| Describe how someone speaks (voice biomarkers, exploratory) | openSMILE (eGeMAPS) or Praat | Runs on the device or in the cloud. Standard, reproducible feature sets. |
| Who is speaking (separate the caregiver's voice from the participant's) | Lightweight speaker diarisation (pyannote, self-hosted) | Helper speech is excluded from scoring. |
| Voice-activity detection for the quality gate | WebRTC VAD or Silero VAD on the device | Already approximated in the prototype with an energy threshold. |

## Fine-tuning plan (Abdulwaliy and Oluwapelumi)

1. **Benchmark first, fine-tune second.** Measure word error rate per dialect on Common Voice Arabic and MGB-3 dialect sets, then on the first consented pilot recordings.
2. **Fine-tune only if the worst subgroup misses the target.** Fine-tune on consented, dialect-specific recordings with separate model-training consent, inside the UAE.
3. **Voice biomarkers stay exploratory.** Pre-specify the analysis. A biomarker drives alerts only if it meets accuracy and stability criteria in every language and dialect subgroup.

## Scope decisions to confirm with the team

| Topic | Proposal |
|---|---|
| Genomics | **Keep, but only as a consent-gated input of existing results** (for example from a national genomics programme). No sequencing or sample collection in our scope. Already built this way. |
| Air pollution | Record **home district** at enrolment (built). Later, link to district-level air-quality data as context and for planning. |
| GIS surveillance | **Later module.** District-level, aggregated, anonymised maps of risk-factor burden and alert rates for programme planning. Mention in the pitch as the population-health extension; do not build before 20 Nov. |
| Enrolment flow | **Built 14 Nov.** Identity vault, consent for each data type, informant, health context, session plan, audited re-identification. |
| Shared accounts | Move the repo to a GitHub organisation called "Cerebro Spark" so it carries the team identity (Settings → Transfer ownership). Azure: in-country UAE region for any hosted component. |
