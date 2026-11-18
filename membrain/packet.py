"""Clinician review packet: a one-screen pre-read for the clinician who reviews a flagged case.

Built from numbered facts taken from the record (concern, check-ins, clinic MoCA, health measures). It has four parts:
  summary    - what is known, in two or three sentences
  rule_out   - which reversible causes to check, chosen ONLY from a fixed list, each with the facts that point to it
  ask        - questions to ask the person and the family at the visit
  gaps       - what the record is still missing
The rules always build it. When Med42 is switched on (api/med42.py) it writes the summary, picks and explains the
checks and writes the questions; every item it returns must cite fact numbers that exist, may use only numbers that are
in the cited facts, must not name a diagnosis, and checks must come from the fixed list. Anything else is dropped and
counted. The clinician reads it as a draft; it never changes a triage result and is never shown to the family.
"""
from __future__ import annotations

import json
import re

from . import intake as IN

CHECKS = {
    "thyroid": "Thyroid function (TSH)", "b12_folate": "Vitamin B12 and folate", "blood_count": "Full blood count",
    "glucose": "HbA1c (blood sugar)", "renal": "Kidney function and electrolytes",
    "medication": "Medication review (anticholinergic and sedative load)", "depression": "Depression screen (PHQ-9)",
    "anxiety": "Anxiety screen (GAD-7)", "sleep": "Sleep and sleep apnoea screen (STOP-BANG)",
    "hearing_vision": "Hearing and vision", "delirium": "Delirium or infection (acute confusion)",
    "alcohol": "Alcohol use", "blood_pressure": "Blood pressure and vascular risk",
}
ROUTINE = ("thyroid", "b12_folate", "blood_count", "glucose", "renal", "medication")
BLOCKED = IN.BLOCKED + ["prescribe", "start treatment", "mg", "donepezil", "memantine", "lecanemab", "rivastigmine", "galantamine"]
MAX_TEXT = 260


def facts(p: dict, ev: dict, dossier: dict) -> list[dict]:
    """Numbered, de-identified facts. Every number a packet may use comes from here."""
    out: list[dict] = []

    def add(kind: str, text: str):
        out.append({"id": f"F{len(out) + 1}", "kind": kind, "text": text})

    pt = dossier.get("participant") or {}
    if pt.get("age"):
        lang = {"ar": "Arabic", "en": "English"}.get(pt.get("language"), pt.get("language") or "not recorded")
        add("person", f"Age {pt['age']}; schooling: {pt.get('education_band') or 'not recorded'}; speaks {lang}.")
    c = dossier.get("concern") or {}
    if c.get("in_their_words"):
        from .deid import redact
        add("concern", f"{c['raised_by']} reported: \"{redact(c['in_their_words'])[0][:200]}\"")
    if c.get("what_changed"):
        add("concern", "Changes reported in: " + ", ".join(c["what_changed"]) + ".")
    if c.get("onset"):
        add("concern", f"Started: {c['onset']}.")
    if c.get("how_often"):
        add("concern", f"How often: {c['how_often']}.")
    if c.get("how_much"):
        add("concern", f"How much: {c['how_much']}.")
    for w in c.get("who_now_does_what") or []:
        add("function", f"Task taken over: {w}.")
    if c.get("red_flags_reported"):
        add("red_flag", "Urgent signs reported: " + ", ".join(c["red_flags_reported"]) + ".")
    if c.get("confounders_reported"):
        add("confounder", "Reported factors that can affect memory: " + ", ".join(c["confounders_reported"]) + ".")
    a = dossier.get("alert") or {}
    if a.get("level"):
        add("checkin", f"Latest check-in result ({a.get('date')}): {a['level'].replace('_', ' ').lower()}. " + " ".join(a.get("reasons") or [])[:220])
    for d in dossier.get("domains") or []:
        if d.get("rci") is not None and d["rci"] <= -1.96:
            add("checkin", f"{d['domain']}: {d['baseline']} at baseline, {d['current']} now (reliable decline).")
    latest = next((s for s in reversed(p.get("sessions") or []) if s.get("type") not in ("intake", "informant") and s.get("raw") is not None), None)
    if latest:
        if latest.get("phq2") is not None:
            add("mood", f"PHQ-2 at the last check-in: {latest['phq2']} of 6.")
        if latest.get("gad2") is not None:
            add("mood", f"GAD-2 at the last check-in: {latest['gad2']} of 6.")
        if latest.get("sleep_hours") is not None:
            add("sleep", f"Sleep reported at the last check-in: {latest['sleep_hours']} hours a night.")
    for m in dossier.get("clinic_assessments") or []:
        add("moca", f"Clinic MoCA {m['date']}: {m['total']} of 30 ({m['test']}{', education point included' if m.get('education_point') else ''}).")
    ctx = p.get("context") or {}
    if ctx.get("sbp") is not None:
        add("health", f"Blood pressure {ctx['sbp']}/{ctx.get('dbp', '?')} mmHg.")
    if ctx.get("hba1c") is not None:
        add("health", f"HbA1c {ctx['hba1c']}%.")
    if ctx.get("hearing_difficulty"):
        add("health", "Hearing difficulty" + (" without a hearing aid." if ctx.get("hearing_aid") is False else "."))
    if ctx.get("smoker"):
        add("health", "Smokes.")
    if ctx.get("social_isolation"):
        add("health", "Socially isolated.")
    if ctx.get("family_history_dementia"):
        add("health", "Family history of memory illness in a parent or sibling.")
    return out


