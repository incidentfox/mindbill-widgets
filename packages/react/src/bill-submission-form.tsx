"use client";

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  createBillReferenceClient,
  createBillSubmissionClient,
  defaultBillReviewPayerOption,
  type BillDeliveryOptions,
  type BillClaimsAdministratorDirectory,
  type BrowserBillSubmissionDocument,
  type BrowserBillSubmissionResult,
  type BillLifecycleSessionProvider,
  type BillReviewPayer,
  type BillReviewPayerOption,
} from "@mindbill/browser";

import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";
import { SendRouteDialog, type SendRouteSubmission } from "./send-route-dialog";
import { ClaimsAdministratorDirectoryDialog } from "./claims-administrator-directory-dialog";
import {
  BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS,
  calculateBillSubmissionAllowedAmount,
  DEFAULT_BILL_SUBMISSION_MODIFIERS,
  DEFAULT_BILL_SUBMISSION_PROCEDURES,
  DEFAULT_BILL_SUBMISSION_TAXONOMIES,
} from "./billing-catalog";

export const BILL_SUBMISSION_DOCUMENT_TYPES = [
  "final_report", "proof_of_service", "letter_of_attestation", "form_122",
  "return_to_work_voucher", "w9", "medical_records", "appeal", "other",
] as const;

export type BillSubmissionDocumentType = (typeof BILL_SUBMISSION_DOCUMENT_TYPES)[number];
export type BillSubmissionAttachmentReportTypeMode = "auto" | "hidden" | "visible";
export type BillSubmissionReportTypeOption = { code: string; label: string };
export const MED_LEGAL_REPORT_TYPE_CODE = "OZ:J4";
export const BILL_SUBMISSION_REPORT_TYPES: readonly BillSubmissionReportTypeOption[] = [
  { code: "OZ:J1", label: "Doctor's First Report (DLSR 5021)" },
  { code: "OZ:J2", label: "Supplemental Medical Report (BRs)" },
  { code: "OZ:J3", label: "Medical Permanent Impairment Report" },
  { code: MED_LEGAL_REPORT_TYPE_CODE, label: "Med-Legal Report" },
  { code: "OZ:J5", label: "Vocational Report" },
  { code: "OZ:J6", label: "Work Status Report" },
  { code: "OZ:J7", label: "Consultation Report" },
  { code: "OZ:J8", label: "Permanent Disability Report" },
  { code: "OZ:J9", label: "Itemized Statement" },
  { code: "03", label: "Justifying Treatment Beyond Utilization Guidelines" },
  { code: "04", label: "Drugs Administered" }, { code: "05", label: "Treatment Diagnosis" },
  { code: "06", label: "Initial Assessment" }, { code: "07", label: "Plan of Treatment" },
  { code: "08", label: "Plan of Treatment" }, { code: "09", label: "PR2 (Progress Report)" },
  { code: "10", label: "Continued Treatment" }, { code: "11", label: "Chemical Analysis" },
  { code: "13", label: "Certified Test Report" }, { code: "15", label: "Justification for Admission" },
  { code: "21", label: "Recovery Plan" }, { code: "A3", label: "Allergies/Sensitivities Document" },
  { code: "A4", label: "Autopsy Report" }, { code: "AM", label: "Ambulance Certification" },
  { code: "AS", label: "Admission Summary" }, { code: "B2", label: "Prescription" },
  { code: "B3", label: "Physician Order" }, { code: "B4", label: "Referral Form" },
  { code: "BR", label: "Benchmark Testing Results" }, { code: "BS", label: "Baseline" },
  { code: "BT", label: "Blanket Test Results" }, { code: "CB", label: "Chiropractic Justification" },
  { code: "CK", label: "Canceled Check" }, { code: "CT", label: "Certification" },
  { code: "D2", label: "Drug Profile Document" }, { code: "DA", label: "Dental Models" },
  { code: "DB", label: "Durable Medical Equipment RX" }, { code: "DG", label: "Diagnostic Report" },
  { code: "DJ", label: "Discharge Monitoring Report" }, { code: "DS", label: "Discharge Summary" },
  { code: "EB", label: "Explanation of Benefits" }, { code: "HC", label: "Health Clinic Records (HC)" },
  { code: "HR", label: "Health Clinic Records (HR)" }, { code: "I5", label: "Immunization Record" },
  { code: "IR", label: "State School Immunization Records" }, { code: "LA", label: "Laboratory Results" },
  { code: "M1", label: "Medical Record Attachment" }, { code: "MT", label: "Nursing Notes" },
  { code: "NN", label: "Minor Deviation Request" }, { code: "OB", label: "Operative Note" },
  { code: "OC", label: "Oxygen Content Averaging Report" }, { code: "OD", label: "Orders and Treatments Document" },
  { code: "OE", label: "Objective Physical Examination Doc" }, { code: "OX", label: "Oxygen Therapy Certification" },
  { code: "OZ", label: "Support Data for Bill" }, { code: "P4", label: "Pathology Report" },
  { code: "P5", label: "Patient Medical History Document" }, { code: "PE", label: "Periodontal Charts" },
  { code: "PN", label: "Physical Therapy Notes" }, { code: "PO", label: "Prosthetics or Orthotic Certification" },
  { code: "PQ", label: "Paramedical Results" }, { code: "PY", label: "Physician's Report" },
  { code: "PZ", label: "Physical Therapy Certification" }, { code: "RB", label: "Radiology Films" },
  { code: "RR", label: "Radiology Reports" }, { code: "RT", label: "Report of tests and Analysis Report" },
  { code: "RX", label: "Renewable Oxygen Content Averaging Report" }, { code: "SG", label: "Symptoms Document" },
  { code: "V5", label: "Death Notification" }, { code: "XP", label: "Photographs" },
] as const;
export type BillSubmissionEvaluationType = "qme" | "ame" | "psych_qme";
export type BillSubmissionAddress = { line1: string; line2?: string; city: string; state: string; postalCode: string };
export type BillSubmissionDiagnosisOption = { code: string; description: string };
export type BillSubmissionProcedureOption = { code: string; description: string; allowedAmount?: number };
export type BillSubmissionModifierOption = { code: string; description: string };
export type BillSubmissionTaxonomyOption = { code: string; description: string };
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
    claimsAdministrator?: {
      id?: string;
      name: string;
      /** The chosen payer (subpayor) when the claims administrator requires payer selection. */
      payerId?: string;
      /** Directory metadata carried while editing; stripped from the submitted bill. */
      payerSelectionRequired?: boolean;
      payers?: BillReviewPayerOption[];
    };
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

/** A validated, submission-ready bill. The form accepts partial provider data while editing,
 * but only emits this complete contract after every required field has passed validation. */
export type CompleteBillSubmissionInput = Omit<
  BillSubmissionInput,
  "claim" | "billingProvider" | "renderingProvider" | "serviceLocation" | "diagnoses" | "serviceLines"
> & {
  claim: BillSubmissionInput["claim"] & {
    employer: string;
    dateOfInjury: string;
    claimsAdministrator: { id: string; name: string; payerId?: string };
  };
  billingProvider: {
    name: string; taxId: string; npi: string; phone: string; address: BillSubmissionAddress;
  };
  renderingProvider: NonNullable<BillSubmissionInput["renderingProvider"]> & {
    name: string; npi: string; taxonomy: string;
  };
  serviceLocation: NonNullable<BillSubmissionInput["serviceLocation"]> & {
    address: BillSubmissionAddress; placeOfServiceCode: string;
  };
  diagnoses: string[];
  serviceLines: BillSubmissionInput["serviceLines"];
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
  /** Authenticated source loader used when the document is not available at a public URL. */
  loadBlob?: () => Promise<Blob>;
  reportTypeCode?: string;
};
export type BillSubmissionUpload = { file: File; documentType: BillSubmissionDocumentType; description?: string; reportTypeCode?: string };
export type BillSubmissionFormValue = {
  bill: CompleteBillSubmissionInput;
  sourceAttachmentIds: string[];
  sourceAttachmentReportTypes: Record<string, string>;
  uploads: BillSubmissionUpload[];
};

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
  onGetClaimsAdministratorDirectory?: (id: string, injuryState?: string) => Promise<BillClaimsAdministratorDirectory>;
  /** Free-text name from the host system, shown as a hint while choosing the canonical directory entry. */
  claimsAdministratorHint?: ReactNode;
  diagnosisOptions?: BillSubmissionDiagnosisOption[];
  onSearchDiagnoses?: (query: string, limit?: number, offset?: number) => Promise<BillSubmissionDiagnosisOption[]>;
  onLookupPostalCode?: (postalCode: string) => Promise<BillSubmissionPostalPlace | null>;
  procedureOptions?: BillSubmissionProcedureOption[];
  modifierOptions?: BillSubmissionModifierOption[];
  /** Common NUCC provider taxonomies are bundled; supplied values extend or replace matching codes. */
  taxonomyOptions?: BillSubmissionTaxonomyOption[];
  /**
   * The delivery-method dialog shown when the biller submits.
   * "auto" (default) shows it in connected mode whenever the delivery preview
   * is available; "off" submits directly on MindBill's recommended route.
   */
  deliveryRoutePicker?: "auto" | "off";
  /** Auto hides and forces J4 for med-legal bills; treatment bills show the full report-type directory. */
  attachmentReportTypeMode?: BillSubmissionAttachmentReportTypeMode;
  attachmentReportTypes?: readonly BillSubmissionReportTypeOption[];
  defaultAttachmentReportType?: string;
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  submitLabel?: string;
  heading?: ReactNode;
  description?: ReactNode;
  /** Rejected-field paths to visually call out while the user corrects the next submission. */
  attentionFields?: string[];
  attentionMessage?: ReactNode;
  /**
   * Optional composable layout. Use the exported section components as children;
   * the parent form continues to own validation, directory lookups, uploads, and submission.
   */
  children?: ReactNode;
};

