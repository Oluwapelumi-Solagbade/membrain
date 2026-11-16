# Navigator AI: family intake, referral drafting and release gates

Built on 15 November 2026, in response to the Navigator technical audit (Abdulwaliy, 15 Nov) and Jeremiah's *MemBrain Navigator Technical Documentation*. This document covers what was built, what was measured, and what is still open.

## 1. Product decision: two doors, one loop

The Navigator documentation makes version 1 *care navigation*, with verbal cognitive testing deferred to Phase 2. The challenge, however, asks for brain-health risk to be found **earlier**, and our measured speech evidence is for the voice check-in. The team chose a **two-door** design:

- **"I'm worried about someone"** (default, "start here"): a family member or household helper describes what they have noticed, by voice or text. This is the Navigator entry.
- **"Check my own brain health"**: the 6-minute voice check-in for adults aged 50–75 in a programme.

Both doors lead to the same red-flag screen, the same clinician review queue and the same closed-loop referral tracking. Jeremiah's phases are unchanged as the pilot plan.

## 2. Family intake extractor

A narrative in Gulf Arabic or English is turned into reviewable facts. Each fact carries the exact words it came from (a character span) and a confidence:

- **concern domains:** memory, word-finding, orientation, money and planning, daily activities, mood, behaviour, sleep;
- **red flags:** the six in `config.RED_FLAGS`;
- **confounders:** new medication, recent illness, hearing, bereavement;
- **onset:** days, weeks, months or years;
- **who took over which activity:** the delegation timeline.

The reporter is recorded: the person themselves, a family member, a household helper, a healthcare professional or a programme coordinator. The reporter sees their words with each fact highlighted, unticks anything that isn't what they meant, and hears the summary read back. Ticked facts are kept as **that person's report, not as clinical facts**. The clinician view shows them under "Reported concern (reported, not clinically verified)", next to the original words.

**Significant concern goes straight to review.** A memory or thinking concern combined with loss of everyday independence (at least one activity now done by someone else), or one raised by a healthcare professional, goes to clinician review at intake. It does not wait for a baseline. The review stays open in the queue until a clinician marks it reviewed, even if a check-in happens first. This rule is provisional and needs Jeremiah's clinical sign-off (`config.CONCERN_*`).

There are two extractors, with one output format:

| | Rules (`membrain/intake.py`, `web/intake.js`) | MedGemma (`api/navai.py`) |
|---|---|---|
| When | Always available; runs in the browser with no server | When `MEDGEMMA_URL` points to an in-country model server |
| How | Lexicons in English and Gulf Arabic, Arabic letter normalisation, negation rules | Fixed JSON schema prompt |
| Guarantees | Every field quotes the narrative | Fields whose quote is not found in the narrative are **dropped**. Red flags are the **union** with the rules, so the model can add but never remove one. |

Red flags are tuned to catch too much rather than miss one. Any red flag, at any confidence, shows the emergency-protocol banner and stops testing.

## 3. Referral drafting and the grounding verifier

The referral reason is drafted **only from facts the reporter checked and the latest check-in result**. Each sentence names who reported it ("A household helper reports…"). A deterministic verifier then checks every sentence (`intake.verify_referral`). It rejects:

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

| Release gate | Target | Rules extractor | MedGemma 4B (as is) | MedGemma + rule red flags |
|---|---|---|---|---|
| Concern-domain macro F1 | ≥ 0.90 | 0.849 ✗ | 0.515 ✗ | 0.515 ✗ |
| Macro F1, worst language | ≥ 0.85 | 0.834 ✗ | 0.479 ✗ | 0.479 ✗ |
| Delegation timeline exact match | ≥ 0.80 | 0.70 ✗ | 0.20 ✗ | 0.20 ✗ |
| Urgent red-flag recall | ≥ 0.99 | 12/12 ✓ (0 false alarms in 18) | 5/12 ✗ | 12/12 ✓ |
| Unsupported field rate | < 1% | n/a (0 of 0 checked) | 52% ✗ (dropped) | 52% ✗ (dropped) |
| p95 latency | < 5 s | 0.002 s ✓ | 27 s ✗ | 27 s ✗ |

**Reading this honestly:**

- **The rules pass the safety gates but not the accuracy gates.**
- **The unsupported-field gate does not apply to the rules.** Every rule field quotes the narrative by construction, so nothing can be dropped and the rate is 0 of 0. It is reported as n/a rather than a pass (`navai/evaluate.py`).
- **MedGemma 4B, used as is with one prompt, did worse than the rules on every gate.** On its own it caught only 5 of 12 urgent cases. About half of what it returned (125 of 239 items) had no real quote in the narrative, so the grounding check dropped it. It took 27 s at the 95th percentile. **It is not used in the product.** The rules extractor is the default, and the MedGemma endpoint stays off unless a server is configured.
- **The safety design held under a weak model.** With the rule red flags added, urgent recall went back to 12/12. Nothing unsupported reached the output.
- **The referral checker caught additions in practice.** It blocked 14 of 120 MedGemma referral sentences, mostly "memory" added when memory was not reported. Only 16 of 30 drafts came through clean. Template drafts: 0 blocked.
- **Why it failed (hypotheses to test, not conclusions):**
  - MedGemma 4B is tuned mainly for English medical images and text, not Gulf Arabic caregiver speech.
  - It paraphrases or translates its evidence instead of quoting.
  - One prompt, no examples, greedy decoding.
- **Planned next steps:**
  - few-shot prompting;
  - constrained JSON output;
  - a LoRA adapter trained on synthetic (Zone 0) and then consented Phase 1 narratives;
  - comparison with a larger or Arabic-strong model;
  - every candidate held to the same gates.
- **The urgent-recall gate isn't really demonstrated yet.** 12/12 only shows recall above 0.76 (Wilson 95% lower bound). Showing 0.99 needs about 300 red-flag narratives with none missed, which is a Phase 1 task.
- **Onset exact match is 0.63.** Common misses are day names ("since Tuesday") and months ("since March").
- **The narratives are synthetic and written by the team**, so real caregiver speech will be harder. Native-speaker review of the Arabic narratives and lexicons (Emirati, other Gulf) is pending.

Full error lists are in `docs/navai/RESULTS_rules_test.json`. Reproduce with `python -m navai.evaluate --set test`.

## 5. MedGemma run on the FZJ cluster (done 15 Nov; results in section 4 and `docs/navai/RESULTS.md`)

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
