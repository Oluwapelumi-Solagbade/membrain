// "MemBrain in your pocket": mobile app presentation on landing page.
// Highlights the live Android APK build (a live client of the MemBrain server) and the upcoming iOS app.
import Image from "next/image";
import {
  BellRing,
  CheckCircle2,
  Clock,
  Download,
  MapPinned,
  Mic,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Eyebrow } from "@/components/ui";
import { APK_URL } from "@/lib/app";
import { asset } from "@/lib/asset";
import type { Lang } from "@/lib/mb";

const T = {
  en: {
    eyebrow: "Mobile Platform",
    androidPill: "Android Live",
    iosPill: "iOS Coming Soon",
    title: ["MemBrain, in your ", "pocket", "."],
    intro:
      "One unified app for families and clinicians. Families report changes via voice or the family questionnaire; individuals complete the spoken check-in; clinicians manage triage alerts, catchment maps, referrals, and clinical summaries. Records stay on MemBrain's server, never on the phone.",
    badges: [
      "Six-minute spoken check-in",
      "Gulf Dialect Acoustic AI",
      "No records kept on the phone",
      "Direct Hospital Routing",
    ],
    features: [
      {
        icon: Mic,
        title: "Speak, don't type",
        text: "Concerns and check-ins by voice, in Arabic or English, heard from the very first word.",
      },
      {
        icon: BellRing,
        title: "Alerts that explain themselves",
        text: "Urgent signs first, every level with transparent clinical reasons and callback SLAs.",
      },
      {
        icon: MapPinned,
        title: "The Emirates at a glance",
        text: "Who needs attention where, catchment health centers, and specialty memory services.",
      },
      {
        icon: UsersRound,
        title: "Family in the loop",
        text: "Report changes since last visit and complete the validated family questionnaire.",
      },
    ],
    androidTitle: "Download for Android",
    androidSubtitle: "Direct APK install · Version 1.3 (7 MB) · Android 5.1+",
    androidBadge: "Available Now",
    androidOffline: "If Play Protect asks: More details → Install anyway",
    iosTitle: "Apple iOS & iPadOS",
    iosSubtitle: "TestFlight pilot onboarding in progress",
    iosBadge: "Coming Soon",
    iosNote: "App Store release arriving soon",
    shots: [
      {
        src: "/images/app/clinician-home.webp",
        alt: "The clinician's home screen: people needing review, urgent alerts and triage levels",
      },
      {
        src: "/images/app/intake.webp",
        alt: "A new concern read on the phone: an urgent sign shown first, and the facts picked out",
      },
      {
        src: "/images/app/patient-home-ar.webp",
        alt: "The person's home screen in Arabic: their latest message, next check-in and plan",
      },
    ],
    note: "MemBrain is an investigational screening navigation tool; it flags risk and change to support physicians and never replaces medical diagnosis.",
  },
  ar: {
    eyebrow: "تطبيق الهاتف الذكي",
    androidPill: "أندرويد متاح الآن",
    iosPill: "آبل iOS قريبًا",
    title: ["MemBrain ", "في جيبك", "."],
    intro:
      "تطبيق موحد للأسرة والكادر الطبي. تبلّغ الأسرة عن التغيّر بالصوت أو عبر استبيان الأسرة، ويُجري الشخص الفحص الصوتي، ويعمل الأطباء على قائمة التنبيهات وخريطة المستشفيات والإحالات. تبقى السجلات على خادم MemBrain، ولا تُحفظ على الهاتف.",
    badges: [
      "فحص صوتي في ست دقائق",
      "ذكاء اصطناعي صوتي للهجات الخليجية",
      "لا تُحفظ السجلات على الهاتف",
      "توجيه مباشر لأقرب مستشفى",
    ],
    features: [
      {
        icon: Mic,
        title: "تحدّث بدلًا من الكتابة",
        text: "البلاغات والفحوص بالصوت، بالعربية أو الإنجليزية، ويُسمع كلامك من أول كلمة.",
      },
      {
        icon: BellRing,
        title: "تنبيهات تشرح نفسها",
        text: "العاجل أولًا، ولكل مستوى أسبابه السريرية الواضحة والخطوة التالية.",
      },
      {
        icon: MapPinned,
        title: "الإمارات في لمحة",
        text: "من يحتاج إلى اهتمام وأين، مع خريطة مراكز الذاكرة والخدمات المتخصصة.",
      },
      {
        icon: UsersRound,
        title: "الأسرة جزء من الرحلة",
        text: "الإبلاغ عن أي تغيّر ومتابعة الاستبيانات السريرية المعتمدة.",
      },
    ],
    androidTitle: "حمّل التطبيق لأندرويد",
    androidSubtitle: "تحميل ملف APK مباشر · الإصدار 1.3 (٧ ميجابايت) · أندرويد 5.1 فأحدث",
    androidBadge: "متاح الآن",
    androidOffline: "إن ظهر تنبيه Play Protect: المزيد من التفاصيل ← التثبيت على أي حال",
    iosTitle: "أجهزة آبل (iOS & iPadOS)",
    iosSubtitle: "قيد الإطلاق التجريبي عبر منصة TestFlight",
    iosBadge: "قريبًا",
    iosNote: "سيتاح قريبًا على متجر App Store",
    shots: [
      {
        src: "/images/app/patient-home-ar.webp",
        alt: "الشاشة الرئيسية للشخص بالعربية: آخر المستجدات والفحص القادم والخطة",
      },
      {
        src: "/images/app/intake.webp",
        alt: "بلاغ جديد يقرؤه الهاتف: العلامة العاجلة أولًا ثم المعلومات المستخرجة",
      },
      {
        src: "/images/app/clinician-home.webp",
        alt: "الشاشة الرئيسية للطبيب: من يحتاج إلى مراجعة والتنبيهات العاجلة ومستويات الفرز",
      },
    ],
    note: "نظام بحثي لدعم القرار السريري والمساعدة في التوجيه الطبي؛ يرصد مؤشرات التغيّر والمخاطر ولا يشخّص أبدًا.",
  },
};

function AndroidIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4128 13.8533 8.125 12 8.125c-1.8577 0-3.5931.2878-5.1329.8247L4.8448 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
    </svg>
  );
}

function AppleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 170 170" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.71-11.65-14.01-6.1-9.47-10.9-19.98-14.41-31.54-3.51-11.55-5.27-22.37-5.27-32.46 0-14.37 3.59-26.17 10.77-35.4 7.18-9.23 16.19-13.91 27.03-14.05 4.8 0 10.14 1.23 16.02 3.69 5.88 2.46 9.77 3.69 11.66 3.69 1.66 0 5.8-1.32 12.42-3.95 6.62-2.63 12.4-3.81 17.34-3.53 13.06.82 23.36 5.56 30.91 14.22-11.53 7.02-17.18 16.82-16.96 29.41.22 9.87 3.99 18.06 11.31 24.58 7.32 6.52 16.04 10.16 26.16 10.93-2.39 7.39-5.3 14.59-8.74 21.61zM119.22 31.84c0-7.72 2.76-14.99 8.27-21.81 5.52-6.82 12.44-10.97 20.77-12.46.22 1.3.33 2.45.33 3.44 0 7.6-2.94 15.02-8.83 22.25-5.88 7.23-12.83 11.23-20.85 12.01-.11-1.12-.17-2.13-.17-3.43z" />
    </svg>
  );
}

function Phone({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`relative rounded-[42px] bg-[#0d1512] p-[9px] shadow-[0_40px_80px_-30px_rgb(15_35_30/0.55),inset_0_0_0_1.5px_rgb(255_255_255/0.08)] ${className}`}
    >
      <div
        className="relative overflow-hidden rounded-[34px] bg-[#f4f6f2]"
        style={{ aspectRatio: "390 / 844" }}
      >
        <Image
          src={asset(src)}
          alt={alt}
          fill
          sizes="(max-width: 768px) 70vw, 300px"
          className="object-cover object-top"
          priority={priority}
        />
        <span
          aria-hidden
          className="absolute left-1/2 top-2.5 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-[#0d1512]"
        />
      </div>
    </div>
  );
}

