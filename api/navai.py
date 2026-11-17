"""Navigator AI endpoints: caregiver narrative extraction and referral drafting.

MedGemma is optional. Set MEDGEMMA_URL to an OpenAI-compatible chat endpoint (for example vLLM serving
google/medgemma-4b-it inside the in-country tenant) and MEDGEMMA_MODEL / MEDGEMMA_KEY if needed. Without it,
or if the call fails or is slow, the deterministic rules extractor answers, so the app never stops working.
Model output is never shown raw: fields must quote the narrative, red flags are a union with the rules,
and every drafted sentence passes the grounding verifier or is removed.
"""
from __future__ import annotations

import os
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth import Principal, principal
from membrain import intake as I

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
    if not url:
        return None
    headers = {"Authorization": f"Bearer {os.getenv('MEDGEMMA_KEY', '')}"} if os.getenv("MEDGEMMA_KEY") else {}
    body = {"model": os.getenv("MEDGEMMA_MODEL", "google/medgemma-4b-it"), "messages": messages,
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
    set_up = (ML.complete is not None or os.getenv("MEDGEMMA_URL")) and _task_on("draft")
    why = ("MedGemma is not set up on this server" if not set_up
           else "MedGemma did not answer in time (its free GPU may be busy or out of today's allowance)")
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
    """Draft from the case itself: the confirmed concern, who reported it and the latest check-in. Nothing else."""
    _clinician(who)
    from api.main import DB
    from membrain.triage import evaluate
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    conf = dict(((p.get("intake") or {}).get("confirmed")) or {})
    if not conf:
        rc = next((s for s in reversed(p.get("sessions", [])) if s.get("type") == "intake"), None)
        if rc:
            r = rc.get("reported_concern") or {}
            conf = {"narrative": rc.get("concern", ""), "domains": r.get("domains", []), "onset": rc.get("onset"),
                    "timeline": r.get("timeline", []), "red_flags": rc.get("red_flags", []), "confounders": r.get("confounders", [])}
    conf["reporter"] = (p.get("intake") or {}).get("reporter") or conf.get("reporter")
    hist = [h for h in evaluate(p, p["sessions"])["history"] if not h.get("intake") and not h.get("informant_report")] if p.get("sessions") else []
    if hist:
        conf["checkin"] = {"level": hist[-1]["level"], "reasons": hist[-1].get("reasons", [])[:2]}
    if not (conf.get("domains") or conf.get("red_flags") or conf.get("checkin")):
        raise HTTPException(409, "Nothing confirmed on this record to draft from yet.")
    out = draft(conf)
    out["facts"] = {k: conf.get(k) for k in ("reporter", "domains", "onset", "timeline", "red_flags", "confounders", "checkin")}
    return out


@router.get("/referral/engine")
def referral_engine():
    """Is MedGemma available for drafting here? (No patient data; for checking the deployment.)"""
    from api import medgemma_local as ML
    return {"local": ML.status, "remote": bool(os.getenv("MEDGEMMA_URL")), "tasks": os.getenv("MEDGEMMA_TASKS", "intake,draft")}


@router.post("/referral/verify")
def referral_verify(body: dict):
    return I.verify_referral(body.get("text", ""), body.get("confirmed") or {})
