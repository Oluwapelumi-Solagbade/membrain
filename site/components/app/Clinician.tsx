"use client";

// The clinician's app: home, map, alerts, reports and the case. Everything reads the live workspace (the MemBrain
// server), refreshes every 20 seconds, and acts through the same API as the web workspace.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, BellRing, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, ClipboardList, Clock3, Copy,
  FileText, FlaskConical, HeartPulse, Home, Lock, Map as MapIcon, MessageSquarePlus, Mic, MoreHorizontal, Route, Search, Send, Share2,
  ShieldCheck, Sparkles, Stethoscope, UserPlus, X,
} from "lucide-react";
import { Avatar, Bars, Card, Chip, Donut, Empty, LiveBadge, Pill, relTime, Screen, SectionTitle, Segmented, Sheet, SheetAction, Skeleton, tap, useToast, type Tab } from "./kit";
import { EMIRATE_KEYS, LiveMap, PLACES, type MapPoint } from "./LiveMap";
import { ReferralTrack, ReferSheet } from "./Referral";
import { useWorkspace } from "../clinician/WorkspaceProvider";
import programmeData from "@/lib/generated/programme-data.json";
import { ACTIVITY, DOMAIN, label } from "@/lib/labels";
import { LEVEL_LABEL, type Level } from "@/lib/mb";
import { useSession } from "@/lib/auth";
import { dueOf, fmtDate, isActive, isIntakeOnly, levelOf, ORDER, profileLine, TODAY } from "@/lib/workspace/derive";
import { NAV, nav } from "@/lib/workspace/navigator";
import type { Case, VaultEntry } from "@/lib/workspace/types";

export const LEVEL_COLOR: Record<Level, string> = { URGENT: "#b3123a", CLINICIAN_REVIEW: "#c0502f", CHECK_AGAIN: "#c98a1b", BASELINE: "#4a6fb0", STABLE: "#2f8a57", INVALID: "#8a9691" };
const REF = () => { const t = new Date().toISOString().slice(0, 10); return t > TODAY ? t : TODAY; };
const days = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86400000);
export const nameOf = (c: Case) => (isIntakeOnly(c) ? "New concern" : c.participant.display_name?.en || c.participant.id);
const reasonsOf = (c: Case) => (c.task && c.task.status !== "closed" ? c.task.reasons : c.latest?.reasons ?? []).map((r) => r.replace(/->/g, "→"));
const lastDate = (c: Case) => c.participant.sessions.map((s) => s.date.slice(0, 10)).filter((d) => d <= REF()).sort().pop() ?? "";
const num2 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
/** Urgent first, then clinician review, then check again; within a level, the earliest review deadline first. */
const byUrgency = (list: Case[]) => [...list].sort((a, b) => ORDER.indexOf(levelOf(a)) - ORDER.indexOf(levelOf(b)) || (dueOf(a) ?? "9999").localeCompare(dueOf(b) ?? "9999"));

export function slaOf(c: Case): { text: string; tone: "bad" | "warn" | "neutral" } | null {
  if (!isActive(c)) return null;
  const d = dueOf(c);
  if (!d) return null;
  const n = days(REF(), d);
  if (n < 0) return { text: `Overdue ${-n} d`, tone: "bad" };
  if (n === 0) return { text: "Due today", tone: "bad" };
  return { text: `Due in ${n} d`, tone: n <= 3 ? "warn" : "neutral" };
}

export const CLIN_TABS = (alerts: number): [Tab, Tab, Tab, Tab] => [
  { key: "home", label: "Home", icon: Home },
  { key: "map", label: "Map", icon: MapIcon },
  { key: "alerts", label: "Alerts", icon: BellRing, badge: alerts },
  { key: "reports", label: "Reports", icon: FileText },
];

/* ── Shared pieces ── */

