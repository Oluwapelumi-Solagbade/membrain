"use client";

// The clinician's app: a dashboard, a map of the emirates, the alert queue, written reports and a case screen.
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, BellRing, CalendarClock, ChartColumnBig, ChevronRight, ClipboardCheck, ClipboardList, Copy, ExternalLink,
  FileText, HeartPulse, Home, Map as MapIcon, MessageSquarePlus, Mic, Route, Share2, ShieldCheck, Sparkles, Stethoscope, UserPlus, Users,
} from "lucide-react";
import { Card, cx, Empty, Hero, initials, Pill, Scroll, SectionTitle, Segmented, Sheet, SheetAction, Stat, TopBar, type Tab } from "./kit";
import { EMIRATES, UaeMap } from "./UaeMap";
import { useWorkspace } from "../clinician/WorkspaceProvider";
import { Logo } from "../Logo";
import programmeData from "@/lib/generated/programme-data.json";
import { ACTIVITY, DOMAIN, label } from "@/lib/labels";
import { LEVEL_LABEL, LEVEL_TONE, type Level } from "@/lib/mb";
import { useSession } from "@/lib/auth";
import { dueOf, fmtDate, isActive, isIntakeOnly, levelOf, ORDER, profileLine, sortCases, TODAY } from "@/lib/workspace/derive";
import { NAV, nav } from "@/lib/workspace/navigator";
import type { Case } from "@/lib/workspace/types";

export const CLIN_TABS: [Tab, Tab, Tab, Tab] = [
  { key: "home", label: "Home", icon: Home },
  { key: "map", label: "Map", icon: MapIcon },
  { key: "alerts", label: "Alerts", icon: BellRing },
  { key: "reports", label: "Reports", icon: FileText },
];

const nameOf = (c: Case) => (isIntakeOnly(c) ? "New concern" : c.participant.display_name?.en || c.participant.id);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86400000);
const lastDate = (c: Case) => c.participant.sessions.map((s) => s.date.slice(0, 10)).sort().pop() ?? null;
const hour = () => new Date().getHours();
const greet = () => (hour() < 12 ? "Good morning" : hour() < 17 ? "Good afternoon" : "Good evening");
const LEVEL_COLOR: Record<Level, string> = { URGENT: "#b3123a", CLINICIAN_REVIEW: "#b0442c", CHECK_AGAIN: "#c27c0e", BASELINE: "#3f5f9b", STABLE: "#2f7a4f", INVALID: "#8a9691" };
const V = (programmeData as unknown as { validation: { summary: { overall: { membrain: { sensitivity: number[]; specificity: number[] }; usual_care: { sensitivity: number[] }; completion_unaided: number } } } }).validation.summary.overall;