export const BILL_SUBMISSION_REQUIRED_FIELDS = [
  "patient.firstName", "patient.lastName", "patient.dateOfBirth", "patient.address.line1",
  "patient.address.city", "patient.address.state", "patient.address.postalCode",
  "claim.claimNumber", "claim.employer", "claim.dateOfInjury", "claim.claimsAdministrator", "service.date",
  "billingProvider.name", "billingProvider.taxId", "billingProvider.npi", "billingProvider.phone",
  "billingProvider.address.line1", "billingProvider.address.city", "billingProvider.address.state", "billingProvider.address.postalCode",
  "renderingProvider.name", "renderingProvider.npi", "renderingProvider.taxonomy",
  "serviceLocation.placeOfServiceCode", "serviceLocation.address.line1", "serviceLocation.address.city",
  "serviceLocation.address.state", "serviceLocation.address.postalCode",
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
  reportTypeCodeByAttachmentId = {},
  defaultReportTypeCode,
  fetch: fetchOverride,
}: {
  attachments: BillSubmissionSourceAttachment[];
  selectedIds: string[];
  uploads: BillSubmissionUpload[];
  reportTypeCodeByAttachmentId?: Record<string, string>;
  defaultReportTypeCode?: string;
  fetch?: typeof globalThis.fetch;
}): Promise<BrowserBillSubmissionDocument[]> {
  const fetcher = fetchOverride ?? globalThis.fetch;
  const selected = selectedIds.map((id) => attachments.find((item) => item.id === id)).filter((item): item is BillSubmissionSourceAttachment => Boolean(item));
  const sourceDocuments = await Promise.all(selected.map(async (attachment) => {
    let blob: Blob;
    if (attachment.loadBlob) blob = await attachment.loadBlob();
    else {
      if (!attachment.previewUrl) throw new Error(`${attachment.fileName} cannot be submitted because its document URL is missing.`);
      if (typeof fetcher !== "function") throw new Error("A Fetch API implementation is required.");
      const response = await fetcher(attachment.previewUrl, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`${attachment.fileName} could not be loaded for submission.`);
      blob = await response.blob();
    }
    return pdfDocument(blob, {
      externalId: attachment.id,
      filename: attachment.fileName,
      documentType: attachment.documentType,
      ...((reportTypeCodeByAttachmentId[attachment.id] || attachment.reportTypeCode || defaultReportTypeCode) ? { reportTypeCode: reportTypeCodeByAttachmentId[attachment.id] || attachment.reportTypeCode || defaultReportTypeCode } : {}),
      ...(attachment.description ? { description: attachment.description } : {}),
    });
  }));
  const uploadedDocuments = await Promise.all(uploads.map(({ file, documentType, description, reportTypeCode }) => pdfDocument(file, {
    filename: file.name,
    documentType,
    ...((reportTypeCode || defaultReportTypeCode) ? { reportTypeCode: reportTypeCode || defaultReportTypeCode } : {}),
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

export const PSYCH_QME_DEFAULT_DIAGNOSIS = "Z04.6";

/** Seed Psych QME's general examination code only when no diagnosis was supplied. */
export function applyBillSubmissionEvaluationDiagnoses(
  diagnoses: string[] | undefined,
  type: BillSubmissionEvaluationType,
): string[] {
  const current = [...(diagnoses ?? [])];
  return type === "psych_qme" && !current.some((code) => code.trim())
    ? [PSYCH_QME_DEFAULT_DIAGNOSIS]
    : current;
}

function initialEvaluationType(bill: BillSubmissionInput): BillSubmissionEvaluationType {
  if (bill.renderingProvider?.isAme) return "ame";
  return bill.renderingProvider?.specialty?.toLowerCase().includes("psych") ? "psych_qme" : "qme";
}

function cloneInitialBill(bill: BillSubmissionInput): BillSubmissionInput {
  const cloned = cloneBill(bill);
  cloned.diagnoses = applyBillSubmissionEvaluationDiagnoses(cloned.diagnoses, initialEvaluationType(bill));
  return cloned;
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
  required("claim.employer", bill.claim.employer, "Enter the employer name.");
  required("claim.dateOfInjury", bill.claim.dateOfInjury, "Enter the date of injury.");
  required("claim.claimsAdministrator", bill.claim.claimsAdministrator?.name, "Select a claims administrator so MindBill can route this bill.");
  required("service.date", bill.service.date, "Enter the date of service.");
  required("billingProvider.name", bill.billingProvider?.name, "Enter the billing provider name.");
  required("billingProvider.taxId", bill.billingProvider?.taxId, "Enter the billing provider Tax ID (EIN or SSN).");
  required("billingProvider.npi", bill.billingProvider?.npi, "Enter the billing provider NPI.");
  required("billingProvider.phone", bill.billingProvider?.phone, "Enter the billing provider phone number.");
  required("billingProvider.address.line1", bill.billingProvider?.address?.line1, "Enter the billing provider street address.");
  required("billingProvider.address.city", bill.billingProvider?.address?.city, "Enter the billing provider city.");
  required("billingProvider.address.state", bill.billingProvider?.address?.state, "Enter the billing provider 2-letter state code.");
  required("billingProvider.address.postalCode", bill.billingProvider?.address?.postalCode, "Enter the billing provider ZIP code.");
  required("renderingProvider.name", bill.renderingProvider?.name, "Enter the rendering provider name.");
  required("renderingProvider.npi", bill.renderingProvider?.npi, "Enter the rendering provider NPI.");
  required("renderingProvider.taxonomy", bill.renderingProvider?.taxonomy, "Enter the rendering provider taxonomy code.");
  required("serviceLocation.placeOfServiceCode", bill.serviceLocation?.placeOfServiceCode, "Enter the 2-digit place of service code.");
  required("serviceLocation.address.line1", bill.serviceLocation?.address?.line1, "Enter the service facility street address.");
  required("serviceLocation.address.city", bill.serviceLocation?.address?.city, "Enter the service facility city.");
  required("serviceLocation.address.state", bill.serviceLocation?.address?.state, "Enter the service facility 2-letter state code.");
  required("serviceLocation.address.postalCode", bill.serviceLocation?.address?.postalCode, "Enter the service facility ZIP code.");
  if (!(bill.diagnoses ?? []).some((code) => code.trim())) {
    errors.diagnoses = "Select at least one ICD-10 diagnosis code.";
  }
  if (bill.claim.claimsAdministrator?.name && !bill.claim.claimsAdministrator.id) {
    errors["claim.claimsAdministrator"] = "Select a claims administrator from the payer directory.";
  }
  if (bill.claim.claimsAdministrator?.payerSelectionRequired && !bill.claim.claimsAdministrator.payerId?.trim()) {
    errors["claim.claimsAdministrator.payerId"] = "Select the payer for this claims administrator.";
  }
  if (bill.patient.dateOfBirth && !parseBillSubmissionDate(bill.patient.dateOfBirth)) errors["patient.dateOfBirth"] = "Use MM/DD/YYYY";
  if (bill.claim.dateOfInjury && !parseBillSubmissionDate(bill.claim.dateOfInjury)) errors["claim.dateOfInjury"] = "Use MM/DD/YYYY";
  if (bill.patient.address.state.trim().length !== 2) errors["patient.address.state"] = "Use a 2-letter state code";
  if (bill.billingProvider?.address?.state && bill.billingProvider.address.state.trim().length !== 2) errors["billingProvider.address.state"] = "Use a 2-letter state code.";
  if (bill.serviceLocation?.address?.state && bill.serviceLocation.address.state.trim().length !== 2) errors["serviceLocation.address.state"] = "Use a 2-letter state code.";
  const digits = (value?: string) => value?.replace(/\D/g, "") ?? "";
  if (bill.billingProvider?.taxId && digits(bill.billingProvider.taxId).length !== 9) errors["billingProvider.taxId"] = "Enter a valid 9-digit EIN or SSN.";
  if (bill.billingProvider?.npi && !/^\d{10}$/.test(digits(bill.billingProvider.npi))) errors["billingProvider.npi"] = "Enter a valid 10-digit NPI.";
  if (bill.renderingProvider?.npi && !/^\d{10}$/.test(digits(bill.renderingProvider.npi))) errors["renderingProvider.npi"] = "Enter a valid 10-digit NPI.";
  if (bill.renderingProvider?.taxonomy && !/^[A-Za-z0-9]{10}$/.test(bill.renderingProvider.taxonomy.trim())) errors["renderingProvider.taxonomy"] = "Enter a valid 10-character taxonomy code.";
  if (bill.serviceLocation?.placeOfServiceCode && !/^\d{2}$/.test(bill.serviceLocation.placeOfServiceCode.trim())) errors["serviceLocation.placeOfServiceCode"] = "Enter a valid 2-digit place of service code.";
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
.mbsf-attention{padding:14px 16px;border-left:4px solid var(--mb-danger);border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-danger) 8%,var(--mb-surface));color:var(--mb-text)}.mbsf [data-attention=true] .mbsf-input,.mbsf [data-attention=true] .mbsf-select,.mbsf [data-attention=true].mbsf-lines{border-color:var(--mb-danger);background:color-mix(in srgb,var(--mb-danger) 4%,var(--mb-input))}.mbsf [data-attention=true]>.mbsf-label{color:var(--mb-danger)}
.mbsf-head,.mbsf-section-head,.mbsf-attach-row,.mbsf-actions{display:flex;align-items:center;justify-content:space-between;gap:16px}.mbsf-title{margin:0;font-size:24px}.mbsf-copy,.mbsf-help{color:var(--mb-muted);margin:5px 0 0}.mbsf-required{font-size:13px;color:var(--mb-muted);white-space:nowrap}.mbsf-star,.mbsf-error{color:var(--mb-danger)}
.mbsf-card{min-width:0;margin:0;padding:24px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);box-shadow:var(--mb-shadow)}.mbsf-card[data-invalid=true]{border-color:var(--mb-danger)}.mbsf-legend{padding:0 10px;font-size:18px;font-weight:760}.mbsf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 24px}.mbsf-subhead{grid-column:1/-1;margin:6px 0 -2px;padding-top:14px;border-top:1px solid var(--mb-border);font-size:15px;font-weight:780;letter-spacing:.01em}.mbsf-subhead:first-child{margin-top:0;padding-top:0;border-top:0}.mbsf-span{grid-column:1/-1}.mbsf-field{display:grid;align-content:start;gap:7px;min-width:0}.mbsf-label{font-weight:680}.mbsf-input,.mbsf-select{width:100%;min-height:46px;padding:10px 12px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-input);color:var(--mb-text);font:inherit}.mbsf-input:focus,.mbsf-select:focus{outline:3px solid color-mix(in srgb,var(--mb-accent) 22%,transparent);border-color:var(--mb-accent)}.mbsf-field[data-invalid=true] .mbsf-input,.mbsf-field[data-invalid=true] .mbsf-select,.mbsf-invalid-control .mbsf-input{border-color:var(--mb-danger);background:color-mix(in srgb,var(--mb-danger) 4%,var(--mb-input))}.mbsf-field[data-invalid=true] .mbsf-input:focus,.mbsf-field[data-invalid=true] .mbsf-select:focus{outline-color:color-mix(in srgb,var(--mb-danger) 24%,transparent)}
.mbsf-combo{position:relative}.mbsf-menu{position:absolute;z-index:20;top:calc(100% + 5px);left:0;right:0;max-height:min(360px,46vh);overflow:auto;overscroll-behavior:contain;padding:7px;border:1px solid var(--mb-border);border-radius:12px;background:var(--mb-surface);box-shadow:0 14px 35px rgba(17,38,49,.16)}.mbsf-option{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:14px;width:100%;padding:10px;border:0;border-radius:8px;background:transparent;color:var(--mb-text);font:inherit;text-align:left;cursor:pointer}.mbsf-option:hover,.mbsf-option:focus{background:color-mix(in srgb,var(--mb-accent) 9%,var(--mb-surface))}.mbsf-option-main{display:grid;gap:2px;min-width:0}.mbsf-option small{color:var(--mb-muted);overflow-wrap:anywhere}.mbsf-option-route{align-self:center;color:var(--mb-accent);font-size:13px;font-weight:750;white-space:nowrap}.mbsf-menu-status{padding:12px;text-align:center;color:var(--mb-muted);font-size:13px}.mbsf-directory-link{justify-self:start;border:0;padding:0;background:transparent;color:var(--mb-accent);font:inherit;font-weight:700;text-align:left;text-decoration:underline;cursor:pointer}
.mbsf-payer-status{display:flex;align-items:center;gap:7px;color:#087f5b;font-size:13px;font-weight:650}.mbsf-payer-intro{margin:4px 0 0;color:var(--mb-muted)}.mbsf-payer-list{display:grid;gap:8px}.mbsf-payer-option{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 12px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-accent) 3%,var(--mb-surface))}.mbsf-payer-option-main{display:grid;gap:5px;min-width:0}.mbsf-payer-option-main strong{overflow-wrap:anywhere}.mbsf-payer-signals{display:flex;flex-wrap:wrap;gap:6px}.mbsf-payer-signal{padding:2px 7px;border:1px solid var(--mb-border);border-radius:999px;color:var(--mb-muted);font-size:12px}.mbsf-payer-signal[data-state=match]{border-color:color-mix(in srgb,#159447 45%,var(--mb-border));color:#087f5b}.mbsf-payer-signal[data-state=warning]{border-color:color-mix(in srgb,#c56a00 55%,var(--mb-border));color:#9a5200}
.mbsf-chips,.mbsf-quick-picks{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:8px}.mbsf-chip,.mbsf-quick-pick{display:inline-flex;align-items:center;gap:7px;padding:5px 9px;border:1px solid var(--mb-border);border-radius:999px;background:var(--mb-input)}.mbsf-chip button{border:0;background:transparent;color:var(--mb-muted);cursor:pointer;font:inherit}.mbsf-quick-pick{color:var(--mb-text);font:inherit;cursor:pointer}.mbsf-quick-pick[data-selected=true]{border-color:var(--mb-accent);color:var(--mb-accent)}
.mbsf-segments{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);overflow:hidden}.mbsf-segment{min-height:44px;border:0;border-right:1px solid var(--mb-border);background:var(--mb-input);color:var(--mb-text);font:inherit;font-weight:700;cursor:pointer}.mbsf-segment:last-child{border-right:0}.mbsf-segment[aria-pressed=true]{background:var(--mb-accent);color:var(--mb-accent-contrast)}
.mbsf-lines{margin-top:18px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);overflow:visible}.mbsf-lines[data-invalid=true]{border-color:var(--mb-danger)}.mbsf-line-head,.mbsf-line{display:grid;grid-template-columns:minmax(190px,1.05fr) minmax(190px,1.3fr) minmax(112px,.7fr) 100px 120px 42px;gap:12px;align-items:start;padding:12px}.mbsf-line-head{color:var(--mb-muted);font-size:13px;font-weight:700;border-bottom:1px solid var(--mb-border)}.mbsf-line{border-bottom:1px solid var(--mb-border)}.mbsf-line:last-child{border-bottom:0}.mbsf-line [data-invalid=true] .mbsf-input{border-color:var(--mb-danger);background:color-mix(in srgb,var(--mb-danger) 4%,var(--mb-input))}.mbsf-money{padding-top:12px;text-align:right;font-variant-numeric:tabular-nums}.mbsf-dx{display:flex;flex-wrap:wrap;gap:5px;padding-top:6px}.mbsf-dx-chip{width:30px;height:30px;border:1px solid var(--mb-border);border-radius:8px;background:var(--mb-surface);color:var(--mb-muted);font:inherit;font-size:13px;font-weight:750;cursor:pointer}.mbsf-dx-chip[data-active=true]{border-color:var(--mb-accent);background:color-mix(in srgb,var(--mb-accent) 10%,var(--mb-surface));color:var(--mb-accent)}.mbsf-total{display:flex;justify-content:flex-end;gap:45px;padding:16px 56px 16px 16px;font-size:17px;font-weight:760}
.mbsf-icon-btn{width:40px;height:42px;border:0;background:transparent;color:var(--mb-text);font-size:22px;cursor:pointer}.mbsf-secondary{min-height:40px;padding:8px 14px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);color:var(--mb-text);font:inherit;font-weight:680;cursor:pointer}.mbsf-attach-list{display:grid;gap:10px;margin-bottom:18px}.mbsf-attach-row{padding:14px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius)}.mbsf-attach-row[data-auto=true]{border-color:color-mix(in srgb,#159447 45%,var(--mb-border));background:color-mix(in srgb,#159447 5%,var(--mb-surface))}.mbsf-attach-main{display:flex;align-items:center;gap:12px;min-width:0;flex:1}.mbsf-attach-type{width:min(360px,32vw);flex:0 1 360px}.mbsf-attach-type .mbsf-label{display:block;margin-bottom:6px;font-size:12px}.mbsf-attach-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto}.mbsf-file{min-width:0}.mbsf-file strong{overflow-wrap:anywhere}.mbsf-badge{display:inline-block;margin-left:8px;padding:2px 7px;border:1px solid var(--mb-border);border-radius:7px;color:var(--mb-muted);font-size:12px;font-weight:600}.mbsf-drop{display:grid;width:100%;place-items:center;min-height:210px;padding:30px;border:2px dashed color-mix(in srgb,var(--mb-muted) 55%,transparent);border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-accent) 3%,var(--mb-surface));color:var(--mb-text);font:inherit;text-align:center;cursor:pointer}.mbsf-drop[data-active=true]{border-color:var(--mb-accent);background:color-mix(in srgb,var(--mb-accent) 10%,var(--mb-surface))}.mbsf-alert{padding:12px 14px;border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-danger) 10%,transparent);color:var(--mb-danger)}.mbsf-actions{justify-content:flex-end}.mbsf-submit{min-width:180px;min-height:48px;padding:11px 24px;border:0;border-radius:var(--mb-control-radius);background:var(--mb-accent);color:var(--mb-accent-contrast);font:inherit;font-weight:780;cursor:pointer}
@media(max-width:820px){.mbsf{gap:16px}.mbsf-grid{grid-template-columns:1fr}.mbsf-span{grid-column:auto}.mbsf-card{padding:18px 16px}.mbsf-line-head{display:none}.mbsf-line{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 86px;gap:14px;padding:18px 16px}.mbsf-line>div:before{display:block;margin-bottom:6px;color:var(--mb-muted);font-size:12px;font-weight:700;content:attr(data-label)}.mbsf-line>div:nth-child(1),.mbsf-line>div:nth-child(2),.mbsf-line>div:nth-child(3){grid-column:1/-1}.mbsf-money{align-self:end;padding:0 0 12px;text-align:right}.mbsf-line .mbsf-icon-btn{position:absolute;right:8px;bottom:3px}.mbsf-total{padding:16px 18px;gap:24px}.mbsf-head{align-items:flex-start}.mbsf-segments{grid-template-columns:repeat(3,minmax(0,1fr))}.mbsf-segment{min-width:0;padding:8px 4px;border-right:1px solid var(--mb-border);border-bottom:0;font-size:13px}.mbsf-segment:last-child{border-right:0}.mbsf-payer-option{align-items:flex-start}.mbsf-attach-row{align-items:flex-start;flex-wrap:wrap}.mbsf-attach-main{align-items:flex-start;flex-basis:calc(100% - 150px)}.mbsf-attach-type{width:100%;flex-basis:100%;order:3}.mbsf-attach-actions{margin-left:auto}.mbsf-drop{min-height:190px;padding:24px 18px}.mbsf-actions{position:sticky;bottom:86px;z-index:10}.mbsf-submit{width:100%}}
`;

function RequiredMark(): ReactElement { return <span className="mbsf-star"> *</span>; }
function Field({ label, required, error, invalid, path, span, children }: { label: string; required?: boolean; error?: string | undefined; invalid?: boolean; path?: string; span?: boolean; children: ReactNode }): ReactElement {
  return <label className={`mbsf-field${span ? " mbsf-span" : ""}`} data-field-path={path} data-invalid={Boolean(error) || invalid}><span className="mbsf-label">{label}{required ? <RequiredMark /> : null}</span>{children}{error ? <small className="mbsf-error" role="alert">{error}</small> : null}</label>;
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

type ComboOption = { id: string; label: string; detail?: string; trailing?: string };
function ComboBox({ value, placeholder, options, disabled, loading, loadingMore, invalid, preserveValueOnOpen = false, onOpen, onQuery, onEndReached, onSelect, createOption, ariaLabel }: { value: string; placeholder: string; options: ComboOption[]; disabled: boolean; loading?: boolean; loadingMore?: boolean; invalid?: boolean; preserveValueOnOpen?: boolean; onOpen?: () => void; onQuery?: (query: string) => void; onEndReached?: () => void; onSelect: (option: ComboOption) => void; createOption?: (query: string) => ComboOption | null; ariaLabel: string }): ReactElement {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? options.filter((option) => `${option.id} ${option.label} ${option.detail ?? ""} ${option.trailing ?? ""}`.toLowerCase().includes(q)) : options;
    const custom = createOption?.(query) ?? null;
    return custom && !matches.some((option) => option.id.toUpperCase() === custom.id.toUpperCase()) ? [...matches, custom] : matches;
  }, [createOption, options, query]);
  const showMenu = open && (loading || visible.length > 0 || query.trim().length >= 2);
  return <div className="mbsf-combo"><input className="mbsf-input" role="combobox" aria-label={ariaLabel} aria-invalid={invalid} aria-expanded={showMenu} autoComplete="off" disabled={disabled} placeholder={placeholder} value={open ? query : value} onFocus={() => { const next = preserveValueOnOpen ? value : ""; setOpen(true); setQuery(next); onOpen?.(); if (next) onQuery?.(next); }} onChange={(event) => { setOpen(true); setQuery(event.target.value); onQuery?.(event.target.value); }} onBlur={() => setTimeout(() => setOpen(false), 120)} />{showMenu ? <div className="mbsf-menu" role="listbox" onScroll={(event) => { const menu = event.currentTarget; if (menu.scrollHeight - menu.scrollTop - menu.clientHeight < 120) onEndReached?.(); }}>{loading && !visible.length ? <div className="mbsf-menu-status">Loading…</div> : visible.length ? visible.map((option) => <button className="mbsf-option" type="button" role="option" key={option.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(option); setOpen(false); setQuery(""); }}><span className="mbsf-option-main"><strong>{option.label}</strong>{option.detail ? <small>{option.detail}</small> : null}</span>{option.trailing ? <span className="mbsf-option-route">{option.trailing}</span> : null}</button>) : <div className="mbsf-option">No matches</div>}{loadingMore ? <div className="mbsf-menu-status">Loading more…</div> : null}</div> : null}</div>;
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

export function normalizeClaimsAdministratorName(value: string): string {
  return value.toUpperCase().replace(/\[[^\]]*]/g, " ").replace(/\b(?:INCORPORATED|INC|COMPANY|CO|CORPORATION|CORP|GROUP|INSURANCE|SERVICES)\b/g, " ").replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function exactClaimsAdministratorMatch(results: BillReviewPayer[], suppliedName: string): BillReviewPayer | undefined {
  const normalized = normalizeClaimsAdministratorName(suppliedName);
  return results.find((payer) => normalizeClaimsAdministratorName(payer.name) === normalized)
    ?? results.find((payer) => payer.confidence === "high" && payer.recommended);
}

export function claimsAdministratorRecommendations(results: BillReviewPayer[], limit = 5): BillReviewPayer[] {
  return [...results]
    .sort((left, right) => Number(Boolean(right.recommended)) - Number(Boolean(left.recommended)))
    .slice(0, Math.max(0, limit));
}

/**
 * Form-state claims administrator for a directory pick. When the administrator
 * requires payer selection it carries the payer (subpayor) choices and
 * preselects the directory default; administrators without subpayors stay a
 * plain `{ id, name }` reference.
 */
export function chooseClaimsAdministrator(
  payer: Pick<BillReviewPayer, "id" | "name" | "payerSelectionRequired" | "payers">,
): NonNullable<BillSubmissionInput["claim"]["claimsAdministrator"]> {
  if (!payer.payerSelectionRequired) return { id: payer.id, name: payer.name };
  const payers = (payer.payers ?? []).map((option) => ({ ...option }));
  const preselected = defaultBillReviewPayerOption(payer);
  return {
    id: payer.id,
    name: payer.name,
    payerSelectionRequired: true,
    ...(payers.length ? { payers } : {}),
    ...(preselected ? { payerId: preselected.id } : {}),
  };
}

/**
 * The claims administrator reference exactly as submitted to MindBill: picker
 * metadata (payerSelectionRequired, payers) stays client-side and the chosen
 * payerId rides on the wire only when set.
 */
export function submittedClaimsAdministrator(
  administrator: NonNullable<BillSubmissionInput["claim"]["claimsAdministrator"]>,
): { id: string; name: string; payerId?: string } {
  return {
    id: administrator.id ?? "",
    name: administrator.name,
    ...(administrator.payerId ? { payerId: administrator.payerId } : {}),
  };
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
  fetch: fetchOverride, onSearchClaimsAdministrators, onGetClaimsAdministratorDirectory, claimsAdministratorHint,
  diagnosisOptions = [], onSearchDiagnoses,
  onLookupPostalCode, procedureOptions, modifierOptions, taxonomyOptions, deliveryRoutePicker = "auto", attachmentReportTypeMode = "auto",
  attachmentReportTypes = BILL_SUBMISSION_REPORT_TYPES, defaultAttachmentReportType,
  appearance, className = "bill-submission-form",
  style, disabled = false, submitLabel = "Submit bill", heading = "Bill information",
  description = "Review the bill details, add attachments, and submit.",
  attentionFields = [], attentionMessage,
  children,
}: BillSubmissionFormProps): ReactElement {
  const [bill, setBill] = useState(() => cloneInitialBill(initialBill));
  const [selectedIds, setSelectedIds] = useState(() => attachments.map((item) => item.id));
  const [removedSourceIds, setRemovedSourceIds] = useState<string[]>([]);
  const [uploads, setUploads] = useState<BillSubmissionUpload[]>([]); const [errors, setErrors] = useState<Record<string, string>>({});
  const [sourceAttachmentReportTypes, setSourceAttachmentReportTypes] = useState<Record<string, string>>(() => Object.fromEntries(attachments.flatMap((item) => item.reportTypeCode ? [[item.id, item.reportTypeCode]] : [])));
  const [validationActive, setValidationActive] = useState(false);
  const [formError, setFormError] = useState<string | null>(null); const [submitting, setSubmitting] = useState(false);
  // The delivery-method dialog staged with the validated bill.
  const [routeDialog, setRouteDialog] = useState<{ delivery: BillDeliveryOptions; complete: CompleteBillSubmissionInput } | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [payerResults, setPayerResults] = useState<BillReviewPayer[]>([]); const [payerLoading, setPayerLoading] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [directory, setDirectory] = useState<BillClaimsAdministratorDirectory | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [diagnosisResults, setDiagnosisResults] = useState<BillSubmissionDiagnosisOption[]>([]);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false); const [diagnosisLoadingMore, setDiagnosisLoadingMore] = useState(false);
  const [diagnosisQuery, setDiagnosisQuery] = useState<string | null>(null); const [diagnosisHasMore, setDiagnosisHasMore] = useState(true);
  const [postalStatus, setPostalStatus] = useState<string | null>(null); const [dragActive, setDragActive] = useState(false);
  const formRef = useRef<HTMLFormElement>(null); const fileInput = useRef<HTMLInputElement>(null);
  const diagnosisRequest = useRef(0); const diagnosisAppendPending = useRef(false); const payerRequest = useRef(0);
  const procedures = useMemo(() => mergeOptions(DEFAULT_BILL_SUBMISSION_PROCEDURES, procedureOptions), [procedureOptions]);
  const modifiers = useMemo(() => mergeOptions(DEFAULT_BILL_SUBMISSION_MODIFIERS, modifierOptions), [modifierOptions]);
  const taxonomies = useMemo(() => mergeOptions(DEFAULT_BILL_SUBMISSION_TAXONOMIES, taxonomyOptions), [taxonomyOptions]);
  const [evaluationType, setEvaluationType] = useState<BillSubmissionEvaluationType>(() => initialEvaluationType(initialBill));
  const connected = !onSubmit;
  const referenceClient = useMemo(() => (getSession || sessionEndpoint || connected) ? createBillReferenceClient({ getSession, sessionEndpoint, apiBaseUrl, fetch: fetchOverride }) : null, [getSession, sessionEndpoint, apiBaseUrl, fetchOverride, connected]);
  const submissionClient = useMemo(() => connected ? createBillSubmissionClient({ getSession, sessionEndpoint, apiBaseUrl, fetch: fetchOverride }) : null, [getSession, sessionEndpoint, apiBaseUrl, fetchOverride, connected]);
  const locked = disabled || submitting;
  const showAttachmentReportTypes = attachmentReportTypeMode === "visible" || (attachmentReportTypeMode === "auto" && bill.billingMode !== "med_legal");
  const forcedAttachmentReportType = showAttachmentReportTypes ? undefined : (defaultAttachmentReportType ?? MED_LEGAL_REPORT_TYPE_CODE);
  const reportTypeOptions = useMemo(() => attachmentReportTypes.map((item) => ({ id: item.code, label: item.code.replace(/^OZ:/, ""), detail: item.label })), [attachmentReportTypes]);
  const missingAttachmentReportType = showAttachmentReportTypes && (
    selectedIds.some((id) => !(sourceAttachmentReportTypes[id] || attachments.find((item) => item.id === id)?.reportTypeCode || defaultAttachmentReportType))
    || uploads.some((upload) => !(upload.reportTypeCode || defaultAttachmentReportType))
  );

  useEffect(() => {
    setBill(cloneInitialBill(initialBill)); setEvaluationType(initialEvaluationType(initialBill)); setSelectedIds(attachments.map((item) => item.id));
    setRemovedSourceIds([]); setUploads([]); setSourceAttachmentReportTypes(Object.fromEntries(attachments.flatMap((item) => item.reportTypeCode ? [[item.id, item.reportTypeCode]] : []))); setErrors({}); setValidationActive(false); setFormError(null); setDiagnosisResults([]);
    setDiagnosisQuery(null); setDiagnosisHasMore(true); diagnosisRequest.current += 1; diagnosisAppendPending.current = false;
  }, [initialBill, attachments]);
  useEffect(() => {
    if (!validationActive) return;
    const next = validateBillSubmission(bill).fieldErrors;
    setErrors(missingAttachmentReportType ? { ...next, attachments: "Select a report type for every attachment." } : next);
  }, [bill, missingAttachmentReportType, validationActive]);
  useEffect(() => {
    const root = formRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-field-path]"));
    nodes.forEach((node) => node.removeAttribute("data-attention"));
    for (const requested of attentionFields) {
      const normalized = requested.replace(/\[\]/g, "");
      for (const node of nodes) {
        const actual = node.dataset.fieldPath ?? "";
        if (actual === requested || actual === normalized || actual.startsWith(`${normalized}.`) || normalized.startsWith(`${actual}.`)) {
          node.dataset.attention = "true";
        }
      }
    }
  }, [attentionFields]);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList); if (!files.length) return; setFormError(null);
    const invalid = files.find((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"));
    if (invalid) return setFormError(`${invalid.name} is not a PDF.`);
    const oversized = files.find((file) => file.size > MAX_PDF_BYTES); if (oversized) return setFormError(`${oversized.name} is larger than 25 MB.`);
    const nextBytes = [...uploads.map((item) => item.file), ...files].reduce((sum, file) => sum + file.size, 0);
    if (nextBytes > MAX_UPLOAD_BYTES) return setFormError("Attachments exceed the 100 MB upload limit.");
    if (selectedIds.length + uploads.length + files.length > MAX_DOCUMENTS) return setFormError(`A bill can include at most ${MAX_DOCUMENTS} attachments.`);
    setUploads((current) => [...current, ...files.map((file) => ({ file, documentType: "other" as const, ...(defaultAttachmentReportType ? { reportTypeCode: defaultAttachmentReportType } : {}) }))]);
  }, [defaultAttachmentReportType, selectedIds.length, uploads]);
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
  const text = (value: string | null | undefined, onChange: (value: string) => void, options: Pick<React.InputHTMLAttributes<HTMLInputElement>, "placeholder" | "maxLength" | "type" | "inputMode"> = {}) => <input className="mbsf-input" disabled={locked} value={value ?? ""} onChange={(event) => onChange(event.target.value)} {...options} />;
  const runPayerSearch = useCallback(async (query: string): Promise<void> => {
    const trimmed = query.trim();
    if (trimmed.length < 2) { setPayerResults([]); return; }
    const search = onSearchClaimsAdministrators ?? referenceClient?.searchClaimsAdministrators;
    if (!search) return;
    const request = ++payerRequest.current;
    setPayerLoading(true);
    try {
      const results = await search(trimmed, bill.claim.claimNumber);
      if (request !== payerRequest.current) return;
      setPayerResults(results);
    } catch (caught) {
      if (request === payerRequest.current) setFormError(caught instanceof Error ? caught.message : "Claims administrator search is unavailable.");
    } finally {
      if (request === payerRequest.current) setPayerLoading(false);
    }
  }, [bill.claim.claimNumber, onSearchClaimsAdministrators, referenceClient]);
  const searchPayers = (query: string) => {
    setBill((current) => {
      const selected = current.claim.claimsAdministrator;
      if (selected?.id && selected.name === query) return current;
      return { ...current, claim: { ...current.claim, claimsAdministrator: { name: query } } };
    });
    void runPayerSearch(query);
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
    setEvaluationType(type); setBill((current) => ({ ...current, diagnoses: applyBillSubmissionEvaluationDiagnoses(current.diagnoses, type), renderingProvider: { ...current.renderingProvider, isAme: type === "ame", isQme: type !== "ame", ...(type === "psych_qme" && !current.renderingProvider?.specialty ? { specialty: "Psychiatry" } : {}) }, serviceLines: applyBillSubmissionEvaluationModifiers(current.serviceLines, type) }));
  };
  const lineCharge = (line: BillSubmissionInput["serviceLines"][number]) => calculateBillSubmissionAllowedAmount(line, procedures) ?? (Number.isFinite(line.charge) ? Number(line.charge) : undefined);
  const total = submittedLines(bill.serviceLines).reduce((sum, line) => sum + (lineCharge(line) ?? 0), 0);

  async function submit(): Promise<void> {
    const clean: BillSubmissionInput = { ...cloneBill(bill), serviceLines: submittedLines(bill.serviceLines).map((line) => { const charge = lineCharge(line); return charge == null ? line : { ...line, charge }; }) };
    const validation = validateBillSubmission(clean);
    const fieldErrors = missingAttachmentReportType ? { ...validation.fieldErrors, attachments: "Select a report type for every attachment." } : validation.fieldErrors;
    setValidationActive(true); setErrors(fieldErrors); setFormError(null);
    if (Object.keys(fieldErrors).length) {
      const count = Object.keys(fieldErrors).length;
      const first = Object.values(fieldErrors)[0];
      setFormError(`Fix ${count} highlighted field${count === 1 ? "" : "s"} before submitting. ${first}`);
      window.requestAnimationFrame(() => { if (formRef.current) focusFirstInvalid(formRef.current); });
      return;
    }
    if (selectedIds.length + uploads.length > MAX_DOCUMENTS) return setFormError(`A bill can include at most ${MAX_DOCUMENTS} attachments.`);
    const administrator = clean.claim.claimsAdministrator;
    const complete = {
      ...clean,
      claim: {
        ...clean.claim,
        ...(administrator ? { claimsAdministrator: submittedClaimsAdministrator(administrator) } : {}),
      },
    } as CompleteBillSubmissionInput;
    if (onSubmit) {
      setSubmitting(true);
      try { await onSubmit({ bill: complete, sourceAttachmentIds: selectedIds, sourceAttachmentReportTypes, uploads }); }
      catch (caught) { setFormError(caught instanceof Error ? caught.message : "Unable to submit the bill."); }
      finally { setSubmitting(false); }
      return;
    }
    // Connected mode: show the delivery-method dialog (e-bill / email / fax /
    // mail with recipient overrides) before dispatch. Falls back to direct
    // submission on MindBill's recommended route when the preview is
    // unavailable (older API deployments, missing payers:read permission).
    if (deliveryRoutePicker !== "off" && referenceClient) {
      setSubmitting(true);
      try {
        const delivery = await referenceClient.getDeliveryPreview({
          claimsAdministratorId: complete.claim.claimsAdministrator.id,
          ...(complete.claim.injuryState ? { injuryState: complete.claim.injuryState } : {}),
        });
        setSubmitting(false);
        setRouteError(null);
        setRouteDialog({ delivery, complete });
        return;
      } catch {
        setSubmitting(false);
      }
    }
    await performConnectedSubmit(complete, undefined);
  }

  async function performConnectedSubmit(
    complete: CompleteBillSubmissionInput,
    submission: SendRouteSubmission | undefined,
  ): Promise<void> {
    setSubmitting(true);
    try {
      if (!submissionClient) throw new Error("The connected billing client is unavailable.");
      const documents = await prepareBillSubmissionDocuments({
        attachments,
        selectedIds,
        uploads,
        reportTypeCodeByAttachmentId: sourceAttachmentReportTypes,
        ...(forcedAttachmentReportType ? { defaultReportTypeCode: forcedAttachmentReportType } : {}),
        ...(fetchOverride ? { fetch: fetchOverride } : {}),
      });
      const result = await submissionClient.submitBill({
        bill: complete,
        ...(submission ? { submission } : {}),
        documents,
      });
      setRouteDialog(null);
      setRouteError(null);
      await onSubmitted?.(result);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to submit the bill.";
      if (submission) setRouteError(message); else setFormError(message);
    }
    finally { setSubmitting(false); }
  }

  const claimsAdministratorError = errors["claim.claimsAdministrator"];
  const choosePayer = (payer: Pick<BillReviewPayer, "id" | "name" | "payerSelectionRequired" | "payers">) => setBill((current) => ({ ...current, claim: { ...current.claim, claimsAdministrator: chooseClaimsAdministrator(payer) } }));
  const administrator = bill.claim.claimsAdministrator;
  const subpayorOptions = administrator?.payerSelectionRequired ? administrator.payers ?? [] : [];
  const subpayorError = errors["claim.claimsAdministrator.payerId"];
  const selectedSubpayor = subpayorOptions.find((option) => option.id === administrator?.payerId);
  const chooseSubpayor = (payerId: string) => setBill((current) => current.claim.claimsAdministrator
    ? { ...current, claim: { ...current.claim, claimsAdministrator: { ...current.claim.claimsAdministrator, payerId } } }
    : current);
  const openAdministratorDirectory = async (): Promise<void> => {
    if (!administrator?.id) return;
    setDirectoryOpen(true); setDirectory(null); setDirectoryError(null); setDirectoryLoading(true);
    try {
      const load = onGetClaimsAdministratorDirectory ?? referenceClient?.getClaimsAdministratorDirectory;
      if (!load) throw new Error("Claims administrator details are unavailable.");
      setDirectory(await load(administrator.id, bill.claim.injuryState));
    } catch (caught) {
      setDirectoryError(caught instanceof Error ? caught.message : "Unable to load claims administrator details.");
    } finally {
      setDirectoryLoading(false);
    }
  };

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
      <Field label="Treatment authorization # (optional)">{text(bill.service.authorizationNumber, (authorizationNumber) => setBill((c) => ({ ...c, service: { ...c.service, authorizationNumber } })), { placeholder: "Utilization-review authorization number" })}<small className="mbsf-help">Rides on the bill as CMS-1500 Box 23 / 837 REF*G1.</small></Field>
      <Field path="claim.dateOfInjury" label="Date of injury" required error={errors["claim.dateOfInjury"]}><TextDateInput ariaLabel="Date of injury" value={bill.claim.dateOfInjury} disabled={locked} required onChange={(dateOfInjury) => setBill((c) => ({ ...c, claim: { ...c.claim, dateOfInjury } }))} /></Field>
      <Field path="claim.employer" label="Employer name" required error={errors["claim.employer"]}>{text(bill.claim.employer, (employer) => setBill((c) => ({ ...c, claim: { ...c.claim, employer } })))}</Field>
      <Field path="claim.claimNumber" label="Claim number" required error={errors["claim.claimNumber"]}>{text(bill.claim.claimNumber, (claimNumber) => setBill((c) => ({ ...c, claim: { ...c.claim, claimNumber } })))}</Field>
      <Field label="WCAB / ADJ number (optional)">{text(bill.claim.adjNumber, (adjNumber) => setBill((c) => ({ ...c, claim: { ...c.claim, adjNumber } })))}</Field>
      <Field path="claim.claimsAdministrator" label="Claims administrator" required span error={claimsAdministratorError} invalid={!administrator?.id}>
        <ComboBox ariaLabel="Claims administrator" invalid={Boolean(claimsAdministratorError) || !administrator?.id} disabled={locked} loading={payerLoading} preserveValueOnOpen value={administrator?.name ?? ""} placeholder="Search the claims administrator directory…" options={payerResults.map((payer) => ({ id: payer.id, label: payer.name, detail: [payer.aliases?.length ? `Also known as ${payer.aliases.join(", ")}` : "", payer.claimNumberHint ?? "", payer.affiliatedEntities?.length ? `Affiliated with ${payer.affiliatedEntities.join(", ")}` : ""].filter(Boolean).join(" · ") || "Claims administrator", ...(payer.route ? { trailing: payer.route } : {}) }))} onQuery={searchPayers} onSelect={(option) => choosePayer(payerResults.find((payer) => payer.id === option.id) ?? { id: option.id, name: option.label })} />
        {claimsAdministratorHint ? <small className="mbsf-help">Claims administrator in your system: {claimsAdministratorHint}</small> : null}
        {administrator?.id ? <button className="mbsf-directory-link" type="button" onClick={() => { void openAdministratorDirectory(); }}>View contacts and routing details for {administrator.name}</button> : <small className="mbsf-help">Search the directory and choose a claims administrator.</small>}
      </Field>
      {administrator?.payerSelectionRequired && subpayorOptions.length ? <Field path="claim.claimsAdministrator.payerId" label="Payer" required span error={subpayorError}>
        <ComboBox ariaLabel="Payer" invalid={Boolean(subpayorError)} disabled={locked} preserveValueOnOpen value={selectedSubpayor?.label ?? ""} placeholder="Select the payer for this claims administrator…" options={subpayorOptions.map((option) => { const detail = [option.aliases?.length ? `Also known as ${option.aliases.join(", ")}` : "", option.hint ?? "", option.affiliatedEntities?.length ? `Affiliated with ${option.affiliatedEntities.join(", ")}` : "", option.default ? "Default" : ""].filter(Boolean).join(" · "); return { id: option.id, label: option.label, ...(detail ? { detail } : {}), ...(option.route ? { trailing: option.route } : {}) }; })} onSelect={(option) => chooseSubpayor(option.id)} />
        {selectedSubpayor ? <div className="mbsf-payer-status" role="status"><strong>✓ Payer set:</strong> {selectedSubpayor.label}</div> : <small className="mbsf-help">This claims administrator routes bills per payer. Choose the payer that should receive this bill.</small>}
      </Field> : null}
      <Field label="Injury description (optional)" span>{text(bill.claim.description, (description) => setBill((c) => ({ ...c, claim: { ...c.claim, description } })))}</Field>
      <Field path="diagnoses" label="Diagnosis codes (ICD-10)" required span error={errors.diagnoses}>
        <div className="mbsf-quick-picks" aria-label="Common diagnosis codes">{BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS.map((option) => { const selected = (bill.diagnoses ?? []).includes(option.code); return <button className="mbsf-quick-pick" data-selected={selected} type="button" key={option.code} aria-pressed={selected} title={`${option.code} — ${option.description}`} onClick={() => setBill((current) => ({ ...current, diagnoses: selected ? (current.diagnoses ?? []).filter((code) => code !== option.code) : [...new Set([...(current.diagnoses ?? []), option.code])] }))}>{selected ? "✓" : "+"} {option.label}</button>; })}</div>
        <div className="mbsf-chips">{(bill.diagnoses ?? []).map((code) => { const option = [...BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS, ...diagnosisChoices].find((item) => item.code === code); return <span className="mbsf-chip" key={code}><strong>{code}</strong>{option?.description ? ` ${option.description}` : ""}<button type="button" aria-label={`Remove ${code}`} onClick={() => setBill((c) => ({ ...c, diagnoses: (c.diagnoses ?? []).filter((item) => item !== code) }))}>×</button></span>; })}</div>
        <ComboBox ariaLabel="Add diagnosis code" invalid={Boolean(errors.diagnoses)} disabled={locked} loading={diagnosisLoading} loadingMore={diagnosisLoadingMore} value="" placeholder={(bill.diagnoses?.length ?? 0) ? `${bill.diagnoses!.length} selected — add more…` : "Search ICD-10 codes…"} options={diagnosisChoices.filter((item) => !(bill.diagnoses ?? []).includes(item.code)).map((item) => ({ id: item.code, label: item.code, detail: item.description }))} onOpen={() => { if (diagnosisQuery !== "") loadDiagnoses(""); }} onQuery={searchDiagnoses} onEndReached={() => loadDiagnoses(diagnosisQuery ?? "", true)} onSelect={(option) => setBill((c) => ({ ...c, diagnoses: [...new Set([...(c.diagnoses ?? []), option.id])] }))} />
      </Field>
    </div></fieldset>;

  const providersSection = <fieldset className="mbsf-card" disabled={locked}><legend className="mbsf-legend">Providers &amp; place of service</legend><div className="mbsf-grid">
      <h4 className="mbsf-subhead">Billing provider</h4>
      <Field path="billingProvider.name" label="Billing provider name" required error={errors["billingProvider.name"]}>{text(bill.billingProvider?.name, (name) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, name } })))}</Field>
      <Field path="billingProvider.taxId" label="Tax ID (EIN / SSN)" required error={errors["billingProvider.taxId"]}>{text(bill.billingProvider?.taxId, (taxId) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, taxId } })), { inputMode: "numeric" })}</Field>
      <Field path="billingProvider.npi" label="Billing provider NPI" required error={errors["billingProvider.npi"]}>{text(bill.billingProvider?.npi, (npi) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, npi } })), { inputMode: "numeric", maxLength: 10 })}</Field>
      <Field path="billingProvider.phone" label="Billing provider phone" required error={errors["billingProvider.phone"]}>{text(bill.billingProvider?.phone, (phone) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, phone } })), { type: "tel" })}</Field>
      <Field path="billingProvider.address.line1" label="Billing address line 1" required span error={errors["billingProvider.address.line1"]}>{text(bill.billingProvider?.address?.line1, (line1) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, address: { line1, line2: c.billingProvider?.address?.line2 ?? "", city: c.billingProvider?.address?.city ?? "", state: c.billingProvider?.address?.state ?? "", postalCode: c.billingProvider?.address?.postalCode ?? "" } } })))}</Field>
      <Field label="Billing address line 2 (optional)" span>{text(bill.billingProvider?.address?.line2, (line2) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, address: { line1: c.billingProvider?.address?.line1 ?? "", line2, city: c.billingProvider?.address?.city ?? "", state: c.billingProvider?.address?.state ?? "", postalCode: c.billingProvider?.address?.postalCode ?? "" } } })))}</Field>
      <Field path="billingProvider.address.city" label="Billing city" required error={errors["billingProvider.address.city"]}>{text(bill.billingProvider?.address?.city, (city) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, address: { line1: c.billingProvider?.address?.line1 ?? "", line2: c.billingProvider?.address?.line2 ?? "", city, state: c.billingProvider?.address?.state ?? "", postalCode: c.billingProvider?.address?.postalCode ?? "" } } })))}</Field>
      <Field path="billingProvider.address.state" label="Billing state" required error={errors["billingProvider.address.state"]}>{text(bill.billingProvider?.address?.state, (state) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, address: { line1: c.billingProvider?.address?.line1 ?? "", line2: c.billingProvider?.address?.line2 ?? "", city: c.billingProvider?.address?.city ?? "", state: state.toUpperCase(), postalCode: c.billingProvider?.address?.postalCode ?? "" } } })), { maxLength: 2 })}</Field>
      <Field path="billingProvider.address.postalCode" label="Billing ZIP" required error={errors["billingProvider.address.postalCode"]}>{text(bill.billingProvider?.address?.postalCode, (postalCode) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, address: { line1: c.billingProvider?.address?.line1 ?? "", line2: c.billingProvider?.address?.line2 ?? "", city: c.billingProvider?.address?.city ?? "", state: c.billingProvider?.address?.state ?? "", postalCode } } })))}</Field>
      <h4 className="mbsf-subhead">Rendering provider</h4>
      <Field path="renderingProvider.name" label="Rendering provider name" required error={errors["renderingProvider.name"]}>{text(bill.renderingProvider?.name, (name) => setBill((c) => ({ ...c, renderingProvider: { ...c.renderingProvider, name } })))}</Field>
      <Field path="renderingProvider.npi" label="Rendering provider NPI" required error={errors["renderingProvider.npi"]}>{text(bill.renderingProvider?.npi, (npi) => setBill((c) => ({ ...c, renderingProvider: { ...c.renderingProvider, npi } })), { inputMode: "numeric", maxLength: 10 })}</Field>
      <Field path="renderingProvider.taxonomy" label="Rendering taxonomy" required error={errors["renderingProvider.taxonomy"]}><ComboBox ariaLabel="Rendering taxonomy" invalid={Boolean(errors["renderingProvider.taxonomy"])} disabled={locked} preserveValueOnOpen value={bill.renderingProvider?.taxonomy ?? ""} placeholder="Search specialty name or taxonomy code…" options={taxonomies.map((item) => ({ id: item.code, label: item.description, detail: item.code }))} createOption={(query) => { const code = query.trim().toUpperCase(); return /^[A-Z0-9]{10}$/.test(code) ? { id: code, label: code, detail: "Use this taxonomy code" } : null; }} onSelect={(option) => setBill((c) => ({ ...c, renderingProvider: { ...c.renderingProvider, taxonomy: option.id } }))} /><small className="mbsf-help">Search by specialty name or 10-character taxonomy code.</small></Field>
      <h4 className="mbsf-subhead">Service facility</h4>
      <Field path="serviceLocation.placeOfServiceCode" label="Place of service code" required error={errors["serviceLocation.placeOfServiceCode"]}>{text(bill.serviceLocation?.placeOfServiceCode, (placeOfServiceCode) => setBill((c) => ({ ...c, serviceLocation: { ...c.serviceLocation, placeOfServiceCode } })), { inputMode: "numeric", maxLength: 2, placeholder: "11" })}</Field>
      <Field path="serviceLocation.address.line1" label="Service address line 1" required span error={errors["serviceLocation.address.line1"]}>{text(bill.serviceLocation?.address?.line1, (line1) => setBill((c) => ({ ...c, serviceLocation: { ...c.serviceLocation, address: { line1, line2: c.serviceLocation?.address?.line2 ?? "", city: c.serviceLocation?.address?.city ?? "", state: c.serviceLocation?.address?.state ?? "", postalCode: c.serviceLocation?.address?.postalCode ?? "" } } })))}</Field>
      <Field label="Service address line 2 (optional)" span>{text(bill.serviceLocation?.address?.line2, (line2) => setBill((c) => ({ ...c, serviceLocation: { ...c.serviceLocation, address: { line1: c.serviceLocation?.address?.line1 ?? "", line2, city: c.serviceLocation?.address?.city ?? "", state: c.serviceLocation?.address?.state ?? "", postalCode: c.serviceLocation?.address?.postalCode ?? "" } } })))}</Field>
      <Field path="serviceLocation.address.city" label="Service city" required error={errors["serviceLocation.address.city"]}>{text(bill.serviceLocation?.address?.city, (city) => setBill((c) => ({ ...c, serviceLocation: { ...c.serviceLocation, address: { line1: c.serviceLocation?.address?.line1 ?? "", line2: c.serviceLocation?.address?.line2 ?? "", city, state: c.serviceLocation?.address?.state ?? "", postalCode: c.serviceLocation?.address?.postalCode ?? "" } } })))}</Field>
      <Field path="serviceLocation.address.state" label="Service state" required error={errors["serviceLocation.address.state"]}>{text(bill.serviceLocation?.address?.state, (state) => setBill((c) => ({ ...c, serviceLocation: { ...c.serviceLocation, address: { line1: c.serviceLocation?.address?.line1 ?? "", line2: c.serviceLocation?.address?.line2 ?? "", city: c.serviceLocation?.address?.city ?? "", state: state.toUpperCase(), postalCode: c.serviceLocation?.address?.postalCode ?? "" } } })), { maxLength: 2 })}</Field>
      <Field path="serviceLocation.address.postalCode" label="Service ZIP" required error={errors["serviceLocation.address.postalCode"]}>{text(bill.serviceLocation?.address?.postalCode, (postalCode) => setBill((c) => ({ ...c, serviceLocation: { ...c.serviceLocation, address: { line1: c.serviceLocation?.address?.line1 ?? "", line2: c.serviceLocation?.address?.line2 ?? "", city: c.serviceLocation?.address?.city ?? "", state: c.serviceLocation?.address?.state ?? "", postalCode } } })))}</Field>
    </div></fieldset>;

  const serviceLinesSection = <fieldset className="mbsf-card" disabled={locked}><legend className="mbsf-legend">Evaluation &amp; service lines</legend>
      <p className="mbsf-help">Sets the evaluator/specialty modifier on medical-legal evaluation lines.</p>
      <div className="mbsf-segments" role="group" aria-label="Evaluation type">{([ ["qme", "QME (default)"], ["ame", "AME"], ["psych_qme", "Psych QME"] ] as const).map(([type, label]) => <button className="mbsf-segment" type="button" key={type} aria-pressed={evaluationType === type} onClick={() => changeEvaluation(type)}>{label}</button>)}</div>
      <p className="mbsf-help">{evaluationType === "ame" ? "Agreed Medical Evaluator — eligible ML evaluation codes default to modifier -94." : evaluationType === "psych_qme" ? "Psychiatric QME — eligible ML evaluation codes default to modifier -96 (-95 for ML200)." : "Qualified Medical Evaluator — eligible ML evaluation codes default to modifier -95."}</p>
      <div className="mbsf-lines" data-field-path="serviceLines" data-invalid={Boolean(errors.serviceLines)}><div className="mbsf-line-head"><span>Procedure code<RequiredMark /></span><span>Modifiers</span><span>Dx</span><span>Units<RequiredMark /></span><span>Allowed</span><span /> </div>
        {bill.serviceLines.map((line, index) => <div className="mbsf-line" key={index}>
          <div data-label="Procedure code" data-field-path={`serviceLines.${index}.code`} data-invalid={Boolean(errors[`serviceLines.${index}.code`])}><ComboBox ariaLabel={`Procedure code ${index + 1}`} invalid={Boolean(errors[`serviceLines.${index}.code`])} disabled={locked} value={line.code} placeholder="Search or enter code…" options={procedures.map((item) => ({ id: item.code, label: item.code, detail: item.description }))} createOption={customProcedureOption} onSelect={(option) => { const auto = evaluationModifier(evaluationType, option.id); setLine(index, { code: option.id, ...(auto ? { modifiers: [auto, ...(line.modifiers ?? []).filter((item) => !["94", "95", "96"].includes(item.replace(/^-/, "")))] } : line.modifiers ? { modifiers: line.modifiers } : {}) }); }} />{line.code ? <small className="mbsf-help">{procedures.find((item) => item.code === line.code)?.description ?? "Custom CPT, HCPCS, or medical-legal code"}</small> : null}{errors[`serviceLines.${index}.code`] ? <small className="mbsf-error" role="alert">{errors[`serviceLines.${index}.code`]}</small> : null}</div>
          <div data-label="Modifiers"><div className="mbsf-chips">{(line.modifiers ?? []).map((modifier) => <span className="mbsf-chip" key={modifier}>−{modifier.replace(/^-/, "")}<button type="button" aria-label={`Remove modifier ${modifier}`} onClick={() => setLine(index, { modifiers: (line.modifiers ?? []).filter((item) => item !== modifier) })}>×</button></span>)}</div><ComboBox ariaLabel={`Modifiers ${index + 1}`} disabled={locked} value="" placeholder={(line.modifiers?.length ?? 0) ? `${line.modifiers!.length} modifier${line.modifiers!.length === 1 ? "" : "s"}` : "Add modifiers…"} options={modifiers.filter((item) => !(line.modifiers ?? []).includes(item.code)).map((item) => ({ id: item.code, label: `−${item.code}`, detail: item.description }))} onSelect={(option) => setLine(index, { modifiers: [...new Set([...(line.modifiers ?? []), option.id])] })} /></div>
          <div data-label="Dx"><div className="mbsf-dx">{(bill.diagnoses ?? []).length ? (bill.diagnoses ?? []).map((code, dxIndex) => { const pointer = dxIndex + 1; const active = (line.diagnosisPointers ?? []).includes(pointer); return <button type="button" key={code} className="mbsf-dx-chip" data-active={active} title={`${String.fromCharCode(64 + pointer)} — ${code}`} aria-pressed={active} aria-label={`Point line ${index + 1} at diagnosis ${code}`} onClick={() => setLine(index, { diagnosisPointers: active ? (line.diagnosisPointers ?? []).filter((item) => item !== pointer) : [...(line.diagnosisPointers ?? []), pointer].sort((left, right) => left - right) })}>{String.fromCharCode(64 + pointer)}</button>; }) : <small className="mbsf-help">Add diagnoses above</small>}</div></div>
          <div data-label="Units" data-field-path={`serviceLines.${index}.units`} data-invalid={Boolean(errors[`serviceLines.${index}.units`])}><input className="mbsf-input" aria-label={`Units ${index + 1}`} aria-invalid={Boolean(errors[`serviceLines.${index}.units`])} type="number" min={1} value={line.units ?? 1} onChange={(event) => setLine(index, { units: Number(event.target.value) })} />{errors[`serviceLines.${index}.units`] ? <small className="mbsf-error" role="alert">{errors[`serviceLines.${index}.units`]}</small> : null}</div>
          <div className="mbsf-money" data-label="Allowed">{lineCharge(line) == null ? "—" : lineCharge(line)!.toLocaleString(undefined, { style: "currency", currency: "USD" })}</div>
          <button className="mbsf-icon-btn" type="button" aria-label={`Remove service line ${index + 1}`} disabled={locked || (!lineHasContent(line) && index === bill.serviceLines.length - 1)} onClick={() => setBill((c) => ({ ...c, serviceLines: ensureTrailingBillSubmissionLine(c.serviceLines.filter((_, itemIndex) => itemIndex !== index)) }))}>×</button>
        </div>)}
        <div className="mbsf-total"><span>Total</span><span>{total.toLocaleString(undefined, { style: "currency", currency: "USD" })}</span></div>
      </div>{errors.serviceLines ? <p className="mbsf-error" role="alert">{errors.serviceLines}</p> : null}
    </fieldset>;

  const attachmentsSection = <fieldset className="mbsf-card" data-field-path="attachments" data-invalid={Boolean(errors.attachments)} disabled={locked}><legend className="mbsf-legend">Attachments</legend><div className="mbsf-attach-list">
      {attachments.filter((attachment) => !removedSourceIds.includes(attachment.id)).map((attachment) => { const auto = attachment.autoAttached || attachment.documentType === "w9"; const removable = !auto && attachment.removable !== false; const reportTypeCode = sourceAttachmentReportTypes[attachment.id] || attachment.reportTypeCode || defaultAttachmentReportType || ""; return <div className="mbsf-attach-row" data-auto={auto} key={attachment.id}><div className="mbsf-attach-main">{auto ? <span aria-label="Always attached" role="img">✓</span> : null}<span className="mbsf-file"><strong>{attachment.fileName}</strong><span className="mbsf-badge">{auto ? "Auto-attached" : documentLabels[attachment.documentType]}</span><span className="mbsf-help" style={{ display: "block" }}>{attachment.description || (auto ? "Included automatically with every bill." : documentLabels[attachment.documentType])}</span></span></div>{showAttachmentReportTypes ? <div className="mbsf-attach-type"><ComboBox ariaLabel={`Report type for ${attachment.fileName}`} invalid={!reportTypeCode} disabled={locked} preserveValueOnOpen value={reportTypeCode} placeholder="Select report type…" options={reportTypeOptions} onSelect={(option) => setSourceAttachmentReportTypes((current) => ({ ...current, [attachment.id]: option.id }))} /></div> : null}<div className="mbsf-attach-actions">{attachment.previewUrl ? <a className="mbsf-secondary" href={attachment.previewUrl} target="_blank" rel="noopener noreferrer">Preview</a> : null}{removable ? <button className="mbsf-icon-btn" type="button" aria-label={`Remove ${attachment.fileName}`} disabled={locked} onClick={() => { setSelectedIds((current) => current.filter((id) => id !== attachment.id)); setRemovedSourceIds((current) => [...new Set([...current, attachment.id])]); }}>×</button> : null}</div></div>; })}
      {uploads.map((upload, index) => { const reportTypeCode = upload.reportTypeCode || defaultAttachmentReportType || ""; return <div className="mbsf-attach-row" key={`${upload.file.name}-${index}`}><div className="mbsf-attach-main"><span className="mbsf-file"><strong>{upload.file.name}</strong><span className="mbsf-help" style={{ display: "block" }}>{(upload.file.size / 1024 / 1024).toFixed(1)} MB</span></span></div>{showAttachmentReportTypes ? <div className="mbsf-attach-type"><ComboBox ariaLabel={`Report type for ${upload.file.name}`} invalid={!reportTypeCode} disabled={locked} preserveValueOnOpen value={reportTypeCode} placeholder="Select report type…" options={reportTypeOptions} onSelect={(option) => setUploads((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reportTypeCode: option.id } : item))} /></div> : null}<div className="mbsf-attach-actions"><button className="mbsf-secondary" type="button" onClick={() => previewUploadedPdf(upload.file)}>Preview</button><button className="mbsf-icon-btn" type="button" aria-label={`Remove ${upload.file.name}`} onClick={() => setUploads((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></div></div>; })}
    </div>{errors.attachments ? <p className="mbsf-error" role="alert">{errors.attachments}</p> : null}<input ref={fileInput} hidden type="file" accept="application/pdf,.pdf" multiple onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} /><button className="mbsf-drop" data-active={dragActive} type="button" onClick={() => fileInput.current?.click()}><span><strong style={{ fontSize: 18 }}>Drop additional PDF files here, or click to choose</strong><span className="mbsf-help" style={{ display: "block", marginTop: 8 }}>Add supporting documents anywhere on this screen.</span></span></button></fieldset>;

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
      {attentionMessage ? <div className="mbsf-attention" role="status">{attentionMessage}</div> : null}
      {children ?? defaultLayout}
      {routeDialog ? (
        <SendRouteDialog
          title="Send bill"
          delivery={routeDialog.delivery}
          submitting={submitting}
          error={routeError}
          onCancel={() => { if (!submitting) { setRouteDialog(null); setRouteError(null); } }}
          onConfirm={(submission) => { void performConnectedSubmit(routeDialog.complete, submission); }}
        />
      ) : null}
    </form>
    <ClaimsAdministratorDirectoryDialog
      open={directoryOpen}
      directory={directory}
      loading={directoryLoading}
      error={directoryError}
      onClose={() => {
        setDirectoryOpen(false);
        setDirectory(null);
        setDirectoryError(null);
      }}
    />
  </BillSubmissionSectionsContext.Provider>;
}
