// Sign-in on the site. Against the MemBrain server it calls api/auth.py and keeps the bearer token for this device;
// with no server (the browser-only demo) it signs in to the same synthetic demo accounts locally, and says so.
// In the pilot the token moves to an httpOnly cookie issued after UAE PASS or hospital single sign-on.
"use client";

import { useSyncExternalStore } from "react";
import { getBackend } from "./workspace/backend";
import { NAV } from "./workspace/navigator";

export type Role = "clinician" | "coordinator" | "participant";
export type User = {
  id: string; role: Role; name?: string | null; email?: string; title?: string; org?: string; pid?: string; phone?: string;
  /** The hospital a clinician works for: they see its patients only. None for the programme coordinator, who sees all. */
  hospital_id?: string | null; hospital_name?: string | null;
};
export type AuthSession = { token: string; user: User; exp: number; mode: "server" | "browser" };
export type Challenge = { challenge_id: string; sent_to: string; expires_in: number; demo_code?: string; known: boolean };
export type DemoAccounts = {
  enabled: boolean;
  otp_on_screen?: boolean;
  clinicians?: { email: string; name: string; role: Role; password: string; title?: string; hospital_id?: string | null; hospital_name?: string | null }[];
  patients?: { phone: string; name: string; name_ar?: string; pid: string }[];
};

const KEY = "membrain.auth.v1";
const CLAIM_KEY = "membrain.claim";
const EVENT = "membrain-auth";

/* ── The stored session, readable from any component ── */

let cache: { raw: string | null; value: AuthSession | null } = { raw: null, value: null };

export function currentSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw !== cache.raw) {
    let value: AuthSession | null = null;
    try {
      value = raw ? (JSON.parse(raw) as AuthSession) : null;
    } catch {
      value = null;
    }
    cache = { raw, value };
  }
  return cache.value && cache.value.exp > Date.now() ? cache.value : null;
}