function CaseRow({ c, onOpen }: { c: Case; onOpen: (id: string) => void }) {
  const lv = levelOf(c);
  const sla = slaOf(c);
  return (
    <Card className="flex items-center gap-3.5 p-3.5" onClick={() => onOpen(c.participant.id)}>
      <Avatar name={nameOf(c)} color={LEVEL_COLOR[lv]} size={44} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15.5px] font-semibold tracking-[-0.01em]">{nameOf(c)}</span>
          <span className="shrink-0 font-mono text-[11px] text-muted">{c.participant.id}</span>
        </span>
        <span className="mt-0.5 line-clamp-1 text-[13px] text-body">{reasonsOf(c)[0] || profileLine(c)}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Pill level={lv} />
          {sla && <Chip tone={sla.tone} icon={Clock3}>{sla.text}</Chip>}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-[#b3bdb8] rtl:-scale-x-100" />
    </Card>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-3 px-5 pt-5">
      <Skeleton className="h-28" />
      <div className="grid grid-cols-2 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  );
}

const FEED: Record<string, [typeof Mic, string, string]> = {
  concern: [MessageSquarePlus, "Concern reported", "#c0502f"], faq: [ClipboardCheck, "Family questionnaire", "#4a6fb0"], checkin: [Mic, "Check-in completed", "#2f8a57"],
  "act:refer": [Send, "Referred", "#0f3f2c"], "act:dismiss": [X, "Closed as not a concern", "#8a9691"], "act:request_repeat": [CalendarClock, "Asked to check again", "#c98a1b"],
  "act:order_investigations": [FlaskConical, "Tests ordered", "#4a6fb0"], "act:confirm_concern": [CheckCircle2, "Concern confirmed", "#0f3f2c"],
};

/* ── Home ── */

export function ClinicianHome({ onOpen, onTab, onProfile }: { onOpen: (id: string) => void; onTab: (t: string) => void; onProfile: () => void }) {
  const { cases, ready, syncedAt, syncing, refresh } = useWorkspace();
  const { session } = useSession();
  const s = useMemo(() => {
    const active = byUrgency(cases.filter(isActive));
    const urgent = active.filter((c) => levelOf(c) === "URGENT");
    const overdue = active.filter((c) => slaOf(c)?.tone === "bad");
    const byLevel = ORDER.filter((l) => l !== "INVALID").map((l) => ({ l, n: cases.filter((c) => levelOf(c) === l).length }));
    const sessions = cases.flatMap((c) => c.participant.sessions.map((x) => ({ x, c })));
    const checkins = sessions.filter(({ x }) => x.type !== "intake" && x.type !== "informant").length;
    const end = REF(); // the chart ends today; check-ins scheduled after today are not activity yet
    const weeks = Array.from({ length: 8 }, (_, i) => sessions.filter(({ x }) => { const d = days(x.date, end); return d >= (7 - i) * 7 && d < (8 - i) * 7; }).length);
    const weekLabels = Array.from({ length: 8 }, (_, i) => (i === 7 ? "Now" : `${7 - i}w`));
    const openRefs = cases.reduce((n, c) => n + c.participant.referrals.filter(nav.isUnresolved).length, 0);
    const feed = [
      ...sessions.map(({ x, c }) => ({ at: x.date, c, kind: x.type === "intake" ? "concern" : x.type === "informant" ? "faq" : "checkin" })),
      ...cases.flatMap((c) => (c.task?.actions ?? []).map((a) => ({ at: a.ts, c, kind: `act:${a.action}` }))),
    ].filter((f) => f.at.slice(0, 10) <= REF()).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 7);
    return { active, urgent, overdue, byLevel, checkins, weeks, weekLabels, openRefs, feed };
  }, [cases]);
  const first = (session?.user.name ?? "").replace(/\(.*?\)/, "").trim();
  const h = new Date().getHours();
  const hello = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  const hero = (
    <div className="relative overflow-hidden rounded-b-[34px] bg-deep px-5 pb-6 text-white" style={{ paddingTop: "calc(var(--mb-sat) + 14px)" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgb(224_173_98/0.28),transparent_55%),radial-gradient(100%_90%_at_0%_110%,rgb(58_140_100/0.55),transparent_60%)]" />
      <div aria-hidden className="pointer-events-none absolute -end-16 -top-10 h-56 w-56 rounded-full border border-white/10" />
      <div aria-hidden className="pointer-events-none absolute -end-6 top-6 h-36 w-36 rounded-full border border-white/10" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <LiveBadge dark syncedAt={syncedAt} syncing={syncing} onSync={() => void refresh()} />
          <button type="button" onClick={() => { tap(); onProfile(); }} aria-label="Profile and settings" className="rounded-full ring-2 ring-white/25 transition-transform active:scale-95">
            <Avatar name={session?.user.name} color="#2a6045" size={38} />
          </button>
        </div>
        <p className="mt-6 text-[14.5px] text-white/70">{hello}{first ? `, ${first}` : ""}</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-[1.15] tracking-[-0.03em]">
          {s.active.length ? <>{s.active.length} {s.active.length === 1 ? "person needs" : "people need"} you</> : "All clear today"}
        </h1>
        <p className="mt-1 text-[13.5px] text-white/60">{session?.user.org ?? "Brain-health programme"}</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {([["Urgent", s.urgent.length, "#ff8fa3", "alerts"], ["Overdue", s.overdue.length, "#ffd08a", "alerts"], ["Open referrals", s.openRefs, "#9fe0b8", "reports"]] as [string, number, string, string][]).map(([l, n, col, to]) => (
            <button key={l} type="button" onClick={() => { tap(); onTab(to); }} className="rounded-2xl bg-white/10 px-3 py-3 text-start ring-1 ring-white/12 backdrop-blur transition-colors active:bg-white/15">
              <p className="text-[24px] font-semibold leading-none tabular-nums tracking-[-0.02em]">{n}</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-white/70"><span className="h-1.5 w-1.5 rounded-full" style={{ background: col }} />{l}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <Screen title="Home" hero={hero} onRefresh={refresh} refreshing={syncing}>
      {!ready ? <HomeSkeleton /> : (
        <>
          {s.urgent.length > 0 && (
            <button type="button" onClick={() => { tap(); onTab("alerts"); }} className="mx-5 mt-5 flex w-[calc(100%-2.5rem)] items-center gap-3 rounded-[20px] bg-gradient-to-r from-[#fde7ec] to-[#fbeef0] px-4 py-3.5 text-start ring-1 ring-lv-urgent/15">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lv-urgent text-white mb-ring"><AlertTriangle size={17} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold text-lv-urgent">{s.urgent.length} urgent {s.urgent.length === 1 ? "review" : "reviews"} waiting</span>
                <span className="block truncate text-[12.5px] text-[#8a2a40]">{s.urgent.map((c) => c.participant.id).slice(0, 3).join(" · ")}</span>
              </span>
              <ChevronRight size={18} className="text-lv-urgent rtl:-scale-x-100" />
            </button>
          )}

          <SectionTitle action={<button type="button" onClick={() => onTab("alerts")} className="text-[13.5px] font-semibold text-deep">See all</button>}>Needs you now</SectionTitle>
          {s.active.length === 0 ? (
            <Card className="mx-5"><Empty icon={ShieldCheck} title="All clear" sub="No one needs a review right now." /></Card>
          ) : (
            <div className="no-scrollbar flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2">
              {s.active.slice(0, 8).map((c) => {
                const lv = levelOf(c), sla = slaOf(c);
                return (
                  <Card key={c.participant.id} className="w-[272px] shrink-0 snap-start overflow-hidden" onClick={() => onOpen(c.participant.id)}>
                    <div className="h-1.5" style={{ background: LEVEL_COLOR[lv] }} />
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2"><Pill level={lv} />{sla && <Chip tone={sla.tone} icon={Clock3}>{sla.text}</Chip>}</div>
                      <div className="mt-3 flex items-center gap-2.5">
                        <Avatar name={nameOf(c)} color={LEVEL_COLOR[lv]} size={36} />
                        <div className="min-w-0">
                          <p className="truncate text-[15.5px] font-semibold tracking-[-0.01em]">{nameOf(c)}</p>
                          <p className="truncate text-[12px] text-muted">{c.participant.id} · {profileLine(c)}</p>
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-2 h-[38px] overflow-hidden text-[13px] leading-[19px] text-body">{reasonsOf(c)[0]}</p>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <SectionTitle>Programme</SectionTitle>
          <Card className="mx-5 p-5">
            <div className="flex items-center gap-5">
              <Donut parts={s.byLevel.map((x) => ({ value: x.n, color: LEVEL_COLOR[x.l] }))} size={120} stroke={14}
                center={<><span className="text-[26px] font-semibold leading-none tracking-[-0.02em]">{cases.length}</span><span className="mt-1 text-[11px] text-muted">people</span></>} />
              <ul className="min-w-0 flex-1 space-y-2">
                {s.byLevel.map(({ l, n }) => (
                  <li key={l} className="flex items-center gap-2 text-[13px]">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: LEVEL_COLOR[l] }} />
                    <span className="min-w-0 flex-1 truncate text-body">{LEVEL_LABEL.en[l]}</span>
                    <span className="font-semibold tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-5 border-t border-[#eef0ec] pt-4">
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-[13px] font-semibold">Activity, last 8 weeks</p>
                <p className="text-[12px] text-muted">{s.checkins} check-ins in total</p>
              </div>
              <Bars values={s.weeks} labels={s.weekLabels} height={56} />
            </div>
          </Card>

          <SectionTitle>Recent activity</SectionTitle>
          <Card className="mx-5 divide-y divide-[#eef0ec]">
            {s.feed.map((f, i) => {
              const [I, text, col] = FEED[f.kind] ?? [Activity, f.kind, "#8a9691"];
              return (
                <button key={i} type="button" onClick={() => { tap(); onOpen(f.c.participant.id); }} className="flex w-full items-center gap-3 px-4 py-3 text-start active:bg-[#f7f8f5]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `${col}18`, color: col }}><I size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{text}</span>
                    <span className="block truncate text-[12px] text-muted">{nameOf(f.c)} · {f.c.participant.id}</span>
                  </span>
                  <span className="shrink-0 text-[11.5px] text-muted">{relTime(f.at)}</span>
                </button>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

/* ── Alerts ── */

type AlertFilter = "all" | "URGENT" | "CLINICIAN_REVIEW" | "CHECK_AGAIN";
export function ClinicianAlerts({ onOpen }: { onOpen: (id: string) => void }) {
  const { cases, ready, syncedAt, syncing, refresh } = useWorkspace();
  const [f, setF] = useState<AlertFilter>("all");
  const [q, setQ] = useState("");
  const active = useMemo(() => byUrgency(cases.filter(isActive)), [cases]);
  const count = (l: Level) => active.filter((c) => levelOf(c) === l).length;
  const list = (f === "all" ? active : active.filter((c) => levelOf(c) === f)).filter((c) => {
    const s = q.trim().toLowerCase();
    return !s || [c.participant.id, nameOf(c), ...reasonsOf(c)].join(" ").toLowerCase().includes(s);
  });
  return (
    <Screen title="Alerts" sub={<>{active.length} need attention · urgent first</>} onRefresh={refresh} refreshing={syncing} right={<LiveBadge syncedAt={syncedAt} syncing={syncing} onSync={() => void refresh()} />}>
      <div className="space-y-3 px-4 pt-4">
        <label className="flex h-11 items-center gap-2.5 rounded-2xl bg-white px-3.5 ring-1 ring-[#e3e6e1] focus-within:ring-2 focus-within:ring-deep/30">
          <Search size={17} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID or reason" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#9aa5a0]" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search"><X size={16} className="text-muted" /></button>}
        </label>
        <Segmented value={f} onChange={setF} options={[
          { key: "all", label: "All", count: active.length }, { key: "URGENT", label: "Urgent", count: count("URGENT") },
          { key: "CLINICIAN_REVIEW", label: "Review", count: count("CLINICIAN_REVIEW") }, { key: "CHECK_AGAIN", label: "Check again", count: count("CHECK_AGAIN") },
        ]} />
      </div>
      <div className="mt-4 space-y-3 px-4">
        {!ready && [0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}
        {ready && list.length === 0 && <Empty icon={ShieldCheck} title={q ? "No match" : "All clear"} sub={q ? "Try another name, ID or reason." : "No alerts at this level."} />}
        {list.map((c) => {
          const lv = levelOf(c), sla = slaOf(c);
          const n = c.participant.sessions.filter((x) => x.type !== "intake" && x.type !== "informant").length;
          const r = c.participant.sessions.filter((x) => x.type === "intake" || x.type === "informant").length;
          return (
            <Card key={c.participant.id} className="overflow-hidden" onClick={() => onOpen(c.participant.id)}>
              <div className="flex">
                <span className="w-[5px] shrink-0" style={{ background: LEVEL_COLOR[lv] }} />
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Pill level={lv} size="md" />
                    {sla && <Chip tone={sla.tone} icon={Clock3}>{sla.text}</Chip>}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Avatar name={nameOf(c)} color={LEVEL_COLOR[lv]} size={40} />
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-semibold tracking-[-0.01em]">{nameOf(c)} <span className="font-mono text-[11.5px] font-normal text-muted">{c.participant.id}</span></p>
                      <p className="truncate text-[12.5px] text-body">{profileLine(c)}</p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {reasonsOf(c).slice(0, 2).map((x) => <li key={x} className="flex gap-2 text-[13px] leading-snug text-body"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: LEVEL_COLOR[lv] }} /><span className="line-clamp-2">{x}</span></li>)}
                  </ul>
                  <div className="mt-3.5 flex items-center gap-4 border-t border-[#eef0ec] pt-3 text-[12px] text-muted">
                    <span className="flex items-center gap-1"><Mic size={13} /> {n}</span>
                    <span className="flex items-center gap-1"><MessageSquarePlus size={13} /> {r}</span>
                    <span className="flex items-center gap-1"><Route size={13} /> {c.participant.referrals.length}</span>
                    <span className="ms-auto">Last activity {relTime(lastDate(c))}</span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </Screen>
  );
}

/* ── Map ── */

type Service = { id: string; name: string; emirate: string; area: string; pathways: string[]; wait_weeks: number; accepting_referrals: boolean; languages: string[] };
export function ClinicianMap({ onOpen }: { onOpen: (id: string) => void }) {
  const { cases, syncedAt, syncing, refresh } = useWorkspace();
  const [layer, setLayer] = useState<"people" | "services">("people");
  const [sel, setSel] = useState<string | null>(null);
  const services = NAV.directory as unknown as Service[];
  const emirateOf = (c: Case) => (c.participant as { emirate?: string }).emirate ?? null;
  const placed = cases.filter((c) => emirateOf(c) && isActive(c));
  const points: MapPoint[] = layer === "people"
    ? EMIRATE_KEYS.map((e) => {
        const list = placed.filter((c) => emirateOf(c) === e);
        const worst = ORDER.find((l) => list.some((c) => levelOf(c) === l)) ?? "STABLE";
        return { id: e, lat: PLACES[e].lat, lon: PLACES[e].lon, count: list.length, color: LEVEL_COLOR[worst], label: `${e}: ${list.length} need attention`, selected: sel === e };
      }).filter((p) => p.count > 0)
    : [...new Set(services.map((s) => s.area))].map((a) => ({ id: a, lat: PLACES[a]?.lat ?? 24.4, lon: PLACES[a]?.lon ?? 54.4, count: services.filter((s) => s.area === a).length, color: "#0f3f2c", label: `${a}: services`, kind: "pin" as const, selected: sel === a }));
  const shownCases = byUrgency(sel ? placed.filter((c) => emirateOf(c) === sel) : placed);
  const shownSvc = services.filter((s) => !sel || s.area === sel || s.emirate === sel);
  const gaps = EMIRATE_KEYS.filter((e) => !services.some((s) => s.emirate === e));
  const unplaced = cases.filter((c) => !emirateOf(c) && isActive(c)).length;
  return (
    <Screen title="Map" sub={sel ? <button type="button" onClick={() => setSel(null)} className="font-medium text-deep">{sel} · show all</button> : "United Arab Emirates"} onRefresh={refresh} refreshing={syncing} right={<LiveBadge syncedAt={syncedAt} syncing={syncing} onSync={() => void refresh()} />}>
      <div className="px-4 pt-4">
        <Segmented value={layer} onChange={(v) => { setLayer(v); setSel(null); }} options={[{ key: "people", label: "People needing attention", count: placed.length }, { key: "services", label: "Services", count: services.length }]} />
        <div className="mt-3"><LiveMap points={points} onSelect={setSel} height={320} /></div>
        {layer === "people" && unplaced > 0 && <p className="mt-2.5 px-1 text-[12.5px] text-muted">{unplaced === 1 ? "1 concern raised without an emirate is" : `${unplaced} concerns raised without an emirate are`} in Alerts, not on the map.</p>}
        {layer === "services" && gaps.length > 0 && (
          <div className="mt-3 flex gap-3 rounded-[18px] bg-sand-soft px-4 py-3 text-[13px] leading-snug text-[#6b4714]">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <span><b className="font-semibold">Service gaps:</b> no listed service in {gaps.join(", ")}. The navigator flags this on every referral from there.</span>
          </div>
        )}
      </div>
      <SectionTitle>{layer === "people" ? `${shownCases.length} ${shownCases.length === 1 ? "person" : "people"}` : `${shownSvc.length} services`}</SectionTitle>
      <div className="space-y-2.5 px-4">
        {layer === "people" && shownCases.map((c) => <CaseRow key={c.participant.id} c={c} onOpen={onOpen} />)}
        {layer === "people" && shownCases.length === 0 && <Empty icon={ShieldCheck} title="All clear" sub="No one here needs attention." />}
        {layer === "services" && shownSvc.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#e9f1ec] text-deep"><Stethoscope size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-snug">{s.name.replace(/ \(synthetic\)$/, "")}</p>
                <p className="mt-0.5 text-[12.5px] text-body">{s.area} · {s.pathways.map((p) => NAV.pathways[p] ?? p).join(", ")}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Chip tone="brand" icon={Clock3}>About {s.wait_weeks} weeks</Chip>
                  <Chip>{s.languages.map((l) => l.toUpperCase()).join(" · ")}</Chip>
                  {!s.accepting_referrals && <Chip tone="bad">Not accepting</Chip>}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Screen>
  );
}

/* ── Reports ── */

type Metric = { sensitivity: number[]; specificity: number[]; ppv: number[] };
const V = (programmeData as unknown as { validation: { summary: { overall: { membrain: Metric; usual_care: Metric } } } }).validation.summary.overall;
const STATES = ["recommended", "sent", "accepted", "appointment_offered", "attended", "assessment_completed"] as const;

export function ClinicianReports({ onOpen }: { onOpen: (id: string) => void }) {
  const { cases, syncedAt, syncing, refresh } = useWorkspace();
  const toast = useToast();
  const [kind, setKind] = useState<"programme" | "cases">("programme");
  const [report, setReport] = useState<string | null>(null);
  const [typed, setTyped] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!report || typed >= report.length) return;
    const id = window.setTimeout(() => setTyped((n) => Math.min(report.length, n + 18)), 16);
    return () => window.clearTimeout(id);
  }, [report, typed]);
  const refs = cases.flatMap((c) => c.participant.referrals);
  const funnel = STATES.map((st) => refs.filter((r) => r.state === st || r.history.some((h) => h.state === st)).length);
  const generate = () => {
    tap("MEDIUM");
    setBusy(true);
    setReport(null);
    setTyped(0);
    window.setTimeout(() => {
      setReport(programmeReport(cases));
      setBusy(false);
    }, 650);
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Report copied");
    } catch {
      toast("Could not copy", "error");
    }
  };
  const share = async (text: string) => {
    try {
      if (navigator.share) await navigator.share({ title: "MemBrain programme report", text });
      else await copy(text);
    } catch {
      /* cancelled */
    }
  };
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <Screen title="Reports" sub="Written from the programme's live data" onRefresh={refresh} refreshing={syncing} right={<LiveBadge syncedAt={syncedAt} syncing={syncing} onSync={() => void refresh()} />}>
      <div className="px-4 pt-4"><Segmented value={kind} onChange={setKind} options={[{ key: "programme", label: "Programme" }, { key: "cases", label: "Case summaries", count: cases.length }]} /></div>
      {kind === "programme" ? (
        <div className="px-4">
          <Card className="mt-4 p-5">
            <p className="text-[14px] font-semibold">MemBrain against usual care</p>
            <p className="text-[12px] text-muted">Synthetic cohort of 2,000 · thresholds provisional</p>
            <div className="mt-4 space-y-3.5">
              {([["Finds real decline (sensitivity)", V.membrain.sensitivity[0], V.usual_care.sensitivity[0]], ["Avoids false alarms (specificity)", V.membrain.specificity[0], V.usual_care.specificity[0]], ["Referrals that are right (PPV)", V.membrain.ppv[0], V.usual_care.ppv[0]]] as [string, number, number][]).map(([l, a, b]) => (
                <div key={l}>
                  <div className="flex items-baseline justify-between text-[12.5px]"><span className="text-body">{l}</span><span className="font-semibold tabular-nums">{pct(a)} <span className="font-normal text-muted">vs {pct(b)}</span></span></div>
                  <div className="mt-1.5 space-y-1">
                    <div className="h-2 rounded-full bg-[#eef0ec]"><div className="h-full rounded-full bg-deep" style={{ width: pct(a) }} /></div>
                    <div className="h-2 rounded-full bg-[#eef0ec]"><div className="h-full rounded-full bg-[#b9c4be]" style={{ width: pct(b) }} /></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-4 text-[11.5px] text-muted"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-deep" />MemBrain</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#b9c4be]" />Usual care</span></div>
          </Card>
          <Card className="mt-3 p-5">
            <p className="text-[14px] font-semibold">Referral loop</p>
            <p className="text-[12px] text-muted">{refs.length} referrals, followed until the person is seen</p>
            <div className="mt-4 space-y-2">
              {STATES.map((st, i) => (
                <div key={st} className="flex items-center gap-3 text-[12.5px]">
                  <span className="w-[118px] shrink-0 truncate text-body">{st.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase())}</span>
                  <span className="relative h-6 flex-1 overflow-hidden rounded-lg bg-[#f1f3ef]"><span className="absolute inset-y-0 start-0 rounded-lg bg-gradient-to-r from-[#1b5a40] to-[#2f8a57]" style={{ width: `${refs.length ? (funnel[i] / refs.length) * 100 : 0}%` }} /></span>
                  <span className="w-5 text-end font-semibold tabular-nums">{funnel[i]}</span>
                </div>
              ))}
            </div>
          </Card>
          <button type="button" onClick={generate} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] bg-gradient-to-b from-[#1b5a40] to-deep py-4 text-[15.5px] font-semibold text-white shadow-[0_14px_30px_-14px_rgb(15_63_44/0.8)] disabled:opacity-70">
            <Sparkles size={18} className={busy ? "animate-pulse" : ""} /> {busy ? "Reading the programme…" : "Write the programme report"}
          </button>
          {report && (
            <Card className="mt-4 overflow-hidden mb-step-in">
              <div className="flex items-center justify-between border-b border-[#eef0ec] bg-[#f7faf7] px-4 py-3">
                <p className="flex items-center gap-2 text-[14.5px] font-semibold"><FileText size={16} className="text-leaf" /> Programme report</p>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => void copy(report)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-deep ring-1 ring-[#e3e6e1]" aria-label="Copy"><Copy size={14} /></button>
                  <button type="button" onClick={() => void share(report)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-deep ring-1 ring-[#e3e6e1]" aria-label="Share"><Share2 size={14} /></button>
                </div>
              </div>
              <ReportText text={report.slice(0, typed)} />
            </Card>
          )}
          <p className="mt-3 px-1 text-[12px] leading-snug text-muted">Written by rules from the live counts, not by a language model, so every sentence traces to the data. Not a clinical assessment.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5 px-4">{byUrgency(cases).map((c) => <CaseRow key={c.participant.id} c={c} onOpen={onOpen} />)}</div>
      )}
    </Screen>
  );
}

function ReportText({ text }: { text: string }) {
  return (
    <div className="space-y-2.5 px-4 py-4 text-[14px] leading-relaxed">
      {text.split("\n\n").map((block, i) => {
        if (block.startsWith("# ")) return <h3 key={i} className="text-[19px] font-semibold tracking-[-0.015em] text-deep">{block.slice(2)}</h3>;
        if (block.startsWith("## ")) return <h4 key={i} className="pt-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf">{block.slice(3)}</h4>;
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
  const overdue = active.filter((c) => slaOf(c)?.tone === "bad");
  const urgentList = cases.filter((c) => levelOf(c) === "URGENT").map((c) => c.participant.id);
  return [
    `# MemBrain programme report`,
    `${fmtDate(REF())} · ${cases.length} people · live data`,
    `## Summary`,
    `${active.length} of ${cases.length} people need attention: ${n("URGENT")} urgent, ${n("CLINICIAN_REVIEW")} for clinician review and ${n("CHECK_AGAIN")} to check again. ${n("STABLE")} are stable and ${n("BASELINE")} are still building their personal baseline. ${concerns.length} records began with a concern raised by a family member, a helper, a professional or the person themselves.`,
    `## Change over time`,
    [
      spread.length ? `- ${spread.length} ${spread.length === 1 ? "person's" : "people's"} reported concern has spread since it was first raised.` : "- No reported concern has spread since it was first raised.",
      faqHigh.length ? `- ${faqHigh.length} ${faqHigh.length === 1 ? "family questionnaire is" : "family questionnaires are"} at or above the cutoff: each needs a professional clinical evaluation, not a diagnosis.` : "- No family questionnaire is at or above the cutoff.",
    ].join("\n"),
    `## Referrals`,
    `${refs.length} referrals in total; ${open} still open and followed until the person is seen.`,
    `## Recommended actions`,
    [
      urgentList.length ? `- Contact the ${urgentList.length} urgent ${urgentList.length === 1 ? "case" : "cases"} today (${urgentList.join(", ")}).` : `- No urgent cases waiting.`,
      overdue.length ? `- ${overdue.length} ${overdue.length === 1 ? "review is" : "reviews are"} due or past the target date: reassign or act.` : `- All reviews are within their target dates.`,
      `- Send family questionnaires to anyone not asked in the last 12 weeks.`,
      `- Chase open referrals older than 14 days.`,
    ].join("\n"),
    `Thresholds are provisional until validated locally. MemBrain flags risk and change; it never diagnoses.`,
  ].join("\n\n");
}

/* ── One case ── */

type Event = { at: string; icon: typeof Mic; color: string; title: string; detail?: string; level?: Level };
const ACTION_TITLE: Record<string, string> = { refer: "Referred", dismiss: "Closed as not a concern", request_repeat: "Asked to check again", order_investigations: "Tests ordered", confirm_concern: "Concern confirmed" };

function timeline(c: Case): Event[] {
  const evById = new Map(c.history.map((h) => [h.session_id, h]));
  const ev: Event[] = [];
  for (const s of c.participant.sessions) {
    const h = evById.get(s.session_id);
    if (s.type === "intake") {
      const ch = h?.concern_change;
      const news = ch && !ch.first ? [...ch.new_domains.map((d) => label(DOMAIN, d, "en")), ...ch.new_activities.map((a) => label(ACTIVITY, a, "en"))] : [];
      ev.push({ at: s.date, icon: MessageSquarePlus, color: "#c0502f", title: ch && !ch.first ? "Follow-up concern" : "Concern reported", detail: news.length ? `New: ${news.join(", ")}` : (s.concern as string | undefined)?.slice(0, 160), level: h?.level });
    } else if (s.type === "informant") {
      const i = h?.informant;
      ev.push({ at: s.date, icon: ClipboardCheck, color: "#4a6fb0", title: "Family questionnaire", detail: i ? `FAQ ${i.score}/${i.max}${i.change != null ? ` (${i.change > 0 ? "+" : ""}${i.change})` : ""}${i.at_or_above_cutoff ? " · at or above cutoff" : ""}` : undefined, level: h?.level });
    } else {
      ev.push({ at: s.date, icon: Mic, color: "#2f8a57", title: `Check-in${s.form ? `, form ${s.form}` : ""}`, detail: h?.reasons[0]?.replace(/->/g, "→"), level: h?.level });
    }
  }
  for (const a of c.task?.actions ?? []) ev.push({ at: a.ts, icon: Stethoscope, color: "#0f3f2c", title: ACTION_TITLE[a.action] ?? a.action, detail: a.note || undefined });
  for (const r of c.participant.referrals) for (const h of r.history) ev.push({ at: h.date, icon: Route, color: "#8a5a14", title: `Referral ${h.state.replace(/_/g, " ")}`, detail: NAV.pathways[r.pathway] ?? r.pathway });
  return ev.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function CaseScreen({ id, onBack, onFollow }: { id: string; onBack: () => void; onFollow: (id: string) => void }) {
  const { byId, act, reidentify, ready, syncing, refresh } = useWorkspace();
  const toast = useToast();
  const c = byId(id);
  const [tab, setTab] = useState<"overview" | "timeline" | "plan">("overview");
  const [more, setMore] = useState(false);
  const [dismiss, setDismiss] = useState(false);
  const [note, setNote] = useState("");
  const [vault, setVault] = useState<VaultEntry | null>(null);
  const [reidOpen, setReidOpen] = useState(false);
  const [referOpen, setReferOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!c) {
    return ready ? (
      <Screen title={id} onBack={onBack} bottomPad={false}><Empty icon={ClipboardList} title="Case not found" sub="It may have been removed, or is not visible to you." /></Screen>
    ) : <Screen title={id} onBack={onBack}><div className="space-y-3 px-5 pt-4"><Skeleton className="h-40" /><Skeleton className="h-24" /></div></Screen>;
  }
  const p = c.participant;
  const lv = levelOf(c);
  const sla = slaOf(c);
  const open = !!c.task && c.task.status !== "closed";
  const z = c.history.map((h) => (h as unknown as { z?: { composite?: number } }).z?.composite).filter((v): v is number => typeof v === "number");
  const events = timeline(c);
  const doAct = async (a: "request_repeat" | "order_investigations" | "dismiss" | "confirm_concern", n = "", msg = "Saved") => {
    if (!c.task) return;
    setBusy(true);
    try {
      await act(c.task.id, a, n);
      toast(msg);
      setMore(false);
      setDismiss(false);
      setNote("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  };
  const showContact = async () => {
    setBusy(true);
    try {
      setVault(await reidentify(p.id, reason.trim()));
      toast("Contact details opened · audited");
    } catch (e) {
      toast(e instanceof Error && /no identity|not found|no contact/i.test(e.message) ? "No contact details on file" : "Could not open contact details", "error");
    } finally {
      setBusy(false);
    }
  };
  const hero = (
    <div className="relative overflow-hidden rounded-b-[34px] px-5 pb-6 text-white" style={{ paddingTop: "calc(var(--mb-sat) + 60px)", background: `linear-gradient(165deg, ${LEVEL_COLOR[lv]} 0%, #0f3f2c 85%)` }}>
      <div aria-hidden className="pointer-events-none absolute -end-14 -top-12 h-52 w-52 rounded-full border border-white/12" />
      <div className="relative flex items-center gap-4">
        <Avatar name={nameOf(c)} color="#ffffff33" size={58} ring />
        <div className="min-w-0">
          <h1 className="truncate text-[24px] font-semibold tracking-[-0.025em]">{nameOf(c)}</h1>
          <p className="truncate text-[13px] text-white/75"><span className="font-mono">{p.id}</span> · {profileLine(c)}</p>
        </div>
      </div>
      <div className="relative mt-4 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold" style={{ color: LEVEL_COLOR[lv] }}>{LEVEL_LABEL.en[lv]}</span>
        {sla && <span className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold ring-1 ring-white/25">{sla.text}</span>}
        {p.referrals.length > 0 && <span className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold ring-1 ring-white/25">Referred</span>}
        {!open && c.task && <span className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold ring-1 ring-white/25">Reviewed</span>}
      </div>
    </div>
  );
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <Screen title={nameOf(c)} onBack={onBack} hero={hero} onRefresh={refresh} refreshing={syncing}
        right={<button type="button" onClick={() => { tap(); setMore(true); }} aria-label="More actions" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/10 backdrop-blur active:bg-black/20"><MoreHorizontal size={20} /></button>}>
        <div className="px-4 pt-4"><Segmented value={tab} onChange={setTab} options={[{ key: "overview", label: "Overview" }, { key: "timeline", label: "Timeline", count: events.length }, { key: "plan", label: "Plan", count: p.referrals.length || undefined }]} /></div>

        {tab === "overview" && (
          <div className="space-y-3 px-4 pt-4">
            <Card className="p-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Why this level</p>
              <ul className="mt-2.5 space-y-2">
                {reasonsOf(c).slice(0, 4).map((r) => <li key={r} className="flex gap-2.5 text-[14px] leading-snug"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: LEVEL_COLOR[lv] }} />{r}</li>)}
              </ul>
              {c.latest?.drivers?.length ? (
                <div className="mt-3.5 grid grid-cols-2 gap-2">
                  {c.latest.drivers.slice(0, 4).map((d) => (
                    <div key={d.input} className="rounded-xl bg-[#f6f8f5] px-3 py-2.5">
                      <p className="line-clamp-1 text-[11.5px] text-muted">{d.input}</p>
                      <p className="mt-0.5 text-[16px] font-semibold tabular-nums">{num2(d.value)}<span className="ms-1 text-[11.5px] font-normal text-muted">vs {num2(d.threshold)}</span></p>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
            {c.concern.in_their_words && (
              <Card className="p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">In their words</p>
                <p dir="auto" className="mt-2 text-[15px] leading-relaxed">“{c.concern.in_their_words}”</p>
                <p className="mt-2 text-[12px] text-muted">{c.concern.raised_by}{c.concern.date ? ` · ${fmtDate(c.concern.date)}` : ""} · their account, not a clinical finding</p>
                {c.concern.who_now_does_what.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{c.concern.who_now_does_what.map((w) => <Chip key={w} tone="warn">{w}</Chip>)}</div>}
              </Card>
            )}
            {z.length > 1 && (
              <Card className="p-4">
                <div className="flex items-baseline justify-between"><p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Check-ins over time</p><p className="text-[12px] text-muted">{z.length} scored</p></div>
                <Spark values={z} />
                <p className="text-[11.5px] text-muted">Overall score against age and schooling norms (z). Dashed line: the norm.</p>
              </Card>
            )}
            {c.concern.missing.length > 0 && (
              <Card className="p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Still missing</p>
                <ul className="mt-2 space-y-1.5">{c.concern.missing.map((m) => <li key={m} className="flex items-center gap-2.5 text-[13.5px]"><span className="h-4 w-4 shrink-0 rounded-[5px] border-[1.5px] border-[#b9c4c2]" />{m}</li>)}</ul>
              </Card>
            )}
          </div>
        )}

        {tab === "timeline" && (
          <div className="px-4 pt-4">
            <Card className="px-4 py-2">
              <ol>
                {events.map((e, i) => {
                  const I = e.icon;
                  return (
                    <li key={i} className="relative flex gap-3.5 py-3">
                      {i < events.length - 1 && <span className="absolute start-[17px] top-[46px] h-[calc(100%-34px)] w-px bg-[#e6e9e4]" />}
                      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `${e.color}18`, color: e.color }}><I size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[14.5px] font-semibold">{e.title}</p>
                          <p className="shrink-0 text-[11.5px] text-muted">{relTime(e.at)}</p>
                        </div>
                        {e.detail && <p dir="auto" className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-body">{e.detail}</p>}
                        {e.level && <div className="mt-1.5"><Pill level={e.level} /></div>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          </div>
        )}

        {tab === "plan" && (
          <div className="space-y-3 px-4 pt-4">
            {p.referrals.length > 0 && (
              <>
                <p className="px-1 pt-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Referrals</p>
                {[...p.referrals].reverse().map((r) => <ReferralTrack key={r.id} r={r} />)}
                <p className="px-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Brain-health plan</p>
              </>
            )}
            {c.prevention?.items?.length ? (
              <Card className="divide-y divide-[#eef0ec]">
                {c.prevention.items.map((x) => <p key={x.rule} dir="auto" className="flex gap-3 px-4 py-3.5 text-[14px] leading-relaxed"><HeartPulse size={17} className="mt-0.5 shrink-0 text-leaf" /><span dir="auto">{x.text}</span></p>)}
              </Card>
            ) : <Empty icon={HeartPulse} title="No plan yet" sub="A plan is written after the first check-in, or from health-record data." />}
            {c.risk_context && (
              <Card className="p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Modifiable risk factors</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{((c.risk_context.modifiable_factors_present as string[] | undefined) ?? []).map((f) => <Chip key={f} tone="warn">{f.replace(/_/g, " ")}</Chip>)}</div>
                <p className="mt-2 text-[12px] text-muted">{String(c.risk_context.count ?? 0)} of {String(c.risk_context.of ?? 14)} (Lancet Commission 2024)</p>
              </Card>
            )}
          </div>
        )}
      </Screen>

      <div className="absolute inset-x-0 bottom-0 z-40 border-t border-[#e7e9e4] bg-white/92 px-4 pt-3 backdrop-blur-xl" style={{ paddingBottom: "max(var(--mb-sab), 12px)" }}>
        <div className="flex gap-2.5">
          <button type="button" onClick={() => { tap(); setMore(true); }} className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[16px] border border-[#e3e6e1] bg-white text-[15px] font-semibold active:bg-[#f3f5f1]"><MoreHorizontal size={18} /> Actions</button>
          {open ? (
            <button type="button" onClick={() => { tap("MEDIUM"); setReferOpen(true); }} className="flex h-[52px] flex-[1.4] items-center justify-center gap-2 rounded-[16px] bg-gradient-to-b from-[#1b5a40] to-deep text-[15px] font-semibold text-white shadow-[0_10px_22px_-10px_rgb(15_63_44/0.8)]"><Send size={17} /> Confirm and refer</button>
          ) : (
            <Link href={`/checkin/?id=${encodeURIComponent(p.id)}`} onClick={() => tap("MEDIUM")} className="flex h-[52px] flex-[1.4] items-center justify-center gap-2 rounded-[16px] bg-gradient-to-b from-[#1b5a40] to-deep text-[15px] font-semibold text-white"><Mic size={17} /> Start a check-in</Link>
          )}
        </div>
      </div>

      <Sheet open={more} onClose={() => { setMore(false); setDismiss(false); }} title="Actions">
        {open && !dismiss && (
          <>
            <SheetAction icon={CalendarClock} title="Check again in 2 to 4 weeks" sub="Repeat with an alternate form" onClick={() => void doAct("request_repeat", "", "Asked to check again")} tone="bg-lv-check-soft text-lv-check" />
            <SheetAction icon={FlaskConical} title="Order tests" sub="Reversible-cause work-up (TSH, B12 and others)" onClick={() => void doAct("order_investigations", "", "Tests ordered")} tone="bg-[#e9eef8] text-[#4a6fb0]" />
            <SheetAction icon={CheckCircle2} title="Confirm the concern" sub="Close the review as confirmed" onClick={() => void doAct("confirm_concern", "", "Concern confirmed")} />
            <SheetAction icon={X} title="Not a concern…" sub="Close with a reason (audited)" onClick={() => setDismiss(true)} tone="bg-[#f1f2ef] text-body" danger />
          </>
        )}
        {dismiss ? (
          <div className="space-y-3 pb-1">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Why this is not a concern (required)" className="w-full rounded-2xl border border-[#e3e6e1] px-3.5 py-3 text-[15px] outline-none focus:border-deep" />
            <button type="button" onClick={() => void doAct("dismiss", note.trim(), "Closed as not a concern")} disabled={!note.trim() || busy} className="h-12 w-full rounded-2xl bg-lv-review text-[15px] font-semibold text-white disabled:opacity-50">Close as not a concern</button>
          </div>
        ) : (
          <>
            {open && <div className="my-2 h-px bg-[#eef0ec]" />}
            <SheetAction icon={MessageSquarePlus} title="Record a change" sub="A follow-up concern, by voice or typing" onClick={() => { setMore(false); onFollow(p.id); }} tone="bg-lv-review-soft text-lv-review" />
            <SheetAction icon={Mic} title="Start a check-in" sub="Six minutes, spoken" href={`/checkin/?id=${encodeURIComponent(p.id)}`} />
            <SheetAction icon={ClipboardCheck} title="Family questionnaire" sub="Ten questions for a family member" href={`/informant/?id=${encodeURIComponent(p.id)}`} tone="bg-[#e9eef8] text-[#4a6fb0]" />
            {!isIntakeOnly(c) && <SheetAction icon={Lock} title="Contact details" sub="Needs a reason · audited" onClick={() => { setMore(false); setReidOpen(true); }} tone="bg-[#eef0f6] text-[#2b3a55]" />}
            <SheetAction icon={Route} title="Refer to a service" sub="Pathway, matched service, reason checked against the record" onClick={() => { setMore(false); setReferOpen(true); }} />
          </>
        )}
      </Sheet>

      <ReferSheet c={c} open={referOpen} onClose={() => { setReferOpen(false); setTab("plan"); }} />

      <Sheet open={reidOpen} onClose={() => { setReidOpen(false); setVault(null); setReason(""); }} title="Contact details">
        {!vault ? (
          <div className="space-y-3 pb-1">
            <p className="text-[14px] leading-snug text-body">Kept in the identity vault, apart from the record. Showing them needs a reason and is written to the audit log under your name.</p>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. arrange the follow-up call" className="h-12 w-full rounded-2xl border border-[#e3e6e1] px-3.5 text-[15px] outline-none focus:border-deep" />
            <button type="button" onClick={() => void showContact()} disabled={!reason.trim() || busy} className="h-12 w-full rounded-2xl bg-deep text-[15px] font-semibold text-white disabled:opacity-50">Show contact details</button>
          </div>
        ) : (
          <dl className="divide-y divide-[#eef0ec] rounded-2xl border border-[#eef0ec] text-[15px]">
            {([["Name", vault.identity?.full_name], ["Emirates ID or MRN", vault.identity?.national_id], ["Mobile", vault.identity?.phone], ["Informant", vault.informant ? `${vault.informant.name} (${vault.informant.relation})` : null], ["Informant's mobile", vault.informant?.phone]] as [string, string | null | undefined][])
              .filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 px-4 py-3"><dt className="text-[13px] text-muted">{k}</dt><dd dir="auto" className="text-end font-medium">{v}</dd></div>
              ))}
          </dl>
        )}
      </Sheet>
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  const W = 320, H = 92, lo = Math.min(-2.5, ...values), hi = Math.max(1, ...values);
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * (W - 16) + 8;
  const y = (v: number) => H - 10 - ((v - lo) / (hi - lo)) * (H - 22);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="my-2 h-[92px] w-full" role="img" aria-label="Overall score over time">
      <defs><linearGradient id="spk" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2a6045" stopOpacity="0.28" /><stop offset="1" stopColor="#2a6045" stopOpacity="0" /></linearGradient></defs>
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="#d4dad5" strokeDasharray="4 5" />
      <path d={`${d}L${x(values.length - 1)},${H}L${x(0)},${H}Z`} fill="url(#spk)" />
      <path d={d} fill="none" stroke="#0f3f2c" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 4.5 : 3.2} fill="#fff" stroke="#0f3f2c" strokeWidth="2.2" />)}
    </svg>
  );
}

/* ── The "+" sheet ── */

export function ClinicianPlus({ open, onClose, onIntake }: { open: boolean; onClose: () => void; onIntake: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Create">
      <SheetAction icon={MessageSquarePlus} title="New concern" sub="By voice or typing; urgent signs checked first" onClick={() => { onClose(); onIntake(); }} tone="bg-lv-review-soft text-lv-review" />
      <SheetAction icon={UserPlus} title="Enrol a participant" sub="Safety screen, identity vault, consent, plan" href="/clinician/enrol/" onClick={onClose} />
      <SheetAction icon={Mic} title="Start a check-in" sub="Six minutes, spoken, with the person" href="/checkin/" onClick={onClose} tone="bg-[#e9eef8] text-[#4a6fb0]" />
    </Sheet>
  );
}
