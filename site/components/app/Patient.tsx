"use client";

// The person's (and their family's) app, in English and Modern Standard Arabic: what happens next, the spoken
// check-in, reporting a change, the family questionnaire, and their plan. Never a score.
import Link from "next/link";
import { CalendarClock, ChevronRight, ClipboardCheck, Globe2, HeartPulse, Home, Leaf, LogOut, Mic, Phone, ShieldCheck, User } from "lucide-react";
import { Card, cx, Hero, Scroll, SectionTitle, TopBar, type Tab } from "./kit";
import { Logo } from "../Logo";
import programmeData from "@/lib/generated/programme-data.json";
import type { Lang } from "@/lib/mb";
import { FAQ_INTERVAL_WEEKS } from "@/lib/workspace/informant";
import type { Case } from "@/lib/workspace/types";

const MESSAGES = (programmeData as unknown as { messages: Record<string, [string, string]> }).messages;
const arNum = (s: string | number) => String(s).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

export const PT = {
  en: {
    tabs: ["Home", "Check-in", "Family", "Me"], plus: "Report a change",
    hello: (h: number) => (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"),
    status: "Your latest", next: "Next check-in", nextSub: "About six minutes, spoken in your own dialect",
    start: "Start check-in", plan: "Your plan", recent: "Your recent activity", noRecent: "Nothing yet. Your first check-in builds your personal baseline.",
    checkinTitle: "Spoken check-in", checkinBody: "Word lists, a short story and everyday questions. You are compared with your own earlier results and with people of your age and schooling. You never see a score; if anything needs a closer look, your clinic contacts you.",
    checkinPoints: ["Find a quiet place", "Have your glasses or hearing aid ready", "A family member can sit with you"],
    familyTitle: "Family questionnaire", familyBody: `Ten short questions for a family member about everyday activities. We ask again about every ${FAQ_INTERVAL_WEEKS} weeks so the clinic can see change. A screening step, never a diagnosis.`,
    familyLast: (d: string) => `Last answered ${d}`, familyNever: "Not answered yet", familyStart: "Answer the questionnaire",
    reportTitle: "Report a change", reportBody: "Something new since last time? Say it in your own words. It is added to your record with the date, and urgent signs are checked first.",
    me: "Me", lang: "Language", privacy: "Privacy", privacyBody: "Your name and number are kept apart from your health record. MemBrain does not diagnose.", signOut: "Sign out",
    emergency: "In an emergency, call 998", kinds: { intake: "You reported a change", informant: "Family questionnaire", checkin: "Check-in" } as Record<string, string>,
    ref: "Reference",
  },
  ar: {
    tabs: ["الرئيسية", "الفحص", "الأسرة", "حسابي"], plus: "الإبلاغ عن تغيّر",
    hello: (h: number) => (h < 12 ? "صباح الخير" : "مساء الخير"),
    status: "آخر المستجدات", next: "الفحص القادم", nextSub: "نحو ست دقائق، بالكلام وبلهجتك",
    start: "ابدأ الفحص", plan: "خطتك", recent: "نشاطك الأخير", noRecent: "لا شيء بعد. فحصك الأول يحدد مستواك الطبيعي.",
    checkinTitle: "الفحص الصوتي", checkinBody: "قوائم كلمات وقصة قصيرة وأسئلة يومية. تُقارَن بنتائجك السابقة وبمن هم في عمرك ومستواك التعليمي. لا ترى أي درجة؛ وإذا احتاج أمر إلى نظرة أدق، تتواصل معك عيادتك.",
    checkinPoints: ["اختر مكانًا هادئًا", "جهّز نظارتك أو سماعتك", "يمكن لأحد أفراد أسرتك الجلوس معك"],
    familyTitle: "استبيان الأسرة", familyBody: `عشرة أسئلة قصيرة لأحد أفراد الأسرة عن الأنشطة اليومية. نسأل مرة أخرى كل ${arNum(FAQ_INTERVAL_WEEKS)} أسبوعًا تقريبًا كي ترى العيادة التغيّر. خطوة فحص أولي، وليست تشخيصًا.`,
    familyLast: (d: string) => `آخر إجابة في ${d}`, familyNever: "لم تتم الإجابة بعد", familyStart: "أجب عن الاستبيان",
    reportTitle: "الإبلاغ عن تغيّر", reportBody: "هل هناك شيء جديد منذ المرة الماضية؟ قله بكلماتك. يُضاف إلى سجلك مع التاريخ، ونتحقق أولًا من العلامات العاجلة.",
    me: "حسابي", lang: "اللغة", privacy: "الخصوصية", privacyBody: "يُحفظ اسمك ورقمك بعيدًا عن سجلك الصحي. MemBrain لا يشخّص.", signOut: "تسجيل الخروج",
    emergency: "في حالات الطوارئ، اتصل على ٩٩٨", kinds: { intake: "أبلغت عن تغيّر", informant: "استبيان الأسرة", checkin: "فحص" } as Record<string, string>,
    ref: "الرقم المرجعي",
  },
};

export const patientTabs = (lang: Lang): [Tab, Tab, Tab, Tab] => {
  const t = PT[lang].tabs;
  return [
    { key: "home", label: t[0], icon: Home },
    { key: "checkin", label: t[1], icon: Mic },
    { key: "family", label: t[2], icon: ClipboardCheck },
    { key: "me", label: t[3], icon: User },
  ];
};

const fmt = (d: string, lang: Lang) => {
  const s = new Date(d.slice(0, 10) + "T00:00:00Z").toLocaleDateString(lang === "ar" ? "ar-AE-u-nu-arab" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return s;
};
const addDays = (iso: string, d: number) => new Date(Date.parse(iso.slice(0, 10) + "T00:00:00Z") + d * 86400000).toISOString().slice(0, 10);
const nameOf = (c: Case, lang: Lang) => (c.participant.enrolled === false ? "" : c.participant.display_name?.[lang] || c.participant.display_name?.en || "");

function statusKey(c: Case): string {
  const scored = [...c.history].reverse().find((h) => !h.intake && !h.informant_report);
  if (!scored) return "BASELINE";
  return scored.valid === false ? "INVALID" : scored.level;
}

export function PatientHome({ c, lang, onTab, onReport }: { c: Case; lang: Lang; onTab: (k: string) => void; onReport: () => void }) {
  const t = PT[lang];
  const i = lang === "ar" ? 1 : 0;
  const key = statusKey(c);
  const msg = (MESSAGES[key] ?? MESSAGES.BASELINE)[i];
  const scored = c.participant.sessions.filter((s) => s.type !== "intake" && s.type !== "informant").map((s) => s.date.slice(0, 10)).sort();
  const last = scored[scored.length - 1];
  const nextDate = last ? addDays(last, key === "CHECK_AGAIN" ? 21 : scored.length < 2 ? 14 : 182) : "2026-11-14";
  const recent = [...c.participant.sessions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  const name = nameOf(c, lang);
  return (
    <Scroll>
      <Hero>
        <div className="flex items-center justify-between">
          <Logo inverted size="sm" />
          <span className="rounded-full bg-white/12 px-2.5 py-1 font-mono text-[11.5px] ring-1 ring-white/20">{c.participant.id}</span>
        </div>
        <p className="mt-6 text-[14px] text-white/70">{t.hello(new Date().getHours())}{name ? (lang === "ar" ? `، ${name}` : `, ${name}`) : ""}</p>
        <Card className="mt-3 border-white/0 bg-white/95 p-4 text-ink">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-leaf">{t.status}</p>
          <p className={cx("mt-1.5 text-[15.5px] text-ink", lang === "ar" ? "leading-[1.85]" : "leading-relaxed")}>{msg}</p>
        </Card>
      </Hero>

      <div className="px-5">
        <Card className="mt-4 flex items-center gap-4 p-4" onClick={() => onTab("checkin")}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-deep text-white"><CalendarClock size={22} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf">{t.next}</span>
            <span className="mt-0.5 block text-[16.5px] font-semibold">{fmt(nextDate, lang)}</span>
            <span className="block text-[12.5px] text-muted">{t.nextSub}</span>
          </span>
          <ChevronRight size={20} className="text-muted rtl:-scale-x-100" />
        </Card>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Card className="p-4" onClick={onReport}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lv-review-soft text-lv-review"><HeartPulse size={19} /></span>
            <p className="mt-3 text-[14.5px] font-semibold">{t.plus}</p>
          </Card>
          <Card className="p-4" onClick={() => onTab("family")}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9eef8] text-[#3f5f9b]"><ClipboardCheck size={19} /></span>
            <p className="mt-3 text-[14.5px] font-semibold">{t.familyTitle}</p>
          </Card>
        </div>
      </div>

      {c.prevention?.items?.length ? (
        <>
          <SectionTitle>{t.plan}</SectionTitle>
          <Card className="mx-5 divide-y divide-line">
            {c.prevention.items.map((x) => (
              <p key={x.rule} className={cx("flex gap-3 px-4 py-3.5 text-[14px]", lang === "ar" ? "leading-[1.8]" : "leading-snug")}>
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e7efe9] text-leaf"><Leaf size={14} /></span>{x.text}
              </p>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>{t.recent}</SectionTitle>
      <Card className="mx-5 divide-y divide-line">
        {recent.length === 0 && <p className="px-4 py-4 text-[14px] text-body">{t.noRecent}</p>}
        {recent.map((s) => (
          <div key={s.session_id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-[14px] font-medium">{t.kinds[s.type === "intake" || s.type === "informant" ? s.type : "checkin"]}</span>
            <span className="text-[12.5px] text-muted">{fmt(s.date, lang)}</span>
          </div>
        ))}
      </Card>
      <a href="tel:998" className="mx-5 mt-6 flex items-center justify-center gap-2 rounded-2xl border border-lv-urgent/20 bg-white py-3 text-[14px] font-semibold text-lv-urgent"><Phone size={16} /> {t.emergency}</a>
    </Scroll>
  );
}

export function PatientCheckin({ c, lang }: { c: Case; lang: Lang }) {
  const t = PT[lang];
  return (
    <Scroll>
      <TopBar title={t.checkinTitle} />
      <div className="px-5 pt-6">
        <div className="relative overflow-hidden rounded-[26px] bg-deep p-6 text-white">
          <div aria-hidden className="absolute -end-10 -top-10 h-40 w-40 rounded-full bg-sand/25 blur-2xl" />
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25"><Mic size={26} /></span>
          <p className={cx("relative mt-5 text-[15px] text-white/85", lang === "ar" ? "leading-[1.9]" : "leading-relaxed")}>{t.checkinBody}</p>
          <ul className="relative mt-5 space-y-2">
            {t.checkinPoints.map((p) => <li key={p} className="flex items-center gap-2.5 text-[14px]"><ShieldCheck size={16} className="text-sand" /> {p}</li>)}
          </ul>
        </div>
        <Link href={`/checkin/?id=${encodeURIComponent(c.participant.id)}&lang=${lang}`} className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-deep py-4 text-[16.5px] font-semibold text-white shadow-[0_14px_30px_-14px_rgb(15_63_44/0.7)] active:bg-deep-hover">
          <Mic size={19} /> {t.start}
        </Link>
      </div>
    </Scroll>
  );
}

export function PatientFamily({ c, lang }: { c: Case; lang: Lang }) {
  const t = PT[lang];
  const last = [...c.participant.sessions].filter((s) => s.type === "informant").sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return (
    <Scroll>
      <TopBar title={t.familyTitle} />
      <div className="px-5 pt-6">
        <Card className="p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e9eef8] text-[#3f5f9b]"><ClipboardCheck size={22} /></span>
          <p className={cx("mt-4 text-[15px] text-body", lang === "ar" ? "leading-[1.9]" : "leading-relaxed")}>{t.familyBody}</p>
          <p className="mt-4 rounded-xl bg-[#f6f8f5] px-3.5 py-2.5 text-[13.5px] font-medium text-deep">{last ? t.familyLast(fmt(last.date, lang)) : t.familyNever}</p>
        </Card>
        <Link href={`/informant/?id=${encodeURIComponent(c.participant.id)}&lang=${lang}`} className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-deep py-4 text-[16.5px] font-semibold text-white active:bg-deep-hover">
          <ClipboardCheck size={19} /> {t.familyStart}
        </Link>
      </div>
    </Scroll>
  );
}

export function PatientMe({ c, lang, setLang, onSignOut }: { c: Case; lang: Lang; setLang: (l: Lang) => void; onSignOut: () => void }) {
  const t = PT[lang];
  return (
    <Scroll>
      <TopBar title={t.me} />
      <div className="space-y-4 px-5 pt-5">
        <Card className="flex items-center gap-4 p-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-deep text-[18px] font-semibold text-white">{(nameOf(c, lang) || "•").slice(0, 1)}</span>
          <span>
            <span className="block text-[16.5px] font-semibold">{nameOf(c, lang) || c.participant.id}</span>
            <span className="block text-[13px] text-muted">{t.ref} <span className="font-mono">{c.participant.id}</span></span>
          </span>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-2 text-[14.5px] font-semibold"><Globe2 size={17} className="text-leaf" /> {t.lang}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["ar", "en"] as Lang[]).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} lang={l} className={cx("rounded-xl py-3 text-[15px] font-semibold", lang === l ? "bg-deep text-white" : "bg-[#f3f5f1] text-body")}>{l === "ar" ? "العربية" : "English"}</button>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-2 text-[14.5px] font-semibold"><ShieldCheck size={17} className="text-leaf" /> {t.privacy}</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-body">{t.privacyBody}</p>
        </Card>
        <button type="button" onClick={onSignOut} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white py-3.5 text-[15px] font-semibold text-lv-review active:bg-paper"><LogOut size={17} /> {t.signOut}</button>
      </div>
    </Scroll>
  );
}
