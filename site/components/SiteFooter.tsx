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
          { label: "Family informant report", href: "/informant/" },
          { label: "Sign in with phone", href: "/signin/patient/" },
        ],
      },
      {
        title: "Clinicians & Hospitals",
        items: [
          { label: "Clinician workspace", href: "/clinician/" },
          { label: "Review queue & triage", href: "/clinician/" },
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
          { label: "Cohorts & longitudinal trends", href: "/clinician/cohorts/" },
        ],
      },
      {
        title: "Clinical Governance",
        items: [
          { label: "SEHA & CCAD alignment", href: "#clinicians" },
          { label: "Clinical safety boundaries", href: "#how" },
          { label: "Zero data retention policy", href: "/signed-out/" },
          { label: "Decision support (No diagnosis)", href: "#how" },
        ],
      },
    ],
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
          { label: "استبيان أفراد الأسرة", href: "/informant/?lang=ar" },
          { label: "تسجيل الدخول برقم الهاتف", href: "/signin/patient/?lang=ar" },
        ],
      },
      {
        title: "الكادر الطبي والمستشفيات",
        items: [
          { label: "بوابة الطبيب السريرية", href: "/clinician/" },
          { label: "قائمة المراجعة والفرز", href: "/clinician/" },
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
          { label: "المجموعات والمتابعة المستمرة", href: "/clinician/cohorts/" },
        ],
      },
      {
        title: "الحوكمة والامتثال",
        items: [
          { label: "التوافق مع صحة (SEHA) وكليفلاند", href: "#clinicians" },
          { label: "الحدود ومعايير الأمان السريري", href: "#how" },
          { label: "سياسة مسح البيانات بالكامل", href: "/signed-out/?lang=ar" },
          { label: "دعم القرار السريري (لا يشخّص)", href: "#how" },
        ],
      },
    ],
    lang: { label: "English", href: "/" },
    rights: "MemBrain · مبادرة صحة الدماغ · دولة الإمارات",
    disclaimer:
      "MemBrain هو نظام بحثي لدعم القرار السريري والمساعدة في التوجيه الطبي؛ يقوم برصد مؤشرات التغيّر والمخاطر لدعم الأطباء ولا يُعد تشخيصًا طبيًا بديلًا. في حالات الطوارئ الطبية، يُرجى الاتصال فورًا بالرقم ٩٩٨.",
  },
};

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
