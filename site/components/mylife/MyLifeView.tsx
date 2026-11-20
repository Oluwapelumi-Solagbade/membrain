"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Coffee,
  Heart,
  HeartHandshake,
  Info,
  Languages,
  MapPin,
  Moon,
  Music,
  Phone,
  Printer,
  Shield,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Sun,
  Sunrise,
  User,
  Users,
  Zap,
} from "lucide-react";
import { Mark } from "../Logo";
import type { Lang } from "@/lib/mb";

const T = {
  en: {
    back: "Back to Home",
    badge: "MyLife Add-on",
    comingSoon: "Coming Soon — Next Pilot Release",
    headline: "Person-Centred Life Story & Quick Care Card",
    subheadline:
      "Bridging clinical assessment with dignity. Preserving identity, daily rhythms, and distress-reduction strategies for hospital teams and caregivers.",
    whyTitle: "Why MyLife matters",
    whyBody:
      "When people with cognitive decline are hospitalised or meet new carers, unfamiliar environments frequently trigger delirium and acute agitation. MyLife gives hospital staff an immediate, compassionate understanding of who the person is — and how to keep them calm.",
    tabs: {
      story: "1. Life Story",
      rhythms: "2. Daily Rhythms",
      card: "3. Quick Care Card",
    },
    storyTitle: "Life Background & Meaningful Memories",
    storyDesc: "Key milestones, cultural roots, and lifetime passions that ground the person.",
    rhythmsTitle: "Daily Rhythms & Comfort Measures",
    rhythmsDesc: "Familiar daily routines, comforting foods, sensory anchors, and calming moments.",
    cardTitle: "Quick Care Card",
    cardSubtitle: "Hospital & Emergency Pocket Summary",
    cardDesc: "What care teams must know immediately to prevent distress and agitation.",
    distressHeader: "May trigger distress",
    comfortHeader: "Soothes & grounds me",
    advocateHeader: "Primary Care Advocate",
    printBtn: "Print Care Card",
    printSoon: "Coming Soon",
    statusNote:
      "The MyLife module specification is active in MemBrain clinical documentation and will unlock full digital authoring and EHR synchronisation in the upcoming trial cohort.",
    personName: "Fatima Al Mansouri",
    personId: "MB-1041",
    personAge: "74 years",
    personClinic: "Tawam Hospital, Al Ain",
    sectionPerson: "About the Person",
    sectionClinical: "Clinical Context",
    morningLabel: "Early Morning",
    afternoonLabel: "Late Afternoon & Maghrib",
    nightLabel: "Evening & Night",
    morningTime: "6:00 – 8:30 AM",
    afternoonTime: "4:00 – 7:00 PM",
    nightTime: "8:00 – 10:00 PM",
  },
  ar: {
    back: "العودة للرئيسية",
    badge: "إضافة MyLife",
    comingSoon: "قريبًا ضمن المرحلة التجريبية القادمة",
    headline: "قصة الحياة الشخصية وبطاقة الرعاية السريعة",
    subheadline:
      "الربط بين التقييم السريري وكرامة الإنسان. حفظ الهوية والروتين اليومي واستراتيجيات التهدئة لطواقم المستشفيات ومقدمي الرعاية.",
    whyTitle: "لماذا MyLife مهمة",
    whyBody:
      "عند تنويم كبار السن ذوي التغيّر الإدراكي في المستشفى أو لقائهم بمقدمي رعاية جدد، تسبب البيئة غير المألوفة التشوّش والهلع أحيانًا. تمنح بطاقة MyLife طواقم التمريض نظرة فورية رحيمة حول من يكون المريض وكيفية الحفاظ على سكينته.",
    tabs: {
      story: "١. قصة حياتي",
      rhythms: "٢. الروتين اليومي",
      card: "٣. بطاقة الرعاية",
    },
    storyTitle: "محطات الحياة والذكريات القريبة إلى القلب",
    storyDesc: "الجذور والمهنة والشغف والأشخاص المهمون الذين يشعرون الشخص بالأمان.",
    rhythmsTitle: "الإيقاع اليومي ومصادر السكينة",
    rhythmsDesc: "العادات الصباحية، الأطعمة المفضلة، الأصوات المألوفة، والمشتتات المهدئة.",
    cardTitle: "بطاقة الرعاية السريعة",
    cardSubtitle: "ملخص الطوارئ وأقسام التنويم",
    cardDesc: "ما يلزم الطواقم الطبية معرفته فورًا لتجنب القلق أو الانفعال الحاد.",
    distressHeader: "ما قد يسبب القلق",
    comfortHeader: "ما يهدئني ويريحني",
    advocateHeader: "المرافق العائلي الرئيسي",
    printBtn: "طباعة بطاقة الرعاية",
    printSoon: "قريبًا",
    statusNote:
      "مواصفة MyLife معتمدة في الوثائق السريرية لـ MemBrain وسيتم تفعيل الإدخال الرقمي المباشر ومزامنتها مع السجلات الصحية في مرحلة الإطلاق القادمة.",
    personName: "فاطمة المنصوري",
    personId: "MB-1041",
    personAge: "٧٤ عامًا",
    personClinic: "مستشفى توام، العين",
    sectionPerson: "عن الشخص",
    sectionClinical: "السياق السريري",
    morningLabel: "الصباح الباكر",
    afternoonLabel: "فترة العصر والمغرب",
    nightLabel: "المساء والنوم",
    morningTime: "٦:٠٠ – ٨:٣٠ ص",
    afternoonTime: "٤:٠٠ – ٧:٠٠ م",
    nightTime: "٨:٠٠ – ١٠:٠٠ م",
  },
};

