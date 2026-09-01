"use client";

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  createBillReferenceClient,
  createBillSubmissionClient,
  type BrowserBillSubmissionDocument,
  type BrowserBillSubmissionResult,
  type BillLifecycleSessionProvider,
  type BillReviewPayer,
} from "@mindbill/browser";

import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";
import {
  BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS,
  calculateBillSubmissionAllowedAmount,
  DEFAULT_BILL_SUBMISSION_MODIFIERS,
  DEFAULT_BILL_SUBMISSION_PROCEDURES,
} from "./billing-catalog";

export const BILL_SUBMISSION_DOCUMENT_TYPES = [
  "final_report", "proof_of_service", "letter_of_attestation", "form_122",
  "return_to_work_voucher", "w9", "medical_records", "appeal", "other",
] as const;

export type BillSubmissionDocumentType = (typeof BILL_SUBMISSION_DOCUMENT_TYPES)[number];
export type BillSubmissionEvaluationType = "qme" | "ame" | "psych_qme";
export type BillSubmissionAddress = { line1: string; city: string; state: string; postalCode: string };
export type BillSubmissionDiagnosisOption = { code: string; description: string };
export type BillSubmissionProcedureOption = { code: string; description: string; allowedAmount?: number };
export type BillSubmissionModifierOption = { code: string; description: string };
export type BillSubmissionPostalPlace = { city: string; state: string };

export type BillSubmissionInput = {
  externalId?: string;
  billingMode?: "med_legal" | "professional";
  patient: {
    id?: string; externalId?: string; firstName: string; middleName?: string; lastName: string;
    dateOfBirth: string; ssn?: string; gender?: "M" | "F" | "X"; phone?: string;
    address: BillSubmissionAddress;
  };
  claim: {
    id?: string; externalId?: string; claimNumber: string; adjNumber?: string; employer?: string;
    dateOfInjury?: string; injuryState?: string; description?: string;
    claimsAdministrator?: { id?: string; name: string };
  };
  service: { date: string; endDate?: string | null; authorizationNumber?: string | null };
  billingProvider?: {
    name?: string; taxId?: string; npi?: string; phone?: string; address?: BillSubmissionAddress;
  };
  renderingProvider?: {
    name?: string; specialty?: string; npi?: string; taxonomy?: string; licenseNumber?: string;
    licenseState?: string; isQme?: boolean; isAme?: boolean;
  };
  serviceLocation?: { name?: string; address?: BillSubmissionAddress; placeOfServiceCode?: string };
  diagnoses?: string[];
  serviceLines: Array<{
    code: string; modifiers?: string[]; units?: number; serviceDate?: string;
    serviceDateEnd?: string | null; charge?: number; diagnosisPointers?: number[];
  }>;
};

export type BillSubmissionSourceAttachment = {
  id: string;
  fileName: string;
  documentType: BillSubmissionDocumentType;
  description?: string;
  /** @deprecated Source attachments shown in the form are included until removed. */
  selected?: boolean;
  /** Auto-attached documents such as a practice W-9 cannot be deselected. */
  autoAttached?: boolean;
  removable?: boolean;
  previewUrl?: string;
};
export type BillSubmissionUpload = { file: File; documentType: BillSubmissionDocumentType; description?: string };
export type BillSubmissionFormValue = { bill: BillSubmissionInput; sourceAttachmentIds: string[]; uploads: BillSubmissionUpload[] };

export type BillSubmissionFormProps = {
  initialBill: BillSubmissionInput;
  attachments?: BillSubmissionSourceAttachment[];
  /**
   * Legacy custom submission escape hatch. Connected forms should omit this so
   * the component owns PDF encoding and the Partner API wire contract.
   */
  onSubmit?: (value: BillSubmissionFormValue) => void | Promise<void>;
  /** Called after the connected component atomically creates and submits the bill. */
  onSubmitted?: (result: BrowserBillSubmissionResult) => void | Promise<void>;
  /** Short-lived partner browser session. Enables reference data and direct submission. */
  getSession?: BillLifecycleSessionProvider;
  sessionEndpoint?: string;
  apiBaseUrl?: string;
  fetch?: typeof globalThis.fetch;
  onSearchClaimsAdministrators?: (query: string, claimNumber?: string) => Promise<BillReviewPayer[]>;
  diagnosisOptions?: BillSubmissionDiagnosisOption[];
  onSearchDiagnoses?: (query: string, limit?: number, offset?: number) => Promise<BillSubmissionDiagnosisOption[]>;
  onLookupPostalCode?: (postalCode: string) => Promise<BillSubmissionPostalPlace | null>;
  procedureOptions?: BillSubmissionProcedureOption[];
  modifierOptions?: BillSubmissionModifierOption[];
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  submitLabel?: string;
  heading?: ReactNode;
  description?: ReactNode;
  /**
   * Optional composable layout. Use the exported section components as children;
   * the parent form continues to own validation, directory lookups, uploads, and submission.
   */
  children?: ReactNode;
};

export const BILL_SUBMISSION_REQUIRED_FIELDS = [
  "patient.firstName", "patient.lastName", "patient.dateOfBirth", "patient.address.line1",
  "patient.address.city", "patient.address.state", "patient.address.postalCode",
  "claim.claimNumber", "claim.claimsAdministrator", "service.date",
  "diagnoses[]",
  "serviceLines[].code", "serviceLines[].units",
] as const;

export type BillSubmissionValidation = { valid: boolean; fieldErrors: Record<string, string> };

const documentLabels: Record<BillSubmissionDocumentType, string> = {
  final_report: "Final report", proof_of_service: "Proof of service",
  letter_of_attestation: "Letter of attestation", form_122: "Form 122",
  return_to_work_voucher: "Return-to-work voucher", w9: "W-9",
  medical_records: "Medical records", appeal: "Appeal", other: "Other",
};
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_DOCUMENTS = 25;
const DIAGNOSIS_PAGE_SIZE = 100;
const EMPTY_ATTACHMENTS: BillSubmissionSourceAttachment[] = [];

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return globalThis.btoa(binary);
}

async function pdfDocument(
  blob: Blob,
  input: Omit<BrowserBillSubmissionDocument, "contentBase64">,
): Promise<BrowserBillSubmissionDocument> {
  if (blob.size > MAX_PDF_BYTES) throw new Error(`${input.filename} is larger than 25 MB.`);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (
    bytes.length < 5
    || bytes[0] !== 0x25
    || bytes[1] !== 0x50
    || bytes[2] !== 0x44
    || bytes[3] !== 0x46
    || bytes[4] !== 0x2d
  ) {
    throw new Error(`${input.filename} is not a valid PDF.`);
  }
  return { ...input, contentBase64: bytesToBase64(bytes) };
}

export async function prepareBillSubmissionDocuments({
  attachments,
  selectedIds,
  uploads,
  fetch: fetchOverride,
}: {
  attachments: BillSubmissionSourceAttachment[];
  selectedIds: string[];
  uploads: BillSubmissionUpload[];
  fetch?: typeof globalThis.fetch;
}): Promise<BrowserBillSubmissionDocument[]> {
  const fetcher = fetchOverride ?? globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("A Fetch API implementation is required.");
  const selected = selectedIds.map((id) => attachments.find((item) => item.id === id)).filter((item): item is BillSubmissionSourceAttachment => Boolean(item));
  const sourceDocuments = await Promise.all(selected.map(async (attachment) => {
    if (!attachment.previewUrl) throw new Error(`${attachment.fileName} cannot be submitted because its document URL is missing.`);
    const response = await fetcher(attachment.previewUrl, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`${attachment.fileName} could not be loaded for submission.`);
    return pdfDocument(await response.blob(), {
      externalId: attachment.id,
      filename: attachment.fileName,
      documentType: attachment.documentType,
      ...(attachment.description ? { description: attachment.description } : {}),
    });
  }));
  const uploadedDocuments = await Promise.all(uploads.map(({ file, documentType, description }) => pdfDocument(file, {
    filename: file.name,
    documentType,
    ...(description ? { description } : {}),
  })));
  return [...sourceDocuments, ...uploadedDocuments];
}

