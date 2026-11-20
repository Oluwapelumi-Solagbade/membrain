"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Home, Lock, LogIn, ShieldCheck } from "lucide-react";
import { Logo, Mark } from "../Logo";
import type { Lang } from "@/lib/mb";
import { getHomeUrl } from "@/lib/auth";

const T = {
  en: {
    title: "You've been safely signed out",
    subtitle: "All session data and health records have been cleared from this browser.",
    desc: "Your session has ended. In accordance with clinical privacy standards, all temporary audio recordings, cached patient identifiers, and credentials were completely erased. This device is safe for another person to use.",
    returnHome: "Return to Homepage",
    signInAgain: "Sign in again",
    securityBadge: "Zero Trace Left · Device Cleared",
    footerNote: "MemBrain · Spoken brain health check-in · UAE",
  },
  ar: {
    title: "تم تسجيل خروجك بأمان",
    subtitle: "تم مسح كافة بيانات الجلسة والسجلات الصحية من هذا المتصفح تمامًا.",
    desc: "انتهت جلستك. وتماشيًا مع معايير الخصوصية السريرية، تم حذف جميع التسجيلات الصوتية المؤقتة والبيانات المحفوظة وبيانات الاعتماد بالكامل من هذا الجهاز. الجهاز آمن تمامًا لاستخدام شخص آخر.",
    returnHome: "العودة إلى الصفحة الرئيسية",
    signInAgain: "تسجيل الدخول مجددًا",
    securityBadge: "لا أثر باقٍ · الجهاز آمن تمامًا",
    footerNote: "MemBrain · فحص صحة الدماغ الصوتي · دولة الإمارات",
  },
};

export function SignedOutView() {
  const params = useSearchParams();
  const initialLang: Lang = params.get("lang") === "ar" ? "ar" : "en";
  const [lang, setLang] = useState<Lang>(initialLang);

  const t = T[lang];
  const homeHref = getHomeUrl(lang);
  const base = typeof window !== "undefined" && window.location.pathname.startsWith("/membrain") ? "/membrain" : "";
  const signInHref = lang === "ar" ? `${base}/signin/patient/?lang=ar` : `${base}/signin/`;

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="flex min-h-dvh flex-col justify-between bg-paper px-4 py-8 sm:px-6">
      {/* Top Bar with Logo & Language Toggle */}
      <header className="mx-auto flex w-full max-w-[580px] items-center justify-between">
        <Link href={homeHref} aria-label="MemBrain home">
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
              href={homeHref}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-deep text-[16px] font-semibold text-white shadow-[0_10px_24px_-10px_rgb(15_63_44/0.7)] hover:bg-deep-hover transition-colors"
            >
              <Home size={18} />
              <span>{t.returnHome}</span>
            </Link>

            <Link
              href={signInHref}
              className="flex h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white text-[14.5px] font-medium text-ink hover:bg-paper transition-colors"
            >
              <LogIn size={16} />
              <span>{t.signInAgain}</span>
            </Link>
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
