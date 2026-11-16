"""Caregiver narrative intake: extraction with source spans and confidence, referral drafting and a
deterministic grounding verifier.

Two extractors share one output format:
  * ``extract_rules``: lexicon + negation rules (English and Gulf Arabic). Always available; runs in the
    browser too (web/intake.js is a parity-tested port).
  * an LLM (MedGemma) behind ``api/main.py``: its JSON is passed through ``ground_llm_output``, which drops
    any field whose evidence quote is not found in the narrative, so nothing unsupported reaches a clinician.

Nothing here diagnoses. Every field is a reported observation with the words it came from. Red flags are
tuned for sensitivity: any red-flag hit, at any confidence, triggers the urgent protocol prompt.
"""
from __future__ import annotations

import json
import re

INTAKE_VERSION = "intake-0.1.0"
REVIEW_BELOW = 0.7          # fields under this confidence are shown as "needs confirmation"
# "~" in a lexicon entry marks a weak cue. Confidence is a fixed table (identical in Python and JS):
# one strong cue 0.85, strong + weak 0.9, two or more strong 0.95, one weak 0.55, two or more weak 0.7.


def _confidence(n_strong: int, n_weak: int) -> float:
    if n_strong >= 2:
        return 0.95
    if n_strong == 1:
        return 0.9 if n_weak else 0.85
    return 0.7 if n_weak >= 2 else 0.55

DOMAINS = {
    "memory": "Memory", "language": "Word-finding and conversation", "orientation": "Orientation (time, place, people)",
    "executive": "Money, planning and decisions", "daily_function": "Daily activities", "mood": "Mood",
    "behaviour": "Behaviour or personality", "sleep": "Sleep"}
RED_FLAGS = {  # keys identical to config.RED_FLAGS
    "sudden_onset": "Sudden change", "fluctuating_confusion": "Confusion that comes and goes",
    "new_neuro_symptoms": "New weakness, facial droop, slurred speech or severe headache",
    "recent_fall_head_injury": "Recent fall or head injury", "rapid_deterioration": "Rapid worsening",
    "safety_risk": "Safety risk (wandering, gas or stove left on, unsafe at home)"}
CONFOUNDERS = {"new_medication": "New or changed medication", "recent_illness": "Recent illness or hospital stay",
               "hearing": "Hearing difficulty", "bereavement": "Recent bereavement"}
ACTIVITIES = {"money": "Managing money / bills", "medicines": "Managing medicines", "cooking": "Cooking",
              "shopping": "Shopping", "driving": "Driving or getting around", "phone": "Using the phone",
              "appointments": "Remembering appointments", "household": "Household tasks", "prayer": "Prayer times / routines"}
WHO = {"son": "son", "daughter": "daughter", "wife": "wife", "husband": "husband", "brother": "brother",
       "sister": "sister", "driver": "driver", "helper": "household helper", "informant": "the informant",
       "other": "another relative"}
ONSET = {"days": "over the last few days", "weeks": "over recent weeks", "months": "over recent months",
         "years": "over a year or more"}

