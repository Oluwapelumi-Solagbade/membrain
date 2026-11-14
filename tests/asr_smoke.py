"""End-to-end smoke test with a TINY random Whisper + a real byte-level Whisper tokenizer built locally
(no downloads). Verifies data loading, featurising, LoRA, training loop, generation, WER, keyword recall, benchmark report."""
import csv, io, json, sys, zipfile, pathlib
import numpy as np, soundfile as sf, torch
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from transformers import WhisperConfig, WhisperFeatureExtractor, WhisperForConditionalGeneration, WhisperProcessor, WhisperTokenizer
def bytes_to_unicode():
    bs = list(range(ord("!"), ord("~") + 1)) + list(range(ord("¡"), ord("¬") + 1)) + list(range(ord("®"), ord("ÿ") + 1)); cs = bs[:]; n = 0
    for b in range(256):
        if b not in bs: bs.append(b); cs.append(256 + n); n += 1
    return dict(zip(bs, [chr(c) for c in cs]))

import tempfile; T = pathlib.Path(tempfile.mkdtemp()); tok_dir = T / "tok"; tok_dir.mkdir(exist_ok=True)
from transformers.models.whisper.tokenization_whisper import LANGUAGES
specials = ["<|endoftext|>", "<|startoftranscript|>"] + [f"<|{l}|>" for l in LANGUAGES] + ["<|translate|>", "<|transcribe|>", "<|startoflm|>", "<|startofprev|>", "<|nospeech|>", "<|notimestamps|>"]
vocab = {ch: i for i, ch in enumerate(bytes_to_unicode().values())}
for s in specials: vocab[s] = len(vocab)
(tok_dir / "vocab.json").write_text(json.dumps(vocab)); (tok_dir / "merges.txt").write_text("#version: 0.2\n")
tok = WhisperTokenizer(str(tok_dir / "vocab.json"), str(tok_dir / "merges.txt"), unk_token="<|endoftext|>", bos_token="<|endoftext|>", eos_token="<|endoftext|>", pad_token="<|endoftext|>", additional_special_tokens=specials[1:])
proc = WhisperProcessor(WhisperFeatureExtractor(), tok); proc.save_pretrained(T / "proc")

# fake "emirati" dataset in the real on-disk format (zip + tsv), categories incl. health (held out)
root = T / "emirati"; root.mkdir(exist_ok=True)
words = ["جمل", "شباك", "برتقال", "قهوة", "قمر"]
rng = np.random.default_rng(0)
with zipfile.ZipFile(root / "audiofiles.zip", "w") as z, open(root / "transcriptions.tsv", "w", encoding="utf-8") as f:
    f.write("audiofilename\ttranscription\t\n")
    for cat in ("traditions", "cars", "health"):
        for k in range(6):
            w = words[k % 5]; tone = np.sin(2 * np.pi * (200 + 40 * (k % 5)) * np.arange(16000) / 16000).astype(np.float32) * 0.3
            buf = io.BytesIO(); sf.write(buf, tone + rng.normal(0, 0.01, 16000).astype(np.float32), 16000, format="WAV"); z.writestr(f"{cat}_chunk-{k:02d}.wav", buf.getvalue())
            f.write(f"{cat}_chunk-{k:02d} wav\t{w}\t\n")

from asr import finetune
from asr.metrics import keyword_recall, wer_cer
cfg = WhisperConfig(vocab_size=len(vocab), d_model=64, encoder_layers=1, decoder_layers=1, encoder_attention_heads=2, decoder_attention_heads=2,
                    encoder_ffn_dim=128, decoder_ffn_dim=128, num_mel_bins=80, max_source_positions=1500, max_target_positions=64,
                    decoder_start_token_id=vocab["<|startoftranscript|>"], eos_token_id=vocab["<|endoftext|>"], pad_token_id=vocab["<|endoftext|>"],
                    bos_token_id=vocab["<|endoftext|>"])
m = WhisperForConditionalGeneration(cfg)
gc = m.generation_config
gc.lang_to_id = {"<|ar|>": vocab["<|ar|>"], "<|en|>": vocab["<|en|>"]}; gc.task_to_id = {"transcribe": vocab["<|transcribe|>"], "translate": vocab["<|translate|>"]}
gc.no_timestamps_token_id = vocab["<|notimestamps|>"]; gc.is_multilingual = True; gc.decoder_start_token_id = cfg.decoder_start_token_id; gc.eos_token_id = cfg.eos_token_id; gc.pad_token_id = cfg.pad_token_id
gc.max_length = 32; gc.begin_suppress_tokens = None; gc.suppress_tokens = None; gc._from_model_config = False
m.save_pretrained(T / "tiny")

assert wer_cer(["جَمَل شباك"], ["جمل الشباك"])["wer"] == 0.5
assert keyword_recall(["قلت جمل وقهوة"], ["جمل"])["keyword_recall"] == 0.5
finetune.main(["--base", str(T / "tiny"), "--processor", str(T / "proc"), "--emirati-root", str(root), "--masc-limit", "0",
               "--epochs", "4", "--batch", "4", "--grad-accum", "1", "--lr", "5e-3", "--lora-r", "4", "--out", str(T / "run")])
log = json.loads((T / "run" / "metrics.json").read_text())
print("data", log["data"]); print("losses", [e["train_loss"] for e in log["epochs"]])
assert log["data"]["test_categories"] == ["health"]
assert log["epochs"][-1]["train_loss"] < log["epochs"][0]["train_loss"], "loss should fall"
from asr import benchmark
benchmark.main(["--emirati-root", str(root), "--models", f"hf:{T/'tiny'}", f"lora:{T/'tiny'}@{T/'run'/'best'}" if (T/'run'/'best').exists() else f"hf:{T/'tiny'}",
                "--processor", str(T / "proc"), "--out", str(T / "report")])
print(open(T / "report" / "BENCHMARK_RESULTS.md").read()[:800]); print("SMOKE OK")
