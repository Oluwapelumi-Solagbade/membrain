"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  HeartHandshake,
  Info,
  Languages,
  MapPin,
  MessageSquareHeart,
  Phone,
  Printer,
  Shield,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  User,
  Users,
} from "lucide-react";
import { Mark } from "../Logo";
import type { Lang } from "@/lib/mb";

const T = {
  en: {
    back: "Back",
    badge: "MyLife Add-on",
    comingSoon: "Coming Soon in Next Pilot Release",
    headline: "Person-Centred Life Story & Quick Care Card",
    subheadline:
      "Bridging clinical assessment with dignity. Preserves the person's identity, daily rhythms, and distress-reduction strategies for hospital staff and caregivers.",
    whyTitle: "Why MyLife Matters in Dementia & Brain Health",
    whyBody:
      "When individuals with cognitive decline are hospitalized or meet new caregivers, disorientation and unfamiliar environments frequently trigger delirium and acute agitation. MyLife provides hospital staff and respite carers with an immediate, compassionate understanding of who the person is and how to keep them calm.",
    tabs: {
      story: "1. Life Story",
      rhythms: "2. Daily Rhythms",
      card: "3. Quick Care Card",
    },
    storyTitle: "Life Background & Meaningful Memories",
    storyDesc: "Key milestones, cultural roots, and lifetime passions that ground the person.",
    rhythmsTitle: "Daily Rhythms & Comfort Measures",
    rhythmsDesc: "Familiar daily routines, comforting foods, sensory anchors, and calming music.",
    cardTitle: "Quick Care Card (Hospital & Emergency Pocket Summary)",
    cardDesc: "What clinical and care teams must know immediately to prevent distress and agitation.",
    distressHeader: "What May Trigger Distress or Disorientation",
    comfortHeader: "What Soothes, Reassures & Grounds Me",
    advocateHeader: "Primary Family Supporter & Care Advocate",
    printBtn: "Print Quick Care Card (Coming Soon)",
    statusNote:
      "The MyLife module specification is active in MemBrain clinical documentation (Module Add-on) and will unlock full digital authoring and EHR synchronization in the upcoming trial cohort.",
  },
  ar: {
    back: "رجوع",
    badge: "إضافة MyLife",
    comingSoon: "قريبًا ضمن المرحلة التجريبية القادمة",
    headline: "قصة الحياة الشخصية وبطاقة الرعاية السريعة",
    subheadline:
      "الربط بين التقييم السريري وكرامة الإنسان. حفظ هوية الشخص، روتينه اليومي، واستراتيجيات تهدئته لطواقم المستشفيات ومقدمي الرعاية.",
    whyTitle: "أهمية MyLife في صحة الدماغ ورعاية الذاكرة",
    whyBody:
      "عند تنويم كبار السن ذوي التغير الإدراكي في المستشفى أو لقائهم بمقدمي رعاية جدد، تسبب البيئة غير المألوفة التشوّش والهلع أحيانًا. تمنح بطاقة MyLife طواقم التمريض والمستشفى نظرة فورية رحيمة حول من يكون المريض وكيفية الحفاظ على سكينته وطمأنينته.",
    tabs: {
      story: "١. قصة حياتي",
      rhythms: "٢. الروتين اليومي",
      card: "٣. بطاقة الرعاية السريعة",
    },
    storyTitle: "محطات الحياة والذكريات القريبة إلى القلب",
    storyDesc: "الجذور والمهنة والشغف والأشخاص المهمون الذين يشعرون الشخص بالأمان.",
    rhythmsTitle: "الإيقاع اليومي ومصادر السكينة",
    rhythmsDesc: "العادات الصباحية، الأطعمة المفضلة، الأصوات المألوفة، والمشتتات المهدئة.",
    cardTitle: "بطاقة الرعاية السريعة (لطوارئ المستشفى وأقسام التنويم)",
    cardDesc: "ما يلزم الطواقم الطبية معرفته فورًا لتجنب القلق أو الانفعال الحاد.",
    distressHeader: "ما قد يسبب لي القلق أو الانزعاج",
    comfortHeader: "ما يهدئني ويشعرني بالطمأنينة والأمان",
    advocateHeader: "المرافق العائلي الرئيسي وممثل الرعاية",
    printBtn: "طباعة بطاقة الرعاية (قريبًا)",
    statusNote:
      "مواصفة MyLife معتمدة في الوثائق السريرية لـ MemBrain وسيتم تفعيل الإدخال الرقمي المباشر ومزامنتها مع السجلات الصحية في مرحلة الإطلاق القادمة.",
  },
};

