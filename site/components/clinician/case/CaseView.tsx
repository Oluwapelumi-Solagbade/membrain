"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ClipboardList,
  Download,
  FileClock,
  FileText,
  HandHelping,
  HeartPulse,
  LineChart,
  ListChecks,
  MessageSquareText,
  Mic,
  Printer,
  Route,
  Stethoscope,
  X,
  MapPinned,
  Send,
} from "lucide-react";
import { Mark } from "../../Logo";
import { LevelPill } from "../../ui";
import { DriversTable, fmtNum, Trend } from "../charts";
import { btnClass, downloadText, Loading, Panel } from "../parts";
import { ReferralCard } from "../ReferralCard";
import { TaskActions } from "../TaskActions";
import { useWorkspace } from "../WorkspaceProvider";
import { fhirBundle } from "./fhir";
import { ReferralForm } from "./ReferralForm";
import { ReportsOverTime } from "./Reports";
import { Handover, handoverRows } from "./Handover";
import { ReferralDraft } from "./ReferralDraft";
import { FamilyMessage } from "./FamilyMessage";
import { MocaPanel } from "./MocaPanel";
import { EDUCATION_LABEL, type Evaluation } from "@/lib/mb";
import { dueOf, fmtDate, fmtTime, isIntakeOnly, levelOf } from "@/lib/workspace/derive";
import { NAV } from "@/lib/workspace/navigator";
import type { AuditEntry, Case } from "@/lib/workspace/types";

const DOMAIN_LABEL: Record<string, string> = {
  memory_immediate: "Word learning",
  memory_delayed: "Delayed word recall",
  fluency: "Word generation (fluency)",
  story_recall: "Story recall",
  judgement: "Everyday judgement",
};

const FACTOR_LABEL: Record<string, string> = {
  hypertension: "High blood pressure",
  diabetes: "Diabetes",
  ldl: "Raised LDL cholesterol",
  physical_inactivity: "Physical inactivity",
  obesity: "Obesity",
  hearing_loss: "Hearing loss",
  low_education: "Less formal education",
  smoking: "Smoking",
  depression: "Depression",
  social_isolation: "Social isolation",
  tbi: "Head injury",
  alcohol: "Alcohol",
  air_pollution: "Air pollution",
  vision_loss: "Vision loss",
};

const ACTION_LABEL: Record<string, string> = {
  concern_raised: "Concern raised",
  view_case: "Case viewed",
  view_dossier: "Dossier viewed",
  view_evaluation: "Evaluation viewed",
  export_fhir: "FHIR exported",
  referral_recommended: "Referral recommended",
  task_confirm_concern: "Concern confirmed",
  task_refer: "Referred",
  task_dismiss: "Closed: not a concern",
  task_request_repeat: "Repeat check-in requested",
  task_order_investigations: "Investigations ordered",
  enrol: "Enrolled",
  session_submitted: "Check-in submitted",
  consent_update: "Consent updated",
  reidentify: "Contact details opened",
};
const readable = (a: string) => ACTION_LABEL[a] ?? (a.startsWith("referral_") ? "Referral: " + a.slice(9).replace(/_/g, " ") : a.replace(/_/g, " "));
const pretty = (k: string) => k.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());

type Z = { domains?: Record<string, number>; composite?: number };
const zOf = (h: Evaluation | null) => (h as unknown as { z?: Z } | null)?.z;

export function CaseView() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { ready, byId } = useWorkspace();
  const c = byId(id);

  if (!ready) return <Loading label="Loading the case" />;
  if (!c)
    return (
      <div className="rounded-2xl border border-[#ebece8] bg-white px-6 py-10 text-center">
        <p className="font-serif text-[26px] font-semibold">No case {id ? `“${id}”` : "selected"}</p>
        <p className="mt-2 text-[15px] text-body">It may have been removed when the demo data was reset.</p>
        <Link href="/clinician/" className={`${btnClass.primary} mt-5`}>
          <ArrowLeft size={17} /> Back to the queue
        </Link>
      </div>
    );
  return <CaseBody key={c.participant.id} c={c} />;
}

