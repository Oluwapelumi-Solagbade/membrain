"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getBackend, type AuditEntry, type Backend, type Case, type EnrolDone, type EnrolIn, type ReferralIn, type ReferralState, type TaskAction, type VaultEntry } from "@/lib/workspace/backend";

type Workspace = {
  ready: boolean;
  /** When the cases were last read from the backend, and whether a read is under way (live refresh). */
  syncedAt: number | null;
  syncing: boolean;
  mode: "server" | "browser" | null;
  base: string | null;
  cases: Case[];
  error: string | null;
  query: string;
  setQuery: (q: string) => void;
  byId: (id: string) => Case | undefined;
  refresh: () => Promise<void>;
  act: (taskId: string, action: TaskAction, note?: string, referralTo?: string | null) => Promise<void>;
  refer: (pid: string, body: ReferralIn) => Promise<void>;
  advance: (rid: string, state: ReferralState, date: string, reason?: string) => Promise<void>;
  audit: () => Promise<AuditEntry[]>;
  reset: () => Promise<void>;
  enrol: (body: EnrolIn) => Promise<EnrolDone>;
  reidentify: (pid: string, reason: string) => Promise<VaultEntry>;
};

const Ctx = createContext<Workspace | null>(null);

/** Loads the cases once, and reloads them after every change, from the server or the browser backend. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let live = true;
    getBackend()
      .then(async (b) => {
        const list = await b.cases();
        if (!live) return;
        setBackend(b);
        setCases(list);
        setSyncedAt(Date.now());
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, []);

  const run = useCallback(async (fn: (b: Backend) => Promise<unknown>) => {
    const b = await getBackend();
    setError(null);
    setSyncing(true);
    try {
      await fn(b);
    } finally {
      try {
        setCases(await b.cases());
        setSyncedAt(Date.now());
      } finally {
        setSyncing(false);
      }
    }
  }, []);

  // Live: against the server, read the cases again every 20 seconds while the page is visible, and as soon as it
  // becomes visible again, so what others add (a concern on the website, a check-in, the Telegram bot) appears here.
  useEffect(() => {
    if (backend?.mode !== "server") return;
    let busy = false;
    const tick = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        setCases(await backend.cases());
        setSyncedAt(Date.now());
      } catch {
        /* keep what is shown; the next tick tries again */
      } finally {
        busy = false;
      }
    };
    const id = window.setInterval(tick, 20000);
    const vis = () => document.visibilityState === "visible" && void tick();
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [backend]);

  const value = useMemo<Workspace>(
    () => ({
      ready: !!backend,
      syncedAt,
      syncing,
      mode: backend?.mode ?? null,
      base: backend?.base ?? null,
      cases,
      error,
      query,
      setQuery,
      byId: (id) => cases.find((c) => c.participant.id === id),
      refresh: () => run(async () => undefined),
      act: (taskId, action, note, referralTo) => run((b) => b.act(taskId, action, note, referralTo)),
      refer: (pid, body) => run((b) => b.refer(pid, body)),
      advance: (rid, state, date, reason) => run((b) => b.advance(rid, state, date, reason)),
      audit: async () => (await getBackend()).audit(),
      reset: () => run((b) => b.reset()),
      enrol: async (body) => {
        let out: EnrolDone | null = null;
        await run(async (b) => {
          out = await b.enrol(body);
        });
        return out!;
      },
      reidentify: async (pid, reason) => (await getBackend()).reidentify(pid, reason),
    }),
    [backend, cases, error, query, run, syncedAt, syncing],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): Workspace {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return v;
}
