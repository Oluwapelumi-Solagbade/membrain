"use client";

import { AudioLines, CheckCircle2, FlaskConical, Gauge, ListChecks, Scale, Timer, UsersRound } from "lucide-react";
import { PageHeader, Panel, Stat, SyntheticBadge } from "../parts";
import { Fact, Note, ci, num, pct } from "./common";
import programme from "@/lib/generated/programme-data.json";
import { EDUCATION_LABEL } from "@/lib/mb";

type CI3 = [number, number, number];
type Arm = { n: number; tp: number; fp: number; fn: number; tn: number; sensitivity: CI3; specificity: CI3; ppv: CI3; npv: CI3; referrals_per_confirmed: number; false_referrals: number };
type Block = { n: number; completion_unaided: number; test_retest_icc: number; practice_effect_z: number; n_retest_pairs: number; membrain: Arm; usual_care: Arm; baseline_stratified: Arm; baseline_naive: Arm; change_detection: Arm };
type Validation = {
  n: number;
  seed: number;
  assumptions: Record<string, unknown> & { usual_care?: string; uae_risk_profile?: string; status_prevalence_age50_75?: Record<string, number>; dialect_mix?: Record<string, number>; education_mix?: Record<string, number>; schedule_weeks?: number[] };
  summary: {
    overall: Block;
    subgroups: Record<"dialect" | "age_band" | "education", Record<string, Block>>;
    time_to_assessment_weeks: { membrain_median: number; membrain_n: number; usual_care_median: number; usual_care_n: number; assumptions: string };
    confounder_rule_ablation: { alerts_with_rules: number; alerts_without_rules: number; false_alerts_with_rules: number; false_alerts_without_rules: number };
    workload: { check_again_repeats: number; sessions_total: number };
    exploratory_voice: { speech_rate_auc_impairment: number; note: string };
    prevalence: { impaired: number; decline_12m: number };
  };
};
type Gate = { metric: string; label: string; target: string; value: number | null; pass: boolean | null };
type NavAI = { rules: { n: number; gates: Gate[]; urgent_recall_cases: string; urgent_recall_wilson_lower95: number; red_flag_false_alarms: string; onset_exact: number; confounder_f1: number; timeline_cases: string } };

const V = programme.validation as unknown as Validation;
const NA = programme.navai as unknown as NavAI;
const O = V.summary.overall;

const ARMS: { key: keyof Pick<Block, "membrain" | "usual_care" | "baseline_stratified" | "baseline_naive" | "change_detection">; label: string; hint: string }[] = [
  { key: "membrain", label: "MemBrain", hint: "Own baseline plus norms for age and schooling, confirmed on repeat" },
  { key: "usual_care", label: "Usual care", hint: "Screen at week 0 and 52, education-blind norms" },
  { key: "baseline_stratified", label: "One-off screen, adjusted norms", hint: "First visit only, norms for age and schooling" },
  { key: "baseline_naive", label: "One-off screen, blind norms", hint: "First visit only, one cutoff for everyone" },
  { key: "change_detection", label: "Change only", hint: "Own baseline, no norms" },
];

/** A 95% interval drawn on a 40–100% scale, with the point estimate as a dot. */
function Range({ t, tone }: { t: CI3; tone: string }) {
  const at = (x: number) => `${((Math.max(0.4, Math.min(1, x)) - 0.4) / 0.6) * 100}%`;
  return (
    <span className="relative block h-5" aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#e4e5e1]" />
      <span className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${tone} opacity-40`} style={{ left: at(t[1]), width: `calc(${at(t[2])} - ${at(t[1])})` }} />
      <span className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${tone}`} style={{ left: at(t[0]) }} />
    </span>
  );
}

function GateStatus({ pass }: { pass: boolean | null }) {
  if (pass === null) return <span className="rounded-full bg-[#efefeb] px-2.5 py-0.5 text-[12.5px] font-semibold text-body">n/a</span>;
  return pass ? <span className="rounded-full bg-lv-stable-soft px-2.5 py-0.5 text-[12.5px] font-semibold text-lv-stable">Pass</span> : <span className="rounded-full bg-lv-review-soft px-2.5 py-0.5 text-[12.5px] font-semibold text-lv-review">Not yet</span>;
}

const gateValue = (g: Gate) => (g.value == null ? "n/a (nothing to check)" : g.metric.includes("latency") ? `${g.value.toFixed(3)} s` : g.value.toFixed(3));
const subLabel = (kind: string, k: string) => (kind === "education" ? EDUCATION_LABEL[k as keyof typeof EDUCATION_LABEL] ?? k : k);

