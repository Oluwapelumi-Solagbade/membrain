# Speech recognition: benchmark and fine-tuning (existing models only)

We do **not** train a new model. We compare existing recognisers on Emirati speech, then adapt an existing Whisper checkpoint with LoRA, a small add-on trained on Emirati data, and keep it only if it measurably helps.

## Data (UAE / Gulf, open licences; checked 15 Nov 2026 on Hugging Face, recheck before publishing)

| Dataset | What | Licence | Role |
|---|---|---|---|
| `eabayed/EmiratiDialictShowsAudioTranscription` | 443 transcribed clips from Emirati TV, podcasts and YouTube (traditions, cars, health, games, sports, police) | AFL-3.0 | Train on traditions, cars and games; **sports is the validation set, used only to pick the epoch**; **health and police are the test set, scored once and never seen in training** |
| `otozz/gulf_train_set` / `gulf_test_set` | MASC corpus, Gulf partition, pre-processed for Whisper-small | CC-BY-4.0 | Extra Gulf training data |
| Team recordings | MemBrain task words read by consented speakers | team consent | Task-specific test (see `docs/asr/TEAM_RECORDING_PROTOCOL.md`) |
| `MBZUAI/MIXAT` (Emirati Arabic–English code-switching, MBZUAI) | – | licence unclear / non-commercial mirror | **Not used** until the licence is confirmed |

## Models compared
- `openai/whisper-small`: the original
- `otozz/whisper-small-dialect_gulf` (Apache-2.0): an existing Gulf fine-tune, which is our starting point
- our LoRA adapter on top of it
- Azure AI Speech, UAE North: already in the app

## Run it (Kaggle "GPU T4 x2" or Colab T4, about 1–2 hours)

```bash
git clone https://github.com/Oluwapelumi-Solagbade/membrain.git && cd membrain
pip install -r requirements.txt -r asr/requirements-asr.txt
huggingface-cli download eabayed/EmiratiDialictShowsAudioTranscription --repo-type dataset --local-dir data/emirati

# 1) fine-tune (LoRA on Emirati x3 + 2,000 MASC Gulf clips, 3 epochs)
python -m asr.finetune --emirati-root data/emirati --masc-limit 2000 --epochs 3 --out runs/emirati-lora

# 2) benchmark everything on the held-out Emirati categories (+ team clips if you have them)
export AZURE_SPEECH_KEY=...   # optional, adds Azure to the table; never commit it
python -m asr.benchmark --emirati-root data/emirati --team data/team \
  --models hf:openai/whisper-small hf:otozz/whisper-small-dialect_gulf \
           lora:otozz/whisper-small-dialect_gulf@runs/emirati-lora/best azure:uaenorth
```

This writes `docs/asr/BENCHMARK_RESULTS.md` and `benchmark_results.json`. Commit those, plus `runs/emirati-lora/metrics.json`; don't commit the audio or the adapter weights. Then replace the TBD tables in `docs/ARABIC_ASR_DIALECT_BENCHMARK.md` with the measured numbers.

**Compute:** use Kaggle or Colab unless your PI confirms in writing that the FZJ cluster may be used for this project.

## Results (15 Nov 2026, FZJ GPU)

Held-out Emirati test set: 103 clips from the health and police categories, never seen in training and scored once. The epoch was chosen beforehand on the sports category (49 clips): epoch 2, validation WER 44.4% (starting model 57.3%).

| Model | Test WER | Task-keyword recall (19 keywords) |
|---|---|---|
| openai/whisper-small | 55.2% | 73.7% (14/19) |
| otozz/whisper-small-dialect_gulf (starting point) | 49.5% | 84.2% (16/19) |
| **+ our LoRA (epoch 2, picked on validation)** | **41.2%** | 73.7% (14/19) |

Paired bootstrap, 2,000 resamples of clips:

- **LoRA vs the Gulf model we started from: −8.3 WER points, 95% CI −16.9 to −1.2, p = 0.011.** About 17% fewer word errors.
- LoRA vs original Whisper-small: −13.9 points, 95% CI −22.5 to −6.8, p < 0.001.
- The Gulf model vs original Whisper-small: −5.7 points, 95% CI −14.7 to +2.7 (not significant on this test set).

**Reproducibility.** Three earlier runs used the first protocol, which had no validation split. Their final epoch, fixed in advance, scored 43.4%, 43.5% and 43.4% on the same test set; the epoch picked on the test set scored 41.1–42.3%. The validation-split result (41.2%) falls in the same range, so the gain is stable across runs.

**Limitations.**
- Keyword recall did not improve: 14 of 19 task words against 16 of 19 for the starting model. With 19 keywords one or two words swing it by 5–10 points, so this is inconclusive, not evidence of harm. The deployed recogniser is still chosen on keyword recall measured on consented recordings of the MemBrain task words (`docs/asr/TEAM_RECORDING_PROTOCOL.md`).
- The test clips are adult broadcast speech (TV and podcasts), not adults aged 50–75 doing a cognitive test.
- One dialect (Emirati) and 103 clips. Per-dialect, per-age and per-education error rates come in Phase 1.
- Azure AI Speech (UAE North) is not yet in this table.

## How to read the result
- **Keyword recall** is the share of MemBrain task words the recogniser catches. It drives scores directly, so it decides the choice, alongside WER on the **worst** subgroup.
- The held-out Emirati set has 103 clips from a few shows, so differences of a couple of WER points are within noise. That is why every comparison carries a paired-bootstrap confidence interval.
- These clips are adult broadcast speech, not older adults with possible impairment. Phase 1 must re-measure on consented participant audio.

## Tested
`/tmp`-style smoke test (tiny random Whisper with a locally built tokenizer, so no downloads) covered: the real dataset format, the category split, featurising, LoRA, the training loop with falling loss, generation, WER, keyword recall and report writing. The first real run happens on the GPU machine.
