"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, FlaskConical, KeyRound, Loader2, MapPin, MessageSquareText, ShieldCheck, Smartphone } from "lucide-react";
import type { Lang } from "@/lib/mb";
import { demoAccounts, homeFor, startPatient, useSession, verifyPatient, type Challenge, type DemoAccounts } from "@/lib/auth";
import { Alert, AuthShell, Divider, Field, input, safeNext } from "./AuthShell";

const num = (s: string | number, lang: Lang) => (lang === "ar" ? String(s).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]) : String(s));

const T = {
  en: {
    back: "MemBrain",
    eyebrow: "Your check-in",
    title: ["Your brain health, ", "in your own words."],
    body: "Sign in with your mobile number to do your spoken check-in and see what happens next. There is no password to remember.",
    trust: ["Your number is kept apart from your health record", "Hosted in-country, Azure UAE North", "Prototype: synthetic records only"],
    previewTitle: "Thank you, Fatima",
    previewBody: "Your results are steady compared with your own earlier results.",
    previewNext: "Next check-in",
    previewWhen: "in 6 months",
    badge: "Patients and families",
    h: "Sign in with your phone",
    p: "We'll send a 6-digit code to your mobile. No password needed.",
    phone: "Mobile number",
    send: "Send code",
    sending: "Sending…",
    or: "or",
    pilot: "Pilot",
    noAccount: "Raising a concern about someone doesn't need an account.",
    raise: "Raise a concern",
    demoTitle: "Demo patients (synthetic)",
    h2: "Enter your code",
    sent: (to: string) => `We sent a 6-digit code to ${to}.`,
    demoCode: (c: string) => `Demo: no text message is sent in this prototype. Your code is ${c}.`,
    fill: "Fill it in",
    verify: "Verify and continue",
    verifying: "Checking…",
    resend: "Didn't get it? Send a new code",
    resendIn: (s: number) => `You can ask for a new code in ${s} s`,
    change: "Change number",
    codeLabel: "6-digit code",
    staff: "Clinical staff?",
    staffLink: "Sign in to the workspace",
    emergency: "In an emergency, call 998.",
    errors: {} as Record<string, string>,
  },
  ar: {
    back: "MemBrain",
    eyebrow: "فحصك",
    title: ["صحة دماغك، ", "بكلماتك أنت."],
    body: "سجّل الدخول برقم هاتفك المحمول لإجراء فحصك الصوتي ومعرفة الخطوة التالية. لا حاجة إلى كلمة مرور.",
    trust: ["يُحفظ رقمك منفصلًا عن سجلك الصحي", "مستضاف داخل الدولة على Azure في الإمارات", "نموذج تجريبي: سجلات وهمية فقط"],
    previewTitle: "شكرًا لكِ، فاطمة",
    previewBody: "نتائجك مستقرة مقارنةً بنتائجك السابقة.",
    previewNext: "فحصك التالي",
    previewWhen: "بعد ستة أشهر",
    badge: "المرضى والعائلات",
    h: "سجّل الدخول برقم هاتفك",
    p: "سنرسل رمزًا من ٦ أرقام إلى هاتفك المحمول. لا حاجة إلى كلمة مرور.",
    phone: "رقم الهاتف المحمول",
    send: "أرسل الرمز",
    sending: "جارٍ الإرسال…",
    or: "أو",
    pilot: "التجربة",
    noAccount: "الإبلاغ عن قلق بشأن شخص ما لا يحتاج إلى حساب.",
    raise: "أبلغ عن تغيّر",
    demoTitle: "مرضى تجريبيون (بيانات وهمية)",
    h2: "أدخل الرمز",
    sent: (to: string) => `أرسلنا رمزًا من ٦ أرقام إلى \u2066${to}\u2069.`,
    demoCode: (c: string) => `تجريبي: لا تُرسل رسالة نصية في هذا النموذج. رمزك هو \u2066${c}\u2069.`,
    fill: "أدخله تلقائيًا",
    verify: "تحقّق وتابع",
    verifying: "جارٍ التحقق…",
    resend: "لم يصلك الرمز؟ أرسل رمزًا جديدًا",
    resendIn: (s: number) => `يمكنك طلب رمز جديد بعد ${num(s, "ar")} ثانية`,
    change: "غيّر الرقم",
    codeLabel: "الرمز المكوّن من ٦ أرقام",
    staff: "من الكادر الطبي؟",
    staffLink: "سجّل الدخول إلى مساحة العمل",
    emergency: "في حالات الطوارئ، اتصل على ٩٩٨.",
    errors: {
      "Please enter a mobile number, for example 050 123 4567.": "يُرجى إدخال رقم هاتف محمول، مثل ٠٥٠ ١٢٣ ٤٥٦٧.",
      "That code isn't right. Please check it and try again.": "الرمز غير صحيح. يُرجى التحقق منه والمحاولة مرة أخرى.",
      "That code has expired. Please ask for a new one.": "انتهت صلاحية الرمز. يُرجى طلب رمز جديد.",
      "Too many wrong codes. Please ask for a new one.": "أُدخلت رموز خاطئة كثيرة. يُرجى طلب رمز جديد.",
      "Too many attempts. Please wait a few minutes and try again.": "محاولات كثيرة. يُرجى الانتظار بضع دقائق ثم المحاولة مرة أخرى.",
      "In the browser-only demo, please use one of the demo numbers below.": "في العرض التجريبي داخل المتصفح، يُرجى استخدام أحد الأرقام التجريبية أدناه.",
      "*": "حدث خطأ. يُرجى المحاولة مرة أخرى.",
    } as Record<string, string>,
  },
};

