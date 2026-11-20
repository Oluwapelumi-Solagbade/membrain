// Speech for the check-in: instructions read aloud, and the person's answers heard and turned into text.
// Recognition uses the best engine this server offers: MemBrain's own Gulf Arabic Whisper (self-hosted), Azure AI
// Speech in UAE North, then the browser's own recognition. Without any of them, answers are typed.
// The level meter, audio quality and voice features are worked out here, on the device; audio is never kept.
// The check-in's recorder (first written for the earlier prototype).
import type { Lang } from "./mb";
import { asset } from "@/lib/asset";
import { getBackend } from "@/lib/workspace/backend";

export type Engine = "local" | "azure" | "browser" | "typed";
export type Speech = {
  engine: Engine;
  label: string;
  base: string | null;
  region?: string;
  locales?: Record<string, string>;
  inUae?: boolean;
  key?: string;
};

export const DEFAULT_AZURE_LOCALES: Record<string, string> = {
  Emirati: "ar-AE",
  "Other Gulf": "ar-SA",
  Egyptian: "ar-EG",
  Levantine: "ar-LB",
  "Other Arabic": "ar-AE",
  English: "en-GB",
};

export function getDirectAzureKey(): { key: string; region: string } | null {
  // A key typed by this clinician on this device only (Settings). Never from the URL (keys in links leak into
  // history and logs) and never built into the public site (anyone could read it): the server's token broker
  // (/api/speech/token, key kept in the Space's secrets) is the normal way to use Azure.
  if (typeof window === "undefined") return null;
  try {
    const lsKey = window.localStorage.getItem("membrain.azure_speech_key");
    const lsRegion = window.localStorage.getItem("membrain.azure_speech_region") || "uaenorth";
    if (lsKey) return { key: lsKey, region: lsRegion };
  } catch {
    /* ignore */
  }
  return null;
}

export function setDirectAzureKey(key: string, region = "uaenorth"): void {
  if (typeof window === "undefined") return;
  if (!key.trim()) {
    window.localStorage.removeItem("membrain.azure_speech_key");
    window.localStorage.removeItem("membrain.azure_speech_region");
  } else {
    window.localStorage.setItem("membrain.azure_speech_key", key.trim());
    window.localStorage.setItem("membrain.azure_speech_region", region.trim() || "uaenorth");
  }
}

export type Audio = { snr_db: number; clipping: number; speech_ratio: number; duration_s: number };
export type VoiceFeatures = { speech_rate_wpm: number; pause_count: number; mean_pause_s: number; type_token_ratio: number; word_count: number };
export type Recording = { text: string; engine: string; locale: string | null; audio: Audio; features: VoiceFeatures };

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyWin = Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any; SpeechSDK?: any; webkitAudioContext?: any };
const win = () => window as AnyWin;
const SDK_URL = asset("/vendor/speech-sdk-1.53.0.min.js"); // Microsoft's Speech SDK (MIT), vendored with the site

export const LABEL: Record<Engine, string> = {
  local: "MemBrain Gulf Whisper (self-hosted, in-country)",
  azure: "Azure AI Speech, UAE North (in-country)",
  browser: "Browser speech recognition (not dialect-tuned)",
  typed: "Typed answers (no speech recognition here)",
};

async function getJson<T>(url: string, ms = 3000): Promise<T | null> {
  try {
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), ms);
    const r = await fetch(url, { signal: ctl.signal });
    window.clearTimeout(t);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    if (win().SpeechSDK) return res();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error("script"));
    document.head.appendChild(s);
  });
}

/* Azure Speech tokens from the server's broker last ten minutes. Fetching one takes a second or two, so one is kept
 * (and fetched ahead, as soon as the engine is known) instead of being asked for each time the microphone opens. */
