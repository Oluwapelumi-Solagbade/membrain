"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { asset } from "@/lib/asset";

const nav = [
  { label: "How it works", href: "/#how" },
  { label: "Demo", href: "/#demo" },
  { label: "Families", href: "/#families" },
  { label: "Clinicians", href: "/#clinicians" },
  { label: "Evidence", href: "/#evidence" },
];
const navItem = "text-[15px] font-medium text-ink transition-colors hover:text-leaf";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[76px] max-w-[1320px] items-center justify-between gap-6 px-4 sm:px-6 lg:h-[84px] lg:px-8">
        <Link href="/" aria-label="MemBrain home" className="shrink-0">
          <Logo size="lg" priority />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-10 lg:flex">
          {nav.map((n) => (
            <a key={n.label} href={asset(n.href)} className={navItem}>
              {n.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <Link href="/concern/?lang=ar" lang="ar" className={`${navItem} text-[16px]`}>
            العربية
          </Link>
          <span aria-hidden className="h-5 w-px bg-line" />
          <Link href="/clinician/" target="_blank" className={`${navItem} inline-flex items-center gap-1.5`}>
            Clinician view <ExternalLink size={15} strokeWidth={2} />
            <span className="sr-only">(opens in a new tab)</span>
          </Link>
          <Link href="/concern/" className="ms-2 inline-flex items-center gap-2 rounded-xl bg-deep px-6 py-3.5 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-deep-hover">
            Raise a concern <ArrowRight size={17} />
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="rounded-md p-2 text-ink hover:bg-mist lg:hidden"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <nav aria-label="Mobile" className="border-t border-line bg-white px-4 pb-5 pt-2 lg:hidden">
          {[...nav, { label: "Clinician view", href: "/clinician/" }].map((item) => (
            <a key={item.label} href={asset(item.href)} onClick={close} className="block border-b border-line py-3.5 text-[16px] font-medium">
              {item.label}
            </a>
          ))}
          <a href={asset("/concern/?lang=ar")} lang="ar" onClick={close} className="block border-b border-line py-3.5 text-[17px] font-medium">
            العربية
          </a>
          <a href={asset("/concern/")} onClick={close} className="mt-4 block rounded-xl bg-deep px-4 py-3.5 text-center text-[15px] font-medium text-white">
            Raise a concern
          </a>
        </nav>
      )}
    </header>
  );
}
