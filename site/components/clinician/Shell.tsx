"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Bell, ChartColumn, ChartNoAxesColumn, ChevronDown, Inbox, LogOut, Menu, Route, Search, Settings, SquarePlus, UsersRound, X, type LucideIcon, UserPlus } from "lucide-react";
import { Logo, Mark } from "../Logo";
import { LevelPill } from "../ui";
import { Avatar, usePopover } from "./parts";
import { useWorkspace } from "./WorkspaceProvider";
import { hospitalLabel, signOut, useSession, getHomeUrl, getSignedOutUrl } from "@/lib/auth";
import { caseHref, fmtDate, isActive, isIntakeOnly, isWaiting, levelOf, matchesQuery, dueOf } from "@/lib/workspace/derive";
import { STALLED, STATE_LABEL } from "@/lib/workspace/navigator";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const path = usePathname();
  const base = "flex h-12 items-center gap-3.5 rounded-xl px-4 text-[16px] transition-colors";
  return (
    <>
      {items.map(({ href, label, icon: Icon, badge }) => {
        const on = href === "/clinician/" ? path === "/clinician" || path === "/clinician/" || path.startsWith("/clinician/case") : path.startsWith(href.replace(/\/$/, ""));
        return (
          <Link key={href} href={href} onClick={onNavigate} aria-current={on ? "page" : undefined} className={`${base} justify-between ${on ? "bg-white/[0.11] font-medium text-white" : "text-white/85 hover:bg-white/5 hover:text-white"}`}>
            <span className="flex items-center gap-3.5">
              <Icon size={20} strokeWidth={1.8} /> {label}
            </span>
            {!!badge && <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-[12.5px] font-semibold text-deep">{badge}</span>}
          </Link>
        );
      })}
    </>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const me = useMe();
  const { cases, mode, base } = useWorkspace();
  const active = cases.filter(isActive).length;
  return (
    <>
      <Link href="/" className="px-2" aria-label="MemBrain home" onClick={onNavigate}>
        <Logo inverted size="lg" priority />
      </Link>
      <p className="mt-3 px-2 text-[15px] text-white/70">Clinician workspace</p>
      <nav className="mt-9 space-y-1.5" aria-label="Workspace">
        <NavLinks
          onNavigate={onNavigate}
          items={[
            { href: "/clinician/", label: "Review queue", icon: Inbox, badge: active },
            { href: "/clinician/referrals/", label: "Referrals", icon: Route },
            { href: "/clinician/enrol/", label: "Enrol a participant", icon: UserPlus },
            { href: "/concern/", label: "Raise a concern", icon: SquarePlus },
          ]}
        />
      </nav>
      <div className="mx-2 my-6 h-px bg-white/10" />
      <p className="px-4 text-[14px] text-white/60">Programme & Evidence</p>
      <nav className="mt-3 space-y-1.5" aria-label="Programme and Evidence">
        <NavLinks
          onNavigate={onNavigate}
          items={[
            { href: "/clinician/cohorts/", label: "Cohorts", icon: UsersRound },
            { href: "/clinician/reports/", label: "Reports", icon: ChartNoAxesColumn },
            { href: "/clinician/live/", label: "Live pilot data", icon: Activity },
            { href: "/clinician/validation/", label: "Model validation", icon: ChartColumn },
            { href: "/clinician/settings/", label: "Settings", icon: Settings },
          ]}
        />
      </nav>
      <div className="mt-auto space-y-3 pt-6">
        <p className="flex items-center gap-2 px-2 text-[12.5px] text-white/60" title={mode === "server" ? `Connected to ${base || "this server"}` : "No server answered, so the engine runs in this browser and changes are kept here."}>
          <span className={`h-2 w-2 rounded-full ${mode === "server" ? "bg-[#7fd39a]" : mode === "browser" ? "bg-sand" : "bg-white/30"}`} />
          {mode === "server" ? "Live: MemBrain server" : mode === "browser" ? "Demo: running in this browser" : "Connecting…"}
        </p>
        <UserMenu align="bottom">
          <span className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-3.5 py-3 hover:bg-white/10">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1deb2] text-[14px] font-semibold text-deep">{initials(me.name)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15.5px] font-medium text-white">{me.name}</span>
              <span className="block truncate text-[13.5px] text-white/65">{me.title}</span>
            </span>
            <ChevronDown size={18} className="text-white/70" />
          </span>
        </UserMenu>
        <button
          type="button"
          onClick={async () => {
            onNavigate?.();
            await signOut();
            window.location.href = getSignedOutUrl("en", "clinician");
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13.5px] font-medium text-rose-300 hover:bg-rose-500/20 hover:text-white transition-colors"
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </>
  );
}

/** The signed-in person, as the shell shows them. */
function useMe() {
  const { session } = useSession();
  const u = session?.user;
  const where = u?.hospital_name ? hospitalLabel(u.hospital_name) : u?.role === "coordinator" ? "All hospitals" : null;
  return { name: u?.name ?? "Signed in", title: where ?? u?.title ?? (u?.role === "coordinator" ? "Programme coordinator" : "Clinician"), email: u?.email ?? "", demo: session?.mode === "browser" };
}
// Letters only: "Layla (coordinator)" is "LC", not "L(".
const initials = (n: string) =>
  n
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "MB";

/** The demo doctor has a photo; anyone else gets their initials. */
function MeAvatar({ size }: { size: number }) {
  const me = useMe();
  if (me.email === "dr.demo@membrain.ae") return <Avatar size={size} />;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-[#f1deb2] font-semibold text-deep" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {initials(me.name)}
    </span>
  );
}

function UserMenu({ align, children }: { align: "top" | "bottom"; children: ReactNode }) {
  const { open, setOpen, ref } = usePopover();
  const me = useMe();
  const router = useRouter();
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" className="w-full text-left">
        {children}
      </button>
      {open && (
        <div role="menu" className={`absolute z-50 w-[260px] rounded-2xl border border-line bg-white p-2 text-ink shadow-xl ${align === "top" ? "right-0 top-full mt-2" : "bottom-full left-0 mb-2"}`}>
          <div className="flex items-center gap-3 px-3 py-2.5">
            <MeAvatar size={40} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{me.name}</p>
              <p className="truncate text-[13px] text-muted">{me.email || me.title}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          {[
            { href: "/clinician/settings/", label: "Settings and audit log" },
            { href: "/", label: "Back to the MemBrain site" },
          ].map((l) => (
            <Link key={l.href} role="menuitem" href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-[14.5px] hover:bg-paper">
              {l.label}
            </Link>
          ))}
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await signOut();
              window.location.href = getSignedOutUrl("en", "clinician");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-[14.5px] font-medium text-lv-urgent hover:bg-lv-urgent-soft"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Alerts() {
  const { cases } = useWorkspace();
  const { open, setOpen, ref } = usePopover();
  const router = useRouter();
  const alerts = [
    ...cases.filter((c) => isIntakeOnly(c) && c.task?.status !== "closed").map((c) => ({ id: c.participant.id, title: `New concern ${c.participant.id}`, detail: `Raised by ${c.concern.raised_by.toLowerCase()}`, tone: "bg-[#2f8a5b]" })),
    ...cases.filter((c) => isWaiting(c) && !isIntakeOnly(c)).map((c) => ({ id: c.participant.id, title: `${c.participant.id} is waiting for review`, detail: `Review by ${fmtDate(dueOf(c))}`, tone: "bg-lv-review" })),
    ...cases.flatMap((c) =>
      c.participant.referrals.filter((r) => STALLED.includes(r.state)).map((r) => ({ id: c.participant.id, title: `${c.participant.id} referral ${STATE_LABEL[r.state].toLowerCase()}`, detail: "The navigator needs to follow this up", tone: "bg-lv-check" })),
    ),
  ];
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-label={`Alerts (${alerts.length})`} aria-expanded={open} className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-paper">
        <Bell size={23} strokeWidth={1.8} />
        {alerts.length > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#2f8a5b] ring-2 ring-white" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(340px,calc(100vw-32px))] rounded-2xl border border-line bg-white p-2 shadow-xl">
          <p className="px-3 pb-1 pt-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-leaf">Alerts</p>
          {alerts.length === 0 && <p className="px-3 py-3 text-[14.5px] text-muted">Nothing needs you right now.</p>}
          {alerts.map((a) => (
            <button
              key={a.id + a.title}
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(caseHref(a.id));
              }}
              className="flex w-full gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-paper"
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.tone}`} />
              <span>
                <span className="block text-[14.5px] font-medium">{a.title}</span>
                <span className="block text-[13px] text-muted">{a.detail}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Search across every case. On the queue it also filters the list; elsewhere it shows matches to jump to. */
function SearchBox() {
  const { cases, query, setQuery } = useWorkspace();
  const path = usePathname();
  const router = useRouter();
  const { open, setOpen, ref } = usePopover();
  const onQueue = path === "/clinician" || path === "/clinician/";
  const hits = query.trim() ? cases.filter((c) => matchesQuery(c, query)).slice(0, 6) : [];
  return (
    <div ref={ref} className="relative min-w-0 flex-1 lg:max-w-[372px]">
      <label className="relative flex items-center">
        <Search size={20} className="pointer-events-none absolute left-4 text-ink" />
        <span className="sr-only">Search cases</span>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hits[0]) {
              setOpen(false);
              router.push(caseHref(hits[0].participant.id));
            }
          }}
          placeholder="Search by ID, name or referral"
          className="h-12 w-full rounded-xl border border-[#e6e6e3] bg-white pl-12 pr-4 text-[15.5px] outline-none placeholder:text-body focus:border-leaf"
        />
      </label>
      {open && !onQueue && query.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-line bg-white p-2 shadow-xl">
          {hits.length === 0 && <p className="px-3 py-3 text-[14.5px] text-muted">No cases match.</p>}
          {hits.map((c) => (
            <Link key={c.participant.id} href={caseHref(c.participant.id)} onClick={() => setOpen(false)} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-paper">
              <span className="text-[15px] font-semibold">{c.participant.id}</span>
              <LevelPill level={levelOf(c)} size="sm" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** The clinician workspace frame: sidebar, top bar, and the page. */
export function Shell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const { error } = useWorkspace();
  return (
    <div className="min-h-dvh bg-[#fbfaf7] lg:grid lg:grid-cols-[270px_1fr] print:block print:bg-white">
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-[#153b33] px-5 pb-5 pt-7 text-white/85 lg:flex print:hidden">
        <SidebarBody />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[290px] flex-col overflow-y-auto bg-[#153b33] px-5 pb-5 pt-6 text-white/85">
            <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="absolute right-3 top-3 rounded-full p-2 text-white/80 hover:bg-white/10">
              <X size={20} />
            </button>
            <SidebarBody onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-[#ecece8] bg-white/95 backdrop-blur print:hidden">
          <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6 lg:h-20 lg:justify-end lg:gap-5 lg:px-8">
            <button type="button" aria-label="Open menu" onClick={() => setDrawer(true)} className="-ml-1 rounded-lg p-2 text-ink hover:bg-paper lg:hidden">
              <Menu size={22} />
            </button>
            <Link href="/clinician/" className="hidden items-center sm:flex lg:hidden" aria-label="Review queue">
              <Mark className="h-8 w-auto" />
            </Link>
            <SearchBox />
            <Alerts />
            <span aria-hidden className="hidden h-8 w-px bg-line sm:block" />
            <button
              type="button"
              onClick={async () => {
                await signOut();
                window.location.href = getSignedOutUrl("en", "clinician");
              }}
              title="Sign out and leave no trace"
              aria-label="Sign out"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-rose-200/90 bg-rose-50/70 px-3 py-1.5 text-[13px] font-medium text-rose-700 transition-colors hover:bg-rose-100 hover:text-rose-800"
            >
              <LogOut size={15} />
              <span>Sign out</span>
            </button>
            <UserMenu align="top">
              <span className="flex items-center gap-2">
                <MeAvatar size={44} />
                <ChevronDown size={20} className="hidden text-ink sm:block" />
              </span>
            </UserMenu>
          </div>
        </header>
        {error && (
          <p role="alert" className="mx-4 mt-4 rounded-xl border border-lv-review/20 bg-lv-review-soft px-4 py-3 text-[14.5px] text-lv-review sm:mx-6 lg:mx-8">
            {error}
          </p>
        )}
        <main className="mx-auto max-w-[1300px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