let azToken: { base: string; at: number; p: Promise<{ token: string; region: string } | null> } | null = null;
function azureToken(base: string): Promise<{ token: string; region: string } | null> {
  if (azToken && azToken.base === base && Date.now() - azToken.at < 8 * 60_000) return azToken.p;
  const p = getJson<{ token: string; region: string }>(base + "/api/speech/token", 8000);
  azToken = { base, at: Date.now(), p };
  void p.then((t) => { if (!t && azToken?.p === p) azToken = null; }); // a failed fetch is tried again next time
  return p;
}

/** Which recognition engine to use. `base` is the MemBrain API ("" on the same origin), or null with no server. */
export async function detectSpeech(base: string | null): Promise<Speech> {
  const s = await pickSpeech(base);
  if (s.engine === "azure" && !s.key && s.base !== null) void azureToken(s.base);
  return s;
}

async function pickSpeech(base: string | null): Promise<Speech> {
  const browser = !!(win().SpeechRecognition || win().webkitSpeechRecognition);
  let s: Speech = { engine: browser ? "browser" : "typed", label: LABEL[browser ? "browser" : "typed"], base };

  const ask = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("asr") : null;
  if (ask === "browser") return s;

  // 1. Direct Azure key (via env var, URL parameter, or saved in browser localStorage)
  const direct = getDirectAzureKey();
  if (direct?.key && ask !== "local") {
    try {
      await loadScript(SDK_URL);
      s = {
        engine: "azure",
        label: LABEL.azure,
        base,
        region: direct.region,
        key: direct.key,
        locales: DEFAULT_AZURE_LOCALES,
      };
      return s;
    } catch {
      /* SDK did not load */
    }
  }

  // 2. Server-brokered Azure Speech or local model via backend API
  if (base !== null) {
    const cfg = await getJson<{ enabled: boolean; region: string; locales: Record<string, string> }>(base + "/api/speech/config");
    if (cfg?.enabled && ask !== "local") {
      try {
        await loadScript(SDK_URL);
        s = { engine: "azure", label: LABEL.azure, base, region: cfg.region, locales: cfg.locales };
        return s;
      } catch {
        /* SDK did not load: keep the fallback */
      }
    }
    const asr = await getJson<{ enabled: boolean; prefer: boolean; label?: string; in_uae?: boolean; engine?: string }>(base + "/api/asr/config");
    if (asr?.enabled && ask !== "azure" && typeof MediaRecorder !== "undefined") {
      // Only switch to self-hosted Whisper if Azure is not configured, or if specifically requested with ?asr=local
      if (ask === "local" || (!cfg?.enabled && asr.prefer)) {
        const where = asr.in_uae ? "self-hosted, in-country" : "self-hosted";
        s = { engine: "local", label: asr.label ? `${asr.label.replace(/\s*\(in-country\)$/, "")} (${where})` : LABEL.local, base, locales: cfg?.locales, inUae: asr.in_uae === true };
        return s;
      }
    }
  }
  return s;
}

/* ── Speaking ── */

let voices: SpeechSynthesisVoice[] = [];
function loadVoices() {
  try {
    voices = speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => (voices = speechSynthesis.getVoices());
  } catch {
    /* no speech synthesis */
  }
}
if (typeof window !== "undefined") loadVoices();

/* Server voices (api/tts.py): the Android app's WebView has no speech at all and Chrome often has no Arabic voice,
 * so instructions are spoken by the MemBrain server when it offers it, and by the device otherwise. */
let ttsBase: string | null | undefined;
let ttsOn: Promise<boolean> | null = null;
let playing: HTMLAudioElement | null = null;
let playingDone: (() => void) | null = null;

async function serverVoice(): Promise<boolean> {
  if (ttsBase === undefined) {
    try {
      const b = await getBackend();
      ttsBase = b.mode === "server" ? b.base ?? "" : null;
    } catch {
      ttsBase = null;
    }
  }
  if (ttsBase === null) return false;
  ttsOn ??= getJson<{ enabled: boolean }>(ttsBase + "/api/speech/tts/config").then((c) => !!c?.enabled);
  return ttsOn;
}