function store(s: AuthSession | null) {
  try {
    if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the session lasts until the page closes */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(fn: () => void) {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

/** The signed-in session (null when signed out), and whether it has been read yet (false during pre-render). */
export function useSession(): { session: AuthSession | null; ready: boolean } {
  const session = useSyncExternalStore(subscribe, currentSession, () => null);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  return { session, ready };
}

export function authHeader(): Record<string, string> {
  const s = currentSession();
  return s?.mode === "server" ? { Authorization: `Bearer ${s.token}` } : {};
}

/** Called when the server says the session has ended: forget it so the page sends the person to sign in. */
export function sessionEnded() {
  if (currentSession()) store(null);
}

/* ── Talking to the server, or the browser-only demo ── */

async function server(): Promise<string | null> {
  const b = await getBackend();
  return b.mode === "server" ? (b.base ?? "") : null;
}

async function post<T>(base: string, path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const r = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as T & { detail?: unknown };
  if (!r.ok) throw new Error(typeof j.detail === "string" ? j.detail : "Something went wrong. Please try again.");
  return j;
}

// The browser-only demo: the same synthetic accounts as api/auth.py, checked here because there is no server.
const LOCAL_PASSWORD = "membrain-demo-2026";
const LOCAL: DemoAccounts = {
  enabled: true,
  otp_on_screen: true,
  clinicians: [],
  patients: (
    [
      ["MB-1041", "Fatima", "فاطمة"], ["MB-1187", "Ahmed", "أحمد"], ["MB-1203", "Mariam", "مريم"], ["MB-1322", "Khalid", "خالد"],
      ["MB-1409", "John", "جون"], ["MB-1455", "Aisha", "عائشة"], ["MB-1510", "Saeed", "سعيد"],
    ] as const
  ).map(([pid, name, name_ar]) => ({ pid, name, name_ar, phone: "+97150000" + pid.slice(-4) })),
};
// One clinician per hospital with demo patients, and the coordinator across hospitals (as api/auth.py DEMO_CLINICIANS).
const H = (id: string) => NAV.directory.find((s) => s.id === id)?.name ?? id;
const LOCAL_USERS: Record<string, User> = Object.fromEntries(
  (
    [
      ["u-clin-1", "dr.demo@membrain.ae", "Dr. Demo", "Consultant, memory clinic", "SVC-01"],
      ["u-clin-2", "dr.alain@membrain.ae", "Dr. Hessa", "Consultant geriatrician", "SVC-02"],
      ["u-clin-3", "dr.dubai@membrain.ae", "Dr. Omar", "Consultant neurologist", "SVC-14"],
    ] as const
  )
    .map(([id, email, name, title, hid]): User => ({ id, role: "clinician", name, email, title, org: H(hid), hospital_id: hid, hospital_name: H(hid) }))
    .concat({ id: "u-coord-1", role: "coordinator", name: "Layla (coordinator)", email: "coordinator@membrain.ae", title: "Programme coordinator", org: "Healthy ageing programme, all hospitals", hospital_id: null, hospital_name: null })
    .map((u) => [u.email!, u]),
);
LOCAL.clinicians = Object.values(LOCAL_USERS).map((u) => ({ email: u.email!, name: u.name!, role: u.role, password: LOCAL_PASSWORD, title: u.title, hospital_id: u.hospital_id, hospital_name: u.hospital_name }));

/** A hospital's name as the screens show it (the directory marks its entries "(synthetic)"). */
export const hospitalLabel = (name?: string | null) => (name ?? "").replace(/\s*\(synthetic\)\s*$/i, "");

/** Whether the signed-in person may see a record: a clinician their own hospital's and those no hospital has yet. */
export function canSee(u: User | null | undefined, p: { id: string; assigned_hospital?: unknown }): boolean {
  if (!u) return false;
  if (u.role === "coordinator") return true;
  if (u.role === "participant") return u.pid === p.id;
  const h = p.assigned_hospital && typeof p.assigned_hospital === "object" ? (p.assigned_hospital as { id?: string | null }).id ?? null : null;
  return !u.hospital_id || !h || h === u.hospital_id;
}
const localCodes = new Map<string, { phone: string; code: string; exp: number; tries: number }>();

export function normalisePhone(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (d.startsWith("+")) return d.length - 1 >= 9 && d.length - 1 <= 15 ? d : null;
  d = d.replace(/^0+/, "");
  return /^5\d{8}$/.test(d) ? "+971" + d : null;
}
export const maskPhone = (p: string) => p.slice(0, 4) + " •• ••• " + p.slice(-4);

export async function demoAccounts(): Promise<DemoAccounts> {
  const base = await server();
  if (base === null) return LOCAL;
  try {
    const r = await fetch(base + "/auth/demo");
    return r.ok ? ((await r.json()) as DemoAccounts) : { enabled: false };
  } catch {
    return { enabled: false };
  }
}

export async function signInClinician(email: string, password: string, remember: boolean): Promise<User> {
  const base = await server();
  if (base !== null) {
    const r = await post<{ token: string; expires_in: number; user: User }>(base, "/auth/clinician/login", { email, password, remember });
    store({ token: r.token, user: r.user, exp: Date.now() + r.expires_in * 1000, mode: "server" });
    return r.user;
  }
  const u = LOCAL_USERS[email.trim().toLowerCase()];
  await new Promise((r) => window.setTimeout(r, 450));
  if (!u || password !== LOCAL_PASSWORD) throw new Error("That email and password don't match an account.");
  store({ token: "local", user: u, exp: Date.now() + (remember ? 7 * 86400e3 : 8 * 3600e3), mode: "browser" });
  return u;
}

export async function startPatient(phone: string): Promise<Challenge> {
  const base = await server();
  if (base !== null) return post<Challenge>(base, "/auth/patient/start", { phone });
  const p = normalisePhone(phone);
  if (!p) throw new Error("Please enter a mobile number, for example 050 123 4567.");
  if (!LOCAL.patients!.some((x) => x.phone === p)) throw new Error("In the browser-only demo, please use one of the demo numbers below.");
  const code = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
  const id = Math.random().toString(36).slice(2);
  localCodes.set(id, { phone: p, code, exp: Date.now() + 600e3, tries: 0 });
  await new Promise((r) => window.setTimeout(r, 450));
  return { challenge_id: id, sent_to: maskPhone(p), expires_in: 600, demo_code: code, known: true };
}

export async function verifyPatient(challengeId: string, code: string): Promise<User> {
  const base = await server();
  let claim: { pid: string; token: string } | undefined;
  try {
    const raw = window.sessionStorage.getItem(CLAIM_KEY);
    if (raw) claim = JSON.parse(raw) as { pid: string; token: string };
  } catch {
    /* none */
  }
  if (base !== null) {
    const r = await post<{ token: string; expires_in: number; user: User }>(base, "/auth/patient/verify", { challenge_id: challengeId, code, claim });
    try {
      window.sessionStorage.removeItem(CLAIM_KEY);
    } catch {
      /* ignore */
    }
    store({ token: r.token, user: r.user, exp: Date.now() + r.expires_in * 1000, mode: "server" });
    return r.user;
  }
  const ch = localCodes.get(challengeId);
  if (!ch || ch.exp < Date.now()) throw new Error("That code has expired. Please ask for a new one.");
  if (ch.code !== code) {
    if (++ch.tries >= 5) {
      localCodes.delete(challengeId);
      throw new Error("Too many wrong codes. Please ask for a new one.");
    }
    throw new Error("That code isn't right. Please check it and try again.");
  }
  localCodes.delete(challengeId);
  const pt = LOCAL.patients!.find((x) => x.phone === ch.phone)!;
  const user: User = { id: "u-" + pt.pid, role: "participant", pid: pt.pid, name: pt.name, phone: maskPhone(ch.phone) };
  store({ token: "local", user, exp: Date.now() + 30 * 86400e3, mode: "browser" });
  return user;
}

export async function signOut() {
  const s = currentSession();
  store(null);
  if (s?.mode === "server") {
    const base = await server();
    if (base !== null) fetch(base + "/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${s.token}` } }).catch(() => {});
  }
}

/** Kept after raising a concern, so signing in afterwards can link that concern to the person's own record. */
export function rememberClaim(pid: string, token: string) {
  try {
    window.sessionStorage.setItem(CLAIM_KEY, JSON.stringify({ pid, token }));
  } catch {
    /* ignore */
  }
}

export const homeFor = (u: User) => (u.role === "participant" ? "/checkin/" : "/clinician/");
