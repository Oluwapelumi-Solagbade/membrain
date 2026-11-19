"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Compass,
  FileClock,
  FileText,
  Funnel,
  HeartPulse,
  Info,
  LineChart,
  Mail,
  MapPin,
  MessageSquareText,
  Mic,
  Phone,
  RotateCcw,
  Route,
  Stethoscope,
} from "lucide-react";
import { Mark } from "../Logo";
import { LevelPill } from "../ui";
import { DriversTable, Trend } from "./charts";
import { Loading, PageHeader, Panel, Stat, SyntheticBadge, btnClass, usePopover } from "./parts";
import { TaskActions } from "./TaskActions";
import { useWorkspace } from "./WorkspaceProvider";
import { DEMO_TODAY } from "@/lib/mb";
import {
  caseHref,
  contactOf,
  dueOf,
  facilityOf,
  fmtDate,
  fmtRelTime,
  HELD,
  isActive,
  isIntakeOnly,
  isWaiting,
  levelOf,
  matchesQuery,
  profileLine,
  QUIET,
  sortCases,
} from "@/lib/workspace/derive";
import { nav, STATE_LABEL } from "@/lib/workspace/navigator";
import { config } from "@/lib/mb";
import type { Case } from "@/lib/workspace/types";

type FilterKey = "all" | "concerns" | "active" | "review" | "check" | "referred" | "stable";
const FILTERS: { key: FilterKey; label: string; test: (c: Case) => boolean }[] = [
  { key: "all", label: "All cases", test: () => true },
  { key: "concerns", label: "New incoming concerns", test: isIntakeOnly },
  { key: "active", label: "Needs attention", test: isActive },
  { key: "review", label: "Clinician or urgent review", test: (c) => HELD.includes(levelOf(c)) },
  { key: "check", label: "Check again", test: (c) => levelOf(c) === "CHECK_AGAIN" },
  { key: "referred", label: "Referred", test: (c) => c.participant.referrals.length > 0 },
  { key: "stable", label: "Stable or building baseline", test: (c) => QUIET.includes(levelOf(c)) },
];