/* Server audio is fetched once per sentence and kept for the visit, so a sentence said again, or one fetched ahead
 * (the word list, the story, the next instruction: see `preloadSpeech`), starts at once instead of after the
 * second or two the server takes to make it. Words of a list then come at an even pace. */
const clips = new Map<string, Promise<string | null>>();
const clipKey = (text: string, lang: Lang, slow: boolean) => `${lang}|${slow ? 1 : 0}|${text}`;
function clip(text: string, lang: Lang, slow: boolean): Promise<string | null> {
  const k = clipKey(text, lang, slow);
  let p = clips.get(k);
  if (!p) {
    const q = new URLSearchParams({ text, lang, ...(slow ? { slow: "true" } : {}) });
    p = (async () => {
      const ctl = new AbortController();
      const t = window.setTimeout(() => ctl.abort(), 20000);
      try {
        const r = await fetch(`${ttsBase}/api/speech/tts?${q}`, { signal: ctl.signal });
        const b = r.ok ? await r.blob() : null;
        return b && b.size > 0 ? URL.createObjectURL(b) : null;
      } catch {
        return null;
      } finally {
        window.clearTimeout(t);
      }
    })();
    clips.set(k, p);
    void p.then((u) => { if (!u && clips.get(k) === p) clips.delete(k); }); // a failure is tried again next time
  }
  return p;
}

/** Fetches the server's audio for these sentences ahead of time, a couple at a time, in the order given. */
export async function preloadSpeech(texts: string[], lang: Lang, slow = false): Promise<void> {
  if (!(await serverVoice())) return;
  const todo = [...new Set(texts.filter(Boolean))];
  const worker = async () => {
    for (let t = todo.shift(); t !== undefined; t = todo.shift()) await clip(t, lang, slow);
  };
  await Promise.all([worker(), worker()]);
}

/** Whether this device can speak by itself (Android's WebView cannot). */
const deviceVoice = () => typeof window !== "undefined" && "speechSynthesis" in window;

function playServer(text: string, lang: Lang, slow: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const a = new Audio();
    let started = false;
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (playing === a) { playing = null; playingDone = null; }
      resolve(ok);
    };
    playing = a;
    playingDone = () => finish(true);
    a.onplaying = () => { started = true; };
    a.onended = () => finish(true);
    a.onerror = () => finish(started);
    // The first Arabic sentence can take a few seconds while the server voice wakes up; past this, the device speaks.
    // A device with no voice of its own (the Android app) waits longer: the server is then the only voice there is.
    window.setTimeout(() => { if (!started) { a.pause(); a.removeAttribute("src"); finish(false); } }, deviceVoice() ? 9000 : 25000);
    void clip(text, lang, slow).then((url) => {
      if (settled) return; // stopped, or given up, while it was being fetched
      if (!url) return finish(false);
      a.src = url;
      a.play().catch(() => finish(false)); // autoplay refused: the device voice takes over
    });
  });
}

