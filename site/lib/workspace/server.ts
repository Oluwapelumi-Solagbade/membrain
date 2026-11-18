// The workspace against the MemBrain API (api/main.py). Every call carries the signed-in session's bearer token
// (lib/auth.ts); the server decides from it what the caller may see.
import { authHeader, sessionEnded } from "../auth";
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
    },
    refer: (pid: string, body: ReferralIn) => post<Referral>(`/participants/${encodeURIComponent(pid)}/referrals`, body),
    advance: (rid: string, state: ReferralState, date: string, reason = "") => post<Referral>(`/referrals/${encodeURIComponent(rid)}/status`, { state, date, reason }),
    audit: () => call<AuditEntry[]>(base, "/audit"),
    raiseConcern: (body: ConcernIn) => post<Case>("/concerns", body),
    followUpConcern: (pid: string, body: ConcernIn) => post<Case>(`/participants/${encodeURIComponent(pid)}/concerns`, body),
    submitInformant: (pid: string, body: InformantIn) => post<InformantDone>(`/participants/${encodeURIComponent(pid)}/informant`, body),
    enrol: (body: EnrolIn) => post<EnrolDone>("/participants", body),
    reidentify: (pid: string, reason: string) => post<VaultEntry>(`/participants/${encodeURIComponent(pid)}/reidentify`, { reason }),
    setProfile: (pid: string, body: ProfileIn) =>
      call<Case>(base, `/participants/${encodeURIComponent(pid)}/profile`, { method: "PATCH", body: JSON.stringify(body) }),
    submitSession: (pid: string, body: SessionIn) =>
      call<CheckinResult>(base, `/participants/${encodeURIComponent(pid)}/sessions`, { method: "POST", body: JSON.stringify(body) }),
    reset: async () => {
      await post("/demo/reset", {});
    },
  };
}
