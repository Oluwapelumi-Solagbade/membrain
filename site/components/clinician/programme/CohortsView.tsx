"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Download, RotateCcw, Search, UsersRound, Check } from "lucide-react";
import { LevelPill } from "../../ui";
import { Loading, PageHeader, Panel, Stat, SyntheticBadge, btnClass, downloadText, toCsv } from "../parts";
import { useWorkspace } from "../WorkspaceProvider";
import { LevelBar, LEVEL_ORDER, selectClass } from "./common";
import { EDUCATION_LABEL, LEVEL_LABEL, type Level } from "@/lib/mb";
import { caseHref, fmtDate, HELD, isIntakeOnly, levelOf, matchesQuery, QUIET, sortCases } from "@/lib/workspace/derive";
import { ENTRY_LABEL } from "@/lib/workspace/concern";
import { NAV, STATE_LABEL, stateTone } from "@/lib/workspace/navigator";
import type { Case } from "@/lib/workspace/types";

const scored = (c: Case) => c.participant.sessions.filter((s) => s.type !== "intake");
const lastCheckIn = (c: Case) => scored(c).map((s) => s.date).sort().pop() ?? null;
const ageBand = (c: Case) => c.participant.age_band ?? (c.participant.age == null ? null : c.participant.age < 60 ? "50-59" : c.participant.age < 70 ? "60-69" : "70-75");
const route = (c: Case) => c.participant.entry_route ?? "programme";
const latestReferral = (c: Case) => c.participant.referrals[c.participant.referrals.length - 1];
const LANG: Record<string, string> = { ar: "Arabic", en: "English" };

function row(c: Case) {
  const p = c.participant;
  const ref = latestReferral(c);
  return {
    id: p.id,
    name: isIntakeOnly(c) ? "New concern" : p.display_name?.en ?? "",
    age: ageBand(c),
    sex: p.sex === "F" ? "Female" : p.sex === "M" ? "Male" : "Not recorded",
    dialect: p.dialect,
    education: p.education ? EDUCATION_LABEL[p.education] : null,
    funding: p.funding ? NAV.funding[p.funding] ?? p.funding : null,
    emirate: p.emirate ?? null,
    route: ENTRY_LABEL[route(c)] ?? route(c),
    language: LANG[p.language] ?? p.language,
    sessions: scored(c).length,
    last: lastCheckIn(c),
    level: levelOf(c),
    referral: ref ? STATE_LABEL[ref.state] : null,
  };
}

