"""Versioned engine configuration.

Every number here is a *starting point* to be re-estimated in Phase A
(feasibility & reliability study). Values marked [PLACEHOLDER] are
illustrative and must be replaced with locally derived estimates.
Changing any value requires a new ENGINE_VERSION (change control).
"""

ENGINE_VERSION = "0.3.0"
NORMS_VERSION = "synthetic-2026.11"  # [PLACEHOLDER] until Phase A local norms

# --- Cognitive domains in the voice-first battery -------------------------
# max_score, test-retest reliability r, expected practice gain per session
# (in raw points, applied to sessions 2..n, saturating after 3 sessions).
DOMAINS = {
    "memory_immediate": {"max": 10, "r": 0.78, "practice": 0.40, "weight": 1.0},
    "memory_delayed":   {"max": 10, "r": 0.80, "practice": 0.50, "weight": 1.5},
    "fluency":          {"max": 30, "r": 0.82, "practice": 0.80, "weight": 1.0},
    "story_recall":     {"max": 12, "r": 0.76, "practice": 0.50, "weight": 1.0},
    "judgement":        {"max": 4,  "r": 0.70, "practice": 0.05, "weight": 0.5},
}
COMPOSITE_R = 0.88  # [PLACEHOLDER] reliability of the weighted composite
INTER_DOMAIN_R = 0.5  # [PLACEHOLDER] average correlation between domain z-scores
PRACTICE_SATURATION = 3  # practice gains stop accumulating after this many sessions

# --- Stratified norms: mean / SD of raw score by education band ------------
# Education bands: none (0y), primary (1-6y), secondary (7-12y), tertiary (>12y)
# Age adjustment: points lost per decade above 50 (applied to the mean).
EDUCATION_BANDS = ["none", "primary", "secondary", "tertiary"]
NORMS = {  # [PLACEHOLDER] synthetic norms
    "memory_immediate": {"mean": {"none": 5.6, "primary": 6.2, "secondary": 6.9, "tertiary": 7.4}, "sd": 1.4, "age_per_decade": 0.35},
    "memory_delayed":   {"mean": {"none": 4.8, "primary": 5.5, "secondary": 6.3, "tertiary": 6.9}, "sd": 1.7, "age_per_decade": 0.45},
    "fluency":          {"mean": {"none": 12.0, "primary": 14.0, "secondary": 16.5, "tertiary": 18.5}, "sd": 4.0, "age_per_decade": 1.0},
    "story_recall":     {"mean": {"none": 5.5, "primary": 6.3, "secondary": 7.3, "tertiary": 8.1}, "sd": 1.9, "age_per_decade": 0.4},
    "judgement":        {"mean": {"none": 2.9, "primary": 3.1, "secondary": 3.4, "tertiary": 3.6}, "sd": 0.7, "age_per_decade": 0.08},
}
# A single, education-blind cutoff (what a naive tool would use) for comparison.
NAIVE_NORM_EDUCATION = "secondary"

# --- Thresholds ------------------------------------------------------------
BASELINE_SESSIONS = 2          # valid sessions needed before change detection
BASELINE_MAX_SESSIONS = 3
RCI_CHECK = -1.645             # one-tailed 95%: beyond measurement noise
RCI_DOMAIN_CHECK = -1.96       # stricter per-domain threshold
# Only these domains can trigger on their own (others are shown as context;
# coarse scales such as judgement 0-4 are too noisy to trigger alone).
TRIGGER_DOMAINS = ["memory_delayed"]
RCI_LARGE = -2.576             # large decline -> urgent
LOW_BASELINE_Z = -1.5          # entry composite below stratified norm -> review
RAPID_DROP_Z = 1.5             # composite z drop vs baseline within <=12 weeks

# --- Confounders -----------------------------------------------------------
PHQ2_CUTOFF = 3      # PHQ-2 >= 3: positive depression screen
GAD2_CUTOFF = 3      # GAD-2 >= 3: positive anxiety screen
SLEEP_HOURS_LOW = 5.5
IQCODE_CUTOFF = 3.34  # Arabic IQCODE-16 reported best cutoff (> 3.34)
IQCODE_RISE = 0.30    # rise vs previous informant report = new functional loss

# --- Audio quality gate ----------------------------------------------------
AUDIO_MIN_SNR_DB = 15.0
AUDIO_MAX_CLIPPING = 0.01
AUDIO_MIN_SPEECH_RATIO = 0.25
AUDIO_MIN_DURATION_S = 3.0

# --- Scheduling -----------------------------------------------------------
REPEAT_WEEKS = (2, 4)
ROUTINE_MONTHS = 6
REVIEW_TARGET_DAYS = {"CLINICIAN_REVIEW": 21, "URGENT": 3}
