// The referral navigator: web/navigator.js (parity-checked against membrain/navigator.py) plus its config.
import makeNavigator from "../generated/navigator.mjs";
import navigatorJson from "../generated/navigator.json";
import type { Referral, ReferralState } from "./types";

export type Service = {
  id: string;
  name: string;
  pathways: string[];
  emirate: string;
  area: string;
  languages: string[];
  funding: string[];
  wait_weeks: number;
  last_verified: string;
  capacity_per_month: number | null;
  accepting_referrals: boolean;
  referral_process: string;
  notes?: string;
  synthetic?: boolean;
};

export type NavConfig = {
  version: string;
  directory: Service[];
  pathways: Record<string, string>;
  states: ReferralState[];
  transitions: Record<ReferralState, ReferralState[]>;
  needs_reason: ReferralState[];
  closed: ReferralState[];
  pack: Record<"en" | "ar", Record<string, string>>;
  funding: Record<string, string>;
  languages: Record<string, string>;
  stale_after_days: number;
  assumptions?: Record<string, unknown>;
  synthetic_metrics: ProgrammeMetrics;
};

export type Completion = Record<string, { sent: number; completed: number; completion: number | null }>;
export type ProgrammeMetrics = {
  referrals: number;
  sent: number;
  accepted_rate: number | null;
  completion_rate: number | null;
  median_days_concern_to_review: number | null;
  median_days_referral_to_assessment: number | null;
  unresolved: number;
  overdue: number;
  non_completion_reasons: Record<string, number>;
  pathway_gaps: number;
  by_entry_route: Completion;
  by_language: Completion;
  by_funding: Completion;
  by_sex: Completion;
  by_age_band: Completion;
};

export type Matched = Service & { accessible: boolean; barriers: string[]; stale: boolean; score: number };

type Navigator = {
  advance: (r: Referral, st: ReferralState, on: string, reason?: string, by?: string) => Referral;
  newReferral: (id: string, pid: string, pathway: string, serviceId: string | null, urgency: string, on: string, reason: string, by?: string, entryRoute?: string) => Referral;
  match: (pathway: string, person: { languages?: string[]; language?: string; funding?: string; emirate?: string }, today?: string) => { pathway: string; services: Matched[]; gap: boolean; gap_action: string | null };
  metrics: (refs: Referral[], people: Record<string, Record<string, unknown>>, today?: string) => ProgrammeMetrics;
  pack: (ref: Referral, svc: Service | undefined, lang: "en" | "ar") => { title: string; sections: string[] };
  isUnresolved: (r: Referral) => boolean;
  stateDate: (r: Referral, st: ReferralState) => string | null;
  days: (a: string, b: string) => number;
};

export const NAV = navigatorJson as unknown as NavConfig;
export const nav: Navigator = makeNavigator(navigatorJson) as Navigator;

export const STATE_LABEL: Record<ReferralState, string> = {
  recommended: "Recommended",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  appointment_offered: "Appointment offered",
  attended: "Attended",
  missed: "Missed",
  assessment_completed: "Assessment completed",
  follow_up_documented: "Follow-up documented",
  lost_to_follow_up: "Lost to follow-up",
  no_accessible_service: "No accessible service",
  cancelled: "Cancelled",
};
export const STALLED: ReferralState[] = ["declined", "missed", "lost_to_follow_up", "no_accessible_service"];
export const DONE: ReferralState[] = ["assessment_completed", "follow_up_documented"];
/** The closed loop, in order: a referral only counts as done at the end. */
export const LOOP: ReferralState[] = ["recommended", "sent", "accepted", "appointment_offered", "attended", "assessment_completed", "follow_up_documented"];

export const serviceById = (id: string | null | undefined) => NAV.directory.find((s) => s.id === id);
export const stateTone = (s: ReferralState) =>
  STALLED.includes(s) ? "bg-lv-review-soft text-lv-review" : DONE.includes(s) ? "bg-lv-stable-soft text-lv-stable" : s === "cancelled" ? "bg-paper text-muted" : "bg-lv-base-soft text-lv-base";
