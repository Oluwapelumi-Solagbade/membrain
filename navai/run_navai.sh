#!/bin/bash
# HTCondor job: measure MedGemma on the Navigator intake gold sets (synthetic data only).
set -euo pipefail
cd "$HOME/membrain"
source .venv/bin/activate
export HF_HOME="${HF_HOME:-$HOME/.cache/huggingface}"
pip install -q -r navai/requirements-navai.txt
nvidia-smi --query-gpu=name,memory.total --format=csv
python -m navai.medgemma_eval --model "${MEDGEMMA_MODEL:-google/medgemma-4b-it}" --sets dev test
