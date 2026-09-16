import type { ReportAutofillResult } from "@mindbill/browser";
import type { BillSubmissionInput } from "./bill-submission-form";
import type { BillSubmissionProfileOptions } from "./billing-profile-options";

const empty = (value: unknown): boolean => value == null || value === "" || (typeof value === "string" && !value.trim()) || (typeof value === "object" && Object.values(value).every(empty));
const date = (value: string): string => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : "";
/** Apply reviewed suggestions only to empty fields; never infer procedures, charges, or diagnosis pointers. */
export function applyReportAutofill(bill: BillSubmissionInput, result: ReportAutofillResult, profiles?: BillSubmissionProfileOptions): BillSubmissionInput {
  const next = structuredClone(bill);
  const fields = new Map(result.fields.map(field => [field.key, field.value.trim()]));
  const fill = <T extends object>(object: T, key: keyof T, field: string, isDate = false) => {
    const value = fields.get(field) ?? "";
    if (empty(object[key]) && value) Object.assign(object, { [key]: isDate ? date(value) : value });
  };
  // A selected identity is accepted only from an unambiguous server match and an empty identity group.
  const matched = (kind: keyof ReportAutofillResult["matches"]) => {
    const match = result.matches[kind];
    return match.status === "matched" && match.candidates.length === 1 && match.selectedId === match.candidates[0]?.id ? match.selectedId : undefined;
  };
  if (empty(bill.patient) && matched("patient")) next.patient.id = matched("patient")!;
  for (const [kind, collection] of [["billingProvider", "billingProviders"], ["renderingProvider", "renderingProviders"], ["serviceLocation", "serviceLocations"]] as const) {
    const id = matched(kind);
    const option = id && profiles?.[collection]?.find(item => item.id === id);
    if (empty(bill[kind]) && option) Object.assign(next, { [kind]: structuredClone(option.value) });
  }
  fill(next.patient, "firstName", "patientFirstName"); fill(next.patient, "lastName", "patientLastName"); fill(next.patient, "dateOfBirth", "dob", true);
  fill(next.patient.address, "line1", "addressLine"); fill(next.patient.address, "city", "city"); fill(next.patient.address, "state", "state"); fill(next.patient.address, "postalCode", "zip");
  fill(next.claim, "claimNumber", "claimNumber"); fill(next.claim, "dateOfInjury", "doi", true); fill(next.claim, "adjNumber", "adjNumber"); fill(next.claim, "employer", "employer"); fill(next.claim, "description", "bodyParts"); fill(next.service, "date", "dos", true);
  if (!next.claim.claimsAdministrator?.id && fields.get("claimsAdminName")) {
    next.claim.claimsAdministrator ??= { name: "" }; fill(next.claim.claimsAdministrator, "name", "claimsAdminName");
  }
  // Do not mix extracted identity fields into a provider already selected or partially entered.
  if (empty(bill.billingProvider) && empty(next.billingProvider)) { next.billingProvider = {}; fill(next.billingProvider, "name", "billingProvider"); fill(next.billingProvider, "npi", "billingProviderNpi"); }
  if (empty(bill.renderingProvider) && empty(next.renderingProvider)) { next.renderingProvider = {}; fill(next.renderingProvider, "name", "renderingProvider"); fill(next.renderingProvider, "npi", "renderingProviderNpi"); }
  if (empty(bill.serviceLocation) && empty(next.serviceLocation)) { next.serviceLocation = {}; fill(next.serviceLocation, "name", "evaluationLocation"); }
  if (empty(bill.diagnoses) && fields.get("dxCode")) next.diagnoses = [...new Set(fields.get("dxCode")!.split(",").map(code => code.trim().toUpperCase()).filter(Boolean))].slice(0, 12);
  return next;
}
