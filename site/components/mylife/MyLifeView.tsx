"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  Heart,
  HeartHandshake,
  Info,
  Languages,
  MessageCircle,
  Music,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { Mark } from "../Logo";
import type { Lang } from "@/lib/mb";

/* ─────────────────────────── copy ─────────────────────────── */

const T = {
  en: {
    back: "Back",
    badge: "Coming Soon · Next Pilot Release",
    headline: "MyLife Profile",
    tagline: "Person-centred care, built around who you are.",
    subheadline:
      "For individuals who need ongoing support — particularly those with functional difficulties or an established diagnosis — MemBrain offers an optional personal life-story and care-preference profile.",
    who: "Who is it for?",
    whoBody:
      "MyLife is designed for participants already on the MemBrain programme who would benefit from a richer, more personal layer of care coordination — shared only with their consent.",

    sectionInputs: "What goes into your profile",
    sectionInputsSub:
      "You or an authorised representative provides the information. AI never invents biographical details — every piece of information remains attributed to its source.",
    inputs: [
      { icon: User,          title: "Personal background & identity",     body: "Who you are, your heritage, cultural background, and what matters most to you." },
      { icon: Languages,     title: "Preferred name & language",          body: "What you like to be called, your preferred language or dialect, and how you like to be greeted." },
      { icon: Users,         title: "Important relationships",            body: "Family members, close friends, and the people whose presence brings you comfort and security." },
      { icon: Briefcase,     title: "Previous occupation & interests",    body: "Your working life, hobbies, passions, and the activities that have shaped who you are." },
      { icon: Clock,         title: "Daily routines",                     body: "Morning habits, mealtimes, rest patterns, prayers, and the rhythms that keep you grounded." },
      { icon: MessageCircle, title: "Communication preferences",          body: "How you prefer to receive information — pace, tone, language, eye contact, and written summaries." },
      { icon: Music,         title: "Activities that provide comfort",    body: "Music, prayer, crafts, nature, familiar objects, and anything that calms or reassures you." },
      { icon: ShieldAlert,   title: "Known distress triggers",            body: "Situations, sounds, environments, or interactions that cause anxiety or disorientation." },
      { icon: Heart,         title: "Care preferences",                   body: "How you want decisions made, who you want involved, and what good care looks and feels like to you." },
    ],

    sectionOutputs: "Three things it creates",
    sectionOutputsSub:
      "Your profile generates three distinct outputs — each tailored to a different audience and purpose.",
    outputs: [
      {
        num: "01",
        icon: BookOpen,
        title: "My Life Story",
        color: "amber",
        desc: "A fuller personal narrative written in your own voice — capturing your history, relationships, and what makes you, you. Shared with carers who want to know you as a person, not just a patient.",
        audience: "For carers, family, and community support",
      },
      {
        num: "02",
        icon: FileText,
        title: "My Care Profile",
        color: "sky",
        desc: "A practical summary for clinical teams and professional caregivers. Covers routines, communication needs, comfort measures, and distress triggers in a structured format that integrates with care planning.",
        audience: "For clinicians, nurses & care coordinators",
      },
      {
        num: "03",
        icon: Shield,
        title: "Quick Care Card",
        color: "emerald",
        desc: "A concise, at-a-glance guide for anyone interacting with you — in hospital, respite, or day care. Fits a pocket or bedside clipboard. Designed to prevent distress during unfamiliar encounters.",
        audience: "For hospital staff, emergency & respite teams",
      },
    ],

    sectionPrivacy: "Privacy & consent",
    privacyPoints: [
      { icon: UserCheck,  text: "You or your authorised representative reviews and approves the profile before anything is shared." },
      { icon: ShieldCheck,text: "Every piece of information remains attributed to its source — AI never invents biographical details." },
      { icon: Globe,      text: "You choose exactly who can see each output — family only, clinical team, or both." },
      { icon: Zap,        text: "You can update or withdraw your profile at any time. No trace is left on shared devices." },
    ],

    cta: "Notify me when MyLife launches",
    ctaSub: "We'll let you know when this add-on is available in the MemBrain programme.",
    ctaBtn: "Back to MemBrain",
    statusNote:
      "MyLife is specified in MemBrain clinical documentation as a Module Add-on. Full digital authoring, participant review workflow, and EHR synchronisation will launch in the upcoming trial cohort.",
    switchLabel: "عربي",
    switchLang: "ar" as Lang,
  },

  ar: {
    back: "رجوع",
    badge: "قريبًا · المرحلة التجريبية القادمة",
    headline: "ملف MyLife",
    tagline: "رعاية شخصية مبنية على هويتك وقصتك.",
    subheadline:
      "للأفراد الذين يحتاجون إلى دعم مستمر — ولا سيما من يعانون من صعوبات وظيفية أو تشخيص محدد — يتيح MemBrain ملفًا شخصيًا اختياريًا يضم قصة حياتك وتفضيلات رعايتك.",
    who: "لمن هذا الملف؟",
    whoBody:
      "صُمِّم MyLife للمشاركين المسجّلين في برنامج MemBrain ممن يستفيدون من طبقة أعمق وأكثر شخصية من تنسيق الرعاية — ولا يُشارَك إلا بموافقتهم الصريحة.",

    sectionInputs: "ما الذي يتضمنه ملفك",
    sectionInputsSub:
      "تقدّم أنت أو ممثلك المفوّض المعلومات. لا يخترع الذكاء الاصطناعي أي تفاصيل شخصية — كل معلومة تبقى منسوبة إلى مصدرها.",
    inputs: [
      { icon: User,          title: "الخلفية الشخصية والهوية",         body: "من أنت، تراثك، خلفيتك الثقافية، وما يهمك أكثر من أي شيء." },
      { icon: Languages,     title: "الاسم المفضل واللغة",             body: "ما تحب أن يناديك به الآخرون، لغتك المفضلة أو لهجتك، وطريقة التحية التي ترتاح إليها." },
      { icon: Users,         title: "العلاقات المهمة",                 body: "أفراد الأسرة والأصدقاء المقرّبون والأشخاص الذين يمنحونك الراحة والأمان." },
      { icon: Briefcase,     title: "المهنة السابقة والاهتمامات",     body: "حياتك المهنية وهواياتك وشغفك والأنشطة التي شكّلت شخصيتك." },
      { icon: Clock,         title: "الروتين اليومي",                  body: "العادات الصباحية، أوقات الوجبات، أوقات الراحة، الصلاة، والإيقاعات التي تمنحك الاستقرار." },
      { icon: MessageCircle, title: "تفضيلات التواصل",                 body: "كيف تفضّل تلقي المعلومات — الوتيرة والنبرة واللغة والتواصل البصري والملخصات الكتابية." },
      { icon: Music,         title: "الأنشطة المهدئة والمريحة",        body: "الموسيقى والصلاة والحرف اليدوية والطبيعة والأشياء المألوفة وكل ما يهدئك ويطمئنك." },
      { icon: ShieldAlert,   title: "المحفزات المعروفة للضائقة",       body: "المواقف والأصوات والبيئات والتفاعلات التي تسبب القلق أو التشوّش." },
      { icon: Heart,         title: "تفضيلات الرعاية",                 body: "كيف تريد اتخاذ القرارات، ومن تريد إشراكه، وكيف تبدو الرعاية الجيدة وتُشعرك بها." },
    ],

    sectionOutputs: "ثلاثة مخرجات يولّدها الملف",
    sectionOutputsSub:
      "يولّد ملفك ثلاثة مخرجات مختلفة — كلٌّ منها مُصمَّم لجمهور وغرض محدد.",
    outputs: [
      {
        num: "٠١",
        icon: BookOpen,
        title: "قصة حياتي",
        color: "amber",
        desc: "سرد شخصي كامل مكتوب بصوتك — يلتقط تاريخك وعلاقاتك وما يجعلك أنت. يُشارَك مع مقدمي الرعاية الذين يريدون معرفتك كإنسان، لا مجرد مريض.",
        audience: "لمقدمي الرعاية والعائلة والدعم المجتمعي",
      },
      {
        num: "٠٢",
        icon: FileText,
        title: "ملف رعايتي",
        color: "sky",
        desc: "ملخص عملي للفرق السريرية ومقدمي الرعاية المحترفين. يغطي الروتين واحتياجات التواصل وإجراءات الراحة ومحفزات الضائقة بتنسيق منظم يتكامل مع تخطيط الرعاية.",
        audience: "للأطباء والممرضين ومنسقي الرعاية",
      },
      {
        num: "٠٣",
        icon: Shield,
        title: "بطاقة الرعاية السريعة",
        color: "emerald",
        desc: "دليل موجز لأي شخص يتفاعل معك — في المستشفى أو الرعاية المؤقتة أو النهارية. يناسب الجيب أو حامل الملفات بجانب السرير. مصمم لمنع الضائقة أثناء اللقاءات غير المألوفة.",
        audience: "لطواقم المستشفى والطوارئ وفرق الرعاية المؤقتة",
      },
    ],

    sectionPrivacy: "الخصوصية والموافقة",
    privacyPoints: [
      { icon: UserCheck,   text: "أنت أو ممثلك المفوّض تراجع الملف وتوافق عليه قبل مشاركة أي شيء." },
      { icon: ShieldCheck, text: "كل معلومة تبقى منسوبة إلى مصدرها — الذكاء الاصطناعي لا يخترع أي تفاصيل شخصية." },
      { icon: Globe,       text: "أنت تختار بالضبط من يمكنه رؤية كل مخرج — الأسرة فقط أو الفريق السريري أو كليهما." },
      { icon: Zap,         text: "يمكنك تحديث ملفك أو سحبه في أي وقت. لا أثر يبقى على الأجهزة المشتركة." },
    ],

    cta: "أبلغني عند إطلاق MyLife",
    ctaSub: "سنُعلمك عندما يصبح هذا الملحق متاحًا في برنامج MemBrain.",
    ctaBtn: "العودة إلى MemBrain",
    statusNote:
      "MyLife محدّد في الوثائق السريرية لـ MemBrain كإضافة وحدة. سيُطلَق التأليف الرقمي الكامل وسير عمل مراجعة المشارك ومزامنة السجلات الصحية في مجموعة التجربة القادمة.",
    switchLabel: "English",
    switchLang: "en" as Lang,
  },
};