# --- lexicons (written in plain spelling; normalised at load time) -----------------------------------
LEX = {
    "domain": {
        "memory": {"en": ["forget", "forgot", "repeats", "repeating", "repeat the same", "same question", "asks the same",
                          "can't remember", "cannot remember", "doesn't remember", "does not remember", "couldn't remember",
                          "didn't remember", "never remember", "misplac", "loses things", "losing things", "memory has",
                          "memory is getting", "memory problem", "memory loss", "memory is slipping", "short-term memory",
                          "short term memory", "where he put", "where she put", "~memory"],
                   "ar": ["ينسى", "تنسى", "نسى", "نسي", "نست", "نسيان", "يعيد نفس", "تعيد نفس", "نفس السؤال", "يعيد كلامه",
                          "تعيد كلامها", "يكرر", "تكرر", "ما يتذكر", "ما تتذكر", "ما تذكر", "ما يذكر", "ما تذكرت", "ما تذكر",
                          "ذاكرته تخف", "ذاكرتها تخف", "~ذاكرته", "~ذاكرتها", "~الذاكره", "وين حط", "وين حطت"]},
        "language": {"en": ["finding the right word", "finding words", "find the right word", "find the word", "word-finding",
                            "word finding", "lost for words", "mixes up words", "mixing up words", "wrong name", "wrong word",
                            "follow the conversation", "follow conversation", "following conversation", "speech has become harder"],
                     "ar": ["تدور على الكلمه", "يدور على الكلمه", "ما يلقى الكلمه", "ما تلقى الكلمه", "يلخبط الكلام", "تلخبط الكلام",
                            "بغير اسمها", "بغير اسمه", "يغلط في الاسامي", "تغلط في الاسامي", "تتابع السالفه", "يتابع السالفه",
                            "كلامه صعب", "كلامها صعب"]},
        "orientation": {"en": ["got lost", "gets lost", "getting lost", "get lost", "lost his way", "lost her way", "didn't recognise",
                               "didn't recognize", "doesn't recognise", "doesn't recognize", "what day it is", "where she was",
                               "where he was", "know what day", "doesn't know what day", "didn't know what day", "don't know what day", "doesn't know where", "didn't know where", "~confused", "~muddled", "~disorient"],
                        "ar": ["ضاع", "ضاعت", "تضيع في", "يضيع في", "ضيع الطريق", "ضيعت الطريق", "ما عرفني", "ما عرفتني",
                               "ما عرف وين", "ما تعرف وين", "ما يعرف وين", "اي يوم اليوم", "ما تعرف اي يوم", "ما يعرف اي يوم", "اي يوم", "~متلخبط", "~متلخبطه"]},
        "executive": {"en": ["money", "bills", "bank", "finances", "scam", "budget", "the remote", "~planning", "~decisions"],
                      "ar": ["الفلوس", "فلوس", "الفواتير", "البنك", "نصاب", "الريموت", "يدير الفلوس", "~يخطط"]},
        "daily_function": {"en": ["cook", "stopped driving", "the driving", "~driving", "~drive", "shopping", "dressing", "dress himself",
                                  "dress herself", "his appearance", "her appearance", "hygiene", "praying on time", "fridge is empty",
                                  "washing machine", "medicines", "his tablets", "her tablets", "~the phone"],
                           "ar": ["يطبخ", "تطبخ", "الطبخ", "~يسوق", "~اسوق", "السواقه", "المقاضي", "يلبس", "تلبس", "يتسبح", "تتسبح",
                                  "ادويته", "ادويتها", "حبوبه", "حبوبها", "يصلي في وقته", "تصلي في وقتها", "الثلاجه فاضيه",
                                  "الغساله", "~التلفون"]},
        "mood": {"en": ["sad", "feeling low", "very low", "seems low", "low mood", "feeling down", "seems down", "depress",
                        "withdrawn", "doesn't want to go out", "lost interest", "no interest", "cries", "crying", "anxious",
                        "lonely"],
                 "ar": ["حزين", "حزينه", "ضايق", "ضايقه", "متضايق", "متضايقه", "مكتئب", "مكتئبه", "اكتئاب", "يبكي", "تبكي",
                        "ما يبي يطلع", "ما تبي تطلع", "ما تبي تشوف", "ما يبي يشوف", "ما له خلق", "ما لها خلق", "قلقان", "قلقانه"]},
        "behaviour": {"en": ["irritable", "angry", "aggressive", "shouts", "shouting", "snaps", "suspicious", "accuses", "blames",
                             "stealing", "personality", "not like him", "not like her", "rude", "sees things", "sees children",
                             "who aren't there", "hallucinat", "~not himself", "~not herself"],
                      "ar": ["عصبي", "عصبيه", "يعصب", "تعصب", "يصارخ", "تصارخ", "يصرخ", "تصرخ", "يشك", "تشك", "يتهم", "تتهم",
                             "سرقت", "تغير طبعه", "تغير طبعها", "قلة ادب", "يشوف عيال", "يشوف اشياء", "تشوف اشياء", "ما لهم وجود"]},
        "sleep": {"en": ["sleeping most", "not sleeping", "can't sleep", "awake at night", "up at night", "insomnia", "~sleep"],
                  "ar": ["تنام اغلب", "ينام اغلب", "ما ينام", "ما تنام", "يصحى بالليل", "تصحى بالليل", "~النوم"]},
    },
    "red_flag": {
        "sudden_onset": {"en": ["sudden", "overnight", "out of nowhere", "since yesterday", "yesterday", "since tuesday", "since monday",
                                "since wednesday", "since thursday", "since friday", "since saturday", "since sunday", "since then",
                                "since a fall"],
                         "ar": ["فجاه", "بين يوم وليله", "من امس", "امس", "البارحه", "من يومها", "من يوم الثلاثاء", "من يوم الاثنين",
                                "من يوم الاربعاء", "من يوم الخميس", "من يوم الجمعه", "من يوم السبت", "من يوم الاحد"]},
        "fluctuating_confusion": {"en": ["comes and goes", "good days and bad days", "worse at night", "worse in the evening",
                                         "better in the morning", "drowsy", "in and out"],
                                  "ar": ["يوم زين ويوم", "ساعات زين", "بالليل اسوا", "بالليل اسوء", "الصبح احسن", "نعسان", "نعسانه"]},
        "new_neuro_symptoms": {"en": ["slurred", "slurring", "droop", "weak on one side", "felt weak", "hand weak", "arm weak",
                                      "weakness", "can't move his", "can't move her", "severe headache", "worst headache", "numb$",
                                      "double vision"],
                               "ar": ["كلامه ثقيل", "كلامها ثقيل", "ثقل في", "ضعيفه", "ضعف في", "ما يقدر يحرك", "ما تقدر تحرك",
                                      "مايل", "صداع قوي", "صداع شديد", "تنميل", "خدر"]},
        "recent_fall_head_injury": {"en": ["fell$", "fallen$", "a fall$", "had a fall", "hit his head", "hit her head", "head injury",
                                           "banged his head", "banged her head", "slipped"],
                                    "ar": ["طاح", "طاحت", "طيحه", "ضرب راسه", "ضربت راسها", "زلق", "زلقت", "انزلق", "انزلقت"]},
        "rapid_deterioration": {"en": ["worse quickly", "getting worse fast", "downhill fast", "gone downhill", "rapidly", "much worse",
                                       "declined fast"],
                                "ar": ["بسرعه", "تتدهور", "يتدهور", "ساءت", "تدهورت"]},
        "safety_risk": {"en": ["wander", "left the gas", "gas on", "left the stove", "stove on", "burned", "burnt", "walked out of the house",
                               "leave the house at night", "found her outside", "found him outside", "unsafe", "lives alone and",
                               "stopped eating", "not eating"],
                        "ar": ["الغاز مفتوح", "خلى الغاز", "خلت الغاز", "نسى الغاز", "نست الغاز", "طلع من البيت", "طلعت من البيت",
                               "يطلع من البيت", "تطلع من البيت", "حرقت", "حرق", "لقوها برا", "لقوه برا", "يهيم", "ما ياكل", "ما تاكل"]},
    },
    "confounder": {
        "new_medication": {"en": ["new medicine", "new medication", "new tablets", "new pills", "new blood pressure tablets",
                                  "changed her medication", "changed his medication", "changed her medicine", "changed his medicine",
                                  "started on", "sleeping pills"],
                           "ar": ["الدوا الجديد", "دوا جديد", "دواء جديد", "علاج جديد", "حبوب جديده", "غير لها الدوا",
                                  "غير له الدوا", "غيروا الدوا", "حبوب النوم"]},
        "recent_illness": {"en": ["infection", "fever", "flu", "hospital", "admitted", "surgery", "operation", "pneumonia", "covid"],
                           "ar": ["التهاب", "حمى", "انفلونزا", "المستشفى", "عمليه", "كورونا"]},
        "hearing": {"en": ["can't hear", "cannot hear", "hard of hearing", "hearing aid", "deaf"],
                    "ar": ["ما يسمع", "ما تسمع", "سمعه ضعيف", "سمعها ضعيف", "سماعه", "اطرش"]},
        "bereavement": {"en": ["passed away", "died", "death of", "widow", "funeral"],
                        "ar": ["توفى", "توفت", "توفي", "وفاه", "الله يرحمه", "الله يرحمها", "ارمله"]},
    },
}
ACT_LEX = {
    "money": {"en": ["money", "bills", "bank", "finances", "pay"], "ar": ["الفلوس", "فلوس", "الفواتير", "البنك", "يدفع", "تدفع", "ادفع"]},
    "medicines": {"en": ["medicines", "medication", "tablets", "pills"], "ar": ["ادويته", "ادويتها", "الدوا", "حبوبه", "حبوبها"]},
    "cooking": {"en": ["cook", "meals"], "ar": ["تطبخ", "يطبخ", "الطبخ"]},
    "shopping": {"en": ["shopping", "groceries"], "ar": ["المقاضي", "التسوق"]},
    "driving": {"en": ["driving", "drives", "drive$"], "ar": ["يسوق فيه", "يسوق", "يوديه", "توديه", "يوصله"]},
    "phone": {"en": ["phone"], "ar": ["التلفون", "الجوال"]},
    "appointments": {"en": ["appointments"], "ar": ["المواعيد", "مواعيده", "مواعيدها"]},
    "household": {"en": ["housework", "cleaning"], "ar": ["شغل البيت", "التنظيف"]},
    "prayer": {"en": ["prayer", "praying"], "ar": ["يصلي", "صلاه", "الصلاه"]},
}
WHO_LEX = {
    "son": {"en": ["my son", "her son", "his son"], "ar": ["ولدي", "ولده", "ولدها"]},
    "daughter": {"en": ["my daughter", "her daughter", "his daughter"], "ar": ["بنتي", "بنته", "بنتها"]},
    "wife": {"en": ["my wife", "his wife"], "ar": ["زوجتي", "زوجته"]},
    "husband": {"en": ["my husband", "her husband"], "ar": ["زوجي", "زوجها"]},
    "brother": {"en": ["my brother$", "her brother$", "his brother$"], "ar": ["اخوي", "اخوه", "اخوها"]},
    "sister": {"en": ["my sister$", "her sister$", "his sister$"], "ar": ["اختي", "اخته", "اختها"]},
    "driver": {"en": ["driver"], "ar": ["السايق", "الدريول"]},
    "helper": {"en": ["maid", "helper", "housekeeper", "nanny"], "ar": ["الخدامه", "الشغاله", "المربيه"]},
    "informant": {"en": ["i$", "i'm$", "i've$"], "ar": ["انا"]},
    "other": {"en": ["my cousin", "my uncle", "my aunt", "my nephew", "my niece", "my mum$", "my mom$"], "ar": ["ولد عمي", "بنت عمي", "خالي", "عمي"]},
}
TAKEOVER = {"en": ["now", "took over", "takes over", "instead", "handles", "has to", "reminds"],
            "ar": ["الحين", "صار", "صارت", "عنه", "عنها", "بداله", "بدالها"]}
