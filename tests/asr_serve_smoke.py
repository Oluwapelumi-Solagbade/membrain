"""Serving smoke test (no downloads): tiny random Whisper + random LoRA -> asr.export_model -> CTranslate2 ->
/api/asr/transcribe with browser-style WebM/Opus audio. Checks the plumbing, not accuracy."""
import json, os, pathlib, subprocess, sys, tempfile
import numpy as np, soundfile as sf
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from transformers import WhisperConfig, WhisperFeatureExtractor, WhisperForConditionalGeneration, WhisperProcessor, WhisperTokenizer
from transformers.models.whisper.tokenization_whisper import LANGUAGES


def bytes_to_unicode():
    bs = list(range(ord("!"), ord("~") + 1)) + list(range(ord("¡"), ord("¬") + 1)) + list(range(ord("®"), ord("ÿ") + 1)); cs = bs[:]; n = 0
    for b in range(256):
        if b not in bs: bs.append(b); cs.append(256 + n); n += 1
    return dict(zip(bs, [chr(c) for c in cs]))


T = pathlib.Path(tempfile.mkdtemp())
specials = ["<|endoftext|>", "<|startoftranscript|>"] + [f"<|{l}|>" for l in LANGUAGES] + ["<|translate|>", "<|transcribe|>", "<|startoflm|>", "<|startofprev|>", "<|nospeech|>", "<|notimestamps|>"]
vocab = {ch: i for i, ch in enumerate(bytes_to_unicode().values())}
for s in specials: vocab[s] = len(vocab)
(T / "vocab.json").write_text(json.dumps(vocab)); (T / "merges.txt").write_text("#version: 0.2\n")
tok = WhisperTokenizer(str(T / "vocab.json"), str(T / "merges.txt"), unk_token="<|endoftext|>", bos_token="<|endoftext|>", eos_token="<|endoftext|>",
                       pad_token="<|endoftext|>", additional_special_tokens=specials[1:])
cfg = WhisperConfig(vocab_size=len(vocab), d_model=64, encoder_layers=1, decoder_layers=1, encoder_attention_heads=2, decoder_attention_heads=2,
                    encoder_ffn_dim=128, decoder_ffn_dim=128, num_mel_bins=80, max_source_positions=1500, max_target_positions=64,
                    decoder_start_token_id=vocab["<|startoftranscript|>"], eos_token_id=vocab["<|endoftext|>"], pad_token_id=vocab["<|endoftext|>"],
                    bos_token_id=vocab["<|endoftext|>"], suppress_tokens=[], begin_suppress_tokens=[])
m = WhisperForConditionalGeneration(cfg)
gc = m.generation_config
gc.lang_to_id = {f"<|{l}|>": vocab[f"<|{l}|>"] for l in LANGUAGES}; gc.task_to_id = {"transcribe": vocab["<|transcribe|>"], "translate": vocab["<|translate|>"]}
gc.no_timestamps_token_id = vocab["<|notimestamps|>"]; gc.is_multilingual = True; gc.max_length = 16
m.save_pretrained(T / "base"); WhisperProcessor(WhisperFeatureExtractor(), tok).save_pretrained(T / "base")
from peft import LoraConfig, get_peft_model
get_peft_model(WhisperForConditionalGeneration.from_pretrained(T / "base"), LoraConfig(r=4, target_modules=["q_proj", "v_proj"])).save_pretrained(T / "adapter")

from asr import export_model
try:   # an incomplete tokenizer (like the tiny test one) must be refused
    export_model.main(["--base", str(T / "base"), "--processor", str(T / "base"), "--adapter", str(T / "adapter"), "--out", str(T / "ct2")])
    raise AssertionError("small vocabulary was not refused")
except SystemExit as e:
    assert "incomplete" in str(e), e
export_model.main(["--base", str(T / "base"), "--processor", str(T / "base"), "--adapter", str(T / "adapter"), "--out", str(T / "ct2"),
                   "--allow-small-vocab"])
assert (T / "ct2" / "model.bin").exists() and (T / "ct2" / "tokenizer.json").exists()

# browser-style audio: 2 s tone -> WebM/Opus (what MediaRecorder produces in Chrome)
sf.write(T / "a.wav", (0.2 * np.sin(2 * np.pi * 220 * np.arange(32000) / 16000)).astype(np.float32), 16000)
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(T / "a.wav"), "-c:a", "libopus", str(T / "a.webm")], check=True)

os.environ["WHISPER_MODEL"] = str(T / "ct2"); os.environ["ASR_PREFER_LOCAL"] = "1"; os.environ["WHISPER_MAX_NEW_TOKENS"] = "40"  # tiny test model: 64 positions
from fastapi.testclient import TestClient
from api.main import app
c = TestClient(app)
assert c.get("/api/asr/config").json()["prefer"] is True
r = c.post("/api/asr/transcribe", files={"audio": ("a.webm", (T / "a.webm").read_bytes(), "audio/webm")}, data={"lang": "ar"})
assert r.status_code == 200, r.text
j = r.json(); assert j["engine"] == "membrain-whisper-gulf" and abs(j["duration_s"] - 2.0) < 0.3 and "text" in j, j
assert c.post("/api/asr/transcribe", files={"audio": ("x.webm", b"not audio", "audio/webm")}, data={"lang": "ar"}).status_code == 422
print("SERVE SMOKE OK", j)
