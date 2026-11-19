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
  lat?: number;
  lon?: number;
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

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export type UaeArea = { id: string; emirate: string; name: { en: string; ar: string }; lat: number; lon: number };

export const UAE_AREAS: UaeArea[] = [
  { id: "dxb-downtown", emirate: "Dubai", name: { en: "Downtown Dubai / Burj Khalifa", ar: "وسط مدينة دبي / برج خليفة" }, lat: 25.1972, lon: 55.2744 },
  { id: "dxb-oud-metha", emirate: "Dubai", name: { en: "Bur Dubai / Oud Metha", ar: "بر دبي / عود ميثاء" }, lat: 25.234, lon: 55.315 },
  { id: "dxb-deira", emirate: "Dubai", name: { en: "Deira / Al Rigga", ar: "ديرة / الرقة" }, lat: 25.2697, lon: 55.3095 },
  { id: "dxb-marina", emirate: "Dubai", name: { en: "Dubai Marina / JBR", ar: "دبي مارينا / جميرا بيتش ريزيدنس" }, lat: 25.0805, lon: 55.1403 },
  { id: "dxb-hills", emirate: "Dubai", name: { en: "Dubai Hills / Al Barsha", ar: "دبي هيلز / البرشاء" }, lat: 25.118, lon: 55.242 },
  { id: "dxb-mirdif", emirate: "Dubai", name: { en: "Mirdif / Al Warqa", ar: "مردف / الورقاء" }, lat: 25.215, lon: 55.419 },
  { id: "dxb-jebel-ali", emirate: "Dubai", name: { en: "Jebel Ali / Dubai South", ar: "جبل علي / دبي الجنوب" }, lat: 25.012, lon: 55.084 },
  { id: "auh-downtown", emirate: "Abu Dhabi", name: { en: "Abu Dhabi City / Corniche", ar: "مدينة أبوظبي / الكورنيش" }, lat: 24.471, lon: 54.372 },
  { id: "auh-maryah", emirate: "Abu Dhabi", name: { en: "Al Maryah / Reem Island", ar: "جزيرة المارية / جزيرة الريم" }, lat: 24.502, lon: 54.3889 },
  { id: "auh-khalifa", emirate: "Abu Dhabi", name: { en: "Khalifa City / Masdar", ar: "مدينة خليفة / مصدر" }, lat: 24.426, lon: 54.582 },
  { id: "auh-yas", emirate: "Abu Dhabi", name: { en: "Yas Island / Al Raha", ar: "جزيرة ياس / شاطئ الراحة" }, lat: 24.482, lon: 54.608 },
  { id: "auh-mzb", emirate: "Abu Dhabi", name: { en: "Mohammed Bin Zayed City", ar: "مدينة محمد بن زايد" }, lat: 24.331, lon: 54.542 },
  { id: "auh-dhafra", emirate: "Abu Dhabi", name: { en: "Al Dhafra / Madinat Zayed", ar: "الظفرة / مدينة زايد" }, lat: 23.652, lon: 53.705 },
  { id: "aan-centre", emirate: "Abu Dhabi", name: { en: "Al Ain City Centre", ar: "وسط مدينة العين" }, lat: 24.218, lon: 55.762 },
  { id: "aan-maqam", emirate: "Abu Dhabi", name: { en: "Al Ain — Al Maqam / Tawam", ar: "العين — المقام / توام" }, lat: 24.195, lon: 55.688 },
  { id: "shj-centre", emirate: "Sharjah", name: { en: "Sharjah City / Al Majaz", ar: "مدينة الشارقة / المجاز" }, lat: 25.335, lon: 55.412 },
  { id: "shj-univ", emirate: "Sharjah", name: { en: "University City / Muwaileh", ar: "المدينة الجامعية / مويلح" }, lat: 25.293, lon: 55.467 },
  { id: "ajm-centre", emirate: "Ajman", name: { en: "Ajman City / Al Jurf", ar: "مدينة عجمان / الجرف" }, lat: 25.421, lon: 55.485 },
  { id: "rak-centre", emirate: "Ras Al Khaimah", name: { en: "Ras Al Khaimah / Al Nakheel", ar: "رأس الخيمة / النخيل" }, lat: 25.768, lon: 55.955 },
  { id: "fuj-centre", emirate: "Fujairah", name: { en: "Fujairah City / Corniche", ar: "مدينة الفجيرة / الكورنيش" }, lat: 25.142, lon: 56.331 },
  { id: "uaq-centre", emirate: "Umm Al Quwain", name: { en: "Umm Al Quwain / Al Salamah", ar: "أم القيوين / السلمة" }, lat: 25.526, lon: 55.558 },
];

export const REGISTERED_HOSPITAL_IDS: string[] = ["SVC-01", "SVC-02", "SVC-14"];

export function isHospitalRegistered(id?: string | null): boolean {
  if (!id) return false;
  return REGISTERED_HOSPITAL_IDS.includes(id);
}

export function findNearbyHospitals(
  lat: number,
  lon: number,
  preferredPathway = "memory_clinic",
  directory = NAV.directory
): (Service & { distanceKm: number; isRegistered: boolean })[] {
  return directory
    .filter((s) => s.pathways.includes(preferredPathway) || s.pathways.includes("primary_care"))
    .map((s) => {
      const d = s.lat && s.lon ? distanceKm(lat, lon, s.lat, s.lon) : 999;
      return { ...s, distanceKm: d, isRegistered: isHospitalRegistered(s.id) };
    })
    .sort((a, b) => {
      if (a.isRegistered !== b.isRegistered) return a.isRegistered ? -1 : 1;
      return a.distanceKm - b.distanceKm;
    });
}

export function findNearestRegisteredHospital(
  lat: number,
  lon: number,
  preferredPathway = "memory_clinic",
  directory = NAV.directory
): Service & { distanceKm: number; isRegistered: boolean } {
  const all = findNearbyHospitals(lat, lon, preferredPathway, directory);
  const reg = all.find((s) => s.isRegistered);
  return reg ?? all[0];
}