export function ValidationView() {
  const t2a = V.summary.time_to_assessment_weeks;
  const abl = V.summary.confounder_rule_ablation;
  return (
    <>
      <PageHeader title="Validation" sub={`What has been measured, on a simulated cohort of ${V.n.toLocaleString("en-GB")} people and on held-out test sets`} aside={<SyntheticBadge />} />

      <div className="mt-6">
        <Note tone="warn">
          <b>Read this first.</b> The cohort below is simulated (seed {V.seed}), with assumptions written down at the bottom of this page. It shows that the rules behave as designed against a fair comparison, including people with little schooling and speakers of different dialects. It does not show how MemBrain performs with real people; that needs the pilot.
        </Note>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat tone="stable" icon={Scale} label="Sensitivity" value={pct(O.membrain.sensitivity[0])} note={`Usual care ${pct(O.usual_care.sensitivity[0])} · 95% CI ${pct(O.membrain.sensitivity[1])}–${pct(O.membrain.sensitivity[2])}`} />
        <Stat tone="referral" icon={Gauge} label="Specificity" value={pct(O.membrain.specificity[0])} note={`Usual care ${pct(O.usual_care.specificity[0])} · 95% CI ${pct(O.membrain.specificity[1])}–${pct(O.membrain.specificity[2])}`} />
        <Stat tone="neutral" icon={Timer} label="Weeks to assessment" value={t2a.membrain_median} note={`Median; usual care ${t2a.usual_care_median} weeks`} />
        <Stat tone="check" icon={UsersRound} label="Referrals per confirmed case" value={num(O.membrain.referrals_per_confirmed)} note={`Usual care ${num(O.usual_care.referrals_per_confirmed)}; fewer is better`} />
      </div>

      <div className="mt-6">
        <Panel title="MemBrain against usual care and simpler rules" icon={Scale} aside={<span className="text-[13.5px] text-body">95% intervals in brackets</span>}>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[14.5px]">
              <thead>
                <tr className="text-left text-[13.5px] text-body">
                  {["Approach", "Sensitivity", "Specificity", "PPV", "NPV", "False referrals"].map((h) => (
                    <th key={h} className="bg-[#f5f5f2] px-3 py-2.5 font-medium first:rounded-l-lg last:rounded-r-lg">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ARMS.map((a) => {
                  const r = O[a.key];
                  return (
                    <tr key={a.key} className={a.key === "membrain" ? "bg-[#f4f8f4]" : ""}>
                      <td className="border-b border-[#f0f0ec] px-3 py-2.5">
                        <span className="font-semibold">{a.label}</span>
                        <span className="block text-[12.5px] text-muted">{a.hint}</span>
                      </td>
                      <td className="border-b border-[#f0f0ec] px-3 py-2.5 tabular-nums">{ci(r.sensitivity)}</td>
                      <td className="border-b border-[#f0f0ec] px-3 py-2.5 tabular-nums">{ci(r.specificity)}</td>
                      <td className="border-b border-[#f0f0ec] px-3 py-2.5 tabular-nums">{ci(r.ppv)}</td>
                      <td className="border-b border-[#f0f0ec] px-3 py-2.5 tabular-nums">{ci(r.npv)}</td>
                      <td className="border-b border-[#f0f0ec] px-3 py-2.5 tabular-nums">
                        {r.false_referrals} <span className="text-muted">of {r.n.toLocaleString("en-GB")}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            {(["sensitivity", "specificity"] as const).map((m) => (
              <div key={m}>
                <p className="text-[14px] font-semibold capitalize">{m}, 40–100%</p>
                {(["membrain", "usual_care"] as const).map((k) => (
                  <div key={k} className="mt-2 grid grid-cols-[96px_1fr_52px] items-center gap-3 text-[13.5px]">
                    <span className="text-body">{k === "membrain" ? "MemBrain" : "Usual care"}</span>
                    <Range t={O[k][m]} tone={k === "membrain" ? "bg-deep" : "bg-[#9aa39f]"} />
                    <span className="text-right font-semibold tabular-nums">{pct(O[k][m][0])}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <Panel title="Reliability and burden" icon={Gauge}>
          <Fact k="Completed without help" v={pct(O.completion_unaided, 1)} />
          <Fact k="Test–retest reliability (ICC)" v={num(O.test_retest_icc, 3)} hint={`${O.n_retest_pairs.toLocaleString("en-GB")} retest pairs`} />
          <Fact k="Practice effect" v={`${num(O.practice_effect_z)} z`} hint="Gain from repeating the test; the engine corrects for it" />
          <Fact k="Repeat check-ins asked for" v={V.summary.workload.check_again_repeats.toLocaleString("en-GB")} hint={`Out of ${V.summary.workload.sessions_total.toLocaleString("en-GB")} sessions`} />
        </Panel>
        <Panel title="What the confounder rules change" icon={ListChecks}>
          <Fact k="Alerts with mood, sleep and illness rules" v={abl.alerts_with_rules} hint={`${abl.false_alerts_with_rules} of them false`} />
          <Fact k="Alerts without those rules" v={abl.alerts_without_rules} hint={`${abl.false_alerts_without_rules} of them false`} />
          <Fact k="Time to assessment, MemBrain" v={`${t2a.membrain_median} weeks`} hint={`Median of ${t2a.membrain_n} who declined`} />
          <Fact k="Time to assessment, usual care" v={`${t2a.usual_care_median} weeks`} hint={t2a.assumptions} />
        </Panel>
      </div>

      <div className="mt-5">
        <Panel title="Fairness across groups" icon={UsersRound} aside={<span className="text-[13.5px] text-body">MemBrain, with usual care for comparison</span>}>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[14.5px]">
              <thead>
                <tr className="text-left text-[13.5px] text-body">
                  {["Group", "n", "Sensitivity", "Specificity", "Usual care sensitivity", "ICC", "Completed unaided"].map((h) => (
                    <th key={h} className="bg-[#f5f5f2] px-3 py-2.5 font-medium first:rounded-l-lg last:rounded-r-lg">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              {(["dialect", "education", "age_band"] as const).map((kind) => (
                <tbody key={kind}>
                  <tr>
                    <td colSpan={7} className="px-3 pb-1 pt-4 text-[12.5px] font-semibold uppercase tracking-[0.12em] text-leaf">
                      {kind === "age_band" ? "Age band" : kind === "education" ? "Schooling" : "Dialect"}
                    </td>
                  </tr>
                  {Object.entries(V.summary.subgroups[kind]).map(([k, b]) => (
                    <tr key={k}>
                      <td className="border-b border-[#f0f0ec] px-3 py-2">{subLabel(kind, k)}</td>
                      <td className="border-b border-[#f0f0ec] px-3 py-2 tabular-nums text-body">{b.n}</td>
                      <td className="border-b border-[#f0f0ec] px-3 py-2 tabular-nums">{ci(b.membrain.sensitivity)}</td>
                      <td className="border-b border-[#f0f0ec] px-3 py-2 tabular-nums">{ci(b.membrain.specificity)}</td>
                      <td className="border-b border-[#f0f0ec] px-3 py-2 tabular-nums text-body">{pct(b.usual_care.sensitivity[0])}</td>
                      <td className="border-b border-[#f0f0ec] px-3 py-2 tabular-nums">{num(b.test_retest_icc, 3)}</td>
                      <td className="border-b border-[#f0f0ec] px-3 py-2 tabular-nums">{pct(b.completion_unaided)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <Panel title="Concern extractor: release gates" icon={CheckCircle2} aside={<span className="text-[13.5px] text-body">{NA.rules.n} held-out test stories</span>}>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[420px] border-separate border-spacing-0 text-[14.5px]">
              <thead>
                <tr className="text-left text-[13.5px] text-body">
                  {["Gate", "Target", "Rules extractor", ""].map((h, i) => (
                    <th key={i} className="bg-[#f5f5f2] px-3 py-2.5 font-medium first:rounded-l-lg last:rounded-r-lg">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {NA.rules.gates.map((g) => (
                  <tr key={g.metric}>
                    <td className="border-b border-[#f0f0ec] px-3 py-2">{g.label}</td>
                    <td className="border-b border-[#f0f0ec] px-3 py-2 font-mono text-[13.5px] text-body">{g.target}</td>
                    <td className="border-b border-[#f0f0ec] px-3 py-2 font-mono text-[13.5px]">{gateValue(g)}</td>
                    <td className="border-b border-[#f0f0ec] px-3 py-2 text-right">
                      <GateStatus pass={g.pass} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[13.5px] leading-relaxed text-body">
            Urgent recall is {NA.rules.urgent_recall_cases} with {NA.rules.red_flag_false_alarms} false alarms, but so few cases only prove recall above {pct(NA.rules.urgent_recall_wilson_lower95)} (Wilson lower bound). Showing 99% needs about 300 red-flag stories. The unsupported-field gate is n/a for the rules: every rule field quotes the narrative, so there is nothing to drop. It becomes a real test on the language-model run.
          </p>
        </Panel>

        <Panel title="Speech recognition, Emirati Arabic" icon={AudioLines}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#f4f8f4] p-4">
              <p className="text-[13px] text-body">MemBrain adapter</p>
              <p className="mt-1 font-serif text-[34px] font-semibold leading-none text-deep">41.2%</p>
              <p className="mt-1 text-[12.5px] text-muted">word error rate</p>
            </div>
            <div className="rounded-xl bg-[#f5f5f2] p-4">
              <p className="text-[13px] text-body">Gulf Whisper, starting point</p>
              <p className="mt-1 font-serif text-[34px] font-semibold leading-none text-ink">49.5%</p>
              <p className="mt-1 text-[12.5px] text-muted">word error rate</p>
            </div>
          </div>
          <Fact k="Difference" v="−8.3 points" hint="95% CI −16.9 to −1.2 (paired bootstrap)" />
          <Fact k="Test set" v="103 clips" hint="Held-out Emirati broadcast speech, topics not seen in training" />
          <p className="mt-2 text-[13.5px] leading-relaxed text-body">
            Measured on adult broadcast speech in one dialect. Older speakers, other dialects and the check-in&apos;s own task words still need measuring, and task-word recall did not improve on its 19 words.
          </p>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <Panel title="What this does and does not show" icon={FlaskConical}>
          <ul className="space-y-2.5 text-[14.5px] leading-relaxed text-body">
            <li>
              <b className="text-ink">Shows:</b> against the same simulated people, comparing each person with their own baseline and with norms for their age and schooling finds more true decline ({pct(O.membrain.sensitivity[0])} against {pct(O.usual_care.sensitivity[0])}) with fewer false referrals ({O.membrain.false_referrals} against {O.usual_care.false_referrals}).
            </li>
            <li>
              <b className="text-ink">Shows:</b> results hold up across dialects, schooling bands and ages within the simulation, including people with no formal schooling.
            </li>
            <li>
              <b className="text-ink">Does not show:</b> real-world accuracy. The simulated impairment rate ({pct(V.summary.prevalence.impaired, 1)}), decline rates and dialect effects are assumptions, listed below.
            </li>
            <li>
              <b className="text-ink">Exploratory only:</b> speech rate separated impairment with AUC {num(V.summary.exploratory_voice.speech_rate_auc_impairment, 3)} in simulation. It is not used for any alert.
            </li>
          </ul>
        </Panel>

        <Panel title="Simulation assumptions" icon={ListChecks} aside={<span className="text-[13px] text-body">n = {V.n.toLocaleString("en-GB")} · seed {V.seed}</span>}>
          <dl className="space-y-3 text-[14px]">
            {V.assumptions.status_prevalence_age50_75 && (
              <div>
                <dt className="text-muted">Status at age 50–75</dt>
                <dd>
                  {Object.entries(V.assumptions.status_prevalence_age50_75)
                    .map(([k, v]) => `${k === "mci" ? "MCI" : k} ${pct(v)}`)
                    .join(" · ")}
                </dd>
              </div>
            )}
            {V.assumptions.dialect_mix && (
              <div>
                <dt className="text-muted">Dialect mix</dt>
                <dd>
                  {Object.entries(V.assumptions.dialect_mix)
                    .map(([k, v]) => `${k} ${pct(v)}`)
                    .join(" · ")}
                </dd>
              </div>
            )}
            {V.assumptions.education_mix && (
              <div>
                <dt className="text-muted">Schooling mix</dt>
                <dd>
                  {Object.entries(V.assumptions.education_mix)
                    .map(([k, v]) => `${EDUCATION_LABEL[k as keyof typeof EDUCATION_LABEL] ?? k} ${pct(v)}`)
                    .join(" · ")}
                </dd>
              </div>
            )}
            {V.assumptions.schedule_weeks && (
              <div>
                <dt className="text-muted">Check-in schedule</dt>
                <dd>Weeks {V.assumptions.schedule_weeks.join(", ")}</dd>
              </div>
            )}
            {V.assumptions.usual_care && (
              <div>
                <dt className="text-muted">Usual care, as modelled</dt>
                <dd>{V.assumptions.usual_care}</dd>
              </div>
            )}
            {V.assumptions.uae_risk_profile && (
              <div>
                <dt className="text-muted">Risk factors</dt>
                <dd>{V.assumptions.uae_risk_profile}</dd>
              </div>
            )}
          </dl>
          <details className="mt-4 text-[13.5px]">
            <summary className="cursor-pointer font-medium text-leaf">All assumptions, as exported</summary>
            <pre className="mt-2 max-h-[320px] overflow-auto rounded-xl bg-[#f5f5f2] p-3 font-mono text-[12px] leading-relaxed text-body">{JSON.stringify(V.assumptions, null, 2)}</pre>
          </details>
        </Panel>
      </div>
    </>
  );
}
