import type { RfaRecord, RfaUpdateDraftInput } from "@mindbill/browser";
import type { RfaDraftInput } from "./rfa-draft-form";

/** True when every attempt to send the request failed and no receipt was ever recorded. */
export function rfaCanResend(rfa: Pick<RfaRecord, "status" | "receivedAt" | "transmissions">): boolean {
  const attempts = rfa.transmissions.filter(sent => sent.direction === "outbound" && (sent.purpose ?? "submission") === "submission");
  return rfa.status === "submitted" && !rfa.receivedAt && attempts.length > 0 && attempts.every(sent => sent.status === "failed");
}
/** The server repeats these checks under a lock; client gating is only a convenience.
 * A request whose every send failed can be corrected too: saving reopens it as a draft for a new signature. */
export function canEditRfaDraft(rfa: RfaRecord): boolean {
  if (rfaCanResend(rfa)) return true;
  return !rfa.submittedAt && !rfa.receivedAt && ["draft", "ready"].includes(rfa.status)
    && !rfa.transmissions.some(item => item.purpose === "submission" && (item.status === "queued" || item.status === "received" || (item.direction === "outbound" && ["sent", "delivered"].includes(item.status))));
}
export function rfaRecordToDraft(rfa: RfaRecord): RfaDraftInput {
  const optional = Object.fromEntries(Object.entries({
    claimsAdminId: rfa.claimsAdminId, requestType: rfa.requestType, writtenConfirmation: rfa.writtenConfirmation,
    requestingPractice: rfa.requestingPractice, authorizationContact: rfa.authorizationContact,
    placeOfServiceCode: rfa.placeOfServiceCode, providerNpi: rfa.providerNpi,
    providerPhone: rfa.providerPhone, providerFax: rfa.providerFax,
    claimNumber: rfa.claimNumber, dateOfInjury: rfa.dateOfInjury,
    rationale: rfa.rationale, materialChange: rfa.materialChange, metadata: rfa.metadata,
  }).filter(([, value]) => value !== null && value !== undefined));
  return {
    ...optional, claimId: rfa.claimId, patientId: rfa.patientId, renderingProviderId: rfa.renderingProviderId,
    employeeName: rfa.employeeName, providerName: rfa.providerName,
    reviewType: rfa.reviewType as RfaDraftInput["reviewType"] & string, expedited: rfa.expedited,
    items: rfa.items.map(item => ({
      ...Object.fromEntries(Object.entries({ diagnosisDescription: item.diagnosisDescription, procedureCode: item.procedureCode, quantity: item.quantity,
        units: item.units, frequency: item.frequency, duration: item.duration, requestedFrom: item.requestedFrom,
        requestedTo: item.requestedTo, metadata: item.metadata }).filter(([, value]) => value !== null && value !== undefined)),
      id: item.id, diagnosisCode: item.diagnosisCode, serviceDescription: item.serviceDescription,
    })),
  };
}
export function rfaDraftReplacement(draft: RfaDraftInput, expectedRevision: number): RfaUpdateDraftInput {
  const editable = { ...draft } as Partial<RfaDraftInput>;
  for (const key of ["claimId", "patientId", "renderingProviderId", "externalId"] as const) delete editable[key];
  return { ...editable, employeeName: draft.employeeName, providerName: draft.providerName, expectedRevision, items: draft.items.map(item => { const copy = { ...item }; delete copy.externalId; return copy; }) };
}
