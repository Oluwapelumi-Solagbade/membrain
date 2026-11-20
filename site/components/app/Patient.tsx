"use client";

// The person's (and their family's) app, in English and Modern Standard Arabic: what happens next, the spoken
// check-in, reporting a change, the family questionnaire, and their plan. Never a score.
import Link from "next/link";
import { CalendarClock, ChevronRight, ClipboardCheck, Globe2, HeartHandshake, HeartPulse, Home, Leaf, LogOut, Mic, Phone, ShieldCheck, User } from "lucide-react";
import { Avatar, Card, cx, LiveBadge, Screen, SectionTitle, tap, type Tab } from "./kit";
import { useWorkspace } from "../clinician/WorkspaceProvider";
import programmeData from "@/lib/generated/programme-data.json";
import type { Lang } from "@/lib/mb";
import { getHomeUrl, signOutAndGoHome } from "@/lib/auth";
import { participantNameOf } from "@/lib/workspace/derive";
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
const nameOf = (c: Case, lang: Lang) => participantNameOf(c.participant, lang);

function statusKey(c: Case): string {
  const scored = [...c.history].reverse().find((h) => !h.intake && !h.informant_report);
  if (!scored) return "BASELINE";
  return scored.valid === false ? "INVALID" : scored.level;
}

export function PatientHome({ c, lang, onTab, onReport }: { c: Case; lang: Lang; onTab: (k: string) => void; onReport: () => void }) {
  const t = PT[lang];
  const { syncedAt, syncing, refresh } = useWorkspace();
  const i = lang === "ar" ? 1 : 0;
  const key = statusKey(c);
  const msg = (MESSAGES[key] ?? MESSAGES.BASELINE)[i];
  const scored = c.participant.sessions.filter((s) => s.type !== "intake" && s.type !== "informant").map((s) => s.date.slice(0, 10)).sort();
  const last = scored[scored.length - 1];
  const nextDate = last ? addDays(last, key === "CHECK_AGAIN" ? 21 : scored.length < 2 ? 14 : 182) : new Date().toISOString().slice(0, 10);
  const recent = [...c.participant.sessions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  const name = nameOf(c, lang);
  const hero = (
    <div className="relative overflow-hidden rounded-b-[34px] bg-deep px-5 pb-6 text-white" style={{ paddingTop: "calc(var(--mb-sat) + 14px)" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgb(224_173_98/0.28),transparent_55%),radial-gradient(100%_90%_at_0%_110%,rgb(58_140_100/0.55),transparent_60%)]" />
      <div aria-hidden className="pointer-events-none absolute -end-16 -top-10 h-56 w-56 rounded-full border border-white/10" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <LiveBadge dark syncedAt={syncedAt} syncing={syncing} onSync={() => void refresh()} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                tap();
                const { signOutAndGoHome } = await import("@/lib/auth");
                await signOutAndGoHome(lang);
              }}
              title={t.signOut}
              aria-label={t.signOut}
              className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12.5px] font-medium text-white/90 hover:bg-white/20 transition-colors"
            >
              <LogOut size={14} className="rtl:-scale-x-100" />
              <span>{t.signOut}</span>
            </button>
            <button type="button" onClick={() => { tap(); onTab("me"); }} aria-label={t.me} className="rounded-full ring-2 ring-white/25"><Avatar name={name || c.participant.id} color="#2a6045" size={38} /></button>
          </div>
        </div>
        <p className="mt-6 text-[14.5px] text-white/70">{t.hello(new Date().getHours())}</p>
        <h1 className={cx("mt-1 text-[28px] font-semibold tracking-[-0.03em]", lang === "ar" ? "leading-[1.4]" : "leading-[1.15]")}>{name || c.participant.id}</h1>
        <div className="mt-4 rounded-[22px] bg-white/95 p-4 text-ink shadow-[0_18px_40px_-24px_rgb(0_0_0/0.6)]">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-leaf">{t.status}</p>
          <p className={cx("mt-1.5 text-[15.5px]", lang === "ar" ? "leading-[1.85]" : "leading-relaxed")}>{msg}</p>
        </div>
      </div>
    </div>
  );
  return (
    <Screen title={name || t.tabs[0]} hero={hero} onRefresh={refresh} refreshing={syncing}>
      <div className="px-5">
        <Card className="mt-5 flex items-center gap-4 p-4" onClick={() => onTab("checkin")}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-b from-[#1b5a40] to-deep text-white"><CalendarClock size={22} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11.5px] font-semibold uppercase tracking-[0.12em] text-leaf">{t.next}</span>
            <span className="mt-0.5 block text-[17px] font-semibold tracking-[-0.01em]">{fmt(nextDate, lang)}</span>
            <span className="block text-[12.5px] text-muted">{t.nextSub}</span>
          </span>
          <ChevronRight size={20} className="text-[#b3bdb8] rtl:-scale-x-100" />
        </Card>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Card className="p-4" onClick={onReport}>
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-lv-review-soft text-lv-review"><HeartPulse size={20} /></span>
            <p className="mt-3 text-[15px] font-semibold leading-snug">{t.plus}</p>
          </Card>
          <Card className="p-4" onClick={() => onTab("family")}>
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#e9eef8] text-[#4a6fb0]"><ClipboardCheck size={20} /></span>
            <p className="mt-3 text-[15px] font-semibold leading-snug">{t.familyTitle}</p>
          </Card>
        </div>
      </div>

      {c.prevention?.items?.length ? (
        <>
          <SectionTitle>{t.plan}</SectionTitle>
          <Card className="mx-5 divide-y divide-[#eef0ec]">
            {c.prevention.items.map((x) => (
              <p key={x.rule} className={cx("flex gap-3 px-4 py-3.5 text-[14px]", lang === "ar" ? "leading-[1.8]" : "leading-snug")}>
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e7efe9] text-leaf"><Leaf size={14} /></span>{x.text}
              </p>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>{t.recent}</SectionTitle>
      <Card className="mx-5 divide-y divide-[#eef0ec]">
        {recent.length === 0 && <p className="px-4 py-4 text-[14px] text-body">{t.noRecent}</p>}
        {recent.map((s) => {
          const k = s.type === "intake" || s.type === "informant" ? s.type : "checkin";
          const I = k === "intake" ? HeartPulse : k === "informant" ? ClipboardCheck : Mic;
          return (
            <div key={s.session_id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef3ef] text-deep"><I size={16} /></span>
              <span className="min-w-0 flex-1 text-[14px] font-medium">{t.kinds[k]}</span>
              <span className="text-[12px] text-muted">{fmt(s.date, lang)}</span>
            </div>
          );
        })}
      </Card>
      <a href="tel:998" className="mx-5 mt-6 flex items-center justify-center gap-2 rounded-[18px] border border-lv-urgent/20 bg-white py-3.5 text-[14px] font-semibold text-lv-urgent"><Phone size={16} /> {t.emergency}</a>
    </Screen>
  );
}

export function PatientCheckin({ c, lang }: { c: Case; lang: Lang }) {
  const t = PT[lang];
  return (
    <Screen title={t.checkinTitle}>
      <div className="px-5 pt-5">
        <div className="relative overflow-hidden rounded-[28px] bg-deep p-6 text-white shadow-[0_24px_50px_-30px_rgb(15_63_44/0.9)]">
          <div aria-hidden className="absolute -end-10 -top-10 h-44 w-44 rounded-full bg-sand/25 blur-2xl" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-[18px] bg-white/15 ring-1 ring-white/25"><Mic size={26} /></span>
          <p className={cx("relative mt-5 text-[15px] text-white/85", lang === "ar" ? "leading-[1.9]" : "leading-relaxed")}>{t.checkinBody}</p>
          <ul className="relative mt-5 space-y-2.5">
            {t.checkinPoints.map((x) => <li key={x} className="flex items-center gap-2.5 text-[14px]"><ShieldCheck size={16} className="text-sand" /> {x}</li>)}
          </ul>
        </div>
        <Link href={`/checkin/?id=${encodeURIComponent(c.participant.id)}&lang=${lang}`} onClick={() => tap("MEDIUM")} className="mt-5 flex h-[56px] items-center justify-center gap-2 rounded-[18px] bg-gradient-to-b from-[#1b5a40] to-deep text-[16.5px] font-semibold text-white shadow-[0_14px_30px_-14px_rgb(15_63_44/0.8)]">
          <Mic size={19} /> {t.start}
        </Link>
      </div>
    </Screen>
  );
}

export function PatientFamily({ c, lang }: { c: Case; lang: Lang }) {
  const t = PT[lang];
  const last = [...c.participant.sessions].filter((s) => s.type === "informant").sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return (
    <Screen title={t.familyTitle}>
      <div className="px-5 pt-5">
        <Card className="p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#e9eef8] text-[#4a6fb0]"><ClipboardCheck size={22} /></span>
          <p className={cx("mt-4 text-[15px] text-body", lang === "ar" ? "leading-[1.9]" : "leading-relaxed")}>{t.familyBody}</p>
          <p className="mt-4 rounded-[14px] bg-[#f5f7f4] px-3.5 py-2.5 text-[13.5px] font-medium text-deep">{last ? t.familyLast(fmt(last.date, lang)) : t.familyNever}</p>
        </Card>
        <Link href={`/informant/?id=${encodeURIComponent(c.participant.id)}&lang=${lang}`} onClick={() => tap("MEDIUM")} className="mt-5 flex h-[56px] items-center justify-center gap-2 rounded-[18px] bg-gradient-to-b from-[#1b5a40] to-deep text-[16.5px] font-semibold text-white">
          <ClipboardCheck size={19} /> {t.familyStart}
        </Link>
      </div>
    </Screen>
  );
}

export function PatientMe({ c, lang, setLang, onSignOut }: { c: Case; lang: Lang; setLang: (l: Lang) => void; onSignOut: () => void }) {
  const t = PT[lang];
  const { syncedAt, syncing, refresh } = useWorkspace();
  return (
    <Screen title={t.me} right={<LiveBadge syncedAt={syncedAt} syncing={syncing} onSync={() => void refresh()} />}>
      <div className="space-y-3 px-5 pt-5">
        <Card className="flex items-center gap-4 p-4">
          <Avatar name={nameOf(c, lang) || c.participant.id} size={56} />
          <span className="min-w-0">
            <span className="block truncate text-[17px] font-semibold">{nameOf(c, lang) || c.participant.id}</span>
            <span className="block text-[13px] text-muted">{t.ref} <span className="font-mono">{c.participant.id}</span></span>
          </span>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-2 text-[14.5px] font-semibold"><Globe2 size={17} className="text-leaf" /> {t.lang}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["ar", "en"] as Lang[]).map((l) => (
              <button key={l} type="button" onClick={() => { tap(); setLang(l); }} lang={l} className={cx("rounded-[14px] py-3 text-[15px] font-semibold transition-colors", lang === l ? "bg-deep text-white" : "bg-[#f3f5f1] text-body")}>{l === "ar" ? "العربية" : "English"}</button>
            ))}
          </div>
        </Card>
        <Link href={`/mylife/?id=${encodeURIComponent(c.participant.id)}&lang=${lang}`} className="block">
          <Card className="flex items-center justify-between p-4 hover:border-leaf/50 transition-colors">
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100/70 text-amber-800">
                <HeartHandshake size={20} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                  {lang === "ar" ? "ملف MyLife للرعاية" : "MyLife Care Profile"}
                  <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">
                    {lang === "ar" ? "قريبًا" : "Coming Soon"}
                  </span>
                </span>
                <span className="block truncate text-[12.5px] text-muted">
                  {lang === "ar" ? "قصة حياتك وبطاقة الرعاية لطواقم المستشفى" : "Life story & quick care card for hospital teams"}
                </span>
              </span>
            </span>
            <ChevronRight size={18} className="text-muted rtl:-scale-x-100" />
          </Card>
        </Link>
        <Card className="p-4">
          <p className="flex items-center gap-2 text-[14.5px] font-semibold"><ShieldCheck size={17} className="text-leaf" /> {t.privacy}</p>
          <p className={cx("mt-1.5 text-[13.5px] text-body", lang === "ar" ? "leading-[1.85]" : "leading-relaxed")}>{t.privacyBody}</p>
        </Card>
        <button type="button" onClick={() => { tap(); onSignOut(); }} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[18px] border border-rose-200 bg-rose-50/70 text-[15px] font-semibold text-rose-700 hover:bg-rose-100 transition-colors"><LogOut size={17} className="rtl:-scale-x-100" /> {t.signOut}</button>
      </div>
    </Screen>
  );
}
