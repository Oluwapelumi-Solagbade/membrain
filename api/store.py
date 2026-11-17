"""Keeps what real visitors do in the demo: concerns, check-ins, family questionnaires, clinician actions and referrals.

The synthetic people are rebuilt from code at every start; everything added while the server runs ("live" data) used to
live only in memory and was lost at each restart or deploy. This module saves the live part as one JSON snapshot:

  * always to a local file (DATA_DIR, default /tmp/membrain-live), and
  * if STORE_REPO is set (e.g. "Vulcan-Spark/membrain-live-data"), to that PRIVATE Hugging Face dataset, written with
    STORE_TOKEN (a fine-grained token with write access to that dataset only). The Space's disk is wiped on restart,
    so the dataset is what makes the data permanent.

What is saved: records created at runtime (whole), check-ins / reports / referrals added to synthetic people, tasks that
were created or acted on at runtime, and the audit log. What is NOT saved: the identity vault (names, IDs, phone
numbers) and sign-in sessions. Saving runs in a background thread every STORE_SYNC_S seconds when something changed,
so requests are never slowed down. Nothing here diagnoses or scores; it only keeps records.
"""
from __future__ import annotations

import copy
import json
import logging
import os
import pathlib
import threading
import time
from datetime import datetime, timezone

log = logging.getLogger("membrain.store")

VERSION = 1
PATH_IN_REPO = "live/snapshot.json"
SYNC_S = float(os.getenv("STORE_SYNC_S", "20"))
AUDIT_CAP = int(os.getenv("STORE_AUDIT_CAP", "20000"))

_lock = threading.Lock()
_dirty = threading.Event()
_state: dict = {"db": None, "seed": None, "loaded_from": None, "last_saved": None, "last_error": None, "thread": None}


def _repo() -> str | None:
    return os.getenv("STORE_REPO") or None


def _token() -> str | None:
    return os.getenv("STORE_TOKEN") or None


def _local_path() -> pathlib.Path | None:
    """Off unless configured (DATA_DIR, or STORE_REPO which implies a local copy too): tests and local runs stay in memory."""
    if not (os.getenv("DATA_DIR") or _repo()):
        return None
    d = pathlib.Path(os.getenv("DATA_DIR", "/tmp/membrain-live"))
    d.mkdir(parents=True, exist_ok=True)
    return d / "snapshot.json"


def enabled() -> bool:
    return _local_path() is not None and os.getenv("STORE_DISABLED") != "1"


# ---------------------------------------------------------------- what counts as live
def remember_seed(db: dict) -> None:
    """Call right after the synthetic people are loaded: what exists now is synthetic, everything added later is live."""
    _state["db"] = db
    _state["seed"] = {
        "participants": {pid: {"sessions": len(p.get("sessions", [])), "referrals": len(p.get("referrals", []))}
                         for pid, p in db["participants"].items()},
        "tasks": set(db["tasks"]),
    }


def seed_counts() -> dict:
    return (_state["seed"] or {}).get("participants", {})


def is_seed(pid: str) -> bool:
    return pid in seed_counts()


def live_sessions(p: dict) -> list[dict]:
    """The sessions (check-ins, concerns, questionnaires) added at runtime to this record."""
    return p.get("sessions", [])[seed_counts().get(p["id"], {}).get("sessions", 0):]


def snapshot(db: dict) -> dict:
    seed = _state["seed"] or {"participants": {}, "tasks": set()}
    people, extra = {}, {}
    for pid, p in db["participants"].items():
        if pid not in seed["participants"]:
            people[pid] = p
        else:
            n_s, n_r = seed["participants"][pid]["sessions"], seed["participants"][pid]["referrals"]
            add_s, add_r = p.get("sessions", [])[n_s:], p.get("referrals", [])[n_r:]
            if add_s or add_r:
                extra[pid] = {"sessions": add_s, "referrals": add_r}
    tasks = {k: t for k, t in db["tasks"].items() if k not in seed["tasks"] or t.get("actions")}
    return {"version": VERSION, "saved_at": datetime.now(timezone.utc).isoformat(), "participants": people,
            "added_to_synthetic": extra, "tasks": tasks, "audit": db["audit"][-AUDIT_CAP:]}


