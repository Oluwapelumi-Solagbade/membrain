"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
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
import { caseHref, fmtDate } from "@/lib/workspace/derive";
import { NAV } from "@/lib/workspace/navigator";
import type { EnrolDone, EnrolIn, InformantChange } from "@/lib/workspace/types";

/* ── What the form asks, in the order the coordinator asks it ── */

const STEPS = [
  { key: "concern", title: "Concern and safety", icon: AlertTriangle },
  { key: "identity", title: "Identity", icon: Lock },
  { key: "profile", title: "Profile", icon: UserRound },
  { key: "consent", title: "Consent", icon: ShieldCheck },
  { key: "informant", title: "Informant", icon: UsersRound },
  { key: "health", title: "Health context", icon: HeartPulse },
  { key: "review", title: "Review and schedule", icon: ClipboardList },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

const ROUTES: { key: EnrolIn["concern"]["route"]; label: string; sub: string }[] = [
  { key: "programme", label: "Programme screening", sub: "Invited by the healthy-ageing programme" },
  { key: "primary_care", label: "Primary care", sub: "Referred by a doctor or nurse" },
  { key: "family", label: "A family member", sub: "Raised by someone close to them" },
  { key: "household_helper", label: "A household helper", sub: "Raised by the person who helps at home" },
  { key: "self", label: "The person themselves", sub: "They noticed it and came forward" },
];
const ONSET: { key: NonNullable<EnrolIn["concern"]["onset"]>; label: string }[] = [
  { key: "days", label: "Within the last few days" },
  { key: "weeks", label: "Over the last few weeks" },
  { key: "months", label: "Over months" },
  { key: "years", label: "Over a year or more" },
  { key: "none", label: "No specific concern" },
];
const RED_FLAGS = config.RED_FLAGS as unknown as Record<string, string>;

// Consent for each type of data, read aloud in the person's language (wording from the consent text, version below).
const CONSENT_VERSION = "consent-ar-en-0.1";
const CONSENT: { key: string; title: string; en: string; ar: string; dflt: boolean }[] = [
  { key: "voice_features", title: "Voice features", en: "Measurements of how you speak (speed, pauses). Calculated on your phone; the recording itself is not sent.", ar: "قياسات لطريقة كلامك (السرعة والتوقفات). تُحسب على هاتفك ولا يُرسل التسجيل نفسه.", dflt: true },
  { key: "raw_audio", title: "Keep voice recordings", en: "Keep your recordings for a fixed time so a person can check the scoring.", ar: "الاحتفاظ بتسجيلاتك لفترة محددة حتى يتمكن شخص من مراجعة التقييم.", dflt: false },
  { key: "wearables", title: "Watch or fitness band", en: "Daily sleep and activity summaries from your device.", ar: "ملخصات يومية للنوم والنشاط من جهازك.", dflt: false },
  { key: "clinical_record", title: "Health record", en: "Blood pressure, sugar (HbA1c), cholesterol and relevant diagnoses from your clinic record.", ar: "ضغط الدم والسكر التراكمي والكوليسترول والتشخيصات المهمة من ملفك في العيادة.", dflt: true },
  { key: "family_history", title: "Family history", en: "Whether close relatives had memory problems or dementia.", ar: "هل عانى أحد الأقارب من مشكلات في الذاكرة أو من الخرف.", dflt: true },
  { key: "caregiver_involvement", title: "Family member involvement", en: "A family member may help with sessions and answer a short questionnaire about daily life.", ar: "يمكن لأحد أفراد العائلة المساعدة في الجلسات والإجابة عن استبيان قصير عن الحياة اليومية.", dflt: true },
  { key: "genomics", title: "Genetic results", en: "Use existing genetic results (for example from a national programme). A clinician discusses results with you only with counselling.", ar: "استخدام نتائج جينية موجودة (مثلًا من برنامج وطني). لا يناقش الطبيب النتائج معك إلا مع الإرشاد.", dflt: false },
  { key: "model_training", title: "Help improve the tool", en: "Allow your anonymised data to be used to improve the tool. Separate from your care.", ar: "السماح باستخدام بياناتك بعد إخفاء هويتك لتحسين الأداة. وهذا منفصل عن رعايتك.", dflt: false },
];

const CONDITIONS: [string, string][] = [
  ["hypertension", "Hypertension"], ["diabetes", "Type 2 diabetes"], ["stroke_tia", "Stroke or TIA"], ["af", "Atrial fibrillation"],
  ["cvd", "Cardiovascular disease"], ["ckd", "Chronic kidney disease"], ["hypothyroid", "Hypothyroidism"], ["b12", "B12 or folate deficiency"],
  ["depression", "Depression"], ["anxiety", "Anxiety"], ["sleep_apnoea", "Sleep apnoea"], ["insomnia", "Chronic insomnia"],
  ["parkinsons", "Parkinson's disease"], ["tbi", "Head injury (TBI)"], ["hearing_loss", "Hearing loss"], ["vision", "Visual impairment"],
];
const DIALECTS = ["Emirati", "Other Gulf", "Levantine", "Egyptian", "Other Arabic", "English"];
const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];
const RELATIONS: [string, string][] = [["spouse", "Spouse"], ["son", "Son"], ["daughter", "Daughter"], ["sibling", "Brother or sister"], ["household_helper", "Household helper"], ["carer", "Paid carer"], ["other", "Other"]];
const WHY = ["Memory or thinking problems", "Physical illness or mobility", "Personal preference", "Family arrangement", "Not sure"];

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
  age: "", sex: "F", years: "", language: "ar", dialect: "Emirati", emirate: "Abu Dhabi", funding: "thiqa", hearingAid: false, glasses: false, digital: "some",
  consent: Object.fromEntries(CONSENT.map((c) => [c.key, c.dflt])),
  infType: "family", helperConsent: false, infLanguage: "ar", infName: "", infRelation: "", infPhone: "", iqcode: "", timeline: [],
  sbp: "", dbp: "", hba1c: "", ldl: "", bmi: "", activity: "", district: "", cond: {}, smoker: false, isolated: false, famHistory: false, apoe: "",
});