NEG = {"en": {"no", "not", "never", "isn't", "doesn't", "don't", "didn't", "hasn't", "haven't", "without", "denies", "none"},
       "ar": {"ما", "مب", "مو", "لا", "بدون", "مافي", "مش", "ابد"}}
# a clause that opens with one of these negates everything after it ("no problem with his memory or behaviour")
NEG_CLAUSE = {"en": ["no problem", "no real problem", "nothing wrong", "no issue", "no concern"],
              "ar": ["ما فيه مشكله", "ما في مشكله", "مافي مشكله", "ما فيه شي", "ما عليه شي"]}
AR_PREFIX = ["وال", "بال", "فال", "لل", "ال", "و", "ف", "ب", "ل"]
CLAUSE = ".!?;,،؛؟\n"
SENT = ".!?;؟\n"

# --- length-tracking normaliser -----------------------------------------------------------------------
_DIAC = set(chr(c) for c in list(range(0x0610, 0x061B)) + list(range(0x064B, 0x0660)) + [0x0670, 0x0640] + list(range(0x06D6, 0x06EE)))
_MAP = {"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي", "’": "'", "‘": "'", "`": "'"}
_MAP.update({chr(0x0660 + i): str(i) for i in range(10)})
_MAP.update({chr(0x06F0 + i): str(i) for i in range(10)})


def normalise(text: str) -> tuple[str, list[int]]:
    """Lower-case, unify Arabic letter variants, drop diacritics/tatweel, collapse spaces.
    Returns the normalised text and, for each of its characters, the index in the original."""
    out, idx = [], []
    for i, ch in enumerate(text or ""):
        if ch in _DIAC:
            continue
        lo = ch.lower()
        ch = lo if len(lo) == 1 else ch
        ch = _MAP.get(ch, ch)
        if ch.isspace():
            if out and out[-1] == " ":
                continue
            ch = " "
        out.append(ch); idx.append(i)
    return "".join(out), idx


def _norm(s: str) -> str:
    return normalise(s)[0]


def _is_letter(ch: str) -> bool:
    return ch.isalpha()


def _entries(lst):
    for e in lst:
        weak = e.startswith("~")
        e = e[1:] if weak else e
        rb = e.endswith("$")
        e = e[:-1] if rb else e
        yield _norm(e), weak, rb


