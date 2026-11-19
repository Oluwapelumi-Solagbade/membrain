"""MemBrain pilot API (FastAPI).

Demo-grade persistence (in-memory) with the same interfaces the pilot will
back with PostgreSQL + a FHIR store. Role is passed as X-Role header in the
demo; production uses SMART on FHIR / OAuth2 + OIDC scopes.
"""
from __future__ import annotations

import contextlib
import copy
import hashlib
import json
import os
import secrets
import pathlib
import uuid
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from membrain import config as C
from membrain.dossier import build_dossier
from membrain.fhir import bundle
from membrain.items import FLUENCY, FORMS, JUDGEMENT, STORIES, WORD_LISTS, form_for_session, participant_seed
from membrain import navigator as NAV
from membrain.personas import personas
from membrain.prevention import participant_message, prevention_plan
from membrain.scoring import score_session_transcripts
from membrain.triage import LEVELS, evaluate



@contextlib.asynccontextmanager
async def lifespan(_app):
    from api.telegram import running   # the Telegram bot runs with the API when TELEGRAM_BOT_TOKEN is set
    from api.tts import preload
    preload()                          # server voices for spoken instructions (api/tts.py), loaded in the background
    async with running():
        yield


app = FastAPI(title="MemBrain API", version=C.ENGINE_VERSION, lifespan=lifespan,
              description="Voice-first longitudinal brain-health check-in. Identifies risk and change; never diagnoses.")
