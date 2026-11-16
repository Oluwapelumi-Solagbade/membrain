#!/bin/bash
# HTCondor job: measure MedGemma on the Navigator intake gold sets (synthetic data only).
set -euo pipefail
cd "$HOME/membrain"
source .venv/bin/activate
export HF_HOME="${HF_HOME:-$HOME/.cache/huggingface}"
pip install -q -r navai/requirements-navai.txt
if ! nvidia-smi --query-gpu=name,memory.total --format=csv; then
  echo "GPU not usable on $(hostname) (driver problem). Resubmit excluding it: -append 'requirements = (Machine != \"$(hostname -f)\")'" >&2
  exit 3
fi
python -c "import torch,sys; ok=torch.cuda.is_available(); print('torch', torch.__version__, 'cuda ok:', ok); sys.exit(0 if ok else 3)"
python -m navai.medgemma_eval --model "${MEDGEMMA_MODEL:-google/medgemma-4b-it}" --tag "${NAVAI_TAG:-medgemma}" --sets dev test
