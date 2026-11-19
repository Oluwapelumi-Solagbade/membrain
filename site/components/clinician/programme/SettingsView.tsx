"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Database, Download, History, Key, Mic, RefreshCw, RotateCcw, SlidersHorizontal } from "lucide-react";
import { PageHeader, Panel, btnClass, downloadText, toCsv } from "../parts";
import { useWorkspace } from "../WorkspaceProvider";
import { Fact, Note, selectClass } from "./common";
import engineData from "@/lib/generated/engine-data.json";
import { config } from "@/lib/mb";
import { caseHref, fmtTime } from "@/lib/workspace/derive";
import type { AuditEntry } from "@/lib/workspace/types";
import { detectSpeech, getDirectAzureKey, setDirectAzureKey, type Speech } from "@/lib/voice";

const C = config as unknown as Record<string, unknown> & {
  REVIEW_TARGET_DAYS: Record<string, number>;
  RED_FLAGS: Record<string, string>;
  CONCERN_COGNITIVE_DOMAINS: string[];
  REPEAT_WEEKS: number[];
  TRIGGER_DOMAINS: string[];
  DOMAINS: Record<string, unknown>;
};
const ITEMS_VERSION = (engineData.items as unknown as { ITEM_BANK_VERSION: string }).ITEM_BANK_VERSION;
const DOMAIN_NAME: Record<string, string> = { memory_immediate: "word learning", memory_delayed: "delayed word recall", fluency: "word generation", story_recall: "story recall", judgement: "everyday judgement" };

type Row = { key: string; label: string; value: string; why: string };
const v = (k: string) => C[k];
const z = (k: string) => `${Number(v(k)).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}`;

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Review targets",
    rows: [
      { key: "REVIEW_TARGET_DAYS.URGENT", label: "Urgent review", value: `${C.REVIEW_TARGET_DAYS.URGENT} days`, why: "A clinician sees an urgent case within this time." },
      { key: "REVIEW_TARGET_DAYS.CLINICIAN_REVIEW", label: "Clinician review", value: `${C.REVIEW_TARGET_DAYS.CLINICIAN_REVIEW} days`, why: "A held case is reviewed within this time." },
    ],
  },
  {
    title: "A concern raised at intake",
    rows: [
      { key: "CONCERN_REVIEW_MIN_ACTIVITIES", label: "Lost independence", value: `${v("CONCERN_REVIEW_MIN_ACTIVITIES")} or more activities`, why: "A memory or thinking concern with this many everyday activities now done by someone else goes to a clinician at intake, without waiting for a baseline. Provisional, pending clinical sign-off." },
      { key: "CONCERN_COGNITIVE_DOMAINS", label: "Counts as memory or thinking", value: C.CONCERN_COGNITIVE_DOMAINS.join(", "), why: "Only these reported changes trigger the rule above. A memory or thinking concern raised by a healthcare professional also goes straight to review." },
      { key: "IQCODE_CUTOFF", label: "Informant questionnaire cutoff", value: `above ${v("IQCODE_CUTOFF")}`, why: "IQCODE-16 above this suggests functional decline (best reported Arabic cutoff)." },
      { key: "IQCODE_RISE", label: "New functional loss", value: `rise of ${v("IQCODE_RISE")}`, why: "A rise this large since the last informant report, ending above the cutoff, is urgent." },
    ],
  },
  {
    title: "Building a baseline",
    rows: [
      { key: "BASELINE_SESSIONS", label: "Sessions for a baseline", value: String(v("BASELINE_SESSIONS")), why: "Valid check-ins needed before change is judged against the person's own baseline." },
      { key: "BASELINE_MAX_SESSIONS", label: "Most sessions in a baseline", value: String(v("BASELINE_MAX_SESSIONS")), why: "The baseline uses at most this many early check-ins." },
      { key: "FIRST_VISIT_REVIEW_Z", label: "Very low first visit", value: `z ≤ ${z("FIRST_VISIT_REVIEW_Z")}`, why: "A very low first score goes to review without waiting for a baseline." },
      { key: "LOW_BASELINE_Z", label: "Low baseline", value: `z < ${z("LOW_BASELINE_Z")}`, why: "A baseline this far below norms for age and schooling goes to review." },
    ],
  },
  {
    title: "Detecting change",
    rows: [
      { key: "RCI_CHECK", label: "Overall change", value: `RCI ≤ ${z("RCI_CHECK")}`, why: "Overall decline beyond measurement noise (one-sided 95%)." },
      { key: "RCI_DOMAIN_CHECK", label: "Change in one task", value: `RCI ≤ ${z("RCI_DOMAIN_CHECK")}`, why: "A stricter threshold for a single task." },
      { key: "RCI_LARGE", label: "Large decline", value: `RCI ≤ ${z("RCI_LARGE")}`, why: "Decline this large is urgent." },
      { key: "RAPID_DROP_Z", label: "Rapid drop", value: `${z("RAPID_DROP_Z")} z within 120 days`, why: "A composite drop this big against baseline within about four months of it is urgent." },
      { key: "REQUIRE_CONFIRMATION", label: "Confirm on repeat", value: v("REQUIRE_CONFIRMATION") ? "Yes" : "No", why: "A single unconfirmed decline never opens a review; a repeat check-in comes first." },
      { key: "REPEAT_WEEKS", label: "Repeat check-in", value: `after ${C.REPEAT_WEEKS.join("–")} weeks`, why: "Scheduling: when 'check again' asks for the repeat." },
      { key: "TRIGGER_DOMAINS", label: "Tasks that can trigger alone", value: C.TRIGGER_DOMAINS.map((d) => DOMAIN_NAME[d] ?? d).join(", "), why: "Other tasks are shown as context; coarse scales are too noisy to trigger on their own." },
      { key: "ROUTINE_MONTHS", label: "Routine check-in", value: `every ${v("ROUTINE_MONTHS")} months`, why: "Scheduling: how often a stable person checks in." },
    ],
  },
  {
    title: "Recording quality",
    rows: [
      { key: "AUDIO_MIN_SNR_DB", label: "Background noise", value: `≥ ${v("AUDIO_MIN_SNR_DB")} dB signal-to-noise`, why: "Noisier recordings are not scored; the person is asked to repeat." },
      { key: "AUDIO_MAX_CLIPPING", label: "Clipping", value: `≤ ${Number(v("AUDIO_MAX_CLIPPING")) * 100}% of samples`, why: "Distorted recordings are not scored." },
      { key: "AUDIO_MIN_SPEECH_RATIO", label: "Speech in the recording", value: `≥ ${Number(v("AUDIO_MIN_SPEECH_RATIO")) * 100}%`, why: "Mostly silent recordings are not scored." },
      { key: "AUDIO_MIN_DURATION_S", label: "Length", value: `≥ ${v("AUDIO_MIN_DURATION_S")} s`, why: "Very short recordings are not scored." },
    ],
  },
  {
    title: "Things that can explain a change",
    rows: [
      { key: "PHQ2_CUTOFF", label: "Low mood (PHQ-2)", value: `≥ ${v("PHQ2_CUTOFF")}`, why: "A positive mood screen makes a change 'check again' rather than review." },
      { key: "GAD2_CUTOFF", label: "Anxiety (GAD-2)", value: `≥ ${v("GAD2_CUTOFF")}`, why: "A positive anxiety screen is treated the same way." },
      { key: "SLEEP_HOURS_LOW", label: "Poor sleep", value: `< ${v("SLEEP_HOURS_LOW")} hours`, why: "Short sleep in the past week is a possible explanation; the check-in is repeated once sleep improves." },
    ],
  },
];

