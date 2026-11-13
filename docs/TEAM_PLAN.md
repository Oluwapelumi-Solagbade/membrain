# Team plan: 13 → 20 November 2026 (submission due 20 Nov)

The working prototype, engine, API, tests, validation pipeline and technical documentation already exist in this repo. The rest of the week goes on clinical credibility, polish, evidence and the pitch.

| # | Deliverable | Owner | Support | Due |
|---|---|---|---|---|
| 1 | Project overview document (problem, users, six requirements, pilot partners, business model) | Jeremiah | Oluwapelumi | Fri 14 Nov, before the 9 pm meeting |
| 2 | Clinical review of thresholds, triage table, reversible-cause list, prevention rules and patient messages (sign-off list in `docs/`) | Jeremiah + Oluwapelumi | – | Sat 15 Nov |
| 3 | Arabic item review: word lists, stories, judgement items and fluency lexicons, per dialect. Native speakers on the team or network. | Jeremiah | Abdulwaliy | Sat 15 Nov |
| 4 | Data sources: confirm access, apply for DementiaBank / ADReSS today, pull Common Voice Arabic | Oluwapelumi | Jeremiah | Sat–Sun 15–16 Nov |
| 5 | ML on FZJ cluster: threshold sensitivity sweep + decision curve; voice-feature model if data arrives; ASR WER per dialect | Oluwapelumi | Abdulwaliy | Tue 18 Nov |
| 6 | UI/app: polish web demo, mobile layout, React Native/Flutter shell of the participant app using `web/engine.js`, deploy API (Render/Fly/Railway) | John Paul | Claude | Tue 18 Nov |
| 7 | Signal processing: replace browser VAD with openSMILE/Praat feature spec; on-device feature extraction design doc (`VOICE_FEATURE_SPEC.md`, `ON_DEVICE_VOICE_DESIGN.md`, `ARABIC_ASR_DIALECT_BENCHMARK.md`) | Abdulwaliy | Oluwapelumi | ✅ Complete (ahead of Mon 17 Nov) |
| 8 | Create GitHub repo, push code, README badges, licence | John Paul | Oluwapelumi | Fri 14 Nov |
| 9 | Demo video (3 min, script in `DEMO_SCRIPT.md`) | Oluwapelumi (voice) + John Paul (recording) | All | Wed 19 Nov |
| 10 | Final submission pack: prototype link, repo, technical doc, assumptions and limitations, video | Oluwapelumi | All | Thu 19 Nov (one day buffer) |
| 11 | Submit | Oluwapelumi | – | **Thu 19 Nov evening** (deadline 20 Nov) |

**Daily stand-up:** 9 pm on WhatsApp, 15 minutes. Each person answers: done, next, blocked.
**Freeze rule:** no new features after Wed 19 Nov 12:00, only fixes.
