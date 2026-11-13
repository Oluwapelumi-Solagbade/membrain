/* MemBrain engine — JavaScript port of membrain/{scoring,change,triage}.py
 * Parity with Python is enforced by tests/golden_vectors.json (web/parity_test.js).
 * Config, items and norms are injected from Python (window.MB_DATA / module arg),
 * so thresholds have ONE source of truth.
 */
(function (root) {
  function makeEngine(D) {
    const C = D.config;
    const LEVELS = ["BASELINE", "STABLE", "CHECK_AGAIN", "CLINICIAN_REVIEW", "URGENT"];
    const DOMAINS = Object.keys(C.DOMAINS);
    const r3 = (x) => Math.round(x * 1000) / 1000;
    const r2 = (x) => Math.round(x * 100) / 100;
    const lvMax = (a, b) => (LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b);
    const days = (a, b) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86400000);

    // ---------------- scoring ----------------
    function normalize(text, lang) {
      text = (text || "").normalize("NFKC").toLowerCase();
      if (lang === "ar") {
        text = text.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "");
        text = text.replace(/[إأآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي");
      }
      text = text.replace(/[^\p{L}\p{N}_\s]/gu, " ");
      return text.replace(/\s+/g, " ").trim();
    }
    function stem(t, lang) {
      if (lang === "ar") {
        for (const p of ["وال", "بال", "فال", "ال", "و"]) if (t.startsWith(p) && t.length - p.length >= 2) return t.slice(p.length);
        return t;
      }
      return t.endsWith("s") && t.length > 3 ? t.slice(0, -1) : t;
    }
    const tokens = (text, lang) => normalize(text, lang).split(" ").filter(Boolean).map((t) => stem(t, lang));

    function scoreWords(tr, form, lang) {
      const targets = {};
      D.items.WORD_LISTS[form][lang].forEach((w) => (targets[stem(normalize(w, lang), lang)] = w));
      const said = tokens(tr, lang);
      const hits = [...new Set(said.filter((t) => targets[t]).map((t) => targets[t]))].sort();
      return { score: hits.length, hits };
    }
    function scoreFluency(tr, form, lang) {
      const lex = new Set(normalize(D.items.FLUENCY_LEXICON[form][lang], lang).split(" ").map((w) => stem(w, lang)));
      const seen = new Set(); const valid = []; const unverified = []; let repeats = 0;
      for (const t of tokens(tr, lang)) {
        if (t.length < 2) continue;
        if (seen.has(t)) { repeats++; continue; }
        seen.add(t); (lex.has(t) ? valid : unverified).push(t);
      }
      return { score: Math.min(valid.length, C.DOMAINS.fluency.max), valid, unverified, repeats, needs_audit: unverified.length > 0 };
    }
    function unitsMatched(tr, units, lang) {
      const norm = " " + normalize(tr, lang) + " ";
      const toks = new Set(tokens(tr, lang));
      const out = [];
      units.forEach((alts, i) => {
        for (const a of alts) {
          const na = normalize(a, lang);
          if ((na.includes(" ") && norm.includes(" " + na + " ")) || toks.has(stem(na, lang))) { out.push(i); break; }
        }
      });
      return out;
    }
    function scoreTranscripts(tr, form, lang) {
      const det = {
        memory_immediate: scoreWords(tr.memory_immediate || "", form, lang),
        memory_delayed: scoreWords(tr.memory_delayed || "", form, lang),
        fluency: scoreFluency(tr.fluency || "", form, lang),
        story_recall: (() => { const m = unitsMatched(tr.story_recall || "", D.items.STORIES[form].units[lang], lang); return { score: m.length, units_recalled: m }; })(),
        judgement: (() => { const m = unitsMatched(tr.judgement || "", D.items.JUDGEMENT[form].rubric[lang], lang); return { score: m.length, rubric_elements: m }; })(),
      };
      const raw = {}; DOMAINS.forEach((d) => (raw[d] = det[d].score));
      return { raw, detail: det };
    }

    // ---------------- norms ----------------
    const expectedRaw = (d, edu, age) => C.NORMS[d].mean[edu] - C.NORMS[d].age_per_decade * Math.max(0, (age - 50) / 10);
    const domainZ = (d, raw, edu, age) => (raw - expectedRaw(d, edu, age)) / C.NORMS[d].sd;
    function compositeSd() {
      const w = DOMAINS.map((d) => C.DOMAINS[d].weight); const tot = w.reduce((a, b) => a + b, 0);
      const sq = w.reduce((a, b) => a + b * b, 0);
      return Math.sqrt(sq + C.INTER_DOMAIN_R * (tot * tot - sq)) / tot;
    }
    function compositeZ(raw, edu, age) {
      let num = 0, den = 0;
      DOMAINS.forEach((d) => { num += C.DOMAINS[d].weight * domainZ(d, raw[d], edu, age); den += C.DOMAINS[d].weight; });
      return num / den / compositeSd();
    }
    function zProfile(raw, edu, age) {
      const domains = {}; DOMAINS.forEach((d) => (domains[d] = r3(domainZ(d, raw[d], edu, age))));
      return { domains, composite: r3(compositeZ(raw, edu, age)), norms_version: C.NORMS_VERSION, education_band: edu };
    }

    // ---------------- change ----------------
    const practiceGain = (i, p) => p * Math.min(i, C.PRACTICE_SATURATION);
    function compositePractice() {
      let z = 0, w = 0;
      DOMAINS.forEach((d) => { z += C.DOMAINS[d].weight * C.DOMAINS[d].practice / C.NORMS[d].sd; w += C.DOMAINS[d].weight; });
      return z / w / compositeSd();
    }
    function rci(cur, idx, bv, bi, sd, r, pps) {
      const k = bv.length; const base = bv.reduce((a, b) => a + b, 0) / k;
      const exp = practiceGain(idx, pps) - bi.reduce((a, i) => a + practiceGain(i, pps), 0) / k;
      const se = sd * Math.sqrt(1 - r) * Math.sqrt(1 + 1 / k);
      return { rci: r3(((cur - base) - exp) / se), baseline: r3(base), current: r3(cur), observed_change: r3(cur - base),
               expected_practice: r3(exp), se_diff: r3(se), k_baseline: k };
    }
    function slopePerYear(xs, ys) {
      if (xs.length < 3) return null;
      const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
      const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0); if (!sxx) return null;
      return r3(xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx * 365.25);
    }

    // ---------------- triage ----------------
    function audioGate(a) {
      if (!a) return [];
      const f = [];
      if ((a.snr_db ?? 99) < C.AUDIO_MIN_SNR_DB) f.push("background noise too high");
      if ((a.clipping ?? 0) > C.AUDIO_MAX_CLIPPING) f.push("recording too loud (clipping)");
      if ((a.speech_ratio ?? 1) < C.AUDIO_MIN_SPEECH_RATIO) f.push("too little speech detected");
      if ((a.duration_s ?? 99) < C.AUDIO_MIN_DURATION_S) f.push("recording too short");
      return f;
    }
    function confounders(s) {
      const out = [];
      if ((s.phq2 || 0) >= C.PHQ2_CUTOFF || (s.gad2 || 0) >= C.GAD2_CUTOFF)
        out.push({ code: "mood", label: "Low mood or anxiety screen positive", action: "Hold cognitive alert, offer mental-health pathway, repeat later" });
      const sh = s.sleep_hours;
      if ((sh != null && sh < C.SLEEP_HOURS_LOW) || s.poor_sleep_self)
        out.push({ code: "sleep", label: "Poor sleep in the past week", action: "Note and repeat after sleep improves" });
      if (s.acute_illness || s.new_medication)
        out.push({ code: "illness_medication", label: "Acute illness or new medication", action: "Repeat after 2-4 weeks" });
      const pc = s.precheck || {};
      if (pc.hearing_ok === false || pc.vision_ok === false)
        out.push({ code: "sensory", label: "Hearing or vision difficulty at pre-check", action: "Repeat with accommodation (volume, slower pace, large text)" });
      if (s.assisted) out.push({ code: "assisted", label: "Session completed with a helper", action: "Cannot confirm change alone; repeat unassisted if possible" });
      return out;
    }
    const DLABEL = { memory_immediate: "Word learning", memory_delayed: "Delayed word recall", fluency: "Word generation (fluency)", story_recall: "Story recall", judgement: "Everyday judgement" };

    function evaluateHistory(p, sessionsIn) {
      const edu = p.education, age = p.age;
      const sessions = [...sessionsIn].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      const evals = []; const baseline = {}; const chIdx = {}; const lastPost = {};
      let prevIq = null; const hd = [], hz = [];
      const t0 = sessions.length ? sessions[0].date : null;
      for (const s of sessions) {
        const ch = s.channel || "app"; const idx = chIdx[ch] || 0; chIdx[ch] = idx + 1;
        const ev = { session_id: s.session_id, date: s.date.slice(0, 10), channel: ch, form: s.form, session_index: idx,
                     level: "BASELINE", reasons: [], drivers: [], confounders: [], pathways: [], valid: true, engine_version: C.ENGINE_VERSION };
        const iq = s.iqcode;
        const fflag = iq != null && iq > C.IQCODE_CUTOFF;
        const newLoss = fflag && prevIq != null && iq - prevIq >= C.IQCODE_RISE;
        const iqBefore = prevIq; if (iq != null) prevIq = iq;
        if (s.safety_concern) { ev.level = "URGENT"; ev.reasons.push("Informant reported a safety concern"); ev.pathways.push("primary_care_urgent"); }
        if (newLoss) {
          ev.level = "URGENT";
          ev.reasons.push(`New functional loss reported by informant (IQCODE ${iqBefore.toFixed(2)} -> ${iq.toFixed(2)}, above cutoff ${C.IQCODE_CUTOFF})`);
          ev.drivers.push({ input: "Informant questionnaire (IQCODE-16)", value: iq, threshold: C.IQCODE_CUTOFF });
          ev.pathways.push("memory_clinic");
        }
        const gate = audioGate(s.audio);
        if (gate.length || s.raw == null) {
          ev.valid = false; ev.level = lvMax(ev.level, "CHECK_AGAIN");
          ev.reasons.push("Session not scored: " + (gate.join(", ") || "incomplete")); ev.next_action = "repeat_soon";
          evals.push(ev); continue;
        }
        const raw = s.raw; const zp = zProfile(raw, edu, age); ev.z = zp;
        const conf = confounders(s); ev.confounders = conf; const cc = new Set(conf.map((c) => c.code));
        if (cc.has("mood")) ev.pathways.push("mental_health");
        hd.push(days(t0, s.date)); hz.push(zp.composite);
        const bl = (baseline[ch] = baseline[ch] || []);
        const clean = !(cc.has("mood") || cc.has("illness_medication") || cc.has("assisted"));
        if (bl.length < C.BASELINE_SESSIONS) {
          if (clean || idx >= C.BASELINE_MAX_SESSIONS - 1) bl.push({ idx, raw, z: zp.composite, s });
          ev.level = lvMax(ev.level, "BASELINE");
          ev.reasons.push(`Building personal baseline (${bl.length}/${C.BASELINE_SESSIONS} sessions, channel: ${ch})`);
          if (bl.length === C.BASELINE_SESSIONS) {
            const bz = bl.reduce((a, b) => a + b.z, 0) / bl.length; ev.baseline_composite_z = r3(bz);
            if (bz <= C.LOW_BASELINE_Z) {
              ev.level = lvMax(ev.level, "CLINICIAN_REVIEW");
              ev.reasons.push(`Baseline score below expected range for age and education (composite z ${bz.toFixed(2)} <= ${C.LOW_BASELINE_Z})`);
              ev.drivers.push({ input: "Baseline composite (education-stratified)", value: r2(bz), threshold: C.LOW_BASELINE_Z });
              ev.pathways.push("memory_clinic");
            }
          }
          if (fflag && ev.level === "BASELINE") { ev.reasons.push("Informant questionnaire above cutoff; clinician to be informed"); ev.level = "CLINICIAN_REVIEW"; ev.pathways.push("primary_care"); }
          ev.next_action = "baseline_next";
          if (ev.level === "BASELINE" && cc.has("mood")) ev.reasons.push("Mood screen positive: support information shown, mental-health pathway offered");
          evals.push(ev); continue;
        }
        ev.level = lvMax(ev.level, "STABLE");
        const bIdx = bl.map((b) => b.idx);
        const crci = rci(zp.composite, idx, bl.map((b) => b.z), bIdx, 1.0, C.COMPOSITE_R, compositePractice());
        const drci = {};
        DOMAINS.forEach((d) => (drci[d] = rci(raw[d], idx, bl.map((b) => b.raw[d]), bIdx, C.NORMS[d].sd, C.DOMAINS[d].r, C.DOMAINS[d].practice)));
        ev.rci = { composite: crci, domains: drci };
        ev.change_interval_90 = [r2(crci.observed_change - crci.expected_practice - 1.645 * crci.se_diff), r2(crci.observed_change - crci.expected_practice + 1.645 * crci.se_diff)];
        const domDec = DOMAINS.filter((d) => drci[d].rci <= C.RCI_DOMAIN_CHECK);
        const keys = new Set(); if (crci.rci <= C.RCI_CHECK) keys.add("composite");
        domDec.filter((d) => C.TRIGGER_DOMAINS.includes(d)).forEach((d) => keys.add(d));
        const decline = keys.size > 0;
        const dsb = days(bl[bl.length - 1].s.date, s.date);
        const large = crci.rci <= C.RCI_LARGE || (dsb <= 120 && crci.baseline - zp.composite >= C.RAPID_DROP_Z);
        ev.slope_per_year = slopePerYear(hd, hz);
        if (crci.rci <= C.RCI_CHECK) ev.drivers.push({ input: "Overall score (composite)", value: crci.rci, threshold: C.RCI_CHECK, change: crci.observed_change, metric: "RCI" });
        domDec.forEach((d) => ev.drivers.push({ input: DLABEL[d], value: drci[d].rci, threshold: C.RCI_DOMAIN_CHECK, change: drci[d].observed_change, metric: "RCI" }));
        const prev = lastPost[ch];
        const prevDecline = !!(prev && [...(prev._keys || [])].some((k) => keys.has(k)));
        ev._keys = keys; ev.decline_signals = [...keys].sort();
        if (large && decline) {
          ev.level = lvMax(ev.level, "URGENT"); ev.reasons.push("Large or rapid decline from personal baseline");
          ev.pathways.push("memory_clinic"); if (cc.has("mood")) ev.pathways.push("mental_health");
          if (conf.length) ev.reasons.push("Confounders present and shown to clinician, but size of change requires prompt review");
        } else if (decline && prevDecline && !cc.has("assisted")) {
          ev.level = lvMax(ev.level, "CLINICIAN_REVIEW"); ev.reasons.push("Decline confirmed on repeat with an alternate form"); ev.pathways.push("memory_clinic");
        } else if (decline && fflag && !(cc.has("mood") || cc.has("illness_medication") || cc.has("sensory"))) {
          ev.level = lvMax(ev.level, "CLINICIAN_REVIEW"); ev.reasons.push("Decline plus an independent informant-reported functional signal"); ev.pathways.push("memory_clinic");
        } else if (decline) {
          ev.level = lvMax(ev.level, "CHECK_AGAIN");
          ev.reasons.push(conf.length ? "Change beyond measurement noise, but possible explanation present: " + conf.map((c) => c.label.toLowerCase()).join(", ")
                                      : "One result beyond the reliable-change range; repeat with an alternate form to confirm");
        } else {
          ev.reasons.push(conf.length ? "Within reliable-change range; context factors noted: " + conf.map((c) => c.code).join(", ") : "Within reliable-change range of personal baseline");
          if (fflag) { ev.level = lvMax(ev.level, "CHECK_AGAIN"); ev.reasons.push("Informant questionnaire above cutoff without measured decline; repeat and inform clinician"); }
        }
        if (cc.has("mood") && (ev.level === "STABLE" || ev.level === "CHECK_AGAIN")) ev.reasons.push("Mood screen positive: support information shown, mental-health pathway offered");
        ev.next_action = { STABLE: "routine", CHECK_AGAIN: "repeat_2_4_weeks", CLINICIAN_REVIEW: "review_task", URGENT: "urgent_review_task" }[ev.level];
        lastPost[ch] = ev; evals.push(ev);
      }
      for (const ev of evals) {
        ev.pathways = [...new Set(ev.pathways)].sort();
        ev.held_for_clinician = ev.level === "CLINICIAN_REVIEW" || ev.level === "URGENT";
        delete ev._keys;
      }
      return evals;
    }
    function evaluate(p, sessions) {
      const h = evaluateHistory(p, sessions);
      return { participant_id: p.id, latest: h.length ? h[h.length - 1] : null, history: h };
    }
    function formForSession(i, seed) { const F = ["A", "B", "C"]; return F[(seed + i) % 3]; }
    return { LEVELS, DOMAINS, DLABEL, normalize, scoreTranscripts, zProfile, compositeZ, expectedRaw, evaluate, evaluateHistory, audioGate, formForSession };
  }
  if (typeof module !== "undefined") module.exports = makeEngine; else root.makeEngine = makeEngine;
})(typeof window !== "undefined" ? window : globalThis);
