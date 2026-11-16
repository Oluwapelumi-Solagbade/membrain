"""Turn the trained LoRA adapter into a fast, self-contained model the API can serve on CPU.

    python -m asr.export_model --base otozz/whisper-small-dialect_gulf --adapter runs/emirati-lora/best \
        --out runs/membrain-whisper-gulf-ct2 [--push Vulcan-Spark/membrain-whisper-gulf-ct2]

Steps: load the base Whisper, merge the LoRA weights into it, save it with its tokenizer and feature extractor,
then convert to CTranslate2 int8 (faster-whisper format). The result runs in api/asr_local.py on an ordinary CPU
container. --push uploads it to a PRIVATE Hugging Face repo so the in-country server can download it.
Licences carried with the model: Whisper (MIT), otozz Gulf model (Apache-2.0), training data AFL-3.0 and CC-BY-4.0
(MASC: attribution required; see asr/README.md).
"""
from __future__ import annotations

import argparse
import json
import pathlib
import shutil


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="otozz/whisper-small-dialect_gulf")
    ap.add_argument("--processor", default="openai/whisper-small",
                    help="tokenizer + feature extractor; must be the one used in training and the benchmark")
    ap.add_argument("--adapter", default="runs/emirati-lora/best")
    ap.add_argument("--out", default="runs/membrain-whisper-gulf-ct2")
    ap.add_argument("--quantization", default="int8")
    ap.add_argument("--push", default=None, help="private Hugging Face repo id to upload to")
    ap.add_argument("--allow-small-vocab", action="store_true", help=argparse.SUPPRESS)   # tiny test models only
    a = ap.parse_args(argv)

    from ctranslate2.converters import TransformersConverter
    from peft import PeftModel
    from transformers import WhisperForConditionalGeneration, WhisperProcessor, WhisperTokenizerFast

    out = pathlib.Path(a.out)
    merged = out.parent / (out.name + "-merged-hf")
    base = WhisperForConditionalGeneration.from_pretrained(a.base)
    model = PeftModel.from_pretrained(base, a.adapter).merge_and_unload()
    model.save_pretrained(merged)
    proc = WhisperProcessor.from_pretrained(a.processor)
    tok_n = len(proc.tokenizer)
    if not a.allow_small_vocab and (tok_n < 51865 or not proc.tokenizer.encode(" -", add_special_tokens=False)):
        raise SystemExit(f"tokenizer from {a.processor} looks incomplete ({tok_n} tokens); use openai/whisper-small")
    proc.save_pretrained(merged)
    proc.feature_extractor.save_pretrained(merged)   # preprocessor_config.json (newer transformers bundle it otherwise)
    WhisperTokenizerFast.from_pretrained(merged).save_pretrained(merged)   # faster-whisper needs tokenizer.json
    if out.exists():
        shutil.rmtree(out)
    TransformersConverter(str(merged), copy_files=["tokenizer.json", "preprocessor_config.json"]).convert(
        str(out), quantization=a.quantization)
    (out / "MEMBRAIN_MODEL.json").write_text(json.dumps({
        "name": "membrain-whisper-gulf", "base": a.base, "adapter": a.adapter, "quantization": a.quantization,
        "measured": "41.2% WER on 103 held-out Emirati clips (vs 49.5% for the base); see docs/asr/BENCHMARK_RESULTS.md",
        "licences": ["openai/whisper: MIT", "otozz/whisper-small-dialect_gulf: Apache-2.0",
                     "eabayed/EmiratiDialictShowsAudioTranscription: AFL-3.0", "MASC (otozz/gulf_train_set): CC-BY-4.0"]}, indent=1))
    print("exported", out, sorted(p.name for p in out.iterdir()))
    if tok_n >= 51865:   # real Whisper vocabulary: the converted model must load as multilingual
        from faster_whisper import WhisperModel
        wm = WhisperModel(str(out), device="cpu", compute_type="int8")
        if not wm.model.is_multilingual:
            raise SystemExit("exported model is not multilingual: tokenizer/vocabulary mismatch")
        print("self-check: loads as multilingual, vocabulary", tok_n)
    if a.push:
        from huggingface_hub import HfApi
        api = HfApi()
        api.create_repo(a.push, private=True, exist_ok=True)
        api.upload_folder(folder_path=str(out), repo_id=a.push)
        print("uploaded to private repo", a.push)


if __name__ == "__main__":
    main()
