"""Navigator AI endpoints: caregiver narrative extraction and referral drafting.

MedGemma is optional. Set MEDGEMMA_URL to an OpenAI-compatible chat endpoint (for example vLLM serving
google/medgemma-4b-it inside the in-country tenant) and MEDGEMMA_MODEL / MEDGEMMA_KEY if needed. Without it,
or if the call fails or is slow, the deterministic rules extractor answers, so the app never stops working.
Model output is never shown raw: fields must quote the narrative, red flags are a union with the rules,
and every drafted sentence passes the grounding verifier or is removed.
"""
from __future__ import annotations

import difflib
import json
import os
import re
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from api.auth import Principal, principal
from membrain import intake as I
from membrain import navigator as NAV

router = APIRouter(prefix="/api", tags=["navigator-ai"])


class IntakeIn(BaseModel):
    text: str = Field(..., min_length=3, max_length=4000)
    lang: str | None = None


class DraftIn(BaseModel):
    confirmed: dict


def _task_on(task: str) -> bool:
    """MEDGEMMA_TASKS lists where MedGemma may be used ("intake,draft" by default). The demo Space sets "draft" only:
    on our held-out test MedGemma missed urgent cases and invented details in intake, so the rules keep that job."""
    return task in {t.strip() for t in os.getenv("MEDGEMMA_TASKS", "intake,draft").split(",")}


def _llm(messages: list[dict], max_tokens: int = 700, task: str = "intake") -> str | None:
    if not _task_on(task):
        return None
    from api import medgemma_local as ML
    if ML.complete is not None:          # MedGemma loaded in this Space (deploy/hf-space/app.py, MEDGEMMA_IN_SPACE=1)
        try:
            return ML.complete(messages, max_tokens)
        except Exception as e:           # GPU allowance used up, queue timeout...: the template answers instead
            ML.status["error"] = f"last call: {type(e).__name__}"
            return None
    url = os.getenv("MEDGEMMA_URL", "").rstrip("/")
    api_key = os.getenv("MEDGEMMA_KEY") or os.getenv("GEMINI_API_KEY")
    model = os.getenv("MEDGEMMA_MODEL")
    if not url and os.getenv("GEMINI_API_KEY"):
        url = "https://generativelanguage.googleapis.com/v1beta/openai"
        model = model or "gemini-2.0-flash"
    if not url:
        return None
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    body = {"model": model or "google/medgemma-4b-it", "messages": messages,
            "temperature": 0, "max_tokens": max_tokens}
    try:
        timeout = float(os.getenv("MEDGEMMA_DRAFT_TIMEOUT", "120") if task == "draft" else os.getenv("MEDGEMMA_TIMEOUT", "8"))
        r = httpx.post(url + "/v1/chat/completions", json=body, headers=headers, timeout=timeout)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    except (httpx.HTTPError, KeyError, ValueError):
        return None


@router.post("/intake/extract")
def intake_extract(body: IntakeIn):
    t = time.perf_counter()
    lang = body.lang or I._detect_lang(body.text)
    rules = I.extract_rules(body.text, lang)
    raw = _llm(I.llm_messages(body.text, lang))
    if raw is None:
        out = rules
        out["fallback_reason"] = "MedGemma not configured or unavailable" if os.getenv("MEDGEMMA_URL") else "MedGemma not configured"
    else:
        out = I.merge_safety(I.ground_llm_output(raw, body.text, lang, engine=os.getenv("MEDGEMMA_MODEL", "medgemma")), rules)
    out["latency_ms"] = round((time.perf_counter() - t) * 1000)
    return out


def _clinician(who: Principal) -> None:
    # Drafting spends the GPU allowance of the MedGemma host, so only signed-in clinicians and coordinators may ask.
    if who.role not in ("clinician", "coordinator"):
        raise HTTPException(401 if who.role == "anonymous" else 403, "Please sign in as a clinician.")


def _theirs(who: Principal, pid: str) -> None:
    """A clinician drafts letters only for their own hospital's patients."""
    from api.main import own
    own(who, pid)


