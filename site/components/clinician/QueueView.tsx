"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ArrowUpRight, CalendarClock, Check, ChevronDown, ChevronRight, ClipboardList, Funnel, LineChart, MessageSquareText, RotateCcw, Route } from "lucide-react";
import { Mark } from "../Logo";
import { LevelPill } from "../ui";
import { DriversTable, Trend } from "./charts";
import { Loading, PageHeader, Panel, Stat, SyntheticBadge, btnClass, usePopover } from "./parts";
import { TaskActions } from "./TaskActions";
import { useWorkspace } from "./WorkspaceProvider";
import { DEMO_TODAY } from "@/lib/mb";
import { caseHref, dueOf, fmtDate, HELD, isActive, isIntakeOnly, isWaiting, levelOf, matchesQuery, profileLine, QUIET, sortCases } from "@/lib/workspace/derive";
import { nav, STATE_LABEL } from "@/lib/workspace/navigator";
import { config } from "@/lib/mb";
import type { Case } from "@/lib/workspace/types";

type FilterKey = "all" | "active" | "review" | "check" | "referred" | "stable";
const FILTERS: { key: FilterKey; label: string; test: (c: Case) => boolean }[] = [
  { key: "all", label: "All cases", test: () => true },
  { key: "active", label: "Needs attention", test: isActive },
  { key: "review", label: "Clinician or urgent review", test: (c) => HELD.includes(levelOf(c)) },
  { key: "check", label: "Check again", test: (c) => levelOf(c) === "CHECK_AGAIN" },
  { key: "referred", label: "Referred", test: (c) => c.participant.referrals.length > 0 },
  { key: "stable", label: "Stable or building baseline", test: (c) => QUIET.includes(levelOf(c)) },
];