const COLOR_MAP: Record<string, { border: string; bg: string; iconBg: string; iconText: string; numText: string; badge: string }> = {
  amber: {
    border: "border-amber-200",
    bg: "from-amber-50/80 to-white",
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
    numText: "text-amber-400",
    badge: "bg-amber-100 text-amber-800",
  },
  sky: {
    border: "border-sky-200",
    bg: "from-sky-50/80 to-white",
    iconBg: "bg-sky-100",
    iconText: "text-sky-700",
    numText: "text-sky-400",
    badge: "bg-sky-100 text-sky-800",
  },
  emerald: {
    border: "border-emerald-200",
    bg: "from-emerald-50/80 to-white",
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-700",
    numText: "text-emerald-400",
    badge: "bg-emerald-100 text-emerald-800",
  },
};

/* ─────────────────────────── component ─────────────────────── */

export function MyLifeView() {
  const params = useSearchParams();
  const initialLang: Lang = params.get("lang") === "ar" ? "ar" : "en";
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = T[lang];
  const isAr = lang === "ar";

  return (
    <div dir={isAr ? "rtl" : "ltr"} lang={lang} className="min-h-dvh bg-[#f7f8f5]">

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-30 border-b border-black/[0.07] bg-white/95 backdrop-blur-xl shadow-[0_1px_12px_-6px_rgb(0_0_0/0.08)]">
        <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href={isAr ? "/ar/" : "/"}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-medium text-ink/70 hover:bg-mist hover:text-ink transition-colors"
              aria-label={t.back}
            >
              <ArrowLeft size={16} className="rtl:-scale-x-100 shrink-0" />
              <span className="hidden sm:inline">{t.back}</span>
            </Link>
            <div className="h-5 w-px bg-line" />
            <Mark className="h-7 w-auto" />
            <span className="hidden sm:inline text-[13.5px] font-semibold text-deep">MyLife</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-800">
              <Sparkles size={12} className="text-amber-600" />
              {t.badge}
            </span>
            <button
              type="button"
              onClick={() => setLang(t.switchLang)}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[13px] font-medium text-deep hover:bg-mist transition-colors shadow-sm"
            >
              <Globe size={13} className="text-leaf" />
              {t.switchLabel}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1140px] px-4 pb-20 pt-10 sm:px-6">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a4a32] via-[#1f5538] to-[#163d29] px-8 py-12 sm:px-12 sm:py-16 shadow-[0_12px_48px_-16px_rgb(10_40_25/0.55)]">
          <div aria-hidden className="pointer-events-none absolute -end-24 -top-24 h-80 w-80 rounded-full bg-white/[0.04] blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -start-16 bottom-0 h-64 w-64 rounded-full bg-amber-400/[0.08] blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute end-1/3 bottom-0 h-48 w-48 rounded-full bg-leaf/[0.06] blur-2xl" />

          <div className="relative max-w-[720px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-3.5 py-1.5 text-[13px] font-bold text-amber-300">
              <Sparkles size={13} />
              {t.badge}
            </span>

            <div className="mt-5 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-sm">
                <HeartHandshake size={26} />
              </span>
              <h1 className="font-serif text-[36px] font-semibold tracking-[-0.02em] text-white sm:text-[48px]">
                {t.headline}
              </h1>
            </div>

            <p className="mt-3 text-[18px] font-medium leading-snug text-amber-200/90 sm:text-[20px]">
              {t.tagline}
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-white/65 sm:text-[16px]">
              {t.subheadline}
            </p>
          </div>
        </div>

        {/* ── Who is it for ── */}
        <div className="mt-6 flex items-start gap-4 rounded-2xl border border-line bg-white p-5 sm:p-6 shadow-sm">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-deep/10 text-deep">
            <UserCheck size={20} />
          </span>
          <div>
            <h2 className="text-[16px] font-semibold text-ink">{t.who}</h2>
            <p className="mt-1 text-[14.5px] leading-relaxed text-body">{t.whoBody}</p>
          </div>
        </div>

        {/* ── What goes in ── */}
        <section className="mt-12">
          <div className="mb-6">
            <h2 className="text-[24px] font-semibold tracking-tight text-ink">{t.sectionInputs}</h2>
            <p className="mt-1.5 max-w-[640px] text-[14.5px] leading-relaxed text-muted">{t.sectionInputsSub}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {t.inputs.map(({ icon: Icon, title, body }, i) => (
              <div
                key={title}
                className="group flex gap-4 rounded-2xl border border-line bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="shrink-0">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ec] text-deep group-hover:bg-deep group-hover:text-white transition-colors">
                    <Icon size={18} />
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-[11px] font-bold text-muted tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-[14.5px] font-semibold leading-snug text-ink">{title}</h3>
                  </div>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-body">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Three outputs ── */}
        <section className="mt-14">
          <div className="mb-6">
            <h2 className="text-[24px] font-semibold tracking-tight text-ink">{t.sectionOutputs}</h2>
            <p className="mt-1.5 max-w-[640px] text-[14.5px] leading-relaxed text-muted">{t.sectionOutputsSub}</p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {t.outputs.map(({ num, icon: Icon, title, color, desc, audience }) => {
              const c = COLOR_MAP[color];
              return (
                <div
                  key={title}
                  className={`relative overflow-hidden rounded-2xl border ${c.border} bg-gradient-to-br ${c.bg} p-6 shadow-sm`}
                >
                  {/* Large watermark number */}
                  <span className={`absolute -end-3 -top-4 font-serif text-[72px] font-bold leading-none ${c.numText} select-none opacity-20`}>
                    {num}
                  </span>

                  <div className="relative">
                    <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${c.iconBg} ${c.iconText}`}>
                      <Icon size={22} />
                    </span>
                    <h3 className="mt-4 text-[18px] font-bold tracking-tight text-ink">{title}</h3>
                    <p className="mt-2.5 text-[14px] leading-relaxed text-body">{desc}</p>
                    <span className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${c.badge}`}>
                      <ChevronRight size={11} className="rtl:-scale-x-100" />
                      {audience}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Privacy & consent ── */}
        <section className="mt-14">
          <h2 className="mb-5 text-[24px] font-semibold tracking-tight text-ink">{t.sectionPrivacy}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {t.privacyPoints.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3.5 rounded-2xl border border-line bg-white p-5 shadow-sm">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-leaf/10 text-leaf">
                  <Icon size={18} />
                </span>
                <p className="text-[14.5px] leading-relaxed text-body">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA / notify banner ── */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 p-8 sm:p-10 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-[520px]">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[12px] font-bold text-amber-800">
                <Sparkles size={12} />
                {t.badge}
              </div>
              <h2 className="text-[22px] font-semibold text-ink">{t.cta}</h2>
              <p className="mt-2 text-[14.5px] text-muted">{t.ctaSub}</p>
            </div>
            <Link
              href={isAr ? "/ar/" : "/"}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-deep px-6 py-3 text-[15px] font-semibold text-white shadow-[0_6px_20px_-8px_rgb(10_63_44/0.6)] hover:bg-deep-hover hover:-translate-y-0.5 transition-all"
            >
              {t.ctaBtn}
              <ArrowRight size={16} className="rtl:-scale-x-100" />
            </Link>
          </div>
        </div>

        {/* ── Status note ── */}
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-black/[0.07] bg-white/80 p-5 text-[13px] leading-relaxed text-muted shadow-sm">
          <Info size={16} className="mt-0.5 shrink-0 text-leaf" />
          <p>{t.statusNote}</p>
        </div>

      </main>
    </div>
  );
}
