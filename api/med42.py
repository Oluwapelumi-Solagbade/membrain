"""Med42-v2-8B (M42, Abu Dhabi) as the optional author of the clinician review packet. OFF by default.

Switched on in one of two ways, never both needed:
- MED42_IN_SPACE=1 on the Hugging Face Space: loads m42-health/Llama3-Med42-8B on ZeroGPU at start-up (as MedGemma
  does). The account behind HF_TOKEN must first accept the model's licence on its Hugging Face page.
- MED42_URL (+ MED42_KEY): any OpenAI-compatible endpoint serving it, e.g. vLLM or Azure ML in UAE North.
If neither is set, or loading or a call fails, the review packet is built by the rules alone (the same facts, the same
checks), so the feature never depends on the model. Med42 only sees de-identified facts, never names or free text IDs.
"""
from __future__ import annotations

import logging
import os
import threading

import httpx

log = logging.getLogger("membrain.med42")

MODEL_ID = os.getenv("MED42_MODEL_ID", "m42-health/Llama3-Med42-8B")
status = {"enabled": False, "loaded": False, "error": None, "model": None}
_local = None
_lock = threading.Lock()


def load(spaces_module=None) -> bool:
    status.update(enabled=True, model=MODEL_ID)
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        tok = os.getenv("HF_TOKEN")
        tk = AutoTokenizer.from_pretrained(MODEL_ID, token=tok)
        try:
            model = AutoModelForCausalLM.from_pretrained(MODEL_ID, dtype=torch.bfloat16, token=tok)
        except TypeError:   # transformers older than 4.56
            model = AutoModelForCausalLM.from_pretrained(MODEL_ID, torch_dtype=torch.bfloat16, token=tok)
        model.eval()
        model.to("cuda")
        stop = [tk.eos_token_id] + [i for i in [tk.convert_tokens_to_ids("<|eot_id|>")] if isinstance(i, int) and i >= 0]

        def _generate(ids, max_new: int) -> str:
            ids = ids.to("cuda")
            with torch.inference_mode():
                out = model.generate(input_ids=ids, attention_mask=torch.ones_like(ids), max_new_tokens=max_new,
                                     do_sample=False, eos_token_id=stop, pad_token_id=tk.eos_token_id)
            return tk.decode(out[0][ids.shape[-1]:], skip_special_tokens=True)

        if spaces_module is not None:
            _generate = spaces_module.GPU(duration=int(os.getenv("MED42_GPU_SECONDS", "90")))(_generate)

        def _complete(messages: list[dict], max_new: int = 700) -> str:
            ids = tk.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt")
            if not hasattr(ids, "shape"):   # newer transformers return a BatchEncoding
                ids = ids["input_ids"]
            with _lock:
                return _generate(ids, min(max_new, 800))

        global _local
        _local = _complete
        status["loaded"] = True
        log.info("Med42 loaded for review packets (%s)", MODEL_ID)
        return True
    except Exception as e:   # never stop the demo because of an optional model
        status["error"] = f"{type(e).__name__}: {str(e)[:160]}"
        log.warning("Med42 not loaded: %s", status["error"])
        return False


def available() -> bool:
    return _local is not None or bool(os.getenv("MED42_URL"))


def name() -> str:
    return os.getenv("MED42_MODEL", "Med42-v2-8B")


def complete(messages: list[dict], max_tokens: int = 700) -> str | None:
    if _local is not None:
        try:
            return _local(messages, max_tokens)
        except Exception as e:   # GPU allowance used up, queue timeout...: the rules answer instead
            status["error"] = f"last call: {type(e).__name__}"
            return None
    url = os.getenv("MED42_URL", "").rstrip("/")
    if not url:
        return None
    headers = {"Authorization": f"Bearer {os.getenv('MED42_KEY')}"} if os.getenv("MED42_KEY") else {}
    body = {"model": os.getenv("MED42_REMOTE_MODEL", MODEL_ID), "messages": messages, "temperature": 0, "max_tokens": max_tokens}
    try:
        r = httpx.post(url + "/v1/chat/completions", json=body, headers=headers, timeout=float(os.getenv("MED42_TIMEOUT", "120")))
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    except (httpx.HTTPError, KeyError, ValueError):
        return None
