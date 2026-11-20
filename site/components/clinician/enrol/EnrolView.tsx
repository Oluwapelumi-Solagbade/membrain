"use client";

import { Suspense, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  HeartPulse,
  Loader2,
  Lock,
  Mic,
  Plus,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UsersRound,
  Volume2,
  X,
} from "lucide-react";
import { PageHeader, btnClass } from "../parts";
import { useWorkspace } from "../WorkspaceProvider";
import { ACTIVITY, label } from "@/lib/labels";
import { config, DEMO_TODAY, EDUCATION_LABEL, type Lang } from "@/lib/mb";
import { speak, stopSpeaking } from "@/lib/voice";
import { caseHref, fmtDate, registeredNameOf } from "@/lib/workspace/derive";
import { NAV } from "@/lib/workspace/navigator";
import { getBackend } from "@/lib/workspace/backend";
import type { Backend, Case, EnrolDone, EnrolIn, InformantChange } from "@/lib/workspace/types";

/* ── Arabic numeral helper ── */
function numAr(n: number | string): string {
  const map: Record<string, string> = { "0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤", "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩", ".": "٫" };
  return String(n).replace(/[0-9.]/g, (d) => map[d] ?? d);
}

function fmtDateLang(iso: string | null | undefined, lang: Lang) {
  if (!iso) return "–";
  try {
    return new Date(iso.slice(0, 10) + "T00:00:00Z").toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return fmtDate(iso);
  }
}

/* ── Bilingual Steps ── */

