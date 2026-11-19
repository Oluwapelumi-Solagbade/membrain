// Client-side clinical referral drafting generator.
// Generates a medically grounded, structured referral letter from confirmed Case data
// matching the backend rules protocol in membrain/intake.py.
import type { Case } from "./types";

export function draftFromCase(c: Case): string[] {
  const p = c.participant;
  const latest = c.latest;
  const sentences: string[] = [];

  // 1. Demographics & Referral Target
  const name = p.display_name?.en || p.display_name?.ar || p.id;
  const age = p.age;
  const sex = p.sex === "M" ? "male" : p.sex === "F" ? "female" : "individual";
  const ageStr = age ? `, a ${age}-year-old ${sex}` : `, an adult ${sex}`;
  const emirate = p.emirate || "Abu Dhabi";
  const entry = (p.entry_route || "primary care").replace(/_/g, " ");
  const pathway = (p.referrals?.[0]?.pathway || "memory_clinic").replace(/_/g, " ");
  const pathwayLabel = pathway.charAt(0).toUpperCase() + pathway.slice(1);

  sentences.push(
    `Clinical referral for specialist assessment at ${pathwayLabel} for ${name}${ageStr} residing in ${emirate} (entry via ${entry}).`
  );

  // Clinical Urgency & Primary Indicators
  const lvl = latest?.level;
  const reasons = latest?.reasons || [];
  if (lvl === "URGENT") {
    sentences.push(
      reasons.length
        ? `Urgent clinical review required. Primary indicators: ${reasons.join("; ")}.`
        : "Urgent clinical review required due to acute or high-risk cognitive and functional indicators."
    );
  } else if (lvl === "CLINICIAN_REVIEW" || lvl === "CHECK_AGAIN") {
    sentences.push(
      reasons.length
        ? `Clinical review recommended based on longitudinal monitoring. Primary indicators: ${reasons.join("; ")}.`
        : "Clinical review recommended based on longitudinal cognitive monitoring."
    );
  }

  // 2. Informant & Caregiver Intake Concern
  const concern = c.concern;
  if (concern?.red_flags_reported?.length) {
    sentences.push(`Urgent safety/red flags reported at intake: ${concern.red_flags_reported.join("; ")}.`);
  }

  if (concern?.what_changed?.length) {
    const onsetStr = concern.onset ? ` over ${concern.onset}` : "";
    const raised = concern.raised_by || "Family";
    sentences.push(`${raised} reports noticeable changes in ${concern.what_changed.join(", ")}${onsetStr}.`);
  }

  if (concern?.who_now_does_what?.length) {
    sentences.push(`Everyday functional tasks taken over by household members: ${concern.who_now_does_what.join("; ")}.`);
  }

  if (concern?.in_their_words && concern.in_their_words.trim().length > 10) {
    const q = concern.in_their_words.trim().slice(0, 120);
    sentences.push(`In the reporter's own words: “${q}${concern.in_their_words.length > 120 ? "..." : ""}”.`);
  }

  if (concern?.confounders_reported?.length) {
    sentences.push(`Clinical confounders noted at intake: ${concern.confounders_reported.join("; ")}.`);
  }

  // Background case presentation context (from clinical story if no narrative)
  if (!concern?.in_their_words && p.story) {
    sentences.push(`Case presentation context: ${p.story}`);
  }

  // 3. Longitudinal Cognitive Check-In Trajectory
  const checkins = c.history.filter((h) => !h.intake && !h.informant_report && h.valid !== false);
  if (checkins.length > 0) {
    const firstDate = checkins[checkins.length - 1]?.date;
    const latestDate = checkins[0]?.date;
    const dRange = firstDate && latestDate && firstDate !== latestDate ? `from ${firstDate} to ${latestDate}` : firstDate ? `on ${firstDate}` : "";
    sentences.push(`Digital cognitive tracking comprises ${checkins.length} check-in session(s) completed ${dRange}.`.trim());
  }

  const drivers = latest?.drivers || [];
  if (drivers.length > 0) {
    const dStrs = drivers.slice(0, 3).map((d) => `${d.input}: ${d.value > 0 ? "+" : ""}${d.value.toFixed(2)}`);
    sentences.push(`Key psychometric decline drivers: ${dStrs.join("; ")}.`);
  }

  // 4. Modifiable Risk Factors & Reversible Causes (Lancet Commission 2024)
  const ctx = (c.risk_context || p.context || {}) as Record<string, unknown>;
  const rfItems: string[] = [];
  if (ctx.sbp != null && ctx.dbp != null) rfItems.push(`blood pressure ${ctx.sbp}/${ctx.dbp} mmHg`);
  if (ctx.hba1c != null) rfItems.push(`HbA1c ${ctx.hba1c}%`);
  if (ctx.ldl != null) rfItems.push(`LDL ${ctx.ldl} mmol/L`);
  if (ctx.bmi != null) rfItems.push(`BMI ${ctx.bmi}`);
  if (ctx.smoker) rfItems.push("smoking history");
  if (ctx.family_history_dementia) rfItems.push("family history of dementia");
  if (ctx.activity_min_week != null) rfItems.push(`physical activity ${ctx.activity_min_week} min/week`);
  if (ctx.sleep_hours != null) rfItems.push(`sleep duration ${ctx.sleep_hours} hours/night`);

  if (rfItems.length > 0) {
    sentences.push(`Lancet Commission 2024 cardiovascular & lifestyle risk factors: ${rfItems.join(", ")}.`);
  }

  // 5. Recommended Actions & Next Steps
  sentences.push(
    "Recommended specialist actions: comprehensive multidisciplinary memory clinic evaluation, formal certified clinician MoCA, structural neuroimaging (brain MRI/CT) if clinically indicated, and cardiovascular risk factor optimization."
  );

  // 6. Safety Boundary Disclaimer
  sentences.push("This referral letter is a screening-derived clinical assessment request. No formal diagnosis has been made.");

  return sentences;
}
