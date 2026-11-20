"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUp, Building2, Check, CheckCircle2, Lock, Mail, MapPin, Mic, Navigation, Phone, RotateCcw, Send, ShieldAlert, Square, Stethoscope, Volume2 } from "lucide-react";
import { LogoMark, Mark } from "../Logo";
import { Narrative } from "../Narrative";
import { config, getEngine, getIntake, LEVEL_TONE, REPORTER_LABEL, type Evaluation, type IntakeResult, type Lang, type Reporter, type Span } from "@/lib/mb";
import { ACTIVITY, CONFOUNDER, DOMAIN, ONSET, RED_FLAG, WHO, label } from "@/lib/labels";
import { APP_HOME, appCaseHref, inApp } from "@/lib/app";
import { rememberClaim, useSession } from "@/lib/auth";
import { speak as speakAloud, stopSpeaking } from "@/lib/voice";
import { getBackend } from "@/lib/workspace/backend";
import { notifyWorkspaceSync } from "@/lib/workspace/sync";
import { NAV, UAE_AREAS, findNearbyHospitals, findNearestRegisteredHospital, isHospitalRegistered, distanceKm, type Service } from "@/lib/workspace/navigator";
import type { ConcernIn } from "@/lib/workspace/types";
import { COPY, EXAMPLES, REPORTERS, type Copy } from "./copy";

type Step = "who" | "describe" | "thinking" | "review" | "routing" | "outcome";

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
  // the server's voice when it has one (works in the Android app and in Chrome), else the device's
  void speakAloud(text, lang).finally(onEnd);
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

/* Physical and metabolic health factors in the person's words (blood pressure, sugar, cholesterol...). They are not
 * changes in memory or thinking, so the extractor does not list them; but they matter for brain health (criterion 3),
 * the clinician sees the words, and the person should hear that they were noted. Shown only, never scored. */
const HEALTH: { label: Record<Lang, string>; en: RegExp; ar: RegExp }[] = [
  { label: { en: "Blood pressure", ar: "ضغط الدم" }, en: /\b(blood pressure|bp|hypertension|hypertensive)\b/i, ar: /ضغط الدم|الضغط|ارتفاع الضغط/ },
  { label: { en: "Blood sugar / diabetes", ar: "السكر / السكري" }, en: /\b(blood sugar|sugar level|diabet\w*|glucose|hba1c)\b/i, ar: /السكري|السكر|سكر الدم/ },
  { label: { en: "Cholesterol", ar: "الكوليسترول" }, en: /\b(cholesterol|ldl)\b/i, ar: /الكوليسترول|الكولسترول|الدهون/ },
  { label: { en: "Heart", ar: "القلب" }, en: /\b(heart|cardiac|chest pain|palpitation\w*)\b/i, ar: /القلب|ألم في الصدر|خفقان/ },
  { label: { en: "Weight", ar: "الوزن" }, en: /\b(weight|obes\w*|overweight)\b/i, ar: /الوزن|السمنة/ },
  { label: { en: "Smoking", ar: "التدخين" }, en: /\b(smok\w*|cigarette\w*|shisha)\b/i, ar: /التدخين|يدخن|تدخن|شيشة/ },
];
const HEALTH_URGENT = { en: /\b(drastic\w*|sudden\w*|very high|severe\w*|spike\w*|dangerous\w*)\b/i, ar: /فجأة|مفاجئ|مرتفع جدا|مرتفع جدًا|شديد|خطير/ };

function healthFactors(text: string, lang: Lang): { found: string[]; urgent: boolean } {
  const found = HEALTH.filter((h) => h.en.test(text) || h.ar.test(text)).map((h) => h.label[lang]);
  return { found, urgent: found.length > 0 && (HEALTH_URGENT.en.test(text) || HEALTH_URGENT.ar.test(text)) };
}

const FREQ_LABEL: Record<Lang, Record<string, string>> = {
  en: { daily: "Every day or nearly every day", weekly: "Several times a week", sometimes: "Now and then", once: "Once so far" },
  ar: { daily: "كل يوم أو شبه يومي", weekly: "عدة مرات في الأسبوع", sometimes: "بين فترة وأخرى", once: "مرة واحدة حتى الآن" },
};
const SEV_LABEL: Record<Lang, Record<string, string>> = {
  en: { marked: "A lot, or much worse", mild: "A little" },
  ar: { marked: "كثيرًا، أو أسوأ بكثير", mild: "قليلًا" },
};

