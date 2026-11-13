"""Transcript scoring and stratified normative z-scores.

Raw scores are ALWAYS stored; z-scores are derived with a versioned norm
table, so cutoffs can be revised without retesting anyone.
"""
from __future__ import annotations

import re
import unicodedata

from . import config as C
from .items import FLUENCY_LEXICON, JUDGEMENT, STORIES, WORD_LISTS

_AR_DIACRITICS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")


def normalize(text: str, lang: str) -> str:
    text = unicodedata.normalize("NFKC", text or "").lower()
    if lang == "ar":
        text = _AR_DIACRITICS.sub("", text)
        text = re.sub("[إأآٱ]", "ا", text)
        text = text.replace("ة", "ه").replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _stem(tok: str, lang: str) -> str:
    if lang == "ar":
        for p in ("وال", "بال", "فال", "ال", "و"):
            if tok.startswith(p) and len(tok) - len(p) >= 2:
                return tok[len(p):]
        return tok
    return tok[:-1] if tok.endswith("s") and len(tok) > 3 else tok


def _tokens(text: str, lang: str) -> list[str]:
    return [_stem(t, lang) for t in normalize(text, lang).split()]


def score_word_recall(transcript: str, form: str, lang: str) -> dict:
    targets = {_stem(normalize(w, lang), lang): w for w in WORD_LISTS[form][lang]}
    said = _tokens(transcript, lang)
    hits = sorted({targets[t] for t in said if t in targets})
    intrusions = sorted({t for t in said if t not in targets and len(t) > 2})
    return {"score": len(hits), "hits": hits, "intrusions": intrusions[:20]}


def score_fluency(transcript: str, form: str, lang: str) -> dict:
    lex = {_stem(w, lang) for w in normalize(FLUENCY_LEXICON[form][lang], lang).split()}
    seen, valid, unverified, repeats = set(), [], [], 0
    for t in _tokens(transcript, lang):
        if len(t) < 2:
            continue
        if t in seen:
            repeats += 1
            continue
        seen.add(t)
        (valid if t in lex else unverified).append(t)
    return {"score": min(len(valid), C.DOMAINS["fluency"]["max"]), "valid": valid,
            "unverified": unverified, "repeats": repeats, "needs_audit": bool(unverified)}


def _units_matched(transcript: str, units: list[list[str]], lang: str) -> list[int]:
    norm = " " + normalize(transcript, lang) + " "
    toks = set(_tokens(transcript, lang))
    out = []
    for i, alts in enumerate(units):
        for a in alts:
            na = normalize(a, lang)
            if (" " in na and f" {na} " in norm) or _stem(na, lang) in toks:
                out.append(i)
                break
    return out


def score_story(transcript: str, form: str, lang: str) -> dict:
    m = _units_matched(transcript, STORIES[form]["units"][lang], lang)
    return {"score": len(m), "units_recalled": m}


def score_judgement(transcript: str, form: str, lang: str) -> dict:
    m = _units_matched(transcript, JUDGEMENT[form]["rubric"][lang], lang)
    return {"score": len(m), "rubric_elements": m, "needs_audit": len(m) <= 1}


def score_session_transcripts(tr: dict, form: str, lang: str) -> dict:
    """tr keys: memory_immediate, memory_delayed, fluency, story_recall, judgement."""
    res = {
        "memory_immediate": score_word_recall(tr.get("memory_immediate", ""), form, lang),
        "memory_delayed": score_word_recall(tr.get("memory_delayed", ""), form, lang),
        "fluency": score_fluency(tr.get("fluency", ""), form, lang),
        "story_recall": score_story(tr.get("story_recall", ""), form, lang),
        "judgement": score_judgement(tr.get("judgement", ""), form, lang),
    }
    return {"raw": {k: v["score"] for k, v in res.items()}, "detail": res}


# ---------------------------------------------------------------- norms ---
def expected_raw(domain: str, education: str, age: float) -> float:
    n = C.NORMS[domain]
    return n["mean"][education] - n["age_per_decade"] * max(0.0, (age - 50) / 10)


def domain_z(domain: str, raw: float, education: str, age: float) -> float:
    return (raw - expected_raw(domain, education, age)) / C.NORMS[domain]["sd"]


def composite_sd() -> float:
    """SD of the weighted mean of correlated unit-variance domain z-scores."""
    w = [C.DOMAINS[d]["weight"] for d in C.DOMAINS]
    tot = sum(w)
    var = sum(a * a for a in w) + C.INTER_DOMAIN_R * (tot * tot - sum(a * a for a in w))
    return var ** 0.5 / tot


def composite_z(raw: dict, education: str, age: float) -> float:
    """Weighted composite, re-standardised to unit variance."""
    num = sum(C.DOMAINS[d]["weight"] * domain_z(d, raw[d], education, age) for d in C.DOMAINS)
    return num / sum(C.DOMAINS[d]["weight"] for d in C.DOMAINS) / composite_sd()


def z_profile(raw: dict, education: str, age: float) -> dict:
    return {"domains": {d: round(domain_z(d, raw[d], education, age), 3) for d in C.DOMAINS},
            "composite": round(composite_z(raw, education, age), 3),
            "norms_version": C.NORMS_VERSION, "education_band": education}
