"""LoRA fine-tuning of an EXISTING Whisper model for Emirati / Gulf Arabic.

We do not build a new model. We start from an open checkpoint
(default: otozz/whisper-small-dialect_gulf, Apache-2.0, itself openai/whisper-small
tuned on MASC Gulf) and adapt it with LoRA on Emirati speech, then measure on
Emirati categories never seen in training.

Run on a GPU (Kaggle / Colab / an approved cluster):
    pip install -r asr/requirements-asr.txt
    huggingface-cli download eabayed/EmiratiDialictShowsAudioTranscription --repo-type dataset --local-dir data/emirati
    python -m asr.finetune --emirati-root data/emirati --masc-limit 2000 --epochs 3 --out runs/emirati-lora

Outputs runs/<name>/best/ (LoRA adapter), metrics.json (baseline vs each epoch).
"""
from __future__ import annotations

import argparse
import json
import math
import random
import time
from pathlib import Path

import numpy as np
import torch

from .metrics import keyword_recall, wer_cer


def build_processor(name: str):
    from transformers import WhisperProcessor
    proc = WhisperProcessor.from_pretrained(name)
    proc.tokenizer.set_prefix_tokens(language="arabic", task="transcribe", predict_timestamps=False)
    return proc


def load_model(base: str, lora_r: int, adapter: str | None = None, model=None):
    from peft import LoraConfig, PeftModel, get_peft_model
    from transformers import WhisperForConditionalGeneration
    model = model or WhisperForConditionalGeneration.from_pretrained(base)
    model.config.forced_decoder_ids = None
    if adapter:
        return PeftModel.from_pretrained(model, adapter)
    cfg = LoraConfig(r=lora_r, lora_alpha=2 * lora_r, lora_dropout=0.05, target_modules=["q_proj", "v_proj"], bias="none")
    return get_peft_model(model, cfg)


def featurize(proc, items: list[dict], max_label_len: int = 440) -> list[dict]:
    out = []
    for it in items:
        if "input_features" in it:
            feats, labels = it["input_features"], list(it["labels"])
        else:
            feats = proc.feature_extractor(it["audio"], sampling_rate=16000, return_tensors="np").input_features[0]
            labels = proc.tokenizer(it["text"]).input_ids
        out.append({"input_features": np.asarray(feats, dtype=np.float16), "labels": labels[:max_label_len],
                    "text": it.get("text"), "meta": {k: it.get(k) for k in ("id", "source", "category", "dialect", "age_band", "education")}})
    return out


def collate(batch: list[dict], decoder_start_id: int):
    feats = torch.tensor(np.stack([b["input_features"] for b in batch]).astype(np.float32))
    L = max(len(b["labels"]) for b in batch)
    labels = torch.full((len(batch), L), -100, dtype=torch.long)
    for i, b in enumerate(batch):
        labels[i, : len(b["labels"])] = torch.tensor(b["labels"])
    if (labels[:, 0] == decoder_start_id).all():  # the model prepends the start token itself
        labels = labels[:, 1:]
    return feats, labels


@torch.no_grad()
def transcribe(model, proc, examples: list[dict], device: str, batch: int = 8, max_new_tokens: int = 225) -> list[str]:
    model.eval()
    cfg = getattr(model, "config", None)
    max_new_tokens = min(max_new_tokens, getattr(cfg, "max_target_positions", 448) - 8)
    hyps = []
    for i in range(0, len(examples), batch):
        feats = torch.tensor(np.stack([e["input_features"] for e in examples[i:i + batch]]).astype(np.float32)).to(device)
        with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=device == "cuda"):
            ids = model.generate(input_features=feats, language="ar", task="transcribe", max_new_tokens=max_new_tokens)
        hyps += proc.tokenizer.batch_decode(ids, skip_special_tokens=True)
    return hyps


def evaluate(model, proc, test: list[dict], device: str) -> dict:
    refs = [e["text"] if e.get("text") else proc.tokenizer.decode([t for t in e["labels"] if t >= 0], skip_special_tokens=True) for e in test]
    hyps = transcribe(model, proc, test, device)
    return {**wer_cer(refs, hyps), **keyword_recall(refs, hyps), "examples": [{"ref": r, "hyp": h} for r, h in list(zip(refs, hyps))[:5]]}


