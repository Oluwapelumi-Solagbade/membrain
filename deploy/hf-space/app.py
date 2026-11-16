"""Hugging Face Space entry point (free Gradio SDK): runs the MemBrain API + site + Gulf Whisper dictation on port 7860.

GitHub Actions (.github/workflows/hf-space.yml) uploads the code and the built site here on every push to main.
Space settings needed: secret HF_TOKEN (a READ token, to fetch the private Whisper model). Nothing else."""
import os

# Free Gradio Spaces now run on ZeroGPU, which refuses to start unless the app declares at least one GPU function.
# Our speech model runs fine on the CPU (about 0.2x real time), so this one only satisfies that check.
# `spaces` must be imported before anything that touches CUDA.
try:
    import spaces

    @spaces.GPU
    def gpu_ready() -> bool:
        return True
except ImportError:   # not on ZeroGPU (CPU Space, local run)
    spaces = None

os.environ.setdefault("WHISPER_MODEL", "Vulcan-Spark/membrain-whisper-gulf-ct2")
os.environ.setdefault("SERVER_IN_UAE", "0")   # this demo host is not in the UAE: the site words its privacy notes so

import gradio as gr
import uvicorn

from api.main import app

with gr.Blocks(title="MemBrain status") as status:
    gr.Markdown("MemBrain demo server is running. The app itself is at the Space's main address (/).")

app = gr.mount_gradio_app(app, status, path="/status")
# The site is mounted at "/" and catches every path, so keep it last (after /status).
web = [r for r in app.router.routes if getattr(r, "name", "") == "web"]
for r in web:
    app.router.routes.remove(r)
    app.router.routes.append(r)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "7860")))
