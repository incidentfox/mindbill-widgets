import type { BrowserBillCreateInput, BillFeeContext, BillFeeQuoteInput } from "@mindbill/browser";
import { parseMindBillSubmissionDate } from "./submission-format";
export type BillSubmissionFeeContext = BillFeeContext;

export type FeeDetails = {
  providerKind?: NonNullable<BillFeeQuoteInput["physicianContext"]>["providerKind"] | "physical_therapist" | "" | undefined;
  basis?: "standard" | "adjustment";
  minutes?: number | undefined;
  totalMinutes?: number | undefined;
  relatedEvaluationDate?: string | undefined;
  prolongedTimeBasis?: "documented" | "review" | "" | undefined;
};
export const isProlongedCode = (code: string) => /^9935[89]$/.test(code.trim());

/** Standard estimate assumptions; prolonged-service facts require an explicit documentation selection. */
export function billSubmissionEstimateContext(code: string, placeOfService: string, details: FeeDetails = {}): BillSubmissionFeeContext {
  if (details.basis === "adjustment") return {};
  if (code !== "97110" && /^[A-Z0-9]{5}$/.test(code) && !/^ML/.test(code) && details.providerKind && details.providerKind !== "physical_therapist") return {
    hasFeeAgreement: false, physicianContext: { providerKind: details.providerKind, placeOfService, incidentToPhysicianService: false, standaloneService: true, globalPeriodApplies: false, hpsaBonusEligible: false },
    ...(isProlongedCode(code) && details.prolongedTimeBasis === "documented" && details.totalMinutes && parseMindBillSubmissionDate(details.relatedEvaluationDate ?? "") ? {
      prolongedServiceContext: {
        totalMinutes: details.totalMinutes, relatedEvaluationDate: parseMindBillSubmissionDate(details.relatedEvaluationDate!)!,
        ongoingPatientManagement: true, personallyPerformed: true, timeCountedInOtherServices: false,
        completeSameDayServices: true, sameDayServices: [],
      },
    } : {}),
  };
  if (code === "97110" && (details.providerKind === "physical_therapist" || details.providerKind === "other") && details.minutes && details.totalMinutes) return {
    hasFeeAgreement: false, therapyContext: { providerKind: details.providerKind, personallyPerformed: true, hospitalPatient: false, incidentToPhysicianService: false, assistantInvolved: false, placeOfService, directOneOnOneMinutes: details.minutes, totalVisitMinutes: details.totalMinutes, visitsOnDate: 1, completeSameDayServices: true, otherSameDayServices: false, globalPeriodApplies: false, hpsaBonusEligible: false },
  };
  return {};
}
/** Rebuild edited fields so clearing an input cannot retain a previously priced context. */
export function billSubmissionCalculationContext(code: string, placeOfService: string, details: FeeDetails, saved: BillFeeContext = {}): BillFeeContext {
  if (details.basis === "adjustment") return {};
  const estimated = billSubmissionEstimateContext(code, placeOfService, details);
  const context = { ...estimated, ...saved };
  delete context.physicianContext;
  delete context.therapyContext;
  delete context.prolongedServiceContext;
  if (estimated.physicianContext) context.physicianContext = {
    ...estimated.physicianContext, ...saved.physicianContext,
    providerKind: estimated.physicianContext.providerKind, placeOfService,
  };
  if (estimated.therapyContext) context.therapyContext = {
    ...estimated.therapyContext, ...saved.therapyContext,
    providerKind: estimated.therapyContext.providerKind, placeOfService,
    directOneOnOneMinutes: estimated.therapyContext.directOneOnOneMinutes,
    totalVisitMinutes: estimated.therapyContext.totalVisitMinutes,
  };
  if (estimated.prolongedServiceContext) context.prolongedServiceContext = estimated.prolongedServiceContext;
  return context;
}

export const isMedicalLegalCode = (code: string) => /^ML/i.test(code.trim());

