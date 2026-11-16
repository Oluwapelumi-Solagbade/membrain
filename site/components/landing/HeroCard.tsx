import { AudioLines, CalendarDays, ShieldAlert, UserRound, UsersRound } from "lucide-react";
import { getEngine, getIntake, type Reporter } from "@/lib/mb";
import { ACTIVITY, label } from "@/lib/labels";
import { Narrative } from "../Narrative";

// A real intake: everything on this card is the rules extractor's output for this narrative, computed at
// build time, and the next step comes from the triage engine. Nothing on it is drawn by hand.
const TEXT = "About two years ago, my mom became more forgetful. She sometimes repeats the same question, and she doesn't want to go out like before. My sister now pays her bills.";
const REPORTER: Reporter = "family";

const CHIP: Record<string, string> = {
  memory: "Memory",
  mood: "Mood",
  executive: "Money and planning",
  language: "Words and conversation",
  orientation: "Time and place",
  daily_function: "Daily activities",
  behaviour: "Behaviour",
  sleep: "Sleep",
};
const CHIP_ORDER = Object.keys(CHIP);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function HeroCard({ className = "" }: { className?: string }) {
  const r = getIntake().extract(TEXT, "en");
  const domains = r.fields.filter((f) => f.kind === "domain").sort((a, b) => CHIP_ORDER.indexOf(a.key) - CHIP_ORDER.indexOf(b.key));
  const flags = r.fields.filter((f) => f.kind === "red_flag");
  const session = {
    session_id: "hero-intake",
    date: "2026-11-14",
    type: "intake" as const,
    channel: "app",
    concern: TEXT,
    reporter: REPORTER,
    reported_concern: { reporter: REPORTER, domains: domains.map((d) => d.key), activities_taken_over: [...new Set(r.timeline.map((t) => t.activity))] },
    red_flags: flags.map((f) => f.key),
  };
  const ev = getEngine().evaluate({ id: "hero", age: 71, education: "primary" }, [session]).latest;
  const next =
    ev.level === "URGENT"
      ? { title: "Emergency steps shown now", pill: "Urgent" }
      : ev.level === "CLINICIAN_REVIEW"
        ? { title: "Next: a clinician review", pill: "Review in 21 days" }
        : { title: "Next: a first check-in", pill: "Routine path" };

  return (
    <div className={`flex w-full flex-col overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-[0_32px_70px_-28px_rgb(15_40_30/0.45),0_8px_20px_-10px_rgb(0_0_0/0.12)] ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-6 pb-3 pt-5 sm:px-7">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.2em] text-deep">What we heard</p>
        <p className="inline-flex items-center gap-1.5 text-[13.5px] text-body">
          <UserRound size={16} strokeWidth={1.8} /> A family member <span className="text-muted">·</span> English
        </p>
      </div>

      <div className="px-6 pb-4 sm:ps-[68px] sm:pe-8">
        <Narrative text={TEXT} result={r} className="!text-[17px] !leading-[1.75] text-ink" />
      </div>

      <div className="mx-6 grid gap-5 border-t border-line py-4 sm:mx-7 sm:grid-cols-2 sm:gap-0">
        <div className="flex gap-3 sm:border-e sm:border-line sm:pe-5">
          <UsersRound size={24} strokeWidth={1.7} className="mt-0.5 shrink-0 text-deep" aria-hidden />
          <div>
            <p className="text-[14px] text-body">Who is doing what now?</p>
            <p className="mt-1.5 text-[15.5px] font-semibold">
              {r.timeline.map((t) => `${label(ACTIVITY, t.activity, "en", t.activity_label)}: ${cap(t.who_label)}`).join("; ") || "No change reported"}
            </p>
          </div>
        </div>
        <div className="flex gap-3 sm:ps-6">
          <AudioLines size={24} strokeWidth={1.7} className="mt-0.5 shrink-0 text-deep" aria-hidden />
          <div>
            <p className="text-[14px] text-body">What has changed?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {domains.map((d) => (
                <span key={d.key} className="rounded-lg bg-mist px-3 py-1 text-[14px] font-medium text-deep">
                  {CHIP[d.key] ?? d.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-4 mb-4 mt-auto flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f3f6f3] px-4 py-3.5 sm:mx-5 sm:mb-5">
        <div className="flex items-center gap-3.5">
          {flags.length ? (
            <ShieldAlert size={26} strokeWidth={1.7} className="shrink-0 text-lv-urgent" aria-hidden />
          ) : (
            <CalendarDays size={26} strokeWidth={1.7} className="shrink-0 text-deep" aria-hidden />
          )}
          <div>
            <p className="text-[15.5px] font-semibold leading-tight">{next.title}</p>
            <p className="mt-0.5 text-[13.5px] text-body">A clinician confirms every fact first.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-mist-strong px-3 py-1.5 text-[13.5px] font-semibold text-deep">
          <span className="h-2 w-2 rounded-full bg-deep" aria-hidden />
          {next.pill}
        </span>
      </div>
    </div>
  );
}
