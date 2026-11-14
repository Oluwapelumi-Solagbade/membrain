"""Azure AI Speech (UAE North) token broker.

The subscription key lives ONLY in the server environment (App Service
application setting or a local .env that is git-ignored). The browser gets a
short-lived authorization token (valid ~10 minutes) and streams audio
directly to the in-country Speech endpoint. The key is never sent to the
browser, never logged and never committed.
"""
from __future__ import annotations

import os
import time
from collections import defaultdict, deque

import httpx
from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/api/speech", tags=["speech"])

# Participant dialect -> Azure speech-to-text locale.
# Verify each locale against Azure's current language-support list before the pilot.
LOCALES = {
    "Emirati": "ar-AE", "Other Gulf": "ar-SA", "Egyptian": "ar-EG", "Levantine": "ar-LB",
    "Other Arabic": "ar-AE", "English": "en-GB",
}
RATE_LIMIT = int(os.getenv("SPEECH_TOKENS_PER_MINUTE", "20"))
_hits: dict[str, deque] = defaultdict(deque)
_cache: dict[str, tuple[float, str]] = {}


def _load_dotenv(path: str = ".env") -> None:
    if not os.path.exists(path):
        return
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()


def _key() -> str:
    return os.getenv("AZURE_SPEECH_KEY", "")


def _region() -> str:
    return os.getenv("AZURE_SPEECH_REGION", "uaenorth")


@router.get("/config")
def speech_config():
    return {"enabled": bool(_key()), "provider": "azure", "region": _region(), "locales": LOCALES,
            "data_handling": "Audio is streamed over TLS to the in-country Azure Speech endpoint for transcription; "
                             "MemBrain stores transcripts and features only, unless raw-audio consent is given."}


@router.get("/token")
async def speech_token(request: Request):
    if not _key():
        raise HTTPException(503, "Speech service not configured (set AZURE_SPEECH_KEY on the server)")
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    q = _hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        raise HTTPException(429, "Too many token requests; try again in a minute")
    q.append(now)
    # Tokens last 10 minutes; reuse one for up to 8 minutes to limit calls to Azure.
    cached = _cache.get("token")
    if cached and now - cached[0] < 480:
        return {"token": cached[1], "region": _region(), "expires_in": int(600 - (now - cached[0]))}
    url = f"https://{_region()}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.post(url, headers={"Ocp-Apim-Subscription-Key": _key(), "Content-Length": "0"})
    except httpx.HTTPError:
        raise HTTPException(502, "Could not reach the Azure Speech token service")
    if resp.status_code != 200:
        raise HTTPException(502, f"Azure Speech token service returned {resp.status_code}")
    _cache["token"] = (now, resp.text)
    return {"token": resp.text, "region": _region(), "expires_in": 600}
