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
# crafted cases for the safety routes
from membrain.personas import _raw  # noqa: E402
extra = [
    ({"id": "G-RF", "age": 71, "education": "primary", "language": "ar", "dialect": "Emirati"},
     [{"session_id": "i0", "date": "2026-11-14", "type": "intake", "concern": "sudden confusion", "red_flags": ["sudden_onset"]}]),
    ({"id": "G-IN", "age": 66, "education": "secondary", "language": "en", "dialect": "English"},
     [{"session_id": "i0", "date": "2026-11-01", "type": "intake", "concern": "memory complaints", "red_flags": []},
      {"session_id": "s0", "date": "2026-11-02", "form": "A", "raw": _raw("secondary", 66, 0.0, 0)}]),
    ({"id": "G-FV", "age": 72, "education": "tertiary", "language": "en", "dialect": "English"},
     [{"session_id": "s0", "date": "2026-11-02", "form": "A", "raw": _raw("tertiary", 72, -2.7, 0)}]),
    # significant concern at intake -> review before any testing
    ({"id": "G-IA", "age": 69, "education": "primary", "language": "ar", "dialect": "Emirati"},
     [{"session_id": "i0", "date": "2026-11-03", "type": "intake", "concern": "forgets, son pays bills, daughter gives medicines",
       "reporter": "family", "activities_taken_over": ["money", "medicines"], "red_flags": []},
      {"session_id": "s0", "date": "2026-11-05", "form": "A", "raw": _raw("primary", 69, 0.0, 0)}]),
    ({"id": "G-I1", "age": 64, "education": "secondary", "language": "en", "dialect": "English"},
     [{"session_id": "i0", "date": "2026-11-03", "type": "intake", "concern": "I keep forgetting appointments",
       "reporter": "self", "activities_taken_over": ["money"], "red_flags": []}]),
    ({"id": "G-IQ", "age": 70, "education": "secondary", "language": "en", "dialect": "English"},
     [{"session_id": "i0", "date": "2026-11-03", "type": "intake", "concern": "informant report", "reporter": "family",
       "iqcode": 3.69, "red_flags": []}]),
    ({"id": "G-IP", "age": 67, "education": "tertiary", "language": "en", "dialect": "English"},
     [{"session_id": "i0", "date": "2026-11-03", "type": "intake", "concern": "decline since last visit",
       "reporter": "primary_care", "red_flags": []}]),
    ({"id": "G-IU", "age": 73, "education": "primary", "language": "ar", "dialect": "Emirati"},
     [{"session_id": "i0", "date": "2026-11-03", "type": "intake", "concern": "fell yesterday", "reporter": "primary_care",
       "activities_taken_over": ["money", "cooking"], "red_flags": ["recent_fall_head_injury"]}]),
]
for p, sess in extra:
    hist = evaluate(p, sess)["history"]   # crafted cases also pin the reason text, so wording stays identical across engines
    cases.append({"participant": p, "sessions": sess, "expected_levels": [h["level"] for h in hist],
                  "expected_reasons": [h["reasons"] for h in hist]})
out = pathlib.Path(__file__).resolve().parents[1] / "tests" / "golden_vectors.json"
out.write_text(json.dumps(cases, ensure_ascii=False))
print(f"wrote {len(cases)} cases -> {out}")
