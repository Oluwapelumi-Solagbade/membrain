# Navigator AI: family intake, referral drafting and release gates

Built on 15 November 2026, in response to the Navigator technical audit (Abdulwaliy, 15 Nov) and Jeremiah's *MemBrain Navigator Technical Documentation*. This document covers what was built, what was measured, and what is still open.

## 1. Product decision: two doors, one loop

The Navigator documentation makes version 1 *care navigation*, with verbal cognitive testing deferred to Phase 2. The challenge, however, asks for brain-health risk to be found **earlier**, and our measured speech evidence is for the voice check-in. The team chose a **two-door** design:

- **"I've noticed a change in memory or thinking"** (default, "start here"): whoever noticed the change describes it by voice or text. That can be the person themselves, a family member, a household helper, a healthcare professional or a programme coordinator. Who raised it is recorded with the concern, so a family member's account never silently becomes the person's own or a clinical finding. This is the Navigator entry.
- **"Check my own brain health"**: the 6-minute voice check-in for adults aged 50–75 in a programme.

Both doors lead to the same red-flag screen, the same clinician review queue and the same closed-loop referral tracking. Jeremiah's phases are unchanged as the pilot plan.

A significant concern goes to clinician review at intake, without waiting for any testing. Significant means two or more everyday activities now done by someone else, an informant questionnaire (IQCODE-16) above the cutoff, or a concern raised by a healthcare professional (`config.INTAKE_REVIEW_*`). Red flags still go to URGENT first. Otherwise the first check-in follows.

## 2. Family intake extractor

A narrative in Gulf Arabic or English is turned into reviewable facts. Each fact carries the exact words it came from (a character span) and a confidence:

- **concern domains:** memory, word-finding, orientation, money and planning, daily activities, mood, behaviour, sleep;
- **red flags:** the six in `config.RED_FLAGS`;
- **confounders:** new medication, recent illness, hearing, bereavement;
- **onset:** days, weeks, months or years;
- **who took over which activity:** the delegation timeline.

The family sees their words with each fact highlighted. They can untick anything wrong, and the app reads the summary back aloud in their language. A clinician confirms before any referral.

There are two extractors, with one output format:

| | Rules (`membrain/intake.py`, `web/intake.js`) | MedGemma (`api/navai.py`) |
|---|---|---|
| When | Always available; runs in the browser with no server | When `MEDGEMMA_URL` points to an in-country model server |
| How | Lexicons in English and Gulf Arabic, Arabic letter normalisation, negation rules | Fixed JSON schema prompt |
| Guarantees | Every field quotes the narrative | Fields whose quote is not found in the narrative are **dropped**. Red flags are the **union** with the rules, so the model can add but never remove one. |

Red flags are tuned to catch too much rather than miss one. Any red flag, at any confidence, shows the emergency-protocol banner and stops testing.

## 3. Referral drafting and the grounding verifier

The referral reason is drafted from **confirmed facts only**: the clinician-confirmed intake and the latest check-in result. A deterministic verifier then checks every sentence (`intake.verify_referral`). It rejects:

- any diagnosis word (dementia, Alzheimer, MCI, "diagnosis" except in "no diagnosis has been made");
- any number that is not in the record;
- any quote that is not in the narrative;
- any claim (a domain, red flag, confounder, activity, person or onset) that was not confirmed.

Absence claims such as "no falls were reported" pass. The engine's own check-in reason is treated as source text.

- **Template drafts:** 0 of 50 gold drafts contain a blocked sentence.
- **MedGemma drafts:** failing sentences are removed before the clinician sees them.
- **Clinician edits:** marked as the clinician's own and not machine-checked. If they name a diagnosis, the clinician is warned.

## 4. Measured results (held-out test set)

The gold set (`navai/gold/`) contains 50 synthetic caregiver narratives, written by the team in Gulf Arabic and English:

- 20 development narratives, used to tune the rules;
- **30 test narratives, frozen (SHA-256 in `test.sha256`, checked by a unit test) before the rules were tuned** and scored once.

| Release gate | Target | Rules extractor | MedGemma 4B |
|---|---|---|---|
| Concern-domain macro F1 | ≥ 0.90 | 0.849 ✗ | FZJ run pending |
| Macro F1, worst language (Arabic) | ≥ 0.85 | 0.834 ✗ | |
| Delegation timeline exact match | ≥ 0.80 | 0.70 ✗ | |
| Urgent red-flag recall | ≥ 0.99 | 12/12 ✓ (0 false alarms in 18) | |
| Unsupported field rate | < 1% | n/a (0 of 0 checked) | |
| p95 latency | < 5 s | 0.002 s ✓ | |

**Reading this honestly:**

- **The rules pass the measurable safety gates (red-flag recall, latency) and fail the accuracy gates.** That is the case for evaluating MedGemma, and the reason the rules remain the always-on fallback.
- **The unsupported-field gate does not apply to the rules.** Every rule field quotes the narrative by construction, so there is nothing to drop and the rate is 0 of 0. It is reported as n/a rather than a pass. The gate becomes a real measurement on the MedGemma run, where unquoted fields are counted and dropped.
- **The urgent-recall gate isn't really demonstrated yet.** 12/12 only shows recall above 0.76 (Wilson 95% lower bound). Showing 0.99 needs about 300 red-flag narratives with none missed, which is a Phase A task.
- **Onset exact match is 0.63.** Common misses are day names ("since Tuesday") and months ("since March").
- **The narratives are synthetic and written by the team**, so real caregiver speech will be harder. Native-speaker review of the Arabic narratives and lexicons (Emirati, other Gulf) is pending.

Full error lists are in `docs/navai/RESULTS_rules_test.json`. Reproduce with `python -m navai.evaluate --set test`.

## 5. MedGemma run on the FZJ cluster

`navai/medgemma_eval.py` runs `google/medgemma-4b-it` on both sets with the same metrics. It also measures:

- the effect of adding the rule red flags;
- the share of MedGemma referral sentences blocked by the verifier.

It writes `docs/navai/RESULTS.md` and `RESULTS_medgemma.json`. The app's Validation tab shows them after `make web`. Only synthetic data is used (Zone 0).

Steps:

1. Accept the MedGemma terms on Hugging Face.
2. Run `hf auth login`.
3. Submit with `condor_submit navai/navai.submit`.

The 27B model drafter in the documentation is left for Phase 1. The 4B model plus the deterministic verifier already provides the safety property the 27B model was meant to give, which is that no unsupported sentence reaches a clinician.

## 6. Directory capacity and search

Each service now has `capacity_per_month` and `accepting_referrals`. A service that is not accepting referrals is still shown, with the barrier "not accepting referrals", but it is not preselected. The clinical pathway is never removed. The Referrals tab has a free-text search over name, area, pathway, language and funding. Semantic search (BGE-M3 and pgvector) is Phase 3 with the PostgreSQL migration.

## 7. Not done (and why)

- **PostgreSQL and pgvector migration:** Phase 3, as in the audit roadmap.
- **Next-steps pack in Urdu, Hindi, Tagalog and Malayalam:** needs professional translation and review. Machine translation of safety text is not acceptable.
- **Zone 0 synthetic pipeline (15,000 pairs) and MedGemma LoRA:** only if the 4B base model misses the gates, and only after Phase 0 pathway discovery.
- **ISO 14971 hazard log and IEC 62304 documentation:** ongoing, outside the prototype.
