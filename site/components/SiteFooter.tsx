"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  CheckCircle2,
  Globe,
  HeartHandshake,
  Lock,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import type { Lang } from "@/lib/mb";
import { APK_URL } from "@/lib/app";
import { LANDING } from "./landing/copy";
import { Logo } from "./Logo";

type Item = { label: string; href: string; badge?: string; external?: boolean };

const COPY: Record<
  Lang,
  {
    tagline: string;
    subTagline: string;
    emergency: string;
    app: string;
    appSub: string;
    backToTop: string;
    trustPills: { icon: "shield" | "lock" | "sparkles"; text: string }[];
    groups: { title: string; items: Item[] }[];
    bots: { title: string; desc: string; badge: string; cta: string };
    lang: Item;
    rights: string;
    disclaimer: string;
  }
> = {
  en: {
    tagline: "Spoken brain health navigation for the UAE.",
    subTagline:
      "From the first worry to the right clinician. In Arabic or English, checked for urgent signs first, and followed until someone is seen.",
    emergency: "Emergency? Call 998",
    app: "Get the Android app",
    appSub: "For clinicians and families",
    backToTop: "Back to top",
    trustPills: [
      { icon: "shield", text: "Hosted in UAE · Azure UAE North" },
      { icon: "lock", text: "Zero-Trace Privacy · Device Cleared" },
      { icon: "sparkles", text: "Gulf Dialect Acoustic AI · MedGemma" },
    ],
    groups: [
      {
        title: "Families & Public",
        items: [
          { label: "Raise a concern", href: "/concern/" },
          { label: "Six-minute check-in", href: "/checkin/" },
          { label: "MyLife Care Profile", href: "/mylife/", badge: "Coming Soon" },
          { label: "Telegram & WhatsApp Bot", href: "#chat", badge: "Coming Soon" },
          { label: "Family informant report", href: "/informant/" },
          { label: "Sign in with phone", href: "/signin/patient/" },
        ],
      },
      {
        title: "Clinicians & Hospitals",
        items: [
          { label: "Clinician workspace", href: "/clinician/" },
          { label: "Referrals network", href: "/clinician/referrals/" },
          { label: "Enrol a participant", href: "/clinician/enrol/" },
          { label: "Model validation & ROC/AUC", href: "/clinician/validation/" },
        ],
      },
      {
        title: "Platform & Science",
        items: [
          { label: "How voice biomarker works", href: "#how" },
          { label: "Watch interactive demo", href: "#demo" },
          { label: "Clinical evidence", href: "#evidence" },
          { label: "Live pilot metrics", href: "/clinician/live/" },
        ],
      },
      {
        title: "Clinical Governance",
        items: [
          { label: "SEHA & CCAD alignment", href: "#clinicians" },
          { label: "Zero-trace privacy policy", href: "#how" },
          { label: "Decision support (No diagnosis)", href: "#how" },
        ],
      },
    ],
    bots: {
      title: "Telegram & WhatsApp Bot",
      desc: "Raise a concern via voice notes or text directly from your everyday chat app.",
      badge: "Coming Soon",
      cta: "Preview channels",
    },
    lang: { label: "العربية", href: "/ar/" },
    rights: "MemBrain · UAE Health Pilot",
    disclaimer:
      "MemBrain is an investigational clinical decision-support and screening navigation tool; it flags risk and change to support physicians and never replaces medical diagnosis. In a medical emergency, call 998 immediately.",
  },
  ar: {
    tagline: "فحص صحة الدماغ الصوتي لدولة الإمارات.",
    subTagline:
      "من أول قلق إلى الطبيب المناسب. بالعربية أو الإنجليزية، مع فحص العلامات العاجلة أولًا، ومتابعة الإحالة حتى تتم المقابلة.",
    emergency: "طوارئ؟ اتصل على ٩٩٨",
    app: "حمّل تطبيق أندرويد",
    appSub: "للأطباء والعائلات",
    backToTop: "إلى الأعلى",
    trustPills: [
      { icon: "shield", text: "مستضاف داخل الدولة · سحابة Azure الإمارات" },
      { icon: "lock", text: "خصوصية كاملة · لا أثر باقٍ بالجهاز" },
      { icon: "sparkles", text: "ذكاء اصطناعي صوتي للهجات الخليجية" },
    ],
    groups: [
      {
        title: "العائلات والجمهور",
        items: [
          { label: "أبلغ عن تغيّر في الذاكرة", href: "/concern/?lang=ar" },
          { label: "فحص الست دقائق الصوتي", href: "/checkin/?lang=ar" },
          { label: "ملف MyLife للرعاية", href: "/mylife/?lang=ar", badge: "قريبًا" },
          { label: "بوت تيليجرام وواتساب", href: "#chat", badge: "قريبًا" },
          { label: "استبيان أفراد الأسرة", href: "/informant/?lang=ar" },
          { label: "تسجيل الدخول برقم الهاتف", href: "/signin/patient/?lang=ar" },
        ],
      },
      {
        title: "الكادر الطبي والمستشفيات",
        items: [
          { label: "بوابة الطبيب السريرية", href: "/clinician/" },
          { label: "شبكة الإحالات الطبية", href: "/clinician/referrals/" },
          { label: "تسجيل مشارك جديد", href: "/clinician/enrol/" },
          { label: "التحقق السريري ومؤشرات ROC", href: "/clinician/validation/" },
        ],
      },
      {
        title: "المنصة والأدلة",
        items: [
          { label: "كيف تعمل المؤشرات الصوتية", href: "#how" },
          { label: "شاهد العرض التوضيحي", href: "#demo" },
          { label: "الأدلة السريرية والمنهجية", href: "#evidence" },
          { label: "بيانات التشغيل الحيّة", href: "/clinician/live/" },
        ],
      },
      {
        title: "الحوكمة والامتثال",
        items: [
          { label: "التوافق مع صحة (SEHA) وكليفلاند", href: "#clinicians" },
          { label: "سياسة مسح البيانات بالكامل", href: "#how" },
          { label: "دعم القرار السريري (لا يشخّص)", href: "#how" },
        ],
      },
    ],
    bots: {
      title: "بوت تيليجرام وواتساب",
      desc: "أبلغ عن المخاوف والتغيرات برسائل صوتية أو نصية عبر تطبيقات المحادثة المعتادة لعائلتك.",
      badge: "قريبًا",
      cta: "معاينة القنوات",
    },
    lang: { label: "English", href: "/" },
    rights: "MemBrain · مبادرة صحة الدماغ · دولة الإمارات",
    disclaimer:
      "MemBrain هو نظام بحثي لدعم القرار السريري والمساعدة في التوجيه الطبي؛ يقوم برصد مؤشرات التغيّر والمخاطر لدعم الأطباء ولا يُعد تشخيصًا طبيًا بديلًا. في حالات الطوارئ الطبية، يُرجى الاتصال فورًا بالرقم ٩٩٨.",
  },
};

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm4.52 11.99c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