const STEPS = [
  { key: "concern", title: { en: "Concern and safety", ar: "القلق والسلامة" }, icon: AlertTriangle },
  { key: "identity", title: { en: "Identity", ar: "الهوية" }, icon: Lock },
  { key: "profile", title: { en: "Profile", ar: "الملف التعريفي" }, icon: UserRound },
  { key: "consent", title: { en: "Consent", ar: "الموافقة على البيانات" }, icon: ShieldCheck },
  { key: "informant", title: { en: "Informant", ar: "المبلّغ / المرافق" }, icon: UsersRound },
  { key: "health", title: { en: "Health context", ar: "السياق الصحي" }, icon: HeartPulse },
  { key: "review", title: { en: "Review and schedule", ar: "المراجعة والجدولة" }, icon: ClipboardList },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

const ROUTES: { key: EnrolIn["concern"]["route"]; label: { en: string; ar: string }; sub: { en: string; ar: string } }[] = [
  {
    key: "programme",
    label: { en: "Programme screening", ar: "فحص البرنامج" },
    sub: { en: "Invited by the healthy-ageing programme", ar: "بدعوة من برنامج الشيخوخة الصحية" },
  },
  {
    key: "primary_care",
    label: { en: "Primary care", ar: "الرعاية الأولية" },
    sub: { en: "Referred by a doctor or nurse", ar: "محال من طبيب أو ممرض" },
  },
  {
    key: "family",
    label: { en: "A family member", ar: "أحد أفراد الأسرة" },
    sub: { en: "Raised by someone close to them", ar: "طرحه شخص مقرب منه" },
  },
  {
    key: "household_helper",
    label: { en: "A household helper", ar: "المساعد المنزلي" },
    sub: { en: "Raised by the person who helps at home", ar: "طرحه الشخص المساعد في المنزل" },
  },
  {
    key: "self",
    label: { en: "The person themselves", ar: "الشخص نفسه" },
    sub: { en: "They noticed it and came forward", ar: "لاحظ بنفسه وتقدّم للتقييم" },
  },
];

const ONSET: { key: NonNullable<EnrolIn["concern"]["onset"]>; label: { en: string; ar: string } }[] = [
  { key: "days", label: { en: "Within the last few days", ar: "خلال الأيام القليلة الماضية" } },
  { key: "weeks", label: { en: "Over the last few weeks", ar: "خلال الأسابيع القليلة الماضية" } },
  { key: "months", label: { en: "Over months", ar: "على مدى عدة أشهر" } },
  { key: "years", label: { en: "Over a year or more", ar: "على مدى عام أو أكثر" } },
  { key: "none", label: { en: "No specific concern", ar: "لا يوجد قلق محدد" } },
];

const RED_FLAGS = config.RED_FLAGS as unknown as Record<string, string>;

const RED_FLAGS_MAP: Record<string, { en: string; ar: string }> = {
  sudden_onset: {
    en: "Sudden onset of cognitive symptoms (hours to days)",
    ar: "تغيّر مفاجئ في الأعراض الإدراكية (خلال ساعات إلى أيام)",
  },
  fluctuating_confusion: {
    en: "Fluctuating confusion or consciousness (possible delirium)",
    ar: "تشوّش أو تقلب في الوعي يظهر ويختفي (اشتباه هذيان)",
  },
  new_neuro_symptoms: {
    en: "New focal neurological symptoms (weakness, numbness, speech difficulty, visual disturbance)",
    ar: "أعراض عصبية موضعية جديدة (ضعف، خدر، ثقل بالكلام، أو اضطراب بالرؤية)",
  },
  recent_fall_head_injury: {
    en: "Recent head trauma or unexplained falls",
    ar: "إصابة حديثة في الرأس أو سقوط متكرر غير مبرر",
  },
  rapid_deterioration: {
    en: "Rapid progression of impairment (weeks to short months)",
    ar: "تدهور سريع في القدرات (خلال أسابيع إلى أشهر قليلة)",
  },
  safety_risk: {
    en: "Immediate risk of harm to self or others (severe agitation, wandering into danger, gas left on)",
    ar: "خطر وشيك على سلامة الشخص أو الآخرين (هياج شديد، شرود في خطر، أو ترك الغاز مشتعلًا)",
  },
};

const CONSENT_VERSION = "consent-ar-en-0.1";
const CONSENT: { key: string; title: { en: string; ar: string }; en: string; ar: string; dflt: boolean }[] = [
  {
    key: "voice_features",
    title: { en: "Voice features", ar: "قياسات الصوت" },
    en: "Measurements of how you speak (speed, pauses). Calculated on your phone; the recording itself is not sent.",
    ar: "قياسات لطريقة كلامك (السرعة والتوقفات). تُحسب على هاتفك ولا يُرسل التسجيل نفسه.",
    dflt: true,
  },
  {
    key: "raw_audio",
    title: { en: "Keep voice recordings", ar: "الاحتفاظ بالتسجيلات الصوتية" },
    en: "Keep your recordings for a fixed time so a person can check the scoring.",
    ar: "الاحتفاظ بتسجيلاتك لفترة محددة حتى يتمكن شخص من مراجعة التقييم.",
    dflt: false,
  },
  {
    key: "wearables",
    title: { en: "Watch or fitness band", ar: "الساعات والأجهزة الذكية" },
    en: "Daily sleep and activity summaries from your device.",
    ar: "ملخصات يومية للنوم والنشاط من جهازك.",
    dflt: false,
  },
  {
    key: "clinical_record",
    title: { en: "Health record", ar: "السجل الصحي" },
    en: "Blood pressure, sugar (HbA1c), cholesterol and relevant diagnoses from your clinic record.",
    ar: "ضغط الدم والسكر التراكمي والكوليسترول والتشخيصات المهمة من ملفك في العيادة.",
    dflt: true,
  },
  {
    key: "family_history",
    title: { en: "Family history", ar: "التاريخ العائلي" },
    en: "Whether close relatives had memory problems or dementia.",
    ar: "هل عانى أحد الأقارب من مشكلات في الذاكرة أو من الخرف.",
    dflt: true,
  },
  {
    key: "caregiver_involvement",
    title: { en: "Family member involvement", ar: "إشراك أحد أفراد الأسرة" },
    en: "A family member may help with sessions and answer a short questionnaire about daily life.",
    ar: "يمكن لأحد أفراد العائلة المساعدة في الجلسات والإجابة عن استبيان قصير عن الحياة اليومية.",
    dflt: true,
  },
  {
    key: "genomics",
    title: { en: "Genetic results", ar: "النتائج الجينية" },
    en: "Use existing genetic results (for example from a national programme). A clinician discusses results with you only with counselling.",
    ar: "استخدام نتائج جينية موجودة (مثلًا من برنامج وطني). لا يناقش الطبيب النتائج معك إلا مع الإرشاد.",
    dflt: false,
  },
  {
    key: "model_training",
    title: { en: "Help improve the tool", ar: "المساهمة في تطوير الأداة" },
    en: "Allow your anonymised data to be used to improve the tool. Separate from your care.",
    ar: "السماح باستخدام بياناتك بعد إخفاء هويتك لتحسين الأداة. وهذا منفصل عن رعايتك.",
    dflt: false,
  },
];

const CONDITIONS: [string, { en: string; ar: string }][] = [
  ["hypertension", { en: "Hypertension", ar: "ارتفاع ضغط الدم" }],
  ["diabetes", { en: "Type 2 diabetes", ar: "السكري من النوع الثاني" }],
  ["stroke_tia", { en: "Stroke or TIA", ar: "جلطة دماغية أو نقص تروية عابر" }],
  ["af", { en: "Atrial fibrillation", ar: "الرجفان الأذيني" }],
  ["cvd", { en: "Cardiovascular disease", ar: "أمراض القلب والأوعية الدموية" }],
  ["ckd", { en: "Chronic kidney disease", ar: "مرض الكلى المزمن" }],
  ["hypothyroid", { en: "Hypothyroidism", ar: "قصور الغدة الدرقية" }],
  ["b12", { en: "B12 or folate deficiency", ar: "نقص فيتامين B12 أو الفولات" }],
  ["depression", { en: "Depression", ar: "الاكتئاب" }],
  ["anxiety", { en: "Anxiety", ar: "القلق النفسي" }],
  ["sleep_apnoea", { en: "Sleep apnoea", ar: "انقطاع التنفس أثناء النوم" }],
  ["insomnia", { en: "Chronic insomnia", ar: "الأرق المزمن" }],
  ["parkinsons", { en: "Parkinson's disease", ar: "مرض باركنسون (الشلل الرعاش)" }],
  ["tbi", { en: "Head injury (TBI)", ar: "إصابة سابقة في الرأس" }],
  ["hearing_loss", { en: "Hearing loss", ar: "ضعف السمع" }],
  ["vision", { en: "Visual impairment", ar: "ضعف البصر" }],
];

const DIALECTS: { key: string; label: { en: string; ar: string } }[] = [
  { key: "Emirati", label: { en: "Emirati", ar: "إماراتية" } },
  { key: "Other Gulf", label: { en: "Other Gulf", ar: "خليجية أخرى" } },
  { key: "Levantine", label: { en: "Levantine", ar: "شاميّة" } },
  { key: "Egyptian", label: { en: "Egyptian", ar: "مصرية" } },
  { key: "Other Arabic", label: { en: "Other Arabic", ar: "عربية أخرى" } },
  { key: "English", label: { en: "English", ar: "إنجليزية" } },
];

const EMIRATES: { key: string; label: { en: string; ar: string } }[] = [
  { key: "Abu Dhabi", label: { en: "Abu Dhabi", ar: "أبوظبي" } },
  { key: "Dubai", label: { en: "Dubai", ar: "دبي" } },
  { key: "Sharjah", label: { en: "Sharjah", ar: "الشارقة" } },
  { key: "Ajman", label: { en: "Ajman", ar: "عجمان" } },
  { key: "Umm Al Quwain", label: { en: "Umm Al Quwain", ar: "أم القيوين" } },
  { key: "Ras Al Khaimah", label: { en: "Ras Al Khaimah", ar: "رأس الخيمة" } },
  { key: "Fujairah", label: { en: "Fujairah", ar: "الفجيرة" } },
];

const RELATIONS: [string, { en: string; ar: string }][] = [
  ["spouse", { en: "Spouse", ar: "الزوج / الزوجة" }],
  ["son", { en: "Son", ar: "الابن" }],
  ["daughter", { en: "Daughter", ar: "الابنة" }],
  ["sibling", { en: "Brother or sister", ar: "الأخ أو الأخت" }],
  ["household_helper", { en: "Household helper", ar: "المساعد المنزلي" }],
  ["carer", { en: "Paid carer", ar: "مقدم رعاية بأجر" }],
  ["other", { en: "Other", ar: "أخرى" }],
];

const WHY: { key: string; label: { en: string; ar: string } }[] = [
  { key: "Memory or thinking problems", label: { en: "Memory or thinking problems", ar: "مشكلات في الذاكرة أو التفكير" } },
  { key: "Physical illness or mobility", label: { en: "Physical illness or mobility", ar: "مرض جسدي أو صعوبة في الحركة" } },
  { key: "Personal preference", label: { en: "Personal preference", ar: "رغبة شخصية" } },
  { key: "Family arrangement", label: { en: "Family arrangement", ar: "ترتيب عائلي" } },
  { key: "Not sure", label: { en: "Not sure", ar: "غير متأكد" } },
];

const DIGITAL_OPTIONS = [
  { key: "none", label: { en: "Not comfortable", ar: "غير متمكن" } },
  { key: "some", label: { en: "Somewhat", ar: "إلى حد ما" } },
  { key: "confident", label: { en: "Confident", ar: "متمكن وواثق" } },
];

const INFORMANT_TYPES = [
  { key: "family", label: { en: "Family member", ar: "أحد أفراد الأسرة" } },
  { key: "household_helper", label: { en: "Household helper", ar: "المساعد المنزلي" } },
  { key: "none", label: { en: "No informant", ar: "لا يوجد مرافق أو مبلّغ" } },
];

const HOSPITALS = [
  { id: "SVC-01", en: "Cleveland Clinic Abu Dhabi (Abu Dhabi)", ar: "كليفلاند كلينك أبوظبي (أبوظبي)" },
  { id: "SVC-02", en: "Tawam Hospital (Al Ain)", ar: "مستشفى توام (العين)" },
  { id: "SVC-14", en: "Rashid Hospital (Dubai)", ar: "مستشفى راشد (دبي)" },
];

const FUNDING_LABELS: Record<string, { en: string; ar: string }> = {
  thiqa: { en: "Thiqa", ar: "ثقة" },
  enaya: { en: "Enaya / Saada", ar: "عناية / سعادة" },
  private: { en: "Private insurance", ar: "تأمين خاص" },
  self_pay: { en: "Self-pay", ar: "حساب خاص" },
};

const EDUCATION_MAP: Record<string, { en: string; ar: string }> = {
  none: { en: "No formal schooling", ar: "بدون تعليم نظامي" },
  primary: { en: "Primary (≤6 y)", ar: "ابتدائي (≤ ٦ سنوات)" },
  secondary: { en: "Secondary (7–12 y)", ar: "ثانوي (٧–١٢ سنة)" },
  tertiary: { en: "Higher education (>12 y)", ar: "تعليم عالي (> ١٢ سنة)" },
};

const NAV_LANGUAGES_MAP: Record<string, { en: string; ar: string }> = {
  ar: { en: "Arabic", ar: "العربية" },
  en: { en: "English", ar: "الإنجليزية" },
  tl: { en: "Tagalog", ar: "التاغالوغية" },
  ml: { en: "Malayalam", ar: "الماليالامية" },
  ur: { en: "Urdu", ar: "الأردية" },
  hi: { en: "Hindi", ar: "الهندية" },
  bn: { en: "Bengali", ar: "البنغالية" },
};

const CHANNELS = [
  { key: "whatsapp", label: { en: "WhatsApp", ar: "واتساب" } },
  { key: "app", label: { en: "MemBrain app", ar: "تطبيق MemBrain" } },
  { key: "phone", label: { en: "Guided phone call", ar: "اتصال هاتفي موجّه" } },
];

/* ── Full Copy Dictionary ── */

const COPY = {
  en: {
    headerTitle: "Enrol a participant",
    headerSub: "Done by a programme coordinator or clinician, with the person (and a family member if they wish).",
    crumbsClinician: "Clinician",
    crumbsEnrol: "Enrol",
    demoBrowser: "Demo: saved in this browser only",

    embeddedEyebrow: "Participant enrolment",
    embeddedTitle: "A little about you",
    embeddedSub: "Please complete participant enrolment details before continuing to the check-in exercise.",

    stepOf: (cur: number, total: number) => `Step ${cur} of ${total}`,
    urgentSkippedHint: "Red flag: the remaining steps can be completed after the urgent review.",

    concernTitle: "Concern and safety",
    concernSub: "People come through a screening programme, primary care, a family member, a household helper or themselves. The red-flag screen comes first, before any testing.",
    howCame: "How did this person come to us?",
    whatNoticed: "What has been noticed?",
    whatNoticedProgrammeHint: "Optional for routine programme screening.",
    whatNoticedGeneralHint: "In the words of whoever raised it, for example: repeats questions, missed bills, got lost driving.",
    whenStart: "When did it start?",
    redFlagTitle: "Red-flag screen",
    redFlagSub: "Ask the person and whoever is with them. Any one of these needs urgent clinical assessment, not memory testing.",

    acuteTitle: "Possible acute presentation",
    acuteBody: "Follow the emergency protocol now (ambulance 998 if needed). Do not start memory testing and do not wait for repeat tests. Record who the person is so the clinician can act; the rest can be completed later.",

    identityTitle: "Identity",
    identitySub: "Stored only in the separate identity vault.",
    vaultNote: "Name, ID and phone are kept in the identity vault so the clinic can contact the person. The record, the dashboard and analytics use a pseudonymous ID. Showing these details again needs a reason and is written to the audit log.",
    fullName: "Full name",
    nationalId: "Emirates ID or clinic MRN",
    optional: "Optional.",
    mobileNumber: "Mobile number",
    mobileHint: "They can sign in with this number to do their own check-ins.",
    preferredChannel: "Preferred channel for reminders and check-ins",
    channelHint: "Each channel keeps its own baseline; scores are not pooled across channels.",
    ageUrgentHint: "Needed for the record; no testing today.",

    profileTitle: "Profile",
    profileSub: "Scores are compared with people of the same age and schooling, and with the person's own earlier results.",
    age: "Age",
    ageHint: "Eligible: 50 to 75.",
    sex: "Sex",
    sexF: "Female",
    sexM: "Male",
    schooling: "Years of schooling",
    schoolingZeroHint: "0 if none.",
    normGroup: "Norm group:",
    sessionLang: "Language for sessions",
    langAr: "Arabic",
    langEn: "English",
    dialect: "Dialect",
    dialectHint: "Used to report accuracy by dialect.",
    emirate: "Emirate of residence",
    emirateHint: "Used to find services the person can reach.",
    funding: "Funding route",
    fundingHint: "Only to find accessible services. Never used to withhold a needed referral.",
    hospital: "Assigned hospital / clinic",
    hospitalHint: "Registered facilities with active clinicians",
    hearingAid: "Uses a hearing aid",
    readingGlasses: "Uses reading glasses",
    digitalComfort: "Comfort with smartphones",
    digitalNoneHint: "Suggest a family member helping with check-ins, or the guided phone channel.",

    consentTitle: "Consent for each type of data",
    consentSub: "Read each one aloud in the person's language. Every item is optional and can be withdrawn at any time; withdrawal stops processing and removes that data.",
    readAloud: (title: string) => `Read "${title}" aloud`,
    consentVersionNote: (v: string) => `Consent text version ${v}, recorded by the coordinator and stored with the record.`,

    informantTitle: "Informant",
    informantSub: "Optional. Someone who knows the person well describes changes in everyday life. Household help can hide early changes, so what a helper sees matters.",
    familyConsentWarn: "Family member involvement was not consented on the Consent step.",
    helperNote: "Household helpers take part voluntarily, under their own consent, in a language they understand. What they report is never shared with an employer or used for employment decisions.",
    helperAgree: "The helper agrees voluntarily, and the person consents to their involvement",
    helperLang: "Helper's preferred language",
    informantName: "Name",
    keptInVault: "Kept in the identity vault.",
    relation: "Relation",
    choose: "Choose",
    iqcodeLabel: "IQCODE-16 average, if done today",
    iqcodeHint: (cutoff: number) => `1 to 5. Above ${cutoff} is flagged to the clinician; a screening result, not a diagnosis.`,
    timelineTitle: "Changes in everyday life",
    timelineSub: "What changed, roughly when, who took over and why. Context for the clinician, not automatic evidence of decline.",
    colActivity: "Activity",
    colChange: "What changed",
    colWhen: "When",
    colWhoTookOver: "Who took over",
    colWhy: "Why",
    addChange: "Add a change",
    removeChange: "Remove this change",

    healthTitle: "Health context",
    healthSub: "In the pilot these come from the clinic record through the partner's integration. Here they are entered by hand.",
    healthNoConsentWarn: "Health-record use was not consented. Readings entered here are not kept; only what the person tells you directly is recorded.",
    bp: "Blood pressure (mmHg)",
    systolicAria: "Systolic",
    diastolicAria: "Diastolic",
    hba1c: "HbA1c (%)",
    ldl: "LDL cholesterol (mmol/L)",
    bmi: "BMI",
    activityMin: "Physical activity (minutes a week)",
    district: "Home district",
    districtHint: "Optional, district level only.",
    knownConditions: "Known conditions",
    lifestyleFamily: "Lifestyle and family",
    smokes: "Smokes (cigarettes, shisha or medwakh)",
    isolated: "Lives alone or rarely sees family and friends",
    famHistory: "A parent or sibling with memory problems or dementia",
    apoeLabel: "Existing APOE result",
    apoeHint: "Imported only, never tested by MemBrain. Shown to the clinician; shared with the person only after counselling. It never changes alert thresholds.",
    apoeNone: "None on file",

    reviewTitle: "Review and schedule",
    reviewSub: "Check the details with the person, then enrol. The record gets a pseudonymous ID.",
    summaryPerson: "Person",
    summaryCame: "Came through",
    summaryConcern: "Concern",
    summaryNoneRecorded: "None recorded (routine screening)",
    summaryChannel: "Channel",
    summaryFamilyHelp: "family help suggested",
    summaryConsent: "Consent",
    summaryNone: "None",
    summaryInformant: "Informant",
    summaryNoInformant: "None",
    summaryConditions: "Conditions",
    summaryNoneCond: "None recorded",
    sessionPlan: "Session plan",
    planBaseline1: "Baseline 1",
    planBaseline1Date: (d: string) => `${d} (today, with you)`,
    planBaseline1Desc: "Form A or B or C, chosen for this person",
    planBaseline2: "Baseline 2",
    planBaseline2Desc: "A different form",
    planFollowUp: "Follow-up",
    planFollowUpDesc: "First check for change, with the family questionnaire",
    planRoutine: "Routine",
    planRoutineDate: "Every 6 months",
    planRoutineDesc: "Or in 2 to 4 weeks after a “check again” result",
    planReminder: (ch: string) => `Reminders go by ${ch} the day before and on the day.`,

    errConcernText: "Describe what has been noticed, in a few words.",
    errName: "Enter a name. It stays in the identity vault.",
    errAge: "MemBrain is for people aged 50 to 75.",
    errSchooling: "Enter years of schooling (0 if none).",
    errIqcode: "IQCODE-16 averages run from 1 to 5.",

    btnBack: "Back",
    btnContinue: "Continue",
    btnEscalateIdentity: "Record identity and escalate",
    btnEscalateSubmit: "Create urgent review now",
    btnEnrolCheckin: "Enrol and begin check-in",
    btnEnrolId: "Enrol and create pseudonymous ID",

    doneUrgentTitle: "Urgent review created.",
    doneUrgentBody: "This person is now among the urgent cases at the top of the clinician queue. Follow the emergency protocol; no memory testing today.",
    doneTitle: "Enrolled",
    doneIdLabel: "Pseudonymous ID",
    doneDesc: (id: string, phoneLinked: boolean) =>
      `Name and contact details are in the identity vault only. Clinicians see ${id}, and can show the contact details for follow-up with a reason, which is audited.${phoneLinked ? " The person can now sign in with their mobile number to do their own check-ins." : ""}`,
    btnStartBaseline: "Start baseline check-in now",
    btnOpenCase: "Open the case",
    btnEnrolAnother: "Enrol another person",
  },
  ar: {
    headerTitle: "تسجيل مشارك جديد",
    headerSub: "يقوم به منسّق البرنامج أو الطبيب، مع المشارك (وأحد أفراد الأسرة إن رغبوا بذلك).",
    crumbsClinician: "الكادر الطبي",
    crumbsEnrol: "التسجيل",
    demoBrowser: "نسخة تجريبية: تُحفظ في هذا المتصفح فقط",

    embeddedEyebrow: "التسجيل الأولي للمشارك",
    embeddedTitle: "معلومات عنك والتسجيل",
    embeddedSub: "يرجى إكمال تفاصيل تسجيل المشارك قبل المتابعة إلى جلسة التقييم.",

    stepOf: (cur: number, total: number) => `الخطوة ${numAr(cur)} من ${numAr(total)}`,
    urgentSkippedHint: "علامة تحذيرية: يمكن استكمال بقية الخطوات بعد المراجعة الطبية العاجلة.",

    concernTitle: "القلق والسلامة",
    concernSub: "يأتي المشاركون عبر برنامج الفحص، أو الرعاية الأولية، أو أحد أفراد الأسرة، أو المساعد المنزلي، أو بأنفسهم. يُجرى فحص السلامة والعلامات التحذيرية أولًا قبل أي فحص للذاكرة.",
    howCame: "كيف وصل إلينا هذا الشخص؟",
    whatNoticed: "ما الذي تمت ملاحظته؟",
    whatNoticedProgrammeHint: "اختياري في حال فحص البرنامج الروتيني.",
    whatNoticedGeneralHint: "بكلمات الشخص الذي لاحظ ذلك، مثلًا: تكرار الأسئلة، نسيان الفواتير، التيه أثناء القيادة.",
    whenStart: "متى بدأ ذلك؟",
    redFlagTitle: "فحص العلامات التحذيرية العاجلة",
    redFlagSub: "اسأل الشخص ومرافقه. وجود أي علامة منها يستدعي تقييمًا سريريًا عاجلًا وفوريًا، وليس فحصًا للذاكرة.",

    acuteTitle: "احتمال وجود حالة حادة عاجلة",
    acuteBody: "اتبع بروتوكول الطوارئ الآن (اتصل بالإسعاف ٩٩٨ إذا لزم الأمر). لا تبدأ فحص الذاكرة ولا تنتظر إعادة الفحص. سجّل هوية الشخص ليتمكن الطبيب من التدخل؛ ويمكن إكمال بقية التفاصيل لاحقًا.",

    identityTitle: "الهوية",
    identitySub: "تُحفظ في خزينة الهوية المنفصلة فقط.",
    vaultNote: "يُحفظ الاسم ورقم الهوية والهاتف في خزينة الهوية لتتمكن العيادة من التواصل مع الشخص. يستخدم الملف وسجل المتابعة والتحليلات معرّفًا بديلًا مشفرًا. يتطلب كشف هذه البيانات مجددًا إدخال سبب رسمي ويتم تدوينه في سجل التدقيق.",
    fullName: "الاسم الكامل",
    nationalId: "الهوية الإماراتية أو الرقم الطبي",
    optional: "اختياري.",
    mobileNumber: "رقم الهاتف المتحرك",
    mobileHint: "يمكنهم تسجيل الدخول بهذا الرقم لإجراء فحوصاتهم بأنفسهم.",
    preferredChannel: "القناة المفضلة للتذكيرات والفحوصات",
    channelHint: "تحتفظ كل قناة بأساس قياس خاص بها؛ ولا تُدمج النتائج بين القنوات المختلفة.",
    ageUrgentHint: "مطلوب للملف الطبي؛ لا توجد اختبارات اليوم.",

    profileTitle: "الملف التعريفي",
    profileSub: "تُقارن الدرجات بالأشخاص من نفس الفئة العمرية ومستوى التعليم، وبنتائج الشخص السابقة.",
    age: "العمر",
    ageHint: "الفئة المؤهلة: ٥٠ إلى ٧٥ سنة.",
    sex: "الجنس",
    sexF: "أنثى",
    sexM: "ذكر",
    schooling: "سنوات التعليم",
    schoolingZeroHint: "٠ إن لم يوجد تعليم نظامي.",
    normGroup: "المجموعة المعيارية:",
    sessionLang: "لغة الجلسات",
    langAr: "العربية",
    langEn: "الإنجليزية",
    dialect: "اللهجة",
    dialectHint: "تُستخدم لقياس دقة النماذج الصوتية حسب اللهجة.",
    emirate: "إمارة الإقامة",
    emirateHint: "تُستخدم لمطابقة الخدمات والمراكز القريبة من الشخص.",
    funding: "جهة التغطية أو التأمين",
    fundingHint: "فقط لتحديد الخدمات المتاحة للشخص، ولا تُستخدم أبدًا لحجب أي إحالة ضرورية.",
    hospital: "المستشفى أو المركز المعتمد",
    hospitalHint: "المستشفيات المسجلة التي تضم أطباء معتمدين",
    hearingAid: "يستخدم سماعة أذن طبية",
    readingGlasses: "يستخدم نظارة قراءة",
    digitalComfort: "مدى إجادة استخدام الهواتف الذكية",
    digitalNoneHint: "يُفضل اقتراح مساعدة أحد أفراد الأسرة في الفحوصات، أو استخدام قناة الاتصال الهاتفي.",

    consentTitle: "الموافقة على كل نوع من البيانات",
    consentSub: "يُقرأ كل بند بصوت واضح بلغة الشخص. كل بند اختياري ويمكن سحب الموافقة عليه في أي وقت؛ وسحب الموافقة يوقف المعالجة ويحذف تلك البيانات.",
    readAloud: (title: string) => `قراءة "${title}" بصوت مسموع`,
    consentVersionNote: (v: string) => `نسخة نص الموافقة ${v}، دوّنها المنسق وتُحفظ مع السجل الطبي.`,

    informantTitle: "المبلّغ / المرافق",
    informantSub: "اختياري. شخص يعرف المشارك جيدًا ويصف التغيّرات في تفاصيل الحياة اليومية. قد تحجب المساعدة المنزلية التغيّرات المبكرة، لذا فإن ملاحظات المساعد المنزلي مهمة للغاية.",
    familyConsentWarn: "لم يتم تسجيل الموافقة على إشراك أحد أفراد الأسرة في خطوة الموافقة.",
    helperNote: "يشارك المساعدون المنزليون طوعًا وبموافقتهم المستقلة وبلغة يفهمونها. لا يتم إطلاع صاحب العمل على ما يذكرونه ولا يُستخدم في قرارات العمل أبدًا.",
    helperAgree: "يوافق المساعد المنزلي طوعًا، ويوافق الشخص المعني على مشاركته",
    helperLang: "اللغة المفضلة للمساعد المنزلي",
    informantName: "الاسم",
    keptInVault: "يُحفظ في خزينة الهوية.",
    relation: "صلة القرابة أو العلاقة",
    choose: "اختر الصلة",
    iqcodeLabel: "متوسط مقياس IQCODE-16 (إن أُجري اليوم)",
    iqcodeHint: (cutoff: number) => `من ١ إلى ٥. الدرجة الأعلى من ${numAr(cutoff)} تُنبه الطبيب المعالج؛ وهي نتيجة فحص وليست تشخيصًا.`,
    timelineTitle: "التغيّرات في الحياة اليومية",
    timelineSub: "ما الذي تغيّر، تقريبًا متى، من تولى المهمة، ولماذا. هذا سياق إيضاحي للطبيب، وليس دليلًا حتميًا على التدهور.",
    colActivity: "النشاط",
    colChange: "ما الذي تغيّر",
    colWhen: "متى",
    colWhoTookOver: "من تولى الأمر",
    colWhy: "السبب",
    addChange: "إضافة تغيّر",
    removeChange: "حذف هذا التغيّر",

    healthTitle: "السياق الصحي",
    healthSub: "في المرحلة التجريبية تُستورد هذه البيانات من السجل الطبي الإلكتروني عبر التكامل البرمجي. وهنا تُدخل يدويًا لأغراض العرض.",
    healthNoConsentWarn: "لم تتم الموافقة على استخدام السجل الصحي. القراءات المدخلة هنا لن تُحفظ؛ يُسجل فقط ما يذكره الشخص مباشرة.",
    bp: "ضغط الدم (ملم زئبق)",
    systolicAria: "الانقباضي",
    diastolicAria: "الانبساطي",
    hba1c: "السكر التراكمي HbA1c (٪)",
    ldl: "الكوليسترول الضار LDL (مليمول/لتر)",
    bmi: "مؤشر كتلة الجسم (BMI)",
    activityMin: "النشاط البدني (دقيقة في الأسبوع)",
    district: "المنطقة أو الحي",
    districtHint: "اختياري، على مستوى المنطقة أو الحي فقط.",
    knownConditions: "الحالات الصحية والتشخيصات السابقة",
    lifestyleFamily: "نمط الحياة والتاريخ العائلي",
    smokes: "يدخّن (سجائر، أو شيشة، أو مدواخ)",
    isolated: "يعيش بمفرده أو نادرًا ما يلتقي بالعائلة والأصدقاء",
    famHistory: "أحد الوالدين أو الإخوة عانى من مشكلات بالذاكرة أو الخرف",
    apoeLabel: "نتيجة فحص جين APOE المتوفرة سابقًا",
    apoeHint: "تُستورد فقط ولا يفحصها MemBrain إطلاقًا. تُعرض للطبيب المختص، وتُناقش مع الشخص بعد تقديم الإرشاد الوراثي فقط. ولا تغيّر أبدًا عتبات التنبيه السريري.",
    apoeNone: "لا يوجد فحص مسجل",

    reviewTitle: "المراجعة والجدولة",
    reviewSub: "راجع البيانات مع الشخص، ثم أتمم التسجيل. يحصل الملف على معرّف بديل مشفر.",
    summaryPerson: "الشخص",
    summaryCame: "طريقة الوصول",
    summaryConcern: "القلق الملاحظ",
    summaryNoneRecorded: "لا يوجد قلق مسجل (فحص روتيني للبرنامج)",
    summaryChannel: "القناة المفضلة",
    summaryFamilyHelp: "مع اقتراح مساعدة الأسرة",
    summaryConsent: "بنود الموافقة",
    summaryNone: "لا يوجد",
    summaryInformant: "المرافق / المبلّغ",
    summaryNoInformant: "لا يوجد",
    summaryConditions: "الحالات الصحية",
    summaryNoneCond: "لا توجد حالات مسجلة",
    sessionPlan: "خطة الجلسات المقررة",
    planBaseline1: "القياس الأساسي الأول",
    planBaseline1Date: (d: string) => `${d} (اليوم، بحضوركم)`,
    planBaseline1Desc: "النموذج (أ) أو (ب) أو (ج)، يُختار للمشارك",
    planBaseline2: "القياس الأساسي الثاني",
    planBaseline2Desc: "نموذج بديل مختلف",
    planFollowUp: "المتابعة الدورية",
    planFollowUpDesc: "أول فحص لتتبع التغيّر، مع استبيان الأسرة",
    planRoutine: "الفحص الروتيني",
    planRoutineDate: "كل ٦ أشهر",
    planRoutineDesc: "أو خلال ٢ إلى ٤ أسابيع بعد نتيجة “إعادة التحقق”",
    planReminder: (ch: string) => `تُرسل التذكيرات عبر ${ch} في اليوم السابق ويوم الجلسة.`,

    errConcernText: "يرجى وصف ما تمت ملاحظته في بضع كلمات.",
    errName: "يرجى إدخال الاسم. يُحفظ في خزينة الهوية.",
    errAge: "برنامج MemBrain مخصص للأشخاص من سن ٥٠ إلى ٧٥ سنة.",
    errSchooling: "أدخل عدد سنوات التعليم (٠ إن لم يوجد تعليم نظامي).",
    errIqcode: "يتراوح متوسط مقياس IQCODE-16 بين ١ و ٥.",

    btnBack: "رجوع",
    btnContinue: "متابعة",
    btnEscalateIdentity: "تسجيل الهوية وتصعيد الحالة",
    btnEscalateSubmit: "إنشاء مراجعة عاجلة الآن",
    btnEnrolCheckin: "تسجيل وبدء التقييم",
    btnEnrolId: "تسجيل وإنشاء معرّف بديل",

    doneUrgentTitle: "تم إنشاء مراجعة عاجلة.",
    doneUrgentBody: "أُدرج هذا الشخص الآن ضمن الحالات العاجلة في أعلى قائمة الأطباء. يرجى اتباع بروتوكول الطوارئ؛ لا يُجرى فحص للذاكرة اليوم.",
    doneTitle: "تم التسجيل بنجاح",
    doneIdLabel: "المعرّف البديل المشفر",
    doneDesc: (id: string, phoneLinked: boolean) =>
      `تُحفظ تفاصيل الاسم وبيانات الاتصال في خزينة الهوية فقط. يرى الأطباء المعرّف ${id}، ويمكنهم كشف بيانات الاتصال للمتابعة مع تدوين السبب في سجل التدقيق.${phoneLinked ? " يمكن للشخص الآن تسجيل الدخول برقم هاتفه لإجراء فحوصاته بنفسه." : ""}`,
    btnStartBaseline: "بدء الفحص الأساسي الآن",
    btnOpenCase: "فتح ملف الحالة",
    btnEnrolAnother: "تسجيل شخص آخر",
  },
};

const eduBand = (years: number): EnrolIn["education"] => (years <= 0 ? "none" : years <= 6 ? "primary" : years <= 12 ? "secondary" : "tertiary");
const addDays = (iso: string, d: number) => new Date(Date.parse(iso + "T00:00:00Z") + d * 86400000).toISOString().slice(0, 10);
const toTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));