function previewUploadedPdf(file: File): void {
  const url = URL.createObjectURL(file);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function blankLine(): BillSubmissionInput["serviceLines"][number] {
  return { code: "", modifiers: [], units: 1 };
}
function lineHasContent(line: BillSubmissionInput["serviceLines"][number]): boolean {
  return Boolean(line.code.trim() || line.modifiers?.length || line.charge != null);
}
export function ensureTrailingBillSubmissionLine(
  lines: BillSubmissionInput["serviceLines"],
): BillSubmissionInput["serviceLines"] {
  const normalized: BillSubmissionInput["serviceLines"] = lines.length ? lines.map((line) => ({ ...line, modifiers: [...(line.modifiers ?? [])], units: line.units ?? 1 })) : [];
  while (normalized.length > 1 && !lineHasContent(normalized.at(-1)!) && !lineHasContent(normalized.at(-2)!)) normalized.pop();
  if (!normalized.length || lineHasContent(normalized.at(-1)!)) normalized.push(blankLine());
  return normalized;
}

export function parseBillSubmissionDate(value: string): string | undefined {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  const digits = /^(\d{2})(\d{2})(\d{4})$/.exec(trimmed.replace(/\D/g, ""));
  const match = iso ? [iso[2], iso[3], iso[1]] : us ? [us[1], us[2], us[3]] : digits ? [digits[1], digits[2], digits[3]] : null;
  if (!match) return undefined;
  const month = Number(match[0]); const day = Number(match[1]); const year = Number(match[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function formatBillSubmissionDate(value: string | null | undefined): string {
  const parsed = value ? parseBillSubmissionDate(value) : undefined;
  if (!parsed) return "";
  const [year, month, day] = parsed.split("-");
  return `${month}/${day}/${year}`;
}

function evaluationModifier(type: BillSubmissionEvaluationType, code: string): string | undefined {
  if (!/^ML(?:200|201|202|203|PRR)$/.test(code.toUpperCase())) return undefined;
  if (type === "ame") return code.toUpperCase() === "ML200" || code.toUpperCase() === "MLPRR" ? undefined : "94";
  if (type === "psych_qme") return code.toUpperCase() === "ML200" ? "95" : code.toUpperCase() === "MLPRR" ? undefined : "96";
  return "95";
}
export function applyBillSubmissionEvaluationModifiers(
  lines: BillSubmissionInput["serviceLines"], type: BillSubmissionEvaluationType,
): BillSubmissionInput["serviceLines"] {
  return lines.map((line) => {
    const auto = evaluationModifier(type, line.code);
    const modifiers = (line.modifiers ?? []).filter((item) => !["94", "95", "96"].includes(item.replace(/^-/, "")));
    return { ...line, modifiers: auto ? [auto, ...modifiers] : modifiers };
  });
}

function submittedLines(lines: BillSubmissionInput["serviceLines"]): BillSubmissionInput["serviceLines"] {
  return lines.filter(lineHasContent).map((line) => ({ ...line, code: line.code.trim(), modifiers: [...(line.modifiers ?? [])] }));
}
function cloneBill(bill: BillSubmissionInput): BillSubmissionInput {
  return {
    ...bill,
    patient: { ...bill.patient, address: { ...bill.patient.address } },
    claim: { ...bill.claim, ...(bill.claim.claimsAdministrator ? { claimsAdministrator: { ...bill.claim.claimsAdministrator } } : {}) },
    service: { ...bill.service },
    ...(bill.billingProvider ? { billingProvider: { ...bill.billingProvider, ...(bill.billingProvider.address ? { address: { ...bill.billingProvider.address } } : {}) } } : {}),
    ...(bill.renderingProvider ? { renderingProvider: { ...bill.renderingProvider } } : {}),
    ...(bill.serviceLocation ? { serviceLocation: { ...bill.serviceLocation, ...(bill.serviceLocation.address ? { address: { ...bill.serviceLocation.address } } : {}) } } : {}),
    diagnoses: [...(bill.diagnoses ?? [])],
    serviceLines: ensureTrailingBillSubmissionLine(bill.serviceLines),
  };
}
export function validateBillSubmission(bill: BillSubmissionInput): BillSubmissionValidation {
  const errors: Record<string, string> = {};
  const required = (path: string, value: unknown, message: string) => { if (typeof value !== "string" || !value.trim()) errors[path] = message; };
  required("patient.firstName", bill.patient.firstName, "Enter the patient's first name.");
  required("patient.lastName", bill.patient.lastName, "Enter the patient's last name.");
  required("patient.dateOfBirth", bill.patient.dateOfBirth, "Enter the patient's date of birth.");
  required("patient.address.line1", bill.patient.address.line1, "Enter the patient's street address.");
  required("patient.address.city", bill.patient.address.city, "Enter the patient's city.");
  required("patient.address.state", bill.patient.address.state, "Enter the patient's 2-letter state code.");
  required("patient.address.postalCode", bill.patient.address.postalCode, "Enter the patient's ZIP code.");
  required("claim.claimNumber", bill.claim.claimNumber, "Enter the claim number.");
  required("claim.claimsAdministrator", bill.claim.claimsAdministrator?.name, "Select a claims administrator so MindBill can route this bill.");
  required("service.date", bill.service.date, "Enter the date of service.");
  if (!(bill.diagnoses ?? []).some((code) => code.trim())) {
    errors.diagnoses = "Select at least one ICD-10 diagnosis code.";
  }
  if (bill.claim.claimsAdministrator?.name && !bill.claim.claimsAdministrator.id) {
    errors["claim.claimsAdministrator"] = "Select a claims administrator from the payer directory.";
  }
  if (bill.patient.dateOfBirth && !parseBillSubmissionDate(bill.patient.dateOfBirth)) errors["patient.dateOfBirth"] = "Use MM/DD/YYYY";
  if (bill.patient.address.state.trim().length !== 2) errors["patient.address.state"] = "Use a 2-letter state code";
  const lines = submittedLines(bill.serviceLines);
  if (!lines.length) errors.serviceLines = "Add at least one service line";
  lines.forEach((line, index) => {
    required(`serviceLines.${index}.code`, line.code, "Select a procedure code.");
    if (!Number.isInteger(line.units) || (line.units ?? 0) < 1) errors[`serviceLines.${index}.units`] = "Enter at least 1 unit";
    if (bill.billingMode === "professional" && (!Number.isFinite(line.charge) || (line.charge ?? 0) < 0)) errors[`serviceLines.${index}.charge`] = "Enter the billed charge";
  });
  return { valid: Object.keys(errors).length === 0, fieldErrors: errors };
}

const css = `
.mbsf{display:grid;gap:20px;color:var(--mb-text);font-family:var(--mb-font);font-size:15px}.mbsf *{box-sizing:border-box}
.mbsf-head,.mbsf-section-head,.mbsf-attach-row,.mbsf-actions{display:flex;align-items:center;justify-content:space-between;gap:16px}.mbsf-title{margin:0;font-size:24px}.mbsf-copy,.mbsf-help{color:var(--mb-muted);margin:5px 0 0}.mbsf-required{font-size:13px;color:var(--mb-muted);white-space:nowrap}.mbsf-star,.mbsf-error{color:var(--mb-danger)}
.mbsf-card{min-width:0;margin:0;padding:24px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);box-shadow:var(--mb-shadow)}.mbsf-legend{padding:0 10px;font-size:18px;font-weight:760}.mbsf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 24px}.mbsf-span{grid-column:1/-1}.mbsf-field{display:grid;align-content:start;gap:7px;min-width:0}.mbsf-label{font-weight:680}.mbsf-input,.mbsf-select{width:100%;min-height:46px;padding:10px 12px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-input);color:var(--mb-text);font:inherit}.mbsf-input:focus,.mbsf-select:focus{outline:3px solid color-mix(in srgb,var(--mb-accent) 22%,transparent);border-color:var(--mb-accent)}.mbsf-field[data-invalid=true] .mbsf-input,.mbsf-field[data-invalid=true] .mbsf-select,.mbsf-invalid-control .mbsf-input{border-color:var(--mb-danger);background:color-mix(in srgb,var(--mb-danger) 4%,var(--mb-input))}.mbsf-field[data-invalid=true] .mbsf-input:focus,.mbsf-field[data-invalid=true] .mbsf-select:focus{outline-color:color-mix(in srgb,var(--mb-danger) 24%,transparent)}
.mbsf-combo{position:relative}.mbsf-menu{position:absolute;z-index:20;top:calc(100% + 5px);left:0;right:0;max-height:min(360px,46vh);overflow:auto;overscroll-behavior:contain;padding:7px;border:1px solid var(--mb-border);border-radius:12px;background:var(--mb-surface);box-shadow:0 14px 35px rgba(17,38,49,.16)}.mbsf-option{display:grid;width:100%;gap:2px;padding:10px;border:0;border-radius:8px;background:transparent;color:var(--mb-text);font:inherit;text-align:left;cursor:pointer}.mbsf-option:hover,.mbsf-option:focus{background:color-mix(in srgb,var(--mb-accent) 9%,var(--mb-surface))}.mbsf-option small{color:var(--mb-muted)}.mbsf-menu-status{padding:12px;text-align:center;color:var(--mb-muted);font-size:13px}
.mbsf-chips,.mbsf-quick-picks{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:8px}.mbsf-chip,.mbsf-quick-pick{display:inline-flex;align-items:center;gap:7px;padding:5px 9px;border:1px solid var(--mb-border);border-radius:999px;background:var(--mb-input)}.mbsf-chip button{border:0;background:transparent;color:var(--mb-muted);cursor:pointer;font:inherit}.mbsf-quick-pick{color:var(--mb-text);font:inherit;cursor:pointer}.mbsf-quick-pick[data-selected=true]{border-color:var(--mb-accent);color:var(--mb-accent)}
.mbsf-segments{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);overflow:hidden}.mbsf-segment{min-height:44px;border:0;border-right:1px solid var(--mb-border);background:var(--mb-input);color:var(--mb-text);font:inherit;font-weight:700;cursor:pointer}.mbsf-segment:last-child{border-right:0}.mbsf-segment[aria-pressed=true]{background:var(--mb-accent);color:var(--mb-accent-contrast)}
.mbsf-lines{margin-top:18px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);overflow:visible}.mbsf-lines[data-invalid=true]{border-color:var(--mb-danger)}.mbsf-line-head,.mbsf-line{display:grid;grid-template-columns:minmax(190px,1.05fr) minmax(220px,1.5fr) 100px 120px 42px;gap:12px;align-items:start;padding:12px}.mbsf-line-head{color:var(--mb-muted);font-size:13px;font-weight:700;border-bottom:1px solid var(--mb-border)}.mbsf-line{border-bottom:1px solid var(--mb-border)}.mbsf-line:last-child{border-bottom:0}.mbsf-line [data-invalid=true] .mbsf-input{border-color:var(--mb-danger);background:color-mix(in srgb,var(--mb-danger) 4%,var(--mb-input))}.mbsf-money{padding-top:12px;text-align:right;font-variant-numeric:tabular-nums}.mbsf-total{display:flex;justify-content:flex-end;gap:45px;padding:16px 56px 16px 16px;font-size:17px;font-weight:760}
.mbsf-icon-btn{width:40px;height:42px;border:0;background:transparent;color:var(--mb-text);font-size:22px;cursor:pointer}.mbsf-secondary{min-height:40px;padding:8px 14px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);color:var(--mb-text);font:inherit;font-weight:680;cursor:pointer}.mbsf-attach-list{display:grid;gap:10px;margin-bottom:18px}.mbsf-attach-row{padding:14px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius)}.mbsf-attach-row[data-auto=true]{border-color:color-mix(in srgb,#159447 45%,var(--mb-border));background:color-mix(in srgb,#159447 5%,var(--mb-surface))}.mbsf-attach-main{display:flex;align-items:center;gap:12px;min-width:0;flex:1}.mbsf-attach-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto}.mbsf-file{min-width:0}.mbsf-file strong{overflow-wrap:anywhere}.mbsf-badge{display:inline-block;margin-left:8px;padding:2px 7px;border:1px solid var(--mb-border);border-radius:7px;color:var(--mb-muted);font-size:12px;font-weight:600}.mbsf-drop{display:grid;width:100%;place-items:center;min-height:210px;padding:30px;border:2px dashed color-mix(in srgb,var(--mb-muted) 55%,transparent);border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-accent) 3%,var(--mb-surface));color:var(--mb-text);font:inherit;text-align:center;cursor:pointer}.mbsf-drop[data-active=true]{border-color:var(--mb-accent);background:color-mix(in srgb,var(--mb-accent) 10%,var(--mb-surface))}.mbsf-alert{padding:12px 14px;border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-danger) 10%,transparent);color:var(--mb-danger)}.mbsf-actions{justify-content:flex-end}.mbsf-submit{min-width:180px;min-height:48px;padding:11px 24px;border:0;border-radius:var(--mb-control-radius);background:var(--mb-accent);color:var(--mb-accent-contrast);font:inherit;font-weight:780;cursor:pointer}
@media(max-width:820px){.mbsf{gap:16px}.mbsf-grid{grid-template-columns:1fr}.mbsf-span{grid-column:auto}.mbsf-card{padding:18px 16px}.mbsf-line-head{display:none}.mbsf-line{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 86px;gap:14px;padding:18px 16px}.mbsf-line>div:before{display:block;margin-bottom:6px;color:var(--mb-muted);font-size:12px;font-weight:700;content:attr(data-label)}.mbsf-line>div:nth-child(1),.mbsf-line>div:nth-child(2){grid-column:1/-1}.mbsf-money{align-self:end;padding:0 0 12px;text-align:right}.mbsf-line .mbsf-icon-btn{position:absolute;right:8px;bottom:3px}.mbsf-total{padding:16px 18px;gap:24px}.mbsf-head{align-items:flex-start}.mbsf-segments{grid-template-columns:repeat(3,minmax(0,1fr))}.mbsf-segment{min-width:0;padding:8px 4px;border-right:1px solid var(--mb-border);border-bottom:0;font-size:13px}.mbsf-segment:last-child{border-right:0}.mbsf-attach-row{align-items:flex-start;flex-wrap:wrap}.mbsf-attach-main{align-items:flex-start}.mbsf-attach-actions{margin-left:auto}.mbsf-drop{min-height:190px;padding:24px 18px}.mbsf-actions{position:sticky;bottom:86px;z-index:10}.mbsf-submit{width:100%}}
`;

function RequiredMark(): ReactElement { return <span className="mbsf-star"> *</span>; }
function Field({ label, required, error, path, span, children }: { label: string; required?: boolean; error?: string | undefined; path?: string; span?: boolean; children: ReactNode }): ReactElement {
  return <label className={`mbsf-field${span ? " mbsf-span" : ""}`} data-field-path={path} data-invalid={Boolean(error)}><span className="mbsf-label">{label}{required ? <RequiredMark /> : null}</span>{children}{error ? <small className="mbsf-error" role="alert">{error}</small> : null}</label>;
}
function TextDateInput({ value, onChange, disabled, required, ariaLabel }: { value?: string | null | undefined; onChange: (value: string) => void; disabled: boolean; required?: boolean; ariaLabel: string }): ReactElement {
  const [display, setDisplay] = useState(() => formatBillSubmissionDate(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setDisplay(formatBillSubmissionDate(value)); setInvalid(false); }, [value]);
  return <><input className="mbsf-input" type="text" inputMode="numeric" autoComplete="off" placeholder="MM/DD/YYYY" aria-label={ariaLabel} aria-invalid={invalid} required={required} disabled={disabled} value={display} onChange={(event) => {
    const next = event.target.value; const parsed = parseBillSubmissionDate(next); setDisplay(next); setInvalid(Boolean(next && !parsed));
    if (!next.trim()) onChange(""); else if (parsed) onChange(parsed);
  }} onBlur={() => setInvalid(Boolean(display && !parseBillSubmissionDate(display)))} />{invalid ? <small className="mbsf-error">Use MM/DD/YYYY</small> : null}</>;
}

type ComboOption = { id: string; label: string; detail?: string };
function ComboBox({ value, placeholder, options, disabled, loading, loadingMore, invalid, onOpen, onQuery, onEndReached, onSelect, createOption, ariaLabel }: { value: string; placeholder: string; options: ComboOption[]; disabled: boolean; loading?: boolean; loadingMore?: boolean; invalid?: boolean; onOpen?: () => void; onQuery?: (query: string) => void; onEndReached?: () => void; onSelect: (option: ComboOption) => void; createOption?: (query: string) => ComboOption | null; ariaLabel: string }): ReactElement {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? options.filter((option) => `${option.id} ${option.label} ${option.detail ?? ""}`.toLowerCase().includes(q)) : options;
    const custom = createOption?.(query) ?? null;
    return custom && !matches.some((option) => option.id.toUpperCase() === custom.id.toUpperCase()) ? [...matches, custom] : matches;
  }, [createOption, options, query]);
  const showMenu = open && (loading || visible.length > 0 || query.trim().length >= 2);
  return <div className="mbsf-combo"><input className="mbsf-input" role="combobox" aria-label={ariaLabel} aria-invalid={invalid} aria-expanded={showMenu} autoComplete="off" disabled={disabled} placeholder={placeholder} value={open ? query : value} onFocus={() => { setOpen(true); setQuery(""); onOpen?.(); }} onChange={(event) => { setOpen(true); setQuery(event.target.value); onQuery?.(event.target.value); }} onBlur={() => setTimeout(() => setOpen(false), 120)} />{showMenu ? <div className="mbsf-menu" role="listbox" onScroll={(event) => { const menu = event.currentTarget; if (menu.scrollHeight - menu.scrollTop - menu.clientHeight < 120) onEndReached?.(); }}>{loading && !visible.length ? <div className="mbsf-menu-status">Loading codes…</div> : visible.length ? visible.map((option) => <button className="mbsf-option" type="button" role="option" key={option.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(option); setOpen(false); setQuery(""); }}><strong>{option.label}</strong>{option.detail ? <small>{option.detail}</small> : null}</button>) : <div className="mbsf-option">No matches</div>}{loadingMore ? <div className="mbsf-menu-status">Loading more…</div> : null}</div> : null}</div>;
}

function focusFirstInvalid(form: HTMLFormElement): void {
  const field = form.querySelector<HTMLElement>('[data-invalid="true"]');
  if (!field) return;
  const control = field.querySelector<HTMLElement>('input,select,textarea,button,[tabindex]:not([tabindex="-1"])');
  control?.focus({ preventScroll: true });
  const fieldRect = field.getBoundingClientRect();
  let scrollParent: HTMLElement | null = field.parentElement;
  while (scrollParent) {
    const style = window.getComputedStyle(scrollParent);
    if (/(auto|scroll)/.test(style.overflowY) && scrollParent.scrollHeight > scrollParent.clientHeight) break;
    scrollParent = scrollParent.parentElement;
  }
  if (scrollParent) {
    const parentRect = scrollParent.getBoundingClientRect();
    scrollParent.scrollTo({ top: Math.max(0, scrollParent.scrollTop + fieldRect.top - parentRect.top - 24), behavior: "smooth" });
  } else {
    window.scrollTo({ top: Math.max(0, window.scrollY + fieldRect.top - 24), behavior: "smooth" });
  }
}

function customProcedureOption(query: string): ComboOption | null {
  const code = query.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^(?:\d{5}|[A-Z]\d{4}|ML(?:20[0-5]|PRR))$/.test(code)) return null;
  return { id: code, label: code, detail: "Use this CPT, HCPCS, or medical-legal code" };
}

