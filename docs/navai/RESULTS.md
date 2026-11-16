# Navigator AI: measured results (2026-11-15)

Model: `google/medgemma-4b-it` · extractor rules `intake-0.1.0` (rules column updated to `intake-0.2.0`, 2026-11-16) · synthetic narratives only (Zone 0). Run on FZJ juseless (RTX PRO 4000 Blackwell, transformers, bf16, greedy decoding, one prompt). Full per-narrative output stays on the cluster; the numbers are in `RESULTS_medgemma_summary.json`.

## dev set (n = 20)

| Release gate | Target | Rules (fallback) | MedGemma | MedGemma + rule red flags |
|---|---|---|---|---|
| Concern-domain macro F1 | >= 0.9 | 0.979 ✓ | 0.468 ✗ | 0.468 ✗ |
| Macro F1 in the worst language | >= 0.85 | 0.975 ✓ | 0.459 ✗ | 0.459 ✗ |
| Delegation timeline exact match | >= 0.8 | 0.625 ✗ | 0.0 ✗ | 0.0 ✗ |
| Urgent red-flag recall (any red flag) | >= 0.99 | 1.0 ✓ | 0.5 ✗ | 1.0 ✓ |
| Unsupported field rate | < 0.01 | 0.0 ✓ | 0.5068 ✗ | 0.5068 ✗ |
| p95 latency (seconds) | < 5.0 | 0.001 ✓ | 19.663 ✗ | 19.663 ✗ |

Urgent cases caught: rules 4/4, MedGemma 2/4, combined 4/4. Onset exact: rules 0.8, MedGemma 0.6. MedGemma items dropped by grounding: 74/146.

Referral drafting: 15 of 80 MedGemma sentences blocked by the verifier; 8/20 drafts fully grounded. Template drafts: 0 blocked sentences.

## test set (n = 30)

| Release gate | Target | Rules (fallback) | MedGemma | MedGemma + rule red flags |
|---|---|---|---|---|
| Concern-domain macro F1 | >= 0.9 | 0.854 ✗ | 0.515 ✗ | 0.515 ✗ |
| Macro F1 in the worst language | >= 0.85 | 0.846 ✗ | 0.479 ✗ | 0.479 ✗ |
| Delegation timeline exact match | >= 0.8 | 0.7 ✗ | 0.2 ✗ | 0.2 ✗ |
| Urgent red-flag recall (any red flag) | >= 0.99 | 1.0 ✓ | 0.417 ✗ | 1.0 ✓ |
| Unsupported field rate | < 0.01 | 0.0 ✓ | 0.523 ✗ | 0.523 ✗ |
| p95 latency (seconds) | < 5.0 | 0.001 ✓ | 27.29 ✗ | 27.29 ✗ |

Urgent cases caught: rules 12/12, MedGemma 5/12, combined 12/12. Onset exact: rules 0.633, MedGemma 0.267. MedGemma items dropped by grounding: 125/239.

Referral drafting: 14 of 120 MedGemma sentences blocked by the verifier; 16/30 drafts fully grounded. Template drafts: 0 blocked sentences. Blocked sentences were mostly "memory" added when memory was not reported (8), then "safety", "conversation" and "daily activities" (2 each).

With 12 urgent cases, 12/12 still only shows recall above about 0.76 (Wilson 95% lower bound). Showing 0.99 needs about 300 red-flag narratives with none missed; that is a Phase 1 task.
