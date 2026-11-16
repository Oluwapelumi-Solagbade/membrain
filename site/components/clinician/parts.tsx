"use client";

// Building blocks shared by every clinician page, so they all look and behave the same.
import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Info, type LucideIcon } from "lucide-react";

/** Closes a popover when you click outside it or press Escape. Destructure the result (the lint rule needs it). */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

export function Avatar({ size = 48 }: { size?: number }) {
  return <Image src="/images/avatar-dr-demo.webp" alt="" width={size} height={size} className="rounded-full object-cover ring-1 ring-black/5" style={{ width: size, height: size }} />;
}

/** Page title in the serif, a line under it, and an optional element on the right. */
export function PageHeader({ title, sub, aside }: { title: string; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-[34px] font-semibold leading-tight tracking-[-0.015em] sm:text-[44px]">{title}</h1>
        {sub && <p className="mt-1 text-[15px] text-body sm:text-[16px]">{sub}</p>}
      </div>
      {aside}
    </div>
  );
}

export function SyntheticBadge() {
  return (
    <span className="inline-flex items-center gap-2.5 rounded-2xl border border-[#ececea] bg-white px-4 py-2.5 text-[14.5px] text-ink shadow-[0_2px_10px_-4px_rgb(0_0_0/0.08)]">
      Synthetic cohort · not a real person
      <span title="Every person, record and referral here is invented for the demo." className="text-body">
        <Info size={18} strokeWidth={1.8} />
      </span>
    </span>
  );
}

export const CARD_TONE = {
  review: { bg: "from-[#fcefec]", icon: "bg-[#fbe2dc] text-lv-review" },
  check: { bg: "from-[#fdf4ec]", icon: "bg-[#fde5d3] text-[#c06a1e]" },
  referral: { bg: "from-[#f5f8f4]", icon: "bg-[#e1eee5] text-deep" },
  stable: { bg: "from-[#eef5ef]", icon: "bg-[#d9ebdd] text-deep" },
  neutral: { bg: "from-[#f6f6f3]", icon: "bg-[#ebebe6] text-ink" },
};

/** A summary card: tinted, with a round icon, a big number and a short note. */
export function Stat({ icon: Icon, label, value, note, tone = "neutral" }: { icon: LucideIcon; label: string; value: ReactNode; note: string; tone?: keyof typeof CARD_TONE }) {
  const t = CARD_TONE[tone];
  return (
    <div className={`rounded-2xl border border-[#ebece8] bg-gradient-to-br ${t.bg} to-white px-4 py-3.5 sm:px-5 sm:py-4`}>
      <p className="flex items-center gap-2.5 text-[14px] font-semibold leading-tight tracking-[-0.01em] sm:gap-3 sm:text-[16.5px]">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 ${t.icon}`}>
          <Icon size={19} strokeWidth={2} />
        </span>
        {label}
      </p>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight sm:text-[34px]">{value}</p>
      <p className="mt-2 text-[12.5px] leading-snug text-body sm:mt-2.5 sm:text-[14.5px]">{note}</p>
    </div>
  );
}

/** A white section card with an icon title and an optional right-hand note. */
export function Panel({ title, icon: Icon, children, aside, id, flush = false }: { title: string; icon: LucideIcon; children: ReactNode; aside?: ReactNode; id?: string; flush?: boolean }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-[#ebece8] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-3 pt-5">
        <h2 className="flex items-center gap-3 text-[17px] font-semibold tracking-[-0.01em]">
          <Icon size={21} strokeWidth={1.8} className="text-deep" /> {title}
        </h2>
        {aside}
      </div>
      <div className={flush ? "pb-2" : "px-6 pb-5"}>{children}</div>
    </section>
  );
}

export const btnClass = {
  primary: "inline-flex items-center justify-center gap-2 rounded-xl bg-[#0c392c] px-4 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-deep-hover disabled:cursor-not-allowed disabled:opacity-50",
  secondary: "inline-flex items-center justify-center gap-2 rounded-xl border border-[#d9dcd7] bg-white px-4 py-2.5 text-[15px] font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50",
  danger: "inline-flex items-center justify-center gap-2 rounded-xl bg-lv-review px-4 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-[#953a25] disabled:cursor-not-allowed disabled:opacity-50",
};

/** A pill for table headers and filter tabs. */
export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-[#f1f1ee] p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-[14px] font-medium transition-colors ${value === o.value ? "bg-white text-ink shadow-sm" : "text-body hover:text-ink"}`}
        >
          {o.label}
          {o.count != null && <span className="ms-1.5 text-muted">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Loading and empty states that match the cards. */
export function Loading({ label = "Loading cases" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#ebece8] bg-white px-6 py-8 text-[15px] text-body">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-mist-strong border-t-deep" aria-hidden /> {label}…
    </div>
  );
}

/** Download text as a file (CSV, JSON). */
export function downloadText(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map((v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(",")).join("\n");
}
