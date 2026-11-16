"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, FlaskConical, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Logo } from "../Logo";
import type { Lang } from "@/lib/mb";
import { asset } from "@/lib/asset";

export type Trust = { icon: typeof ShieldCheck; text: string }[];

/** The sign-in pages' frame: a brand panel on the left (desktop only) and the form on the right. */
export function AuthShell({
  lang = "en",
  setLang,
  variant,
  eyebrow,
  title,
  body,
  preview,
  trust,
  back,
  children,
  footer,
}: {
  lang?: Lang;
  setLang?: (l: Lang) => void;
  variant: "patient" | "clinician" | "neutral";
  eyebrow: string;
  title: ReactNode;
  body: string;
  preview?: ReactNode;
  trust: Trust;
  back: { href: string; label: string };
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ar = lang === "ar";
  return (
    <div dir={ar ? "rtl" : "ltr"} lang={lang} className="flex min-h-dvh bg-white">
      {/* Brand panel */}
      <aside className="relative hidden w-[46%] max-w-[760px] shrink-0 flex-col overflow-hidden bg-deep text-white lg:flex">
        {variant === "patient" && (
          <div aria-hidden className="absolute inset-0">
            <Image src={asset("/images/hero-family-top.webp")} alt="" fill priority sizes="46vw" className="object-cover object-[60%_30%] opacity-[0.38]" />
            <div className="absolute inset-0 bg-gradient-to-b from-deep/70 via-deep/85 to-[#0b3324]" />
          </div>
        )}
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,rgb(42_96_69/0.55),transparent_60%),radial-gradient(90%_70%_at_100%_100%,rgb(224_173_98/0.16),transparent_60%)]" />
        <Image aria-hidden src={asset("/brand/membrain-mark-white.png")} alt="" width={355} height={312} className="pointer-events-none absolute -bottom-24 -end-20 w-[440px] opacity-[0.05]" />

        <div className="relative flex flex-1 flex-col px-12 py-11 xl:px-16">
          <Link href={ar ? "/ar/" : "/"} aria-label="MemBrain">
            <Logo inverted size="lg" />
          </Link>
          <div className="my-auto max-w-[500px] py-12">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.22em] text-sand">{eyebrow}</p>
            <h1 className={`mt-4 font-serif text-[40px] font-semibold tracking-[-0.02em] text-balance xl:text-[46px] ${ar ? "leading-[1.3]" : "leading-[1.08]"}`}>{title}</h1>
            <p className={`mt-5 text-[17px] text-white/75 ${ar ? "leading-[1.85]" : "leading-[1.6]"}`}>{body}</p>
            {preview && <div className="mt-10">{preview}</div>}
          </div>
          <ul className="grid gap-3 border-t border-white/10 pt-6 text-[13.5px] text-white/70 xl:grid-cols-3 xl:gap-5">
            {trust.map(({ icon: I, text }) => (
              <li key={text} className="flex items-start gap-2.5">
                <I size={16} className="mt-0.5 shrink-0 text-sand" aria-hidden /> {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* The form */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[72px] items-center justify-between gap-3 px-5 sm:px-10">
          <Link href={back.href} className="inline-flex items-center gap-2 rounded-full px-2 py-1.5 text-[14.5px] font-medium text-body hover:bg-mist hover:text-ink">
            <ArrowLeft size={17} className="rtl:-scale-x-100" /> {back.label}
          </Link>
          <div className="flex items-center gap-3">
            <Link href={ar ? "/ar/" : "/"} className="lg:hidden" aria-label="MemBrain">
              <Logo size="sm" />
            </Link>
            {setLang && (
              <div className="flex rounded-full bg-mist p-1" role="group" aria-label="Language">
                {(["en", "ar"] as Lang[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    aria-pressed={lang === l}
                    lang={l}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${lang === l ? "bg-white text-deep shadow-sm" : "text-muted hover:text-ink"}`}
                  >
                    {l === "en" ? "English" : "عربي"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-10 pt-4 sm:px-10">
          <div className="w-full max-w-[430px]">{children}</div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-line px-5 py-5 text-[13px] text-muted">
          {footer}
        </div>
      </main>
    </div>
  );
}

export const TRUST_ICONS = { ShieldCheck, MapPin, FlaskConical, Phone };

/* ── Form pieces ── */

export const input =
  "h-[52px] w-full rounded-xl border border-[#d7ddda] bg-white px-4 text-[16px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-[#9aa5a0] focus:border-deep focus:shadow-[0_0_0_4px_rgb(15_63_44/0.10)]";

export function Field({ label, htmlFor, hint, children, aside }: { label: string; htmlFor: string; hint?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[14px] font-medium text-ink">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

export function Alert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-[14.5px] leading-snug ${tone === "error" ? "bg-lv-urgent-soft text-lv-urgent" : "bg-sand-soft text-[#6b4714]"}`}>
      {children}
    </div>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-[12.5px] font-medium uppercase tracking-[0.14em] text-muted">
      <span className="h-px flex-1 bg-line" /> {label} <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Where to go after signing in: only a path on this site. */
export function safeNext(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : fallback;
}
