"""WER/CER with the SAME Arabic normalisation the scoring engine uses, plus task-keyword recall."""
from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

import jiwer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from membrain.items import FLUENCY_LEXICON, WORD_LISTS  # noqa: E402
from membrain.scoring import _stem, normalize  # noqa: E402


def norm(text: str, lang: str = "ar") -> str:
    return normalize(text or "", lang)


def wer_cer(refs: list[str], hyps: list[str], lang: str = "ar") -> dict:
    r = [norm(x, lang) or "<empty>" for x in refs]
    h = [norm(x, lang) for x in hyps]
    return {"wer": round(jiwer.wer(r, h), 4), "cer": round(jiwer.cer(r, h), 4), "n": len(r)}


def task_keywords(lang: str = "ar") -> set[str]:
    """All target words the MemBrain scoring engine listens for (word lists + fluency lexicons)."""
    kw = set()
    for f in WORD_LISTS.values():
        kw |= {_stem(normalize(w, lang), lang) for w in f[lang]}
    for f in FLUENCY_LEXICON.values():
        kw |= {_stem(w, lang) for w in normalize(f[lang], lang).split()}
    return kw


def keyword_recall(refs: list[str], hyps: list[str], lang: str = "ar") -> dict:
    """Of the task keywords spoken in the reference, how many does the ASR output contain?
    This is what actually drives MemBrain scores, so it matters more than overall WER."""
    kw = task_keywords(lang)
    hit = tot = 0
    for r, h in zip(refs, hyps):
        rk = {_stem(t, lang) for t in norm(r, lang).split()} & kw
        hk = {_stem(t, lang) for t in norm(h, lang).split()}
        tot += len(rk)
        hit += len(rk & hk)
    return {"keyword_recall": round(hit / tot, 4) if tot else None, "keywords_in_refs": tot}


def by_group(rows: list[dict], key: str, lang: str = "ar") -> dict:
    g = defaultdict(lambda: ([], []))
    for r in rows:
        g[r.get(key, "unknown")][0].append(r["ref"])
        g[r.get(key, "unknown")][1].append(r["hyp"])
    return {k: {**wer_cer(a, b, lang), **keyword_recall(a, b, lang)} for k, (a, b) in sorted(g.items())}


def word_errors(ref: str, hyp: str, lang: str = "ar") -> tuple[int, int]:
    """(edit operations, reference words) for one utterance, same normalisation as wer_cer."""
    r = norm(ref, lang) or "<empty>"
    out = jiwer.process_words(r, norm(hyp, lang))
    return out.substitutions + out.deletions + out.insertions, len(r.split())


def paired_bootstrap(errs_a: list[tuple[int, int]], errs_b: list[tuple[int, int]], n_boot: int = 2000, seed: int = 0) -> dict:
    """95% CI for WER(b) - WER(a), resampling utterances (paired). Negative = b better."""
    import numpy as np
    rng = np.random.default_rng(seed)
    ea, eb = np.array(errs_a, dtype=float), np.array(errs_b, dtype=float)
    n = len(ea)
    diffs = []
    for _ in range(n_boot):
        i = rng.integers(0, n, n)
        diffs.append(eb[i, 0].sum() / eb[i, 1].sum() - ea[i, 0].sum() / ea[i, 1].sum())
    d = eb[:, 0].sum() / eb[:, 1].sum() - ea[:, 0].sum() / ea[:, 1].sum()
    lo, hi = np.percentile(diffs, [2.5, 97.5])
    return {"diff": round(float(d), 4), "ci95": [round(float(lo), 4), round(float(hi), 4)],
            "p_b_not_better": round(float(np.mean(np.array(diffs) >= 0)), 4), "n_utterances": n}
