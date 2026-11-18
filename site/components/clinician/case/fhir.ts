// A FHIR R4 collection Bundle for one case, built in the browser. First written for the earlier prototype
// (the genomics part is left out). The server's GET /participants/{pid}/fhir is the reference export.
import { config, LEVEL_LABEL } from "@/lib/mb";
import { NAV } from "@/lib/workspace/navigator";
import type { Case } from "@/lib/workspace/types";

const CS = "https://fhir.membrain.health/CodeSystem";
const cc = (s: string, c: string, d: string) => ({ coding: [{ system: s, code: c, display: d }], text: d });

const FS: Record<string, string> = {
  recommended: "draft",
  sent: "active",
  accepted: "active",
  appointment_offered: "active",
  attended: "active",
  missed: "on-hold",
  declined: "revoked",
  assessment_completed: "completed",
  follow_up_documented: "completed",
  lost_to_follow_up: "on-hold",
  no_accessible_service: "on-hold",
  cancelled: "revoked",
};

type Resource = Record<string, unknown> & { resourceType: string; id: string };

export function fhirBundle(c: Case) {
  const p = c.participant;
  let n = 0;
  const id = (k: string) => `${p.id}-${k}-${++n}`;
  const ent: Resource[] = [];
  ent.push({
    resourceType: "Patient",
    id: p.id,
    gender: ({ F: "female", M: "male" } as Record<string, string>)[p.sex] ?? "unknown",
    extension: [
      { url: CS + "/ext/education-band", valueCode: p.education },
      { url: CS + "/ext/dialect", valueString: p.dialect },
    ],
  });
  Object.entries(p.consent ?? {}).forEach(([k, v]) =>
    ent.push({
      resourceType: "Consent",
      id: id("consent"),
      status: v ? "active" : "inactive",
      category: [cc(CS + "/consent-signal", k, k)],
      patient: { reference: "Patient/" + p.id },
      provision: { type: v ? "permit" : "deny" },
    }),
  );
  c.history.forEach((h) => {
    const s = p.sessions.find((x) => x.session_id === h.session_id);
    const raw = s?.raw as Record<string, number> | undefined;
    if (!s || !raw) return;
    const z = (h as unknown as { z?: { composite?: number } }).z;
    const o: Resource = {
      resourceType: "Observation",
      id: id("obs"),
      status: "final",
      code: cc(CS + "/digital-marker", "membrain-checkin", "MemBrain voice check-in"),
      subject: { reference: "Patient/" + p.id },
      effectiveDateTime: h.date,
      component: [
        ...Object.entries(raw).map(([k, v]) => ({ code: cc(CS + "/cognitive-domain", k, k), valueInteger: v })),
        ...(z?.composite != null ? [{ code: cc(CS + "/digital-marker", "composite-z", "Education-stratified composite z"), valueQuantity: { value: z.composite, unit: "z" } }] : []),
      ],
    };
    ent.push(o);
    if (h.valid && h.level !== "BASELINE") {
      const ra: Resource = {
        resourceType: "RiskAssessment",
        id: id("risk"),
        status: "preliminary",
        subject: { reference: "Patient/" + p.id },
        occurrenceDateTime: h.date,
        basis: [{ reference: "Observation/" + o.id }],
        method: cc(CS + "/method", "rci-rules-" + config.ENGINE_VERSION, "Practice-adjusted RCI + confounder rules"),
        prediction: [{ outcome: cc(CS + "/triage-level", h.level, LEVEL_LABEL.en[h.level]), rationale: h.reasons.join("; ") }],
        note: [{ text: "Risk/change identification only. Not a diagnosis." }],
      };
      ent.push(ra);
      if (h.held_for_clinician)
        ent.push({
          resourceType: "Task",
          id: id("task"),
          status: "requested",
          intent: "order",
          priority: h.level === "URGENT" ? "urgent" : "routine",
          for: { reference: "Patient/" + p.id },
          focus: { reference: "RiskAssessment/" + ra.id },
          authoredOn: h.date,
          code: cc(CS + "/task", "clinician-review", "Clinician review of MemBrain alert"),
        });
    }
  });
  p.referrals.forEach((r) =>
    ent.push({
      resourceType: "ServiceRequest",
      id: id("ref"),
      status: FS[r.state],
      intent: "order",
      priority: r.urgency === "urgent" ? "urgent" : "routine",
      code: cc(CS + "/pathway", r.pathway, NAV.pathways[r.pathway] ?? r.pathway),
      subject: { reference: "Patient/" + p.id },
      authoredOn: r.history[0]?.date,
      performer: [{ display: r.service_id || "to be assigned" }],
      extension: [{ url: CS + "/ext/referral-state", valueCode: r.state }],
      note: r.history.map((h) => ({ text: `${h.date} ${h.state} ${h.reason || ""}`.trim() })),
    }),
  );
  return { resourceType: "Bundle", type: "collection", entry: ent.map((r) => ({ fullUrl: "urn:uuid:" + r.id, resource: r })) };
}
