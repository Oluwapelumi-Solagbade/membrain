// Small, shared readings of a Case, so every page counts and labels things the same way.
import { config, EDUCATION_LABEL, type Evaluation, type Level } from "../mb";
import { nav } from "./navigator";
import type { Case } from "./types";

export const ORDER: Level[] = ["URGENT", "CLINICIAN_REVIEW", "CHECK_AGAIN", "BASELINE", "STABLE", "INVALID"];
export const HELD: Level[] = ["URGENT", "CLINICIAN_REVIEW"];
export const QUIET: Level[] = ["STABLE", "BASELINE", "INVALID"];

export const levelOf = (c: Case): Level => c.latest?.level ?? "BASELINE";
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
export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "–";
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function profileLine(c: Case): string {
  const p = c.participant;
  if (isIntakeOnly(c)) return `Raised by ${c.concern.raised_by.toLowerCase()} · ${p.language === "ar" ? "Arabic" : "English"} · not yet enrolled`;
  return [`${p.age} y`, p.sex, p.dialect, p.education ? EDUCATION_LABEL[p.education] : null].filter(Boolean).join(" · ");
}

export function sortCases(list: Case[], by: "urgency" | "due" = "urgency"): Case[] {
  return [...list].sort((a, b) => {
    if (by === "due") {
      const da = dueFor(a.latest) ?? "9999", db = dueFor(b.latest) ?? "9999";
      if (da !== db) return da < db ? -1 : 1;
    }
    const ia = isIntakeOnly(a), ib = isIntakeOnly(b);
    if (ia !== ib) return ia ? -1 : 1;
    return ORDER.indexOf(levelOf(a)) - ORDER.indexOf(levelOf(b));
  });
}

export function matchesQuery(c: Case, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const p = c.participant;
  return [p.id, p.display_name?.en, p.display_name?.ar, c.concern.in_their_words, ...p.referrals.map((r) => r.id)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(s);
}

export const caseHref = (id: string, hash = "") => `/clinician/case/?id=${encodeURIComponent(id)}${hash}`;
export const TODAY = "2026-11-14";
