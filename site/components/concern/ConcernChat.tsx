"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUp, Check, Lock, Mic, Phone, RotateCcw, ShieldAlert, Square, Stethoscope, Volume2 } from "lucide-react";
import { LogoMark, Mark } from "../Logo";
import { Narrative } from "../Narrative";
import { config, getEngine, getIntake, LEVEL_TONE, REPORTER_LABEL, type Evaluation, type IntakeResult, type Lang, type Reporter } from "@/lib/mb";
import { ACTIVITY, CONFOUNDER, DOMAIN, ONSET, RED_FLAG, WHO, label } from "@/lib/labels";
import { getBackend } from "@/lib/workspace/backend";
import { COPY, EXAMPLES, REPORTERS, type Copy } from "./copy";

type Step = "who" | "describe" | "thinking" | "review" | "outcome";

/* ── Speech: dictation in, read-back out. Both are optional and fail quietly. ── */

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speak(text: string, lang: Lang, onEnd: () => void) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "ar" ? "ar-AE" : "en-GB";
    u.rate = 0.95;
    const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith(lang === "ar" ? "ar" : "en"));
    if (voice) u.voice = voice;
    u.onend = onEnd;
    u.onerror = onEnd;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    onEnd();
  }
}

const refFor = (text: string) => {
  let h = 7;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return `MB-C-${String(h).padStart(4, "0")}`;
};

/* ── Chat parts ── */

function BotRow({ children, avatar = true, wide = false }: { children: ReactNode; avatar?: boolean; wide?: boolean }) {
  return (
    <div className="mb-msg-in flex items-end gap-2.5">
      <span className="w-8 shrink-0">{avatar && <LogoMark className="h-8 w-8" />}</span>
      <div className={`${wide ? "w-full max-w-[560px]" : "max-w-[85%] sm:max-w-[460px]"} rounded-[20px] rounded-es-[6px] border border-line bg-white px-4 py-3 text-[15.5px] leading-[1.55] shadow-[0_1px_2px_rgb(15_35_40/0.04)]`}>
        {children}
      </div>
    </div>
  );
}

function UserRow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-msg-in flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-ee-[6px] bg-deep px-4 py-3 text-[15.5px] leading-[1.55] text-white sm:max-w-[460px]">{children}</div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-end gap-2.5" aria-hidden>
      <span className="w-8 shrink-0">
        <LogoMark className="h-8 w-8" />
      </span>
      <span className="flex gap-1 rounded-[20px] rounded-es-[6px] border border-line bg-white px-4 py-3.5">
        <span className="mb-dot h-[7px] w-[7px] rounded-full bg-muted" />
        <span className="mb-dot h-[7px] w-[7px] rounded-full bg-muted [animation-delay:150ms]" />
        <span className="mb-dot h-[7px] w-[7px] rounded-full bg-muted [animation-delay:300ms]" />
      </span>
    </div>
  );
}

function FactRow({ checked, onToggle, locked, title, quote, flag, t, tone = "default" }: {
  checked: boolean;
  onToggle?: () => void;
  locked: boolean;
  title: string;
  quote?: string;
  flag?: boolean;
  t: Copy;
  tone?: "default" | "urgent";
}) {
  const box = tone === "urgent" ? "border-lv-urgent bg-lv-urgent text-white" : "border-deep bg-deep text-white";
  const body = (
    <>
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors ${checked ? box : "border-[#b9c4c2] bg-white text-transparent"}`} aria-hidden>
        <Check size={13} strokeWidth={3} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-medium leading-snug ${checked ? "" : "text-muted line-through decoration-muted/60"}`}>
          {title}
          {flag && <span className="ms-2 rounded bg-lv-check-soft px-1.5 py-px align-middle text-[11px] font-semibold text-lv-check">{t.check}</span>}
        </span>
        {quote && (
          <span dir="auto" className="mt-0.5 block text-[13.5px] leading-snug text-muted">
            {/[؀-ۿ]/.test(quote) ? `«${quote}»` : `“${quote}”`}
          </span>
        )}
      </span>
    </>
  );
  if (locked || !onToggle) return <div className="flex gap-3 py-2.5">{body}</div>;
  return (
    <label className="-mx-2 flex cursor-pointer gap-3 rounded-lg px-2 py-2.5 hover:bg-paper">
      <input type="checkbox" className="sr-only" checked={checked} onChange={onToggle} />
      {body}
    </label>
  );
}

