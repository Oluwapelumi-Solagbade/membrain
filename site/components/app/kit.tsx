"use client";

// The mobile app's design system: phone-first, on the site's palette (deep green, sand, warm off-white), sans-serif
// for data, generous spacing, soft depth. Screens have a large title that collapses into a compact bar, pull to refresh,
// skeletons while loading, toasts after actions and light haptics on Android.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, Loader2, Plus, RefreshCw, XCircle, type LucideIcon } from "lucide-react";
import { LEVEL_LABEL, LEVEL_TONE, type Lang, type Level } from "@/lib/mb";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ── Haptics (Android, through Capacitor's bridge; nothing on the web) ── */
type HapticsPlugin = { impact: (o: { style: "LIGHT" | "MEDIUM" | "HEAVY" }) => Promise<void>; notification: (o: { type: "SUCCESS" | "WARNING" | "ERROR" }) => Promise<void> };
const haptics = () => (typeof window === "undefined" ? undefined : (window as unknown as { Capacitor?: { Plugins?: { Haptics?: HapticsPlugin } } }).Capacitor?.Plugins?.Haptics);
export const tap = (style: "LIGHT" | "MEDIUM" | "HEAVY" = "LIGHT") => void haptics()?.impact({ style }).catch(() => {});
export const buzz = (type: "SUCCESS" | "WARNING" | "ERROR") => void haptics()?.notification({ type }).catch(() => {});

/* ── Status bar icons (Android): white over the green header, dark over light screens ──
   Every mounted screen asks for a style; the one mounted last (the screen on top) wins. */
type NativeBars = { setStatusBarStyle?: (s: "light" | "dark") => void; setEdgeToEdge?: (on: boolean, color: string) => void };
const nativeBars = () => (typeof window === "undefined" ? undefined : (window as unknown as { MembrainNative?: NativeBars }).MembrainNative);

/** The app's own screens draw behind the status bar; any other page (the check-in, the questionnaire) sits below a
 *  status bar painted in that page's top colour. Called when the app frame mounts or unmounts and on every route change. */
let chromeTimer: ReturnType<typeof setTimeout> | null = null;
export function syncNativeChrome() {
  if (!nativeBars()?.setEdgeToEdge) return;
  if (chromeTimer) clearTimeout(chromeTimer);
  chromeTimer = setTimeout(() => {
    const app = !!document.querySelector(".mb-app");
    let el: Element | null = document.elementFromPoint(window.innerWidth / 2, 2);
    let color = "rgb(255, 255, 255)";
    while (el) {
      const bg = getComputedStyle(el).backgroundColor;
      if (bg && bg !== "transparent" && !/rgba\(.*,\s*0\)$/.test(bg)) { color = bg; break; }
      el = el.parentElement;
    }
    try {
      nativeBars()?.setEdgeToEdge?.(app, color);
      if (!app) nativeBars()?.setStatusBarStyle?.("dark");
      else applyBars();
    } catch {
      /* not inside the app */
    }
  }, 30);
}
const barStack: { id: number; light: boolean }[] = [];
let barSeq = 0;
function applyBars() {
  const native = nativeBars();
  try {
    native?.setStatusBarStyle?.(barStack.length && barStack[barStack.length - 1].light ? "light" : "dark");
  } catch {
    /* not inside the app */
  }
}
export function useStatusBar(light: boolean) {
  const id = useRef(0);
  useEffect(() => {
    id.current = ++barSeq;
    barStack.push({ id: id.current, light });
    applyBars();
    return () => {
      const i = barStack.findIndex((b) => b.id === id.current);
      if (i >= 0) barStack.splice(i, 1);
      applyBars();
    };
    // registered once per mount; changes are handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const b = barStack.find((x) => x.id === id.current);
    if (b && b.light !== light) {
      b.light = light;
      applyBars();
    }
  }, [light]);
}

/* ── Time ── */
export function relTime(iso: string | number | null | undefined, now = Date.now()): string {
  if (iso == null) return "–";
  const t = typeof iso === "number" ? iso : Date.parse(iso.length <= 10 ? iso + "T09:00:00Z" : iso);
  const s = Math.round((now - t) / 1000);
  if (Math.abs(s) < 45) return "just now";
  const m = Math.round(s / 60), h = Math.round(s / 3600), d = Math.round(s / 86400);
  if (Math.abs(m) < 60) return m > 0 ? `${m} min ago` : `in ${-m} min`;
  if (Math.abs(h) < 24) return h > 0 ? `${h} h ago` : `in ${-h} h`;
  if (Math.abs(d) < 14) return d > 0 ? (d === 1 ? "yesterday" : `${d} days ago`) : d === -1 ? "tomorrow" : `in ${-d} days`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/* ── Frame ── */
export function Frame({ children, dir = "ltr", lang = "en" }: { children: ReactNode; dir?: "ltr" | "rtl"; lang?: Lang }) {
  useEffect(() => {
    syncNativeChrome();
    return () => syncNativeChrome();
  }, []);
  return (
    <div dir={dir} lang={lang} className="mb-app relative mx-auto flex h-dvh w-full max-w-[520px] flex-col overflow-hidden bg-[#f5f6f3] text-ink sm:border-x sm:border-[#e7e9e4]">
      {children}
    </div>
  );
}

/** A screen: a large title that collapses into a compact blurred bar as you scroll, pull to refresh, and room for the tab bar. */
export function Screen({ title, sub, right, onBack, onRefresh, refreshing = false, children, hero, backLabel = "Back", bottomPad = true }: {
  title: string; sub?: ReactNode; right?: ReactNode; onBack?: () => void; onRefresh?: () => Promise<void> | void; refreshing?: boolean;
  children: ReactNode; hero?: ReactNode; backLabel?: string; bottomPad?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [pull, setPull] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [busyPull, setBusyPull] = useState(false);
  const start = useRef<number | null>(null);
  const busy = refreshing || busyPull;
  useStatusBar(!!hero && !scrolled);
  const onScroll = () => setScrolled((ref.current?.scrollTop ?? 0) > (hero ? 150 : 44));
  const end = async () => {
    const p = pull;
    start.current = null;
    setPulling(false);
    setPull(0);
    if (p > 70 && onRefresh) {
      tap("MEDIUM");
      setBusyPull(true);
      try {
        await onRefresh();
      } finally {
        setBusyPull(false);
      }
    }
  };
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Until the page scrolls, the bar is see-through and must not take the taps meant for the header under it
          (the hero's sign-out and profile buttons): only its own buttons catch them. */}
      <div className={cx("absolute inset-x-0 top-0 z-30 transition-[background-color,box-shadow] duration-200", scrolled ? "bg-[#f5f6f3]/88 shadow-[0_1px_0_rgb(15_35_30/0.07)] backdrop-blur-xl" : "pointer-events-none bg-transparent")}
        style={{ paddingTop: "var(--mb-sat)" }}>
        <div className="flex h-[52px] items-center gap-1 ps-1.5 pe-3">
          {onBack ? (
            <button type="button" onClick={() => { tap(); onBack(); }} aria-label={backLabel}
              className={cx("pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full transition-colors", hero && !scrolled ? "bg-white/15 text-white backdrop-blur" : "text-ink active:bg-black/5")}>
              <ChevronLeft size={24} className="rtl:-scale-x-100" />
            </button>
          ) : <span className="w-2.5" />}
          <p className={cx("min-w-0 flex-1 truncate text-[16.5px] font-semibold tracking-[-0.01em] transition-opacity duration-200", scrolled ? "opacity-100" : "opacity-0")}>{title}</p>
          <div className="pointer-events-auto flex items-center gap-1.5">{right}</div>
        </div>
      </div>
      {onRefresh && (pull > 6 || busy) && (
        <div className="pointer-events-none absolute inset-x-0 z-40 flex justify-center" style={{ top: `calc(var(--mb-sat) + ${busy ? 58 : 20 + pull * 0.5}px)` }} aria-hidden>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-deep shadow-[0_8px_22px_-8px_rgb(15_35_30/0.45)]" style={{ transform: busy ? undefined : `rotate(${pull * 3}deg)`, opacity: busy ? 1 : Math.min(1, pull / 60) }}>
            {busy ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={16} />}
          </span>
        </div>
      )}
      <div ref={ref} onScroll={onScroll}
        onTouchStart={(e) => { if ((ref.current?.scrollTop ?? 1) <= 0 && onRefresh) { start.current = e.touches[0].clientY; setPulling(true); } }}
        onTouchMove={(e) => { if (start.current != null) setPull(Math.max(0, Math.min(120, (e.touches[0].clientY - start.current) * 0.55))); }}
        onTouchEnd={() => void end()}
        className={cx("min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain", bottomPad && "pb-32")}>
        <div style={{ transform: pull > 0 ? `translateY(${pull * 0.5}px)` : undefined, transition: pulling ? undefined : "transform 0.25s ease" }}>
          {hero ?? (
            <div className="px-5 pb-1" style={{ paddingTop: "calc(var(--mb-sat) + 56px)" }}>
              <h1 className="text-[31px] font-semibold leading-[1.1] tracking-[-0.03em]">{title}</h1>
              {sub && <div className="mt-1.5 text-[14px] text-muted">{sub}</div>}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

export function Card({ children, className = "", onClick, href }: { children: ReactNode; className?: string; onClick?: () => void; href?: string }) {
  const cls = cx("block rounded-[22px] border border-[#e8eae5] bg-white shadow-[0_1px_2px_rgb(16_24_20/0.04),0_14px_34px_-24px_rgb(16_24_20/0.22)]", className);
  if (href) return <Link href={href} onClick={() => tap()} className={cx(cls, "transition-transform active:scale-[0.985]")}>{children}</Link>;
  return onClick ? (
    <button type="button" onClick={() => { tap(); onClick(); }} className={cx(cls, "w-full text-start transition-transform active:scale-[0.985]")}>{children}</button>
  ) : <div className={cls}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-baseline justify-between px-5">
      <h2 className="text-[18px] font-semibold tracking-[-0.015em]">{children}</h2>
      {action}
    </div>
  );
}

export function Pill({ level, lang = "en", label, size = "sm" }: { level: Level; lang?: Lang; label?: string; size?: "sm" | "md" }) {
  const t = LEVEL_TONE[level];
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold", t.bg, t.fg, size === "md" ? "px-2.5 py-1 text-[12.5px]" : "px-2 py-0.5 text-[11.5px]")}>
      <span className={cx("h-1.5 w-1.5 rounded-full", t.dot)} aria-hidden />
      {label ?? LEVEL_LABEL[lang][level]}
    </span>
  );
}

export function Chip({ children, tone = "neutral", icon: I }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "brand"; icon?: LucideIcon }) {
  const t = { neutral: "bg-[#f0f2ee] text-body", good: "bg-lv-stable-soft text-lv-stable", warn: "bg-lv-check-soft text-lv-check", bad: "bg-lv-urgent-soft text-lv-urgent", brand: "bg-[#e6efe9] text-deep" }[tone];
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold", t)}>{I && <I size={12} strokeWidth={2.4} />}{children}</span>;
}

/** Choose one of a few, with optional counts. */
export function Segmented<T extends string>({ value, options, onChange, className = "" }: { value: T; options: { key: T; label: ReactNode; count?: number }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cx("no-scrollbar flex gap-1.5 overflow-x-auto", className)} role="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button key={o.key} type="button" role="tab" aria-selected={on} onClick={() => { tap(); onChange(o.key); }}
            className={cx("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13.5px] font-semibold transition-colors", on ? "bg-ink text-white" : "bg-white text-body ring-1 ring-[#e3e6e1] active:bg-[#f0f2ee]")}>
            {o.label}
            {o.count != null && <span className={cx("rounded-full px-1.5 text-[11px] tabular-nums", on ? "bg-white/20" : "bg-[#eef0ec] text-muted")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export type Tab = { key: string; label: string; icon: LucideIcon; badge?: number };

/** The floating bottom bar: two tabs, the "+" in the middle, two tabs. */
export function TabBar({ tabs, current, onTab, onPlus, plusLabel }: { tabs: [Tab, Tab, Tab, Tab]; current: string; onTab: (k: string) => void; onPlus: () => void; plusLabel: string }) {
  const item = (t: Tab) => {
    const on = t.key === current;
    const I = t.icon;
    return (
      <button key={t.key} type="button" onClick={() => { tap(); onTab(t.key); }} aria-current={on ? "page" : undefined}
        className={cx("relative flex flex-1 flex-col items-center gap-[3px] py-2 text-[10.5px] font-semibold tracking-[0.01em] transition-colors", on ? "text-deep" : "text-[#93a09a]")}>
        <span className={cx("flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200", on && "bg-[#e3eee7]")}>
          <I size={21} strokeWidth={on ? 2.3 : 1.9} />
        </span>
        {t.label}
        {!!t.badge && <span className="absolute end-[18%] top-1 min-w-[17px] rounded-full bg-lv-urgent px-1 text-center text-[10px] font-bold leading-[17px] text-white ring-2 ring-white">{t.badge}</span>}
      </button>
    );
  };
  return (
    <nav className="absolute inset-x-3 z-40" style={{ bottom: "max(var(--mb-sab), 10px)" }} aria-label="App">
      <div className="flex items-center rounded-[28px] border border-white/70 bg-white/90 px-1.5 shadow-[0_18px_40px_-18px_rgb(16_24_20/0.35),0_2px_6px_rgb(16_24_20/0.05)] backdrop-blur-2xl">
        {item(tabs[0])}
        {item(tabs[1])}
        <div className="flex flex-1 justify-center">
          <button type="button" onClick={() => { tap("MEDIUM"); onPlus(); }} aria-label={plusLabel}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-gradient-to-b from-[#1b5a40] to-deep text-white shadow-[0_10px_22px_-8px_rgb(15_63_44/0.8)] transition-transform active:scale-90">
            <Plus size={26} strokeWidth={2.4} />
          </button>
        </div>
        {item(tabs[2])}
        {item(tabs[3])}
      </div>
    </nav>
  );
}

/** A sheet that slides up from the bottom (actions, pickers, details). */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="mb-fade-in absolute inset-0 bg-[#0b1712]/40 backdrop-blur-[3px]" />
      <div className="mb-sheet-in relative max-h-[88%] overflow-y-auto rounded-t-[30px] bg-white px-5 pt-2.5 shadow-[0_-20px_50px_-20px_rgb(0_0_0/0.35)]" style={{ paddingBottom: "max(var(--mb-sab), 22px)" }}>
        <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-[#dfe3de]" />
        {title && <p className="mb-2 text-[19px] font-semibold tracking-[-0.015em]">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function SheetAction({ icon: I, title, sub, onClick, href, tone = "bg-[#e9f1ec] text-deep", danger = false }: { icon: LucideIcon; title: string; sub?: string; onClick?: () => void; href?: string; tone?: string; danger?: boolean }) {
  const inner = (
    <>
      <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]", tone)}><I size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className={cx("block text-[15.5px] font-semibold", danger && "text-lv-review")}>{title}</span>
        {sub && <span className="block text-[13px] leading-snug text-muted">{sub}</span>}
      </span>
    </>
  );
  const cls = "flex w-full items-center gap-3.5 rounded-2xl px-1.5 py-2.5 text-start transition-colors active:bg-[#f3f5f1]";
  return href ? <Link href={href} onClick={() => { tap(); onClick?.(); }} className={cls}>{inner}</Link> : <button type="button" onClick={() => { tap(); onClick?.(); }} className={cls}>{inner}</button>;
}

export function Empty({ icon: I, title, sub, action }: { icon: LucideIcon; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-b from-[#eaf3ed] to-[#dcebe1] text-deep"><I size={28} /></span>
      <p className="mt-4 text-[17px] font-semibold">{title}</p>
      {sub && <p className="mt-1 max-w-[260px] text-[14px] leading-snug text-muted">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cx("mb-shimmer rounded-xl bg-[#e9ece7]", className)} />;
}

/** The connection, always in view: live with the time of the last sync, or syncing. Tap to sync now. */
export function LiveBadge({ syncedAt, syncing, onSync, dark = false }: { syncedAt: number | null; syncing: boolean; onSync: () => void; dark?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <button type="button" onClick={() => { tap(); onSync(); }} aria-label="Sync now"
      className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold tabular-nums", dark ? "bg-white/12 text-white ring-1 ring-white/20 backdrop-blur" : "bg-white text-deep ring-1 ring-[#e3e6e1]")}>
      {syncing ? <Loader2 size={12} className="animate-spin" /> : (
        <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-ping rounded-full bg-[#5fd08a] opacity-60" /><span className="relative h-2 w-2 rounded-full bg-[#3fbf72]" /></span>
      )}
      {syncing ? "Syncing" : `Live · ${relTime(syncedAt, Math.max(now, syncedAt ?? 0))}`}
    </button>
  );
}

export const initials = (name?: string | null) =>
  (name ?? "")
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w) && !/^dr\.?$/i.test(w))
    .slice(0, 2)
    .map((w) => w.match(/\p{L}/u)![0].toUpperCase())
    .join("") || "•";

export function Avatar({ name, color = "#0f3f2c", size = 44, ring = false }: { name?: string | null; color?: string; size?: number; ring?: boolean }) {
  return (
    <span className={cx("flex shrink-0 items-center justify-center rounded-full font-semibold text-white", ring && "ring-[3px] ring-white")}
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(160deg, ${color}, ${color}cc)` }}>
      {initials(name)}
    </span>
  );
}

/* ── Charts ── */
export function Donut({ parts, size = 132, stroke = 16, center }: { parts: { value: number; color: string }[]; size?: number; stroke?: number; center?: ReactNode }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = (size - stroke) / 2, C = 2 * Math.PI * r;
  const shown = parts.filter((p) => p.value > 0);
  const lens = shown.map((p) => (p.value / total) * C);
  const offs = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0ec" strokeWidth={stroke} />
        {shown.map((p, i) => (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeDasharray={`${Math.max(0, lens[i] - 3)} ${C}`} strokeDashoffset={-offs[i]} />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
    </div>
  );
}

export function Bars({ values, labels, color = "#0f3f2c", height = 64 }: { values: number[]; labels?: string[]; color?: string; height?: number }) {
  const max = Math.max(1, ...values);
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {values.map((v, i) => (
          <div key={i} className="flex-1 rounded-[6px] transition-[height] duration-500" style={{ height: `${Math.max(6, (v / max) * 100)}%`, background: i === values.length - 1 ? color : `${color}38` }} title={String(v)} />
        ))}
      </div>
      {labels && <div className="mt-1.5 flex gap-1.5">{labels.map((l, i) => <span key={i} className="flex-1 truncate text-center text-[10px] text-muted">{l}</span>)}</div>}
    </div>
  );
}

/* ── Toasts ── */
type ToastT = { id: number; text: string; tone: "ok" | "error" };
const ToastCtx = createContext<(text: string, tone?: "ok" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function Toasts({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastT[]>([]);
  const show = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    buzz(tone === "ok" ? "SUCCESS" : "ERROR");
    setList((l) => [...l, { id, text, tone }]);
    window.setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4" style={{ paddingTop: "calc(var(--mb-sat) + 10px)" }} aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className="mb-toast-in pointer-events-auto flex max-w-full items-center gap-2.5 rounded-2xl bg-ink px-4 py-3 text-[14px] font-medium text-white shadow-[0_18px_40px_-16px_rgb(0_0_0/0.5)]">
            {t.tone === "ok" ? <CheckCircle2 size={18} className="shrink-0 text-[#6fdc98]" /> : <XCircle size={18} className="shrink-0 text-[#ff8fa3]" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** A plain bar for full-screen flows (the intake), with a back button. */
export function TopBar({ title, sub, onBack, right, backLabel = "Back" }: { title: string; sub?: string; onBack?: () => void; right?: ReactNode; backLabel?: string }) {
  useStatusBar(false);
  return (
    <div className="sticky top-0 z-20 border-b border-[#e7e9e4] bg-[#f5f6f3]/90 backdrop-blur-xl" style={{ paddingTop: "var(--mb-sat)" }}>
      <div className="flex h-14 items-center gap-2 ps-1.5 pe-3">
        {onBack ? (
          <button type="button" onClick={() => { tap(); onBack(); }} aria-label={backLabel} className="flex h-10 w-10 items-center justify-center rounded-full text-ink active:bg-black/5">
            <ChevronLeft size={24} className="rtl:-scale-x-100" />
          </button>
        ) : <span className="w-3" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16.5px] font-semibold leading-tight tracking-[-0.01em]">{title}</p>
          {sub && <p className="truncate text-[12.5px] leading-tight text-muted">{sub}</p>}
        </div>
        {right}
      </div>
    </div>
  );
}
