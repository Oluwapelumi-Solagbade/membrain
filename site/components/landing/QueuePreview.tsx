import Image from "next/image";
import { getEngine, config, type Level, type Persona } from "@/lib/mb";
import personas from "@/lib/generated/personas.json";
import { LevelPill } from "../ui";

const ORDER: Level[] = ["URGENT", "CLINICIAN_REVIEW", "CHECK_AGAIN", "BASELINE", "STABLE", "INVALID"];

function WindowBar({ path }: { path: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-line bg-paper px-4 py-2.5">
      <span className="h-2.5 w-2.5 rounded-full bg-[#e6e4de]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#e6e4de]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#e6e4de]" />
      <span className="ms-3 truncate rounded-md bg-white px-3 py-1 font-mono text-[11.5px] text-muted">{path}</span>
    </div>
  );
}

/** The clinician view on the landing page: a real screenshot of a case page behind the review queue, which is
 *  the synthetic cohort triaged by the engine at build time. */
export function QueuePreview() {
  const E = getEngine();
  const rows = (personas as Persona[])
    .map((p) => ({ p, ev: E.evaluate(p, p.sessions).latest }))
    .sort((a, b) => ORDER.indexOf(a.ev.level) - ORDER.indexOf(b.ev.level));
  const open = rows.filter((r) => r.ev.level === "URGENT" || r.ev.level === "CLINICIAN_REVIEW").length;

  return (
    <div className="relative">
      {/* Back: the case page, as it looks in the workspace */}
      <figure className="ms-auto w-[94%] overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_24px_60px_-30px_rgb(15_40_30/0.4)]">
        <WindowBar path="membrain / clinician / case / MB-1187" />
        <Image
          src="/images/clinician-case.webp"
          alt="The clinician case page for MB-1187: clinician review, consent, why this level, and the assessment inputs against their thresholds"
          width={1600}
          height={1000}
          sizes="(min-width: 1024px) 640px, 94vw"
          className="block h-auto w-full"
        />
      </figure>

      {/* Front: the review queue */}
      <div className="relative -mt-[26%] w-[92%] overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_32px_70px_-28px_rgb(15_40_30/0.5),0_8px_20px_-10px_rgb(0_0_0/0.12)] sm:w-[80%]">
        <WindowBar path="membrain / clinician / review-queue" />
        <div className="flex items-baseline justify-between gap-4 px-5 pb-2.5 pt-3.5">
          <div>
            <p className="text-[16px] font-semibold tracking-tight">Review queue</p>
            <p className="text-[12.5px] text-muted">
              {open} open alerts, sorted by urgency · engine {config.ENGINE_VERSION}
            </p>
          </div>
          <span className="hidden shrink-0 rounded-lg bg-mist px-2.5 py-1 text-[12px] font-medium text-deep sm:inline">Today, 14 Nov</span>
        </div>
        <ul className="divide-y divide-line border-t border-line">
          {rows.slice(0, 4).map(({ p, ev }) => (
            <li key={p.id} className="flex items-start gap-3 px-5 py-3">
              <div className="w-[92px] shrink-0">
                <p className="whitespace-nowrap font-mono text-[13px] font-semibold">{p.id}</p>
                <p className="text-[12px] text-muted">
                  {p.age} y · {p.dialect}
                </p>
              </div>
              <p className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug text-body">{ev.reasons[0].replace(/->/g, "→")}</p>
              <LevelPill level={ev.level} size="sm" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
