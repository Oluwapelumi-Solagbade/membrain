"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Compass,
  Download,
  FileClock,
  FileText,
  HandHelping,
  HeartPulse,
  LineChart,
  ListChecks,
  Lock,
  Mail,
  MapPinned,
  MessageSquareText,
  Mic,
  Phone,
  Printer,
  RotateCcw,
  Route,
  Send,
  Stethoscope,
  X,
} from "lucide-react";
import { Mark } from "../../Logo";
import { LevelPill } from "../../ui";
import { DriversTable, fmtNum, Trend } from "../charts";
import { btnClass, downloadText, Loading, Panel } from "../parts";
import { ReferralCard } from "../ReferralCard";
import { TaskActions } from "../TaskActions";
import { useWorkspace } from "../WorkspaceProvider";
import { hospitalLabel, useSession } from "@/lib/auth";
import { fhirBundle } from "./fhir";
import { ReferralForm } from "./ReferralForm";
import { ReportsOverTime } from "./Reports";
import { ContactDetails } from "./ContactDetails";
import { Handover, handoverRows } from "./Handover";
import { ReferralDraft } from "./ReferralDraft";
import { FamilyMessage } from "./FamilyMessage";
import { MocaPanel } from "./MocaPanel";
import { ReviewPacket } from "./ReviewPacket";
import { EDUCATION_LABEL, type Evaluation } from "@/lib/mb";
import { caseHref, contactOf, dueOf, facilityOf, fmtDate, fmtRelTime, fmtTime, isIntakeOnly, levelOf, participantNameOf, registeredNameOf } from "@/lib/workspace/derive";
import { NAV, STATE_LABEL } from "@/lib/workspace/navigator";
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

type CaseTab = "overview" | "concern" | "cognitive" | "referral" | "timeline";

export function CaseView() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { ready, byId, getCase, refresh, syncing } = useWorkspace();
  const [directCase, setDirectCase] = useState<Case | null>(null);
  const [loadingDirect, setLoadingDirect] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);

  const c = byId(id) ?? directCase ?? undefined;

  // Direct fetch fallback if the case is not yet in the general list cache
  useEffect(() => {
    if (ready && !byId(id) && id && !loadingDirect && !directCase && !directError) {
      setLoadingDirect(true);
      getCase(id)
        .then((found) => {
          setDirectCase(found);
          setLoadingDirect(false);
        })
        .catch((err) => {
          setDirectError(err instanceof Error ? err.message : String(err));
          setLoadingDirect(false);
        });
    }
  }, [ready, id, byId, getCase, loadingDirect, directCase, directError]);

  if (!ready || loadingDirect || (syncing && !c)) return <Loading label="Loading the case" />;
  if (!c) {
    if (syncing) return <Loading label="Retrieving latest case data..." />;
    return (
      <div className="rounded-2xl border border-[#ebece8] bg-white px-6 py-10 text-center">
        <p className="font-serif text-[26px] font-semibold">No case {id ? `“${id}”` : "selected"}</p>
        <p className="mt-2 text-[15px] text-body">
          {directError || "This person may be under another hospital, which only its own clinicians can see, or the demo data was reset."}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button type="button" onClick={() => { setDirectError(null); void refresh(); }} className={btnClass.secondary}>
            <RotateCcw size={16} /> Refresh cases
          </button>
          <Link href="/clinician/" className={`${btnClass.primary}`}>
            <ArrowLeft size={17} /> Back to the queue
          </Link>
        </div>
      </div>
    );
  }
  return <CaseBody key={c.participant.id} c={c} />;
}

