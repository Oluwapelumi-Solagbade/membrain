"use client";

// The app's intake: a concern (or a change since the last one) in the reporter's own words, by voice or typing. The
// intake extractor reads it on the phone as they go, urgent signs come first, every fact shows the words it came from
// and can be unticked, and the confirmed facts go to the same triage as the website and the Telegram bot.
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Keyboard, Loader2, Mic, Phone, Sparkles, Square, Wand2 } from "lucide-react";
import { Card, cx, Pill, TopBar } from "./kit";
import { EXAMPLES } from "../concern/copy";
import { ACTIVITY, CONFOUNDER, DOMAIN, label, ONSET, RED_FLAG, WHO } from "@/lib/labels";
import { config, getIntake, REPORTER_LABEL, type IntakeResult, type Lang, type Reporter } from "@/lib/mb";
import { detectSpeech, Recorder, type Speech } from "@/lib/voice";
import { getBackend } from "@/lib/workspace/backend";
import type { Case, ConcernIn } from "@/lib/workspace/types";

const T = {
  en: {
    newTitle: "New concern", followTitle: "Report a change", sub: "Checked for urgent signs first",
    who: "Who noticed the change?", say: "In your own words", placeholder: "What has changed, since when, and does someone now do things the person used to do?",
    voice: "Voice", voiceSub: "Speak", type: "Type", typeSub: "Keyboard", example: "Example", exampleSub: "Try one",
    listening: "Listening… tap to stop", working: "Turning your voice into text…", noMic: "The microphone isn't available here. Please type instead.",
    read: "Read it", reading: "Reading…", picked: "What MemBrain picked out", tap: "Tap a fact to untick it if it's wrong.",
    urgentTitle: "Possible urgent signs", urgentBody: "If the person is unwell right now, call 998. A clinician checks these; they can't be unticked.",
    changed: "What has changed", started: "When it started", whoNow: "Who now does what", affect: "Things that can affect memory", none: "Nothing specific yet. Add more detail, or save and a clinician will ask.",
    save: "Confirm and send", saving: "Sending…", call: "Call 998",
    doneUrgent: "Please get help now", doneReview: (d: number) => "A clinician will review this within 24 hours", doneRoutine: "Saved. Next step: a short check-in",
    doneFollowNew: "Added. The clinic sees what has changed", doneFollowSame: "Added. Nothing new needs a separate review",
    newSince: "New since the earlier report", open: "Open the case", finish: "Done", failed: "This could not be sent. Please try again.",
    engine: "Read on this phone by the intake extractor", ref: "Reference",
  },
  ar: {
    newTitle: "قلق جديد", followTitle: "الإبلاغ عن تغيّر", sub: "نتحقق أولًا من العلامات العاجلة",
    who: "من لاحظ التغيّر؟", say: "بكلماتك", placeholder: "ما الذي تغيّر، ومنذ متى، وهل أصبح شخص آخر يقوم بأمور كان الشخص يقوم بها؟",
    voice: "صوت", voiceSub: "تحدّث", type: "كتابة", typeSub: "لوحة المفاتيح", example: "مثال", exampleSub: "جرّب واحدًا",
    listening: "أستمع… اضغط للإيقاف", working: "جارٍ تحويل صوتك إلى نص…", noMic: "الميكروفون غير متاح هنا. يُرجى الكتابة بدلًا من ذلك.",
    read: "اقرأه", reading: "جارٍ القراءة…", picked: "ما استخرجه MemBrain", tap: "اضغط على أي معلومة لإلغاء تحديدها إن كانت خاطئة.",
    urgentTitle: "علامات قد تكون عاجلة", urgentBody: "إذا كان الشخص متوعكًا الآن، اتصل على ٩٩٨. يتحقق الطبيب من هذه العلامات، ولا يمكن إلغاء تحديدها.",
    changed: "ما الذي تغيّر", started: "متى بدأ", whoNow: "من يقوم بماذا الآن", affect: "أمور قد تؤثر في الذاكرة", none: "لا شيء محدد بعد. أضف تفاصيل، أو أرسل وسيسألك الطبيب.",
    save: "تأكيد وإرسال", saving: "جارٍ الإرسال…", call: "اتصل على ٩٩٨",
    doneUrgent: "يُرجى طلب المساعدة الآن", doneReview: (d: number) => "سيراجع طبيب هذا خلال ٢٤ ساعة", doneRoutine: "تم الحفظ. الخطوة التالية: فحص قصير",
    doneFollowNew: "أُضيف. سترى العيادة ما الذي تغيّر", doneFollowSame: "أُضيف. لا يوجد ما يستدعي مراجعة مستقلة",
    newSince: "جديد منذ البلاغ السابق", open: "افتح الحالة", finish: "تم", failed: "تعذّر الإرسال. حاول مرة أخرى.",
    engine: "قرأه مستخرج المعلومات على هذا الهاتف", ref: "الرقم المرجعي",
  },
};
const REPORTERS: Reporter[] = ["family", "self", "helper", "professional", "coordinator"];
const today = () => new Date().toISOString().slice(0, 10);