/** Context and service changes produce a different quote request; amounts are never reused across requests. */
export function billSubmissionFeeRequest(bill: BrowserBillCreateInput, line: BrowserBillCreateInput["serviceLines"][number], context: BillSubmissionFeeContext = line.feeContext ?? {}): BillFeeQuoteInput {
  const dateOfService = parseMindBillSubmissionDate(line.serviceDate ?? bill.service.date) ?? "";
  const sameDayServices = bill.serviceLines.filter((candidate) => candidate.code.trim() && parseMindBillSubmissionDate(candidate.serviceDate ?? bill.service.date) === dateOfService);
  const otherSameDayServices = Boolean(dateOfService) && sameDayServices.length > 1;
  const billingProviderId = ("savedProviderId" in bill.billingProvider ? bill.billingProvider.savedProviderId : "id" in bill.billingProvider ? bill.billingProvider.id : undefined);
  const payerId = bill.claim.claimsAdministrator?.id;
  return {
    ...billSubmissionQuoteContext(context as BillFeeQuoteInput),
    ...(line.drug ? { drug: line.drug } : {}),
    ...(otherSameDayServices && context.physicianContext ? { physicianContext: { ...context.physicianContext, standaloneService: false } } : {}),
    ...(otherSameDayServices && context.therapyContext ? { therapyContext: { ...context.therapyContext, otherSameDayServices: true } } : {}),
    ...(context.prolongedServiceContext ? { prolongedServiceContext: { ...context.prolongedServiceContext, sameDayServices: sameDayServices.map((candidate) => ({ code: candidate.code.trim().toUpperCase(), units: candidate.units ?? 1 })) } } : {}),
    ...(billingProviderId ? { billingProviderId } : {}), ...(payerId ? { payerId } : {}),
    code: line.code.trim().toUpperCase(), dateOfService, units: line.units ?? 1, modifiers: line.modifiers ?? [], serviceZip: bill.serviceLocation?.address?.postalCode ?? "",
  };
}

/** Keep only calculation context; the server derives identities and service fields from the bill. */
export function billSubmissionQuoteContext(input: BillFeeQuoteInput): BillFeeContext {
  return {
    ...(input.padbContext ? { padbContext: input.padbContext } : {}),
    ...(input.anesthesiaContext ? { anesthesiaContext: input.anesthesiaContext } : {}),
    ...(input.pages !== undefined ? { pages: input.pages } : {}),
    ...(input.reportKind !== undefined ? { reportKind: input.reportKind } : {}),
    ...(input.hasFeeAgreement !== undefined ? { hasFeeAgreement: input.hasFeeAgreement } : {}),
    ...(input.physicianContext ? { physicianContext: input.physicianContext } : {}),
    ...(input.therapyContext ? { therapyContext: input.therapyContext } : {}),
    ...(input.reportQualification ? { reportQualification: input.reportQualification } : {}),
    ...(input.catalogContext ? { catalogContext: input.catalogContext } : {}),
    ...(input.prolongedServiceContext ? { prolongedServiceContext: input.prolongedServiceContext } : {}),
  };
}

/** Preserve the meaning of every line pointer when the claim diagnosis list changes. */
export function remapBillSubmissionDiagnoses(bill: BrowserBillCreateInput, nextCodes: string[]): BrowserBillCreateInput {
  const diagnoses = [...new Set(nextCodes.map((code) => code.trim().toUpperCase()).filter(Boolean))].slice(0, 12);
  return { ...bill, diagnoses, serviceLines: bill.serviceLines.map((line) => ({
    ...line,
    ...(line.diagnosisPointers ? { diagnosisPointers: line.diagnosisPointers.flatMap((pointer) => {
      const code = bill.diagnoses?.[pointer - 1];
      const index = code ? diagnoses.indexOf(code.trim().toUpperCase()) : -1;
      return index < 0 ? [] : [index + 1];
    }) } : {}),
  })) };
}

