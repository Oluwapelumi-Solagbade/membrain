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
console.log(`${cases.length} cases, ${n} session evaluations, ${fail} mismatches`);
process.exit(fail ? 1 : 0);