def _has(fs: list[dict], kind: str, *words: str) -> list[str]:
    return [f["id"] for f in fs if f["kind"] == kind and (not words or any(w in f["text"].lower() for w in words))]


def rules_packet(fs: list[dict], dossier: dict) -> dict:
    ids = lambda *xs: [i for x in xs for i in x]  # noqa: E731
    rule_out = []

    def check(key: str, why: str, refs: list[str]):
        rule_out.append({"check": key, "label": CHECKS[key], "why": why, "facts": sorted(set(refs), key=lambda s: int(s[1:]))})

    mood = [f["id"] for f in fs if f["kind"] == "mood" and re.search(r": ([3-6]) of 6", f["text"])]
    if mood or _has(fs, "concern", "mood"):
        check("depression", "Low mood can look like a memory problem.", ids(mood, _has(fs, "concern", "mood")))
    sleep = [f["id"] for f in fs if f["kind"] == "sleep" and re.search(r": ([0-5](\.\d)?) hours", f["text"])]
    if sleep or _has(fs, "concern", "sleep"):
        check("sleep", "Short or poor sleep lowers test scores.", ids(sleep, _has(fs, "concern", "sleep")))
    if _has(fs, "health", "hearing"):
        check("hearing_vision", "Untreated hearing loss affects the spoken check-in and memory.", _has(fs, "health", "hearing"))
    if _has(fs, "confounder", "medic", "tablet"):
        check("medication", "A medicine change was reported.", _has(fs, "confounder", "medic", "tablet"))
    if _has(fs, "red_flag", "sudden", "comes and goes", "fluctuat"):
        check("delirium", "Sudden or fluctuating change needs an acute cause ruled out first.", _has(fs, "red_flag"))
    bp = [f["id"] for f in fs if f["kind"] == "health" and (m := re.search(r"Blood pressure (\d+)", f["text"])) and int(m.group(1)) >= 140]
    if bp:
        check("blood_pressure", "Raised blood pressure is a vascular risk to brain health.", bp)
    a1c = [f["id"] for f in fs if f["kind"] == "health" and (m := re.search(r"HbA1c ([\d.]+)", f["text"])) and float(m.group(1)) >= 6.5]
    for key in ROUTINE:
        if not any(r["check"] == key for r in rule_out):
            if key == "glucose" and a1c:
                check(key, "HbA1c is in the diabetes range.", a1c)
            else:
                check(key, "Routine before a memory assessment.", [])
    summary = []
    for kind in ("checkin", "concern", "moca"):
        f = next((f for f in fs if f["kind"] == kind), None)
        if f:
            summary.append({"text": f["text"], "facts": [f["id"]]})
    ask = []
    missing = (dossier.get("concern") or {}).get("missing") or []
    if any("started" in m for m in missing):
        ask.append({"q": "When did you first notice the change, and did it come on suddenly or slowly?", "facts": []})
    if _has(fs, "function"):
        ask.append({"q": "Which everyday tasks has the family taken over, and since when?", "facts": _has(fs, "function")})
    ask.append({"q": "Is it safe at home: medicines, cooking and the stove, driving, money, going out alone?", "facts": []})
    ask.append({"q": "Any new medicines, illness, falls or hospital stays in the last three months?", "facts": []})
    if mood or _has(fs, "concern", "mood"):
        ask.append({"q": "How has the person's mood and interest in things been over the last two weeks?", "facts": ids(mood, _has(fs, "concern", "mood"))})
    return {"summary": summary, "rule_out": rule_out, "ask": ask, "gaps": missing}