const looksLikeCase = (target: string) => (/^MB-[A-Z0-9]+(:|$)/.test(target) ? target.split(":")[0] : null);
const detailText = (d: Record<string, unknown>) =>
  Object.entries(d ?? {})
    .filter(([, x]) => x !== "" && x != null && !(Array.isArray(x) && !x.length))
    .map(([k, x]) => `${k.replace(/_/g, " ")}: ${typeof x === "object" ? JSON.stringify(x) : String(x)}`)
    .join(" · ");

export function SettingsView() {
  const { mode, base, ready, reset, audit, cases } = useWorkspace();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [log, setLog] = useState<AuditEntry[] | null>(null);
  const [logErr, setLogErr] = useState<string | null>(null);
  const [action, setAction] = useState("all");

  const loadLog = useCallback(async () => {
    setLogErr(null);
    try {
      const entries = await audit();
      setLog([...entries].sort((a, b) => (a.ts < b.ts ? 1 : -1)));
    } catch (e) {
      setLogErr(e instanceof Error ? e.message : String(e));
    }
  }, [audit]);

  // Reload the log once the backend is known, and again whenever the cases change (an action elsewhere).
  useEffect(() => {
    if (ready) void loadLog(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [ready, cases, loadLog]);

  const doReset = async () => {
    setBusy(true);
    try {
      await reset();
      setDone(mode === "server" ? "The server's demo data was reset." : "This browser's saved changes were cleared.");
      setConfirming(false);
      await loadLog();
    } finally {
      setBusy(false);
    }
  };

  const actions = [...new Set((log ?? []).map((e) => e.action))].sort();
  const shown = (log ?? []).filter((e) => action === "all" || e.action === action);
  const exportLog = () =>
    downloadText("membrain-audit-log.csv", toCsv([["Time", "Actor", "Action", "Target", "Detail"], ...shown.map((e) => [e.ts, e.actor, e.action, e.target, detailText(e.detail)])]), "text/csv");

  return (
    <>
      <PageHeader title="Settings" sub="Where the data lives, the thresholds every level comes from, and who did what" />

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel title="Data source" icon={Database}>
          <Fact k="Mode" v={mode === "server" ? "Live: MemBrain server" : mode === "browser" ? "Demo: in this browser" : "Connecting…"} />
          <Fact k="Server address" v={mode === "server" ? base || "This site's own server" : "None answered"} />
          <Fact k="Engine" v={`${C.ENGINE_VERSION as string}`} hint={`Norms ${C.NORMS_VERSION as string} · item bank ${ITEMS_VERSION}`} />
          <p className="mt-3 text-[14px] leading-relaxed text-body">
            {mode === "server"
              ? "Every action goes to the MemBrain API and into its audit log. The demo server keeps data in memory, so a restart also resets it."
              : "No MemBrain server answered, so the same engine runs here and changes are saved in this browser only. Nothing is sent anywhere."}
          </p>
          <div className="mt-4 border-t border-line pt-4">
            {done && <p className="mb-3 rounded-xl bg-lv-stable-soft px-3 py-2 text-[14px] text-lv-stable">{done}</p>}
            {!confirming ? (
              <button type="button" onClick={() => setConfirming(true)} className={btnClass.secondary}>
                <RotateCcw size={16} /> Reset demo data
              </button>
            ) : (
              <div className="rounded-xl border border-lv-review/25 bg-lv-review-soft p-3">
                <p className="text-[14.5px]">
                  {mode === "server"
                    ? "This resets the server's in-memory store for everyone using it: concerns raised, actions, referral changes and the audit log go back to the starting cohort."
                    : "This clears every change saved in this browser: concerns raised, actions, referral changes and the audit log."}{" "}
                  It cannot be undone.
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={busy} onClick={doReset} className={btnClass.danger}>
                    Yes, reset
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className={btnClass.secondary}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </Panel>

        <SpeechConfigPanel base={base} />
      </div>

      <div className="mt-5">
        <Panel title="Urgent warning signs" icon={SlidersHorizontal} aside={<span className="text-[13.5px] text-body">Any one means urgent</span>}>
          <ul className="space-y-1.5 text-[14.5px]">
            {Object.entries(C.RED_FLAGS).map(([k, label]) => (
              <li key={k} className="flex gap-2.5">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-lv-urgent" />
                {label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13.5px] text-body">These never wait for testing: the emergency steps show and a clinician is alerted.</p>
        </Panel>
      </div>

      <div className="mt-5">
        <Panel title="Thresholds" icon={SlidersHorizontal} aside={<span className="text-[13.5px] text-body">Read-only · from membrain/config.py</span>}>
          <Note>
            Every threshold comes from <code className="font-mono text-[13px]">membrain/config.py</code>, the single source for both the Python and the in-browser engine. Changing one means changing that file, re-running the parity tests and releasing a new engine version, so they are not editable here.
          </Note>
          <div className="mt-4 grid gap-x-8 gap-y-6 lg:grid-cols-2">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-leaf">{g.title}</p>
                <dl className="mt-1">
                  {g.rows.map((r) => (
                    <div key={r.key} className="border-b border-[#f0f0ec] py-2.5 last:border-b-0">
                      <div className="flex items-baseline justify-between gap-4">
                        <dt className="text-[14.5px] font-medium">{r.label}</dt>
                        <dd className="shrink-0 text-right font-mono text-[13.5px]">{r.value}</dd>
                      </div>
                      <p className="mt-0.5 text-[13px] leading-snug text-body">{r.why}</p>
                      <p className="mt-0.5 font-mono text-[11.5px] text-muted">{r.key}</p>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-5">
        <Panel
          title="Audit log"
          icon={History}
          aside={
            <div className="flex flex-wrap items-center gap-2">
              <label>
                <span className="sr-only">Action</span>
                <select value={action} onChange={(e) => setAction(e.target.value)} className={selectClass}>
                  <option value="all">All actions ({log?.length ?? 0})</option>
                  {actions.map((a) => (
                    <option key={a} value={a}>
                      {a.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => void loadLog()} className={btnClass.secondary} aria-label="Reload the audit log">
                <RefreshCw size={16} />
              </button>
              <button type="button" onClick={exportLog} disabled={!shown.length} className={btnClass.secondary}>
                <Download size={16} /> CSV
              </button>
            </div>
          }
        >
          {logErr && <p className="text-[14px] text-lv-review">{logErr}</p>}
          {log === null && !logErr && <p className="text-[14.5px] text-muted">Loading the audit log…</p>}
          {log !== null && shown.length === 0 && (
            <p className="text-[14.5px] text-muted">{log.length ? "No entries for this action." : "Nothing recorded yet. Actions on cases, referrals and concerns appear here."}</p>
          )}
          {shown.length > 0 && (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[14px]">
                <thead>
                  <tr className="text-left text-[13px] text-body">
                    {["Time", "Who", "Action", "Record", "Detail"].map((h) => (
                      <th key={h} className="bg-[#f5f5f2] px-3 py-2.5 font-medium first:rounded-l-lg last:rounded-r-lg">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, 200).map((e, i) => {
                    const pid = looksLikeCase(e.target);
                    return (
                      <tr key={e.ts + i}>
                        <td className="whitespace-nowrap border-b border-[#f0f0ec] px-3 py-2 text-body">{fmtTime(e.ts)}</td>
                        <td className="border-b border-[#f0f0ec] px-3 py-2">{e.actor}</td>
                        <td className="border-b border-[#f0f0ec] px-3 py-2 font-medium">{e.action.replace(/_/g, " ")}</td>
                        <td className="whitespace-nowrap border-b border-[#f0f0ec] px-3 py-2">
                          {pid ? (
                            <Link href={caseHref(pid)} className="font-mono text-[13px] text-leaf hover:underline">
                              {e.target}
                            </Link>
                          ) : (
                            <span className="font-mono text-[13px]">{e.target}</span>
                          )}
                        </td>
                        <td className="border-b border-[#f0f0ec] px-3 py-2 text-[13px] text-body">{detailText(e.detail) || "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function SpeechConfigPanel({ base }: { base: string | null }) {
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [key, setKey] = useState("");
  const [region, setRegion] = useState("uaenorth");
  const [msg, setMsg] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const direct = getDirectAzureKey();
    if (direct) {
      setKey(direct.key);
      setRegion(direct.region);
    }
    void detectSpeech(base).then(setSpeech);
  }, [base]);

  const save = async () => {
    setDirectAzureKey(key, region);
    const updated = await detectSpeech(base);
    setSpeech(updated);
    setMsg(key.trim() ? "Azure Speech key saved! Speech engine is now Azure AI Speech." : "Key cleared. Reverted to standard detection.");
    setTimeout(() => setMsg(null), 4000);
  };

  const clear = async () => {
    setKey("");
    setDirectAzureKey("", "uaenorth");
    const updated = await detectSpeech(base);
    setSpeech(updated);
    setMsg("Cleared custom Azure Speech key.");
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <Panel
      title="Speech & Voice AI"
      icon={Mic}
      aside={
        <span
          className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
            speech?.engine === "azure"
              ? "bg-lv-stable-soft text-lv-stable"
              : speech?.engine === "local"
                ? "bg-deep/10 text-deep"
                : "bg-lv-hold-soft text-lv-hold"
          }`}
        >
          {speech?.engine === "azure" ? "Azure AI Speech Active" : speech?.engine === "local" ? "Gulf Whisper Active" : "Browser Speech Active"}
        </span>
      }
    >
      <Fact k="Active engine" v={speech?.label ?? "Detecting…"} />
      <Fact k="Target region" v={speech?.region ?? region} />
      {speech?.key && <Fact k="Key source" v="Direct browser key (localStorage)" />}

      <div className="mt-4 space-y-3 border-t border-line pt-4">
        <label className="block text-[13.5px] font-medium text-ink">
          Azure AI Speech Key
          <div className="mt-1.5 flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Paste Azure Speech Key…"
              className="flex-1 rounded-xl border border-line bg-panel px-3 py-2 font-mono text-[13px] text-ink placeholder:text-muted focus:border-deep focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="rounded-xl border border-line px-3 py-2 text-[12px] text-body hover:bg-neutral-100"
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <label className="block text-[13.5px] font-medium text-ink">
          Azure Region
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g. uaenorth"
            className="mt-1.5 w-full rounded-xl border border-line bg-panel px-3 py-2 font-mono text-[13px] text-ink focus:border-deep focus:outline-none"
          />
        </label>

        {msg && <p className="rounded-xl bg-lv-stable-soft px-3 py-2 text-[13px] text-lv-stable">{msg}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={save} className={btnClass.primary}>
            Save & Activate Azure
          </button>
          {key && (
            <button type="button" onClick={clear} className={btnClass.secondary}>
              Clear Key
            </button>
          )}
        </div>

        <p className="text-[12.5px] leading-relaxed text-body">
          Tip: You can also set <code className="font-mono text-[12px] text-ink">AZURE_SPEECH_KEY</code> in GitHub Repository Secrets (for GitHub Pages builds) or Hugging Face Space secrets to enable Azure Speech across all devices without entering it here.
        </p>
      </div>
    </Panel>
  );
}
