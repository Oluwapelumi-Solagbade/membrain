// The prevention plan and risk context for someone enrolled in the browser-only demo. A port of the rule tests in
// membrain/prevention.py (prevention_plan, risk_context); the texts come from there through programme-data.json.
// Against the server, the server computes both. Keep the tests here in step with prevention.py.
import programmeData from "../generated/programme-data.json";
import type { Lang } from "../mb";
import type { PreventionPlan } from "./types";

type Rule = { id: string; evidence: string; en: string; ar: string };
const D = programmeData as unknown as { prevention_rules: Rule[]; prevention_always: { en: string; ar: string } };
export type Context = Record<string, unknown>;

const n = (v: unknown) => (typeof v === "number" ? v : 0);
const TEST: Record<string, (c: Context) => boolean> = {
  bp: (c) => n(c.sbp) >= 130 || n(c.dbp) >= 80 || !!c.hypertension,
  glucose: (c) => n(c.hba1c) >= 6.5 || !!c.diabetes,
  ldl: (c) => n(c.ldl) >= 3.0,
  activity: (c) => (typeof c.activity_min_week === "number" ? c.activity_min_week : 999) < 150,
  sleep: (c) => (typeof c.sleep_hours === "number" && c.sleep_hours ? c.sleep_hours : 7) < 6 || !!c.snoring,
  hearing: (c) => !!c.hearing_difficulty && !c.hearing_aid,
  vision: (c) => !!c.vision_difficulty,
  smoking: (c) => !!c.smoker,
  weight: (c) => n(c.bmi) >= 30,
  social: (c) => !!c.social_isolation,
  mood: (c) => !!c.mood_positive,
};

export function preventionPlan(ctx: Context, lang: Lang): NonNullable<PreventionPlan> {
  const items = D.prevention_rules.filter((r) => TEST[r.id]?.(ctx)).map((r) => ({ rule: r.id, text: r[lang], evidence: r.evidence }));
  items.push({ rule: "cognitive_engagement", text: D.prevention_always[lang], evidence: "Lancet Commission 2024 (education / cognitive activity)" });
  return { version: "pv-0.2.1", items: items.slice(0, 5) };
}

const REVERSIBLE = ["TSH", "Vitamin B12", "Folate", "Full blood count", "HbA1c", "Renal function", "Medication review (anticholinergic burden)",
  "Depression (PHQ-9)", "Sleep apnoea screen (STOP-BANG)", "Hearing and vision"];

export function riskContext(ctx: Context, education: string): Record<string, unknown> {
  const m: Record<string, boolean> = {
    hypertension: n(ctx.sbp) >= 140 || !!ctx.hypertension,
    diabetes: n(ctx.hba1c) >= 6.5 || !!ctx.diabetes,
    ldl: n(ctx.ldl) >= 3.0,
    physical_inactivity: (typeof ctx.activity_min_week === "number" ? ctx.activity_min_week : 999) < 150,
    smoking: !!ctx.smoker,
    obesity: n(ctx.bmi) >= 30,
    hearing_loss: !!ctx.hearing_difficulty,
    vision_loss: !!ctx.vision_difficulty,
    depression: !!ctx.mood_positive,
    social_isolation: !!ctx.social_isolation,
    low_education: education === "none" || education === "primary",
  };
  const present = Object.keys(m).filter((k) => m[k]);
  return { modifiable_factors_present: present, count: present.length, of: 14, family_history_dementia: ctx.family_history_dementia ?? null, genomic: null, reversible_cause_checks: REVERSIBLE };
}
