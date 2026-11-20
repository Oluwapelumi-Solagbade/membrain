"use client";

// The MemBrain mobile app. It works against the live MemBrain server only: the splash connects (and waits for a server
// that is waking up), and if the server cannot be reached the app says so and offers to retry, instead of quietly
// showing an offline copy. Then sign-in, and the clinician's or the person's app. Screens opened on top of a tab (a case,
// a new concern) are a small stack tied to the browser history, so Android's back button closes them.
import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardCheck, CloudOff, HeartHandshake, HeartPulse, Loader2, LogOut, Mic, RefreshCw, ScrollText, Server, ShieldCheck, Wifi } from "lucide-react";
import { Avatar, Frame, Sheet, SheetAction, TabBar, Toasts, relTime, tap, useStatusBar, useToast } from "./kit";
import { CaseScreen, CLIN_TABS, ClinicianAlerts, ClinicianHome, ClinicianMap, ClinicianPlus, ClinicianReports } from "./Clinician";
import { Intake } from "./Intake";
import { PatientCheckin, PatientFamily, PatientHome, PatientMe, patientTabs, PT } from "./Patient";
import { Welcome } from "./SignIn";
import { WorkspaceProvider, useWorkspace } from "../clinician/WorkspaceProvider";
import { LogoMark } from "../Logo";
import { markInApp } from "@/lib/app";
import { signOutAndGoHome, useSession, getHomeUrl } from "@/lib/auth";
import { config, type Lang } from "@/lib/mb";
import { getBackend, requireServer, resetBackend } from "@/lib/workspace/backend";
import { isActive, levelOf } from "@/lib/workspace/derive";
import type { AuditEntry } from "@/lib/workspace/types";

const LANG_KEY = "membrain.app.lang";
const VERSION = "1.2";
type Layer = { kind: "case"; id: string } | { kind: "intake"; followPid: string | null };
type Conn = "connecting" | "waking" | "ok" | "failed";

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
  const [conn, setConn] = useState<Conn>("connecting");
  const [shown, setShown] = useState(false);
  const [lang, setLangState] = useState<Lang>("en");

  const connect = useCallback(() => {
    setConn("connecting");
    const slow = window.setTimeout(() => setConn((c) => (c === "connecting" ? "waking" : c)), 3500);
    getBackend()
      .then(() => setConn("ok"))
      .catch(() => setConn("failed"))
      .finally(() => window.clearTimeout(slow));
  }, []);

  useEffect(() => {
    markInApp();
    // The app is a live system: no in-browser copy unless a demo explicitly asks for it (?mode=browser).
    if (new URLSearchParams(window.location.search).get("mode") !== "browser") requireServer();
    try {
      const l = window.localStorage.getItem(LANG_KEY);
      if (l === "ar" || l === "en") setLangState(l); // eslint-disable-line react-hooks/set-state-in-effect
    } catch {
      /* ignore */
    }
    connect();
    const t = window.setTimeout(() => setShown(true), 1100);
    return () => window.clearTimeout(t);
  }, [connect]);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  };

  if (conn === "failed") return <Offline lang={lang} onRetry={() => { resetBackend(); connect(); }} />;
  if (conn !== "ok" || !shown || !ready) return <Splash conn={conn} lang={lang} />;
  if (!session) return <Frame><Toasts><Welcome lang={lang} setLang={setLang} onSignedIn={() => tap("MEDIUM")} /></Toasts></Frame>;
  return (
    <WorkspaceProvider key={session.user.id}>
      {session.user.role === "participant" ? <PatientShell lang={lang} setLang={setLang} pid={session.user.pid ?? ""} /> : <ClinicianShell />}
    </WorkspaceProvider>
  );
}

