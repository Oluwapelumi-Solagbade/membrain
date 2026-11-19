// Small, shared readings of a Case, so every page counts and labels things the same way.
import { config, EDUCATION_LABEL, type Evaluation, type Level } from "../mb";
import { nav } from "./navigator";
import type { Case } from "./types";

export const ORDER: Level[] = ["URGENT", "CLINICIAN_REVIEW", "CHECK_AGAIN", "BASELINE", "STABLE", "INVALID"];
export const HELD: Level[] = ["URGENT", "CLINICIAN_REVIEW"];
export const QUIET: Level[] = ["STABLE", "BASELINE", "INVALID"];

/** The level a case is worked at: the latest check-in's, unless an earlier review or urgent hold is still open. */
export const levelOf = (c: Case): Level => {
  const l = c.latest?.level ?? "BASELINE";
  const t = c.task && c.task.status !== "closed" ? c.task.level : null;
  return t && ORDER.indexOf(t) < ORDER.indexOf(l) ? t : l;
};
export const isIntakeOnly = (c: Case) => c.participant.enrolled === false || c.participant.id.startsWith("MB-C");
export const lastAction = (c: Case) => c.task?.actions[c.task.actions.length - 1] ?? null;
/** Waiting for a clinician: a held level whose task is still open and that has not been referred. */
export const isWaiting = (c: Case) => !!c.task && c.task.status === "open" && !c.participant.referrals.length;
/** Needs attention: not stable, not building baseline, and not already closed by a clinician. */
export const isActive = (c: Case) => !QUIET.includes(levelOf(c)) && c.task?.status !== "closed";
export const openReferrals = (c: Case) => c.participant.referrals.filter(nav.isUnresolved);

const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
export const dueFor = (ev: Evaluation | null) => {
  const d = ev ? config.REVIEW_TARGET_DAYS?.[ev.level] : undefined;
  return ev && d ? addDays(ev.date, d) : null;
};
/** When the case should be reviewed: the open task's target, else the latest check-in's. */
export const dueOf = (c: Case) =>
  c.task && c.task.status !== "closed" ? addDays(c.task.created, c.task.review_target_days) : dueFor(c.latest);

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "–";