type Form = {
  route: EnrolIn["concern"]["route"];
  text: string;
  onset: NonNullable<EnrolIn["concern"]["onset"]>;
  flags: Record<string, boolean>;
  name: string;
  nationalId: string;
  phone: string;
  channel: "app" | "whatsapp" | "phone";
  age: string;
  sex: "F" | "M";
  years: string;
  language: Lang;
  dialect: string;
  emirate: string;
  funding: string;
  hospital_id: string;
  hearingAid: boolean;
  glasses: boolean;
  digital: "none" | "some" | "confident";
  consent: Record<string, boolean>;
  infType: "family" | "household_helper" | "none";
  helperConsent: boolean;
  infLanguage: string;
  infName: string;
  infRelation: string;
  infPhone: string;
  iqcode: string;
  timeline: InformantChange[];
  sbp: string;
  dbp: string;
  hba1c: string;
  ldl: string;
  bmi: string;
  activity: string;
  district: string;
  cond: Record<string, boolean>;
  smoker: boolean;
  isolated: boolean;
  famHistory: boolean;
  apoe: string;
};

const blank = (): Form => ({
  route: "programme", text: "", onset: "none", flags: {},
  name: "", nationalId: "", phone: "", channel: "whatsapp",
  age: "", sex: "F", years: "", language: "ar", dialect: "Emirati", emirate: "Abu Dhabi", funding: "thiqa", hospital_id: "SVC-01", hearingAid: false, glasses: false, digital: "some",
  consent: Object.fromEntries(CONSENT.map((c) => [c.key, c.dflt])),
  infType: "family", helperConsent: false, infLanguage: "ar", infName: "", infRelation: "", infPhone: "", iqcode: "", timeline: [],
  sbp: "", dbp: "", hba1c: "", ldl: "", bmi: "", activity: "", district: "", cond: {}, smoker: false, isolated: false, famHistory: false, apoe: "",
});

