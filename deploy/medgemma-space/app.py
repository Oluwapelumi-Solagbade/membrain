"""MedGemma for MemBrain: a small, separate Hugging Face Space (free ZeroGPU) that drafts referral letters.

It answers POST /v1/chat/completions in the OpenAI format, which the main MemBrain server already speaks
(api/navai.py, MEDGEMMA_URL). It is kept apart from the main demo Space on purpose: the 8 GB model makes start-up slow,
and when the free GPU allowance runs out only drafting falls back to the rules template; the demo keeps working.

Space secrets: HF_TOKEN (a READ token of an account that accepted MedGemma's terms on Hugging Face) and MEDGEMMA_KEY
(any long random string; the main Space sends the same value). Requests without the key are refused, so strangers
cannot spend the GPU allowance. The server receives only confirmed facts (no names, no free text) and keeps nothing.
FAKE_MODEL=1 runs the web layer without a GPU or the model, for local tests.
"""
import hmac
import os
import threading
import time
import uuid

FAKE = os.getenv("FAKE_MODEL") == "1"
ON_ZERO_GPU = os.getenv("SPACES_ZERO_GPU", "").lower() in ("1", "true", "yes")
MODEL_ID = os.getenv("MEDGEMMA_MODEL", "google/medgemma-4b-it")
MAX_NEW = int(os.getenv("MAX_NEW_TOKENS", "400"))

if ON_ZERO_GPU:
    import spaces   # must come before torch on ZeroGPU

if not FAKE:
    import torch
    from transformers import AutoModelForImageTextToText, AutoProcessor

    tok = os.getenv("HF_TOKEN")
    proc = AutoProcessor.from_pretrained(MODEL_ID, token=tok)
    try:
        model = AutoModelForImageTextToText.from_pretrained(MODEL_ID, dtype=torch.bfloat16, token=tok)
    except TypeError:   # transformers older than 4.56 call it torch_dtype
        model = AutoModelForImageTextToText.from_pretrained(MODEL_ID, torch_dtype=torch.bfloat16, token=tok)
    model.eval()
    if ON_ZERO_GPU or torch.cuda.is_available():
        model.to("cuda")   # on ZeroGPU this is packed at start-up and attached when a GPU task runs

    def _generate(ids: "torch.Tensor", mask: "torch.Tensor", max_new: int) -> str:
        ids, mask = ids.to(model.device), mask.to(model.device)
        with torch.inference_mode():
            out = model.generate(input_ids=ids, attention_mask=mask, max_new_tokens=max_new, do_sample=False)
        return proc.tokenizer.decode(out[0][ids.shape[-1]:], skip_special_tokens=True)

    if ON_ZERO_GPU:
        _generate = spaces.GPU(duration=int(os.getenv("GPU_SECONDS", "60")))(_generate)

    def complete(messages: list[dict], max_new: int) -> str:
        # Gemma chat templates take content as a list of parts (the cluster evaluation used the same code).
        msgs = [{"role": m["role"], "content": [{"type": "text", "text": str(m.get("content", ""))}]} for m in messages]
        prompt = proc.apply_chat_template(msgs, add_generation_prompt=True, tokenize=False)
        enc = proc.tokenizer(prompt, add_special_tokens=False, return_tensors="pt")
        return _generate(enc["input_ids"], enc["attention_mask"], max_new)
else:
    def complete(messages: list[dict], max_new: int) -> str:
        return "A family member reports changes in memory. No diagnosis has been made."

from fastapi import FastAPI, Header, HTTPException  # noqa: E402
from pydantic import BaseModel  # noqa: E402

app = FastAPI(title="MemBrain MedGemma", docs_url=None, redoc_url=None)
_one_at_a_time = threading.Lock()


class Msg(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    model: str | None = None
    messages: list[Msg]
    max_tokens: int | None = None
    temperature: float | None = None


@app.get("/")
def home():
    return {"service": "MemBrain MedGemma drafting", "model": MODEL_ID, "fake": FAKE,
            "use": "POST /v1/chat/completions with the MemBrain key; drafts are checked by MemBrain's verifier before anyone sees them"}


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/v1/chat/completions")
def chat(body: ChatIn, authorization: str = Header(default="")):
    key = os.getenv("MEDGEMMA_KEY", "")
    if not key or not hmac.compare_digest(authorization, f"Bearer {key}"):
        raise HTTPException(401, "MemBrain key required")
    if not body.messages or len(body.messages) > 8 or sum(len(m.content) for m in body.messages) > 6000:
        raise HTTPException(422, "Request too large")
    max_new = max(16, min(int(body.max_tokens or MAX_NEW), MAX_NEW))
    t = time.perf_counter()
    with _one_at_a_time:
        try:
            text = complete([m.model_dump() for m in body.messages], max_new)
        except Exception as e:   # GPU allowance used up, queue timeout...: MemBrain falls back to its template
            raise HTTPException(503, f"MedGemma unavailable: {type(e).__name__}")
    return {"id": "chatcmpl-" + uuid.uuid4().hex[:12], "object": "chat.completion", "model": MODEL_ID,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
            "latency_ms": round((time.perf_counter() - t) * 1000)}


if __name__ == "__main__":
    import uvicorn
    if ON_ZERO_GPU:
        import spaces.zero as zero
        (getattr(zero, "zerogpu_startup", None) or zero.startup)()   # tell ZeroGPU we are up (same as the main Space)
        print("ZeroGPU startup reported", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "7860")))
