"""Sign-in for MemBrain: clinicians with a work email and password, patients with their phone number and a one-time
code. Every API call then carries a bearer token, and the role and record it may touch come from that token, not
from anything the browser claims.

Demo-grade in the same way as the rest of the API: accounts, codes and sessions live in memory. What is real:
passwords are stored only as salted PBKDF2 hashes, tokens and codes only as SHA-256 hashes, codes expire and allow
five tries, repeated failures are slowed down, and every sign-in is audited. In the pilot this sits behind the
health system's identity provider (UAE PASS for patients, hospital SSO for clinicians) through OIDC, with the
token in an httpOnly cookie.

Environment:
  DEMO_ACCOUNTS=1 (default)  seed the synthetic demo accounts (clinician, coordinator, the seven demo patients)
  CLINICIAN_DEMO_PASSWORD     the demo clinicians' password (see .env.example)
  DEMO_OTP=1 (default)        return the patient's one-time code in the response, because no SMS is sent
  ALLOW_ROLE_HEADER=1         accept the old X-Role header instead of a token (tests and the old prototype only)
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/auth", tags=["auth"])

CLINICIAN_TTL = 8 * 3600            # a working day
CLINICIAN_REMEMBER_TTL = 7 * 86400
PATIENT_TTL = 30 * 86400            # patients come back every few weeks; they can sign out on shared devices
CODE_TTL = 10 * 60
CODE_TRIES = 5
WINDOW, MAX_FAILS = 15 * 60, 5

_on = lambda k, d="1": os.getenv(k, d) == "1"  # noqa: E731


def _demo_password() -> str:
    return os.getenv("CLINICIAN_DEMO_PASSWORD") or "membrain-demo-2026"


# ---------------------------------------------------------------------------------------------------- stores
@dataclass
class Principal:
    role: str                    # clinician | coordinator | participant | anonymous
    user_id: str | None = None
    pid: str | None = None       # a participant's own record
    name: str | None = None
    legacy: bool = False         # authorised by the X-Role header (tests, old prototype)

    @property
    def actor(self) -> str:
        return self.user_id or self.role

    def may_touch(self, pid: str) -> bool:
        return self.legacy or self.role in ("clinician", "coordinator") or (self.role == "participant" and self.pid == pid)


USERS: dict[str, dict] = {}          # clinicians and coordinators, by lower-case email
PHONES: dict[str, str] = {}          # patient phone (E.164) -> participant id
SESSIONS: dict[str, dict] = {}       # sha256(token) -> {"user": {...}, "exp": epoch}
CODES: dict[str, dict] = {}          # challenge id -> {"phone", "hash", "exp", "tries"}
CLAIMS: dict[str, str] = {}          # concern pid -> sha256(claim token): lets the person who raised it link it
_fails: dict[str, deque] = defaultdict(deque)

DEMO_PATIENTS = {"MB-1041": "Fatima", "MB-1187": "Ahmed", "MB-1203": "Mariam", "MB-1322": "Khalid",
                 "MB-1409": "John", "MB-1455": "Aisha", "MB-1510": "Saeed"}
DEMO_PATIENTS_AR = {"MB-1041": "فاطمة", "MB-1187": "أحمد", "MB-1203": "مريم", "MB-1322": "خالد",
                    "MB-1409": "جون", "MB-1455": "عائشة", "MB-1510": "سعيد"}


def _sha(x: str) -> str:
    return hashlib.sha256(x.encode()).hexdigest()


def hash_password(pw: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 210_000)
    return f"pbkdf2_sha256$210000${salt.hex()}${dk.hex()}"


def check_password(pw: str, stored: str) -> bool:
    try:
        _, it, salt, dk = stored.split("$")
        got = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), int(it))
        return hmac.compare_digest(got.hex(), dk)
    except ValueError:
        return False


def demo_phone(pid: str) -> str:
    return "+97150000" + re.sub(r"\D", "", pid)[-4:]


def seed() -> None:
    USERS.clear(); PHONES.clear()
    if not _on("DEMO_ACCOUNTS"):
        return
    pw = hash_password(_demo_password())
    for u in ({"id": "u-clin-1", "email": "dr.demo@membrain.ae", "name": "Dr. Demo", "role": "clinician",
               "title": "Consultant, memory clinic", "org": "Demo memory clinic, Abu Dhabi"},
              {"id": "u-coord-1", "email": "coordinator@membrain.ae", "name": "Layla (coordinator)", "role": "coordinator",
               "title": "Programme coordinator", "org": "Healthy ageing programme"}):
        USERS[u["email"]] = u | {"password": pw}
    for pid in DEMO_PATIENTS:
        PHONES[demo_phone(pid)] = pid


seed()


def normalise_phone(raw: str) -> str | None:
    """UAE numbers in any usual form (050…, 50…, 00971…, +971…) -> +9715…; other international numbers kept."""
    d = re.sub(r"[^\d+]", "", raw or "")
    if d.startswith("00"):
        d = "+" + d[2:]
    if d.startswith("+"):
        return d if 9 <= len(d) - 1 <= 15 else None
    d = d.lstrip("0")
    if re.fullmatch(r"5\d{8}", d):
        return "+971" + d
    return None


def mask_phone(p: str) -> str:
    return p[:4] + " •• ••• " + p[-4:]


def _slow_down(key: str) -> None:
    q, now = _fails[key], time.time()
    while q and q[0] < now - WINDOW:
        q.popleft()
    if len(q) >= MAX_FAILS:
        raise HTTPException(429, "Too many attempts. Please wait a few minutes and try again.")


def _fail(key: str) -> None:
    _fails[key].append(time.time())


def _audit(actor: str, action: str, target: str, detail: dict | None = None) -> None:
    from api.main import audit   # late: api.main imports this module
    audit(actor, action, target, detail)


def _issue(user: dict, ttl: int) -> dict:
    token = secrets.token_urlsafe(32)
    SESSIONS[_sha(token)] = {"user": user, "exp": time.time() + ttl}
    return {"token": token, "expires_in": ttl, "user": user}


def _public(u: dict) -> dict:
    return {k: v for k, v in u.items() if k != "password"}


# ---------------------------------------------------------------------------------------------------- who is calling
def principal(authorization: str | None = Header(None), x_role: str | None = Header(None)) -> Principal:
    if authorization and authorization.lower().startswith("bearer "):
        s = SESSIONS.get(_sha(authorization[7:].strip()))
        if not s or s["exp"] < time.time():
            raise HTTPException(401, "Your session has ended. Please sign in again.")
        u = s["user"]
        return Principal(role=u["role"], user_id=u["id"], pid=u.get("pid"), name=u.get("name"))
    if _on("ALLOW_ROLE_HEADER", "0") and x_role:
        if x_role not in ("participant", "clinician", "coordinator"):
            raise HTTPException(403, "unknown role")
        return Principal(role=x_role, legacy=True)
    if _on("ALLOW_ROLE_HEADER", "0"):
        return Principal(role="participant", legacy=True)
    return Principal(role="anonymous")


# ---------------------------------------------------------------------------------------------------- endpoints
class ClinicianLogin(BaseModel):
    email: str = Field(max_length=200)
    password: str = Field(max_length=200)
    remember: bool = False


@router.post("/clinician/login")
def clinician_login(body: ClinicianLogin, request: Request):
    email = body.email.strip().lower()
    key = "login:" + email
    _slow_down(key)
    u = USERS.get(email)
    if not u or not check_password(body.password, u["password"]):
        _fail(key)
        _audit("public", "sign_in_failed", email[:3] + "…", {"kind": "clinician"})
        raise HTTPException(401, "That email and password don't match an account.")
    _fails.pop(key, None)
    _audit(u["id"], "sign_in", u["id"], {"kind": u["role"], "remember": body.remember})
    return _issue(_public(u), CLINICIAN_REMEMBER_TTL if body.remember else CLINICIAN_TTL)


class PatientStart(BaseModel):
    phone: str = Field(max_length=40)


@router.post("/patient/start")
def patient_start(body: PatientStart):
    phone = normalise_phone(body.phone)
    if not phone:
        raise HTTPException(422, "Please enter a mobile number, for example 050 123 4567.")
    _slow_down("code:" + phone)
    _fail("code:" + phone)           # every code sent counts towards the limit
    code = f"{secrets.randbelow(1_000_000):06d}"
    cid = secrets.token_urlsafe(12)
    CODES[cid] = {"phone": phone, "hash": _sha(cid + code), "exp": time.time() + CODE_TTL, "tries": 0}
    out = {"challenge_id": cid, "sent_to": mask_phone(phone), "expires_in": CODE_TTL, "known": phone in PHONES}
    if _on("DEMO_OTP"):
        out["demo_code"] = code      # no SMS gateway in the prototype: the code is shown on screen instead
    return out


class Claim(BaseModel):
    pid: str
    token: str


class PatientVerify(BaseModel):
    challenge_id: str
    code: str = Field(pattern=r"^\d{6}$")
    claim: Claim | None = None


@router.post("/patient/verify")
def patient_verify(body: PatientVerify):
    from api.main import DB, VAULT, new_participant
    ch = CODES.get(body.challenge_id)
    if not ch or ch["exp"] < time.time():
        CODES.pop(body.challenge_id, None)
        raise HTTPException(410, "That code has expired. Please ask for a new one.")
    ch["tries"] += 1
    if not hmac.compare_digest(ch["hash"], _sha(body.challenge_id + body.code)):
        if ch["tries"] >= CODE_TRIES:
            CODES.pop(body.challenge_id, None)
            raise HTTPException(410, "Too many wrong codes. Please ask for a new one.")
        raise HTTPException(401, "That code isn't right. Please check it and try again.")
    CODES.pop(body.challenge_id, None)
    phone = ch["phone"]
    pid = PHONES.get(phone)
    if pid not in DB["participants"]:
        pid = None
    # Someone who has just raised a concern in this browser can link it to their number.
    if not pid and body.claim and CLAIMS.get(body.claim.pid) == _sha(body.claim.token) and body.claim.pid in DB["participants"]:
        pid = body.claim.pid
        CLAIMS.pop(pid, None)
    if not pid:
        pid = new_participant()
    PHONES[phone] = pid
    VAULT.setdefault(pid, {"identity": {}, "informant": None})["identity"]["phone"] = phone   # identifiers stay in the vault
    p = DB["participants"][pid]
    name = p.get("display_name", {}).get("en") if p.get("enrolled", True) else None
    user = {"id": "u-" + pid, "role": "participant", "pid": pid, "name": name, "phone": mask_phone(phone)}
    _audit(user["id"], "sign_in", pid, {"kind": "participant"})
    return _issue(user, PATIENT_TTL)


@router.get("/me")
def me(p: Principal = Depends(principal)):
    if p.role == "anonymous" or p.legacy:
        raise HTTPException(401, "Not signed in")
    for s in SESSIONS.values():
        if s["user"]["id"] == p.user_id:
            return s["user"]
    raise HTTPException(401, "Not signed in")


@router.post("/logout")
def logout(authorization: str | None = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        s = SESSIONS.pop(_sha(authorization[7:].strip()), None)
        if s:
            _audit(s["user"]["id"], "sign_out", s["user"].get("pid") or s["user"]["id"])
    return {"ok": True}


@router.get("/demo")
def demo_accounts():
    """The synthetic demo accounts, for the sign-in pages' "use a demo account" buttons. Off with DEMO_ACCOUNTS=0."""
    if not _on("DEMO_ACCOUNTS"):
        return {"enabled": False}
    return {"enabled": True, "otp_on_screen": _on("DEMO_OTP"),
            "clinicians": [{"email": u["email"], "name": u["name"], "role": u["role"], "password": _demo_password()} for u in USERS.values()],
            "patients": [{"phone": demo_phone(pid), "name": n, "name_ar": DEMO_PATIENTS_AR[pid], "pid": pid} for pid, n in DEMO_PATIENTS.items()]}
