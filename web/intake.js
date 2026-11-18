/* MemBrain Navigator intake: JavaScript port of membrain/intake.py (rules extractor, referral drafter and
   grounding verifier). Parity with Python is checked in web/parity_test.js. Lexicons come from data.js. */
(function (root) {
  function makeIntake(X) {
    const isLetter = (ch) => /\p{L}/u.test(ch);
    const DIAC = new Set(); for (let c = 0x0610; c < 0x061B; c++) DIAC.add(String.fromCharCode(c));
    for (let c = 0x064B; c < 0x0660; c++) DIAC.add(String.fromCharCode(c)); DIAC.add("ٰ"); DIAC.add("ـ");
    for (let c = 0x06D6; c < 0x06EE; c++) DIAC.add(String.fromCharCode(c));
    const MAP = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي", "’": "'", "‘": "'", "`": "'" };
    for (let i = 0; i < 10; i++) { MAP[String.fromCharCode(0x0660 + i)] = String(i); MAP[String.fromCharCode(0x06F0 + i)] = String(i); }

    function normalise(text) {
      const out = [], idx = []; const t = text || "";
      for (let i = 0; i < t.length; i++) {
        let ch = t[i]; if (DIAC.has(ch)) continue;
        const lo = ch.toLowerCase(); ch = lo.length === 1 ? lo : ch; ch = MAP[ch] || ch;
        if (/\s/.test(ch)) { if (out.length && out[out.length - 1] === " ") continue; ch = " "; }
        out.push(ch); idx.push(i);
      }
      return [out.join(""), idx];
    }
    const norm1 = (s) => normalise(s)[0];
    function* entries(lst) { for (let e of lst || []) { const weak = e.startsWith("~"); if (weak) e = e.slice(1); const rb = e.endsWith("$"); if (rb) e = e.slice(0, -1); yield [norm1(e), weak, rb]; } }
    function* find(norm, phrase, rb) {
      let i = norm.indexOf(phrase);
      while (i !== -1) {
        let ok = i === 0 || !isLetter(norm[i - 1]);
        if (!ok) for (const p of X.AR_PREFIX) { const j = i - p.length; if (j >= 0 && norm.slice(j, i) === p && (j === 0 || !isLetter(norm[j - 1]))) { ok = true; break; } }
        const end = i + phrase.length;
        if (ok && rb && end < norm.length && isLetter(norm[end])) ok = false;
        if (ok) yield [i, end];
        i = norm.indexOf(phrase, i + 1);
      }
    }
    const rfind = (s, c, start) => (start > 0 ? s.lastIndexOf(c, start - 1) : -1);
    const split = (s) => s.split(/\s+/).filter(Boolean);
    function negated(norm, start, lang) {
      const cs = Math.max(...[...X.CLAUSE].map((c) => rfind(norm, c, start))) + 1;
      const pre = norm.slice(cs, start);
      if (X.NEG_CLAUSE[lang].some((ph) => pre.includes(norm1(ph)))) return true;
      const toks = split(pre).slice(-2); const neg = new Set(X.NEG[lang]);
      return toks.some((t) => neg.has(t) || (lang === "ar" && t !== "ولا" && "وف".includes(t[0]) && neg.has(t.slice(1))));
    }
    // A hit that starts one of these phrases belongs elsewhere (weak hearing is not a stroke's new weakness).
    const notAHit = (norm, start, lang) => ((X.NOT_A_HIT || {})[lang] || []).some((x) => norm.startsWith(norm1(x), start));
    const span = (idx, s, e) => [idx[s], idx[e - 1] + 1];
    const detectLang = (t) => { let ar = 0; for (const c of t) if (c >= "؀" && c <= "ۿ") ar++; return ar > t.length * 0.2 ? "ar" : "en"; };
    function confidence(s, w) { if (s >= 2) return 0.95; if (s === 1) return w ? 0.9 : 0.85; return w >= 2 ? 0.7 : 0.55; }

    // --- onset
    const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, few: 3, "couple of": 2, several: 4, last: 1, past: 1, "18": 18 };
    const RX_EN = /(?<![a-z])([0-9]+|an|a|one|two|three|four|five|six|few|couple of|several|last|past)\s+(?:few\s+)?(?:or\s+\w+\s+)?(day|week|month|year)s?(?![a-z])/g;
    const AR_UNITS = { "عام": ["year", 1], "عامين": ["year", 2], "اعوام": ["year", 3], "يوم": ["day", 1], "ايام": ["day", 3], "يومين": ["day", 2], "اسبوع": ["week", 1], "اسابيع": ["week", 3], "اسبوعين": ["week", 2], "شهر": ["month", 1], "شهور": ["month", 3], "اشهر": ["month", 3], "شهرين": ["month", 2], "سنه": ["year", 1], "سنين": ["year", 3], "سنتين": ["year", 2], "سنوات": ["year", 3] };
    const AR_NUM = { "ثلاثه": 3, "اربعه": 4, "خمسه": 5, "سته": 6, "سبعه": 7, "ثمانيه": 8, "عشره": 10, "بضعه": 3, "بضع": 3, "عده": 4, "كم": 3, "ثلاث": 3, "الثلاث": 3, "اربع": 4, "خمس": 5, "ست": 6, "الست": 6, "سبع": 7, "ثمان": 8, "عشر": 10 };
    const RX_AR = /(?<![ء-ي])(?:منذ|من|قبل|خلال)\s+(?:حوالي\s+|تقريبا\s+|نحو\s+)?(?:([0-9]+|ثلاثه|اربعه|خمسه|سته|سبعه|ثمانيه|عشره|بضعه|بضع|عده|كم|ثلاث|الثلاث|اربع|خمس|ست|الست|سبع|ثمان|عشر)\s+)?(يومين|يوم|ايام|اسبوعين|اسبوع|اسابيع|شهرين|شهر|شهور|اشهر|سنتين|سنه|سنين|سنوات|عامين|عام|اعوام)(?![ء-ي])/g;
    const RX_AR_LAST = /(?<![ء-ي])(?:منذ|من|خلال)\s+(الاسبوع|الشهر|السنه|العام)\s+(?:اللي\s+طاف|الماضي|الماضيه)/g;
    const RX_AR_RECENT = /(?<![ء-ي])(?:في|خلال)\s+(الايام|الاسابيع|الاشهر|الشهور|السنوات|الاعوام)\s+(?:الاخيره|الماضيه|القليله\s+الماضيه)/g;
    const RANK = { days: 0, weeks: 1, months: 2, years: 3 };
    const bucket = (u, n) => (u === "day" ? (n < 14 ? "days" : "weeks") : u === "week" ? (n < 8 ? "weeks" : "months") : u === "month" ? (n < 12 ? "months" : "years") : "years");
    function onset(norm, idx, lang) {
      let best = null; const consider = (b, s, e) => { if (!best || RANK[b] > RANK[best[0]]) best = [b, s, e]; };
      if (lang === "en") {
        for (const m of norm.matchAll(RX_EN)) {
          let n = /^[0-9]+$/.test(m[1]) ? parseInt(m[1], 10) : (NUM[m[1]] ?? 1);
          if ((m[1] === "last" || m[1] === "past") && m[2] === "month" && !m[0].includes("few")) n = 1;
          consider(bucket(m[2], n), m.index, m.index + m[0].length);
        }
      } else {
        for (const m of norm.matchAll(RX_AR_LAST)) consider({ "الاسبوع": "weeks", "الشهر": "months", "السنه": "years", "العام": "years" }[m[1]], m.index, m.index + m[0].length);
        for (const m of norm.matchAll(RX_AR_RECENT)) consider({ "الايام": "days", "الاسابيع": "weeks", "الاشهر": "months", "الشهور": "months", "السنوات": "years", "الاعوام": "years" }[m[1]], m.index, m.index + m[0].length);
        for (const m of norm.matchAll(RX_AR)) { const [u, base] = AR_UNITS[m[2]]; const n = !m[1] ? base : /^[0-9]+$/.test(m[1]) ? parseInt(m[1], 10) : AR_NUM[m[1]]; consider(bucket(u, n), m.index, m.index + m[0].length); }
      }
      return best ? { value: best[0], label: X.ONSET[best[0]], confidence: 0.8, spans: [span(idx, best[1], best[2])] } : null;
    }
    // --- frequency and severity (same phrases and rules as membrain/intake.py)
    const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    function phraseHits(norm, lex, lang) {
      const hits = [];
      for (const [value, byLang] of Object.entries(lex)) for (const ph of (byLang[lang] || [])) {
        const rx = lang === "en" ? new RegExp("(?<![a-z])" + esc(ph) + "(?![a-z])", "g") : new RegExp("(?<![\\u0621-\\u064a])(?:[وف])?" + esc(ph) + "(?![\\u0621-\\u064a])", "g");
        for (const m of norm.matchAll(rx)) hits.push([m.index, m.index + m[0].length, value]);
      }
      return hits.filter((h) => !hits.some((o) => o[0] <= h[0] && h[1] <= o[1] && (o[1] - o[0]) > (h[1] - h[0])));
    }
    function graded(norm, idx, lang, lex, rank, labels) {
      const hits = phraseHits(norm, lex, lang); if (!hits.length) return null;
      let best = hits[0]; for (const h of hits) if (rank[h[2]] > rank[best[2]] || (rank[h[2]] === rank[best[2]] && h[0] < best[0])) best = h;
      return { value: best[2], label: labels[best[2]], confidence: 0.7, spans: [span(idx, best[0], best[1])] };
    }
    function* sentences(norm) { let s = 0; const t = norm + "."; for (let i = 0; i < t.length; i++) if (X.SENT.includes(t[i])) { if (i > s) yield [s, i]; s = i + 1; } }
    function timeline(norm, idx, lang) {
      const out = [];
      for (const [s, e] of sentences(norm)) {
        const seg = norm.slice(s, e);
        const cues = []; for (const t of X.TAKEOVER[lang]) for (const [a] of find(seg, norm1(t), false)) cues.push(a);
        if (!cues.length) continue;
        const whos = []; for (const [k, lx] of Object.entries(X.WHO_LEX)) for (const [ph, , rb] of entries(lx[lang])) for (const [a, b] of find(seg, ph, rb)) whos.push([a, b, k]);
        if (!whos.length) continue;
        const acts = []; for (const [k, lx] of Object.entries(X.ACT_LEX)) for (const [ph, , rb] of entries(lx[lang])) for (const [a, b] of find(seg, ph, rb)) acts.push([a, b, k]);
        if (!acts.length) continue;
        const dist = (w) => Math.min(...cues.map((c) => Math.abs(w[0] - c)));
        let who = whos[0]; for (const w of whos) { const d1 = dist(w), d0 = dist(who); if (d1 < d0 || (d1 === d0 && w[0] < who[0])) who = w; }
        acts.sort((x, y) => x[0] - y[0] || x[1] - y[1] || (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0));
        const seen = new Set();
        for (const [, , k] of acts) { if (seen.has(k)) continue; seen.add(k);
          out.push({ activity: k, activity_label: X.ACTIVITIES[k], who_took_over: who[2], who_label: X.WHO[who[2]], confidence: 0.75, spans: [span(idx, s, e)] }); }
      }
      return out;
    }
    // Mixed Arabic-English text: read with both word lists and merge (same rules as membrain/intake.py)
    function isMixed(text) {
      let ar = 0; for (const ch of text) if (ch >= "\u0600" && ch <= "\u06ff") ar++;
      return ar >= 3 && (text.match(/[A-Za-z]{2,}/g) || []).length >= 2;
    }
    function merge(a, b, text) {
      const out = { ...a }; const fields = a.fields.map((f) => ({ ...f })); const pos = new Map(fields.map((f, i) => [f.kind + "|" + f.key, i]));
      for (const f of b.fields) {
        const k = f.kind + "|" + f.key;
        if (!pos.has(k)) { pos.set(k, fields.length); fields.push({ ...f }); continue; }
        const g = fields[pos.get(k)];
        const uniq = new Map(); for (const sp of [...g.spans, ...f.spans]) uniq.set(sp[0] + ":" + sp[1], [sp[0], sp[1]]);
        const spans = [...uniq.values()].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
        g.confidence = Math.max(g.confidence, f.confidence); g.needs_confirmation = g.confidence < X.REVIEW_BELOW;
        g.spans = spans; g.evidence = spans.map(([s0, e0]) => text.slice(s0, e0));
      }
      out.fields = fields;
      if (b.onset && (!a.onset || RANK[b.onset.value] > RANK[a.onset.value])) out.onset = b.onset;
      const seen = new Set(a.timeline.map((t) => t.activity + "|" + t.who_took_over));
      out.timeline = [...a.timeline, ...b.timeline.filter((t) => !seen.has(t.activity + "|" + t.who_took_over))];
      if (b.frequency && (!a.frequency || X.FREQ_RANK[b.frequency.value] > X.FREQ_RANK[a.frequency.value])) out.frequency = b.frequency;
      if (b.severity && (!a.severity || X.SEV_RANK[b.severity.value] > X.SEV_RANK[a.severity.value])) out.severity = b.severity;
      out.urgent = fields.some((f) => f.kind === "red_flag");
      return out;
    }
    function extract(text, lang) {
      lang = lang || detectLang(text); const one = extractOne(text, lang);
      return (lang === "ar" || lang === "en") && isMixed(text) ? merge(one, extractOne(text, lang === "ar" ? "en" : "ar"), text) : one;
    }
    function extractOne(text, lang) {
      const [norm, idx] = normalise(text); const fields = [];
      const LAB = { domain: X.DOMAINS, red_flag: X.RED_FLAGS, confounder: X.CONFOUNDERS };
      for (const [kind, groups] of Object.entries(X.LEX)) for (const [key, lx] of Object.entries(groups)) {
        const hits = [];
        for (const [ph, weak, rb] of entries(lx[lang])) for (const [a, b] of find(norm, ph, rb)) if (!negated(norm, a, lang) && !(kind === "red_flag" && notAHit(norm, a, lang))) hits.push([a, b, weak]);
        if (!hits.length) continue;
        hits.sort((x, y) => x[0] - y[0] || x[1] - y[1] || (x[2] - y[2]));
        const spans = []; let ns = 0, nw = 0, last = -1;
        for (const [a, b, weak] of hits) { if (a < last) continue; last = b; spans.push(span(idx, a, b)); if (weak) nw++; else ns++; }
        const conf = confidence(ns, nw);
        fields.push({ kind, key, label: LAB[kind][key], confidence: conf, needs_confirmation: conf < X.REVIEW_BELOW, spans, evidence: spans.map(([s, e]) => text.slice(s, e)) });
      }
      const out = { engine: "rules", version: X.INTAKE_VERSION, lang, fields, onset: onset(norm, idx, lang), timeline: timeline(norm, idx, lang),
        frequency: graded(norm, idx, lang, X.FREQ_LEX, X.FREQ_RANK, X.FREQUENCY), severity: graded(norm, idx, lang, X.SEV_LEX, X.SEV_RANK, X.SEVERITY) };
      out.urgent = fields.some((f) => f.kind === "red_flag"); return out;
    }
    function summaryKeys(r) {
      const f = r.fields; const u = (k) => [...new Set(f.filter((x) => x.kind === k).map((x) => x.key))].sort();
      const tl = [...new Set((r.timeline || []).map((t) => t.activity + "|" + t.who_took_over))].sort().map((s) => s.split("|"));
      return { domains: u("domain"), red_flags: u("red_flag"), confounders: u("confounder"), onset: (r.onset || {}).value || null, timeline: tl };
    }

    // --- drafting and verification
    const join = (xs) => (xs.length === 1 ? xs[0] : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
    function confirmedItems(c) {
      const s = new Set(); (c.domains || []).forEach((k) => s.add("dom:" + k)); (c.red_flags || []).forEach((k) => s.add("rf:" + k)); (c.confounders || []).forEach((k) => s.add("cf:" + k));
      if (c.onset) s.add("on:" + c.onset); if (c.frequency) s.add("fr:" + c.frequency); if (c.severity) s.add("sv:" + c.severity);
      (c.timeline || []).forEach(([a, w]) => { s.add("act:" + a); s.add("who:" + w); });
      if ((c.red_flags || []).length || (c.checkin || {}).level === "URGENT") s.add("urgent"); if (c.checkin) s.add("checkin"); s.add("rep:" + (c.reporter || "family")); return s;
    }
    function draft(c) {
      const out = [];
      const repLower = () => (X.DRAFT_REPORTER[c.reporter] ? X.DRAFT_REPORTER[c.reporter][0].toLowerCase() + X.DRAFT_REPORTER[c.reporter].slice(1) : "the family");
      if ((c.red_flags || []).length) out.push({ text: "Urgent: " + repLower() + " reports " + join(c.red_flags.map((k) => X.DRAFT_RF[k])) + ". Please assess urgently; cognitive testing was not started.", sources: c.red_flags.map((k) => "rf:" + k) });
      if ((c.domains || []).length) { const on = c.onset ? " " + X.ONSET[c.onset] : "";
        out.push({ text: `${X.DRAFT_REPORTER[c.reporter] || X.DRAFT_REPORTER.family} reports changes in ${join(c.domains.map((k) => X.DRAFT_DOMAIN[k]))}${on}.`, sources: [...c.domains.map((k) => "dom:" + k), ...(c.onset ? ["on:" + c.onset] : [])] }); }
      if (c.frequency || c.severity) {
        const bits = [...(c.frequency ? [`it happens ${X.FREQUENCY[c.frequency]}`] : []), ...(c.severity ? [`the reporter describes it as ${X.SEVERITY[c.severity]}`] : [])];
        const t = bits.join("; ");
        out.push({ text: t[0].toUpperCase() + t.slice(1) + ".", sources: [...(c.frequency ? ["fr:" + c.frequency] : []), ...(c.severity ? ["sv:" + c.severity] : [])] });
      }
      const q = (c.quotes || []).filter(Boolean).slice(0, 2);
      if (q.length) out.push({ text: "In their words: " + q.map((x) => `“${x}”`).join("; ") + ".", sources: ["quote"] });
      if ((c.timeline || []).length) out.push({ text: "Activities others have taken over: " + c.timeline.map(([a, w]) => `${X.DRAFT_ACT[a]} (now ${X.DRAFT_WHO[w]})`).join("; ") + ".", sources: c.timeline.map(([a]) => "act:" + a) });
      if ((c.confounders || []).length) out.push({ text: "Factors to consider before interpreting this: " + join(c.confounders.map((k) => X.DRAFT_CF[k])) + ".", sources: c.confounders.map((k) => "cf:" + k) });
      const ck = c.checkin; if (ck && ck.level) out.push({ text: `Latest MemBrain check-in: ${X.LEVEL_TXT[ck.level] || ck.level}.` + ((ck.reasons || []).length ? " " + ck.reasons[0] : ""), sources: ["checkin"] });
      out.push({ text: "This is a request for assessment. No diagnosis has been made.", sources: [] });
      return out;
    }
    const strip = (s, chars) => { let a = 0, b = s.length; while (a < b && chars.includes(s[a])) a++; while (b > a && chars.includes(s[b - 1])) b--; return s.slice(a, b); };
    const splitSentences = (t) => (t || "").trim().split(/(?<=[.!?])\s+(?=[A-Z“"(])/).map((p) => p.trim()).filter(Boolean);
    const DISCLAIMER = /(no|not a|without a) diagnosis/;
    function verifySentence(sent, c) {
      const conf = confirmedItems(c); const reasons = [];
      const corpus = norm1([c.narrative || "", ...(((c.checkin || {}).reasons) || [])].join(" "));
      const quotes = [...sent.matchAll(/[“"]([^”"]+)[”"]/g)].map((m) => m[1]);
      for (const q of quotes) if (!corpus.includes(strip(norm1(q), " .,"))) reasons.push(`quote not found in the narrative: “${q.slice(0, 40)}”`);
      let body = sent.replace(/[“"][^”"]*[”"]/g, " ");
      for (const r of ((c.checkin || {}).reasons) || []) if (r) body = body.split(r).join(" ");   // engine output is source text, like a quote
      const nb = norm1(body); const disclaimer = DISCLAIMER.test(nb);
      for (const term of X.BLOCKED) { const rb = term.endsWith("$"); const t = term.replace(/\$$/, ""); if (t === "diagnos" && disclaimer) continue;
        if (!find(nb, t, rb).next().done) reasons.push(`diagnostic term not allowed: '${t}'`); }
      for (const m of nb.matchAll(/[0-9]+/g)) if (!corpus.includes(m[0])) reasons.push(`number ${m[0]} not in the record`);
      const hits = new Map();
      for (const [item, trig] of Object.entries(X.VOCAB)) for (const t of trig) { const rb = t.endsWith("$"); const tt = t.replace(/\$$/, "");
        for (const [a, b] of find(nb, tt, rb)) { if (!hits.has(a)) hits.set(a, []); hits.get(a).push([b, tt, item]); } }
      let covered = -1;
      for (const a of [...hits.keys()].sort((x, y) => x - y)) { const hs = hits.get(a); const longest = Math.max(...hs.map((h) => h[0]));
        if (a < covered && longest <= covered) continue; covered = Math.max(covered, longest);
        const sup = hs.filter((h) => h[0] === longest).map((h) => h[2]);
        if (sup.some((x) => conf.has(x)) || negated(nb, a, "en")) continue;
        const top = hs.reduce((m, h) => (h[0] > m[0] || (h[0] === m[0] && (h[1] > m[1] || (h[1] === m[1] && h[2] > m[2]))) ? h : m));
        reasons.push(`'${top[1]}' is not among the confirmed facts`); }
      const rs = [...new Set(reasons)].sort();
      return { text: sent, ok: !rs.length, reasons: rs, checked_claims: hits.size + quotes.length, disclaimer };
    }
    function verify(textOrSentences, c) {
      const sents = (Array.isArray(textOrSentences) ? textOrSentences : splitSentences(textOrSentences)).map((s) => (typeof s === "object" ? s.text : s));
      const res = sents.map((s) => verifySentence(s, c)); const bad = res.filter((r) => !r.ok).length;
      return { sentences: res, n: res.length, unsupported: bad, grounded: bad === 0, uncheckable: res.filter((r) => r.ok && r.checked_claims === 0 && !r.disclaimer).length };
    }
    function quotesFrom(r, text, n = 2) {
      const out = []; const P = ".!?،,;؟\n";
      for (const f of r.fields.filter((f) => f.kind === "domain").map((f, i) => [f, i]).sort((x, y) => y[0].confidence - x[0].confidence || x[1] - y[1]).map((x) => x[0])) {
        const [a, b] = f.spans[0]; const s = Math.max(...[...P].map((ch) => rfind(text, ch, a))) + 1;
        const ends = [...P].map((ch) => text.indexOf(ch, b)).filter((i) => i !== -1); const e = ends.length ? Math.min(...ends) : text.length;
        const q = text.slice(s, e).trim(); if (q.length >= 6 && q.length <= 140 && !out.includes(q)) out.push(q); if (out.length >= n) break;
      }
      return out;
    }
    return { normalise, extract, summaryKeys, draft, verify, verifySentence, splitSentences, quotesFrom, confirmedItems, detectLang };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = makeIntake; else root.makeIntake = makeIntake;
})(typeof window !== "undefined" ? window : globalThis);