/* ── Small pieces ── */

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

/* ── The screen ── */

export function EnrolView() {
  const { enrol, mode } = useWorkspace();
  const [f, setF] = useState<Form>(blank);
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<EnrolDone | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const upd = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const flags = Object.keys(f.flags).filter((k) => f.flags[k]);
  const urgent = flags.length > 0;
  const key: StepKey = STEPS[step].key;
  const age = num(f.age);
  const years = num(f.years);
  const band = years == null ? null : eduBand(years);

  // What stops the coordinator moving on, step by step.
  const problems = useMemo(() => {
    const p: Partial<Record<StepKey, Record<string, string>>> = {};
    if (f.route !== "programme" && f.onset !== "none" && !f.text.trim()) p.concern = { text: "Describe what has been noticed, in a few words." };
    if (!f.name.trim()) p.identity = { name: "Enter a name. It stays in the identity vault." };
    const prof: Record<string, string> = {};
    if (age == null || age < 50 || age > 75) prof.age = "MemBrain is for people aged 50 to 75.";
    if (years == null || years < 0 || years > 25) prof.years = "Enter years of schooling (0 if none).";
    if (Object.keys(prof).length) {
      p.profile = prof;
      if (urgent) p.identity = { ...(p.identity ?? {}), ...prof };
    }
    const iq = num(f.iqcode);
    if (f.iqcode.trim() && (iq == null || iq < 1 || iq > 5)) p.informant = { iqcode: "IQCODE-16 averages run from 1 to 5." };
    return p;
  }, [f, age, years, urgent]);
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
      iqcode: f.infType === "none" ? null : num(f.iqcode),
      apoe: f.consent.genomics && f.apoe ? f.apoe : null,
    };
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      setDone(await enrol(body()));
      stopSpeaking();
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
    if (key === "identity" && urgent) return void submit(); // a red flag: record who they are and escalate now
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      toTop();
    } else void submit();
  };
  const goTo = (i: number) => {
    // Earlier steps are always open; later ones only once everything before them is complete.
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
    void speak(text, f.language).finally(() => setReading((r) => (r === k ? null : r)));
  };

  if (done) return <Done done={done} urgent={urgent} lang={f.language} onAgain={() => { setF(blank()); setStep(0); setDone(null); }} />;

  /* ── Each step ── */
  let content: ReactNode = null;
  if (key === "concern") {
    content = (
      <Section title="Concern and safety" sub="People come through a screening programme, primary care, a family member, a household helper or themselves. The red-flag screen comes first, before any testing.">
        <div>
          <p className="mb-2 text-[14px] font-medium">How did this person come to us?</p>
          <Choice value={f.route} onPick={(v) => upd("route", v)} options={ROUTES} />
        </div>
        <Field label="What has been noticed?" error={err("text")} hint={f.route === "programme" ? "Optional for routine programme screening." : "In the words of whoever raised it, for example: repeats questions, missed bills, got lost driving."}>
          <textarea value={f.text} onChange={(e) => upd("text", e.target.value)} rows={3} dir="auto" className={`${field} h-auto py-2.5 leading-snug`} />
        </Field>
        <div>
          <p className="mb-2 text-[14px] font-medium">When did it start?</p>
          <Choice value={f.onset} onPick={(v) => upd("onset", v)} options={ONSET} cols={3} />
        </div>
        <div>
          <p className="text-[14px] font-medium">Red-flag screen</p>
          <p className="mb-2 text-[13.5px] text-body">Ask the person and whoever is with them. Any one of these needs urgent clinical assessment, not memory testing.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(RED_FLAGS).map(([k, v]) => (
              <CheckRow key={k} on={!!f.flags[k]} onChange={(on) => upd("flags", { ...f.flags, [k]: on })}>{v}</CheckRow>
            ))}
          </div>
        </div>
        {urgent && <UrgentNote flags={flags} />}
      </Section>
    );
  } else if (key === "identity") {
    content = (
      <Section title="Identity" sub={<>Stored only in the separate identity vault.</>}>
        {urgent && <UrgentNote flags={flags} short />}
        <Note>
          <span className="flex items-start gap-2.5"><Lock size={16} className="mt-0.5 shrink-0" /> <span>Name, ID and phone are kept in the identity vault so the clinic can contact the person. The record, the dashboard and analytics use a pseudonymous ID. Showing these details again needs a reason and is written to the audit log.</span></span>
        </Note>
        <Field label="Full name" error={err("name")}><input value={f.name} onChange={(e) => upd("name", e.target.value)} className={field} autoComplete="off" dir="auto" /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Emirates ID or clinic MRN" hint="Optional."><input value={f.nationalId} onChange={(e) => upd("nationalId", e.target.value)} className={field} autoComplete="off" placeholder="784-XXXX-XXXXXXX-X" /></Field>
          <Field label="Mobile number" hint="They can sign in with this number to do their own check-ins."><input value={f.phone} onChange={(e) => upd("phone", e.target.value)} className={field} type="tel" autoComplete="off" placeholder="050 123 4567" /></Field>
        </div>
        <div>
          <p className="mb-2 text-[14px] font-medium">Preferred channel for reminders and check-ins</p>
          <Choice value={f.channel} onPick={(v) => upd("channel", v)} cols={3} options={[
            { key: "whatsapp", label: "WhatsApp" }, { key: "app", label: "MemBrain app" }, { key: "phone", label: "Guided phone call" },
          ]} />
          <p className="mt-2 text-[13px] text-muted">Each channel keeps its own baseline; scores are not pooled across channels.</p>
        </div>
        {urgent && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Age" error={err("age")} hint="Needed for the record; no testing today."><input value={f.age} onChange={(e) => upd("age", e.target.value)} className={field} inputMode="numeric" /></Field>
            <Field label="Years of schooling" error={err("years")}><input value={f.years} onChange={(e) => upd("years", e.target.value)} className={field} inputMode="numeric" /></Field>
          </div>
        )}
      </Section>
    );
  } else if (key === "profile") {
    content = (
      <Section title="Profile" sub="Scores are compared with people of the same age and schooling, and with the person's own earlier results.">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Age" error={err("age")} hint="Eligible: 50 to 75."><input value={f.age} onChange={(e) => upd("age", e.target.value)} className={field} inputMode="numeric" /></Field>
          <Field label="Sex">
            <select value={f.sex} onChange={(e) => upd("sex", e.target.value as Form["sex"])} className={field}><option value="F">Female</option><option value="M">Male</option></select>
          </Field>
          <Field label="Years of schooling" error={err("years")} hint={band ? <>Norm group: <b className="font-semibold text-ink">{EDUCATION_LABEL[band]}</b></> : "0 if none."}>
            <input value={f.years} onChange={(e) => upd("years", e.target.value)} className={field} inputMode="numeric" />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Language for sessions">
            <select value={f.language} onChange={(e) => upd("language", e.target.value as Lang)} className={field}><option value="ar">Arabic</option><option value="en">English</option></select>
          </Field>
          <Field label="Dialect" hint="Used to report accuracy by dialect.">
            <select value={f.dialect} onChange={(e) => upd("dialect", e.target.value)} className={field}>{DIALECTS.map((d) => <option key={d}>{d}</option>)}</select>
          </Field>
          <Field label="Emirate of residence" hint="Used to find services the person can reach.">
            <select value={f.emirate} onChange={(e) => upd("emirate", e.target.value)} className={field}>{EMIRATES.map((d) => <option key={d}>{d}</option>)}</select>
          </Field>
          <Field label="Funding route" hint="Only to find accessible services. Never used to withhold a needed referral.">
            <select value={f.funding} onChange={(e) => upd("funding", e.target.value)} className={field}>{Object.entries(NAV.funding).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </Field>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <CheckRow on={f.hearingAid} onChange={(v) => upd("hearingAid", v)}>Uses a hearing aid</CheckRow>
          <CheckRow on={f.glasses} onChange={(v) => upd("glasses", v)}>Uses reading glasses</CheckRow>
        </div>
        <div>
          <p className="mb-2 text-[14px] font-medium">Comfort with smartphones</p>
          <Choice value={f.digital} onPick={(v) => upd("digital", v)} cols={3} options={[{ key: "none", label: "Not comfortable" }, { key: "some", label: "Somewhat" }, { key: "confident", label: "Confident" }]} />
          {f.digital === "none" && <p className="mt-2 text-[13.5px] text-body">Suggest a family member helping with check-ins, or the guided phone channel.</p>}
        </div>
      </Section>
    );
  } else if (key === "consent") {
    content = (
      <Section title="Consent for each type of data" sub="Read each one aloud in the person's language. Every item is optional and can be withdrawn at any time; withdrawal stops processing and removes that data.">
        <div className="divide-y divide-line rounded-2xl border border-line">
          {CONSENT.map((c) => {
            const on = !!f.consent[c.key];
            const text = f.language === "ar" ? c.ar : c.en;
            return (
              <div key={c.key} className="flex items-start gap-3.5 px-4 py-3.5">
                <input type="checkbox" checked={on} onChange={(e) => upd("consent", { ...f.consent, [c.key]: e.target.checked })} aria-label={c.title} className="mt-1 h-[18px] w-[18px] shrink-0 accent-[#0f3f2c]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{c.title}</p>
                  <p className="mt-0.5 text-[14px] leading-snug text-body">{c.en}</p>
                  <p dir="rtl" lang="ar" className="mt-1 text-[15px] leading-[1.7] text-muted">{c.ar}</p>
                </div>
                <button type="button" onClick={() => read(c.key, text)} aria-label={`Read "${c.title}" aloud`} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${reading === c.key ? "border-deep bg-mist text-deep" : "border-line bg-white text-body hover:bg-paper"}`}>
                  <Volume2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[13px] text-muted">Consent text version {CONSENT_VERSION}, recorded by the coordinator and stored with the record.</p>
      </Section>
    );
  } else if (key === "informant") {
    const helper = f.infType === "household_helper";
    content = (
      <Section title="Informant" sub="Optional. Someone who knows the person well describes changes in everyday life. Household help can hide early changes, so what a helper sees matters.">
        <Choice value={f.infType} onPick={(v) => upd("infType", v)} cols={3} options={[{ key: "family", label: "Family member" }, { key: "household_helper", label: "Household helper" }, { key: "none", label: "No informant" }]} />
        {f.infType === "family" && !f.consent.caregiver_involvement && <Note tone="warn">Family member involvement was not consented on the Consent step.</Note>}
        {helper && (
          <>
            <Note>Household helpers take part voluntarily, under their own consent, in a language they understand. What they report is never shared with an employer or used for employment decisions.</Note>
            <CheckRow on={f.helperConsent} onChange={(v) => upd("helperConsent", v)}>The helper agrees voluntarily, and the person consents to their involvement</CheckRow>
            <Field label="Helper's preferred language">
              <select value={f.infLanguage} onChange={(e) => upd("infLanguage", e.target.value)} className={field}>{Object.entries(NAV.languages).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </Field>
          </>
        )}
        {f.infType !== "none" && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Name" hint="Kept in the identity vault."><input value={f.infName} onChange={(e) => upd("infName", e.target.value)} className={field} autoComplete="off" dir="auto" /></Field>
              <Field label="Relation">
                <select value={f.infRelation} onChange={(e) => upd("infRelation", e.target.value)} className={field}><option value="">Choose</option>{RELATIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </Field>
              <Field label="Mobile number" hint="Kept in the identity vault."><input value={f.infPhone} onChange={(e) => upd("infPhone", e.target.value)} className={field} type="tel" autoComplete="off" /></Field>
              <Field label="IQCODE-16 average, if done today" error={err("iqcode")} hint={`1 to 5. Above ${config.IQCODE_CUTOFF} is flagged to the clinician; a screening result, not a diagnosis.`}>
                <input value={f.iqcode} onChange={(e) => upd("iqcode", e.target.value)} className={field} inputMode="decimal" placeholder="3.1" />
              </Field>
            </div>
            <div>
              <p className="text-[14px] font-medium">Changes in everyday life</p>
              <p className="mb-2 text-[13.5px] text-body">What changed, roughly when, who took over and why. Context for the clinician, not automatic evidence of decline.</p>
              <div className="space-y-2.5">
                {f.timeline.map((t, i) => {
                  const set = (k: keyof InformantChange, v: string) => upd("timeline", f.timeline.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
                  return (
                    <div key={i} className="grid gap-2 rounded-xl border border-line bg-paper/60 p-3 sm:grid-cols-[1.1fr_1.4fr_0.9fr_1fr_1.2fr_auto]">
                      <select value={t.activity_key} onChange={(e) => set("activity_key", e.target.value)} className={field} aria-label="Activity">{Object.keys(ACTIVITY).map((k) => <option key={k} value={k}>{label(ACTIVITY, k, "en")}</option>)}</select>
                      <input value={t.change} onChange={(e) => set("change", e.target.value)} className={field} placeholder="What changed" dir="auto" />
                      <input value={t.when} onChange={(e) => set("when", e.target.value)} className={field} placeholder="When" />
                      <input value={t.who_took_over} onChange={(e) => set("who_took_over", e.target.value)} className={field} placeholder="Who took over" dir="auto" />
                      <select value={t.why} onChange={(e) => set("why", e.target.value)} className={field} aria-label="Why">{WHY.map((w) => <option key={w}>{w}</option>)}</select>
                      <button type="button" onClick={() => upd("timeline", f.timeline.filter((_, j) => j !== i))} aria-label="Remove this change" className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-body hover:bg-paper"><X size={16} /></button>
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={() => upd("timeline", [...f.timeline, { activity_key: "money", change: "", when: "", who_took_over: "", why: WHY[0] }])} className={`${btnClass.secondary} mt-2.5`}>
                <Plus size={16} /> Add a change
              </button>
            </div>
          </>
        )}
      </Section>
    );
  } else if (key === "health") {
    content = (
      <Section title="Health context" sub="In the pilot these come from the clinic record through the partner's integration. Here they are entered by hand.">
        {!f.consent.clinical_record && <Note tone="warn">Health-record use was not consented. Readings entered here are not kept; only what the person tells you directly is recorded.</Note>}
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Blood pressure (mmHg)">
            <div className="flex items-center gap-2"><input value={f.sbp} onChange={(e) => upd("sbp", e.target.value)} className={field} inputMode="numeric" placeholder="130" aria-label="Systolic" /><span className="text-muted">/</span><input value={f.dbp} onChange={(e) => upd("dbp", e.target.value)} className={field} inputMode="numeric" placeholder="80" aria-label="Diastolic" /></div>
          </Field>
          <Field label="HbA1c (%)"><input value={f.hba1c} onChange={(e) => upd("hba1c", e.target.value)} className={field} inputMode="decimal" placeholder="6.1" /></Field>
          <Field label="LDL cholesterol (mmol/L)"><input value={f.ldl} onChange={(e) => upd("ldl", e.target.value)} className={field} inputMode="decimal" placeholder="3.0" /></Field>
          <Field label="BMI"><input value={f.bmi} onChange={(e) => upd("bmi", e.target.value)} className={field} inputMode="decimal" placeholder="28" /></Field>
          <Field label="Physical activity (minutes a week)"><input value={f.activity} onChange={(e) => upd("activity", e.target.value)} className={field} inputMode="numeric" placeholder="90" /></Field>
          <Field label="Home district" hint="Optional, district level only."><input value={f.district} onChange={(e) => upd("district", e.target.value)} className={field} placeholder="Al Ain" /></Field>
        </div>
        <div>
          <p className="mb-2 text-[14px] font-medium">Known conditions</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CONDITIONS.map(([k, v]) => <CheckRow key={k} on={!!f.cond[k]} onChange={(on) => upd("cond", { ...f.cond, [k]: on })}>{v}</CheckRow>)}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[14px] font-medium">Lifestyle and family</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <CheckRow on={f.smoker} onChange={(v) => upd("smoker", v)}>Smokes (cigarettes, shisha or medwakh)</CheckRow>
            <CheckRow on={f.isolated} onChange={(v) => upd("isolated", v)}>Lives alone or rarely sees family and friends</CheckRow>
            {f.consent.family_history && <CheckRow on={f.famHistory} onChange={(v) => upd("famHistory", v)}>A parent or sibling with memory problems or dementia</CheckRow>}
          </div>
        </div>
        {f.consent.genomics && (
          <Field label="Existing APOE result" hint="Imported only, never tested by MemBrain. Shown to the clinician; shared with the person only after counselling. It never changes alert thresholds.">
            <select value={f.apoe} onChange={(e) => upd("apoe", e.target.value)} className={field}>
              <option value="">None on file</option>{["e3/e3", "e2/e3", "e3/e4", "e4/e4"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </Field>
        )}
      </Section>
    );
  } else {
    const plan: [string, string, string][] = [
      ["Baseline 1", `${fmtDate(DEMO_TODAY)} (today, with you)`, "Form A or B or C, chosen for this person"],
      ["Baseline 2", fmtDate(addDays(DEMO_TODAY, 14)), "A different form"],
      ["Follow-up", fmtDate(addDays(DEMO_TODAY, 84)), "First check for change, with the family questionnaire"],
      ["Routine", "Every 6 months", "Or in 2 to 4 weeks after a “check again” result"],
    ];
    const consented = CONSENT.filter((c) => f.consent[c.key]);
    const rows: [string, ReactNode][] = [
      ["Person", <>{f.name || "–"} · {age ?? "–"} y · {f.sex === "F" ? "female" : "male"} · {band ? EDUCATION_LABEL[band] : "–"} · {f.dialect}</>],
      ["Came through", ROUTES.find((r) => r.key === f.route)?.label ?? f.route],
      ["Concern", f.text.trim() || "None recorded (routine screening)"],
      ["Channel", { whatsapp: "WhatsApp", app: "MemBrain app", phone: "Guided phone call" }[f.channel] + (f.digital === "none" ? " · family help suggested" : "")],
      ["Consent", consented.length ? consented.map((c) => c.title).join(", ") : "None"],
      ["Informant", f.infType === "none" ? "None" : `${f.infName || "Name not given"} (${RELATIONS.find(([k]) => k === f.infRelation)?.[1] ?? "relation not set"})`],
      ["Conditions", CONDITIONS.filter(([k]) => f.cond[k]).map(([, v]) => v).join(", ") || "None recorded"],
    ];
    content = (
      <Section title="Review and schedule" sub="Check the details with the person, then enrol. The record gets a pseudonymous ID.">
        <dl className="divide-y divide-line rounded-2xl border border-line text-[15px]">
          {rows.map(([k, v]) => (
            <div key={k} className="px-4 py-2.5 xl:grid xl:grid-cols-[160px_1fr] xl:gap-3">
              <dt className="text-[13px] text-muted xl:text-[15px]">{k}</dt>
              <dd className="break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="mb-2 text-[14px] font-medium">Session plan</p>
          <div className="overflow-hidden rounded-2xl border border-line">
            {plan.map(([a, b, c]) => (
              <div key={a} className="grid grid-cols-[110px_1fr] gap-3 border-b border-line px-4 py-2.5 text-[14.5px] last:border-0 sm:grid-cols-[130px_200px_1fr]">
                <span className="font-semibold">{a}</span>
                <span>{b}</span>
                <span className="col-span-2 text-[13.5px] text-body sm:col-span-1">{c}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted">Reminders go by {f.channel === "whatsapp" ? "WhatsApp" : f.channel === "phone" ? "phone" : "the app"} the day before and on the day.</p>
        </div>
      </Section>
    );
  }

  const isLast = step === STEPS.length - 1;
  const primaryLabel = urgent && key === "concern" ? "Record identity and escalate" : urgent && key === "identity" ? "Create urgent review now" : isLast ? "Enrol and create pseudonymous ID" : "Continue";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enrol a participant"
        sub="Done by a programme coordinator or clinician, with the person (and a family member if they wish)."
        aside={mode === "browser" ? <span className="rounded-2xl border border-[#ececea] bg-white px-4 py-2.5 text-[14px] text-body">Demo: saved in this browser only</span> : undefined}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Steps */}
        <nav aria-label="Enrolment steps" className="-mx-1 overflow-x-auto lg:mx-0 lg:overflow-visible">
          <ol className="flex gap-2 px-1 lg:flex-col lg:gap-1 lg:rounded-2xl lg:border lg:border-[#ebece8] lg:bg-white lg:p-3">
            {STEPS.map((s, i) => {
              const doneStep = i < step;
              const cur = i === step;
              const skipped = urgent && i > 1;
              const I = s.icon;
              return (
                <li key={s.key} className="shrink-0">
                  <button type="button" onClick={() => goTo(i)} disabled={skipped} aria-current={cur ? "step" : undefined}
                    className={`flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-start text-[14.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${cur ? "bg-[#eef4ef] font-semibold text-deep" : "text-body hover:bg-paper"}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12.5px] font-semibold ${cur ? "bg-deep text-white" : doneStep ? "bg-[#dfeae2] text-deep" : "bg-[#f0f1ee] text-muted"}`}>
                      {doneStep ? <Check size={14} strokeWidth={3} /> : <I size={14} />}
                    </span>
                    {s.title}
                  </button>
                </li>
              );
            })}
          </ol>
          {urgent && <p className="mt-2 hidden px-2 text-[13px] leading-snug text-lv-urgent lg:block">Red flag: the remaining steps can be completed after the urgent review.</p>}
        </nav>

        {/* The step */}
        <section className="rounded-2xl border border-[#ebece8] bg-white">
          <div className="px-5 py-6 sm:px-8 sm:py-7">{content}</div>
          {error && <div className="px-5 pb-4 sm:px-8"><Note tone="urgent">{error}</Note></div>}
          <div className="flex items-center gap-3 border-t border-line px-5 py-4 sm:px-8">
            {step > 0 && (
              <button type="button" onClick={() => { setTried(false); setStep(step - 1); toTop(); }} className={btnClass.secondary}>
                <ArrowLeft size={16} /> Back
              </button>
            )}
            <span className="ms-auto hidden text-[13px] text-muted sm:block">Step {step + 1} of {STEPS.length}</span>
            <button type="button" onClick={next} disabled={busy}
              className={`${urgent && (key === "concern" || key === "identity") ? btnClass.danger : btnClass.primary} min-w-[180px] ${step === 0 ? "ms-auto sm:ms-0" : ""}`}>
              {busy ? <Loader2 size={17} className="animate-spin" /> : null}
              {primaryLabel} {!busy && !isLast && !(urgent && key === "identity") && <ArrowRight size={16} />}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function UrgentNote({ flags, short = false }: { flags: string[]; short?: boolean }) {
  return (
    <Note tone="urgent">
      <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> Possible acute presentation</p>
      {!short && <p className="mt-1">Follow the emergency protocol now (ambulance 998 if needed). Do not start memory testing and do not wait for repeat tests. Record who the person is so the clinician can act; the rest can be completed later.</p>}
      <ul className="mt-1.5 list-disc ps-5">{flags.map((f) => <li key={f}>{RED_FLAGS[f]}</li>)}</ul>
    </Note>
  );
}

function Done({ done, urgent, lang, onAgain }: { done: EnrolDone; urgent: boolean; lang: Lang; onAgain: () => void }) {
  return (
    <div className="mx-auto max-w-[680px] space-y-5 pt-4">
      {urgent && (
        <Note tone="urgent">
          <p className="font-semibold">Urgent review created.</p>
          <p className="mt-0.5">This person is now among the urgent cases at the top of the clinician queue. Follow the emergency protocol; no memory testing today.</p>
        </Note>
      )}
      <div className="rounded-2xl border border-[#ebece8] bg-white px-6 py-9 text-center sm:px-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-deep text-white shadow-[0_14px_34px_-14px_rgb(15_63_44/0.65)]"><Check size={30} strokeWidth={2.6} /></span>
        <h2 className="mt-5 font-serif text-[30px] font-semibold tracking-[-0.015em]">Enrolled</h2>
        <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-leaf">Pseudonymous ID</p>
        <p className="mt-1 font-mono text-[34px] font-semibold tracking-[0.04em] text-deep">{done.id}</p>
        <p className="mx-auto mt-3 max-w-[480px] text-[14.5px] leading-snug text-body">
          Name and contact details are in the identity vault only. Clinicians see <span className="whitespace-nowrap font-mono">{done.id}</span>, and can show the contact details for follow-up with a reason, which is audited.
          {done.phone_linked && " The person can now sign in with their mobile number to do their own check-ins."}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          {!urgent && (
            <Link href={`/checkin/?id=${encodeURIComponent(done.id)}&lang=${lang}`} className={btnClass.primary}><Mic size={16} /> Start baseline check-in now</Link>
          )}
          <Link href={caseHref(done.id)} className={urgent ? btnClass.danger : btnClass.secondary}><Stethoscope size={16} /> Open the case</Link>
          <button type="button" onClick={onAgain} className={btnClass.secondary}><Plus size={16} /> Enrol another person</button>
        </div>
      </div>
    </div>
  );
}
