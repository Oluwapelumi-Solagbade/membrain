"use client";

// The MemBrain mobile app: splash, sign-in, then the clinician's or the person's app. Screens opened on top of a tab
// (a case, a new concern) are kept in a small stack tied to the browser history, so Android's back button closes them.
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Frame, Sheet, SheetAction, TabBar } from "./kit";
import { CaseScreen, CLIN_TABS, ClinicianAlerts, ClinicianHome, ClinicianMap, ClinicianPlus, ClinicianReports } from "./Clinician";
import { Intake } from "./Intake";
import { PatientCheckin, PatientFamily, PatientHome, PatientMe, patientTabs, PT } from "./Patient";
import { Welcome } from "./SignIn";
import { WorkspaceProvider, useWorkspace } from "../clinician/WorkspaceProvider";
import { LogoMark } from "../Logo";
import { ClipboardCheck, HeartPulse, Mic } from "lucide-react";
import { markInApp } from "@/lib/app";
import { signOut, useSession } from "@/lib/auth";
import type { Lang } from "@/lib/mb";
import { getBackend } from "@/lib/workspace/backend";

const LANG_KEY = "membrain.app.lang";
type Layer = { kind: "case"; id: string } | { kind: "intake"; followPid: string | null };

function useStack() {
  const [stack, setStack] = useState<Layer[]>([]);
  useEffect(() => {
    const pop = () => setStack((s) => s.slice(0, -1));
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const push = useCallback((l: Layer) => {
    window.history.pushState({ membrainLayer: true }, "");
    setStack((s) => [...s, l]);
  }, []);
  const back = useCallback(() => window.history.back(), []);
  return { top: stack[stack.length - 1] ?? null, push, back };
}

export function MobileApp() {
  const { session, ready } = useSession();
  const [splash, setSplash] = useState(true);
  const [mode, setMode] = useState<"server" | "browser" | null>(null);
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    markInApp();
    try {
      const l = window.localStorage.getItem(LANG_KEY);
      if (l === "ar" || l === "en") setLangState(l); // eslint-disable-line react-hooks/set-state-in-effect
    } catch {
      /* ignore */
    }
    const t0 = Date.now();
    getBackend()
      .then((b) => setMode(b.mode))
      .catch(() => setMode("browser"))
      .finally(() => window.setTimeout(() => setSplash(false), Math.max(0, 1400 - (Date.now() - t0))));
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  };

  if (splash || !ready) return <Splash mode={mode} lang={lang} />;
  if (!session) return <Frame><Welcome lang={lang} setLang={setLang} onSignedIn={() => {}} /></Frame>;
  return (
    <WorkspaceProvider key={session.user.id}>
      {session.user.role === "participant" ? <PatientShell lang={lang} setLang={setLang} pid={session.user.pid ?? ""} /> : <ClinicianShell mode={mode} />}
    </WorkspaceProvider>
  );
}

function Splash({ mode, lang }: { mode: "server" | "browser" | null; lang: Lang }) {
  const ar = lang === "ar";
  const line = mode === null ? (ar ? "جارٍ تشغيل محرك MemBrain على الجهاز…" : "Starting the on-device engine…")
    : mode === "server" ? (ar ? "متصل بخادم MemBrain" : "Connected to the MemBrain server") : (ar ? "يعمل على هذا الهاتف" : "Running on this phone");
  return (
    <Frame dir={ar ? "rtl" : "ltr"} lang={lang}>
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-deep text-white">
        <div aria-hidden className="absolute -top-24 end-[-80px] h-72 w-72 rounded-full bg-sand/20 blur-3xl" />
        <div aria-hidden className="absolute -bottom-24 start-[-80px] h-72 w-72 rounded-full bg-[#2f7a4f]/50 blur-3xl" />
        <div className="relative mb-float">
          <span className="flex h-24 w-24 items-center justify-center rounded-[30px] bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <LogoMark inverted className="h-14 w-14" />
          </span>
        </div>
        <p className="relative mt-6 font-serif text-[30px] font-semibold tracking-[-0.01em]">MemBrain</p>
        <p className="relative mt-1 text-[13.5px] text-white/65">{ar ? "صحة الدماغ، بكلماتك" : "Brain health, in your own words"}</p>
        <div className="relative mt-10 h-1 w-40 overflow-hidden rounded-full bg-white/15"><span className="block h-full w-1/2 animate-[mb-load_1.1s_ease-in-out_infinite] rounded-full bg-sand" /></div>
        <p className="relative mt-3 flex items-center gap-2 text-[12.5px] text-white/70">{mode === null && <Loader2 size={13} className="animate-spin" />}{line}</p>
        <p className="absolute bottom-8 text-[11px] text-white/40" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>{ar ? "نموذج تجريبي · لا يشخّص" : "Prototype · never diagnoses"}</p>
      </div>
    </Frame>
  );
}

function ClinicianShell({ mode }: { mode: "server" | "browser" | null }) {
  const [tab, setTab] = useState("home");
  const [plus, setPlus] = useState(false);
  const { top, push, back } = useStack();
  const { ready } = useWorkspace();
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("case");
    if (id) push({ kind: "case", id });
  }, [push]);
  const open = (id: string) => push({ kind: "case", id });
  if (!ready) return <Frame><Loading /></Frame>;
  return (
    <Frame>
      {top?.kind === "case" ? (
        <CaseScreen id={top.id} onBack={back} onFollow={(id) => push({ kind: "intake", followPid: id })} />
      ) : top?.kind === "intake" ? (
        <Intake lang="en" staff followPid={top.followPid} onBack={back} onOpenCase={(id) => { back(); window.setTimeout(() => open(id), 60); }} />
      ) : (
        <>
          {tab === "home" && <ClinicianHome onOpen={open} onTab={setTab} mode={mode} />}
          {tab === "map" && <ClinicianMap onOpen={open} />}
          {tab === "alerts" && <ClinicianAlerts onOpen={open} />}
          {tab === "reports" && <ClinicianReports onOpen={open} />}
          <TabBar tabs={CLIN_TABS} current={tab} onTab={setTab} onPlus={() => setPlus(true)} plusLabel="New" />
          <ClinicianPlus open={plus} onClose={() => setPlus(false)} onIntake={() => push({ kind: "intake", followPid: null })} />
        </>
      )}
    </Frame>
  );
}

