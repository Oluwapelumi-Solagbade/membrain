"""MemBrain pilot API (FastAPI).

Demo-grade persistence (in-memory) with the same interfaces the pilot will
back with PostgreSQL + a FHIR store. Role is passed as X-Role header in the
demo; production uses SMART on FHIR / OAuth2 + OIDC scopes.
"""
from __future__ import annotations

import copy
import os
import pathlib
import uuid
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException
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

app = FastAPI(title="MemBrain API", version=C.ENGINE_VERSION,
              description="Voice-first longitudinal brain-health check-in. Identifies risk and change; never diagnoses.")
# Only listed origins may call the API from a browser (GitHub Pages demo, local dev, the App Service itself).
ALLOWED_ORIGINS = [o.strip() for o in os.getenv(
    "ALLOWED_ORIGINS", "https://oluwapelumi-solagbade.github.io,http://localhost:8000,http://127.0.0.1:8000,"
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3100,http://127.0.0.1:3100").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["*"], allow_headers=["*"])

from api.speech import router as speech_router  # noqa: E402

app.include_router(speech_router)
from api.navai import router as navai_router  # noqa: E402

app.include_router(navai_router)
from api.asr_local import router as asr_router  # noqa: E402

app.include_router(asr_router)

DB: dict = {"participants": {}, "tasks": {}, "audit": []}
# Identity vault: direct identifiers live here ONLY, keyed by pseudonym.
# In production this is a separate encrypted store with its own keys and access policy.
VAULT: dict = {}


def audit(actor: str, action: str, target: str, detail: dict | None = None):
    DB["audit"].append({"ts": datetime.now(timezone.utc).isoformat(), "actor": actor, "action": action,
                        "target": target, "detail": detail or {}})


def role(x_role: str = Header("participant")) -> str:
    if x_role not in ("participant", "clinician", "coordinator"):
        raise HTTPException(403, "unknown role")
    return x_role


def need(r: str, *allowed: str):
    if r not in allowed:
        raise HTTPException(403, f"role '{r}' not permitted")


def _sync_tasks(p: dict, ev: dict):
    latest = ev["latest"]
    if latest and latest["level"] in ("CLINICIAN_REVIEW", "URGENT"):
        key = f"{p['id']}:{latest['session_id']}"
        if key not in DB["tasks"]:
            DB["tasks"][key] = {"id": key, "participant_id": p["id"], "level": latest["level"], "status": "open",
                                "created": latest["date"], "review_target_days": C.REVIEW_TARGET_DAYS[latest["level"]],
                                "reasons": latest["reasons"], "actions": []}


def _seed():
    DB["participants"].clear(); DB["tasks"].clear()
    for p in personas():
        DB["participants"][p["id"]] = p
        _sync_tasks(p, evaluate(p, p["sessions"]))


_seed()


class Identity(BaseModel):
    full_name: str
    national_id: str | None = None   # Emirates ID or MRN
    phone: str | None = None
    preferred_channel: str = Field("app", pattern="^(app|whatsapp|phone)$")


class Informant(BaseModel):
    name: str
    relation: str
    phone: str | None = None


class Enrol(BaseModel):
    identity: Identity | None = None
    informant: Informant | None = None
    enrolled_by: str = "coordinator"
    programme: str = "pilot"
    consent_version: str = "consent-ar-en-0.1"
    age: float = Field(ge=50, le=75)
    sex: str = "U"
    education: str = Field(pattern="^(none|primary|secondary|tertiary)$")
    language: str = Field(pattern="^(ar|en)$")
    dialect: str = "Emirati"
    consent: dict = Field(default_factory=dict)
    context: dict = Field(default_factory=dict)


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


@app.post("/participants")
def enrol(body: Enrol, r: str = Depends(role)):
    need(r, "coordinator", "clinician")
    pid = "MB-" + uuid.uuid4().hex[:6].upper()
    data = body.model_dump()
    ident, informant = data.pop("identity"), data.pop("informant")
    VAULT[pid] = {"identity": ident, "informant": informant}   # identifiers never enter the analytics record
    p = data | {"id": pid, "sessions": [], "has_informant": informant is not None,
                "enrolled_at": datetime.now(timezone.utc).isoformat()}
    DB["participants"][pid] = p
    audit(r, "enrol", pid, {"consent": body.consent, "consent_version": body.consent_version, "programme": body.programme})
    return {"id": pid, "first_form": form_for_session(0, participant_seed(pid)), "schedule": {"baseline_1": "today", "baseline_2": "+2 weeks", "follow_up": "+12 weeks"}}


@app.post("/participants/{pid}/reidentify")
def reidentify(pid: str, reason: dict, r: str = Depends(role)):
    """Break-glass re-identification for follow-up contact: clinician only, reason required, audited."""
    need(r, "clinician", "coordinator")
    if not reason.get("reason"):
        raise HTTPException(422, "a reason is required to re-identify")
    if pid not in VAULT:
        raise HTTPException(404, "no identity on file")
    audit(r, "reidentify", pid, {"reason": reason["reason"]})
    return VAULT[pid]


@app.patch("/participants/{pid}/consent")
def update_consent(pid: str, consent: dict, r: str = Depends(role)):
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
def submit_session(pid: str, body: SessionIn, r: str = Depends(role)):
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    idx = len(p["sessions"])
    s = body.model_dump()
    s["session_id"] = f"{pid}-s{idx}"
    s["form"] = form_for_session(idx, participant_seed(pid))
    if s.get("transcripts") and not s.get("raw"):
        scored = score_session_transcripts(s["transcripts"], s["form"], p["language"])
        s["raw"], s["scoring_detail"] = scored["raw"], scored["detail"]
    if not (p.get("consent") or {}).get("voice_features"):
        s["voice_features"] = None
    p["sessions"].append(s)
    ev = evaluate(p, p["sessions"])
    _sync_tasks(p, ev)
    audit(r, "session_submitted", pid, {"session_id": s["session_id"], "level": ev["latest"]["level"]})
    msg = participant_message(ev["latest"], p["language"])
    out = {"session_id": s["session_id"], "message": msg, "next_form": form_for_session(idx + 1, participant_seed(pid))}
    if ev["latest"]["level"] in ("BASELINE", "STABLE"):
        out["prevention"] = prevention_plan({**p.get("context", {}), "mood_positive": (body.phq2 or 0) >= 3}, p["language"])
    return out  # held results: participant sees only the message; details go to clinician


@app.get("/participants")
def list_participants(r: str = Depends(role)):
    need(r, "clinician", "coordinator")
    out = []
    for p in DB["participants"].values():
        ev = evaluate(p, p["sessions"]) if p["sessions"] else {"latest": None}
        out.append({"id": p["id"], "age": p["age"], "education": p["education"], "dialect": p.get("dialect"),
                    "sessions": len(p["sessions"]), "level": ev["latest"]["level"] if ev["latest"] else "ENROLLED"})
    return sorted(out, key=lambda x: -LEVELS.index(x["level"]) if x["level"] in LEVELS else 0)


@app.get("/participants/{pid}/evaluation")
def get_eval(pid: str, r: str = Depends(role)):
    need(r, "clinician")
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    audit(r, "view_evaluation", pid)
    return evaluate(p, p["sessions"])


@app.get("/participants/{pid}/dossier")
def dossier(pid: str, r: str = Depends(role)):
    need(r, "clinician")
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    audit(r, "view_dossier", pid)
    return build_dossier(p, evaluate(p, p["sessions"]))


@app.get("/participants/{pid}/fhir")
def fhir_bundle(pid: str, r: str = Depends(role)):
    need(r, "clinician")
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    ev = evaluate(p, p["sessions"])
    audit(r, "export_fhir", pid)
    return bundle(p, p["sessions"], ev["history"])


@app.get("/queue")
def queue(r: str = Depends(role)):
    need(r, "clinician")
    ts = [t for t in DB["tasks"].values() if t["status"] == "open"]
    return sorted(ts, key=lambda t: (-LEVELS.index(t["level"]), t["created"]))


@app.post("/tasks/{task_id}/action")
def task_action(task_id: str, body: Action, r: str = Depends(role)):
    need(r, "clinician")
    t = DB["tasks"].get(task_id)
    if not t:
        raise HTTPException(404)
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


@app.get("/audit")
def get_audit(r: str = Depends(role)):
    need(r, "clinician", "coordinator")
    return copy.deepcopy(DB["audit"][-200:])


@app.post("/demo/reset")
def reset():
    _seed()
    return {"ok": True, "participants": len(DB["participants"])}


# ------------------------------------------------------------- Navigator
@app.get("/directory")
def get_directory():
    return NAV.directory()


@app.get("/participants/{pid}/services")
def services_for(pid: str, pathway: str, r: str = Depends(role)):
    need(r, "clinician", "coordinator")
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    return NAV.match_services(pathway, p)


@app.post("/participants/{pid}/referrals")
def create_referral(pid: str, body: ReferralIn, r: str = Depends(role)):
    need(r, "clinician")
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    if body.pathway not in NAV.PATHWAYS:
        raise HTTPException(422, "unknown pathway")
    refs = p.setdefault("referrals", [])
    ref = NAV.new_referral(f"REF-{pid}-{len(refs)}", pid, body.pathway, body.service_id, body.urgency, body.date, body.reason,
                           entry_route=p.get("entry_route", "programme"))
    refs.append(ref)
    audit(r, "referral_recommended", pid, {"pathway": body.pathway, "service": body.service_id})
    return ref


@app.post("/referrals/{rid}/status")
def referral_status(rid: str, body: ReferralStatus, r: str = Depends(role)):
    need(r, "clinician", "coordinator")
    for p in DB["participants"].values():
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
def list_referrals(unresolved_only: bool = False, r: str = Depends(role)):
    need(r, "clinician", "coordinator")
    out = [ref for p in DB["participants"].values() for ref in p.get("referrals", [])]
    return [x for x in out if NAV.is_unresolved(x)] if unresolved_only else out


@app.get("/referrals/{rid}/next-steps")
def next_steps(rid: str, lang: str = "en", r: str = Depends(role)):
    need(r, "clinician", "coordinator")
    svc = {s["id"]: s for s in NAV.directory()}
    for p in DB["participants"].values():
        for ref in p.get("referrals", []):
            if ref["id"] == rid:
                return NAV.next_steps_pack(ref, svc.get(ref.get("service_id")), lang)
    raise HTTPException(404)


@app.get("/programme/metrics")
def metrics(r: str = Depends(role)):
    need(r, "clinician", "coordinator")
    refs = [ref for p in DB["participants"].values() for ref in p.get("referrals", [])]
    people = {p["id"]: {"language": p.get("language"), "funding": p.get("funding"), "sex": p.get("sex"), "age_band": p.get("age_band")}
              for p in DB["participants"].values()}
    return NAV.programme_metrics(refs, people)




# ------------------------------------------------------------- Genomics (consent-gated)
from membrain import genomics as GX  # noqa: E402


@app.get("/participants/{pid}/genomics")
def get_genomics(pid: str, r: str = Depends(role)):
    need(r, "clinician")
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    audit(r, "view_genomics", pid)
    return GX.genomic_context(p)


@app.post("/participants/{pid}/genomics/counselling")
def genomics_counselling(pid: str, body: dict, r: str = Depends(role)):
    need(r, "clinician")
    p = DB["participants"].get(pid)
    if not p or not p.get("genomics"):
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
    return DB["tasks"].get(f"{p['id']}:{latest['session_id']}") if latest else None


def _case(p: dict, full: bool = False) -> dict:
    ev = evaluate(p, p["sessions"]) if p["sessions"] else {"latest": None, "history": []}
    ctx = p.get("context") or {}
    out = {"participant": p, "history": ev["history"], "latest": ev["latest"], "task": _task_for(p, ev["latest"]),
           "concern": concern_summary(p), "risk_context": risk_context(ctx) if ctx else None,
           "prevention": prevention_plan(ctx, p.get("language") or "en") if ctx else None}
    if full:
        out["dossier"] = build_dossier(p, ev)
    return out


@app.get("/cases")
def list_cases(r: str = Depends(role)):
    need(r, "clinician", "coordinator")
    return [_case(p) for p in DB["participants"].values()]


@app.get("/cases/{pid}")
def get_case(pid: str, r: str = Depends(role)):
    need(r, "clinician", "coordinator")
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    audit(r, "view_case", pid)
    return _case(p, full=True)


class ConcernIn(BaseModel):
    """A concern confirmed by whoever raised it in the chat. Only the confirmed facts are stored."""
    reporter: str = Field(pattern="^(self|family|helper|professional|coordinator)$")   # config.REPORTER_LABEL keys
    lang: str = Field(pattern="^(ar|en)$")
    narrative: str = Field(min_length=3, max_length=4000)
    domains: list[str] = Field(default_factory=list)
    onset: str | None = None
    timeline: list[list[str]] = Field(default_factory=list)   # [activity, who took over]
    red_flags: list[str] = Field(default_factory=list)
    confounders: list[str] = Field(default_factory=list)
    date: str


# Who raised the concern -> the navigator's entry route (as web/app.js does at enrolment).
ENTRY_ROUTE = {"self": "self", "family": "family", "helper": "household_helper", "professional": "primary_care", "coordinator": "programme"}


@app.post("/concerns")
def raise_concern(body: ConcernIn):
    """Anyone can raise a concern. It becomes a pseudonymous record with an intake session, triaged by the engine;
    a significant concern opens a clinician task straight away. No identifiers are taken here."""
    pid = "MB-C" + uuid.uuid4().hex[:4].upper()
    acts = sorted({a for a, _ in body.timeline})
    p = {"id": pid, "display_name": {"en": "New concern", "ar": "قلق جديد"}, "age": None, "education": None, "sex": "U",
         "dialect": None, "language": body.lang, "languages": [body.lang], "entry_route": ENTRY_ROUTE[body.reporter], "context": {},
         "consent": {}, "referrals": [], "enrolled": False,
         "intake": {"reporter": body.reporter, "at": body.date,
                    "confirmed": {"narrative": body.narrative, "domains": body.domains, "onset": body.onset,
                                  "timeline": body.timeline, "red_flags": body.red_flags, "confounders": body.confounders}},
         "sessions": [{"session_id": f"{pid}-intake", "date": body.date, "type": "intake", "channel": "app",
                       "concern": body.narrative, "onset": body.onset, "red_flags": body.red_flags,
                       "reported_concern": {"reporter": body.reporter, "domains": body.domains, "activities_taken_over": acts}}]}
    DB["participants"][pid] = p
    _sync_tasks(p, evaluate(p, p["sessions"]))
    audit("public", "concern_raised", pid, {"reporter": body.reporter, "red_flags": body.red_flags, "activities": acts})
    return _case(p)


# ------------------------------------------------------------- web app (keep LAST: the mount catches every unmatched path)
# Serve the built site at "/" so one in-country App Service hosts both the API and the front end (same origin:
# microphone and speech work over HTTPS). The new site (site/out) wins; it carries the old prototype at /prototype/.
_ROOT = pathlib.Path(__file__).resolve().parents[1]
_DIST = next((d for d in (_ROOT / "site" / "out", _ROOT / "web" / "dist") if (d / "index.html").exists()), None)
if _DIST:
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=str(_DIST), html=True), name="web")