export function ConcernChat() {
  const params = useSearchParams();
  const [lang, setLang] = useState<Lang>(params.get("lang") === "ar" ? "ar" : "en");
  // ?for=<record>: a follow-up about someone already known, added to their record (signed in as them, or as staff).
  const forPid = params.get("for");
  // Opened from the mobile app: its links lead back to the app (known only in the browser, so set after mount).
  const [appMode, setAppMode] = useState(false);
  useEffect(() => setAppMode(inApp()), []); // eslint-disable-line react-hooks/set-state-in-effect
  const [saveError, setSaveError] = useState<string | null>(null);
  const t = COPY[lang];
  const [step, setStep] = useState<Step>("who");
  // On the MemBrain server what the person confirms is sent to the API, so the privacy wording must say so.
  // If the server also offers speech recognition (our Gulf Whisper, or Azure Speech in UAE North), dictation records
  // the answer and sends it there instead of using the browser's own recognition (Google's servers in Chrome).
  const [onServer, setOnServer] = useState(false);
  const [serverAsr, setServerAsr] = useState<string | null>(null);   // API base when server speech is available
  const [inUae, setInUae] = useState(false);   // the server itself says whether it runs in the UAE; default: don't claim it
  useEffect(() => {
    getBackend()
      .then(async (b) => {
        setOnServer(b.mode === "server");
        if (b.mode !== "server") return;
        setApiBase(b.base ?? "");
        const r = await fetch((b.base ?? "") + "/api/asr/config");
        const j = (await r.json()) as { enabled?: boolean; in_uae?: boolean };
        setInUae(j.in_uae === true);
        if (typeof window === "undefined" || !("MediaRecorder" in window)) return;
        if (j.enabled) setServerAsr(b.base ?? "");
      })
      .catch(() => setOnServer(false));
  }, []);
  const { session } = useSession();
  const [reporter, setReporter] = useState<Reporter | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]); // what the person sent, in order
  const [askedMore, setAskedMore] = useState(false);
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [apiBase, setApiBase] = useState<string | null>(null);   // the MemBrain server, when there is one
  const [ai, setAi] = useState<{ state: "idle" | "reading" | "done"; health: string[]; count: number }>({ state: "idle", health: [], count: 0 });
  const [ok, setOk] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState<Evaluation | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState("dxb-downtown");
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>({ lat: 25.1972, lon: 55.2744 });
  const [locating, setLocating] = useState(false);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("SVC-14");
  const [contactError, setContactError] = useState<string | null>(null);
  const currentArea = useMemo(() => {
    return UAE_AREAS.find((a) => a.id === selectedAreaId) ?? UAE_AREAS[0];
  }, [selectedAreaId]);

  const coords = userCoords ?? { lat: currentArea.lat, lon: currentArea.lon };

  const nearbyHospitals = useMemo(() => {
    return findNearbyHospitals(coords.lat, coords.lon);
  }, [coords.lat, coords.lon]);

  const registeredHospitals = useMemo(() => {
    return nearbyHospitals.filter((s) => s.isRegistered);
  }, [nearbyHospitals]);

  const comingSoonHospitals = useMemo(() => {
    return nearbyHospitals.filter((s) => !s.isRegistered);
  }, [nearbyHospitals]);

  const recommendedHospital = useMemo(() => {
    return registeredHospitals[0] ?? nearbyHospitals[0];
  }, [registeredHospitals, nearbyHospitals]);

  // Ensure selected hospital is strictly an active registered hospital with clinicians
  useEffect(() => {
    if (!isHospitalRegistered(selectedHospitalId)) {
      const best = registeredHospitals[0]?.id || "SVC-14";
      setSelectedHospitalId(best);
    }
  }, [selectedHospitalId, registeredHospitals]);

  const assignedHospital = useMemo(() => {
    const regList = NAV.directory.filter((s) => isHospitalRegistered(s.id));
    const found = regList.find((s: Service) => s.id === selectedHospitalId);
    return found ?? recommendedHospital ?? regList[0];
  }, [selectedHospitalId, recommendedHospital]);

  const detectLocation = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setUserCoords({ lat, lon });
        let closestArea = UAE_AREAS[0];
        let minDist = Infinity;
        for (const a of UAE_AREAS) {
          const d = distanceKm(lat, lon, a.lat, a.lon);
          if (d < minDist) {
            minDist = d;
            closestArea = a;
          }
        }
        setSelectedAreaId(closestArea.id);
        const bestReg = findNearestRegisteredHospital(lat, lon);
        if (bestReg) {
          setSelectedHospitalId(bestReg.id);
        }
      },
      () => setLocating(false),
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const handleAreaChange = (areaId: string) => {
    setSelectedAreaId(areaId);
    const area = UAE_AREAS.find((a) => a.id === areaId);
    if (area) {
      setUserCoords({ lat: area.lat, lon: area.lon });
      const bestReg = findNearestRegisteredHospital(area.lat, area.lon);
      if (bestReg) {
        setSelectedHospitalId(bestReg.id);
      }
    }
  };

  const submitWithRouting = () => {
    if (!assignedHospital || !isHospitalRegistered(assignedHospital.id)) {
      setContactError(t.selectRegisteredHospital);
      return;
    }
    if (!phone.trim()) {
      setContactError(t.phoneRequired);
      return;
    }
    if (email.trim() && !email.includes("@")) {
      setContactError(t.emailRequired);
      return;
    }
    setContactError(null);
    confirm();
  };

  const [listening, setListening] = useState(false);
  const [reading, setReading] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const mrRef = useRef<{ mr: MediaRecorder; stream: MediaStream; chunks: Blob[] } | null>(null);
  const [micNote, setMicNote] = useState<string | null>(null);   // why dictation produced nothing, shown under the box
  const vadRef = useRef<{ ctx: AudioContext; timer: number } | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const browserDictation = useMemo(() => getRecognition() !== null, []);
  const canDictate = serverAsr !== null || browserDictation;

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
    try { mrRef.current?.mr.stop(); mrRef.current?.stream.getTracks().forEach((tr) => tr.stop()); } catch { /* not recording */ }
    stopSpeaking();
  }, []);

  const switchLang = (l: Lang) => {
    stopListening();
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
      if (r.frequency) next.freq = true;
      if (r.severity) next.sev = true;
      r.timeline.forEach((_, i) => (next[`tl:${i}`] = true));
      setResult(r);
      setOk(next);
      setStep("review");
      setAi({ state: "idle", health: [], count: 0 });
      if (apiBase !== null && !r.fields.length && !r.timeline.length && !r.onset) void secondRead(joined, r);
    }, 1100);
  };

  // The rules found nothing: ask MedGemma to read the words a second time. Its suggestions must quote the person's words
  // (checked on the server) and are shown for the person to confirm; urgent ones are added, never taken away.
  async function secondRead(joined: string, r: IntakeResult) {
    setAi({ state: "reading", health: [], count: 0 });
    try {
      const res = await fetch(apiBase + "/api/intake/second-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: joined, lang: r.lang }),
      });
      const j = (await res.json()) as { items?: { kind: string; key: string; label: string; quote: string }[] };
      const items = j.items ?? [];
      const low = joined.toLowerCase();
      const fields = items
        .filter((it) => it.kind === "domain" || it.kind === "red_flag")
        .map((it) => {
          const at = low.indexOf(it.quote.toLowerCase());
          return { kind: it.kind as "domain" | "red_flag", key: it.key, label: it.label, confidence: 0.5, needs_confirmation: it.kind === "domain",
                   spans: at >= 0 ? ([[at, at + it.quote.length]] as Span[]) : [], evidence: [it.quote], ai: true };
        });
      if (fields.length) {
        setResult((cur) => (cur && cur === r ? { ...cur, fields: [...cur.fields, ...fields], urgent: cur.urgent || fields.some((f) => f.kind === "red_flag") } : cur));
        setOk((o) => ({ ...o, ...Object.fromEntries(fields.map((f) => [`${f.kind}:${f.key}`, f.kind === "red_flag"])) }));
      }
      setAi({ state: "done", health: items.filter((it) => it.kind === "health").map((it) => it.label), count: items.length });
    } catch {
      setAi({ state: "done", health: [], count: 0 });   // MedGemma unavailable: the conversation simply carries on
    }
  }

  const tryExample = (ex: (typeof EXAMPLES)[number]) => {
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
      date: new Date().toISOString().slice(0, 10),
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
    const body: ConcernIn = {
      reporter: reporter ?? "family",
      lang: narrativeLang,
      narrative,
      domains: result.fields.filter((f) => f.kind === "domain" && ok[`domain:${f.key}`]).map((f) => f.key),
      onset: result.onset && ok.onset ? result.onset.value : null,
      frequency: result.frequency && ok.freq ? result.frequency.value : null,
      severity: result.severity && ok.sev ? result.severity.value : null,
      timeline: result.timeline.filter((_, i) => ok[`tl:${i}`]).map((x) => [x.activity, x.who_took_over] as [string, string]),
      red_flags: flags,
      confounders: result.fields.filter((f) => f.kind === "confounder" && ok[`confounder:${f.key}`]).map((f) => f.key),
      date: session.date,
      channel: "app",
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      emirate: currentArea.emirate,
      area: currentArea.name[lang],
      hospital_id: assignedHospital?.id,
      hospital_name: assignedHospital?.name,
      latitude: coords.lat,
      longitude: coords.lon,
    };
    if (forPid) {
      setSaveError(null);
      setStep("thinking");
      const added = getBackend().then((b) => b.followUpConcern(forPid, body));
      Promise.all([added, new Promise((r) => window.setTimeout(r, 900))])
        .then(([c]) => {
          setCaseId(c.participant.id);
          notifyWorkspaceSync({ action: "followUpConcern", pid: c.participant.id });
          setOutcome(c.latest);
          setStep("outcome");
        })
        .catch((e: Error) => {
          setSaveError(/sign in/i.test(e.message) ? t.followSignIn : t.followFailed);
          setStep("review");
        });
      return;
    }
    const saved = getBackend()
      .then((b) => b.raiseConcern(body))
      .then((c) => {
        setCaseId(c.participant.id);
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem("membrain.recent_concern_id", c.participant.id);
            if (assignedHospital?.id) {
              window.sessionStorage.setItem("membrain.recent_concern_hospital_id", assignedHospital.id);
              window.sessionStorage.setItem("membrain.recent_concern_hospital_name", assignedHospital.name);
            }
          } catch {
            /* storage disabled */
          }
        }
        notifyWorkspaceSync({ action: "raiseConcern", pid: c.participant.id });
        const claim = (c as { claim_token?: string }).claim_token;
        if (claim) rememberClaim(c.participant.id, claim);
        return c.latest ?? ev;
      })
      .catch((err) => {
        console.error("Failed to save concern:", err);
        return ev;
      });
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
    setPhone("");
    setEmail("");
    setContactError(null);
  };

  function stopListening() {
    recRef.current?.stop();
    recRef.current = null;
    if (mrRef.current) {
      const { mr } = mrRef.current;
      try { mr.stop(); } catch { /* already stopped */ }
    }
    setListening(false);
  }

  // Record, then send once to the MemBrain server; the text is added to the draft. Nothing is stored.
  async function startServerDictation(base: string) {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    } catch {
      setMicNote(t.micBlocked);
      return;
    }
    setMicNote(null);
    const mime = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    const before = draft ? draft.trimEnd() + " " : "";
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = async () => {
      stopVad();
      stream.getTracks().forEach((tr) => tr.stop());
      mrRef.current = null;
      setListening(false);
      setTranscribing(true);
      try {
        const fd = new FormData();
        fd.append("audio", new Blob(chunks, { type: mr.mimeType || "audio/webm" }), "answer.webm");
        fd.append("lang", lang);
        const res = await fetch(base + "/api/asr/transcribe", { method: "POST", body: fd });
        if (res.ok) {
          const j = (await res.json()) as { text?: string };
          let txt = (j.text || "").trim();
          if (lang === "en") {
            txt = txt
              .split(/\s+/)
              .filter((w) => !/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(w))
              .join(" ")
              .trim();
          } else if (lang === "ar") {
            txt = txt
              .split(/\s+/)
              .filter((w) => !/[A-Za-z]/.test(w))
              .join(" ")
              .trim();
          }
          if (txt) setDraft(before + txt);
          else setMicNote(t.micNothing);
        } else {
          setMicNote(t.micFailed);
        }
      } catch {
        setMicNote(t.micFailed);   // typing still works
      } finally {
        setTranscribing(false);
        inputRef.current?.focus();
      }
    };
    mr.start(1000);
    mrRef.current = { mr, stream, chunks };
    setListening(true);
    startVad(stream);
  }

  // Stop by itself: about 1.8 s of quiet after speech, 8 s if nothing is said at all, and 60 s at most.
  function startVad(stream: MediaStream) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize);
      const t0 = performance.now();
      let heard = false;
      let lastLoud = t0;
      const timer = window.setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();
        if (rms > 0.02) { heard = true; lastLoud = now; }
        if ((heard && now - lastLoud > 1800) || (!heard && now - t0 > 8000) || now - t0 > 60000) stopListening();
      }, 100);
      vadRef.current = { ctx, timer };
    } catch {
      /* no auto-stop: the square still stops it */
    }
  }

  function stopVad() {
    if (!vadRef.current) return;
    window.clearInterval(vadRef.current.timer);
    void vadRef.current.ctx.close().catch(() => undefined);
    vadRef.current = null;
  }

  const toggleMic = () => {
    if (listening) return stopListening();
    if (serverAsr !== null) {
      void startServerDictation(serverAsr);
      return;
    }
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
      let clean = said.trim();
      if (lang === "en") {
        clean = clean
          .split(/\s+/)
          .filter((w) => !/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(w))
          .join(" ")
          .trim();
      }
      if (clean) setDraft(before + clean);
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
    stopSpeaking();
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
        ? `فهمت أنك لاحظت تغيّرًا في: ${doms.join("، ") || "أمر لم يتحدّد بعد"}. ${onset}. ${flags.length ? "وذكرت علامات قد تكون عاجلة، وسيطّلع عليها طبيب. " : ""}هل هذا صحيح؟`
        : `I heard that you have noticed changes in ${doms.join(", ") || "nothing specific yet"}${onset ? ". " + onset : ""}. ${flags.length ? "You also mentioned signs that may be urgent, so a clinician will look at them. " : ""}Is that right?`;
    setReading(true);
    speak(text, L, () => setReading(false));
  };

  const toggle = (key: string) => setOk((o) => ({ ...o, [key]: !o[key] }));

  /* ── Pieces of the conversation ── */

  const frozen = step === "outcome" || step === "routing" || (step === "thinking" && !!result);
  const redFlags = result?.fields.filter((f) => f.kind === "red_flag") ?? [];
  const domains = result?.fields.filter((f) => f.kind === "domain") ?? [];
  const confounders = result?.fields.filter((f) => f.kind === "confounder") ?? [];
  const nothingFound = result && !domains.some((f) => !f.ai) && !redFlags.some((f) => !f.ai) && !result.timeline.length && !result.onset;
  const health0 = result ? healthFactors(narrative, lang) : { found: [] as string[], urgent: false };
  const health = { ...health0, found: [...new Set([...health0.found, ...ai.health])] };

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
      <p>{nothingFound ? (health.found.length ? t.pickedHealth : t.pickedNone) : frozen ? t.pickedFrozen : t.picked}</p>
      {ai.state === "reading" && <p className="mt-2 animate-pulse text-[13.5px] text-lv-base">{t.aiReading}</p>}
      {ai.state === "done" && ai.count > 0 && (
        <p className="mt-2 rounded-lg bg-[#e8ebf4] px-3 py-2 text-[13.5px] leading-snug text-lv-base">{t.aiSuggested}</p>
      )}
      <div className="mt-3 rounded-xl bg-paper px-3.5 py-2.5">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">{t.yourWords}</p>
        <Narrative text={narrative} result={result} className="mt-1 text-ink" />
      </div>
      {health.found.length > 0 && (
        <div className="mt-3 rounded-xl border border-line bg-white px-3.5 py-2.5">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">{t.health}</p>
          <p className="mt-1 font-medium text-ink">{health.found.join(" · ")}</p>
          <p className="mt-1 text-[13px] leading-snug text-body">{t.healthNote}</p>
          {health.urgent && !redFlags.length && (
            <p className="mt-2 rounded-lg bg-lv-urgent-soft px-3 py-2 text-[13.5px] font-medium leading-snug text-lv-urgent">{t.healthUrgent}</p>
          )}
        </div>
      )}
      <div className="mt-3 space-y-2.5">
        {redFlags.length > 0 && (
          <Section title={t.urgent} tone="urgent">
            {redFlags.map((f) => (
              <FactRow key={f.key} t={t} locked checked tone="urgent" title={label(RED_FLAG, f.key, lang, f.label) + (f.ai ? ` · ${t.aiTag}` : "")} quote={f.evidence.join(" … ")} />
            ))}
            {!frozen && <p className="pb-1 text-[12.5px] text-muted">{t.urgentLocked}</p>}
          </Section>
        )}
        {domains.length > 0 && (
          <Section title={t.changed}>
            {domains
              .filter((f) => !frozen || ok[`domain:${f.key}`])
              .map((f) => (
                <FactRow key={f.key} t={t} locked={frozen} checked={!!ok[`domain:${f.key}`]} onToggle={() => toggle(`domain:${f.key}`)} title={label(DOMAIN, f.key, lang, f.label) + (f.ai ? ` · ${t.aiTag}` : "")} quote={f.evidence.join(" … ")} flag={f.needs_confirmation} />
              ))}
          </Section>
        )}
        {result.onset && (!frozen || ok.onset) && (
          <Section title={t.started}>
            <FactRow t={t} locked={frozen} checked={!!ok.onset} onToggle={() => toggle("onset")} title={label(ONSET, result.onset.value, lang, result.onset.label)} quote={narrative.slice(...result.onset.spans[0])} />
          </Section>
        )}
        {result.frequency && (!frozen || ok.freq) && (
          <Section title={t.often}>
            <FactRow t={t} locked={frozen} checked={!!ok.freq} onToggle={() => toggle("freq")} title={FREQ_LABEL[lang][result.frequency.value] ?? result.frequency.label} quote={narrative.slice(...result.frequency.spans[0])} />
          </Section>
        )}
        {result.severity && (!frozen || ok.sev) && (
          <Section title={t.much}>
            <FactRow t={t} locked={frozen} checked={!!ok.sev} onToggle={() => toggle("sev")} title={SEV_LABEL[lang][result.severity.value] ?? result.severity.label} quote={narrative.slice(...result.severity.spans[0])} />
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
    // A follow-up (?for=): say what it adds to the earlier report, from the engine's own comparison.
    const ch = outcome.concern_change;
    // The record's first concern reads as a new one; urgent wording only when this report raised an urgent sign itself.
    const follow = !!forPid && !!ch && !ch.first && !(outcome.level === "URGENT" && !outcome.carried);
    const spread = follow && !!ch && (ch.new_activities.length > 0 || ch.new_domains.some((d) => config.CONCERN_COGNITIVE_DOMAINS.includes(d)));
    const sep = lang === "ar" ? "، " : ", ";
    const newItems = ch
      ? [
          ...(ch.new_domains.length ? [t.newArea(ch.new_domains.map((d) => label(DOMAIN, d, lang, d)).join(sep))] : []),
          ...(ch.new_activities.length ? [t.newAct(ch.new_activities.map((a) => label(ACTIVITY, a, lang, a)).join(sep))] : []),
        ]
      : [];
    const head = follow
      ? spread ? t.followSpread(days("CLINICIAN_REVIEW")) : t.followAdded
      : outcome.level === "URGENT" ? t.urgentOutcome : outcome.level === "CLINICIAN_REVIEW" ? t.reviewOutcome(days("CLINICIAN_REVIEW")) : t.routineOutcome;
    const dChanged = result.fields.filter((f) => f.kind === "domain" && ok[`domain:${f.key}`]).map((f) => label(DOMAIN, f.key, lang, f.label));
    const dWho = result.timeline.filter((_, i) => ok[`tl:${i}`]).map((x) => `${label(ACTIVITY, x.activity, lang, x.activity_label)}: ${label(WHO, x.who_took_over, lang, x.who_label)}`);
    const rows: [string, string][] = [
      [t.assignedHospitalLabel, assignedHospital?.name || ""],
      [t.phoneLabel, phone.trim() || t.none],
      ...(email.trim() ? [[t.emailLabel, email.trim()]] as [string, string][] : []),
      [t.raisedBy, reporter === "self" ? t.selfSeen : REPORTER_LABEL[lang][reporter ?? "family"]],
      [t.changed, dChanged.join(lang === "ar" ? "، " : ", ") || t.none],
      [t.started, result.onset && ok.onset ? label(ONSET, result.onset.value, lang, result.onset.label) : t.none],
      [t.often, result.frequency && ok.freq ? FREQ_LABEL[lang][result.frequency.value] ?? result.frequency.label : t.none],
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
        {follow && (
          <>
            {newItems.length > 0 && ch?.since && (
              <>
                <p className="font-medium">{t.newSince(ch.since)}</p>
                <ul className="mt-2 space-y-1">
                  {newItems.map((r) => (
                    <li key={r} className="flex gap-2">
                      <span className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${spread ? "bg-lv-review" : "bg-leaf"}`} />
                      {r}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!spread && <p className={newItems.length ? "mt-2 text-body" : ""}>{t.followNothingNew}</p>}
            {spread && <p className="mt-2 text-body">{t.reviewOutcomeAfter}</p>}
          </>
        )}
        {!follow && outcome.level === "CLINICIAN_REVIEW" && (
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
        {!follow && outcome.level === "BASELINE" && <p>{t.routineOutcomeBody}</p>}

        <div className="mt-4 rounded-xl border border-leaf/30 bg-leaf/5 p-4">
          <div className="flex items-start gap-3">
            <Building2 size={22} className="mt-0.5 shrink-0 text-leaf" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-deep text-[15px]">
                  {assignedHospital?.name}
                </span>
                <span className="rounded-full bg-leaf/15 px-2.5 py-0.5 text-[12px] font-medium text-leaf">
                  {currentArea.name[lang]} · {currentArea.emirate}
                </span>
              </div>
              <p className="mt-1 text-[13.5px] leading-snug text-body">
                {assignedHospital?.notes ?? assignedHospital?.area}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-white px-3 py-2 text-[13px] border border-line">
                <span className="font-semibold text-deep flex items-center gap-1.5">
                  <Stethoscope size={14} className="text-leaf" />
                  {t.reviewCommitment}
                </span>
                {phone && (
                  <span className="text-muted flex items-center gap-1">
                    <Phone size={13} /> {phone}
                  </span>
                )}
                {email && (
                  <span className="text-muted flex items-center gap-1">
                    <Mail size={13} /> {email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

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

  const routingCard = (step === "routing" || (step === "outcome" && !outcome)) && (
    <BotRow wide>
      <div className="flex items-start gap-2.5">
        <Building2 size={20} className="mt-0.5 shrink-0 text-leaf" />
        <div>
          <p className="font-semibold text-deep text-[16px]">{t.routingTitle}</p>
          <p className="mt-0.5 text-[14px] leading-snug text-muted">{t.routingSubtitle}</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {/* Location & Area picker */}
        <div className="rounded-xl border border-line bg-mist p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="area-select" className="text-[13px] font-semibold text-deep flex items-center gap-1.5">
              <MapPin size={15} className="text-leaf" /> {t.selectArea}
            </label>
            <button
              type="button"
              onClick={detectLocation}
              disabled={locating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-line px-2.5 py-1 text-[12.5px] font-medium text-deep hover:bg-paper transition-colors disabled:opacity-60 shadow-sm"
            >
              <Navigation size={13} className={locating ? "animate-spin text-leaf" : "text-leaf"} />
              {locating ? t.detectingLocation : t.detectLocation}
            </button>
          </div>

          <select
            id="area-select"
            value={selectedAreaId}
            onChange={(e) => handleAreaChange(e.target.value)}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14.5px] font-medium text-ink focus:border-leaf focus:outline-none"
          >
            {UAE_AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name[lang]} ({a.emirate})
              </option>
            ))}
          </select>
        </div>

        {/* Recommended & Selectable Hospitals */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-semibold text-deep flex items-center gap-1.5">
              <Building2 size={15} className="text-leaf" /> {t.availableHospitalsTitle}
            </label>
            <span className="text-[11.5px] font-medium text-leaf">{t.registeredOnlyNotice}</span>
          </div>

          <div className="space-y-2">
            {registeredHospitals.map((s) => {
              const isSelected = selectedHospitalId === s.id;
              const isRecommended = s.id === recommendedHospital?.id;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setSelectedHospitalId(s.id)}
                  className={`w-full text-start rounded-xl border p-3 transition-all ${
                    isSelected
                      ? "border-deep bg-deep/5 shadow-sm ring-2 ring-deep"
                      : "border-line bg-white hover:border-leaf/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[14.5px] text-ink">
                          {s.name}
                        </span>
                        {isRecommended && (
                          <span className="rounded bg-leaf/15 px-2 py-0.5 text-[11px] font-semibold text-leaf">
                            {t.nearestHospital}
                          </span>
                        )}
                        <span className="rounded bg-mist px-2 py-0.5 text-[10.5px] font-medium text-deep">
                          {t.activeDoctors}
                        </span>
                        <span className="text-[12px] font-medium text-muted">
                          {t.distanceAway(s.distanceKm)}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-muted line-clamp-1">
                        {s.notes ?? s.area} · {s.emirate}
                      </p>
                    </div>
                    <span
                      className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        isSelected ? "border-deep bg-deep text-white" : "border-line bg-white"
                      }`}
                    >
                      {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Coming Soon Hospitals */}
          {comingSoonHospitals.length > 0 && (
            <div className="pt-2 space-y-2">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                {t.comingSoonHospitalsTitle}
              </p>
              <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                {comingSoonHospitals.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-dashed border-line bg-paper/50 p-2.5 opacity-60 cursor-not-allowed select-none pointer-events-none"
                    aria-disabled="true"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-[13.5px] text-muted line-clamp-1">
                            {s.name}
                          </span>
                          <span className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                            {t.comingSoon}
                          </span>
                          <span className="text-[11.5px] text-muted">
                            {t.distanceAway(s.distanceKm)}
                          </span>
                        </div>
                        <p className="text-[12px] text-muted line-clamp-1">
                          {s.notes ?? s.area} · {s.emirate} — {t.comingSoonDesc}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Contact details */}
        <div className="rounded-xl border border-line bg-white p-3.5 space-y-3">
          <div>
            <p className="text-[14px] font-semibold text-deep">{t.contactTitle}</p>
            <p className="text-[12.5px] text-muted">{t.contactSubtitle}</p>
          </div>

          {contactError && (
            <p role="alert" className="rounded-lg bg-lv-urgent-soft px-3 py-2 text-[13px] text-lv-urgent">
              {contactError}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="user-phone" className="block text-[12.5px] font-medium text-body mb-1">
                {t.phoneLabel} <span className="text-lv-urgent">*</span>
              </label>
              <input
                id="user-phone"
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (contactError) setContactError(null);
                }}
                placeholder={t.phonePlaceholder}
                className="w-full rounded-lg border border-line px-3 py-2 text-[14px] outline-none focus:border-leaf"
              />
            </div>

            <div>
              <label htmlFor="user-email" className="block text-[12.5px] font-medium text-body mb-1">
                {t.emailLabel}
              </label>
              <input
                id="user-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (contactError) setContactError(null);
                }}
                placeholder={t.emailPlaceholder}
                className="w-full rounded-lg border border-line px-3 py-2 text-[14px] outline-none focus:border-leaf"
              />
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-[12px] text-muted">
            <Lock size={12} className="shrink-0 text-leaf" /> {t.contactAssurance}
          </p>
        </div>
      </div>
    </BotRow>
  );

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
            {EXAMPLES.filter((ex) => ex.lang === lang).map((ex, i) => (
              <button key={i} type="button" onClick={() => tryExample(ex)} className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-body transition-colors hover:border-leaf hover:text-deep">
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
            onChange={(e) => { setDraft(e.target.value); if (micNote) setMicNote(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={Math.min(5, Math.max(1, draft.split("\n").length + Math.floor(draft.length / 48)))}
            placeholder={transcribing ? t.transcribing : listening ? t.listening : t.placeholder}
            dir="auto"
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-[16px] leading-[1.45] outline-none placeholder:text-muted"
          />
          <button type="submit" aria-label={t.send} disabled={draft.trim().length < 3 || transcribing} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-deep text-white transition-colors hover:bg-deep-hover disabled:bg-mist-strong disabled:text-muted">
            <ArrowUp size={20} />
          </button>
        </form>
        {micNote && (
          <p role="status" className="mt-2 px-1 text-[13px] font-medium text-lv-review">{micNote}</p>
        )}
        <p className="mt-2 flex items-center gap-1.5 px-1 text-[12px] text-muted">
          <Lock size={12} className="shrink-0" /> <span>{onServer ? (inUae ? t.disclaimerServer : t.disclaimerServerAbroad) : t.disclaimer}{serverAsr !== null ? " " + (inUae ? t.voiceNoteServer : t.voiceNoteServerAbroad) : canDictate ? " " + t.voiceNote : ""}</span>
        </p>
      </div>
    );
  } else if (step === "review") {
    composer = (
      <div className="flex flex-wrap gap-2">
        {saveError && (
          <p role="alert" className="w-full rounded-xl bg-lv-urgent-soft px-4 py-3 text-[14.5px] text-lv-urgent">
            {saveError}{" "}
            {saveError === t.followSignIn && (
              <Link href={`/signin/?next=${encodeURIComponent(`/concern/?for=${forPid}&lang=${lang}`)}`} className="font-semibold underline">
                {lang === "ar" ? "تسجيل الدخول" : "Sign in"}
              </Link>
            )}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            stopReading();
            setStep("routing");
          }}
          className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-deep px-5 py-3.5 text-[15px] font-medium text-white hover:bg-deep-hover sm:flex-none shadow-sm"
        >
          <Navigation size={18} /> {t.nextRouting}
        </button>
        <button type="button" onClick={readBack} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-4 py-3.5 text-[15px] font-medium hover:bg-mist">
          {reading ? <Square size={15} fill="currentColor" /> : <Volume2 size={18} />} {reading ? t.stopReading : t.readBack}
        </button>
        <button type="button" onClick={addMore} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-4 py-3.5 text-[15px] font-medium hover:bg-mist">
          {t.addMore}
        </button>
      </div>
    );
  } else if (step === "routing") {
    composer = (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submitWithRouting}
          className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-deep px-5 py-3.5 text-[15px] font-medium text-white hover:bg-deep-hover sm:flex-none shadow-sm"
        >
          <Check size={18} /> {t.submitRouting}
        </button>
        <button
          type="button"
          onClick={() => setStep("review")}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-4 py-3.5 text-[15px] font-medium hover:bg-mist"
        >
          <ArrowLeft size={16} className="rtl:-scale-x-100" /> {t.backReview}
        </button>
      </div>
    );
  } else if (step === "outcome") {
    const targetPid = caseId || (typeof window !== "undefined" ? window.sessionStorage.getItem("membrain.recent_concern_id") : null);
    const checkinHref = targetPid ? `/checkin/?id=${encodeURIComponent(targetPid)}&lang=${lang}` : `/checkin/?lang=${lang}`;

    composer = (
      <div className="flex flex-wrap gap-2">
        <Link
          href={checkinHref}
          className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-deep px-5 py-3.5 text-[15px] font-medium text-white hover:bg-deep-hover sm:flex-none shadow-sm"
        >
          <CheckCircle2 size={18} /> {t.checkin}
        </Link>
        <button
          type="button"
          onClick={restart}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white px-4 py-3.5 text-[15px] font-medium hover:bg-mist"
        >
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
          <Link href={appMode ? APP_HOME : lang === "ar" ? "/ar/" : "/"} aria-label={t.home} className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-mist">
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
            {(onServer ? [...t.aside.slice(0, 4), inUae ? t.privacyServer : t.privacyServerAbroad] : t.aside).map((a, i) => (
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
              {forPid && (
                <div className="mx-auto mb-3 flex max-w-[640px] items-start gap-2.5 rounded-2xl border border-leaf/25 bg-mist px-4 py-3 text-[14.5px] leading-snug text-deep">
                  <RotateCcw size={16} className="mt-0.5 shrink-0" /> {t.followBanner(forPid)}
                </div>
              )}
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
              {routingCard}
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
