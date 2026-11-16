// Picks the backend once per page load. The MemBrain API is used when it answers: on the same origin (the API
// serves this site in production) or at NEXT_PUBLIC_API_URL. Otherwise everything runs in the browser.
// ?mode=browser forces the browser backend; ?api=<url> points at another API.
import { localBackend } from "./local";
import { serverBackend } from "./server";
import type { Backend } from "./types";

let chosen: Promise<Backend> | null = null;

async function healthy(base: string): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), 2500);
    const res = await fetch(base + "/health", { signal: ctl.signal });
    window.clearTimeout(t);
    if (!res.ok) return false;
    const j = (await res.json()) as { status?: string; engine?: string };
    return j.status === "ok" && typeof j.engine === "string";
  } catch {
    return false;
  }
}

async function pick(): Promise<Backend> {
  const q = new URLSearchParams(window.location.search);
  if (q.get("mode") === "browser") return localBackend;
  // Static hosting with no API next to it (GitHub Pages): skip probing, unless ?api=<url> names one.
  if (process.env.NEXT_PUBLIC_STATIC_ONLY === "1" && !q.get("api")) return localBackend;
  const candidates = [q.get("api"), process.env.NEXT_PUBLIC_API_URL, ""].filter((x): x is string => x != null).map((x) => x.replace(/\/$/, ""));
  for (const base of [...new Set(candidates)]) if (await healthy(base)) return serverBackend(base);
  return localBackend;
}

export function getBackend(): Promise<Backend> {
  return (chosen ??= pick());
}

export * from "./types";