function Splash({ conn, lang }: { conn: Conn; lang: Lang }) {
  useStatusBar(true);
  const ar = lang === "ar";
  const steps = ar ? ["الاتصال بخادم MemBrain", "تشغيل الخادم", "جاهز"] : ["Connecting to MemBrain", "Waking the server", "Ready"];
  const at = conn === "ok" ? 2 : conn === "waking" ? 1 : 0;
  return (
    <Frame dir={ar ? "rtl" : "ltr"} lang={lang}>
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-deep text-white">
        <div aria-hidden className="absolute -top-24 end-[-90px] h-80 w-80 rounded-full bg-sand/20 blur-3xl" />
        <div aria-hidden className="absolute -bottom-28 start-[-90px] h-80 w-80 rounded-full bg-[#2f8a57]/45 blur-3xl" />
        <div className="relative mb-float">
          <span className="flex h-[104px] w-[104px] items-center justify-center rounded-[32px] bg-gradient-to-b from-white/18 to-white/6 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)] ring-1 ring-white/20 backdrop-blur">
            <LogoMark inverted className="h-16 w-16" />
          </span>
        </div>
        <p className="relative mt-7 text-[30px] font-semibold tracking-[-0.03em]">MemBrain</p>
        <p className="relative mt-1 text-[14px] text-white/60">{ar ? "صحة الدماغ، بكلماتك" : "Brain health, in your own words"}</p>
        <ol className="relative mt-10 w-[230px] space-y-2.5">
          {steps.map((s, i) => (
            <li key={s} className={`flex items-center gap-3 text-[13.5px] transition-opacity ${i <= at ? "opacity-100" : "opacity-35"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${i < at || conn === "ok" ? "bg-sand text-deep" : "bg-white/15"}`}>
                {i < at || conn === "ok" ? <span className="text-[11px] font-bold">✓</span> : i === at ? <Loader2 size={12} className="animate-spin" /> : null}
              </span>
              {s}
            </li>
          ))}
        </ol>
        {conn === "waking" && <p className="relative mt-5 max-w-[270px] text-center text-[12.5px] leading-snug text-white/55">{ar ? "يستيقظ الخادم بعد فترة من عدم النشاط. يستغرق ذلك عادة أقل من دقيقة." : "The server sleeps when idle and is waking up. This usually takes under a minute."}</p>}
        <p className="absolute bottom-7 text-[11px] tracking-[0.04em] text-white/35" style={{ marginBottom: "var(--mb-sab)" }}>v{VERSION} · {ar ? "لا يشخّص" : "Never diagnoses"}</p>
      </div>
    </Frame>
  );
}

function Offline({ lang, onRetry }: { lang: Lang; onRetry: () => void }) {
  useStatusBar(false);
  const ar = lang === "ar";
  return (
    <Frame dir={ar ? "rtl" : "ltr"} lang={lang}>
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-b from-[#fdecef] to-[#f8dde3] text-lv-urgent"><CloudOff size={34} /></span>
        <h1 className="mt-6 text-[24px] font-semibold tracking-[-0.025em]">{ar ? "تعذّر الوصول إلى خادم MemBrain" : "Can't reach the MemBrain server"}</h1>
        <p className="mt-2 max-w-[300px] text-[14.5px] leading-relaxed text-body">
          {ar ? "تحقّق من اتصالك بالإنترنت ثم حاول مرة أخرى. لا يعرض التطبيق بيانات قديمة أو وهمية أثناء انقطاع الاتصال." : "Check your internet connection and try again. The app never shows stale or demo data while it is offline."}
        </p>
        <button type="button" onClick={() => { tap("MEDIUM"); onRetry(); }} className="mt-7 flex h-[52px] items-center gap-2 rounded-[16px] bg-gradient-to-b from-[#1b5a40] to-deep px-7 text-[15.5px] font-semibold text-white shadow-[0_14px_30px_-14px_rgb(15_63_44/0.8)]">
          <RefreshCw size={18} /> {ar ? "حاول مرة أخرى" : "Try again"}
        </button>
        <p className="mt-4 flex items-center gap-1.5 text-[12px] text-muted"><Wifi size={13} /> {(process.env.NEXT_PUBLIC_API_URL || "").replace(/^https?:\/\//, "") || "this server"}</p>
      </div>
    </Frame>
  );
}

function ClinicianShell() {
  const [tab, setTab] = useState("home");
  const [plus, setPlus] = useState(false);
  const [profile, setProfile] = useState(false);
  const { top, push, back } = useStack();
  const { cases, ready, error } = useWorkspace();
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("case");
    if (id) push({ kind: "case", id });
  }, [push]);
  const open = (id: string) => push({ kind: "case", id });
  const urgent = cases.filter((c) => isActive(c) && levelOf(c) === "URGENT").length;
  if (error && !ready) return <Offline lang="en" onRetry={() => window.location.reload()} />;
  return (
    <Frame>
      <Toasts>
        {top?.kind === "case" ? (
          <CaseScreen id={top.id} onBack={back} onFollow={(id) => push({ kind: "intake", followPid: id })} />
        ) : top?.kind === "intake" ? (
          <Intake lang="en" staff followPid={top.followPid} onBack={back} onOpenCase={(id) => { back(); window.setTimeout(() => open(id), 60); }} />
        ) : (
          <>
            {tab === "home" && <ClinicianHome onOpen={open} onTab={setTab} onProfile={() => setProfile(true)} />}
            {tab === "map" && <ClinicianMap onOpen={open} />}
            {tab === "alerts" && <ClinicianAlerts onOpen={open} />}
            {tab === "reports" && <ClinicianReports onOpen={open} />}
            <TabBar tabs={CLIN_TABS(urgent)} current={tab} onTab={setTab} onPlus={() => setPlus(true)} plusLabel="Create" />
            <ClinicianPlus open={plus} onClose={() => setPlus(false)} onIntake={() => push({ kind: "intake", followPid: null })} />
            <Profile open={profile} onClose={() => setProfile(false)} />
          </>
        )}
        <NewArrivals />
      </Toasts>
    </Frame>
  );
}

/** A case that appears during a live refresh (a concern from the website or Telegram, a check-in) is announced. */
function NewArrivals() {
  const { cases, ready } = useWorkspace();
  const toast = useToast();
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!ready) return;
    const now = new Set(cases.filter(isActive).map((c) => c.participant.id));
    if (seen.current) {
      const fresh = cases.filter((c) => now.has(c.participant.id) && !seen.current!.has(c.participant.id));
      for (const c of fresh) toast(`${levelOf(c) === "URGENT" ? "New urgent" : "New"}: ${c.participant.id} needs review`, levelOf(c) === "URGENT" ? "error" : "ok");
    }
    seen.current = now;
  }, [cases, ready, toast]);
  return null;
}