export function stopSpeaking() {
  try {
    speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
  if (playing) {
    playing.pause();
    const done = playingDone;
    playing = null;
    playingDone = null;
    done?.();
  }
}

/** In Arabic mode only Arabic words count: a recogniser sometimes writes a word it mis-heard in English letters
 *  ("Call lemon"). Words containing Latin letters are dropped from what was heard; what the person types is untouched. */
export function arabicOnly(text: string): string {
  return text
    .split(/\s+/)
    .filter((w) => w && !/[A-Za-z]/.test(w))
    .join(" ")
    .replace(/\s+([.,،؛؟?!:])/g, "$1")
    .trim();
}

/** In English mode only English/Latin words count: an Arabic recogniser (or server model fine-tune) must never
 *  write Arabic script into an English exercise or concern text box. */
export function englishOnly(text: string): string {
  return text
    .split(/\s+/)
    .filter((w) => w && !/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(w))
    .join(" ")
    .replace(/\s+([.,;:?!])/g, "$1")
    .trim();
}

/** Says the text; resolves when it has finished. Resolves `false` when the device plainly could not say it
 * (no voice for the language, or speech blocked), so the screen can show the text instead. */
export async function speak(text: string, lang: Lang, slow = false): Promise<boolean> {
  stopSpeaking();
  if (await serverVoice()) {
    if (await playServer(text, lang, slow)) return true;
  }
  return speakOnDevice(text, lang, slow);
}

function speakOnDevice(text: string, lang: Lang, slow = false): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const t0 = performance.now();
    const end = () => {
      if (!done) {
        done = true;
        resolve(performance.now() - t0 > Math.max(150, text.length * 25));
      }
    };
    try {
      speechSynthesis.cancel();
      if (!voices.length) voices = speechSynthesis.getVoices();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === "ar" ? "ar-AE" : "en-GB";
      u.rate = slow ? 0.7 : 0.92;
      const pick = (p: string) => voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(p));
      const v = lang === "ar" ? pick("ar-ae") ?? pick("ar-sa") ?? pick("ar") : pick("en-gb") ?? pick("en");
      if (v) u.voice = v;
      u.onend = end;
      u.onerror = end;
      // Some browsers never fire onend: give up after a generous estimate of the reading time.
      window.setTimeout(end, 1500 + text.length * (slow ? 130 : 90));
      window.setTimeout(() => speechSynthesis.speak(u), 40);
    } catch {
      window.setTimeout(end, 400);
    }
  });
}

/* ── Listening ── */

export class Recorder {
  active = false;
  text = "";
  engine: string = "none";
  private finalText = "";
  private frames: number[] = [];
  private t0 = 0;
  private clip = 0;
  private samples = 0;
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private src: MediaStreamAudioSourceNode | null = null;
  private iv: number | null = null;
  private sr: any = null;
  private az: any = null;
  private push: any = null;
  private proc: ScriptProcessorNode | null = null;
  private mr: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private lang: Lang = "en";
  private locale: string | null = null;
  private speech: Speech | null = null;
  private onText: ((t: string) => void) | null = null;

