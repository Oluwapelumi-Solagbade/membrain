"""MedGemma inside the demo Space itself (free ZeroGPU), for drafting referral letters only.

Off unless the Space has the variable MEDGEMMA_IN_SPACE=1. Loading happens in deploy/hf-space/app.py BEFORE the
server reports start-up to ZeroGPU (ZeroGPU only attaches GPUs to models that were placed on "cuda" at start-up).
If anything fails (no torch, model terms not accepted for the token, out of memory), MemBrain starts without it and
drafting uses the rules template, exactly as before. api/navai.py calls `complete` instead of an HTTP endpoint.
"""
from __future__ import annotations

import logging
import os
import threading

log = logging.getLogger("membrain.medgemma")

complete = None          # set by load(): complete(messages, max_new_tokens) -> str
status = {"enabled": False, "loaded": False, "error": None, "model": None}
_lock = threading.Lock()


def load(spaces_module=None) -> bool:
    model_id = os.getenv("MEDGEMMA_MODEL_ID", "google/medgemma-4b-it")
    status.update(enabled=True, model=model_id)
    try:
        import torch
        from transformers import AutoModelForImageTextToText, AutoProcessor

        tok = os.getenv("HF_TOKEN")
        proc = AutoProcessor.from_pretrained(model_id, token=tok)
        try:
            model = AutoModelForImageTextToText.from_pretrained(model_id, dtype=torch.bfloat16, token=tok)
        except TypeError:   # transformers older than 4.56
            model = AutoModelForImageTextToText.from_pretrained(model_id, torch_dtype=torch.bfloat16, token=tok)
        model.eval()
        model.to("cuda")

        def _generate(ids, mask, max_new: int) -> str:
            ids, mask = ids.to("cuda"), mask.to("cuda")
            with torch.inference_mode():
                out = model.generate(input_ids=ids, attention_mask=mask, max_new_tokens=max_new, do_sample=False)
            return proc.tokenizer.decode(out[0][ids.shape[-1]:], skip_special_tokens=True)

        if spaces_module is not None:
            _generate = spaces_module.GPU(duration=int(os.getenv("GPU_SECONDS", "60")))(_generate)

        def _complete(messages: list[dict], max_new: int = 400) -> str:
            msgs = [{"role": m["role"], "content": [{"type": "text", "text": str(m.get("content", ""))}]} for m in messages]
            prompt = proc.apply_chat_template(msgs, add_generation_prompt=True, tokenize=False)
            enc = proc.tokenizer(prompt, add_special_tokens=False, return_tensors="pt")
            with _lock:   # one draft at a time on the shared GPU
                return _generate(enc["input_ids"], enc["attention_mask"], min(max_new, 400))

        global complete
        complete = _complete
        status["loaded"] = True
        log.info("MedGemma loaded for drafting (%s)", model_id)
        return True
    except Exception as e:   # never stop the demo because of the drafting model
        status["error"] = f"{type(e).__name__}: {str(e)[:160]}"
        log.warning("MedGemma not loaded: %s", status["error"])
        return False
