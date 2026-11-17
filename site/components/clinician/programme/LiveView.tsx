"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, Clock, Database, FileText, MessageSquareText, RefreshCw, Scale, ShieldCheck, UsersRound } from "lucide-react";
import { PageHeader, Panel, Stat } from "../parts";
import { Fact, LevelBar, Note, num, pct } from "./common";
import { authHeader } from "@/lib/auth";
import { getBackend } from "@/lib/workspace/backend";
import type { Level } from "@/lib/mb";

/* Live data: what real visitors have done in this demo (concerns, check-ins, clinician decisions), saved permanently
 * and recomputed on every visit by GET /live/stats (api/live.py). The Validation page next door is the simulated
 * cohort; nothing here is synthetic. */

type Seg = { group: string; people: number; checkins: number; scored: number; completion: number | null; flagged_share: number | null };
type Stats = {
  store: { enabled: boolean; permanent: boolean; repo: string | null; loaded_from: string | null; last_saved: string | null; last_error: string | null; pending: boolean };
  people: number; new_records: number; concerns: number; reporters: Record<string, number>; checkins: number; family_questionnaires: number;
  completion: { scored: number; submitted: number; rate: number | null; not_scored: Record<string, number>; concern_then_checkin: { people: number; did_checkin: number } };
  reliability: { pairs: number; min_pairs: number; icc_3_1?: number; pearson_r?: number; mean_change_z?: number; median_days_apart?: number };
  latest_levels: Partial<Record<Level, number>>;
  review: { flags: number; reviewed: number; agreed: number; dismissed: number; open: number; false_referral_share: number | null; median_days_to_first_action: number | null };
  letters: { drafts: number; by_medgemma: number; template_fallbacks: number; sentences_checked: number; sentences_removed: number; removed_share: number | null;
    median_seconds: number | null; approved: number; approved_medgemma: number; accepted_unchanged: number; accepted_unchanged_share: number | null; median_similarity: number | null };
  second_reader: { reads: number; with_suggestions: number; suggestions: number; dropped_ungrounded: number; median_seconds: number | null };
  souq_route: { done: number; people: number; median_span: number | null; median_accuracy: number | null; repeat_pairs: number; icc_3_1: number | null };
  timing: { referrals: number; median_days_concern_to_referral: number | null; assessed: number; median_days_concern_to_assessment: number | null };
  segments: Record<"language" | "age" | "schooling", Seg[]>;
  not_measurable_yet: string[];
};

const REPORTER: Record<string, string> = { self: "The person", family: "Family", helper: "Household helper", professional: "Professional", coordinator: "Coordinator", unknown: "Not recorded" };
const SCHOOLING: Record<string, string> = { none: "No schooling", primary: "Primary", secondary: "Secondary", tertiary: "University", "not given": "Not given" };