function mergeOptions<T extends { code: string }>(defaults: T[], supplied: T[] | undefined): T[] {
  const map = new Map(defaults.map((item) => [item.code.toUpperCase(), item]));
  supplied?.forEach((item) => map.set(item.code.toUpperCase(), item)); return [...map.values()];
}

function mergeDiagnosisOptions(options: BillSubmissionDiagnosisOption[]): BillSubmissionDiagnosisOption[] {
  return [...new Map(options.map((item) => [item.code.toUpperCase(), item])).values()]
    .sort((left, right) => left.code.localeCompare(right.code, undefined, { numeric: true }));
}

export type BillSubmissionSectionId =
  | "header"
  | "patient"
  | "claim"
  | "providers"
  | "serviceLines"
  | "attachments"
  | "actions";

type BillSubmissionSections = Record<BillSubmissionSectionId, ReactNode>;
const BillSubmissionSectionsContext = createContext<BillSubmissionSections | null>(null);

function BillSubmissionSection({ id }: { id: BillSubmissionSectionId }): ReactElement {
  const sections = useContext(BillSubmissionSectionsContext);
  if (!sections) throw new Error("Bill submission sections must be rendered inside BillSubmissionForm.");
  return <>{sections[id]}</>;
}

export function BillSubmissionHeader(): ReactElement { return <BillSubmissionSection id="header" />; }
export function BillSubmissionPatientSection(): ReactElement { return <BillSubmissionSection id="patient" />; }
export function BillSubmissionClaimSection(): ReactElement { return <BillSubmissionSection id="claim" />; }
export function BillSubmissionProvidersSection(): ReactElement { return <BillSubmissionSection id="providers" />; }
export function BillSubmissionServiceLinesSection(): ReactElement { return <BillSubmissionSection id="serviceLines" />; }
export function BillSubmissionAttachmentsSection(): ReactElement { return <BillSubmissionSection id="attachments" />; }
export function BillSubmissionActions(): ReactElement { return <BillSubmissionSection id="actions" />; }

