import Link from "next/link";
import { ArrowUpRight, Phone, Smartphone } from "lucide-react";
import type { Lang } from "@/lib/mb";
import { APK_URL } from "@/lib/app";
import { LANDING } from "./landing/copy";
import { Logo } from "./Logo";

type Item = { label: string; href: string; external?: boolean };

const COPY: Record<Lang, { tagline: string; emergency: string; app: string; appSub: string; groups: { title: string; items: Item[] }[]; lang: Item; rights: string }> = {
  en: {
    tagline: "From the first worry to the right clinician. In Arabic or English, checked for urgent signs first, and followed until someone is seen.",
    emergency: "Emergency? Call 998",
    app: "Get the Android app",
    appSub: "For clinicians and families",
    groups: [
      { title: "Families", items: [{ label: "Raise a concern", href: "/concern/" }, { label: "Six-minute check-in", href: "/checkin/" }, { label: "MyLife Profile (Coming soon)", href: "/mylife/" }, { label: "Sign in", href: "/signin/" }] },
      { title: "Clinicians", items: [{ label: "Clinician workspace", href: "/clinician/" }, { label: "Enrol a participant", href: "/clinician/enrol/" }] },
      { title: "MemBrain", items: [{ label: "How it works", href: "#how" }, { label: "Evidence", href: "#evidence" }, { label: "Watch the demo", href: "#demo" }] },
    ],
    lang: { label: "العربية", href: "/ar/" },
    rights: "MemBrain",
  },
  ar: {
    tagline: "من أول قلق إلى الطبيب المناسب. بالعربية أو الإنجليزية، مع فحص العلامات العاجلة أولًا، ومتابعة الإحالة حتى تتم المقابلة.",
    emergency: "طوارئ؟ اتصل على ٩٩٨",
    app: "حمّل تطبيق أندرويد",
    appSub: "للأطباء والعائلات",
    groups: [
      { title: "للعائلات", items: [{ label: "أبلغ عن تغيّر", href: "/concern/?lang=ar" }, { label: "فحص الست دقائق", href: "/checkin/?lang=ar" }, { label: "ملف MyLife (قريبًا)", href: "/mylife/?lang=ar" }, { label: "تسجيل الدخول", href: "/signin/patient/?lang=ar" }] },
      { title: "للأطباء", items: [{ label: "واجهة الطبيب", href: "/clinician/" }, { label: "تسجيل مشارك", href: "/clinician/enrol/" }] },
      { title: "MemBrain", items: [{ label: "كيف يعمل", href: "#how" }, { label: "الأدلة", href: "#evidence" }, { label: "شاهد العرض", href: "#demo" }] },
    ],
    lang: { label: "English", href: "/" },
    rights: "MemBrain",
  },
};

function FooterLink({ item }: { item: Item }) {
  const cls = "inline-flex items-center gap-1 py-1 text-[15px] text-white/75 transition-colors hover:text-white";
  if (item.href.startsWith("#")) return <a href={item.href} className={cls}>{item.label}</a>;
  return <Link href={item.href} className={cls}>{item.label}</Link>;
}

export function SiteFooter({ lang = "en" }: { lang?: Lang }) {
  const t = COPY[lang];
  const note = LANDING[lang].footer.note;
  const other: Lang = lang === "ar" ? "en" : "ar";
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-[#0b3324] text-white">
      <div aria-hidden className="pointer-events-none absolute -end-40 -top-40 h-[420px] w-[420px] rounded-full bg-[#1d5a40]/40 blur-3xl" />
      <div className="relative mx-auto max-w-[1320px] px-5 pb-8 pt-14 sm:px-6 md:pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.25fr_2fr] lg:gap-16">
          <div className="max-w-[440px]">
            <Logo inverted size="lg" className="self-start" />
            <p className="mt-5 text-[15.5px] leading-relaxed text-white/70">{t.tagline}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={APK_URL} className="group inline-flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-deep transition-transform hover:-translate-y-0.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-deep text-white"><Smartphone size={18} /></span>
                <span className="leading-tight">
                  <span className="block text-[14.5px] font-semibold">{t.app}</span>
                  <span className="block text-[12px] text-body">{t.appSub}</span>
                </span>
              </a>
              <a href="tel:998" className="inline-flex items-center gap-2.5 rounded-2xl border border-white/15 px-4 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-white/5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e05a4a]/20 text-[#ff8c7d]"><Phone size={17} /></span>
                {t.emergency}
              </a>
            </div>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
            {t.groups.map((g) => (
              <div key={g.title}>
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9fc9b1]">{g.title}</p>
                <ul className="space-y-1.5">
                  {g.items.map((i) => <li key={i.href}><FooterLink item={i} /></li>)}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-5 border-t border-white/10 pt-7 md:flex-row md:items-center md:justify-between">
          <p className="max-w-[640px] text-[13px] leading-relaxed text-white/55">{note}</p>
          <div className="flex shrink-0 items-center gap-4 text-[13px] text-white/55">
            <span>© {new Date().getFullYear()} {t.rights}</span>
            <Link href={t.lang.href} lang={other} hrefLang={other} className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 font-medium text-white/85 hover:bg-white/5">
              {t.lang.label} <ArrowUpRight size={13} className="rtl:-scale-x-100" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
