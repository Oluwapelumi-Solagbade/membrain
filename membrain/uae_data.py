"""UAE country data used to calibrate the synthetic cohort's risk-factor profile.

Source: WHO Global Health Observatory (GHO) OData API, country code ARE, retrieved 15 Nov 2026.
These are national, population-level estimates (most are modelled by WHO), not individual records.
They make the synthetic cohort's vascular and lifestyle profile look like the UAE adult population.
Age-specific rates for 50-75-year-olds should replace them once the partner provides UAE
National Health Survey or programme data.
"""
from __future__ import annotations

import numpy as np

RETRIEVED = "2026-11-15"
SOURCE = "WHO Global Health Observatory OData API (ghoapi.azureedge.net), SpatialDim = ARE"

# value = % ; by sex where WHO reports it. (indicator, year, age group, both, female, male, 95% UI both)
UAE_INDICATORS = {
    "hypertension": {"indicator": "NCD_HYP_PREVALENCE_C", "year": 2019, "age": "30-79", "both": 31.6, "F": 23.1, "M": 34.6, "ui": (25.1, 38.5)},
    "diabetes": {"indicator": "NCD_DIABETES_PREVALENCE_CRUDE", "year": 2022, "age": "30+", "both": 24.3, "F": 23.7, "M": 24.6, "ui": (17.2, 32.2)},
    "obesity": {"indicator": "NCD_BMI_30C", "year": 2024, "age": "18+", "both": 30.3, "F": 34.9, "M": 28.0, "ui": (25.7, 35.2)},
    "insufficient_activity": {"indicator": "NCD_PAC", "year": 2022, "age": "18+", "both": 64.0, "F": 71.4, "M": 61.3, "ui": (52.0, 75.2)},
    "current_smoking": {"indicator": "M_Est_smk_curr", "year": 2025, "age": "15+", "both": 10.9, "F": 2.5, "M": 15.1, "ui": None},
}


def uae_context(rng: np.random.Generator, sex: str, age: float) -> dict:
    """Draw a person's vascular / lifestyle profile from UAE national prevalences.

    Hypertension and diabetes rise with age; the WHO adult rates are re-centred on age 62
    (middle of our 50-75 band) with a modest gradient, which keeps the cohort average close to the
    national figure. This is an assumption, stated in docs/UAE_DATA.md.
    """
    s = "F" if sex == "F" else "M"
    age_factor = 1 + 0.025 * (age - 62)
    p = {k: UAE_INDICATORS[k][s] / 100 for k in UAE_INDICATORS}
    htn = rng.random() < min(0.95, p["hypertension"] * age_factor)
    dm = rng.random() < min(0.95, p["diabetes"] * age_factor)
    ob = rng.random() < p["obesity"]
    inactive = rng.random() < p["insufficient_activity"]
    smoker = rng.random() < p["current_smoking"]
    return {
        "hypertension": bool(htn), "diabetes": bool(dm), "smoker": bool(smoker),
        "sbp": float(rng.normal(148, 12) if htn else rng.normal(122, 9)),
        "dbp": float(rng.normal(90, 8) if htn else rng.normal(77, 6)),
        "hba1c": float(max(5.0, rng.normal(7.6, 1.1)) if dm else min(6.4, max(4.6, rng.normal(5.6, 0.35)))),
        "bmi": float(rng.normal(33.5, 3.0) if ob else rng.normal(26.0, 2.6)),
        "activity_min_week": float(max(0, rng.normal(60, 40)) if inactive else rng.normal(240, 50)),
        "uae_calibrated": True,
    }
