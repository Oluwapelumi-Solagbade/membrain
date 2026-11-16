import Link from "next/link";
import type { Lang } from "@/lib/mb";
import { LANDING } from "./landing/copy";
import { Logo } from "./Logo";
import { asset } from "@/lib/asset";

export function SiteFooter({ lang = "en" }: { lang?: Lang }) {
  const t = LANDING[lang].footer;
  return (
    <footer className="border-t border-white/10 bg-[#0b3324] text-white/70">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-4 py-9 text-sm sm:px-6 md:flex-row md:items-center md:justify-between">
        <Logo inverted />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {t.links.map(([label, href]) =>
            href.startsWith("/prototype") ? (
              // The earlier prototype is a plain page next to the site, not a Next route: link it directly.
              <a key={href} href={asset(href)} className="hover:text-white">
                {label}
              </a>
            ) : (
              <Link key={href} href={href} className="hover:text-white">
                {label}
              </Link>
            ),
          )}
        </nav>
        <p className="max-w-[340px] text-xs leading-relaxed">{t.note}</p>
      </div>
    </footer>
  );
}