function initialForm(prefilledCase?: Case, initialLang: Lang = "ar"): Form {
  const base = blank();
  if (initialLang) base.language = initialLang;
  if (!prefilledCase) return base;

  const p = prefilledCase.participant;
  const c = prefilledCase.concern;
  const intake = p.intake?.confirmed;

  const regName = registeredNameOf(p.id) || (p.display_name && p.display_name.en !== "Enrolled participant" && p.display_name.en !== "New concern" && p.display_name.en !== "مشارك مسجّل" && p.display_name.en !== "قلق جديد" ? (p.display_name.en || p.display_name.ar || "") : "");

  let route: EnrolIn["concern"]["route"] = "programme";
  const rawRoute = c?.raised_by || p.entry_route || p.intake?.reporter;
  if (rawRoute === "family") route = "family";
  else if (rawRoute === "helper" || rawRoute === "household_helper") route = "household_helper";
  else if (rawRoute === "self") route = "self";
  else if (rawRoute === "professional" || rawRoute === "primary_care") route = "primary_care";

  const narrative = c?.in_their_words || intake?.narrative || "";
  const rawOnset = c?.onset || intake?.onset || "none";
  const onset: NonNullable<EnrolIn["concern"]["onset"]> =
    rawOnset === "days" || rawOnset === "weeks" || rawOnset === "months" || rawOnset === "years" ? rawOnset : "none";

  const flags: Record<string, boolean> = {};
  for (const rf of [...(c?.red_flags_reported ?? []), ...(intake?.red_flags ?? [])]) {
    flags[rf] = true;
  }

  const phone = p.phone || c?.phone || "";
  const age = p.age != null ? String(p.age) : "";
  const sex = p.sex === "M" ? "M" : "F";
  const years = p.education === "none" ? "0" : p.education === "primary" ? "6" : p.education === "secondary" ? "12" : p.education === "tertiary" ? "16" : "";
  const dialect = p.dialect || "Emirati";
  const language = (p.language as Lang) || initialLang || "ar";
  const emirate = p.emirate || (typeof c?.emirate === "string" ? c.emirate : "Abu Dhabi");
  const funding = p.funding || "thiqa";
  const rawHosp = p.assigned_hospital;
  const pAssignedId = typeof rawHosp === "string" ? rawHosp : rawHosp?.id;
  const hospital_id = pAssignedId || (c as unknown as { assigned_hospital?: { id?: string } })?.assigned_hospital?.id || (emirate === "Dubai" ? "SVC-14" : "SVC-01");

  return {
    ...base,
    route,
    text: narrative,
    onset,
    flags,
    name: regName,
    phone,
    age,
    sex,
    years,
    language,
    dialect,
    emirate,
    funding,
    hospital_id,
    channel: (p as unknown as { preferred_channel?: "app" | "whatsapp" | "phone" }).preferred_channel || "whatsapp",
  };
}

