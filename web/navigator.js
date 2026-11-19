/* MemBrain Navigator — JavaScript port of membrain/navigator.py (parity-checked in web/parity_test.js). */
(function (root) {
  function makeNavigator(N) {
    const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
    const stateDate = (r, st) => { const h = r.history.find((x) => x.state === st); return h ? h.date : null; };
    const isUnresolved = (r) => !N.closed.includes(r.state);
    function advance(r, st, on, reason = "", by = "coordinator") {
      if (!(N.transitions[r.state] || []).includes(st)) throw new Error(`cannot move referral from '${r.state}' to '${st}'`);
      if (N.needs_reason.includes(st) && !reason) throw new Error(`'${st}' needs a reason`);
      r.state = st; r.history.push({ state: st, date: on, reason, by }); return r;
    }
    function newReferral(id, pid, pathway, service_id, urgency, on, reason, by = "clinician", entry_route = "programme") {
      return { id, participant_id: pid, pathway, service_id, urgency, reason, entry_route, state: "recommended", history: [{ state: "recommended", date: on, reason, by }] };
    }
    function match(pathway, person, today = new Date().toISOString().slice(0, 10)) {
      const langs = new Set(person.languages || [person.language || "ar"]); const out = [];
      for (const s of N.directory) {
        if (!s.pathways.includes(pathway)) continue;
        const langOk = s.languages.some((l) => langs.has(l)); const fundOk = !person.funding || s.funding.includes(person.funding);
        const stale = days(s.last_verified, today) > N.stale_after_days;
        const barriers = [...(langOk ? [] : ["language"]), ...(fundOk ? [] : ["funding"]), ...(s.accepting_referrals === false ? ["not accepting referrals"] : [])];
        const score = Math.round(((langOk ? 2 : 0) + (fundOk ? 2 : 0) + (person.emirate && s.emirate === person.emirate ? 1 : 0) - s.wait_weeks / 10) * 100) / 100;
        out.push({ ...s, accessible: !barriers.length, barriers, stale, score });
      }
      out.sort((a, b) => (b.accessible - a.accessible) || (b.score - a.score));
      const gap = !out.some((x) => x.accessible);
      return { pathway, services: out, gap, gap_action: gap ? "Record pathway gap, explain options to the person, escalate to responsible clinical team" : null };
    }
    const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    function metrics(refs, people, today = new Date().toISOString().slice(0, 10)) {
      const sent = refs.filter((r) => stateDate(r, "sent")); const done = refs.filter((r) => stateDate(r, "assessment_completed"));
      const accepted = sent.filter((r) => stateDate(r, "accepted"));
      const tcr = refs.filter((r) => r.concern_date).map((r) => days(r.concern_date, r.history[0].date));
      const tra = done.filter((r) => stateDate(r, "sent")).map((r) => days(stateDate(r, "sent"), stateDate(r, "assessment_completed")));
      const unresolved = refs.filter(isUnresolved); const reasons = {};
      refs.forEach((r) => { if (N.needs_reason.includes(r.state) || r.state === "missed") reasons[r.state] = (reasons[r.state] || 0) + 1; });
      const by = (key) => { const g = {};
        sent.forEach((r) => { const k = key === "entry_route" ? (r.entry_route || "unknown") : ((people[r.participant_id] || {})[key] || "unknown");
          const d = (g[k] = g[k] || { sent: 0, completed: 0 }); d.sent++; if (stateDate(r, "assessment_completed")) d.completed++; });
        const o = {}; Object.keys(g).sort().forEach((k) => (o[k] = { ...g[k], completion: g[k].sent ? Math.round((g[k].completed / g[k].sent) * 1000) / 1000 : null })); return o; };
      const overdue = unresolved.filter((r) => (r.state === "sent" || r.state === "recommended") && days(r.history[r.history.length - 1].date, today) > 14);
      const r3 = (x) => Math.round(x * 1000) / 1000;
      return { referrals: refs.length, sent: sent.length, accepted_rate: sent.length ? r3(accepted.length / sent.length) : null,
        completion_rate: sent.length ? r3(done.length / sent.length) : null, median_days_concern_to_review: median(tcr), median_days_referral_to_assessment: median(tra),
        unresolved: unresolved.length, overdue: overdue.length, non_completion_reasons: reasons,
        pathway_gaps: refs.filter((r) => r.history.some((h) => h.state === "no_accessible_service")).length,
        by_entry_route: by("entry_route"), by_language: by("language"), by_funding: by("funding"), by_sex: by("sex"), by_age_band: by("age_band") };
    }
    function pack(ref, svc, lang) {
      const t = N.pack[lang];
      const where = svc ? (lang === "en" ? `${svc.name}, ${svc.area}. ${svc.referral_process}. Expected wait about ${svc.wait_weeks} weeks.` : `${svc.name}، ${svc.area}. مدة الانتظار المتوقعة حوالي ${svc.wait_weeks} أسابيع.`)
                        : (lang === "en" ? "The clinic will call you to arrange the service." : "ستتصل بك العيادة لترتيب الموعد.");
      return { title: t.title, sections: [t.established, t.not_established, where, t.bring, t.independence, t.urgent, t.carer] };
    }
    return { advance, newReferral, match, metrics, pack, isUnresolved, stateDate, days };
  }
  if (typeof module !== "undefined") module.exports = makeNavigator; else root.makeNavigator = makeNavigator;
})(typeof window !== "undefined" ? window : globalThis);
