# 3-minute demo video script

**0:00–0:20 · Problem.** "In Abu Dhabi, cognitive screening is starting from age 50. But a single score misleads. Fatima never went to school, so an education-blind test would refer her. Ahmed is slipping slowly, and annual screening would miss it for a year."

**0:20–1:05 · Participant app (Arabic).**
- Start Fatima's check-in in Arabic.
- Show the spoken instruction, the "repeat" button, larger text and the helper toggle.
- Run the hearing check, play the word list, and recall by voice (or a sample answer).
- Show the mood questions and the result: "steady compared with your own earlier results", plus her prevention plan (BP, glucose, hearing aid, walking after Maghrib).

**1:05–1:50 · Clinician dashboard.**
- Open Khalid: urgent. The informant questionnaire rose from 3.05 to 3.72 and there was a large decline.
- Show the trend chart, the drivers table with RCI and thresholds, the 90% uncertainty range, and the confounders checked.
- Show integrated context with consent chips (APOE visible only because genomics consent is on).
- Open the referral dossier and the FHIR bundle.
- Switch to Mariam: the decline was held because of low mood and poor sleep, and she was offered the mental-health pathway instead.

**1:50–2:30 · Validation.**
- Synthetic cohort of 2,000 people.
- Against education-blind usual care: sensitivity 83% vs 61%, PPV 59% vs 46%, referrals per confirmed finding 1.7 vs 2.2.
- False positives among people with no schooling drop from 44% to 7%.
- Be honest: "this is a simulation of our pipeline, not clinical evidence. And it already shows a sensitivity gap for people with no formal education, which is the first job of Phase A."

**2:30–3:00 · Safety, deployment, pilot.**
- "It never diagnoses. Alerts are held for a clinician, explained, and audit-logged."
- FHIR R4, in-country hosting, and per-signal consent.
- Pilot route: IFHAS and the Longevity centres for Phase A, specialist centres for Phase B, under ethics approval while EDE classification is sought.
