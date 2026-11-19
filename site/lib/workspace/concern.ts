// The concern that started the journey, attributed to whoever reported it, plus what is still missing.
// A port of membrain/dossier.py concern_summary; keep the two in step.
import intakeData from "../generated/intake-data.json";
import engineData from "../generated/engine-data.json";
import type { ConcernSummary, Participant } from "./types";

const IL = intakeData as unknown as { ACTIVITIES: Record<string, string>; WHO: Record<string, string>; ONSET: Record<string, string>; DOMAINS: Record<string, string>; CONFOUNDERS: Record<string, string> };
const RED_FLAGS = (engineData.config as unknown as { RED_FLAGS: Record<string, string> }).RED_FLAGS;

export const ENTRY_LABEL: Record<string, string> = {
  family: "Family member",
  self: "The person themselves",
  helper: "Household helper",
  household_helper: "Household helper",
  professional: "Healthcare professional",
  primary_care: "Healthcare professional",
  coordinator: "Programme coordinator",
  programme: "Programme screening",
};

type InformantRow = { activity: string; who_took_over?: string; when?: string; why?: string };

export function concernSummary(p: Participant): ConcernSummary {
  const sessions = p.sessions || [];
  const ikS = (sessions.find((s) => s.type === "intake") ?? {}) as Record<string, unknown>;
  const ik = p.intake ?? {};
  const c = ik.confirmed ?? ({} as NonNullable<NonNullable<Participant["intake"]>["confirmed"]>);
  const rc = (ikS.reported_concern ?? {}) as { reporter?: string; domains?: string[] };
  const route = (ik.reporter ?? rc.reporter ?? (ikS.reporter as string | undefined) ?? p.entry_route) as string | undefined;
  const raisedBy = (route && ENTRY_LABEL[route]) || route || "Not recorded";
  let text: string | null = c.narrative || (ikS.concern as string | undefined) || null;
  if (text === "routine programme screening") text = null;
  const onset = c.onset ?? (ikS.onset as string | undefined) ?? null;
  const freq = (c as { frequency?: string | null }).frequency ?? (ikS.frequency as string | undefined) ?? null;
  const sev = (c as { severity?: string | null }).severity ?? (ikS.severity as string | undefined) ?? null;
  const inf = p.informant ?? null;
  const who = (c.timeline ?? []).length
    ? (c.timeline ?? []).map(([a, w]) => `${IL.ACTIVITIES[a] ?? a}: now ${IL.WHO[w] ?? w}`)
    : ((inf?.timeline ?? []) as InformantRow[]).map(
        (t) => `${t.activity}: now ${t.who_took_over || "someone else"}` + (t.when ? ` (${t.when})` : "") + (t.why ? `; reason given: ${t.why}` : ""),
      );
  const missing: string[] = [];
  if (!text) missing.push(!route || route === "programme" ? "No specific concern (routine programme screening)" : "The concern in the reporter's own words");
  if (!onset || onset === "none") missing.push("When the change started");
  if (text && !freq) missing.push("How often it happens");
  if (!inf) missing.push("An informant account (family member or household helper)");
  if (!sessions.some((s) => s.iqcode != null || (s as { faq?: number | null }).faq != null) && (p as { pending_iqcode?: number | null }).pending_iqcode == null)
    missing.push("Family questionnaire (FAQ or IQCODE-16)");
  if (!sessions.some((s) => s.type !== "intake" && s.type !== "informant" && s.raw != null)) missing.push("A scored check-in");
  const ctx = (p.context ?? {}) as Record<string, unknown>;
  if (ctx.sbp == null && ctx.hba1c == null) missing.push("Blood pressure and HbA1c");
  return {
    raised_by: raisedBy,
    date: (ik.at ?? (ikS.date as string | undefined) ?? "").slice(0, 10) || null,
    in_their_words: text,
    onset: onset ? IL.ONSET[onset] ?? null : null,
    how_often: freq ? (IL as unknown as { FREQUENCY: Record<string, string> }).FREQUENCY[freq] ?? null : null,
    how_much: sev ? (IL as unknown as { SEVERITY: Record<string, string> }).SEVERITY[sev] ?? null : null,
    what_changed: (c.domains?.length ? c.domains : rc.domains ?? []).map((d) => IL.DOMAINS[d] ?? d),
    who_now_does_what: who,
    red_flags_reported: ((ikS.red_flags as string[] | undefined) ?? []).map((f) => RED_FLAGS[f] ?? f),
    confounders_reported: (c.confounders ?? []).map((f) => IL.CONFOUNDERS[f] ?? f),
    informant: inf ? { type: inf.type, relation: inf.relation } : null,
    attribution: `Reported by: ${raisedBy}. This is their account, not a clinical finding, until a clinician confirms it.`,
    missing,
    phone: p.phone ?? null,
    email: p.email ?? null,
    emirate: p.emirate ?? null,
    area: p.area ?? null,
    assigned_hospital: p.assigned_hospital ?? null,
  };
}