export function CohortsView() {
  const { ready, cases } = useWorkspace();
  const [level, setLevel] = useState<"all" | Level>("all");
  const [entry, setEntry] = useState("all");
  const [lang, setLang] = useState("all");
  const [q, setQ] = useState("");

  const routes = useMemo(() => [...new Set(cases.map(route))].sort(), [cases]);
  const langs = useMemo(() => [...new Set(cases.map((c) => c.participant.language))].sort(), [cases]);
  const shown = sortCases(
    cases.filter((c) => (level === "all" || levelOf(c) === level) && (entry === "all" || route(c) === entry) && (lang === "all" || c.participant.language === lang) && matchesQuery(c, q)),
  );

  const counts: Partial<Record<Level, number>> = {};
  cases.forEach((c) => (counts[levelOf(c)] = (counts[levelOf(c)] ?? 0) + 1));
  const held = cases.filter((c) => HELD.includes(levelOf(c))).length;
  const quiet = cases.filter((c) => QUIET.includes(levelOf(c))).length;
  const concerns = cases.filter(isIntakeOnly).length;

  const exportCsv = () => {
    const head = ["ID", "Name (synthetic)", "Age band", "Sex", "Dialect", "Schooling", "Funding", "Emirate", "Entry route", "Language", "Scored check-ins", "Last check-in", "Level", "Referral"];
    const rows = shown.map(row).map((r) => [r.id, r.name, r.age, r.sex, r.dialect, r.education, r.funding, r.emirate, r.route, r.language, r.sessions, r.last, LEVEL_LABEL.en[r.level], r.referral]);
    downloadText("membrain-cohort.csv", toCsv([head, ...rows]), "text/csv");
  };

  return (
    <>
      <PageHeader title="Cohorts" sub="Everyone in the programme and every concern raised, with where each person stands today" aside={<SyntheticBadge />} />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat tone="neutral" icon={UsersRound} label="People" value={cases.length} note={`${cases.length - concerns} enrolled · ${concerns} concern${concerns === 1 ? "" : "s"} not yet enrolled`} />
        <Stat tone="review" icon={AlertTriangle} label="Held for a clinician" value={held} note="Urgent or clinician review" />
        <Stat tone="check" icon={RotateCcw} label="Check again" value={counts.CHECK_AGAIN ?? 0} note="A repeat check-in is due" />
        <Stat tone="stable" icon={Check} label="Stable or building baseline" value={quiet} note="No action needed now" />
      </div>

      {!ready ? (
        <div className="mt-6">
          <Loading />
        </div>
      ) : (
        <>
          <div className="mt-6">
            <Panel title="Where the cohort stands" icon={UsersRound} aside={<span className="text-[14px] text-body">Latest level for each person</span>}>
              <LevelBar counts={counts} total={cases.length} />
            </Panel>
          </div>

          <section className="mt-6 overflow-hidden rounded-2xl border border-[#ebece8] bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-[#efefeb] px-5 py-4">
              <label className="relative flex min-w-[200px] flex-1 items-center">
                <Search size={18} className="pointer-events-none absolute left-3.5 text-body" />
                <span className="sr-only">Search the cohort</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by ID, name or referral" className="h-11 w-full rounded-xl border border-[#e3e4e0] bg-white pl-10 pr-3 text-[14.5px] outline-none focus:border-leaf" />
              </label>
              <label>
                <span className="sr-only">Level</span>
                <select value={level} onChange={(e) => setLevel(e.target.value as "all" | Level)} className={selectClass}>
                  <option value="all">All levels</option>
                  {LEVEL_ORDER.filter((l) => counts[l]).map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_LABEL.en[l]} ({counts[l]})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Entry route</span>
                <select value={entry} onChange={(e) => setEntry(e.target.value)} className={selectClass}>
                  <option value="all">All entry routes</option>
                  {routes.map((r) => (
                    <option key={r} value={r}>
                      {ENTRY_LABEL[r] ?? r}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Language</span>
                <select value={lang} onChange={(e) => setLang(e.target.value)} className={selectClass}>
                  <option value="all">All languages</option>
                  {langs.map((l) => (
                    <option key={l} value={l}>
                      {LANG[l] ?? l}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={exportCsv} className={btnClass.secondary}>
                <Download size={17} /> Export CSV
              </button>
            </div>

            <p className="px-5 pt-3 text-[13.5px] text-muted">
              Showing {shown.length} of {cases.length}. Names are invented for the demo; a real record holds only the pseudonymous ID here.
            </p>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto px-2 pb-3 pt-2 lg:block">
              <table className="w-full border-separate border-spacing-0 text-[14.5px]">
                <thead>
                  <tr className="text-left text-[13.5px] text-body">
                    {["ID", "Age · sex", "Dialect · schooling", "Funding · emirate", "Entry route", "Check-ins", "Last check-in", "Level", "Referral"].map((h) => (
                      <th key={h} className="bg-[#f5f5f2] px-3 py-2.5 font-medium first:rounded-l-lg last:rounded-r-lg">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => {
                    const r = row(c);
                    const ref = latestReferral(c);
                    return (
                      <tr key={r.id} className="hover:bg-[#fafaf8]">
                        <td className="border-b border-[#f0f0ec] px-3 py-3">
                          <Link href={caseHref(r.id)} className="font-semibold text-ink hover:text-leaf hover:underline">
                            {r.id}
                          </Link>
                          <span className="block text-[12.5px] text-muted">{r.name}</span>
                        </td>
                        <td className="border-b border-[#f0f0ec] px-3 py-3">{[r.age, r.sex].filter(Boolean).join(" · ") || "–"}</td>
                        <td className="border-b border-[#f0f0ec] px-3 py-3">{[r.dialect, r.education].filter(Boolean).join(" · ") || "–"}</td>
                        <td className="border-b border-[#f0f0ec] px-3 py-3">{[r.funding, r.emirate].filter(Boolean).join(" · ") || "–"}</td>
                        <td className="border-b border-[#f0f0ec] px-3 py-3">{r.route}</td>
                        <td className="border-b border-[#f0f0ec] px-3 py-3 tabular-nums">{r.sessions}</td>
                        <td className="border-b border-[#f0f0ec] px-3 py-3 whitespace-nowrap">{r.last ? fmtDate(r.last) : "–"}</td>
                        <td className="border-b border-[#f0f0ec] px-3 py-3">
                          <LevelPill level={r.level} size="sm" />
                        </td>
                        <td className="border-b border-[#f0f0ec] px-3 py-3">{ref ? <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ${stateTone(ref.state)}`}>{STATE_LABEL[ref.state]}</span> : <span className="text-muted">–</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phone and tablet cards */}
            <ul className="divide-y divide-[#efefeb] lg:hidden">
              {shown.map((c) => {
                const r = row(c);
                const ref = latestReferral(c);
                return (
                  <li key={r.id}>
                    <Link href={caseHref(r.id)} className="block px-5 py-4 hover:bg-[#fafaf8]">
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-[17px] font-semibold">{r.id}</span>
                        <LevelPill level={r.level} size="sm" />
                      </span>
                      <span className="mt-0.5 block text-[13px] text-muted">{r.name}</span>
                      <span className="mt-1 block text-[14px] text-body">{[r.age, r.sex, r.dialect, r.education].filter(Boolean).join(" · ")}</span>
                      <span className="mt-0.5 block text-[14px] text-body">
                        {r.route} · {r.sessions} check-in{r.sessions === 1 ? "" : "s"}
                        {r.last ? ` · last ${fmtDate(r.last)}` : ""}
                      </span>
                      {ref && <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ${stateTone(ref.state)}`}>Referral · {STATE_LABEL[ref.state]}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {shown.length === 0 && <p className="px-6 py-8 text-center text-[15px] text-muted">No one matches these filters.</p>}
          </section>
        </>
      )}
    </>
  );
}
