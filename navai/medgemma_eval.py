"""Measure MedGemma on the Navigator intake gold sets, with the same metrics and gates as the rules extractor.

    python -m navai.medgemma_eval --model google/medgemma-4b-it --sets dev test

Needs a GPU, `pip install -r navai/requirements-navai.txt`, and a Hugging Face token for an account that has
accepted the MedGemma terms (Health AI Developer Foundations) on the model page. Only synthetic narratives
are used (Zone 0): no participant data.

Writes docs/navai/RESULTS_medgemma.json and docs/navai/RESULTS.md (rules vs MedGemma, per gate).
"""
from __future__ import annotations

import argparse
import json
import pathlib
import time

from membrain import intake as I
from navai.evaluate import ROOT, GATES, errors, load, run_rules, score


def load_model(mid: str, dtype: str = "bfloat16"):
    import torch
    from transformers import AutoModelForImageTextToText, AutoProcessor
    proc = AutoProcessor.from_pretrained(mid)
    # bfloat16 on recent GPUs (Ampere and newer); float16 on older ones such as Kaggle/Colab T4
    try:
        model = AutoModelForImageTextToText.from_pretrained(mid, dtype=getattr(torch, dtype), device_map="cuda")
    except TypeError:   # transformers older than 4.56 call it torch_dtype
        model = AutoModelForImageTextToText.from_pretrained(mid, torch_dtype=getattr(torch, dtype), device_map="cuda")
    model.eval()

    def chat(messages, max_new_tokens=1024, prefill=""):
        # Gemma chat templates take content as a list of parts; a system turn is folded into the first user turn.
        # prefill starts the model's answer (e.g. "{"), which also stops MedGemma 1.5 from writing a reasoning block first.
        msgs = [{"role": m["role"], "content": [{"type": "text", "text": m["content"]}]} for m in messages]
        prompt = proc.apply_chat_template(msgs, add_generation_prompt=True, tokenize=False) + prefill
        inp = proc.tokenizer(prompt, add_special_tokens=False, return_tensors="pt").to(model.device)
        with torch.inference_mode():
            out = model.generate(**inp, max_new_tokens=max_new_tokens, do_sample=False)
        return prefill + proc.tokenizer.decode(out[0][inp["input_ids"].shape[-1]:], skip_special_tokens=True)
    return chat


def confirmed_from_gold(g: dict) -> dict:
    """What a clinician would have confirmed for this narrative (gold labels), plus two verbatim quotes."""
    rules = I.extract_rules(g["text"], g["lang"])
    return {"narrative": g["text"], "domains": g["domains"], "red_flags": g["red_flags"], "confounders": g["confounders"],
            "onset": g["onset"], "timeline": [tuple(x) for x in g["timeline"]], "quotes": I.quotes_from(rules, g["text"])}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="google/medgemma-4b-it")
    ap.add_argument("--sets", nargs="+", default=["dev", "test"])
    ap.add_argument("--out", default=str(ROOT / "docs" / "navai"))
    ap.add_argument("--tag", default="medgemma", help="output name: docs/navai/RESULTS_<tag>.json and .md")
    ap.add_argument("--no-few-shot", action="store_true", help="v1 behaviour: no worked examples")
    ap.add_argument("--allow-thinking", action="store_true", help="let the model write its reasoning block first (slower)")
    ap.add_argument("--dtype", default="bfloat16", choices=["bfloat16", "float16"], help="float16 for T4 GPUs (Kaggle, Colab)")
    a = ap.parse_args(argv)
    chat = load_model(a.model, a.dtype)
    chat([{"role": "user", "content": "Say OK."}], max_new_tokens=4)  # warm-up, not timed
    report = {"model": a.model, "tag": a.tag,
              "prompt": ("v1 zero-shot" if a.no_few_shot else "v2 rules + 3 worked examples") + ("" if a.allow_thinking else ", answer starts with '{' (no reasoning block)"),
              "intake_version": I.INTAKE_VERSION, "date": time.strftime("%Y-%m-%d"), "sets": {}}
    for name in a.sets:
        gold = [g for g in load(name) if g["id"] not in I.FEW_SHOT_IDS]   # worked examples never scored
        preds, merged, ungr, lat, raw_out = [], [], [], [], []
        unsup = items = 0
        for g in gold:
            t = time.perf_counter()
            raw = chat(I.llm_messages(g["text"], g["lang"], few_shot=not a.no_few_shot), prefill="" if a.allow_thinking else "{")
            lat.append(time.perf_counter() - t)
            res = I.ground_llm_output(raw, g["text"], g["lang"], engine=a.model)
            unsup += res["grounding"]["unsupported"]; items += res["grounding"]["items"]
            k = I.summary_keys(res); k["timeline"] = [list(x) for x in k["timeline"]]
            preds.append(k)
            u = dict(res["ungrounded"]); u["timeline"] = [list(x) for x in u["timeline"]]
            ungr.append(u)
            m = I.summary_keys(I.merge_safety(res, I.extract_rules(g["text"], g["lang"]))); m["timeline"] = [list(x) for x in m["timeline"]]
            merged.append(m)
            raw_out.append({"id": g["id"], "raw": raw, "grounding": res["grounding"]})
            print(g["id"], f"{lat[-1]:.1f}s", res["grounding"], flush=True)
        rp, rl = run_rules(gold)
        # referral drafting: MedGemma draft from confirmed facts, checked by the deterministic verifier
        drafts = []
        for g in gold:
            c = confirmed_from_gold(g)
            d = I.strip_thinking(chat(I.llm_draft_messages(c), max_new_tokens=1024 if a.allow_thinking else 400))[0]
            v = I.verify_referral(d, c)
            tv = I.verify_referral(I.draft_referral(c), c)
            drafts.append({"id": g["id"], "draft": d, "unsupported_sentences": v["unsupported"], "sentences": v["n"],
                           "reasons": [r["reasons"] for r in v["sentences"] if not r["ok"]],
                           "template_unsupported": tv["unsupported"]})
        n_s = sum(x["sentences"] for x in drafts); n_bad = sum(x["unsupported_sentences"] for x in drafts)
        report["sets"][name] = {
            "medgemma": dict(score(gold, preds, lat, unsup, items), errors=errors(gold, preds)),
            "medgemma_plus_rule_red_flags": score(gold, merged, lat, unsup, items),
            "medgemma_before_quote_check": _no_quote_gate(score(gold, ungr, lat)),
            "diagnostics": {"parse_errors": sum(1 for r in raw_out if r["grounding"]["parse_error"]),
                            "invalid_keys": sum(r["grounding"]["invalid_key"] for r in raw_out),
                            "translated_evidence": sum(r["grounding"].get("translated_evidence", 0) for r in raw_out),
                            "thinking_blocks": sum(1 for r in raw_out if r["grounding"].get("thinking")),
                            "items": items, "dropped": unsup, "few_shot": not a.no_few_shot},
            "rules": score(gold, rp, rl),
            "drafting": {"sentences": n_s, "unsupported_sentences": n_bad,
                         "unsupported_sentence_rate": round(n_bad / n_s, 3) if n_s else None,
                         "drafts_fully_grounded": sum(1 for x in drafts if x["unsupported_sentences"] == 0),
                         "template_unsupported_sentences": sum(x["template_unsupported"] for x in drafts), "n": len(drafts)},
            "raw": raw_out, "drafts": drafts}
    out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
    (out / f"RESULTS_{a.tag}.json").write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    (out / f"RESULTS_{a.tag}.md").write_text(markdown(report), encoding="utf-8")
    print((out / f"RESULTS_{a.tag}.md").read_text(encoding="utf-8"))