def _find(norm: str, phrase: str, rb: bool):
    """Start/end positions of phrase in norm with a word boundary on the left (Arabic clitics allowed)."""
    i = norm.find(phrase)
    while i != -1:
        ok = i == 0 or not _is_letter(norm[i - 1])
        if not ok:
            for p in AR_PREFIX:
                j = i - len(p)
                if j >= 0 and norm[j:i] == p and (j == 0 or not _is_letter(norm[j - 1])):
                    ok = True
                    break
        end = i + len(phrase)
        if ok and rb and end < len(norm) and _is_letter(norm[end]):
            ok = False
        if ok:
            yield i, end
        i = norm.find(phrase, i + 1)


def _negated(norm: str, start: int, lang: str) -> bool:
    cs = max(norm.rfind(c, 0, start) for c in CLAUSE) + 1
    if any(_norm(ph) in norm[cs:start] for ph in NEG_CLAUSE[lang]):
        return True
    toks = norm[cs:start].split()[-2:]
    neg = NEG[lang]
    return any(t in neg or (lang == "ar" and t != "ولا" and t[:1] in "وف" and t[1:] in neg) for t in toks)


def _span(idx, s, e):
    return [idx[s], idx[e - 1] + 1]


def _detect_lang(text: str) -> str:
    ar = sum(1 for c in text if "؀" <= c <= "ۿ")
    return "ar" if ar > len(text) * 0.2 else "en"


# --- onset ---------------------------------------------------------------------------------------------
_NUM = {"a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "few": 3, "couple of": 2,
        "several": 4, "last": 1, "past": 1, "18": 18}
_UNIT_EN = {"day": "day", "week": "week", "month": "month", "year": "year"}
_RX_EN = re.compile(r"(?<![a-z])([0-9]+|an|a|one|two|three|four|five|six|few|couple of|several|last|past)\s+(?:few\s+)?(?:or\s+\w+\s+)?(day|week|month|year)s?(?![a-z])")
_AR_UNITS = {"يوم": ("day", 1), "ايام": ("day", 3), "يومين": ("day", 2), "اسبوع": ("week", 1), "اسابيع": ("week", 3),
             "اسبوعين": ("week", 2), "شهر": ("month", 1), "شهور": ("month", 3), "اشهر": ("month", 3), "شهرين": ("month", 2),
             "سنه": ("year", 1), "سنين": ("year", 3), "سنتين": ("year", 2), "سنوات": ("year", 3)}
_AR_NUM = {"كم": 3, "ثلاث": 3, "الثلاث": 3, "اربع": 4, "خمس": 5, "ست": 6, "الست": 6, "سبع": 7, "ثمان": 8, "عشر": 10}
_RX_AR = re.compile(r"(?<![ء-ي])(?:من|قبل|خلال)\s+(?:حوالي\s+|تقريبا\s+)?(?:([0-9]+|كم|ثلاث|الثلاث|اربع|خمس|ست|الست|سبع|ثمان|عشر)\s+)?"
                    r"(يومين|يوم|ايام|اسبوعين|اسبوع|اسابيع|شهرين|شهر|شهور|اشهر|سنتين|سنه|سنين|سنوات)(?![ء-ي])")
_RX_AR_LAST = re.compile(r"(?<![\u0621-\u064a])من\s+(الاسبوع|الشهر|السنه)\s+(?:اللي\s+طاف|الماضي|الماضيه)")
_RANK = {"days": 0, "weeks": 1, "months": 2, "years": 3}


def _bucket(unit: str, n: float) -> str:
    if unit == "day":
        return "days" if n < 14 else "weeks"
    if unit == "week":
        return "weeks" if n < 8 else "months"
    if unit == "month":
        return "months" if n < 12 else "years"
    return "years"


def _onset(norm: str, idx: list[int], lang: str):
    best = None
    if lang == "en":
        for m in _RX_EN.finditer(norm):
            n = int(m.group(1)) if m.group(1).isdigit() else _NUM.get(m.group(1), 1)
            if m.group(1) in ("last", "past") and m.group(2) == "month" and "few" not in m.group(0):
                n = 1
            b = _bucket(_UNIT_EN[m.group(2)], n)
            if best is None or _RANK[b] > _RANK[best[0]]:
                best = (b, m.start(), m.end())
    else:
        for m in _RX_AR_LAST.finditer(norm):
            b = {"الاسبوع": "weeks", "الشهر": "months", "السنه": "years"}[m.group(1)]
            if best is None or _RANK[b] > _RANK[best[0]]:
                best = (b, m.start(), m.end())
        for m in _RX_AR.finditer(norm):
            unit, base = _AR_UNITS[m.group(2)]
            n = base if not m.group(1) else (int(m.group(1)) if m.group(1).isdigit() else _AR_NUM[m.group(1)])
            b = _bucket(unit, n)
            if best is None or _RANK[b] > _RANK[best[0]]:
                best = (b, m.start(), m.end())
    if best is None:
        return None
    return {"value": best[0], "label": ONSET[best[0]], "confidence": 0.8, "spans": [_span(idx, best[1], best[2])]}


# --- timeline (who took over which activity) ------------------------------------------------------------
def _sentences(norm: str):
    s = 0
    for i, ch in enumerate(norm + "."):
        if ch in SENT:
            if i > s:
                yield s, i
            s = i + 1


def _timeline(norm: str, idx: list[int], lang: str):
    out = []
    for s, e in _sentences(norm):
        seg = norm[s:e]
        cues = [a for t in TAKEOVER[lang] for a, _ in _find(seg, _norm(t), False)]
        if not cues:
            continue
        whos = []
        for k, lx in WHO_LEX.items():
            for ph, _w, rb in _entries(lx[lang]):
                for a, b in _find(seg, ph, rb):
                    whos.append((a, b, k))
        if not whos:
            continue
        acts = []
        for k, lx in ACT_LEX.items():
            for ph, _w, rb in _entries(lx[lang]):
                for a, b in _find(seg, ph, rb):
                    acts.append((a, b, k))
        if not acts:
            continue
        who = min(whos, key=lambda w: (min(abs(w[0] - c) for c in cues), w[0]))[2]
        seen = set()
        for a, b, k in sorted(acts):
            if k in seen:
                continue
            seen.add(k)
            out.append({"activity": k, "activity_label": ACTIVITIES[k], "who_took_over": who, "who_label": WHO[who],
                        "confidence": 0.75, "spans": [_span(idx, s, e)]})
    return out


