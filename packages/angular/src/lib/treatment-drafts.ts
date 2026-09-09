/** Framework-independent unsigned treatment draft contracts and validation. */
export function isDraftDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

/** Existing source records supplied by the host; saving does not sign or verify them. */
export type DentalAttestationsInput = {
  providerSignatureOnFile: boolean;
  providerAcceptAssignment: "A" | "B" | "C";
  benefitsAssignment: "Y" | "N" | "W";
  releaseOfInformation: "I" | "Y";
  evidenceReference: string;
};
export type DentalConsentInput = {
  mode: "signature_on_file";
  signerName: string;
  signedDate: string;
  evidenceReference: string;
};
export type DentalAdaFormInput = {
  patientConsent?: DentalConsentInput;
  directPaymentAuthorization?: DentalConsentInput;
  providerCertification?: { printedName: string; signedDate: string; evidenceReference: string };
  treatingLicenseNumber?: string;
  treatmentLocation?: { line1: string; city: string; state: string; postalCode: string };
  treatingPhone?: string;
};
export type DentalOrthodonticsInput = {
  appliancePlacementDate: string;
  totalMonths: number;
  remainingMonths: number;
};
export type DentalProsthesisInput =
  | { placement: "I" }
  | { placement: "R"; priorPlacementDate: string };

