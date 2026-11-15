# Arabic speech recognition benchmark: measured results

Run 2026-11-15 (FZJ HTCondor job 11591954, commit `30386a3`). Test audio: {'emirati_heldout': 103}. Normalisation is identical to the MemBrain scoring engine.

Keyword recall = share of MemBrain task words (word lists, fluency lexicons) spoken in the reference that the recogniser output contains. It is the metric that drives scores, so it matters more than overall WER.

| Model | emirati_heldout WER | emirati_heldout keyword recall |
|---|---|---|
| `hf:openai/whisper-small` | 55.2% | 73.7% |
| `hf:otozz/whisper-small-dialect_gulf` | 49.5% | 84.2% |
| `lora:otozz/whisper-small-dialect_gulf@runs/emirati-lora/best` | 41.2% | 73.7% |

**Paired bootstrap vs `hf:openai/whisper-small`** (2,000 resamples of utterances; negative = fewer errors):

| Model | Test set | WER difference | 95% CI | P(no improvement) |
|---|---|---|---|---|
| `hf:otozz/whisper-small-dialect_gulf` | emirati_heldout | -5.7% | -14.7% to +2.7% | 0.102 |
| `lora:otozz/whisper-small-dialect_gulf@runs/emirati-lora/best` | emirati_heldout | -13.9% | -22.5% to -6.8% | 0.000 |

**Paired bootstrap vs `hf:otozz/whisper-small-dialect_gulf`** (2,000 resamples of utterances; negative = fewer errors):

| Model | Test set | WER difference | 95% CI | P(no improvement) |
|---|---|---|---|---|
| `lora:otozz/whisper-small-dialect_gulf@runs/emirati-lora/best` | emirati_heldout | -8.3% | -16.9% to -1.2% | 0.011 |

Training log (epoch chosen on the sports validation category, 49 clips; test set scored once afterwards):

| | Validation WER |
|---|---|
| Starting model (otozz Gulf) | 57.3% |
| Epoch 1 | 51.4% |
| **Epoch 2 (selected)** | **44.4%** |
| Epoch 3 | 44.8% |

Per-category, per-dialect, per-age and per-education breakdowns are in `benchmark_results.json`. The production recogniser is chosen on its WORST subgroup, not the average.
