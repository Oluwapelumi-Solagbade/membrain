#!/usr/bin/env python3
"""MemBrain: Arabic ASR Dialectal Benchmark & Error Rate Evaluation Harness.

Author: Abdulwaliy (Team Cerebro Spark)
Deliverable: 7 & 5 Support (Arabic ASR Error Rates & Scoring Bias Mitigation)

Computes Word Error Rate (WER), Character Error Rate (CER), and Task-Specific
Target Match Rates across Arabic dialects (Emirati, Gulf, Levantine, Egyptian, MSA).
Demonstrates how dialectal normalization recovers missed cognitive test items.

Usage:
    # Run full dialect benchmark suite with simulated dialect phonetic variants:
    python scripts/benchmark_arabic_asr.py --report

    # Evaluate existing hypothesis and reference transcripts:
    python scripts/benchmark_arabic_asr.py --hypo hyp.json --ref ref.json --output wer_report.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import numpy as np

# Ensure local membrain package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from membrain.scoring import normalize, _stem, _tokens
from membrain.items import WORD_LISTS, FLUENCY_LEXICON, STORIES


def levenshtein_distance(seq1: list[Any] | str, seq2: list[Any] | str) -> int:
    """Compute standard Levenshtein edit distance between two sequences."""
    n1, n2 = len(seq1), len(seq2)
    if n1 == 0:
        return n2
    if n2 == 0:
        return n1

    dp = [[0] * (n2 + 1) for _ in range(n1 + 1)]
    for i in range(n1 + 1):
        dp[i][0] = i
    for j in range(n2 + 1):
        dp[0][j] = j

    for i in range(1, n1 + 1):
        for j in range(1, n2 + 1):
            cost = 0 if seq1[i - 1] == seq2[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,       # deletion
                dp[i][j - 1] + 1,       # insertion
                dp[i - 1][j - 1] + cost # substitution
            )

    return dp[n1][n2]


def compute_wer(ref: str, hyp: str, apply_norm: bool = False, lang: str = "ar") -> float:
    """Compute Word Error Rate (WER) between reference and hypothesis text."""
    if apply_norm:
        r_words = _tokens(ref, lang)
        h_words = _tokens(hyp, lang)
    else:
        r_words = ref.strip().split()
        h_words = hyp.strip().split()

    if not r_words:
        return 0.0 if not h_words else 1.0

    edit_dist = levenshtein_distance(r_words, h_words)
    return float(edit_dist / len(r_words))


def compute_cer(ref: str, hyp: str, apply_norm: bool = False, lang: str = "ar") -> float:
    """Compute Character Error Rate (CER)."""
    if apply_norm:
        r_chars = list(normalize(ref, lang).replace(" ", ""))
        h_chars = list(normalize(hyp, lang).replace(" ", ""))
    else:
        r_chars = list(ref.replace(" ", ""))
        h_chars = list(hyp.replace(" ", ""))

    if not r_chars:
        return 0.0 if not h_chars else 1.0

    edit_dist = levenshtein_distance(r_chars, h_chars)
    return float(edit_dist / len(r_chars))


# Curated dialect test sentences mapping common clinical responses across dialects
DIALECT_BENCHMARK_CORPUS = [
    {
        "id": "item_recall_01",
        "domain": "memory_delayed",
        "standard_ref": "جمل شباك برتقال معلم نهر قهوة قارب حديقة طبيب قمر",
        "dialect_utterances": {
            "Emirati": "يمل شباك برتقال معلم نهر گهوه طراد حديگه طبيب قمر",
            "Other Gulf": "جمل دريشة برتقال مدرس نهر قهوة قارب حديقة دكتور قمر",
            "Levantine": "جمل شباك بردقان معلم نهر أهوة فلوكة جنينة حكيم أمر",
            "Egyptian": "جمل شباك برتقان مدرس بحر أهوة مركب جنينة دكتور أمر",
            "MSA": "جمل نافذة برتقال معلم نهر قهوة قارب حديقة طبيب قمر"
        }
    },
    {
        "id": "story_recall_01",
        "domain": "story_recall",
        "standard_ref": "يوم الجمعة ذهبت فاطمة بالسوق واشترت تمرا ووشاحا ازرق",
        "dialect_utterances": {
            "Emirati": "يوم اليمعه راحت فاطمه السوج وخذت سح وشيله زرقا",
            "Other Gulf": "يوم الجمعه راحت فاطمه السوق وشرت تمر وشال ازرق",
            "Levantine": "يوم الجمعه راحت فاطمه ع السوق واشترت تمر ومنديل ازرق",
            "Egyptian": "يوم الجمعه راحت فاطمه السوق واشترت بلح وطرحه زرقه",
            "MSA": "يوم الجمعة ذهبت فاطمة الى السوق واشترت تمرا ووشاحا ازرق"
        }
    },
    {
        "id": "fluency_animals_01",
        "domain": "fluency",
        "standard_ref": "كلب قط حصان خروف اسد ذئب صقر جمل",
        "dialect_utterances": {
            "Emirati": "چلب قطو خيل طلي اسد ذيب طير يمل",
            "Other Gulf": "كلب بس خيل خروف اسد ذيب صقر بعير",
            "Levantine": "كلب بسينه حصان خروف اسد ديب باز جمل",
            "Egyptian": "كلب قطه حصان خروف اسد ديب صقر جمل",
            "MSA": "كلب هر حصان كبش اسد ذئب صقر جمل"
        }
    },
    {
        "id": "judgement_kitchen_01",
        "domain": "judgement",
        "standard_ref": "اطفئ الغاز واخرج من البيت واتصل بالدفاع المدني",
        "dialect_utterances": {
            "Emirati": "اسكر الفرن واظهر برا البيت واتصل بالشرطه",
            "Other Gulf": "اطفي الفرن واطلع برا واكلم الدفاع المدني",
            "Levantine": "طفي الغاز واطلع لبرا وتلفن للإطفائيه",
            "Egyptian": "اقفل البوتاجاز واخرج برا البيت واطلب المطافي",
            "MSA": "اغلق الموقد واغادر المنزل واستدعي رجال الاطفاء"
        }
    }
]


def run_dialect_benchmark() -> dict[str, Any]:
    """Execute dialectal ASR error evaluation and normalization gain analysis."""
    dialects = ["Emirati", "Other Gulf", "Levantine", "Egyptian", "MSA"]
    summary: dict[str, Any] = {d: {"raw_wer": [], "norm_wer": [], "raw_cer": [], "norm_cer": []} for d in dialects}

    for item in DIALECT_BENCHMARK_CORPUS:
        ref = item["standard_ref"]
        for dialect, hyp in item["dialect_utterances"].items():
            raw_wer = compute_wer(ref, hyp, apply_norm=False)
            norm_wer = compute_wer(ref, hyp, apply_norm=True)
            raw_cer = compute_cer(ref, hyp, apply_norm=False)
            norm_cer = compute_cer(ref, hyp, apply_norm=True)

            summary[dialect]["raw_wer"].append(raw_wer)
            summary[dialect]["norm_wer"].append(norm_wer)
            summary[dialect]["raw_cer"].append(raw_cer)
            summary[dialect]["norm_cer"].append(norm_cer)

    results_table = {}
    for d in dialects:
        mean_raw_wer = float(np.mean(summary[d]["raw_wer"]))
        mean_norm_wer = float(np.mean(summary[d]["norm_wer"]))
        mean_raw_cer = float(np.mean(summary[d]["raw_cer"]))
        mean_norm_cer = float(np.mean(summary[d]["norm_cer"]))
        wer_reduction_pct = (
            round((mean_raw_wer - mean_norm_wer) / max(0.01, mean_raw_wer) * 100.0, 1)
        )

        results_table[d] = {
            "raw_wer_pct": round(mean_raw_wer * 100.0, 1),
            "normalized_wer_pct": round(mean_norm_wer * 100.0, 1),
            "wer_reduction_pct": wer_reduction_pct,
            "raw_cer_pct": round(mean_raw_cer * 100.0, 1),
            "normalized_cer_pct": round(mean_norm_cer * 100.0, 1),
        }

    return results_table


def main():
    parser = argparse.ArgumentParser(
        description="MemBrain Arabic ASR Dialectal Benchmark & Error Evaluation"
    )
    parser.add_argument("--report", action="store_true", help="Run benchmark and print formatted table")
    parser.add_argument("--hypo", type=str, help="JSON file with hypothesis transcripts")
    parser.add_argument("--ref", type=str, help="JSON file with reference transcripts")
    parser.add_argument("--output", "-o", type=str, help="Output path for JSON results")
    args = parser.parse_args()

    if args.hypo and args.ref:
        hyp_data = json.loads(Path(args.hypo).read_text(encoding="utf-8"))
        ref_data = json.loads(Path(args.ref).read_text(encoding="utf-8"))
        results = {}
        for key, ref_text in ref_data.items():
            hyp_text = hyp_data.get(key, "")
            results[key] = {
                "raw_wer": round(compute_wer(ref_text, hyp_text, False), 3),
                "norm_wer": round(compute_wer(ref_text, hyp_text, True), 3),
            }
        out_str = json.dumps(results, indent=2)
        if args.output:
            Path(args.output).write_text(out_str, encoding="utf-8")
        else:
            print(out_str)
        return

    # Default: Run benchmark corpus
    results = run_dialect_benchmark()

    print("\n=========================================================================")
    print("   MEMBRAIN ARABIC ASR DIALECT BENCHMARK: RAW VS NORMALIZED ERROR RATES  ")
    print("=========================================================================")
    print(f"{'Dialect':<15} | {'Raw WER':<10} | {'Norm WER':<10} | {'WER Drop':<10} | {'Norm CER':<10}")
    print("-------------------------------------------------------------------------")
    for dialect, metrics in results.items():
        print(
            f"{dialect:<15} | {metrics['raw_wer_pct']:>8.1f}% | {metrics['normalized_wer_pct']:>8.1f}% | {metrics['wer_reduction_pct']:>8.1f}% | {metrics['normalized_cer_pct']:>8.1f}%"
        )
    print("=========================================================================\n")

    if args.output:
        Path(args.output).write_text(json.dumps(results, indent=2), encoding="utf-8")
        print(f"Results written to {args.output}")


if __name__ == "__main__":
    main()
