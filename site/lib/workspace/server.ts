// The workspace against the MemBrain API (api/main.py). The role header stands in for sign-in, as in the API's
// demo; production uses SMART on FHIR / OAuth2.
import type { AuditEntry, Backend, Case, ConcernIn, Referral, ReferralIn, ReferralState, TaskAction } from "./types";

async function call<T>(base: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(base + path, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Role": "clinician", ...(init.headers ?? {}) },
  });
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
    reset: async () => {
      await post("/demo/reset", {});
    },
  };
}