export function LiveView() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"server" | "browser" | null>(null);
  const [at, setAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const b = await getBackend();
      setMode(b.mode === "server" ? "server" : "browser");
      if (b.mode !== "server") return;
      const r = await fetch((b.base ?? "") + "/live/stats", { headers: { ...authHeader() } });
      if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "Sign in as a clinician to see live data." : `Server answered ${r.status}`);
      setS((await r.json()) as Stats);
      setErr(null);
      setAt(new Date());
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(id);
  }, [load]);

  const badge = (
    <span className="inline-flex items-center gap-2 rounded-2xl border border-[#d9ebdd] bg-[#eef5ef] px-4 py-2.5 text-[14.5px] font-medium text-deep">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-lv-stable" /> Live · real use of this demo, not synthetic
    </span>
  );

  if (mode === "browser")
    return (
      <div className="space-y-6">
        <PageHeader title="Live data" sub="What real visitors have done in MemBrain, kept and analysed as it happens." />
        <Note>This copy of the site runs entirely in your browser, so there is no shared data to show. Open the live demo server (Hugging Face Space) to see live data.</Note>
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live data"
        sub="Every concern, check-in and clinician decision made in this demo, saved and analysed as it happens. Recomputed every 30 seconds."
        aside={badge}
      />
      {err && <Note tone="warn">{err}</Note>}
      {!s ? (
        !err && <p className="text-body">Loading live data…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={UsersRound} label="People" value={s.people} note={`${s.new_records} new records; the rest are check-ins added to demo people`} />
            <Stat icon={MessageSquareText} label="Concerns" value={s.concerns} note={Object.entries(s.reporters).map(([k, v]) => `${REPORTER[k] ?? k} ${v}`).join(" · ") || "None yet"} tone="referral" />
            <Stat icon={CheckCircle2} label="Check-ins" value={s.checkins} note={`${pct(s.completion.rate)} scored (${s.completion.scored} of ${s.completion.submitted})`} tone="stable" />
            <Stat icon={ShieldCheck} label="Flags reviewed" value={`${s.review.reviewed} / ${s.review.flags}`} note={s.review.false_referral_share == null ? "No clinician decisions yet" : `${pct(s.review.false_referral_share)} dismissed by a clinician`} tone="review" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Test–retest reliability" icon={Scale} aside={<span className="text-[14px] text-body">First two check-ins per person</span>}>
              {s.reliability.icc_3_1 != null ? (
                <dl className="divide-y divide-line">
                  <Fact k="ICC(3,1), overall score" v={num(s.reliability.icc_3_1)} hint={`${s.reliability.pairs} people; published target is above 0.75`} />
                  <Fact k="Correlation (r)" v={num(s.reliability.pearson_r)} />
                  <Fact k="Average change, 1st to 2nd" v={`${num(s.reliability.mean_change_z)} z`} hint="Practice effect; the engine allows for it" />
                  <Fact k="Typical gap" v={`${s.reliability.median_days_apart ?? "–"} days`} />
                </dl>
              ) : (
                <Note>
                  {s.reliability.pairs} of the {s.reliability.min_pairs} people needed have done two check-ins. Reliability is calculated as soon as {s.reliability.min_pairs} people have repeated the check-in.
                  {s.reliability.mean_change_z != null ? ` Average change so far: ${num(s.reliability.mean_change_z)} z.` : ""}
                </Note>
              )}
            </Panel>

            <Panel title="Results and clinician review" icon={Activity} aside={<span className="text-[14px] text-body">Latest result per person</span>}>
              <LevelBar counts={s.latest_levels} total={Object.values(s.latest_levels).reduce((a, b) => a + (b ?? 0), 0)} />
              <dl className="mt-3 divide-y divide-line">
                <Fact k="Flags a clinician agreed with" v={s.review.agreed} hint="Confirmed, referred or investigations ordered" />
                <Fact k="Flags dismissed (false-referral burden)" v={s.review.dismissed} hint={s.review.false_referral_share == null ? "" : pct(s.review.false_referral_share)} />
                <Fact k="Still open" v={s.review.open} />
                <Fact k="Days to first clinician action (median)" v={s.review.median_days_to_first_action ?? "–"} />
              </dl>
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="From concern to care" icon={Clock}>
              <dl className="divide-y divide-line">
                <Fact k="Concern, then a check-in" v={`${s.completion.concern_then_checkin.did_checkin} of ${s.completion.concern_then_checkin.people}`} hint="People who raised a concern and went on to do a check-in" />
                <Fact k="Referrals made" v={s.timing.referrals} />
                <Fact k="Days from concern to referral (median)" v={s.timing.median_days_concern_to_referral ?? "–"} />
                <Fact k="Days from concern to assessment (median)" v={s.timing.median_days_concern_to_assessment ?? "–"} hint={`${s.timing.assessed} assessed so far`} />
                <Fact k="Check-ins not scored" v={Object.entries(s.completion.not_scored).map(([k, v]) => `${k} (${v})`).join("; ") || "None"} />
              </dl>
            </Panel>
            <Panel title="Where the data is kept" icon={Database}>
              <dl className="divide-y divide-line">
                <Fact k="Saved permanently" v={s.store.permanent ? "Yes" : s.store.enabled ? "On this server only" : "No (memory only)"} hint={s.store.permanent ? "Private dataset; survives restarts and updates" : "Set STORE_REPO and STORE_TOKEN on the server"} />
                <Fact k="Last saved" v={s.store.last_saved ? new Date(s.store.last_saved).toLocaleTimeString("en-GB") : s.store.pending ? "Saving shortly" : "–"} />
                <Fact k="Restored at start from" v={s.store.loaded_from ?? "Nothing yet (fresh start)"} />
                {s.store.last_error && <Fact k="Last problem" v={s.store.last_error} />}
                <Fact k="Not measurable yet" v="Sensitivity, specificity" hint="Need a clinician's assessment for each person (pilot)" />
              </dl>
            </Panel>
          </div>

          <Panel title="AI referral letters (MedGemma)" icon={FileText} aside={<span className="text-[14px] text-body">Drafts, fact checks and clinician approvals</span>}>
            {s.letters.drafts === 0 ? (
              <Note>No letters drafted yet. Open a case and use Referral letter, then Draft with MedGemma.</Note>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <dl className="divide-y divide-line">
                  <Fact k="Drafts" v={s.letters.drafts} hint={`${s.letters.by_medgemma} by MedGemma, ${s.letters.template_fallbacks} by the rules template (MedGemma unavailable or failed the check)`} />
                  <Fact k="Sentences removed by the fact check" v={`${s.letters.sentences_removed} of ${s.letters.sentences_checked}`} hint={s.letters.removed_share == null ? "" : `${pct(s.letters.removed_share)} of what MedGemma wrote`} />
                  <Fact k="Time to a draft (median)" v={s.letters.median_seconds == null ? "–" : `${s.letters.median_seconds} s`} />
                </dl>
                <dl className="divide-y divide-line">
                  <Fact k="Letters approved by a clinician" v={s.letters.approved} hint={`${s.letters.approved_medgemma} from MedGemma drafts`} />
                  <Fact k="Approved without any edit" v={s.letters.accepted_unchanged_share == null ? "–" : pct(s.letters.accepted_unchanged_share)} hint={`${s.letters.accepted_unchanged} of ${s.letters.approved_medgemma} MedGemma drafts`} />
                  <Fact k="Share of the draft kept (median)" v={s.letters.median_similarity == null ? "–" : pct(s.letters.median_similarity)} hint="Word-level match between draft and approved letter" />
                </dl>
              </div>
            )}
          </Panel>

          <Panel title="AI second reader (MedGemma)" icon={Activity} aside={<span className="text-[14px] text-body">Runs only when the rules find nothing</span>}>
            <dl className="divide-y divide-line">
              <Fact k="Concerns read a second time" v={s.second_reader.reads} hint="The rules found no change, so MedGemma read the words" />
              <Fact k="With at least one suggestion" v={`${s.second_reader.with_suggestions} of ${s.second_reader.reads}`} hint={`${s.second_reader.suggestions} suggestions shown, each quoting the person's words`} />
              <Fact k="Suggestions dropped (not in the person's words)" v={s.second_reader.dropped_ungrounded} hint="What MedGemma made up never reaches the screen" />
              <Fact k="Time to read (median)" v={s.second_reader.median_seconds == null ? "–" : `${s.second_reader.median_seconds} s`} />
            </dl>
          </Panel>

          <Panel title="Souq route (exploratory)" icon={Activity} aside={<span className="text-[14px] text-body">Spatial route memory · not used for triage</span>}>
            <dl className="divide-y divide-line">
              <Fact k="Tasks completed" v={s.souq_route.done} hint={`${s.souq_route.people} people`} />
              <Fact k="Route span (median)" v={s.souq_route.median_span == null ? "–" : `${s.souq_route.median_span} stops`} hint={s.souq_route.median_accuracy == null ? "" : `${pct(s.souq_route.median_accuracy)} of steps right`} />
              <Fact k="Test–retest (ICC)" v={s.souq_route.icc_3_1 == null ? "–" : num(s.souq_route.icc_3_1)} hint={`${s.souq_route.repeat_pairs} people repeated it; calculated from 5`} />
            </dl>
          </Panel>

          <Panel title="By group" icon={UsersRound} aside={<span className="text-[14px] text-body">Language, age and schooling</span>}>
            <div className="grid gap-6 lg:grid-cols-3">
              {(["language", "age", "schooling"] as const).map((dim) => (
                <div key={dim}>
                  <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">{dim === "age" ? "Age" : dim === "language" ? "Language" : "Schooling"}</p>
                  <table className="w-full text-[14px]">
                    <thead>
                      <tr className="text-left text-[12.5px] text-muted">
                        <th className="pb-1 font-medium">Group</th><th className="pb-1 font-medium">People</th><th className="pb-1 font-medium">Scored</th><th className="pb-1 font-medium" title="Sent to a clinician at any point">Flagged</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.segments[dim].length ? (
                        s.segments[dim].map((r) => (
                          <tr key={r.group} className="border-t border-line">
                            <td className="py-1.5">{dim === "schooling" ? SCHOOLING[r.group] ?? r.group : r.group}</td>
                            <td>{r.people}</td>
                            <td>{pct(r.completion)}</td>
                            <td>{pct(r.flagged_share)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={4} className="py-2 text-muted">No data yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </Panel>

          <p className="flex items-center gap-2 text-[13px] text-muted">
            <RefreshCw size={14} /> Updated {at ? at.toLocaleTimeString("en-GB") : "–"}. Demo visitors are asked not to enter real names; identities are never saved with these records.
          </p>
        </>
      )}
    </div>
  );
}
