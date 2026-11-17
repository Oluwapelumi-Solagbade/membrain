"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Apple, ArrowLeft, BookOpen, Candy, Carrot, Coffee, Croissant, Fish, Flower2, Gem, Lamp, MapPin, Scissors, Shirt, Soup, SprayCan, TreePalm,
  type LucideIcon,
} from "lucide-react";
import { authHeader } from "@/lib/auth";
import type { Lang } from "@/lib/mb";
import { speak, stopSpeaking } from "@/lib/voice";
import { getBackend } from "@/lib/workspace/backend";

/* Souq route: spatial route memory in a market scene (EXPLORATORY).
 * A route of stalls lights up one by one from "You are here"; the person then taps the same stalls in order. Routes
 * grow from 3 to 7 stops, two routes per length, and the task ends after two misses at one length (the classic
 * spatial-span procedure, here in a familiar scene, with pictures instead of reading). Way-finding and spatial memory
 * are among the earliest abilities to change in Alzheimer's disease; this version is NOT validated, so results are
 * shown to the clinician as exploratory and never change a triage level (api/main.py, /exploratory). */

const VERSION = "sr-0.1";
const SIZE = 4;
const START = 13; // bottom row, second stall: "You are here"
const LENGTHS = [3, 4, 5, 6, 7];
const SHOW_MS = 850;
const GAP_MS = 250;

type Stall = { icon: LucideIcon; en: string; ar: string; tone: string };
const STALLS: Stall[] = [
  { icon: Coffee, en: "Coffee", ar: "قهوة", tone: "bg-[#f3e7da]" }, { icon: Fish, en: "Fish", ar: "سمك", tone: "bg-[#dfeef5]" },
  { icon: Apple, en: "Fruit", ar: "فواكه", tone: "bg-[#f7e1df]" }, { icon: Croissant, en: "Bread", ar: "خبز", tone: "bg-[#f6ecd6]" },
  { icon: Shirt, en: "Clothes", ar: "ملابس", tone: "bg-[#e5e8f5]" }, { icon: Gem, en: "Gold", ar: "ذهب", tone: "bg-[#f7efcf]" },
  { icon: Flower2, en: "Flowers", ar: "زهور", tone: "bg-[#f4e3ef]" }, { icon: Soup, en: "Spices", ar: "بهارات", tone: "bg-[#f6e3d3]" },
  { icon: TreePalm, en: "Dates", ar: "تمر", tone: "bg-[#e3efe2]" }, { icon: SprayCan, en: "Perfume", ar: "عطور", tone: "bg-[#ece4f4]" },
  { icon: Lamp, en: "Lanterns", ar: "فوانيس", tone: "bg-[#f8edd8]" }, { icon: BookOpen, en: "Books", ar: "كتب", tone: "bg-[#e6eef0]" },
  { icon: Scissors, en: "Tailor", ar: "خيّاط", tone: "bg-[#eceae6]" }, { icon: MapPin, en: "You are here", ar: "أنت هنا", tone: "bg-deep" },
  { icon: Carrot, en: "Vegetables", ar: "خضار", tone: "bg-[#f7e6d6]" }, { icon: Candy, en: "Sweets", ar: "حلويات", tone: "bg-[#f8e1ea]" },
];

const T = {
  en: {
    title: "Souq route", sub: "About 2 minutes · exploratory",
    intro: "Watch a short walk through the market. The stalls light up one by one, starting from where you are. Then tap the same stalls, in the same order.",
    note: "This is a new, exploratory task. Your clinician sees the result, but it does not change your check-in result.",
    start: "Start with a practice", practice: "Practice route", watch: "Watch the route…", your: "Your turn: tap the stalls in order",
    route: (i: number, n: number) => `Route ${i} · ${n} stops`, next: "Next route", ok: "Thank you", begin: "Start the task",
    practiceDone: "That was the practice. Now the routes get a little longer.",
    done: "All done, thank you", span: (n: number) => (n ? `Longest route you remembered: ${n} stops.` : "These routes were difficult today, and that's fine."),
    saved: "Saved with your record for your clinician.", notSaved: "Not saved: this copy is not connected to the MemBrain server.",
    back: "Back to the check-in", here: "You are here",
  },
  ar: {
    title: "طريق السوق", sub: "نحو دقيقتين · مهمة استكشافية",
    intro: "شاهد جولة قصيرة في السوق. تُضاء المحلات واحدًا تلو الآخر، بدءًا من مكانك. ثم اضغط على المحلات نفسها وبالترتيب نفسه.",
    note: "هذه مهمة جديدة واستكشافية. يطّلع طبيبك على النتيجة، لكنها لا تغيّر نتيجة الفحص.",
    start: "ابدأ بتجربة", practice: "طريق تجريبي", watch: "شاهد الطريق…", your: "دورك: اضغط على المحلات بالترتيب",
    route: (i: number, n: number) => `الطريق ${i} · ${n} محطات`, next: "الطريق التالي", ok: "شكرًا لك", begin: "ابدأ المهمة",
    practiceDone: "انتهت التجربة. الآن تصبح الطرق أطول قليلًا.",
    done: "انتهينا، شكرًا لك", span: (n: number) => (n ? `أطول طريق تذكّرته: ${n} محطات.` : "كانت هذه الطرق صعبة اليوم، ولا بأس بذلك."),
    saved: "حُفظت النتيجة مع سجلك ليطّلع عليها طبيبك.", notSaved: "لم تُحفظ: هذه النسخة غير متصلة بخادم MemBrain.",
    back: "العودة إلى الفحص", here: "أنت هنا",
  },
};

