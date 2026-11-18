"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { authHeader } from "@/lib/auth";
import { getBackend } from "@/lib/workspace/backend";
import { fmtDate } from "@/lib/workspace/derive";
import { btnClass } from "../parts";

/* The family's next step: a plain-language draft built from the case, which the clinician edits and approves. Only
 * approved words reach the family ("Your next step" page, api/family.py). */

type Approved = { ts: string; by: string; en: string; ar: string };

export function FamilyMessage({ pid }: { pid: string }) {
  const [base, setBase] = useState<string | null | undefined>(undefined);
  const [en, setEn] = useState("");
  const [ar, setAr] = useState("");
  const [approved, setApproved] = useState<Approved[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getBackend().then(async (b) => {
      if (b.mode !== "server") return setBase(null);
      const bs = b.base ?? "";
      setBase(bs);
      const r = await fetch(`${bs}/participants/${encodeURIComponent(pid)}/family-message/suggest`, { headers: { ...authHeader() } });
      if (!r.ok) return;
      const j = (await r.json()) as { en: string; ar: string; approved: Approved[] };
      setEn(j.en); setAr(j.ar); setApproved(j.approved ?? []);
    }).catch(() => setBase(null));
  }, [pid]);

  async function approve() {
    if (!base && base !== "") return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${base}/participants/${encodeURIComponent(pid)}/family-message`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeader() }, body: JSON.stringify({ en, ar }),
      });
      const j = (await r.json()) as Approved & { detail?: string };
      if (!r.ok) throw new Error(j.detail || `Server answered ${r.status}`);
      setApproved((a) => [...a, j]); setDone(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (base === undefined) return null;
  if (base === null) return <p className="text-[14.5px] text-body">Approving family messages needs the MemBrain server (the live demo).</p>;
  return (
    <div className="space-y-3">
      <p className="text-[14px] text-body">A suggested next step from this case. Edit it, then approve: only approved words reach the family, on their &ldquo;Your next step&rdquo; page.</p>
      <label className="block">
        <span className="text-[13px] font-medium text-muted">English</span>
        <textarea value={en} onChange={(e) => { setEn(e.target.value); setDone(false); }} rows={3} className="mt-1 w-full rounded-xl border border-line p-3 text-[15px] leading-relaxed outline-none focus:border-leaf" />
      </label>
      <label className="block">
        <span className="text-[13px] font-medium text-muted">العربية</span>
        <textarea dir="rtl" lang="ar" value={ar} onChange={(e) => { setAr(e.target.value); setDone(false); }} rows={3} className="mt-1 w-full rounded-xl border border-line p-3 text-[16px] leading-relaxed outline-none focus:border-leaf" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={approve} disabled={busy || done} className={`${btnClass.primary} inline-flex items-center gap-2`}>
          <Check size={16} /> {done ? "Approved and shared" : "Approve and share with the family"}
        </button>
        {err && <span className="text-[14px] text-lv-review">{err}</span>}
      </div>
      {approved.length > 0 && (
        <div className="rounded-xl bg-paper px-3.5 py-2.5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Shared with the family</p>
          <ul className="mt-1.5 space-y-1.5 text-[14px]">
            {approved.slice().reverse().map((m) => (
              <li key={m.ts}><span className="text-muted">{fmtDate(m.ts)} · {m.by}:</span> {m.en || m.ar}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