def messages(fs: list[dict]) -> list[dict]:
    lines = "\n".join(f"{f['id']}: {f['text']}" for f in fs)
    checks = ", ".join(CHECKS)
    sys = ("You prepare a short pre-read for a clinician who will review a person flagged by a memory screening check-in. "
           "Use ONLY the numbered facts. Do not name or suggest any diagnosis or disease, do not suggest medicines or doses. "
           "Answer with JSON only, in this shape: "
           '{"summary":[{"text":"...","facts":["F1"]}],"rule_out":[{"check":"<key>","why":"...","facts":["F2"]}],'
           '"ask":[{"q":"...","facts":["F3"]}]}. '
           f"summary: 2 or 3 sentences, each citing its facts. rule_out: at most 5 reversible causes that a fact points to "
           f"(an abnormal value or a reported problem), keys only from: {checks}; do not list routine blood tests, they "
           f"are added automatically. "
           "ask: up to 5 questions for the person and family at the visit. Every item cites the facts it rests on. "
           "Use no number that is not in the cited facts. Write facts as strings like \"F2\". Start your answer with { and "
           "write nothing after the closing }.")
    example = ('Example for other facts (F1: Age 80; speaks English. F2: Sleep reported at the last check-in: 4.5 hours a night. '
               'F3: Story recall: 9 at baseline, 6 now (reliable decline).):\n'
               '{"summary":[{"text":"Story recall fell from 9 to 6, a reliable decline.","facts":["F3"]},'
               '{"text":"Sleep is short at 4.5 hours a night.","facts":["F2"]}],'
               '"rule_out":[{"check":"sleep","why":"Short sleep lowers memory scores.","facts":["F2"]}],'
               '"ask":[{"q":"How has sleep been over the last month?","facts":["F2"]}]}')
    return [{"role": "system", "content": sys + "\n\n" + example}, {"role": "user", "content": "Facts:\n" + lines}]


def _clean(t: str) -> str:
    return re.sub(r"\s*[\[(]\s*F\d+(?:\s*,\s*F\d+)*\s*[\])]", "", t).strip()


def _blocked(t: str) -> bool:
    low = IN.DISCLAIMER.sub("", t.lower())
    return any(re.search(r"\b" + b.replace("$", r"\b"), low) for b in BLOCKED)


def _nums(t: str) -> set[float]:
    return {float(n) for n in re.findall(r"\d+(?:\.\d+)?", t)}


def _numbers_ok(t: str, refs: list[str], by_id: dict) -> bool:
    src = _nums(" ".join(by_id[r] for r in refs))
    t = re.sub(r"\bF\d+\b", "", t)   # fact labels written in the sentence are not numbers
    return _nums(t) <= src             # 4 and 4.0 are the same number


