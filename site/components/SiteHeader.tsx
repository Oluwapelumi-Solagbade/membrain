"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Menu, UserRound, X } from "lucide-react";
import type { Lang } from "@/lib/mb";
import { LANDING } from "./landing/copy";
import { Logo } from "./Logo";

const navItem = "text-[15px] font-medium text-ink transition-colors hover:text-leaf";

export function SiteHeader({ lang = "en" }: { lang?: Lang }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const t = LANDING[lang];
  const other = t.switchLang as Lang;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[76px] max-w-[1320px] items-center justify-between gap-6 px-4 sm:px-6 lg:h-[84px] lg:px-8">
        <Link href={lang === "ar" ? "/ar/" : "/"} aria-label={t.home} className="shrink-0">
          <Logo size="lg" priority />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-10 lg:flex">
          {t.nav.map((n) => (
            <a key={n.href} href={n.href} className={navItem}>
              {n.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          {/* The same page in the other language */}
          <Link href={t.switchHref} lang={other} hrefLang={other} className={`${navItem} ${other === "ar" ? "text-[16px]" : ""}`}>
            {t.switchLabel}
          </Link>
          <span aria-hidden className="h-5 w-px bg-line" />
          <Link href="/clinician/" target="_blank" className={`${navItem} inline-flex items-center gap-1.5`}>
            {t.clinicianView} <ExternalLink size={15} strokeWidth={2} />
            <span className="sr-only">{t.newTab}</span>
          </Link>
          <Link href={lang === "ar" ? "/signin/patient/?lang=ar" : "/signin/"} className={`${navItem} inline-flex items-center gap-1.5`}>
            <UserRound size={17} strokeWidth={2} /> {t.signIn}
          </Link>
          <Link href={t.concernHref} className="ms-2 inline-flex items-center gap-2 rounded-xl bg-deep px-6 py-3.5 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-deep-hover">
            {t.raise} <ArrowRight size={17} className="rtl:-scale-x-100" />
          </Link>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <Link href={t.switchHref} lang={other} hrefLang={other} className="rounded-md px-2.5 py-2 text-[15px] font-medium text-deep hover:bg-mist">
            {t.switchLabel}
          </Link>
          <button
            type="button"
            aria-label={open ? t.menuClose : t.menuOpen}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="rounded-md p-2 text-ink hover:bg-mist"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Mobile" className="border-t border-line bg-white px-4 pb-5 pt-2 lg:hidden">
          {[...t.nav, { label: t.clinicianView, href: "/clinician/" }, { label: t.signIn, href: lang === "ar" ? "/signin/patient/?lang=ar" : "/signin/" }].map((item) => (
            <a key={item.href} href={item.href} onClick={close} className="block border-b border-line py-3.5 text-[16px] font-medium">
              {item.label}
            </a>
          ))}
          <a href={t.concernHref} onClick={close} className="mt-4 block rounded-xl bg-deep px-4 py-3.5 text-center text-[15px] font-medium text-white">
            {t.raise}
          </a>
        </nav>
      )}
    </header>
  );
}
