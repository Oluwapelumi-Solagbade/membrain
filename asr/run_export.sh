#!/bin/bash
# HTCondor job (CPU is enough): merge the LoRA adapter into the Gulf Whisper base and convert to CTranslate2 int8.
set -euo pipefail
cd "$HOME/membrain"
source .venv/bin/activate
export HF_HOME="${HF_HOME:-$HOME/.cache/huggingface}"
pip install -q -r asr/requirements-serve.txt
python -m asr.export_model --base otozz/whisper-small-dialect_gulf --adapter runs/emirati-lora/best \
  --out runs/membrain-whisper-gulf-ct2 ${HF_PUSH_REPO:+--push "$HF_PUSH_REPO"}
# quick check that the exported model loads and transcribes a held-out Emirati clip
python - <<'PY'
import glob, time
from faster_whisper import WhisperModel
m = WhisperModel("runs/membrain-whisper-gulf-ct2", device="cpu", compute_type="int8", cpu_threads=4)
clips = sorted(glob.glob("data/emirati/**/*health*.wav", recursive=True))[:3]
for c in clips:
    t = time.time(); segs, info = m.transcribe(c, language="ar", beam_size=1, vad_filter=True)
    print(c.split("/")[-1], f"{time.time()-t:.1f}s for {info.duration:.1f}s audio:", " ".join(s.text for s in segs))
if not clips:
    print("no extracted Emirati clips found under data/emirati; model exported, transcription check skipped")
PY