export function QueueView() {
  const { ready, cases, query } = useWorkspace();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<"urgency" | "due">("urgency");
  const { open: sortOpen, setOpen: setSortOpen, ref: sortRef } = usePopover();

  const f = FILTERS.find((x) => x.key === filter)!;
  const shown = sortCases(cases.filter(f.test).filter((c) => matchesQuery(c, query)), sort);
  const sel = shown.find((c) => c.participant.id === selected) ?? shown[0] ?? null;

  const waiting = cases.filter(isWaiting).length;
  const checkAgain = cases.filter((c) => levelOf(c) === "CHECK_AGAIN").length;
  const referrals = cases.flatMap((c) => c.participant.referrals).filter(nav.isUnresolved).length;
  const stable = cases.filter((c) => QUIET.includes(levelOf(c))).length;

  const pick = (id: string) => {
    setSelected(id);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.setTimeout(() => document.getElementById("detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  };

  return (
    <>
      <PageHeader
        title="Review queue"
        sub={
          <>
            {fmtDate(DEMO_TODAY)} <span className="mx-1 text-muted">·</span> sorted by {sort === "urgency" ? "urgency" : "review date"} <span className="mx-1 text-muted">·</span> every level shows the inputs and thresholds behind it
          </>
        }
        aside={<SyntheticBadge />}
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat tone="review" icon={AlertTriangle} label="Waiting for review" value={waiting} note={`Urgent ≤ ${config.REVIEW_TARGET_DAYS.URGENT} days · review ≤ ${config.REVIEW_TARGET_DAYS.CLINICIAN_REVIEW} days`} />
        <Stat tone="check" icon={RotateCcw} label="Check again" value={checkAgain} note="Repeat check-in, with a reason" />
        <Stat tone="referral" icon={Route} label="Referrals in progress" value={referrals} note="Tracked until follow-up is written" />
        <Stat tone="stable" icon={Check} label="Stable or building baseline" value={stable} note="No action needed now" />
      </div>

      {!ready ? (
        <div className="mt-6">
          <Loading />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(320px,400px)_1fr]">
          <section aria-label="Queue" className="self-start overflow-hidden rounded-2xl border border-[#ebece8] bg-white lg:sticky lg:top-[104px]">
            <div className="flex items-center justify-between gap-3 border-b border-[#efefeb] px-5 py-3.5">
              <label className="relative inline-flex min-w-0 items-center">
                <span className="sr-only">Show</span>
                <select value={filter} onChange={(e) => setFilter(e.target.value as FilterKey)} className="min-w-0 cursor-pointer appearance-none truncate bg-transparent py-1.5 pr-7 text-[17px] font-semibold outline-none">
                  {FILTERS.map((x) => (
                    <option key={x.key} value={x.key}>
                      {x.label} ({cases.filter(x.test).length})
                    </option>
                  ))}
                </select>
                <ChevronDown size={19} className="pointer-events-none absolute right-0" />
              </label>
              <div ref={sortRef} className="relative">
                <button type="button" onClick={() => setSortOpen(!sortOpen)} aria-label="Sort" aria-expanded={sortOpen} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f3f3f0] text-ink hover:bg-[#ebebe7]">
                  <Funnel size={20} strokeWidth={1.8} />
                </button>
                {sortOpen && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-[210px] rounded-2xl border border-line bg-white p-2 shadow-xl">
                    <p className="px-3 pb-1 pt-1.5 text-[12.5px] font-semibold uppercase tracking-[0.12em] text-leaf">Sort by</p>
                    {(["urgency", "due"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setSort(k);
                          setSortOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14.5px] hover:bg-paper"
                      >
                        {k === "urgency" ? "Urgency" : "Review date"}
                        {sort === k && <Check size={16} className="text-deep" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <ul className="divide-y divide-[#efefeb] lg:max-h-[calc(100dvh-180px)] lg:overflow-y-auto">
              {shown.length === 0 && <li className="px-6 py-8 text-center text-[15px] text-muted">No cases match.</li>}
              {shown.map((c) => (
                <QueueRow key={c.participant.id} c={c} on={sel?.participant.id === c.participant.id} onPick={pick} />
              ))}
            </ul>
          </section>

          <div id="detail" className="min-w-0 scroll-mt-24 space-y-5">
            {sel && <QueueDetail c={sel} />}
          </div>
        </div>
      )}
    </>
  );
}

function QueueRow({ c, on, onPick }: { c: Case; on: boolean; onPick: (id: string) => void }) {
  const ref = c.participant.referrals[0];
  const due = ref || c.task?.status === "closed" ? null : dueOf(c);
  const last = c.task?.actions[c.task.actions.length - 1];
  return (
    <li>
      <button type="button" onClick={() => onPick(c.participant.id)} aria-current={on} className={`relative flex w-full items-center gap-3 py-4 pl-6 pr-4 text-left transition-colors ${on ? "bg-[#e9efe8]" : "hover:bg-[#fafaf8]"}`}>
        {on && <span className="absolute inset-y-0 left-0 w-1 bg-[#154f3b]" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[19px] font-semibold tracking-[-0.01em]">
              {c.participant.id}
              {isIntakeOnly(c) && <span className="rounded bg-sand-soft px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide text-[#8a5a14]">New</span>}
            </span>
            <LevelPill level={levelOf(c)} />
          </span>
          <span className="mt-0.5 block text-[14.5px] text-body">{profileLine(c)}</span>
          <span className="mt-1 line-clamp-2 text-[15px] leading-snug text-ink">{(c.latest?.reasons[0] ?? "Enrolled. No check-in yet.").replace(/->/g, "→")}</span>
          {c.task?.status === "closed" && last ? (
            <span className="mt-2 flex items-center gap-2 text-[14px] text-lv-stable">
              <Check size={16} /> Closed · {last.action.replace(/_/g, " ")}
            </span>
          ) : ref ? (
            <span className="mt-2 flex items-center gap-2 text-[14px] text-body">
              <Route size={16} strokeWidth={1.8} /> Referred · {STATE_LABEL[ref.state].toLowerCase()}
            </span>
          ) : due ? (
            <span className="mt-2 flex items-center gap-2 text-[14px] text-body">
              <CalendarClock size={16} strokeWidth={1.8} /> Review by {fmtDate(due)}
            </span>
          ) : null}
        </span>
        <ChevronRight size={20} className="shrink-0 text-ink" aria-hidden />
      </button>
    </li>
  );
}

function QueueDetail({ c }: { c: Case }) {
  const ev = c.latest;
  const referred = c.participant.referrals.length > 0;
  const due = referred || c.task?.status === "closed" ? null : dueOf(c);
  const p = c.participant;
  return (
    <>
      <section className="rounded-2xl border border-[#ebece8] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="flex min-w-0 flex-wrap items-center gap-3">
            <span className="text-[30px] font-semibold leading-none tracking-[-0.02em]">{p.id}</span>
            <span className="[&>span]:px-3.5 [&>span]:py-1.5 [&>span]:text-[14.5px]">
              <LevelPill level={levelOf(c)} />
            </span>
          </p>
          <div className="flex flex-wrap gap-2.5">
            {referred && (
              <Link href={caseHref(p.id, "#referrals")} className={btnClass.secondary}>
                <Route size={18} strokeWidth={1.8} /> View referral
              </Link>
            )}
            <Link href={caseHref(p.id)} className={btnClass.primary}>
              Open case <ArrowRight size={18} />
            </Link>
          </div>
        </div>
        <p className="mt-2.5 text-[16px] text-body">
          {isIntakeOnly(c)
            ? `Concern raised by ${c.concern.raised_by.toLowerCase()} on ${fmtDate(c.concern.date)} · not yet enrolled`
            : [`${p.age} years`, p.sex === "F" ? "Female" : "Male", `${p.dialect} dialect`, p.education && `${p.education[0].toUpperCase()}${p.education.slice(1)} schooling`, p.emirate].filter(Boolean).join(" · ")}
          {due && (
            <span className="ms-2 inline-flex items-center gap-1.5 text-ink">
              · <CalendarClock size={15} className="text-leaf" /> review by <b>{fmtDate(due)}</b>
            </span>
          )}
        </p>

        {ev && (
          <div className="mt-5 flex gap-4 rounded-2xl bg-[#f1f4ee] p-4 sm:p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#dcefe2]">
              <Mark className="h-7 w-auto" />
            </span>
            <div>
              <p className="text-[17px] font-semibold">Why this level</p>
              <ul className="mt-1.5 space-y-1 text-[15.5px] leading-snug">
                {ev.reasons.map((r) => (
                  <li key={r} className="flex gap-2.5">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
                    {r.replace(/->/g, "→")}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div className="mt-4">
          <TaskActions c={c} />
        </div>
      </section>

      {ev && ev.drivers.length > 0 && (
        <Panel title="Assessment inputs" icon={ClipboardList} aside={<span className="text-[14px] text-body">Thresholds from config.py</span>}>
          <DriversTable drivers={ev.drivers} />
        </Panel>
      )}

      {isIntakeOnly(c) ? (
        <Panel title="The concern" icon={MessageSquareText} aside={<span className="text-[14px] text-body">Confirmed by the reporter</span>}>
          {c.concern.in_their_words && (
            <blockquote dir={p.language === "ar" ? "rtl" : "ltr"} lang={p.language} className={`border-s-[3px] border-sand ps-4 text-ink ${p.language === "ar" ? "text-[17px] leading-[1.9]" : "text-[15.5px] leading-relaxed"}`}>
              {c.concern.in_their_words}
            </blockquote>
          )}
          <p className="mt-3 text-[14.5px] text-body">
            {c.concern.what_changed.join(", ") || "No specific change picked out"}
            {c.concern.who_now_does_what.length > 0 && <> · {c.concern.who_now_does_what.join("; ")}</>}
          </p>
        </Panel>
      ) : (
        <Panel title="Over time" icon={LineChart} aside={<span className="text-[14px] text-body">Compared with own baseline</span>}>
          <Trend history={c.history} />
        </Panel>
      )}

      <p className="flex flex-wrap items-center gap-1.5 px-1 text-[13px] text-muted">
        MemBrain flags risk and change. It does not diagnose.
        <Link href={caseHref(p.id)} className="inline-flex items-center gap-0.5 text-leaf hover:underline">
          Full case, referral draft and history <ArrowUpRight size={13} />
        </Link>
      </p>
    </>
  );
}
