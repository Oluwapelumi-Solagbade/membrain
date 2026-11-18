"use client";

// Referrals inside the app: confirm the concern and refer (pathway, a matched service, urgency, a reason drafted
// from confirmed facts and checked sentence by sentence), then follow the referral round the closed loop. The same
// API calls as the web workspace; nothing here opens a desktop page.
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, FileText, Route, Send } from "lucide-react";
import { buzz, Card, cx, Sheet, tap, useToast } from "./kit";
import { useWorkspace } from "../clinician/WorkspaceProvider";
import { getIntake, type Level } from "@/lib/mb";
import { levelOf, TODAY } from "@/lib/workspace/derive";
import { DONE, LOOP, NAV, nav, serviceById, STALLED, STATE_LABEL } from "@/lib/workspace/navigator";
import type { Case, Referral, ReferralState } from "@/lib/workspace/types";

type Confirmed = {
  narrative?: string; domains?: string[]; red_flags?: string[]; confounders?: string[]; onset?: string | null;
  timeline?: [string, string][]; quotes?: string[]; checkin?: { level: Level; reasons: string[] };
};
type Verified = { text: string; ok: boolean; reasons: string[] };
type Drafting = {
  draft: (c: Confirmed) => { text: string }[];
  verify: (s: string[] | string, c: Confirmed) => { sentences: Verified[]; n: number; unsupported: number; grounded: boolean };
  verifySentence: (s: string, c: Confirmed) => Verified;
  splitSentences: (t: string) => string[];
};

function confirmedOf(c: Case): Confirmed {
  const base = JSON.parse(JSON.stringify(c.participant.intake?.confirmed ?? { narrative: "", domains: [], red_flags: [], confounders: [], onset: null, timeline: [], quotes: [] })) as Confirmed;
  base.quotes = base.quotes ?? [];
  const ev = c.latest;
  if (ev && ev.level && ev.level !== "BASELINE") base.checkin = { level: ev.level, reasons: (ev.reasons ?? []).slice(0, 1) };
  return base;
}

const stateColor = (s: ReferralState) => (STALLED.includes(s) ? "#b4492b" : DONE.includes(s) ? "#2f7d4f" : s === "cancelled" ? "#8a958f" : "#2f5fa8");

/* ── Confirm and refer ── */

export function ReferSheet({ c, open, onClose }: { c: Case; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Confirm and refer">
      {open && <ReferForm c={c} onDone={onClose} />}
    </Sheet>
  );
}