/* ── UI Building Blocks ── */

const field = "h-11 w-full rounded-xl border border-[#d7ddda] bg-white px-3.5 text-[15.5px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-[#9aa5a0] focus:border-deep focus:shadow-[0_0_0_4px_rgb(15_63_44/0.10)]";

function Field({ label, hint, children, error }: { label: string; hint?: ReactNode; children: ReactNode; error?: string | null }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-medium text-ink">{label}</span>
      {children}
      {error ? <span className="mt-1.5 block text-[13px] font-medium text-lv-review">{error}</span> : hint ? <span className="mt-1.5 block text-[13px] leading-snug text-muted">{hint}</span> : null}
    </label>
  );
}

function CheckRow({ on, onChange, children, sub }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode; sub?: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${on ? "border-deep/40 bg-[#eef4ef]" : "border-line bg-white hover:bg-paper"}`}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#0f3f2c]" />
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-ink">{children}</span>
        {sub && <span className="mt-0.5 block text-[13.5px] leading-snug text-body">{sub}</span>}
      </span>
    </label>
  );
}

function Choice<T extends string>({ value, options, onPick, cols = 2 }: { value: T; options: { key: T; label: string; sub?: string }[]; onPick: (v: T) => void; cols?: 1 | 2 | 3 }) {
  return (
    <div className={`grid gap-2.5 ${cols === 3 ? "sm:grid-cols-2 xl:grid-cols-3" : cols === 2 ? "sm:grid-cols-2" : ""}`} role="radiogroup">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button key={o.key} type="button" role="radio" aria-checked={on} onClick={() => onPick(o.key)}
            className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-start transition-colors ${on ? "border-deep bg-[#eef4ef] shadow-[0_0_0_3px_rgb(15_63_44/0.08)]" : "border-line bg-white hover:bg-paper"}`}>
            <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${on ? "border-deep bg-deep text-white" : "border-[#b9c4c2]"}`} aria-hidden>
              {on && <Check2 />}
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-medium text-ink">{o.label}</span>
              {o.sub && <span className="mt-0.5 block text-[13px] leading-snug text-body">{o.sub}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
const Check2 = () => <Check size={11} strokeWidth={3.5} />;

function Note({ tone = "info", children }: { tone?: "info" | "warn" | "urgent"; children: ReactNode }) {
  const cls = tone === "urgent" ? "border-lv-urgent/25 bg-lv-urgent-soft text-[#7a1f33]" : tone === "warn" ? "border-[#e9cf9f] bg-sand-soft text-[#6b4714]" : "border-[#d6dde9] bg-[#f3f6fb] text-[#2b3a55]";
  return <div className={`rounded-xl border px-4 py-3 text-[14.5px] leading-snug ${cls}`}>{children}</div>;
}

function Section({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-[19px] font-semibold tracking-[-0.01em]">{title}</h2>
      {sub && <p className="mt-1 text-[14.5px] leading-snug text-body">{sub}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </div>
  );
}

/* ── The Enrolment Form Component ── */

export function EnrolForm({
  backend,
  prefilledCase,
  lang,
  initialLang = "ar",
  title,
  sub,
  embedded = false,
  onComplete,
}: {
  backend?: Backend;
  prefilledCase?: Case;
  lang?: Lang;
  initialLang?: Lang;
  title?: string;
  sub?: string;
  embedded?: boolean;
  onComplete?: (done: EnrolDone) => void;
}) {
  const activeLang: Lang = lang ?? initialLang ?? "ar";
  const t = COPY[activeLang];

  const [f, setF] = useState<Form>(() => initialForm(prefilledCase, activeLang));
  const [step, setStep] = useState(prefilledCase && embedded ? 1 : 0);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<EnrolDone | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const upd = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const flags = Object.keys(f.flags).filter((k) => f.flags[k]);
  const urgent = flags.length > 0;
  const isUrgentEscalation = urgent && !embedded;
  const key: StepKey = STEPS[step].key;
  const age = num(f.age);
  const years = num(f.years);
  const band = years == null ? null : eduBand(years);

  // What stops the coordinator moving on, step by step.
  const problems = useMemo(() => {
    const p: Partial<Record<StepKey, Record<string, string>>> = {};
    if (f.route !== "programme" && f.onset !== "none" && !f.text.trim()) p.concern = { text: t.errConcernText };
    if (!f.name.trim()) p.identity = { name: t.errName };
    const prof: Record<string, string> = {};
    if (age == null || age < 50 || age > 75) prof.age = t.errAge;
    if (years == null || years < 0 || years > 25) prof.years = t.errSchooling;
    if (Object.keys(prof).length) {
      p.profile = prof;
      if (isUrgentEscalation) p.identity = { ...(p.identity ?? {}), ...prof };
    }
    const iq = num(f.iqcode);
    if (f.iqcode.trim() && (iq == null || iq < 1 || iq > 5)) p.informant = { iqcode: t.errIqcode };
    return p;
  }, [f, age, years, isUrgentEscalation, t]);
  const here = problems[key];
  const err = (k: string) => (tried && here?.[k]) || null;

  const body = (): EnrolIn => {
    const cond = Object.keys(f.cond).filter((k) => f.cond[k]);
    const prof = f.infType === "none" ? null : {
      type: f.infType, relation: f.infRelation || null, language: f.infLanguage || null,
      consented: f.infType === "household_helper" ? f.helperConsent : true,
      timeline: f.timeline.filter((t) => t.change.trim() || t.when.trim() || t.who_took_over.trim()),
    } as EnrolIn["informant_profile"];
    return {
      date: DEMO_TODAY,
      age: age ?? 0,
      sex: f.sex,
      education: band ?? "primary",
      language: f.language,
      dialect: f.dialect,
      identity: f.name.trim() ? { full_name: f.name.trim(), national_id: f.nationalId.trim() || null, phone: f.phone.trim() || null, preferred_channel: f.channel } : null,
      informant: f.infType !== "none" && f.infName.trim() ? { name: f.infName.trim(), relation: f.infRelation || "other", phone: f.infPhone.trim() || null } : null,
      informant_profile: prof,
      concern: { route: f.route, text: f.text.trim(), onset: f.onset, red_flags: flags },
      consent: f.consent,
      context: {
        sbp: num(f.sbp), dbp: num(f.dbp), hba1c: num(f.hba1c), ldl: num(f.ldl), bmi: num(f.bmi), activity_min_week: num(f.activity),
        district: f.district.trim() || null, smoker: f.smoker, social_isolation: f.isolated, family_history_dementia: f.consent.family_history ? f.famHistory : null,
        hypertension: !!f.cond.hypertension, diabetes: !!f.cond.diabetes, hearing_difficulty: !!f.cond.hearing_loss, hearing_aid: f.hearingAid,
        vision_difficulty: !!f.cond.vision, glasses: f.glasses, mood_positive: !!f.cond.depression, tbi: !!f.cond.tbi, conditions: cond, digital_comfort: f.digital,
      },
      emirate: f.emirate,
      funding: f.funding,
      hospital_id: f.hospital_id || undefined,
      iqcode: f.infType === "none" ? null : num(f.iqcode),
      apoe: f.consent.genomics && f.apoe ? f.apoe : null,
    };
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const regName = f.name.trim();
      const payload = body();
      if (prefilledCase?.participant?.id) {
        payload.id = prefilledCase.participant.id;
      }
      const enrolFn = backend?.enrol ?? (async (b: EnrolIn) => (await getBackend()).enrol(b));
      const res = await enrolFn(payload);
      if (typeof window !== "undefined" && regName) {
        try {
          window.sessionStorage.setItem(`membrain.registered_name.${res.id}`, regName);
          window.localStorage.setItem(`membrain.registered_name.${res.id}`, regName);
        } catch { /* storage disabled */ }
      }
      const fullDone: EnrolDone = { ...res, registered_name: regName };
      stopSpeaking();
      if (onComplete) {
        onComplete(fullDone);
      } else {
        setDone(fullDone);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    setTried(true);
    if (here) return;
    setTried(false);
    if (key === "identity" && isUrgentEscalation) return void submit(); // a red flag: record who they are and escalate now
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      toTop();
    } else void submit();
  };
  const goTo = (i: number) => {
    for (let j = 0; j < i; j++) if (problems[STEPS[j].key]) return;
    setTried(false);
    setStep(i);
    toTop();
  };
  const read = (k: string, text: string) => {
    if (reading === k) {
      stopSpeaking();
      setReading(null);
      return;
    }
    setReading(k);
    void speak(text, activeLang).finally(() => setReading((r) => (r === k ? null : r)));
  };

  if (done && !onComplete) return <Done done={done} urgent={urgent} lang={activeLang} onAgain={() => { setF(initialForm(prefilledCase, activeLang)); setStep(0); setDone(null); }} />;

  /* ── Each step ── */
  let content: ReactNode = null;
  if (key === "concern") {
    content = (
      <Section title={t.concernTitle} sub={t.concernSub}>
        <div>
          <p className="mb-2 text-[14px] font-medium">{t.howCame}</p>
          <Choice
            value={f.route}
            onPick={(v) => upd("route", v)}
            options={ROUTES.map((r) => ({ key: r.key, label: r.label[activeLang], sub: r.sub[activeLang] }))}
          />
        </div>
        <Field label={t.whatNoticed} error={err("text")} hint={f.route === "programme" ? t.whatNoticedProgrammeHint : t.whatNoticedGeneralHint}>
          <textarea value={f.text} onChange={(e) => upd("text", e.target.value)} rows={3} dir="auto" className={`${field} h-auto py-2.5 leading-snug`} />
        </Field>
        <div>
          <p className="mb-2 text-[14px] font-medium">{t.whenStart}</p>
          <Choice
            value={f.onset}
            onPick={(v) => upd("onset", v)}
            options={ONSET.map((o) => ({ key: o.key, label: o.label[activeLang] }))}
            cols={3}
          />
        </div>
        <div>
          <p className="text-[14px] font-medium">{t.redFlagTitle}</p>
          <p className="mb-2 text-[13.5px] text-body">{t.redFlagSub}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.keys(RED_FLAGS).map((k) => (
              <CheckRow key={k} on={!!f.flags[k]} onChange={(on) => upd("flags", { ...f.flags, [k]: on })}>
                {RED_FLAGS_MAP[k]?.[activeLang] ?? RED_FLAGS[k]}
              </CheckRow>
            ))}
          </div>
        </div>
        {urgent && <UrgentNote flags={flags} lang={activeLang} />}
      </Section>
    );
  } else if (key === "identity") {
    content = (
      <Section title={t.identityTitle} sub={t.identitySub}>
        {urgent && <UrgentNote flags={flags} lang={activeLang} short />}
        <Note>
          <span className="flex items-start gap-2.5"><Lock size={16} className="mt-0.5 shrink-0" /> <span>{t.vaultNote}</span></span>
        </Note>
        <Field label={t.fullName} error={err("name")}><input value={f.name} onChange={(e) => upd("name", e.target.value)} className={field} autoComplete="off" dir="auto" /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t.nationalId} hint={t.optional}><input value={f.nationalId} onChange={(e) => upd("nationalId", e.target.value)} className={field} autoComplete="off" placeholder="784-XXXX-XXXXXXX-X" dir="ltr" /></Field>
          <Field label={t.mobileNumber} hint={t.mobileHint}><input value={f.phone} onChange={(e) => upd("phone", e.target.value)} className={field} type="tel" autoComplete="off" placeholder="050 123 4567" dir="ltr" /></Field>
        </div>
        <div>
          <p className="mb-2 text-[14px] font-medium">{t.preferredChannel}</p>
          <Choice
            value={f.channel}
            onPick={(v) => upd("channel", v)}
            cols={3}
            options={CHANNELS.map((c) => ({ key: c.key as Form["channel"], label: c.label[activeLang] }))}
          />
          <p className="mt-2 text-[13px] text-muted">{t.channelHint}</p>
        </div>
        {isUrgentEscalation && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t.age} error={err("age")} hint={t.ageUrgentHint}><input value={f.age} onChange={(e) => upd("age", e.target.value)} className={field} inputMode="numeric" dir="ltr" /></Field>
            <Field label={t.schooling} error={err("years")}><input value={f.years} onChange={(e) => upd("years", e.target.value)} className={field} inputMode="numeric" dir="ltr" /></Field>
          </div>
        )}
      </Section>
    );
  } else if (key === "profile") {
    content = (
      <Section title={t.profileTitle} sub={t.profileSub}>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label={t.age} error={err("age")} hint={t.ageHint}><input value={f.age} onChange={(e) => upd("age", e.target.value)} className={field} inputMode="numeric" dir="ltr" /></Field>
          <Field label={t.sex}>
            <select value={f.sex} onChange={(e) => upd("sex", e.target.value as Form["sex"])} className={field}><option value="F">{t.sexF}</option><option value="M">{t.sexM}</option></select>
          </Field>
          <Field label={t.schooling} error={err("years")} hint={band ? <>{t.normGroup} <b className="font-semibold text-ink">{EDUCATION_MAP[band]?.[activeLang] ?? EDUCATION_LABEL[band]}</b></> : t.schoolingZeroHint}>
            <input value={f.years} onChange={(e) => upd("years", e.target.value)} className={field} inputMode="numeric" dir="ltr" />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t.sessionLang}>
            <select value={f.language} onChange={(e) => upd("language", e.target.value as Lang)} className={field}><option value="ar">{t.langAr}</option><option value="en">{t.langEn}</option></select>
          </Field>
          <Field label={t.dialect} hint={t.dialectHint}>
            <select value={f.dialect} onChange={(e) => upd("dialect", e.target.value)} className={field}>{DIALECTS.map((d) => <option key={d.key} value={d.key}>{d.label[activeLang]}</option>)}</select>
          </Field>
          <Field label={t.emirate} hint={t.emirateHint}>
            <select value={f.emirate} onChange={(e) => upd("emirate", e.target.value)} className={field}>{EMIRATES.map((d) => <option key={d.key} value={d.key}>{d.label[activeLang]}</option>)}</select>
          </Field>
          <Field label={t.funding} hint={t.fundingHint}>
            <select value={f.funding} onChange={(e) => upd("funding", e.target.value)} className={field}>
              {Object.entries(NAV.funding).map(([k, v]) => (
                <option key={k} value={k}>{FUNDING_LABELS[k]?.[activeLang] ?? v}</option>
              ))}
            </select>
          </Field>
          <Field label={t.hospital} hint={t.hospitalHint}>
            <select value={f.hospital_id} onChange={(e) => upd("hospital_id", e.target.value)} className={field}>
              {HOSPITALS.map((h) => (
                <option key={h.id} value={h.id}>{h[activeLang]}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <CheckRow on={f.hearingAid} onChange={(v) => upd("hearingAid", v)}>{t.hearingAid}</CheckRow>
          <CheckRow on={f.glasses} onChange={(v) => upd("glasses", v)}>{t.readingGlasses}</CheckRow>
        </div>
        <div>
          <p className="mb-2 text-[14px] font-medium">{t.digitalComfort}</p>
          <Choice
            value={f.digital}
            onPick={(v) => upd("digital", v)}
            cols={3}
            options={DIGITAL_OPTIONS.map((d) => ({ key: d.key as Form["digital"], label: d.label[activeLang] }))}
          />
          {f.digital === "none" && <p className="mt-2 text-[13.5px] text-body">{t.digitalNoneHint}</p>}
        </div>
      </Section>
    );
  } else if (key === "consent") {
    content = (
      <Section title={t.consentTitle} sub={t.consentSub}>
        <div className="divide-y divide-line rounded-2xl border border-line">
          {CONSENT.map((c) => {
            const on = !!f.consent[c.key];
            const text = activeLang === "ar" ? c.ar : c.en;
            return (
              <div key={c.key} className="flex items-start gap-3.5 px-4 py-3.5">
                <input type="checkbox" checked={on} onChange={(e) => upd("consent", { ...f.consent, [c.key]: e.target.checked })} aria-label={c.title[activeLang]} className="mt-1 h-[18px] w-[18px] shrink-0 accent-[#0f3f2c]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{c.title[activeLang]}</p>
                  <p className="mt-0.5 text-[14px] leading-snug text-body">{activeLang === "ar" ? c.ar : c.en}</p>
                  {activeLang === "en" && <p dir="rtl" lang="ar" className="mt-1 text-[15px] leading-[1.7] text-muted">{c.ar}</p>}
                  {activeLang === "ar" && <p dir="ltr" lang="en" className="mt-1 text-[13.5px] leading-[1.6] text-muted">{c.en}</p>}
                </div>
                <button type="button" onClick={() => read(c.key, text)} aria-label={t.readAloud(c.title[activeLang])} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${reading === c.key ? "border-deep bg-mist text-deep" : "border-line bg-white text-body hover:bg-paper"}`}>
                  <Volume2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[13px] text-muted">{t.consentVersionNote(CONSENT_VERSION)}</p>
      </Section>
    );
  } else if (key === "informant") {
    const helper = f.infType === "household_helper";
    content = (
      <Section title={t.informantTitle} sub={t.informantSub}>
        <Choice
          value={f.infType}
          onPick={(v) => upd("infType", v)}
          cols={3}
          options={INFORMANT_TYPES.map((i) => ({ key: i.key as Form["infType"], label: i.label[activeLang] }))}
        />
        {f.infType === "family" && !f.consent.caregiver_involvement && <Note tone="warn">{t.familyConsentWarn}</Note>}
        {helper && (
          <>
            <Note>{t.helperNote}</Note>
            <CheckRow on={f.helperConsent} onChange={(v) => upd("helperConsent", v)}>{t.helperAgree}</CheckRow>
            <Field label={t.helperLang}>
              <select value={f.infLanguage} onChange={(e) => upd("infLanguage", e.target.value)} className={field}>
                {Object.entries(NAV.languages).map(([k, v]) => (
                  <option key={k} value={k}>{NAV_LANGUAGES_MAP[k]?.[activeLang] ?? v}</option>
                ))}
              </select>
            </Field>
          </>
        )}
        {f.infType !== "none" && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t.informantName} hint={t.keptInVault}><input value={f.infName} onChange={(e) => upd("infName", e.target.value)} className={field} autoComplete="off" dir="auto" /></Field>
              <Field label={t.relation}>
                <select value={f.infRelation} onChange={(e) => upd("infRelation", e.target.value)} className={field}><option value="">{t.choose}</option>{RELATIONS.map(([k, v]) => <option key={k} value={k}>{v[activeLang]}</option>)}</select>
              </Field>
              <Field label={t.mobileNumber} hint={t.keptInVault}><input value={f.infPhone} onChange={(e) => upd("infPhone", e.target.value)} className={field} type="tel" autoComplete="off" dir="ltr" /></Field>
              <Field label={t.iqcodeLabel} error={err("iqcode")} hint={t.iqcodeHint(config.IQCODE_CUTOFF)}>
                <input value={f.iqcode} onChange={(e) => upd("iqcode", e.target.value)} className={field} inputMode="decimal" placeholder="3.1" dir="ltr" />
              </Field>
            </div>
            <div>
              <p className="text-[14px] font-medium">{t.timelineTitle}</p>
              <p className="mb-2 text-[13.5px] text-body">{t.timelineSub}</p>
              <div className="space-y-2.5">
                {f.timeline.map((it, i) => {
                  const set = (k: keyof InformantChange, v: string) => upd("timeline", f.timeline.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
                  return (
                    <div key={i} className="grid gap-2 rounded-xl border border-line bg-paper/60 p-3 sm:grid-cols-[1.1fr_1.4fr_0.9fr_1fr_1.2fr_auto]">
                      <select value={it.activity_key} onChange={(e) => set("activity_key", e.target.value)} className={field} aria-label={t.colActivity}>{Object.keys(ACTIVITY).map((k) => <option key={k} value={k}>{label(ACTIVITY, k, activeLang)}</option>)}</select>
                      <input value={it.change} onChange={(e) => set("change", e.target.value)} className={field} placeholder={t.colChange} dir="auto" />
                      <input value={it.when} onChange={(e) => set("when", e.target.value)} className={field} placeholder={t.colWhen} dir="auto" />
                      <input value={it.who_took_over} onChange={(e) => set("who_took_over", e.target.value)} className={field} placeholder={t.colWhoTookOver} dir="auto" />
                      <select value={it.why} onChange={(e) => set("why", e.target.value)} className={field} aria-label={t.colWhy}>{WHY.map((w) => <option key={w.key} value={w.key}>{w.label[activeLang]}</option>)}</select>
                      <button type="button" onClick={() => upd("timeline", f.timeline.filter((_, j) => j !== i))} aria-label={t.removeChange} className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-body hover:bg-paper"><X size={16} /></button>
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={() => upd("timeline", [...f.timeline, { activity_key: "money", change: "", when: "", who_took_over: "", why: WHY[0].key }])} className={`${btnClass.secondary} mt-2.5`}>
                <Plus size={16} /> {t.addChange}
              </button>
            </div>
          </>
        )}
      </Section>
    );
  } else if (key === "health") {
    content = (
      <Section title={t.healthTitle} sub={t.healthSub}>
        {!f.consent.clinical_record && <Note tone="warn">{t.healthNoConsentWarn}</Note>}
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label={t.bp}>
            <div className="flex items-center gap-2">
              <input value={f.sbp} onChange={(e) => upd("sbp", e.target.value)} className={field} inputMode="numeric" placeholder="130" aria-label={t.systolicAria} dir="ltr" />
              <span className="text-muted">/</span>
              <input value={f.dbp} onChange={(e) => upd("dbp", e.target.value)} className={field} inputMode="numeric" placeholder="80" aria-label={t.diastolicAria} dir="ltr" />
            </div>
          </Field>
          <Field label={t.hba1c}><input value={f.hba1c} onChange={(e) => upd("hba1c", e.target.value)} className={field} inputMode="decimal" placeholder="6.1" dir="ltr" /></Field>
          <Field label={t.ldl}><input value={f.ldl} onChange={(e) => upd("ldl", e.target.value)} className={field} inputMode="decimal" placeholder="3.0" dir="ltr" /></Field>
          <Field label={t.bmi}><input value={f.bmi} onChange={(e) => upd("bmi", e.target.value)} className={field} inputMode="decimal" placeholder="28" dir="ltr" /></Field>
          <Field label={t.activityMin}><input value={f.activity} onChange={(e) => upd("activity", e.target.value)} className={field} inputMode="numeric" placeholder="90" dir="ltr" /></Field>
          <Field label={t.district} hint={t.districtHint}><input value={f.district} onChange={(e) => upd("district", e.target.value)} className={field} placeholder={activeLang === "ar" ? "العين" : "Al Ain"} dir="auto" /></Field>
        </div>
        <div>
          <p className="mb-2 text-[14px] font-medium">{t.knownConditions}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CONDITIONS.map(([k, v]) => <CheckRow key={k} on={!!f.cond[k]} onChange={(on) => upd("cond", { ...f.cond, [k]: on })}>{v[activeLang]}</CheckRow>)}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[14px] font-medium">{t.lifestyleFamily}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <CheckRow on={f.smoker} onChange={(v) => upd("smoker", v)}>{t.smokes}</CheckRow>
            <CheckRow on={f.isolated} onChange={(v) => upd("isolated", v)}>{t.isolated}</CheckRow>
            {f.consent.family_history && <CheckRow on={f.famHistory} onChange={(v) => upd("famHistory", v)}>{t.famHistory}</CheckRow>}
          </div>
        </div>
        {f.consent.genomics && (
          <Field label={t.apoeLabel} hint={t.apoeHint}>
            <select value={f.apoe} onChange={(e) => upd("apoe", e.target.value)} className={field}>
              <option value="">{t.apoeNone}</option>{["e3/e3", "e2/e3", "e3/e4", "e4/e4"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </Field>
        )}
      </Section>
    );
  } else {
    const plan: [string, string, string][] = activeLang === "ar" ? [
      [t.planBaseline1, `${fmtDateLang(DEMO_TODAY, "ar")} (اليوم، بحضوركم)`, t.planBaseline1Desc],
      [t.planBaseline2, fmtDateLang(addDays(DEMO_TODAY, 14), "ar"), t.planBaseline2Desc],
      [t.planFollowUp, fmtDateLang(addDays(DEMO_TODAY, 84), "ar"), t.planFollowUpDesc],
      [t.planRoutine, t.planRoutineDate, t.planRoutineDesc],
    ] : [
      [t.planBaseline1, `${fmtDate(DEMO_TODAY)} (today, with you)`, t.planBaseline1Desc],
      [t.planBaseline2, fmtDate(addDays(DEMO_TODAY, 14)), t.planBaseline2Desc],
      [t.planFollowUp, fmtDate(addDays(DEMO_TODAY, 84)), t.planFollowUpDesc],
      [t.planRoutine, t.planRoutineDate, t.planRoutineDesc],
    ];
    const consented = CONSENT.filter((c) => f.consent[c.key]);
    const dialectLabel = DIALECTS.find((d) => d.key === f.dialect)?.label[activeLang] ?? f.dialect;
    const sexLabel = f.sex === "F" ? t.sexF : t.sexM;
    const yearsLabel = activeLang === "ar" ? (age != null ? `${numAr(age)} سنة` : "–") : (age != null ? `${age} y` : "–");
    const eduBandLabel = band ? (EDUCATION_MAP[band]?.[activeLang] ?? EDUCATION_LABEL[band]) : "–";

    const rows: [string, ReactNode][] = [
      [t.summaryPerson, <>{f.name || "–"} · {yearsLabel} · {sexLabel} · {eduBandLabel} · {dialectLabel}</>],
      [t.summaryCame, ROUTES.find((r) => r.key === f.route)?.label[activeLang] ?? f.route],
      [t.summaryConcern, f.text.trim() || t.summaryNoneRecorded],
      [t.summaryChannel, (CHANNELS.find((c) => c.key === f.channel)?.label[activeLang] ?? f.channel) + (f.digital === "none" ? ` · ${t.summaryFamilyHelp}` : "")],
      [t.summaryConsent, consented.length ? consented.map((c) => c.title[activeLang]).join(activeLang === "ar" ? "، " : ", ") : t.summaryNone],
      [t.summaryInformant, f.infType === "none" ? t.summaryNoInformant : `${f.infName || (activeLang === "ar" ? "لم يُذكر الاسم" : "Name not given")} (${RELATIONS.find(([k]) => k === f.infRelation)?.[1][activeLang] ?? (activeLang === "ar" ? "لم تُحدد الصلة" : "relation not set")})`],
      [t.summaryConditions, CONDITIONS.filter(([k]) => f.cond[k]).map(([, v]) => v[activeLang]).join(activeLang === "ar" ? "، " : ", ") || t.summaryNoneCond],
    ];
    content = (
      <Section title={t.reviewTitle} sub={t.reviewSub}>
        <dl className="divide-y divide-line rounded-2xl border border-line text-[15px]">
          {rows.map(([k, v]) => (
            <div key={k} className="px-4 py-2.5 xl:grid xl:grid-cols-[160px_1fr] xl:gap-3">
              <dt className="text-[13px] text-muted xl:text-[15px]">{k}</dt>
              <dd className="break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="mb-2 text-[14px] font-medium">{t.sessionPlan}</p>
          <div className="overflow-hidden rounded-2xl border border-line">
            {plan.map(([a, b, c]) => (
              <div key={a} className="grid grid-cols-[110px_1fr] gap-3 border-b border-line px-4 py-2.5 text-[14.5px] last:border-0 sm:grid-cols-[130px_200px_1fr]">
                <span className="font-semibold">{a}</span>
                <span>{b}</span>
                <span className="col-span-2 text-[13.5px] text-body sm:col-span-1">{c}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted">{t.planReminder(CHANNELS.find((c) => c.key === f.channel)?.label[activeLang] ?? f.channel)}</p>
        </div>
      </Section>
    );
  }

  const isLast = step === STEPS.length - 1;
  const primaryLabel = isUrgentEscalation && key === "concern"
    ? t.btnEscalateIdentity
    : isUrgentEscalation && key === "identity"
    ? t.btnEscalateSubmit
    : isLast
    ? (embedded ? t.btnEnrolCheckin : t.btnEnrolId)
    : t.btnContinue;

  return (
    <div dir={activeLang === "ar" ? "rtl" : "ltr"} lang={activeLang} className="space-y-6">
      {embedded && (
        <div className="rounded-2xl border border-line bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgb(15_35_40/0.05)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-leaf">
            {t.embeddedEyebrow}
          </p>
          <h2 className="mt-1 font-serif text-[24px] font-semibold tracking-[-0.015em] sm:text-[28px]">
            {title || t.embeddedTitle}
          </h2>
          <p className="mt-1 text-[14.5px] leading-snug text-body">
            {sub || t.embeddedSub}
          </p>
        </div>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Steps */}
        <nav aria-label="Enrolment steps" className="-mx-1 overflow-x-auto lg:mx-0 lg:overflow-visible">
          <ol className="flex gap-2 px-1 lg:flex-col lg:gap-1 lg:rounded-2xl lg:border lg:border-[#ebece8] lg:bg-white lg:p-3">
            {STEPS.map((s, i) => {
              const doneStep = i < step;
              const cur = i === step;
              const skipped = isUrgentEscalation && i > 1;
              const I = s.icon;
              return (
                <li key={s.key} className="shrink-0">
                  <button type="button" onClick={() => goTo(i)} disabled={skipped} aria-current={cur ? "step" : undefined}
                    className={`flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-start text-[14.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${cur ? "bg-[#eef4ef] font-semibold text-deep" : "text-body hover:bg-paper"}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12.5px] font-semibold ${cur ? "bg-deep text-white" : doneStep ? "bg-[#dfeae2] text-deep" : "bg-[#f0f1ee] text-muted"}`}>
                      {doneStep ? <Check size={14} strokeWidth={3} /> : <I size={14} />}
                    </span>
                    {s.title[activeLang]}
                  </button>
                </li>
              );
            })}
          </ol>
          {isUrgentEscalation && <p className="mt-2 hidden px-2 text-[13px] leading-snug text-lv-urgent lg:block">{t.urgentSkippedHint}</p>}
        </nav>

        {/* The step */}
        <section className="rounded-2xl border border-[#ebece8] bg-white">
          <div className="px-5 py-6 sm:px-8 sm:py-7">{content}</div>
          {error && <div className="px-5 pb-4 sm:px-8"><Note tone="urgent">{error}</Note></div>}
          <div className="flex items-center gap-3 border-t border-line px-5 py-4 sm:px-8">
            {step > 0 && (
              <button type="button" onClick={() => { setTried(false); setStep(step - 1); toTop(); }} className={btnClass.secondary}>
                <ArrowLeft size={16} className="rtl:-scale-x-100" /> {t.btnBack}
              </button>
            )}
            <span className="ms-auto hidden text-[13px] text-muted sm:block">{t.stepOf(step + 1, STEPS.length)}</span>
            <button type="button" onClick={next} disabled={busy}
              className={`${isUrgentEscalation && (key === "concern" || key === "identity") ? btnClass.danger : btnClass.primary} min-w-[180px] ${step === 0 ? "ms-auto sm:ms-0" : ""}`}>
              {busy ? <Loader2 size={17} className="animate-spin" /> : null}
              {primaryLabel} {!busy && !isLast && !(isUrgentEscalation && key === "identity") && <ArrowRight size={16} className="rtl:-scale-x-100" />}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Standalone View in Clinician Workspace ── */

function EnrolViewContent({ defaultLang }: { defaultLang?: Lang }) {
  const { mode } = useWorkspace();
  const searchParams = useSearchParams();
  const qLang = searchParams?.get("lang") as Lang | null;

  const [lang, setLangState] = useState<Lang>(() => {
    if (qLang === "ar" || qLang === "en") return qLang;
    if (defaultLang) return defaultLang;
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("membrain.app.lang");
        if (stored === "ar" || stored === "en") return stored as Lang;
      } catch {}
    }
    return "ar";
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      const u = new URL(window.location.href);
      if (l === "ar") u.searchParams.set("lang", "ar");
      else u.searchParams.delete("lang");
      window.history.replaceState(null, "", u.toString());
      window.localStorage.setItem("membrain.app.lang", l);
    } catch {}
  };

  const t = COPY[lang];

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="space-y-6">
      <PageHeader
        title={t.headerTitle}
        sub={t.headerSub}
        aside={
          <div className="flex items-center gap-3">
            {mode === "browser" && (
              <span className="hidden rounded-2xl border border-[#ececea] bg-white px-3.5 py-1.5 text-[13.5px] text-body sm:inline-block">
                {t.demoBrowser}
              </span>
            )}
            <div className="flex rounded-full bg-mist p-1" role="group" aria-label="Language">
              {(["en", "ar"] as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  lang={l}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    lang === l ? "bg-white text-deep shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {l === "en" ? "English" : "عربي"}
                </button>
              ))}
            </div>
          </div>
        }
      />
      <EnrolForm lang={lang} initialLang={lang} />
    </div>
  );
}

export function EnrolView({ defaultLang }: { defaultLang?: Lang }) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-paper" />}>
      <EnrolViewContent defaultLang={defaultLang} />
    </Suspense>
  );
}

function UrgentNote({ flags, short = false, lang = "en" }: { flags: string[]; short?: boolean; lang?: Lang }) {
  const t = COPY[lang];
  return (
    <Note tone="urgent">
      <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> {t.acuteTitle}</p>
      {!short && <p className="mt-1">{t.acuteBody}</p>}
      <ul className="mt-1.5 list-disc ps-5">{flags.map((f) => <li key={f}>{RED_FLAGS_MAP[f]?.[lang] ?? RED_FLAGS[f] ?? f}</li>)}</ul>
    </Note>
  );
}

function Done({ done, urgent, lang, onAgain }: { done: EnrolDone; urgent: boolean; lang: Lang; onAgain: () => void }) {
  const t = COPY[lang];
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="mx-auto max-w-[680px] space-y-5 pt-4">
      {urgent && (
        <Note tone="urgent">
          <p className="font-semibold">{t.doneUrgentTitle}</p>
          <p className="mt-0.5">{t.doneUrgentBody}</p>
        </Note>
      )}
      <div className="rounded-2xl border border-[#ebece8] bg-white px-6 py-9 text-center sm:px-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-deep text-white shadow-[0_14px_34px_-14px_rgb(15_63_44/0.65)]"><Check size={30} strokeWidth={2.6} /></span>
        <h2 className="mt-5 font-serif text-[30px] font-semibold tracking-[-0.015em]">{t.doneTitle}</h2>
        <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-leaf">{t.doneIdLabel}</p>
        <p className="mt-1 font-mono text-[34px] font-semibold tracking-[0.04em] text-deep" dir="ltr">{done.id}</p>
        <p className="mx-auto mt-3 max-w-[480px] text-[14.5px] leading-snug text-body">
          {t.doneDesc(done.id, Boolean(done.phone_linked))}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          {!urgent && (
            <Link
              href={`/checkin/?id=${encodeURIComponent(done.id)}${done.registered_name ? `&name=${encodeURIComponent(done.registered_name)}` : ""}&lang=${lang}`}
              className={btnClass.primary}
            >
              <Mic size={16} /> {t.btnStartBaseline}
            </Link>
          )}
          <Link href={caseHref(done.id)} className={urgent ? btnClass.danger : btnClass.secondary}><Stethoscope size={16} /> {t.btnOpenCase}</Link>
          <button type="button" onClick={onAgain} className={btnClass.secondary}><Plus size={16} /> {t.btnEnrolAnother}</button>
        </div>
      </div>
    </div>
  );
}
