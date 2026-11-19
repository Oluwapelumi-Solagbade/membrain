"use client";

import { useState } from "react";
import { Loader2, Lock, X } from "lucide-react";
import { btnClass } from "../parts";
import { useWorkspace } from "../WorkspaceProvider";
import type { VaultEntry } from "@/lib/workspace/types";

const CHANNEL: Record<string, string> = { whatsapp: "WhatsApp", app: "MemBrain app", phone: "Guided phone call" };

/** Break-glass re-identification for follow-up contact: a reason is required, and the opening is written to the audit log.
 *  Names and numbers live only in the identity vault; the case itself shows the pseudonymous ID. */
export function ContactDetails({ pid, onClose }: { pid: string; onClose: () => void }) {
  const { reidentify } = useWorkspace();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<VaultEntry | null>(null);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const entry = await reidentify(pid, reason.trim());
      setV(entry);
      if (typeof window !== "undefined" && entry.identity?.full_name?.trim()) {
        try {
          const fn = entry.identity.full_name.trim();
          window.sessionStorage.setItem(`membrain.registered_name.${pid}`, fn);
          window.localStorage.setItem(`membrain.registered_name.${pid}`, fn);
        } catch { /* storage disabled */ }
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setError(/no identity|not found|no contact/i.test(m) ? "No contact details on file for this person (synthetic records have none)." : m);
    } finally {
      setBusy(false);
    }
  };

  const rows: [string, string | null | undefined][] = v
    ? [
        ["Name", v.identity?.full_name],
        ["Emirates ID or MRN", v.identity?.national_id],
        ["Mobile", v.identity?.phone],
        ["Preferred channel", v.identity ? CHANNEL[v.identity.preferred_channel] ?? v.identity.preferred_channel : null],
        ["Informant", v.informant ? `${v.informant.name} (${v.informant.relation})` : null],
        ["Informant's mobile", v.informant?.phone],
      ]
    : [];

  return (
    <section className="rounded-2xl border border-[#d6dde9] bg-[#f6f8fc] p-5 print:hidden" aria-label="Contact details">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[17px] font-semibold"><Lock size={18} className="text-[#2b3a55]" /> Contact details</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-body hover:bg-white"><X size={18} /></button>
      </div>
      {!v ? (
        <>
          <p className="mt-1.5 text-[14.5px] leading-snug text-[#2b3a55]">Kept in the identity vault. Showing them needs a reason, and is written to the audit log under your account.</p>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[14px] font-medium">Reason</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. arrange the follow-up call" autoFocus
              className="h-11 w-full rounded-xl border border-[#d7ddda] bg-white px-3.5 text-[15.5px] outline-none focus:border-deep focus:shadow-[0_0_0_4px_rgb(15_63_44/0.10)]" />
          </label>
          {error && <p className="mt-2 text-[14px] font-medium text-lv-review">{error}</p>}
          <button type="button" onClick={open} disabled={!reason.trim() || busy} className={`${btnClass.primary} mt-3`}>
            {busy && <Loader2 size={16} className="animate-spin" />} Show contact details
          </button>
        </>
      ) : (
        <dl className="mt-3 divide-y divide-[#dfe5ef] rounded-xl border border-[#dfe5ef] bg-white text-[15px]">
          {rows.filter(([, x]) => x).map(([k, x]) => (
            <div key={k} className="px-4 py-2.5 sm:grid sm:grid-cols-[180px_1fr] sm:gap-3">
              <dt className="text-[13px] text-muted sm:text-[15px]">{k}</dt>
              <dd dir="auto" className="break-words">{x}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