def draft(c: dict) -> dict:
    t = time.perf_counter()
    raw = I.strip_thinking(_llm(I.llm_draft_messages(c), 400, task="draft") or "")[0]
    if raw:
        v = I.verify_referral(raw, c)
        kept = [s["text"] for s in v["sentences"] if s["ok"]]
        removed = [{"text": s["text"], "reasons": s["reasons"]} for s in v["sentences"] if not s["ok"]]
        if any(not s["disclaimer"] for s in v["sentences"] if s["ok"]):
            if not any(s["disclaimer"] for s in v["sentences"] if s["ok"]):
                kept.append("No diagnosis has been made.")
            return {"engine": os.getenv("MEDGEMMA_MODEL", "medgemma"), "sentences": kept, "removed": removed,
                    "checked": len(v["sentences"]), "latency_ms": round((time.perf_counter() - t) * 1000)}
        # nothing the model wrote survived the check: say so, and give the safe template instead
        return {"engine": "template", "sentences": [s["text"] for s in I.draft_referral(c)], "removed": removed,
                "checked": len(v["sentences"]), "fallback_reason": "Every sentence MedGemma wrote failed the fact check, so the rules template is shown",
                "latency_ms": round((time.perf_counter() - t) * 1000)}
    from api import medgemma_local as ML
    set_up = (ML.complete is not None or os.getenv("MEDGEMMA_URL") or os.getenv("GEMINI_API_KEY")) and _task_on("draft")
    why = ("MedGemma did not answer in time (free GPU may be busy or out of allowance)" if set_up else "MedGemma is not set up on this server")

    return {"engine": "template", "sentences": [s["text"] for s in I.draft_referral(c)], "removed": [], "fallback_reason": why,
            "latency_ms": round((time.perf_counter() - t) * 1000)}


@router.post("/referral/draft")
def referral_draft(body: DraftIn, who: Principal = Depends(principal)):
    _clinician(who)
    c = body.confirmed
    if not isinstance(c, dict):
        raise HTTPException(422, "confirmed must be an object")
    return draft(c)


@router.post("/referral/draft/{pid}")
def referral_draft_for_case(pid: str, who: Principal = Depends(principal)):
    """Draft from the case itself: demographics, longitudinal check-ins, confirmed concern, and Lancet 2024 risk markers."""
    _clinician(who)
    _theirs(who, pid)
    from api.main import DB
    from membrain.triage import evaluate
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    ev = evaluate(p, p.get("sessions", [])) if p.get("sessions") else {"latest": None, "history": []}
    t = time.perf_counter()
    conf = dict(((p.get("intake") or {}).get("confirmed")) or {})
    if not conf:
        rc = next((s for s in reversed(p.get("sessions", [])) if s.get("type") == "intake"), None)
        if rc:
            r = rc.get("reported_concern") or {}
            conf = {"narrative": rc.get("concern", ""), "domains": r.get("domains", []), "onset": rc.get("onset"),
                    "timeline": r.get("timeline", []), "red_flags": rc.get("red_flags", []), "confounders": r.get("confounders", [])}
    conf["reporter"] = (p.get("intake") or {}).get("reporter") or conf.get("reporter")
    hist = [h for h in ev.get("history", []) if not h.get("intake") and not h.get("informant_report")]
    if hist:
        conf["checkin"] = {"level": hist[-1]["level"], "reasons": hist[-1].get("reasons", [])[:2]}

    from api import medgemma_local as ML
    has_llm = (ML.complete is not None or os.getenv("MEDGEMMA_URL") or os.getenv("GEMINI_API_KEY")) and _task_on("draft")
    raw = None
    if (conf.get("domains") or conf.get("red_flags") or conf.get("checkin")):
        raw = I.strip_thinking(_llm(I.llm_draft_messages(conf), 450, task="draft") or "")[0]

    if raw:
        v = I.verify_referral(raw, conf)
        kept = [s["text"] for s in v["sentences"] if s["ok"]]
        removed = [{"text": s["text"], "reasons": s["reasons"]} for s in v["sentences"] if not s["ok"]]
        if any(not s["disclaimer"] for s in v["sentences"] if s["ok"]):
            if not any(s["disclaimer"] for s in v["sentences"] if s["ok"]):
                kept.append("No diagnosis has been made.")
            engine_name = os.getenv("MEDGEMMA_MODEL", "gemini-2.0-flash" if os.getenv("GEMINI_API_KEY") else "medgemma")
            out = {"engine": engine_name, "sentences": kept, "removed": removed,
                   "checked": len(v["sentences"]), "latency_ms": round((time.perf_counter() - t) * 1000)}
        else:
            case_sents = [s["text"] for s in I.draft_case_referral(p, ev)]
            out = {"engine": "template", "engine_label": "MemBrain Clinical Protocol", "sentences": case_sents,
                   "removed": removed, "checked": len(v["sentences"]),
                   "fallback_reason": "MedGemma output required grounding safety fallback, so the clinical protocol draft was used",
                   "latency_ms": round((time.perf_counter() - t) * 1000)}
    else:
        case_sents = [s["text"] for s in I.draft_case_referral(p, ev)]
        why = ("MedGemma did not answer in time (free GPU may be busy or out of allowance)" if has_llm else "MedGemma is not set up on this server")
        out = {"engine": "template", "engine_label": "MemBrain Clinical Protocol", "sentences": case_sents,
               "removed": [], "checked": len(case_sents), "fallback_reason": why,
               "latency_ms": round((time.perf_counter() - t) * 1000)}

    out["facts"] = {k: conf.get(k) for k in ("reporter", "domains", "onset", "timeline", "red_flags", "confounders", "checkin")}
    # The full letter in the usual memory-service layout: MedGemma's checked sentences are the reason for referral;
    # every other section is filled from the record (membrain/letter.py).
    from api import auth as AU
    from membrain.dossier import build_dossier
    from membrain.letter import build as build_letter
    u = next((x for x in AU.USERS.values() if x.get("id") == who.user_id), {}) if who.user_id else {}
    ref = next((r for r in reversed(p.get("referrals") or []) if NAV.is_unresolved(r)), None) or (p.get("referrals") or [None])[-1]
    svc = {s["id"]: s for s in NAV.directory()}.get((ref or {}).get("service_id") or (p.get("assigned_hospital") or {}).get("id"))
    lt = build_letter(p, ev, build_dossier(p, ev), reason=out["sentences"] if out["engine"] != "template" else None,
                      service=svc, referrer={"name": u.get("name") or who.name, "title": u.get("title"), "org": u.get("org")})
    out["letter"], out["sections"] = lt["text"], lt["sections"]
    from api.main import audit
    audit(who.actor, "referral_drafted", pid, {"engine": "medgemma" if out["engine"] != "template" else "template",
                                               "checked": out.get("checked", 0), "removed": len(out.get("removed", [])),
                                               "kept": len(out["sentences"]), "latency_ms": out.get("latency_ms"),
                                               "fallback": out.get("fallback_reason")})
    return out


