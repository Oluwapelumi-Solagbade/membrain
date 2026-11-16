# Exported speech model check (CTranslate2 int8, CPU)

Model `runs/membrain-whisper-gulf-ct2` (MemBrain Gulf Whisper: LoRA merged into otozz/whisper-small-dialect_gulf, `openai/whisper-small` tokenizer) on the held-out Emirati test set (health and police, 103 clips). Greedy decoding, 4 CPU threads, FZJ juseless, 16 Nov 2026.

| | WER | Keyword recall | CPU time per second of audio |
|---|---|---|---|
| Exported int8 model (CPU) | 38.0% | 79.0% (15/19) | 0.20 s |
| PyTorch model in the benchmark (GPU) | 41.2% | 73.7% (14/19) | – |

1,288.7 s of audio were transcribed in 252.9 s (real-time factor 0.196). A 10-second spoken answer takes about 2 seconds on 4 ordinary CPU cores, so no GPU is needed in production.

The model is the same; the slightly lower error comes from the server's decoding settings (no timestamps, greedy). We report it as "accuracy preserved (38–41% WER)", not as an improvement; no confidence interval was computed for the difference. Character error rate 17.1%.
