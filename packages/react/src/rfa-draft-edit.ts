import type { RfaRecord, RfaUpdateDraftInput } from "@mindbill/browser";
import type { RfaDraftInput } from "./rfa-draft-form";

/** The server repeats these checks under a lock; client gating is only a convenience. */
export function canEditRfaDraft(rfa: RfaRecord): boolean {
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