/** Select a diagnosis for one service line without assigning it to other lines. */
export function setBillSubmissionLineDiagnosis(bill: BrowserBillCreateInput, lineIndex: number, slot: number, code: string): BrowserBillCreateInput {
  if (!bill.serviceLines[lineIndex] || slot < 0 || slot > 3) return bill;
  const diagnoses = [...(bill.diagnoses ?? [])];
  const normalized = code.trim().toUpperCase();
  if (normalized && !diagnoses.includes(normalized)) {
    if (diagnoses.length >= 12) return bill;
    diagnoses.push(normalized);
  }
  return { ...bill, diagnoses, serviceLines: bill.serviceLines.map((line, index) => {
    if (index !== lineIndex) return line;
    const pointers = [...(line.diagnosisPointers ?? [])];
    if (normalized) pointers[slot] = diagnoses.indexOf(normalized) + 1;
    else pointers.splice(slot, 1);
    return { ...line, diagnosisPointers: [...new Set(pointers.filter((pointer) => Number.isInteger(pointer) && pointer > 0))].slice(0, 4) };
  }) };
}

/** Resolve pointers before rebuilding the bill-wide diagnosis catalog. */
export function billSubmissionLineDiagnosisCodes(bill: BrowserBillCreateInput, index: number): string[] {
  return (bill.serviceLines[index]?.diagnosisPointers ?? []).flatMap((pointer) => bill.diagnoses?.[pointer - 1] ? [bill.diagnoses[pointer - 1]!.trim().toUpperCase()] : []);
}

/** New forms share diagnoses; saved independent assignments retain their meaning. */
export function billSubmissionUsesSharedDiagnoses(bill: BrowserBillCreateInput): boolean {
  const codes = (bill.diagnoses ?? []).map((code) => code.trim().toUpperCase());
  if (codes.length > 4) return false;
  return bill.serviceLines.filter((line) => line.code.trim() && line.diagnosisPointers !== undefined)
    .every((line) => JSON.stringify(line.diagnosisPointers?.map((pointer) => codes[pointer - 1])) === JSON.stringify(codes));
}

/** Rebuild pointers by code, rejecting selections outside claim and line limits. */
export function setBillSubmissionDiagnosisAssignments(bill: BrowserBillCreateInput, assignments: string[][]): BrowserBillCreateInput {
  const normalized = bill.serviceLines.map((_, index) => [...new Set((assignments[index] ?? []).map((code) => code.trim().toUpperCase()).filter(Boolean))]);
  const selected = [...new Set(normalized.flat())];
  if (selected.length > 12 || normalized.some((codes) => codes.length > 4)) return bill;
  const diagnoses = [...new Set([...(bill.diagnoses ?? []).map((code) => code.trim().toUpperCase()).filter((code) => selected.includes(code)), ...selected])];
  return { ...bill, diagnoses, serviceLines: bill.serviceLines.map((line, index) => ({ ...line, diagnosisPointers: normalized[index]!.map((code) => diagnoses.indexOf(code) + 1) })) };
}

export function setBillSubmissionSharedDiagnoses(bill: BrowserBillCreateInput, codes: string[]): BrowserBillCreateInput {
  return setBillSubmissionDiagnosisAssignments(bill, bill.serviceLines.map(() => codes));
}

export function setBillSubmissionLineDiagnoses(bill: BrowserBillCreateInput, index: number, codes: string[]): BrowserBillCreateInput {
  if (!bill.serviceLines[index]) return bill;
  return setBillSubmissionDiagnosisAssignments(bill, bill.serviceLines.map((_, lineIndex) => lineIndex === index ? codes : billSubmissionLineDiagnosisCodes(bill, lineIndex)));
}


/** Stable source identity: equivalent host renders preserve local edits. */
export function treatmentDraftKey(value: unknown): string {
  const stable = (entry: unknown): unknown => Array.isArray(entry) ? entry.map(stable) : entry && typeof entry === "object" ? Object.fromEntries(Object.entries(entry).filter(([,v]) => typeof v !== "function").sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,stable(v)])) : entry;
  return JSON.stringify(stable(value));
}
