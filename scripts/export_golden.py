"""Export golden test vectors (personas + synthetic sample) for Python/JS parity."""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from membrain.personas import personas  # noqa: E402
from membrain.simulate import generate_cohort  # noqa: E402
from membrain.triage import evaluate  # noqa: E402

KEEP = ("id", "age", "education", "language", "dialect")
cases = []
for p in personas() + generate_cohort(80, seed=11):
    sess = [s for s in p["sessions"] if not s.get("incomplete")]
    if not sess:
        continue
    cases.append({"participant": {k: p[k] for k in KEEP}, "sessions": sess,
                  "expected_levels": [h["level"] for h in evaluate(p, sess)["history"]]})
out = pathlib.Path(__file__).resolve().parents[1] / "tests" / "golden_vectors.json"
out.write_text(json.dumps(cases, ensure_ascii=False))
print(f"wrote {len(cases)} cases -> {out}")
