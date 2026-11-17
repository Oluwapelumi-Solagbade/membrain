---
title: MemBrain MedGemma
emoji: 🩺
colorFrom: green
colorTo: indigo
sdk: gradio
sdk_version: 6.32.0
app_file: app.py
pinned: false
---

MedGemma 4B drafting service for MemBrain (team Cerebro Spark). It drafts short referral letters for a clinician from
confirmed facts only; MemBrain's verifier removes any sentence with a diagnosis or an unsupported claim, and a clinician
edits and approves every letter. Requests need the MemBrain key. Not a medical device; never diagnoses.
