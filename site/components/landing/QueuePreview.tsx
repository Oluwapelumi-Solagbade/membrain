import { getEngine, config, type Level, type Persona } from "@/lib/mb";
import personas from "@/lib/generated/personas.json";
import { LevelPill } from "../ui";

const ORDER: Level[] = ["URGENT", "CLINICIAN_REVIEW", "CHECK_AGAIN", "BASELINE", "STABLE", "INVALID"];

/** A window onto the clinician queue: the synthetic cohort, triaged by the real engine at build time. */
export function QueuePreview() {
  const E = getEngine();
  const rows = (personas as Persona[])
    .map((p) => ({ p, ev: E.evaluate(p, p.sessions).latest }))
    .sort((a, b) => ORDER.indexOf(a.ev.level) - ORDER.indexOf(b.ev.level));
  const open = rows.filter((r) => r.ev.level === "URGENT" || r.ev.level === "CLINICIAN_REVIEW").length;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_30px_70px_-34px_rgb(15_63_44/0.45)]">
      <div className="flex items-center gap-2 border-b border-line bg-paper px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#e8e4dc]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e8e4dc]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e8e4dc]" />
        <span className="ms-3 truncate rounded-md bg-white px-3 py-1 font-mono text-[11.5px] text-muted">membrain / clinician / review-queue</span>
      </div>
      <div className="flex items-baseline justify-between gap-4 px-5 pb-3 pt-4">
        <div>
          <p className="text-[17px] font-semibold tracking-tight">Review queue</p>
          <p className="text-[13px] text-muted">
            {open} open alerts, sorted by urgency · engine {config.ENGINE_VERSION}
          </p>
        </div>
        <span className="hidden rounded-lg bg-mist px-2.5 py-1 text-[12px] font-medium text-deep sm:inline">Today, 14 Nov</span>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {rows.slice(0, 5).map(({ p, ev }) => (
          <li key={p.id} className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[132px_1fr_auto]">
            <div>
              <p className="whitespace-nowrap font-mono text-[13px] font-medium">{p.id}</p>
              <p className="text-[12px] text-muted">
                {p.age} y · {p.dialect}
              </p>
            </div>
            <p className="col-span-2 row-start-2 line-clamp-2 text-[13px] leading-snug text-body sm:col-span-1 sm:row-start-auto">{ev.reasons[0]}</p>
            <div className="col-start-2 row-start-1 sm:col-start-auto">
              <LevelPill level={ev.level} size="sm" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
