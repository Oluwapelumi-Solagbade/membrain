"""Hugging Face Space entry point (free Gradio SDK): runs the MemBrain API + site + Gulf Whisper dictation on port 7860.

GitHub Actions (.github/workflows/hf-space.yml) uploads the code and the built site here on every push to main.
Space settings needed: secret HF_TOKEN (a READ token, to fetch the private Whisper model). Nothing else."""
import os

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
