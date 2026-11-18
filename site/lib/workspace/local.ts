// The workspace running entirely in the browser: the engine copies decide every level, and changes (actions,
// referrals, concerns, the audit trail) are kept in this browser's storage. It mirrors api/main.py so the pages
// behave the same as against the server. Nothing leaves the browser.
import personasJson from "../generated/personas.json";
import programmeData from "../generated/programme-data.json";
import { config, getEngine, type Level, type Persona, type Session } from "../mb";
import { concernSummary } from "./concern";
import { FAQ_ITEMS, INFORMANT_MESSAGE } from "./informant";
import { nav } from "./navigator";
import type { AuditEntry, Backend, Case, CheckinResult, ConcernIn, InformantDone, InformantIn, Participant, ProfileIn, Referral, ReferralIn, ReferralState, SessionIn, Task, TaskAction } from "./types";

const KEY = "membrain.workspace.v2";
// Who raised the concern -> the navigator's entry route (as api/main.py and web/app.js do).
const ENTRY_ROUTE: Record<string, string> = { self: "self", family: "family", helper: "household_helper", professional: "primary_care", coordinator: "programme" };
const HELD: Level[] = ["CLINICIAN_REVIEW", "URGENT"];
const REPORTS_PER_PERSON = 60; // as api/main.py

type State = {
  concerns: Participant[];
  referrals: Record<string, Referral[]>; // a participant's full referral list, once it has changed
  tasks: Record<string, Task>; // tasks that have been acted on
  sessions: Record<string, Session[]>; // check-ins done here, added after a participant's own sessions
  profiles: Record<string, ProfileIn>; // age and schooling given at a first check-in after a concern
  audit: AuditEntry[];
};

const MESSAGES = (programmeData as unknown as { messages: Record<string, [string, string]> }).messages;
const empty = (): State => ({ concerns: [], referrals: {}, tasks: {}, sessions: {}, profiles: {}, audit: [] });

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
  return [...base, ...clone(s.concerns)].map((p) => ({
    ...p,
    ...(s.profiles[p.id] ?? {}),
    sessions: [...p.sessions, ...clone(s.sessions[p.id] ?? [])],
    referrals: s.referrals[p.id] ?? p.referrals ?? [],
  }));
}

