"use client";

import { Activity, ChartNoAxesColumn, ClipboardList, Download, Printer, Route, Scale, Timer } from "lucide-react";
import { Loading, PageHeader, Panel, Stat, SyntheticBadge, btnClass, downloadText, toCsv } from "../parts";
import { useWorkspace } from "../WorkspaceProvider";
import { BarRow, Fact, LevelBar, Note, pct } from "./common";
import type { Level } from "@/lib/mb";
import { levelOf } from "@/lib/workspace/derive";
import { ENTRY_LABEL } from "@/lib/workspace/concern";
import { NAV, nav, STATE_LABEL, type Completion, type ProgrammeMetrics } from "@/lib/workspace/navigator";
import type { ReferralState, TaskAction } from "@/lib/workspace/types";

const ACTION_LABEL: Record<TaskAction, string> = {
  confirm_concern: "Concern confirmed",
  refer: "Referred",
  dismiss: "Closed: not a concern",
  request_repeat: "Repeat check-in requested",
  order_investigations: "Investigations ordered",
};

const GROUPS: { key: keyof Pick<ProgrammeMetrics, "by_entry_route" | "by_language" | "by_funding" | "by_sex" | "by_age_band">; title: string; label: (k: string) => string }[] = [
  { key: "by_entry_route", title: "By who raised the concern", label: (k) => ENTRY_LABEL[k] ?? k },
  { key: "by_language", title: "By language", label: (k) => NAV.languages[k] ?? k },
  { key: "by_funding", title: "By funding", label: (k) => NAV.funding[k] ?? k },
  { key: "by_sex", title: "By sex", label: (k) => (k === "F" ? "Female" : k === "M" ? "Male" : k) },
  { key: "by_age_band", title: "By age band", label: (k) => k },
];

/** Groups whose completion is more than 10 points below the overall rate. */
function equityGaps(m: ProgrammeMetrics) {
  const overall = m.completion_rate ?? 0;
  return GROUPS.flatMap((g) =>
    Object.entries(m[g.key] as Completion)
      .filter(([, v]) => v.completion != null && v.completion < overall - 0.1)
      .map(([k, v]) => ({ group: g.title.replace(/^By /, ""), label: g.label(k), completion: v.completion!, sent: v.sent })),
  );
}

function CompletionBars({ m, group }: { m: ProgrammeMetrics; group: (typeof GROUPS)[number] }) {
  const rows = Object.entries(m[group.key] as Completion);
  if (!rows.length) return <p className="text-[14px] text-muted">No referrals sent yet.</p>;
  return (
    <div>
      {rows.map(([k, v]) => (
        <BarRow key={k} label={group.label(k)} value={v.completion} display={pct(v.completion)} note={`${v.completed}/${v.sent}${v.sent < 10 ? " · small" : ""}`} reference={m.completion_rate} tone={v.sent < 10 ? "bg-leaf/45" : "bg-deep"} />
      ))}
    </div>
  );
}

function Reasons({ m }: { m: ProgrammeMetrics }) {
  const entries = Object.entries(m.non_completion_reasons);
  if (!entries.length) return <p className="text-[14px] text-muted">No referral has stopped short of completion.</p>;
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <div>
      {entries
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => (
          <BarRow key={k} label={STATE_LABEL[k as ReferralState] ?? k} value={v} of={max} display={v} tone="bg-lv-review/70" />
        ))}
    </div>
  );
}

