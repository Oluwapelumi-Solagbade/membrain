"use client";

// The landing page header: slim and translucent, it gains a shadow once you scroll, and the link for the section on
// screen is highlighted. On phones the menu opens as a full-screen panel with the main actions at hand.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Globe,
  HeartHandshake,
  LogOut,
  Menu,
  Phone,
  Smartphone,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import type { Lang } from "@/lib/mb";
import { APK_URL } from "@/lib/app";
import { useSession, signOutAndGoHome } from "@/lib/auth";
import { LANDING } from "./landing/copy";
import { Logo } from "./Logo";

const EXTRA: Record<
  Lang,
  {
    app: string;
    appSub: string;
    emergency: string;
    menu: string;
    clinicianSub: string;
    signInSub: string;
    myLifeSub: string;
  }
> = {
  en: {
    app: "Get the Android app",
    appSub: "For clinicians and families",
    emergency: "Emergency? Call 998",
    menu: "Navigation",
    clinicianSub: "Review queue, referrals, programme",
    signInSub: "See your results and plan",
    myLifeSub: "Person-centred story and hospital care card",
  },
  ar: {
    app: "حمّل تطبيق أندرويد",
    appSub: "للأطباء والعائلات",
    emergency: "طوارئ؟ اتصل على ٩٩٨",
    menu: "القائمة",
    clinicianSub: "قائمة المراجعة والإحالات والبرنامج",
    signInSub: "اطّلع على نتائجك وخطتك",
    myLifeSub: "قصة حياتك والروتين المهدئ لطواقم المستشفى",
  },
};

