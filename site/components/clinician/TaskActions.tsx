"use client";

// What a clinician can do with a case's review task. Shared by the queue and the case page.
import { useState } from "react";
import Link from "next/link";
import { Check, Info, RotateCcw, Route, Stethoscope, X } from "lucide-react";
import { btnClass } from "./parts";
import { useWorkspace } from "./WorkspaceProvider";
import { caseHref, fmtTime, HELD, levelOf } from "@/lib/workspace/derive";
import type { Case } from "@/lib/workspace/types";

const DONE_LABEL: Record<string, string> = {
  confirm_concern: "Concern confirmed",
  refer: "Referred",
  dismiss: "Closed: not a concern",
  request_repeat: "Repeat check-in requested",
  order_investigations: "Investigations ordered",
};

export function TaskActions({ c, onRefer }: { c: Case; onRefer?: () => void }) {
  const { act } = useWorkspace();
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const task = c.task;
  const last = task?.actions[task.actions.length - 1];
  const referred = c.participant.referrals.length > 0;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      setDismissing(false);
      setReason("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (last && task?.status === "closed") {
    return (
      <p className="flex flex-wrap items-center gap-2.5 rounded-xl bg-lv-stable-soft px-4 py-3 text-[15px] font-medium text-lv-stable">
        <Check size={18} /> {DONE_LABEL[last.action] ?? last.action}
        {last.note && <span className="font-normal text-ink">· “{last.note}”</span>}
        <span className="font-normal text-body">· {fmtTime(last.ts)}</span>
      </p>
    );
  }
  if (referred) {
    return (
      <p className="flex items-center gap-3 rounded-xl bg-[#f6f6f4] px-4 py-3 text-[15.5px] text-body">
        <Info size={19} strokeWidth={1.8} className="shrink-0 text-ink" /> Already referred. The referral is tracked until follow-up is documented.
      </p>
    );
  }
  if (!task || !HELD.includes(levelOf(c))) {
    const next = c.latest?.next_action;
    return (
      <p className="flex items-center gap-3 rounded-xl bg-[#f6f6f4] px-4 py-3 text-[15.5px] text-body">
        <Info size={19} strokeWidth={1.8} className="shrink-0 text-ink" />
        {levelOf(c) === "CHECK_AGAIN"
          ? "No clinician task. The engine asks for a repeat check-in with a reason; it opens a task only if the change holds."
          : next === "first_session"
            ? "No clinician task. The first check-in comes next."
            : "No clinician task. Nothing needs doing now."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {last && (
        <p className="flex items-center gap-2 text-[14px] text-body">
          <RotateCcw size={15} /> {DONE_LABEL[last.action] ?? last.action} · {fmtTime(last.ts)}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        {onRefer ? (
          <button type="button" disabled={busy} onClick={onRefer} className={btnClass.primary}>
            <Stethoscope size={17} /> Confirm concern and refer
          </button>
        ) : (
          <Link href={caseHref(c.participant.id, "#refer")} className={btnClass.primary}>
            <Stethoscope size={17} /> Confirm concern and refer
          </Link>
        )}
        <button type="button" disabled={busy} onClick={() => run(() => act(task.id, "request_repeat", "Repeat check-in before deciding"))} className={btnClass.secondary}>
          <RotateCcw size={16} /> Check again first
        </button>
        <button type="button" disabled={busy} onClick={() => run(() => act(task.id, "order_investigations", "Bloods and reversible-cause screen"))} className={btnClass.secondary}>
          <Route size={16} /> Order investigations
        </button>
        <button type="button" disabled={busy} onClick={() => setDismissing((d) => !d)} className={`${btnClass.secondary} text-body`}>
          <X size={16} /> Not a concern
        </button>
      </div>
      {dismissing && (
        <form
          className="rounded-xl border border-line bg-paper p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => act(task.id, "dismiss", reason.trim()));
          }}
        >
          <label className="block text-[14px] font-medium" htmlFor={`dismiss-${task.id}`}>
            Why is this not a concern? A reason is required and goes into the audit log.
          </label>
          <textarea id={`dismiss-${task.id}`} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-[15px] outline-none focus:border-leaf" />
          <div className="mt-2 flex gap-2">
            <button type="submit" disabled={busy || !reason.trim()} className={btnClass.primary}>
              Close the alert
            </button>
            <button type="button" onClick={() => setDismissing(false)} className={btnClass.secondary}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {err && <p className="text-[14px] text-lv-review">{err}</p>}
    </div>
  );
}
