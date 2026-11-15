"""Benchmark speech recognisers on held-out Emirati / Gulf Arabic and team recordings.

Models (any combination):
  hf:openai/whisper-small                       original model
  hf:otozz/whisper-small-dialect_gulf           existing Gulf fine-tune
  lora:otozz/whisper-small-dialect_gulf@runs/emirati-lora/best   our LoRA adapter
  azure:uaenorth                                Azure AI Speech (needs AZURE_SPEECH_KEY; locale from each clip's dialect)

    python -m asr.benchmark --emirati-root data/emirati --team data/team \
        --models hf:openai/whisper-small hf:otozz/whisper-small-dialect_gulf lora:otozz/whisper-small-dialect_gulf@runs/emirati-lora/best azure:uaenorth

Writes docs/asr/benchmark_results.json and docs/asr/BENCHMARK_RESULTS.md. Only open-licensed
or consented audio is used; nothing is retained by the script beyond the metrics and 5 example lines.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import time
from pathlib import Path

import numpy as np

from .metrics import by_group, keyword_recall, paired_bootstrap, wer_cer, word_errors

LOCALE = {"Emirati": "ar-AE", "Other Gulf": "ar-SA", "Egyptian": "ar-EG", "Levantine": "ar-LB", "English": "en-GB"}


def azure_transcribe(items: list[dict], region: str) -> list[str]:
    import httpx
    import soundfile as sf
    key = os.environ.get("AZURE_SPEECH_KEY")
    if not key:
        raise SystemExit("AZURE_SPEECH_KEY not set")
    out = []
    with httpx.Client(timeout=60) as c:
        for it in items:
            buf = io.BytesIO()
            sf.write(buf, it["audio"][: 16000 * 59], 16000, format="WAV", subtype="PCM_16")
            r = c.post(f"https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1",
                       params={"language": LOCALE.get(it.get("dialect"), "ar-AE")},
                       headers={"Ocp-Apim-Subscription-Key": key, "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000"},
                       content=buf.getvalue())
            out.append(r.json().get("DisplayText", "") if r.status_code == 200 else "")
            time.sleep(0.2)
    return out


def hf_transcribe(spec: str, items: list[dict], processor: str) -> list[str]:
    import torch
    from transformers import WhisperForConditionalGeneration

    from .finetune import build_processor, featurize, load_model, transcribe
    device = "cuda" if torch.cuda.is_available() else "cpu"
    proc = build_processor(processor)
    if spec.startswith("lora:"):
        base, adapter = spec[5:].split("@")
        model = load_model(base, 16, adapter=adapter)
    else:
        model = WhisperForConditionalGeneration.from_pretrained(spec[3:])
        model.config.forced_decoder_ids = None
    model.to(device)
    return transcribe(model, proc, featurize(proc, items), device)


def run(models: list[str], sets: dict[str, list[dict]], processor: str) -> dict:
    res = {}
    for m in models:
        res[m] = {}
        for name, items in sets.items():
            if not items:
                continue
            t0 = time.time()
            hyps = azure_transcribe(items, m.split(":")[1]) if m.startswith("azure:") else hf_transcribe(m, items, processor)
            refs = [i["text"] for i in items]
            rows = [{**{k: i.get(k) for k in ("category", "dialect", "age_band", "education")}, "ref": r, "hyp": h}
                    for i, r, h in zip(items, refs, hyps)]
            res[m][name] = {**wer_cer(refs, hyps), **keyword_recall(refs, hyps), "seconds": round(time.time() - t0, 1),
                            "by_category": by_group(rows, "category"), "by_dialect": by_group(rows, "dialect"),
                            "by_age_band": by_group(rows, "age_band"), "by_education": by_group(rows, "education"),
                            "examples": rows[:5],
                            "per_utterance": [{"id": i.get("id"), "errors": e, "ref_words": w}
                                              for i, (e, w) in zip(items, (word_errors(r, h) for r, h in zip(refs, hyps)))]}
            print(f"{m:60s} {name:16s} WER {res[m][name]['wer']:.3f}  keyword recall {res[m][name]['keyword_recall']}")
    # paired bootstrap of every model against every model listed before it
    # (so the fine-tune is compared both with the original and with its starting checkpoint)
    for j, m in enumerate(models):
        for base in models[:j]:
            for name in res[m]:
                if name not in res[base]:
                    continue
                a = [(u["errors"], u["ref_words"]) for u in res[base][name]["per_utterance"]]
                b = [(u["errors"], u["ref_words"]) for u in res[m][name]["per_utterance"]]
                if len(a) == len(b):
                    res[m][name]["vs_" + base] = paired_bootstrap(a, b)
    return res


def write_report(res: dict, out_dir: Path, meta: dict):
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "benchmark_results.json").write_text(json.dumps({"meta": meta, "results": res}, ensure_ascii=False, indent=1))
    sets = sorted({s for m in res.values() for s in m})
    lines = ["# Arabic speech recognition benchmark: measured results", "",
             f"Run {meta['date']}. Test audio: {meta['sets']}. Normalisation is identical to the MemBrain scoring engine.", "",
             "Keyword recall = share of MemBrain task words (word lists, fluency lexicons) spoken in the reference that the recogniser output contains. "
             "It is the metric that drives scores, so it matters more than overall WER.", "",
             "| Model | " + " | ".join(f"{s} WER | {s} keyword recall" for s in sets) + " |",
             "|---|" + "---|---|" * len(sets)]
    for m, r in res.items():
        cells = []
        for s in sets:
            x = r.get(s)
            cells += [f"{x['wer']:.1%}" if x else "–", f"{x['keyword_recall']:.1%}" if x and x["keyword_recall"] is not None else "–"]
        lines.append(f"| `{m}` | " + " | ".join(cells) + " |")
    for base in list(res):
        cmp = [(m, s_, r[s_]["vs_" + base]) for m, r in res.items() for s_ in r if ("vs_" + base) in r[s_]]
        if cmp:
            lines += ["", f"**Paired bootstrap vs `{base}`** (2,000 resamples of utterances; negative = fewer errors):", "",
                      "| Model | Test set | WER difference | 95% CI | P(no improvement) |", "|---|---|---|---|---|"]
            lines += [f"| `{m}` | {s_} | {c['diff']:+.1%} | {c['ci95'][0]:+.1%} to {c['ci95'][1]:+.1%} | {c['p_b_not_better']:.3f} |" for m, s_, c in cmp]
    lines += ["", "Per-category, per-dialect, per-age and per-education breakdowns are in `benchmark_results.json`. "
              "The production recogniser is chosen on its WORST subgroup, not the average."]
    (out_dir / "BENCHMARK_RESULTS.md").write_text("\n".join(lines) + "\n")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--emirati-root")
    ap.add_argument("--team")
    ap.add_argument("--masc-test-limit", type=int, default=0)
    ap.add_argument("--models", nargs="+", required=True)
    ap.add_argument("--processor", default="openai/whisper-small")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parents[1] / "docs" / "asr"))
    args = ap.parse_args(argv)
    from .data import emirati_shows, team_recordings
    sets = {}
    if args.emirati_root:
        sets["emirati_heldout"] = emirati_shows(args.emirati_root)["test"]
    if args.team:
        sets["team_task_words"] = team_recordings(args.team)
    res = run(args.models, sets, args.processor)
    write_report(res, Path(args.out), {"date": time.strftime("%Y-%m-%d"), "sets": {k: len(v) for k, v in sets.items()}, "models": args.models})


if __name__ == "__main__":
    main()
