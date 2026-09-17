import type { BillFeeContext, CaTherapyContext } from "@mindbill/browser";

/** A partial draft never implies clinical facts or a fee agreement. */
type TherapyDraft = { [Key in keyof CaTherapyContext]?: CaTherapyContext[Key] | undefined };
export type TherapyDetails = {
  therapyPricingBasis?: "" | "omfs" | "agreement" | undefined;
  therapy?: TherapyDraft | undefined;
};
type TherapyInputs = TherapyDetails & { providerKind?: string | undefined; minutes?: number | undefined; totalMinutes?: number | undefined };
const flags = ["personallyPerformed", "hospitalPatient", "incidentToPhysicianService", "assistantInvolved", "globalPeriodApplies", "hpsaBonusEligible"] as const;
export const isInitialPtEvaluationCode = (code: string) => /^9716[123]$/.test(code.trim());
export const isTherapyEditorCode = (code: string) => code.trim() === "97110" || isInitialPtEvaluationCode(code);

export function therapyDetailsFromSaved(saved?: BillFeeContext): TherapyDetails {
  return {
    therapyPricingBasis: saved?.hasFeeAgreement === false ? "omfs" : saved?.hasFeeAgreement === true ? "agreement" : "",
    ...(saved?.therapyContext ? { therapy: { ...saved.therapyContext } } : {}),
  };
}

export function missingTherapyDetails(details: TherapyInputs, code = "97110"): string[] {
  const missing: string[] = [];
  if (!details.therapyPricingBasis) missing.push("pricing basis");
  if (details.providerKind !== "physical_therapist" && details.providerKind !== "other") missing.push("provider type");
  if (isInitialPtEvaluationCode(code)) {
    if (typeof details.therapy?.priorInitialEvaluationInEpisode !== "boolean") missing.push("initial evaluation history for this care episode");
  } else {
  if (!(Number.isInteger(details.minutes) && details.minutes! > 0)) missing.push("direct one-on-one minutes");
  if (!(Number.isInteger(details.totalMinutes) && details.totalMinutes! > 0)) missing.push("total visit minutes");
  }
  const facts = details.therapy ?? {};
  if (typeof facts.personallyPerformed !== "boolean" || typeof facts.assistantInvolved !== "boolean") missing.push("care delivery");
  if (typeof facts.incidentToPhysicianService !== "boolean") missing.push("billing arrangement");
  if (typeof facts.hospitalPatient !== "boolean") missing.push("patient setting");
  if (typeof facts.globalPeriodApplies !== "boolean" || typeof facts.hpsaBonusEligible !== "boolean") missing.push("payment adjustments");
  if (!(Number.isInteger(facts.visitsOnDate) && facts.visitsOnDate! > 0)) missing.push("visits on this date");
  return missing;
}

/** This form contains the encounter's services. Supplied incomplete/other-service facts remain authoritative. */
export function therapyCalculationContext(placeOfService: string, details: TherapyInputs, saved: BillFeeContext = {}, code = "97110"): BillFeeContext {
  if (missingTherapyDetails(details, code).length) return {};
  const facts = Object.fromEntries(Object.entries(details.therapy!).filter(([, value]) => value !== undefined)) as CaTherapyContext;
  if (isInitialPtEvaluationCode(code)) { delete facts.directOneOnOneMinutes; delete facts.totalVisitMinutes; }
  // Check every flag explicitly; false and unknown are different inputs.
  if (!flags.every((key) => typeof facts[key] === "boolean")) return {};
  const context = { ...saved };
  delete context.physicianContext;
  delete context.prolongedServiceContext;
  delete context.dmeposContext;
  delete context.padbContext;
  delete context.anesthesiaContext;
  return {
    ...context,
    hasFeeAgreement: details.therapyPricingBasis === "agreement",
    therapyContext: {
      ...facts,
      providerKind: details.providerKind as NonNullable<CaTherapyContext["providerKind"]>,
      personallyPerformed: facts.personallyPerformed!, assistantInvolved: facts.assistantInvolved!,
      hospitalPatient: facts.hospitalPatient!, incidentToPhysicianService: facts.incidentToPhysicianService!,
      globalPeriodApplies: facts.globalPeriodApplies!, hpsaBonusEligible: facts.hpsaBonusEligible!,
      placeOfService, ...(!isInitialPtEvaluationCode(code) ? { directOneOnOneMinutes: details.minutes!, totalVisitMinutes: details.totalMinutes! } : {}), visitsOnDate: facts.visitsOnDate!,
      completeSameDayServices: facts.completeSameDayServices ?? true,
      otherSameDayServices: facts.otherSameDayServices ?? false,
    },
  };
}

