"use client";

// Welcome and sign-in, phone-first: patients and families by mobile number and a one-time code, clinical staff by
// email and password. Uses lib/auth, so it works against the server or in the browser-only demo.
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, Loader2, ShieldCheck, Stethoscope, UsersRound } from "lucide-react";
import { cx } from "./kit";
import { Logo } from "../Logo";
import { asset } from "@/lib/asset";
import { demoAccounts, signInClinician, startPatient, verifyPatient, type Challenge, type DemoAccounts } from "@/lib/auth";
import type { Lang } from "@/lib/mb";

const T = {
  en: {
    tag: "From “something’s not right” to the right clinician.", body: "A spoken brain-health check-in in Arabic or English, and a family that is heard.",
    patient: "I'm a patient or family member", patientSub: "Sign in with your mobile number", staff: "I'm a clinician or coordinator", staffSub: "Sign in with your work account",
    phone: "Mobile number", phoneHint: "We send a 6-digit code. No password to remember.", send: "Send code", code: "Enter the code", codeSent: (p: string) => `Sent to ${p}`,
    demoCode: (c: string) => `Demo: no text message is sent. Your code is ${c}.`, fill: "Fill it in", verify: "Verify and continue",
    email: "Work email", password: "Password", signIn: "Sign in", demo: "Demo accounts (synthetic)", use: "Use", back: "Back", disclaimer: "Prototype · synthetic data · MemBrain never diagnoses",
  },
  ar: {
    tag: "من «هناك شيء ليس على ما يرام» إلى الطبيب المناسب.", body: "فحص صوتي لصحة الدماغ بالعربية أو بالإنجليزية، وأسرة يُستمع إليها.",
    patient: "أنا مريض أو من أفراد الأسرة", patientSub: "سجّل الدخول برقم هاتفك", staff: "أنا طبيب أو منسق", staffSub: "سجّل الدخول بحساب العمل",
    phone: "رقم الهاتف", phoneHint: "نرسل رمزًا من ستة أرقام. لا حاجة إلى كلمة مرور.", send: "أرسل الرمز", code: "أدخل الرمز", codeSent: (p: string) => `أُرسل إلى ⁦${p}⁩`,
    demoCode: (c: string) => `تجريبي: لا تُرسل رسالة نصية. رمزك هو ⁦${c}⁩.`, fill: "أدخله تلقائيًا", verify: "تحقّق وتابِع",
    email: "بريد العمل", password: "كلمة المرور", signIn: "تسجيل الدخول", demo: "حسابات تجريبية (وهمية)", use: "استخدم", back: "رجوع", disclaimer: "نموذج تجريبي · بيانات وهمية · MemBrain لا يشخّص",
  },
};