export type DentalDraftLineInput = {
  code: string | null; description: string | null; editionYear: number | null; serviceDate: string | null;
  quantity: number; /** Extended charge, already includes quantity. Null means unknown. */
  chargeCents: number | null; chargeReference: string | null; teeth: string[]; surfaces: string[];
  oralCavity: string | null; prosthesisNotes: string | null;
  prosthesis?: DentalProsthesisInput;
  /** One-based references to claim diagnosis codes; validated by the host API. */
  diagnosisPointers?: number[];
};
export type DentalDraftContentInput = {
  renderingProviderId: string; billingProviderId?: string | null; diagnosisCodes: string[];
  notes: string | null; lines: DentalDraftLineInput[];
  /** Host-managed clinical details are preserved when saving the full content. */
  attestations?: DentalAttestationsInput;
  adaForm?: DentalAdaFormInput;
  authorizationNumber?: string;
  orthodontics?: DentalOrthodonticsInput;
  missingTeeth?: string[];
};
export function dentalDraftChargeSummary(lines: readonly Pick<DentalDraftLineInput, "chargeCents">[]) {
  const knownChargeCents = lines.reduce((sum, line) => sum + (line.chargeCents ?? 0), 0);
  return { knownChargeCents, totalChargeCents: lines.some((line) => line.chargeCents === null) ? null : knownChargeCents };
}
/** Convert decimal dollars exactly; reject excess precision, zero, and exponential notation. */
export function parseDentalCharge(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("Enter a positive charge with at most two decimal places, or leave it blank.");
  const [whole = "0", fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 1_000_000_000) throw new Error("Enter a charge between $0.01 and $10,000,000, or leave it blank.");
  return cents;
}
export function validateDentalDraftContent(content: DentalDraftContentInput): string | null {
  if (!content.renderingProviderId.trim() || content.renderingProviderId.length > 255) return "Choose a rendering provider in the host application.";
  if (content.billingProviderId != null && (!content.billingProviderId.trim() || content.billingProviderId.length > 255)) return "Choose a valid billing provider in the host application.";
  if (content.lines.length > 100) return "A draft can contain up to 100 service lines.";
  if (content.diagnosisCodes.length > 12 || content.diagnosisCodes.some((code) => !code.trim() || code.length > 20)) return "Enter up to 12 diagnosis codes of at most 20 characters each.";
  if (content.notes !== null && (!content.notes.trim() || content.notes.length > 5000)) return "Notes must contain between 1 and 5,000 characters.";
  for (const [index, line] of content.lines.entries()) {
    const prefix = `Line ${index + 1}: `;
    if (line.code !== null && !/^D[0-9]{4}$/.test(line.code)) return prefix + "enter D followed by four digits, or leave the code blank.";
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 100000) return prefix + "enter a whole quantity between 1 and 100,000.";
    if (line.chargeCents !== null && (!Number.isSafeInteger(line.chargeCents) || line.chargeCents < 1 || line.chargeCents > 1_000_000_000)) return prefix + "enter a positive extended charge, or leave it unknown.";
    if (line.serviceDate !== null && !isDraftDate(line.serviceDate)) return prefix + "enter a valid service date.";
    if (line.editionYear !== null && (!Number.isInteger(line.editionYear) || line.editionYear < 1900 || line.editionYear > 2200)) return prefix + "enter an edition year between 1900 and 2200.";
    for (const [value, limit] of [[line.description, 1000], [line.chargeReference, 1000], [line.oralCavity, 100], [line.prosthesisNotes, 2000]] as const) {
      if (value !== null && (!value.trim() || value.length > limit)) return prefix + `text must contain between 1 and ${limit} characters.`;
    }
    if (line.teeth.length > 32 || line.surfaces.length > 10 || [...line.teeth, ...line.surfaces].some((value) => !value.trim() || value.length > 20)) return prefix + "check tooth and surface entries (up to 32 teeth and 10 surfaces, 20 characters each).";
  }
  return null;
}
import type { RfaDraftInput } from "@mindbill/browser";
export type { RfaDraftInput, RfaDraftItemInput } from "@mindbill/browser";
/** Remove blank optional item fields, retaining an explicitly cleared return fax. */
export function normalizeRfaDraft(draft: RfaDraftInput): RfaDraftInput {
  const copy = structuredClone(draft);
  for (const item of copy.items) {
    for (const key of ["externalId", "procedureCode", "frequency", "duration", "requestedFrom", "requestedTo"] as const) {
      if (item[key] !== undefined && !item[key]?.trim()) delete item[key];
    }
  }
  // Runtime callers may pass extra properties despite the unsigned TypeScript contract.
  delete (copy as RfaDraftInput & { signedAt?: unknown }).signedAt;
  return copy;
}
export function validateRfaDraft(draft: RfaDraftInput): string | null {
  for (const value of [draft.claimId, draft.patientId, draft.renderingProviderId]) if (!value.trim() || value.length > 255) return "Select a claim, patient, and rendering provider in the host application.";
  for (const value of [draft.externalId, draft.claimsAdminId]) if (value !== undefined && (!value.trim() || value.length > 255)) return "Check the request and claims administrator identifiers.";
  for (const value of [draft.employeeName, draft.providerName]) if (!value.trim() || value.length > 200) return "Employee and provider names are required (up to 200 characters).";
  if (draft.requestType !== undefined && !["new", "resubmission_material_change", "oral_authorization_confirmation"].includes(draft.requestType)) return "Choose a valid request type.";
  if (draft.reviewType !== undefined && !["prospective", "concurrent", "retrospective"].includes(draft.reviewType)) return "Choose a valid review type.";
  if (draft.requestType === "resubmission_material_change" && !draft.materialChange?.trim()) return "Describe the material change for this resubmission.";
  if ((draft.rationale?.length ?? 0) > 20000 || (draft.materialChange?.length ?? 0) > 20000) return "Rationale and material change must each be at most 20,000 characters.";
  if (draft.placeOfServiceCode !== undefined && !/^\d{2}$/.test(draft.placeOfServiceCode)) return "Place of service must contain two digits.";
  if ((draft.providerNpi?.length ?? 0) > 20 || (draft.providerPhone?.length ?? 0) > 30 || (draft.claimNumber?.length ?? 0) > 100) return "Check provider contact and claim number lengths.";
  if (draft.providerFax && (draft.providerFax.length > 30 || !/^[+\d().\s-]+$/.test(draft.providerFax) || !/^\d{10,15}$/.test(draft.providerFax.replace(/\D/g, "")))) return "Enter a return fax with 10 to 15 digits, or leave it blank.";
  if (draft.dateOfInjury !== undefined && !isDraftDate(draft.dateOfInjury)) return "Check the injury date in the host application.";
  if (draft.items.length < 1 || draft.items.length > 100) return "Include between 1 and 100 requested services.";
  for (const [index, item] of draft.items.entries()) {
    const prefix = `Service ${index + 1}: `;
    if (!item.diagnosisCode.trim() || item.diagnosisCode.length > 16 || !item.serviceDescription.trim() || item.serviceDescription.length > 1000) return prefix + "a diagnosis code and service description are required.";
    for (const [value, max] of [[item.externalId, 255], [item.procedureCode, 16], [item.frequency, 200], [item.duration, 200]] as const) if (value !== undefined && (!value.trim() || value.length > max)) return prefix + `optional text must contain 1 to ${max} characters.`;
    if (item.units !== undefined && (!Number.isInteger(item.units) || item.units < 1 || item.units > 100000)) return prefix + "units must be a whole number between 1 and 100,000.";
    if (item.quantity !== undefined && (!Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 100000)) return prefix + "quantity must be positive and at most 100,000.";
    if ((item.requestedFrom !== undefined && !isDraftDate(item.requestedFrom)) || (item.requestedTo !== undefined && (!isDraftDate(item.requestedTo) || !item.requestedFrom || item.requestedTo < item.requestedFrom))) return prefix + "enter valid dates with the end on or after the start.";
  }
  return null;
}
