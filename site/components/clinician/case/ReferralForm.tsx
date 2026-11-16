"use client";

// Start a referral: pathway, a matched service, urgency, and a reason drafted from confirmed facts only.
// Every machine sentence is checked against the record (the grounding verifier in web/intake.js); sentences the
// clinician writes are marked as theirs, with a warning if they name a diagnosis.
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Route, X } from "lucide-react";
import { btnClass, Panel } from "../parts";
import { useWorkspace } from "../WorkspaceProvider";
import { getIntake, type Level } from "@/lib/mb";
import { levelOf, TODAY } from "@/lib/workspace/derive";
import { NAV, nav, type Matched } from "@/lib/workspace/navigator";
import type { Case } from "@/lib/workspace/types";

type Confirmed = {
  narrative?: string;
  domains?: string[];
  red_flags?: string[];
  confounders?: string[];
  onset?: string | null;
  timeline?: [string, string][];
  quotes?: string[];
  checkin?: { level: Level; reasons: string[] };
};
type Verified = { text: string; ok: boolean; reasons: string[]; disclaimer: boolean };
type Drafting = {
  draft: (c: Confirmed) => { text: string; sources: string[] }[];
  verify: (s: string[] | string, c: Confirmed) => { sentences: Verified[]; n: number; unsupported: number; grounded: boolean };
  verifySentence: (s: string, c: Confirmed) => Verified;
  splitSentences: (t: string) => string[];
};

/** Mirrors draftConfirmed in web/app.js: the confirmed intake plus the latest check-in, when there is one. */
function draftConfirmed(c: Case): Confirmed {
  const base = JSON.parse(JSON.stringify(c.participant.intake?.confirmed ?? { narrative: "", domains: [], red_flags: [], confounders: [], onset: null, timeline: [], quotes: [] })) as Confirmed;
  base.quotes = base.quotes ?? [];
  const ev = c.latest;
  if (ev && ev.level && ev.level !== "BASELINE") base.checkin = { level: ev.level, reasons: (ev.reasons ?? []).slice(0, 1) };
  return base;
}