/** A case no hospital has taken on yet: every clinician can see it until one hospital takes it on. */
function TakeOn({ pid }: { pid: string }) {
  const { assignHospital } = useWorkspace();
  const { session } = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hid = session?.user.hospital_id;
  return (
    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#d9b36a] bg-[#fdf6e7] px-4 py-3">
      <div className="flex items-center gap-2.5">
        <Building2 size={18} className="shrink-0 text-[#a87a22]" />
        <div>
          <p className="text-[14.5px] font-semibold text-ink">No hospital has taken this person on yet</p>
          <p className="text-[13px] text-muted">{err ?? "Every clinician can see them until one hospital does. After that, only that hospital's clinicians can."}</p>
        </div>
      </div>
      {hid && (
        <button type="button" disabled={busy}
          onClick={async () => {
            setBusy(true); setErr(null);
            try { await assignHospital(pid, hid); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-deep px-3.5 py-2 text-[13.5px] font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : `Take on for ${hospitalLabel(session?.user.hospital_name)}`}
        </button>
      )}
    </div>
  );
}

function CaseBody({ c }: { c: Case }) {
  const params = useSearchParams();
  const { audit } = useWorkspace();
  const p = c.participant;
  const ev = c.latest;
  const intakeOnly = isIntakeOnly(c);
  const referred = p.referrals.length > 0;
  const due = referred || c.task?.status === "closed" ? null : dueOf(c);
  const fac = facilityOf(c);
  const con = contactOf(c);

  // Tab State: prioritize query param -> hash -> intelligent default
  const paramTab = params.get("tab") as CaseTab | null;
  const [activeTab, setActiveTab] = useState<CaseTab>(() => {
    if (paramTab && ["overview", "concern", "cognitive", "referral", "timeline"].includes(paramTab)) return paramTab;
    return "overview";
  });

  const [referring, setReferring] = useState(false);
  const [contact, setContact] = useState(false);
  const [activity, setActivity] = useState<AuditEntry[] | null>(null);
  const registeredName = participantNameOf(p, "en") || registeredNameOf(p.id) || null;
  const actionsTaken = c.task?.actions.length ?? 0;
  const refCount = p.referrals.length;
  const historyCount = p.referrals.reduce((n, r) => n + r.history.length, 0);

  // Synchronize hash & query params with tabs
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash === "#refer" || hash === "#referrals") {
      setActiveTab("referral");
      if (hash === "#refer" && c.task?.status === "open" && !referred) {
        setReferring(true);
      }
      window.setTimeout(() => document.getElementById("referrals")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } else if (hash === "#concern") {
      setActiveTab("concern");
      window.setTimeout(() => document.getElementById("concern-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } else if (hash === "#cognitive" || hash === "#moca" || hash === "#souq") {
      setActiveTab("cognitive");
    } else if (hash === "#timeline" || hash === "#activity") {
      setActiveTab("timeline");
    } else if (paramTab && ["overview", "concern", "cognitive", "referral", "timeline"].includes(paramTab)) {
      setActiveTab(paramTab);
    }
  }, [c.task?.status, referred, paramTab]);

  const switchTab = (tab: CaseTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      url.hash = "";
      window.history.replaceState({}, "", url.toString());
    }
  };

  useEffect(() => {
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
    setActiveTab("referral");
    setReferring(true);
    window.setTimeout(() => document.getElementById("refer")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const exportFhir = () => downloadText(`${p.id}-fhir-bundle.json`, JSON.stringify(fhirBundle(c), null, 2), "application/fhir+json");

  const consent = Object.entries(p.consent ?? {});
  const facts = [
    fac?.name && ["Assigned Facility", fac.name],
    fac?.area && ["Catchment Area", fac.area],
    con.phone && ["Callback Phone", con.phone],
    con.email && ["Email", con.email],
    p.funding && ["Funding", NAV.funding?.[p.funding] ?? p.funding],
    p.emirate && ["Emirate", p.emirate],
    p.languages?.length && ["Languages", p.languages.map((l) => NAV.languages?.[l] ?? l).join(", ")],
    ["Entry", c.concern.raised_by],
  ].filter(Boolean) as [string, string][];

  const z = zOf(ev);
  const scoredHistory = [...c.history].reverse();

  const TABS: { id: CaseTab; label: string; icon: typeof Compass; count?: number | string }[] = [
    { id: "overview", label: "Overview & Decision", icon: Compass },
    { id: "concern", label: "The Concern & Family", icon: MessageSquareText, count: intakeOnly ? "New" : undefined },
    { id: "cognitive", label: "Cognitive Assessments", icon: ListChecks, count: c.history.length > 0 ? c.history.length : undefined },
    { id: "referral", label: "Referral & Care Plan", icon: Route, count: p.referrals.length > 0 ? p.referrals.length : undefined },
    { id: "timeline", label: "Timeline & Audit", icon: FileClock, count: activity?.length },
  ];

  return (
    <div className="space-y-5">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/clinician/" className="inline-flex items-center gap-2 text-[15px] font-medium text-deep hover:underline">
          <ArrowLeft size={17} /> Back to queue
        </Link>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href={`/checkin/?id=${encodeURIComponent(p.id)}${registeredName ? `&name=${encodeURIComponent(registeredName)}` : ""}`}
            className={btnClass.secondary}
          >
            <Mic size={16} /> Start in-clinic check-in
          </Link>
          {p.enrolled !== false && !p.id.startsWith("MB-C") && (
            <button type="button" onClick={() => setContact((x) => !x)} aria-expanded={contact} className={btnClass.secondary}>
              <Lock size={16} /> Contact details
            </button>
          )}
          <button type="button" onClick={exportFhir} className={btnClass.secondary}>
            <Download size={16} /> Export FHIR
          </button>
          <button type="button" onClick={() => window.print()} className={btnClass.secondary}>
            <Printer size={16} /> Print summary
          </button>
        </div>
      </div>

      {contact && <ContactDetails pid={p.id} onClose={() => setContact(false)} />}

      {/* Case Header Card */}
      <section className="rounded-2xl border border-[#ebece8] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="flex min-w-0 flex-wrap items-center gap-3">
            <span className="text-[30px] font-semibold leading-none tracking-[-0.02em] sm:text-[34px]">
              {registeredName ? `${registeredName} (${p.id})` : p.id}
            </span>
            <span className="[&>span]:px-3.5 [&>span]:py-1.5 [&>span]:text-[14.5px]">
              <LevelPill level={levelOf(c)} />
            </span>
            {intakeOnly && (
              <span className="rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-wide text-amber-900">
                New concern
              </span>
            )}
          </p>
          {due && (
            <span className="inline-flex items-center gap-2 rounded-xl bg-paper px-4 py-2.5 text-[14.5px]">
              <CalendarClock size={17} className="text-leaf" /> Review target: <b>{fmtDate(due)}</b>
              <span className="text-muted">({fmtRelTime(due)})</span>
            </span>
          )}
        </div>

        <p className="mt-2 text-[15.5px] text-body">
          {intakeOnly
            ? `Concern raised by ${c.concern.raised_by.toLowerCase()} on ${fmtDate(c.concern.date)} (${fmtRelTime(c.concern.date)}) · not yet enrolled`
            : [registeredName, `${p.age} years`, p.sex === "F" ? "Female" : p.sex === "M" ? "Male" : null, p.dialect && `${p.dialect} dialect`, p.education && `${EDUCATION_LABEL[p.education]} schooling`, p.emirate].filter(Boolean).join(" · ")}
        </p>

        {/* Demographics & consent chips */}
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line/70 pt-3 text-[14px]">
          {facts.map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="text-[12.5px] text-muted">{k}:</span>
              <span className="font-medium text-ink">{v}</span>
            </div>
          ))}
          {consent.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[12.5px] text-muted">Consent:</span>
              <ul className="inline-flex flex-wrap gap-1">
                {consent.map(([k, v]) => (
                  <li key={k} className={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[11.5px] font-medium ${v ? "bg-lv-stable-soft text-lv-stable" : "bg-[#f1f1ee] text-muted"}`}>
                    {v ? <Check size={11} /> : <X size={11} />} {pretty(k)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {!fac?.name && <TakeOn pid={p.id} />}

        {fac?.name && (
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-leaf/30 bg-leaf/5 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Building2 size={18} className="shrink-0 text-leaf" />
              <div>
                <span className="text-[14.5px] font-semibold text-deep">{fac.name}</span>
                {fac.area && <span className="ms-2 text-[13px] text-muted">· {fac.area}</span>}
                <span className="ms-2 text-[12.5px] font-medium text-leaf">· 21-Day Review SLA</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {con.phone && (
                <a
                  href={`tel:${con.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1 text-[13px] font-semibold text-leaf shadow-sm hover:bg-paper"
                >
                  <Phone size={13} /> Call {con.phone}
                </a>
              )}
              {con.email && (
                <a
                  href={`mailto:${con.email}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1 text-[13px] font-medium text-deep shadow-sm hover:bg-paper"
                >
                  <Mail size={13} /> Email
                </a>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Tab Navigation */}
      <nav aria-label="Case sections" className="sticky top-[72px] z-20 flex overflow-x-auto rounded-2xl border border-line bg-white/95 p-1.5 shadow-sm backdrop-blur print:hidden">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[14.5px] font-medium transition-colors ${
                active ? "bg-deep text-white shadow-sm" : "text-body hover:bg-paper hover:text-ink"
              }`}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    active ? "bg-white/20 text-white" : t.count === "New" ? "bg-amber-100 text-amber-800" : "bg-line/80 text-ink"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* =========================================================================
          TAB 1: OVERVIEW & CLINICAL DECISION
          ========================================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* Why this level banner */}
          {ev && (
            <section className="rounded-2xl border border-[#dfe7dd] bg-[#f2f6ef] p-5 sm:p-6 shadow-sm">
              <div className="flex gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#dcefe2]">
                  <Mark className="h-7 w-auto" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[17px] font-semibold text-ink">Why this triage level ({levelOf(c)})</p>
                    {ev.date && <span className="text-[13px] text-muted">Evaluated {fmtDate(ev.date)} · {fmtRelTime(ev.date)}</span>}
                  </div>
                  <ul className="mt-2 space-y-1.5 text-[15px] leading-snug">
                    {(c.task && c.task.status !== "closed" && c.task.id !== `${p.id}:${ev.session_id}`
                      ? [
                          ...c.task.reasons,
                          ev.intake || ev.informant_report
                            ? `Still open from ${fmtDate(c.task.created)}; a later report does not close it. Latest report: ${ev.reasons[0] ?? ev.level}`
                            : `Still open from ${fmtDate(c.task.created)}; a later check-in does not close it. Latest check-in: ${ev.reasons[0] ?? ev.level}`,
                        ]
                      : ev.reasons
                    ).map((r) => (
                      <li key={r} className="flex gap-2.5">
                        <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
                        <span>{r.replace(/->/g, "→")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Task Decision Actions */}
              <div className="mt-5 border-t border-[#d8e2d6] pt-4 print:hidden">
                <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wider text-leaf">Clinician Action</p>
                <TaskActions c={c} onRefer={openReferral} />
              </div>
            </section>
          )}

          {/* At-a-Glance Snapshot Cards (4 Key Pillars) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. The Concern */}
            <div className="flex flex-col justify-between rounded-2xl border border-line bg-white p-4 shadow-sm">
              <div>
                <p className="flex items-center justify-between text-[12.5px] font-semibold uppercase tracking-wider text-muted">
                  <span className="flex items-center gap-1.5 text-leaf"><MessageSquareText size={15} /> Concern</span>
                  <span>{fmtRelTime(c.concern.date)}</span>
                </p>
                <p className="mt-2 font-medium text-ink">Raised by {c.concern.raised_by.toLowerCase()}</p>
                <p className="mt-1 line-clamp-3 text-[13.5px] text-body">
                  {c.concern.in_their_words ? `“${c.concern.in_their_words}”` : "No narrative statement."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => switchTab("concern")}
                className="mt-3 inline-flex items-center gap-1 text-[13.5px] font-semibold text-leaf hover:underline"
              >
                View full concern <ArrowRight size={14} />
              </button>
            </div>

            {/* 2. Cognitive Performance */}
            <div className="flex flex-col justify-between rounded-2xl border border-line bg-white p-4 shadow-sm">
              <div>
                <p className="flex items-center justify-between text-[12.5px] font-semibold uppercase tracking-wider text-muted">
                  <span className="flex items-center gap-1.5 text-leaf"><ListChecks size={15} /> Cognition</span>
                  <span>{c.history.length} sessions</span>
                </p>
                <p className="mt-2 text-[26px] font-semibold tabular-nums text-ink">
                  {z?.composite != null ? fmtNum(z.composite) : "–"}
                  <span className="ms-1.5 text-[13px] font-normal text-muted">composite z</span>
                </p>
                <p className="mt-1 text-[13px] text-body">
                  {z?.domains ? `${Object.keys(z.domains).length} domains assessed vs norms` : "Baseline being built"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => switchTab("cognitive")}
                className="mt-3 inline-flex items-center gap-1 text-[13.5px] font-semibold text-leaf hover:underline"
              >
                Domain breakdown & trends <ArrowRight size={14} />
              </button>
            </div>

            {/* 3. Referral Tracking */}
            <div className="flex flex-col justify-between rounded-2xl border border-line bg-white p-4 shadow-sm">
              <div>
                <p className="flex items-center justify-between text-[12.5px] font-semibold uppercase tracking-wider text-muted">
                  <span className="flex items-center gap-1.5 text-leaf"><Route size={15} /> Referral</span>
                  <span>{referred ? "Active" : "None"}</span>
                </p>
                <p className="mt-2 font-semibold text-ink">
                  {referred ? STATE_LABEL[p.referrals[0].state] : "No referral sent"}
                </p>
                <p className="mt-1 text-[13px] text-body">
                  {referred ? (NAV.pathways[p.referrals[0].pathway] ?? p.referrals[0].pathway) : "Closed-loop tracking starts upon referral."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => switchTab("referral")}
                className="mt-3 inline-flex items-center gap-1 text-[13.5px] font-semibold text-leaf hover:underline"
              >
                Referral loop & letter <ArrowRight size={14} />
              </button>
            </div>

            {/* 4. Prevention & Risk */}
            <div className="flex flex-col justify-between rounded-2xl border border-line bg-white p-4 shadow-sm">
              <div>
                <p className="flex items-center justify-between text-[12.5px] font-semibold uppercase tracking-wider text-muted">
                  <span className="flex items-center gap-1.5 text-leaf"><HeartPulse size={15} /> Prevention</span>
                  <span>Lancet 2024</span>
                </p>
                <p className="mt-2 font-semibold text-ink">
                  {c.risk_context ? `${((c.risk_context.modifiable_factors_present as string[]) || []).length} modifiable factors` : "Risk screen"}
                </p>
                <p className="mt-1 text-[13px] text-body">
                  {c.prevention?.items?.length ? `${c.prevention.items.length} prevention plan targets` : "Evidence-based lifestyle rules"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => switchTab("referral")}
                className="mt-3 inline-flex items-center gap-1 text-[13.5px] font-semibold text-leaf hover:underline"
              >
                Care & prevention plan <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Assessment Drivers Table */}
          {ev && ev.drivers.length > 0 && (
            <Panel title="Assessment inputs & engine drivers" icon={ClipboardList} aside={<span className="text-[14px] text-body">Thresholds from config.py</span>}>
              <DriversTable drivers={ev.drivers} />
            </Panel>
          )}

          {/* Review packet (Med42 AI clinical summarizer) */}
          <Panel title="Clinical review packet" icon={ClipboardCheck} aside={<span className="text-[14px] text-body">Med42 fact-checked pre-read</span>}>
            <ReviewPacket pid={p.id} />
          </Panel>
        </div>
      )}

      {/* =========================================================================
          TAB 2: THE CONCERN & FAMILY REPORT
          ========================================================================= */}
      {activeTab === "concern" && (
        <div id="concern-section" className="space-y-5">
          {fac?.name && (
            <div className="rounded-2xl border border-leaf/30 bg-leaf/5 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-deep shadow-sm">
                  <Building2 size={20} className="text-leaf" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-semibold text-deep">{fac.name}</span>
                    {fac.area && (
                      <span className="rounded-full bg-leaf/15 px-2.5 py-0.5 text-[12px] font-medium text-leaf">
                        {fac.area}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13.5px] text-body">
                    Assigned Memory Clinic & Catchment · Clinical commitment: <b>Review and patient callback within 21 days</b>
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {con.phone && (
                      <a
                        href={`tel:${con.phone}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-leaf shadow-sm hover:bg-paper"
                      >
                        <Phone size={14} /> Call Participant ({con.phone})
                      </a>
                    )}
                    {con.email && (
                      <a
                        href={`mailto:${con.email}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] font-medium text-deep shadow-sm hover:bg-paper"
                      >
                        <Mail size={14} /> Send Email ({con.email})
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <Panel
            title="The concern in their words"
            icon={MessageSquareText}
            aside={<span className="text-[14px] text-body">Raised by {c.concern.raised_by} on {fmtDate(c.concern.date)} ({fmtRelTime(c.concern.date)})</span>}
          >
            {c.concern.in_their_words ? (
              <blockquote
                dir={p.language === "ar" ? "rtl" : "ltr"}
                lang={p.language}
                className={`rounded-2xl border-s-4 border-sand bg-sand-soft/30 p-5 text-ink ${
                  p.language === "ar" ? "text-[18px] leading-[2.1]" : "text-[16px] leading-relaxed"
                }`}
              >
                {c.concern.in_their_words}
              </blockquote>
            ) : (
              <p className="text-[15px] text-muted">No free-text concern recorded.</p>
            )}

            <p className="mt-3 text-[13.5px] italic text-body">{c.concern.attribution}</p>

            {/* Confirmed facts grid */}
            <dl className="mt-4 divide-y divide-line rounded-xl border border-line text-[15px]">
              {(
                [
                  ["When it started (onset)", c.concern.onset ?? "Not specified"],
                  ["How often (frequency)", c.concern.how_often ?? "Not specified"],
                  ["How much (severity)", c.concern.how_much ?? "Not specified"],
                  ["What has changed", c.concern.what_changed.join(", ") || "None recorded"],
                  ["Who now does what", c.concern.who_now_does_what.join("; ") || "None recorded"],
                  ["Urgent red flags reported", c.concern.red_flags_reported.join("; ") || "None"],
                  ["Confounders affecting memory", c.concern.confounders_reported.join("; ") || "None mentioned"],
                  ["Informant relation", c.concern.informant ? [c.concern.informant.relation, c.concern.informant.type].filter(Boolean).join(", ") : "None on file"],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="px-4 py-2.5 sm:grid sm:grid-cols-[220px_1fr] sm:gap-3">
                  <dt className="text-[13.5px] text-muted sm:text-[14.5px]">{k}</dt>
                  <dd className="font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            {/* Still missing checklist */}
            {c.concern.missing.length > 0 && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-amber-900">Information still missing</p>
                <ul className="mt-2 space-y-1.5">
                  {c.concern.missing.map((m) => (
                    <li key={m} className="flex items-center gap-2.5 text-[14.5px] text-amber-950">
                      <span className="h-4 w-4 shrink-0 rounded border border-amber-400 bg-white" aria-hidden /> {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          {/* Household task takeover */}
          {handoverRows(p).length > 0 && (
            <Panel title="Who does it now" icon={HandHelping} aside={<span className="text-[14px] text-body">Tasks the household has taken over</span>}>
              <Handover p={p} history={c.history} />
            </Panel>
          )}

          {/* Reports & follow-up concerns over time */}
          <ReportsOverTime c={c} />

          {/* Pre-approved family message */}
          <Panel title="Message to the family" icon={Send} aside={<span className="text-[14px] text-body">Requires clinician sign-off</span>}>
            <FamilyMessage pid={p.id} />
          </Panel>
        </div>
      )}

      {/* =========================================================================
          TAB 3: COGNITIVE ASSESSMENTS & DOMAINS
          ========================================================================= */}
      {activeTab === "cognitive" && (
        <div className="space-y-5">
          {/* Latest check-in by domain */}
          {z?.domains && (
            <Panel title="Latest check-in by cognitive domain" icon={ListChecks} aside={<span className="text-[14px] text-body">z against age & schooling norms · {fmtDate(ev?.date)}</span>}>
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[420px] border-separate border-spacing-0 text-[15.5px]">
                  <thead>
                    <tr>
                      <th className="rounded-l-lg bg-[#f5f5f2] px-4 py-2.5 text-left font-medium">Domain</th>
                      <th className="bg-[#f5f5f2] px-4 py-2.5 text-right font-medium">z</th>
                      <th className="rounded-r-lg bg-[#f5f5f2] px-4 py-2.5 text-left font-medium">Against population norms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(z.domains).map(([k, v]) => {
                      const w = Math.min(100, Math.abs(v) * 25);
                      return (
                        <tr key={k}>
                          <td className="border-b border-[#f0f0ec] px-4 py-2.5 font-medium">{DOMAIN_LABEL[k] ?? pretty(k)}</td>
                          <td className="border-b border-[#f0f0ec] px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{fmtNum(v)}</td>
                          <td className="border-b border-[#f0f0ec] px-4 py-2.5">
                            <span className="relative block h-2.5 w-44 rounded-full bg-[#efefeb]" aria-hidden>
                              <span className="absolute inset-y-0 left-1/2 w-px bg-muted/40" />
                              <span
                                className={`absolute inset-y-0 rounded-full ${v < -1.5 ? "bg-lv-review" : v < -1 ? "bg-lv-check" : "bg-leaf"}`}
                                style={v < 0 ? { right: "50%", width: `${w / 2}%` } : { left: "50%", width: `${w / 2}%` }}
                              />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {z.composite != null && (
                      <tr className="bg-paper/40">
                        <td className="px-4 py-3 font-semibold">Composite Score</td>
                        <td className="px-4 py-3 text-right font-mono text-[17px] font-bold tabular-nums text-deep">{fmtNum(z.composite)}</td>
                        <td className="px-4 py-3 text-[13.5px] text-muted">Weighted composite across all completed domains</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {/* Over time trend */}
          {c.history.some((h) => zOf(h)?.composite != null) && (
            <Panel title="Longitudinal cognitive trend" icon={LineChart} aside={<span className="text-[14px] text-body">Normalized against participant baseline</span>}>
              <Trend history={c.history} />
            </Panel>
          )}

          {/* Sessions table */}
          {c.history.length > 0 && (
            <Panel title="Recorded check-in sessions" icon={FileClock} aside={<span className="text-[14px] text-body">{c.history.length} sessions on file</span>}>
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[14.5px]">
                  <thead>
                    <tr>
                      {["Date", "Relative", "Channel", "Form", "Triage level", "Composite z", "Scored"].map((h, i, a) => (
                        <th
                          key={h}
                          className={`bg-[#f5f5f2] px-3.5 py-2.5 font-medium ${
                            h === "Composite z" ? "text-right" : "text-left"
                          } ${i === 0 ? "rounded-l-lg" : ""} ${i === a.length - 1 ? "rounded-r-lg" : ""}`}
                        >
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
                        <tr key={h.session_id} className="hover:bg-paper/40">
                          <td className="border-b border-[#f0f0ec] px-3.5 py-2.5 font-mono text-[13.5px]">{fmtDate(h.date)}</td>
                          <td className="border-b border-[#f0f0ec] px-3.5 py-2.5 text-[13px] text-muted">{fmtRelTime(h.date)}</td>
                          <td className="border-b border-[#f0f0ec] px-3.5 py-2.5">
                            {isIntake ? (h.concern_change?.first === false ? "Follow-up concern" : "Intake") : isFaq ? "Family questionnaire" : (h as unknown as { channel?: string }).channel ?? "app"}
                          </td>
                          <td className="border-b border-[#f0f0ec] px-3.5 py-2.5 font-mono">{form ?? "–"}</td>
                          <td className="border-b border-[#f0f0ec] px-3.5 py-2.5">
                            <LevelPill level={h.level} size="sm" />
                          </td>
                          <td className="border-b border-[#f0f0ec] px-3.5 py-2.5 text-right font-mono tabular-nums">
                            {comp != null ? fmtNum(comp) : "–"}
                          </td>
                          <td className="border-b border-[#f0f0ec] px-3.5 py-2.5 text-[13.5px]">
                            {isIntake ? (
                              <span className="text-muted">Concern only</span>
                            ) : isFaq ? (
                              <span className="text-muted">FAQ {h.informant?.score}/{h.informant?.max}</span>
                            ) : notScored ? (
                              <span className="text-lv-check">{notScored.replace("Session not scored: ", "Not scored: ")}</span>
                            ) : h.valid ? (
                              <span className="text-lv-stable font-medium">Valid</span>
                            ) : (
                              <span className="text-muted">No</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {/* Reference standard: Clinic MoCA */}
          <Panel title="Clinic MoCA (Reference assessment)" icon={Stethoscope} aside={<span className="text-[14px] text-body">Certified clinician administration</span>}>
            <MocaPanel pid={p.id} />
          </Panel>

          {/* Exploratory spatial route memory */}
          {((p as { exploratory?: unknown[] }).exploratory ?? []).length > 0 && (
            <Panel title="Souq route memory (Exploratory)" icon={MapPinned} aside={<span className="text-[14px] text-body">Early spatial route marker · not triaged</span>}>
              <table className="w-full text-[14.5px]">
                <thead>
                  <tr className="text-left text-[13px] text-muted">
                    <th className="pb-1.5 font-medium">Date</th>
                    <th className="pb-1.5 font-medium">Route span</th>
                    <th className="pb-1.5 font-medium">Steps right</th>
                    <th className="pb-1.5 font-medium">Time per step</th>
                    <th className="pb-1.5 font-medium">Form · language</th>
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
                Spatial route memory (spatial-span in market navigation scene) is among the earliest cognitive domains to show change. It is currently exploratory and validated alongside check-ins.
              </p>
            </Panel>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: REFERRAL & CARE PLAN
          ========================================================================= */}
      {activeTab === "referral" && (
        <div id="referrals" className="space-y-5">
          {referring && <ReferralForm c={c} onClose={() => setReferring(false)} />}

          {/* Active referrals or referral CTA */}
          {p.referrals.length > 0 ? (
            p.referrals.map((r, i) => <ReferralCard key={r.id} r={r} id={i === 0 ? "referrals-card" : undefined} />)
          ) : (
            <Panel id="referrals-card" title="Closed-loop referral tracker" icon={Route} aside={<span className="text-[14px] text-body">7-step closed loop</span>}>
              <p className="text-[15px] text-body">No referral has been dispatched for this case yet.</p>
              {c.task?.status === "open" && !referring && (
                <button type="button" onClick={openReferral} className={`${btnClass.primary} mt-3 print:hidden`}>
                  <Stethoscope size={17} /> Confirm concern and initiate referral
                </button>
              )}
            </Panel>
          )}

          {/* Clinical referral letter draft */}
          <Panel title="Referral letter draft" icon={FileText} aside={<span className="text-[14px] text-body">Clinician review & export · Grounded in confirmed record</span>}>
            <ReferralDraft pid={p.id} caseData={c} />
          </Panel>

          {/* Lancet Commission 2024 modifiable risk factors & reversible causes */}
          {(c.risk_context || c.prevention?.items?.length) && (
            <Panel title="Risk factors & prevention plan" icon={HeartPulse} aside={<span className="text-[14px] text-body">Lancet Commission 2024</span>}>
              {c.risk_context && <RiskContext rc={c.risk_context} />}
              {c.prevention?.items?.length ? (
                <div className={c.risk_context ? "mt-5 border-t border-line pt-4" : ""}>
                  <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-leaf">Individualized lifestyle prevention plan</p>
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
        </div>
      )}

      {/* =========================================================================
          TAB 5: TIMELINE & AUDIT TRAIL
          ========================================================================= */}
      {activeTab === "timeline" && (
        <div id="activity" className="space-y-5">
          <Panel
            title="Case activity & tamper-evident audit trail"
            icon={FileClock}
            aside={
              <button type="button" onClick={exportFhir} className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-leaf hover:underline">
                <Download size={14} /> Export FHIR Bundle
              </button>
            }
          >
            {activity === null ? (
              <p className="text-[14.5px] text-muted">Loading audit log…</p>
            ) : activity.length === 0 ? (
              <p className="text-[14.5px] text-muted">Nothing recorded for this case yet{intakeOnly ? "" : " in this session"}.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-[13px] text-muted">
                  Cryptographically chained with SHA-256 integrity verification. Every clinician action, assessment submission, and triage change is auditable.
                </p>
                <ul className="divide-y divide-line">
                  {activity.map((a, i) => {
                    const note = (a.detail?.note as string) || (a.detail?.reason as string) || "";
                    return (
                      <li key={a.ts + i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-3 text-[14.5px]">
                        <span className="w-[180px] shrink-0 font-mono text-[12.5px] text-muted">
                          {fmtTime(a.ts)} <span className="text-body font-sans">({fmtRelTime(a.ts)})</span>
                        </span>
                        <span className="font-semibold text-ink">{readable(a.action)}</span>
                        <span className="text-muted">· {a.actor}</span>
                        {note && <span className="w-full text-[13.5px] text-body sm:ms-[192px]">“{note}”</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Footer Disclaimer */}
      <p className="px-1 text-[13px] text-muted">
        MemBrain flags risk and change. It does not diagnose. Synthetic data demonstration.
      </p>
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
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-leaf">Reversible causes to screen</p>
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
