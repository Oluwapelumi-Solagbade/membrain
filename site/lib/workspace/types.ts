// The clinician workspace's data, in the shape the FastAPI backend returns from GET /cases. The in-browser
// backend builds exactly the same shape, so every page works the same in either mode.
import type { Evaluation, Lang, Level, Persona, Reporter } from "../mb";
export type { ConcernChange, InformantResult } from "../mb";

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
  how_often?: string | null;
  how_much?: string | null;
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
    confirmed?: { narrative: string; domains: string[]; onset: string | null; frequency?: string | null; severity?: string | null; timeline: [string, string][]; red_flags: string[]; confounders: string[] };
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
  frequency?: string | null;
  severity?: string | null;
  timeline: [string, string][];
  red_flags: string[];
  confounders: string[];
  date: string;
  channel?: "app" | "telegram" | "phone";
};

/** The family questionnaire (membrain/config.py FAQ_ITEMS): each everyday activity as it is now, 0 manages normally,
 * 1 has difficulty but manages alone, 2 needs help, 3 someone else does it now. */
export type Respondent = "spouse" | "child" | "sibling" | "other_family" | "helper" | "friend" | "self";
export type InformantIn = { date: string; lang: Lang; respondent: Respondent; answers: Record<string, number>; channel?: "app" | "phone" };
/** What the family sees: a message, never a score. Clinicians also get the updated case. */
export type InformantDone = { session_id: string; message: string; held_for_clinician: boolean; case?: Case };

/** Enrolment by a coordinator or clinician (api/main.py Enrol). Name, ID and phone go to the identity vault only. */
export type EnrolIdentity = { full_name: string; national_id?: string | null; phone?: string | null; preferred_channel: "app" | "whatsapp" | "phone" };
export type EnrolInformant = { name: string; relation: string; phone?: string | null };
export type InformantChange = { activity_key: string; change: string; when: string; who_took_over: string; why: string };
export type EnrolIn = {
  date: string;
  age: number;
  sex: "F" | "M";
  education: NonNullable<Participant["education"]>;
  language: Lang;
  dialect: string;
  identity: EnrolIdentity | null;
  informant: EnrolInformant | null;
  informant_profile: { type: "family" | "household_helper"; relation: string | null; language: string | null; consented: boolean; timeline: InformantChange[] } | null;
  concern: { route: "programme" | "primary_care" | "family" | "household_helper" | "self"; text: string; onset: "days" | "weeks" | "months" | "years" | "none" | null; red_flags: string[] };
  consent: Record<string, boolean>;
  context: Record<string, unknown>;
  emirate: string | null;
  funding: string | null;
  iqcode: number | null;
  apoe: string | null;
};
export type EnrolDone = { id: string; first_form: string; phone_linked: boolean; case?: Case };
/** What re-identification returns (clinical staff only, a reason is required, and it is audited). */
export type VaultEntry = { identity: EnrolIdentity | null; informant: EnrolInformant | null };

/** A finished check-in, as the participant app sends it (api/main.py SessionIn). Transcripts are scored by the
 * engine: in Python on the server, or by the byte-identical JavaScript copy in the browser. */
export type SessionIn = {
  date: string;
  channel: "app";
  form: "A" | "B" | "C";
  lang: Lang;
  transcripts: { memory_immediate: string; memory_delayed: string; fluency: string; story_recall: string; judgement: string };
  audio: { snr_db: number; clipping: number; speech_ratio: number; duration_s: number } | null;
  precheck: { hearing_ok: boolean; vision_ok: boolean; noise_ok: boolean };
  phq2: number;
  gad2: number;
  sleep_hours: number;
  acute_illness: boolean;
  assisted: boolean;
  helper_role: string | null;
  input_mode: string;
  asr: { engine: string; locale?: string | null } | null;
  voice_features: Record<string, number> | null;
};

/** What the person is shown afterwards: a message, never a score. */
export type CheckinResult = {
  session_id: string;
  message: { key: string; text: string; support?: string };
  level: Level;
  held_for_clinician: boolean;
  prevention?: PreventionPlan;
};

export type ProfileIn = { age: number; education: NonNullable<Participant["education"]>; sex?: "F" | "M" | "U"; dialect?: string | null };

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
  /** A later concern about someone already known: added to their record, dated, and compared with what came before. */
  followUpConcern(pid: string, body: ConcernIn): Promise<Case>;
  submitInformant(pid: string, body: InformantIn): Promise<InformantDone>;
  enrol(body: EnrolIn): Promise<EnrolDone>;
  reidentify(pid: string, reason: string): Promise<VaultEntry>;
  setProfile(pid: string, body: ProfileIn): Promise<Case>;
  submitSession(pid: string, body: SessionIn): Promise<CheckinResult>;
  reset(): Promise<void>;
}
