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
