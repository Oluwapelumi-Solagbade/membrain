"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Keyboard, Loader2, Mic, Square, UserRound, Volume2 } from "lucide-react";
import type { Lang } from "@/lib/mb";
import { Recorder, type Recording, type Speech } from "@/lib/voice";
import { num, type Copy } from "./copy";

/** The spoken instruction, written large, with a button to hear it again. */
export function Prompt({ text, sub, speaking, onRepeat, t, eyebrow }: { text: string; sub?: ReactNode; speaking: boolean; onRepeat?: () => void; t: Copy; eyebrow?: string }) {
  return (
    <div>
      {eyebrow && <p className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-leaf">{eyebrow}</p>}
      <h1 className={`${eyebrow ? "mt-2" : ""} font-serif text-[27px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink text-balance sm:text-[32px]`}>{text}</h1>
      {sub && <div className="mt-3 text-[16.5px] leading-[1.55] text-body text-pretty">{sub}</div>}
      {onRepeat && (
        <button
          type="button"
          onClick={onRepeat}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[14.5px] font-medium text-deep shadow-sm transition-colors hover:bg-mist"
        >
          {speaking ? <Wave /> : <Volume2 size={17} />} {t.repeat}
        </button>
      )}
    </div>
  );
}

export function Wave({ className = "text-deep" }: { className?: string }) {
  return (
    <span className={`inline-flex h-[17px] items-center gap-[3px] ${className}`} aria-hidden>
      {[0, 120, 240, 360].map((d) => (
        <span key={d} className="mb-wave h-full w-[3px] rounded-full bg-current" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

/** Large tap targets. Picking one moves on by itself after a beat, so the person never hunts for "Next". */
export function Options({ options, value, onPick, cols = 1 }: { options: { value: string | number; label: string }[]; value: string | number | null | undefined; onPick: (v: string | number) => void; cols?: 1 | 2 }) {
  return (
    <div className={`grid gap-3 ${cols === 2 ? "grid-cols-2" : "grid-cols-1"}`} role="radiogroup">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(o.value)}
            className={`flex min-h-[60px] items-center gap-3.5 rounded-2xl border-[1.5px] px-5 py-3.5 text-start text-[17px] font-medium transition-all ${
              on ? "border-deep bg-mist text-deep shadow-[0_0_0_3px_rgb(15_63_44/0.08)]" : "border-line bg-white text-ink hover:border-leaf/50 hover:bg-[#fbfcfb]"
            }`}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${on ? "border-deep bg-deep text-white" : "border-[#b9c4c2] bg-white text-transparent"}`} aria-hidden>
              <Check size={14} strokeWidth={3} />
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const fmt = (s: number, lang: Lang) => num(Math.floor(s / 60), lang) + ":" + num(Math.floor(s % 60), lang).padStart(2, lang === "ar" ? "٠" : "0");

/** One spoken answer: the microphone, what was heard (which can be corrected), and demo answers. */
export function MicAnswer({
  t,
  lang,
  speech,
  dialect,
  micOk,
  value,
  onText,
  onRecorded,
  samples,
  seconds,
  noiseDb,
  countWords = false,
  onNoMic,
}: {
  t: Copy;
  lang: Lang;
  speech: Speech | null;
  dialect: string | null;
  micOk: boolean;
  value: string;
  onText: (v: string) => void;
  onRecorded: (r: Recording) => void;
  samples: [string, string];
  seconds?: number;
  noiseDb: number | null;
  countWords?: boolean;
  onNoMic?: () => void;
}) {
  const rec = useRef<Recorder | null>(null);
  const [state, setState] = useState<"idle" | "rec" | "working">("idle");
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [failed, setFailed] = useState(false);
  const [timeUp, setTimeUp] = useState(false); // a timed task stopped itself at zero
  const timer = useRef<number | null>(null);
  const stopRef = useRef<() => void>(() => {});

  const stop = async () => {
    if (!rec.current || state !== "rec") return;
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setState("working");
    const r = await rec.current.stop(noiseDb);
    rec.current = null;
    setLevel(0);
    if (r.text) onText(r.text);
    onRecorded(r);
    setState("idle");
  };
  useEffect(() => {
    stopRef.current = () => void stop();
  });

  const start = async () => {
    if (!speech) return;
    const r = new Recorder();
    // A timed task (word fluency) starts over: a new try replaces the last one and gets the full time again, so it can
    // never add up to more than one minute. Other answers keep what was said before and add to it.
    const before = seconds ? "" : value.trim() ? value.trim() + " " : "";
    if (seconds) onText("");
    setTimeUp(false);
    const ok = await r.start({ lang, speech, dialect, onText: (x) => onText(before + x), onLevel: setLevel });
    if (!ok) {
      setFailed(true);
      onNoMic?.();
      return;
    }
    rec.current = r;
    setElapsed(0);
    setState("rec");
    const t0 = performance.now();
    timer.current = window.setInterval(() => {
      const s = (performance.now() - t0) / 1000;
      setElapsed(s);
      if (seconds && s >= seconds) {
        setElapsed(seconds);
        setTimeUp(true);
        stopRef.current();
      }
    }, 200);
  };

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
      if (rec.current) void rec.current.stop();
    },
    [],
  );

  const canMic = micOk && !failed && !!speech;
  const words = value.split(/\s+/).filter(Boolean).length;
  const left = seconds ? Math.max(0, seconds - elapsed) : 0;
  const R = 66;
  const C = 2 * Math.PI * R;
  const frac = seconds ? (state === "rec" ? left / seconds : 1) : 0;

  return (
    <div className="flex flex-col items-center">
      {canMic && (
        <>
          <div className="relative mt-2 flex h-[168px] w-[168px] items-center justify-center">
            {seconds ? (
              <svg viewBox="0 0 160 160" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
                <circle cx="80" cy="80" r={R} fill="none" stroke="#e3e6e3" strokeWidth="5" />
                <circle cx="80" cy="80" r={R} fill="none" stroke="#2a6045" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: "stroke-dashoffset 0.2s linear" }} />
              </svg>
            ) : null}
            <button
              type="button"
              onClick={state === "rec" ? () => void stop() : () => void start()}
              disabled={state === "working"}
              aria-label={state === "rec" ? t.stopTap : t.tap}
              className={`relative flex h-[116px] w-[116px] items-center justify-center rounded-full text-white transition-[background-color,box-shadow] duration-150 disabled:opacity-70 ${state === "rec" ? "bg-lv-review" : "bg-deep hover:bg-deep-hover"}`}
              style={{ boxShadow: state === "rec" ? `0 0 0 ${seconds ? 3 + level * 10 : 6 + level * 26}px rgb(176 68 44 / 0.16), 0 10px 30px -10px rgb(176 68 44 / 0.6)` : "0 14px 34px -14px rgb(15 63 44 / 0.65)" }}
            >
              {state === "working" ? <Loader2 size={40} className="animate-spin" /> : state === "rec" ? <Square size={34} fill="currentColor" /> : <Mic size={44} strokeWidth={1.8} />}
            </button>
          </div>
          <p className="mt-3 flex h-6 items-center gap-2 text-[15.5px] font-medium text-body" aria-live="polite">
            {state === "rec" ? (
              <>
                <span className="h-2 w-2 rounded-full bg-lv-review mb-ring" /> {t.listening} · <span className="font-mono text-[15px] tabular-nums">{fmt(seconds ? left : elapsed, lang)}</span>
              </>
            ) : state === "working" ? (
              t.working
            ) : timeUp ? (
              <span className="font-mono text-[15px] tabular-nums">{fmt(0, lang)}</span>
            ) : (
              t.tap
            )}
          </p>
          {state === "idle" && timeUp && seconds && (
            <p role="status" className="mt-2 max-w-[440px] rounded-xl bg-sand-soft px-4 py-2.5 text-center text-[15px] leading-snug text-[#6b4714]">{t.timeUp(seconds)}</p>
          )}
          {state === "rec" && <p className="mt-1 text-[14px] text-muted">{t.stopTap}</p>}
        </>
      )}

      <div className="mt-6 w-full rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgb(15_35_40/0.04)]">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.12em] text-leaf">
            {canMic ? t.heard : <><Keyboard size={14} /> {t.typedOnly}</>}
          </p>
          {countWords && words > 0 && <span className="rounded-full bg-mist px-2.5 py-0.5 text-[13px] font-semibold text-deep">{t.fluCount(words)}</span>}
        </div>
        <textarea
          dir="auto"
          value={value}
          onChange={(e) => onText(e.target.value)}
          rows={3}
          placeholder={canMic ? t.typeHere : "…"}
          className="mt-2 w-full resize-none rounded-xl bg-paper px-3.5 py-3 text-[17px] leading-[1.5] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-leaf/40"
        />
        {value && canMic && <p className="mt-1.5 text-[13px] text-muted">{t.edit}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-[12.5px] font-medium text-muted">{t.sample}:</span>
          {[t.sampleGood, t.sampleWeak].map((label, i) => (
            <button key={label} type="button" onClick={() => onText(samples[i])} className="rounded-full border border-line bg-white px-3 py-1 text-[13px] font-medium text-body hover:bg-mist">
              {label}
            </button>
          ))}
        </div>
      </div>
      {!canMic && failed && <p className="mt-3 text-center text-[14px] text-muted">{t.noMic}</p>}
    </div>
  );
}

export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-2 py-2.5 text-[15px] hover:bg-paper">
      <span>{label}</span>
      <input type="checkbox" className="peer sr-only" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? "bg-deep" : "bg-[#cfd6d3]"}`} aria-hidden>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "start-[18px]" : "start-0.5"}`} />
      </span>
    </label>
  );
}

const TONES = ["bg-mist text-deep", "bg-sand-soft text-[#7a5218]", "bg-lv-base-soft text-lv-base", "bg-[#e7efe9] text-leaf"];
export function Avatar({ name, id, className = "h-12 w-12 text-[17px]" }: { name: string; id: string; className?: string }) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${TONES[h % TONES.length]} ${className}`}>
      {name === "?" || !initials ? <UserRound className="h-[46%] w-[46%]" strokeWidth={2} /> : initials}
    </span>
  );
}