export function ReportsView() {
  const { ready, cases } = useWorkspace();

  // This cohort, live: the same metric function the Python navigator uses, over the referrals in the workspace.
  const refs = cases.flatMap((c) => c.participant.referrals);
  const people: Record<string, Record<string, unknown>> = Object.fromEntries(
    cases.map((c) => [c.participant.id, { language: c.participant.language, funding: c.participant.funding, sex: c.participant.sex, age_band: c.participant.age_band }]),
  );
  const live = nav.metrics(refs, people);
  const counts: Partial<Record<Level, number>> = {};
  cases.forEach((c) => (counts[levelOf(c)] = (counts[levelOf(c)] ?? 0) + 1));
  const tasks = cases.map((c) => c.task).filter((t): t is NonNullable<typeof t> => !!t);
  const taskStatus = { open: tasks.filter((t) => t.status === "open").length, in_progress: tasks.filter((t) => t.status === "in_progress").length, closed: tasks.filter((t) => t.status === "closed").length };
  const actionCounts: Partial<Record<TaskAction, number>> = {};
  tasks.forEach((t) => t.actions.forEach((a) => (actionCounts[a.action] = (actionCounts[a.action] ?? 0) + 1)));

  // The programme simulation: 160 synthetic referrals from the navigator's simulation.
  const S = NAV.synthetic_metrics;
  const accepted = S.accepted_rate != null ? Math.round(S.sent * S.accepted_rate) : null;
  const completed = S.completion_rate != null ? Math.round(S.sent * S.completion_rate) : null;
  const funnel: [string, number | null][] = [
    ["Recommended", S.referrals],
    ["Sent", S.sent],
    ["Accepted", accepted],
    ["Assessment completed", completed],
  ];
  const gaps = equityGaps(S);
  const small = GROUPS.flatMap((g) => Object.entries(S[g.key] as Completion).filter(([, v]) => v.sent < 10).map(([k]) => g.label(k)));

  const exportCsv = () => {
    const rows: (string | number | null)[][] = [["Source", "Breakdown", "Group", "Sent", "Completed", "Completion"]];
    for (const [src, m] of [["This cohort", live], ["Programme simulation (synthetic)", S]] as const) {
      rows.push([src, "Overall", "All", m.sent, null, m.completion_rate]);
      for (const g of GROUPS) for (const [k, v] of Object.entries(m[g.key] as Completion)) rows.push([src, g.title, g.label(k), v.sent, v.completed, v.completion]);
      for (const [k, v] of Object.entries(m.non_completion_reasons)) rows.push([src, "Not completed", STATE_LABEL[k as ReferralState] ?? k, v, null, null]);
    }
    downloadText("membrain-programme-report.csv", toCsv(rows), "text/csv");
  };

  return (
    <>
      <PageHeader
        title="Reports"
        sub="Does the loop close? Referrals followed from recommendation to a documented follow-up"
        aside={
          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={() => window.print()} className={btnClass.secondary}>
              <Printer size={17} /> Print
            </button>
            <button type="button" onClick={exportCsv} className={btnClass.secondary}>
              <Download size={17} /> Export CSV
            </button>
          </div>
        }
      />

      {!ready ? (
        <div className="mt-6">
          <Loading />
        </div>
      ) : (
        <>
          <h2 className="mt-8 font-serif text-[26px] font-semibold tracking-[-0.01em]">This cohort</h2>
          <p className="mt-1 text-[15px] text-body">Live from the workspace: the {cases.length} people and {refs.length} referrals here, including changes made today.</p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Stat tone="referral" icon={Route} label="Referrals" value={live.referrals} note={`${live.sent} sent · ${live.unresolved} still open`} />
            <Stat tone="stable" icon={Activity} label="Completion" value={pct(live.completion_rate)} note="Sent referrals with an assessment done" />
            <Stat tone="neutral" icon={Scale} label="Accepted" value={pct(live.accepted_rate)} note="Sent referrals a service accepted" />
            <Stat tone="check" icon={Timer} label="Overdue" value={live.overdue} note="Sent or recommended, no news for 14+ days" />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Panel title="Levels today" icon={ChartNoAxesColumn} aside={<span className="text-[14px] text-body">{cases.length} people</span>}>
              <LevelBar counts={counts} total={cases.length} />
            </Panel>
            <Panel title="Clinician tasks" icon={ClipboardList} aside={<span className="text-[14px] text-body">Opened by urgent or review levels</span>}>
              <Fact k="Open" v={taskStatus.open} />
              <Fact k="In progress" v={taskStatus.in_progress} hint="A repeat or investigations were requested" />
              <Fact k="Closed" v={taskStatus.closed} />
              {Object.entries(actionCounts).map(([a, n]) => (
                <Fact key={a} k={ACTION_LABEL[a as TaskAction] ?? a} v={n} />
              ))}
            </Panel>
            <Panel title="Timing" icon={Timer}>
              <Fact k="Median days, concern to review" v={live.median_days_concern_to_review ?? "–"} hint="Needs a concern date on the referral" />
              <Fact k="Median days, referral sent to assessment" v={live.median_days_referral_to_assessment ?? "–"} />
              <Fact k="Pathway gaps" v={live.pathway_gaps} hint="No accessible service was found" />
            </Panel>
            <Panel title="Why referrals stopped" icon={Route}>
              <Reasons m={live} />
            </Panel>
          </div>

          <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-[26px] font-semibold tracking-[-0.01em]">Programme simulation</h2>
              <p className="mt-1 max-w-[760px] text-[15px] text-body">
                {S.referrals} synthetic referrals from the navigator&apos;s simulation, to show what these reports look like at programme scale. None of it is real data.
              </p>
            </div>
            <SyntheticBadge />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Panel title="Through the loop" icon={Route} aside={<span className="text-[14px] text-body">of {S.referrals} recommended</span>}>
              {funnel.map(([k, v]) => (
                <BarRow key={k} label={k} value={v} of={S.referrals} display={v ?? "–"} note={v != null ? pct(v / S.referrals) : undefined} />
              ))}
              <p className="mt-3 text-[13px] text-muted">
                Accepted and completed are counted out of the {S.sent} sent. The simulation summary does not break out the appointment and attendance steps.
              </p>
            </Panel>
            <Panel title="Headline" icon={Activity}>
              <Fact k="Completion (sent → assessment done)" v={pct(S.completion_rate, 1)} />
              <Fact k="Accepted by the service" v={pct(S.accepted_rate, 1)} />
              <Fact k="Median days, concern to review" v={S.median_days_concern_to_review ?? "–"} />
              <Fact k="Median days, referral sent to assessment" v={S.median_days_referral_to_assessment ?? "–"} />
              <Fact k="Still open" v={S.unresolved} />
              <Fact k="Pathway gaps (no accessible service)" v={S.pathway_gaps} />
            </Panel>
          </div>

          <div className="mt-5">
            {gaps.length ? (
              <Note tone="warn">
                <b>Equity check.</b> Completion is more than 10 points below the overall {pct(S.completion_rate)} for:{" "}
                {gaps.map((g) => `${g.label} (${g.group.toLowerCase()}, ${pct(g.completion)} of ${g.sent})`).join("; ")}. Look at language, transport and funding barriers for these groups first.
              </Note>
            ) : (
              <Note>
                <b>Equity check.</b> No group&apos;s completion is more than 10 points below the overall {pct(S.completion_rate)}. The black line on each bar marks the overall rate.
                {small.length > 0 && <> Groups under 10 referrals ({small.join(", ")}) are too small to read much into.</>}
              </Note>
            )}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {GROUPS.map((g) => (
              <Panel key={g.key} title={`Completion ${g.title.toLowerCase()}`} icon={Scale} aside={<span className="text-[13px] text-body">completed / sent</span>}>
                <CompletionBars m={S} group={g} />
              </Panel>
            ))}
            <Panel title="Why referrals stopped" icon={Route} aside={<span className="text-[13px] text-body">referrals</span>}>
              <Reasons m={S} />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
