"use client";

// The mobile app's building blocks: a phone-first look on the site's palette (deep green, sand, mist).
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, type LucideIcon } from "lucide-react";
import { LEVEL_LABEL, LEVEL_TONE, type Lang, type Level } from "@/lib/mb";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** The full-height app frame: the content scrolls, the tab bar stays. */
export function Frame({ children, dir = "ltr", lang = "en" }: { children: ReactNode; dir?: "ltr" | "rtl"; lang?: Lang }) {
  return (
    <div dir={dir} lang={lang} className="mb-app relative mx-auto flex h-dvh w-full max-w-[520px] flex-col overflow-hidden bg-[#f4f6f2] text-ink sm:border-x sm:border-line">
      {children}
    </div>
  );
}

export function Scroll({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cx("min-h-0 flex-1 overflow-y-auto overscroll-contain pb-28", className)}>{children}</div>;
}

/** The deep-green header with the soft sand glow, as on the home screens. */
export function Hero({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("relative overflow-hidden rounded-b-[30px] bg-deep px-5 pb-6 text-white", className)} style={{ paddingTop: "max(env(safe-area-inset-top), 18px)" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_70%_at_100%_0%,rgb(224_173_98/0.30),transparent_55%),radial-gradient(90%_80%_at_0%_100%,rgb(56_132_96/0.55),transparent_60%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

/** A plain top bar for inner screens, with a back button. */
export function TopBar({ title, sub, onBack, right, backLabel = "Back" }: { title: string; sub?: string; onBack?: () => void; right?: ReactNode; backLabel?: string }) {
  return (
    <div className="sticky top-0 z-20 border-b border-line/70 bg-[#f4f6f2]/90 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex h-14 items-center gap-2 ps-2 pe-3">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label={backLabel} className="flex h-10 w-10 items-center justify-center rounded-full text-ink active:bg-mist">
            <ChevronLeft size={24} className="rtl:-scale-x-100" />
          </button>
        ) : (
          <span className="w-3" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16.5px] font-semibold leading-tight">{title}</p>
          {sub && <p className="truncate text-[12.5px] leading-tight text-muted">{sub}</p>}
        </div>
        {right}
      </div>
    </div>
  );
}

export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const cls = cx("rounded-[20px] border border-[#e6e9e3] bg-white shadow-[0_1px_2px_rgb(15_35_40/0.04),0_8px_24px_-18px_rgb(15_35_40/0.25)]", className);
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(cls, "block w-full text-start transition-transform active:scale-[0.985]")}>
      {children}
    </button>
  ) : (
    <div className={cls}>{children}</div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-7 flex items-baseline justify-between px-5">
      <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-leaf">{children}</h2>
      {action}
    </div>
  );
}

export function Stat({ icon: I, value, label, sub, tone = "text-deep", onClick }: { icon: LucideIcon; value: ReactNode; label: string; sub?: string; tone?: string; onClick?: () => void }) {
  return (
    <Card className="p-4" onClick={onClick}>
      <span className={cx("flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef3ef]", tone)}>
        <I size={18} strokeWidth={2} />
      </span>
      <p className="mt-3 font-serif text-[28px] font-semibold leading-none tracking-[-0.02em]">{value}</p>
      <p className="mt-1.5 text-[13.5px] font-medium text-ink">{label}</p>
      {sub && <p className="mt-0.5 text-[12px] leading-snug text-muted">{sub}</p>}
    </Card>
  );
}

export function Pill({ level, lang = "en", label }: { level: Level; lang?: Lang; label?: string }) {
  const t = LEVEL_TONE[level];
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold", t.bg, t.fg)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", t.dot)} aria-hidden />
      {label ?? LEVEL_LABEL[lang][level]}
    </span>
  );
}

/** Choose one of a few: the filters above the alert list, languages, and so on. */
export function Segmented<T extends string>({ value, options, onChange, className = "" }: { value: T; options: { key: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cx("flex gap-1.5 overflow-x-auto", className)} role="tablist">
      {options.map((o) => (
        <button key={o.key} type="button" role="tab" aria-selected={o.key === value} onClick={() => onChange(o.key)}
          className={cx("shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors", o.key === value ? "bg-deep text-white shadow-sm" : "bg-white text-body ring-1 ring-[#e3e6e1] active:bg-mist")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type Tab = { key: string; label: string; icon: LucideIcon };

/** The bottom bar: two tabs, the big "+" in the middle, two tabs. */
export function TabBar({ tabs, current, onTab, onPlus, plusLabel }: { tabs: [Tab, Tab, Tab, Tab]; current: string; onTab: (k: string) => void; onPlus: () => void; plusLabel: string }) {
  const item = (t: Tab) => {
    const on = t.key === current;
    const I = t.icon;
    return (
      <button key={t.key} type="button" onClick={() => onTab(t.key)} aria-current={on ? "page" : undefined}
        className={cx("flex flex-1 flex-col items-center gap-1 pb-1 pt-2 text-[11px] font-medium transition-colors", on ? "text-deep" : "text-[#8a9691]")}>
        <I size={22} strokeWidth={on ? 2.3 : 1.9} />
        {t.label}
      </button>
    );
  };
  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 border-t border-[#e3e6e1] bg-white/92 backdrop-blur-xl" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }} aria-label="App">
      <div className="flex items-end px-2">
        {item(tabs[0])}
        {item(tabs[1])}
        <div className="flex flex-1 justify-center">
          <button type="button" onClick={onPlus} aria-label={plusLabel}
            className="-mt-7 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-deep text-white shadow-[0_12px_28px_-10px_rgb(15_63_44/0.75)] ring-[5px] ring-[#f4f6f2] transition-transform active:scale-95">
            <Plus size={28} strokeWidth={2.4} />
          </button>
        </div>
        {item(tabs[2])}
        {item(tabs[3])}
      </div>
    </nav>
  );
}

/** A sheet that slides up from the bottom (actions, pickers). */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#0b1f17]/45 backdrop-blur-[2px] mb-fade-in" />
      <div className="mb-sheet-in relative max-h-[85%] overflow-y-auto rounded-t-[28px] bg-white px-5 pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#dfe3de]" />
        <p className="mb-3 text-[17px] font-semibold">{title}</p>
        {children}
      </div>
    </div>
  );
}

export function SheetAction({ icon: I, title, sub, onClick, href, tone = "bg-[#eef3ef] text-deep" }: { icon: LucideIcon; title: string; sub: string; onClick?: () => void; href?: string; tone?: string }) {
  const inner = (
    <>
      <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", tone)}><I size={21} /></span>
      <span className="min-w-0">
        <span className="block text-[15.5px] font-semibold">{title}</span>
        <span className="block text-[13px] leading-snug text-body">{sub}</span>
      </span>
    </>
  );
  const cls = "flex w-full items-center gap-3.5 rounded-2xl px-2 py-3 text-start active:bg-paper";
  return href ? <Link href={href} onClick={onClick} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

export function Empty({ icon: I, title, sub }: { icon: LucideIcon; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e6f0e9] text-deep"><I size={26} /></span>
      <p className="mt-4 text-[16px] font-semibold text-deep">{title}</p>
      {sub && <p className="mt-1 text-[13.5px] text-muted">{sub}</p>}
    </div>
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