class ApproveIn(BaseModel):
    draft: str = Field(..., max_length=12000)
    final: str = Field(..., min_length=10, max_length=12000)
    engine: str = Field("template", max_length=40)


def _words(t: str) -> list[str]:
    return re.findall(r"[\w'’-]+", (t or "").lower())


@router.post("/referral/draft/{pid}/approve")
def approve_letter(pid: str, body: ApproveIn, who: Principal = Depends(principal)):
    """The clinician approves the letter (as drafted or after editing). Only measures are kept, not the text:
    how much of the draft survived, so 'the AI helps' becomes a number on the Live data page."""
    _clinician(who)
    _theirs(who, pid)
    from api.main import DB, audit
    if pid not in DB["participants"]:
        raise HTTPException(404)
    a, b = _words(body.draft), _words(body.final)
    sim = difflib.SequenceMatcher(None, a, b).ratio() if a or b else 1.0
    m = {"engine": "medgemma" if body.engine not in ("template", "") else "template", "unchanged": a == b,
         "similarity": round(sim, 3), "words_draft": len(a), "words_final": len(b)}
    audit(who.actor, "referral_letter_approved", pid, m)
    return m


# ---------------------------------------------------------------- MedGemma as a second reader
# The rules read every concern first (instant, and they caught every urgent case on our held-out test). Only when they
# find NOTHING does MedGemma read the words and suggest what they might be. A suggestion is kept only if it quotes the
# person's own words, and the person confirms it before it counts; urgent suggestions are only ever added (never removed).
SECOND_HEALTH = {"blood_pressure": ("Blood pressure", "ضغط الدم"), "blood_sugar": ("Blood sugar / diabetes", "السكر / السكري"),
                 "cholesterol": ("Cholesterol", "الكوليسترول"), "heart": ("Heart", "القلب"), "kidney": ("Kidneys", "الكلى"),
                 "stroke": ("Stroke or mini-stroke", "جلطة أو جلطة صغيرة"), "weight": ("Weight", "الوزن"),
                 "smoking": ("Smoking", "التدخين"), "hearing": ("Hearing", "السمع"), "vision": ("Eyesight", "النظر"),
                 "other_health": ("Other health problem", "مشكلة صحية أخرى")}
_SR_HITS: dict[str, list[float]] = {}
_SR_DAY: dict[str, int] = {}


