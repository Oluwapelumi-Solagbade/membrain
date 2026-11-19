// The workspace against the MemBrain API (api/main.py). Every call carries the signed-in session's bearer token
// (lib/auth.ts); the server decides from it what the caller may see.
import { authHeader, sessionEnded } from "../auth";
import { notifyWorkspaceSync } from "./sync";
import type { AuditEntry, Backend, Case, CheckinResult, ConcernIn, EnrolDone, EnrolIn, InformantDone, InformantIn, VaultEntry, ProfileIn, Referral, ReferralIn, ReferralState, SessionIn, TaskAction } from "./types";

async function call<T>(base: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(base + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeader(), ...(init.headers ?? {}) },
  });
  if (res.status === 401) sessionEnded();
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const j = (await res.json()) as { detail?: unknown };
      if (j.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* not JSON */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export function serverBackend(base: string): Backend {
  const post = <T,>(path: string, body: unknown) => call<T>(base, path, { method: "POST", body: JSON.stringify(body) });
  return {
    mode: "server",
    base,
    cases: () => call<Case[]>(base, "/cases"),
    act: async (taskId: string, action: TaskAction, note = "", referralTo: string | null = null) => {
      await post(`/tasks/${encodeURIComponent(taskId)}/action`, { action, note, referral_to: referralTo });
      notifyWorkspaceSync({ action: "act", taskId });
    },
    refer: async (pid: string, body: ReferralIn) => {
      const r = await post<Referral>(`/participants/${encodeURIComponent(pid)}/referrals`, body);
      notifyWorkspaceSync({ action: "refer", pid });
      return r;
    },
    advance: async (rid: string, state: ReferralState, date: string, reason = "") => {
      const r = await post<Referral>(`/referrals/${encodeURIComponent(rid)}/status`, { state, date, reason });
      notifyWorkspaceSync({ action: "advance", rid });
      return r;
    },
    audit: () => call<AuditEntry[]>(base, "/audit"),
    raiseConcern: async (body: ConcernIn) => {
      const r = await post<Case>("/concerns", body);
      notifyWorkspaceSync({ action: "raiseConcern", pid: r.participant.id });
      return r;
    },
    followUpConcern: async (pid: string, body: ConcernIn) => {
      const r = await post<Case>(`/participants/${encodeURIComponent(pid)}/concerns`, body);
      notifyWorkspaceSync({ action: "followUpConcern", pid });
      return r;
    },
    submitInformant: async (pid: string, body: InformantIn) => {
      const r = await post<InformantDone>(`/participants/${encodeURIComponent(pid)}/informant`, body);
      notifyWorkspaceSync({ action: "submitInformant", pid });
      return r;
    },
    enrol: async (body: EnrolIn) => {
      const r = await post<EnrolDone>("/participants", body);
      notifyWorkspaceSync({ action: "enrol", id: r.id });
      return r;
    },
    reidentify: (pid: string, reason: string) => post<VaultEntry>(`/participants/${encodeURIComponent(pid)}/reidentify`, { reason }),
    setProfile: async (pid: string, body: ProfileIn) => {
      const r = await call<Case>(base, `/participants/${encodeURIComponent(pid)}/profile`, { method: "PATCH", body: JSON.stringify(body) });
      notifyWorkspaceSync({ action: "setProfile", pid });
      return r;
    },
    submitSession: async (pid: string, body: SessionIn) => {
      const r = await call<CheckinResult>(base, `/participants/${encodeURIComponent(pid)}/sessions`, { method: "POST", body: JSON.stringify(body) });
      notifyWorkspaceSync({ action: "submitSession", pid });
      return r;
    },
    reset: async () => {
      await post("/demo/reset", {});
      notifyWorkspaceSync({ action: "reset" });
    },
  };
}