export function SiteHeader({ lang = "en" }: { lang?: Lang }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [menuTop, setMenuTop] = useState(64);
  const bar = useRef<HTMLElement | null>(null);
  const t = LANDING[lang];
  const x = EXTRA[lang];
  const other = t.switchLang as Lang;
  const signInHref = lang === "ar" ? "/signin/patient/?lang=ar" : "/signin/";
  const close = () => setOpen(false);
  const { session, ready } = useSession();
  const user = ready ? session?.user : null;

  const handleSignOut = async () => {
    close();
    await signOutAndGoHome(lang);
  };

  const toggle = () => {
    if (!open && bar.current) setMenuTop(Math.round(bar.current.getBoundingClientRect().bottom));
    setOpen(!open);
  };

  // Shadow once the page has scrolled
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Highlight the section on screen
  useEffect(() => {
    const ids = t.nav.map((n) => n.href.replace("#", ""));
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        let best: string | null = null,
          max = 0;
        for (const [id, r] of seen) {
          if (r > max) {
            max = r;
            best = id;
          }
        }
        setActive(best);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.01, 0.25, 0.5, 1] }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [t.nav]);

  // Lock scroll on mobile drawer open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", k);
    };
  }, [open]);

  return (
    <>
      <header
        ref={bar}
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled || open
            ? "border-b border-black/[0.07] bg-white/90 shadow-[0_4px_24px_-12px_rgb(15_35_30/0.18)] backdrop-blur-xl"
            : "border-b border-transparent bg-white/75 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1340px] items-center justify-between gap-4 px-4 sm:px-6 lg:h-[74px] lg:px-8">
          {/* Brand Logo */}
          <Link
            href={lang === "ar" ? "/ar/" : "/"}
            aria-label={t.home}
            onClick={close}
            className="shrink-0 transition-transform hover:scale-[1.02]"
          >
            <Logo size="md" priority className="lg:h-[32px]" />
          </Link>

          {/* Desktop Center Navigation Pills */}
          <nav
            aria-label="Main"
            className="hidden items-center gap-1 rounded-full border border-black/[0.06] bg-[#f4f6f3]/80 p-1 shadow-[0_2px_8px_-4px_rgb(0_0_0/0.05)] backdrop-blur-md lg:flex"
          >
            {t.nav.map((n) => {
              const on = active === n.href.slice(1);
              return (
                <a
                  key={n.href}
                  href={n.href}
                  aria-current={on ? "true" : undefined}
                  className={`rounded-full px-4 py-1.5 text-[14px] font-medium transition-all ${
                    on
                      ? "bg-deep text-white shadow-sm"
                      : "text-ink/80 hover:bg-white hover:text-ink"
                  }`}
                >
                  {n.label}
                </a>
              );
            })}
          </nav>

          {/* Desktop Right Action Area */}
          <div className="hidden items-center gap-2 lg:flex">
            {/* Language Switcher Pill */}
            <Link
              href={t.switchHref}
              lang={other}
              hrefLang={other}
              aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[13.5px] font-medium text-deep shadow-[0_1px_2px_rgb(0_0_0/0.04)] hover:border-leaf/40 hover:bg-mist transition-colors"
            >
              <Globe size={14} className="text-leaf" />
              <span>{t.switchLabel}</span>
            </Link>

            {user ? (
              <>
                <Link
                  href={user.role === "participant" ? (lang === "ar" ? "/checkin/?lang=ar" : "/checkin/") : "/clinician/"}
                  className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3.5 py-1.5 text-[14px] font-medium text-deep shadow-[0_1px_2px_rgb(0_0_0/0.04)] hover:border-leaf/40 hover:bg-mist transition-colors"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-deep text-white text-[10px] font-bold">
                    {user.role === "participant" ? <UserRound size={12} /> : <Stethoscope size={12} />}
                  </span>
                  <span className="max-w-[130px] truncate">
                    {user.name || (user.role === "participant" ? (lang === "ar" ? "فحصي" : "My Check-in") : (lang === "ar" ? "العيادة" : "Clinician View"))}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/90 bg-rose-50/70 px-3 py-1.5 text-[13px] font-medium text-rose-700 transition-colors hover:bg-rose-100 hover:text-rose-800"
                  title={lang === "ar" ? "تسجيل الخروج ومسح كافة البيانات" : "Sign out and leave no trace"}
                >
                  <LogOut size={14} className="rtl:-scale-x-100" />
                  <span>{lang === "ar" ? "تسجيل الخروج" : "Sign out"}</span>
                </button>
              </>
            ) : (
              <>
                {/* MyLife Link Pill */}
                <Link
                  href={lang === "ar" ? "/mylife/?lang=ar" : "/mylife/"}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/70 bg-amber-50/60 px-3 py-1.5 text-[13px] font-medium text-amber-900 transition-all hover:bg-amber-100/70 hover:border-amber-300"
                >
                  <HeartHandshake size={15} className="text-amber-700" />
                  <span>{lang === "ar" ? "ملف MyLife" : "MyLife"}</span>
                  <span className="rounded-full bg-amber-200/80 px-1.5 py-0.2 text-[9.5px] font-bold text-amber-900 uppercase tracking-wider">
                    {lang === "ar" ? "قريبًا" : "Coming Soon"}
                  </span>
                </Link>

                {/* Clinician Portal Link */}
                <Link
                  href="/clinician/"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-medium text-ink/85 transition-colors hover:bg-mist hover:text-ink"
                >
                  <Stethoscope size={15} className="text-deep/80" />
                  <span>{t.clinicianView}</span>
                  <ArrowUpRight size={13} className="text-muted rtl:-scale-x-100" />
                </Link>

                {/* Patient Sign In Link */}
                <Link
                  href={signInHref}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-medium text-ink/85 transition-colors hover:bg-mist hover:text-ink"
                >
                  <UserRound size={15} />
                  <span>{t.signIn}</span>
                </Link>
              </>
            )}

            {/* Primary CTA Button */}
            <Link
              href={t.concernHref}
              className="ms-1 inline-flex items-center gap-2 rounded-full bg-deep px-5 py-2.5 text-[14.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgb(15_63_44/0.75)] hover:shadow-[0_12px_28px_-8px_rgb(15_63_44/0.9)] hover:bg-deep-hover hover:-translate-y-0.5 transition-all"
            >
              <span>{t.raise}</span>
              <ArrowRight size={16} className="rtl:-scale-x-100" />
            </Link>
          </div>

          {/* Mobile Right Controls */}
          <div className="flex items-center gap-2 lg:hidden">
            <Link
              href={t.switchHref}
              lang={other}
              hrefLang={other}
              className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[13px] font-medium text-deep shadow-sm"
            >
              <Globe size={13} className="text-leaf" />
              <span>{t.switchLabel}</span>
            </Link>
            <button
              type="button"
              aria-label={open ? t.menuClose : t.menuOpen}
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={toggle}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                open ? "bg-deep text-white" : "bg-[#f1f3ef] text-ink hover:bg-mist"
              }`}
            >
              {open ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {open && (
        <div
          id="site-menu"
          className="mb-fade-in fixed inset-x-0 bottom-0 z-40 overflow-y-auto overscroll-contain bg-white lg:hidden"
          style={{ top: menuTop }}
        >
          <nav aria-label="Mobile" className="px-5 pb-10 pt-4">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
              {x.menu}
            </p>
            <ul>
              {t.nav.map((n) => (
                <li key={n.href}>
                  <a
                    href={n.href}
                    onClick={close}
                    className="flex items-center justify-between border-b border-line py-3.5 text-[17.5px] font-semibold tracking-[-0.01em] text-ink"
                  >
                    <span>{n.label}</span>
                    <ChevronRight size={18} className="text-muted rtl:-scale-x-100" />
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-5 grid gap-2.5">
              {user ? (
                <div className="rounded-2xl border border-line bg-[#f4f6f3] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-deep text-white shadow-sm">
                      {user.role === "participant" ? <UserRound size={20} /> : <Stethoscope size={20} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15.5px] font-semibold text-ink">
                        {user.name || (user.role === "participant" ? (lang === "ar" ? "مشارك مسجّل" : "Participant") : (lang === "ar" ? "طبيب مسجّل" : "Clinician"))}
                      </p>
                      <p className="truncate text-[12.5px] text-muted">
                        {user.role === "participant" ? (user.phone || (lang === "ar" ? "فحص صوتي" : "Voice check-in")) : (user.hospital_name || user.title || "Clinical Staff")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={user.role === "participant" ? (lang === "ar" ? "/checkin/?lang=ar" : "/checkin/") : "/clinician/"}
                      onClick={close}
                      className="flex-1 rounded-xl bg-deep py-2.5 text-center text-[14px] font-medium text-white shadow-sm hover:bg-deep-hover transition-colors"
                    >
                      {user.role === "participant" ? (lang === "ar" ? "ابدأ الفحص" : "Go to Check-in") : (lang === "ar" ? "مساحة العمل" : "Workspace")}
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[14px] font-medium text-rose-700 hover:bg-rose-100 transition-colors"
                    >
                      <LogOut size={16} className="rtl:-scale-x-100" />
                      <span>{lang === "ar" ? "تسجيل الخروج" : "Sign out"}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* MyLife Mobile Card */}
                  <Link
                    href={lang === "ar" ? "/mylife/?lang=ar" : "/mylife/"}
                    onClick={close}
                    className="flex items-center gap-3.5 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-3.5 transition-colors hover:bg-amber-100/70"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shadow-sm">
                      <HeartHandshake size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="block text-[15px] font-semibold text-ink">
                          {lang === "ar" ? "ملف MyLife للرعاية" : "MyLife Care Profile"}
                        </span>
                        <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                          {lang === "ar" ? "قريبًا" : "Coming Soon"}
                        </span>
                      </span>
                      <span className="block truncate text-[12.5px] text-body">{x.myLifeSub}</span>
                    </span>
                    <ChevronRight size={18} className="text-muted rtl:-scale-x-100" />
                  </Link>

                  {/* Clinician Card */}
                  <Link
                    href="/clinician/"
                    onClick={close}
                    className="flex items-center gap-3.5 rounded-2xl bg-[#f4f6f3] px-4 py-3.5 transition-colors hover:bg-mist"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-deep shadow-sm">
                      <Stethoscope size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15.5px] font-semibold">{t.clinicianView}</span>
                      <span className="block truncate text-[13px] text-muted">{x.clinicianSub}</span>
                    </span>
                    <ChevronRight size={18} className="text-muted rtl:-scale-x-100" />
                  </Link>

                  {/* Sign In Card */}
                  <Link
                    href={signInHref}
                    onClick={close}
                    className="flex items-center gap-3.5 rounded-2xl bg-[#f4f6f3] px-4 py-3.5 transition-colors hover:bg-mist"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-deep shadow-sm">
                      <UserRound size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15.5px] font-semibold">{t.signIn}</span>
                      <span className="block truncate text-[13px] text-muted">{x.signInSub}</span>
                    </span>
                    <ChevronRight size={18} className="text-muted rtl:-scale-x-100" />
                  </Link>
                </>
              )}

              {/* Android App Download */}
              <a
                href={APK_URL}
                className="flex items-center gap-3.5 rounded-2xl bg-[#f4f6f3] px-4 py-3.5 transition-colors hover:bg-mist"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-deep text-white">
                  <Smartphone size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15.5px] font-semibold">{x.app}</span>
                  <span className="block truncate text-[13px] text-muted">{x.appSub}</span>
                </span>
                <ArrowUpRight size={18} className="text-muted rtl:-scale-x-100" />
              </a>
            </div>

            {/* Primary Mobile Action Buttons */}
            <Link
              href={t.concernHref}
              onClick={close}
              className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-deep text-[16px] font-semibold text-white shadow-[0_12px_28px_-12px_rgb(15_63_44/0.8)]"
            >
              <span>{t.raise}</span>
              <ArrowRight size={18} className="rtl:-scale-x-100" />
            </Link>

            <a
              href="tel:998"
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-lv-urgent/25 bg-lv-urgent-soft/50 text-[15px] font-semibold text-lv-urgent transition-colors hover:bg-lv-urgent-soft"
            >
              <Phone size={16} />
              <span>{x.emergency}</span>
            </a>
          </nav>
        </div>
      )}
    </>
  );
}