def _no_quote_gate(r: dict) -> dict:
    """Before the quote check nothing is grounded, so the unsupported-field gate does not apply."""
    r["unsupported_rate"] = None
    for g in r["gates"]:
        if g["metric"] == "unsupported_rate":
            g["value"], g["pass"] = "n/a", False
    return r


def markdown(rep: dict) -> str:
    L = [f"# Navigator AI: measured results ({rep['date']})", "",
         f"Model: `{rep['model']}` · prompt: {rep['prompt']} · extractor rules `{rep['intake_version']}` · synthetic narratives only (Zone 0). "
         "Development-set narratives used as worked examples are not scored.", ""]
    for name, s in rep["sets"].items():
        L += [f"## {name} set (n = {s['rules']['n']})", "",
              "| Release gate | Target | Rules (fallback) | Model | Model + rule red flags | Model before quote check |", "|---|---|---|---|---|---|"]
        for i, (m, op, t, lab) in enumerate(GATES):
            cell = lambda r: "n/a" if r[m] is None else f"{r[m]} {'✓' if r['gates'][i]['pass'] else '✗'}"
            L.append(f"| {lab} | {op} {t} | {cell(s['rules'])} | {cell(s['medgemma'])} | {cell(s['medgemma_plus_rule_red_flags'])} | {cell(s['medgemma_before_quote_check'])} |")
        dg = s["diagnostics"]
        L += ["", f"Diagnostics: {dg['parse_errors']} unparseable answers, {dg['invalid_keys']} invalid keys, "
                  f"{dg['translated_evidence']} Arabic-text quotes given in another language, {dg.get('thinking_blocks', 0)} answers with a reasoning block, "
                  f"{dg['dropped']}/{dg['items']} items dropped by the quote check."]
        L += ["", f"Urgent cases caught: rules {s['rules']['urgent_recall_cases']}, MedGemma {s['medgemma']['urgent_recall_cases']}, "
                  f"combined {s['medgemma_plus_rule_red_flags']['urgent_recall_cases']}. "
                  f"Onset exact: rules {s['rules']['onset_exact']}, MedGemma {s['medgemma']['onset_exact']}. "
                  f"MedGemma items dropped by grounding: {s['medgemma']['unsupported_items']}.",
              "", f"Referral drafting: {s['drafting']['unsupported_sentences']} of {s['drafting']['sentences']} MedGemma sentences "
                  f"blocked by the verifier; {s['drafting']['drafts_fully_grounded']}/{s['drafting']['n']} drafts fully grounded. "
                  f"Template drafts: {s['drafting']['template_unsupported_sentences']} blocked sentences.", ""]
    L += ["With 12 urgent cases, 12/12 still only shows recall above about 0.76 (Wilson 95% lower bound). Showing 0.99 "
          "needs about 300 red-flag narratives with none missed; that is a Phase 1 task."]
    return "\n".join(L) + "\n"


if __name__ == "__main__":
    main()
