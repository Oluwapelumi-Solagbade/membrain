"use client";

import { ACTIVITY, WHO, label } from "@/lib/labels";
import { DEMO_TODAY, type Evaluation } from "@/lib/mb";
import { fmtDate } from "@/lib/workspace/derive";
import type { Participant } from "@/lib/workspace/types";

/* "Who does it now": tasks the household has quietly taken over, on the same time axis as the check-ins.
 * In many UAE homes a relative, driver or domestic helper takes over the bills, the medicines or the driving before
 * anyone asks for an assessment, so decline in everyday function stays hidden. Questionnaires ask "can they still do
 * it?"; this asks "who does it now, and since when?". Dates come from the informant's own words ("about 8 months
 * ago") or, for a concern, the day it was reported. Nothing here is scored: it is shown to the clinician as context. */

type Row = { date: string; approx: boolean; activity: string; who: string; why?: string; source: string };
type InformantRow = { activity?: string; change?: string; when?: string; who_took_over?: string; why?: string };

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30.44, year: 365.25 };

/** "about 8 months ago" → a date before `today`; null if the words give no amount of time. */
export function whenToDate(when: string | undefined, today: string): string | null {
  const m = (when ?? "").toLowerCase().match(/(\d+(?:\.\d+)?|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(day|week|month|year)s?/);
  if (!m) return null;
  const n = NUM[m[1]] ?? parseFloat(m[1]);
  const d = new Date(today + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - Math.round(n * UNIT_DAYS[m[2]]));
  return d.toISOString().slice(0, 10);
}

const DAY = 86400000;
const t = (s: string) => Date.parse(s.slice(0, 10) + "T00:00:00Z");
const monthYear = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const monthsBetween = (a: string, b: string) => Math.round((t(b) - t(a)) / DAY / 30.44);
const LEVEL_FILL: Record<string, string> = {
  BASELINE: "fill-lv-base", STABLE: "fill-lv-stable", CHECK_AGAIN: "fill-lv-check", CLINICIAN_REVIEW: "fill-lv-review", URGENT: "fill-lv-urgent",
};
const LEVEL_TEXT: Record<string, string> = { BASELINE: "Baseline", STABLE: "Stable", CHECK_AGAIN: "Check again", CLINICIAN_REVIEW: "Clinician review", URGENT: "Urgent" };

export function handoverRows(p: Participant): Row[] {
  const rows: Row[] = [];
  const inf = p.informant;
  const infSource = inf ? [inf.relation, inf.type === "household_helper" ? "household helper" : inf.type].filter(Boolean).join(", ") : "";
  for (const r of ((inf?.timeline ?? []) as InformantRow[])) {
    const date = whenToDate(r.when, DEMO_TODAY);
    if (!date || !r.activity) continue;
    rows.push({ date, approx: true, activity: r.activity, who: r.who_took_over || "someone else", why: r.why, source: `Informant (${infSource || "family"}): "${r.when}"` });
  }
  // Concerns raised in the app: the extractor's "who took over which activity", dated by when the concern was reported.
  const seen = new Set(rows.map((r) => r.activity.toLowerCase()));
  const add = (date: string | undefined, tl: [string, string][] | undefined, by: string) => {
    for (const [a, w] of tl ?? []) {
      const act = label(ACTIVITY, a, "en");
      if (!date || seen.has(act.toLowerCase())) continue;
      seen.add(act.toLowerCase());
      rows.push({ date: date.slice(0, 10), approx: false, activity: act, who: label(WHO, w, "en"), source: `Reported in a concern${by ? ` by ${by}` : ""}` });
    }
  };
  for (const s of p.sessions ?? []) {
    const rc = (s as { reported_concern?: { timeline?: [string, string][]; reporter?: string } }).reported_concern;
    if (rc?.timeline?.length) add(s.date, rc.timeline, rc.reporter === "helper" ? "the household helper" : rc.reporter === "family" ? "a family member" : "");
  }
  add(p.intake?.at, p.intake?.confirmed?.timeline, p.intake?.reporter === "helper" ? "the household helper" : p.intake?.reporter === "family" ? "a family member" : "");
  return rows.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function Handover({ p, history }: { p: Participant; history: Evaluation[] }) {
  const rows = handoverRows(p);
  if (!rows.length) return null;
  const checks = history.filter((h) => (h as { z?: unknown }).z);
  const flagged = history.find((h) => h.level === "CLINICIAN_REVIEW" || h.level === "URGENT");
  const first = rows[0];

  const dates = [...rows.map((r) => r.date), ...checks.map((h) => h.date), DEMO_TODAY];
  const lo = Math.min(...dates.map(t)) - 20 * DAY, hi = t(DEMO_TODAY) + 10 * DAY;
  const W = 760, L = 190, R = 20, rowH = 34, top = 34;
  const H = top + rowH * (rows.length + 1) + 18;
  const x = (d: string) => L + ((t(d) - lo) / (hi - lo)) * (W - L - R);
  const ticks: string[] = [];
  for (let d = new Date(lo); d.getTime() <= hi; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    if (m.getTime() >= lo) ticks.push(m.toISOString().slice(0, 10));
  }

  const lead = flagged ? monthsBetween(first.date, flagged.date) : monthsBetween(first.date, DEMO_TODAY);
  return (
    <div>
      <p className="text-[15px] leading-relaxed text-ink">
        <span className="font-semibold">
          {first.activity} handed to {first.who}, {first.approx ? `about ${monthYear(first.date)}` : fmtDate(first.date)}
        </span>
        {first.why ? ` (${first.why.toLowerCase()})` : ""}.{" "}
        {flagged
          ? lead > 0
            ? `That was about ${lead} month${lead === 1 ? "" : "s"} before a check-in reached ${LEVEL_TEXT[flagged.level].toLowerCase()}.`
            : lead < 0
              ? `A check-in had already reached ${LEVEL_TEXT[flagged.level].toLowerCase()} about ${-lead} month${lead === -1 ? "" : "s"} earlier; the household's report shows the change in daily life.`
              : "Check-ins and the household reported change at about the same time."
          : `No check-in has reached clinician review; the household noticed first, about ${lead} month${lead === 1 ? "" : "s"} ago.`}
      </p>

      <div className="-mx-1 mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tasks taken over by others and check-in results on one time axis" className="h-auto w-full min-w-[620px]">
          {ticks.map((d) => (
            <g key={d}>
              <line x1={x(d)} x2={x(d)} y1={top - 12} y2={H - 16} className="stroke-line" />
              <text x={x(d)} y={H - 3} textAnchor="middle" className="fill-muted text-[11px]">
                {new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}
              </text>
            </g>
          ))}
          <line x1={x(DEMO_TODAY)} x2={x(DEMO_TODAY)} y1={top - 18} y2={H - 16} className="stroke-ink/40" strokeDasharray="3 3" />
          <text x={x(DEMO_TODAY)} y={top - 22} textAnchor="end" className="fill-muted text-[11px]">today</text>

          {/* lane 1: check-ins */}
          <text x={0} y={top + 4} className="fill-body text-[12.5px] font-medium">Check-ins</text>
          {checks.map((h, i) => (
            <circle key={i} cx={x(h.date)} cy={top} r={7} className={LEVEL_FILL[h.level] ?? "fill-muted"}>
              <title>{`${fmtDate(h.date)}: ${LEVEL_TEXT[h.level] ?? h.level}`}</title>
            </circle>
          ))}

          {/* one lane per task taken over */}
          {rows.map((r, i) => {
            const y = top + rowH * (i + 1);
            return (
              <g key={r.activity}>
                <text x={0} y={y + 4} className="fill-ink text-[12.5px] font-medium">{r.activity.length > 28 ? r.activity.slice(0, 27) + "…" : r.activity}</text>
                <line x1={x(r.date)} x2={x(DEMO_TODAY)} y1={y} y2={y} className="stroke-sand" strokeWidth={6} strokeLinecap="round" />
                <rect x={x(r.date) - 6} y={y - 6} width={12} height={12} transform={`rotate(45 ${x(r.date)} ${y})`} className="fill-sand stroke-white" strokeWidth={2}>
                  <title>{`${r.activity}: now ${r.who}${r.why ? ` (${r.why})` : ""}. ${r.source}`}</title>
                </rect>
                <text x={Math.min(x(r.date) + 12, W - R - 150)} y={y - 10} className="fill-body text-[11.5px]">now {r.who}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="mt-3 space-y-1.5 text-[13.5px] text-body">
        {rows.map((r) => (
          <li key={r.activity}>
            <span className="font-medium text-ink">{r.activity}</span>: now {r.who}
            {r.why ? `; reason given: ${r.why}` : ""}. <span className="text-muted">{r.source}.</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-lg bg-mist px-3 py-2 text-[13px] leading-snug text-body">
        Questionnaires ask whether the person can still do a task. In many households a relative, driver or helper quietly takes it over first, so MemBrain asks who does it now, and since when. Context for the clinician, not a score; dates from the informant&apos;s words are approximate.
      </p>
    </div>
  );
}