# --- main extractor ------------------------------------------------------------------------------------
def extract_rules(text: str, lang: str | None = None) -> dict:
    lang = lang or _detect_lang(text)
    norm, idx = normalise(text)
    fields = []
    for kind, groups in LEX.items():
        labels = {"domain": DOMAINS, "red_flag": RED_FLAGS, "confounder": CONFOUNDERS}[kind]
        for key, lx in groups.items():
            hits = []
            for ph, weak, rb in _entries(lx.get(lang, [])):
                for a, b in _find(norm, ph, rb):
                    if not _negated(norm, a, lang):
                        hits.append((a, b, weak))
            if not hits:
                continue
            hits.sort()
            spans, n_strong, n_weak, last_end = [], 0, 0, -1
            for a, b, weak in hits:
                if a < last_end:      # overlapping hit of the same field: count once
                    continue
                last_end = b
                spans.append(_span(idx, a, b))
                n_weak += weak; n_strong += not weak
            conf = _confidence(n_strong, n_weak)
            fields.append({"kind": kind, "key": key, "label": labels[key], "confidence": conf,
                           "needs_confirmation": conf < REVIEW_BELOW, "spans": spans,
                           "evidence": [text[s:e] for s, e in spans]})
    out = {"engine": "rules", "version": INTAKE_VERSION, "lang": lang, "fields": fields,
           "onset": _onset(norm, idx, lang), "timeline": _timeline(norm, idx, lang)}
    out["urgent"] = any(f["kind"] == "red_flag" for f in fields)
    return out


def summary_keys(res: dict) -> dict:
    """Flat view used by the evaluation and the UI read-back."""
    f = res["fields"]
    return {"domains": sorted({x["key"] for x in f if x["kind"] == "domain"}),
            "red_flags": sorted({x["key"] for x in f if x["kind"] == "red_flag"}),
            "confounders": sorted({x["key"] for x in f if x["kind"] == "confounder"}),
            "onset": (res.get("onset") or {}).get("value"),
            "timeline": sorted({(t["activity"], t["who_took_over"]) for t in res.get("timeline", [])})}


# --- LLM (MedGemma) prompt and grounding --------------------------------------------------------------
# Worked examples for the model (taken from the DEVELOPMENT set; those ids are excluded when scoring dev).
FEW_SHOT = [
    ("d-en-10", "My wife can't cook anymore because she forgets steps, so our maid cooks now. She also gets lost in the neighbourhood.",
     {"domains": [{"key": "memory", "evidence": "she forgets steps"}, {"key": "daily_function", "evidence": "can't cook anymore"},
                  {"key": "orientation", "evidence": "gets lost in the neighbourhood"}],
      "red_flags": [], "confounders": [], "onset": {"value": "unknown", "evidence": ""},
      "timeline": [{"activity": "cooking", "who_took_over": "helper", "evidence": "our maid cooks now"}]}),
    ("d-ar-05", "أمي ما تعرف تستخدم الريموت ولا الغسالة، وما تقدر تدير بطاقة البنك. أختي الحين تدفع الفواتير عنها. شوي شوي من ثلاث سنين.",
     {"domains": [{"key": "daily_function", "evidence": "ما تعرف تستخدم الريموت ولا الغسالة"}, {"key": "executive", "evidence": "ما تقدر تدير بطاقة البنك"}],
      "red_flags": [], "confounders": [], "onset": {"value": "years", "evidence": "من ثلاث سنين"},
      "timeline": [{"activity": "money", "who_took_over": "sister", "evidence": "أختي الحين تدفع الفواتير عنها"}]}),
    ("d-en-03", "My husband had a stroke two years ago. Since a fall last Sunday he is much more confused and keeps trying to leave the house at night.",
     {"domains": [{"key": "orientation", "evidence": "he is much more confused"}],
      "red_flags": [{"key": "recent_fall_head_injury", "evidence": "Since a fall last Sunday"}, {"key": "sudden_onset", "evidence": "Since a fall last Sunday"},
                    {"key": "safety_risk", "evidence": "keeps trying to leave the house at night"}],
      "confounders": [], "onset": {"value": "days", "evidence": "Since a fall last Sunday"}, "timeline": []}),
]
FEW_SHOT_IDS = {x[0] for x in FEW_SHOT}


def llm_messages(text: str, lang: str, few_shot: bool = True) -> list[dict]:
    """Prompt v2: allowed keys as plain lists, explicit rules, worked examples (English and Gulf Arabic)."""
    keys = (f"domains: {list(DOMAINS)}\nred_flags: {list(RED_FLAGS)}\nconfounders: {list(CONFOUNDERS)}\n"
            f"onset: ['days', 'weeks', 'months', 'years', 'unknown']\ntimeline activity: {list(ACTIVITIES)}\n"
            f"timeline who_took_over: {list(WHO)}")
    sys_ = ("You extract facts from what a family member, helper, clinician or the person themselves says about changes in an "
            "older adult. A clinician will check every item. Return ONLY one JSON object with the fields domains, red_flags, "
            "confounders, onset and timeline, using ONLY these keys:\n" + keys + "\n\nRules:\n"
            "1. 'evidence' must be copied EXACTLY from the text, in the text's own language and spelling. Never translate or paraphrase.\n"
            "2. Include an item only if the text says it. Leave out anything denied ('no falls', 'his memory is fine').\n"
            "3. red_flags: sudden_onset = started over hours or days or 'since <a recent day>'; fluctuating_confusion = better and worse "
            "at different times; new_neuro_symptoms = weakness, slurred or heavy speech, facial droop, severe headache; "
            "recent_fall_head_injury = a fall or head injury; rapid_deterioration = getting worse fast; safety_risk = gas or stove "
            "left on, burned pots, wandering or leaving home, found outside, not eating. When unsure about a red flag, include it.\n"
            "4. onset = when the change began (the longest time mentioned for the change), 'unknown' if not said.\n"
            "5. timeline = an everyday activity that someone else now does; 'informant' if the speaker says 'I' or 'انا'.\n"
            "6. Never diagnose and never add anything that is not in the text.")
    msgs = [{"role": "system", "content": sys_}]
    if few_shot:
        for _id, t, j in FEW_SHOT:
            msgs += [{"role": "user", "content": f"Text:\n{t}"}, {"role": "assistant", "content": json.dumps(j, ensure_ascii=False)}]
    msgs.append({"role": "user", "content": f"Text:\n{text}"})
    return msgs