def train(model, proc, train_set: list[dict], test_set: list[dict], args, device: str) -> dict:
    model.to(device)
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=args.lr, weight_decay=0.0)
    steps_per_epoch = math.ceil(len(train_set) / (args.batch * args.grad_accum))
    total = steps_per_epoch * args.epochs
    warm = max(1, int(0.1 * total))
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1.0, (s + 1) / warm) * max(0.0, (total - s) / max(1, total - warm)))
    scaler = torch.amp.GradScaler("cuda", enabled=device == "cuda")
    start_id = model.config.decoder_start_token_id
    log = {"baseline": evaluate(model, proc, test_set, device), "epochs": []}
    best = log["baseline"]["wer"]
    print(f"baseline WER {best:.3f}  keyword recall {log['baseline']['keyword_recall']}")
    out = Path(args.out)
    rng = random.Random(args.seed)
    for ep in range(1, args.epochs + 1):
        model.train()
        order = list(range(len(train_set)))
        rng.shuffle(order)
        t0, losses = time.time(), []
        for bi in range(0, len(order), args.batch):
            feats, labels = collate([train_set[j] for j in order[bi:bi + args.batch]], start_id)
            with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=device == "cuda"):
                loss = model(input_features=feats.to(device), labels=labels.to(device)).loss / args.grad_accum
            scaler.scale(loss).backward()
            losses.append(loss.item() * args.grad_accum)
            if (bi // args.batch + 1) % args.grad_accum == 0 or bi + args.batch >= len(order):
                scaler.step(opt); scaler.update(); opt.zero_grad(set_to_none=True); sched.step()
        ev = evaluate(model, proc, test_set, device)
        ev.update({"epoch": ep, "train_loss": round(float(np.mean(losses)), 4), "minutes": round((time.time() - t0) / 60, 1)})
        log["epochs"].append(ev)
        print(f"epoch {ep}: loss {ev['train_loss']:.3f}  WER {ev['wer']:.3f}  keyword recall {ev['keyword_recall']}")
        model.save_pretrained(out / "last")
        if ev["wer"] < best:
            best = ev["wer"]
            model.save_pretrained(out / "best")
            log["best_epoch"] = ep
    log["best_wer"] = best
    return log


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="otozz/whisper-small-dialect_gulf")
    ap.add_argument("--processor", default="openai/whisper-small")
    ap.add_argument("--emirati-root", required=True)
    ap.add_argument("--masc-limit", type=int, default=2000, help="MASC Gulf examples mixed in (0 = Emirati only)")
    ap.add_argument("--emirati-oversample", type=int, default=3)
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--grad-accum", type=int, default=2)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--lora-r", type=int, default=16)
    ap.add_argument("--seed", type=int, default=13)
    ap.add_argument("--out", default="runs/emirati-lora")
    args = ap.parse_args(argv)
    torch.manual_seed(args.seed)
    from .data import emirati_shows, masc_gulf
    device = "cuda" if torch.cuda.is_available() else "cpu"
    proc = build_processor(args.processor)
    em = emirati_shows(args.emirati_root)
    train_items = em["train"] * args.emirati_oversample + (list(masc_gulf("train", args.masc_limit)) if args.masc_limit else [])
    train_set, test_set = featurize(proc, train_items), featurize(proc, em["test"])
    print(f"train {len(train_set)} examples (Emirati x{args.emirati_oversample} + MASC {args.masc_limit}); "
          f"Emirati held-out test {len(test_set)} clips (categories never trained on)")
    model = load_model(args.base, args.lora_r)
    model.print_trainable_parameters()
    log = train(model, proc, train_set, test_set, args, device)
    log["config"] = vars(args)
    log["data"] = {"train_emirati_clips": len(em["train"]), "test_emirati_clips": len(em["test"]),
                   "test_categories": sorted({e["category"] for e in em["test"]})}
    Path(args.out).mkdir(parents=True, exist_ok=True)
    (Path(args.out) / "metrics.json").write_text(json.dumps(log, ensure_ascii=False, indent=1))
    print("saved", args.out)


if __name__ == "__main__":
    main()
