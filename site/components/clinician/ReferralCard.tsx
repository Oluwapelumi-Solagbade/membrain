"use client";

// One referral: where it is in the closed loop, its history, the moves the navigator allows next (a reason is
// required where the navigator says so), and the next-steps pack for the family. Used by the case and
// referrals pages.
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FileText, Route } from "lucide-react";
import { btnClass, Panel } from "./parts";
import { useWorkspace } from "./WorkspaceProvider";
import { caseHref, fmtDate, TODAY } from "@/lib/workspace/derive";
import { LOOP, NAV, nav, serviceById, STALLED, STATE_LABEL, stateTone } from "@/lib/workspace/navigator";
import type { Referral, ReferralState } from "@/lib/workspace/types";

export function ReferralState({ state }: { state: ReferralState }) {
  return <span className={`whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold ${stateTone(state)}`}>{STATE_LABEL[state] ?? state}</span>;
}

/** The seven-step loop as a bar: done steps, the current step, and what is left. */
export function LoopBar({ r }: { r: Referral }) {
  const reached = new Set(r.history.map((h) => h.state));
  return (
    <ol className="grid grid-cols-7 gap-1.5" aria-label="Referral loop">
      {LOOP.map((s) => {
        const done = reached.has(s);
        const now = r.state === s;
        return (
          <li key={s} className="min-w-0">
            <span className={`block h-1.5 rounded-full ${now ? "bg-deep" : done ? "bg-leaf/60" : "bg-line"}`} />
            <span className={`mt-1.5 block truncate text-[11.5px] ${now ? "font-semibold text-ink" : "text-muted"}`} title={STATE_LABEL[s]}>
              {STATE_LABEL[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ReferralCard({ r, showPerson = false, id }: { r: Referral; showPerson?: boolean; id?: string }) {
  const { advance } = useWorkspace();
  const [next, setNext] = useState<ReferralState | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [packLang, setPackLang] = useState<"en" | "ar" | null>(null);
  const svc = serviceById(r.service_id);
  const allowed = NAV.transitions[r.state] ?? [];
  const needsReason = (s: ReferralState) => NAV.needs_reason.includes(s);
  const stalled = STALLED.includes(r.state);
  const lastDate = r.history[r.history.length - 1]?.date;
  const daysInState = lastDate ? nav.days(lastDate, TODAY) : null;

  const move = async (s: ReferralState, why = "") => {
    setBusy(true);
    setErr(null);
    try {
      await advance(r.id, s, TODAY, why);
      setNext(null);
      setReason("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pack = packLang ? nav.pack(r, svc, packLang) : null;

  return (
    <Panel id={id} title={showPerson ? `Referral · ${r.participant_id}` : "Referral"} icon={Route} aside={<ReferralState state={r.state} />}>
      <p className="text-[15.5px]">
        <b>{NAV.pathways[r.pathway] ?? r.pathway}</b> · {svc?.name ?? "Service to be assigned"} · <span className={r.urgency === "urgent" ? "font-medium text-lv-urgent" : ""}>{r.urgency}</span>
      </p>
      {r.reason && <p className="mt-1 text-[14px] text-body">Reason: {r.reason}</p>}
      <div className="mt-4">
        <LoopBar r={r} />
      </div>
      {stalled && <p className="mt-3 text-[14px] text-lv-review">This referral has stalled ({STATE_LABEL[r.state].toLowerCase()}). The navigator follows it up.</p>}
      {daysInState != null && !NAV.closed.includes(r.state) && (
        <p className="mt-2 text-[13.5px] text-muted">
          In this step for {daysInState} day{daysInState === 1 ? "" : "s"} · since {fmtDate(lastDate)}
        </p>
      )}

      <ul className="mt-4 space-y-1 text-[14px] text-body">
        {r.history.map((h, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-[96px] shrink-0 font-mono text-[12.5px] text-muted">{h.date}</span>
            <span>
              {STATE_LABEL[h.state] ?? h.state}
              {h.by && <span className="text-muted"> · {h.by}</span>}
              {h.reason && <span className="text-muted"> · “{h.reason}”</span>}
            </span>
          </li>
        ))}
      </ul>

      {allowed.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-leaf">Record the next step</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {allowed.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => (needsReason(s) ? setNext(next === s ? null : s) : move(s))}
                className={`${STALLED.includes(s) || s === "cancelled" ? btnClass.secondary + " text-body" : btnClass.secondary}`}
              >
                {STATE_LABEL[s]}
                {needsReason(s) && <span className="text-[12px] text-muted">· reason</span>}
              </button>
            ))}
          </div>
          {next && (
            <form
              className="mt-3 rounded-xl border border-line bg-paper p-3"
              onSubmit={(e) => {
                e.preventDefault();
                move(next, reason.trim());
              }}
            >
              <label className="block text-[14px] font-medium" htmlFor={`reason-${r.id}`}>
                Why “{STATE_LABEL[next].toLowerCase()}”? The navigator needs a reason for this step.
              </label>
              <input id={`reason-${r.id}`} value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-[15px] outline-none focus:border-leaf" />
              <div className="mt-2 flex gap-2">
                <button type="submit" disabled={busy || !reason.trim()} className={btnClass.primary}>
                  Record
                </button>
                <button type="button" onClick={() => setNext(null)} className={btnClass.secondary}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          {err && <p className="mt-2 text-[14px] text-lv-review">{err}</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <span className="flex items-center gap-2 text-[14px] text-body">
          <FileText size={16} /> Next-steps pack for the family:
        </span>
        <button type="button" onClick={() => setPackLang(packLang === "en" ? null : "en")} className={`rounded-lg px-3 py-1.5 text-[14px] font-medium ${packLang === "en" ? "bg-deep text-white" : "bg-[#f1f1ee] hover:bg-[#e9e9e5]"}`}>
          English
        </button>
        <button type="button" lang="ar" onClick={() => setPackLang(packLang === "ar" ? null : "ar")} className={`rounded-lg px-3 py-1.5 text-[15px] font-medium ${packLang === "ar" ? "bg-deep text-white" : "bg-[#f1f1ee] hover:bg-[#e9e9e5]"}`}>
          العربية
        </button>
        {showPerson && (
          <Link href={caseHref(r.participant_id, "#referrals")} className="ms-auto inline-flex items-center gap-1 text-[14px] font-medium text-leaf hover:underline">
            Open case <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
      {pack && (
        <div dir={packLang === "ar" ? "rtl" : "ltr"} lang={packLang ?? "en"} className="mt-3 rounded-xl border border-line bg-paper p-4">
          <p className="font-semibold">{pack.title}</p>
          <ul className="mt-2 space-y-1.5 text-[14.5px] leading-relaxed">
            {pack.sections.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
