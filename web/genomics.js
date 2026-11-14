/* Consent-gated genomic context — JavaScript port of membrain/genomics.py (parity-checked). */
(function (root) {
  const VALID = new Set(["e2/e2", "e2/e3", "e2/e4", "e3/e3", "e3/e4", "e4/e4"]);
  const TRANSITIONS = { not_offered: ["offered"], offered: ["completed_wants_result", "completed_declines_result", "declined_counselling"],
    completed_wants_result: [], completed_declines_result: [], declined_counselling: ["offered"] };
  const copiesOf = (g) => (g && VALID.has(g) ? (g.match(/e4/g) || []).length : null);
  function advance(state, next) { if (!(TRANSITIONS[state] || []).includes(next)) throw new Error(`cannot move counselling from '${state}' to '${next}'`); return next; }
  function context(person) {
    const consent = !!(person.consent || {}).genomics; const g = person.genomics || {};
    if (!consent) return { available: false, reason: "No genomics consent: genomic data is not processed or shown." };
    if (!Object.keys(g).length) return { available: false, reason: "Consented, but no existing genomic result has been received." };
    const copies = copiesOf(g.apoe); const fh = !!(person.context || {}).family_history_dementia; const age = person.age || 0;
    const recs = [], flags = [];
    if (copies !== null && copies >= 1) recs.push({ id: "vascular_risk_focus", text: "Prioritise blood pressure, glucose, lipids, hearing and activity. Lifestyle risk reduction benefits APOE e4 carriers as well as non-carriers (FINGER trial).", reason: `APOE e4 x${copies}` });
    if (copies === 2 || (copies === 1 && fh && age >= 60)) recs.push({ id: "monitoring_interval", text: "Consider 3-monthly instead of 6-monthly check-ins. This changes how closely we watch; it never changes what counts as a decline.", reason: copies === 2 ? "APOE e4 homozygous" : "APOE e4 + first-degree family history + age 60 or over" });
    if (copies === 2) flags.push({ id: "aria_risk", text: "If anti-amyloid therapy is ever considered, APOE e4 homozygotes have a substantially higher risk of ARIA (amyloid-related imaging abnormalities). The genotype must be known before that decision.", severity: "treatment_safety" });
    if (copies !== null && copies >= 1) flags.push({ id: "research_eligibility", text: "May be eligible for prevention research (for example genomics-led prevention trials with the partner). Offer only with separate research consent.", severity: "information" });
    const prs = g.prs ? { percentile: g.prs.percentile, reference_ancestry: g.prs.reference_ancestry || "European", warning: "Polygenic score derived from mostly European-ancestry studies; not validated in Gulf or Arab populations. Shown for research context only; do not use for individual decisions." } : null;
    const state = g.counselling || "not_offered";
    return { available: true, apoe: g.apoe, apoe4_copies: copies, result_date: g.date, source: g.source || "partner programme", family_history_dementia: fh,
      recommendations: recs, flags, prs, counselling: state, participant_disclosure_allowed: state === "completed_wants_result", affects_triage: false };
  }
  const api = { context, advance, TRANSITIONS };
  if (typeof module !== "undefined") module.exports = api; else root.MBGenomics = api;
})(typeof window !== "undefined" ? window : globalThis);
