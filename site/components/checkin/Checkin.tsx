"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ClipboardCheck, HeartHandshake, MessageSquarePlus, Keyboard, Leaf, Volume1, Loader2, LogOut, Phone, Play, RotateCcw, Settings2, Stethoscope, Users, MapPinned, ListChecks } from "lucide-react";
import { Mark } from "../Logo";
import { LevelPill } from "../ui";
import engineData from "@/lib/generated/engine-data.json";
import { DEMO_TODAY, getEngine, type Lang, type Level } from "@/lib/mb";
import { detectSpeech, LABEL, Recorder, speak, stopSpeaking, type Audio, type Recording, type Speech, type VoiceFeatures } from "@/lib/voice";
import { appCaseHref, homeHref } from "@/lib/app";
import { useSession, signOut, getHomeUrl, getSignedOutUrl } from "@/lib/auth";
import { getBackend } from "@/lib/workspace/backend";
import { notifyWorkspaceSync } from "@/lib/workspace/sync";
import type { Backend, Case, CheckinResult, Participant, SessionIn } from "@/lib/workspace/types";
import { EnrolForm } from "../clinician/enrol/EnrolView";
import { COPY, num, type Copy } from "./copy";
import { Avatar, MicAnswer, Options, Prompt, Toggle } from "./parts";

/* ── The item bank and engine helpers ── */

type Items = {
  WORD_LISTS: Record<string, Record<Lang, string[]>>;
  FLUENCY: Record<string, { category: Record<Lang, string> }>;
  STORIES: Record<string, Record<Lang, string> & { units: Record<Lang, unknown> }>;
  JUDGEMENT: Record<string, Record<Lang, string> & { rubric: Record<Lang, [string, ...unknown[]][]> }>;
  FLUENCY_LEXICON: Record<string, Record<Lang, string>>;
};
const ITEMS = (engineData as unknown as { items: Items }).items;
const DOMAINS = (engineData as unknown as { config: { DOMAINS: Record<string, { max: number }> } }).config.DOMAINS;
type EngineX = { formForSession: (i: number, seed: number) => "A" | "B" | "C"; DLABEL: Record<string, string> };
const ENGINE = () => getEngine() as unknown as EngineX;

/** Same as participant_seed in membrain/items.py. */
function seedOf(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h % 3;
}

type Task = "memory_immediate" | "memory_delayed" | "fluency" | "story_recall" | "judgement";

function samples(task: Task, form: string, lang: Lang): [string, string] {
  const wl = ITEMS.WORD_LISTS[form][lang];
  const lex = ITEMS.FLUENCY_LEXICON[form][lang].split(" ");
  const parts = ITEMS.STORIES[form][lang].split(/[.،,]/).filter((x) => x.trim());
  const rub = ITEMS.JUDGEMENT[form].rubric[lang];
  return {
    memory_immediate: [wl.slice(0, 7).join(" "), wl.slice(0, 4).join(" ")],
    memory_delayed: [wl.slice(1, 7).join(" "), wl.slice(0, 2).join(" ")],
    story_recall: [parts.slice(0, 4).join(" "), parts[0].split(" ").slice(0, 6).join(" ")],
    fluency: [lex.slice(0, 17).join(" "), lex.slice(0, 8).join(" ")],
    judgement: [rub.map((r) => r[0]).join(" "), String(rub[0][0])],
  }[task] as [string, string];
}

const addDays = (iso: string, d: number) => new Date(Date.parse(iso + "T00:00:00Z") + d * 86400000).toISOString().slice(0, 10);

/** The check-in's date: matches real-world execution date. */
function sessionDate(_p: Participant) {
  return new Date().toISOString().slice(0, 10);
}

function registeredNameOf(pid?: string | null): string {
  if (!pid || typeof window === "undefined") return "";
  try {
    const s =
      window.sessionStorage.getItem(`membrain.registered_name.${pid}`) ||
      window.localStorage.getItem(`membrain.registered_name.${pid}`);
    if (s && s.trim()) return s.trim();
  } catch {
    /* storage disabled */
  }
  return "";
}

const nameOf = (p: Participant, lang: Lang, explicitName?: string | null) => {
  if (p.enrolled === false) return "";
  if (explicitName && explicitName.trim()) return explicitName.trim();
  const reg = registeredNameOf(p.id);
  if (reg) return reg;
  const n = p.display_name?.[lang] || p.display_name?.en || "";
  if (n === "Enrolled participant" || n === "مشارك مسجّل" || n === "New concern" || n === "قلق جديد") return "";
  return n;
};

/* ── Steps ── */

type Step =
  | "profile" | "welcome" | "hear" | "noise" | "see" | "words_listen" | "words_recall" | "story_listen" | "story_recall"
  | "fluency" | "judgement" | "delayed" | "mood0" | "mood1" | "mood2" | "mood3" | "sleep" | "ill" | "saving" | "done";

const TASKS: Step[] = ["hear", "noise", "see", "words_listen", "words_recall", "story_listen", "story_recall", "fluency", "judgement", "delayed", "mood0", "mood1", "mood2", "mood3", "sleep", "ill"];
const SECTION: Partial<Record<Step, number>> = {
  hear: 0, noise: 0, see: 0, words_listen: 1, words_recall: 1, story_listen: 1, story_recall: 1, fluency: 2, judgement: 3, delayed: 4,
  mood0: 5, mood1: 5, mood2: 5, mood3: 5, sleep: 5, ill: 5,
};
const TASK_OF: Partial<Record<Step, Task>> = { words_recall: "memory_immediate", story_recall: "story_recall", fluency: "fluency", judgement: "judgement", delayed: "memory_delayed" };
const HOURS = [4.5, 5.5, 6.5, 7.5, 8.5];
const ENGINE_AR: Record<string, string> = {
  local: "نموذج MemBrain للهجة الخليجية (مستضاف داخل الدولة)",
  localDemo: "نموذج MemBrain للهجة الخليجية (على خادمنا التجريبي)",
  azure: "خدمة Azure للتعرّف على الكلام، دبي (داخل الدولة)",
  browser: "التعرّف على الكلام في المتصفح (غير مُكيَّف للهجات)",
  typed: "كتابة الإجابات (لا يتوفر التعرّف على الكلام هنا)",
};

type Answers = {
  tr: Record<Task, string>;
  audio: Partial<Record<Task, Audio>>;
  vf: Partial<Record<Task, VoiceFeatures>>;
  asr: { engine: string; locale: string | null } | null;
  precheck: { hearing_ok: boolean | null; vision_ok: boolean | null; noise_ok: boolean | null };
  noiseDb: number | null;
  heardWords: boolean;
  heardStory: boolean;
  mood: (number | null)[];
  sleep: number | null;
  ill: boolean | null;
  assisted: boolean;
};
const freshAnswers = (): Answers => ({
  tr: { memory_immediate: "", memory_delayed: "", fluency: "", story_recall: "", judgement: "" },
  audio: {},
  vf: {},
  asr: null,
  precheck: { hearing_ok: null, vision_ok: null, noise_ok: null },
  noiseDb: null,
  heardWords: false,
  heardStory: false,
  mood: [null, null, null, null],
  sleep: null,
  ill: null,
  assisted: false,
});