export function MyLifeView() {
  const params = useSearchParams();
  const pid = params.get("id") || "MB-1041";
  const initialLang: Lang = params.get("lang") === "ar" ? "ar" : "en";
  const [lang, setLang] = useState<Lang>(initialLang);
  const [activeTab, setActiveTab] = useState<"story" | "rhythms" | "card">("card");

  const t = T[lang];

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="min-h-dvh bg-paper">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href={lang === "ar" ? "/ar/" : "/"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-mist"
              aria-label={t.back}
            >
              <ArrowLeft size={20} className="rtl:-scale-x-100" />
            </Link>
            <Mark className="h-8 w-auto" />
            <div className="hidden sm:block">
              <p className="text-[14.5px] font-semibold text-ink leading-tight">MemBrain MyLife</p>
              <p className="text-[12px] text-muted leading-tight">{t.headline}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-mist p-1" role="group" aria-label="Language">
              {(["en", "ar"] as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`rounded-full px-2.5 py-1 text-[13px] font-medium transition-colors ${
                    lang === l ? "bg-white text-deep shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {l === "en" ? "English" : "عربي"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 sm:py-10">
        {/* Hero Banner with Coming Soon Pill */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-white to-emerald-50/60 p-6 sm:p-8 shadow-[0_4px_20px_-10px_rgb(217_119_6/0.2)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100/80 px-3 py-1 text-[12.5px] font-bold text-amber-900">
              <Sparkles size={14} className="text-amber-700" />
              {t.comingSoon}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-deep/10 px-2.5 py-1 text-[12px] font-medium text-deep">
              <HeartHandshake size={13} /> {t.badge}
            </span>
            <span className="text-[12.5px] font-mono text-muted">ID: {pid}</span>
          </div>

          <h1 className="mt-3 font-serif text-[28px] font-semibold tracking-[-0.015em] text-ink sm:text-[36px]">
            {t.headline}
          </h1>
          <p className="mt-2 max-w-[800px] text-[16px] leading-relaxed text-body">{t.subheadline}</p>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-amber-200/60 pt-5">
            <button
              type="button"
              onClick={() => setActiveTab("card")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14.5px] font-semibold transition-all ${
                activeTab === "card"
                  ? "bg-deep text-white shadow-md shadow-deep/20"
                  : "bg-white/80 text-ink hover:bg-white border border-line"
              }`}
            >
              <Shield size={16} />
              {t.tabs.card}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("story")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14.5px] font-semibold transition-all ${
                activeTab === "story"
                  ? "bg-deep text-white shadow-md shadow-deep/20"
                  : "bg-white/80 text-ink hover:bg-white border border-line"
              }`}
            >
              <User size={16} />
              {t.tabs.story}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("rhythms")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14.5px] font-semibold transition-all ${
                activeTab === "rhythms"
                  ? "bg-deep text-white shadow-md shadow-deep/20"
                  : "bg-white/80 text-ink hover:bg-white border border-line"
              }`}
            >
              <Clock size={16} />
              {t.tabs.rhythms}
            </button>
          </div>
        </div>

        {/* Tab 1: Quick Care Card */}
        {activeTab === "card" && (
          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-[22px] font-semibold text-ink">{t.cardTitle}</h2>
                <p className="mt-1 text-[14.5px] text-muted">{t.cardDesc}</p>
              </div>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-[14px] font-medium text-muted opacity-80 cursor-not-allowed shadow-sm"
              >
                <Printer size={16} /> {t.printBtn}
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* What causes distress */}
              <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm">
                <div className="flex items-center gap-2.5 text-rose-800">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                    <ShieldAlert size={19} />
                  </span>
                  <h3 className="text-[17px] font-bold">{t.distressHeader}</h3>
                </div>
                <ul className="mt-4 space-y-2.5 text-[14.5px] leading-relaxed text-ink">
                  <li className="flex items-start gap-2">
                    <span className="text-rose-600 font-bold">•</span>
                    <span>
                      {lang === "ar"
                        ? "الأصوات الحادة المفاجئة وأجهزة الإنذار الطبية الصاخبة."
                        : "Sudden sharp clinical alarms and high-volume background beeps."}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-600 font-bold">•</span>
                    <span>
                      {lang === "ar"
                        ? "التحدث باللغة الإنجليزية بسرعة ودون النظر في الوجه أو التمهيد."
                        : "Fast speech in unfamiliar languages without facing the person or gentle eye contact."}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-600 font-bold">•</span>
                    <span>
                      {lang === "ar"
                        ? "الإجراءات الطبية أو اللمس المفاجئ دون شرح هادئ مسبق."
                        : "Abrupt physical contact or vital checks without calm advance explanation."}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-600 font-bold">•</span>
                    <span>
                      {lang === "ar"
                        ? "البقاء في غرفة معتمة أو غير مألوفة بمفرده."
                        : "Being left alone in a darkened or confusing clinical space."}
                    </span>
                  </li>
                </ul>
              </div>

              {/* What comforts */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
                <div className="flex items-center gap-2.5 text-emerald-800">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Heart size={19} />
                  </span>
                  <h3 className="text-[17px] font-bold">{t.comfortHeader}</h3>
                </div>
                <ul className="mt-4 space-y-2.5 text-[14.5px] leading-relaxed text-ink">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>
                      {lang === "ar"
                        ? "التحدث بلهجة إماراتية/خليجية هادئة وبنبرة دافئة بطيئة."
                        : "Speaking in calm, slow Gulf Arabic with a reassuring, unhurried tone."}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>
                      {lang === "ar"
                        ? "وجود المرافق العائلي في مجال الرؤية المباشر."
                        : "Having the designated family supporter visible in the room."}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>
                      {lang === "ar"
                        ? "إمساك السبحة أو الاستماع لتلاوة مهدئة أو صوت مألوف."
                        : "Holding prayer beads or listening to soothing recitations and familiar heritage audio."}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>
                      {lang === "ar"
                        ? "شرب شاي دافئ خفيف بالهيل والزعفران."
                        : "Warm light tea with cardamom/saffron in a familiar cup."}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Advocate Card */}
            <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-deep/10 text-deep">
                  <Users size={20} />
                </span>
                <div>
                  <h3 className="text-[16px] font-semibold text-ink">{t.advocateHeader}</h3>
                  <p className="text-[13px] text-muted">
                    {lang === "ar" ? "الشخص المخوّل والمعتمد للتواصل الطبي السريع" : "Designated proxy for clinical clarification"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-paper p-3 text-[14px]">
                  <span className="block text-[12px] font-medium text-muted">
                    {lang === "ar" ? "الاسم والصلة" : "Name & Relationship"}
                  </span>
                  <span className="font-semibold text-ink">{lang === "ar" ? "مريم (الابنة)" : "Mariam (Daughter)"}</span>
                </div>
                <div className="rounded-xl bg-paper p-3 text-[14px]">
                  <span className="block text-[12px] font-medium text-muted">
                    {lang === "ar" ? "الهاتف" : "Telephone"}
                  </span>
                  <span className="font-mono font-semibold text-ink">+971 50 ••• 1203</span>
                </div>
                <div className="rounded-xl bg-paper p-3 text-[14px]">
                  <span className="block text-[12px] font-medium text-muted">
                    {lang === "ar" ? "المستشفى المتابع" : "Assigned Clinic"}
                  </span>
                  <span className="font-semibold text-ink">{lang === "ar" ? "مستشفى توام، العين" : "Tawam Hospital, Al Ain"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Life Story */}
        {activeTab === "story" && (
          <div className="mt-8 space-y-6">
            <div>
              <h2 className="text-[22px] font-semibold text-ink">{t.storyTitle}</h2>
              <p className="mt-1 text-[14.5px] text-muted">{t.storyDesc}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-white p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mist text-deep">
                  <MapPin size={18} />
                </span>
                <h3 className="mt-3 text-[16.5px] font-semibold text-ink">
                  {lang === "ar" ? "الجذور والأماكن ذات المعنى" : "Roots & Meaningful Places"}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-body">
                  {lang === "ar"
                    ? "نشأت في واحات مدينة العين، وترتبط بذكريات عائلية واسعة حول الزراعة والنخيل واللقاءات الأسرية في المجلس."
                    : "Raised in the oasis groves of Al Ain; deeply connected to memories of family date farming and gatherings in the community majlis."}
                </p>
              </div>

              <div className="rounded-2xl border border-line bg-white p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mist text-deep">
                  <Languages size={18} />
                </span>
                <h3 className="mt-3 text-[16.5px] font-semibold text-ink">
                  {lang === "ar" ? "اللغة واللهجة المفضلة" : "Preferred Dialect & Greeting"}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-body">
                  {lang === "ar"
                    ? "اللهجة الإماراتية التراثية. تفضل المناداة بلقب (أم محمد) والتحية بالسلام والدعاء الطيب."
                    : "Emirati heritage dialect. Prefers being greeted respectfully as 'Umm Mohammed' with traditional warm greetings."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Daily Rhythms */}
        {activeTab === "rhythms" && (
          <div className="mt-8 space-y-6">
            <div>
              <h2 className="text-[22px] font-semibold text-ink">{t.rhythmsTitle}</h2>
              <p className="mt-1 text-[14.5px] text-muted">{t.rhythmsDesc}</p>
            </div>

            <div className="rounded-2xl border border-line bg-white p-5 space-y-4">
              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sand/30 text-deep">
                  <Clock size={16} />
                </span>
                <div>
                  <h4 className="text-[15.5px] font-semibold text-ink">
                    {lang === "ar" ? "الصباح الباكر (٦:٠٠ - ٨:٣٠ ص)" : "Early Morning (6:00 - 8:30 AM)"}
                  </h4>
                  <p className="text-[14px] text-body mt-0.5">
                    {lang === "ar"
                      ? "صلاة الفجر، وقت هادئ، وشاي بالهيل مع خبز رقاق. تفضل عدم التحدث بالهاتف أو إجراء تحاليل مفاجئة قبل الإفطار."
                      : "Fajr quiet time, light tea with cardamom. Prefers no loud commotion or clinical testing before morning breakfast."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-line/60 pt-4">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sand/30 text-deep">
                  <Clock size={16} />
                </span>
                <div>
                  <h4 className="text-[15.5px] font-semibold text-ink">
                    {lang === "ar" ? "فترة العصر والمغرب" : "Late Afternoon & Maghrib"}
                  </h4>
                  <p className="text-[14px] text-body mt-0.5">
                    {lang === "ar"
                      ? "استراحة هادئة في الحديقة أو الشرفة. يساهم البخور الخفيف ووجود أحد الأبناء في منع متلازمة الغروب والتشوّش المسائي."
                      : "Quiet time on the patio. Light oud aroma and family presence help prevent sundowning confusion."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Clinical Note Footer */}
        <div className="mt-10 rounded-2xl border border-black/[0.08] bg-[#f2f4ef] p-4 text-[13.5px] leading-relaxed text-muted flex items-start gap-3">
          <Info size={18} className="shrink-0 text-leaf mt-0.5" />
          <p>{t.statusNote}</p>
        </div>
      </main>
    </div>
  );
}
