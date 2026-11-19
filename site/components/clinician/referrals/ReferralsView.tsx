"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Download, MapPin, RotateCcw, Route, Search } from "lucide-react";
import { Loading, PageHeader, Panel, Stat, SyntheticBadge, Tabs, btnClass, downloadText, toCsv } from "../parts";
import { ReferralCard, ReferralState } from "../ReferralCard";
import { useWorkspace } from "../WorkspaceProvider";
import { caseHref, fmtDate, fmtRelTime, TODAY } from "@/lib/workspace/derive";
import { DONE, NAV, nav, serviceById, STALLED, STATE_LABEL, type Service } from "@/lib/workspace/navigator";
import type { Referral } from "@/lib/workspace/types";

type Group = "all" | "progress" | "stalled" | "completed" | "closed";

const inGroup: Record<Group, (r: Referral) => boolean> = {
  all: () => true,
  progress: (r) => nav.isUnresolved(r) && !STALLED.includes(r.state) && !DONE.includes(r.state),
  stalled: (r) => STALLED.includes(r.state),
  completed: (r) => DONE.includes(r.state),
  closed: (r) => NAV.closed.includes(r.state) && !DONE.includes(r.state),
};

const lastDate = (r: Referral) => r.history[r.history.length - 1]?.date ?? null;
const daysInStep = (r: Referral) => {
  const d = lastDate(r);
  return d ? nav.days(d, TODAY) : null;
};
const isOverdue = (r: Referral) => (r.state === "sent" || r.state === "recommended") && (daysInStep(r) ?? 0) > 14;
const pct = (x: number | null) => (x == null ? "–" : `${Math.round(x * 100)}%`);

export function ReferralsView() {
  const { ready, cases, refresh, syncing } = useWorkspace();
  const [tab, setTab] = useState<"referrals" | "directory">("referrals");

  const referrals = useMemo(() => cases.flatMap((c) => c.participant.referrals), [cases]);
  const metrics = useMemo(() => {
    const people: Record<string, Record<string, unknown>> = {};
    for (const c of cases) {
      const p = c.participant;
      people[p.id] = { language: p.language, funding: p.funding, sex: p.sex, age_band: p.age_band };
    }
    return nav.metrics(referrals, people, TODAY);
  }, [cases, referrals]);
  const stalled = referrals.filter((r) => STALLED.includes(r.state)).length;

  return (
    <>
      <PageHeader
        title="Referrals"
        sub="Closed-loop tracking: a referral counts as done only when the assessment has happened and follow-up is written down"
        aside={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={syncing}
              title="Refresh referrals from server"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-[13px] font-medium text-body shadow-sm hover:bg-paper"
            >
              <RotateCcw size={14} className={syncing ? "animate-spin text-leaf" : ""} />
              <span>{syncing ? "Syncing..." : "Sync"}</span>
            </button>
            <SyntheticBadge />
          </div>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat tone="referral" icon={Route} label="In progress" value={ready ? metrics.unresolved : "–"} note="Not yet closed or cancelled" />
        <Stat tone="review" icon={AlertTriangle} label="Stalled" value={ready ? stalled : "–"} note="Declined, missed, lost or no service" />
        <Stat tone="stable" icon={CheckCircle2} label="Completion rate" value={ready ? pct(metrics.completion_rate) : "–"} note="Sent referrals with an assessment done" />
        <Stat tone="check" icon={Clock} label="Referral to assessment" value={ready ? (metrics.median_days_referral_to_assessment == null ? "–" : `${metrics.median_days_referral_to_assessment} d`) : "–"} note="Median days, sent to assessed" />
      </div>

      <div className="mt-6">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "referrals", label: "Referrals", count: ready ? referrals.length : undefined },
            { value: "directory", label: "Service directory", count: NAV.directory.length },
          ]}
        />
      </div>

      <div className="mt-5">{!ready ? <Loading label="Loading referrals" /> : tab === "referrals" ? <ReferralList referrals={referrals} /> : <Directory />}</div>
    </>
  );
}

