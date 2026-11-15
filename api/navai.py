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
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from membrain import intake as I

router = APIRouter(prefix="/api", tags=["navigator-ai"])


class IntakeIn(BaseModel):
    text: str = Field(..., min_length=3, max_length=4000)
    lang: str | None = None


class DraftIn(BaseModel):
    confirmed: dict


def _llm(messages: list[dict], max_tokens: int = 700) -> str | None:
    url = os.getenv("MEDGEMMA_URL", "").rstrip("/")
    if not url:
        return None
    headers = {"Authorization": f"Bearer {os.getenv('MEDGEMMA_KEY', '')}"} if os.getenv("MEDGEMMA_KEY") else {}
    body = {"model": os.getenv("MEDGEMMA_MODEL", "google/medgemma-4b-it"), "messages": messages,
            "temperature": 0, "max_tokens": max_tokens}
    try:
        r = httpx.post(url + "/v1/chat/completions", json=body, headers=headers, timeout=float(os.getenv("MEDGEMMA_TIMEOUT", "8")))
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


@router.post("/referral/draft")
def referral_draft(body: DraftIn):
    c = body.confirmed
    if not isinstance(c, dict):
        raise HTTPException(422, "confirmed must be an object")
    raw = _llm(I.llm_draft_messages(c), 300)
    if raw:
        v = I.verify_referral(raw, c)
        kept = [s["text"] for s in v["sentences"] if s["ok"]]
        if kept and not any(s["disclaimer"] for s in v["sentences"] if s["ok"]):
            kept.append("No diagnosis has been made.")
        return {"engine": os.getenv("MEDGEMMA_MODEL", "medgemma"), "sentences": kept, "removed": [s for s in v["sentences"] if not s["ok"]]}
    return {"engine": "template", "sentences": [s["text"] for s in I.draft_referral(c)], "removed": []}


@router.post("/referral/verify")
def referral_verify(body: dict):
    return I.verify_referral(body.get("text", ""), body.get("confirmed") or {})
