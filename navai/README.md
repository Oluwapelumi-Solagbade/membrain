# Navigator AI evaluation

The method, results and limits are in `docs/NAVIGATOR_AI.md`.

```bash
python -m navai.evaluate --set dev --errors     # rules extractor, development set
python -m navai.evaluate --set test --write     # held-out set, writes docs/navai/RESULTS_rules_test.json

# MedGemma on a GPU node (FZJ juseless), from ~/membrain:
hf auth login                                   # account that has accepted the MedGemma terms
condor_submit navai/navai.submit                # logs/navai.out, writes docs/navai/RESULTS.md
```

`gold/test.jsonl` is frozen. Its SHA-256 is in `gold/test.sha256` and a unit test checks it. Do not edit it to improve a score: add new narratives to `dev.jsonl`, or start a new versioned test set.

## Cluster notes (FZJ juseless)

- Only the **x86_64** GPU nodes can run our environment (torch cu130); the `gpuNN` nodes are IBM POWER (`ppc64le`). `navai.submit` therefore asks for x86, 1 CPU and 12 GB, and no local disk; asking for more leaves no matching slot.
- If a node's NVIDIA driver is broken, the job stops at once and names the node. Exclude it with `-append 'requirements = (Arch == "X86_64") && (Machine != "<node>")'`.

## Backup: Kaggle (free T4 GPU)

1. Create a new Kaggle notebook. Set the accelerator to **GPU T4 x2** and turn Internet on.
2. Add your Hugging Face read token as a secret named `HF_TOKEN` (Add-ons → Secrets). The same account must have accepted the MedGemma terms.
3. Run:

```python
from kaggle_secrets import UserSecretsClient; import os
os.environ["HF_TOKEN"] = UserSecretsClient().get_secret("HF_TOKEN")
!git clone -q https://github.com/teamcerebrospark/membrain.git && cd membrain && pip -q install -r requirements.txt -r navai/requirements-navai.txt
!cd membrain && python -m navai.medgemma_eval --model google/medgemma-1.5-4b-it --tag medgemma15_v2_t4 --dtype float16 --sets dev test
!cat membrain/docs/navai/RESULTS_medgemma15_v2_t4.md
```

T4s are slower than the cluster GPU, so the latency gate will look worse there; the accuracy numbers are comparable.