export function Welcome({ lang, setLang, onSignedIn }: { lang: Lang; setLang: (l: Lang) => void; onSignedIn: () => void }) {
  const t = T[lang];
  const [mode, setMode] = useState<"choose" | "patient" | "staff">("choose");
  const [demo, setDemo] = useState<DemoAccounts | null>(null);
  useEffect(() => {
    demoAccounts().then(setDemo).catch(() => setDemo({ enabled: false }));
  }, []);

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-deep text-white">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[58%]">
        <Image src={asset("/images/hero-family-top.webp")} alt="" fill priority sizes="520px" className="object-cover object-[60%_30%] opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-b from-deep/30 via-deep/70 to-deep" />
      </div>
      <div className="relative flex items-center justify-between px-5" style={{ paddingTop: "max(env(safe-area-inset-top), 18px)" }}>
        <Logo inverted size="md" />
        <div className="flex rounded-full bg-white/12 p-0.5 ring-1 ring-white/20">
          {(["en", "ar"] as Lang[]).map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)} lang={l} aria-pressed={lang === l} className={cx("rounded-full px-3 py-1 text-[12.5px] font-medium", lang === l ? "bg-white text-deep" : "text-white/80")}>
              {l === "en" ? "English" : "عربي"}
            </button>
          ))}
        </div>
      </div>
      <div className="relative mt-auto px-5 pb-6 pt-40">
        {mode === "choose" && (
          <div className="mb-step-in">
            <h1 className={cx("font-serif text-[31px] font-semibold tracking-[-0.015em] text-balance", lang === "ar" ? "leading-[1.35]" : "leading-[1.12]")}>{t.tag}</h1>
            <p className={cx("mt-3 text-[15.5px] text-white/75", lang === "ar" ? "leading-[1.85]" : "leading-relaxed")}>{t.body}</p>
            <div className="mt-7 space-y-3">
              {[
                { k: "patient" as const, icon: UsersRound, title: t.patient, sub: t.patientSub },
                { k: "staff" as const, icon: Stethoscope, title: t.staff, sub: t.staffSub },
              ].map(({ k, icon: I, title, sub }) => (
                <button key={k} type="button" onClick={() => setMode(k)} className="flex w-full items-center gap-3.5 rounded-[20px] bg-white px-4 py-4 text-start text-ink shadow-[0_18px_40px_-20px_rgb(0_0_0/0.5)] active:scale-[0.99]">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef3ef] text-deep"><I size={21} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15.5px] font-semibold">{title}</span>
                    <span className="block text-[13px] text-body">{sub}</span>
                  </span>
                  <ArrowRight size={18} className="text-muted rtl:-scale-x-100" />
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === "patient" && <PatientForm lang={lang} demo={demo} onBack={() => setMode("choose")} onDone={onSignedIn} />}
        {mode === "staff" && <StaffForm lang={lang} demo={demo} onBack={() => setMode("choose")} onDone={onSignedIn} />}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-white/55"><ShieldCheck size={13} /> {t.disclaimer}</p>
      </div>
    </div>
  );
}

const field = "h-12 w-full rounded-2xl bg-white px-4 text-[16px] text-ink outline-none ring-1 ring-white/40 placeholder:text-[#9aa5a0] focus:ring-2 focus:ring-sand";

function Panel({ title, onBack, back, children }: { title: string; onBack: () => void; back: string; children: React.ReactNode }) {
  return (
    <div className="mb-step-in rounded-[24px] bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[17px] font-semibold">{title}</p>
        <button type="button" onClick={onBack} className="text-[13.5px] font-medium text-white/75">{back}</button>
      </div>
      {children}
    </div>
  );
}

function PatientForm({ lang, demo, onBack, onDone }: { lang: Lang; demo: DemoAccounts | null; onBack: () => void; onDone: () => void }) {
  const t = T[lang];
  const [phone, setPhone] = useState("");
  const [ch, setCh] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement | null>(null);
  const send = async (p = phone) => {
    setBusy(true);
    setError(null);
    try {
      setCh(await startPatient(p));
      window.setTimeout(() => codeRef.current?.focus(), 80);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const verify = async (c = code) => {
    if (!ch) return;
    setBusy(true);
    setError(null);
    try {
      await verifyPatient(ch.challenge_id, c);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <Panel title={ch ? t.code : t.patient} onBack={ch ? () => { setCh(null); setCode(""); } : onBack} back={t.back}>
      {!ch ? (
        <>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" dir="ltr" placeholder="050 123 4567" aria-label={t.phone} className={field} />
          <p className="mt-2 text-[12.5px] text-white/65">{t.phoneHint}</p>
          {demo?.patients?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {demo.patients.slice(0, 5).map((p) => (
                <button key={p.pid} type="button" onClick={() => { setPhone(p.phone); void send(p.phone); }} className="rounded-full bg-white/12 px-3 py-1.5 text-[12.5px] font-medium ring-1 ring-white/20">
                  {lang === "ar" ? p.name_ar ?? p.name : p.name}
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" onClick={() => send()} disabled={busy || phone.trim().length < 7} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-sand py-3.5 text-[15.5px] font-semibold text-deep disabled:opacity-60">
            {busy && <Loader2 size={17} className="animate-spin" />} {t.send}
          </button>
        </>
      ) : (
        <>
          <p className="text-[13px] text-white/70">{t.codeSent(ch.sent_to)}</p>
          <input ref={codeRef} value={code} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); if (v.length === 6) void verify(v); }}
            inputMode="numeric" autoComplete="one-time-code" dir="ltr" aria-label={t.code} className={cx(field, "mt-2 text-center font-mono text-[24px] tracking-[0.5em]")} placeholder="••••••" />
          {ch.demo_code && (
            <div className="mt-3 rounded-2xl bg-sand-soft px-3.5 py-2.5 text-[13px] text-[#6b4714]">
              {t.demoCode(ch.demo_code)}{" "}
              <button type="button" onClick={() => { setCode(ch.demo_code!); void verify(ch.demo_code!); }} className="font-semibold underline">{t.fill}</button>
            </div>
          )}
          <button type="button" onClick={() => verify()} disabled={busy || code.length !== 6} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-sand py-3.5 text-[15.5px] font-semibold text-deep disabled:opacity-60">
            {busy && <Loader2 size={17} className="animate-spin" />} {t.verify}
          </button>
        </>
      )}
      {error && <p role="alert" className="mt-3 rounded-xl bg-white px-3.5 py-2.5 text-[13.5px] font-medium text-lv-urgent">{error}</p>}
    </Panel>
  );
}

function StaffForm({ lang, demo, onBack, onDone }: { lang: Lang; demo: DemoAccounts | null; onBack: () => void; onDone: () => void }) {
  const t = T[lang];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async (e = email, p = password) => {
    setBusy(true);
    setError(null);
    try {
      await signInClinician(e, p, true);
      onDone();
    } catch (x) {
      setError(x instanceof Error ? x.message : String(x));
      setBusy(false);
    }
  };
  return (
    <Panel title={t.staff} onBack={onBack} back={t.back}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" dir="ltr" placeholder="name@clinic.ae" aria-label={t.email} className={field} autoComplete="username" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" dir="ltr" placeholder={t.password} aria-label={t.password} className={cx(field, "mt-2.5")} autoComplete="current-password" />
      <button type="button" onClick={() => go()} disabled={busy || !email || !password} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-sand py-3.5 text-[15.5px] font-semibold text-deep disabled:opacity-60">
        {busy && <Loader2 size={17} className="animate-spin" />} {t.signIn}
      </button>
      {demo?.clinicians?.length ? (
        <div className="mt-4 rounded-2xl bg-white/8 p-3 ring-1 ring-white/12">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-white/60">{t.demo}</p>
          {demo.clinicians.map((c) => (
            <button key={c.email} type="button" onClick={() => { setEmail(c.email); setPassword(c.password); void go(c.email, c.password); }} className="mt-2 flex w-full items-center justify-between rounded-xl bg-white/10 px-3 py-2.5 text-start">
              <span><span className="block text-[14px] font-semibold">{c.name}</span><span className="block text-[12px] text-white/60" dir="ltr">{c.email}</span></span>
              <span className="text-[13px] font-semibold text-sand">{t.use} →</span>
            </button>
          ))}
        </div>
      ) : null}
      {error && <p role="alert" className="mt-3 rounded-xl bg-white px-3.5 py-2.5 text-[13.5px] font-medium text-lv-urgent">{error}</p>}
    </Panel>
  );
}