function CaseBody({ c }: { c: Case }) {
  const { audit } = useWorkspace();
  const p = c.participant;
  const ev = c.latest;
  const intakeOnly = isIntakeOnly(c);
  const referred = p.referrals.length > 0;
  const due = referred || c.task?.status === "closed" ? null : dueOf(c);
  const [referring, setReferring] = useState(false);
  const [activity, setActivity] = useState<AuditEntry[] | null>(null);
  const actionsTaken = c.task?.actions.length ?? 0;
  const refCount = p.referrals.length;
  const historyCount = p.referrals.reduce((n, r) => n + r.history.length, 0);

  useEffect(() => {
    // Open the referral form straight away when the queue sent us here to refer.
    if (window.location.hash === "#refer" && c.task?.status === "open" && !referred) {
      setReferring(true); // eslint-disable-line react-hooks/set-state-in-effect
      window.setTimeout(() => document.getElementById("refer")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } else if (window.location.hash === "#referrals") {
      window.setTimeout(() => document.getElementById("referrals")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  }, [c.task?.status, referred]);

  useEffect(() => {
    // The case's activity, reloaded whenever something on the case changes.
    let live = true;
    audit()
      .then((all) => {
        if (!live) return;
        const mine = all.filter((a) => a.target === p.id || a.target.startsWith(p.id + ":"));
        setActivity(mine.sort((a, b) => (a.ts < b.ts ? 1 : -1)));
      })
      .catch(() => live && setActivity([]));
    return () => {
      live = false;
    };
  }, [audit, p.id, actionsTaken, refCount, historyCount]);

  const openReferral = () => {
    setReferring(true);
    window.setTimeout(() => document.getElementById("refer")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const exportFhir = () => downloadText(`${p.id}-fhir-bundle.json`, JSON.stringify(fhirBundle(c), null, 2), "application/fhir+json");

  const consent = Object.entries(p.consent ?? {});
  const facts = [
    p.funding && ["Funding", NAV.funding?.[p.funding] ?? p.funding],
    p.emirate && ["Emirate", p.emirate],
    p.languages?.length && ["Languages", p.languages.map((l) => NAV.languages?.[l] ?? l).join(", ")],
    ["Entry", c.concern.raised_by],
  ].filter(Boolean) as [string, string][];

  const z = zOf(ev);
  const scoredHistory = [...c.history].reverse();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/clinician/" className="inline-flex items-center gap-2 text-[15px] font-medium text-deep hover:underline">
          <ArrowLeft size={17} /> Back to queue
        </Link>
        <div className="flex flex-wrap gap-2.5">
          <Link href={`/checkin/?id=${encodeURIComponent(p.id)}&lang=${p.language ?? "en"}`} className={btnClass.secondary}>
            <Mic size={17} /> Start a check-in
          </Link>
          <button type="button" onClick={exportFhir} className={btnClass.secondary}>
            <Download size={17} /> Export FHIR
          </button>
          <button type="button" onClick={() => window.print()} className={btnClass.secondary}>
            <Printer size={17} /> Print summary
          </button>
        </div>
      </div>

      {/* Header */}
      <section className="rounded-2xl border border-[#ebece8] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="flex min-w-0 flex-wrap items-center gap-3">
            <span className="text-[30px] font-semibold leading-none tracking-[-0.02em] sm:text-[34px]">{p.id}</span>
            <span className="[&>span]:px-3.5 [&>span]:py-1.5 [&>span]:text-[14.5px]">
              <LevelPill level={levelOf(c)} />
            </span>
            {intakeOnly && <span className="rounded bg-sand-soft px-2 py-0.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#8a5a14]">New concern</span>}
          </p>
          {due && (
            <span className="inline-flex items-center gap-2 rounded-xl bg-paper px-4 py-2.5 text-[14.5px]">
              <CalendarClock size={17} className="text-leaf" /> Review by <b>{fmtDate(due)}</b>
            </span>
          )}
        </div>
        <p className="mt-2.5 text-[16px] text-body">
          {intakeOnly
            ? `Concern raised by ${c.concern.raised_by.toLowerCase()} on ${fmtDate(c.concern.date)} · not yet enrolled`
            : [`${p.age} years`, p.sex === "F" ? "Female" : p.sex === "M" ? "Male" : null, p.dialect && `${p.dialect} dialect`, p.education && `${EDUCATION_LABEL[p.education]} schooling`].filter(Boolean).join(" · ")}
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[14.5px]">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[12.5px] text-muted">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {consent.length > 0 && (
          <div className="mt-4">
            <p className="text-[12.5px] text-muted">Consent</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {consent.map(([k, v]) => (
                <li key={k} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-medium ${v ? "bg-lv-stable-soft text-lv-stable" : "bg-[#f1f1ee] text-muted"}`}>
                  {v ? <Check size={13} /> : <X size={13} />} {pretty(k)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {ev && (
          <div className="mt-5 flex gap-4 rounded-2xl bg-[#f1f4ee] p-4 sm:p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#dcefe2]">
              <Mark className="h-7 w-auto" />
            </span>
            <div>
              <p className="text-[17px] font-semibold">Why this level</p>
              <ul className="mt-1.5 space-y-1 text-[15.5px] leading-snug">
                {(c.task && c.task.status !== "closed" && c.task.id !== `${p.id}:${ev.session_id}`
                  ? // An earlier review is still open: its reasons lead, and the later check-in follows (it does not close it).
                    [...c.task.reasons, ev.intake || ev.informant_report
                      ? `Still open from ${fmtDate(c.task.created)}; a later report does not close it. Latest report: ${ev.reasons[0] ?? ev.level}`
                      : `Still open from ${fmtDate(c.task.created)}; a later check-in does not close it. Latest check-in: ${ev.reasons[0] ?? ev.level}`]
                  : ev.reasons
                ).map((r) => (
                  <li key={r} className="flex gap-2.5">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
                    {r.replace(/->/g, "→")}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div className="mt-4 print:hidden">
          <TaskActions c={c} onRefer={openReferral} />
        </div>
      </section>

      {referring && <ReferralForm c={c} onClose={() => setReferring(false)} />}

      {/* Scores */}
      {ev && ev.drivers.length > 0 && (
        <Panel title="Assessment inputs" icon={ClipboardList} aside={<span className="text-[14px] text-body">Thresholds from config.py</span>}>
          <DriversTable drivers={ev.drivers} />
        </Panel>
      )}

      {z?.domains && (
        <Panel title="Latest check-in by domain" icon={ListChecks} aside={<span className="text-[14px] text-body">z against age and schooling norms · {fmtDate(ev?.date)}</span>}>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[420px] border-separate border-spacing-0 text-[15.5px]">
              <thead>
                <tr>
                  <th className="rounded-l-lg bg-[#f5f5f2] px-4 py-2.5 text-left font-medium">Domain</th>
                  <th className="bg-[#f5f5f2] px-4 py-2.5 text-right font-medium">z</th>
                  <th className="rounded-r-lg bg-[#f5f5f2] px-4 py-2.5 text-left font-medium">Against norms</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(z.domains).map(([k, v]) => {
                  const w = Math.min(100, Math.abs(v) * 25);
                  return (
                    <tr key={k}>
                      <td className="border-b border-[#f0f0ec] px-4 py-2.5">{DOMAIN_LABEL[k] ?? pretty(k)}</td>
                      <td className="border-b border-[#f0f0ec] px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{fmtNum(v)}</td>
                      <td className="border-b border-[#f0f0ec] px-4 py-2.5">
                        <span className="relative block h-2 w-40 rounded-full bg-[#efefeb]" aria-hidden>
                          <span className="absolute inset-y-0 left-1/2 w-px bg-muted/40" />
                          <span className={`absolute inset-y-0 rounded-full ${v < -1.5 ? "bg-lv-review" : v < -1 ? "bg-lv-check" : "bg-leaf"}`} style={v < 0 ? { right: "50%", width: `${w / 2}%` } : { left: "50%", width: `${w / 2}%` }} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {z.composite != null && (
                  <tr>
                    <td className="px-4 py-2.5 font-semibold">Composite</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{fmtNum(z.composite)}</td>
                    <td className="px-4 py-2.5 text-[13.5px] text-muted">weighted across domains</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {c.history.some((h) => zOf(h)?.composite != null) && (
        <Panel title="Over time" icon={LineChart} aside={<span className="text-[14px] text-body">Compared with own baseline</span>}>
          <Trend history={c.history} />
        </Panel>
      )}

      {handoverRows(p).length > 0 && (
        <Panel title="Who does it now" icon={HandHelping} aside={<span className="text-[14px] text-body">Tasks the household has taken over, beside the check-ins</span>}>
          <Handover p={p} history={c.history} />
        </Panel>
      )}

      {c.history.length > 0 && (
        <Panel title="Sessions" icon={FileClock} aside={<span className="text-[14px] text-body">{c.history.length} recorded</span>}>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[14.5px]">
              <thead>
                <tr>
                  {["Date", "Channel", "Form", "Level", "Composite z", "Scored"].map((h, i, a) => (
                    <th key={h} className={`bg-[#f5f5f2] px-3.5 py-2.5 font-medium ${h === "Composite z" ? "text-right" : "text-left"} ${i === 0 ? "rounded-l-lg" : ""} ${i === a.length - 1 ? "rounded-r-lg" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scoredHistory.map((h) => {
                  const notScored = h.reasons.find((r) => r.startsWith("Session not scored"));
                  const isIntake = h.intake;
                  const isFaq = h.informant_report;
                  const comp = zOf(h)?.composite;
                  const form = (h as unknown as { form?: string }).form;
                  return (
                    <tr key={h.session_id}>
                      <td className="border-b border-[#f0f0ec] px-3.5 py-2.5 font-mono text-[13.5px]">{h.date}</td>
                      <td className="border-b border-[#f0f0ec] px-3.5 py-2.5">{isIntake ? (h.concern_change?.first === false ? "Follow-up concern" : "Intake") : isFaq ? "Family questionnaire" : (h as unknown as { channel?: string }).channel ?? "app"}</td>
                      <td className="border-b border-[#f0f0ec] px-3.5 py-2.5">{form ?? "–"}</td>
                      <td className="border-b border-[#f0f0ec] px-3.5 py-2.5">
                        <LevelPill level={h.level} size="sm" />
                      </td>
                      <td className="border-b border-[#f0f0ec] px-3.5 py-2.5 text-right font-mono tabular-nums">{comp != null ? fmtNum(comp) : "–"}</td>
                      <td className="border-b border-[#f0f0ec] px-3.5 py-2.5 text-[13.5px]">
                        {isIntake ? <span className="text-muted">Concern only</span> : isFaq ? <span className="text-muted">FAQ {h.informant?.score}/{h.informant?.max}</span> : notScored ? <span className="text-lv-check">{notScored.replace("Session not scored: ", "Not scored: ")}</span> : h.valid ? <span className="text-lv-stable">Yes</span> : <span className="text-muted">No</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* The concern */}
      <Panel title="The concern" icon={MessageSquareText} aside={<span className="text-[14px] text-body">{c.concern.raised_by}{c.concern.date ? ` · ${fmtDate(c.concern.date)}` : ""}</span>}>
        {c.concern.in_their_words ? (
          <blockquote dir={p.language === "ar" ? "rtl" : "ltr"} lang={p.language} className={`border-s-[3px] border-sand ps-4 text-ink ${p.language === "ar" ? "text-[17px] leading-[1.9]" : "text-[15.5px] leading-relaxed"}`}>
            {c.concern.in_their_words}
          </blockquote>
        ) : (
          <p className="text-[15px] text-muted">No concern in the reporter&apos;s own words on file.</p>
        )}
        <dl className="mt-4 divide-y divide-line rounded-xl border border-line text-[15px]">
          {(
            [
              ["When it started", c.concern.onset ?? "Not said"],
              ["How often", c.concern.how_often ?? "Not said"],
              ["How much", c.concern.how_much ?? "Not said"],
              ["What has changed", c.concern.what_changed.join(", ") || "None recorded"],
              ["Who now does what", c.concern.who_now_does_what.join("; ") || "None recorded"],
              ["Urgent signs reported", c.concern.red_flags_reported.join("; ") || "None"],
              ["Can affect memory", c.concern.confounders_reported.join("; ") || "None mentioned"],
              ["Informant", c.concern.informant ? [c.concern.informant.relation, c.concern.informant.type].filter(Boolean).join(", ") : "None on file"],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k} className="px-4 py-2.5 sm:grid sm:grid-cols-[190px_1fr] sm:gap-3">
              <dt className="text-[13px] text-muted sm:text-[15px]">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[13.5px] italic text-body">{c.concern.attribution}</p>
        {c.concern.missing.length > 0 && (
          <div className="mt-4">
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-leaf">Still missing</p>
            <ul className="mt-2 space-y-1.5">
              {c.concern.missing.map((m) => (
                <li key={m} className="flex items-center gap-2.5 text-[15px]">
                  <span className="h-4 w-4 shrink-0 rounded border-[1.5px] border-[#b9c4c2] bg-white" aria-hidden /> {m}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <ReportsOverTime c={c} />

      {/* Risk and prevention */}
      {(c.risk_context || c.prevention?.items?.length) && (
        <Panel title="Risk factors and prevention" icon={HeartPulse} aside={<span className="text-[14px] text-body">Lancet Commission 2024</span>}>
          {c.risk_context && <RiskContext rc={c.risk_context} />}
          {c.prevention?.items?.length ? (
            <div className={c.risk_context ? "mt-5 border-t border-line pt-4" : ""}>
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-leaf">Prevention plan for the person</p>
              <ul className="mt-2 space-y-3">
                {c.prevention.items.map((it) => (
                  <li key={it.rule} dir={p.language === "ar" ? "rtl" : "ltr"} lang={p.language}>
                    <p className="text-[15px] leading-relaxed">{it.text}</p>
                    {it.evidence && <p className="mt-0.5 text-[12.5px] text-muted" dir="ltr">{it.evidence}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      )}

      {/* Exploratory tasks: shown, never scored */}
      {((p as { exploratory?: unknown[] }).exploratory ?? []).length > 0 && (
        <Panel title="Souq route (exploratory)" icon={MapPinned} aside={<span className="text-[14px] text-body">Spatial route memory · not used for triage</span>}>
          <table className="w-full text-[14.5px]">
            <thead>
              <tr className="text-left text-[13px] text-muted">
                <th className="pb-1.5 font-medium">Date</th><th className="pb-1.5 font-medium">Route span</th><th className="pb-1.5 font-medium">Steps right</th>
                <th className="pb-1.5 font-medium">Time per step</th><th className="pb-1.5 font-medium">Form · language</th>
              </tr>
            </thead>
            <tbody>
              {((p as { exploratory?: { task: string; date: string; span: number; accuracy: number | null; ms_per_step: number | null; form: string; lang: string }[] }).exploratory ?? [])
                .filter((x) => x.task === "souq_route")
                .map((x, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-1.5">{fmtDate(x.date)}</td>
                    <td className="font-semibold">{x.span} stops</td>
                    <td>{x.accuracy == null ? "–" : `${Math.round(x.accuracy * 100)}%`}</td>
                    <td>{x.ms_per_step == null ? "–" : `${(x.ms_per_step / 1000).toFixed(1)} s`}</td>
                    <td className="text-muted">{x.form} · {x.lang === "ar" ? "Arabic" : "English"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="mt-3 rounded-lg bg-[#e8ebf4] px-3 py-2 text-[13px] leading-snug text-lv-base">
            New and not yet validated. Spatial route memory (the spatial-span method in a market scene) is among the first abilities to change in Alzheimer&apos;s disease. Track it alongside the check-in; it will join the engine only after the pilot validates it against a clinician-given assessment.
          </p>
        </Panel>
      )}

      {/* Clinic MoCA: the reference standard, entered by the clinician (scores only) */}
      <Panel title="Clinic MoCA" icon={Stethoscope} aside={<span className="text-[14px] text-body">Given by a certified clinician · reference, not used for triage</span>}>
        <MocaPanel pid={p.id} />
      </Panel>

      {/* What the family is told: only after a clinician approves it */}
      <Panel title="Message to the family" icon={Send} aside={<span className="text-[14px] text-body">Shared only after you approve it</span>}>
        <FamilyMessage pid={p.id} />
      </Panel>

      {/* Referral letter: always available to a clinician, before or after a referral */}
      <Panel title="Referral letter" icon={FileText} aside={<span className="text-[14px] text-body">Drafted by MedGemma, fact-checked by MemBrain</span>}>
        <ReferralDraft pid={p.id} />
      </Panel>

      {/* Referrals */}
      {p.referrals.length > 0 ? (
        p.referrals.map((r, i) => <ReferralCard key={r.id} r={r} id={i === 0 ? "referrals" : undefined} />)
      ) : (
        <Panel id="referrals" title="Referrals" icon={Route}>
          <p className="text-[15px] text-body">No referral yet.</p>
          {c.task?.status === "open" && !referring && (
            <button type="button" onClick={openReferral} className={`${btnClass.primary} mt-3 print:hidden`}>
              <Stethoscope size={17} /> Confirm concern and refer
            </button>
          )}
        </Panel>
      )}

      {/* Activity */}
      <Panel title="Case activity" icon={FileClock} aside={<span className="text-[14px] text-body">From the audit log</span>}>
        {activity === null ? (
          <p className="text-[14.5px] text-muted">Loading…</p>
        ) : activity.length === 0 ? (
          <p className="text-[14.5px] text-muted">Nothing recorded for this case yet{intakeOnly ? "" : " in this session"}.</p>
        ) : (
          <ul className="divide-y divide-line">
            {activity.map((a, i) => {
              const note = (a.detail?.note as string) || (a.detail?.reason as string) || "";
              return (
                <li key={a.ts + i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5 text-[14.5px]">
                  <span className="w-[120px] shrink-0 text-[13px] text-muted">{fmtTime(a.ts)}</span>
                  <span className="font-medium">{readable(a.action)}</span>
                  <span className="text-muted">· {a.actor}</span>
                  {note && <span className="w-full text-[13.5px] text-body sm:ms-[132px]">“{note}”</span>}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <p className="px-1 text-[13px] text-muted">MemBrain flags risk and change. It does not diagnose. Synthetic data only.</p>
    </div>
  );
}

function RiskContext({ rc }: { rc: Record<string, unknown> }) {
  const factors = (rc.modifiable_factors_present as string[] | undefined) ?? [];
  const checks = (rc.reversible_cause_checks as string[] | undefined) ?? [];
  const known = new Set(["modifiable_factors_present", "count", "of", "reversible_cause_checks", "genomic"]);
  const other = Object.entries(rc).filter(([k, v]) => !known.has(k) && v != null && v !== "");
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-leaf">
          Modifiable risk factors {rc.count != null && rc.of != null ? `· ${String(rc.count)} of ${String(rc.of)}` : ""}
        </p>
        {factors.length ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {factors.map((f) => (
              <li key={f} className="rounded-lg bg-lv-check-soft px-2.5 py-1 text-[13.5px] font-medium text-lv-check">
                {FACTOR_LABEL[f] ?? pretty(f)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[14.5px] text-muted">None recorded.</p>
        )}
        {other.length > 0 && (
          <dl className="mt-3 space-y-1 text-[14px]">
            {other.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-muted">{pretty(k)}:</dt>
                <dd>{typeof v === "boolean" ? (v ? "Yes" : "No") : Array.isArray(v) ? v.join(", ") : String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div>
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-leaf">Reversible causes to check</p>
        {checks.length ? (
          <ul className="mt-2 space-y-1">
            {checks.map((x) => (
              <li key={x} className="flex items-center gap-2 text-[14.5px]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-leaf" /> {x}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[14.5px] text-muted">None listed.</p>
        )}
      </div>
    </div>
  );
}