def ground_llm_output(raw: str, text: str, lang: str, engine: str = "medgemma") -> dict:
    """Parse model JSON, keep only allowed keys whose evidence is found in the narrative. Returns the common
    output format plus counts of dropped (unsupported) items."""
    norm, idx = normalise(text)
    stats = {"items": 0, "unsupported": 0, "invalid_key": 0, "parse_error": False, "translated_evidence": 0}
    ungrounded = {"domains": set(), "red_flags": set(), "confounders": set(), "onset": None, "timeline": set()}
    arabic_text = _detect_lang(text) == "ar"
    try:
        j = json.loads(raw[raw.index("{"): raw.rindex("}") + 1])
    except Exception:
        j, stats["parse_error"] = {}, True

    def locate(ev):
        ev_n = _norm(str(ev or "")).strip(" .,'\"")
        if len(ev_n) < 3:
            return None
        i = norm.find(ev_n)
        return None if i < 0 else _span(idx, i, i + len(ev_n))

    fields = []
    for kind, key_set, src in (("domain", DOMAINS, "domains"), ("red_flag", RED_FLAGS, "red_flags"),
                               ("confounder", CONFOUNDERS, "confounders")):
        labels = {"domain": DOMAINS, "red_flag": RED_FLAGS, "confounder": CONFOUNDERS}[kind]
        by_key = {}
        for it in (j.get(src) or []):
            if not isinstance(it, dict):
                continue
            stats["items"] += 1
            k = it.get("key")
            if k not in key_set:
                stats["invalid_key"] += 1; stats["unsupported"] += 1
                continue
            ungrounded[src].add(k)
            ev = str(it.get("evidence") or "")
            if arabic_text and ev and not any("\u0600" <= ch <= "\u06ff" for ch in ev):
                stats["translated_evidence"] += 1
            sp = locate(ev)
            if sp is None:
                stats["unsupported"] += 1
                continue
            by_key.setdefault(k, []).append(sp)
        for k, spans in by_key.items():
            fields.append({"kind": kind, "key": k, "label": labels[k], "confidence": 0.8, "needs_confirmation": False,
                           "spans": spans, "evidence": [text[a:b] for a, b in spans]})
    onset = None
    o = j.get("onset") if isinstance(j.get("onset"), dict) else None
    if o and o.get("value") in ONSET:
        stats["items"] += 1
        ungrounded["onset"] = o["value"]
        sp = locate(o.get("evidence"))
        if sp is None:
            stats["unsupported"] += 1
        else:
            onset = {"value": o["value"], "label": ONSET[o["value"]], "confidence": 0.8, "spans": [sp]}
    tl = []
    for it in (j.get("timeline") or []):
        if not isinstance(it, dict):
            continue
        stats["items"] += 1
        if it.get("activity") not in ACTIVITIES or it.get("who_took_over") not in WHO:
            stats["invalid_key"] += 1; stats["unsupported"] += 1
            continue
        ungrounded["timeline"].add((it["activity"], it["who_took_over"]))
        sp = locate(it.get("evidence"))
        if sp is None:
            stats["unsupported"] += 1
            continue
        tl.append({"activity": it["activity"], "activity_label": ACTIVITIES[it["activity"]], "who_took_over": it["who_took_over"],
                   "who_label": WHO[it["who_took_over"]], "confidence": 0.8, "spans": [sp]})
    out = {"engine": engine, "version": INTAKE_VERSION, "lang": lang, "fields": fields, "onset": onset, "timeline": tl,
           "grounding": stats,
           # what the model said BEFORE the quote check: measures understanding separately from quoting
           "ungrounded": {"domains": sorted(ungrounded["domains"]), "red_flags": sorted(ungrounded["red_flags"]),
                          "confounders": sorted(ungrounded["confounders"]), "onset": ungrounded["onset"] if ungrounded["onset"] != "unknown" else None,
                          "timeline": sorted(ungrounded["timeline"])}}
    out["urgent"] = any(f["kind"] == "red_flag" for f in fields)
    return out


def merge_safety(llm: dict, rules: dict) -> dict:
    """Red flags are a union of both extractors: the LLM may add context, but it can never remove a rule-detected
    red flag (sensitivity first)."""
    have = {f["key"] for f in llm["fields"] if f["kind"] == "red_flag"}
    for f in rules["fields"]:
        if f["kind"] == "red_flag" and f["key"] not in have:
            llm["fields"].append(dict(f, source="rules"))
    llm["urgent"] = any(f["kind"] == "red_flag" for f in llm["fields"])
    return llm


# --- referral drafting and grounding verification -----------------------------------------------------
DRAFT_DOMAIN = {"memory": "memory", "language": "word-finding and conversation",
                "orientation": "orientation (getting lost or confused about time and place)",
                "executive": "handling money", "daily_function": "daily activities", "mood": "mood",
                "behaviour": "behaviour or personality", "sleep": "sleep"}