export function QueueView() {
  const { ready, cases, query, refresh, syncing } = useWorkspace();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<"urgency" | "due">("urgency");
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const { open: sortOpen, setOpen: setSortOpen, ref: sortRef } = usePopover();

  const facilities = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => {
      const fac = facilityOf(c);
      if (fac?.name) set.add(fac.name);
    });
    return Array.from(set).sort();
  }, [cases]);

  const f = FILTERS.find((x) => x.key === filter)!;
  const shown = sortCases(
    cases
      .filter(f.test)
      .filter((c) => {
        if (facilityFilter === "all") return true;
        const fac = facilityOf(c);
        return fac?.name === facilityFilter;
      })
      .filter((c) => matchesQuery(c, query)),
    sort,
  );
  const sel = shown.find((c) => c.participant.id === selected) ?? shown[0] ?? null;

  const concernsCount = cases.filter(isIntakeOnly).length;
  const waiting = cases.filter(isWaiting).length;
  const checkAgain = cases.filter((c) => levelOf(c) === "CHECK_AGAIN").length;
  const referrals = cases.flatMap((c) => c.participant.referrals).filter(nav.isUnresolved).length;
  const stable = cases.filter((c) => QUIET.includes(levelOf(c))).length;

  const pick = (id: string) => {
    setSelected(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      window.setTimeout(() => document.getElementById("detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  };

  return (
    <>
      <PageHeader
        title="Review queue"
        sub={
          <>
            {fmtDate(DEMO_TODAY)} <span className="mx-1 text-muted">·</span> sorted by {sort === "urgency" ? "urgency" : "review date"} <span className="mx-1 text-muted">·</span> clinical triage & closed-loop care
          </>
        }
        aside={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={syncing}
              title="Refresh queue from server"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-[13px] font-medium text-body shadow-sm hover:bg-paper"
            >
              <RotateCcw size={14} className={syncing ? "animate-spin text-leaf" : ""} />
              <span>{syncing ? "Syncing..." : "Sync"}</span>
            </button>
            <SyntheticBadge />
          </div>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <Stat
          tone="review"
          icon={MessageSquareText}
          label="New concerns"
          value={concernsCount}
          note="From family & public chat"
        />
        <Stat
          tone="review"
          icon={AlertTriangle}
          label="Waiting for review"
          value={waiting}
          note={`Urgent ≤ ${config.REVIEW_TARGET_DAYS.URGENT}d · review ≤ ${config.REVIEW_TARGET_DAYS.CLINICIAN_REVIEW}d`}
        />
        <Stat tone="check" icon={RotateCcw} label="Check again" value={checkAgain} note="Repeat check-in scheduled" />
        <Stat tone="referral" icon={Route} label="Referrals in progress" value={referrals} note="Tracked closed-loop" />
        <Stat tone="stable" icon={Check} label="Stable / baseline" value={stable} note="No action needed now" />
      </div>

      {!ready ? (
        <div className="mt-6">
          <Loading />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(330px,410px)_1fr]">
          <section aria-label="Queue" className="self-start overflow-hidden rounded-2xl border border-[#ebece8] bg-white lg:sticky lg:top-[104px]">
            <div className="flex items-center justify-between gap-3 border-b border-[#efefeb] px-5 py-3.5">
              <label className="relative inline-flex min-w-0 items-center">
                <span className="sr-only">Show</span>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as FilterKey)}
                  className="min-w-0 cursor-pointer appearance-none truncate bg-transparent py-1.5 pr-7 text-[16px] font-semibold outline-none"
                >
                  {FILTERS.map((x) => (
                    <option key={x.key} value={x.key}>
                      {x.label} ({cases.filter(x.test).length})
                    </option>
                  ))}
                </select>
                <ChevronDown size={19} className="pointer-events-none absolute right-0" />
              </label>
              <div ref={sortRef} className="relative">
                <button
                  type="button"
                  onClick={() => setSortOpen(!sortOpen)}
                  aria-label="Sort"
                  aria-expanded={sortOpen}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3f3f0] text-ink hover:bg-[#ebebe7]"
                >
                  <Funnel size={18} strokeWidth={1.8} />
                </button>
                {sortOpen && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-[210px] rounded-2xl border border-line bg-white p-2 shadow-xl">
                    <p className="px-3 pb-1 pt-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf">Sort by</p>
                    {(["urgency", "due"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setSort(k);
                          setSortOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] hover:bg-paper"
                      >
                        {k === "urgency" ? "Urgency" : "Review date"}
                        {sort === k && <Check size={16} className="text-deep" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {facilities.length > 0 && (
              <div className="flex items-center gap-2 border-b border-[#efefeb] bg-paper/50 px-4 py-2">
                <Building2 size={14} className="shrink-0 text-leaf" />
                <label className="relative inline-flex min-w-0 flex-1 items-center">
                  <span className="sr-only">Facility filter</span>
                  <select
                    value={facilityFilter}
                    onChange={(e) => setFacilityFilter(e.target.value)}
                    className="w-full cursor-pointer appearance-none truncate bg-transparent pr-5 text-[12.5px] font-medium text-deep outline-none"
                  >
                    <option value="all">All UAE Facilities ({cases.length})</option>
                    {facilities.map((fac) => (
                      <option key={fac} value={fac}>
                        {fac} ({cases.filter((c) => facilityOf(c)?.name === fac).length})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-0 text-muted" />
                </label>
                {facilityFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setFacilityFilter("all")}
                    className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-leaf hover:bg-mist"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
            <ul className="divide-y divide-[#efefeb] lg:max-h-[calc(100dvh-180px)] lg:overflow-y-auto">
              {shown.length === 0 && <li className="px-6 py-8 text-center text-[15px] text-muted">No cases match this filter.</li>}
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
  const isNew = isIntakeOnly(c);

  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(c.participant.id)}
        aria-current={on}
        className={`relative flex w-full items-center gap-3 py-3.5 pl-5 pr-4 text-left transition-colors ${
          on ? "bg-[#e9efe8]" : isNew ? "bg-[#fffdf9] hover:bg-[#fdfaf3]" : "hover:bg-[#fafaf8]"
        }`}
      >
        {on && <span className="absolute inset-y-0 left-0 w-1.5 bg-[#154f3b]" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[17.5px] font-semibold tracking-[-0.01em]">
              {c.participant.id}
              {isNew && (
                <span className="rounded-md border border-amber-300 bg-amber-100/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                  New Concern
                </span>
              )}
            </span>
            <LevelPill level={levelOf(c)} />
          </span>

          <span className="mt-0.5 block text-[13.5px] text-body">
            {isNew
              ? `Reported ${fmtRelTime(c.concern.date)} · ${c.concern.raised_by.toLowerCase()}`
              : profileLine(c)}
          </span>

          {(() => {
            const fac = facilityOf(c);
            const con = contactOf(c);
            if (!fac?.name) return null;
            return (
              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
                <span className="inline-flex items-center gap-1 rounded bg-[#e8f1eb] px-2 py-0.5 font-medium text-deep">
                  <Building2 size={11} className="text-leaf" />
                  {fac.name}
                </span>
                {fac.area && <span className="text-muted">· {fac.area}</span>}
                {con.phone && (
                  <span className="inline-flex items-center gap-1 font-medium text-leaf">
                    <Phone size={10} /> {con.phone}
                  </span>
                )}
              </span>
            );
          })()}

          <span className="mt-1 line-clamp-2 text-[14px] leading-snug text-ink">
            {isNew && c.concern.in_their_words
              ? `“${c.concern.in_their_words}”`
              : (c.latest?.reasons[0] ?? "Enrolled. No check-in yet.").replace(/->/g, "→")}
          </span>

          {c.task?.status === "closed" && last ? (
            <span className="mt-1.5 flex items-center gap-1.5 text-[13px] text-lv-stable">
              <Check size={15} /> Closed · {last.action.replace(/_/g, " ")} · {fmtRelTime(last.ts)}
            </span>
          ) : ref ? (
            <span className="mt-1.5 flex items-center gap-1.5 text-[13px] text-body">
              <Route size={15} strokeWidth={1.8} /> Referred · {STATE_LABEL[ref.state].toLowerCase()}
            </span>
          ) : isNew ? (
            <span className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-amber-800">
              <AlertTriangle size={14} /> Intake review required
            </span>
          ) : due ? (
            <span className="mt-1.5 flex items-center gap-1.5 text-[13px] text-body">
              <CalendarClock size={15} strokeWidth={1.8} /> Review by {fmtDate(due)}
            </span>
          ) : null}
        </span>
        <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
      </button>
    </li>
  );
}

/** Visual Stepper showing where this patient sits in the clinical care pathway. */
function ClinicalStepper({ c }: { c: Case }) {
  const isNew = isIntakeOnly(c);
  const hasSessions = c.history.some((h) => !h.intake);
  const isReferred = c.participant.referrals.length > 0;
  const isClosed = c.task?.status === "closed";

  const steps = [
    { id: "intake", label: "1. Concern Triaged", done: true, current: isNew && !isReferred },
    { id: "checkin", label: "2. Check-in", done: hasSessions, current: !isNew && !hasSessions },
    { id: "review", label: "3. Clinician Review", done: hasSessions || isReferred || isClosed, current: !isNew && isWaiting(c) },
    { id: "referral", label: "4. Referral & Care Plan", done: isReferred || isClosed, current: isReferred && !isClosed },
    { id: "monitor", label: "5. Active Monitoring", done: isClosed, current: isClosed },
  ];

  return (
    <div className="rounded-xl border border-line bg-paper/60 p-3.5">
      <div className="flex items-center justify-between gap-2 pb-2">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-leaf">
          <Compass size={14} /> Clinical Pathway Stage
        </p>
        <span className="text-[12px] text-muted">
          {isNew ? "Awaiting triage decision" : isReferred ? "Referral tracking active" : isClosed ? "Task resolved" : "Routine clinical loop"}
        </span>
      </div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Clinical pathway">
        {steps.map((st) => (
          <li
            key={st.id}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] ${
              st.current
                ? "border-deep bg-white font-semibold text-deep shadow-sm"
                : st.done
                  ? "border-[#e0ebe2] bg-[#f0f7f2] font-medium text-leaf"
                  : "border-transparent bg-transparent text-muted"
            }`}
          >
            {st.done ? <CheckCircle2 size={14} className="shrink-0 text-leaf" /> : <span className="h-2 w-2 shrink-0 rounded-full bg-line" />}
            <span className="truncate">{st.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function QueueDetail({ c }: { c: Case }) {
  const ev = c.latest;
  const referred = c.participant.referrals.length > 0;
  const due = referred || c.task?.status === "closed" ? null : dueOf(c);
  const p = c.participant;
  const isNew = isIntakeOnly(c);

  return (
    <>
      <section className="rounded-2xl border border-[#ebece8] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="flex min-w-0 flex-wrap items-center gap-3">
            <span className="text-[28px] font-semibold leading-none tracking-[-0.02em] sm:text-[32px]">{p.id}</span>
            <span className="[&>span]:px-3 [&>span]:py-1 [&>span]:text-[14px]">
              <LevelPill level={levelOf(c)} />
            </span>
            {isNew && (
              <span className="rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                New Concern
              </span>
            )}
          </p>

          <div className="flex flex-wrap gap-2">
            {isNew ? (
              <>
                <Link href={caseHref(p.id, "#concern")} className={btnClass.primary}>
                  <MessageSquareText size={17} /> Review Full Concern <ArrowRight size={16} />
                </Link>
                <Link href={caseHref(p.id, "#refer")} className={btnClass.secondary}>
                  <Stethoscope size={17} /> Confirm & Refer
                </Link>
              </>
            ) : (
              <>
                {referred && (
                  <Link href={caseHref(p.id, "#referrals")} className={btnClass.secondary}>
                    <Route size={17} strokeWidth={1.8} /> View Referral
                  </Link>
                )}
                <Link href={caseHref(p.id)} className={btnClass.primary}>
                  Open Case <ArrowRight size={17} />
                </Link>
              </>
            )}
          </div>
        </div>

        <p className="mt-2 text-[15px] text-body">
          {isNew
            ? `Concern raised by ${c.concern.raised_by.toLowerCase()} on ${fmtDate(c.concern.date)} (${fmtRelTime(c.concern.date)}) · not yet enrolled`
            : [`${p.age} years`, p.sex === "F" ? "Female" : "Male", `${p.dialect} dialect`, p.education && `${p.education[0].toUpperCase()}${p.education.slice(1)} schooling`, p.emirate].filter(Boolean).join(" · ")}
          {due && (
            <span className="ms-2 inline-flex items-center gap-1.5 font-medium text-ink">
              · <CalendarClock size={15} className="text-leaf" /> review target: <b>{fmtDate(due)}</b> ({fmtRelTime(due)})
            </span>
          )}
        </p>

        {/* Assigned Healthcare Facility & 21-Day Callback SLA */}
        {(() => {
          const fac = facilityOf(c);
          const con = contactOf(c);
          if (!fac?.name) return null;
          return (
            <div className="mt-4 rounded-xl border border-leaf/30 bg-leaf/5 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-deep shadow-sm">
                  <Building2 size={20} className="text-leaf" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15.5px] font-semibold text-deep">{fac.name}</span>
                    {fac.area && (
                      <span className="rounded-full bg-leaf/15 px-2.5 py-0.5 text-[12px] font-medium text-leaf">
                        {fac.area}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] text-body">
                    Assigned Catchment Center · Clinical SLA: <b>Review & callback within 21 days</b>
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[13px]">
                    {con.phone ? (
                      <a
                        href={`tel:${con.phone}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 font-semibold text-leaf shadow-sm hover:bg-paper"
                      >
                        <Phone size={13} /> Call {con.phone}
                      </a>
                    ) : (
                      <span className="flex items-center gap-1 text-[12.5px] text-muted">
                        <Phone size={12} /> No phone provided
                      </span>
                    )}
                    {con.email && (
                      <a
                        href={`mailto:${con.email}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 font-medium text-deep shadow-sm hover:bg-paper"
                      >
                        <Mail size={13} /> {con.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Clinical Pathway Stepper */}
        <div className="mt-4">
          <ClinicalStepper c={c} />
        </div>

        {/* Level Reason Banner */}
        {ev && (
          <div className="mt-5 flex gap-4 rounded-2xl bg-[#f1f4ee] p-4 sm:p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#dcefe2]">
              <Mark className="h-6 w-auto" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold text-ink">Why this triage level</p>
              <ul className="mt-1.5 space-y-1.5 text-[15px] leading-snug">
                {ev.reasons.map((r) => (
                  <li key={r} className="flex gap-2.5">
                    <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
                    <span>{r.replace(/->/g, "→")}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Direct Action Bar */}
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Clinician Decision</p>
          <TaskActions c={c} />
        </div>
      </section>

      {/* Case Quick Cards */}
      {isNew ? (
        <Panel
          title="The reported concern"
          icon={MessageSquareText}
          aside={
            <Link href={caseHref(p.id, "#concern")} className="inline-flex items-center gap-1 text-[13.5px] font-medium text-leaf hover:underline">
              Inspect details <ArrowRight size={14} />
            </Link>
          }
        >
          {c.concern.in_their_words ? (
            <blockquote
              dir={p.language === "ar" ? "rtl" : "ltr"}
              lang={p.language}
              className={`rounded-xl border-s-[3px] border-sand bg-sand-soft/30 p-3.5 text-ink ${
                p.language === "ar" ? "text-[16.5px] leading-[1.8]" : "text-[15px] leading-relaxed"
              }`}
            >
              {c.concern.in_their_words}
            </blockquote>
          ) : (
            <p className="text-[14.5px] text-muted">No free-text concern recorded.</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2 text-[13.5px]">
            {c.concern.what_changed.length > 0 && (
              <span className="rounded-lg bg-paper px-2.5 py-1 text-body">
                <b>Noticed:</b> {c.concern.what_changed.join(", ")}
              </span>
            )}
            {c.concern.who_now_does_what.length > 0 && (
              <span className="rounded-lg bg-paper px-2.5 py-1 text-body">
                <b>Household handover:</b> {c.concern.who_now_does_what.join("; ")}
              </span>
            )}
          </div>
        </Panel>
      ) : (
        <>
          {ev && ev.drivers.length > 0 && (
            <Panel title="Assessment inputs" icon={ClipboardList} aside={<span className="text-[13.5px] text-body">Thresholds from config.py</span>}>
              <DriversTable drivers={ev.drivers} />
            </Panel>
          )}

          {c.history.length > 1 && (
            <Panel title="Over time" icon={LineChart} aside={<span className="text-[13.5px] text-body">Normalized against baseline</span>}>
              <Trend history={c.history} />
            </Panel>
          )}
        </>
      )}

      {/* Footer Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 text-[13.5px]">
        <span className="text-muted">MemBrain flags risk and change. It does not diagnose.</span>
        <div className="flex items-center gap-3">
          <Link href={caseHref(p.id, "#cognitive")} className="inline-flex items-center gap-1 font-medium text-leaf hover:underline">
            Cognitive scores <ArrowUpRight size={14} />
          </Link>
          <span className="text-line">|</span>
          <Link href={caseHref(p.id, "#referrals")} className="inline-flex items-center gap-1 font-medium text-leaf hover:underline">
            Referral letter & care plan <ArrowUpRight size={14} />
          </Link>
          <span className="text-line">|</span>
          <Link href={caseHref(p.id)} className="inline-flex items-center gap-1 font-semibold text-deep hover:underline">
            Full Case <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </>
  );
}