def merge(db: dict, snap: dict) -> dict:
    """Put a saved snapshot back on top of freshly seeded synthetic data."""
    if not snap or snap.get("version") != VERSION:
        return {"participants": 0, "sessions": 0}
    n_s = 0
    for pid, p in (snap.get("participants") or {}).items():
        db["participants"][pid] = p
        n_s += len(p.get("sessions", []))
    for pid, add in (snap.get("added_to_synthetic") or {}).items():
        p = db["participants"].get(pid)
        if not p:
            continue
        p.setdefault("sessions", []).extend(add.get("sessions", []))
        p.setdefault("referrals", []).extend(add.get("referrals", []))
        n_s += len(add.get("sessions", []))
    db["tasks"].update(snap.get("tasks") or {})
    seen = {(a.get("ts"), a.get("action"), a.get("target")) for a in db["audit"]}
    db["audit"][:0] = [a for a in (snap.get("audit") or []) if (a.get("ts"), a.get("action"), a.get("target")) not in seen]
    return {"participants": len(snap.get("participants") or {}), "sessions": n_s}


# ---------------------------------------------------------------- load and save
def _read_remote() -> dict | None:
    if not _repo():
        return None
    from huggingface_hub import hf_hub_download
    try:
        f = hf_hub_download(_repo(), PATH_IN_REPO, repo_type="dataset", token=_token() or os.getenv("HF_TOKEN"),
                            force_download=True)
        return json.loads(pathlib.Path(f).read_text("utf-8"))
    except Exception as e:  # first run (no file yet), no access, network: start empty and say why
        name = type(e).__name__
        if name not in ("EntryNotFoundError", "RemoteEntryNotFoundError"):
            _state["last_error"] = f"load: {name}"
            log.warning("live store: could not load %s (%s)", _repo(), name)
        return None


def load_into(db: dict) -> dict:
    """At start-up: the remote dataset wins (it survives restarts); the local file is the fallback."""
    snap = _read_remote()
    src = f"dataset {_repo()}" if snap else None
    if snap is None and _local_path() and _local_path().exists():
        try:
            snap, src = json.loads(_local_path().read_text("utf-8")), "local file"
        except Exception:
            snap = None
    out = merge(db, snap) if snap else {"participants": 0, "sessions": 0}
    _state["loaded_from"] = src
    log.info("live store: loaded %s from %s", out, src or "nothing (fresh start)")
    return out


def _save_now() -> None:
    db = _state["db"]
    if db is None:
        return
    with _lock:
        data = json.dumps(copy.deepcopy(snapshot(db)), ensure_ascii=False, default=str).encode("utf-8")
    if _local_path():
        _local_path().write_bytes(data)
    if _repo() and _token():
        from huggingface_hub import HfApi
        api = HfApi(token=_token())
        try:
            api.create_repo(_repo(), repo_type="dataset", private=True, exist_ok=True)
        except Exception:   # a token scoped to one existing dataset may not create repos; uploading still works
            pass
        api.upload_file(path_or_fileobj=data, path_in_repo=PATH_IN_REPO, repo_id=_repo(), repo_type="dataset",
                        commit_message="Live demo data snapshot")
    _state["last_saved"] = datetime.now(timezone.utc).isoformat()
    _state["last_error"] = None


def mark_dirty() -> None:
    _dirty.set()


def _loop() -> None:
    while True:
        _dirty.wait()
        time.sleep(SYNC_S)          # collect a burst of changes into one save
        _dirty.clear()
        try:
            _save_now()
        except Exception as e:      # keep serving; try again on the next change
            _state["last_error"] = f"save: {type(e).__name__}"
            log.warning("live store: save failed (%s)", type(e).__name__)
            _dirty.set()
            time.sleep(SYNC_S * 3)


def start() -> None:
    if _state["thread"] is None and enabled():
        t = threading.Thread(target=_loop, name="live-store", daemon=True)
        t.start()
        _state["thread"] = t


def status() -> dict:
    return {"enabled": enabled(), "permanent": bool(_repo() and _token()), "repo": _repo(), "loaded_from": _state["loaded_from"],
            "last_saved": _state["last_saved"], "last_error": _state["last_error"], "pending": _dirty.is_set()}
