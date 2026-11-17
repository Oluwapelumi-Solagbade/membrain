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
    ({"id": "G-RC", "age": 68, "education": "primary", "language": "ar", "dialect": "Emirati"},
     [{"session_id": "i0", "date": "2026-11-14", "type": "intake", "concern": "forgets, sister pays bills", "red_flags": [],
       "reported_concern": {"reporter": "family", "domains": ["memory", "executive"], "activities_taken_over": ["money"]}},
      {"session_id": "s0", "date": "2026-11-15", "form": "A", "raw": _raw("primary", 68, 0.0, 0)}]),
    ({"id": "G-RM", "age": 60, "education": "secondary", "language": "en", "dialect": "English"},
     [{"session_id": "i0", "date": "2026-11-14", "type": "intake", "concern": "low mood only", "red_flags": [],
       "reported_concern": {"reporter": "self", "domains": ["mood", "sleep"], "activities_taken_over": ["cooking"]}}]),
    ({"id": "G-RP", "age": 70, "education": "tertiary", "language": "en", "dialect": "English"},
     [{"session_id": "i0", "date": "2026-11-14", "type": "intake", "concern": "GP noticed decline", "red_flags": [],
       "reported_concern": {"reporter": "professional", "domains": ["memory"], "activities_taken_over": []}}]),
    ({"id": "G-FV", "age": 72, "education": "tertiary", "language": "en", "dialect": "English"},
     [{"session_id": "s0", "date": "2026-11-02", "form": "A", "raw": _raw("tertiary", 72, -2.7, 0)}]),
    # follow-up concerns (engine 0.5.0): spread -> review; nothing new -> level carried; a new red flag -> urgent
    ({"id": "G-FU", "age": 74, "education": "primary", "language": "ar", "dialect": "Emirati"},
     [{"session_id": "i0", "date": "2026-09-01", "type": "intake", "concern": "forgets names", "red_flags": [],
       "reported_concern": {"reporter": "family", "domains": ["memory"], "activities_taken_over": []}},
      {"session_id": "s0", "date": "2026-09-02", "form": "A", "raw": _raw("primary", 74, 0.0, 0)},
      {"session_id": "s1", "date": "2026-09-16", "form": "B", "raw": _raw("primary", 74, 0.0, 1)},
      {"session_id": "i1", "date": "2026-10-01", "type": "intake", "concern": "still forgets names", "red_flags": [],
       "reported_concern": {"reporter": "family", "domains": ["memory"], "activities_taken_over": []}},
      {"session_id": "i2", "date": "2026-11-01", "type": "intake", "concern": "now misses her medicines, daughter gives them", "red_flags": [],
       "reported_concern": {"reporter": "family", "domains": ["memory", "language"], "activities_taken_over": ["medicines"]}},
      {"session_id": "i3", "date": "2026-11-10", "type": "intake", "concern": "fell and hit her head", "red_flags": ["recent_fall_head_injury"],
       "reported_concern": {"reporter": "family", "domains": ["memory"], "activities_taken_over": ["medicines"]}}]),
    # family questionnaire (FAQ): below cutoff, first time at/above cutoff -> review, still above -> carried, big rise -> urgent
    ({"id": "G-FQ", "age": 70, "education": "secondary", "language": "en", "dialect": "English"},
     [{"session_id": "s0", "date": "2026-06-01", "form": "A", "raw": _raw("secondary", 70, 0.0, 0)},
      {"session_id": "f0", "date": "2026-06-02", "type": "informant", "faq": 4},
      {"session_id": "f1", "date": "2026-09-01", "type": "informant", "faq": 10},
      {"session_id": "f2", "date": "2026-10-01", "type": "informant", "faq": 11},
      {"session_id": "f3", "date": "2026-11-01", "type": "informant", "faq": 15}]),
    # a concern raised only after check-ins
    ({"id": "G-LC", "age": 66, "education": "tertiary", "language": "en", "dialect": "English"},
     [{"session_id": "s0", "date": "2026-06-01", "form": "A", "raw": _raw("tertiary", 66, 0.0, 0)},
      {"session_id": "i0", "date": "2026-06-20", "type": "intake", "concern": "sleeps badly", "red_flags": [],
       "reported_concern": {"reporter": "self", "domains": ["sleep"], "activities_taken_over": []}}]),
]
EXTRA_KEYS = ("concern_change", "informant", "carried", "next_action")
for p, sess in extra:
    hist = evaluate(p, sess)["history"]   # crafted cases also pin the reason text, so wording stays identical across engines
    cases.append({"participant": p, "sessions": sess, "expected_levels": [h["level"] for h in hist],
                  "expected_reasons": [h["reasons"] for h in hist],
                  "expected_extra": [{k: h[k] for k in EXTRA_KEYS if k in h} for h in hist]})
out = pathlib.Path(__file__).resolve().parents[1] / "tests" / "golden_vectors.json"
out.write_text(json.dumps(cases, ensure_ascii=False))
print(f"wrote {len(cases)} cases -> {out}")
