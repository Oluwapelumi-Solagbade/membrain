"""Hugging Face Space entry point (free Gradio SDK on ZeroGPU): runs the MemBrain API + site + Gulf Whisper dictation
on port 7860.

GitHub Actions (.github/workflows/hf-space.yml) uploads the code and the built site here on every push to main.
Space settings needed: secret HF_TOKEN (a READ token, to fetch the private Whisper model). Nothing else."""
import os

# Free Gradio Spaces now run on ZeroGPU. It refuses to start unless the app (1) declares a GPU function and
# (2) reports "startup" to the ZeroGPU service. Our speech model runs fine on the CPU (about 0.2x real time), so the
# GPU function only satisfies that check. `spaces` must be imported before anything that touches CUDA.
ON_ZERO_GPU = os.getenv("SPACES_ZERO_GPU", "").lower() in ("1", "true", "yes")
if ON_ZERO_GPU:
    import spaces

    @spaces.GPU
    def gpu_ready() -> bool:
        return True

os.environ.setdefault("WHISPER_MODEL", "Vulcan-Spark/membrain-whisper-gulf-ct2")
os.environ.setdefault("ASR_PREFER_LOCAL", "1")   # spoken check-in uses our Gulf Whisper, not the browser
os.environ.setdefault("SERVER_IN_UAE", "0")   # this demo host is not in the UAE: the site words its privacy notes so
# Live demo data is saved to this PRIVATE dataset (api/store.py) when the Space has a STORE_TOKEN secret
# (fine-grained, write access to that dataset only). Without the secret, data stays in memory as before.
os.environ.setdefault("STORE_REPO", "Vulcan-Spark/membrain-live-data")
# MedGemma drafts referral letters from a separate Space (deploy/medgemma-space) when this Space has a MEDGEMMA_KEY
# secret (the same value as that Space's). It is used for drafting only, never for intake, where it failed our tests.
if os.getenv("MEDGEMMA_KEY"):
    os.environ.setdefault("MEDGEMMA_URL", "https://vulcan-spark-membrain-medgemma.hf.space")
    os.environ.setdefault("MEDGEMMA_MODEL", "MedGemma 4B")
    os.environ.setdefault("MEDGEMMA_TASKS", "draft")

import uvicorn

from api.main import app

if __name__ == "__main__":
    if ON_ZERO_GPU:
        import spaces.zero as zero
        (getattr(zero, "zerogpu_startup", None) or zero.startup)()   # tell ZeroGPU we are up (name differs by version)
        print("ZeroGPU startup reported", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "7860")))
