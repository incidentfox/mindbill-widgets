import type { RfaRecord } from "@mindbill/browser";
import { normalizeRfaDraft, validateRfaDraft } from "./rfa-draft-form";
import { canEditRfaDraft, rfaRecordToDraft } from "./rfa-draft-edit";

/** Only content a person can fix here; signing and destination selection happen during Send. */
export function rfaSendFix(rfa: RfaRecord, documentIds: string[], descriptions: Record<string, string>): { label: string; message: string } | null {
  if (!rfa.documents.some(document => ["clinical_report", "supporting_record"].includes(document.documentType) && documentIds.includes(document.id))) return {
    label: "Add documents", message: "Add the report that supports this request (PR-2, Doctor's First Report or narrative) before sending.",
  };
  const invalid = canEditRfaDraft(rfa) ? validateRfaDraft(normalizeRfaDraft(rfaRecordToDraft(rfa))) : null;
  if (invalid) return { label: "Edit request", message: invalid };
  const missingDiagnosis = rfa.items.find(item => !(descriptions[item.id] ?? item.diagnosisDescription ?? "").trim());
  if (missingDiagnosis) return { label: "Edit request", message: `Add the diagnosis for ${missingDiagnosis.diagnosisCode} before sending.` };
  return null;
}
