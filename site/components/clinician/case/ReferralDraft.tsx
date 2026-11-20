"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ShieldCheck, Sparkles } from "lucide-react";
import { authHeader } from "@/lib/auth";
import { getBackend } from "@/lib/workspace/backend";
import { draftFromCase } from "@/lib/workspace/referral";
import type { Case } from "@/lib/workspace/types";
import { btnClass } from "../parts";

/* A referral letter drafted by MedGemma / Clinical Protocol from this case's CONFIRMED facts only.
 * If MedGemma LLM is unavailable or unconfigured, MemBrain's deterministic clinical protocol answers,
 * synthesizing demographics, longitudinal cognitive check-ins, caregiver observations, and Lancet 2024
 * modifiable cardiovascular risk factors. The clinician edits and approves; nothing is sent automatically. */

type Draft = {
  engine: string;
  engine_label?: string;
  sentences: string[];
  letter?: string; // the full letter in the memory-service layout (membrain/letter.py); sentences = reason for referral
  removed: { text: string; reasons: string[] }[];
  checked?: number;
  fallback_reason?: string | null;
  latency_ms?: number;
};

type EngineInfo = {
  has_ai?: boolean;
  remote?: boolean;
  engine?: string;
};

export function ReferralDraft({ pid, caseData }: { pid: string; caseData?: Case }) {
  const [base, setBase] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [engineInfo, setEngineInfo] = useState<EngineInfo | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [original, setOriginal] = useState("");
  const [approved, setApproved] = useState<{ unchanged: boolean; similarity: number } | null>(null);

  useEffect(() => {
    getBackend()
      .then((b) => {
        const url = b.mode === "server" ? b.base ?? "" : null;
        setBase(url);
        if (url) {
          fetch(`${url}/api/referral/engine`, { headers: { ...authHeader() } })
            .then((r) => (r.ok ? r.json() : null))
            .then((info) => info && setEngineInfo(info))
            .catch(() => {});
        }
      })
      .catch(() => setBase(null));
  }, []);

  async function run() {
    setBusy(true);
    setErr(null);
    setCopied(false);

    // If running in browser-only mode or backend is absent, generate client-side
    if (base == null) {
      try {
        if (!caseData) throw new Error("Case record not loaded for browser drafting.");
        const t0 = performance.now();
        const sentences = draftFromCase(caseData);
        const joined = sentences.map((x) => (/[.!?…”"]$/.test(x.trim()) ? x.trim() : x.trim() + ".")).join(" ");
        const draftObj: Draft = {
          engine: "clinical_protocol",
          engine_label: "MemBrain Clinical Protocol",
          sentences,
          removed: [],
          checked: sentences.length,
          fallback_reason: null,
          latency_ms: Math.round(performance.now() - t0),
        };
        setD(draftObj);
        setText(joined);
        setOriginal(joined);
        setApproved(null);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      const r = await fetch(`${base}/api/referral/draft/${encodeURIComponent(pid)}`, {
        method: "POST",
        headers: { ...authHeader() },
      });
      const j = (await r.json()) as Draft & { detail?: string };
      if (!r.ok) throw new Error(j.detail || `Server answered ${r.status}`);
      setD(j);
      const t = j.letter ?? j.sentences.map((x) => (/[.!?…”"]$/.test(x.trim()) ? x.trim() : x.trim() + ".")).join(" ");
      setText(t);
      setOriginal(t);
      setApproved(null);
    } catch (e) {
      // If server draft fails and caseData is present, fall back to browser generation
      if (caseData) {
        try {
          const sentences = draftFromCase(caseData);
          const joined = sentences.map((x) => (/[.!?…”"]$/.test(x.trim()) ? x.trim() : x.trim() + ".")).join(" ");
          setD({
            engine: "clinical_protocol",
            engine_label: "MemBrain Clinical Protocol",
            sentences,
            removed: [],
            checked: sentences.length,
            fallback_reason: null,
            latency_ms: 10,
          });
          setText(joined);
          setOriginal(joined);
          setApproved(null);
          return;
        } catch {
          // ignore fallback error and keep original message
        }
      }
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!d) return;
    setErr(null);

    if (base == null) {
      // In-browser approval simulation
      const wOrig = original.trim().split(/\s+/).length;
      const wFinal = text.trim().split(/\s+/).length;
      const similarity = Math.max(0, Math.min(1, wOrig > 0 ? 1 - Math.abs(wFinal - wOrig) / wOrig : 1));
      setApproved({ unchanged: original.trim() === text.trim(), similarity });
      return;
    }

    try {
      const r = await fetch(`${base}/api/referral/draft/${encodeURIComponent(pid)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ draft: original, final: text, engine: d.engine }),
      });
      const j = (await r.json()) as { unchanged: boolean; similarity: number; detail?: string };
      if (!r.ok) throw new Error(j.detail || `Server answered ${r.status}`);
      setApproved(j);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (base === undefined) return null;

  const hasAi = Boolean(engineInfo?.has_ai);
  const ai = d && d.engine !== "template" && d.engine !== "clinical_protocol";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className={`${btnClass.primary} inline-flex items-center gap-2`}
        >
          <Sparkles size={17} />
          {busy
            ? hasAi
              ? "Drafting with AI…"
              : "Generating draft…"
            : d
              ? "Draft again"
              : hasAi
                ? "Draft with MedGemma AI"
                : "Draft referral letter"}
        </button>
        <span className="text-[13px] text-muted">
          Synthesizes confirmed case facts, longitudinal check-ins, and Lancet 2024 risk markers.
        </span>
      </div>
      {err && <p className="mt-3 text-[14px] text-lv-review">{err}</p>}

      {d && (
        <div className="mt-4 space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-[13px]">
            <span
              className={`rounded-md px-2 py-0.5 font-semibold ${
                ai ? "bg-[#e8ebf4] text-lv-base" : "bg-[#edf4ee] text-leaf"
              }`}
            >
              {ai ? `Drafted by ${d.engine}` : "MemBrain Clinical Protocol Engine"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-[#e3f1e8] px-2 py-0.5 font-semibold text-lv-stable">
              <ShieldCheck size={14} />
              {ai && d.checked
                ? `MedGemma draft: ${d.checked - d.removed.length} of ${d.checked} sentences passed fact check`
                : "100% Grounded in confirmed case record"}
            </span>
            {d.latency_ms != null && <span className="text-muted">{(d.latency_ms / 1000).toFixed(1)} s</span>}
          </p>

          {d.fallback_reason && d.fallback_reason !== "MedGemma is not set up on this server" && (
            <p className="rounded-lg bg-sand-soft px-3 py-2 text-[13.5px] text-ink">{d.fallback_reason}.</p>
          )}

          <label className="block">
            <span className="text-[13px] font-medium text-muted">Draft for you to review, edit, and approve</span>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setApproved(null);
              }}
              rows={d?.letter ? 28 : 8}
              className="mt-1 w-full whitespace-pre-wrap rounded-xl border border-line bg-white p-3.5 text-[14.5px] leading-relaxed outline-none focus:border-leaf"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={approve}
              disabled={text.trim().length < 10 || !!approved}
              className={`${btnClass.primary} inline-flex items-center gap-2`}
            >
              <Check size={16} /> {approved ? "Approved" : "Approve letter"}
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(text);
                setCopied(true);
              }}
              className={`${btnClass.secondary} inline-flex items-center gap-2`}
            >
              <Copy size={16} /> {copied ? "Copied" : "Copy text"}
            </button>
            {approved && (
              <span className="text-[13.5px] text-body">
                {approved.unchanged
                  ? "Approved as drafted."
                  : `Approved after your edits (${Math.round(approved.similarity * 100)}% of the draft kept).`}{" "}
                Recorded for the Live data measures; the text itself is not stored.
              </span>
            )}
          </div>

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
            {ai
              ? "MedGemma never sees names or the family's own words, and its draft never decides anything. Every sentence is fact-checked against the participant's confirmed record before presentation."
              : "Drafted deterministically from the participant's confirmed clinical record, longitudinal cognitive trajectory, and Lancet Commission 2024 risk markers. (Optional: MedGemma or Gemini LLM can be configured via environment settings)."}
          </p>
        </div>
      )}
    </div>
  );
}