def second_read_messages(text: str, lang: str) -> list[dict]:
    keys = (f"domain: {list(I.DOMAINS)}\nred_flag: {list(I.RED_FLAGS)}\nhealth: {list(SECOND_HEALTH)}")
    return [{"role": "system", "content":
             "You read what a person, a family member, a household helper or a clinician wrote about an older adult, and list "
             "what it mentions, using ONLY these kinds and keys:\n" + keys + "\n\nRules: include an item only if the text "
             "clearly says it; copy the exact words from the text as the quote (do not translate or reword); do not guess or "
             "diagnose; return an empty list if nothing matches. Answer with JSON only, in this form: "
             '{"items": [{"kind": "health", "key": "blood_pressure", "quote": "exact words"}]}'},
            {"role": "user", "content": text}]


def ground_second_read(raw: str, text: str, lang: str) -> tuple[list[dict], int]:
    """Keep items whose key is allowed and whose quote really is in the text (after Arabic/English normalisation)."""
    m = re.search(r"\{.*\}", I.strip_thinking(raw or "")[0], re.S)
    try:
        items = json.loads(m.group(0)).get("items", []) if m else []
    except (ValueError, AttributeError):
        items = []
    allowed = {"domain": I.DOMAINS, "red_flag": I.RED_FLAGS, "health": SECOND_HEALTH}
    body, out, seen, dropped = I._norm(text), [], set(), 0
    for it in items if isinstance(items, list) else []:
        kind, key, quote = (it or {}).get("kind"), (it or {}).get("key"), str((it or {}).get("quote") or "").strip()
        nq = I._norm(quote).strip(" .,")
        if kind not in allowed or key not in allowed[kind] or len(nq) < 3 or nq not in body or (kind, key) in seen:
            dropped += 1
            continue
        seen.add((kind, key))
        if kind == "health":
            label = SECOND_HEALTH[key][1 if lang == "ar" else 0]
        else:
            label = allowed[kind][key]
        out.append({"kind": kind, "key": key, "label": label, "quote": quote})
    return out, dropped


class SecondReadIn(BaseModel):
    text: str = Field(..., min_length=3, max_length=4000)
    lang: str | None = None


@router.post("/intake/second-read")
def second_read(body: SecondReadIn, request: Request):
    import datetime as _dt
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0].strip()
    now = time.time()
    hits = [t for t in _SR_HITS.get(ip, []) if now - t < 60]
    day = _dt.date.today().isoformat()
    if len(hits) >= int(os.getenv("SECOND_READ_PER_MIN", "4")) or _SR_DAY.get(day, 0) >= int(os.getenv("SECOND_READ_DAILY_CAP", "200")):
        return {"engine": "none", "items": [], "reason": "busy"}
    _SR_HITS[ip] = hits + [now]
    lang = body.lang or I._detect_lang(body.text)
    rules = I.extract_rules(body.text, lang)
    if rules.get("fields") or rules.get("timeline") or rules.get("onset"):
        return {"engine": "rules", "items": [], "reason": "the rules already found facts"}
    _SR_DAY[day] = _SR_DAY.get(day, 0) + 1
    from membrain.deid import redact
    clean, removed_ids = redact(body.text)          # MedGemma never sees names, numbers, IDs, phones or e-mails
    t = time.perf_counter()
    raw = _llm(second_read_messages(clean, lang), 300, task="second_read")
    ms = round((time.perf_counter() - t) * 1000)
    if raw is None:
        return {"engine": "none", "items": [], "reason": "unavailable", "latency_ms": ms}
    items, dropped = ground_second_read(raw, clean, lang)
    from api.main import audit
    audit("public", "second_read", "-", {"items": len(items), "dropped": dropped, "kinds": sorted({i["kind"] for i in items}),
                                         "latency_ms": ms, "lang": lang, "deidentified": sum(removed_ids.values())})
    return {"engine": os.getenv("MEDGEMMA_MODEL", "medgemma"), "items": items, "dropped": dropped, "latency_ms": ms,
            "deidentified": removed_ids}


@router.get("/referral/engine")
def referral_engine():
    """Is MedGemma available for drafting here? (No patient data; for checking the deployment.)"""
    from api import medgemma_local as ML
    has_remote = bool(os.getenv("MEDGEMMA_URL") or os.getenv("GEMINI_API_KEY"))
    has_local = bool(ML.status.get("loaded"))
    has_ai = has_remote or has_local
    engine_name = os.getenv("MEDGEMMA_MODEL", "gemini-2.0-flash" if os.getenv("GEMINI_API_KEY") else "google/medgemma-4b-it") if has_ai else "clinical_protocol"
    return {"local": ML.status, "remote": has_remote, "has_ai": has_ai, "engine": engine_name, "tasks": os.getenv("MEDGEMMA_TASKS", "intake,draft")}


@router.post("/referral/verify")
def referral_verify(body: dict):
    return I.verify_referral(body.get("text", ""), body.get("confirmed") or {})