DRAFT_RF = {"sudden_onset": "a sudden change", "fluctuating_confusion": "confusion that comes and goes",
            "new_neuro_symptoms": "new weakness, facial droop, slurred speech or severe headache",
            "recent_fall_head_injury": "a recent fall or head injury", "rapid_deterioration": "rapid worsening",
            "safety_risk": "a safety risk (wandering, gas or stove left on)"}
DRAFT_CF = {"new_medication": "a new or changed medication", "recent_illness": "a recent illness or hospital stay",
            "hearing": "hearing difficulty", "bereavement": "a recent bereavement"}
DRAFT_ACT = {"money": "managing money / bills", "medicines": "managing medicines", "cooking": "cooking", "shopping": "shopping",
             "driving": "driving", "phone": "using the phone", "appointments": "remembering appointments",
             "household": "household tasks", "prayer": "prayer routines"}
DRAFT_WHO = {"son": "a son", "daughter": "a daughter", "wife": "the wife", "husband": "the husband", "brother": "a brother",
             "sister": "a sister", "driver": "the driver", "helper": "a domestic helper", "informant": "the informant",
             "other": "another relative"}
DRAFT_REPORTER = {"self": "The participant", "family": "A family member", "helper": "A household helper",
                  "professional": "A healthcare professional", "coordinator": "A programme coordinator"}
LEVEL_TXT = {"STABLE": "stable", "CHECK_AGAIN": "check again", "CLINICIAN_REVIEW": "clinician review", "URGENT": "urgent review",
             "BASELINE": "building baseline"}

# claim vocabulary: trigger -> items that can support it
VOCAB = {
    "dom:memory": ["memory", "forget", "repeat"], "dom:language": ["word-finding", "word finding", "finding words", "conversation", "language"],
    "dom:orientation": ["orientation", "getting lost", "got lost", "disorient", "confused about time"],
    "dom:executive": ["money", "planning", "finances", "bills"], "dom:daily_function": ["daily activities", "daily function", "cooking", "driving", "shopping", "household", "medicines"],
    "dom:mood": ["mood", "sad", "depress", "withdrawn", "anxi"], "dom:behaviour": ["behaviour", "behavior", "personality", "irritab", "agitat", "suspicious", "aggress", "hallucinat"],
    "dom:sleep": ["sleep", "insomnia"],
    "rf:sudden_onset": ["sudden", "abrupt"], "rf:fluctuating_confusion": ["comes and goes", "fluctuat"],
    "rf:new_neuro_symptoms": ["weakness", "droop", "slurred", "headache", "stroke", "neurolog"],
    "rf:recent_fall_head_injury": ["fall$", "fell$", "head injury"], "rf:rapid_deterioration": ["rapid", "quickly"],
    "rf:safety_risk": ["safety", "wander", "unsafe", "gas", "stove"],
    "cf:new_medication": ["medication", "medicine", "tablets"], "cf:recent_illness": ["illness", "infection", "fever", "hospital"],
    "cf:hearing": ["hearing"], "cf:bereavement": ["bereave", "passed away", "died", "death"],
    "on:days": ["days$"], "on:weeks": ["weeks$"], "on:months": ["months$"], "on:years": ["year$", "years$"],
    "act:money": ["money", "bills"], "act:medicines": ["medicines", "medication"], "act:cooking": ["cooking"], "act:shopping": ["shopping"],
    "act:driving": ["driving"], "act:phone": ["phone"], "act:appointments": ["appointments"], "act:household": ["household"],
    "act:prayer": ["prayer"],
    "who:son": ["son$"], "who:daughter": ["daughter"], "who:wife": ["wife"], "who:husband": ["husband"], "who:brother": ["brother"],
    "who:sister": ["sister"], "who:driver": ["driver"], "who:helper": ["helper", "maid", "housekeeper"],
    "urgent": ["urgent", "red flag", "emergency"], "checkin": ["check-in", "checkin", "membrain"],
    "rep:self": ["participant"], "rep:family": ["family member"], "rep:helper": ["household helper"],
    "rep:professional": ["healthcare professional"], "rep:coordinator": ["programme coordinator"],
}
BLOCKED = ["dementia", "alzheimer", "mild cognitive impairment", "mci$", "neurodegenera", "cognitive decline is confirmed", "diagnos"]
DISCLAIMER = re.compile(r"(no|not a|without a) diagnosis")


def confirmed_items(c: dict) -> set:
    s = {"dom:" + k for k in c.get("domains", [])} | {"rf:" + k for k in c.get("red_flags", [])} | \
        {"cf:" + k for k in c.get("confounders", [])}
    if c.get("onset"):
        s.add("on:" + c["onset"])
    for a, w in c.get("timeline", []):
        s |= {"act:" + a, "who:" + w}
    if c.get("red_flags") or (c.get("checkin") or {}).get("level") == "URGENT":
        s.add("urgent")
    if c.get("checkin"):
        s.add("checkin")
    s.add("rep:" + (c.get("reporter") or "family"))
    return s


