"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Info, Loader2, Phone, Send } from "lucide-react";
import { Mark } from "../Logo";
import { Options } from "../checkin/parts";
import type { Lang } from "@/lib/mb";
import { APP_HOME, appCaseHref, homeHref, inApp } from "@/lib/app";
import { useSession } from "@/lib/auth";
import { getBackend, type Backend, type Case, type Respondent } from "@/lib/workspace/backend";
import { FAQ_INTERVAL_WEEKS, FAQ_ITEMS, ITEM, NEVER, RESPONDENT, SCALE } from "@/lib/workspace/informant";
import { participantNameOf } from "@/lib/workspace/derive";
import { QCOPY } from "./copy";

const nameOf = (c: Case, lang: Lang) => participantNameOf(c.participant, lang);
const today = () => new Date().toISOString().slice(0, 10);

/** The family questionnaire: who is answering, then one everyday activity per screen, then a thank-you (never a score). */
export function Questionnaire() {
  const params = useSearchParams();
  const id = params.get("id");
  const [lang, setLang] = useState<Lang>(params.get("lang") === "ar" ? "ar" : "en");
  const [backend, setBackend] = useState<Backend | null>(null);
  const [found, setFound] = useState<Case | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    getBackend()
      .then((b) => {
        if (live) setBackend(b);
        return b.cases();
      })
      .then((cs) => live && setFound(cs.find((c) => c.participant.id === id) ?? null))
      .catch(() => live && setFound(null));
    return () => {
      live = false;
    };
  }, [id]);
  const t = QCOPY[lang];
  if (found === undefined || !backend) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-paper" dir={lang === "ar" ? "rtl" : "ltr"}>
        <Mark className="h-12 w-auto opacity-90" />
        <p className="flex items-center gap-2 text-[15px] text-muted"><Loader2 size={16} className="animate-spin" /> {t.loading}</p>
      </div>
    );
  }
  if (!found) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-paper px-6 text-center" dir={lang === "ar" ? "rtl" : "ltr"}>
        <Mark className="h-12 w-auto opacity-90" />
        <p className="text-[16px] text-body">{t.notYours}</p>
        <Link href={homeHref(lang)} className="rounded-xl border border-line bg-white px-5 py-3 text-[15px] font-medium hover:bg-mist">{t.exit}</Link>
      </div>
    );
  }
  return <Run c={found} backend={backend} lang={lang} setLang={setLang} />;
}

type Answer = { value: number; key: string };

