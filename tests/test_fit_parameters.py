"""The Phase 2 parameter-fitting script must recover the simulator's known values."""
from membrain import config as C
from scripts.fit_parameters import estimate, from_synthetic


def test_recovers_known_parameters():
    est = estimate(from_synthetic(3000, seed=5))
    assert est["n_retest_pairs"] > 800
    for d in C.DOMAINS:
        assert abs(est["norms"][d]["sd"] - C.NORMS[d]["sd"]) < 0.15 * C.NORMS[d]["sd"]
        assert abs(est["practice"][d] - C.DOMAINS[d]["practice"]) < 0.2
        for b in C.EDUCATION_BANDS:
            assert abs(est["norms"][d]["mean"][b] - C.NORMS[d]["mean"][b]) < 0.4 * C.NORMS[d]["sd"]
        # whole-point scores lose a little reliability to rounding, never gain it
        assert C.DOMAINS[d]["r"] - 0.16 < est["r"][d] < C.DOMAINS[d]["r"] + 0.03
    assert 0.85 < est["composite_r"] < 0.95