export function ClinicianHome({ onOpen, onTab, mode }: { onOpen: (id: string) => void; onTab: (t: string) => void; mode: "server" | "browser" | null }) {
  const { cases } = useWorkspace();
  const { session } = useSession();
  const s = useMemo(() => {
    const active = cases.filter(isActive);
    const urgent = active.filter((c) => levelOf(c) === "URGENT");
    const dueSoon = active.filter((c) => { const d = dueOf(c); return d != null && daysBetween(TODAY, d) <= 7; });
    const scored = cases.flatMap((c) => c.participant.sessions.filter((x) => x.type !== "intake" && x.type !== "informant"));
    const month = scored.length;
    const concerns = cases.flatMap((c) => c.participant.sessions.filter((x) => x.type === "intake")).filter((x) => daysBetween(x.date, TODAY) <= 7).length;
    const referrals = cases.reduce((n, c) => n + c.participant.referrals.filter(nav.isUnresolved).length, 0);
    const byLevel = ORDER.map((l) => ({ l, n: cases.filter((c) => levelOf(c) === l).length })).filter((x) => x.n);
    const recent = [...cases].sort((a, b) => ((lastDate(b) ?? "") > (lastDate(a) ?? "") ? 1 : -1)).slice(0, 6);
    return { active, urgent, dueSoon, month, concerns, referrals, byLevel, recent };
  }, [cases]);
  const max = Math.max(1, ...s.byLevel.map((x) => x.n));
  const first = (session?.user.name ?? "").replace(/\(.*?\)/, "").trim();
  return (
    <Scroll>
      <Hero>
        <div className="flex items-center justify-between">
          <Logo inverted size="sm" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-white/20">
            <span className={cx("h-1.5 w-1.5 rounded-full", mode === "server" ? "bg-[#7fd39a] mb-dot" : "bg-sand")} /> {mode === "server" ? "LIVE" : "ON DEVICE"}
          </span>
        </div>
        <p className="mt-5 text-[14px] text-white/70">{greet()}{first ? `, ${first}` : ""}</p>
        <h1 className="mt-0.5 font-serif text-[27px] font-semibold leading-tight tracking-[-0.015em]">Brain-health programme</h1>
        <div className="mt-4 grid grid-cols-3 divide-x divide-white/15 rounded-2xl bg-white/10 py-3 ring-1 ring-white/15 rtl:divide-x-reverse">
          {[["Need review", s.active.length, "alerts"], ["Urgent", s.urgent.length, "alerts"], ["Due in 7 days", s.dueSoon.length, "alerts"]].map(([l, n, t]) => (
            <button key={l as string} type="button" onClick={() => onTab(t as string)} className="px-2 text-center">
              <p className="font-serif text-[25px] font-semibold leading-none">{n as number}</p>
              <p className="mt-1.5 text-[11.5px] text-white/70">{l as string}</p>
            </button>
          ))}
        </div>
      </Hero>

      {s.urgent.length > 0 && (
        <button type="button" onClick={() => onTab("alerts")} className="mx-5 mt-4 flex w-[calc(100%-2.5rem)] items-center gap-2.5 rounded-2xl bg-lv-urgent-soft px-4 py-3 text-start ring-1 ring-lv-urgent/20">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lv-urgent text-white mb-ring"><AlertTriangle size={16} /></span>
          <span className="min-w-0 flex-1 text-[14px] font-semibold text-lv-urgent">{s.urgent.length} urgent {s.urgent.length === 1 ? "review" : "reviews"} waiting</span>
          <ChevronRight size={18} className="text-lv-urgent rtl:-scale-x-100" />
        </button>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 px-5">
        <Stat icon={Users} value={cases.length} label="People" sub="Enrolled and new concerns" />
        <Stat icon={Mic} value={s.month} label="Check-ins" sub="Spoken, across everyone" tone="text-[#3f5f9b]" />
        <Stat icon={MessageSquarePlus} value={s.concerns} label="New concerns" sub="This week" tone="text-lv-review" />
        <Stat icon={Route} value={s.referrals} label="Open referrals" sub="Followed until seen" tone="text-[#8a5a14]" onClick={() => onTab("reports")} />
      </div>

      <SectionTitle>Triage levels</SectionTitle>
      <Card className="mx-5 space-y-3 p-4">
        {s.byLevel.map(({ l, n }) => (
          <div key={l} className="flex items-center gap-3">
            <span className="w-[118px] shrink-0 text-[13px] text-body">{LEVEL_LABEL.en[l]}</span>
            <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-[#eef0ec]">
              <span className="absolute inset-y-0 start-0 rounded-full" style={{ width: `${(n / max) * 100}%`, background: LEVEL_COLOR[l] }} />
            </span>
            <span className="w-6 text-end font-mono text-[13px] font-semibold tabular-nums">{n}</span>
          </div>
        ))}
      </Card>

      <SectionTitle action={<button type="button" onClick={() => onTab("alerts")} className="text-[13px] font-medium text-deep">See all</button>}>Recent activity</SectionTitle>
      <div className="space-y-2.5 px-5">
        {s.recent.map((c) => <CaseRow key={c.participant.id} c={c} onOpen={onOpen} />)}
      </div>
    </Scroll>
  );
}

function CaseRow({ c, onOpen }: { c: Case; onOpen: (id: string) => void }) {
  const lv = levelOf(c);
  const reason = (c.task && c.task.status !== "closed" ? c.task.reasons[0] : c.latest?.reasons[0]) ?? "";
  return (
    <Card className="flex items-center gap-3 p-3.5" onClick={() => onOpen(c.participant.id)}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white" style={{ background: LEVEL_COLOR[lv] }}>
        {isIntakeOnly(c) ? "?" : initials(c.participant.display_name?.en)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold">{nameOf(c)}</span>
          <span className="shrink-0 font-mono text-[11.5px] text-muted">{c.participant.id}</span>
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-body">{reason.replace(/->/g, "→") || profileLine(c)}</span>
      </span>
      <Pill level={lv} />
    </Card>
  );
}

/* ── Alerts: the review queue ── */

type AlertFilter = "all" | "URGENT" | "CLINICIAN_REVIEW" | "CHECK_AGAIN";
export function ClinicianAlerts({ onOpen }: { onOpen: (id: string) => void }) {
  const { cases } = useWorkspace();
  const [f, setF] = useState<AlertFilter>("all");
  const active = useMemo(() => sortCases(cases.filter(isActive)), [cases]);
  const count = (l: Level) => active.filter((c) => levelOf(c) === l).length;
  const list = f === "all" ? active : active.filter((c) => levelOf(c) === f);
  return (
    <Scroll>
      <TopBar title="Alerts" sub={`${active.length} need attention · sorted by urgency`} />
      <div className="px-4 pt-3">
        <div className="mb-3 flex gap-2">
          {(["URGENT", "CLINICIAN_REVIEW", "CHECK_AGAIN"] as Level[]).map((l) => (
            <span key={l} className={cx("rounded-full px-2.5 py-1 text-[11.5px] font-semibold", LEVEL_TONE[l].bg, LEVEL_TONE[l].fg)}>{count(l)} {LEVEL_LABEL.en[l].toLowerCase()}</span>
          ))}
        </div>
        <Segmented value={f} onChange={setF} options={[{ key: "all", label: "All" }, { key: "URGENT", label: "Urgent" }, { key: "CLINICIAN_REVIEW", label: "Review" }, { key: "CHECK_AGAIN", label: "Check again" }]} />
      </div>
      <div className="mt-3 space-y-3 px-4">
        {list.length === 0 && <Empty icon={ShieldCheck} title="All clear" sub="No alerts match this filter." />}
        {list.map((c) => {
          const lv = levelOf(c);
          const reasons = (c.task && c.task.status !== "closed" ? c.task.reasons : c.latest?.reasons ?? []).slice(0, 2);
          const due = dueOf(c);
          const n = c.participant.sessions.filter((x) => x.type !== "intake" && x.type !== "informant").length;
          const r = c.participant.sessions.filter((x) => x.type === "intake" || x.type === "informant").length;
          return (
            <Card key={c.participant.id} className="overflow-hidden">
              <div className="flex">
                <span className="w-1.5 shrink-0" style={{ background: LEVEL_COLOR[lv] }} />
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Pill level={lv} />
                    {due && <span className="text-[12px] text-muted">Review by {fmtDate(due)}</span>}
                  </div>
                  <p className="mt-2 text-[16px] font-semibold">{nameOf(c)} <span className="font-mono text-[12px] font-normal text-muted">{c.participant.id}</span></p>
                  <p className="text-[12.5px] text-body">{profileLine(c)}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[#f6f8f5] p-2.5 text-center">
                    <div><p className="font-mono text-[16px] font-semibold">{n}</p><p className="text-[11px] text-muted">check-ins</p></div>
                    <div><p className="font-mono text-[16px] font-semibold">{r}</p><p className="text-[11px] text-muted">reports</p></div>
                    <div><p className="font-mono text-[16px] font-semibold">{c.participant.referrals.length}</p><p className="text-[11px] text-muted">referrals</p></div>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {reasons.map((x) => <li key={x} className="flex gap-2 text-[13px] leading-snug text-body"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: LEVEL_COLOR[lv] }} />{x.replace(/->/g, "→")}</li>)}
                  </ul>
                  <div className="mt-3.5 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => onOpen(c.participant.id)} className="rounded-xl bg-deep py-2.5 text-[13.5px] font-semibold text-white active:bg-deep-hover">Open case</button>
                    <Link href={`/clinician/case/?id=${encodeURIComponent(c.participant.id)}#refer`} className="rounded-xl border border-line py-2.5 text-center text-[13.5px] font-semibold active:bg-paper">Refer</Link>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </Scroll>
  );
}

/* ── Map ── */

export function ClinicianMap({ onOpen }: { onOpen: (id: string) => void }) {
  const { cases } = useWorkspace();
  const [layer, setLayer] = useState<"cases" | "services">("cases");
  const [sel, setSel] = useState<string | null>(null);
  const byEmirate = useMemo(() => {
    const m = new Map<string, Case[]>();
    cases.forEach((c) => { const e = (c.participant as { emirate?: string }).emirate; if (e) m.set(e, [...(m.get(e) ?? []), c]); });
    return m;
  }, [cases]);
  const services = NAV.directory as unknown as { id: string; name: string; emirate: string; area: string; pathways: string[]; wait_weeks: number; accepting_referrals: boolean }[];
  const markers = EMIRATES.map((e) => {
    if (layer === "services") {
      const n = services.filter((s) => s.emirate === e.key).length;
      return { key: e.key, count: n, color: "#2f7a4f", label: `${n} services` };
    }
    const list = (byEmirate.get(e.key) ?? []).filter(isActive);
    const worst = ORDER.find((l) => list.some((c) => levelOf(c) === l)) ?? "STABLE";
    return { key: e.key, count: list.length, color: LEVEL_COLOR[worst], label: `${list.length} need attention` };
  });
  const unknown = cases.filter((c) => !(c.participant as { emirate?: string }).emirate).length;
  const shown = layer === "cases" ? sortCases((sel ? byEmirate.get(sel) ?? [] : cases.filter((c) => (c.participant as { emirate?: string }).emirate)).filter(isActive)) : [];
  const svc = layer === "services" ? services.filter((s) => !sel || s.emirate === sel) : [];
  return (
    <Scroll>
      <TopBar title="Map" sub={sel ? `${sel} · tap again to show all` : "United Arab Emirates"} />
      <div className="px-4 pt-3">
        <Segmented value={layer} onChange={(v) => { setLayer(v); setSel(null); }} options={[{ key: "cases", label: "People needing attention" }, { key: "services", label: "Services" }]} />
        <div className="mt-3">
          <UaeMap markers={markers} selected={sel} onSelect={setSel} />
        </div>
        {layer === "cases" && unknown > 0 && <p className="mt-2 text-[12.5px] text-muted">{unknown} concerns raised without an emirate are not on the map.</p>}
        {layer === "services" && (
          <p className="mt-2 rounded-xl bg-sand-soft px-3.5 py-2.5 text-[13px] leading-snug text-[#6b4714]">
            Emirates with no listed service are service gaps: the navigator flags them on every referral. Directory is synthetic.
          </p>
        )}
      </div>
      <SectionTitle>{layer === "cases" ? `${shown.length} people` : `${svc.length} services`}</SectionTitle>
      <div className="space-y-2.5 px-5">
        {layer === "cases" && shown.map((c) => <CaseRow key={c.participant.id} c={c} onOpen={onOpen} />)}
        {layer === "cases" && shown.length === 0 && <Empty icon={ShieldCheck} title="All clear" sub="No one here needs attention." />}
        {svc.map((s) => (
          <Card key={s.id} className="p-3.5">
            <p className="text-[14.5px] font-semibold">{s.name}</p>
            <p className="mt-0.5 text-[12.5px] text-body">{s.area} · {s.pathways.map((p) => NAV.pathways[p] ?? p).join(", ")}</p>
            <p className="mt-1.5 flex items-center gap-2 text-[12px]">
              <span className="rounded-full bg-[#eef3ef] px-2 py-0.5 font-medium text-deep">Wait about {s.wait_weeks} weeks</span>
              {!s.accepting_referrals && <span className="rounded-full bg-lv-review-soft px-2 py-0.5 font-medium text-lv-review">Not accepting referrals</span>}
            </p>
          </Card>
        ))}
      </div>
    </Scroll>
  );
}

/* ── Reports ── */

export function ClinicianReports({ onOpen }: { onOpen: (id: string) => void }) {
  const { cases } = useWorkspace();
  const [kind, setKind] = useState<"programme" | "case">("programme");
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const generate = () => {
    setBusy(true);
    setReport(null);
    window.setTimeout(() => {
      setReport(programmeReport(cases));
      setBusy(false);
    }, 700);
  };
  const share = async (text: string) => {
    try {
      if (navigator.share) await navigator.share({ title: "MemBrain programme report", text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      /* cancelled */
    }
  };
  return (
    <Scroll>
      <TopBar title="Reports" sub="Written from the programme's own data" />
      <div className="px-4 pt-3">
        <Segmented value={kind} onChange={setKind} options={[{ key: "programme", label: "Programme report" }, { key: "case", label: "Case summaries" }]} />
      </div>
      {kind === "programme" ? (
        <div className="px-4">
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat icon={ChartColumnBig} value={`${Math.round(V.membrain.sensitivity[0] * 100)}%`} label="Sensitivity" sub={`Usual care ${Math.round(V.usual_care.sensitivity[0] * 100)}% · synthetic cohort`} />
            <Stat icon={ShieldCheck} value={`${Math.round(V.membrain.specificity[0] * 100)}%`} label="Specificity" sub="Fewer false referrals" tone="text-[#3f5f9b]" />
          </div>
          <button type="button" onClick={generate} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-deep py-4 text-[15.5px] font-semibold text-white disabled:opacity-70">
            <Sparkles size={18} className={busy ? "animate-pulse" : ""} /> {busy ? "Writing the report…" : "Generate programme report"}
          </button>
          {report && (
            <Card className="mt-4 overflow-hidden mb-step-in">
              <div className="flex items-center justify-between border-b border-line bg-[#f7faf7] px-4 py-3">
                <p className="flex items-center gap-2 text-[14.5px] font-semibold"><FileText size={16} className="text-leaf" /> Programme report</p>
                <button type="button" onClick={() => share(report)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold text-deep ring-1 ring-line">
                  {copied ? <><Copy size={13} /> Copied</> : <><Share2 size={13} /> Share</>}
                </button>
              </div>
              <ReportText text={report} />
            </Card>
          )}
          <p className="mt-3 px-1 text-[12px] leading-snug text-muted">Written by rules from the counts above, never by a language model, so every sentence can be traced to the data. Not a clinical assessment.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5 px-5">
          {sortCases(cases).map((c) => <CaseRow key={c.participant.id} c={c} onOpen={onOpen} />)}
        </div>
      )}
    </Scroll>
  );
}

function ReportText({ text }: { text: string }) {
  return (
    <div className="space-y-2.5 px-4 py-4 text-[14px] leading-relaxed">
      {text.split("\n\n").map((block, i) => {
        if (block.startsWith("# ")) return <h3 key={i} className="font-serif text-[19px] font-semibold text-deep">{block.slice(2)}</h3>;
        if (block.startsWith("## ")) return <h4 key={i} className="pt-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-leaf">{block.slice(3)}</h4>;
        if (block.startsWith("- ")) return <ul key={i} className="space-y-1">{block.split("\n").map((l) => <li key={l} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf" />{l.slice(2)}</li>)}</ul>;
        return <p key={i} className="text-body">{block}</p>;
      })}
    </div>
  );
}

function programmeReport(cases: Case[]): string {
  const active = cases.filter(isActive);
  const n = (l: Level) => cases.filter((c) => levelOf(c) === l).length;
  const refs = cases.flatMap((c) => c.participant.referrals);
  const open = refs.filter(nav.isUnresolved).length;
  const concerns = cases.filter((c) => c.participant.sessions.some((s) => s.type === "intake"));
  const spread = cases.filter((c) => c.history.some((h) => h.concern_change && !h.concern_change.first && (h.concern_change.new_activities.length || h.concern_change.new_domains.length)));
  const faqHigh = cases.filter((c) => c.history.some((h) => h.informant?.at_or_above_cutoff));
  const overdue = active.filter((c) => { const d = dueOf(c); return d != null && d < TODAY; });
  const urgentList = cases.filter((c) => levelOf(c) === "URGENT").map((c) => c.participant.id);
  return [
    `# MemBrain programme report`,
    `${fmtDate(TODAY)} · ${cases.length} people · synthetic data`,
    `## Summary`,
    `${active.length} of ${cases.length} people need attention: ${n("URGENT")} urgent, ${n("CLINICIAN_REVIEW")} for clinician review and ${n("CHECK_AGAIN")} to check again. ${n("STABLE")} are stable and ${n("BASELINE")} are still building their personal baseline. ${concerns.length} records began with a concern raised by a family member, a helper, a professional or the person themselves.`,
    `## Change over time`,
    [
      spread.length
        ? `- ${spread.length} ${spread.length === 1 ? "person's" : "people's"} reported concern has spread since it was first raised (a new memory or thinking area, or an activity newly taken over).`
        : "- No reported concern has spread since it was first raised.",
      faqHigh.length
        ? `- ${faqHigh.length} ${faqHigh.length === 1 ? "family questionnaire is" : "family questionnaires are"} at or above the cutoff: each needs a professional clinical evaluation, not a diagnosis.`
        : "- No family questionnaire is at or above the cutoff.",
    ].join("\n"),
    `## Referrals`,
    `${refs.length} referrals in total; ${open} still open and followed until the person is seen.`,
    `## Recommended actions`,
    [
      urgentList.length ? `- Contact the ${urgentList.length} urgent ${urgentList.length === 1 ? "case" : "cases"} today (${urgentList.join(", ")}).` : `- No urgent cases waiting.`,
      overdue.length ? `- ${overdue.length} ${overdue.length === 1 ? "review is" : "reviews are"} past the target date: reassign or act.` : `- All reviews are within their target dates.`,
      `- Send family questionnaires to anyone not asked in the last 12 weeks.`,
      `- Chase open referrals older than 14 days.`,
    ].join("\n"),
    `Thresholds are provisional until validated locally. MemBrain flags risk and change; it never diagnoses.`,
  ].join("\n\n");
}

/* ── One case ── */

export function CaseScreen({ id, onBack, onFollow }: { id: string; onBack: () => void; onFollow: (id: string) => void }) {
  const { byId, act } = useWorkspace();
  const c = byId(id);
  const [dismissing, setDismissing] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  if (!c) return (<><TopBar title={id} onBack={onBack} /><Empty icon={ClipboardList} title="Case not found" sub="It may have been removed or is not visible to you." /></>);
  const p = c.participant;
  const lv = levelOf(c);
  const reasons = c.task && c.task.status !== "closed" ? c.task.reasons : c.latest?.reasons ?? [];
  const z = c.history.map((h) => (h as unknown as { z?: { composite?: number } }).z?.composite).filter((v): v is number => typeof v === "number");
  const reports = c.history.filter((h) => h.concern_change || h.informant);
  const doAct = async (a: "request_repeat" | "order_investigations" | "dismiss" | "confirm_concern", n = "") => {
    if (!c.task) return;
    setBusy(a);
    try {
      await act(c.task.id, a, n);
      setDismissing(false);
    } finally {
      setBusy(null);
    }
  };
  const open = c.task && c.task.status !== "closed";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title={isIntakeOnly(c) ? "New concern" : p.display_name?.en ?? p.id} sub={`${p.id} · ${profileLine(c)}`} onBack={onBack} />
      <Scroll>
        <div className="px-4 pt-4">
          <Card className="overflow-hidden">
            <div className={cx("px-4 py-4", LEVEL_TONE[lv].bg)}>
              <Pill level={lv} />
              <ul className="mt-3 space-y-1.5">
                {reasons.slice(0, 3).map((r) => <li key={r} className="flex gap-2 text-[13.5px] leading-snug text-ink"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />{r.replace(/->/g, "→")}</li>)}
              </ul>
              {dueOf(c) && open && <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-medium text-body"><CalendarClock size={14} /> Review by {fmtDate(dueOf(c))}</p>}
            </div>
            {open && (
              <div className="grid grid-cols-2 gap-2 p-3">
                <Link href={`/clinician/case/?id=${encodeURIComponent(p.id)}#refer`} className="col-span-2 rounded-xl bg-deep py-3 text-center text-[14px] font-semibold text-white">Confirm and refer</Link>
                <button type="button" onClick={() => doAct("request_repeat")} disabled={!!busy} className="rounded-xl border border-line py-2.5 text-[13.5px] font-semibold active:bg-paper">{busy === "request_repeat" ? "Saving…" : "Check again"}</button>
                <button type="button" onClick={() => doAct("order_investigations")} disabled={!!busy} className="rounded-xl border border-line py-2.5 text-[13.5px] font-semibold active:bg-paper">{busy === "order_investigations" ? "Saving…" : "Order tests"}</button>
                <button type="button" onClick={() => setDismissing((x) => !x)} className="col-span-2 rounded-xl py-2 text-[13.5px] font-medium text-body active:bg-paper">Not a concern…</button>
                {dismissing && (
                  <div className="col-span-2 space-y-2">
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (required)" className="h-11 w-full rounded-xl border border-line px-3 text-[15px] outline-none focus:border-deep" />
                    <button type="button" onClick={() => doAct("dismiss", note.trim())} disabled={!note.trim() || !!busy} className="w-full rounded-xl bg-lv-review py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-50">Close as not a concern</button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {c.concern.in_their_words && (
          <>
            <SectionTitle>In their words</SectionTitle>
            <Card className="mx-4 p-4">
              <p dir="auto" className="text-[15px] leading-relaxed text-ink">“{c.concern.in_their_words}”</p>
              <p className="mt-2 text-[12px] text-muted">{c.concern.raised_by}{c.concern.date ? ` · ${fmtDate(c.concern.date)}` : ""}. Their account, not a clinical finding.</p>
            </Card>
          </>
        )}

        {z.length > 1 && (
          <>
            <SectionTitle>Check-ins over time</SectionTitle>
            <Card className="mx-4 p-4"><Spark values={z} /><p className="mt-2 text-[12px] text-muted">Overall score against age and schooling norms (z), each check-in.</p></Card>
          </>
        )}

        {reports.length > 0 && (
          <>
            <SectionTitle>Reports over time</SectionTitle>
            <div className="mx-4 space-y-2">
              {reports.map((h) => (
                <Card key={h.session_id} className="p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13.5px] font-semibold">{h.informant ? "Family questionnaire" : h.concern_change?.first ? "First concern" : "Follow-up concern"}</span>
                    <span className="font-mono text-[12px] text-muted">{h.date}</span>
                  </div>
                  {h.informant && <p className="mt-1 text-[13px] text-body">FAQ {h.informant.score}/{h.informant.max}{h.informant.change != null ? ` (${h.informant.change > 0 ? "+" : ""}${h.informant.change})` : ""}{h.informant.at_or_above_cutoff ? " · at or above cutoff" : ""}</p>}
                  {h.concern_change && (h.concern_change.new_domains.length > 0 || h.concern_change.new_activities.length > 0) && (
                    <p className="mt-1 text-[13px] text-lv-review">New: {[...h.concern_change.new_domains.map((d) => label(DOMAIN, d, "en")), ...h.concern_change.new_activities.map((a) => label(ACTIVITY, a, "en"))].join(", ")}</p>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}

        {c.prevention?.items?.length ? (
          <>
            <SectionTitle>Prevention plan</SectionTitle>
            <Card className="mx-4 divide-y divide-line">
              {c.prevention.items.map((x) => <p key={x.rule} dir="auto" className="flex gap-3 px-4 py-3 text-[13.5px] leading-relaxed"><HeartPulse size={16} className="mt-0.5 shrink-0 text-leaf" /><span dir="auto">{x.text}</span></p>)}
            </Card>
          </>
        ) : null}

        <SectionTitle>Actions</SectionTitle>
        <div className="mx-4 grid grid-cols-2 gap-2.5">
          <QuickLink href={`/checkin/?id=${encodeURIComponent(p.id)}&lang=${p.language ?? "en"}`} icon={Mic} label="Start a check-in" />
          <QuickButton onClick={() => onFollow(p.id)} icon={MessageSquarePlus} label="Record a change" />
          <QuickLink href={`/informant/?id=${encodeURIComponent(p.id)}`} icon={ClipboardCheck} label="Family questionnaire" />
          <QuickLink href={`/clinician/case/?id=${encodeURIComponent(p.id)}`} icon={ExternalLink} label="Full case" />
        </div>
      </Scroll>
    </div>
  );
}

function QuickLink({ href, icon: I, label }: { href: string; icon: typeof Mic; label: string }) {
  return <Link href={href} className="flex flex-col items-start gap-2 rounded-[18px] border border-[#e3e6e1] bg-white p-3.5 active:bg-paper"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef3ef] text-deep"><I size={18} /></span><span className="text-[13.5px] font-semibold">{label}</span></Link>;
}
function QuickButton({ onClick, icon: I, label }: { onClick: () => void; icon: typeof Mic; label: string }) {
  return <button type="button" onClick={onClick} className="flex flex-col items-start gap-2 rounded-[18px] border border-[#e3e6e1] bg-white p-3.5 text-start active:bg-paper"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef3ef] text-deep"><I size={18} /></span><span className="text-[13.5px] font-semibold">{label}</span></button>;
}

function Spark({ values }: { values: number[] }) {
  const W = 300, H = 70, lo = Math.min(-2.5, ...values), hi = Math.max(1, ...values);
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * (W - 12) + 6;
  const y = (v: number) => H - 8 - ((v - lo) / (hi - lo)) * (H - 16);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[70px] w-full" role="img" aria-label="Overall score over time">
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="#d9ded8" strokeDasharray="3 4" />
      <path d={d + `L${x(values.length - 1)},${H}L${x(0)},${H}Z`} fill="url(#sg)" opacity="0.5" />
      <defs><linearGradient id="sg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2a6045" stopOpacity="0.35" /><stop offset="1" stopColor="#2a6045" stopOpacity="0" /></linearGradient></defs>
      <path d={d} fill="none" stroke="#0f3f2c" strokeWidth="2.2" strokeLinejoin="round" />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.2" fill="#fff" stroke="#0f3f2c" strokeWidth="2" />)}
    </svg>
  );
}

/* ── The "+" sheet ── */

export function ClinicianPlus({ open, onClose, onIntake }: { open: boolean; onClose: () => void; onIntake: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="New">
      <SheetAction icon={MessageSquarePlus} title="New concern" sub="By voice or typing; urgent signs checked first" onClick={() => { onClose(); onIntake(); }} />
      <SheetAction href="/clinician/enrol/" onClick={onClose} icon={UserPlus} title="Enrol a participant" sub="Safety screen, identity vault, consent, plan" />
      <SheetAction href="/checkin/" onClick={onClose} icon={Mic} title="Start a check-in" sub="Six minutes, spoken, with someone present" tone="bg-[#e9eef8] text-[#3f5f9b]" />
      <SheetAction href="/clinician/live/" onClick={onClose} icon={Activity} title="Live data" sub="What visitors have added to the demo" tone="bg-sand-soft text-[#8a5a14]" />
      <SheetAction href="/clinician/" onClick={onClose} icon={Stethoscope} title="Open the full workspace" sub="Every tool, on a larger screen" tone="bg-[#f1f2ef] text-ink" />
    </Sheet>
  );
}

export function Section({ children }: { children: ReactNode }) {
  return <div className="px-5">{children}</div>;
}