function ServiceRow({ s, on, onPick }: { s: Matched; on: boolean; onPick: () => void }) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 transition-colors ${on ? "border-deep bg-[#eef4ef]" : "border-line bg-white hover:bg-paper"}`}>
      <input type="radio" name="service" checked={on} onChange={onPick} className="mt-1 accent-[#0f3f2c]" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
          {s.name}
          {s.accessible ? (
            <span className="rounded-full bg-lv-stable-soft px-2 py-0.5 text-[11.5px] font-semibold text-lv-stable">Accessible</span>
          ) : (
            <span className="rounded-full bg-lv-review-soft px-2 py-0.5 text-[11.5px] font-semibold text-lv-review">Barrier: {s.barriers.join(", ")}</span>
          )}
          {s.stale && <span className="rounded-full bg-lv-check-soft px-2 py-0.5 text-[11.5px] font-semibold text-lv-check">Details not re-checked recently</span>}
        </span>
        <span className="mt-0.5 block text-[13.5px] text-body">
          {s.area}, {s.emirate} · languages {s.languages.join(", ")} · funding {s.funding.join(", ")}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13.5px] text-body">
          <span className="inline-flex items-center gap-1">
            <Clock size={13} /> about {s.wait_weeks} weeks
          </span>
          <span>{s.capacity_per_month == null ? "same day" : `${s.capacity_per_month} a month`}</span>
          {s.accepting_referrals === false && <span className="font-medium text-lv-review">not accepting referrals</span>}
        </span>
      </span>
    </label>
  );
}

export function ReferralForm({ c, onClose }: { c: Case; onClose: () => void }) {
  const { refer, act } = useWorkspace();
  const IX = getIntake() as unknown as Drafting;
  const p = c.participant;
  const [pathway, setPathway] = useState<string>(c.latest?.pathways?.find((x) => NAV.pathways[x]) ?? "memory_clinic");
  const match = useMemo(() => nav.match(pathway, p), [pathway, p]);
  const firstGood = match.services.find((s) => s.accessible && s.accepting_referrals !== false) ?? match.services[0];
  const [serviceId, setServiceId] = useState<string | null>(firstGood?.id ?? null);
  const [urgency, setUrgency] = useState<"routine" | "urgent">(levelOf(c) === "URGENT" ? "urgent" : "routine");
  const confirmed = useMemo(() => draftConfirmed(c), [c]);
  const machine = useMemo(() => IX.draft(confirmed).map((x) => x.text), [IX, confirmed]);
  const [text, setText] = useState(machine.join(" "));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const check = IX.verify(machine, confirmed);
  const original = new Set(IX.splitSentences(machine.join(" ")));
  const now = IX.splitSentences(text);
  const edits = now.filter((x) => !original.has(x));
  const diagnosisInEdits = edits.filter((x) => IX.verifySentence(x, confirmed).reasons.some((r) => r.startsWith("diagnostic")));
  const chosen = match.services.find((s) => s.id === serviceId) ?? null;

  const changePathway = (pw: string) => {
    setPathway(pw);
    const m = nav.match(pw, p);
    const good = m.services.find((s) => s.accessible && s.accepting_referrals !== false) ?? m.services[0];
    setServiceId(good?.id ?? null);
  };

  const submit = async () => {
    const reason = text.trim();
    if (!reason) return setErr("Write a reason for the referral.");
    setBusy(true);
    setErr(null);
    try {
      await refer(p.id, { pathway, service_id: serviceId, urgency, reason, date: TODAY });
      if (c.task?.status === "open") await act(c.task.id, "refer", reason, serviceId);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      id="refer"
      title="Confirm concern and refer"
      icon={Route}
      aside={
        <button type="button" onClick={onClose} aria-label="Close the referral form" className="rounded-full p-1.5 text-body hover:bg-paper">
          <X size={19} />
        </button>
      }
    >
      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="text-[14px] font-medium">Pathway</span>
            <select value={pathway} onChange={(e) => changePathway(e.target.value)} className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-leaf">
              {Object.entries(NAV.pathways).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="text-[14px] font-medium">Urgency</legend>
            <div className="mt-1.5 flex rounded-xl bg-[#f1f1ee] p-1">
              {(["routine", "urgent"] as const).map((u) => (
                <button key={u} type="button" aria-pressed={urgency === u} onClick={() => setUrgency(u)} className={`rounded-lg px-4 py-2 text-[14.5px] font-medium capitalize ${urgency === u ? (u === "urgent" ? "bg-lv-urgent text-white" : "bg-white shadow-sm") : "text-body"}`}>
                  {u}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div>
          <p className="text-[14px] font-medium">Service, matched on language, funding and area</p>
          {match.gap && (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-lv-check-soft px-3.5 py-2.5 text-[14px] text-lv-check">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> No accessible service for this person on this pathway. {match.gap_action}.
            </p>
          )}
          <div className="mt-2 grid gap-2">
            {match.services.length === 0 && <p className="text-[14.5px] text-muted">No services listed for this pathway. The referral can still be recorded and assigned later.</p>}
            {match.services.map((s) => (
              <ServiceRow key={s.id} s={s} on={serviceId === s.id} onPick={() => setServiceId(s.id)} />
            ))}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="referral-reason" className="text-[14px] font-medium">
              Reason for referral
            </label>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${check.grounded ? "bg-lv-stable-soft text-lv-stable" : "bg-lv-review-soft text-lv-review"}`}>
              {check.grounded ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {check.n - check.unsupported}/{check.n} sentences backed by confirmed facts
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            Drafted from {p.intake?.confirmed ? "the confirmed intake" : "the record (no intake narrative on file)"}
            {confirmed.checkin ? " and the latest check-in" : ""}. Any diagnosis word, number not in the record or unconfirmed claim is blocked. Edit freely: your changes are marked as yours.
          </p>
          <textarea id="referral-reason" value={text} onChange={(e) => setText(e.target.value)} rows={6} className="mt-2 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] leading-relaxed outline-none focus:border-leaf" />
          {!check.grounded && (
            <ul className="mt-1 space-y-0.5 text-[13px] text-lv-review">
              {check.sentences
                .filter((s) => !s.ok)
                .map((s) => (
                  <li key={s.text}>
                    “{s.text.slice(0, 60)}…”: {s.reasons.join("; ")}
                  </li>
                ))}
            </ul>
          )}
          <p className="mt-1 text-[13px] text-muted">{edits.length ? `${edits.length} sentence(s) written or changed by you (not machine-checked).` : "Unchanged machine draft."}</p>
          {diagnosisInEdits.length > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-[13.5px] font-medium text-lv-review">
              <AlertTriangle size={14} /> Your text names a diagnosis. MemBrain referrals request assessment only.
            </p>
          )}
        </div>

        {err && <p className="text-[14px] text-lv-review">{err}</p>}
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" disabled={busy} onClick={submit} className={btnClass.primary}>
            <Route size={17} /> {busy ? "Recording…" : "Record referral"}
          </button>
          <button type="button" onClick={onClose} className={btnClass.secondary}>
            Cancel
          </button>
          <span className="text-[13px] text-muted">
            {chosen ? `To ${chosen.name}` : "Service to be assigned"} · {urgency}
            {c.task?.status === "open" ? " · closes the review task" : ""}
          </span>
        </div>
      </div>
    </Panel>
  );
}