function TelegramIcon({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="currentColor">
      <path d="M9.04 15.28 8.7 19.6c.48 0 .69-.21.94-.46l2.26-2.16 4.68 3.43c.86.47 1.47.22 1.7-.79l3.08-14.43c.28-1.27-.46-1.77-1.3-1.46L1.95 10.7c-1.24.48-1.22 1.17-.21 1.48l4.62 1.44L17.1 6.9c.5-.33.96-.15.58.18" />
    </svg>
  );
}

function FooterLink({ item }: { item: Item }) {
  const cls =
    "group inline-flex items-center gap-1.5 py-1 text-[14.5px] text-white/70 transition-colors hover:text-white";
  const badgeCls =
    "rounded-full bg-amber-400/20 border border-amber-400/40 px-1.5 py-0.2 text-[10px] font-bold text-amber-300";

  if (item.href.startsWith("#")) {
    return (
      <a href={item.href} className={cls}>
        <span>{item.label}</span>
        {item.badge && <span className={badgeCls}>{item.badge}</span>}
      </a>
    );
  }

  return (
    <Link href={item.href} className={cls}>
      <span>{item.label}</span>
      {item.badge && <span className={badgeCls}>{item.badge}</span>}
    </Link>
  );
}

export function SiteFooter({ lang = "en" }: { lang?: Lang }) {
  const t = COPY[lang];
  const other: Lang = lang === "ar" ? "en" : "ar";

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-[#0a271c] text-white">
      {/* Ambient background light gradients */}
      <div
        aria-hidden
        className="pointer-events-none absolute -end-40 -top-40 h-[460px] w-[460px] rounded-full bg-[#1b583e]/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -start-40 h-[400px] w-[400px] rounded-full bg-[#154632]/25 blur-3xl"
      />

      <div className="relative mx-auto max-w-[1340px] px-5 pb-8 pt-14 sm:px-6 md:pt-16">
        {/* Top Section: Brand Story & Trust Signals */}
        <div className="grid gap-10 border-b border-white/10 pb-12 lg:grid-cols-[1.3fr_2fr] lg:gap-14">
          <div className="max-w-[460px]">
            <Logo inverted size="lg" className="self-start" />
            <h2 className="mt-4 font-serif text-[20px] font-semibold text-white">
              {t.tagline}
            </h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-white/70">
              {t.subTagline}
            </p>

            {/* Trust Signals */}
            <div className="mt-5 space-y-2">
              {t.trustPills.map((pill, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-[12.5px] font-medium text-[#a2d4ba]"
                >
                  {pill.icon === "shield" && <ShieldCheck size={14} className="shrink-0 text-emerald-400" />}
                  {pill.icon === "lock" && <Lock size={13} className="shrink-0 text-emerald-400" />}
                  {pill.icon === "sparkles" && <Sparkles size={13} className="shrink-0 text-emerald-400" />}
                  <span>{pill.text}</span>
                </div>
              ))}
            </div>

            {/* Quick Action Badges */}
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={APK_URL}
                className="group inline-flex items-center gap-3 rounded-2xl bg-white px-4 py-2.5 text-deep shadow-sm transition-transform hover:-translate-y-0.5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-deep text-white">
                  <Smartphone size={18} />
                </span>
                <span className="leading-tight">
                  <span className="block text-[14px] font-semibold">{t.app}</span>
                  <span className="block text-[11.5px] text-body">{t.appSub}</span>
                </span>
              </a>

              <a
                href="tel:998"
                className="inline-flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/5 px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-white/10"
              >
                <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-[#e05a4a]/25 text-[#ff8c7d]">
                  <Phone size={15} />
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                  </span>
                </span>
                <span>{t.emergency}</span>
              </a>
            </div>
          </div>

          {/* 4-Column Directory Grid */}
          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:gap-x-8"
          >
            {t.groups.map((g) => (
              <div key={g.title}>
                <p className="mb-3.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[#9fc9b1]">
                  {g.title}
                </p>
                <ul className="space-y-2">
                  {g.items.map((i) => (
                    <li key={i.href}>
                      <FooterLink item={i} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Telegram & WhatsApp Bot Feature (Coming Soon) */}
        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex -space-x-1.5 rtl:space-x-reverse shrink-0">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25d366] text-white shadow ring-2 ring-[#0a271c]"
                aria-hidden
              >
                <WhatsAppIcon size={18} />
              </span>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#229ed9] text-white shadow ring-2 ring-[#0a271c]"
                aria-hidden
              >
                <TelegramIcon size={17} />
              </span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold text-white">
                  {t.bots.title}
                </span>
                <span className="rounded-full bg-amber-400/20 border border-amber-400/40 px-2 py-0.5 text-[10.5px] font-bold text-amber-300">
                  {t.bots.badge}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] text-white/70">
                {t.bots.desc}
              </p>
            </div>
          </div>
          <a
            href="#chat"
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/20"
          >
            <span>{t.bots.cta}</span>
            <ArrowRight size={14} className="rtl:-scale-x-100 opacity-80" />
          </a>
        </div>

        {/* Bottom Utility Bar: Disclaimer, Rights, Language & Back-to-Top */}
        <div className="mt-8 flex flex-col gap-6 pt-2 lg:flex-row lg:items-center lg:justify-between">
          <p className="max-w-[720px] text-[12.5px] leading-relaxed text-white/50">
            {t.disclaimer}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-[13px] text-white/60">
            <span>© {new Date().getFullYear()} {t.rights}</span>

            {/* Language Switcher */}
            <Link
              href={t.lang.href}
              lang={other}
              hrefLang={other}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1 font-medium text-white/90 hover:bg-white/10 transition-colors"
            >
              <Globe size={13} className="text-[#a2d4ba]" />
              <span>{t.lang.label}</span>
              <ArrowUpRight size={12} className="rtl:-scale-x-100 opacity-70" />
            </Link>

            {/* Back to top button */}
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-[12.5px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={t.backToTop}
            >
              <ArrowUp size={13} />
              <span>{t.backToTop}</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