const TAB_ICONS = {
  story: BookOpen,
  rhythms: Clock,
  card: Shield,
};

export function MyLifeView() {
  const params = useSearchParams();
  const pid = params.get("id") || "MB-1041";
  const initialLang: Lang = params.get("lang") === "ar" ? "ar" : "en";
  const [lang, setLang] = useState<Lang>(initialLang);
  const [activeTab, setActiveTab] = useState<"card" | "story" | "rhythms">("story");

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
            {/* Coming soon badge */}
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-800">
              <Sparkles size={12} className="text-amber-600" />
              {t.comingSoon}
            </span>
            {/* Language toggle */}
            <div className="flex rounded-full bg-[#eef0eb] p-0.5" role="group" aria-label="Language">
              {(["en", "ar"] as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`rounded-full px-3 py-1 text-[13px] font-medium transition-all ${
                    lang === l ? "bg-white text-deep shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {l === "en" ? "EN" : "عربي"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1140px] px-4 pb-16 pt-8 sm:px-6">

        {/* ── Hero section ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a4a32] via-[#1f5538] to-[#163d29] p-8 sm:p-10 shadow-[0_8px_40px_-12px_rgb(10_40_25/0.5)]">
          {/* Background decorative blobs */}
          <div aria-hidden className="pointer-events-none absolute -end-20 -top-20 h-72 w-72 rounded-full bg-white/[0.04] blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -start-16 bottom-0 h-56 w-56 rounded-full bg-amber-400/[0.07] blur-2xl" />

          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1 text-[12.5px] font-bold text-amber-300">
                <Sparkles size={12} />
                {t.comingSoon}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-medium text-white/80">
                <HeartHandshake size={12} />
                {t.badge}
              </span>
            </div>

            <h1 className="mt-5 font-serif text-[30px] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[40px]">
              {t.headline}
            </h1>
            <p className="mt-3 max-w-[680px] text-[15.5px] leading-relaxed text-white/70">
              {t.subheadline}
            </p>

            {/* Person preview card */}
            <div className="mt-8 inline-flex flex-wrap items-center gap-4 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-amber-300">
                <User size={22} />
              </div>
              <div>
                <p className="text-[16px] font-semibold text-white">{t.personName}</p>
                <p className="text-[13px] text-white/60">{t.personAge} · {t.personClinic}</p>
              </div>
              <div className="h-8 w-px bg-white/15 hidden sm:block" />
              <span className="font-mono text-[12px] text-white/50">{t.personId}</span>
            </div>
          </div>
        </div>

        {/* ── Why MyLife matters ── */}
        <div className="mt-6 rounded-2xl border border-amber-200/60 bg-amber-50/70 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200/60 text-amber-800">
              <Info size={20} />
            </span>
            <div>
              <h2 className="text-[16px] font-semibold text-amber-900">{t.whyTitle}</h2>
              <p className="mt-1 text-[14.5px] leading-relaxed text-amber-800/80">{t.whyBody}</p>
            </div>
          </div>
        </div>

        {/* ── Tab navigation ── */}
        <div className="mt-8 flex gap-2 overflow-x-auto pb-1" role="tablist">
          {(["story", "rhythms", "card"] as const).map((tab) => {
            const Icon = TAB_ICONS[tab];
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold transition-all ${
                  isActive
                    ? "bg-deep text-white shadow-[0_4px_16px_-6px_rgb(10_63_44/0.5)]"
                    : "bg-white text-ink/70 border border-line hover:border-leaf/30 hover:bg-[#f0f4ee] hover:text-ink"
                }`}
              >
                <Icon size={15} />
                {t.tabs[tab]}
              </button>
            );
          })}
        </div>

        {/* ── Tab: Quick Care Card ── */}
        {activeTab === "card" && (
          <div className="mt-6 space-y-5" role="tabpanel">
            {/* Card header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[22px] font-semibold text-ink">{t.cardTitle}</h2>
                <p className="mt-0.5 text-[14px] text-muted">{t.cardSubtitle} · {t.cardDesc}</p>
              </div>
              <button
                type="button"
                disabled
                title={t.printSoon}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-[13.5px] font-medium text-muted cursor-not-allowed opacity-70 shadow-sm"
              >
                <Printer size={15} />
                {t.printBtn}
                <span className="rounded-full bg-mist px-1.5 py-0.5 text-[10px] font-bold text-muted uppercase">{t.printSoon}</span>
              </button>
            </div>

            {/* Distress / Comfort grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Distress card */}
              <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                    <ShieldAlert size={20} />
                  </span>
                  <h3 className="text-[16.5px] font-bold text-rose-900">{t.distressHeader}</h3>
                </div>
                <ul className="mt-4 space-y-3">
                  {(isAr ? [
                    "الأصوات الحادة المفاجئة وأجهزة الإنذار الطبية الصاخبة.",
                    "التحدث بسرعة بالإنجليزية دون النظر في الوجه أو التمهيد.",
                    "الإجراءات الطبية أو اللمس المفاجئ دون شرح هادئ مسبق.",
                    "البقاء في غرفة معتمة أو غير مألوفة بمفرده.",
                  ] : [
                    "Sudden sharp clinical alarms and high-volume background beeps.",
                    "Fast speech in unfamiliar languages without facing the person.",
                    "Abrupt physical contact or vital checks without calm advance explanation.",
                    "Being left alone in a darkened or confusing clinical space.",
                  ]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-rose-900/80">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Comfort card */}
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Heart size={20} />
                  </span>
                  <h3 className="text-[16.5px] font-bold text-emerald-900">{t.comfortHeader}</h3>
                </div>
                <ul className="mt-4 space-y-3">
                  {(isAr ? [
                    "التحدث بلهجة إماراتية/خليجية هادئة وبنبرة دافئة بطيئة.",
                    "وجود المرافق العائلي في مجال الرؤية المباشر.",
                    "إمساك السبحة أو الاستماع لتلاوة مهدئة أو صوت مألوف.",
                    "شاي دافئ خفيف بالهيل والزعفران في فنجان مألوف.",
                  ] : [
                    "Speaking in calm, slow Gulf Arabic with a reassuring tone.",
                    "Having the designated family supporter visible in the room.",
                    "Holding prayer beads or listening to familiar heritage audio.",
                    "Warm light tea with cardamom and saffron in a familiar cup.",
                  ]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-emerald-900/80">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Family advocate card */}
            <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-deep/10 text-deep">
                  <Users size={20} />
                </span>
                <div>
                  <h3 className="text-[16px] font-semibold text-ink">{t.advocateHeader}</h3>
                  <p className="text-[13px] text-muted">
                    {isAr ? "الشخص المخوّل للتواصل الطبي السريع" : "Designated proxy for clinical clarification"}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: isAr ? "الاسم والصلة" : "Name & Relationship",
                    value: isAr ? "مريم (الابنة)" : "Mariam (Daughter)",
                    icon: User,
                  },
                  {
                    label: isAr ? "الهاتف" : "Telephone",
                    value: "+971 50 ••• 1203",
                    icon: Phone,
                    mono: true,
                  },
                  {
                    label: isAr ? "المستشفى المتابع" : "Assigned Clinic",
                    value: isAr ? "مستشفى توام، العين" : "Tawam Hospital, Al Ain",
                    icon: Stethoscope,
                  },
                ].map(({ label, value, icon: Icon, mono }) => (
                  <div key={label} className="flex items-start gap-3 rounded-xl bg-[#f4f6f3] p-3.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-deep shadow-sm">
                      <Icon size={14} />
                    </span>
                    <div>
                      <span className="block text-[11.5px] font-medium uppercase tracking-wide text-muted">{label}</span>
                      <span className={`block text-[14px] font-semibold text-ink ${mono ? "font-mono" : ""}`}>{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Life Story ── */}
        {activeTab === "story" && (
          <div className="mt-6 space-y-5" role="tabpanel">
            <div>
              <h2 className="text-[22px] font-semibold text-ink">{t.storyTitle}</h2>
              <p className="mt-1 text-[14px] text-muted">{t.storyDesc}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: MapPin,
                  color: "bg-sky-50 border-sky-200",
                  iconBg: "bg-sky-100 text-sky-700",
                  title: isAr ? "الجذور والأماكن ذات المعنى" : "Roots & Meaningful Places",
                  body: isAr
                    ? "نشأت في واحات مدينة العين، وترتبط بذكريات عائلية واسعة حول الزراعة والنخيل واللقاءات الأسرية في المجلس."
                    : "Raised in the oasis groves of Al Ain; deeply connected to memories of family date farming and community gatherings in the majlis.",
                },
                {
                  icon: Languages,
                  color: "bg-violet-50 border-violet-200",
                  iconBg: "bg-violet-100 text-violet-700",
                  title: isAr ? "اللغة واللهجة المفضلة" : "Preferred Dialect & Greeting",
                  body: isAr
                    ? "اللهجة الإماراتية التراثية. تفضل المناداة بلقب (أم محمد) والتحية بالسلام والدعاء الطيب."
                    : "Emirati heritage dialect. Prefers being greeted as 'Umm Mohammed' with traditional warm greetings.",
                },
                {
                  icon: Heart,
                  color: "bg-rose-50 border-rose-200",
                  iconBg: "bg-rose-100 text-rose-700",
                  title: isAr ? "الشغف والاهتمامات" : "Passions & Interests",
                  body: isAr
                    ? "الحياكة التقليدية، زراعة الأعشاب العطرية، والاستماع إلى تلاوات القرآن الكريم مع أحفادها في المساء."
                    : "Traditional weaving, growing aromatic herbs, and listening to Quran recitations with grandchildren in the evenings.",
                },
                {
                  icon: Users,
                  color: "bg-amber-50 border-amber-200",
                  iconBg: "bg-amber-100 text-amber-700",
                  title: isAr ? "الروابط العائلية المهمة" : "Important Family Bonds",
                  body: isAr
                    ? "أم لخمسة أبناء، وجدة لسبعة عشر حفيدًا. مريم ابنتها هي المرجع الأول وأكثرهم قربًا منها."
                    : "Mother of five, grandmother of seventeen. Daughter Mariam is her closest family contact and primary advocate.",
                },
              ].map(({ icon: Icon, color, iconBg, title, body }) => (
                <div key={title} className={`rounded-2xl border p-5 shadow-sm ${color} bg-gradient-to-br`}>
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
                    <Icon size={18} />
                  </span>
                  <h3 className="mt-3 text-[16px] font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-body">{body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: Daily Rhythms ── */}
        {activeTab === "rhythms" && (
          <div className="mt-6 space-y-5" role="tabpanel">
            <div>
              <h2 className="text-[22px] font-semibold text-ink">{t.rhythmsTitle}</h2>
              <p className="mt-1 text-[14px] text-muted">{t.rhythmsDesc}</p>
            </div>

            <div className="space-y-4">
              {[
                {
                  icon: Sunrise,
                  color: "text-amber-600",
                  bg: "bg-amber-50 border-amber-200",
                  iconBg: "bg-amber-100",
                  label: t.morningLabel,
                  time: t.morningTime,
                  body: isAr
                    ? "صلاة الفجر، وقت هادئ، وشاي بالهيل مع خبز رقاق. تفضل عدم التحدث بالهاتف أو إجراء تحاليل مفاجئة قبل الإفطار."
                    : "Fajr quiet time, light tea with cardamom. Prefers no loud commotion or clinical testing before morning breakfast.",
                  tips: isAr
                    ? ["لا تحاليل أو تدخلات طبية قبل الساعة ٨:٣٠ صباحًا", "صوت منخفض وإضاءة خافتة"]
                    : ["No clinical tests before 8:30 AM", "Low noise and dim lighting preferred"],
                },
                {
                  icon: Sun,
                  color: "text-sky-600",
                  bg: "bg-sky-50 border-sky-200",
                  iconBg: "bg-sky-100",
                  label: t.afternoonLabel,
                  time: t.afternoonTime,
                  body: isAr
                    ? "استراحة هادئة في الحديقة أو الشرفة. يساهم البخور الخفيف ووجود أحد الأبناء في منع متلازمة الغروب والتشوّش المسائي."
                    : "Quiet time on the patio. Light oud aroma and family presence help prevent sundowning confusion.",
                  tips: isAr
                    ? ["خطر تشوّش الغروب — احرص على الإضاءة الجيدة", "وجود أحد أفراد الأسرة مفيد جدًا"]
                    : ["Sundowning risk — keep room well-lit", "Family presence strongly recommended"],
                },
                {
                  icon: Moon,
                  color: "text-indigo-600",
                  bg: "bg-indigo-50 border-indigo-200",
                  iconBg: "bg-indigo-100",
                  label: t.nightLabel,
                  time: t.nightTime,
                  body: isAr
                    ? "نوم مبكر مع تلاوة هادئة. تحتاج إلى إضاءة ليلية خفيفة وإبقاء باب الغرفة مواربًا لتجنب الشعور بالعزلة المفاجئة."
                    : "Early sleep with quiet recitation. Needs a gentle nightlight and slightly open door to avoid sudden feelings of isolation.",
                  tips: isAr
                    ? ["إضاءة ليلية خفيفة ضرورية", "باب مفتوح قليلًا لتجنب الشعور بالعزلة"]
                    : ["Gentle nightlight is essential", "Door slightly ajar prevents isolation"],
                },
              ].map(({ icon: Icon, color, bg, iconBg, label, time, body, tips }) => (
                <div key={label} className={`rounded-2xl border p-5 sm:p-6 shadow-sm ${bg}`}>
                  <div className="flex items-start gap-4">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg} ${color}`}>
                      <Icon size={22} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[16px] font-bold text-ink">{label}</h3>
                        <span className="rounded-full bg-white/70 border border-black/[0.07] px-2.5 py-0.5 text-[12px] font-medium text-muted">
                          {time}
                        </span>
                      </div>
                      <p className="mt-2 text-[14.5px] leading-relaxed text-body">{body}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tips.map((tip) => (
                          <span key={tip} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-black/[0.08] px-2.5 py-1 text-[12.5px] text-ink/70">
                            <CheckCircle2 size={12} className={color} />
                            {tip}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Comfort items */}
            <div className="rounded-2xl border border-line bg-white p-5 sm:p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-[16px] font-semibold text-ink">
                <Music size={16} className="text-leaf" />
                {isAr ? "المحفزات الحسية المهدئة" : "Sensory Comfort Anchors"}
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(isAr ? [
                  { icon: Coffee, label: "المشروب المفضل", value: "شاي بالهيل والزعفران" },
                  { icon: Music, label: "الصوت المهدئ", value: "تلاوات هادئة وأناشيد تراثية" },
                  { icon: Zap, label: "رائحة مهدئة", value: "البخور الخفيف والعود" },
                  { icon: Heart, label: "جسم مريح", value: "السبحة وقماش ناعم مألوف" },
                ] : [
                  { icon: Coffee, label: "Favourite drink", value: "Cardamom & saffron tea" },
                  { icon: Music, label: "Soothing sound", value: "Soft recitations & heritage nasheed" },
                  { icon: Zap, label: "Calming scent", value: "Light oud & gentle bakhour" },
                  { icon: Heart, label: "Tactile comfort", value: "Prayer beads & soft familiar fabric" },
                ]).map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl bg-[#f4f6f3] p-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-deep shadow-sm">
                      <Icon size={16} />
                    </span>
                    <div>
                      <span className="block text-[11.5px] font-medium uppercase tracking-wide text-muted">{label}</span>
                      <span className="block text-[14px] font-semibold text-ink">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Status / disclaimer note ── */}
        <div className="mt-10 flex items-start gap-3 rounded-2xl border border-black/[0.07] bg-white/80 p-5 text-[13.5px] leading-relaxed text-muted shadow-sm">
          <Info size={17} className="mt-0.5 shrink-0 text-leaf" />
          <p>{t.statusNote}</p>
        </div>

      </main>
    </div>
  );
}