function Section({ title, children, tone }: { title: string; children: ReactNode; tone?: "urgent" }) {
  return (
    <div className="border-t border-line pt-2.5 first:border-t-0 first:pt-0">
      <p className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${tone === "urgent" ? "text-lv-urgent" : "text-leaf"}`}>{title}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

/* ── The chat ── */

export function ConcernChat() {
  const params = useSearchParams();
  const [lang, setLang] = useState<Lang>(params.get("lang") === "ar" ? "ar" : "en");
  const t = COPY[lang];
  const [step, setStep] = useState<Step>("who");
  const [reporter, setReporter] = useState<Reporter | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]); // what the person sent, in order
  const [askedMore, setAskedMore] = useState(false);
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [ok, setOk] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState<Evaluation | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [reading, setReading] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canDictate = useMemo(() => getRecognition() !== null, []);

  const narrative = messages.join("\n");
  const narrativeLang: Lang = narrative ? getIntake().detectLang(narrative) : lang;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [step, messages.length, result, outcome, askedMore]);

  useEffect(() => {
    if (step === "describe") inputRef.current?.focus();
  }, [step]);

  useEffect(() => () => {
    recRef.current?.stop();
    try { speechSynthesis.cancel(); } catch { /* not available */ }
  }, []);

  const switchLang = (l: Lang) => {
    setLang(l);
    try {
      const u = new URL(window.location.href);
      if (l === "ar") u.searchParams.set("lang", "ar");
      else u.searchParams.delete("lang");
      window.history.replaceState(null, "", u);
    } catch { /* ignore */ }
  };

  const chooseReporter = (r: Reporter) => {
    setReporter(r);
    setStep("describe");
  };

  const send = (text = draft) => {
    const clean = text.trim();
    if (clean.length < 3) return;
    stopListening();
    const all = [...messages, clean];
    setMessages(all);
    setDraft("");
    setStep("thinking");
    window.setTimeout(() => {
      const joined = all.join("\n");
      const r = getIntake().extract(joined, getIntake().detectLang(joined));
      const next: Record<string, boolean> = {};
      r.fields.forEach((f) => (next[`${f.kind}:${f.key}`] = f.kind === "red_flag" || !f.needs_confirmation));
      if (r.onset) next.onset = true;
      r.timeline.forEach((_, i) => (next[`tl:${i}`] = true));
      setResult(r);
      setOk(next);
      setStep("review");
    }, 1100);
  };

  const tryExample = (i: number) => {
    const ex = EXAMPLES[i];
    if (!reporter) setReporter(ex.reporter);
    send(ex.text);
  };

  const addMore = () => {
    setAskedMore(true);
    setResult(null);
    setStep("describe");
  };

  const confirm = () => {
    if (!result) return;
    stopReading();
    const acts = [...new Set(result.timeline.filter((_, i) => ok[`tl:${i}`]).map((x) => x.activity))];
    const flags = result.fields.filter((f) => f.kind === "red_flag").map((f) => f.key);
    const session = {
      session_id: "concern-intake",
      date: "2026-11-14",
      type: "intake" as const,
      channel: "app",
      concern: narrative,
      red_flags: flags,
      reported_concern: {
        reporter: reporter ?? "family",
        domains: result.fields.filter((f) => f.kind === "domain" && ok[`domain:${f.key}`]).map((f) => f.key),
        activities_taken_over: acts,
      },
    };
    const ev = getEngine().evaluate({ id: "new", age: 65, education: "secondary" }, [session]).latest;
    // Hand the confirmed facts to the workspace: the MemBrain server when it answers, otherwise this browser.
    // The server's own triage decides the outcome shown; the in-browser result is the fallback.
    const body = {
      reporter: reporter ?? "family",
      lang: narrativeLang,
      narrative,
      domains: result.fields.filter((f) => f.kind === "domain" && ok[`domain:${f.key}`]).map((f) => f.key),
      onset: result.onset && ok.onset ? result.onset.value : null,
      timeline: result.timeline.filter((_, i) => ok[`tl:${i}`]).map((x) => [x.activity, x.who_took_over] as [string, string]),
      red_flags: flags,
      confounders: result.fields.filter((f) => f.kind === "confounder" && ok[`confounder:${f.key}`]).map((f) => f.key),
      date: session.date,
    };
    const saved = getBackend()
      .then((b) => b.raiseConcern(body))
      .then((c) => {
        setCaseId(c.participant.id);
        return c.latest ?? ev;
      })
      .catch(() => ev);
    setStep("thinking");
    Promise.all([saved, new Promise((r) => window.setTimeout(r, 900))]).then(([final]) => {
      setOutcome(final as Evaluation);
      setStep("outcome");
    });
  };

  const restart = () => {
    stopReading();
    stopListening();
    setStep("who");
    setReporter(null);
    setDraft("");
    setMessages([]);
    setAskedMore(false);
    setResult(null);
    setOk({});
    setOutcome(null);
    setCaseId(null);
  };

  function stopListening() {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }

  const toggleMic = () => {
    if (listening) return stopListening();
    const Ctor = getRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang === "ar" ? "ar-AE" : "en-GB";
    rec.continuous = true;
    rec.interimResults = true;
    const before = draft ? draft.trimEnd() + " " : "";
    rec.onresult = (e) => {
      let said = "";
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      setDraft(before + said);
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  function stopReading() {
    try { speechSynthesis.cancel(); } catch { /* ignore */ }
    setReading(false);
  }

  const readBack = () => {
    if (!result) return;
    if (reading) return stopReading();
    const L = narrativeLang;
    const doms = result.fields.filter((f) => f.kind === "domain" && ok[`domain:${f.key}`]).map((f) => label(DOMAIN, f.key, L, f.label).toLowerCase());
    const flags = result.fields.filter((f) => f.kind === "red_flag");
    const onset = result.onset && ok.onset ? label(ONSET, result.onset.value, L, result.onset.label) : "";
    const text =
      L === "ar"
        ? `سمعت إنك لاحظت تغيّر في: ${doms.join("، ") || "شي ما تحدد للحين"}. ${onset}. ${flags.length ? "وذكرت علامات ممكن تكون عاجلة، فبيشوفها طبيب. " : ""}هل هذا صحيح؟`
        : `I heard that you have noticed changes in ${doms.join(", ") || "nothing specific yet"}${onset ? ". " + onset : ""}. ${flags.length ? "You also mentioned signs that may be urgent, so a clinician will look at them. " : ""}Is that right?`;
    setReading(true);
    speak(text, L, () => setReading(false));
  };

  const toggle = (key: string) => setOk((o) => ({ ...o, [key]: !o[key] }));

  /* ── Pieces of the conversation ── */

  const frozen = step === "outcome" || (step === "thinking" && !!result);
  const redFlags = result?.fields.filter((f) => f.kind === "red_flag") ?? [];
  const domains = result?.fields.filter((f) => f.kind === "domain") ?? [];
  const confounders = result?.fields.filter((f) => f.kind === "confounder") ?? [];
  const nothingFound = result && !domains.length && !redFlags.length && !result.timeline.length && !result.onset;

  const factsCard = result && (
    <BotRow wide>
      {redFlags.length > 0 && (
        <div className="-mx-4 -mt-3 mb-3 rounded-t-[19px] border-b border-lv-urgent/20 bg-lv-urgent-soft px-4 py-3.5">
          <p className="flex items-start gap-2 font-semibold text-lv-urgent">
            <ShieldAlert size={19} className="mt-0.5 shrink-0" /> {t.urgentTitle}
          </p>
          <p className="mt-1 text-[14.5px] leading-snug text-ink">{t.urgentBody}</p>
          <a href="tel:998" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-lv-urgent px-4 py-2.5 text-[14.5px] font-semibold text-white hover:bg-[#7a1832]">
            <Phone size={16} /> {t.call}
          </a>
        </div>
      )}
      <p>{nothingFound ? t.pickedNone : frozen ? t.pickedFrozen : t.picked}</p>
      <div className="mt-3 rounded-xl bg-paper px-3.5 py-2.5">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">{t.yourWords}</p>
        <Narrative text={narrative} result={result} className="mt-1 text-ink" />
      </div>
      <div className="mt-3 space-y-2.5">
        {redFlags.length > 0 && (
          <Section title={t.urgent} tone="urgent">
            {redFlags.map((f) => (
              <FactRow key={f.key} t={t} locked checked tone="urgent" title={label(RED_FLAG, f.key, lang, f.label)} quote={f.evidence.join(" … ")} />
            ))}
            {!frozen && <p className="pb-1 text-[12.5px] text-muted">{t.urgentLocked}</p>}
          </Section>
        )}
        {domains.length > 0 && (
          <Section title={t.changed}>
            {domains
              .filter((f) => !frozen || ok[`domain:${f.key}`])
              .map((f) => (
                <FactRow key={f.key} t={t} locked={frozen} checked={!!ok[`domain:${f.key}`]} onToggle={() => toggle(`domain:${f.key}`)} title={label(DOMAIN, f.key, lang, f.label)} quote={f.evidence.join(" … ")} flag={f.needs_confirmation} />
              ))}
          </Section>
        )}
        {result.onset && (!frozen || ok.onset) && (
          <Section title={t.started}>
            <FactRow t={t} locked={frozen} checked={!!ok.onset} onToggle={() => toggle("onset")} title={label(ONSET, result.onset.value, lang, result.onset.label)} quote={narrative.slice(...result.onset.spans[0])} />
          </Section>
        )}
        {result.timeline.length > 0 && (
          <Section title={t.who}>
            {result.timeline.map((x, i) =>
              frozen && !ok[`tl:${i}`] ? null : (
                <FactRow
                  key={i}
                  t={t}
                  locked={frozen}
                  checked={!!ok[`tl:${i}`]}
                  onToggle={() => toggle(`tl:${i}`)}
                  title={`${label(ACTIVITY, x.activity, lang, x.activity_label)}: ${t.nowDoneBy} ${label(WHO, x.who_took_over, lang, x.who_label)}`}
                  quote={narrative.slice(...x.spans[0]).trim()}
                />
              ),
            )}
          </Section>
        )}
        {confounders.length > 0 && (
          <Section title={t.affect}>
            {confounders
              .filter((f) => !frozen || ok[`confounder:${f.key}`])
              .map((f) => (
                <FactRow key={f.key} t={t} locked={frozen} checked={!!ok[`confounder:${f.key}`]} onToggle={() => toggle(`confounder:${f.key}`)} title={label(CONFOUNDER, f.key, lang, f.label)} quote={f.evidence.join(" … ")} flag={f.needs_confirmation} />
              ))}
          </Section>
        )}
      </div>
    </BotRow>
  );

  const days = (lv: string) => (config.REVIEW_TARGET_DAYS?.[lv] as number | undefined) ?? 0;

  const outcomeCard = outcome && result && (() => {
    const acts = [...new Set(result.timeline.filter((_, i) => ok[`tl:${i}`]).map((x) => x.activity))];
    const reasons: string[] = [];
    // The engine's rule (membrain/config.py): a memory or thinking concern plus lost independence, or one raised by a professional.
    const thinking = result.fields.some((f) => f.kind === "domain" && ok[`domain:${f.key}`] && config.CONCERN_COGNITIVE_DOMAINS.includes(f.key));
    if (thinking && acts.length >= config.CONCERN_REVIEW_MIN_ACTIVITIES) reasons.push(t.reasonActs(acts.length));
    if (thinking && reporter === "professional") reasons.push(t.reasonPro);
    const tone = LEVEL_TONE[outcome.level];
    const head =
      outcome.level === "URGENT" ? t.urgentOutcome : outcome.level === "CLINICIAN_REVIEW" ? t.reviewOutcome(days("CLINICIAN_REVIEW")) : t.routineOutcome;
    const dChanged = result.fields.filter((f) => f.kind === "domain" && ok[`domain:${f.key}`]).map((f) => label(DOMAIN, f.key, lang, f.label));
    const dWho = result.timeline.filter((_, i) => ok[`tl:${i}`]).map((x) => `${label(ACTIVITY, x.activity, lang, x.activity_label)}: ${label(WHO, x.who_took_over, lang, x.who_label)}`);
    const rows: [string, string][] = [
      [t.raisedBy, reporter === "self" ? t.selfSeen : REPORTER_LABEL[lang][reporter ?? "family"]],
      [t.changed, dChanged.join(lang === "ar" ? "، " : ", ") || t.none],
      [t.started, result.onset && ok.onset ? label(ONSET, result.onset.value, lang, result.onset.label) : t.none],
      [t.who, dWho.join(lang === "ar" ? "، " : "; ") || t.none],
      [t.urgent, redFlags.map((f) => label(RED_FLAG, f.key, lang, f.label)).join(lang === "ar" ? "، " : "; ") || t.none],
      [t.missing, t.missingItems.join(lang === "ar" ? "، " : "; ")],
    ];
    return (
      <BotRow wide>
        <div className={`-mx-4 -mt-3 mb-3 rounded-t-[19px] px-4 py-4 ${tone.bg}`}>
          <p className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${tone.fg}`}>
            {t.reference} {caseId ?? refFor(narrative)}
          </p>
          <p className="mt-1 font-serif text-[22px] font-semibold leading-snug text-ink">{head}</p>
        </div>
        {outcome.level === "URGENT" && (
          <>
            <p>{t.urgentOutcomeBody(days("URGENT"))}</p>
            <a href="tel:998" className="mb-ring mt-3 inline-flex items-center gap-2 rounded-xl bg-lv-urgent px-4 py-2.5 text-[14.5px] font-semibold text-white">
              <Phone size={16} /> {t.call}
            </a>
          </>
        )}
        {outcome.level === "CLINICIAN_REVIEW" && (
          <>
            <p>{t.reviewOutcomeBody}</p>
            <ul className="mt-2 space-y-1">
              {reasons.map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-lv-review" />
                  {r}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-body">{t.reviewOutcomeAfter}</p>
          </>
        )}
        {outcome.level === "BASELINE" && <p>{t.routineOutcomeBody}</p>}

        <div className="mt-4 rounded-xl border border-line">
          <p className="flex items-center gap-2 border-b border-line px-3.5 py-2.5 text-[13px] font-semibold">
            <Stethoscope size={15} className="text-leaf" /> {t.seen}
          </p>
          <dl className="divide-y divide-line text-[14px]">
            {rows.map(([k, v]) => (
              <div key={k} className="px-3.5 py-2 sm:grid sm:grid-cols-[140px_1fr] sm:gap-3">
                <dt className="text-[12.5px] text-muted sm:text-[14px]">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="mt-3 text-[12px] leading-snug text-muted" dir="ltr" lang="en">
          {t.engineNote} {config.ENGINE_VERSION}: “{outcome.reasons[0]}”
        </p>
      </BotRow>
    );
  })();

  /* ── Composer: what you can do right now ── */

  let composer: ReactNode = null;
  if (step === "who") {
    composer = (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {REPORTERS.map((r) => (
          <button key={r} type="button" onClick={() => chooseReporter(r)} className="rounded-xl border border-line bg-white px-3 py-3 text-start text-[14.5px] font-medium shadow-sm transition-colors hover:border-leaf hover:bg-mist">
            {REPORTER_LABEL[lang][r]}
          </button>
        ))}
      </div>
    );
  } else if (step === "describe") {
    composer = (
      <div>
        {messages.length === 0 && (
          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
            <span className="shrink-0 self-center text-[12.5px] text-muted">{t.examples}</span>
            {EXAMPLES.map((ex, i) => (
              <button key={i} type="button" onClick={() => tryExample(i)} className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-body transition-colors hover:border-leaf hover:text-deep">
                {ex.label[lang]}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className={`flex items-end gap-2 rounded-[22px] border bg-white p-1.5 shadow-sm transition-colors ${listening ? "border-lv-review" : "border-line focus-within:border-leaf"}`}
        >
          {canDictate && (
            <button
              type="button"
              onClick={toggleMic}
              aria-label={t.mic}
              aria-pressed={listening}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${listening ? "mb-ring bg-lv-review text-white" : "bg-mist text-deep hover:bg-mist-strong"}`}
            >
              {listening ? <Square size={16} fill="currentColor" /> : <Mic size={20} />}
            </button>
          )}
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={Math.min(5, Math.max(1, draft.split("\n").length + Math.floor(draft.length / 48)))}
            placeholder={listening ? t.listening : t.placeholder}
            dir="auto"
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-[16px] leading-[1.45] outline-none placeholder:text-muted"
          />
          <button type="submit" aria-label={t.send} disabled={draft.trim().length < 3} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-deep text-white transition-colors hover:bg-deep-hover disabled:bg-mist-strong disabled:text-muted">
            <ArrowUp size={20} />
          </button>
        </form>
        <p className="mt-2 flex items-center gap-1.5 px-1 text-[12px] text-muted">
          <Lock size={12} /> {canDictate ? t.voiceNote : t.disclaimer}
        </p>
      </div>
    );
  } else if (step === "review") {
    composer = (
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={confirm} className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-deep px-5 py-3.5 text-[15px] font-medium text-white hover:bg-deep-hover sm:flex-none">
          <Check size={18} /> {t.right}
        </button>
        <button type="button" onClick={readBack} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-4 py-3.5 text-[15px] font-medium hover:bg-mist">
          {reading ? <Square size={15} fill="currentColor" /> : <Volume2 size={18} />} {reading ? t.stopReading : t.readBack}
        </button>
        <button type="button" onClick={addMore} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-4 py-3.5 text-[15px] font-medium hover:bg-mist">
          {t.addMore}
        </button>
      </div>
    );
  } else if (step === "outcome") {
    composer = (
      <div className="flex flex-wrap gap-2">
        <Link href={caseId ? `/clinician/case/?id=${encodeURIComponent(caseId)}` : "/clinician/"} className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-deep px-5 py-3.5 text-[15px] font-medium text-white hover:bg-deep-hover sm:flex-none">
          <Stethoscope size={18} /> {t.clinician}
        </Link>
        {outcome?.level !== "URGENT" && (
          <Link href="/prototype/#participant" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-4 py-3.5 text-[15px] font-medium hover:bg-mist">
            {t.checkin}
          </Link>
        )}
        <button type="button" onClick={restart} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-4 py-3.5 text-[15px] font-medium hover:bg-mist">
          <RotateCcw size={16} /> {t.restart}
        </button>
      </div>
    );
  }

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="flex h-dvh flex-col bg-paper">
      {/* Top bar */}
      <header className="shrink-0 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[64px] max-w-[1080px] items-center gap-3 px-3 sm:px-6">
          <Link href="/" aria-label={t.home} className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-mist">
            <ArrowLeft size={21} className="rtl:-scale-x-100" />
          </Link>
          <Mark className="h-9 w-auto" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold leading-tight tracking-[-0.01em]">{t.title}</p>
            <p className="truncate text-[12.5px] leading-tight text-muted">{t.subtitle}</p>
          </div>
          <div className="flex rounded-full bg-mist p-1" role="group" aria-label="Language">
            {(["en", "ar"] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => switchLang(l)}
                aria-pressed={lang === l}
                lang={l}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${lang === l ? "bg-white text-deep shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {l === "en" ? "English" : "عربي"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1080px] flex-1 gap-10 lg:px-6">
        {/* What happens to what you say: desktop only */}
        <aside className="hidden w-[280px] shrink-0 py-8 lg:block">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-leaf">{t.asideTitle}</p>
          <ol className="mt-4 space-y-4">
            {t.aside.map((a, i) => (
              <li key={a} className="flex gap-3 text-[14.5px] leading-snug text-body">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white font-mono text-[12px] text-deep shadow-sm">{i + 1}</span>
                {a}
              </li>
            ))}
          </ol>
          <div className="mt-8 rounded-2xl border border-lv-urgent/15 bg-white p-4">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-lv-urgent">
              <Phone size={15} /> {t.emergency}
            </p>
          </div>
        </aside>

        {/* The conversation */}
        <main className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-6 sm:px-6 lg:px-0" aria-live="polite">
            <div className="mx-auto max-w-[680px] space-y-3 pb-6">
              <BotRow avatar={false}>{t.intro1}</BotRow>
              <BotRow>{t.intro2}</BotRow>
              {reporter && (
                <>
                  <UserRow>{REPORTER_LABEL[lang][reporter]}</UserRow>
                  <BotRow>{reporter === "self" ? t.askSelf : t.askOther}</BotRow>
                </>
              )}
              {messages.map((m, i) => (
                <div key={i} className="space-y-3">
                  {i > 0 && <BotRow>{t.askMore}</BotRow>}
                  <UserRow>
                    <span dir="auto">{m}</span>
                  </UserRow>
                </div>
              ))}
              {askedMore && step === "describe" && <BotRow>{t.askMore}</BotRow>}
              {factsCard}
              {outcome && <UserRow>{t.right}</UserRow>}
              {outcomeCard}
              {step === "thinking" && <Typing />}
              <div ref={endRef} />
            </div>
          </div>

          <div className="shrink-0 border-t border-line bg-paper/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6 lg:px-0">
            <div className="mx-auto max-w-[680px]">{composer}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