function ReferralList({ referrals }: { referrals: Referral[] }) {
  const [group, setGroup] = useState<Group>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const shown = referrals
    .filter(inGroup[group])
    .sort((a, b) => (lastDate(b) ?? "").localeCompare(lastDate(a) ?? ""));
  const sel = shown.find((r) => r.id === selected) ?? shown[0] ?? null;

  const pick = (id: string) => {
    setSelected(id);
    if (window.matchMedia("(max-width: 1279px)").matches) {
      window.setTimeout(() => document.getElementById("referral-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  };

  const exportCsv = () => {
    const rows = [
      ["Referral", "Participant", "Pathway", "Service", "Urgency", "State", "Last update", "Days in step", "Overdue"],
      ...shown.map((r) => [r.id, r.participant_id, NAV.pathways[r.pathway] ?? r.pathway, serviceById(r.service_id)?.name ?? "", r.urgency, STATE_LABEL[r.state], lastDate(r), daysInStep(r), isOverdue(r) ? "yes" : ""]),
    ];
    downloadText(`membrain-referrals-${TODAY}.csv`, toCsv(rows), "text/csv");
  };

  const groups: { value: Group; label: string }[] = [
    { value: "all", label: "All" },
    { value: "progress", label: "In progress" },
    { value: "stalled", label: "Stalled" },
    { value: "completed", label: "Completed" },
    { value: "closed", label: "Closed" },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_minmax(380px,460px)]">
      <section aria-label="Referrals" className="self-start overflow-hidden rounded-2xl border border-[#ebece8] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efefeb] px-5 py-3.5">
          <Tabs value={group} onChange={setGroup} options={groups.map((g) => ({ ...g, count: referrals.filter(inGroup[g.value]).length }))} />
          <button type="button" onClick={exportCsv} disabled={!shown.length} className={btnClass.secondary}>
            <Download size={16} /> Export CSV
          </button>
        </div>

        {shown.length === 0 ? (
          <p className="px-6 py-10 text-center text-[15px] text-muted">No referrals in this group.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-separate border-spacing-0 text-[15px]">
                <thead>
                  <tr className="text-left text-[14px] text-body">
                    {["Participant", "Pathway and service", "Urgency", "State", "Last update", "In step"].map((h) => (
                      <th key={h} className="border-b border-[#efefeb] bg-[#fafaf8] px-4 py-2.5 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const on = sel?.id === r.id;
                    const d = daysInStep(r);
                    return (
                      <tr key={r.id} onClick={() => pick(r.id)} aria-selected={on} className={`cursor-pointer transition-colors ${on ? "bg-[#e9efe8]" : "hover:bg-[#fafaf8]"}`}>
                        <td className={`border-b border-[#f0f0ec] px-4 py-3 ${on ? "shadow-[inset_4px_0_0_#154f3b]" : ""}`}>
                          <Link href={caseHref(r.participant_id, "#referrals")} onClick={(e) => e.stopPropagation()} className="font-semibold text-ink hover:text-leaf hover:underline">
                            {r.participant_id}
                          </Link>
                          <span className="block font-mono text-[12px] text-muted">{r.id}</span>
                        </td>
                        <td className="border-b border-[#f0f0ec] px-4 py-3">
                          <span className="block font-medium">{NAV.pathways[r.pathway] ?? r.pathway}</span>
                          <span className="block text-[13.5px] text-body">{serviceById(r.service_id)?.name ?? "Service to be assigned"}</span>
                        </td>
                        <td className={`border-b border-[#f0f0ec] px-4 py-3 ${r.urgency === "urgent" ? "font-medium text-lv-urgent" : "text-body"}`}>{r.urgency}</td>
                        <td className="border-b border-[#f0f0ec] px-4 py-3">
                          <ReferralState state={r.state} />
                        </td>
                        <td className="whitespace-nowrap border-b border-[#f0f0ec] px-4 py-3 text-body">
                          <div>{fmtDate(lastDate(r))}</div>
                          <div className="text-[12px] text-muted">{fmtRelTime(lastDate(r))}</div>
                        </td>
                        <td className="whitespace-nowrap border-b border-[#f0f0ec] px-4 py-3">
                          {NAV.closed.includes(r.state) ? <span className="text-muted">–</span> : <span className="tabular-nums">{d} d</span>}
                          {isOverdue(r) && <span className="ms-2 rounded-full bg-lv-review-soft px-2 py-0.5 text-[12px] font-semibold text-lv-review">overdue</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phone cards */}
            <ul className="divide-y divide-[#efefeb] md:hidden">
              {shown.map((r) => {
                const on = sel?.id === r.id;
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => pick(r.id)} aria-current={on} className={`relative block w-full px-5 py-4 text-left ${on ? "bg-[#e9efe8]" : ""}`}>
                      {on && <span className="absolute inset-y-0 left-0 w-1 bg-[#154f3b]" aria-hidden />}
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-[17px] font-semibold">{r.participant_id}</span>
                        <ReferralState state={r.state} />
                      </span>
                      <span className="mt-1 block text-[14.5px]">{NAV.pathways[r.pathway] ?? r.pathway}</span>
                      <span className="block text-[13.5px] text-body">{serviceById(r.service_id)?.name ?? "Service to be assigned"}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                        <span className={r.urgency === "urgent" ? "font-medium text-lv-urgent" : ""}>{r.urgency}</span>· updated {fmtDate(lastDate(r))} ({fmtRelTime(lastDate(r))})
                        {!NAV.closed.includes(r.state) && <>· {daysInStep(r)} d in step</>}
                        {isOverdue(r) && <span className="rounded-full bg-lv-review-soft px-2 py-0.5 text-[12px] font-semibold text-lv-review">overdue</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <div id="referral-detail" className="min-w-0 scroll-mt-24 self-start xl:sticky xl:top-[104px]">
        {sel ? <ReferralCard key={sel.id} r={sel} showPerson /> : <p className="rounded-2xl border border-[#ebece8] bg-white px-6 py-8 text-[15px] text-muted">Select a referral to see its history and record the next step.</p>}
      </div>
    </div>
  );
}

const staleFor = (s: Service) => nav.days(s.last_verified, TODAY) > NAV.stale_after_days;

function Directory() {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = NAV.directory.filter((s) => {
    if (!needle) return true;
    return [s.name, s.area, s.emirate, ...s.pathways.map((p) => NAV.pathways[p] ?? p), ...s.languages.map((l) => NAV.languages[l] ?? l), ...s.funding.map((f) => NAV.funding[f] ?? f)]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
  const perPathway = Object.keys(NAV.pathways)
    .map((p) => ({ p, n: NAV.directory.filter((s) => s.pathways.includes(p)).length }))
    .filter((x) => x.n > 0);

  return (
    <Panel title="Service directory" icon={MapPin} aside={<span className="text-[14px] text-body">{shown.length} of {NAV.directory.length} services · synthetic</span>}>
      <div className="flex flex-wrap gap-2">
        {perPathway.map(({ p, n }) => (
          <button key={p} type="button" onClick={() => setQ(NAV.pathways[p])} className="rounded-full bg-[#f1f1ee] px-3 py-1 text-[13px] text-body hover:bg-[#e9e9e5]">
            {NAV.pathways[p]} <span className="font-semibold text-ink">{n}</span>
          </button>
        ))}
      </div>
      <label className="relative mt-4 flex items-center">
        <Search size={19} className="pointer-events-none absolute left-4 text-ink" />
        <span className="sr-only">Search services</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, area, pathway, language or funding"
          className="h-12 w-full rounded-xl border border-[#e6e6e3] bg-white pl-12 pr-4 text-[15.5px] outline-none placeholder:text-body focus:border-leaf"
        />
      </label>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-muted">No services match “{q}”.</p>
      ) : (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {shown.map((s) => {
            const stale = staleFor(s);
            return (
              <li key={s.id} className="rounded-2xl border border-[#ebece8] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold leading-snug">{s.name}</p>
                    <p className="text-[13.5px] text-body">
                      {s.area} · {s.emirate}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.accepting_referrals === false && <span className="rounded-full bg-lv-review-soft px-2.5 py-0.5 text-[12px] font-semibold text-lv-review">not accepting referrals</span>}
                    {stale && <span className="rounded-full bg-lv-check-soft px-2.5 py-0.5 text-[12px] font-semibold text-lv-check">stale</span>}
                    {s.synthetic && <span className="rounded-full bg-[#f1f1ee] px-2.5 py-0.5 text-[12px] text-muted">synthetic</span>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.pathways.map((p) => (
                    <span key={p} className="rounded-md bg-mist px-2 py-0.5 text-[12.5px] font-medium text-deep">
                      {NAV.pathways[p] ?? p}
                    </span>
                  ))}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13.5px]">
                  <div>
                    <dt className="text-muted">Languages</dt>
                    <dd>{s.languages.map((l) => NAV.languages[l] ?? l).join(", ")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Funding</dt>
                    <dd>{s.funding.map((f) => NAV.funding[f] ?? f).join(", ")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Wait</dt>
                    <dd>{s.wait_weeks === 0 ? "No wait" : `About ${s.wait_weeks} week${s.wait_weeks === 1 ? "" : "s"}`}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Capacity</dt>
                    <dd>{s.capacity_per_month == null ? "Same day" : `${s.capacity_per_month} per month`}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted">How to refer</dt>
                    <dd>{s.referral_process}</dd>
                  </div>
                </dl>
                {s.notes && <p className="mt-2 text-[13.5px] text-body">{s.notes}</p>}
                <p className={`mt-2 text-[12.5px] ${stale ? "text-lv-check" : "text-muted"}`}>
                  Last verified {fmtDate(s.last_verified)}
                  {stale && ` · older than ${NAV.stale_after_days} days, check before referring`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
