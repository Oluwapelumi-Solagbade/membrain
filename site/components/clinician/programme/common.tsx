"use client";

// Small pieces shared by the cohorts, reports, validation and settings pages.
import type { ReactNode } from "react";
import { LEVEL_LABEL, LEVEL_TONE, type Level } from "@/lib/mb";

export const pct = (x: number | null | undefined, d = 0) => (x == null ? "–" : `${(x * 100).toFixed(d)}%`);
export const num = (x: number | null | undefined, d = 2) => (x == null ? "–" : x.toFixed(d));
/** A value with its 95% interval, e.g. 83% (79–87). */
export const ci = (t: [number, number, number] | number[] | undefined) => (t && t.length === 3 ? `${pct(t[0])} (${pct(t[1])}–${pct(t[2])})` : "–");

export const LEVEL_ORDER: Level[] = ["URGENT", "CLINICIAN_REVIEW", "CHECK_AGAIN", "BASELINE", "STABLE", "INVALID"];

/** A stacked bar of how many cases sit at each level, with a legend. */
export function LevelBar({ counts, total }: { counts: Partial<Record<Level, number>>; total: number }) {
  const levels = LEVEL_ORDER.filter((l) => (counts[l] ?? 0) > 0);
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#efefeb]" role="img" aria-label={levels.map((l) => `${LEVEL_LABEL.en[l]}: ${counts[l]}`).join(", ")}>
        {levels.map((l) => (
          <span key={l} className={`${LEVEL_TONE[l].dot} h-full border-r-2 border-white last:border-r-0`} style={{ width: `${((counts[l] ?? 0) / Math.max(1, total)) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-body">
        {levels.map((l) => (
          <li key={l} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${LEVEL_TONE[l].dot}`} />
            {LEVEL_LABEL.en[l]} <span className="font-semibold text-ink">{counts[l]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One horizontal bar row: label, bar, value, and an optional reference line (e.g. the overall rate). */
export function BarRow({ label, value, of = 1, display, note, reference, tone = "bg-deep" }: { label: ReactNode; value: number | null; of?: number; display: ReactNode; note?: ReactNode; reference?: number | null; tone?: string }) {
  const w = value == null ? 0 : Math.max(0, Math.min(1, value / of)) * 100;
  return (
    <div className="grid grid-cols-[minmax(92px,150px)_1fr_auto] items-center gap-3 py-1.5">
      <span className="truncate text-[14px] text-ink">{label}</span>
      <span className="relative h-2.5 rounded-full bg-[#efefeb]">
        <span className={`absolute inset-y-0 left-0 rounded-full ${tone}`} style={{ width: `${w}%` }} />
        {reference != null && <span className="absolute -top-1 bottom-[-4px] w-0.5 bg-ink/60" style={{ left: `${(reference / of) * 100}%` }} title="Overall" />}
      </span>
      <span className="whitespace-nowrap text-right text-[14px] tabular-nums">
        <span className="font-semibold">{display}</span>
        {note && <span className="ms-1.5 text-muted">{note}</span>}
      </span>
    </div>
  );
}

/** A label and a value on one line, for small fact lists. */
export function Fact({ k, v, hint }: { k: ReactNode; v: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#f0f0ec] py-2.5 last:border-b-0">
      <span className="text-[14.5px] text-body">
        {k}
        {hint && <span className="mt-0.5 block text-[12.5px] text-muted">{hint}</span>}
      </span>
      <span className="shrink-0 text-right text-[15px] font-semibold tabular-nums">{v}</span>
    </div>
  );
}

/** A neutral note box, for honest caveats. */
export function Note({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" }) {
  return <div className={`rounded-xl px-4 py-3 text-[14.5px] leading-relaxed ${tone === "warn" ? "bg-lv-check-soft text-ink" : "bg-[#f3f5f1] text-body"}`}>{children}</div>;
}

export const selectClass = "h-11 rounded-xl border border-[#e3e4e0] bg-white px-3 pr-8 text-[14.5px] outline-none focus:border-leaf";
