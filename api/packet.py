"""Clinician review packet endpoint (membrain/packet.py). Med42 writes it when switched on (api/med42.py); otherwise,
or if its answer fails the checks, the rules build it. Clinicians and coordinators only; rate-limited; audited."""
from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException

from api import med42
from api.auth import Principal, principal
from membrain import packet as PK

router = APIRouter(tags=["review-packet"])
_HITS: list[float] = []
PER_MIN = 4


@router.get("/review-packet/engine")
def engine(who: Principal = Depends(principal)):
    st = dict(med42.status)
    if who.role not in ("clinician", "coordinator"):
        st.pop("last_raw", None)   # Med42's last answer is for staff only
    return {"med42": st, "remote": bool(__import__("os").getenv("MED42_URL")), "available": med42.available()}


@router.post("/participants/{pid}/review-packet")
def review_packet(pid: str, use_model: bool = True, who: Principal = Depends(principal)):
    if who.role not in ("clinician", "coordinator"):
        raise HTTPException(401 if who.role == "anonymous" else 403, "Please sign in as a clinician.")
    from api.main import DB, audit
    from membrain.dossier import build_dossier
    from membrain.triage import evaluate
    p = DB["participants"].get(pid)
    if not p:
        raise HTTPException(404)
    ev = evaluate(p, p["sessions"]) if p.get("sessions") else {"history": [], "latest": None}
    fs = PK.facts(p, ev, build_dossier(p, ev))
    rules = PK.rules_packet(fs, build_dossier(p, ev))
    out = {**rules, "engine": "rules", "facts": fs, "kept": None, "removed": 0, "latency_ms": None, "fallback_reason": None}
    if use_model and med42.available():
        now = time.time()
        _HITS[:] = [t for t in _HITS if now - t < 60]
        if len(_HITS) >= PER_MIN:
            out["fallback_reason"] = "Med42 is busy; built by the rules"
        else:
            _HITS.append(now)
            t = time.perf_counter()
            raw = med42.complete(PK.messages(fs))
            out["latency_ms"] = round((time.perf_counter() - t) * 1000)
            model, kept, removed = PK.verify(raw, fs) if raw else (None, 0, 0)
            if model:
                out.update(PK.merge(model, rules), engine=med42.name(), kept=kept, removed=removed)
            else:
                out.update(removed=removed, fallback_reason="Med42 unavailable" if raw is None else "Med42's answer failed the checks; built by the rules")
    elif use_model:
        out["fallback_reason"] = "Med42 is switched off; built by the rules"
    audit(who.actor, "review_packet_drafted", pid, {"engine": out["engine"], "kept": out["kept"], "removed": out["removed"],
                                                    "latency_ms": out["latency_ms"], "checks": [r["check"] for r in out["rule_out"]]})
    return out