  /** Opens the microphone. Returns false when there is none or permission is refused. */
  async start(o: { lang: Lang; speech: Speech; dialect?: string | null; onText?: (t: string) => void; onLevel?: (v: number) => void; transcribe?: boolean }) {
    this.text = this.finalText = "";
    this.frames = [];
    this.t0 = performance.now();
    this.clip = this.samples = 0;
    this.engine = "none";
    this.lang = o.lang;
    this.speech = o.speech;
    this.onText = o.onText ?? null;
    stopSpeaking();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      const Ctx = window.AudioContext ?? win().webkitAudioContext;
      this.ctx = new Ctx({ sampleRate: 16000 }) as AudioContext;
      // A context made outside a tap can start suspended (autoplay rules): it would hear nothing at all.
      if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
      this.src = this.ctx.createMediaStreamSource(this.stream);
      const an = this.ctx.createAnalyser();
      an.fftSize = 1024;
      this.src.connect(an);
      const buf = new Float32Array(an.fftSize);
      this.iv = window.setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let s = 0;
        for (const x of buf) {
          s += x * x;
          if (Math.abs(x) > 0.99) this.clip++;
          this.samples++;
        }
        const db = 10 * Math.log10(s / buf.length + 1e-10);
        this.frames.push(db);
        o.onLevel?.(Math.max(0, Math.min(1, (db + 60) / 50)));
      }, 50);
    } catch {
      this.release();
      return false;
    }
    this.active = true;
    if (o.transcribe === false) return true;

    const emit = (interim = "") => {
      this.text = this.keep((this.finalText + " " + interim).trim());
      this.onText?.(this.text);
    };
    const sp = o.speech;
    // The dialect picks the Arabic variety; a person whose profile says "English" but who answers in Arabic is heard
    // as Arabic (Emirati), not with the English recogniser.
    const dialectLocale = (o.dialect && sp.locales?.[o.dialect]) || "";
    this.locale = o.lang === "ar" ? (dialectLocale.startsWith("ar") ? dialectLocale : "ar-AE") : "en-GB";

    if (sp.engine === "local" && sp.base !== null) {
      try {
        const mime = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
        this.mr = new MediaRecorder(this.stream!, mime ? { mimeType: mime } : {});
        this.chunks = [];
        this.mr.ondataavailable = (e) => e.data?.size && this.chunks.push(e.data);
        this.mr.start(1000);
        this.engine = "local";
        return true;
      } catch {
        this.mr = null;
      }
    }
    if (sp.engine === "azure" && (sp.key || sp.base !== null) && win().SpeechSDK) {
      try {
        const sdk = win().SpeechSDK;
        // Capture starts now, before the connection to Azure is ready: the push stream holds the audio until the
        // recogniser reads it, so the first words of an answer (said as soon as the button is tapped) are not lost.
        this.push = sdk.AudioInputStream.createPushStream();
        // Feed the same microphone audio to Azure as 16 kHz 16-bit PCM.
        this.proc = this.ctx!.createScriptProcessor(4096, 1, 1);
        this.proc.onaudioprocess = (e) => {
          if (!this.active || !this.push) return;
          const f = e.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(f.length);
          for (let i = 0; i < f.length; i++) {
            const s = Math.max(-1, Math.min(1, f[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          this.push.write(pcm.buffer);
        };
        this.src!.connect(this.proc);
        this.proc.connect(this.ctx!.destination);
        let cfg;
        if (sp.key) {
          cfg = sdk.SpeechConfig.fromSubscription(sp.key, sp.region || "uaenorth");
        } else if (sp.base !== null) {
          const tok = await azureToken(sp.base);
          if (!tok) throw new Error("token");
          cfg = sdk.SpeechConfig.fromAuthorizationToken(tok.token, tok.region);
        } else {
          throw new Error("No speech key or token available");
        }
        if (!this.active || !this.push) return true; // stopped while connecting
        cfg.speechRecognitionLanguage = this.locale;
        this.az = new sdk.SpeechRecognizer(cfg, sdk.AudioConfig.fromStreamInput(this.push));
        this.az.recognizing = (_: unknown, e: any) => e.result?.text && emit(e.result.text);
        this.az.recognized = (_: unknown, e: any) => {
          if (e.result?.reason === sdk.ResultReason.RecognizedSpeech && e.result.text) {
            this.finalText = (this.finalText + " " + e.result.text).trim();
            emit();
          }
        };
        this.az.canceled = (_: unknown, e: any) => {
          if (e && e.errorDetails) {
            console.warn("Azure Speech SDK error:", e.errorDetails);
          }
          if (this.active && this.az) {
            try {
              this.az.close();
            } catch {
              /* ignore */
            }
            this.az = null;
            this.browser(o.lang);
          }
        };
        await new Promise((res, rej) => this.az.startContinuousRecognitionAsync(res, rej));
        this.engine = "azure";
        return true;
      } catch (err) {
        console.warn("Azure Speech init failed, falling back to browser:", err);
        this.az = null;
        try {
          this.proc?.disconnect();
          this.push?.close();
        } catch {
          /* ignore */
        }
        this.proc = null;
        this.push = null;
      }
    }
    this.browser(o.lang);
    return true;
  }

  private keep(text: string): string {
    return this.lang === "ar" ? arabicOnly(text) : englishOnly(text);
  }

  private browser(lang: Lang) {
    const SR = win().SpeechRecognition ?? win().webkitSpeechRecognition;
    if (!SR) return;
    try {
      this.sr = new SR();
      this.sr.lang = lang === "ar" ? "ar-AE" : "en-GB";
      this.sr.continuous = true;
      this.sr.interimResults = true;
      this.sr.onresult = (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
        let f = "";
        for (let i = 0; i < ev.results.length; i++) f += ev.results[i][0].transcript + " ";
        this.text = this.keep(f.trim());
        this.onText?.(this.text);
      };
      this.sr.onerror = () => {};
      this.sr.start();
      this.engine = "browser";
    } catch {
      this.sr = null;
    }
  }

  private release() {
    if (this.iv) window.clearInterval(this.iv);
    this.iv = null;
    try {
      this.stream?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    try {
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.stream = null;
    this.ctx = null;
  }

  /** The room's background level in dBFS, from what was heard so far (used by the quiet-room check). */
  median(): number {
    const f = [...this.frames].sort((a, b) => a - b);
    return f.length ? f[Math.floor(f.length / 2)] : -60;
  }

  /** Stops listening and works out the audio quality and voice features. */
  async stop(noiseDb: number | null = null): Promise<Recording> {
    this.active = false;
    try {
      this.sr?.stop();
    } catch {
      /* ignore */
    }
    this.sr = null;
    if (this.push) {
      try {
        this.push.close();
      } catch {
        /* ignore */
      }
      this.push = null;
    }
    if (this.proc) {
      try {
        this.proc.disconnect();
      } catch {
        /* ignore */
      }
      this.proc = null;
    }
    if (this.az) {
      const az = this.az;
      this.az = null;
      try {
        await new Promise((res) => az.stopContinuousRecognitionAsync(res, res));
        az.close();
      } catch {
        /* ignore */
      }
    }
    if (this.mr && this.speech) {
      const mr = this.mr;
      this.mr = null;
      try {
        await new Promise<void>((res) => {
          mr.onstop = () => res();
          mr.stop();
        });
        const fd = new FormData();
        fd.append("audio", new Blob(this.chunks, { type: mr.mimeType || "audio/webm" }), "answer.webm");
        fd.append("lang", this.lang);
        const ctl = new AbortController();
        const t = window.setTimeout(() => ctl.abort(), 25000);
        const r = await fetch(this.speech.base + "/api/asr/transcribe", { method: "POST", body: fd, signal: ctl.signal });
        window.clearTimeout(t);
        if (!r.ok) throw new Error("asr");
        this.text = this.keep((((await r.json()) as { text?: string }).text ?? "").trim());
        this.onText?.(this.text);
      } catch {
        this.engine = "local-failed";
      }
      this.chunks = [];
    }
    this.release();

    const dur = (performance.now() - this.t0) / 1000;
    const fr = this.frames;
    const floor = noiseDb ?? (fr.length ? [...fr].sort((a, b) => a - b)[Math.floor(fr.length * 0.1)] : -60);
    const speech = fr.map((d) => d > floor + 10);
    const sp = speech.filter(Boolean).length;
    let run = 0;
    const pauses: number[] = [];
    speech.forEach((s) => {
      if (!s) run++;
      else {
        if (run * 0.05 >= 0.25) pauses.push(run * 0.05);
        run = 0;
      }
    });
    const spDb = fr.filter((_, i) => speech[i]);
    const meanSp = spDb.length ? spDb.reduce((a, b) => a + b, 0) / spDb.length : floor;
    const words = this.text.split(/\s+/).filter(Boolean);
    const r2 = (x: number, d = 2) => +x.toFixed(d);
    return {
      text: this.text,
      engine: this.engine,
      locale: this.engine === "azure" ? this.locale : null,
      audio: { snr_db: r2(meanSp - floor, 1), clipping: this.samples ? r2(this.clip / this.samples, 4) : 0, speech_ratio: fr.length ? r2(sp / fr.length) : 0, duration_s: r2(dur, 1) },
      features: {
        speech_rate_wpm: sp ? r2(words.length / ((sp * 0.05) / 60), 1) : 0,
        pause_count: pauses.length,
        mean_pause_s: pauses.length ? r2(pauses.reduce((a, b) => a + b, 0) / pauses.length) : 0,
        type_token_ratio: words.length ? r2(new Set(words).size / words.length) : 0,
        word_count: words.length,
      },
    };
  }
}