export function TherapyLineFields({ index, details, update, code = "97110" }: { code?: string; index: number; details: TherapyDetails; update: (patch: Partial<TherapyDetails>) => void }) {
  const facts = details.therapy ?? {};
  const patch = (value: TherapyDraft) => update({ therapy: { ...facts, ...value } });
  const delivery = typeof facts.personallyPerformed === "boolean" && typeof facts.assistantInvolved === "boolean" ? `${Number(facts.personallyPerformed)}${Number(facts.assistantInvolved)}` : "";
  const adjustments = typeof facts.globalPeriodApplies === "boolean" && typeof facts.hpsaBonusEligible === "boolean" ? `${Number(facts.globalPeriodApplies)}${Number(facts.hpsaBonusEligible)}` : "";
  const unknown = <option value="">Select from the service record…</option>;
  return <div className="mbsf-grid" aria-label={`Therapy service details for line ${index + 1}`}>
    {isInitialPtEvaluationCode(code) && <label className="mbsf-field"><span>Prior initial evaluation in this care episode</span><select className="mbsf-input" aria-label={`Prior initial evaluation for line ${index + 1}`} value={typeof facts.priorInitialEvaluationInEpisode === "boolean" ? String(facts.priorInitialEvaluationInEpisode) : ""} onChange={event => patch({ priorInitialEvaluationInEpisode: event.target.value ? event.target.value === "true" : undefined })}>{unknown}<option value="false">No prior initial evaluation</option><option value="true">An initial evaluation already occurred</option></select><small>Include evaluations on earlier dates in this care episode.</small></label>}
    <label className="mbsf-field"><span>Therapy pricing basis</span><select className="mbsf-input" aria-label={`Therapy pricing basis for line ${index + 1}`} value={details.therapyPricingBasis ?? ""} onChange={(event) => update({ therapyPricingBasis: event.target.value as TherapyDetails["therapyPricingBasis"] })}>{unknown}<option value="omfs">OMFS — no negotiated fee agreement</option><option value="agreement">Negotiated fee agreement</option></select></label>
    <label className="mbsf-field"><span>Care delivery</span><select className="mbsf-input" aria-label={`Therapy care delivery for line ${index + 1}`} value={delivery} onChange={(event) => patch({ personallyPerformed: event.target.value ? event.target.value[0] === "1" : undefined, assistantInvolved: event.target.value ? event.target.value[1] === "1" : undefined })}>{unknown}<option value="10">Personally performed; no assistant</option><option value="11">Personally performed with assistant involvement</option><option value="01">Assistant performed the service</option><option value="00">Not personally performed; no assistant</option></select></label>
    <label className="mbsf-field"><span>Billing arrangement</span><select className="mbsf-input" aria-label={`Therapy billing arrangement for line ${index + 1}`} value={typeof facts.incidentToPhysicianService === "boolean" ? String(facts.incidentToPhysicianService) : ""} onChange={(event) => patch({ incidentToPhysicianService: event.target.value ? event.target.value === "true" : undefined })}>{unknown}<option value="false">Therapist's own service</option><option value="true">Incident to a physician's service</option></select></label>
    <label className="mbsf-field"><span>Patient setting</span><select className="mbsf-input" aria-label={`Therapy patient setting for line ${index + 1}`} value={typeof facts.hospitalPatient === "boolean" ? String(facts.hospitalPatient) : ""} onChange={(event) => patch({ hospitalPatient: event.target.value ? event.target.value === "true" : undefined })}>{unknown}<option value="false">Not a hospital inpatient or outpatient</option><option value="true">Hospital inpatient or outpatient</option></select></label>
    <label className="mbsf-field"><span>Payment adjustments</span><select className="mbsf-input" aria-label={`Therapy payment adjustments for line ${index + 1}`} value={adjustments} onChange={(event) => patch({ globalPeriodApplies: event.target.value ? event.target.value[0] === "1" : undefined, hpsaBonusEligible: event.target.value ? event.target.value[1] === "1" : undefined })}>{unknown}<option value="00">No global-period adjustment or HPSA bonus</option><option value="10">Global-period adjustment applies</option><option value="01">Health professional shortage area (HPSA) bonus applies</option><option value="11">Both apply</option></select></label>
    <label className="mbsf-field"><span>Therapy visits on this date</span><input className="mbsf-input" aria-label={`Therapy visits for line ${index + 1}`} type="number" min="1" step="1" value={facts.visitsOnDate ?? ""} onChange={(event) => patch({ visitsOnDate: event.target.value ? Number(event.target.value) : undefined })} /></label>
    <p className="mbsf-help mbsf-span">Include all services for this patient and service date by the provider or group in this bill. {isInitialPtEvaluationCode(code) ? "Initial evaluations are untimed and require one unit as the only service that day. Choose the code from the documented evaluation complexity, not its duration. Prior evaluations in this episode or other circumstances require review." : "Use actual documented minutes. Other arrangements, additional same-day services and some timed-unit combinations require fee review."}</p>
  </div>;
}
