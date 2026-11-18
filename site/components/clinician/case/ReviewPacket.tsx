"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, Printer } from "lucide-react";
import { authHeader } from "@/lib/auth";
import { getBackend } from "@/lib/workspace/backend";
import { btnClass } from "../parts";

/* Clinician review packet (api/packet.py, membrain/packet.py): a pre-read built from numbered facts. Med42-v2-8B writes it
 * when switched on; every item must cite facts, use only their numbers and name no diagnosis, or it is dropped. */

type Fact = { id: string; kind: string; text: string };
type Packet = {
  engine: string; fallback_reason: string | null; kept: number | null; removed: number; latency_ms: number | null;
  facts: Fact[]; summary: { text: string; facts: string[] }[];
  rule_out: { check: string; label: string; why: string; facts: string[] }[];
  ask: { q: string; facts: string[] }[]; gaps: string[];
};

function Refs({ ids, facts }: { ids: string[]; facts: Record<string, string> }) {
  if (!ids.length) return null;
  return (
    <span className="ml-1.5 inline-flex flex-wrap gap-1 align-middle">
      {ids.map((i) => (
        <span key={i} title={facts[i]} className="cursor-help rounded bg-[#e8ebf4] px-1.5 text-[11.5px] font-semibold text-lv-base">{i}</span>
      ))}
    </span>
  );
}

export function ReviewPacket({ pid }: { pid: string }) {
  const [base, setBase] = useState<string | null | undefined>(undefined);
  const [pk, setPk] = useState<Packet | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showFacts, setShowFacts] = useState(false);

  useEffect(() => {
    getBackend().then((b) => setBase(b.mode === "server" ? b.base ?? "" : null)).catch(() => setBase(null));
  }, []);

  async function prepare() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${base}/participants/${encodeURIComponent(pid)}/review-packet`, { method: "POST", headers: { ...authHeader() } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || `Server answered ${r.status}`);
      setPk(j);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (base === undefined) return null;
  if (base === null) return <p className="text-[14.5px] text-body">The review packet needs the MemBrain server (the live demo).</p>;
  const fx = Object.fromEntries((pk?.facts ?? []).map((f) => [f.id, f.text]));
  return (
    <div className="space-y-3">
      {!pk ? (
        <p className="text-[14px] text-body">A one-screen pre-read for your review: what is known, reversible causes to check, questions for the visit and what is missing. Every line points to the facts it rests on.</p>
      ) : (
        <div className="space-y-4 print:text-black">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className={`rounded-full px-2.5 py-0.5 font-medium ${pk.engine === "rules" ? "bg-paper text-muted" : "bg-[#e6f2ea] text-lv-stable"}`}>
              {pk.engine === "rules" ? "Built by the rules" : `Written by ${pk.engine}`}
            </span>
            {pk.engine !== "rules" && <span className="text-muted">{pk.kept} items kept · {pk.removed} removed by the fact check{pk.latency_ms ? ` · ${(pk.latency_ms / 1000).toFixed(1)} s` : ""}</span>}
            {pk.fallback_reason && <span className="text-muted">{pk.fallback_reason}</span>}
          </div>
          <section>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Summary</p>
            <ul className="mt-1 space-y-1 text-[15px] leading-relaxed">{pk.summary.map((s, i) => <li key={i}>{s.text}<Refs ids={s.facts} facts={fx} /></li>)}</ul>
          </section>
          <section>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Reversible causes to check</p>
            <ul className="mt-1 grid gap-1.5 text-[14.5px] sm:grid-cols-2">
              {pk.rule_out.map((r) => (
                <li key={r.check} className="rounded-lg border border-line px-3 py-2">
                  <span className="font-medium">{r.label}</span><Refs ids={r.facts} facts={fx} />
                  <span className="block text-[13px] text-body">{r.why}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Questions for the visit</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-[14.5px]">{pk.ask.map((a, i) => <li key={i}>{a.q}<Refs ids={a.facts} facts={fx} /></li>)}</ol>
          </section>
          {pk.gaps.length > 0 && (
            <section>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Still missing</p>
              <ul className="mt-1 list-disc pl-5 text-[14px] text-body">{pk.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
            </section>
          )}
          <button type="button" onClick={() => setShowFacts((v) => !v)} className="text-[13.5px] font-medium text-leaf underline">{showFacts ? "Hide" : "Show"} the {pk.facts.length} facts used</button>
          {showFacts && (
            <ul className="space-y-0.5 rounded-xl bg-paper px-3.5 py-2.5 text-[13px]">
              {pk.facts.map((f) => <li key={f.id}><span className="font-semibold">{f.id}</span> {f.text}</li>)}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button type="button" onClick={prepare} disabled={busy} className={`${btnClass.primary} inline-flex items-center gap-2`}>
          <ClipboardCheck size={16} /> {busy ? "Preparing…" : pk ? "Prepare again" : "Prepare review packet"}
        </button>
        {pk && <button type="button" onClick={() => window.print()} className={btnClass.secondary}><Printer size={16} /> Print</button>}
        {err && <span className="text-[14px] text-lv-review">{err}</span>}
      </div>
      <p className="text-[12.5px] text-muted">A draft for the reviewing clinician. It names no diagnosis, never changes the check-in result and is never shown to the family.</p>
    </div>
  );
}
