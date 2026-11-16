"use client";

// Charts and tables shared by the queue and the case page.
import type { Evaluation, Level } from "@/lib/mb";

const LEVEL_COLOUR: Record<Level, string> = { BASELINE: "#4d5f8a", STABLE: "#2f7d4f", CHECK_AGAIN: "#9a5d14", CLINICIAN_REVIEW: "#b0442c", URGENT: "#8f1d3b", INVALID: "#6b7b80" };

export const fmtNum = (x: number) => (x < 0 ? "−" : "") + Math.abs(x).toFixed(2);
export const fmtChange = (x: number) => (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toFixed(2);

/** Composite score at each scored session, against the person's own baseline. */
export function Trend({ history }: { history: Evaluation[] }) {
  const pts = history
    .map((h) => ({ d: h.date, z: (h as unknown as { z?: { composite?: number } }).z?.composite, lv: h.level }))
    .filter((p): p is { d: string; z: number; lv: Level } => typeof p.z === "number");
  if (pts.length < 2) return <p className="text-[15px] text-muted">The trend appears after two scored check-ins.</p>;
  const W = 640, H = 180, P = { l: 36, r: 16, t: 14, b: 26 };
  const zs = pts.map((p) => p.z);
  const lo = Math.min(-2.5, Math.floor(Math.min(...zs))), hi = Math.max(1, Math.ceil(Math.max(...zs)));
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / (pts.length - 1);
  const y = (z: number) => P.t + ((hi - z) * (H - P.t - P.b)) / (hi - lo);
  const base = zs.slice(0, Math.min(2, zs.length)).reduce((a, b) => a + b, 0) / Math.min(2, zs.length);
  const ticks: number[] = [];
  for (let z = hi; z >= lo; z--) ticks.push(z);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Composite score at each check-in compared with the person's own baseline">
        {ticks.map((z) => (
          <g key={z}>
            <line x1={P.l} x2={W - P.r} y1={y(z)} y2={y(z)} stroke="#e7e9e5" strokeDasharray={z === 0 ? undefined : "2 4"} />
            <text x={P.l - 8} y={y(z) + 4} textAnchor="end" fontSize="11" fill="#6c7772">
              {z > 0 ? `+${z}` : z}
            </text>
          </g>
        ))}
        <line x1={P.l} x2={W - P.r} y1={y(base)} y2={y(base)} stroke="#2a6045" strokeWidth="1.5" strokeDasharray="6 4" />
        <text x={W - P.r} y={y(base) - 6} textAnchor="end" fontSize="11" fill="#2a6045">
          own baseline
        </text>
        <polyline fill="none" stroke="#0f3f2c" strokeWidth="2" points={pts.map((p, i) => `${x(i)},${y(p.z)}`).join(" ")} />
        {pts.map((p, i) => (
          <g key={p.d + i}>
            <circle cx={x(i)} cy={y(p.z)} r="5" fill={LEVEL_COLOUR[p.lv]} stroke="#fff" strokeWidth="2" />
            <text x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"} fontSize="11" fill="#6c7772">
              {new Date(p.d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 text-[13px] text-muted">Composite score (z) at each check-in, adjusted for age and schooling. Dot colour is the level that session produced.</figcaption>
    </figure>
  );
}

/** The inputs behind a level, against their thresholds, with the change since baseline. */
export function DriversTable({ drivers }: { drivers: Evaluation["drivers"] }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[480px] border-separate border-spacing-0 text-[15.5px]">
        <thead>
          <tr className="text-[15px] text-ink">
            <th className="rounded-l-lg bg-[#f5f5f2] px-4 py-2.5 text-left font-medium">Input</th>
            <th className="bg-[#f5f5f2] px-4 py-2.5 text-right font-medium">Value</th>
            <th className="bg-[#f5f5f2] px-4 py-2.5 text-right font-medium">Threshold</th>
            <th className="rounded-r-lg bg-[#f5f5f2] px-4 py-2.5 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr key={d.input}>
              <td className="border-b border-[#f0f0ec] px-4 py-2.5">{d.input}</td>
              <td className="border-b border-[#f0f0ec] px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{fmtNum(d.value)}</td>
              <td className="border-b border-[#f0f0ec] px-4 py-2.5 text-right font-mono tabular-nums text-body">{fmtNum(d.threshold)}</td>
              <td className="border-b border-[#f0f0ec] px-4 py-2 text-right">
                {d.change != null ? (
                  <span className="inline-block rounded-md bg-[#e4ece3] px-2 py-0.5 font-mono text-[14.5px] font-medium tabular-nums text-deep">{fmtChange(d.change)}</span>
                ) : (
                  <span className="text-muted">–</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