/** Who is signed in, and proof of the connection: the server, its engine version, how fast it answers, the last sync. */
function Profile({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = useSession();
  const { base, mode, syncedAt, syncing, refresh, cases, audit } = useWorkspace();
  const [log, setLog] = useState<AuditEntry[] | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const openAudit = async () => {
    onClose();
    setLogOpen(true);
    setLog(null);
    try {
      setLog((await audit()).slice().reverse().slice(0, 60));
    } catch {
      setLog([]);
    }
  };
  const [health, setHealth] = useState<{ ms: number; engine: string } | null>(null);
  useEffect(() => {
    if (!open || mode !== "server" || base == null) return;
    const t0 = performance.now();
    fetch(base + "/health", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ engine?: string }>)
      .then((j) => setHealth({ ms: Math.round(performance.now() - t0), engine: j.engine ?? "?" }))
      .catch(() => setHealth(null));
  }, [open, mode, base]);
  const u = session?.user;
  const host = (base || (typeof window !== "undefined" ? window.location.origin : "")).replace(/^https?:\/\//, "");
  return (
    <>
    <Sheet open={open} onClose={onClose}>
      <div className="flex items-center gap-4 pb-4">
        <Avatar name={u?.name} size={56} />
        <div className="min-w-0">
          <p className="truncate text-[19px] font-semibold tracking-[-0.015em]">{u?.name}</p>
          <p className="truncate text-[13.5px] text-muted">{u?.title ?? u?.role}{u?.org ? ` · ${u.org}` : ""}</p>
        </div>
      </div>
      <div className="rounded-[20px] bg-[#f5f7f4] p-4">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-deep"><span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-ping rounded-full bg-[#5fd08a] opacity-60" /><span className="relative h-2 w-2 rounded-full bg-[#3fbf72]" /></span>{mode === "server" ? "Connected, live" : "Demo copy on this device"}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
          <div><dt className="text-muted">Server</dt><dd className="truncate font-medium">{host}</dd></div>
          <div><dt className="text-muted">Response time</dt><dd className="font-medium tabular-nums">{health ? `${health.ms} ms` : "…"}</dd></div>
          <div><dt className="text-muted">Engine</dt><dd className="font-medium tabular-nums">{health?.engine ?? config.ENGINE_VERSION}</dd></div>
          <div><dt className="text-muted">Last sync</dt><dd className="font-medium">{syncing ? "now" : relTime(syncedAt)}</dd></div>
          <div><dt className="text-muted">Records</dt><dd className="font-medium tabular-nums">{cases.length}</dd></div>
          <div><dt className="text-muted">Refresh</dt><dd className="font-medium">Every 20 s</dd></div>
        </dl>
      </div>
      <div className="mt-2">
        <SheetAction icon={RefreshCw} title="Sync now" sub="Read every case again from the server" onClick={() => void refresh()} />
        <SheetAction icon={ScrollText} title="Audit log" sub="Every action on the server, newest first" onClick={() => void openAudit()} tone="bg-[#f1f2ef] text-ink" />
        <SheetAction icon={ShieldCheck} title="Privacy and safety" sub="Names stay in the identity vault; every action is audited. MemBrain flags risk and change; it never diagnoses." tone="bg-[#eef0f6] text-[#2b3a55]" />
        <SheetAction icon={LogOut} title="Sign out" onClick={async () => { onClose(); await signOutAndGoHome("en"); }} tone="bg-lv-review-soft text-lv-review" danger />
      </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-muted"><Server size={12} /> MemBrain v{VERSION} · demo records are synthetic</p>
    </Sheet>
    <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="Audit log">
      <p className="-mt-1 mb-2 text-[13px] text-muted">Every action on the server, newest first. Names stay in the identity vault.</p>
      <div className="min-h-[55dvh]">
        {log == null ? (
          <div className="flex justify-center py-10 text-muted"><Loader2 className="animate-spin" size={20} /></div>
        ) : log.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-muted">No entries yet.</p>
        ) : (
          <ol className="divide-y divide-[#eef0ec]">
            {log.map((e, i) => (
              <li key={i} className="py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[14px] font-semibold first-letter:uppercase">{e.action.replace(/_/g, " ")}</p>
                  <p className="shrink-0 text-[11.5px] text-muted">{relTime(e.ts)}</p>
                </div>
                <p className="truncate text-[12.5px] text-body"><span className="font-mono">{e.target}</span> · {e.actor}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Sheet>
    </>
  );
}

function PatientShell({ lang, setLang, pid }: { lang: Lang; setLang: (l: Lang) => void; pid: string }) {
  const [tab, setTab] = useState("home");
  const [plus, setPlus] = useState(false);
  const { top, push, back } = useStack();
  const { cases, ready, error } = useWorkspace();
  const c = cases.find((x) => x.participant.id === pid) ?? null;
  const t = PT[lang];
  if (error && !ready) return <Offline lang={lang} onRetry={() => window.location.reload()} />;
  if (!ready || !c) return <Splash conn="ok" lang={lang} />;
  const report = () => push({ kind: "intake", followPid: pid });
  return (
    <Frame dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <Toasts>
        {top?.kind === "intake" ? (
          <Intake lang={lang} staff={false} followPid={top.followPid} defaultReporter="self" onBack={back} />
        ) : (
          <>
            {tab === "home" && <PatientHome c={c} lang={lang} onTab={setTab} onReport={report} />}
            {tab === "checkin" && <PatientCheckin c={c} lang={lang} />}
            {tab === "family" && <PatientFamily c={c} lang={lang} />}
            {tab === "me" && <PatientMe c={c} lang={lang} setLang={setLang} onSignOut={async () => { await signOutAndGoHome(lang); }} />}
            <TabBar tabs={patientTabs(lang)} current={tab} onTab={setTab} onPlus={() => setPlus(true)} plusLabel={t.plus} />
            <Sheet open={plus} onClose={() => setPlus(false)} title={lang === "ar" ? "ماذا تريد أن تفعل؟" : "What would you like to do?"}>
              <SheetAction icon={HeartPulse} title={t.reportTitle} sub={t.reportBody} tone="bg-lv-review-soft text-lv-review" onClick={() => { setPlus(false); report(); }} />
              <SheetAction icon={Mic} title={t.checkinTitle} sub={t.nextSub} href={`/checkin/?id=${encodeURIComponent(pid)}&lang=${lang}`} onClick={() => setPlus(false)} />
              <SheetAction icon={ClipboardCheck} title={t.familyTitle} sub={lang === "ar" ? "عشرة أسئلة قصيرة لأحد أفراد الأسرة" : "Ten short questions for a family member"} href={`/informant/?id=${encodeURIComponent(pid)}&lang=${lang}`} onClick={() => setPlus(false)} tone="bg-[#e9eef8] text-[#4a6fb0]" />
              <SheetAction icon={HeartHandshake} title={lang === "ar" ? "ملف MyLife وبطاقة الرعاية (قريبًا)" : "MyLife Care Profile (Coming Soon)"} sub={lang === "ar" ? "قصة حياتك والروتين المهدئ لطواقم المستشفى" : "Person-centred story and quick care card for hospital teams"} href={`/mylife/?id=${encodeURIComponent(pid)}&lang=${lang}`} onClick={() => setPlus(false)} tone="bg-amber-50 text-amber-900 border border-amber-200/60" />
            </Sheet>
          </>
        )}
      </Toasts>
    </Frame>
  );
}