type Prefs = { big: boolean; hc: boolean; slow: boolean; voice: boolean };
const PREFS_KEY = "membrain.checkin.prefs";
const saveKey = (pid: string) => `membrain.checkin.v1:${pid}`;
type Saved = { step: Step; answers: Answers; lang: Lang };

function readJson<T>(store: "local" | "session", key: string): T | null {
  try {
    const raw = (store === "local" ? window.localStorage : window.sessionStorage).getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(store: "local" | "session", key: string, v: unknown) {
  try {
    const s = store === "local" ? window.localStorage : window.sessionStorage;
    if (v === null) s.removeItem(key);
    else s.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

/* ── The page ── */

export function Checkin() {
  const { session: me } = useSession();
  const params = useSearchParams();
  const id = params.get("id");
  const effectiveId = id || (me?.user?.role === "participant" ? me.user.pid : null) || (typeof window !== "undefined" ? window.sessionStorage.getItem("membrain.recent_concern_id") : null);
  const qLang = params.get("lang") === "ar" ? "ar" : params.get("lang") === "en" ? "en" : null;
  const qName = params.get("name");
  const [backend, setBackend] = useState<Backend | null>(null);
  const [cases, setCases] = useState<Case[] | null>(null);

  useEffect(() => {
    const target = id || effectiveId;
    if (target && qName && typeof window !== "undefined") {
      try {
        const n = qName.trim();
        window.sessionStorage.setItem(`membrain.registered_name.${target}`, n);
        window.localStorage.setItem(`membrain.registered_name.${target}`, n);
      } catch {
        /* storage disabled */
      }
    }
  }, [id, effectiveId, qName]);

  useEffect(() => {
    let live = true;
    getBackend()
      .then(async (b) => {
        if (live) setBackend(b);
        const target = id || (me?.user?.role === "participant" ? me.user.pid : null) || (typeof window !== "undefined" ? window.sessionStorage.getItem("membrain.recent_concern_id") : null);
        if (target && b.getCase) {
          try {
            const single = await b.getCase(target);
            if (live && single) {
              setCases((prev) => {
                const rest = (prev ?? []).filter((x) => x.participant.id !== single.participant.id);
                return [single, ...rest];
              });
            }
          } catch {
            /* fall back to listing cases */
          }
        }
        return b.cases();
      })
      .then((c) => {
        if (c && live) {
          setCases((prev) => {
            if (!prev || prev.length === 0) return c;
            const existingIds = new Set(c.map((x) => x.participant.id));
            const extra = prev.filter((x) => !existingIds.has(x.participant.id));
            return [...extra, ...c];
          });
        }
      })
      .catch(() => live && setCases((prev) => prev ?? []));
    return () => {
      live = false;
    };
  }, [id]);

  if (!cases || !backend) return <Splash lang={qLang ?? "en"} />;
  const c = effectiveId ? cases.find((x) => x.participant.id === effectiveId) : null;
  if (!c) return <Picker cases={cases} initialLang={qLang ?? "en"} />;
  return <Run key={c.participant.id} c={c} backend={backend} initialLang={qLang ?? "en"} />;
}

function Splash({ lang }: { lang: Lang }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-paper" dir={lang === "ar" ? "rtl" : "ltr"}>
      <Mark className="h-12 w-auto opacity-90" />
      <p className="flex items-center gap-2 text-[15px] text-muted">
        <Loader2 size={16} className="animate-spin" /> {COPY[lang].loading}
      </p>
    </div>
  );
}

/* ── Shell: top bar, progress and the column the screens sit in ── */

function TopBar({ t, lang, setLang, subtitle, exitHref, right }: { t: Copy; lang: Lang; setLang: (l: Lang) => void; subtitle: string; exitHref: string; right?: ReactNode }) {
  return (
    <header className="relative z-20 shrink-0 border-b border-line bg-white/95 backdrop-blur print:hidden">
      <div className="mx-auto flex h-[64px] max-w-[1080px] items-center gap-3 px-3 sm:px-6">
        <Link href={exitHref} aria-label={t.exit} className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-mist" onClick={() => stopSpeaking()}>
          <ArrowLeft size={21} className="rtl:-scale-x-100" />
        </Link>
        <Mark className="hidden h-9 w-auto sm:block" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold leading-tight tracking-[-0.01em]">{t.title}</p>
          <p className="truncate text-[12.5px] leading-tight text-muted">{subtitle}</p>
        </div>
        {right}
        <div className="flex rounded-full bg-mist p-1" role="group" aria-label="Language">
          {(["en", "ar"] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              lang={l}
              className={`rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-3 ${lang === l ? "bg-white text-deep shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {l === "en" ? "English" : "عربي"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={async () => {
            stopSpeaking();
            await signOut();
            window.location.href = getSignedOutUrl(lang);
          }}
          title={lang === "ar" ? "تسجيل الخروج ومسح كافة البيانات" : "Sign out and leave no trace"}
          aria-label={lang === "ar" ? "تسجيل الخروج" : "Sign out"}
          className="flex items-center gap-1.5 rounded-full border border-rose-200/90 bg-rose-50/70 px-2.5 py-1.5 text-[12.5px] font-medium text-rose-700 transition-colors hover:bg-rose-100 hover:text-rose-800 sm:px-3"
        >
          <LogOut size={15} className="rtl:-scale-x-100" />
          <span className="hidden sm:inline">{lang === "ar" ? "تسجيل الخروج" : "Sign out"}</span>
        </button>
      </div>
    </header>
  );
}

/* ── Who is doing the check-in ── */

function Picker({ cases, initialLang }: { cases: Case[]; initialLang: Lang }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      const u = new URL(window.location.href);
      if (l === "ar") u.searchParams.set("lang", "ar");
      else u.searchParams.delete("lang");
      window.history.replaceState(null, "", u);
    } catch { /* ignore */ }
  };
  const t = COPY[lang];
  const people = useMemo(() => {
    const list = cases.map((c) => c.participant);
    return [...list.filter((p) => p.enrolled === false).reverse(), ...list.filter((p) => p.enrolled !== false)];
  }, [cases]);
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="flex min-h-dvh flex-col bg-paper">
      <TopBar t={t} lang={lang} setLang={setLang} subtitle={t.minutes} exitHref="/clinician/" />
      <main className="mx-auto w-full max-w-[1080px] px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.2em] text-leaf">{t.pickEyebrow}</p>
        <h1 className="mt-3 max-w-[680px] font-serif text-[32px] font-semibold leading-[1.12] tracking-[-0.015em] text-balance sm:text-[42px]">{t.pickTitle}</h1>
        <p className="mt-3 max-w-[640px] text-[16.5px] leading-[1.55] text-body text-pretty">{t.pickBody}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => {
            const concern = p.enrolled === false;
            const nm = concern ? p.id : (nameOf(p, lang) || p.display_name?.[lang] || p.display_name?.en || p.id);
            const n = p.sessions.filter((s) => s.type !== "intake" && s.type !== "informant").length;
            const pl = (p.language as Lang) ?? "en";
            return (
              <Link
                key={p.id}
                href={`/checkin/?id=${encodeURIComponent(p.id)}&lang=${lang}`}
                className="group flex flex-col rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgb(15_35_40/0.04)] transition-all hover:-translate-y-0.5 hover:border-leaf/40 hover:shadow-[0_12px_30px_-18px_rgb(15_63_44/0.45)]"
              >
                <div className="flex items-center gap-3.5">
                  <Avatar name={concern ? "?" : (nameOf(p, lang) || p.display_name.en)} id={p.id} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-semibold leading-tight">
                      {nm} {!concern && lang === "en" && <span className="ms-1 font-normal text-muted" lang="ar">{p.display_name.ar}</span>}
                    </p>
                    <p className="mt-0.5 truncate text-[13.5px] text-muted">
                      {[p.age != null ? (lang === "ar" ? `${num(p.age, "ar")} سنة` : `${p.age} y`) : null, p.dialect, pl === "ar" ? "عربي" : "English"].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 min-h-[40px] text-[14.5px] leading-snug text-body" dir="ltr">
                  {concern ? p.intake?.confirmed?.narrative ?? "" : p.story}
                </p>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${concern ? "bg-sand-soft text-[#7a5218]" : "bg-paper text-muted"}`}>
                    {concern ? t.fromConcern : t.sessions(n)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[14.5px] font-semibold text-deep">
                    {t.continueAs} <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        <p className="mt-10 flex items-center gap-2 text-[14px] text-muted">
          <Phone size={15} /> {t.emergency}
        </p>
      </main>
    </div>
  );
}

/* ── The check-in itself ── */

const SCENARIOS_AR: Record<string, string> = {
  A: "أَنْتَ تَطْبُخُ وَشَمِمْتَ رَائِحَةَ دُخَانٍ مِنَ المَطْبَخِ. مَاذَا تَفْعَلُ؟",
  B: "أَنْتَ فِي مَرْكَزِ تَسَوُّقٍ وَلَا تَجِدُ الشَّخْصَ الَّذِي جِئْتَ مَعَهُ. مَاذَا تَفْعَلُ؟",
  C: "وَصَلَكَ اتِّصَالٌ يَقُولُ إِنَّكَ رَبِحْتَ مَالًا، وَيَطْلُبُونَ رَقْمَ بِطَاقَتِكَ البَنْكِيَّةِ. مَاذَا تَفْعَلُ؟",
};

const CATEGORIES_AR: Record<string, string> = {
  A: "الحَيَوَانَات",
  B: "الفَوَاكِهِ وَالخُضْرَاوَات",
  C: "أَشْيَاءَ تَشْتَرِيهَا مِنَ السُّوق",
};

function Run({ c, backend, initialLang }: { c: Case; backend: Backend; initialLang: Lang }) {
  const [currentCase, setCurrentCase] = useState<Case>(c);
  const p = currentCase.participant;
  const { session: me } = useSession();
  const params = useSearchParams();
  const qName = params?.get("name");
  const userMeName = me?.user?.pid === p.id && me.user.name && me.user.name !== "Enrolled participant" && me.user.name !== "مشارك مسجّل" ? me.user.name : null;
  const saved = useMemo(() => readJson<Saved>("session", saveKey(p.id)), [p.id]);
  const needsProfile = p.age == null || p.education == null || p.enrolled === false;
  const flow: Step[] = useMemo(() => [...(needsProfile ? (["profile"] as Step[]) : []), "welcome", ...TASKS], [needsProfile]);

  const [lang, setLangState] = useState<Lang>(initialLang);
  const [step, setStep] = useState<Step>(saved && flow.includes(saved.step) ? saved.step : flow[0]);
  const [ans, setAns] = useState<Answers>(saved?.answers ?? freshAnswers());
  const [resumed] = useState(!!saved && saved.step !== flow[0]);
  const [prefs, setPrefs] = useState<Prefs>(() => ({ big: false, hc: false, slow: false, voice: true, ...(readJson<Prefs>("local", PREFS_KEY) ?? {}) }));
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [micOk, setMicOk] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [started, setStarted] = useState(true);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [after, setAfter] = useState<Case | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [profile, setProfile] = useState<{ age: number; education: Participant["education"] }>({ age: 65, education: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const spokenFor = useRef("");
  const t = COPY[lang];

  const form = useMemo(() => ENGINE().formForSession(p.sessions.filter((s) => s.type !== "intake").length, seedOf(p.id)), [p]);
  const name = nameOf(p, lang, qName || userMeName);
  const words = ITEMS.WORD_LISTS[form][lang];
  const story = ITEMS.STORIES[form][lang];
  const scenario = lang === "ar" ? SCENARIOS_AR[form] ?? ITEMS.JUDGEMENT[form][lang] : ITEMS.JUDGEMENT[form][lang];
  const category = lang === "ar" ? CATEGORIES_AR[form] ?? ITEMS.FLUENCY[form].category[lang] : ITEMS.FLUENCY[form].category[lang];

  // Speech recognition: the best engine the server offers.
  useEffect(() => {
    let live = true;
    void detectSpeech(backend.mode === "server" ? backend.base : null).then((s) => live && setSpeech(s));
    return () => {
      live = false;
    };
  }, [backend]);

  // Keep progress for this browser tab, so a refresh carries on where it left off.
  useEffect(() => {
    if (step === "saving" || step === "done") return;
    writeJson("session", saveKey(p.id), { step, answers: ans, lang } satisfies Saved);
  }, [step, ans, lang, p.id]);
  useEffect(() => writeJson("local", PREFS_KEY, prefs), [prefs]);
  useEffect(() => () => stopSpeaking(), []);

  const setLang = (l: Lang) => {
    stopSpeaking();
    spokenFor.current = "";
    setLangState(l);
    try {
      const u = new URL(window.location.href);
      if (l === "ar") u.searchParams.set("lang", "ar");
      else u.searchParams.delete("lang");
      window.history.replaceState(null, "", u);
    } catch { /* ignore */ }
  };

  /* Reading the instruction aloud, once per screen. */
  const promptOf = (s: Step): string => {
    switch (s) {
      case "welcome": return `${t.welcome(name)} ${t.welcomeBody}`;
      case "hear": return t.hearQ;
      case "noise": return `${t.noiseQ} ${t.noiseBody}`;
      case "see": return t.seeQ;
      case "words_listen": return t.wordsL;
      case "words_recall": return t.wordsR;
      case "story_listen": return t.storyL;
      case "story_recall": return t.storyR;
      case "fluency": return t.flu(category);
      case "judgement": return `${t.judgT} ${scenario}`;
      case "delayed": return t.delayed;
      case "mood0": return `${t.moodT} ${t.moodSub} ${t.mood[0]}`;
      case "mood1": return t.mood[1];
      case "mood2": return t.mood[2];
      case "mood3": return t.mood[3];
      case "sleep": return t.sleepQ;
      case "ill": return t.illQ;
      case "done": return result ? result.message.text : "";
      default: return "";
    }
  };
  const say = (text: string) => {
    if (!text) return;
    setSpeaking(true);
    void speak(text, lang, prefs.slow).then(() => setSpeaking(false));
  };
  useEffect(() => {
    const key = `${step}:${lang}`;
    if (!prefs.voice || spokenFor.current === key) return;
    spokenFor.current = key;
    const text = promptOf(step);
    if (!text) return;
    const timer = window.setTimeout(() => say(text), 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, lang, prefs.voice, result]);

  /* Moving through the screens. */
  const go = (s: Step) => {
    stopSpeaking();
    setSpeaking(false);
    setStep(s);
    window.scrollTo({ top: 0 });
  };
  const idx = flow.indexOf(step);
  const next = () => {
    if (step === "ill") return void submit();
    const n = flow[idx + 1];
    if (n) go(n);
  };
  const back = () => idx > 0 && go(flow[idx - 1]);
  const pickThenNext = (fn: () => void) => {
    fn();
    window.setTimeout(next, 260);
  };
  const upd = (fn: (a: Answers) => Answers) => setAns((a) => fn(structuredClone(a)));

  /* The listening tasks. */
  const [wordIdx, setWordIdx] = useState(-1);
  const [storyPlaying, setStoryPlaying] = useState(false);
  const [storyShown, setStoryShown] = useState(false); // the device could not read it aloud
  const playToken = useRef(0);
  useEffect(() => {
    playToken.current++;
  }, [step]);
  const playWords = async () => {
    const tok = ++playToken.current;
    stopSpeaking();
    for (let i = 0; i < words.length; i++) {
      if (playToken.current !== tok) return;
      setWordIdx(i);
      await Promise.all([speak(words[i], lang, prefs.slow), new Promise((r) => window.setTimeout(r, prefs.slow ? 1900 : 1300))]);
    }
    if (playToken.current !== tok) return;
    setWordIdx(words.length);
    upd((a) => ({ ...a, heardWords: true }));
  };
  const playStory = async () => {
    const tok = ++playToken.current;
    setStoryPlaying(true);
    const spoken = await speak(story, lang, prefs.slow);
    if (playToken.current !== tok) return;
    setStoryPlaying(false);
    if (!spoken) setStoryShown(true);
    upd((a) => ({ ...a, heardStory: true }));
  };

  const [noiseState, setNoiseState] = useState<"idle" | "listening">("idle");
  const checkRoom = async () => {
    if (!speech) return;
    const r = new Recorder();
    setNoiseState("listening"); // straight away, while the browser asks for the microphone
    const ok = await r.start({ lang, speech, transcribe: false });
    if (!ok) {
      setNoiseState("idle");
      setMicOk(false);
      upd((a) => ({ ...a, noiseDb: -50, precheck: { ...a.precheck, noise_ok: true } }));
      return;
    }
    setNoiseState("listening");
    await new Promise((res) => window.setTimeout(res, 3000));
    const med = r.median();
    await r.stop();
    setNoiseState("idle");
    upd((a) => ({ ...a, noiseDb: +med.toFixed(1), precheck: { ...a.precheck, noise_ok: med < -45 } }));
  };

  const recorded = (task: Task) => (r: Recording) =>
    upd((a) => ({ ...a, audio: { ...a.audio, [task]: r.audio }, vf: { ...a.vf, [task]: r.features }, asr: { engine: r.engine, locale: r.locale } }));

  /* Saving. */
  const submit = async () => {
    go("saving");
    setSaveError(false);
    const audios = Object.values(ans.audio).filter(Boolean) as Audio[];
    const vfs = Object.values(ans.vf).filter(Boolean) as VoiceFeatures[];
    const mean = (k: keyof VoiceFeatures) => +(vfs.reduce((s, f) => s + f[k], 0) / vfs.length).toFixed(2);
    const body: SessionIn = {
      date: sessionDate(p),
      channel: "app",
      form,
      lang,
      transcripts: ans.tr,
      // The quality gate is there to catch a broken recording (bad microphone, noisy room), which affects every task;
      // it must not reject a session because one answer was short or silent: not recalling any word is a valid
      // score of 0, and exactly the signal MemBrain looks for. So the session is judged by its clearest task.
      audio: audios.length
        ? {
            snr_db: Math.max(...audios.map((a) => a.snr_db)),
            clipping: [...audios.map((a) => a.clipping)].sort((x, y) => x - y)[Math.floor(audios.length / 2)],
            speech_ratio: Math.max(...audios.map((a) => a.speech_ratio)),
            duration_s: Math.max(...audios.map((a) => a.duration_s)),
          }
        : null,
      precheck: { hearing_ok: ans.precheck.hearing_ok ?? true, vision_ok: ans.precheck.vision_ok ?? true, noise_ok: ans.precheck.noise_ok ?? true },
      phq2: (ans.mood[0] ?? 0) + (ans.mood[1] ?? 0),
      gad2: (ans.mood[2] ?? 0) + (ans.mood[3] ?? 0),
      sleep_hours: ans.sleep ?? 6.5,
      acute_illness: !!ans.ill,
      assisted: ans.assisted,
      helper_role: ans.assisted ? "family member" : null,
      input_mode: audios.length ? "voice" : "typed (demo)",
      asr: ans.asr,
      voice_features:
        p.consent?.voice_features && vfs.length
          ? { speech_rate_wpm: mean("speech_rate_wpm"), pause_count: mean("pause_count"), mean_pause_s: mean("mean_pause_s"), type_token_ratio: mean("type_token_ratio"), word_count: mean("word_count") }
          : null,
    };
    try {
      const [r] = await Promise.all([backend.submitSession(p.id, body), new Promise((res) => window.setTimeout(res, 900))]);
      setResult(r);
      writeJson("session", saveKey(p.id), null);
      notifyWorkspaceSync({ action: "submitSession", pid: p.id });
      backend.cases().then((all) => setAfter(all.find((x) => x.participant.id === p.id) ?? null)).catch(() => {});
      go("done");
    } catch {
      setSaveError(true);
    }
  };

  const saveProfile = async () => {
    if (!profile.education) return;
    try {
      await backend.setProfile(p.id, { age: profile.age, education: profile.education });
    } catch {
      /* the server keeps an enrolled profile; carry on */
    }
    go("welcome");
  };

  /* Which "Continue" is available. */
  const task = TASK_OF[step];
  const canNext =
    step === "profile" ? true :
    step === "welcome" ? true :
    step === "hear" ? ans.precheck.hearing_ok !== null :
    step === "see" ? ans.precheck.vision_ok !== null :
    step === "noise" ? ans.noiseDb !== null :
    step === "words_listen" ? ans.heardWords :
    step === "story_listen" ? ans.heardStory :
    task ? ans.tr[task].trim().length > 0 :
    step.startsWith("mood") ? ans.mood[Number(step.slice(4))] !== null :
    step === "sleep" ? ans.sleep !== null :
    step === "ill" ? ans.ill !== null : false;

  const section = SECTION[step];
  // The arrow leaves the check-in: a patient goes back to the home page (in their language), staff to this person's case.
  // ("/checkin/" would bring a signed-in patient straight back here, so the arrow seemed to do nothing.)
  const staff = me?.user.role === "clinician" || me?.user.role === "coordinator";
  const exitHref = staff ? appCaseHref(p.id) : homeHref(lang); // back to the app when it opened the check-in
  const subtitle = [name || p.id, t.minutes].join(" · ");
  const engineLabel = speech ? (lang === "ar" ? ENGINE_AR[speech.engine === "local" && !speech.inUae ? "localDemo" : speech.engine] : speech.label) : "";

  /* ── Screens ── */

  let body: ReactNode = null;
  const recordProps = (k: Task) => ({
    t, lang, speech, micOk, dialect: lang === "ar" ? p.dialect : "English", noiseDb: ans.noiseDb,
    value: ans.tr[k],
    onText: (v: string) => upd((a) => ({ ...a, tr: { ...a.tr, [k]: v } })),
    onRecorded: recorded(k),
    samples: samples(k, form, lang),
    onNoMic: () => setMicOk(false),
  });

  switch (step) {
    case "profile":
      body = (
        <div className="space-y-6">
          <EnrolForm
            backend={backend}
            prefilledCase={currentCase}
            initialLang={lang}
            embedded
            title={t.profileTitle}
            sub={t.profileBody}
            onComplete={(done) => {
              if (done.case) setCurrentCase(done.case);
              else setCurrentCase((prev) => ({ ...prev, participant: { ...prev.participant, enrolled: true } }));
              if (done.registered_name) {
                try {
                  window.sessionStorage.setItem(`membrain.registered_name.${done.id}`, done.registered_name);
                  window.localStorage.setItem(`membrain.registered_name.${done.id}`, done.registered_name);
                } catch {}
              }
              try {
                const u = new URL(window.location.href);
                u.searchParams.set("id", done.id);
                if (done.registered_name) u.searchParams.set("name", done.registered_name);
                window.history.replaceState(null, "", u.toString());
              } catch {}
              go("welcome");
            }}
          />
        </div>
      );
      break;

    case "welcome": {
      const consent = Object.entries(p.consent ?? {});
      body = (
        <div className="space-y-6">
          {resumed && <p className="rounded-xl bg-mist px-4 py-3 text-[15px] text-deep">{t.resumed}</p>}
          <div className="flex items-center gap-4">
            <Avatar name={p.enrolled === false ? "?" : (name || p.display_name.en)} id={p.id} className="h-16 w-16 text-[22px]" />
            <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-leaf">{t.minutes}</p>
          </div>
          <Prompt t={t} text={t.welcome(name)} sub={t.welcomeBody} speaking={speaking} onRepeat={() => say(promptOf("welcome"))} />
          {consent.length > 0 && (
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-leaf">{t.shared}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {consent.map(([k, v]) => (
                  <span key={k} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] font-medium ${v ? "bg-mist text-deep" : "bg-white text-muted ring-1 ring-line"}`}>
                    {v ? <Check size={14} strokeWidth={2.6} /> : null}
                    {t.consent[k] ?? k.replace(/_/g, " ")}
                    {!v && <span className="text-[12px]">· {t.notShared}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-line bg-white p-2">
            <Toggle label={t.helper} on={ans.assisted} onChange={(v) => upd((a) => ({ ...a, assisted: v }))} />
            {ans.assisted && (
              <p className="flex items-center gap-2 px-2 pb-2 text-[14px] text-muted">
                <Users size={15} /> {t.helperNote}
              </p>
            )}
          </div>
        </div>
      );
      break;
    }

    case "hear":
      body = (
        <div className="space-y-6">
          <Prompt t={t} text={t.hearQ} sub={t.hearBody} speaking={speaking} />
          <button type="button" onClick={() => say(t.hearQ)} className="inline-flex items-center gap-2.5 rounded-2xl bg-mist px-5 py-4 text-[16px] font-semibold text-deep hover:bg-mist-strong">
            <Play size={18} fill="currentColor" /> {t.play}
          </button>
          <Options cols={2} options={[{ value: 1, label: t.yes }, { value: 0, label: t.no }]} value={ans.precheck.hearing_ok === null ? null : ans.precheck.hearing_ok ? 1 : 0} onPick={(v) => pickThenNext(() => upd((a) => ({ ...a, precheck: { ...a.precheck, hearing_ok: v === 1 } })))} />
        </div>
      );
      break;

    case "noise": {
      const done = ans.noiseDb !== null;
      body = (
        <div className="space-y-6">
          <Prompt t={t} text={t.noiseQ} sub={t.noiseBody} speaking={speaking} onRepeat={() => say(promptOf("noise"))} />
          <div className="flex flex-col items-center rounded-2xl border border-line bg-white px-5 py-8">
            <div className={`relative flex h-24 w-24 items-center justify-center rounded-full ${noiseState === "listening" ? "bg-mist" : !micOk ? "bg-paper" : done ? (ans.precheck.noise_ok ? "bg-lv-stable-soft" : "bg-lv-check-soft") : "bg-paper"}`}>
              {noiseState === "listening" ? (
                <span className="absolute inset-0 rounded-full border-2 border-leaf/40 mb-ring" />
              ) : null}
              {noiseState === "listening" ? <WaveBig /> : !micOk ? <Keyboard size={34} className="text-muted" /> : done ? (ans.precheck.noise_ok ? <Check size={38} className="text-lv-stable" /> : <Volume1 size={38} className="text-lv-check" />) : <Leaf size={34} className="text-leaf" />}
            </div>
            <p className="mt-4 text-center text-[16px] font-medium text-body" aria-live="polite">
              {!micOk ? t.noMic : noiseState === "listening" ? t.noiseListening : done ? (ans.precheck.noise_ok ? t.noiseOk : t.noiseLoud) : ""}
            </p>
            {noiseState === "idle" && micOk && (
              <button type="button" onClick={() => void checkRoom()} disabled={!speech} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-deep px-5 py-3.5 text-[16px] font-medium text-white hover:bg-deep-hover disabled:opacity-50">
                {done ? <RotateCcw size={17} /> : null} {t.noiseBtn}
              </button>
            )}
          </div>
        </div>
      );
      break;
    }

    case "see":
      body = (
        <div className="space-y-6">
          <Prompt t={t} text={t.seeQ} speaking={speaking} onRepeat={() => say(t.seeQ)} />
          <div className="rounded-2xl border border-line bg-white px-6 py-10 text-center font-serif text-[34px] font-semibold leading-tight text-ink sm:text-[40px]">{t.seeSample}</div>
          <Options cols={2} options={[{ value: 1, label: t.yes }, { value: 0, label: t.no }]} value={ans.precheck.vision_ok === null ? null : ans.precheck.vision_ok ? 1 : 0} onPick={(v) => pickThenNext(() => upd((a) => ({ ...a, precheck: { ...a.precheck, vision_ok: v === 1 } })))} />
        </div>
      );
      break;

    case "words_listen": {
      const playing = wordIdx >= 0 && wordIdx < words.length;
      body = (
        <div className="space-y-6">
          <Prompt t={t} text={t.wordsL} speaking={speaking && !playing} onRepeat={playing ? undefined : () => say(t.wordsL)} />
          <div className="flex flex-col items-center rounded-2xl border border-line bg-white px-5 py-9">
            <div className="flex h-[76px] items-center justify-center">
              {playing ? (
                <span key={wordIdx} className="mb-step-in font-serif text-[48px] font-semibold leading-none text-deep sm:text-[56px]">{words[wordIdx]}</span>
              ) : wordIdx >= words.length ? (
                <span className="flex items-center gap-2 text-[17px] font-medium text-lv-stable"><Check size={22} /> {t.wordsDone}</span>
              ) : (
                <WaveBig muted />
              )}
            </div>
            <div className="mt-6 flex gap-2" aria-hidden>
              {words.map((w, i) => (
                <span key={w} className={`h-2.5 w-2.5 rounded-full transition-colors duration-300 ${i <= wordIdx ? "bg-deep" : "bg-line"}`} />
              ))}
            </div>
            {/* Played once, as in a standard administration: hearing the list twice would change what it measures. */}
            {!playing && !ans.heardWords && (
              <button type="button" onClick={() => void playWords()} className="mt-7 inline-flex items-center gap-2.5 rounded-xl bg-deep px-6 py-3.5 text-[16px] font-medium text-white hover:bg-deep-hover">
                <Play size={17} fill="currentColor" /> {t.wordsPlay}
              </button>
            )}
          </div>
        </div>
      );
      break;
    }

    case "story_listen": {
      const showCaption = (ans.precheck.hearing_ok === false || storyShown) && (storyPlaying || ans.heardStory);
      body = (
        <div className="space-y-6">
          <Prompt t={t} text={t.storyL} speaking={speaking && !storyPlaying} onRepeat={storyPlaying ? undefined : () => say(t.storyL)} />
          <div className="flex flex-col items-center rounded-2xl border border-line bg-white px-5 py-9">
            <div className={`flex h-24 w-24 items-center justify-center rounded-full ${storyPlaying ? "bg-mist" : ans.heardStory ? "bg-lv-stable-soft" : "bg-paper"}`}>
              {storyPlaying ? <WaveBig /> : ans.heardStory ? <Check size={38} className="text-lv-stable" /> : <HeartHandshake size={34} className="text-leaf" />}
            </div>
            <p className="mt-4 h-6 text-[16px] font-medium text-body">{storyPlaying ? t.storyPlaying : ans.heardStory ? t.storyDone : ""}</p>
            {!storyPlaying && !ans.heardStory && (
              <button type="button" onClick={() => void playStory()} className="mt-3 inline-flex items-center gap-2.5 rounded-xl bg-deep px-6 py-3.5 text-[16px] font-medium text-white hover:bg-deep-hover">
                <Play size={17} fill="currentColor" /> {t.storyPlay}
              </button>
            )}
          </div>
          {showCaption && (
            <div className="rounded-2xl bg-sand-soft p-5">
              <p className="text-[13.5px] font-semibold text-[#7a5218]">{storyShown ? t.storyRead : t.storyCaption}</p>
              <p className="mt-2 text-[17px] leading-[1.6] text-ink">{story}</p>
            </div>
          )}
        </div>
      );
      break;
    }

    case "words_recall":
    case "story_recall":
    case "delayed":
      body = (
        <div className="space-y-4">
          <Prompt t={t} text={step === "words_recall" ? t.wordsR : step === "story_recall" ? t.storyR : t.delayed} speaking={speaking} onRepeat={() => say(promptOf(step))} />
          <MicAnswer key={`${step}-${lang}`} {...recordProps(task!)} />
        </div>
      );
      break;

    case "fluency":
      body = (
        <div className="space-y-4">
          <Prompt t={t} text={t.flu(category)} sub={t.fluNote} speaking={speaking} onRepeat={() => say(promptOf("fluency"))} />
          <MicAnswer key={`${step}-${lang}`} {...recordProps("fluency")} seconds={60} countWords />
        </div>
      );
      break;

    case "judgement":
      body = (
        <div className="space-y-4">
          <Prompt t={t} eyebrow={t.judgT} text={scenario} speaking={speaking} onRepeat={() => say(promptOf("judgement"))} />
          <MicAnswer key={`${step}-${lang}`} {...recordProps("judgement")} />
        </div>
      );
      break;

    case "mood0":
    case "mood1":
    case "mood2":
    case "mood3": {
      const i = Number(step.slice(4));
      body = (
        <div className="space-y-6">
          <div>
            <p className="text-[13px] font-semibold text-muted">{t.question(i + 1, 4)}</p>
            <p className="mt-2 text-[16.5px] leading-snug text-body">{i === 0 ? `${t.moodT} ${t.moodSub}` : t.moodSub}</p>
          </div>
          <Prompt t={t} text={t.mood[i]} speaking={speaking} onRepeat={() => say(t.mood[i])} />
          <Options options={t.freq.map((f, v) => ({ value: v, label: f }))} value={ans.mood[i]} onPick={(v) => pickThenNext(() => upd((a) => { a.mood[i] = Number(v); return a; }))} />
        </div>
      );
      break;
    }

    case "sleep":
      body = (
        <div className="space-y-6">
          <Prompt t={t} text={t.sleepQ} speaking={speaking} onRepeat={() => say(t.sleepQ)} />
          <Options options={t.sleepO.map((o, k) => ({ value: HOURS[k], label: o }))} value={ans.sleep} onPick={(v) => pickThenNext(() => upd((a) => ({ ...a, sleep: Number(v) })))} />
        </div>
      );
      break;

    case "ill":
      body = (
        <div className="space-y-6">
          <Prompt t={t} text={t.illQ} speaking={speaking} onRepeat={() => say(t.illQ)} />
          <Options cols={2} options={[{ value: 1, label: t.yes }, { value: 0, label: t.no }]} value={ans.ill === null ? null : ans.ill ? 1 : 0} onPick={(v) => upd((a) => ({ ...a, ill: v === 1 }))} />
        </div>
      );
      break;

    case "saving":
      body = (
        <div className="flex flex-col items-center py-16 text-center">
          {saveError ? (
            <>
              <p className="max-w-[420px] text-[17px] leading-relaxed text-body">{t.saveFailed}</p>
              <button type="button" onClick={() => void submit()} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-deep px-6 py-3.5 text-[16px] font-medium text-white hover:bg-deep-hover">
                <RotateCcw size={17} /> {t.retry}
              </button>
            </>
          ) : (
            <>
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-mist">
                <Loader2 size={34} className="animate-spin text-deep" />
              </span>
              <p className="mt-5 text-[17px] font-medium text-body">{t.saving}</p>
            </>
          )}
        </div>
      );
      break;

    case "done":
      body = result && (
        <Done
          t={t}
          lang={lang}
          name={name}
          result={result}
          after={after}
          form={form}
          speechLabel={speech?.label ?? LABEL.typed}
          speaking={speaking}
          onRepeat={() => say(result.message.text)}
          staff={staff}
          exitHref={exitHref}
        />
      );
      break;
  }

  /* ── Layout ── */

  const showFooter = step !== "saving" && step !== "done" && step !== "profile";
  const isLast = step === "ill";
  const nextLabel = step === "welcome" ? t.start : isLast ? t.finish : t.next;
  const tasksDone = Math.max(0, TASKS.indexOf(step));
  const pct = step === "done" || step === "saving" ? 100 : Math.round((tasksDone / TASKS.length) * 100);

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      lang={lang}
      className={`flex h-dvh flex-col bg-paper ${prefs.hc ? "mb-hc" : ""}`}
      onPointerDownCapture={() => {
        try {
          if (typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        } catch {
          /* ignore */
        }
      }}
    >
      <TopBar
        t={t}
        lang={lang}
        setLang={setLang}
        subtitle={subtitle}
        exitHref={exitHref}
        right={
          <div className="relative">
            <button type="button" onClick={() => setSettingsOpen((o) => !o)} aria-expanded={settingsOpen} aria-label={t.settings} className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-mist">
              <Settings2 size={20} />
            </button>
            {settingsOpen && (
              <div className="fixed inset-x-3 top-[70px] z-30 rounded-2xl border border-line bg-white p-2 shadow-[0_18px_40px_-18px_rgb(15_35_40/0.35)] sm:absolute sm:inset-x-auto sm:end-0 sm:top-12 sm:w-[260px]">
                <p className="px-2 pb-1 pt-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf">{t.settings}</p>
                <Toggle label={t.larger} on={prefs.big} onChange={(v) => setPrefs((x) => ({ ...x, big: v }))} />
                <Toggle label={t.contrast} on={prefs.hc} onChange={(v) => setPrefs((x) => ({ ...x, hc: v }))} />
                <Toggle label={t.slow} on={prefs.slow} onChange={(v) => setPrefs((x) => ({ ...x, slow: v }))} />
                <Toggle label={t.voiceOn} on={prefs.voice} onChange={(v) => { if (!v) stopSpeaking(); setPrefs((x) => ({ ...x, voice: v })); }} />
              </div>
            )}
          </div>
        }
      />

      {/* Progress through the six parts */}
      {step !== "profile" && step !== "welcome" && (
        <div className="shrink-0 border-b border-line bg-white">
          <div className="mx-auto flex max-w-[1080px] items-center gap-4 px-4 py-2.5 sm:px-6">
            <div className="flex flex-1 gap-1.5" aria-hidden>
              {t.sections.map((s, i) => {
                const doneSec = step === "done" || step === "saving" || (section !== undefined && i < section);
                return <span key={s} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${doneSec ? "bg-deep" : i === section ? "bg-leaf/60" : "bg-line"}`} />;
              })}
            </div>
            <p className="shrink-0 text-[13px] font-medium text-body" aria-live="polite">
              {section !== undefined ? (
                <>
                  <span className="font-semibold text-deep">{t.sections[section]}</span> <span className="text-muted">· {t.sectionOf(section + 1, t.sections.length)}</span>
                </>
              ) : (
                <span className="font-mono text-[12px] text-muted">{num(pct, lang)}%</span>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto" onClick={() => settingsOpen && setSettingsOpen(false)}>
        <div className="mx-auto flex w-full max-w-[1080px] gap-10 lg:px-6">
          {step !== "profile" && (
            <aside className="hidden w-[280px] shrink-0 py-10 lg:block">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-leaf">{t.asideTitle}</p>
              <ol className="mt-4 space-y-4">
                {t.aside.map((a, i) => (
                  <li key={a} className="flex gap-3 text-[14.5px] leading-snug text-body">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white font-mono text-[12px] text-deep shadow-sm">{num(i + 1, lang)}</span>
                    {a}
                  </li>
                ))}
              </ol>
              {engineLabel && (
                <p className="mt-8 rounded-2xl border border-line bg-white p-4 text-[13px] leading-snug text-muted">
                  <span className="block text-[11.5px] font-semibold uppercase tracking-[0.12em] text-leaf">{lang === "ar" ? "التعرّف على الكلام" : "Speech recognition"}</span>
                  <span className="mt-1 block text-body" dir="auto">{engineLabel}</span>
                </p>
              )}
              <div className="mt-4 rounded-2xl border border-lv-urgent/15 bg-white p-4">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-lv-urgent">
                  <Phone size={15} /> {t.emergency}
                </p>
              </div>
            </aside>
          )}

          <main className={`mx-auto w-full ${step === "profile" ? "max-w-[960px]" : "max-w-[600px]"} px-4 pb-10 pt-8 sm:pt-12`} style={prefs.big ? { zoom: 1.16 } : undefined}>
            <div key={step} className="mb-step-in">
              {body}
            </div>
          </main>
        </div>
      </div>

      {showFooter && (
        <footer className="shrink-0 border-t border-line bg-white/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {/* Lined up with the screen's column: the same spacer as the side panel on wide screens. */}
          <div className="mx-auto flex max-w-[1080px] gap-10 lg:px-6">
          <div className="hidden w-[280px] shrink-0 lg:block" aria-hidden />
          <div className="mx-auto flex w-full max-w-[600px] items-center gap-2.5 px-4 py-3">
            {idx > 0 && (
              <button type="button" onClick={back} aria-label={t.back} className="inline-flex h-[52px] items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-[15px] font-medium text-ink hover:bg-mist">
                <ArrowLeft size={17} className="rtl:-scale-x-100" /> <span className="hidden sm:inline">{t.back}</span>
              </button>
            )}
            {step !== "welcome" && (
              <button type="button" onClick={next} className="h-[52px] px-3 text-[15px] font-medium text-muted hover:text-ink">
                {t.skip}
              </button>
            )}
            <button
              type="button"
              disabled={!canNext}
              onClick={() => {
                if (step === "welcome") setStarted(true);
                next();
              }}
              className="ms-auto inline-flex h-[52px] min-w-[150px] flex-1 items-center justify-center gap-2 rounded-xl bg-deep px-6 text-[16.5px] font-semibold text-white shadow-sm transition-colors hover:bg-deep-hover disabled:cursor-not-allowed disabled:bg-[#9fb3aa] sm:flex-none"
            >
              {nextLabel} {isLast ? <Check size={18} /> : <ArrowRight size={18} className="rtl:-scale-x-100" />}
            </button>
          </div>
          </div>
        </footer>
      )}
    </div>
  );
}

function WaveBig({ muted = false }: { muted?: boolean }) {
  return (
    <span className={`inline-flex h-10 items-center gap-[5px] ${muted ? "text-line" : "text-deep"}`} aria-hidden>
      {[0, 140, 280, 420, 560].map((d, i) => (
        <span key={d} className={`${muted ? "" : "mb-wave"} w-[5px] rounded-full bg-current`} style={{ height: muted ? `${[40, 70, 100, 70, 40][i]}%` : "100%", animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

/* ── The end: what the person sees, and (folded) what the clinician sees ── */

const MESSAGE_TONE: Record<string, string> = {
  BASELINE: "bg-mist text-deep",
  STABLE: "bg-lv-stable-soft text-[#1f5a39]",
  CHECK_AGAIN: "bg-sand-soft text-[#6b4714]",
  CLINICIAN_REVIEW: "bg-white text-ink ring-1 ring-line",
  URGENT: "bg-white text-ink ring-1 ring-line",
  INVALID: "bg-white text-ink ring-1 ring-line",
};

function Done({ t, lang, name, result, after, form, speechLabel, speaking, onRepeat, staff, exitHref }: {
  t: Copy; lang: Lang; name: string; result: CheckinResult; after: Case | null; form: string; speechLabel: string; speaking: boolean; onRepeat: () => void; staff?: boolean; exitHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const key = result.message.key;
  const plan = result.prevention?.items ?? [];
  const p = after?.participant;
  const last = p?.sessions[p.sessions.length - 1] as { raw?: Record<string, number>; input_mode?: string; audio?: Audio | null } | undefined;
  const ev = after?.latest;
  const dl = ENGINE().DLABEL;
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center pt-2 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-deep text-white shadow-[0_14px_34px_-14px_rgb(15_63_44/0.65)]">
          <Check size={38} strokeWidth={2.4} />
        </span>
        <h1 className="mt-5 font-serif text-[32px] font-semibold leading-tight tracking-[-0.015em] sm:text-[38px]">{t.thanks(name)}</h1>
      </div>

      <div className={`rounded-2xl p-5 text-[18px] leading-[1.55] ${MESSAGE_TONE[key] ?? MESSAGE_TONE.INVALID}`}>
        <p>{result.message.text}</p>
        <button type="button" onClick={onRepeat} className="mt-3 inline-flex items-center gap-2 text-[14px] font-medium opacity-80 hover:opacity-100">
          {speaking ? <span className="inline-flex h-[15px] items-center gap-[3px]">{[0, 120, 240].map((d) => <span key={d} className="mb-wave h-full w-[3px] rounded-full bg-current" style={{ animationDelay: `${d}ms` }} />)}</span> : <Play size={14} fill="currentColor" />} {t.repeat}
        </button>
      </div>

      {result.message.support && <div className="rounded-2xl bg-sand-soft p-5 text-[16.5px] leading-[1.55] text-[#5d3f12]">{result.message.support}</div>}

      <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mist text-deep">
          <RotateCcw size={19} />
        </span>
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-leaf">{t.nextCheck}</p>
          <p className="mt-0.5 text-[17px] font-medium text-ink">{t.nextWhen[key] ?? t.nextWhen.BASELINE}</p>
        </div>
      </div>

      {plan.length > 0 && (
        <div>
          <h2 className="font-serif text-[22px] font-semibold leading-tight">{t.plan}</h2>
          <ul className="mt-3 space-y-2.5">
            {plan.map((x) => (
              <li key={x.rule} className="flex gap-3.5 rounded-2xl border border-line bg-white p-4 text-[16px] leading-[1.5] text-body">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7efe9] text-leaf">
                  <Leaf size={16} />
                </span>
                {x.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {p && (
        <div>
          <h2 className="font-serif text-[22px] font-semibold leading-tight">{t.alsoTitle}</h2>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {[
              { href: `/concern/?for=${encodeURIComponent(p.id)}&lang=${lang}`, icon: MessageSquarePlus, title: t.alsoChange, body: t.alsoChangeBody },
              { href: `/informant/?id=${encodeURIComponent(p.id)}&lang=${lang}`, icon: ClipboardCheck, title: t.alsoFamily, body: t.alsoFamilyBody },
              { href: `/checkin/route/?id=${encodeURIComponent(p.id)}&lang=${lang}`, icon: MapPinned, title: t.alsoRoute, body: t.alsoRouteBody },
              { href: `/my/?id=${encodeURIComponent(p.id)}&lang=${lang}`, icon: ListChecks, title: t.alsoNext, body: t.alsoNextBody },
              { href: `/mylife/?id=${encodeURIComponent(p.id)}&lang=${lang}`, icon: HeartHandshake, title: (lang === "ar" ? "ملف MyLife للرعاية (قريبًا)" : "MyLife Care Profile (Coming Soon)"), body: (lang === "ar" ? "قصة حياتك والروتين اليومي وبطاقة الرعاية المهدئة لطواقم المستشفى." : "Your life story, daily routines, and quick care card for hospital teams.") },
            ].map(({ href, icon: I, title, body }) => (
              <Link key={href} href={href} className="group flex gap-3.5 rounded-2xl border border-line bg-white p-4 transition-colors hover:border-leaf/50 hover:bg-[#fbfcfb]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mist text-deep"><I size={18} /></span>
                <span>
                  <span className="block text-[16.5px] font-semibold text-ink">{title}</span>
                  <span className="mt-0.5 block text-[14.5px] leading-snug text-body">{body}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2.5 pt-1">
        <Link href={staff && exitHref ? exitHref : homeHref(lang)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-deep px-6 py-3.5 text-[16px] font-semibold text-white hover:bg-deep-hover sm:flex-none">
          {staff ? (lang === "ar" ? "العودة إلى ملف المشارك" : "Return to Case") : t.done}
        </Link>
        <Link href="/checkin/" className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 py-3.5 text-[15.5px] font-medium hover:bg-mist">
          <RotateCcw size={16} /> {t.again}
        </Link>
        <button
          type="button"
          onClick={async () => {
            stopSpeaking();
            await signOut();
            window.location.href = getSignedOutUrl(lang);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-5 py-3.5 text-[15.5px] font-medium text-rose-700 hover:bg-rose-100 transition-colors"
        >
          <LogOut size={16} className="rtl:-scale-x-100" /> {lang === "ar" ? "تسجيل الخروج ومسح الجلسة" : "Sign out & leave no trace"}
        </button>
      </div>

      {/* Clinician view only: staff see the triage analysis and open case shortcut */}
      {staff && (
        <div className="rounded-2xl border border-dashed border-[#c9d2ce] bg-white/70" dir="ltr" lang="en">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start">
            <span className="flex items-center gap-2 text-[14.5px] font-semibold text-body">
              <Stethoscope size={16} className="text-leaf" /> Behind the scenes (clinician view)
            </span>
            <ChevronDown size={18} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="space-y-4 border-t border-line px-5 py-4 text-[14px] text-body">
              <p className="text-muted">The person sees only the message above. This is what the clinician sees.</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">Triage level</span>
                <LevelPill level={(key === "INVALID" ? "INVALID" : result.level) as Level} size="sm" />
                {result.held_for_clinician && <span className="text-[13px] text-muted">Held for clinician review: the person sees no score.</span>}
              </div>
              {last?.raw && (
                <div>
                  <p className="font-semibold text-ink">Scores, alternate form {form}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {Object.entries(last.raw).map(([k, v]) => {
                      const max = DOMAINS[k]?.max ?? 10;
                      return (
                        <div key={k} className="rounded-xl bg-paper px-3 py-2.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[13px]">{dl[k] ?? k}</span>
                            <span className="font-mono text-[13px] font-semibold text-ink">{v}/{max}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-line">
                            <div className="h-full rounded-full bg-leaf" style={{ width: `${Math.min(100, (v / max) * 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {ev?.reasons?.length ? (
                <div>
                  <p className="font-semibold text-ink">Why</p>
                  <ul className="mt-1.5 list-disc space-y-1 ps-5">
                    {ev.reasons.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </div>
              ) : null}
              <p>
                <span className="font-semibold text-ink">Speech recognition:</span> {last?.input_mode === "voice" ? speechLabel : "Typed or demo answers"}
                {last?.audio ? <span className="text-muted"> · SNR {last.audio.snr_db} dB · speech {Math.round(last.audio.speech_ratio * 100)}%</span> : null}
              </p>
              {p && (
                <Link href={`/clinician/case/?id=${encodeURIComponent(p.id)}`} className="inline-flex items-center gap-2 rounded-xl bg-deep px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-deep-hover">
                  <Stethoscope size={15} /> Open in the clinician view
                </Link>
              )}
            </div>
          )}
        </div>
      )}
      <p className="text-center text-[13px] text-muted">{lang === "ar" ? "لا يقدّم MemBrain أي تشخيص." : "MemBrain does not diagnose."}</p>
    </div>
  );
}
