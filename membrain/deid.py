"""De-identification before any text reaches a language model (MedGemma second reader).

Rule-based, English and Arabic: Emirates ID numbers, UAE phone numbers, e-mail addresses, other long numbers, and names
that follow a cue ("my father Ahmed", "named Sara", "Dr. Khalid", "اسمه محمد", "أبو خالد"). Each is replaced by a
placeholder such as [NAME]. The clinician still sees the original words; only the copy sent to the model is cleaned.
This is a first line, not a guarantee: a fine-tuned Arabic NER model (Presidio + CAMeLBERT/AraBERT) is the pilot plan.
"""
from __future__ import annotations

import re

KIN_EN = r"(?:father|mother|dad|mum|mom|husband|wife|son|daughter|brother|sister|uncle|aunt|grandfather|grandmother|grandma|grandpa|friend|neighbour|neighbor|maid|helper|driver)"
_RULES: list[tuple[str, re.Pattern, str]] = [
    ("emirates_id", re.compile(r"\b784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d\b"), "[ID]"),
    ("email", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"), "[EMAIL]"),
    ("phone", re.compile(r"(?<!\d)(?:\+?971[-\s]?|00971[-\s]?|0)(?:5\d|[2-9])[-\s]?\d{3}[-\s]?\d{4}(?!\d)"), "[PHONE]"),
    ("long_number", re.compile(r"(?<!\d)\d[\d\s-]{5,}\d(?!\d)"), "[NUMBER]"),
    # names after an English cue: keep the cue, replace the capitalised name (one or two words)
    ("name_en", re.compile(r"(?:(?<=\b[Mm]y\s)" + KIN_EN + r"|\bnamed|\bcalled|\b(?:Mr|Mrs|Ms|Dr|Sheikh|Sheikha)\.?)\s+([A-Z][a-z]+(?:(?:\s+(?:Al|El|al|bin|bint|Bin|Abu))?[\s-]+[A-Z][a-z]+){0,2})"), "[NAME]"),
    # Arabic cues: اسمه / اسمها / يسمى / أبو / أم / الدكتور + the next word
    ("name_ar", re.compile(r"(?:اسمه|اسمها|إسمه|إسمها|يسمى|تسمى|أبو|ابو|أم|ام|الدكتور|الدكتورة|دكتور|دكتورة)\s+([ء-ي]{2,})"), "[NAME]"),
]


def redact(text: str) -> tuple[str, dict]:
    """Returns (cleaned text, counts by kind)."""
    counts: dict[str, int] = {}
    out = text or ""
    for kind, rx, ph in _RULES:
        if kind.startswith("name"):
            def sub(m, ph=ph):
                return m.group(0)[: m.start(1) - m.start(0)] + ph
            out, n = rx.subn(sub, out)
        else:
            out, n = rx.subn(ph, out)
        if n:
            counts[kind] = counts.get(kind, 0) + n
    return out, counts