export function BillSubmissionForm({
  initialBill, attachments = EMPTY_ATTACHMENTS, onSubmit, onSubmitted, getSession, sessionEndpoint, apiBaseUrl,
  fetch: fetchOverride, onSearchClaimsAdministrators, diagnosisOptions = [], onSearchDiagnoses,
  onLookupPostalCode, procedureOptions, modifierOptions, appearance, className = "bill-submission-form",
  style, disabled = false, submitLabel = "Submit bill", heading = "Bill information",
  description = "Review the bill details, add attachments, and submit.",
  children,
}: BillSubmissionFormProps): ReactElement {
  const [bill, setBill] = useState(() => cloneBill(initialBill));
  const [selectedIds, setSelectedIds] = useState(() => attachments.map((item) => item.id));
  const [removedSourceIds, setRemovedSourceIds] = useState<string[]>([]);
  const [uploads, setUploads] = useState<BillSubmissionUpload[]>([]); const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationActive, setValidationActive] = useState(false);
  const [formError, setFormError] = useState<string | null>(null); const [submitting, setSubmitting] = useState(false);
  const [payerResults, setPayerResults] = useState<BillReviewPayer[]>([]); const [payerLoading, setPayerLoading] = useState(false);
  const [diagnosisResults, setDiagnosisResults] = useState<BillSubmissionDiagnosisOption[]>([]);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false); const [diagnosisLoadingMore, setDiagnosisLoadingMore] = useState(false);
  const [diagnosisQuery, setDiagnosisQuery] = useState<string | null>(null); const [diagnosisHasMore, setDiagnosisHasMore] = useState(true);
  const [postalStatus, setPostalStatus] = useState<string | null>(null); const [dragActive, setDragActive] = useState(false);
  const formRef = useRef<HTMLFormElement>(null); const fileInput = useRef<HTMLInputElement>(null);
  const diagnosisRequest = useRef(0); const diagnosisAppendPending = useRef(false);
  const procedures = useMemo(() => mergeOptions(DEFAULT_BILL_SUBMISSION_PROCEDURES, procedureOptions), [procedureOptions]);
  const modifiers = useMemo(() => mergeOptions(DEFAULT_BILL_SUBMISSION_MODIFIERS, modifierOptions), [modifierOptions]);
  const [evaluationType, setEvaluationType] = useState<BillSubmissionEvaluationType>(() => initialBill.renderingProvider?.isAme ? "ame" : initialBill.renderingProvider?.specialty?.toLowerCase().includes("psych") ? "psych_qme" : "qme");
  const connected = !onSubmit;
  const referenceClient = useMemo(() => (getSession || sessionEndpoint || connected) ? createBillReferenceClient({ getSession, sessionEndpoint, apiBaseUrl, fetch: fetchOverride }) : null, [getSession, sessionEndpoint, apiBaseUrl, fetchOverride, connected]);
  const submissionClient = useMemo(() => connected ? createBillSubmissionClient({ getSession, sessionEndpoint, apiBaseUrl, fetch: fetchOverride }) : null, [getSession, sessionEndpoint, apiBaseUrl, fetchOverride, connected]);
  const locked = disabled || submitting;

  useEffect(() => {
    setBill(cloneBill(initialBill)); setSelectedIds(attachments.map((item) => item.id));
    setRemovedSourceIds([]); setUploads([]); setErrors({}); setValidationActive(false); setFormError(null); setDiagnosisResults([]);
    setDiagnosisQuery(null); setDiagnosisHasMore(true); diagnosisRequest.current += 1; diagnosisAppendPending.current = false;
  }, [initialBill, attachments]);
  useEffect(() => {
    if (validationActive) setErrors(validateBillSubmission(bill).fieldErrors);
  }, [bill, validationActive]);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList); if (!files.length) return; setFormError(null);
    const invalid = files.find((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"));
    if (invalid) return setFormError(`${invalid.name} is not a PDF.`);
    const oversized = files.find((file) => file.size > MAX_PDF_BYTES); if (oversized) return setFormError(`${oversized.name} is larger than 25 MB.`);
    const nextBytes = [...uploads.map((item) => item.file), ...files].reduce((sum, file) => sum + file.size, 0);
    if (nextBytes > MAX_UPLOAD_BYTES) return setFormError("Attachments exceed the 100 MB upload limit.");
    if (selectedIds.length + uploads.length + files.length > MAX_DOCUMENTS) return setFormError(`A bill can include at most ${MAX_DOCUMENTS} attachments.`);
    setUploads((current) => [...current, ...files.map((file) => ({ file, documentType: "other" as const }))]);
  }, [selectedIds.length, uploads]);
  useEffect(() => {
    const over = (event: DragEvent) => { if (event.dataTransfer?.types.includes("Files")) { event.preventDefault(); setDragActive(true); } };
    const leave = (event: DragEvent) => { if (!event.relatedTarget) setDragActive(false); };
    const drop = (event: DragEvent) => { if (event.dataTransfer?.files.length) { event.preventDefault(); setDragActive(false); addFiles(event.dataTransfer.files); } };
    window.addEventListener("dragover", over); window.addEventListener("dragleave", leave); window.addEventListener("drop", drop);
    return () => { window.removeEventListener("dragover", over); window.removeEventListener("dragleave", leave); window.removeEventListener("drop", drop); };
  }, [addFiles]);

  const setAddress = (patch: Partial<BillSubmissionAddress>) => setBill((current) => ({ ...current, patient: { ...current.patient, address: { ...current.patient.address, ...patch } } }));
  const setLine = (index: number, patch: Partial<BillSubmissionInput["serviceLines"][number]>) => setBill((current) => ({ ...current, serviceLines: ensureTrailingBillSubmissionLine(current.serviceLines.map((line, lineIndex) => {
    if (lineIndex !== index) return line;
    const next = { ...line, ...patch };
    const charge = calculateBillSubmissionAllowedAmount(next, procedures);
    if (charge != null) return { ...next, charge };
    if (Object.hasOwn(patch, "code")) { const withoutCharge = { ...next }; delete withoutCharge.charge; return withoutCharge; }
    return next;
  })) }));
  const text = (value: string | null | undefined, onChange: (value: string) => void, options: { placeholder?: string; maxLength?: number; type?: string } = {}) => <input className="mbsf-input" disabled={locked} value={value ?? ""} onChange={(event) => onChange(event.target.value)} {...options} />;
  const searchPayers = (query: string) => {
    if (query.trim().length < 2) return;
    setPayerLoading(true); const search = onSearchClaimsAdministrators ?? referenceClient?.searchClaimsAdministrators;
    if (!search) { setPayerLoading(false); return; }
    void search(query, bill.claim.claimNumber).then(setPayerResults).catch((caught) => setFormError(caught instanceof Error ? caught.message : "Claims administrator search is unavailable.")).finally(() => setPayerLoading(false));
  };
  const loadDiagnoses = (query: string, append = false) => {
    const trimmed = query.trim();
    const search = onSearchDiagnoses ?? referenceClient?.searchDiagnosisCodes;
    if (!search) { setDiagnosisResults(mergeDiagnosisOptions(diagnosisOptions)); setDiagnosisHasMore(false); setDiagnosisQuery(trimmed); return; }
    const continuing = append && diagnosisQuery === trimmed;
    if (continuing && (!diagnosisHasMore || diagnosisAppendPending.current)) return;
    const offset = continuing ? diagnosisResults.length : 0;
    const request = ++diagnosisRequest.current;
    if (continuing) { diagnosisAppendPending.current = true; setDiagnosisLoadingMore(true); }
    else { setDiagnosisLoading(true); setDiagnosisLoadingMore(false); setDiagnosisQuery(trimmed); setDiagnosisHasMore(true); }
    void search(trimmed, DIAGNOSIS_PAGE_SIZE, offset).then((page) => {
      if (request !== diagnosisRequest.current) return;
      setDiagnosisResults((current) => mergeDiagnosisOptions(continuing ? [...current, ...page] : page));
      setDiagnosisHasMore(page.length >= DIAGNOSIS_PAGE_SIZE);
    }).catch(() => {
      if (request === diagnosisRequest.current && !continuing) setDiagnosisResults([]);
    }).finally(() => {
      if (request !== diagnosisRequest.current) return;
      diagnosisAppendPending.current = false; setDiagnosisLoading(false); setDiagnosisLoadingMore(false);
    });
  };
  const searchDiagnoses = (query: string) => loadDiagnoses(query);
  const diagnosisChoices = useMemo(() => mergeDiagnosisOptions([...diagnosisOptions, ...diagnosisResults]), [diagnosisOptions, diagnosisResults]);
  const updatePostalCode = (postalCode: string) => {
    setAddress({ postalCode }); setPostalStatus(null); const lookup = onLookupPostalCode ?? referenceClient?.lookupPostalCode;
    if (!lookup || !/^\d{5}$/.test(postalCode)) return;
    setPostalStatus("Looking up ZIP…"); void lookup(postalCode).then((place) => { if (!place) return setPostalStatus("ZIP not found"); setAddress({ city: place.city, state: place.state.toUpperCase() }); setPostalStatus(`${place.city}, ${place.state.toUpperCase()} filled from ZIP`); }).catch(() => setPostalStatus("ZIP lookup unavailable"));
  };
  const changeEvaluation = (type: BillSubmissionEvaluationType) => {
    setEvaluationType(type); setBill((current) => ({ ...current, renderingProvider: { ...current.renderingProvider, isAme: type === "ame", isQme: type !== "ame", ...(type === "psych_qme" && !current.renderingProvider?.specialty ? { specialty: "Psychiatry" } : {}) }, serviceLines: applyBillSubmissionEvaluationModifiers(current.serviceLines, type) }));
  };
  const lineCharge = (line: BillSubmissionInput["serviceLines"][number]) => calculateBillSubmissionAllowedAmount(line, procedures) ?? (Number.isFinite(line.charge) ? Number(line.charge) : undefined);
  const total = submittedLines(bill.serviceLines).reduce((sum, line) => sum + (lineCharge(line) ?? 0), 0);

  async function submit(): Promise<void> {
    const clean: BillSubmissionInput = { ...cloneBill(bill), serviceLines: submittedLines(bill.serviceLines).map((line) => { const charge = lineCharge(line); return charge == null ? line : { ...line, charge }; }) };
    const validation = validateBillSubmission(clean); setValidationActive(true); setErrors(validation.fieldErrors); setFormError(null);
    if (!validation.valid) {
      const count = Object.keys(validation.fieldErrors).length;
      const first = Object.values(validation.fieldErrors)[0];
      setFormError(`Fix ${count} highlighted field${count === 1 ? "" : "s"} before submitting. ${first}`);
      window.requestAnimationFrame(() => { if (formRef.current) focusFirstInvalid(formRef.current); });
      return;
    }
    if (selectedIds.length + uploads.length > MAX_DOCUMENTS) return setFormError(`A bill can include at most ${MAX_DOCUMENTS} attachments.`);
    setSubmitting(true); try {
      if (onSubmit) {
        await onSubmit({ bill: clean, sourceAttachmentIds: selectedIds, uploads });
      } else {
        if (!submissionClient) throw new Error("The connected billing client is unavailable.");
        const documents = await prepareBillSubmissionDocuments({
          attachments,
          selectedIds,
          uploads,
          ...(fetchOverride ? { fetch: fetchOverride } : {}),
        });
        const result = await submissionClient.submitBill({ bill: clean, documents });
        await onSubmitted?.(result);
      }
    }
    catch (caught) { setFormError(caught instanceof Error ? caught.message : "Unable to submit the bill."); }
    finally { setSubmitting(false); }
  }

  const claimsAdministratorError = errors["claim.claimsAdministrator"] ?? (!bill.claim.claimsAdministrator?.id ? "Required for routing — search and select a claims administrator." : undefined);

  const headerSection = <div className="mbsf-head"><div><h3 className="mbsf-title">{heading}</h3><p className="mbsf-copy">{description}</p></div><span className="mbsf-required"><RequiredMark /> Required</span></div>;

  const patientSection = <fieldset className="mbsf-card" disabled={locked}><legend className="mbsf-legend">Patient</legend><div className="mbsf-grid">
      <Field path="patient.firstName" label="First name" required error={errors["patient.firstName"]}>{text(bill.patient.firstName, (firstName) => setBill((c) => ({ ...c, patient: { ...c.patient, firstName } })))}</Field>
      <Field path="patient.lastName" label="Last name" required error={errors["patient.lastName"]}>{text(bill.patient.lastName, (lastName) => setBill((c) => ({ ...c, patient: { ...c.patient, lastName } })))}</Field>
      <Field label="Middle name">{text(bill.patient.middleName, (middleName) => setBill((c) => ({ ...c, patient: { ...c.patient, middleName } })))}</Field>
      <Field label="Phone (optional)">{text(bill.patient.phone, (phone) => setBill((c) => ({ ...c, patient: { ...c.patient, phone } })), { type: "tel" })}</Field>
      <Field path="patient.dateOfBirth" label="Date of birth" required error={errors["patient.dateOfBirth"]}><TextDateInput ariaLabel="Date of birth" value={bill.patient.dateOfBirth} disabled={locked} required onChange={(dateOfBirth) => setBill((c) => ({ ...c, patient: { ...c.patient, dateOfBirth } }))} /></Field>
      <Field path="patient.address.line1" label="Address" required span error={errors["patient.address.line1"]}>{text(bill.patient.address.line1, (line1) => setAddress({ line1 }), { placeholder: "Street address" })}</Field>
      <Field path="patient.address.postalCode" label="ZIP" required error={errors["patient.address.postalCode"]}>{text(bill.patient.address.postalCode, updatePostalCode, { maxLength: 10 })}{postalStatus ? <small className="mbsf-help">{postalStatus}</small> : null}</Field>
      <Field path="patient.address.city" label="City" required error={errors["patient.address.city"]}>{text(bill.patient.address.city, (city) => setAddress({ city }))}</Field>
      <Field path="patient.address.state" label="State" required error={errors["patient.address.state"]}>{text(bill.patient.address.state, (state) => setAddress({ state: state.toUpperCase() }), { maxLength: 2 })}</Field>
    </div></fieldset>;

  const claimSection = <fieldset className="mbsf-card" disabled={locked}><legend className="mbsf-legend">Injury &amp; claim</legend><div className="mbsf-grid">
      <Field path="service.date" label="Date of service" required error={errors["service.date"]}><TextDateInput ariaLabel="Date of service" value={bill.service.date} disabled={locked} required onChange={(date) => setBill((c) => ({ ...c, service: { ...c.service, date } }))} /></Field>
      <Field label="Date of injury"><TextDateInput ariaLabel="Date of injury" value={bill.claim.dateOfInjury} disabled={locked} onChange={(dateOfInjury) => setBill((c) => ({ ...c, claim: { ...c.claim, dateOfInjury } }))} /></Field>
      <Field label="Employer (optional)">{text(bill.claim.employer, (employer) => setBill((c) => ({ ...c, claim: { ...c.claim, employer } })))}</Field>
      <Field path="claim.claimNumber" label="Claim number" required error={errors["claim.claimNumber"]}>{text(bill.claim.claimNumber, (claimNumber) => setBill((c) => ({ ...c, claim: { ...c.claim, claimNumber } })))}</Field>
      <Field label="WCAB / ADJ number (optional)">{text(bill.claim.adjNumber, (adjNumber) => setBill((c) => ({ ...c, claim: { ...c.claim, adjNumber } })))}</Field>
      <Field path="claim.claimsAdministrator" label="Claims administrator" required span error={claimsAdministratorError}><ComboBox ariaLabel="Claims administrator" invalid={Boolean(claimsAdministratorError)} disabled={locked} loading={payerLoading} value={bill.claim.claimsAdministrator?.name ?? ""} placeholder="Search the payer directory…" options={payerResults.map((payer) => ({ id: payer.id, label: payer.name, detail: [payer.hasElectronic ? "Electronic" : "Work comp", ...(payer.states ?? [])].join(" · ") }))} onQuery={searchPayers} onSelect={(option) => setBill((c) => ({ ...c, claim: { ...c.claim, claimsAdministrator: { id: option.id, name: option.label } } }))} /></Field>
      <Field label="Injury description (optional)" span>{text(bill.claim.description, (description) => setBill((c) => ({ ...c, claim: { ...c.claim, description } })))}</Field>
      <Field path="diagnoses" label="Diagnosis codes (ICD-10)" required span error={errors.diagnoses}>
        <div className="mbsf-quick-picks" aria-label="Common diagnosis codes">{BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS.map((option) => { const selected = (bill.diagnoses ?? []).includes(option.code); return <button className="mbsf-quick-pick" data-selected={selected} type="button" key={option.code} aria-pressed={selected} title={`${option.code} — ${option.description}`} onClick={() => setBill((current) => ({ ...current, diagnoses: selected ? (current.diagnoses ?? []).filter((code) => code !== option.code) : [...new Set([...(current.diagnoses ?? []), option.code])] }))}>{selected ? "✓" : "+"} {option.label}</button>; })}</div>
        <div className="mbsf-chips">{(bill.diagnoses ?? []).map((code) => { const option = [...BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS, ...diagnosisChoices].find((item) => item.code === code); return <span className="mbsf-chip" key={code}><strong>{code}</strong>{option?.description ? ` ${option.description}` : ""}<button type="button" aria-label={`Remove ${code}`} onClick={() => setBill((c) => ({ ...c, diagnoses: (c.diagnoses ?? []).filter((item) => item !== code) }))}>×</button></span>; })}</div>
        <ComboBox ariaLabel="Add diagnosis code" invalid={Boolean(errors.diagnoses)} disabled={locked} loading={diagnosisLoading} loadingMore={diagnosisLoadingMore} value="" placeholder={(bill.diagnoses?.length ?? 0) ? `${bill.diagnoses!.length} selected — add more…` : "Search ICD-10 codes…"} options={diagnosisChoices.filter((item) => !(bill.diagnoses ?? []).includes(item.code)).map((item) => ({ id: item.code, label: item.code, detail: item.description }))} onOpen={() => { if (diagnosisQuery !== "") loadDiagnoses(""); }} onQuery={searchDiagnoses} onEndReached={() => loadDiagnoses(diagnosisQuery ?? "", true)} onSelect={(option) => setBill((c) => ({ ...c, diagnoses: [...new Set([...(c.diagnoses ?? []), option.id])] }))} />
      </Field>
    </div></fieldset>;

  const providersSection = <fieldset className="mbsf-card" disabled={locked}><legend className="mbsf-legend">Providers &amp; place of service</legend><div className="mbsf-grid">
      <Field label="Billing provider">{text(bill.billingProvider?.name, (name) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, name } })))}</Field>
      <Field label="Billing tax ID">{text(bill.billingProvider?.taxId, (taxId) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, taxId } })))}</Field>
      <Field label="Billing NPI">{text(bill.billingProvider?.npi, (npi) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, npi } })))}</Field>
      <Field label="Billing phone">{text(bill.billingProvider?.phone, (phone) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, phone } })), { type: "tel" })}</Field>
      <Field label="Rendering provider">{text(bill.renderingProvider?.name, (name) => setBill((c) => ({ ...c, renderingProvider: { ...c.renderingProvider, name } })))}</Field>
      <Field label="Specialty">{text(bill.renderingProvider?.specialty, (specialty) => setBill((c) => ({ ...c, renderingProvider: { ...c.renderingProvider, specialty } })))}</Field>
      <Field label="Rendering NPI">{text(bill.renderingProvider?.npi, (npi) => setBill((c) => ({ ...c, renderingProvider: { ...c.renderingProvider, npi } })))}</Field>
      <Field label="License number">{text(bill.renderingProvider?.licenseNumber, (licenseNumber) => setBill((c) => ({ ...c, renderingProvider: { ...c.renderingProvider, licenseNumber } })))}</Field>
      <Field label="License state">{text(bill.renderingProvider?.licenseState, (licenseState) => setBill((c) => ({ ...c, renderingProvider: { ...c.renderingProvider, licenseState: licenseState.toUpperCase() } })), { maxLength: 2 })}</Field>
      <Field label="Service location">{text(bill.serviceLocation?.name, (name) => setBill((c) => ({ ...c, serviceLocation: { ...c.serviceLocation, name } })))}</Field>
      <Field label="Place of service">{text(bill.serviceLocation?.placeOfServiceCode, (placeOfServiceCode) => setBill((c) => ({ ...c, serviceLocation: { ...c.serviceLocation, placeOfServiceCode } })), { maxLength: 2 })}</Field>
    </div></fieldset>;

  const serviceLinesSection = <fieldset className="mbsf-card" disabled={locked}><legend className="mbsf-legend">Evaluation &amp; service lines</legend>
      <p className="mbsf-help">Sets the evaluator/specialty modifier on medical-legal evaluation lines.</p>
      <div className="mbsf-segments" role="group" aria-label="Evaluation type">{([ ["qme", "QME (default)"], ["ame", "AME"], ["psych_qme", "Psych QME"] ] as const).map(([type, label]) => <button className="mbsf-segment" type="button" key={type} aria-pressed={evaluationType === type} onClick={() => changeEvaluation(type)}>{label}</button>)}</div>
      <p className="mbsf-help">{evaluationType === "ame" ? "Agreed Medical Evaluator — eligible ML evaluation codes default to modifier -94." : evaluationType === "psych_qme" ? "Psychiatric QME — eligible ML evaluation codes default to modifier -96 (-95 for ML200)." : "Qualified Medical Evaluator — eligible ML evaluation codes default to modifier -95."}</p>
      <div className="mbsf-lines" data-field-path="serviceLines" data-invalid={Boolean(errors.serviceLines)}><div className="mbsf-line-head"><span>Procedure code</span><span>Modifiers</span><span>Units</span><span>Allowed</span><span /> </div>
        {bill.serviceLines.map((line, index) => <div className="mbsf-line" key={index}>
          <div data-label="Procedure code" data-field-path={`serviceLines.${index}.code`} data-invalid={Boolean(errors[`serviceLines.${index}.code`])}><ComboBox ariaLabel={`Procedure code ${index + 1}`} invalid={Boolean(errors[`serviceLines.${index}.code`])} disabled={locked} value={line.code} placeholder="Search or enter code…" options={procedures.map((item) => ({ id: item.code, label: item.code, detail: item.description }))} createOption={customProcedureOption} onSelect={(option) => { const auto = evaluationModifier(evaluationType, option.id); setLine(index, { code: option.id, ...(auto ? { modifiers: [auto, ...(line.modifiers ?? []).filter((item) => !["94", "95", "96"].includes(item.replace(/^-/, "")))] } : line.modifiers ? { modifiers: line.modifiers } : {}) }); }} />{line.code ? <small className="mbsf-help">{procedures.find((item) => item.code === line.code)?.description ?? "Custom CPT, HCPCS, or medical-legal code"}</small> : null}{errors[`serviceLines.${index}.code`] ? <small className="mbsf-error" role="alert">{errors[`serviceLines.${index}.code`]}</small> : null}</div>
          <div data-label="Modifiers"><div className="mbsf-chips">{(line.modifiers ?? []).map((modifier) => <span className="mbsf-chip" key={modifier}>−{modifier.replace(/^-/, "")}<button type="button" aria-label={`Remove modifier ${modifier}`} onClick={() => setLine(index, { modifiers: (line.modifiers ?? []).filter((item) => item !== modifier) })}>×</button></span>)}</div><ComboBox ariaLabel={`Modifiers ${index + 1}`} disabled={locked} value="" placeholder={(line.modifiers?.length ?? 0) ? `${line.modifiers!.length} modifier${line.modifiers!.length === 1 ? "" : "s"}` : "Add modifiers…"} options={modifiers.filter((item) => !(line.modifiers ?? []).includes(item.code)).map((item) => ({ id: item.code, label: `−${item.code}`, detail: item.description }))} onSelect={(option) => setLine(index, { modifiers: [...new Set([...(line.modifiers ?? []), option.id])] })} /></div>
          <div data-label="Units" data-field-path={`serviceLines.${index}.units`} data-invalid={Boolean(errors[`serviceLines.${index}.units`])}><input className="mbsf-input" aria-label={`Units ${index + 1}`} aria-invalid={Boolean(errors[`serviceLines.${index}.units`])} type="number" min={1} value={line.units ?? 1} onChange={(event) => setLine(index, { units: Number(event.target.value) })} />{errors[`serviceLines.${index}.units`] ? <small className="mbsf-error" role="alert">{errors[`serviceLines.${index}.units`]}</small> : null}</div>
          <div className="mbsf-money" data-label="Allowed">{lineCharge(line) == null ? "—" : lineCharge(line)!.toLocaleString(undefined, { style: "currency", currency: "USD" })}</div>
          <button className="mbsf-icon-btn" type="button" aria-label={`Remove service line ${index + 1}`} disabled={locked || (!lineHasContent(line) && index === bill.serviceLines.length - 1)} onClick={() => setBill((c) => ({ ...c, serviceLines: ensureTrailingBillSubmissionLine(c.serviceLines.filter((_, itemIndex) => itemIndex !== index)) }))}>×</button>
        </div>)}
        <div className="mbsf-total"><span>Total</span><span>{total.toLocaleString(undefined, { style: "currency", currency: "USD" })}</span></div>
      </div>{errors.serviceLines ? <p className="mbsf-error" role="alert">{errors.serviceLines}</p> : null}
    </fieldset>;

  const attachmentsSection = <fieldset className="mbsf-card" disabled={locked}><legend className="mbsf-legend">Attachments</legend><div className="mbsf-attach-list">
      {attachments.filter((attachment) => !removedSourceIds.includes(attachment.id)).map((attachment) => { const auto = attachment.autoAttached || attachment.documentType === "w9"; const removable = !auto && attachment.removable !== false; return <div className="mbsf-attach-row" data-auto={auto} key={attachment.id}><div className="mbsf-attach-main">{auto ? <span aria-label="Always attached" role="img">✓</span> : null}<span className="mbsf-file"><strong>{attachment.fileName}</strong><span className="mbsf-badge">{auto ? "Auto-attached" : documentLabels[attachment.documentType]}</span><span className="mbsf-help" style={{ display: "block" }}>{attachment.description || (auto ? "Included automatically with every bill." : documentLabels[attachment.documentType])}</span></span></div><div className="mbsf-attach-actions">{attachment.previewUrl ? <a className="mbsf-secondary" href={attachment.previewUrl} target="_blank" rel="noopener noreferrer">Preview</a> : null}{removable ? <button className="mbsf-icon-btn" type="button" aria-label={`Remove ${attachment.fileName}`} disabled={locked} onClick={() => { setSelectedIds((current) => current.filter((id) => id !== attachment.id)); setRemovedSourceIds((current) => [...new Set([...current, attachment.id])]); }}>×</button> : null}</div></div>; })}
      {uploads.map((upload, index) => <div className="mbsf-attach-row" key={`${upload.file.name}-${index}`}><div className="mbsf-attach-main"><span className="mbsf-file"><strong>{upload.file.name}</strong><span className="mbsf-help" style={{ display: "block" }}>{(upload.file.size / 1024 / 1024).toFixed(1)} MB</span></span></div><div className="mbsf-attach-actions"><button className="mbsf-secondary" type="button" onClick={() => previewUploadedPdf(upload.file)}>Preview</button><button className="mbsf-icon-btn" type="button" aria-label={`Remove ${upload.file.name}`} onClick={() => setUploads((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></div></div>)}
    </div><input ref={fileInput} hidden type="file" accept="application/pdf,.pdf" multiple onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} /><button className="mbsf-drop" data-active={dragActive} type="button" onClick={() => fileInput.current?.click()}><span><strong style={{ fontSize: 18 }}>Drop additional PDF files here, or click to choose</strong><span className="mbsf-help" style={{ display: "block", marginTop: 8 }}>Add supporting documents anywhere on this screen.</span></span></button></fieldset>;

  const actionsSection = <>{formError ? <div className="mbsf-alert" role="alert">{formError}</div> : null}<div className="mbsf-actions"><button className="mbsf-submit" type="submit" disabled={locked}>{submitting ? "Submitting…" : submitLabel}</button></div></>;
  const sections: BillSubmissionSections = {
    header: headerSection,
    patient: patientSection,
    claim: claimSection,
    providers: providersSection,
    serviceLines: serviceLinesSection,
    attachments: attachmentsSection,
    actions: actionsSection,
  };
  const defaultLayout = <>
    <BillSubmissionHeader />
    <BillSubmissionPatientSection />
    <BillSubmissionClaimSection />
    <BillSubmissionProvidersSection />
    <BillSubmissionServiceLinesSection />
    <BillSubmissionAttachmentsSection />
    <BillSubmissionActions />
  </>;

  return <BillSubmissionSectionsContext.Provider value={sections}>
    <form ref={formRef} className={`${className} mbsf`} style={{ ...mindBillAppearanceStyle(appearance), ...style }} onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
      <style>{css}</style>
      {children ?? defaultLayout}
    </form>
  </BillSubmissionSectionsContext.Provider>;
}
