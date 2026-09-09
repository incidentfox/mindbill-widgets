import type { RfaDraftInput, RfaEditDraftInput, RfaRecord, RfaDecisionInput, RfaTransmissionInput } from '@mindbill/browser';

export function canEditRfa(record: RfaRecord): boolean {
  return !record.signedAt && !record.submittedAt && !record.decidedAt && ['draft', 'ready'].includes(record.status);
}
/** Only editable draft properties cross the save boundary; item IDs preserve decisions' identity. */
export function rfaRecordDraft(record: RfaRecord): RfaDraftInput {
  const draft: RfaDraftInput = { claimId: record.claimId, patientId: record.patientId, renderingProviderId: record.renderingProviderId, employeeName: record.employeeName, providerName: record.providerName, items: record.items.map(item => {
    const result: RfaDraftInput['items'][number] = { id: item.id, diagnosisCode: item.diagnosisCode, serviceDescription: item.serviceDescription };
    for (const key of ['externalId','procedureCode','quantity','units','frequency','duration','requestedFrom','requestedTo','metadata'] as const) if (item[key] != null) Object.assign(result, { [key]: item[key] });
    return result;
  }) };
  for (const key of ['externalId','claimsAdminId','requestType','reviewType','expedited','placeOfServiceCode','providerNpi','providerPhone','providerFax','claimNumber','dateOfInjury','rationale','materialChange','metadata'] as const) if (record[key] != null) Object.assign(draft, { [key]: record[key] });
  return draft;
}
export function rfaEditInput(draft: RfaDraftInput, expectedRevision: number): RfaEditDraftInput {
  const { claimId: _claim, patientId: _patient, renderingProviderId: _provider, externalId: _external, ...editable } = draft;
  void _claim; void _patient; void _provider; void _external;
  return { ...editable, expectedRevision, items: editable.items.map(({ externalId, ...item }) => { void externalId; return item; }) };
}
export function validateRfaTransmission(input: RfaTransmissionInput): string | null {
  if (!input.occurredAt || !Number.isFinite(Date.parse(input.occurredAt))) return 'Enter the actual event date and time.';
  if (!input.proofDocumentId && !input.providerMessageId?.trim()) return 'Attach transmission evidence or enter the external delivery reference.';
  if (input.direction === 'inbound' && input.status !== 'received') return 'An inbound receipt must have received status.';
  if (input.direction === 'outbound' && input.status === 'received') return 'Use inbound for a receipt.';
  if (input.direction === 'outbound' && !input.destination?.trim()) return 'Confirm the authorization destination first.';
  if (input.status === 'received' && (!input.receivedAt || !Number.isFinite(Date.parse(input.receivedAt)))) return 'Enter the actual receipt time.';
  return null;
}
export function validateRfaDecision(input: RfaDecisionInput): string | null {
  if (!input.decidedAt || !Number.isFinite(Date.parse(input.decidedAt))) return 'Enter the decision date and time from the response.';
  if (!input.responseDocumentId || !input.decisions.length) return 'Select the UR response and at least one item decision.';
  for (const item of input.decisions) {
    if ((item.outcome === 'approved' || item.outcome === 'modified') && !item.authorizationNumber?.trim()) return 'Enter the authorization number for each approved or modified item.';
    if (item.outcome !== 'approved' && (!input.imrDocumentId || !item.decisionReason?.trim() || !item.reviewerName?.trim() || !item.reviewerPhone?.trim())) return 'Modified and denied items require the IMR document, decision reason, reviewer name, and reviewer phone.';
  }
  return null;
}
