"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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

/** Loads cases on mount, reloads on route changes, window focus, custom sync events, and live polling. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [backend, setBackend] = useState<Backend | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const busyRef = useRef(false);

  const fetchCases = useCallback(async (b?: Backend) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setSyncing(true);
    try {
      const activeBackend = b ?? (await getBackend());
      const list = await activeBackend.cases();
      setBackend(activeBackend);
      setCases(list);
      setSyncedAt(Date.now());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busyRef.current = false;
      setSyncing(false);
    }
  }, []);

  const run = useCallback(async (fn: (b: Backend) => Promise<unknown>) => {
    const b = await getBackend();
    setError(null);
    setSyncing(true);
    try {
      await fn(b);
    } finally {
      try {
        const list = await b.cases();
        setCases(list);
        setSyncedAt(Date.now());
      } finally {
        setSyncing(false);
      }
    }
  }, []);

  // 1. Initial mount
  useEffect(() => {
    void fetchCases();
  }, [fetchCases]);

  // 2. Immediate refresh on route change (e.g. entering /clinician/ or /clinician/case/?id=...)
  useEffect(() => {
    void fetchCases();
  }, [pathname, searchParams, fetchCases]);

  // 3. Live Sync listeners:
  // - Window focus (when user switches back to clinician tab)
  // - Visibilitychange (when browser un-minimizes or tab switches)
  // - Custom "membrain:sync" event (dispatched whenever a concern or check-in completes)
  // - Storage event (dispatched across browser tabs when another tab submits data)
  // - Rapid active interval (every 4 seconds)
  useEffect(() => {
    const trigger = () => {
      void fetchCases();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") trigger();
    };
    const onFocus = () => trigger();
    const onSync = () => trigger();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("membrain")) trigger();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("membrain:sync", onSync);
    window.addEventListener("storage", onStorage);

    const pollId = window.setInterval(trigger, 4000);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("membrain:sync", onSync);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(pollId);
    };
  }, [fetchCases]);

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
      refresh: () => fetchCases(),
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
    [backend, cases, error, fetchCases, query, run, syncedAt, syncing],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): Workspace {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return v;
}
