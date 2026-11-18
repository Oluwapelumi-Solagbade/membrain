// Picks the backend once per page load. The MemBrain API is used when it answers: at NEXT_PUBLIC_API_URL (GitHub Pages
// points at the live Hugging Face Space) or on the same origin (the Space serves this site). Only if neither answers
// after three tries does everything run in the browser, and components/ModeBanner.tsx then says so on every page.
// ?mode=browser forces the browser backend; ?api=<url> points at another API.
import { localBackend } from "./local";
import { serverBackend } from "./server";
import type { Backend } from "./types";

let chosen: Promise<Backend> | null = null;
let serverOnly = false;

/** The mobile app works against the live server only: it never falls back to the in-browser copy (where nothing is
 *  saved). If the server cannot be reached, getBackend() rejects and the app shows a retry screen. */
export function requireServer() {
  serverOnly = true;
}
/** Forget the choice, so the next getBackend() probes again (the app's "Retry"). */
export function resetBackend() {
  chosen = null;
}

type Probe = "ok" | "no" | "retry";

/** "no" = definitely no MemBrain API here (404, wrong answer); "retry" = maybe asleep or busy (timeout, 5xx, network). */
async function probe(base: string, ms: number): Promise<Probe> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(base + "/health", { signal: ctl.signal, cache: "no-store" });
    if (res.status >= 500) return "retry";
    if (!res.ok) return "no";
    const j = (await res.json()) as { status?: string; engine?: string };
    return j.status === "ok" && typeof j.engine === "string" ? "ok" : "no";
  } catch {
    return "retry";
  } finally {
    window.clearTimeout(t);
  }
}

/** A free host can take several seconds to wake up or answer while busy: try three times before giving up, so a
 *  visitor on the live demo is never silently moved to the in-browser copy (where nothing is saved). */
async function reachable(base: string): Promise<boolean> {
  for (const ms of [5000, 9000, 14000]) {
    const r = await probe(base, ms);
    if (r === "ok") return true;
    if (r === "no") return false;
  }
  return false;
}

/** Was this page meant to use a server? (true on the live demo; false only when the browser copy was asked for.) */
export const serverExpected = (): boolean =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") !== "browser" && process.env.NEXT_PUBLIC_STATIC_ONLY !== "1";

/** Where the live demo is, for the banner shown when this page could not reach it. */
export const LIVE_DEMO_URL = process.env.NEXT_PUBLIC_API_URL || "https://vulcan-spark-membrain.hf.space";

async function pick(): Promise<Backend> {
  const q = new URLSearchParams(window.location.search);
  if (q.get("mode") === "browser") return localBackend;
  // Static hosting with no API at all (only if a build asks for it): skip probing, unless ?api=<url> names one.
  if (process.env.NEXT_PUBLIC_STATIC_ONLY === "1" && !q.get("api")) return localBackend;
  // Inside the Android app the page itself is served from the phone (https://localhost): only the live server counts.
  const sameOrigin = process.env.NEXT_PUBLIC_MOBILE === "1" ? null : "";
  const candidates = [q.get("api"), process.env.NEXT_PUBLIC_API_URL, sameOrigin].filter((x): x is string => x != null).map((x) => x.replace(/\/$/, ""));
  for (const base of [...new Set(candidates)]) if (await reachable(base)) return serverBackend(base);
  if (serverOnly) throw new Error("The MemBrain server could not be reached.");
  return localBackend;
}

export function getBackend(): Promise<Backend> {
  chosen ??= pick();
  chosen.catch(() => {
    chosen = null; // a failed connection is retried on the next call, not remembered
  });
  return chosen;
}

export * from "./types";