/** Six boxes for the one-time code: typing moves on, backspace moves back, a pasted code fills them all. */
function CodeBoxes({ value, onChange, label, disabled }: { value: string; onChange: (v: string) => void; label: string; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const set = (i: number, d: string) => {
    const chars = value.padEnd(6, " ").split("");
    chars[i] = d || " ";
    onChange(chars.join("").replace(/\s+$/, "").replace(/ /g, ""));
  };
  return (
    <div dir="ltr" role="group" aria-label={label} className="flex justify-between gap-2">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={value[i] ?? ""}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`${label} ${i + 1}`}
          maxLength={6}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "");
            if (d.length > 1) {
              onChange(d.slice(0, 6));
              refs.current[Math.min(5, d.length)]?.focus();
              return;
            }
            set(i, d);
            if (d && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          onPaste={(e) => {
            const d = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            if (d) {
              e.preventDefault();
              onChange(d);
              refs.current[Math.min(5, d.length - 1)]?.focus();
            }
          }}
          className={`h-[60px] w-full min-w-0 rounded-xl border text-center font-mono text-[26px] font-semibold text-ink outline-none transition-[border-color,box-shadow] focus:border-deep focus:shadow-[0_0_0_4px_rgb(15_63_44/0.10)] ${value[i] ? "border-deep/60 bg-mist/40" : "border-[#d7ddda] bg-white"}`}
        />
      ))}
    </div>
  );
}