function buildCase(p: Participant, s: State): Case {
  const E = getEngine();
  const ev = p.sessions.length ? E.evaluate(p as unknown as Persona, p.sessions) : { latest: null, history: [] };
  const latest = ev.latest;
  // The case's task: the most recent held one still open, else the latest session's. A later check-in does not
  // close a review or urgent hold opened earlier (by a concern, say); only a clinician's action does (as api/main.py).
  const taskOf = (e: (typeof ev.history)[number]): Task => {
    const id = `${p.id}:${e.session_id}`;
    return s.tasks[id] ?? {
      id,
      participant_id: p.id,
      level: e.level,
      status: "open",
      created: e.date,
      review_target_days: config.REVIEW_TARGET_DAYS[e.level],
      reasons: e.reasons,
      actions: [],
    };
  };
  // A report that only carries the previous level forward (nothing new) does not open a second task.
  const held = ev.history.filter((e) => HELD.includes(e.level) && !e.carried).map(taskOf);
  let task: Task | null = [...held].reverse().find((t) => t.status !== "closed") ?? null;
  if (!task && latest && HELD.includes(latest.level) && !latest.carried) task = taskOf(latest);
  if (!task && held.length) task = held[held.length - 1]; // the last one, closed: the case shows it was handled
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
      entry_route: ENTRY_ROUTE[body.reporter],
      story: "",
      context: {},
      consent: {},
      referrals: [],
      enrolled: false,
      intake: {
        reporter: body.reporter,
        at: body.date,
        confirmed: { narrative: body.narrative, domains: body.domains, onset: body.onset, frequency: body.frequency ?? null, severity: body.severity ?? null, timeline: body.timeline, red_flags: body.red_flags, confounders: body.confounders },
      },
      sessions: [
        {
          session_id: `${pid}-intake`, date: body.date, type: "intake", channel: "app", concern: body.narrative, onset: body.onset, frequency: body.frequency ?? null, severity: body.severity ?? null, red_flags: body.red_flags,
          reported_concern: { reporter: body.reporter, domains: body.domains, activities_taken_over: acts },
        },
      ],
    };
    s.concerns.push(p);
    audit(s, "public", "concern_raised", pid, { reporter: body.reporter, red_flags: body.red_flags, activities: acts });
    commit(s);
    return buildCase(p, s);
  },

  async followUpConcern(pid: string, body: ConcernIn) {
    const s = clone(state());
    const p = participants(s).find((x) => x.id === pid);
    if (!p) throw new Error("Participant not found");
    if (p.sessions.filter((x) => x.type === "intake" || x.type === "informant").length >= REPORTS_PER_PERSON) throw new Error("This record has reached the demo's limit of reports");
    const n = p.sessions.filter((x) => x.type === "intake").length;
    const acts = [...new Set(body.timeline.map(([a]) => a))].sort();
    (s.sessions[pid] ??= []).push({
      session_id: `${pid}-intake` + (n ? `-${n + 1}` : ""), date: body.date, type: "intake", channel: body.channel ?? "app",
      concern: body.narrative, onset: body.onset, frequency: body.frequency ?? null, severity: body.severity ?? null, red_flags: body.red_flags,
      reported_concern: { reporter: body.reporter, domains: body.domains, activities_taken_over: acts, timeline: body.timeline, confounders: body.confounders },
    });
    const after = participants(s).find((x) => x.id === pid)!;
    const c = buildCase(after, s);
    audit(s, "participant", "concern_follow_up", pid, { reporter: body.reporter, red_flags: body.red_flags, activities: acts, level: c.latest?.level });
    commit(s);
    return c;
  },

  async submitInformant(pid: string, body: InformantIn): Promise<InformantDone> {
    const s = clone(state());
    const p = participants(s).find((x) => x.id === pid);
    if (!p) throw new Error("Participant not found");
    const keys = Object.keys(body.answers);
    if (keys.length !== FAQ_ITEMS.length || !FAQ_ITEMS.every((k) => k in body.answers)) throw new Error("Please answer every activity in the questionnaire");
    if (!Object.values(body.answers).every((v) => [0, 1, 2, 3].includes(v))) throw new Error("Each answer must be 0, 1, 2 or 3");
    if (p.sessions.filter((x) => x.type === "intake" || x.type === "informant").length >= REPORTS_PER_PERSON) throw new Error("This record has reached the demo's limit of reports");
    const n = p.sessions.filter((x) => x.type === "informant").length;
    const answers = Object.fromEntries(FAQ_ITEMS.map((k) => [k, body.answers[k]]));
    const total = FAQ_ITEMS.reduce((a, k) => a + body.answers[k], 0);
    const session_id = `${pid}-faq-${n + 1}`;
    (s.sessions[pid] ??= []).push({ session_id, date: body.date, type: "informant", channel: body.channel ?? "app", faq: total, faq_items: answers, respondent: body.respondent, lang: body.lang });
    const after = participants(s).find((x) => x.id === pid)!;
    const latest = getEngine().evaluate(after as unknown as Persona, after.sessions).latest;
    audit(s, "participant", "informant_questionnaire", pid, { session_id, respondent: body.respondent, level: latest?.level });
    commit(s);
    return { session_id, message: INFORMANT_MESSAGE[body.lang], held_for_clinician: Boolean(latest?.held_for_clinician) };
  },

  async setProfile(pid: string, body: ProfileIn) {
    const s = clone(state());
    const p = participants(s).find((x) => x.id === pid);
    if (!p) throw new Error("Participant not found");
    if (p.enrolled !== false && !s.profiles[pid] && p.age != null) throw new Error("This participant is enrolled; their profile is changed through enrolment");
    s.profiles[pid] = { sex: "U", ...body };
    audit(s, "participant", "profile_set", pid, { age: body.age, education: body.education });
    commit(s);
    return buildCase(participants(s).find((x) => x.id === pid)!, s);
  },

  async submitSession(pid: string, body: SessionIn): Promise<CheckinResult> {
    const s = clone(state());
    const p = participants(s).find((x) => x.id === pid);
    if (!p) throw new Error("Participant not found");
    if (p.age == null || p.education == null) throw new Error("Age and schooling are needed before a check-in can be scored");
    const E = getEngine() as unknown as { scoreTranscripts: (tr: SessionIn["transcripts"], form: string, lang: string) => { raw: Record<string, number>; detail: unknown } };
    const sc = E.scoreTranscripts(body.transcripts, body.form, body.lang);
    const { lang, ...rest } = body;
    const session: Session = {
      ...rest,
      lang,
      session_id: `${pid}-s${p.sessions.length}`,
      raw: sc.raw,
      scoring_detail: sc.detail,
      voice_features: p.consent?.voice_features ? body.voice_features : null,
    };
    (s.sessions[pid] ??= []).push(session);
    const after = participants(s).find((x) => x.id === pid)!;
    const ev = getEngine().evaluate(after as unknown as Persona, after.sessions).latest as ReturnType<ReturnType<typeof getEngine>["evaluate"]>["latest"] & { confounders?: { code: string }[] };
    audit(s, "participant", "session_submitted", pid, { session_id: session.session_id, level: ev.level });
    commit(s);
    const i = lang === "ar" ? 1 : 0;
    const key = ev.valid === false ? "INVALID" : ev.level;
    const message: CheckinResult["message"] = { key, text: (MESSAGES[key] ?? MESSAGES.INVALID)[i] };
    if ((ev.confounders ?? []).some((c) => c.code === "mood")) message.support = MESSAGES.MOOD_SUPPORT[i];
    const out: CheckinResult = { session_id: session.session_id, message, level: ev.level, held_for_clinician: Boolean(ev.held_for_clinician) };
    if (ev.level === "BASELINE" || ev.level === "STABLE") out.prevention = p.prevention?.[lang] ?? null;
    return out;
  },

  async reset() {
    commit(empty());
  },
};
