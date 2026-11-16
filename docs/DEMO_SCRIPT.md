# 3-minute demo video script

**0:00–0:20 · Problem.** "In Abu Dhabi, cognitive screening is starting from age 50. But a single score misleads. Fatima never went to school, so an education-blind test would refer her. Ahmed is slipping slowly, and annual screening would miss it for a year."

**0:20–1:05 · Participant app (Arabic).**
- Start Fatima's check-in in Arabic.
- Show the spoken instruction, the "repeat" button, larger text and the helper toggle.
- Run the hearing check, play the word list, and recall by voice (or a sample answer).
- Show the mood questions and the result: "steady compared with your own earlier results", plus her prevention plan (BP, glucose, hearing aid, walking after Maghrib).

**1:05–1:40 · Clinician dashboard.**
- Open Khalid: urgent. The informant questionnaire rose from 3.05 to 3.72 and there was a large decline.
- Show the trend chart, the drivers table with RCI and thresholds, the 90% uncertainty range, and the confounders checked.
- Show integrated context with consent chips (APOE visible only because genomics consent is on).
- Open the referral dossier and the FHIR bundle.
- Switch to Mariam: the decline was held because of low mood and poor sleep, and she was offered the mental-health pathway instead.

**1:40–2:00 · Navigator.**
- Start page → "I've noticed a change in memory or thinking" → the Gulf Arabic sample: the facts appear highlighted in the family's own words, are read back aloud and are confirmed. Then the "urgent" sample: the fall and slurred speech trigger the emergency banner, and no testing happens. Then "English: my own memory": the person raises the concern themselves, and the dossier shows it as their own account with what is still missing.
- Open Referrals: Ahmed's memory-clinic referral is tracked to "attended". Mariam missed her mental-health appointment, so she sits at the top of the worklist.
- New referral: the clinical pathway is chosen first, then a service she can reach; funding never removes the pathway. Show the Arabic next-steps pack.
- Enrolment with "sudden onset" ticked: an urgent review is created at once, with no testing first.

**2:00–2:30 · Validation.**
- Synthetic cohort of 2,000 people.
- Against education-blind usual care: sensitivity 83% vs 61%, PPV 58% vs 46%, referrals per confirmed finding 1.7 vs 2.2.
- False positives among people with no schooling drop from 44% to 7%.
- Scroll to the evidence pack: the results hold across 10 cohorts, confirmation and stratified norms do the most work, and the default was re-tested against stricter settings on fresh cohorts.
- Be honest: "this is a simulation of our pipeline, not clinical evidence. Small groups such as people with no schooling give unstable estimates, so Phase A deliberately over-recruits them."

**2:30–3:00 · Safety, deployment, pilot.**
- "It never diagnoses. Alerts are held for a clinician, explained, and audit-logged."
- FHIR R4, in-country hosting, and per-signal consent.
- Pilot route: IFHAS and the Longevity centres for Phase A, specialist centres for Phase B, under ethics approval while EDE classification is sought.