# Only listed origins may call the API from a browser (GitHub Pages demo, local dev, the App Service itself).
ALLOWED_ORIGINS = [o.strip() for o in os.getenv(
    "ALLOWED_ORIGINS", "https://teamcerebrospark.github.io,https://oluwapelumi-solagbade.github.io,http://localhost:8000,http://127.0.0.1:8000,"
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3100,http://127.0.0.1:3100").split(",") if o.strip()]
# The Android app (Capacitor) loads its screens from https://localhost on the phone; it calls the same API.
ALLOWED_ORIGINS += [o for o in ("https://localhost", "capacitor://localhost") if o not in ALLOWED_ORIGINS]
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["*"], allow_headers=["*"])

from api.speech import router as speech_router  # noqa: E402

app.include_router(speech_router)
from api.tts import router as tts_router  # noqa: E402

app.include_router(tts_router)
from api.navai import router as navai_router  # noqa: E402

app.include_router(navai_router)
from api.asr_local import preload as asr_preload, router as asr_router  # noqa: E402

app.include_router(asr_router)
asr_preload()   # background model load when WHISPER_MODEL is set (no-op otherwise)
from api.telegram import router as telegram_router  # noqa: E402

app.include_router(telegram_router)

DB: dict = {"participants": {}, "tasks": {}, "audit": []}
# Identity vault: direct identifiers live here ONLY, keyed by pseudonym.
# In production this is a separate encrypted store with its own keys and access policy.
VAULT: dict = {}


def _audit_hash(e: dict, prev: str) -> str:
    body = json.dumps({k: e.get(k) for k in ("ts", "actor", "action", "target", "detail")}, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256((prev + body).encode("utf-8")).hexdigest()


def audit(actor: str, action: str, target: str, detail: dict | None = None):
    """Append-only and tamper-evident: each entry carries the SHA-256 of itself and of the entry before it, so changing
    or deleting any earlier entry breaks the chain (GET /audit/verify says where)."""
    prev = DB["audit"][-1].get("hash", "") if DB["audit"] else ""
    e = {"ts": datetime.now(timezone.utc).isoformat(), "actor": actor, "action": action, "target": target,
         "detail": json.loads(json.dumps(detail or {}, default=str)), "prev": prev}
    e["hash"] = _audit_hash(e, prev)
    DB["audit"].append(e)


def verify_audit(entries: list[dict]) -> dict:
    chained = [e for e in entries if "hash" in e]
    for i, e in enumerate(chained):
        if (i and e.get("prev") != chained[i - 1]["hash"]) or _audit_hash(e, e.get("prev", "")) != e["hash"]:
            return {"ok": False, "entries": len(chained), "first_bad": i, "at": e.get("ts")}
    return {"ok": True, "entries": len(chained), "first_bad": None, "last_hash": chained[-1]["hash"] if chained else None}


from api.auth import CLAIMS, Principal, principal  # noqa: E402
from api.auth import router as auth_router  # noqa: E402

app.include_router(auth_router)


def role(p: Principal = Depends(principal)) -> str:
    """The caller's role, from their signed-in session (api/auth.py)."""
    return p.role


def need(r: str, *allowed: str):
    if r == "anonymous":
        raise HTTPException(401, "Please sign in.")
    if r not in allowed:
        raise HTTPException(403, f"role '{r}' not permitted")


def own(p: Principal, pid: str):
    """A participant may act on their own record only; a clinician on their own hospital's patients (and the ones no
    hospital has taken on yet); the programme coordinator on any."""
    if p.role == "anonymous":
        raise HTTPException(401, "Please sign in.")
    if not p.may_touch(pid):
        raise HTTPException(403, "This person is under another hospital." if p.role == "clinician" else "This is not your record.")


def visible(who: Principal) -> list[dict]:
    """The records this caller may see: for a clinician, their hospital's (see Principal.sees)."""
    return [p for p in DB["participants"].values() if who.sees(p)]


def _staff_record(who: Principal, pid: str, *roles: str) -> dict:
    """The record for a staff endpoint: signed in with one of the roles, the record exists, and it is theirs to see."""
    need(who.role, *roles)
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    own(who, pid)
    return p


def new_participant() -> str:
    """A pseudonymous record for someone who signs in without one (no programme enrolment yet)."""
    pid = "MB-P" + uuid.uuid4().hex[:4].upper()
    DB["participants"][pid] = {"id": pid, "display_name": {"en": "New participant", "ar": "مشارك جديد"}, "age": None, "education": None,
                               "sex": "U", "dialect": None, "language": "ar", "languages": ["ar"], "entry_route": "self", "context": {},
                               "consent": {}, "referrals": [], "enrolled": False, "sessions": []}
    audit("system", "participant_created", pid, {"via": "sign_in"})
    return pid


def _sync_tasks(p: dict, ev: dict):
    latest = ev["latest"]
    # A report that only carries the previous level forward (nothing new) does not open a second task.
    if latest and latest["level"] in ("CLINICIAN_REVIEW", "URGENT") and not latest.get("carried"):
        key = f"{p['id']}:{latest['session_id']}"
        if key not in DB["tasks"]:
            hosp = p.get("assigned_hospital") or {}
            DB["tasks"][key] = {"id": key, "participant_id": p["id"], "level": latest["level"], "status": "open",
                                "created": latest["date"], "review_target_days": C.REVIEW_TARGET_DAYS[latest["level"]],
                                "reasons": latest["reasons"], "actions": [],
                                "hospital_id": hosp.get("id"), "hospital_name": hosp.get("name"),
                                "emirate": p.get("emirate"), "area": p.get("area"),
                                "phone": p.get("phone") or (p.get("identity") or {}).get("phone"),
                                "email": p.get("email") or (p.get("identity") or {}).get("email")}


def _seed():
    DB["participants"].clear(); DB["tasks"].clear()
    for p in personas():
        DB["participants"][p["id"]] = p
        _sync_tasks(p, evaluate(p, p["sessions"]))


_seed()

# Live data: what real visitors add is saved (api/store.py) and survives restarts; synthetic people are rebuilt above.
from api import store  # noqa: E402

store.remember_seed(DB)
if store.enabled():
    store.load_into(DB)
    for _p in DB["participants"].values():
        if store.live_sessions(_p):
            _sync_tasks(_p, evaluate(_p, _p["sessions"]))
    store.start()


@app.middleware("http")
async def _save_after_changes(request: Request, call_next):
    resp = await call_next(request)
    if request.method in ("POST", "PATCH", "PUT", "DELETE") and resp.status_code < 400:
        store.mark_dirty()
    return resp


from api.live import router as live_router  # noqa: E402

app.include_router(live_router)
from api.family import router as family_router  # noqa: E402

app.include_router(family_router)
from api.moca import router as moca_router  # noqa: E402
app.include_router(moca_router)
from api.packet import router as packet_router  # noqa: E402
app.include_router(packet_router)


class Identity(BaseModel):
    full_name: str = Field(max_length=200)
    national_id: str | None = Field(None, max_length=40)   # Emirates ID or MRN
    phone: str | None = Field(None, max_length=30)
    preferred_channel: str = Field("app", pattern="^(app|whatsapp|phone)$")


class Informant(BaseModel):
    """Who the informant is, for the identity vault (name and phone never enter the analytics record)."""
    name: str = Field(max_length=200)
    relation: str = Field(max_length=40)
    phone: str | None = Field(None, max_length=30)


class InformantProfile(BaseModel):
    """What the analytics record keeps about the informant: their role, never who they are."""
    type: str = Field("family", pattern="^(family|household_helper)$")
    relation: str | None = Field(None, max_length=40)
    language: str | None = Field(None, max_length=10)
    consented: bool = True
    timeline: list[dict] = Field(default_factory=list, max_length=12)   # {activity, change, when, who_took_over, why}


class EnrolConcern(BaseModel):
    """How the person came to the programme, what was noticed, and the red-flag screen done before any testing."""
    route: str = Field("programme", pattern="^(programme|primary_care|family|household_helper|self)$")
    text: str = Field("", max_length=2000)
    onset: str | None = Field(None, pattern="^(days|weeks|months|years|none)$")
    red_flags: list[str] = Field(default_factory=list, max_length=len(C.RED_FLAGS))


class Enrol(BaseModel):
    id: str | None = None
    identity: Identity | None = None
    informant: Informant | None = None
    informant_profile: InformantProfile | None = None
    concern: EnrolConcern | None = None
    enrolled_by: str = "coordinator"
    programme: str = "pilot"
    consent_version: str = "consent-ar-en-0.1"
    age: float = Field(ge=50, le=75)
    sex: str = Field("U", pattern="^(F|M|U)$")
    education: str = Field(pattern="^(none|primary|secondary|tertiary)$")
    language: str = Field(pattern="^(ar|en)$")
    dialect: str = Field("Emirati", max_length=40)
    consent: dict = Field(default_factory=dict)
    context: dict = Field(default_factory=dict)
    emirate: str | None = Field(None, max_length=40)
    funding: str | None = Field(None, max_length=40)
    hospital_id: str | None = Field(None, max_length=40)   # the coordinator's choice; a clinician enrols into their own
    iqcode: float | None = Field(None, ge=1, le=5)   # IQCODE-16 average, if an informant completed it today
    apoe: str | None = Field(None, pattern="^e[234]/e[234]$")   # an existing result, imported only with genomics consent
    date: str | None = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class SessionIn(BaseModel):
    date: str
    channel: str = "app"
    assisted: bool = False
    helper_role: str | None = None
    transcripts: dict | None = None
    raw: dict | None = None
    audio: dict | None = None
    precheck: dict | None = None
    phq2: int | None = None
    gad2: int | None = None
    sleep_hours: float | None = None
    poor_sleep_self: bool = False
    acute_illness: bool = False
    new_medication: bool = False
    iqcode: float | None = None
    safety_concern: bool = False
    voice_features: dict | None = None
    # What the check-in actually used: the alternate form it spoke and the language it was done in. Without
    # them the server assigns the form itself and scores in the participant's enrolment language.
    form: str | None = Field(None, pattern="^[ABC]$")
    lang: str | None = Field(None, pattern="^(ar|en)$")
    input_mode: str | None = None
    asr: dict | None = None


class Profile(BaseModel):
    """Age and schooling for someone who came in through a concern: the norms need both before a check-in is scored."""
    age: int = Field(ge=40, le=100)
    education: str = Field(pattern="^(none|primary|secondary|tertiary)$")
    sex: str = Field("U", pattern="^(F|M|U)$")
    dialect: str | None = None


class ReferralIn(BaseModel):
    pathway: str
    service_id: str | None = None
    urgency: str = Field("routine", pattern="^(routine|urgent)$")
    reason: str
    date: str


class ReferralStatus(BaseModel):
    state: str
    date: str
    reason: str = ""


class Action(BaseModel):
    action: str = Field(pattern="^(confirm_concern|dismiss|request_repeat|order_investigations|refer)$")
    note: str = ""
    referral_to: str | None = None


@app.get("/health")
def health():
    return {"status": "ok", "engine": C.ENGINE_VERSION, "norms": C.NORMS_VERSION}


@app.get("/items/{form}")
def items(form: str, lang: str = "en"):
    if form not in FORMS:
        raise HTTPException(404)
    return {"form": form, "lang": lang, "word_list": WORD_LISTS[form][lang],
            "fluency_category": FLUENCY[form]["category"][lang], "story": STORIES[form][lang],
            "judgement": JUDGEMENT[form][lang]}


def _informant_record(prof: "InformantProfile") -> dict:
    """The informant's role and the changes they describe, with each activity as a known key and its label."""
    rows = []
    for t in prof.timeline:
        key = str(t.get("activity_key") or "")
        label = _IK.ACTIVITIES.get(key) or str(t.get("activity") or "")[:80]
        if not label:
            continue
        rows.append({"activity_key": key if key in _IK.ACTIVITIES else None, "activity": label,
                     **{k: str(t.get(k) or "")[:120] for k in ("change", "when", "who_took_over", "why")}})
    return prof.model_dump(exclude={"timeline"}) | {"timeline": rows}


# How someone came to the programme (enrolment) -> who raised the concern (the triage engine's reporter keys).
ROUTE_REPORTER = {"programme": "coordinator", "primary_care": "professional", "family": "family", "household_helper": "helper", "self": "self"}


@app.post("/participants")
def enrol(body: Enrol, who: Principal = Depends(principal)):
    """A coordinator or clinician enrols someone. Name, ID and phone go to the identity vault only; the record the
    engine, dashboard and analytics use carries a pseudonymous ID. A red flag at the safety screen opens an urgent
    review straight away."""
    r = who.actor   # audited under the signed-in account
    need(who.role, "coordinator", "clinician")
    hid = who.hospital_id if who.role == "clinician" and who.hospital_id else body.hospital_id
    hosp = _hospital(hid) if hid else None
    if body.id and body.id in DB["participants"] and not DB["participants"][body.id].get("enrolled", True):
        pid = body.id
        existing_p = DB["participants"][pid]
        existing_sessions = list(existing_p.get("sessions", []))
        if not hid and existing_p.get("assigned_hospital"):
            hosp = existing_p.get("assigned_hospital")
        if not body.emirate and existing_p.get("emirate"):
            body.emirate = existing_p.get("emirate")
    else:
        existing_sessions = []
        while True:
            pid = "MB-" + uuid.uuid4().hex[:6].upper()
            if pid not in DB["participants"]:
                break
    today = body.date or datetime.now(timezone.utc).date().isoformat()
    consent = {k: bool(v) for k, v in (body.consent or {}).items()}
    ctx = dict(body.context or {})
    if not consent.get("clinical_record", True):        # no health-record consent: keep only what the person said
        for k in ("sbp", "dbp", "hba1c", "ldl", "bmi"):
            ctx[k] = None
    if not consent.get("family_history", True):
        ctx["family_history_dementia"] = None
    age = float(body.age)
    prof = body.informant_profile
    helper_ok = prof is None or prof.type != "household_helper" or prof.consented
    p = {"id": pid, "display_name": {"en": "Enrolled participant", "ar": "مشارك مسجّل"}, "age": age,
         "age_band": "50-59" if age < 60 else "60-69" if age < 70 else "70-75", "sex": body.sex, "education": body.education,
         "dialect": body.dialect, "language": body.language, "languages": [body.language], "story": "", "context": ctx,
         "consent": consent, "sessions": list(existing_sessions), "referrals": [], "enrolled": True,
         "entry_route": body.concern.route if body.concern else "programme", "emirate": body.emirate, "funding": body.funding,
         "preferred_channel": body.identity.preferred_channel if body.identity else "app",
         "pending_iqcode": body.iqcode, "has_informant": body.informant is not None or prof is not None,
         "informant": _informant_record(prof) if prof and helper_ok else None,
         "genomics": {"apoe": body.apoe, "source": "Existing result entered at enrolment", "date": today, "counselling": "not_offered"}
         if body.apoe and consent.get("genomics") else None,
         "assigned_hospital": hosp,
         "programme": body.programme, "consent_version": body.consent_version, "enrolled_by": body.enrolled_by,
         "enrolled_at": datetime.now(timezone.utc).isoformat()}
    cz = body.concern or EnrolConcern()
    flags = [f for f in dict.fromkeys(cz.red_flags) if f in C.RED_FLAGS]
    acts = sorted({str(t.get("activity_key")) for t in (prof.timeline if prof else []) if t.get("activity_key") in _IK.ACTIVITIES})
    if body.concern:   # the concern and the red-flag screen, recorded before any testing
        intake_sess = next((s for s in p["sessions"] if s.get("type") == "intake"), None)
        if intake_sess:
            if cz.text.strip():
                intake_sess["concern"] = cz.text.strip()
            if cz.onset:
                intake_sess["onset"] = cz.onset
            if flags:
                intake_sess["red_flags"] = flags
        else:
            p["sessions"].append({"session_id": f"{pid}-intake", "date": today, "type": "intake", "channel": "app",
                                "concern": cz.text.strip() or "routine programme screening", "onset": cz.onset, "red_flags": flags,
                                "reported_concern": {"reporter": ROUTE_REPORTER[cz.route], "domains": [], "activities_taken_over": acts}})
    DB["participants"][pid] = p
    VAULT[pid] = {"identity": body.identity.model_dump() if body.identity else None,
                  "informant": body.informant.model_dump() if body.informant else None}   # identifiers never enter the record
    phone_linked = False
    if body.identity and body.identity.phone:   # the person can then sign in with this number and land on their own record
        from api.auth import PHONES, normalise_phone
        ph = normalise_phone(body.identity.phone)
        if ph and ph not in PHONES:
            PHONES[ph] = pid
            phone_linked = True
    if p["sessions"]:
        _sync_tasks(p, evaluate(p, p["sessions"]))
    audit(r, "enrol", pid, {"consent": consent, "consent_version": body.consent_version, "programme": body.programme,
                            "entry_route": p["entry_route"], "red_flags": flags})
    out_case = _case(p)
    if body.identity and body.identity.full_name:
        out_case["registered_name"] = body.identity.full_name.strip()
    return {"id": pid, "first_form": form_for_session(0, participant_seed(pid)), "phone_linked": phone_linked,
            "schedule": {"baseline_1": "today", "baseline_2": "+2 weeks", "follow_up": "+12 weeks"}, "case": out_case}


@app.post("/participants/{pid}/reidentify")
def reidentify(pid: str, reason: dict, who: Principal = Depends(principal)):
    """Break-glass re-identification for follow-up contact: clinical staff only, reason required, audited under the
    signed-in account."""
    r = who.actor
    need(who.role, "clinician", "coordinator")
    own(who, pid)
    if not reason.get("reason"):
        raise HTTPException(422, "a reason is required to re-identify")
    if pid not in VAULT:
        raise HTTPException(404, "no identity on file")
    audit(r, "reidentify", pid, {"reason": reason["reason"]})
    return VAULT[pid]


def _hospital(hid: str) -> dict:
    s = next((x for x in NAV.directory() if x["id"] == hid), None)
    if not s:
        raise HTTPException(422, "unknown hospital")
    return {"id": s["id"], "name": s["name"]}


class HospitalIn(BaseModel):
    hospital_id: str = Field(max_length=40)


@app.post("/participants/{pid}/hospital")
def assign_hospital(pid: str, body: HospitalIn, who: Principal = Depends(principal)):
    """Put someone under a hospital. A clinician can take on a person no hospital has yet, for their own hospital;
    the programme coordinator can assign or move anyone. Open reviews move with the person."""
    p = _staff_record(who, pid, "clinician", "coordinator")
    from api.auth import hospital_of
    if who.role == "clinician" and who.hospital_id and not who.legacy:
        if body.hospital_id != who.hospital_id:
            raise HTTPException(403, "A clinician can take someone on only for their own hospital.")
        if hospital_of(p) not in (None, who.hospital_id):
            raise HTTPException(403, "This person is under another hospital.")
    before = hospital_of(p)
    p["assigned_hospital"] = _hospital(body.hospital_id)
    for t in DB["tasks"].values():
        if t["participant_id"] == pid and t["status"] != "closed":
            t["hospital_id"], t["hospital_name"] = p["assigned_hospital"]["id"], p["assigned_hospital"]["name"]
    audit(who.actor, "hospital_assigned", pid, {"from": before, "to": body.hospital_id})
    return _case(p)


@app.patch("/participants/{pid}/consent")
def update_consent(pid: str, consent: dict, who: Principal = Depends(principal)):
    own(who, pid)
    r = who.actor
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    p["consent"] = {**p.get("consent", {}), **consent}
    withdrawn = [k for k, v in consent.items() if not v]
    # withdrawal propagates: stop processing and purge the affected signal downstream
    if "voice_features" in withdrawn:
        for s in p["sessions"]:
            s["voice_features"] = None
    if "wearables" in withdrawn:
        for k in ("sleep_hours", "activity_min_week"):
            (p.get("context") or {}).pop(k, None)
    audit(r, "consent_update", pid, consent)
    return p["consent"]


@app.post("/participants/{pid}/sessions")
def submit_session(pid: str, body: SessionIn, who: Principal = Depends(principal)):
    own(who, pid)
    r = who.actor
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    if p.get("age") is None or p.get("education") is None:
        raise HTTPException(409, "age and schooling are needed before a check-in can be scored (PATCH /participants/{pid}/profile)")
    idx = len(p["sessions"])
    s = body.model_dump()
    lang = s.pop("lang") or p["language"]
    s["session_id"] = f"{pid}-s{idx}"
    s["form"] = s.get("form") or form_for_session(idx, participant_seed(pid))
    s["lang"] = lang
    if s.get("transcripts") and not s.get("raw"):
        scored = score_session_transcripts(s["transcripts"], s["form"], lang)
        s["raw"], s["scoring_detail"] = scored["raw"], scored["detail"]
    # An informant questionnaire collected at enrolment travels with the first scored check-in (as the earlier prototype did).
    if p.get("pending_iqcode") is not None and s.get("iqcode") is None and not any(x.get("type") != "intake" for x in p["sessions"]):
        s["iqcode"], p["pending_iqcode"] = p["pending_iqcode"], None
    if not (p.get("consent") or {}).get("voice_features"):
        s["voice_features"] = None
    p["sessions"].append(s)
    ev = evaluate(p, p["sessions"])
    _sync_tasks(p, ev)
    # The person hears about the check-in they just did, even if a report (a concern, the family questionnaire) on the
    # record is dated later.
    mine = next((e for e in ev["history"] if e["session_id"] == s["session_id"]), ev["latest"])
    audit(r, "session_submitted", pid, {"session_id": s["session_id"], "level": mine["level"]})
    msg = participant_message(mine, lang)
    out = {"session_id": s["session_id"], "message": msg, "level": mine["level"],
           "held_for_clinician": bool(mine.get("held_for_clinician")),
           "next_form": form_for_session(idx + 1, participant_seed(pid))}
    if mine["level"] in ("BASELINE", "STABLE"):
        out["prevention"] = prevention_plan({**p.get("context", {}), "mood_positive": (body.phq2 or 0) >= 3}, lang)
    return out  # held results: participant sees only the message; details go to clinician


# ------------------------------------------------------------- Exploratory tasks (never used for triage)
class RouteTrial(BaseModel):
    length: int = Field(ge=2, le=9)
    correct: bool
    steps_correct: int = Field(ge=0, le=9)
    ms: int = Field(ge=0, le=600000)


class ExploratoryIn(BaseModel):
    task: str = Field(pattern="^souq_route$")
    version: str = Field(max_length=20)
    form: str = Field(pattern="^[ABC]$")
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    lang: str = Field(pattern="^(ar|en)$")
    span: int = Field(ge=0, le=9)
    trials: list[RouteTrial] = Field(max_length=20)
    assisted: bool = False


@app.post("/participants/{pid}/exploratory")
def exploratory_result(pid: str, body: ExploratoryIn, who: Principal = Depends(principal)):
    """Souq route (spatial route memory): kept with the record and shown to the clinician as EXPLORATORY.
    It is not part of the scored check-in and never changes a triage level until it has been validated (pilot)."""
    own(who, pid)
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    t = body.trials
    steps = sum(x.length for x in t)
    res = body.model_dump() | {
        "accuracy": round(sum(x.steps_correct for x in t) / steps, 3) if steps else None,
        "ms_per_step": round(sum(x.ms for x in t) / steps) if steps else None,
        "trials_correct": sum(1 for x in t if x.correct),
    }
    p.setdefault("exploratory", []).append(res)
    audit(who.actor, "exploratory_task", pid, {"task": body.task, "span": body.span, "accuracy": res["accuracy"]})
    return {"saved": True, "span": body.span, "accuracy": res["accuracy"], "ms_per_step": res["ms_per_step"],
            "previous": [{"date": x["date"], "span": x["span"]} for x in p["exploratory"][:-1] if x["task"] == body.task][-3:]}


@app.patch("/participants/{pid}/profile")
def set_profile(pid: str, body: Profile, who: Principal = Depends(principal)):
    """Only for someone who came in through a concern (no enrolment yet); an enrolled profile is not changed here."""
    own(who, pid)
    r = who.actor
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    if p.get("enrolled", True) and p.get("age") is not None:
        raise HTTPException(409, "this participant is enrolled; their profile is changed through enrolment")
    p.update({"age": body.age, "education": body.education, "sex": body.sex,
              "age_band": "50-59" if body.age < 60 else "60-69" if body.age < 70 else "70-75"})
    if body.dialect:
        p["dialect"] = body.dialect
    audit(r, "profile_set", pid, {"age": body.age, "education": body.education})
    return _case(p)


@app.get("/participants")
def list_participants(who: Principal = Depends(principal)):
    need(who.role, "clinician", "coordinator")
    out = []
    for p in visible(who):
        ev = evaluate(p, p["sessions"]) if p["sessions"] else {"latest": None}
        out.append({"id": p["id"], "age": p["age"], "education": p["education"], "dialect": p.get("dialect"),
                    "sessions": len(p["sessions"]), "level": ev["latest"]["level"] if ev["latest"] else "ENROLLED"})
    return sorted(out, key=lambda x: -LEVELS.index(x["level"]) if x["level"] in LEVELS else 0)


@app.get("/participants/{pid}/evaluation")
def get_eval(pid: str, who: Principal = Depends(principal)):
    p = _staff_record(who, pid, "clinician")
    audit(who.actor, "view_evaluation", pid)
    return evaluate(p, p["sessions"])


@app.get("/participants/{pid}/dossier")
def dossier(pid: str, who: Principal = Depends(principal)):
    p = _staff_record(who, pid, "clinician")
    audit(who.actor, "view_dossier", pid)
    return build_dossier(p, evaluate(p, p["sessions"]))


@app.get("/participants/{pid}/fhir")
def fhir_bundle(pid: str, who: Principal = Depends(principal)):
    p = _staff_record(who, pid, "clinician")
    ev = evaluate(p, p["sessions"])
    audit(who.actor, "export_fhir", pid)
    return bundle(p, p["sessions"], ev["history"])


@app.get("/queue")
def queue(who: Principal = Depends(principal)):
    need(who.role, "clinician")
    ts = [t for t in DB["tasks"].values() if t["status"] == "open" and who.sees(DB["participants"].get(t["participant_id"]))]
    return sorted(ts, key=lambda t: (-LEVELS.index(t["level"]), t["created"]))


@app.post("/tasks/{task_id}/action")
def task_action(task_id: str, body: Action, who: Principal = Depends(principal)):
    need(who.role, "clinician")
    r = who.actor
    t = DB["tasks"].get(task_id)
    if not t:
        raise HTTPException(404)
    own(who, t["participant_id"])
    if body.action == "dismiss" and not body.note:
        raise HTTPException(422, "dismissal requires a reason")
    t["actions"].append(body.model_dump() | {"ts": datetime.now(timezone.utc).isoformat()})
    t["status"] = "closed" if body.action in ("dismiss", "refer", "confirm_concern") else "in_progress"
    audit(r, "task_" + body.action, task_id, body.model_dump())
    return t


@app.get("/validation/summary")
def validation_summary(n: int = 1500, seed: int = 7, r: str = Depends(role)):
    need(r, "clinician", "coordinator")
    from membrain.simulate import ASSUMPTIONS, generate_cohort
    from membrain.validation import analyse
    res = analyse(generate_cohort(min(n, 3000), seed))
    return {"synthetic": True, "assumptions": ASSUMPTIONS, "summary": res["summary"]}


@app.get("/audit/verify")
def audit_verify(r: str = Depends(role)):
    need(r, "clinician", "coordinator")
    return verify_audit(DB["audit"])


@app.get("/audit")
def get_audit(who: Principal = Depends(principal)):
    need(who.role, "clinician", "coordinator")
    log = DB["audit"]
    if who.role == "clinician" and who.hospital_id and not who.legacy:
        # a hospital's clinician sees what they did and what happened to their own hospital's patients
        mine = {p["id"] for p in visible(who)}
        log = [e for e in log if e.get("actor") == who.user_id or str(e.get("target", "")).split(":")[0] in mine]
    return copy.deepcopy(log[-200:])


@app.post("/demo/reset")
def reset():
    keep = store.snapshot(DB)   # a demo reset restores the synthetic people; it never deletes what real visitors added
    _seed()
    store.merge(DB, keep)
    return {"ok": True, "participants": len(DB["participants"])}


# ------------------------------------------------------------- Navigator
@app.get("/directory")
def get_directory():
    return NAV.directory()


@app.get("/participants/{pid}/services")
def services_for(pid: str, pathway: str, who: Principal = Depends(principal)):
    p = _staff_record(who, pid, "clinician", "coordinator")
    return NAV.match_services(pathway, p)


@app.post("/participants/{pid}/referrals")
def create_referral(pid: str, body: ReferralIn, who: Principal = Depends(principal)):
    p = _staff_record(who, pid, "clinician")
    r = who.actor
    if body.pathway not in NAV.PATHWAYS:
        raise HTTPException(422, "unknown pathway")
    refs = p.setdefault("referrals", [])
    ref = NAV.new_referral(f"REF-{pid}-{len(refs)}", pid, body.pathway, body.service_id, body.urgency, body.date, body.reason,
                           entry_route=p.get("entry_route", "programme"))
    cd = NAV.concern_date(p, evaluate(p, p["sessions"])["history"] if p.get("sessions") else [])
    if cd:
        ref["concern_date"] = cd
    refs.append(ref)
    audit(r, "referral_recommended", pid, {"pathway": body.pathway, "service": body.service_id})
    return ref


@app.post("/referrals/{rid}/status")
def referral_status(rid: str, body: ReferralStatus, who: Principal = Depends(principal)):
    need(who.role, "clinician", "coordinator")
    r = who.actor
    for p in visible(who):
        for ref in p.get("referrals", []):
            if ref["id"] == rid:
                try:
                    NAV.advance(ref, body.state, body.date, body.reason, by=r)
                except ValueError as e:
                    raise HTTPException(422, str(e))
                audit(r, "referral_" + body.state, p["id"], {"referral": rid, "reason": body.reason})
                return ref
    raise HTTPException(404)


@app.get("/referrals")
def list_referrals(unresolved_only: bool = False, who: Principal = Depends(principal)):
    need(who.role, "clinician", "coordinator")
    out = [ref for p in visible(who) for ref in p.get("referrals", [])]
    return [x for x in out if NAV.is_unresolved(x)] if unresolved_only else out


@app.get("/referrals/{rid}/next-steps")
def next_steps(rid: str, lang: str = "en", who: Principal = Depends(principal)):
    need(who.role, "clinician", "coordinator")
    svc = {s["id"]: s for s in NAV.directory()}
    for p in visible(who):
        for ref in p.get("referrals", []):
            if ref["id"] == rid:
                return NAV.next_steps_pack(ref, svc.get(ref.get("service_id")), lang)
    raise HTTPException(404)


@app.get("/programme/metrics")
def metrics(who: Principal = Depends(principal)):
    need(who.role, "clinician", "coordinator")
    mine = visible(who)
    refs = [ref for p in mine for ref in p.get("referrals", [])]
    people = {p["id"]: {"language": p.get("language"), "funding": p.get("funding"), "sex": p.get("sex"), "age_band": p.get("age_band")}
              for p in mine}
    return NAV.programme_metrics(refs, people)




# ------------------------------------------------------------- Genomics (consent-gated)
from membrain import genomics as GX  # noqa: E402


@app.get("/participants/{pid}/genomics")
def get_genomics(pid: str, who: Principal = Depends(principal)):
    p = _staff_record(who, pid, "clinician")
    audit(who.actor, "view_genomics", pid)
    return GX.genomic_context(p)


@app.post("/participants/{pid}/genomics/counselling")
def genomics_counselling(pid: str, body: dict, who: Principal = Depends(principal)):
    p = _staff_record(who, pid, "clinician")
    r = who.actor
    if not p.get("genomics"):
        raise HTTPException(404)
    try:
        p["genomics"]["counselling"] = GX.advance_counselling(p["genomics"].get("counselling", "not_offered"), body.get("state", ""))
    except ValueError as e:
        raise HTTPException(422, str(e))
    audit(r, "genomics_counselling_" + p["genomics"]["counselling"], pid)
    return GX.genomic_context(p)


@app.get("/me/{pid}/genomics")
def participant_genomics(pid: str):
    """What the PARTICIPANT app may show: nothing unless counselling is completed and they chose to know."""
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    gc = GX.genomic_context(p)
    if not gc.get("participant_disclosure_allowed"):
        return {"shown": False, "message": "Any genetic results are discussed with you by a clinician with counselling."}
    return {"shown": True, "apoe": gc["apoe"], "limits": gc["limits"]}


# ------------------------------------------------------------- Clinician workspace (site/)
# One call returns what the dashboard needs for every case, so the queue, cohort and reports pages
# read the same state the actions write to.
from membrain.dossier import concern_summary  # noqa: E402
from membrain.prevention import risk_context  # noqa: E402


def _task_for(p: dict, latest: dict | None) -> dict | None:
    """The case's clinician task: the most recent one still open, else the latest session's. A later check-in does
    not close a review or urgent hold opened earlier (by a concern, say); only a clinician's action does."""
    mine = [t for t in DB["tasks"].values() if t["participant_id"] == p["id"]]
    still_open = [t for t in mine if t["status"] != "closed"]
    if still_open:
        return still_open[-1]
    current = DB["tasks"].get(f"{p['id']}:{latest['session_id']}") if latest else None
    return current or (mine[-1] if mine else None)   # otherwise the last one, closed: the case shows it was handled


def _case(p: dict, full: bool = False) -> dict:
    pid = p.get("id", "")
    p_out = dict(p)
    reg_name = (VAULT.get(pid, {}).get("identity") or {}).get("full_name")
    if reg_name:
        p_out["display_name"] = {"en": reg_name, "ar": reg_name}
    ev = evaluate(p, p["sessions"]) if p["sessions"] else {"latest": None, "history": []}
    ctx = p.get("context") or {}
    out = {"participant": p_out, "history": ev["history"], "latest": ev["latest"], "task": _task_for(p, ev["latest"]),
           "concern": concern_summary(p), "risk_context": risk_context(ctx) if ctx else None,
           "prevention": prevention_plan(ctx, p.get("language") or "en") if ctx else None}
    if full:
        out["dossier"] = build_dossier(p, ev)
    return out


@app.get("/cases")
def list_cases(who: Principal = Depends(principal)):
    """A clinician's hospital's cases (and those not yet taken on), every case for the coordinator; a signed-in
    participant gets only their own."""
    if who.role == "participant" and not who.legacy:
        p = DB["participants"].get(who.pid or "")
        return [_case(p)] if p else []
    need(who.role, "clinician", "coordinator")
    return [_case(p) for p in visible(who)]


@app.get("/cases/{pid}")
def get_case(pid: str, who: Principal = Depends(principal)):
    own(who, pid)
    if who.role == "participant" and not who.legacy:
        p = DB["participants"].get(pid)
        if not p:
            raise HTTPException(404)
        return _case(p)
    r = who.actor
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    audit(r, "view_case", pid)
    return _case(p, full=True)


from membrain import intake as _IK  # noqa: E402
from pydantic import field_validator  # noqa: E402


class ConcernIn(BaseModel):
    """A concern confirmed by whoever raised it in the chat. Only the confirmed facts are stored.
    Public endpoint: only known labels are accepted, sizes are capped, and the date must be a real date."""
    reporter: str = Field(pattern="^(self|family|helper|professional|coordinator)$")   # config.REPORTER_LABEL keys
    lang: str = Field(pattern="^(ar|en)$")
    narrative: str = Field(min_length=3, max_length=4000)
    domains: list[str] = Field(default_factory=list, max_length=len(_IK.DOMAINS))
    onset: str | None = Field(default=None, pattern="^(days|weeks|months|years)$")
    frequency: str | None = Field(default=None, pattern="^(daily|weekly|sometimes|once)$")   # how often, in their words
    severity: str | None = Field(default=None, pattern="^(marked|mild)$")                     # how much, in their words
    timeline: list[list[str]] = Field(default_factory=list, max_length=12)   # [activity, who took over]
    red_flags: list[str] = Field(default_factory=list, max_length=len(C.RED_FLAGS))
    confounders: list[str] = Field(default_factory=list, max_length=len(_IK.CONFOUNDERS))
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    channel: str = Field("app", pattern="^(app|telegram|phone)$")   # where it was raised; channels are never pooled
    phone: str | None = Field(default=None, max_length=60)
    email: str | None = Field(default=None, max_length=120)
    emirate: str | None = Field(default=None, max_length=40)
    area: str | None = Field(default=None, max_length=100)
    hospital_id: str | None = Field(default=None, max_length=40)
    hospital_name: str | None = Field(default=None, max_length=150)
    latitude: float | None = None
    longitude: float | None = None

    @field_validator("domains")
    @classmethod
    def _domains(cls, v):
        bad = [x for x in v if x not in _IK.DOMAINS]
        if bad:
            raise ValueError(f"unknown domain {bad[0]!r}")
        return list(dict.fromkeys(v))

    @field_validator("red_flags")
    @classmethod
    def _flags(cls, v):
        bad = [x for x in v if x not in C.RED_FLAGS]
        if bad:
            raise ValueError(f"unknown red flag {bad[0]!r}")
        return list(dict.fromkeys(v))

    @field_validator("confounders")
    @classmethod
    def _conf(cls, v):
        bad = [x for x in v if x not in _IK.CONFOUNDERS]
        if bad:
            raise ValueError(f"unknown confounder {bad[0]!r}")
        return list(dict.fromkeys(v))

    @field_validator("timeline")
    @classmethod
    def _timeline(cls, v):
        for row in v:
            if len(row) != 2 or row[0] not in _IK.ACTIVITIES or row[1] not in _IK.WHO:
                raise ValueError("each timeline row must be [activity, who_took_over] with known keys")
        return v

    @field_validator("date")
    @classmethod
    def _date(cls, v):
        from datetime import date as _d
        _d.fromisoformat(v)   # raises on 2026-02-30 etc.
        return v


# Who raised the concern -> the navigator's entry route (as enrolment does).
ENTRY_ROUTE = {"self": "self", "family": "family", "helper": "household_helper", "professional": "primary_care", "coordinator": "programme"}


_CONCERN_HITS: dict = {}
CONCERN_RATE = int(os.getenv("CONCERN_RATE_PER_MIN", "6"))      # per client address
PUBLIC_CONCERN_CAP = int(os.getenv("PUBLIC_CONCERN_CAP", "500"))  # demo memory cap


@app.post("/concerns")
def raise_concern(body: ConcernIn, request: Request):
    """Anyone can raise a concern. It becomes a pseudonymous record with an intake session, triaged by the engine;
    a significant concern opens a clinician task straight away. No identifiers are taken here."""
    import time as _t
    from collections import deque
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0].strip()
    q = _CONCERN_HITS.setdefault(ip, deque())
    now = _t.time()
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= CONCERN_RATE:
        raise HTTPException(429, "Too many concerns from this connection; please wait a minute")
    if sum(1 for p in DB["participants"].values() if p["id"].startswith("MB-C")) >= PUBLIC_CONCERN_CAP:
        raise HTTPException(429, "The demo is full; it is reset when the server restarts")
    q.append(now)
    return create_concern(body)


def create_concern(body: ConcernIn) -> dict:
    """The concern record itself, shared by POST /concerns and the Telegram bot (api/telegram.py)."""
    if sum(1 for p in DB["participants"].values() if p["id"].startswith("MB-C")) >= PUBLIC_CONCERN_CAP:
        raise HTTPException(429, "The demo is full; it is reset when the server restarts")
    while True:   # 8 hex characters, and never reuse an existing ID
        pid = "MB-C" + uuid.uuid4().hex[:8].upper()
        if pid not in DB["participants"]:
            break
    acts = sorted({a for a, _ in body.timeline})
    hosp = {"id": body.hospital_id, "name": body.hospital_name} if body.hospital_id else None
    loc = {"latitude": body.latitude, "longitude": body.longitude, "emirate": body.emirate, "area": body.area} if (body.latitude or body.emirate) else None
    p = {"id": pid, "display_name": {"en": "New concern", "ar": "قلق جديد"}, "age": None, "education": None, "sex": "U",
         "dialect": None, "language": body.lang, "languages": [body.lang], "entry_route": ENTRY_ROUTE[body.reporter], "context": {},
         "consent": {}, "referrals": [], "enrolled": False,
         "phone": body.phone, "email": body.email, "emirate": body.emirate, "area": body.area,
         "assigned_hospital": hosp, "location": loc,
         "intake": {"reporter": body.reporter, "at": body.date, "phone": body.phone, "email": body.email,
                    "emirate": body.emirate, "area": body.area, "assigned_hospital": hosp,
                    "confirmed": {"narrative": body.narrative, "domains": body.domains, "onset": body.onset, "frequency": body.frequency, "severity": body.severity,
                                  "timeline": body.timeline, "red_flags": body.red_flags, "confounders": body.confounders}},
         "sessions": [{"session_id": f"{pid}-intake", "date": body.date, "type": "intake", "channel": body.channel,
                       "concern": body.narrative, "onset": body.onset, "frequency": body.frequency, "severity": body.severity, "red_flags": body.red_flags,
                       "reported_concern": {"reporter": body.reporter, "domains": body.domains, "activities_taken_over": acts}}]}
    DB["participants"][pid] = p
    _sync_tasks(p, evaluate(p, p["sessions"]))
    audit("public", "concern_raised", pid, {"reporter": body.reporter, "channel": body.channel, "red_flags": body.red_flags, "activities": acts})
    # A one-time token that lets whoever raised it link the concern to their own sign-in later (api/auth.py).
    claim = secrets.token_urlsafe(18)
    CLAIMS[pid] = hashlib.sha256(claim.encode()).hexdigest()
    return _case(p) | {"claim_token": claim}


REPORTS_PER_PERSON = 60   # demo memory cap on follow-up concerns and questionnaires per record


def _reports(p: dict, kind: str) -> int:
    n = sum(1 for x in p["sessions"] if x.get("type") == kind)
    if sum(1 for x in p["sessions"] if x.get("type") in ("intake", "informant")) >= REPORTS_PER_PERSON:
        raise HTTPException(429, "This record has reached the demo's limit of reports")
    return n


def add_follow_up(p: dict, body: ConcernIn, actor: str) -> dict:
    """A later concern about someone already known: a new dated report on the same record, in the same five parts,
    so the engine can say what is new since it was first reported (membrain/triage.py). Shared with the Telegram bot."""
    n = _reports(p, "intake")
    sid = f"{p['id']}-intake" + (f"-{n + 1}" if n else "")
    acts = sorted({a for a, _ in body.timeline})
    p["sessions"].append({"session_id": sid, "date": body.date, "type": "intake", "channel": body.channel,
                          "concern": body.narrative, "onset": body.onset, "frequency": body.frequency, "severity": body.severity, "red_flags": body.red_flags,
                          "reported_concern": {"reporter": body.reporter, "domains": body.domains, "activities_taken_over": acts,
                                               "timeline": body.timeline, "confounders": body.confounders}})
    if not p.get("intake"):   # the first concern on a record that started with a check-in
        p["intake"] = {"reporter": body.reporter, "at": body.date,
                       "confirmed": {"narrative": body.narrative, "domains": body.domains, "onset": body.onset, "frequency": body.frequency, "severity": body.severity,
                                     "timeline": body.timeline, "red_flags": body.red_flags, "confounders": body.confounders}}
    ev = evaluate(p, p["sessions"])
    _sync_tasks(p, ev)
    audit(actor, "concern_follow_up", p["id"], {"reporter": body.reporter, "channel": body.channel, "red_flags": body.red_flags,
                                               "activities": acts, "level": ev["latest"]["level"]})
    return _case(p)


@app.post("/participants/{pid}/concerns")
def follow_up_concern(pid: str, body: ConcernIn, who: Principal = Depends(principal)):
    """Report a change again about someone already known (the person, their family, or a clinician after a call)."""
    own(who, pid)
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    return add_follow_up(p, body, who.actor)


FAQ_SCORES = {0, 1, 2, 3}
INFORMANT_MESSAGE = {
    "en": "Thank you. Your answers are now with the clinic team, together with everything reported before. If they show "
          "that everyday activities have become harder, the clinic will contact you about a full assessment by a doctor. "
          "This questionnaire is a screening step: it cannot diagnose any condition, including dementia or Alzheimer's disease.",
    "ar": "شكرًا لك. أصبحت إجاباتك الآن لدى فريق العيادة مع كل ما أُبلغ عنه سابقًا. إذا أظهرت أن الأنشطة اليومية أصبحت أصعب، "
          "فستتواصل معك العيادة بشأن تقييم كامل يجريه طبيب. هذا الاستبيان خطوة فحص أولي، ولا يمكنه تشخيص أي حالة، بما في ذلك الخرف أو مرض ألزهايمر.",
}


class InformantIn(BaseModel):
    """The family questionnaire (Functional Activities Questionnaire, membrain/config.py FAQ_ITEMS): each everyday
    activity rated as it is now, 0 manages normally ... 3 someone else does it now."""
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    lang: str = Field("ar", pattern="^(ar|en)$")
    respondent: str = Field(pattern="^(spouse|child|sibling|other_family|helper|friend|self)$")
    answers: dict[str, int]
    channel: str = Field("app", pattern="^(app|telegram|phone)$")

    @field_validator("answers")
    @classmethod
    def _answers(cls, v):
        if set(v) != set(C.FAQ_ITEMS):
            raise ValueError("answer every activity in the questionnaire")
        if any(x not in FAQ_SCORES for x in v.values()):
            raise ValueError("each answer must be 0, 1, 2 or 3")
        return {k: v[k] for k in C.FAQ_ITEMS}

    @field_validator("date")
    @classmethod
    def _date(cls, v):
        from datetime import date as _d
        _d.fromisoformat(v)
        return v


@app.post("/participants/{pid}/informant")
def informant_questionnaire(pid: str, body: InformantIn, who: Principal = Depends(principal)):
    """A family member's answers to the questionnaire, repeated at follow-ups. The family hears a message, never a
    score; the clinician sees the score, its change since last time, and that it is a screening result."""
    own(who, pid)
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    n = _reports(p, "informant")
    total = sum(body.answers.values())
    s = {"session_id": f"{pid}-faq-{n + 1}", "date": body.date, "type": "informant", "channel": body.channel,
         "faq": total, "faq_items": body.answers, "respondent": body.respondent, "lang": body.lang}
    p["sessions"].append(s)
    ev = evaluate(p, p["sessions"])
    _sync_tasks(p, ev)
    audit(who.actor, "informant_questionnaire", pid, {"session_id": s["session_id"], "respondent": body.respondent,
                                                     "level": ev["latest"]["level"]})
    out = {"session_id": s["session_id"], "message": INFORMANT_MESSAGE[body.lang],
           "held_for_clinician": bool(ev["latest"].get("held_for_clinician"))}
    if who.role in ("clinician", "coordinator"):   # the family's own account gets the message only, never the score
        out["case"] = _case(p)
    return out


# ------------------------------------------------------------- web app (keep LAST: the mount catches every unmatched path)
# Serve the built site at "/" so one in-country App Service hosts both the API and the front end (same origin:
# microphone and speech work over HTTPS). Only the site (site/out, built by `npm run build` in site/) is served; the
# earlier single-page prototype is retired, and /prototype/ forwards to the site's home page.
_ROOT = pathlib.Path(__file__).resolve().parents[1]
_DIST = _ROOT / "site" / "out" if (_ROOT / "site" / "out" / "index.html").exists() else None
if _DIST:
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=str(_DIST), html=True), name="web")
