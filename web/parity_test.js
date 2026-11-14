// Replays tests/golden_vectors.json through the JS engine; must match Python exactly.
const fs = require("fs"); const path = require("path");
global.window = {}; eval(fs.readFileSync(path.join(__dirname, "data.js"), "utf8"));
const makeEngine = require("./engine.js"); const E = makeEngine(window.MB_DATA);
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tests", "golden_vectors.json"), "utf8"));
let fail = 0, n = 0;
for (const c of cases) {
  const got = E.evaluate(c.participant, c.sessions).history.map((h) => h.level); n += got.length;
  if (JSON.stringify(got) !== JSON.stringify(c.expected_levels)) { fail++; console.log("MISMATCH", c.participant.id, got, c.expected_levels); }
}
// scoring parity spot check
const r = E.scoreTranscripts({ memory_immediate: "جَمَل، الشباك، برتقال وقهوة والقمر", fluency: "كلب قطة جمل حصان الحصان أسد دب" }, "A", "ar");
if (r.raw.memory_immediate !== 5 || r.raw.fluency !== 6) { fail++; console.log("scoring mismatch", r.raw); }
// navigator metrics parity on the synthetic pathway log (expected values computed in Python at export time)
const makeNav = require("./navigator.js"); const NV = makeNav(window.MB_DATA.navigator);
const log = window.MB_DATA.navigator.synthetic_log; const jm = NV.metrics(log.referrals, log.people);
const pm = window.MB_DATA.navigator.synthetic_metrics;
for (const k of Object.keys(pm)) if (JSON.stringify(pm[k]) !== JSON.stringify(jm[k])) { fail++; console.log("NAV MISMATCH", k, pm[k], jm[k]); }
const m1 = NV.match("memory_clinic", { language: "tl", funding: "basic", emirate: "Abu Dhabi" }); if (!m1.gap || !m1.services.length) { fail++; console.log("nav match mismatch"); }
console.log(`navigator metrics: ${Object.keys(pm).length} fields compared`);
// genomics parity
const GXJ = require("./genomics.js");
for (const c of window.MB_DATA.genomics_cases) {
  const j = GXJ.context(c.person); const want = c.expected;
  for (const k of Object.keys(want)) if (JSON.stringify(want[k]) !== JSON.stringify(j[k])) { fail++; console.log("GX MISMATCH", c.person.id, k, want[k], j[k]); }
}
console.log(`genomics: ${window.MB_DATA.genomics_cases.length} cases compared`);
console.log(`${cases.length} cases, ${n} session evaluations, ${fail} mismatches`);
process.exit(fail ? 1 : 0);
