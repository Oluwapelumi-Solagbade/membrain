// The workspace running entirely in the browser: the engine copies decide every level, and changes (actions,
// referrals, concerns, the audit trail) are kept in this browser's storage. It mirrors api/main.py so the pages
// behave the same as against the server. Nothing leaves the browser.
import personasJson from "../generated/personas.json";
import { config, getEngine, type Level, type Persona } from "../mb";
import { concernSummary } from "./concern";
import { nav } from "./navigator";
import type { AuditEntry, Backend, Case, ConcernIn, Participant, Referral, ReferralIn, ReferralState, Task, TaskAction } from "./types";

const KEY = "membrain.workspace.v1";
const HELD: Level[] = ["CLINICIAN_REVIEW", "URGENT"];

type State = {
  concerns: Participant[];
  referrals: Record<string, Referral[]>; // a participant's full referral list, once it has changed
  tasks: Record<string, Task>; // tasks that have been acted on
  audit: AuditEntry[];
};

const empty = (): State => ({ concerns: [], referrals: {}, tasks: {}, audit: [] });

function load(): State {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...empty(), ...(JSON.parse(raw) as State) } : empty();
  } catch {
    return empty();
  }
}

function save(s: State) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode): changes last until the page is closed */
  }
}

let memory: State | null = null;
const state = () => (memory ??= load());
const commit = (s: State) => {
  memory = s;
  save(s);
};
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function audit(s: State, actor: string, action: string, target: string, detail: Record<string, unknown> = {}) {
  s.audit.push({ ts: new Date().toISOString(), actor, action, target, detail });
  if (s.audit.length > 400) s.audit.splice(0, s.audit.length - 400);
}

function participants(s: State): Participant[] {
  const base = clone(personasJson as unknown as Participant[]);
  return [...base, ...clone(s.concerns)].map((p) => ({ ...p, referrals: s.referrals[p.id] ?? p.referrals ?? [] }));
}

function buildCase(p: Participant, s: State): Case {
  const E = getEngine();
  const ev = p.sessions.length ? E.evaluate(p as unknown as Persona, p.sessions) : { latest: null, history: [] };
  const latest = ev.latest;
  let task: Task | null = null;
  if (latest && HELD.includes(latest.level)) {
    const id = `${p.id}:${latest.session_id}`;
    task = s.tasks[id] ?? {
      id,
      participant_id: p.id,
      level: latest.level,
      status: "open",
      created: latest.date,
      review_target_days: config.REVIEW_TARGET_DAYS[latest.level],
      reasons: latest.reasons,
      actions: [],
    };
  }
  const lang = p.language ?? "en";
  return {
    participant: p,
    history: ev.history,
    latest,
    task,
    concern: concernSummary(p),
    risk_context: (p.risk_context as Record<string, unknown> | undefined) ?? null,
    prevention: p.prevention?.[lang] ?? null,
  };
}

function findReferral(s: State, rid: string): { pid: string; list: Referral[]; ref: Referral } {
  for (const p of participants(s)) {
    const i = p.referrals.findIndex((r) => r.id === rid);
    if (i >= 0) {
      const list = clone(p.referrals);
      return { pid: p.id, list, ref: list[i] };
    }
  }
  throw new Error("Referral not found");
}

export const localBackend: Backend = {
  mode: "browser",
  base: null,

  async cases() {
    const s = state();
    return participants(s).map((p) => buildCase(p, s));
  },

  async act(taskId: string, action: TaskAction, note = "", referralTo: string | null = null) {
    const s = clone(state());
    const pid = taskId.split(":")[0];
    const p = participants(s).find((x) => x.id === pid);
    const task = p ? buildCase(p, s).task : null;
    if (!task || task.id !== taskId) throw new Error("Task not found");
    if (action === "dismiss" && !note.trim()) throw new Error("Dismissal requires a reason");
    task.actions.push({ action, note, referral_to: referralTo, ts: new Date().toISOString() });
    task.status = ["dismiss", "refer", "confirm_concern"].includes(action) ? "closed" : "in_progress";
    s.tasks[taskId] = task;
    audit(s, "clinician", "task_" + action, taskId, { action, note, referral_to: referralTo });
    commit(s);
  },

  async refer(pid: string, body: ReferralIn) {
    const s = clone(state());
    const p = participants(s).find((x) => x.id === pid);
    if (!p) throw new Error("Participant not found");
    const list = clone(p.referrals);
    const ref = nav.newReferral(`REF-${pid}-${list.length}`, pid, body.pathway, body.service_id, body.urgency, body.date, body.reason, "clinician", p.entry_route ?? "programme");
    list.push(ref);
    s.referrals[pid] = list;
    audit(s, "clinician", "referral_recommended", pid, { pathway: body.pathway, service: body.service_id });
    commit(s);
    return ref;
  },

  async advance(rid: string, st: ReferralState, date: string, reason = "") {
    const s = clone(state());
    const { pid, list, ref } = findReferral(s, rid);
    nav.advance(ref, st, date, reason, "clinician"); // throws on a move the navigator does not allow
    s.referrals[pid] = list;
    audit(s, "clinician", "referral_" + st, pid, { referral: rid, reason });
    commit(s);
    return ref;
  },

  async audit() {
    return clone(state().audit);
  },

  async raiseConcern(body: ConcernIn) {
    const s = clone(state());
    const pid = "MB-C" + Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, "0");
    const acts = [...new Set(body.timeline.map(([a]) => a))].sort();
    const p: Participant = {
      id: pid,
      display_name: { en: "New concern", ar: "قلق جديد" },
      age: null,
      education: null,
      sex: "U",
      dialect: null,
      language: body.lang,
      languages: [body.lang],
      entry_route: body.reporter,
      story: "",
      context: {},
      consent: {},
      referrals: [],
      enrolled: false,
      intake: {
        reporter: body.reporter,
        at: body.date,
        confirmed: { narrative: body.narrative, domains: body.domains, onset: body.onset, timeline: body.timeline, red_flags: body.red_flags, confounders: body.confounders },
      },
      sessions: [
        { session_id: `${pid}-intake`, date: body.date, type: "intake", channel: "app", concern: body.narrative, onset: body.onset, reporter: body.reporter, activities_taken_over: acts, red_flags: body.red_flags },
      ],
    };
    s.concerns.push(p);
    audit(s, "public", "concern_raised", pid, { reporter: body.reporter, red_flags: body.red_flags, activities: acts });
    commit(s);
    return buildCase(p, s);
  },

  async reset() {
    commit(empty());
  },
};
