"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { authHeader } from "@/lib/auth";
import { getBackend } from "@/lib/workspace/backend";
import { fmtDate } from "@/lib/workspace/derive";
import { btnClass } from "../parts";

/* Clinician-entered MoCA (api/moca.py). Scores only: MemBrain never shows or copies MoCA content. The clinic MoCA is the
 * reference the home check-in is validated against (Live data); it never changes a triage result. */

type Nearest = { date: string; gap_days: number; composite_z: number; level: string } | null;
type Rec = {
  ts: string; date: string; version: string; total: number; sections: Record<string, number> | null;
  education_point: boolean; below_cut: boolean; cut: number; given_by: string; notes: string;
};

const LABEL: Record<string, string> = {
  visuospatial: "Visuospatial / executive", naming: "Naming", attention: "Attention", language: "Language",
  abstraction: "Abstraction", delayed_recall: "Delayed recall", orientation: "Orientation",
};
const LEVEL: Record<string, string> = {
  BASELINE: "Baseline", STABLE: "Stable", CHECK_AGAIN: "Check again", CLINICIAN_REVIEW: "Clinician review", URGENT: "Urgent",
};

export function MocaPanel({ pid }: { pid: string }) {
  const [base, setBase] = useState<string | null | undefined>(undefined);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [near, setNear] = useState<Nearest[]>([]);
  const [maxes, setMaxes] = useState<Record<string, number>>({});
  const [versions, setVersions] = useState<string[]>([]);
  const [cut, setCut] = useState(26);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [version, setVersion] = useState("Arabic MoCA 8.1");
  const [mode, setMode] = useState<"sections" | "total">("sections");
  const [secs, setSecs] = useState<Record<string, string>>({});
  const [total, setTotal] = useState("");
  const [edu, setEdu] = useState(false);
  const [certified, setCertified] = useState(false);
  const [givenBy, setGivenBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getBackend().then(async (b) => {
      if (b.mode !== "server") return setBase(null);
      const bs = b.base ?? "";
      setBase(bs);
      const r = await fetch(`${bs}/participants/${encodeURIComponent(pid)}/moca`, { headers: { ...authHeader() } });
      if (!r.ok) return;
      const j = await r.json();
      setRecs(j.records ?? []); setNear(j.nearest_checkin ?? []); setMaxes(j.sections ?? {}); setVersions(j.versions ?? []);
      setCut(j.cut ?? 26); setEdu(!!j.education_point_suggested);
    }).catch(() => setBase(null));
  }, [pid]);

  const sum = useMemo(() => {
    const keys = Object.keys(maxes);
    if (!keys.length || keys.some((k) => secs[k] === undefined || secs[k] === "")) return null;
    return Math.min(30, keys.reduce((a, k) => a + Number(secs[k]), 0) + (edu ? 1 : 0));
  }, [secs, maxes, edu]);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const body: Record<string, unknown> = { date, version, language: version.startsWith("Arabic") ? "ar" : "en", education_point: edu, certified, given_by: givenBy };
      if (mode === "sections") body.sections = Object.fromEntries(Object.entries(secs).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]));
      else body.total = total === "" ? null : Number(total);
      const r = await fetch(`${base}/participants/${encodeURIComponent(pid)}/moca`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeader() }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.detail === "string" ? j.detail : "Please check the scores.");
      setRecs((x) => [...x, j]); setNear((x) => [...x, j.nearest_checkin ?? null]); setOpen(false); setSecs({}); setTotal("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (base === undefined) return null;
  if (base === null) return <p className="text-[14.5px] text-body">Recording a MoCA needs the MemBrain server (the live demo).</p>;
  const input = "w-full rounded-lg border border-line px-2.5 py-1.5 text-[15px] outline-none focus:border-leaf";
  return (
    <div className="space-y-3">
      {recs.length ? (
        <table className="w-full text-[14.5px]">
          <thead>
            <tr className="text-left text-[13px] text-muted">
              <th className="pb-1.5 font-medium">Date</th><th className="pb-1.5 font-medium">MoCA</th><th className="pb-1.5 font-medium">Lowest sections</th>
              <th className="pb-1.5 font-medium">Nearest home check-in</th><th className="pb-1.5 font-medium">Version · given by</th>
            </tr>
          </thead>
          <tbody>
            {recs.map((m, i) => {
              const low = m.sections ? Object.entries(m.sections).filter(([k, v]) => v < (maxes[k] ?? 0)).sort((a, b) => a[1] / (maxes[a[0]] || 1) - b[1] / (maxes[b[0]] || 1)).slice(0, 2) : [];
              const n = near[i];
              return (
                <tr key={m.ts} className="border-t border-line align-top">
                  <td className="py-1.5">{fmtDate(m.date)}</td>
                  <td>
                    <span className="font-semibold">{m.total}/30</span>
                    <span className={`ml-2 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] ${m.below_cut ? "bg-[#fbeee0] text-lv-review" : "bg-[#e6f2ea] text-lv-stable"}`}>{m.below_cut ? `below ${m.cut}` : `${m.cut} or above`}</span>
                    {m.education_point && <span className="block text-[12.5px] text-muted">includes the education point</span>}
                  </td>
                  <td className="text-[13.5px]">{low.length ? low.map(([k, v]) => `${LABEL[k] ?? k} ${v}/${maxes[k]}`).join(", ") : m.sections ? "None lost" : "Total only"}</td>
                  <td className="text-[13.5px]">{n ? `${LEVEL[n.level] ?? n.level} · composite z ${n.composite_z.toFixed(2)} · ${n.gap_days} d apart` : "None within 30 days"}</td>
                  <td className="text-[13.5px] text-muted">{m.version}{m.given_by ? ` · ${m.given_by}` : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-[14.5px] text-body">No clinic MoCA recorded yet.</p>
      )}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={btnClass.secondary}>Record a MoCA given in clinic</button>
      ) : (
        <div className="space-y-3 rounded-xl border border-line p-3.5">
          <p className="text-[13.5px] text-body">Give the official MoCA on paper or the licensed app, then enter the scores here. Scores only: no test content is stored.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="text-[13px] font-medium text-muted">Date given</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} /></label>
            <label className="block"><span className="text-[13px] font-medium text-muted">Version</span>
              <select value={version} onChange={(e) => setVersion(e.target.value)} className={input}>{versions.map((v) => <option key={v}>{v}</option>)}</select></label>
            <label className="block"><span className="text-[13px] font-medium text-muted">Given by</span>
              <input value={givenBy} onChange={(e) => setGivenBy(e.target.value)} placeholder="Name and role" className={input} /></label>
          </div>
          <div className="flex gap-4 text-[14px]">
            <label className="inline-flex items-center gap-1.5"><input type="radio" checked={mode === "sections"} onChange={() => setMode("sections")} /> Section scores</label>
            <label className="inline-flex items-center gap-1.5"><input type="radio" checked={mode === "total"} onChange={() => setMode("total")} /> Total only</label>
          </div>
          {mode === "sections" ? (
            <div className="grid gap-2 sm:grid-cols-4">
              {Object.entries(maxes).map(([k, mx]) => (
                <label key={k} className="block"><span className="text-[12.5px] text-muted">{LABEL[k] ?? k} (0–{mx})</span>
                  <input type="number" min={0} max={mx} value={secs[k] ?? ""} onChange={(e) => setSecs((s) => ({ ...s, [k]: e.target.value }))} className={input} /></label>
              ))}
              <div className="flex items-end pb-1.5 text-[15px]">Total: <span className="ml-1.5 font-semibold">{sum == null ? "–" : `${sum}/30`}</span></div>
            </div>
          ) : (
            <label className="block w-40"><span className="text-[13px] font-medium text-muted">Total (0–30, with the education point)</span>
              <input type="number" min={0} max={30} value={total} onChange={(e) => setTotal(e.target.value)} className={input} /></label>
          )}
          <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={edu} onChange={(e) => setEdu(e.target.checked)} /> Education point added (12 years of schooling or fewer)</label>
          <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} /> Given by a MoCA-certified person</label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={busy || !certified} className={`${btnClass.primary} inline-flex items-center gap-2`}><Check size={16} /> Save MoCA</button>
            <button type="button" onClick={() => setOpen(false)} className={btnClass.secondary}>Cancel</button>
            {err && <span className="text-[14px] text-lv-review">{err}</span>}
          </div>
        </div>
      )}
      <p className="rounded-lg bg-[#e8ebf4] px-3 py-2 text-[13px] leading-snug text-lv-base">
        The clinic MoCA is the reference for checking the home check-in (Live data). It never changes the check-in result. Cut-off {cut} as in the Arabic validation; the local cut-off is set in the pilot.
      </p>
    </div>
  );
}