def supports(check: str, text: str) -> bool:
    """Does this fact actually point to this check? (the same thresholds as the rules)"""
    low = text.lower()
    num = lambda pat: (lambda m: float(m.group(1)) if m else None)(re.search(pat, text))  # noqa: E731
    if check == "depression":
        v = num(r"PHQ-2 [^:]*: ([\d.]+)")
        return (v is not None and v >= 3) or ("reported" in low and ("mood" in low or "sad" in low or "depress" in low))
    if check == "anxiety":
        v = num(r"GAD-2 [^:]*: ([\d.]+)")
        return (v is not None and v >= 3) or ("reported" in low and "anxi" in low)
    if check == "sleep":
        v = num(r"Sleep [^:]*: ([\d.]+) hours")
        return (v is not None and v < 6) or ("reported" in low and "sleep" in low)
    if check == "hearing_vision":
        return "hearing" in low or "vision" in low or "eyesight" in low
    if check == "medication":
        return "medic" in low or "tablet" in low
    if check == "delirium":
        return "urgent signs" in low or "sudden" in low or "comes and goes" in low
    if check == "blood_pressure":
        v = num(r"Blood pressure (\d+)")
        return v is not None and v >= 140
    if check == "glucose":
        v = num(r"HbA1c ([\d.]+)")
        return v is not None and v >= 6.5
    if check == "alcohol":
        return "alcohol" in low
    return False   # routine checks (thyroid, B12, blood count, kidney) are added by the rules without facts


def _refs(v) -> list[str]:
    """Fact references as the model writes them: "F2", 2, "2", "F2, F7" -> ["F2", ...]."""
    if isinstance(v, (str, int)):
        v = re.findall(r"\d+", str(v))
    out = []
    for r in v or []:
        m = re.search(r"\d+", str(r))
        if m:
            out.append(f"F{int(m.group(0))}")
    return out


SECTION_KEYS = {"summary": ("summary",), "rule_out": ("rule_out", "rule out", "checks", "reversible_causes", "reversible causes"),
                "ask": ("ask", "questions")}


def _salvage(s: str, dec: json.JSONDecoder) -> dict | None:
    out = {}
    for name, keys in SECTION_KEYS.items():
        m = re.search(r'"(?:' + "|".join(re.escape(k) for k in keys) + r')"\s*:\s*\[', s, re.I)
        if not m:
            continue
        nxt = re.search(r'"(?:' + "|".join(re.escape(k) for ks in SECTION_KEYS.values() for k in ks) + r')"\s*:', s[m.end():], re.I)
        body = s[m.end(): m.end() + nxt.start()] if nxt else s[m.end():]
        items = []
        for o in re.finditer(r"\{", body):
            try:
                obj, _ = dec.raw_decode(body[o.start():])
            except ValueError:
                items.append(None)   # a broken item: counted as removed
                continue
            if isinstance(obj, dict):
                items.append(obj)
        items += [x for x in re.findall(r'^\s*"([^"]{8,})"\s*,?\s*$', body, re.M)] if name != "rule_out" else []
        out[name] = items
    return out or None


ALIASES = {"hypertension": "blood_pressure", "bp": "blood_pressure", "diabetes": "glucose", "hba1c": "glucose",
           "b12": "b12_folate", "folate": "b12_folate", "tsh": "thyroid", "anaemia": "blood_count", "anemia": "blood_count",
           "kidney": "renal", "medications": "medication", "mood": "depression", "hearing": "hearing_vision",
           "vision": "hearing_vision", "sleep_apnoea": "sleep", "sleep_apnea": "sleep", "infection": "delirium"}