export function PatientSignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const [lang, setLangState] = useState<Lang>(params.get("lang") === "ar" ? "ar" : "en");
  const t = T[lang];
  const { session, ready } = useSession();
  const [phone, setPhone] = useState("");
  const [ch, setCh] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState<DemoAccounts | null>(null);
  const [wait, setWait] = useState(0);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("lang", l);
      window.history.replaceState(null, "", u);
    } catch {
      /* ignore */
    }
  };
  const tr = (msg: string) => (lang === "ar" ? t.errors[msg] ?? t.errors["*"] : msg);
  const dest = () => safeNext(`/checkin/?lang=${lang}`);

  useEffect(() => {
    void demoAccounts().then(setDemo);
  }, []);
  useEffect(() => {
    if (ready && session?.user.role === "participant") router.replace(safeNext(homeFor(session.user)));
  }, [ready, session, router]);
  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  const send = async (e?: React.FormEvent, number?: string) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const c = await startPatient(number ?? phone);
      setCh(c);
      setCode("");
      setWait(30);
    } catch (err) {
      setError(tr((err as Error).message));
    }
    setBusy(false);
  };

  const verify = async (value = code) => {
    if (!ch || value.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await verifyPatient(ch.challenge_id, value);
      router.replace(dest());
    } catch (err) {
      setError(tr((err as Error).message));
      setBusy(false);
    }
  };

  return (
    <AuthShell
      lang={lang}
      setLang={setLang}
      variant="patient"
      eyebrow={t.eyebrow}
      title={
        <>
          {t.title[0]}
          <span className="text-sand">{t.title[1]}</span>
        </>
      }
      body={t.body}
      preview={
        <div className="max-w-[400px] rounded-2xl border border-white/12 bg-white/[0.08] p-5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sand text-deep">
              <Check size={22} strokeWidth={2.6} />
            </span>
            <p className="font-serif text-[21px] font-semibold">{t.previewTitle}</p>
          </div>
          <p className="mt-3 rounded-xl bg-white/90 px-4 py-3 text-[15px] leading-relaxed text-deep">{t.previewBody}</p>
          <p className="mt-3 flex items-center justify-between text-[13.5px] text-white/70">
            <span>{t.previewNext}</span>
            <span className="font-semibold text-white">{t.previewWhen}</span>
          </p>
        </div>
      }
      trust={[
        { icon: ShieldCheck, text: t.trust[0] },
        { icon: MapPin, text: t.trust[1] },
        { icon: FlaskConical, text: t.trust[2] },
      ]}
      back={{ href: lang === "ar" ? "/ar/" : "/", label: t.back }}
      footer={
        <>
          <span>{t.staff}</span>
          <Link href="/signin/clinician/" className="font-medium text-deep hover:underline">
            {t.staffLink}
          </Link>
          <span className="text-lv-urgent">{t.emergency}</span>
        </>
      }
    >
      <div className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-mist px-3 py-1 text-[12.5px] font-semibold text-deep">
          {ch ? <KeyRound size={14} /> : <Smartphone size={14} />} {t.badge}
        </span>
        <h2 className="mt-4 text-[30px] font-semibold leading-tight tracking-[-0.02em]">{ch ? t.h2 : t.h}</h2>
        <p className="mt-2 text-[15.5px] leading-relaxed text-body">{ch ? t.sent(ch.sent_to) : t.p}</p>
      </div>

      {!ch ? (
        <>
          <form onSubmit={send} className="space-y-5" noValidate>
            {error && <Alert>{error}</Alert>}
            <Field label={t.phone} htmlFor="phone">
              <div dir="ltr" className="flex gap-2">
                <span className="flex h-[52px] shrink-0 items-center gap-1.5 rounded-xl border border-[#d7ddda] bg-paper px-3.5 text-[16px] font-medium text-ink">+971</span>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="50 123 4567"
                  className={input}
                />
              </div>
            </Field>
            <button type="submit" disabled={busy || phone.replace(/\D/g, "").length < 8} className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-deep text-[16px] font-semibold text-white shadow-sm transition-colors hover:bg-deep-hover disabled:opacity-60">
              {busy ? <Loader2 size={19} className="animate-spin" /> : <MessageSquareText size={18} />} {busy ? t.sending : t.send}
            </button>
          </form>
          <div className="mt-7 space-y-4">
            <Divider label={t.or} />
            <button type="button" disabled className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-white text-[15px] font-medium text-body opacity-80" title="Planned for the pilot">
              <ShieldCheck size={18} /> UAE PASS <span className="rounded-full bg-paper px-2 py-0.5 text-[11.5px] font-semibold text-muted">{t.pilot}</span>
            </button>
            <p className="text-center text-[14px] text-body">
              {t.noAccount}{" "}
              <Link href={lang === "ar" ? "/concern/?lang=ar" : "/concern/"} className="font-medium text-deep hover:underline">
                {t.raise}
              </Link>
            </p>
          </div>
          {demo?.enabled && demo.patients?.length ? (
            <div className="mt-8 rounded-2xl border border-dashed border-[#cdd6d1] bg-paper/70 p-4">
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-leaf">{t.demoTitle}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {demo.patients.map((d) => (
                  <button
                    key={d.pid}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPhone(d.phone.replace("+971", "0"));
                      void send(undefined, d.phone);
                    }}
                    className="rounded-full bg-white px-3.5 py-1.5 text-[14px] font-medium ring-1 ring-line transition-shadow hover:ring-leaf/50"
                  >
                    {lang === "ar" ? d.name_ar ?? d.name : d.name} <span className="font-mono text-[12px] text-muted" dir="ltr">…{d.phone.slice(-4)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
          className="space-y-5"
          noValidate
        >
          {ch.demo_code && (
            <Alert tone="info">
              <span className="block">{t.demoCode(ch.demo_code.replace(/(\d{3})(\d{3})/, "$1 $2"))}</span>
              <button
                type="button"
                onClick={() => {
                  setCode(ch.demo_code!);
                  void verify(ch.demo_code!);
                }}
                className="mt-2 inline-flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
              >
                {t.fill} <ArrowRight size={15} className="rtl:-scale-x-100" />
              </button>
            </Alert>
          )}
          {error && <Alert>{error}</Alert>}
          <CodeBoxes
            value={code}
            label={t.codeLabel}
            disabled={busy}
            onChange={(v) => {
              setCode(v);
              if (v.length === 6) void verify(v);
            }}
          />
          <button type="submit" disabled={busy || code.length !== 6} className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-deep text-[16px] font-semibold text-white shadow-sm transition-colors hover:bg-deep-hover disabled:opacity-60">
            {busy ? <Loader2 size={19} className="animate-spin" /> : null} {busy ? t.verifying : t.verify}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
            {wait > 0 ? (
              <span className="text-muted">{t.resendIn(wait)}</span>
            ) : (
              <button type="button" onClick={() => void send()} className="font-medium text-deep hover:underline">
                {t.resend}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setCh(null);
                setError(null);
              }}
              className="font-medium text-body hover:text-ink hover:underline"
            >
              {t.change}
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
