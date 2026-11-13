"""MemBrain pilot API (FastAPI).

Demo-grade persistence (in-memory) with the same interfaces the pilot will
back with PostgreSQL + a FHIR store. Role is passed as X-Role header in the
demo; production uses SMART on FHIR / OAuth2 + OIDC scopes.
"""
from __future__ import annotations

import copy
import uuid
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from membrain import config as C
from membrain.dossier import build_dossier
from membrain.fhir import bundle
from membrain.items import FLUENCY, FORMS, JUDGEMENT, STORIES, WORD_LISTS, form_for_session
from membrain.personas import personas
from membrain.prevention import participant_message, prevention_plan
from membrain.scoring import score_session_transcripts
from membrain.triage import LEVELS, evaluate

app = FastAPI(title="MemBrain API", version=C.ENGINE_VERSION,
              description="Voice-first longitudinal brain-health check-in. Identifies risk and change; never diagnoses.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DB: dict = {"participants": {}, "tasks": {}, "audit": []}


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


class Enrol(BaseModel):
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
    p = body.model_dump() | {"id": pid, "sessions": []}
    DB["participants"][pid] = p
    audit(r, "enrol", pid, {"consent": body.consent})
    return {"id": pid}


@app.patch("/participants/{pid}/consent")
def update_consent(pid: str, consent: dict, r: str = Depends(role)):
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    p["consent"] = {**p.get("consent", {}), **consent}
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
    s["form"] = form_for_session(idx, hash(pid) % 3)
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
    out = {"session_id": s["session_id"], "message": msg, "next_form": form_for_session(idx + 1, hash(pid) % 3)}
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