/** Deterministic routes (same for everyone on the same form, so repeat visits are comparable). */
function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function makeRoute(len: number, seed: number): number[] {
  for (let attempt = 0; attempt < 50; attempt++) {
    const r = rng(seed * 97 + attempt * 7919);
    const path = [START];
    while (path.length <= len) {
      const cur = path[path.length - 1];
      const [row, col] = [Math.floor(cur / SIZE), cur % SIZE];
      const options = [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
        .filter(([a, b]) => a >= 0 && b >= 0 && a < SIZE && b < SIZE)
        .map(([a, b]) => a * SIZE + b)
        .filter((i) => !path.includes(i));
      if (!options.length) break;
      path.push(options[Math.floor(r() * options.length)]);
    }
    if (path.length === len + 1) return path.slice(1);
  }
  return [];
}
const FORM_SEED: Record<string, number> = { A: 11, B: 23, C: 37 };
const formForToday = () => (["A", "B", "C"] as const)[Math.floor(Date.now() / 86400000) % 3];

type Trial = { length: number; correct: boolean; steps_correct: number; ms: number };
type Phase = "intro" | "show" | "answer" | "between" | "done";

export function SouqRoute() {
  const params = useSearchParams();
  const pid = params.get("id") ?? "";
  const lang: Lang = params.get("lang") === "en" ? "en" : "ar";
  const t = T[lang];
  const form = useMemo(formForToday, []);

  const [phase, setPhase] = useState<Phase>("intro");
  const [practice, setPractice] = useState(true);
  const [li, setLi] = useState(0);          // index into LENGTHS
  const [rep, setRep] = useState(0);        // 0 or 1: two routes per length
  const [route, setRoute] = useState<number[]>([]);
  const [lit, setLit] = useState<number | null>(null);
  const [taps, setTaps] = useState<number[]>([]);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [save, setSave] = useState<"saving" | "saved" | "not" | null>(null);
  const t0 = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach((x) => window.clearTimeout(x)); stopSpeaking(); }, []);

  function play(r: number[]) {
    setRoute(r); setTaps([]); setLit(null); setPhase("show");
    void speak(t.watch, lang);
    r.forEach((cell, i) => {
      timers.current.push(window.setTimeout(() => setLit(cell), 600 + i * (SHOW_MS + GAP_MS)));
      timers.current.push(window.setTimeout(() => setLit(null), 600 + i * (SHOW_MS + GAP_MS) + SHOW_MS));
    });
    timers.current.push(window.setTimeout(() => { setPhase("answer"); t0.current = performance.now(); void speak(t.your, lang); },
      600 + r.length * (SHOW_MS + GAP_MS) + 200));
  }

  const startPractice = () => { setPractice(true); play(makeRoute(2, 5)); };
  const startTrial = (l = li, k = rep) => { setPractice(false); play(makeRoute(LENGTHS[l], FORM_SEED[form] * 10 + l * 2 + k)); };

  function tap(cell: number) {
    if (phase !== "answer" || cell === START || taps.length >= route.length) return;
    const nt = [...taps, cell];
    setTaps(nt);
    if (nt.length < route.length) return;
    const ms = Math.round(performance.now() - t0.current);
    if (practice) { setPhase("between"); return; }
    const stepsOk = nt.filter((c, i) => c === route[i]).length;
    const trial: Trial = { length: route.length, correct: stepsOk === route.length, steps_correct: stepsOk, ms };
    const all = [...trials, trial];
    setTrials(all);
    const atLen = all.filter((x) => x.length === route.length);
    const failedTwice = atLen.length === 2 && atLen.every((x) => !x.correct);
    const last = li === LENGTHS.length - 1 && rep === 1;
    if (failedTwice || last) return finish(all);
    if (rep === 0) setRep(1); else { setRep(0); setLi(li + 1); }
    setPhase("between");
  }

  async function finish(all: Trial[]) {
    setPhase("done");
    const span = Math.max(0, ...all.filter((x) => x.correct).map((x) => x.length));
    void speak(t.done, lang);
    setSave("saving");
    try {
      const b = await getBackend();
      if (b.mode !== "server" || !pid) { setSave("not"); return; }
      const r = await fetch(`${b.base ?? ""}/participants/${encodeURIComponent(pid)}/exploratory`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ task: "souq_route", version: VERSION, form, date: new Date().toISOString().slice(0, 10), lang, span, trials: all }),
      });
      setSave(r.ok ? "saved" : "not");
    } catch {
      setSave("not");
    }
  }

  const span = Math.max(0, ...trials.filter((x) => x.correct).map((x) => x.length));
  const label = practice ? t.practice : t.route(trials.length + 1, LENGTHS[li]);

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[820px] items-center gap-3 px-4 py-3">
          <Link href={`/checkin/?id=${encodeURIComponent(pid)}&lang=${lang}`} aria-label={t.back} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-mist" onClick={() => stopSpeaking()}>
            <ArrowLeft size={20} className={lang === "ar" ? "rotate-180" : ""} />
          </Link>
          <div>
            <p className="text-[17px] font-semibold">{t.title}</p>
            <p className="text-[13px] text-muted">{pid ? `${pid} · ` : ""}{t.sub}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[820px] px-4 py-6">
        {phase === "intro" && (
          <div className="space-y-4">
            <p className="text-[19px] leading-relaxed text-ink">{t.intro}</p>
            <p className="rounded-xl bg-[#e8ebf4] px-4 py-3 text-[14.5px] leading-snug text-lv-base">{t.note}</p>
            <button type="button" onClick={startPractice} className="rounded-xl bg-deep px-6 py-3.5 text-[17px] font-semibold text-white hover:bg-deep-hover">{t.start}</button>
          </div>
        )}

        {(phase === "show" || phase === "answer") && (
          <p className="mb-3 text-[17px] font-medium text-ink" aria-live="polite">
            {label} · <span className={phase === "answer" ? "text-leaf" : "text-muted"}>{phase === "answer" ? t.your : t.watch}</span>
          </p>
        )}

        {(phase === "show" || phase === "answer") && (
          <div dir="ltr" className="mx-auto grid max-w-[560px] grid-cols-4 gap-2.5 sm:gap-3" role="grid" aria-label={t.title}>
            {STALLS.map((s, i) => {
              const Icon = s.icon;
              const isStart = i === START;
              const on = lit === i;
              const order = taps.indexOf(i);
              return (
                <button key={i} type="button" onClick={() => tap(i)} disabled={phase !== "answer" || isStart}
                  aria-label={isStart ? t.here : lang === "ar" ? s.ar : s.en}
                  className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 text-center transition-all duration-150
                    ${isStart ? "border-deep bg-deep text-white" : on ? "scale-105 border-sand bg-sand text-ink shadow-lg" : order >= 0 ? "border-leaf bg-[#dcebe2] text-ink" : `border-transparent ${s.tone} text-ink`}
                    ${phase === "answer" && !isStart ? "hover:border-leaf/60" : ""}`}>
                  <Icon size={30} strokeWidth={1.8} />
                  <span className="text-[13px] font-medium leading-tight sm:text-[14px]">{isStart ? t.here : lang === "ar" ? s.ar : s.en}</span>
                  {order >= 0 && <span className="text-[12px] font-semibold text-leaf">{order + 1}</span>}
                </button>
              );
            })}
          </div>
        )}

        {phase === "between" && (
          <div className="space-y-4 text-center">
            <p className="text-[20px] font-semibold">{t.ok}</p>
            {practice && <p className="text-[16px] text-body">{t.practiceDone}</p>}
            <button type="button" onClick={() => startTrial()} className="rounded-xl bg-deep px-6 py-3.5 text-[17px] font-semibold text-white hover:bg-deep-hover">
              {practice ? t.begin : t.next}
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-4 text-center">
            <p className="font-serif text-[30px] font-semibold">{t.done}</p>
            <p className="text-[18px] text-ink">{t.span(span)}</p>
            <p className="text-[14.5px] text-body">{save === "saved" ? t.saved : save === "not" ? t.notSaved : "…"}</p>
            <p className="mx-auto max-w-[560px] rounded-xl bg-[#e8ebf4] px-4 py-3 text-[14px] leading-snug text-lv-base">{t.note}</p>
            <Link href={`/checkin/?id=${encodeURIComponent(pid)}&lang=${lang}`} className="inline-flex rounded-xl border border-line bg-white px-5 py-3 text-[15.5px] font-medium hover:bg-mist">{t.back}</Link>
          </div>
        )}
      </main>
    </div>
  );
}