export function AppSection({ lang }: { lang: Lang }) {
  const t = T[lang];
  const ar = lang === "ar";

  return (
    <section
      id="app"
      aria-labelledby="app-title"
      className="relative scroll-mt-20 overflow-hidden border-t border-line bg-deep py-16 text-white lg:py-24"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_85%_10%,rgb(224_173_98/0.18),transparent_60%),radial-gradient(60%_70%_at_0%_100%,rgb(56_132_96/0.45),transparent_60%)]"
      />

      <div className="relative mx-auto grid max-w-[1320px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:px-8">
        <div>
          {/* Eyebrow & Platform Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Eyebrow className="text-sand">
              <Smartphone size={15} className="me-2 inline -translate-y-px" aria-hidden />
              {t.eyebrow}
            </Eyebrow>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 border border-emerald-400/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {t.androidPill}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
              <Clock size={11} />
              {t.iosPill}
            </span>
          </div>

          <h2
            id="app-title"
            className={`mt-4 font-serif text-[36px] font-semibold tracking-[-0.015em] text-balance sm:text-[48px] ${
              ar ? "leading-[1.3]" : "leading-[1.06]"
            }`}
          >
            {t.title[0]}
            <span className="text-sand">{t.title[1]}</span>
            {t.title[2]}
          </h2>

          <p
            className={`mt-4 max-w-[580px] text-[17px] text-white/80 ${
              ar ? "leading-[1.9]" : "leading-[1.6]"
            }`}
          >
            {t.intro}
          </p>

          {/* Platform Capability Pills */}
          <div className="mt-6 flex flex-wrap gap-2">
            {t.badges.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[12.5px] font-medium text-white/90"
              >
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                {b}
              </span>
            ))}
          </div>

          {/* 4 Feature Columns */}
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {t.features.map(({ icon: I, title, text }) => (
              <li key={title} className="flex gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sand ring-1 ring-white/15">
                  <I size={19} />
                </span>
                <span>
                  <span className="block text-[15.5px] font-semibold">{title}</span>
                  <span
                    className={`mt-0.5 block text-[14px] text-white/65 ${
                      ar ? "leading-[1.8]" : "leading-snug"
                    }`}
                  >
                    {text}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {/* Platform Download Actions: Android Prominent + iOS Coming Soon */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {/* Android Card (Live & Highlighted) */}
            <a
              href={APK_URL}
              download
              className="group relative flex flex-col justify-between rounded-2xl bg-white p-5 text-deep shadow-[0_20px_45px_-15px_rgb(0_0_0/0.5)] ring-2 ring-emerald-400 transition-all hover:-translate-y-1 hover:shadow-[0_25px_55px_-15px_rgb(0_0_0/0.7)]"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3ddc84] text-[#0d2a1d] shadow-sm">
                      <AndroidIcon size={22} />
                    </span>
                    <span className="text-[12px] font-bold uppercase tracking-wider text-emerald-800">
                      Android
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    {t.androidBadge}
                  </span>
                </div>

                <div className="mt-4">
                  <span className="block font-serif text-[18px] font-bold text-deep leading-snug">
                    {t.androidTitle}
                  </span>
                  <span className="mt-1 block text-[12.5px] text-body">
                    {t.androidSubtitle}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                <span className="text-[11.5px] font-medium text-emerald-800">
                  {t.androidOffline}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-deep text-white group-hover:bg-deep-hover transition-colors">
                  <Download size={14} />
                </span>
              </div>
            </a>

            {/* iOS Card (Coming Soon) */}
            <div className="relative flex flex-col justify-between rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-md shadow-sm">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white shadow-sm ring-1 ring-white/30">
                      <AppleIcon size={20} />
                    </span>
                    <span className="text-[12px] font-bold uppercase tracking-wider text-white/80">
                      iOS &amp; iPadOS
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                    <Clock size={11} />
                    {t.iosBadge}
                  </span>
                </div>

                <div className="mt-4">
                  <span className="block font-serif text-[18px] font-bold text-white leading-snug">
                    {t.iosTitle}
                  </span>
                  <span className="mt-1 block text-[12.5px] text-white/70">
                    {t.iosSubtitle}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-[11.5px] font-medium text-white/60">
                  {t.iosNote}
                </span>
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/90">
                  TestFlight
                </span>
              </div>
            </div>
          </div>

          <p className="mt-6 text-[12.5px] text-white/50">{t.note}</p>
        </div>

        {/* 3 Mockup Phones Display */}
        <div className="relative mx-auto flex w-full max-w-[640px] items-end justify-center gap-0">
          <Phone
            src={t.shots[0].src}
            alt={t.shots[0].alt}
            className="z-10 w-[44%] -me-[8%] translate-y-6 rotate-[-6deg] max-sm:hidden"
          />
          <Phone
            src={t.shots[1].src}
            alt={t.shots[1].alt}
            className="z-20 w-[62%] sm:w-[46%]"
            priority
          />
          <Phone
            src={t.shots[2].src}
            alt={t.shots[2].alt}
            className="z-10 w-[44%] -ms-[8%] translate-y-6 rotate-[6deg] max-sm:hidden"
          />
        </div>
      </div>
    </section>
  );
}