/** Accurate, timezone-aware formatting: pure dates stay dates, full timestamps include time without midnight distortion. */
export const fmtTime = (iso: string | null | undefined) => {
  if (!iso) return "–";
  // If it's a date-only string (e.g. YYYY-MM-DD), format as a date to prevent UTC-midnight timezone shifts
  if (!iso.includes("T") && !iso.includes(":")) return fmtDate(iso);
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  return dt.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** Human-readable relative time ("Just now", "12m ago", "3h ago", "Yesterday", "4d ago"). */
export const fmtRelTime = (iso: string | null | undefined): string => {
  if (!iso) return "–";
  const isDateOnly = !iso.includes("T") && !iso.includes(":");
  const dt = new Date(isDateOnly ? iso.slice(0, 10) + "T00:00:00Z" : iso);
  if (isNaN(dt.getTime())) return iso;

  const now = Date.now();
  const diffMs = isDateOnly
    ? new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime() - dt.getTime()
    : now - dt.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  // Future timestamp
  if (diffSec < -60) {
    const futSec = -diffSec;
    if (futSec < 86400) {
      if (isDateOnly) return "Due today";
      const hrs = Math.floor(futSec / 3600);
      return hrs <= 1 ? "in 1 hour" : `in ${hrs} hours`;
    }
    const days = Math.round(futSec / 86400);
    if (days === 0) return "Due today";
    if (days === 1) return "Tomorrow";
    if (days < 7) return `in ${days} days`;
    const weeks = Math.round(days / 7);
    if (weeks <= 4) return `in ${weeks} week${weeks > 1 ? "s" : ""}`;
    return fmtDate(iso);
  }
  if (diffSec <= 0) {
    return isDateOnly ? "Today" : "Just now";
  }
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return `${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hrs = Math.floor(diffSec / 3600);
    return `${hrs}h ago`;
  }
  const days = Math.floor(diffSec / 86400);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return fmtDate(iso);
};

export function profileLine(c: Case): string {
  const p = c.participant;
  if (isIntakeOnly(c)) return `Raised by ${c.concern.raised_by.toLowerCase()} · ${p.language === "ar" ? "Arabic" : "English"} · not yet enrolled`;
  return [`${p.age} y`, p.sex, p.dialect, p.education ? EDUCATION_LABEL[p.education] : null].filter(Boolean).join(" · ");
}

export function sortCases(list: Case[], by: "urgency" | "due" = "urgency"): Case[] {
  return [...list].sort((a, b) => {
    if (by === "due") {
      const da = dueOf(a) ?? "9999", db = dueOf(b) ?? "9999";
      if (da !== db) return da < db ? -1 : 1;
    }
    const ia = isIntakeOnly(a), ib = isIntakeOnly(b);
    if (ia !== ib) return ia ? -1 : 1;
    return ORDER.indexOf(levelOf(a)) - ORDER.indexOf(levelOf(b));
  });
}

export function facilityOf(c: Case): { id?: string | null; name?: string | null; area?: string | null; emirate?: string | null } | null {
  const t = c.task;
  const p = c.participant;
  const cz = c.concern;
  const name =
    t?.hospital_name ??
    (typeof cz.assigned_hospital === "object" ? cz.assigned_hospital?.name : cz.assigned_hospital) ??
    (typeof p.assigned_hospital === "object" ? p.assigned_hospital?.name : p.assigned_hospital);
  if (!name) return null;
  const id =
    t?.hospital_id ??
    (typeof cz.assigned_hospital === "object" ? cz.assigned_hospital?.id : null) ??
    (typeof p.assigned_hospital === "object" ? p.assigned_hospital?.id : null);
  const area = t?.area ?? cz.area ?? p.area ?? null;
  const emirate = t?.emirate ?? cz.emirate ?? p.emirate ?? null;
  return { id, name, area, emirate };
}

export function contactOf(c: Case): { phone?: string | null; email?: string | null } {
  const t = c.task;
  const p = c.participant;
  const cz = c.concern;
  const phone = t?.phone ?? cz.phone ?? p.phone ?? null;
  const email = t?.email ?? cz.email ?? p.email ?? null;
  return { phone, email };
}

export function matchesQuery(c: Case, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const p = c.participant;
  const fac = facilityOf(c);
  const con = contactOf(c);
  return [
    p.id,
    p.display_name?.en,
    p.display_name?.ar,
    c.concern.in_their_words,
    fac?.name,
    fac?.area,
    con.phone,
    con.email,
    ...p.referrals.map((r) => r.id),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(s);
}

/**
 * Intelligent deep linking to case tabs and anchors:
 * caseHref("MB-0001", "#referrals") -> "/clinician/case/?id=MB-0001&tab=referral#referrals"
 * caseHref("MB-0001", "#concern") -> "/clinician/case/?id=MB-0001&tab=concern#concern"
 */
export const caseHref = (id: string, hashOrExtra = "") => {
  const encId = encodeURIComponent(id);
  if (!hashOrExtra) return `/clinician/case/?id=${encId}`;

  if (hashOrExtra.startsWith("?") || hashOrExtra.startsWith("&")) {
    const clean = hashOrExtra.startsWith("?") ? hashOrExtra.slice(1) : hashOrExtra;
    return `/clinician/case/?id=${encId}&${clean}`;
  }

  const hash = hashOrExtra.startsWith("#") ? hashOrExtra : `#${hashOrExtra}`;
  if (hash === "#refer" || hash === "#referrals") {
    return `/clinician/case/?id=${encId}&tab=referral${hash}`;
  }
  if (hash === "#concern") {
    return `/clinician/case/?id=${encId}&tab=concern#concern`;
  }
  if (hash === "#cognitive" || hash === "#moca" || hash === "#souq") {
    return `/clinician/case/?id=${encId}&tab=cognitive${hash}`;
  }
  if (hash === "#timeline" || hash === "#activity") {
    return `/clinician/case/?id=${encId}&tab=timeline#activity`;
  }
  return `/clinician/case/?id=${encId}${hash}`;
};

export const TODAY = new Date().toISOString().slice(0, 10);
