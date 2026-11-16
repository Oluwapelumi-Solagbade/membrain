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


def load_model(mid: str):
    import torch
    from transformers import AutoModelForImageTextToText, AutoProcessor
    proc = AutoProcessor.from_pretrained(mid)
    model = AutoModelForImageTextToText.from_pretrained(mid, torch_dtype=torch.bfloat16, device_map="cuda")
    model.eval()

    def chat(messages, max_new_tokens=700):
        # Gemma chat templates take content as a list of parts; a system turn is folded into the first user turn.
        msgs = [{"role": m["role"], "content": [{"type": "text", "text": m["content"]}]} for m in messages]
        inp = proc.apply_chat_template(msgs, add_generation_prompt=True, tokenize=True, return_dict=True,
                                       return_tensors="pt").to(model.device)
        with torch.inference_mode():
            out = model.generate(**inp, max_new_tokens=max_new_tokens, do_sample=False)
        return proc.decode(out[0][inp["input_ids"].shape[-1]:], skip_special_tokens=True)
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
    a = ap.parse_args(argv)
    chat = load_model(a.model)
    chat([{"role": "user", "content": "Say OK."}], max_new_tokens=4)  # warm-up, not timed
    report = {"model": a.model, "intake_version": I.INTAKE_VERSION, "date": time.strftime("%Y-%m-%d"), "sets": {}}
    for name in a.sets:
        gold = load(name)
        preds, merged, lat, raw_out = [], [], [], []
        unsup = items = 0
        for g in gold:
            t = time.perf_counter()
            raw = chat(I.llm_messages(g["text"], g["lang"]))
            lat.append(time.perf_counter() - t)
            res = I.ground_llm_output(raw, g["text"], g["lang"], engine=a.model)
            unsup += res["grounding"]["unsupported"]; items += res["grounding"]["items"]
            k = I.summary_keys(res); k["timeline"] = [list(x) for x in k["timeline"]]
            preds.append(k)
            m = I.summary_keys(I.merge_safety(res, I.extract_rules(g["text"], g["lang"]))); m["timeline"] = [list(x) for x in m["timeline"]]
            merged.append(m)
            raw_out.append({"id": g["id"], "raw": raw, "grounding": res["grounding"]})
            print(g["id"], f"{lat[-1]:.1f}s", res["grounding"], flush=True)
        rp, rl = run_rules(gold)
        # referral drafting: MedGemma draft from confirmed facts, checked by the deterministic verifier
        drafts = []
        for g in gold:
            c = confirmed_from_gold(g)
            d = chat(I.llm_draft_messages(c), max_new_tokens=300)
            v = I.verify_referral(d, c)
            tv = I.verify_referral(I.draft_referral(c), c)
            drafts.append({"id": g["id"], "draft": d, "unsupported_sentences": v["unsupported"], "sentences": v["n"],
                           "reasons": [r["reasons"] for r in v["sentences"] if not r["ok"]],
                           "template_unsupported": tv["unsupported"]})
        n_s = sum(x["sentences"] for x in drafts); n_bad = sum(x["unsupported_sentences"] for x in drafts)
        report["sets"][name] = {
            "medgemma": dict(score(gold, preds, lat, unsup, items), errors=errors(gold, preds)),
            "medgemma_plus_rule_red_flags": score(gold, merged, lat, unsup, items),
            "rules": score(gold, rp, rl),
            "drafting": {"sentences": n_s, "unsupported_sentences": n_bad,
                         "unsupported_sentence_rate": round(n_bad / n_s, 3) if n_s else None,
                         "drafts_fully_grounded": sum(1 for x in drafts if x["unsupported_sentences"] == 0),
                         "template_unsupported_sentences": sum(x["template_unsupported"] for x in drafts), "n": len(drafts)},
            "raw": raw_out, "drafts": drafts}
    out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
    (out / "RESULTS_medgemma.json").write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    (out / "RESULTS.md").write_text(markdown(report), encoding="utf-8")
    print((out / "RESULTS.md").read_text(encoding="utf-8"))


def markdown(rep: dict) -> str:
    L = [f"# Navigator AI: measured results ({rep['date']})", "",
         f"Model: `{rep['model']}` · extractor rules `{rep['intake_version']}` · synthetic narratives only (Zone 0).", ""]
    for name, s in rep["sets"].items():
        L += [f"## {name} set (n = {s['rules']['n']})", "",
              "| Release gate | Target | Rules (fallback) | MedGemma | MedGemma + rule red flags |", "|---|---|---|---|---|"]
        for i, (m, op, t, lab) in enumerate(GATES):
            cell = lambda r: "n/a" if r["gates"][i]["pass"] is None else f"{r[m]} {'✓' if r['gates'][i]['pass'] else '✗'}"
            L.append(f"| {lab} | {op} {t} | {cell(s['rules'])} | {cell(s['medgemma'])} | {cell(s['medgemma_plus_rule_red_flags'])} |")
        L += ["", f"Urgent cases caught: rules {s['rules']['urgent_recall_cases']}, MedGemma {s['medgemma']['urgent_recall_cases']}, "
                  f"combined {s['medgemma_plus_rule_red_flags']['urgent_recall_cases']}. "
                  f"Onset exact: rules {s['rules']['onset_exact']}, MedGemma {s['medgemma']['onset_exact']}. "
                  f"MedGemma items dropped by grounding: {s['medgemma']['unsupported_items']}.",
              "", f"Referral drafting: {s['drafting']['unsupported_sentences']} of {s['drafting']['sentences']} MedGemma sentences "
                  f"blocked by the verifier; {s['drafting']['drafts_fully_grounded']}/{s['drafting']['n']} drafts fully grounded. "
                  f"Template drafts: {s['drafting']['template_unsupported_sentences']} blocked sentences.", ""]
    L += ["With 12 urgent cases, 12/12 still only shows recall above about 0.76 (Wilson 95% lower bound). Showing 0.99 "
          "needs about 300 red-flag narratives with none missed; that is a Phase A task."]
    return "\n".join(L) + "\n"


if __name__ == "__main__":
    main()
