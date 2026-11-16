#!/bin/bash
# HTCondor job (CPU is enough): merge the LoRA adapter into the Gulf Whisper base and convert to CTranslate2 int8.
set -euo pipefail
cd "$HOME/membrain"
source .venv/bin/activate
export HF_HOME="${HF_HOME:-$HOME/.cache/huggingface}"
pip install -q -r asr/requirements-serve.txt
if [ "${SKIP_EXPORT:-0}" != "1" ]; then
  python -m asr.export_model --base otozz/whisper-small-dialect_gulf --adapter runs/emirati-lora/best \
    --out runs/membrain-whisper-gulf-ct2 ${HF_PUSH_REPO:+--push "$HF_PUSH_REPO"}
fi
# accuracy and CPU speed of the exported model on the same 103 held-out Emirati clips as the benchmark
python -m asr.check_export --model runs/membrain-whisper-gulf-ct2 --emirati-root data/emirati --threads 4