function PatientShell({ lang, setLang, pid }: { lang: Lang; setLang: (l: Lang) => void; pid: string }) {
  const [tab, setTab] = useState("home");
  const [plus, setPlus] = useState(false);
  const { top, push, back } = useStack();
  const { cases, ready } = useWorkspace();
  const c = cases.find((x) => x.participant.id === pid) ?? null;
  const t = PT[lang];
  if (!ready || !c) return <Frame dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}><Loading /></Frame>;
  const report = () => push({ kind: "intake", followPid: pid });
  return (
    <Frame dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      {top?.kind === "intake" ? (
        <Intake lang={lang} staff={false} followPid={top.followPid} defaultReporter="self" onBack={back} />
      ) : (
        <>
          {tab === "home" && <PatientHome c={c} lang={lang} onTab={setTab} onReport={report} />}
          {tab === "checkin" && <PatientCheckin c={c} lang={lang} />}
          {tab === "family" && <PatientFamily c={c} lang={lang} />}
          {tab === "me" && <PatientMe c={c} lang={lang} setLang={setLang} onSignOut={() => void signOut()} />}
          <TabBar tabs={patientTabs(lang)} current={tab} onTab={setTab} onPlus={() => setPlus(true)} plusLabel={t.plus} />
          <Sheet open={plus} onClose={() => setPlus(false)} title={lang === "ar" ? "ماذا تريد أن تفعل؟" : "What would you like to do?"}>
            <SheetAction icon={HeartPulse} title={t.reportTitle} sub={t.reportBody} tone="bg-lv-review-soft text-lv-review" onClick={() => { setPlus(false); report(); }} />
            <SheetAction icon={Mic} title={t.checkinTitle} sub={t.nextSub} href={`/checkin/?id=${encodeURIComponent(pid)}&lang=${lang}`} onClick={() => setPlus(false)} />
            <SheetAction icon={ClipboardCheck} title={t.familyTitle} sub={lang === "ar" ? "عشرة أسئلة قصيرة لأحد أفراد الأسرة" : "Ten short questions for a family member"} href={`/informant/?id=${encodeURIComponent(pid)}&lang=${lang}`} onClick={() => setPlus(false)} tone="bg-[#e9eef8] text-[#3f5f9b]" />
          </Sheet>
        </>
      )}
    </Frame>
  );
}

function Loading() {
  return <div className="flex flex-1 items-center justify-center"><Loader2 size={22} className="animate-spin text-deep" /></div>;
}
