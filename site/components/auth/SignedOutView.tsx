"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  HeartHandshake,
  Home,
  Lock,
  LogIn,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Logo } from "../Logo";
import type { Lang } from "@/lib/mb";

const T = {
  en: {
    title: "You've been safely signed out",
    subtitle: "All session data and health records have been cleared from this browser.",
    desc: "Your session has ended. In accordance with clinical privacy standards, all temporary audio recordings, cached patient identifiers, and credentials were completely erased. This device is safe for another person to use.",
    returnHome: "Return to Homepage",
    signInAgain: "Sign in again",
    signInClinician: "Sign in as Clinician",
    signInPatient: "Sign in with Mobile Number",
    switchPatient: "Looking for patient check-in? Sign in with phone",
    switchClinician: "Are you clinical staff? Sign in to Clinician Portal",
    patientOption: "Patient or family sign-in",
    clinicianOption: "Clinical staff sign-in",
    securityBadge: "Zero Trace Left · Device Cleared",
    footerNote: "MemBrain · Spoken brain health check-in · UAE",
  },
  ar: {
    title: "تم تسجيل خروجك بأمان",
    subtitle: "تم مسح كافة بيانات الجلسة والسجلات الصحية من هذا المتصفح تمامًا.",
    desc: "انتهت جلستك. وتماشيًا مع معايير الخصوصية السريرية، تم حذف جميع التسجيلات الصوتية المؤقتة والبيانات المحفوظة وبيانات الاعتماد بالكامل من هذا الجهاز. الجهاز آمن تمامًا لاستخدام شخص آخر.",
    returnHome: "العودة إلى الصفحة الرئيسية",
    signInAgain: "تسجيل الدخول مجددًا",
    signInClinician: "تسجيل الدخول ككادر طبي",
    signInPatient: "تسجيل الدخول برقم الهاتف",
    switchPatient: "ترغب في فحص المريض أو الأسرة؟ سجّل الدخول بالهاتف",
    switchClinician: "من الكادر الطبي؟ سجّل الدخول إلى بوابة العيادة",
    patientOption: "دخول المرضى والعائلات",
    clinicianOption: "دخول الكادر الطبي",
    securityBadge: "لا أثر باقٍ · الجهاز آمن تمامًا",
    footerNote: "MemBrain · فحص صحة الدماغ الصوتي · دولة الإمارات",
  },
};

export function SignedOutView() {
  const params = useSearchParams();
  const initialLang: Lang = params.get("lang") === "ar" ? "ar" : "en";
  const [lang, setLang] = useState<Lang>(initialLang);

  const roleParam = params.get("role");
  const role: "clinician" | "participant" | null =
    roleParam === "clinician" || roleParam === "coordinator"
      ? "clinician"
      : roleParam === "participant"
      ? "participant"
      : null;

  const t = T[lang];

  // Route paths relative to Next.js app root.
  // Next.js <Link> automatically handles basePath (/membrain on GitHub Pages).
  const homeRoute = lang === "ar" ? "/ar/" : "/";
  const patientSignInRoute = lang === "ar" ? "/signin/patient/?lang=ar" : "/signin/patient/";
  const clinicianSignInRoute = "/signin/clinician/";

  const primarySignInRoute =
    role === "clinician"
      ? clinicianSignInRoute
      : role === "participant"
      ? patientSignInRoute
      : lang === "ar"
      ? patientSignInRoute
      : "/signin/";

  const primarySignInLabel =
    role === "clinician"
      ? t.signInClinician
      : role === "participant"
      ? t.signInPatient
      : t.signInAgain;

  const PrimaryIcon = role === "clinician" ? Stethoscope : role === "participant" ? HeartHandshake : LogIn;

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="flex min-h-dvh flex-col justify-between bg-paper px-4 py-8 sm:px-6">
      {/* Top Bar with Logo & Language Toggle */}
      <header className="mx-auto flex w-full max-w-[580px] items-center justify-between">
        <Link href={homeRoute} aria-label="MemBrain home">
          <Logo size="md" />
        </Link>
        <div className="flex rounded-full bg-mist p-1" role="group" aria-label="Language">
          {(["en", "ar"] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${
                lang === l ? "bg-white text-deep shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {l === "en" ? "English" : "عربي"}
            </button>
          ))}
        </div>
      </header>

      {/* Main Signed Out Card */}
      <main className="mx-auto w-full max-w-[580px] py-10">
        <div className="rounded-[28px] border border-line bg-white p-7 text-center shadow-[0_12px_36px_-16px_rgb(15_35_40/0.12)] sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e6f4ec] text-[#227b52] shadow-sm">
            <ShieldCheck size={36} strokeWidth={2.2} />
          </div>

          <div className="mt-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-bold text-emerald-800">
              <CheckCircle2 size={13} className="text-emerald-700" />
              {t.securityBadge}
            </span>
          </div>

          <h1 className="mt-4 font-serif text-[27px] font-semibold tracking-[-0.015em] text-ink sm:text-[32px]">
            {t.title}
          </h1>
          <p className="mt-2 text-[15.5px] font-medium text-deep">{t.subtitle}</p>
          <p className="mt-3 text-[14px] leading-relaxed text-body">{t.desc}</p>

          {/* Action Buttons */}
          <div className="mt-8 space-y-3">
            <Link
              href={homeRoute}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-deep text-[16px] font-semibold text-white shadow-[0_10px_24px_-10px_rgb(15_63_44/0.7)] hover:bg-deep-hover transition-colors"
            >
              <Home size={18} />
              <span>{t.returnHome}</span>
            </Link>

            <Link
              href={primarySignInRoute}
              className="flex h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white text-[14.5px] font-medium text-ink hover:bg-paper transition-colors"
            >
              <PrimaryIcon size={16} />
              <span>{primarySignInLabel}</span>
            </Link>

            {/* Smart Secondary Navigation based on role */}
            {role === "clinician" ? (
              <div className="pt-2">
                <Link
                  href={patientSignInRoute}
                  className="text-[13px] font-medium text-muted hover:text-deep transition-colors underline-offset-4 hover:underline"
                >
                  {t.switchPatient}
                </Link>
              </div>
            ) : role === "participant" ? (
              <div className="pt-2">
                <Link
                  href={clinicianSignInRoute}
                  className="text-[13px] font-medium text-muted hover:text-deep transition-colors underline-offset-4 hover:underline"
                >
                  {t.switchClinician}
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-[13px]">
                <Link
                  href={patientSignInRoute}
                  className="font-medium text-muted hover:text-deep transition-colors underline-offset-4 hover:underline"
                >
                  {t.patientOption}
                </Link>
                <span className="text-line" aria-hidden="true">·</span>
                <Link
                  href={clinicianSignInRoute}
                  className="font-medium text-muted hover:text-deep transition-colors underline-offset-4 hover:underline"
                >
                  {t.clinicianOption}
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Footer Note */}
      <footer className="mx-auto flex w-full max-w-[580px] items-center justify-center gap-2 text-center text-[12px] text-muted">
        <Lock size={12} />
        <span>{t.footerNote}</span>
      </footer>
    </div>
  );
}