function Run({ c, backend, lang, setLang }: { c: Case; backend: Backend; lang: Lang; setLang: (l: Lang) => void }) {
  const t = QCOPY[lang];
  const { session } = useSession();
  const staff = session?.user.role === "clinician" || session?.user.role === "coordinator";
  const name = nameOf(c, lang);
  const [i, setI] = useState(-1); // -1: intro; 0..9: the activities; 10: sending/done
  const [respondent, setRespondent] = useState<Respondent | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [neverOpen, setNeverOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "failed">("idle");
  const [message, setMessage] = useState("");
  const n = FAQ_ITEMS.length;
  const item = i >= 0 && i < n ? FAQ_ITEMS[i] : null;
  const exitHref = staff ? appCaseHref(c.participant.id) : inApp() ? APP_HOME : `/checkin/?id=${encodeURIComponent(c.participant.id)}&lang=${lang}`;
  const reportHref = `/concern/?for=${encodeURIComponent(c.participant.id)}&lang=${lang}`;
  const respondents = useMemo(() => (Object.keys(RESPONDENT) as Respondent[]).map((k) => ({ value: k, label: RESPONDENT[k][lang] })), [lang]);

  const submit = async () => {
    if (!respondent) return;
    setState("sending");
    try {
      const done = await backend.submitInformant(c.participant.id, {
        date: today(), lang, respondent, answers: Object.fromEntries(FAQ_ITEMS.map((k) => [k, answers[k].value])),
      });
      setMessage(done.message);
      setState("done");
      setI(n);
    } catch {
      setState("failed");
    }
  };
  const pick = (key: string, value: number) => {
    if (!item) return;
    setAnswers((a) => ({ ...a, [item]: { key, value } }));
    // Move on by itself after a beat, unless the person has already moved (tapped Next or Back) in the meantime.
    const at = i;
    if (i < n - 1) window.setTimeout(() => { setI((x) => (x === at ? x + 1 : x)); setNeverOpen(false); }, 260);
  };

  let body;
  if (i === -1) {
    body = (
      <div className="space-y-7">
        <div>
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-leaf">{t.eyebrow}</p>
          <h1 className="mt-2 font-serif text-[27px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink text-balance sm:text-[32px]">{t.intro(name)}</h1>
          <p className="mt-3 text-[16.5px] leading-[1.6] text-body text-pretty">{t.introBody(FAQ_INTERVAL_WEEKS)}</p>
        </div>
        <div className="flex gap-3.5 rounded-2xl border border-[#d9c49d] bg-sand-soft p-4 sm:p-5">
          <Info size={20} className="mt-0.5 shrink-0 text-[#8a5a14]" aria-hidden />
          <div>
            <p className="text-[16px] font-semibold text-[#5d3f12]">{t.notDiagnosis}</p>
            <p className="mt-1 text-[15px] leading-[1.6] text-[#6b4714]">{t.notDiagnosisBody}</p>
          </div>
        </div>
        <div>
          <p className="mb-3 text-[17px] font-semibold text-ink">{t.whoYou}</p>
          <Options options={respondents} value={respondent} onPick={(v) => setRespondent(v as Respondent)} cols={2} />
        </div>
      </div>
    );
  } else if (item) {
    const a = answers[item];
    const it = ITEM[item];
    const eg = lang === "ar" ? it.ar_eg : it.en_eg;
    body = (
      <div className="space-y-6">
        <div>
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-leaf">{t.question(name)}</p>
          <h1 className="mt-2 font-serif text-[27px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink text-balance sm:text-[32px]">{it[lang]}</h1>
          {eg && <p className="mt-2 text-[16px] text-muted">{eg}</p>}
        </div>
        <Options options={SCALE.map((s) => ({ value: s.key, label: s[lang] }))} value={a && SCALE.some((s) => s.key === a.key) ? a.key : null}
          onPick={(k) => pick(String(k), SCALE.find((s) => s.key === k)!.value)} />
        <div>
          <button type="button" onClick={() => setNeverOpen((o) => !o)} aria-expanded={neverOpen || NEVER.some((s) => s.key === a?.key)}
            className="inline-flex items-center gap-1.5 text-[15px] font-medium text-deep hover:underline">
            {t.never} <ChevronDown size={16} className={`transition-transform ${neverOpen || NEVER.some((s) => s.key === a?.key) ? "rotate-180" : ""}`} />
          </button>
          {(neverOpen || NEVER.some((s) => s.key === a?.key)) && (
            <div className="mt-3">
              <Options options={NEVER.map((s) => ({ value: s.key, label: s[lang] }))} value={a && NEVER.some((s) => s.key === a.key) ? a.key : null}
                onPick={(k) => pick(String(k), NEVER.find((s) => s.key === k)!.value)} />
            </div>
          )}
        </div>
        {state === "failed" && <p role="alert" className="rounded-xl bg-lv-urgent-soft px-4 py-3 text-[15px] text-lv-urgent">{t.failed}</p>}
      </div>
    );
  } else {
    body = (
      <div className="space-y-6">
        <div className="flex flex-col items-center pt-2 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-deep text-white shadow-[0_14px_34px_-14px_rgb(15_63_44/0.65)]">
            <Check size={38} strokeWidth={2.4} />
          </span>
          <h1 className="mt-5 font-serif text-[32px] font-semibold leading-tight tracking-[-0.015em] sm:text-[38px]">{t.thanks}</h1>
        </div>
        <div className="rounded-2xl bg-mist p-5 text-[17.5px] leading-[1.6] text-deep">{message}</div>
        <p className="text-center text-[15.5px] text-body">{t.nextTime(FAQ_INTERVAL_WEEKS)}</p>
        <div className="flex flex-wrap justify-center gap-2.5 pt-1">
          <Link href={exitHref} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-deep px-6 py-3.5 text-[16px] font-semibold text-white hover:bg-deep-hover sm:flex-none">{t.done}</Link>
          <Link href={reportHref} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 py-3.5 text-[15.5px] font-medium hover:bg-mist">{t.report}</Link>
        </div>
      </div>
    );
  }

  const answered = item ? !!answers[item] : false;
  const last = i === n - 1;
  const canNext = i === -1 ? !!respondent : answered;
  const pct = i < 0 ? 0 : Math.round((Math.min(i, n) / n) * 100);

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="flex h-dvh flex-col bg-paper">
      <header className="relative z-20 shrink-0 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[64px] max-w-[1080px] items-center gap-3 px-3 sm:px-6">
          <Link href={exitHref} aria-label={t.exit} className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-mist">
            <ArrowLeft size={21} className="rtl:-scale-x-100" />
          </Link>
          <Mark className="hidden h-9 w-auto sm:block" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold leading-tight tracking-[-0.01em]">{t.title}</p>
            <p className="truncate text-[12.5px] leading-tight text-muted">{t.about(name || c.participant.id)}</p>
          </div>
          <div className="flex rounded-full bg-mist p-1" role="group" aria-label="Language">
            {(["en", "ar"] as Lang[]).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} lang={l}
                className={`rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-3 ${lang === l ? "bg-white text-deep shadow-sm" : "text-muted hover:text-ink"}`}>
                {l === "en" ? "English" : "عربي"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {i >= 0 && i < n && (
        <div className="shrink-0 border-b border-line bg-white">
          <div className="mx-auto flex max-w-[1080px] items-center gap-4 px-4 py-2.5 sm:px-6">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full rounded-full bg-deep transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="shrink-0 text-[13px] font-medium text-body" aria-live="polite">{t.of(i + 1, n)}</p>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1080px] gap-10 lg:px-6">
          <aside className="hidden w-[280px] shrink-0 py-10 lg:block">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-leaf">{t.asideTitle}</p>
            <ul className="mt-4 space-y-3.5">
              {t.aside.map((x) => (
                <li key={x} className="flex gap-3 text-[14.5px] leading-snug text-body">
                  <Check size={16} className="mt-0.5 shrink-0 text-leaf" /> {x}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-2xl border border-lv-urgent/15 bg-white p-4">
              <p className="flex items-center gap-2 text-[14px] font-semibold text-lv-urgent"><Phone size={15} /> {t.emergency}</p>
            </div>
          </aside>
          <main className="mx-auto w-full max-w-[600px] px-4 pb-10 pt-8 sm:pt-12">
            <div key={i} className="mb-step-in">{body}</div>
          </main>
        </div>
      </div>

      {i < n && (
        <footer className="shrink-0 border-t border-line bg-white/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="mx-auto flex max-w-[1080px] gap-10 lg:px-6">
            <div className="hidden w-[280px] shrink-0 lg:block" aria-hidden />
            <div className="mx-auto flex w-full max-w-[600px] items-center gap-2.5 px-4 py-3">
              {i >= 0 && (
                <button type="button" onClick={() => { setI((x) => x - 1); setNeverOpen(false); }} aria-label={t.back}
                  className="inline-flex h-[52px] items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-[15px] font-medium text-ink hover:bg-mist">
                  <ArrowLeft size={17} className="rtl:-scale-x-100" /> <span className="hidden sm:inline">{t.back}</span>
                </button>
              )}
              <button
                type="button"
                disabled={!canNext || state === "sending"}
                onClick={() => (last ? void submit() : (setI((x) => x + 1), setNeverOpen(false)))}
                className="ms-auto inline-flex h-[52px] min-w-[150px] flex-1 items-center justify-center gap-2 rounded-xl bg-deep px-6 text-[16.5px] font-semibold text-white shadow-sm transition-colors hover:bg-deep-hover disabled:cursor-not-allowed disabled:bg-[#9fb3aa] sm:flex-none"
              >
                {state === "sending" ? <><Loader2 size={18} className="animate-spin" /> {t.sending}</> :
                  last ? <>{t.send} <Send size={17} className="rtl:-scale-x-100" /></> :
                  <>{i === -1 ? t.start : t.next} <ArrowRight size={18} className="rtl:-scale-x-100" /></>}
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