function ReferForm({ c, onDone }: { c: Case; onDone: () => void }) {
  const { refer, act } = useWorkspace();
  const toast = useToast();
  const IX = getIntake() as unknown as Drafting;
  const p = c.participant;
  const [pathway, setPathway] = useState<string>(c.latest?.pathways?.find((x) => NAV.pathways[x]) ?? "memory_clinic");
  const match = useMemo(() => nav.match(pathway, p), [pathway, p]);
  const pickGood = (m: typeof match) => (m.services.find((s) => s.accessible && s.accepting_referrals !== false) ?? m.services[0])?.id ?? null;
  const [serviceId, setServiceId] = useState<string | null>(pickGood(match));
  const [urgency, setUrgency] = useState<"routine" | "urgent">(levelOf(c) === "URGENT" ? "urgent" : "routine");
  const confirmed = useMemo(() => confirmedOf(c), [c]);
  const machine = useMemo(() => IX.draft(confirmed).map((x) => x.text), [IX, confirmed]);
  const [text, setText] = useState(machine.join(" "));
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const check = IX.verify(machine, confirmed);
  const original = new Set(IX.splitSentences(machine.join(" ")));
  const edits = IX.splitSentences(text).filter((x) => !original.has(x));
  const diagnosis = edits.some((x) => IX.verifySentence(x, confirmed).reasons.some((r) => r.startsWith("diagnostic")));
  const chosen = match.services.find((s) => s.id === serviceId) ?? null;
  const services = showAll ? match.services : match.services.slice(0, 3);
  const chips = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // bring the chosen pathway into view (sideways only, so the sheet itself does not jump)
    const row = chips.current, on = row?.querySelector<HTMLElement>("[data-on]");
    if (row && on) row.scrollLeft = on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
  }, [pathway]);

  const submit = async () => {
    const reason = text.trim();
    if (!reason) return toast("Write a reason for the referral", "error");
    setBusy(true);
    try {
      await refer(p.id, { pathway, service_id: serviceId, urgency, reason, date: TODAY });
      if (c.task && c.task.status !== "closed") await act(c.task.id, "refer", reason, serviceId);
      buzz("SUCCESS");
      toast(chosen ? `Referred to ${chosen.name}` : "Referral recorded");
      onDone();
    } catch (e) {
      buzz("ERROR");
      toast(e instanceof Error ? e.message : "Could not record the referral", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 pb-1">
      <div>
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Pathway</p>
        <div ref={chips} className="no-scrollbar relative -mx-5 flex gap-2 overflow-x-auto px-5">
          {Object.entries(NAV.pathways).map(([k, v]) => (
            <button key={k} type="button" data-on={pathway === k || undefined} onClick={() => { tap(); setPathway(k); setServiceId(pickGood(nav.match(k, p))); setShowAll(false); }}
              className={cx("shrink-0 rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors", pathway === k ? "bg-deep text-white" : "bg-[#f1f3ef] text-body")}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Urgency</p>
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#f1f3ef] p-1">
          {(["routine", "urgent"] as const).map((u) => (
            <button key={u} type="button" aria-pressed={urgency === u} onClick={() => { tap(); setUrgency(u); }}
              className={cx("h-10 rounded-xl text-[14.5px] font-semibold capitalize transition-colors", urgency === u ? (u === "urgent" ? "bg-lv-urgent text-white" : "bg-white shadow-sm") : "text-body")}>
              {u}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Service · matched on language, funding and area</p>
        {match.gap && (
          <p className="mb-2 flex items-start gap-2 rounded-2xl bg-lv-check-soft px-3.5 py-2.5 text-[13.5px] leading-snug text-lv-check">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> No accessible service for this person on this pathway. {match.gap_action}.
          </p>
        )}
        {match.services.length === 0 && <p className="text-[14px] text-muted">No services listed for this pathway. The referral can be recorded and assigned later.</p>}
        <div className="space-y-2">
          {services.map((s) => {
            const on = serviceId === s.id;
            return (
              <button key={s.id} type="button" onClick={() => { tap(); setServiceId(s.id); }} aria-pressed={on}
                className={cx("w-full rounded-2xl border px-4 py-3 text-start transition-colors", on ? "border-deep bg-[#eef4ef]" : "border-[#e6e9e4] bg-white")}>
                <span className="flex items-start gap-3">
                  <span className={cx("mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", on ? "border-deep" : "border-[#c3ccc6]")}>{on && <span className="h-2.5 w-2.5 rounded-full bg-deep" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-snug">{s.name}</span>
                    <span className="mt-0.5 block text-[12.5px] text-body">{s.area}, {s.emirate} · {s.languages.join(", ")}</span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {s.accessible ? <Tag tone="good">Accessible</Tag> : <Tag tone="bad">Barrier: {s.barriers.join(", ")}</Tag>}
                      <Tag><Clock size={11} className="me-0.5 inline" />~{s.wait_weeks} wk</Tag>
                      {s.accepting_referrals === false && <Tag tone="bad">Not accepting</Tag>}
                      {s.stale && <Tag tone="warn">Details not re-checked</Tag>}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
          {match.services.length > 3 && (
            <button type="button" onClick={() => setShowAll(!showAll)} className="flex w-full items-center justify-center gap-1 py-1.5 text-[13.5px] font-medium text-deep">
              {showAll ? "Show fewer" : `Show all ${match.services.length}`} <ChevronDown size={15} className={showAll ? "rotate-180" : ""} />
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Reason</p>
          <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold", check.grounded ? "bg-lv-stable-soft text-lv-stable" : "bg-lv-review-soft text-lv-review")}>
            {check.grounded ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}{check.n - check.unsupported}/{check.n} backed by the record
          </span>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} dir="auto"
          className="w-full rounded-2xl border border-[#e3e6e1] bg-white px-3.5 py-3 text-[14.5px] leading-relaxed outline-none focus:border-deep" />
        <p className="mt-1 text-[12px] text-muted">{edits.length ? `${edits.length} sentence${edits.length === 1 ? "" : "s"} written by you (not machine-checked).` : "Drafted from confirmed facts only. Edit freely."}</p>
        {diagnosis && <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-lv-review"><AlertTriangle size={14} /> Your text names a diagnosis. MemBrain referrals request assessment only.</p>}
      </div>

      <button type="button" disabled={busy || !text.trim()} onClick={() => void submit()}
        className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[18px] bg-gradient-to-b from-[#1b5a40] to-deep text-[16px] font-semibold text-white shadow-[0_14px_30px_-14px_rgb(15_63_44/0.8)] disabled:opacity-60">
        <Send size={18} /> {busy ? "Recording…" : "Record referral"}
      </button>
      <p className="-mt-2 text-center text-[12px] text-muted">
        {chosen ? `To ${chosen.name}` : "Service to be assigned"} · {urgency}{c.task && c.task.status !== "closed" ? " · closes the review" : ""}
      </p>
    </div>
  );
}

function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const t = { neutral: "bg-[#f0f2ee] text-body", good: "bg-lv-stable-soft text-lv-stable", warn: "bg-lv-check-soft text-lv-check", bad: "bg-lv-review-soft text-lv-review" }[tone];
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", t)}>{children}</span>;
}

/* ── A referral, followed round the loop ── */

export function ReferralTrack({ r }: { r: Referral }) {
  const { advance } = useWorkspace();
  const toast = useToast();
  const [next, setNext] = useState<ReferralState | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [pack, setPack] = useState<"en" | "ar" | null>(null);
  const svc = serviceById(r.service_id);
  const allowed = NAV.transitions[r.state] ?? [];
  const needsReason = (s: ReferralState) => NAV.needs_reason.includes(s);
  const reached = new Set(r.history.map((h) => h.state));
  const last = r.history[r.history.length - 1]?.date;
  const days = last ? nav.days(last, TODAY) : null;
  const closed = NAV.closed.includes(r.state);
  const step = Math.max(0, LOOP.indexOf(r.state));

  const move = async (s: ReferralState, why = "") => {
    setBusy(true);
    try {
      await advance(r.id, s, TODAY, why);
      buzz("SUCCESS");
      toast(`Referral: ${STATE_LABEL[s]}`);
      setNext(null);
      setReason("");
    } catch (e) {
      buzz("ERROR");
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  };
  const packed = pack ? nav.pack(r, svc, pack) : null;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${stateColor(r.state)}18`, color: stateColor(r.state) }}><Route size={19} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug">{NAV.pathways[r.pathway] ?? r.pathway}</p>
          <p className="truncate text-[12.5px] text-body">{svc?.name ?? "Service to be assigned"}{r.urgency === "urgent" ? " · urgent" : ""}</p>
          <span className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold" style={{ background: `${stateColor(r.state)}18`, color: stateColor(r.state) }}>{STATE_LABEL[r.state] ?? r.state}</span>
        </div>
      </div>

      <div className="mt-4 flex gap-1" aria-label={`Step ${step + 1} of ${LOOP.length}`}>
        {LOOP.map((s) => <span key={s} className={cx("h-1.5 flex-1 rounded-full", r.state === s ? "bg-deep" : reached.has(s) ? "bg-leaf/60" : "bg-[#e6e9e4]")} />)}
      </div>
      <p className="mt-1.5 text-[12px] text-muted">
        {closed ? "Loop closed" : `Step ${step + 1} of ${LOOP.length}`}{days != null && !closed ? ` · ${days} day${days === 1 ? "" : "s"} in this step` : ""}
      </p>
      {STALLED.includes(r.state) && <p className="mt-2 rounded-xl bg-lv-review-soft px-3 py-2 text-[13px] text-lv-review">Stalled: the navigator follows this up.</p>}

      <ol className="mt-3 space-y-1.5 border-t border-[#eef0ec] pt-3">
        {r.history.map((h, i) => (
          <li key={i} className="flex gap-3 text-[13px]">
            <span className="w-[52px] shrink-0 whitespace-nowrap text-muted">{new Date(h.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
            <span className="min-w-0"><span className="font-medium">{STATE_LABEL[h.state] ?? h.state}</span>{h.reason && <span className="line-clamp-2 text-muted">“{h.reason}”</span>}</span>
          </li>
        ))}
      </ol>

      {allowed.length > 0 && (
        <div className="mt-3 border-t border-[#eef0ec] pt-3">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Record the next step</p>
          <div className="flex flex-wrap gap-1.5">
            {allowed.map((s) => (
              <button key={s} type="button" disabled={busy} onClick={() => { tap(); if (needsReason(s)) setNext(next === s ? null : s); else void move(s); }}
                className={cx("rounded-full px-3 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50",
                  next === s ? "bg-deep text-white" : STALLED.includes(s) || s === "cancelled" ? "bg-[#f3f1ee] text-body" : "bg-[#e6efe9] text-deep")}>
                {STATE_LABEL[s]}
              </button>
            ))}
          </div>
          {next && (
            <div className="mt-2.5 space-y-2">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`Why “${STATE_LABEL[next].toLowerCase()}”? (required)`}
                className="h-11 w-full rounded-xl border border-[#e3e6e1] px-3 text-[14px] outline-none focus:border-deep" />
              <button type="button" disabled={busy || !reason.trim()} onClick={() => void move(next, reason.trim())} className="h-11 w-full rounded-xl bg-deep text-[14px] font-semibold text-white disabled:opacity-50">Record</button>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-[#eef0ec] pt-3">
        <FileText size={15} className="text-muted" />
        <span className="flex-1 text-[13px] text-body">Next steps for the family</span>
        {(["en", "ar"] as const).map((l) => (
          <button key={l} type="button" lang={l} onClick={() => { tap(); setPack(pack === l ? null : l); }}
            className={cx("rounded-full px-2.5 py-1 text-[12.5px] font-semibold", pack === l ? "bg-deep text-white" : "bg-[#f1f3ef] text-body")}>{l === "en" ? "EN" : "عربي"}</button>
        ))}
      </div>
      {packed && (
        <div dir={pack === "ar" ? "rtl" : "ltr"} lang={pack ?? "en"} className="mt-2.5 rounded-2xl bg-[#f6f8f5] p-3.5">
          <p className="text-[14px] font-semibold">{packed.title}</p>
          <ul className="mt-1.5 space-y-1 text-[13.5px] leading-relaxed text-body">{packed.sections.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
    </Card>
  );
}
