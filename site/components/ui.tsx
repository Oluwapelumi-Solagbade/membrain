import type { ReactNode } from "react";
import { LEVEL_LABEL, LEVEL_TONE, type Lang, type Level } from "@/lib/mb";

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-deep px-5 py-3.5 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-deep-hover disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 py-3.5 text-[15px] font-medium text-ink shadow-sm transition-colors hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50",
  quiet: "inline-flex items-center gap-1.5 text-[14px] font-medium text-leaf hover:text-deep hover:underline underline-offset-4",
};

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[12.5px] font-semibold uppercase tracking-[0.2em] text-leaf ${className}`}>{children}</p>;
}

export function LevelPill({ level, lang = "en", size = "md", label }: { level: Level; lang?: Lang; size?: "sm" | "md"; label?: string }) {
  const t = LEVEL_TONE[level];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${t.bg} ${t.fg} ${
        size === "sm" ? "px-2 py-0.5 text-[11.5px]" : "px-2.5 py-1 text-[12.5px]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden />
      {label ?? LEVEL_LABEL[lang][level]}
    </span>
  );
}

export function SectionHeading({ eyebrow, title, intro, id }: { eyebrow: string; title: ReactNode; intro?: ReactNode; id?: string }) {
  return (
    <div className="max-w-[680px]">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="mt-3 font-serif text-[32px] font-semibold leading-[1.1] tracking-[-0.015em] text-balance sm:text-[42px]">
        {title}
      </h2>
      {intro && <p className="mt-3 text-[16.5px] leading-[1.55] text-body text-pretty">{intro}</p>}
    </div>
  );
}
