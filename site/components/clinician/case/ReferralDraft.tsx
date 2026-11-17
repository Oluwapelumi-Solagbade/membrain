"use client";

import { useEffect, useState } from "react";
import { Copy, ShieldCheck, Sparkles } from "lucide-react";
import { authHeader } from "@/lib/auth";
import { getBackend } from "@/lib/workspace/backend";
import { btnClass } from "../parts";

/* A referral letter drafted by MedGemma from this case's CONFIRMED facts only (never names or free text), then checked
 * sentence by sentence by MemBrain's verifier (membrain/intake.py): a sentence with a diagnosis, a number or a claim
 * that is not in the record is removed and shown struck through with the reason. If MedGemma is unavailable, the
 * deterministic template answers. The clinician edits and approves; nothing is sent automatically. */

type Draft = {
  engine: string;
  sentences: string[];
  removed: { text: string; reasons: string[] }[];
  checked?: number;
  fallback_reason?: string;
  latency_ms?: number;
};

export function ReferralDraft({ pid }: { pid: string }) {
  const [base, setBase] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState<Draft | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getBackend().then((b) => setBase(b.mode === "server" ? b.base ?? "" : null)).catch(() => setBase(null));
  }, []);

  async function run() {
    if (base == null) return;
    setBusy(true); setErr(null); setCopied(false);
    try {
      const r = await fetch(`${base}/api/referral/draft/${encodeURIComponent(pid)}`, { method: "POST", headers: { ...authHeader() } });
      const j = (await r.json()) as Draft & { detail?: string };
      if (!r.ok) throw new Error(j.detail || `Server answered ${r.status}`);
      setD(j);
      setText(j.sentences.map((x) => (/[.!?…”"]$/.test(x.trim()) ? x.trim() : x.trim() + ".")).join(" "));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (base === undefined) return null;
  if (base === null)
    return <p className="text-[14.5px] text-body">Drafting needs the MemBrain server (the live demo Space); this copy runs only in your browser.</p>;

  const ai = d && d.engine !== "template";
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={run} disabled={busy} className={`${btnClass.primary} inline-flex items-center gap-2`}>
          <Sparkles size={17} /> {busy ? "Drafting… (MedGemma can take up to a minute)" : d ? "Draft again" : "Draft with MedGemma"}
        </button>
        <span className="text-[13px] text-muted">Uses the confirmed facts only. Every sentence is fact-checked before you see it.</span>
      </div>
      {err && <p className="mt-3 text-[14px] text-lv-review">{err}</p>}

      {d && (
        <div className="mt-4 space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className={`rounded-md px-2 py-0.5 font-semibold ${ai ? "bg-[#e8ebf4] text-lv-base" : "bg-mist text-deep"}`}>
              {ai ? `Drafted by ${d.engine}` : "Rules template"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-[#e3f1e8] px-2 py-0.5 font-semibold text-lv-stable">
              <ShieldCheck size={14} /> {d.checked ? `MedGemma's draft: ${d.checked - d.removed.length} of ${d.checked} sentences passed the fact check` : "Built from confirmed facts only"}
            </span>
            {d.latency_ms != null && <span className="text-muted">{(d.latency_ms / 1000).toFixed(1)} s</span>}
          </p>
          {d.fallback_reason && <p className="rounded-lg bg-sand-soft px-3 py-2 text-[13.5px] text-ink">{d.fallback_reason}.</p>}

          <label className="block">
            <span className="text-[13px] font-medium text-muted">Draft for you to edit and approve</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
              className="mt-1 w-full rounded-xl border border-line bg-white p-3 text-[15px] leading-relaxed outline-none focus:border-leaf" />
          </label>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(text); setCopied(true); }} className={`${btnClass.secondary} inline-flex items-center gap-2`}>
            <Copy size={16} /> {copied ? "Copied" : "Copy text"}
          </button>

          {d.removed.length > 0 && (
            <div className="rounded-xl border border-[#f1d3cb] bg-[#fdf3f0] p-3">
              <p className="text-[13px] font-semibold text-lv-review">Removed by the fact check</p>
              <ul className="mt-1.5 space-y-1.5 text-[14px]">
                {d.removed.map((r, i) => (
                  <li key={i}>
                    <span className="text-body line-through">{r.text}</span>
                    <span className="block text-[12.5px] text-lv-review">{r.reasons.join("; ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[12.5px] text-muted">
            MedGemma never sees names or the family&apos;s own words, and its draft never decides anything. On our held-out test it was not safe enough to extract facts, so it is used only to word this letter, under the check above.
          </p>
        </div>
      )}
    </div>
  );
}