def draft_referral(c: dict) -> list[dict]:
    """Deterministic draft from CONFIRMED facts only. Each sentence lists the items it rests on."""
    out = []
    if c.get("red_flags"):
        out.append({"text": "Urgent: " + _rep_lower(c) + " reports " + _join([DRAFT_RF[k] for k in c["red_flags"]]) +
                            ". Please assess urgently; cognitive testing was not started.", "sources": ["rf:" + k for k in c["red_flags"]]})
    if c.get("domains"):
        on = (" " + ONSET[c["onset"]]) if c.get("onset") else ""
        who = DRAFT_REPORTER.get(c.get("reporter"), DRAFT_REPORTER["family"])
        out.append({"text": f"{who} reports changes in {_join([DRAFT_DOMAIN[k] for k in c['domains']])}{on}.",
                    "sources": ["dom:" + k for k in c["domains"]] + (["on:" + c["onset"]] if c.get("onset") else [])})
    q = [x for x in c.get("quotes", []) if x][:2]
    if q:
        out.append({"text": "In their words: " + "; ".join(f"“{x}”" for x in q) + ".", "sources": ["quote"]})
    if c.get("timeline"):
        out.append({"text": "Activities others have taken over: " + "; ".join(f"{DRAFT_ACT[a]} (now {DRAFT_WHO[w]})" for a, w in c["timeline"]) + ".",
                    "sources": [f"act:{a}" for a, _ in c["timeline"]]})
    if c.get("confounders"):
        out.append({"text": "Factors to consider before interpreting this: " + _join([DRAFT_CF[k] for k in c["confounders"]]) + ".",
                    "sources": ["cf:" + k for k in c["confounders"]]})
    ck = c.get("checkin")
    if ck and ck.get("level"):
        out.append({"text": f"Latest MemBrain check-in: {LEVEL_TXT.get(ck['level'], ck['level'])}." +
                            (f" {ck['reasons'][0]}" if ck.get("reasons") else ""), "sources": ["checkin"]})
    out.append({"text": "This is a request for assessment. No diagnosis has been made.", "sources": []})
    return out


def _rep_lower(c):
    r = c.get("reporter")
    return "the family" if r not in DRAFT_REPORTER else DRAFT_REPORTER[r][0].lower() + DRAFT_REPORTER[r][1:]


def _join(xs):
    return xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + " and " + xs[-1]


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z“\"(])", (text or "").strip())
    return [p.strip() for p in parts if p.strip()]


def verify_sentence(sent: str, c: dict) -> dict:
    """Is every claim in this sentence supported by the confirmed facts?"""
    conf = confirmed_items(c)
    reasons = []
    corpus = _norm(" ".join([c.get("narrative", "")] + list((c.get("checkin") or {}).get("reasons") or [])))
    quotes = re.findall(r"[“\"]([^”\"]+)[”\"]", sent)
    for q in quotes:
        if _norm(q).strip(" .,") not in corpus:
            reasons.append(f"quote not found in the narrative: “{q[:40]}”")
    body = re.sub(r"[“\"][^”\"]*[”\"]", " ", sent)
    for r in (c.get("checkin") or {}).get("reasons") or []:   # engine output is source text, like a quote
        if r:
            body = body.replace(r, " ")
    nb = _norm(body)
    disclaimer = bool(DISCLAIMER.search(nb))
    for term in BLOCKED:
        rb = term.endswith("$"); t = term.rstrip("$")
        if t == "diagnos" and disclaimer:
            continue
        if any(True for _ in _find(nb, t, rb)):
            reasons.append(f"diagnostic term not allowed: '{t}'")
    for num in re.findall(r"[0-9]+", nb):
        if num not in corpus:
            reasons.append(f"number {num} not in the record")
    # group trigger hits by start position, so "medicines" (an activity) is not also read as "medicine" (a confounder)
    hits = {}
    for item, trig in VOCAB.items():
        for t in trig:
            rb = t.endswith("$"); tt = t.rstrip("$")
            for a, b in _find(nb, tt, rb):
                hits.setdefault(a, []).append((b, tt, item))
    claims = len(hits)
    covered = -1
    for a in sorted(hits):
        hs = hits[a]
        longest = max(b for b, _, _ in hs)
        if a < covered and longest <= covered:   # inside a longer phrase already checked ("household helper")
            continue
        covered = max(covered, longest)
        supporters = {item for b, _, item in hs if b == longest}
        if supporters & conf or _negated(nb, a, "en"):   # negated = absence claim ("no falls reported")
            continue
        reasons.append(f"'{max(hs)[1]}' is not among the confirmed facts")
    reasons = sorted(set(reasons))
    return {"text": sent, "ok": not reasons, "reasons": reasons, "checked_claims": claims + len(quotes),
            "disclaimer": disclaimer}


def verify_referral(text_or_sentences, c: dict) -> dict:
    sents = text_or_sentences if isinstance(text_or_sentences, list) else split_sentences(text_or_sentences)
    sents = [s["text"] if isinstance(s, dict) else s for s in sents]
    res = [verify_sentence(s, c) for s in sents]
    n_bad = sum(1 for r in res if not r["ok"])
    return {"sentences": res, "n": len(res), "unsupported": n_bad, "grounded": n_bad == 0,
            "uncheckable": sum(1 for r in res if r["ok"] and r["checked_claims"] == 0 and not r["disclaimer"])}


def quotes_from(res: dict, text: str, n: int = 2) -> list[str]:
    """Short verbatim quotes (the clause around the highest-confidence domain evidence)."""
    out = []
    for f in sorted([f for f in res["fields"] if f["kind"] == "domain"], key=lambda f: -f["confidence"]):
        a, b = f["spans"][0]
        s = max([text.rfind(ch, 0, a) for ch in ".!?،,;؟\n"]) + 1
        ends = [i for i in (text.find(ch, b) for ch in ".!?،,;؟\n") if i != -1]
        e = min(ends) if ends else len(text)
        q = text[s:e].strip()
        if 6 <= len(q) <= 140 and q not in out:
            out.append(q)
        if len(out) >= n:
            break
    return out


def llm_draft_messages(c: dict) -> list[dict]:
    facts = {k: c.get(k) for k in ("domains", "red_flags", "confounders", "onset", "timeline", "checkin")}
    return [{"role": "system", "content": "Write a short reason for referral (3-5 sentences, English) for a memory or primary care "
             "clinician, using ONLY these confirmed facts. Do not add facts, numbers or names. Do not diagnose or name a disease. "
             "End with: 'No diagnosis has been made.'"},
            {"role": "user", "content": json.dumps(facts, ensure_ascii=False)}]
