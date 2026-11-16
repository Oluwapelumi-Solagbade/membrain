// The clinician workspace's data, in the shape the FastAPI backend returns from GET /cases. The in-browser
// backend builds exactly the same shape, so every page works the same in either mode.
import type { Evaluation, Lang, Level, Persona, Reporter } from "../mb";

export type ReferralState =
  | "recommended" | "sent" | "accepted" | "declined" | "appointment_offered" | "attended" | "missed"
  | "assessment_completed" | "follow_up_documented" | "lost_to_follow_up" | "no_accessible_service" | "cancelled";

export type Referral = {
  id: string;
  participant_id: string;
  pathway: string;
  service_id: string | null;
  urgency: "routine" | "urgent";
  reason: string;
  entry_route?: string;
  concern_date?: string;
  state: ReferralState;
  history: { state: ReferralState; date: string; reason?: string; by?: string }[];
};

export type TaskAction = "confirm_concern" | "dismiss" | "request_repeat" | "order_investigations" | "refer";

export type Task = {
  id: string;
  participant_id: string;
  level: Level;
  status: "open" | "in_progress" | "closed";
  created: string;
  review_target_days: number;
  reasons: string[];
  actions: { action: TaskAction; note: string; referral_to?: string | null; ts: string }[];
};

export type ConcernSummary = {
  raised_by: string;
  date: string | null;
  in_their_words: string | null;
  onset: string | null;
  what_changed: string[];
  who_now_does_what: string[];
  red_flags_reported: string[];
  confounders_reported: string[];
  informant: { type?: string; relation?: string } | null;
  attribution: string;
  missing: string[];
};

export type PreventionPlan = { version?: string; items: { rule: string; text: string; evidence?: string }[] } | null;

export type Participant = Omit<Persona, "age" | "education" | "dialect" | "referrals"> & {
  age: number | null;
  education: Persona["education"] | null;
  dialect: string | null;
  age_band?: string;
  funding?: string;
  emirate?: string;
  languages?: string[];
  consent?: Record<string, boolean>;
  risk_context?: Record<string, unknown>;
  prevention?: Record<Lang, PreventionPlan>;
  intake?: {
    reporter?: Reporter;
    at?: string;
    engine?: string;
    confirmed?: { narrative: string; domains: string[]; onset: string | null; timeline: [string, string][]; red_flags: string[]; confounders: string[] };
  } | null;
  informant?: { type?: string; relation?: string; timeline?: unknown[] } | null;
  enrolled?: boolean;
  referrals: Referral[];
};

export type Case = {
  participant: Participant;
  history: Evaluation[];
  latest: Evaluation | null;
  task: Task | null;
  concern: ConcernSummary;
  risk_context: Record<string, unknown> | null;
  prevention: PreventionPlan;
};

export type AuditEntry = { ts: string; actor: string; action: string; target: string; detail: Record<string, unknown> };

export type ConcernIn = {
  reporter: Reporter;
  lang: Lang;
  narrative: string;
  domains: string[];
  onset: string | null;
  timeline: [string, string][];
  red_flags: string[];
  confounders: string[];
  date: string;
};

export type ReferralIn = { pathway: string; service_id: string | null; urgency: "routine" | "urgent"; reason: string; date: string };

/** What every page uses. Implemented by the server (FastAPI) and by the browser (engine copies + local storage). */
export interface Backend {
  mode: "server" | "browser";
  base: string | null;
  cases(): Promise<Case[]>;
  act(taskId: string, action: TaskAction, note?: string, referralTo?: string | null): Promise<void>;
  refer(pid: string, body: ReferralIn): Promise<Referral>;
  advance(rid: string, state: ReferralState, date: string, reason?: string): Promise<Referral>;
  audit(): Promise<AuditEntry[]>;
  raiseConcern(body: ConcernIn): Promise<Case>;
  reset(): Promise<void>;
}
