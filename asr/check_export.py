"""Check the exported (CTranslate2 int8) model on the same held-out Emirati test set as the benchmark, on CPU.
Confirms the conversion kept accuracy (benchmark: 41.2% WER with the PyTorch model) and measures CPU speed.

    python -m asr.check_export --model runs/membrain-whisper-gulf-ct2 --emirati-root data/emirati
"""
from __future__ import annotations

import argparse
import json
import pathlib
import time


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="runs/membrain-whisper-gulf-ct2")
    ap.add_argument("--emirati-root", default="data/emirati")
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--max-new-tokens", type=int, default=200)
    ap.add_argument("--out", default="docs/asr/EXPORT_CHECK.md")
    a = ap.parse_args(argv)
    from faster_whisper import WhisperModel
    from asr.data import emirati_shows
    from asr.metrics import keyword_recall, wer_cer
    test = emirati_shows(a.emirati_root)["test"]
    m = WhisperModel(a.model, device="cpu", compute_type="int8", cpu_threads=a.threads)
    hyps, audio_s, t0 = [], 0.0, time.time()
    for it in test:
        segs, info = m.transcribe(it["audio"].astype("float32"), language="ar", task="transcribe", beam_size=1,
                                  vad_filter=False, condition_on_previous_text=False, without_timestamps=True,
                                  max_new_tokens=a.max_new_tokens)
        hyps.append(" ".join(s.text.strip() for s in segs).strip()); audio_s += info.duration
    wall = time.time() - t0
    refs = [it["text"] for it in test]
    res = {**wer_cer(refs, hyps), **keyword_recall(refs, hyps), "n": len(test), "audio_seconds": round(audio_s, 1),
           "cpu_seconds": round(wall, 1), "real_time_factor": round(wall / max(audio_s, 1e-9), 3), "threads": a.threads}
    lines = ["# Exported speech model check (CTranslate2 int8, CPU)", "",
             f"Model `{a.model}` on the held-out Emirati test set (health and police, {res['n']} clips), greedy decoding, {a.threads} CPU threads.", "",
             "| | WER | Keyword recall | CPU time per second of audio |", "|---|---|---|---|",
             f"| Exported int8 model (CPU) | {res['wer']:.1%} | {res['keyword_recall']:.1%} | {res['real_time_factor']:.2f} s |",
             "| PyTorch model in the benchmark (GPU) | 41.2% | 73.7% | – |", "",
             f"{res['audio_seconds']} s of audio transcribed in {res['cpu_seconds']} s. A real-time factor below 1 means faster than speech."]
    pathlib.Path(a.out).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines)); print(json.dumps(res))


if __name__ == "__main__":
    main()
