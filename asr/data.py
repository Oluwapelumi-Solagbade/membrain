"""Dataset loaders. All sources are open-licensed; check each licence again before redistribution.

| Source | Licence | Use |
|---|---|---|
| eabayed/EmiratiDialictShowsAudioTranscription (Emirati TV/podcasts, 443 clips) | AFL-3.0 | Emirati fine-tune + held-out test, split BY CATEGORY |
| otozz/gulf_train_set / gulf_test_set (MASC Gulf partition, Whisper-small features) | CC-BY-4.0 | Gulf fine-tune / test |
| Team recordings (consented, MemBrain task words) | team consent forms | Task-specific test only |
"""
from __future__ import annotations

import csv
import io
import zipfile
from pathlib import Path

import numpy as np

SR = 16000
# Category-level split: test categories are never seen in training (no speaker/show leakage).
EMIRATI_TEST_CATEGORIES = {"health", "police"}


def _load_audio(data: bytes | str) -> np.ndarray:
    import librosa
    import soundfile as sf
    if isinstance(data, (bytes, bytearray)):
        wav, sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=False)
    else:
        wav, sr = sf.read(data, dtype="float32", always_2d=False)
    if wav.ndim > 1:
        wav = wav.mean(axis=1)
    return librosa.resample(wav, orig_sr=sr, target_sr=SR) if sr != SR else wav


def emirati_shows(root: str | Path) -> dict[str, list[dict]]:
    """root contains audiofiles.zip and transcriptions.tsv from the HF dataset repo."""
    root = Path(root)
    zf = zipfile.ZipFile(root / "audiofiles.zip")
    names = {Path(n).stem.replace(" ", "").lower(): n for n in zf.namelist() if n.lower().endswith(".wav")}
    out = {"train": [], "test": []}
    with open(root / "transcriptions.tsv", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            fid = (row.get("audiofilename") or "").replace(" wav", "").replace(".wav", "").strip()
            text = (row.get("transcription") or "").strip()
            key = fid.replace(" ", "").lower()
            if not fid or not text or key not in names:
                continue
            cat = fid.split("_")[0].lower()
            item = {"id": fid, "audio": _load_audio(zf.read(names[key])), "text": text, "dialect": "Emirati",
                    "category": cat, "source": "emirati_shows"}
            out["test" if cat in EMIRATI_TEST_CATEGORIES else "train"].append(item)
    return out


def team_recordings(folder: str | Path) -> list[dict]:
    """folder/metadata.csv with columns: file,text,dialect,age_band,education,speaker_id,consent_id"""
    folder = Path(folder)
    rows = []
    with open(folder / "metadata.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if not r.get("consent_id"):
                continue  # never use a recording without a consent record
            rows.append({**r, "id": r["file"], "audio": _load_audio(str(folder / r["file"])), "source": "team"})
    return rows


def masc_gulf(split: str = "train", limit: int | None = None):
    """Pre-computed Whisper-small log-mel features + labels (MASC Gulf, CC-BY-4.0). Streams from the Hub."""
    from datasets import load_dataset
    name = "otozz/gulf_train_set" if split == "train" else "otozz/gulf_test_set"
    ds = load_dataset(name, split="train", streaming=True)
    for i, ex in enumerate(ds):
        if limit and i >= limit:
            break
        yield {"input_features": np.asarray(ex["input_features"], dtype=np.float32), "labels": ex["labels"], "source": "masc_gulf"}