export function Intake({ lang: initialLang, followPid, staff, defaultReporter, onBack, onOpenCase }: {
  lang: Lang; followPid?: string | null; staff: boolean; defaultReporter?: Reporter; onBack: () => void; onOpenCase?: (id: string) => void;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = T[lang];
  const [reporter, setReporter] = useState<Reporter>(defaultReporter ?? (staff ? "professional" : "family"));
  const [text, setText] = useState("");
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [ok, setOk] = useState<Record<string, boolean>>({});
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Case | null>(null);
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [rec, setRec] = useState<"idle" | "rec" | "working">("idle");
  const [noMic, setNoMic] = useState(false);
  const recorder = useRef<Recorder | null>(null);
  const area = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let live = true;
    getBackend().then((b) => detectSpeech(b.base)).then((s) => live && setSpeech(s)).catch(() => {});
    return () => {
      live = false;
      void recorder.current?.stop();
    };
  }, []);

  // Read what was said as it changes (on the phone, no server needed), so the facts appear as the person speaks.
  const live = useMemo(() => (text.trim().length >= 12 ? getIntake().extract(text, getIntake().detectLang(text)) : null), [text]);

  const startMic = async () => {
    if (!speech || speech.engine === "typed") return setNoMic(true);
    const r = new Recorder();
    const before = text.trim() ? text.trim() + " " : "";
    const started = await r.start({ lang, speech, onText: (x) => setText(before + x) });
    if (!started) return setNoMic(true);
    recorder.current = r;
    setRec("rec");
  };
  const stopMic = async () => {
    if (!recorder.current) return;
    setRec("working");
    await recorder.current.stop(); // the recorder has already written what it heard into the box (onText)
    recorder.current = null;
    setRec("idle");
  };

  function focusText() {
    area.current?.focus();
  }
  function toggleMic() {
    if (rec === "rec") void stopMic();
    else if (rec === "idle") void startMic();
  }
  function useExample() {
    const list = EXAMPLES.filter((x) => x.lang === lang);
    const pool = list.length ? list : EXAMPLES;
    const e = pool[Math.floor(Math.random() * pool.length)];
    setText(e.text);
    setReporter(e.reporter);
    setResult(null);
  }

  const read = () => {
    if (text.trim().length < 3) return;
    setReading(true);
    window.setTimeout(() => {
      const r = getIntake().extract(text, getIntake().detectLang(text));
      const o: Record<string, boolean> = {};
      r.fields.forEach((f) => { if (f.kind !== "red_flag") o[`${f.kind}:${f.key}`] = !f.needs_confirmation; });
      if (r.onset) o.onset = true;
      r.timeline.forEach((_, i) => (o[`tl:${i}`] = true));
      setOk(o);
      setResult(r);
      setReading(false);
    }, 450);
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    setError(null);
    const body: ConcernIn = {
      reporter, lang: result.lang, narrative: text.trim(),
      domains: result.fields.filter((f) => f.kind === "domain" && ok[`domain:${f.key}`]).map((f) => f.key),
      onset: result.onset && ok.onset ? result.onset.value : null,
      timeline: result.timeline.filter((_, i) => ok[`tl:${i}`]).map((x) => [x.activity, x.who_took_over] as [string, string]),
      red_flags: result.fields.filter((f) => f.kind === "red_flag").map((f) => f.key),
      confounders: result.fields.filter((f) => f.kind === "confounder" && ok[`confounder:${f.key}`]).map((f) => f.key),
      date: today(),
    };
    try {
      const b = await getBackend();
      setDone(followPid ? await b.followUpConcern(followPid, body) : await b.raiseConcern(body));
    } catch {
      setError(t.failed);
    } finally {
      setSaving(false);
    }
  };

  const flags = (result ?? live)?.fields.filter((f) => f.kind === "red_flag") ?? [];
  const L = (d: Record<string, { en: string; ar: string }>, k: string, f?: string) => label(d, k, lang, f ?? k);
  const days = (lv: string) => (config.REVIEW_TARGET_DAYS?.[lv] as number | undefined) ?? 0;

  if (done) {
    const ev = done.latest;
    const level = ev?.level ?? "BASELINE";
    const ch = ev?.concern_change;
    // Urgent only when this report raised an urgent sign itself; a level carried from earlier is not news.
    const ownUrgent = level === "URGENT" && !ev?.carried;
    const follow = !!followPid && !!ch && !ch.first && !ownUrgent;
    const news = follow && ch ? [...ch.new_domains.map((d) => L(DOMAIN, d)), ...ch.new_activities.map((a) => L(ACTIVITY, a))] : [];
    const head = follow ? (news.length ? t.doneFollowNew : t.doneFollowSame)
      : ownUrgent ? t.doneUrgent : level === "CLINICIAN_REVIEW" ? t.doneReview(days("CLINICIAN_REVIEW")) : t.doneRoutine;
    return (
      <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="flex min-h-0 flex-1 flex-col">
        <TopBar title={followPid ? t.followTitle : t.newTitle} onBack={onBack} />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-28 pt-8">
          <div className="flex flex-col items-center text-center mb-step-in">
            <span className={cx("flex h-20 w-20 items-center justify-center rounded-full text-white shadow-[0_16px_34px_-14px_rgb(15_63_44/0.7)]", ownUrgent ? "bg-lv-urgent" : "bg-deep")}>
              {ownUrgent ? <AlertTriangle size={36} /> : <CheckCircle2 size={38} />}
            </span>
            <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-leaf">{t.ref} {done.participant.id}</p>
            <h2 className="mt-2 font-serif text-[26px] font-semibold leading-tight text-balance">{head}</h2>
            <div className="mt-3"><Pill level={level} lang={lang} /></div>
          </div>
          {news.length > 0 && (
            <Card className="mt-6 p-4">
              <p className="text-[13px] font-semibold text-lv-review">{t.newSince}</p>
              <ul className="mt-2 space-y-1.5 text-[14.5px]">{news.map((n) => <li key={n} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-lv-review" />{n}</li>)}</ul>
            </Card>
          )}
          {ownUrgent && (
            <a href="tel:998" className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-lv-urgent py-4 text-[16px] font-semibold text-white"><Phone size={18} /> {t.call}</a>
          )}
          <div className="mt-6 grid gap-2.5">
            {staff && onOpenCase && <button type="button" onClick={() => onOpenCase(done.participant.id)} className="rounded-2xl bg-deep py-4 text-[16px] font-semibold text-white active:bg-deep-hover">{t.open}</button>}
            <button type="button" onClick={onBack} className="rounded-2xl border border-line bg-white py-4 text-[16px] font-semibold active:bg-paper">{t.finish}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="flex min-h-0 flex-1 flex-col">
      <TopBar title={followPid ? t.followTitle : t.newTitle} sub={followPid ? `${followPid} · ${t.sub}` : t.sub} onBack={onBack}
        right={
          <div className="flex shrink-0 rounded-full bg-white p-0.5 ring-1 ring-line" role="group" aria-label="Language">
            {(["en", "ar"] as Lang[]).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} className={cx("rounded-full px-2.5 py-1 text-[12.5px] font-medium", lang === l ? "bg-deep text-white" : "text-muted")}>{l === "en" ? "EN" : "ع"}</button>
            ))}
          </div>
        } />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-32 pt-4">
        <p className="px-1 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-leaf">{t.who}</p>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {REPORTERS.map((r) => (
            <button key={r} type="button" onClick={() => setReporter(r)} className={cx("shrink-0 rounded-full px-3.5 py-2 text-[13.5px] font-medium", r === reporter ? "bg-deep text-white" : "bg-white text-body ring-1 ring-line")}>
              {REPORTER_LABEL[lang][r]}
            </button>
          ))}
        </div>

        <p className="mt-5 px-1 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-leaf">{t.say}</p>
        <div className="mt-2 grid grid-cols-3 gap-2.5">
          <Mode icon={rec === "rec" ? Square : Mic} title={t.voice} sub={rec === "working" ? t.working : rec === "rec" ? t.listening : t.voiceSub} on={rec !== "idle"} busy={rec === "working"} onClick={toggleMic} />
          <Mode icon={Keyboard} title={t.type} sub={t.typeSub} onClick={focusText} />
          <Mode icon={Wand2} title={t.example} sub={t.exampleSub} onClick={useExample} />
        </div>
        {noMic && <p className="mt-2 px-1 text-[13px] font-medium text-lv-review">{t.noMic}</p>}

        <Card className="mt-3 p-3.5">
          <textarea ref={area} value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} rows={5} dir="auto" placeholder={t.placeholder}
            className="w-full resize-none bg-transparent text-[16px] leading-[1.55] outline-none placeholder:text-[#9aa5a0]" />
          {live && !result && (
            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
              {live.fields.slice(0, 6).map((f) => (
                <span key={f.kind + f.key} className={cx("rounded-full px-2.5 py-1 text-[12px] font-medium", f.kind === "red_flag" ? "bg-lv-urgent-soft text-lv-urgent" : "bg-[#eef3ef] text-deep")}>
                  {f.kind === "domain" ? L(DOMAIN, f.key, f.label) : f.kind === "red_flag" ? L(RED_FLAG, f.key, f.label) : L(CONFOUNDER, f.key, f.label)}
                </span>
              ))}
              {live.onset && <span className="rounded-full bg-sand-soft px-2.5 py-1 text-[12px] font-medium text-[#6b4714]">{L(ONSET, live.onset.value, live.onset.label)}</span>}
            </div>
          )}
        </Card>

        {flags.length > 0 && (
          <div className="mt-3 rounded-[18px] border border-lv-urgent/25 bg-lv-urgent-soft p-4 mb-step-in">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-lv-urgent"><AlertTriangle size={17} /> {t.urgentTitle}</p>
            <ul className="mt-1.5 space-y-1 text-[14px] text-[#7a1f33]">{flags.map((f) => <li key={f.key}>• {L(RED_FLAG, f.key, f.label)}</li>)}</ul>
            <p className="mt-2 text-[13px] text-[#7a1f33]">{t.urgentBody}</p>
            <a href="tel:998" className="mt-3 inline-flex items-center gap-2 rounded-full bg-lv-urgent px-4 py-2 text-[14px] font-semibold text-white"><Phone size={15} /> {t.call}</a>
          </div>
        )}

        {result && (
          <Card className="mt-3 overflow-hidden mb-step-in">
            <div className="flex items-center gap-2 border-b border-line bg-[#f7faf7] px-4 py-3">
              <Sparkles size={16} className="text-leaf" />
              <p className="text-[14.5px] font-semibold">{t.picked}</p>
            </div>
            <div className="space-y-4 px-4 py-4">
              {!result.fields.some((f) => f.kind !== "red_flag") && !result.onset && !result.timeline.length && <p className="text-[14px] text-body">{t.none}</p>}
              {[["domain", t.changed], ["confounder", t.affect]].map(([kind, title]) => {
                const fs = result.fields.filter((f) => f.kind === kind);
                if (!fs.length) return null;
                return (
                  <div key={kind}>
                    <p className="text-[12.5px] font-semibold text-muted">{title}</p>
                    <div className="mt-1.5 space-y-1.5">
                      {fs.map((f) => {
                        const k = `${f.kind}:${f.key}`;
                        const ev = f.evidence.find((e) => e.trim());
                        return (
                          <button key={k} type="button" onClick={() => setOk((o) => ({ ...o, [k]: !o[k] }))} className={cx("flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-start", ok[k] ? "bg-[#eef4ef]" : "bg-paper opacity-70")}>
                            <span className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", ok[k] ? "border-deep bg-deep text-white" : "border-[#b9c4c2] bg-white")}>{ok[k] && <Check size={13} strokeWidth={3} />}</span>
                            <span className="min-w-0">
                              <span className="block text-[14.5px] font-medium">{kind === "domain" ? L(DOMAIN, f.key, f.label) : L(CONFOUNDER, f.key, f.label)}</span>
                              {ev && <span dir="auto" className="block truncate text-[12.5px] text-muted">«{ev}»</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {result.onset && (
                <div>
                  <p className="text-[12.5px] font-semibold text-muted">{t.started}</p>
                  <button type="button" onClick={() => setOk((o) => ({ ...o, onset: !o.onset }))} className={cx("mt-1.5 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start", ok.onset ? "bg-[#eef4ef]" : "bg-paper opacity-70")}>
                    <span className={cx("flex h-5 w-5 items-center justify-center rounded-md border", ok.onset ? "border-deep bg-deep text-white" : "border-[#b9c4c2] bg-white")}>{ok.onset && <Check size={13} strokeWidth={3} />}</span>
                    <span className="text-[14.5px] font-medium">{L(ONSET, result.onset.value, result.onset.label)}</span>
                  </button>
                </div>
              )}
              {result.timeline.length > 0 && (
                <div>
                  <p className="text-[12.5px] font-semibold text-muted">{t.whoNow}</p>
                  <div className="mt-1.5 space-y-1.5">
                    {result.timeline.map((x, i) => (
                      <button key={i} type="button" onClick={() => setOk((o) => ({ ...o, [`tl:${i}`]: !o[`tl:${i}`] }))} className={cx("flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start", ok[`tl:${i}`] ? "bg-[#eef4ef]" : "bg-paper opacity-70")}>
                        <span className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", ok[`tl:${i}`] ? "border-deep bg-deep text-white" : "border-[#b9c4c2] bg-white")}>{ok[`tl:${i}`] && <Check size={13} strokeWidth={3} />}</span>
                        <span className="text-[14.5px] font-medium">{L(ACTIVITY, x.activity, x.activity_label)} → {L(WHO, x.who_took_over, x.who_label)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[12px] text-muted">{t.tap} {t.engine}.</p>
            </div>
          </Card>
        )}
        {error && <p className="mt-3 rounded-xl bg-lv-urgent-soft px-4 py-3 text-[14px] text-lv-urgent">{error}</p>}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 backdrop-blur" style={{ paddingBottom: "max(var(--mb-sab), 14px)" }}>
        {!result ? (
          <button type="button" onClick={read} disabled={text.trim().length < 3 || reading || rec !== "idle"} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-deep py-4 text-[16px] font-semibold text-white disabled:bg-[#9fb3aa]">
            {reading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} {reading ? t.reading : t.read}
          </button>
        ) : (
          <button type="button" onClick={save} disabled={saving} className={cx("flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[16px] font-semibold text-white", flags.length ? "bg-lv-urgent" : "bg-deep")}>
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} {saving ? t.saving : t.save}
          </button>
        )}
      </div>
    </div>
  );
}

function Mode({ icon: I, title, sub, on = false, busy = false, onClick }: { icon: typeof Mic; title: string; sub: string; on?: boolean; busy?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cx("flex flex-col items-center rounded-[18px] border px-2 py-3.5 text-center transition-colors", on ? "border-lv-review bg-lv-review-soft" : "border-[#e3e6e1] bg-white active:bg-paper")}>
      <span className={cx("flex h-10 w-10 items-center justify-center rounded-full", on ? "bg-lv-review text-white mb-ring" : "bg-[#eef3ef] text-deep")}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : <I size={18} />}
      </span>
      <span className="mt-2 text-[13.5px] font-semibold">{title}</span>
      <span className="mt-0.5 line-clamp-1 text-[11.5px] text-muted">{sub}</span>
    </button>
  );
}