def parse(raw: str | None) -> dict | None:
    """The first JSON object in the answer (code fences, text around it and key case tolerated), normalised."""
    if not raw:
        return None
    s = re.sub(r"```(?:json)?", "", raw)
    dec = json.JSONDecoder()
    data = None
    for m in re.finditer(r"\{", s):
        try:
            obj, _ = dec.raw_decode(s[m.start():])
        except ValueError:
            continue
        if isinstance(obj, dict) and {str(k).lower() for k in obj} & {"summary", "rule_out", "ask", "questions", "checks"}:
            data = obj
            break
    if data is None:
        data = _salvage(s, dec)   # broken or cut-off JSON: read each section, and each item, on its own
    if not data:
        return None
    data = {str(k).strip().lower().replace(" ", "_").replace("-", "_"): v for k, v in data.items()}
    data["rule_out"] = data.get("rule_out") or data.get("checks") or data.get("reversible_causes") or []
    data["ask"] = data.get("ask") or data.get("questions") or []
    summ = data.get("summary") or []
    if isinstance(summ, str):
        summ = [{"text": summ, "facts": re.findall(r"F\d+", summ)}]
    norm = lambda items, key: [  # noqa: E731
        ({key: it, "facts": []} if isinstance(it, str) else {**it, key: it.get(key) or it.get("text") or it.get("question") or it.get("reason"),
                                                            "facts": _refs(it.get("facts") or it.get("fact_ids") or it.get("refs"))}
         if isinstance(it, dict) else None)
        for it in items]
    data["summary"] = norm(summ, "text")
    data["ask"] = norm(data["ask"], "q")
    data["rule_out"] = [({**it, "check": ALIASES.get(k := str(it.get("check") or it.get("key") or "").strip().lower().replace(" ", "_"), k),
                          "why": it.get("why") or it.get("reason"),
                          "facts": _refs(it.get("facts") or it.get("fact_ids") or it.get("refs"))} if isinstance(it, dict) else None)
                        for it in data["rule_out"]]
    return data


def verify(raw: str, fs: list[dict]) -> tuple[dict | None, int, int]:
    """Keep only grounded items. Returns (packet or None, kept, removed)."""
    data = parse(raw)
    if not data:
        return None, 0, 0
    by_id = {f["id"]: f["text"] for f in fs}
    kept = removed = 0
    out = {"summary": [], "rule_out": [], "ask": []}

    def ok(text, refs, need_refs=True):
        refs = [r for r in refs if isinstance(r, str)]
        return (isinstance(text, str) and 0 < len(text) <= MAX_TEXT and all(r in by_id for r in refs)
                and (refs or not need_refs) and not _blocked(text) and _numbers_ok(text, refs, by_id))

    for it in data.get("summary") or []:
        if isinstance(it, dict) and ok(it.get("text"), it.get("facts") or []):
            out["summary"].append({"text": _clean(it["text"]), "facts": it["facts"]}); kept += 1
        else:
            removed += 1
    seen = set()
    for it in data.get("rule_out") or []:
        refs = (it.get("facts") or []) if isinstance(it, dict) else []
        grounded = isinstance(it, dict) and refs and all(r in by_id and supports(it.get("check"), by_id[r]) for r in refs)
        if isinstance(it, dict) and it.get("check") in CHECKS and it["check"] not in seen and grounded and ok(it.get("why"), refs):
            seen.add(it["check"])
            out["rule_out"].append({"check": it["check"], "label": CHECKS[it["check"]], "why": _clean(it["why"]), "facts": it.get("facts") or []}); kept += 1
        else:
            removed += 1
    for it in (data.get("ask") or [])[:6]:
        if isinstance(it, dict) and ok(it.get("q"), it.get("facts") or [], need_refs=False):
            out["ask"].append({"q": _clean(it["q"]), "facts": it.get("facts") or []}); kept += 1
        else:
            removed += 1
    if not out["summary"]:
        return None, kept, removed
    return out, kept, removed


def merge(model: dict, rules: dict) -> dict:
    """Model's summary and questions; checks = model's, then the routine ones it left out (never fewer than the rules)."""
    have = {r["check"] for r in model["rule_out"]}
    extra = [r for r in rules["rule_out"] if r["check"] not in have]
    return {"summary": model["summary"], "rule_out": model["rule_out"] + extra, "ask": model["ask"] or rules["ask"], "gaps": rules["gaps"]}
