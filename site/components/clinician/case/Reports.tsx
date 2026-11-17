"use client";

import Link from "next/link";
import { ClipboardCheck, History, MessageSquarePlus } from "lucide-react";
import { LevelPill } from "../../ui";
import { btnClass, Panel } from "../parts";
import { REPORTER_LABEL, type Evaluation, type Reporter, type Session } from "@/lib/mb";
import { ACTIVITY, DOMAIN, RED_FLAG, WHO, label } from "@/lib/labels";
import { fmtDate } from "@/lib/workspace/derive";
import { FAQ_CUTOFF, FAQ_INTERVAL_WEEKS, FAQ_ITEMS, FAQ_MAX, ITEM, RESPONDENT } from "@/lib/workspace/informant";
import type { Case, Respondent } from "@/lib/workspace/types";

const COG = ["memory", "language", "orientation", "executive"];
const weeksSince = (d: string, today = new Date()) => Math.floor((today.getTime() - Date.parse(d)) / (7 * 86400000));

function Chip({ text, isNew, tone = "leaf" }: { text: string; isNew?: boolean; tone?: "leaf" | "review" | "urgent" }) {
  const ring = isNew ? (tone === "urgent" ? "bg-lv-urgent-soft text-lv-urgent ring-lv-urgent/25" : "bg-lv-review-soft text-lv-review ring-lv-review/25") : "bg-[#f3f4f1] text-body ring-transparent";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13.5px] ring-1 ${ring}`}>
      {isNew && <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">New</span>}
      {text}
    </span>
  );
}

/** Every report on the record in date order: concerns (the first and each follow-up) and the family questionnaire.
 *  What is "new" comes from the triage engine's own comparison (membrain/triage.py), not from this page. */
export function ReportsOverTime({ c }: { c: Case }) {
  const p = c.participant;
  const byId = new Map(p.sessions.map((s) => [s.session_id, s as Session]));
  const concerns = c.history.filter((h) => h.concern_change);
  const faqs = c.history.filter((h) => h.informant && h.informant.score != null);
  const lastFaq = faqs[faqs.length - 1];
  const due = lastFaq ? weeksSince(lastFaq.date) >= FAQ_INTERVAL_WEEKS : true;
  const first = concerns[0]?.concern_change;
  const latest = concerns[concerns.length - 1]?.concern_change;
  const grownDomains = first && latest && concerns.length > 1 ? concerns.flatMap((h) => h.concern_change!.new_domains).filter((d) => COG.includes(d)) : [];
  const grownActs = first && concerns.length > 1 ? concerns.flatMap((h) => h.concern_change!.new_activities) : [];

  return (
    <Panel
      id="reports"
      title="Reports over time"
      icon={History}
      aside={
        <div className="flex flex-wrap gap-2 print:hidden">
          <Link href={`/concern/?for=${encodeURIComponent(p.id)}`} className={btnClass.secondary}>
            <MessageSquarePlus size={16} /> Record a follow-up concern
          </Link>
          <Link href={`/informant/?id=${encodeURIComponent(p.id)}`} className={btnClass.secondary}>
            <ClipboardCheck size={16} /> Family questionnaire
          </Link>
        </div>
      }
    >
      {/* Concern trajectory */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-semibold">The concern, each time it was reported</h3>
          <p className="text-[13.5px] text-muted">
            {concerns.length ? `${concerns.length} report${concerns.length === 1 ? "" : "s"} since ${fmtDate(first?.since ?? concerns[0].date)}` : "No concern reported yet"}
          </p>
        </div>
        {concerns.length > 1 && (
          <p className={`mt-2 rounded-xl px-4 py-2.5 text-[14.5px] ${grownDomains.length || grownActs.length ? "bg-lv-review-soft text-[#7a3320]" : "bg-[#f3f4f1] text-body"}`}>
            {grownDomains.length || grownActs.length
              ? `Since the first report: ${[
                  grownDomains.length ? `newly reported ${grownDomains.map((d) => label(DOMAIN, d, "en").toLowerCase()).join(", ")}` : "",
                  grownActs.length ? `${grownActs.map((a) => label(ACTIVITY, a, "en").toLowerCase()).join(", ")} now done by someone else` : "",
                ].filter(Boolean).join("; ")}.`
              : "No new area or activity taken over since the first report."}
          </p>
        )}
        {concerns.length > 0 && (
          <ol className="relative mt-4 space-y-4 border-s-2 border-[#e6e8e3] ps-5">
            {concerns.map((h) => {
              const ch = h.concern_change!;
              const s = byId.get(h.session_id);
              const rc = (s?.reported_concern ?? {}) as { timeline?: [string, string][] };
              const who = new Map((rc.timeline ?? (h === concerns[0] ? p.intake?.confirmed?.timeline ?? [] : [])).map(([a, w]) => [a, w]));
              const lang = (s?.concern && /[؀-ۿ]/.test(s.concern)) ? "ar" : "en";
              const reporter = ch.reporter ? REPORTER_LABEL.en[ch.reporter as Reporter] ?? ch.reporter : "Not recorded";
              const flags = (s?.red_flags ?? []) as string[];
              return (
                <li key={h.session_id} className="relative">
                  <span className={`absolute -start-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${h.level === "URGENT" ? "bg-lv-urgent" : h.level === "CLINICIAN_REVIEW" && !h.carried ? "bg-lv-review" : "bg-leaf"}`} aria-hidden />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-[13.5px] text-ink">{h.date}</span>
                    <span className="text-[14px] text-body">{ch.first ? "First report" : "Follow-up"} · {reporter} · {(s?.channel as string) ?? "app"}</span>
                    {h.carried ? <span className="text-[12.5px] text-muted">level unchanged</span> : <LevelPill level={h.level} size="sm" />}
                  </div>
                  {s?.concern && (
                    <p dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className={`mt-1.5 line-clamp-3 text-ink ${lang === "ar" ? "text-[16px] leading-[1.8]" : "text-[15px] leading-relaxed"}`}>
                      “{s.concern}”
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ch.domains.map((d) => <Chip key={d} text={label(DOMAIN, d, "en")} isNew={ch.new_domains.includes(d) && COG.includes(d)} />)}
                    {ch.activities.map((a) => (
                      <Chip key={a} text={`${label(ACTIVITY, a, "en")}${who.get(a) ? `: ${label(WHO, who.get(a)!, "en")}` : ""}`} isNew={ch.new_activities.includes(a)} />
                    ))}
                    {flags.map((f) => <Chip key={f} text={label(RED_FLAG, f, "en")} isNew tone="urgent" />)}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Family questionnaire */}
      <div className="mt-7 border-t border-line pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-semibold">Family questionnaire (FAQ)</h3>
          <p className={`text-[13.5px] ${due ? "font-medium text-lv-check" : "text-muted"}`}>
            {lastFaq ? (due ? `Due again: last answered ${fmtDate(lastFaq.date)}` : `Next due ${fmtDate(new Date(Date.parse(lastFaq.date) + FAQ_INTERVAL_WEEKS * 7 * 86400000).toISOString())}`) : "Not answered yet"}
          </p>
        </div>
        {faqs.length > 0 && <FaqSeries faqs={faqs} byId={byId} />}
        <p className="mt-3 text-[13px] leading-snug text-body">
          Ten everyday activities rated by a family member as they are now, 0 to {FAQ_MAX}. {FAQ_CUTOFF} or more suggests the person needs a professional clinical evaluation;
          it is a screening result, not a diagnosis of dementia or any other condition. Wording adapted for the UAE; the Arabic version is not yet validated.
        </p>
      </div>
    </Panel>
  );
}

function FaqSeries({ faqs, byId }: { faqs: Evaluation[]; byId: Map<string, Session> }) {
  const last = faqs[faqs.length - 1];
  const prev = faqs.length > 1 ? faqs[faqs.length - 2] : null;
  const items = (h: Evaluation | null) => (h ? ((byId.get(h.session_id)?.faq_items as Record<string, number> | undefined) ?? null) : null);
  const now = items(last), before = items(prev);
  const worse = now && before ? FAQ_ITEMS.filter((k) => now[k] > before[k]) : [];
  const H = 96;
  const y = (v: number) => H - (v / FAQ_MAX) * H;
  return (
    <div className="mt-3 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <div className="relative rounded-xl bg-[#fafaf8] px-3 pb-2 pt-3">
          <div className="relative" style={{ height: H }}>
            <div className="absolute inset-x-0 border-t border-dashed border-lv-review/60" style={{ top: y(FAQ_CUTOFF) }} aria-hidden />
            <span className="absolute end-0 -translate-y-full text-[11px] font-medium text-lv-review" style={{ top: y(FAQ_CUTOFF) }}>cutoff {FAQ_CUTOFF}</span>
            <div className="absolute inset-0 flex items-end justify-around gap-2">
              {faqs.map((h) => {
                const v = h.informant!.score!;
                return (
                  <div key={h.session_id} className="flex w-full max-w-[44px] flex-col items-center justify-end" style={{ height: "100%" }}>
                    <span className="mb-1 font-mono text-[12.5px] font-semibold tabular-nums text-ink">{v}</span>
                    <span className={`w-full rounded-t-md ${v >= FAQ_CUTOFF ? "bg-lv-review" : "bg-leaf"}`} style={{ height: `${Math.max(3, (v / FAQ_MAX) * 100)}%` }} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-1.5 flex justify-around gap-2">
            {faqs.map((h) => <span key={h.session_id} className="w-full max-w-[44px] text-center font-mono text-[11px] text-muted">{h.date.slice(5)}</span>)}
          </div>
        </div>
        <table className="mt-3 w-full text-[14px]">
          <tbody>
            {[...faqs].reverse().map((h) => {
              const inf = h.informant!;
              const r = byId.get(h.session_id)?.respondent as Respondent | undefined;
              return (
                <tr key={h.session_id} className="border-b border-[#f0f0ec] last:border-0">
                  <td className="py-2 pe-3 font-mono text-[13px]">{h.date}</td>
                  <td className="py-2 pe-3 text-body">{r ? RESPONDENT[r].en : "–"}</td>
                  <td className="py-2 pe-3 text-end font-mono font-semibold tabular-nums">{inf.score}/{inf.max}</td>
                  <td className={`py-2 text-end font-mono tabular-nums ${inf.change != null && inf.change > 0 ? "text-lv-review" : "text-muted"}`}>
                    {inf.change == null ? "first" : inf.change > 0 ? `+${inf.change}` : inf.change}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-leaf">{prev ? `Harder since ${fmtDate(prev.date)}` : "Latest answers"}</p>
        {prev && worse.length === 0 && <p className="mt-2 text-[14.5px] text-body">No activity rated harder than last time.</p>}
        <ul className="mt-2 space-y-1.5">
          {(prev ? worse : FAQ_ITEMS.filter((k) => (now?.[k] ?? 0) > 0)).map((k) => (
            <li key={k} className="flex items-center justify-between gap-3 rounded-lg bg-[#fafaf8] px-3 py-2 text-[14px]">
              <span>{ITEM[k].en}</span>
              <span className="shrink-0 font-mono tabular-nums text-body">
                {before ? <>{before[k]} → </> : null}
                <span className="font-semibold text-ink">{now?.[k]}</span>
                <span className="text-muted">/3</span>
              </span>
            </li>
          ))}
          {!prev && now && FAQ_ITEMS.every((k) => now[k] === 0) && <li className="text-[14.5px] text-body">Every activity managed normally.</li>}
        </ul>
      </div>
    </div>
  );
}
