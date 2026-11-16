# MemBrain Navigator layer: from alert to completed care

Built on 14 November from Jeremiah's *MemBrain Navigator* document. MemBrain finds a meaningful change and explains it; the Navigator layer makes sure the person is not lost between the alert and the appointment.

## What it adds

| Function | Where |
|---|---|
| **Two-door start page.** "I've noticed a change" (concern intake from the person, family, a helper or a clinician; the default) and "Check my own brain health" (voice check-in) lead to the same red-flag screen, review queue and referral loop. | Start tab |
| **Concern intake by voice or text, with who raised it** (Gulf Arabic, English). Facts are shown with the words they came from and a confidence, read back aloud, and confirmed before enrolment. See `NAVIGATOR_AI.md`. | Raise a concern tab, `intake.py`, `/api/intake/extract` |
| **Referral reason drafter and grounding verifier.** Drafted from confirmed facts only. Every sentence is checked; diagnosis words, invented numbers and unconfirmed claims are blocked. Clinician edits are tracked. | Referral dialog, `intake.verify_referral` |
| **Concern-led entry.** Enrolment starts with how the person came to us (programme screening, primary care clinician, family member, household helper) and what was noticed. | Enrolment step 1 |
| **Red-flag screen before any testing.** Sudden onset, fluctuating confusion, new neurological symptoms, a fall or head injury, rapid worsening, or a safety risk goes straight to an **urgent review** under the emergency protocol. There is no waiting for repeat tests. | `config.RED_FLAGS`, `triage.py` (intake record), enrolment |
| **First-visit review.** A very low first score (composite z ≤ −2.0 for age and education) goes to clinician review without waiting for a 2-session baseline. | `config.FIRST_VISIT_REVIEW_Z` |
| **Household helpers as informants.** Separate consent, a language they understand, and never shared with an employer. | Enrolment, Informant step |
| **Functional change timeline.** For each change: what changed, when, who took over and why. This is context, not automatic evidence of decline. | Enrolment, clinician view |
| **Service directory** with pathways, languages, funding routes, waiting time, monthly capacity, whether it is accepting referrals, and a "last verified" date. Free-text search in the Referrals tab. Anything not re-verified in 90 days is flagged. | `navigator.directory()` (synthetic entries), Referrals tab |
| **Matching:** the clinical pathway comes first, then accessibility. Funding never removes a clinically needed pathway. If nothing is accessible, a **pathway gap** is recorded and escalated. | `navigator.match_services()` |
| **Closed-loop referral tracking:** recommended → sent → accepted or declined → appointment offered → attended or missed → assessment completed → follow-up documented. Declined, missed, lost and no-accessible-service states need a reason and stay visible. | `navigator.TRANSITIONS`, clinician view, Referrals tab |
| **Next-steps pack** in Arabic and English: what has and has not been established, where to go, what to bring, supporting independence, urgent warning signs (ambulance 998), and caregiver support. | `navigator.next_steps_pack()` |
| **Programme metrics:** completion and acceptance rates, days from concern to review, days from referral to assessment, open referrals, reasons for non-completion, pathway gaps. Broken down by entry route, language, funding, sex and age band. | `navigator.programme_metrics()`, Referrals tab |
| **FHIR:** each referral becomes a `ServiceRequest`, with its state as an extension and history as notes. | `fhir.service_request()` |

## Scope position for the submission

We submit **MemBrain + Navigator** for Challenge 08. The six challenge requirements stay fully addressed: longitudinal change detection, integrated risk context and validation metrics are working. Jeremiah's phased plan (Phase 0 pathway discovery → Phase 1 navigation MVP → Phase 2 assessment validation → Phase 3 pathway evaluation) is our **pilot implementation plan**.

## Principles carried over from the Navigator document

- Thresholds are set by evidence and validation, not by how many people a clinic can review. Review capacity shows up as a visible backlog.
- A referral is not a success until the assessment is completed and follow-up is documented.
- A low mood or sleep score does not close the cognitive pathway if a significant concern is present.
- Directory entries in this repository are synthetic placeholders named so they cannot be mistaken for real providers.
