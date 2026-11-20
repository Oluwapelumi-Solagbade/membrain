"""The referral letter has every section a memory service expects, filled only from the record."""
from fastapi.testclient import TestClient

from api.main import DB, app
from membrain.dossier import build_dossier
from membrain.letter import build
from membrain.triage import evaluate

c = TestClient(app)
SECTIONS = ["REFERRAL FOR SPECIALIST MEMORY ASSESSMENT", "PATIENT DETAILS", "REASON FOR REFERRAL", "HISTORY OF THE PRESENTING CONCERN",
            "EVERYDAY FUNCTION (INSTRUMENTAL ACTIVITIES)", "SAFETY AND URGENT SIGNS", "COGNITIVE SCREENING RESULTS",
            "MOOD, SLEEP AND OTHER FACTORS", "PHYSICAL HEALTH AND RISK FACTORS", "CURRENT MEDICINES",
            "INVESTIGATIONS TO COMPLETE (REVERSIBLE CAUSES)", "CONSENT AND INFORMATION SHARING", "REQUESTED FROM THE SERVICE",
            "NOTES", "REFERRING CLINICIAN"]


def _letter(pid, **kw):
    p = DB["participants"][pid]
    ev = evaluate(p, p["sessions"])
    return build(p, ev, build_dossier(p, ev), **kw)


def test_every_standard_section_is_there_and_filled_from_the_record():
    lt = _letter("MB-1322")
    assert [s["title"] for s in lt["sections"]] == SECTIONS
    t = lt["text"]
    assert "Urgency: URGENT" in t and "IQCODE-16 (informant), 24 May 2026: 3.72" in t
    assert "Delayed word recall: 7.0 at baseline, 3 now (reliable decline)" in t
    assert "Blood pressure: 138/84 mmHg" in t and "Driving" in t
    assert "Not recorded in MemBrain" in t                     # medicines are not guessed
    assert "No diagnosis has been made." in t and "not a diagnosis" in t
    assert "apoe" not in t.lower()                             # genomic results stay out of the letter


def test_medgemmas_checked_sentences_become_the_reason_for_referral():
    lt = _letter("MB-1187", reason=["A healthcare professional reports changes in memory.", "No diagnosis has been made."])
    reason = next(s for s in lt["sections"] if s["title"] == "REASON FOR REFERRAL")
    assert reason["lines"] == ["A healthcare professional reports changes in memory.", "No diagnosis has been made."]


def test_the_draft_endpoint_returns_the_full_letter():
    tok = c.post("/auth/clinician/login", json={"email": "dr.demo@membrain.ae", "password": "membrain-demo-2026"}).json()["token"]
    j = c.post("/api/referral/draft/MB-1322", headers={"Authorization": "Bearer " + tok}).json()
    assert j["letter"].startswith("REFERRAL FOR SPECIALIST MEMORY ASSESSMENT") and "From: Dr. Demo" in j["letter"]
    assert len(j["sections"]) == len(SECTIONS)
