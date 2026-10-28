"use client";

import { MedicalProviderNetworkSelect } from "./medical-provider-network-select";
import type { MedicalProviderNetwork } from "@mindbill/browser";

import { TherapyLineFields, therapyDetailsFromSaved, therapyCalculationContext, missingTherapyDetails, isTherapyEditorCode, isInitialPtEvaluationCode, type TherapyDetails } from "./therapy-line-fields";

import { feeReviewMessage } from "./fee-review-message";

import { AnesthesiaCalculationDetails } from "./anesthesia-calculation-details";
import { FeeCalculationDetails } from "./fee-calculation-details";

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { createContext, Fragment, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  createOrganizationClient,
  type OrganizationClientOptions,
  type OrganizationProfileData,
  createBillReferenceClient,
  createBillSubmissionClient,
  type BillDeliveryOptions,
  type BillFeeQuote,
  type BilledDrug,
  type ClaimForm,
  type BillFormData,
  type BillLineFormData,
  type BillFeeContext,
  type BillFeeQuoteInput,
  type BillProcedureCodeSearchInput,
  type BillProcedureCodePage,
  type BillClaimsAdministratorSource,
  type BillClaimsAdministratorDirectory,
  type BrowserBillSubmissionDocument,
  type BrowserBillSubmissionResult,
  type BillLifecycleSessionProvider,
  type BillReviewPayer,
  type BillReviewPayerListInput,
  type BillReviewPayerOption,
  type BillReviewPayerPage,
  type BillReviewPayerSuggestion,
  type MindBillAnalyticsEvent,
} from "@mindbill/browser";
import { useMindBillAnalytics } from "./analytics";

import { isProfessionalComponentCandidate, professionalComponentCalculationContext, type ProfessionalComponentDetails } from "./professional-component-context";
import { AnesthesiaLineFields, anesthesiaDetailsFromSaved, anesthesiaCalculationContext, isAnesthesiaCandidate, type AnesthesiaDetails } from "./bill-anesthesia-context";
import { DrugLineFields, drugClaimFactsProblem, drugDetailsFromSaved, drugFieldsEnabled, drugRequestDetails, type DrugDetails } from "./bill-drug-context";
import { equipmentCalculationContext, equipmentFields, type EquipmentDetails } from "./bill-equipment-context";
import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";
import { analyticsErrorCode, ReportAutofill } from "./report-autofill";
import { applyReportAutofill, reportAutofillInsuranceCarrier } from "./report-autofill-values";
import { BillingSettings, organizationOnboardingCss } from "./organization-onboarding";
import { BillDoctorQuickAdd } from "./bill-doctor-quick-add";
import { ProviderSignature, renderingProvidersCss } from "./rendering-providers-settings";
import { SendRouteDialog, type SendRouteSubmission } from "./send-route-dialog";
import { ClaimsAdministratorDirectoryDialog } from "./claims-administrator-directory-dialog";
import { billSubmissionProfileSummary, matchingBillSubmissionProfileOption, organizationProfileOptions, type BillSubmissionProfileOptions, type BillSubmissionProfileSection } from "./billing-profile-options";
import {
  BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS,
  calculateBillSubmissionAllowedAmount,
  billSubmissionModifierOptions,
  medicalLegalModifierApplies,
  DEFAULT_BILL_SUBMISSION_PROCEDURES,
  DEFAULT_BILL_SUBMISSION_TAXONOMIES,
} from "./billing-catalog";
import { DateField, Select, Checkbox } from "./form-controls";

export const BILL_SUBMISSION_DOCUMENT_TYPES = [
  "final_report", "proof_of_service", "letter_of_attestation", "form_122",
  "return_to_work_voucher", "w9", "medical_records", "appeal", "other",
] as const;

export type BillSubmissionDocumentType = (typeof BILL_SUBMISSION_DOCUMENT_TYPES)[number];
export type BillSubmissionAttachmentReportTypeMode = "auto" | "hidden" | "visible";
export type BillSubmissionReportTypeOption = { code: string; label: string };
export const MED_LEGAL_REPORT_TYPE_CODE = "OZ:J4";
/** PWK report type for a PR-2 progress report: the default supporting report on treatment bills. */
export const TREATMENT_PROGRESS_REPORT_TYPE_CODE = "09";
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
const BILL_SUBMISSION_REPORT_TYPE_CODES = new Set(BILL_SUBMISSION_REPORT_TYPES.map(({ code }) => code));

/** Normalize a supported report-type code and reject labels or unknown values. */
export function normalizeBillSubmissionReportTypeCode(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (BILL_SUBMISSION_REPORT_TYPE_CODES.has(normalized)) return normalized;
  throw new Error(
    `Unsupported attachment report type code ${JSON.stringify(value)}. Use a code from BILL_SUBMISSION_REPORT_TYPES, not its display label.`,
  );
}
export type BillSubmissionEvaluationType = "qme" | "ame" | "psych_qme" | "psych_ame";
export type BillSubmissionAddress = { line1: string; line2?: string; city: string; state: string; postalCode: string };
export type BillSubmissionDiagnosisOption = { code: string; description: string };
export type BillSubmissionProcedureOption = {
  code: string; description: string; allowedAmount?: number;
  /** Units a line starts with when this code is chosen, for services with a customary or minimum quantity. */
  defaultUnits?: number;
};
export type BillSubmissionModifierOption = { code: string; description: string };
export type BillSubmissionTaxonomyOption = { code: string; description: string };
export type BillSubmissionPostalPlace = { city: string; state: string };

export type BillSubmissionInput = {
  claimForm?: ClaimForm;
  formData?: BillFormData;
  externalId?: string;
  billingMode?: "med_legal" | "professional";
  patient: {
    id?: string; externalId?: string; firstName: string; middleName?: string; lastName: string;
    dateOfBirth: string; ssn?: string; gender?: "M" | "F" | "X"; phone?: string;
    address: BillSubmissionAddress;
  };
  claim: {
    id?: string; externalId?: string; claimNumber: string; adjNumber?: string; medicalProviderNetworkId?: string | null; employer?: string;
    /**
     * The date of injury. For a cumulative trauma (CT) claim (`injuryType: "cumulative"`) this is the START of the
     * injury period and `injuryEndDate` is its end; the bill's date of injury (CMS-1500 Box 14) uses the end date.
     */
    dateOfInjury?: string; injuryState?: string; description?: string;
    /** "cumulative" for a cumulative trauma (CT) claim. Omitted or "specific" for a single-date injury. */
    injuryType?: "specific" | "cumulative";
    /** End of a cumulative trauma (CT) injury period. Sent only for `injuryType: "cumulative"`. */
    injuryEndDate?: string | null;
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
    /** Saved MindBill billing provider identity used for contracted fee schedules. */
    id?: string;
    name?: string; taxId?: string; npi?: string; phone?: string; address?: BillSubmissionAddress;
    taxIdType?: "EIN" | "SSN"; savedProviderId?: string; sourceBillId?: string; taxIdLast4?: string;
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
    /** Context used for the displayed fee, revalidated when submitting. */
    feeContext?: BillFeeContext;
    drug?: BilledDrug;
    formData?: BillLineFormData;
    /** Authorized RFA item associated with this procedure. Cleared when its code changes. */
    rfaItemId?: string;
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
    id?: string; name: string; taxId: string; taxIdType?: "EIN" | "SSN"; npi: string; phone: string; address: BillSubmissionAddress;
  } | { savedProviderId: string } | { sourceBillId: string };
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
  /** Marks a document that the host selected by default. This does not imply that it is locked. */
  autoAttached?: boolean;
  /** Controls whether the user can remove the document from this submission packet. Defaults to false for auto-attached documents and true otherwise. */
  removable?: boolean;
  previewUrl?: string;
  /** Authenticated source loader used when the document is not available at a public URL. */
  loadBlob?: () => Promise<Blob>;
  reportTypeCode?: string;
};
export type BillSubmissionUpload = { file: File; documentType: BillSubmissionDocumentType; description?: string; reportTypeCode?: string };
export type BillSubmissionFormValue = {
  bill: CompleteBillSubmissionInput;
  /** Delivery route explicitly confirmed by the biller, when the route picker is enabled. */
  submission?: SendRouteSubmission;
  sourceAttachmentIds: string[];
  sourceAttachmentReportTypes: Record<string, string>;
  uploads: BillSubmissionUpload[];
};

export type BillSubmissionFeeContext = BillFeeContext;

type FeeDetails = TherapyDetails & EquipmentDetails & ProfessionalComponentDetails & DrugDetails & AnesthesiaDetails & {
  providerKind?: NonNullable<BillFeeQuoteInput["physicianContext"]>["providerKind"] | "physical_therapist" | "" | undefined;
  basis?: "standard" | "adjustment";
  minutes?: number | undefined;
  totalMinutes?: number | undefined;
  relatedEvaluationDate?: string | undefined;
  prolongedTimeBasis?: "documented" | "review" | "" | undefined;
};
const isProlongedCode = (code: string) => /^9935[89]$/.test(code.trim());

/**
 * Provider type implied by the rendering provider's NUCC taxonomy. Physicians follow Labor Code § 3209.3
 * (including psychologists, chiropractors, podiatrists, optometrists, dentists and acupuncturists).
 */
export function billSubmissionProviderKindForTaxonomy(taxonomy: string | undefined): NonNullable<BillFeeQuoteInput["physicianContext"]>["providerKind"] | undefined {
  const code = taxonomy?.trim().toUpperCase() ?? "";
  if (!/^[A-Z0-9]{10}$/.test(code)) return undefined;
  if (/^(20|103[GT]|111N|213E|152W|1223|1711)/.test(code)) return "physician";
  if (code.startsWith("363A")) return "physician_assistant";
  if (code.startsWith("363L")) return "nurse_practitioner";
  if (code.startsWith("364S")) return "clinical_nurse_specialist";
  return undefined;
}

const PROVIDER_KIND_LABELS: Record<Exclude<NonNullable<FeeDetails["providerKind"]>, "">, string> = {
  physician: "Physician", physician_assistant: "Physician assistant", nurse_practitioner: "Nurse practitioner",
  clinical_nurse_specialist: "Clinical nurse specialist", physical_therapist: "Physical therapist", other: "Other",
};

/** Standard estimate assumptions; prolonged-service facts require an explicit documentation selection. */
export function billSubmissionEstimateContext(code: string, placeOfService: string, details: FeeDetails = {}): BillSubmissionFeeContext {
  if (details.basis === "adjustment") return {};
  if (!isTherapyEditorCode(code) && /^[A-Z0-9]{5}$/.test(code) && !/^ML/.test(code) && details.providerKind && details.providerKind !== "physical_therapist") return {
    hasFeeAgreement: false, physicianContext: { providerKind: details.providerKind, placeOfService, incidentToPhysicianService: false, standaloneService: true, globalPeriodApplies: false, hpsaBonusEligible: false },
    ...(isProlongedCode(code) && details.prolongedTimeBasis === "documented" && details.totalMinutes && parseBillSubmissionDate(details.relatedEvaluationDate ?? "") ? {
      prolongedServiceContext: {
        totalMinutes: details.totalMinutes, relatedEvaluationDate: parseBillSubmissionDate(details.relatedEvaluationDate!)!,
        ongoingPatientManagement: true, personallyPerformed: true, timeCountedInOtherServices: false,
        completeSameDayServices: true, sameDayServices: [],
      },
    } : {}),
  };
  if (isTherapyEditorCode(code)) return therapyCalculationContext(placeOfService, details, {}, code);
  return {};
}
type LineAttestation = { code: string; reasons: string[]; confirmed: boolean };
const ATTESTABLE_REASONS = new Set(["code_specific_coding_requirements_not_confirmed", "complete_surgical_package_required"]);

/** Reads "Service line N: reason" from a refused submission when the biller can confirm the missing fact. */
export function attestationRequest(message: string, lines: BillSubmissionInput["serviceLines"]): { index: number; position: number; code: string; reason: string } | null {
  const match = /Service line (\d+): ([a-z_]+)/.exec(message);
  if (!match || !ATTESTABLE_REASONS.has(match[2]!)) return null;
  const position = Number(match[1]);
  const index = lines.map((line, itemIndex) => lineHasContent(line) ? itemIndex : -1).filter((itemIndex) => itemIndex >= 0)[position - 1];
  if (index == null) return null;
  return { index, position, code: lines[index]!.code.trim().toUpperCase(), reason: match[2]! };
}

export function lineAttestationText(attestation: { code: string; reasons: readonly string[] }): string {
  const surgical = attestation.reasons.includes("complete_surgical_package_required");
  return `I confirm the documentation meets the coding requirements for ${attestation.code}${surgical ? ", and the complete procedure, including its global surgical package, was performed" : ""}.`;
}

/** The standard professional context plus the confirmed catalog facts for one line. */
export function attestedFeeContext(estimate: BillFeeContext, attestation: { reasons: readonly string[] }, standaloneService: boolean): BillFeeContext {
  const physician = (estimate as { physicianContext?: Record<string, unknown> }).physicianContext;
  return {
    ...estimate,
    hasFeeAgreement: false,
    ...(physician ? { physicianContext: { ...physician, standaloneService } } : {}),
    catalogContext: {
      ...((estimate as { catalogContext?: Record<string, unknown> }).catalogContext ?? {}),
      codingRequirementsSatisfied: true,
      ...(attestation.reasons.includes("complete_surgical_package_required") ? { completeSurgicalPackage: true } : {}),
    },
  } as BillFeeContext;
}

/**
 * True when a line's fee context only restates the standard estimate (no fee agreement, physician
 * assumptions) and carries no specialty or catalog facts entered by the biller.
 */
export function isEstimateOnlyFeeContext(context: BillFeeContext | undefined): boolean {
  if (!context) return true;
  return Object.entries(context).every(([key, value]) => value === undefined
    || (key === "hasFeeAgreement" && value === false)
    || key === "physicianContext");
}
/** Rebuild edited fields so clearing an input cannot retain a previously priced context. */
export function billSubmissionCalculationContext(code: string, placeOfService: string, details: FeeDetails, saved: BillFeeContext = {}, modifiers: readonly string[] = []): BillFeeContext {
  if (details.basis === "adjustment") return {};
  if (isAnesthesiaCandidate(code)) return anesthesiaCalculationContext(placeOfService, details);
  if (isTherapyEditorCode(code)) return therapyCalculationContext(placeOfService, details, saved, code);
  const equipment = equipmentFields(code, modifiers);
  if (equipment.residence) return equipmentCalculationContext(code, modifiers, details);
  if (drugFieldsEnabled(code, details)) {
    const { padbContext } = drugRequestDetails(code, placeOfService, details);
    return padbContext ? { padbContext } : {};
  }
  const estimated = billSubmissionEstimateContext(code, placeOfService, details);
  const context = { ...estimated, ...saved };
  delete context.physicianContext;
  delete context.therapyContext;
  delete context.prolongedServiceContext;
  delete context.dmeposContext;
  delete context.padbContext;
  delete context.anesthesiaContext;
  if (estimated.physicianContext) context.physicianContext = {
    ...estimated.physicianContext, ...saved.physicianContext,
    providerKind: estimated.physicianContext.providerKind, placeOfService,
  };
  if (estimated.prolongedServiceContext) context.prolongedServiceContext = estimated.prolongedServiceContext;
  return context;
}

const isMedicalLegalCode = (code: string) => /^ML/i.test(code.trim());
/**
 * A bill with a medical-legal procedure is a medical-legal bill. The diagnostic
 * tests performed for that evaluation are billed on it at treatment fee schedule
 * rates (8 CCR §9794(a)(1)).
 */
const billingModeForLines = (lines: readonly { code: string }[]) => lines.some((line) => isMedicalLegalCode(line.code)) ? "med_legal" as const : "professional" as const;

/** Context and service changes produce a different quote request; amounts are never reused across requests. */
export function billSubmissionFeeRequest(bill: BillSubmissionInput, line: BillSubmissionInput["serviceLines"][number], context: BillSubmissionFeeContext = line.feeContext ?? {}): BillFeeQuoteInput {
  const dateOfService = parseBillSubmissionDate(line.serviceDate ?? bill.service.date) ?? "";
  const sameDayServices = bill.serviceLines.filter((candidate) => candidate.code.trim() && parseBillSubmissionDate(candidate.serviceDate ?? bill.service.date) === dateOfService);
  const padbSameDayServices = bill.serviceLines.filter((candidate) => {
    if (!candidate.code.trim()) return false;
    const start = parseBillSubmissionDate(candidate.serviceDate ?? bill.service.date);
    const end = candidate.serviceDateEnd ? parseBillSubmissionDate(candidate.serviceDateEnd) : start;
    return !start || !end || (start <= dateOfService && dateOfService <= end);
  });
  const otherSameDayServices = Boolean(dateOfService) && sameDayServices.length > 1;
  const billingProviderId = bill.billingProvider?.savedProviderId ?? bill.billingProvider?.id;
  const payerId = bill.claim.claimsAdministrator?.id;
  return {
    ...billSubmissionQuoteContext(context as BillFeeQuoteInput),
    ...(otherSameDayServices && context.physicianContext ? { physicianContext: { ...context.physicianContext, standaloneService: false } } : {}),
    ...((padbSameDayServices.length !== 1 || Boolean(line.serviceDateEnd && parseBillSubmissionDate(line.serviceDateEnd) !== dateOfService)) && context.therapyContext ? { therapyContext: { ...context.therapyContext, otherSameDayServices: true } } : {}),
    ...(context.prolongedServiceContext ? { prolongedServiceContext: { ...context.prolongedServiceContext, sameDayServices: sameDayServices.map((candidate) => ({ code: candidate.code.trim().toUpperCase(), units: candidate.units ?? 1 })) } } : {}),
    ...(context.anesthesiaContext ? { anesthesiaContext: { ...context.anesthesiaContext, placeOfService: bill.serviceLocation?.placeOfServiceCode ?? "", otherSameDayServices: padbSameDayServices.length !== 1 || Boolean(line.serviceDateEnd && parseBillSubmissionDate(line.serviceDateEnd) !== dateOfService) } } : {}),
    ...(line.drug ? { drug: line.drug } : {}),
    ...(context.padbContext ? { padbContext: { ...context.padbContext, sameDayServices: padbSameDayServices.map((candidate) => ({ code: candidate.code.trim().toUpperCase(), units: candidate.units ?? 1 })) } } : {}),
    ...(billingProviderId ? { billingProviderId } : {}), ...(payerId ? { payerId } : {}),
    code: line.code.trim().toUpperCase(), dateOfService, units: line.units ?? 1, modifiers: line.modifiers ?? [], serviceZip: bill.serviceLocation?.address?.postalCode ?? "",
  };
}

/** Keep only calculation context; the server derives identities and service fields from the bill. */
export function billSubmissionQuoteContext(input: BillFeeQuoteInput): BillFeeContext {
  return {
    ...(input.pages !== undefined ? { pages: input.pages } : {}),
    ...(input.reportKind !== undefined ? { reportKind: input.reportKind } : {}),
    ...(input.hasFeeAgreement !== undefined ? { hasFeeAgreement: input.hasFeeAgreement } : {}),
    ...(input.physicianContext ? { physicianContext: input.physicianContext } : {}),
    ...(input.therapyContext ? { therapyContext: input.therapyContext } : {}),
    ...(input.reportQualification ? { reportQualification: input.reportQualification } : {}),
    ...(input.professionalComponentContext ? { professionalComponentContext: input.professionalComponentContext } : {}),
    ...(input.technicalComponentContext ? { technicalComponentContext: input.technicalComponentContext } : {}),
    ...(input.padbContext ? { padbContext: input.padbContext } : {}),
    ...(input.anesthesiaContext ? { anesthesiaContext: input.anesthesiaContext } : {}),
    ...(input.dmeposContext ? { dmeposContext: input.dmeposContext } : {}),
    ...(input.catalogContext ? { catalogContext: input.catalogContext } : {}),
    ...(input.prolongedServiceContext ? { prolongedServiceContext: input.prolongedServiceContext } : {}),
  };
}

export type BillSubmissionFormProps = {
  initialBill: BillSubmissionInput;
  /** Persist one host-generated key per logical bill. Reuse it across retries and tabs. */
  idempotencyKey?: string;
  /** Host-owned choices or organizationProfileOptions(profile). Selection copies a snapshot into this bill only. */
  profileOptions?: BillSubmissionProfileOptions;
  /** Separate organization:manage session. Supply only for users allowed to manage practice settings. */
  billingSettings?: OrganizationClientOptions;
  /**
   * Without `billingSettings`: opens the host's own practice-settings page (doctors, signatures, locations, W-9).
   * The form shows a "Manage doctors & signatures" button that calls it.
   */
  onManageSettings?: () => void;
  /** Optional written-agreement feature; use a dedicated organization-wide autofill:run session. */
  reportAutofill?: OrganizationClientOptions;
  /**
   * How provider and location details show. "auto" (default) collapses each billing provider, rendering provider
   * and service location that matches a saved choice in `profileOptions` to a one-line summary with an Edit button;
   * a section without a matching saved choice, with missing or invalid values, or named in `attentionFields` shows
   * its fields. "expanded" always shows every field. "compact" also puts all details behind one disclosure.
   */
  profileDisplay?: "auto" | "expanded" | "compact";
  attachments?: BillSubmissionSourceAttachment[];
  /**
   * Files listed as attachments when the form opens, e.g. the PR-2 or previous bill a host already read to
   * prefill the bill. They upload only when the bill is submitted, exactly like files the user chooses, and
   * the user can remove them. Read once on mount; remount with a new key to replace them.
   */
  initialUploads?: readonly BillSubmissionUpload[];
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
  /** Active California MPN directory for the optional injury field. */
  onListMedicalProviderNetworks?: () => Promise<MedicalProviderNetwork[]>;
  /** Paginated claims-administrator directory. Empty queries return the alphabetical first page. */
  onListClaimsAdministrators?: (input?: BillReviewPayerListInput) => Promise<BillReviewPayerPage>;
  /** @deprecated Prefer onListClaimsAdministrators for browse and pagination support. */
  onSearchClaimsAdministrators?: (query: string, claimNumber?: string) => Promise<BillReviewPayer[]>;
  onGetClaimsAdministratorDirectory?: (id: string, injuryState?: string) => Promise<BillClaimsAdministratorDirectory>;
  /** Host-system evidence shown without preselecting a canonical directory entry. EAMS evidence takes precedence. */
  claimsAdministratorSources?: readonly BillClaimsAdministratorSource[];
  /** @deprecated Prefer claimsAdministratorSources so the source label and optional URL remain explicit. */
  claimsAdministratorHint?: ReactNode;
  diagnosisOptions?: BillSubmissionDiagnosisOption[];
  onSearchDiagnoses?: (query: string, limit?: number, offset?: number) => Promise<BillSubmissionDiagnosisOption[]>;
  onLookupPostalCode?: (postalCode: string) => Promise<BillSubmissionPostalPlace | null>;
  procedureOptions?: BillSubmissionProcedureOption[];
  /** Extend the existing procedure picker with treatment codes and authoritative fee quotes. */
  treatmentBilling?: boolean;
  /** Lines added when a procedure is chosen, keyed by that procedure's code. A code already on the bill is not added again. */
  companionLines?: Readonly<Record<string, readonly { code: string; units?: number }[]>>;
  /**
   * Approved treatment authorizations for this claim. A service line whose procedure code matches one is linked to it
   * as the code is entered, and the treatment authorization number fills in when every linked line shares it, so the
   * form shows what will be saved instead of filling it only after the draft is saved.
   */
  linkedAuthorizations?: readonly BillSubmissionLinkedAuthorization[];
  /**
   * @deprecated Ignored since 0.87.0. Medical-legal bills no longer show an evaluator-type control: each line's
   * modifiers (-94 AME, -95 QME, -96 psychiatric, …) are the single source of truth. A medical-legal evaluation code
   * chosen without an evaluator modifier still starts with the QME default (-95).
   */
  evaluationTypes?: readonly BillSubmissionEvaluationType[];
  /**
   * Insurance carrier (payer) named in the host's records, e.g. "Zenith Insurance". Used only to suggest the payer
   * under a claims administrator that administers several payers; it is never submitted.
   */
  insuranceCarrierName?: string;
  /** Send privacy-safe product analytics to MindBill (no PHI or free text). Defaults to true. */
  analytics?: boolean;
  /** Receives every analytics event, whether or not `analytics` is enabled. */
  onAnalyticsEvent?: (event: MindBillAnalyticsEvent) => void;
  /** Opt in to editable treatment billed charges; fee quotes remain separate estimates. */
  editableTreatmentCharges?: boolean;
  /**
   * Show fee-schedule estimates while the bill is entered: the Expected (OMFS) and Difference columns, fee notes
   * and calculation details. Defaults to true. Estimates are informational; the entered charge is what is billed.
   * Pass false to show only the charges, and present the expected amount on the Explanation of Review instead.
   */
  showFeeEstimates?: boolean;
  onSearchProcedureCodes?: (input?: BillProcedureCodeSearchInput) => Promise<BillProcedureCodePage>;
  onQuoteFee?: (input: BillFeeQuoteInput) => Promise<BillFeeQuote>;
  /**
   * Quote every treatment line together as one encounter, so multiple-procedure,
   * bundling and add-on rules apply across lines. Return one quote per input, in
   * order. When supplied, the editor shows Charge, Expected (OMFS) and Difference
   * columns with totals, and does not ask for per-line therapy minutes.
   */
  onQuoteEncounter?: (inputs: BillFeeQuoteInput[]) => Promise<BillFeeQuote[]>;
  /** Short display description for a procedure code (for example from the host's licensed code catalog). */
  describeProcedureCode?: (code: string) => string | undefined;
  modifierOptions?: BillSubmissionModifierOption[];
  /** Common NUCC provider taxonomies are bundled; supplied values extend or replace matching codes. */
  taxonomyOptions?: BillSubmissionTaxonomyOption[];
  /**
   * The delivery-method dialog shown when the biller submits.
   * "auto" (default) shows it whenever the delivery preview is available;
   * "required" fails closed until the biller confirms a route; "off" submits
   * directly on MindBill's recommended route.
   */
  deliveryRoutePicker?: "auto" | "required" | "off";
  /** Heading for the delivery confirmation dialog. */
  deliveryRouteDialogTitle?: ReactNode;
  /** Auto hides and forces J4 for med-legal bills; treatment bills show the full report-type directory. */
  attachmentReportTypeMode?: BillSubmissionAttachmentReportTypeMode;
  attachmentReportTypes?: readonly BillSubmissionReportTypeOption[];
  defaultAttachmentReportType?: string;
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  submitLabel?: string;
  /** Submits this saved draft (createBillDraftsClient); the server marks it submitted with the new bill. */
  draft?: { id: string; revision: number };
  /** Adds a "Save draft" action that hands the bill as entered (unvalidated, possibly incomplete) to the host. */
  onSaveDraft?: (bill: BillSubmissionInput) => void | Promise<void>;
  saveDraftLabel?: string;
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
const PAYER_PAGE_SIZE = 50;
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
  const reportTypeCode = (value: string | undefined): string | undefined =>
    value === undefined ? undefined : normalizeBillSubmissionReportTypeCode(value);
  const selected = selectedIds.map((id) => attachments.find((item) => item.id === id)).filter((item): item is BillSubmissionSourceAttachment => Boolean(item));
  const sourceDocuments = await Promise.all(selected.map(async (attachment) => {
    const selectedReportTypeCode = reportTypeCode(reportTypeCodeByAttachmentId[attachment.id] || attachment.reportTypeCode || defaultReportTypeCode);
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
      ...(selectedReportTypeCode ? { reportTypeCode: selectedReportTypeCode } : {}),
      ...(attachment.description ? { description: attachment.description } : {}),
    });
  }));
  const uploadedDocuments = await Promise.all(uploads.map(({ file, documentType, description, reportTypeCode: uploadReportTypeCode }) => {
    const selectedReportTypeCode = reportTypeCode(uploadReportTypeCode || defaultReportTypeCode);
    return pdfDocument(file, {
      filename: file.name,
      documentType,
      ...(selectedReportTypeCode ? { reportTypeCode: selectedReportTypeCode } : {}),
      ...(description ? { description } : {}),
    });
  }));
  return [...sourceDocuments, ...uploadedDocuments];
}

/**
 * Document type for a file attached to a medical-legal bill. Every file is sent as the med-legal report supporting
 * document (PWK OZ:J4); a file named as a W-9 is the tax form, so MindBill does not attach the saved W-9 twice.
 */
export function medicalLegalUploadDocumentType(fileName: string): BillSubmissionDocumentType {
  return /(?:^|[^a-z0-9])w-?9(?:[^a-z0-9]|$)/i.test(fileName) ? "w9" : "final_report";
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
  return Boolean(line.code.trim() || line.modifiers?.length || line.charge != null || line.drug || line.formData);
}
/** Append a procedure's companion lines after the entered lines; a code already on the bill is left as entered. */
export function withAddedBillSubmissionLines(
  lines: BillSubmissionInput["serviceLines"],
  added: readonly { code: string; units?: number }[] | undefined,
): BillSubmissionInput["serviceLines"] {
  if (!added?.length) return lines;
  const entered = [...lines];
  while (entered.length && !lineHasContent(entered.at(-1)!)) entered.pop();
  const present = new Set(entered.map((line) => line.code.trim().toUpperCase()));
  for (const line of added) {
    const code = line.code.trim().toUpperCase();
    if (!code || present.has(code)) continue;
    present.add(code);
    entered.push({ code, modifiers: [], units: line.units ?? 1 });
  }
  return entered;
}
export function ensureTrailingBillSubmissionLine(
  lines: BillSubmissionInput["serviceLines"],
): BillSubmissionInput["serviceLines"] {
  const normalized: BillSubmissionInput["serviceLines"] = lines.length ? lines.map((line) => ({ ...line, modifiers: [...(line.modifiers ?? [])], units: line.units ?? 1 })) : [];
  while (normalized.length > 1 && !lineHasContent(normalized.at(-1)!) && !lineHasContent(normalized.at(-2)!)) normalized.pop();
  if (!normalized.length || lineHasContent(normalized.at(-1)!)) normalized.push(blankLine());
  return normalized;
}

export type BillSubmissionLinkedAuthorization = { rfaItemId: string; procedureCode: string; authorizationNumber?: string | null };

/** Link lines to approved authorizations by procedure code and fill the shared authorization number (see `linkedAuthorizations`). */
export function linkBillSubmissionAuthorizations(
  bill: BillSubmissionInput,
  authorizations: readonly BillSubmissionLinkedAuthorization[] | undefined,
): BillSubmissionInput {
  if (!authorizations?.length) return bill;
  const normalize = (code: string) => code.trim().toUpperCase();
  const match = (code: string) => code.trim() ? authorizations.find((item) => normalize(item.procedureCode) === normalize(code)) : undefined;
  const serviceLines: BillSubmissionInput["serviceLines"] = bill.serviceLines.map((line) => {
    const found = match(line.code);
    if (found) return line.rfaItemId === found.rfaItemId ? line : { ...line, rfaItemId: found.rfaItemId };
    if (!line.rfaItemId || !authorizations.some((item) => item.rfaItemId === line.rfaItemId)) return line;
    const rest = { ...line };
    delete rest.rfaItemId;
    return rest;
  });
  const linked = serviceLines.flatMap((line) => line.rfaItemId ? [authorizations.find((item) => item.rfaItemId === line.rfaItemId)] : []);
  const numbers = new Set(linked.map((item) => item?.authorizationNumber?.trim() || null));
  const shared = linked.length && numbers.size === 1 ? [...numbers][0] ?? null : null;
  const current = bill.service.authorizationNumber?.trim() || null;
  const supplied = (value: string | null) => value !== null && authorizations.some((item) => (item.authorizationNumber?.trim() || null) === value);
  // Fill a blank or replace a number this list supplied; never overwrite one the biller typed.
  const service = (!current || supplied(current)) && shared !== current ? { ...bill.service, authorizationNumber: shared } : bill.service;
  return { ...bill, service, serviceLines };
}

export function replaceBillSubmissionServiceLines(
  bill: BillSubmissionInput,
  serviceLines: BillSubmissionInput["serviceLines"],
): BillSubmissionInput {
  const lostLastRfaLink = bill.serviceLines.some((line) => line.rfaItemId)
    && !serviceLines.some((line) => line.rfaItemId);
  const service = lostLastRfaLink ? { ...bill.service } : bill.service;
  // A linked authorization must not follow a replacement, unrelated procedure.
  if (lostLastRfaLink) delete service.authorizationNumber;
  return { ...bill, service, serviceLines };
}

/** Keep a single-day bill's inherited line dates aligned with an edited service date. */
export function setBillSubmissionServiceDate(bill: BillSubmissionInput, date: string): BillSubmissionInput {
  const populated = bill.serviceLines.filter(lineHasContent);
  const dates = new Set(populated.map((line) => line.serviceDate || bill.service.date));
  const singleDay = bill.billingMode !== "professional" && dates.size <= 1 && populated.every((line) => !line.serviceDateEnd || line.serviceDateEnd === (line.serviceDate || bill.service.date));
  return { ...bill, service: { ...bill.service, date }, serviceLines: bill.serviceLines.map((line) => {
    const start = line.serviceDate || bill.service.date;
    if (line.serviceDateEnd && line.serviceDateEnd !== start) return line;
    if (!singleDay && start !== bill.service.date) return line;
    return { ...line, ...(line.serviceDate ? { serviceDate: date } : {}),
      ...(line.serviceDateEnd && line.serviceDateEnd === start ? { serviceDateEnd: date } : {}) };
  }) };
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

function evaluationModifiers(type: BillSubmissionEvaluationType, code: string): string[] {
  const normalizedCode = code.toUpperCase();
  if (!/^ML(?:200|201|202|203|PRR)$/.test(normalizedCode)) return [];
  const isAme = type === "ame" || type === "psych_ame";
  if (normalizedCode === "ML200" || normalizedCode === "MLPRR") return isAme ? [] : ["95"];
  const modifiers = [isAme ? "94" : "95"];
  if (type === "psych_qme" || type === "psych_ame") modifiers.push("96");
  return modifiers;
}
export function applyBillSubmissionEvaluationModifiers(
  lines: BillSubmissionInput["serviceLines"], type: BillSubmissionEvaluationType,
): BillSubmissionInput["serviceLines"] {
  return lines.map((line) => {
    if (!isMedicalLegalCode(line.code)) return line;
    const auto = evaluationModifiers(type, line.code);
    const modifiers = (line.modifiers ?? []).filter((item) => !["94", "95", "96"].includes(item.replace(/^-/, "")));
    return { ...line, modifiers: [...auto, ...modifiers] };
  });
}

/** Evaluator-role modifiers on a medical-legal evaluation line: -92 PTP, -94 AME, -95 QME. */
const EVALUATOR_ROLE_MODIFIERS = ["92", "94", "95"];

/**
 * The modifiers a medical-legal line keeps when its procedure code is chosen. The line's own modifiers are the
 * source of truth: an evaluator modifier already on the line (for example -94 from the host or a report) is never
 * replaced. Only a line without one starts with the default for `type` (QME: -95; psychiatric adds -96).
 */
export function withDefaultBillSubmissionEvaluatorModifiers(
  line: BillSubmissionInput["serviceLines"][number], type: BillSubmissionEvaluationType = "qme",
): BillSubmissionInput["serviceLines"][number] {
  if (!isMedicalLegalCode(line.code)) return line;
  const kept = (line.modifiers ?? []).filter((modifier) => medicalLegalModifierApplies(modifier, line.code));
  const normalized = kept.map((modifier) => modifier.replace(/^-/, ""));
  if (normalized.some((modifier) => EVALUATOR_ROLE_MODIFIERS.includes(modifier))) return { ...line, modifiers: kept };
  const added = evaluationModifiers(type, line.code).filter((modifier) => !normalized.includes(modifier));
  return { ...line, modifiers: [...added, ...kept] };
}

/** The evaluator type implied by the rendering provider; used only for the default modifiers of a new line. */
export function billSubmissionDefaultEvaluationType(bill: Pick<BillSubmissionInput, "renderingProvider">): BillSubmissionEvaluationType {
  return initialEvaluationType(bill as BillSubmissionInput);
}

export const PSYCH_QME_DEFAULT_DIAGNOSIS = "Z04.6";

/** Seed the psychiatric examination code only when no diagnosis was supplied. */
export function applyBillSubmissionEvaluationDiagnoses(
  diagnoses: string[] | undefined,
  type: BillSubmissionEvaluationType,
): string[] {
  const current = [...(diagnoses ?? [])];
  return (type === "psych_qme" || type === "psych_ame") && !current.some((code) => code.trim())
    ? [PSYCH_QME_DEFAULT_DIAGNOSIS]
    : current;
}

function initialEvaluationType(bill: BillSubmissionInput): BillSubmissionEvaluationType {
  const isPsych = bill.renderingProvider?.specialty?.toLowerCase().includes("psych");
  if (bill.renderingProvider?.isAme) return isPsych ? "psych_ame" : "ame";
  return isPsych ? "psych_qme" : "qme";
}

/** Preserve the meaning of every line pointer when the claim diagnosis list changes. */
export function remapBillSubmissionDiagnoses(bill: BillSubmissionInput, nextCodes: string[]): BillSubmissionInput {
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
export function setBillSubmissionLineDiagnosis(bill: BillSubmissionInput, lineIndex: number, slot: number, code: string): BillSubmissionInput {
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
export function billSubmissionLineDiagnosisCodes(bill: BillSubmissionInput, index: number): string[] {
  return (bill.serviceLines[index]?.diagnosisPointers ?? []).flatMap((pointer) => bill.diagnoses?.[pointer - 1] ? [bill.diagnoses[pointer - 1]!.trim().toUpperCase()] : []);
}

/** New forms share diagnoses; saved independent assignments retain their meaning. */
export function billSubmissionUsesSharedDiagnoses(bill: BillSubmissionInput): boolean {
  const codes = (bill.diagnoses ?? []).map((code) => code.trim().toUpperCase());
  if (codes.length > 4) return false;
  return bill.serviceLines.filter((line) => line.code.trim() && line.diagnosisPointers !== undefined)
    .every((line) => JSON.stringify(line.diagnosisPointers?.map((pointer) => codes[pointer - 1])) === JSON.stringify(codes));
}

/**
 * Rebuild pointers by code, rejecting selections outside claim and line limits. By default the claim keeps only
 * the diagnoses a line uses (shared mode). With `retainUnused`, every claim diagnosis stays listed (Box 21 may
 * carry codes no line points to) and newly chosen codes are appended.
 */
export function setBillSubmissionDiagnosisAssignments(bill: BillSubmissionInput, assignments: string[][], options: { retainUnused?: boolean } = {}): BillSubmissionInput {
  const normalized = bill.serviceLines.map((_, index) => [...new Set((assignments[index] ?? []).map((code) => code.trim().toUpperCase()).filter(Boolean))]);
  const selected = [...new Set(normalized.flat())];
  if (selected.length > 12 || normalized.some((codes) => codes.length > 4)) return bill;
  const existing = (bill.diagnoses ?? []).map((code) => code.trim().toUpperCase()).filter(Boolean);
  const diagnoses = [...new Set([...(options.retainUnused ? existing : existing.filter((code) => selected.includes(code))), ...selected])];
  if (diagnoses.length > 12) return bill;
  return { ...bill, diagnoses, serviceLines: bill.serviceLines.map((line, index) => ({ ...line, diagnosisPointers: normalized[index]!.map((code) => diagnoses.indexOf(code) + 1) })) };
}

export function setBillSubmissionSharedDiagnoses(bill: BillSubmissionInput, codes: string[]): BillSubmissionInput {
  return setBillSubmissionDiagnosisAssignments(bill, bill.serviceLines.map(() => codes));
}

export function setBillSubmissionLineDiagnoses(bill: BillSubmissionInput, index: number, codes: string[]): BillSubmissionInput {
  if (!bill.serviceLines[index]) return bill;
  return setBillSubmissionDiagnosisAssignments(bill, bill.serviceLines.map((_, lineIndex) => lineIndex === index ? codes : billSubmissionLineDiagnosisCodes(bill, lineIndex)), { retainUnused: true });
}

/** Pointers a new service line starts with: the first four claim diagnoses (A–D), or fewer. */
export function defaultBillSubmissionLinePointers(bill: Pick<BillSubmissionInput, "diagnoses">): number[] {
  return Array.from({ length: Math.min(4, bill.diagnoses?.length ?? 0) }, (_, index) => index + 1);
}

/** Add a diagnosis to the claim's Box 21 list (max 12) without assigning it to a line. */
export function addBillSubmissionClaimDiagnosis(bill: BillSubmissionInput, code: string): BillSubmissionInput {
  const normalized = code.trim().toUpperCase();
  const current = (bill.diagnoses ?? []).map((item) => item.trim().toUpperCase());
  if (!normalized || current.includes(normalized) || current.length >= 12) return bill;
  return remapBillSubmissionDiagnoses(bill, [...current, normalized]);
}

/** Remove a diagnosis from the claim and from every line that pointed to it; other pointers keep their meaning. */
export function removeBillSubmissionClaimDiagnosis(bill: BillSubmissionInput, code: string): BillSubmissionInput {
  const normalized = code.trim().toUpperCase();
  return remapBillSubmissionDiagnoses(bill, (bill.diagnoses ?? []).filter((item) => item.trim().toUpperCase() !== normalized));
}

/** Lines without a procedure yet, or without any pointer, start with the default pointers (A–D). */
function withDefaultLinePointers(bill: BillSubmissionInput): BillSubmissionInput {
  const defaults = defaultBillSubmissionLinePointers(bill);
  if (!defaults.length) return bill;
  return { ...bill, serviceLines: bill.serviceLines.map((line) => !line.diagnosisPointers?.length || (!line.code.trim() && line.diagnosisPointers.length <= 1)
    ? { ...line, diagnosisPointers: defaults } : line) };
}

/** CMS-1500 Box 21 lists at most 12 diagnoses (A–L); Box 24E points each line to at most 4 of them. */
export const BILL_SUBMISSION_MAX_DIAGNOSES = 12;
export const BILL_SUBMISSION_MAX_LINE_POINTERS = 4;

/** What `limitBillSubmissionDiagnoses` removed from a host- or report-supplied bill. */
export type BillSubmissionDiagnosisLimitNotice = {
  /** Diagnoses after the 12th, in the order supplied. */
  droppedDiagnoses: string[];
  /** Indexes of service lines that pointed to more than 4 diagnoses and now keep their first 4. */
  trimmedLines: number[];
};

/**
 * Keep the first 12 diagnoses (Box 21 A–L) and each line's first 4 pointers that still resolve. Codes keep their
 * meaning: a pointer to a dropped code is removed rather than shifted to another code.
 */
export function limitBillSubmissionDiagnoses(bill: BillSubmissionInput): { bill: BillSubmissionInput; notice: BillSubmissionDiagnosisLimitNotice | null } {
  const supplied = [...new Set((bill.diagnoses ?? []).map((code) => code.trim().toUpperCase()).filter(Boolean))];
  const diagnoses = supplied.slice(0, BILL_SUBMISSION_MAX_DIAGNOSES);
  const droppedDiagnoses = supplied.slice(BILL_SUBMISSION_MAX_DIAGNOSES);
  const trimmedLines: number[] = [];
  const serviceLines = bill.serviceLines.map((line, index) => {
    if (!line.diagnosisPointers) return line;
    const pointers = [...new Set(line.diagnosisPointers.flatMap((pointer) => {
      const code = Number.isInteger(pointer) ? bill.diagnoses?.[pointer - 1]?.trim().toUpperCase() : undefined;
      const position = code ? diagnoses.indexOf(code) : -1;
      return position < 0 ? [] : [position + 1];
    }))];
    if (pointers.length > BILL_SUBMISSION_MAX_LINE_POINTERS) trimmedLines.push(index);
    return { ...line, diagnosisPointers: pointers.slice(0, BILL_SUBMISSION_MAX_LINE_POINTERS) };
  });
  const changed = droppedDiagnoses.length > 0 || trimmedLines.length > 0;
  if (!changed && !bill.diagnoses) return { bill, notice: null };
  return { bill: { ...bill, diagnoses, serviceLines }, notice: changed ? { droppedDiagnoses, trimmedLines } : null };
}

/** Non-blocking explanation of what `limitBillSubmissionDiagnoses` removed. */
export function diagnosisLimitNoticeText(notice: BillSubmissionDiagnosisLimitNotice): string {
  const parts: string[] = [];
  if (notice.droppedDiagnoses.length) parts.push(`This bill was given ${BILL_SUBMISSION_MAX_DIAGNOSES + notice.droppedDiagnoses.length} diagnoses. A CMS-1500 lists at most 12 (Box 21 A–L), so the first 12 were kept and ${notice.droppedDiagnoses.join(", ")} ${notice.droppedDiagnoses.length === 1 ? "was" : "were"} left off.`);
  if (notice.trimmedLines.length) parts.push(`${notice.trimmedLines.length === 1 ? `Service line ${notice.trimmedLines[0]! + 1}` : `Service lines ${notice.trimmedLines.map((index) => index + 1).join(", ")}`} pointed to more than 4 diagnoses; each line keeps its first 4.`);
  return `${parts.join(" ")} Review the diagnoses before submitting.`;
}

/** A medical-legal bill: the billing mode says so, or (unset) a non-treatment form or one with an ML evaluation line. */
export function isMedicalLegalBillSubmission(bill: Pick<BillSubmissionInput, "billingMode" | "serviceLines">, treatmentBilling = false): boolean {
  if (bill.billingMode) return bill.billingMode === "med_legal";
  return !treatmentBilling || bill.serviceLines.some((line) => isMedicalLegalCode(line.code));
}

/**
 * On a medical-legal bill every diagnosis applies to every line: each line points to the first 4 Box 21 diagnoses
 * (the CMS-1500 24E / 837P SV107 maximum).
 */
export function withMedicalLegalLinePointers(bill: BillSubmissionInput): BillSubmissionInput {
  const pointers = defaultBillSubmissionLinePointers(bill);
  return { ...bill, serviceLines: bill.serviceLines.map((line) => ({ ...line, diagnosisPointers: [...pointers] })) };
}

function cloneInitialBill(input: BillSubmissionInput, treatmentBilling = false): BillSubmissionInput {
  const bill = limitBillSubmissionDiagnoses(input).bill;
  const cloned = cloneBill(bill);
  if (treatmentBilling && cloned.serviceLines.some((line) => line.code.trim())) cloned.billingMode = billingModeForLines(cloned.serviceLines);
  if (cloned.billingMode !== "professional") cloned.diagnoses = applyBillSubmissionEvaluationDiagnoses(cloned.diagnoses, initialEvaluationType(bill));
  if (billSubmissionUsesSharedDiagnoses(cloned)) return setBillSubmissionSharedDiagnoses(cloned, cloned.diagnoses ?? []);
  return cloned.billingMode === "professional" ? withDefaultLinePointers(cloned) : cloned;
}

function stableInitializationValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableInitializationValue);
  if (!value || typeof value !== "object") return typeof value === "function" ? undefined : value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => typeof entry !== "function")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, stableInitializationValue(entry)]));
}

/**
 * Identifies the source draft represented by the host props. Hosts may rebuild
 * equivalent objects during polling; that must not erase in-progress edits.
 */
export function billSubmissionInitializationKey(
  initialBill: BillSubmissionInput,
  attachments: BillSubmissionSourceAttachment[] = EMPTY_ATTACHMENTS,
  sourceClaimsAdministratorName = "",
): string {
  return JSON.stringify(stableInitializationValue({
    attachments,
    initialBill,
    sourceClaimsAdministratorName,
  }));
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
  required("claim.dateOfInjury", bill.claim.dateOfInjury, bill.claim.injuryType === "cumulative" ? "Enter the start date of the cumulative trauma period." : "Enter the date of injury.");
  required("claim.claimsAdministrator", bill.claim.claimsAdministrator?.name, "Select a claims administrator so MindBill can route this bill.");
  required("service.date", bill.service.date, "Enter the date of service.");
  if (!bill.billingProvider?.savedProviderId?.trim() && !bill.billingProvider?.sourceBillId?.trim()) {
  required("billingProvider.name", bill.billingProvider?.name, "Enter the billing provider name.");
  required("billingProvider.taxId", bill.billingProvider?.taxId, "Enter the billing provider Tax ID (EIN or SSN).");
  required("billingProvider.npi", bill.billingProvider?.npi, "Enter the billing provider NPI.");
  required("billingProvider.phone", bill.billingProvider?.phone, "Enter the billing provider phone number.");
  required("billingProvider.address.line1", bill.billingProvider?.address?.line1, "Enter the billing provider street address.");
  required("billingProvider.address.city", bill.billingProvider?.address?.city, "Enter the billing provider city.");
  required("billingProvider.address.state", bill.billingProvider?.address?.state, "Enter the billing provider 2-letter state code.");
  required("billingProvider.address.postalCode", bill.billingProvider?.address?.postalCode, "Enter the billing provider ZIP code.");
  }
  required("renderingProvider.name", bill.renderingProvider?.name, "Enter the rendering provider name.");
  required("renderingProvider.npi", bill.renderingProvider?.npi, "Enter the rendering provider NPI.");
  required("renderingProvider.taxonomy", bill.renderingProvider?.taxonomy, "Enter the rendering provider taxonomy code.");
  required("serviceLocation.placeOfServiceCode", bill.serviceLocation?.placeOfServiceCode, "Enter the 2-digit place of service code.");
  required("serviceLocation.address.line1", bill.serviceLocation?.address?.line1, "Enter the service facility street address.");
  required("serviceLocation.address.city", bill.serviceLocation?.address?.city, "Enter the service facility city.");
  required("serviceLocation.address.state", bill.serviceLocation?.address?.state, "Enter the service facility 2-letter state code.");
  required("serviceLocation.address.postalCode", bill.serviceLocation?.address?.postalCode, "Enter the service facility ZIP code.");
  if ((bill.diagnoses?.length ?? 0) > 12) errors.diagnoses = "Select no more than 12 claim diagnoses.";
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
  if (bill.claim.injuryType === "cumulative") {
    const start = bill.claim.dateOfInjury ? parseBillSubmissionDate(bill.claim.dateOfInjury) : undefined;
    const end = bill.claim.injuryEndDate ? parseBillSubmissionDate(bill.claim.injuryEndDate) : undefined;
    if (!bill.claim.injuryEndDate?.trim()) errors["claim.injuryEndDate"] = "Enter the end date of the cumulative trauma period.";
    else if (!end) errors["claim.injuryEndDate"] = "Use MM/DD/YYYY";
    else if (start && end < start) errors["claim.injuryEndDate"] = "The CT end date cannot be before the start date.";
  }
  if (bill.patient.address.state.trim().length !== 2) errors["patient.address.state"] = "Use a 2-letter state code";
  if (!bill.billingProvider?.savedProviderId && !bill.billingProvider?.sourceBillId && bill.billingProvider?.address?.state && bill.billingProvider.address.state.trim().length !== 2) errors["billingProvider.address.state"] = "Use a 2-letter state code.";
  if (bill.serviceLocation?.address?.state && bill.serviceLocation.address.state.trim().length !== 2) errors["serviceLocation.address.state"] = "Use a 2-letter state code.";
  const digits = (value?: string) => value?.replace(/\D/g, "") ?? "";
  if (!bill.billingProvider?.savedProviderId && !bill.billingProvider?.sourceBillId && bill.billingProvider?.taxId && digits(bill.billingProvider.taxId).length !== 9) errors["billingProvider.taxId"] = "Enter a valid 9-digit EIN or SSN.";
  if (!bill.billingProvider?.savedProviderId && !bill.billingProvider?.sourceBillId && bill.billingProvider?.npi && !/^\d{10}$/.test(digits(bill.billingProvider.npi))) errors["billingProvider.npi"] = "Enter a valid 10-digit NPI.";
  if (bill.renderingProvider?.npi && !/^\d{10}$/.test(digits(bill.renderingProvider.npi))) errors["renderingProvider.npi"] = "Enter a valid 10-digit NPI.";
  if (bill.renderingProvider?.taxonomy && !/^[A-Za-z0-9]{10}$/.test(bill.renderingProvider.taxonomy.trim())) errors["renderingProvider.taxonomy"] = "Enter a valid 10-character taxonomy code.";
  if (bill.serviceLocation?.placeOfServiceCode && !/^\d{2}$/.test(bill.serviceLocation.placeOfServiceCode.trim())) errors["serviceLocation.placeOfServiceCode"] = "Enter a valid 2-digit place of service code.";
  const lines = submittedLines(bill.serviceLines);
  if (!lines.length) errors.serviceLines = "Add at least one service line";
  lines.forEach((line, index) => {
    required(`serviceLines.${index}.code`, line.code, "Select a procedure code.");
    const inapplicable = isMedicalLegalCode(line.code) ? (line.modifiers ?? []).find((modifier) => !medicalLegalModifierApplies(modifier, line.code)) : undefined;
    if (inapplicable && !errors[`serviceLines.${index}.code`]) errors[`serviceLines.${index}.code`] = `Modifier -${inapplicable.replace(/^-/, "")} does not apply to ${line.code.trim().toUpperCase()} (8 CCR §9795(d)). Remove it.`;
    const pointers = line.diagnosisPointers ?? [];
    if (pointers.length > 4 || new Set(pointers).size !== pointers.length || pointers.some((pointer) => !Number.isInteger(pointer) || pointer < 1 || pointer > (bill.diagnoses?.length ?? 0)) || (bill.billingMode === "professional" && !pointers.length)) errors[`serviceLines.${index}.diagnosisPointers`] = "Select up to four diagnoses for this service line.";
    if (!Number.isInteger(line.units) || (line.units ?? 0) < 1) errors[`serviceLines.${index}.units`] = "Enter at least 1 unit";
    // Tests billed with a medical-legal evaluation need a price, like any treatment line.
    if ((bill.billingMode === "professional" || (!isMedicalLegalCode(line.code) && lines.some((other) => isMedicalLegalCode(other.code)))) && (!Number.isFinite(line.charge) || (line.charge ?? 0) <= 0)) errors[`serviceLines.${index}.charge`] = "Enter the billed charge";
  });
  return { valid: Object.keys(errors).length === 0, fieldErrors: errors };
}

const css = `.mbsf-profile-fields{display:contents}
.mbsf-saved-choice{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px 16px;min-width:0;margin-top:-6px;padding:11px 14px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-accent) 3%,var(--mb-surface))}
.mbsf-saved-text{flex:1 1 260px;min-width:0;margin:0;line-height:1.5;color:var(--mb-muted);overflow-wrap:anywhere}.mbsf-saved-text strong{color:var(--mb-text);font-weight:680}
.mbsf-edit-btn{flex:none;min-height:30px;padding:2px 4px}
.mbsf-diagnosis-toggle .mbctl-check,.mbsf-fee-confirm .mbctl-check{margin-top:2px}

.mbsf{display:grid;gap:20px;color:var(--mb-text);font-family:var(--mb-font);font-size:15px}.mbsf *{box-sizing:border-box}
.mbsf-attention{padding:14px 16px;border-left:4px solid var(--mb-danger);border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-danger) 8%,var(--mb-surface));color:var(--mb-text)}.mbsf [data-attention=true] .mbsf-input,.mbsf [data-attention=true] .mbsf-select,.mbsf [data-attention=true].mbsf-lines{border-color:var(--mb-danger);background:color-mix(in srgb,var(--mb-danger) 4%,var(--mb-input))}.mbsf [data-attention=true]>.mbsf-label{color:var(--mb-danger)}
.mbsf-head,.mbsf-section-head,.mbsf-attach-row,.mbsf-actions{display:flex;align-items:center;justify-content:space-between;gap:16px}.mbsf-title{margin:0;font-size:24px}.mbsf-copy,.mbsf-help{color:var(--mb-muted);margin:5px 0 0}.mbsf-help{overflow-wrap:anywhere}.mbsf-required{font-size:13px;color:var(--mb-muted);white-space:nowrap}.mbsf-star,.mbsf-error{color:var(--mb-danger)}
.mbsf-card{min-width:0;margin:0;padding:24px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);box-shadow:var(--mb-shadow)}.mbsf-card[data-invalid=true]{border-color:var(--mb-danger)}.mbsf-legend{padding:0 10px;font-size:18px;font-weight:760}.mbsf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 24px}.mbsf-subhead{grid-column:1/-1;margin:6px 0 -2px;padding-top:14px;border-top:1px solid var(--mb-border);font-size:15px;font-weight:780;letter-spacing:.01em}.mbsf-subhead:first-child{margin-top:0;padding-top:0;border-top:0}.mbsf-span{grid-column:1/-1}.mbsf-field{display:grid;align-content:start;gap:7px;min-width:0}.mbsf-label{font-weight:680}.mbsf-input,.mbsf-select{width:100%;min-height:46px;padding:10px 12px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-input);color:var(--mb-text);font:inherit}.mbsf-input:focus,.mbsf-select:focus{outline:3px solid color-mix(in srgb,var(--mb-accent) 22%,transparent);border-color:var(--mb-accent)}.mbsf-field[data-invalid=true] .mbsf-input,.mbsf-field[data-invalid=true] .mbsf-select,.mbsf-invalid-control .mbsf-input{border-color:var(--mb-danger);background:color-mix(in srgb,var(--mb-danger) 4%,var(--mb-input))}.mbsf-field[data-invalid=true] .mbsf-input:focus,.mbsf-field[data-invalid=true] .mbsf-select:focus{outline-color:color-mix(in srgb,var(--mb-danger) 24%,transparent)}
.mbsf-combo{position:relative}.mbsf-menu{position:absolute;z-index:20;top:calc(100% + 5px);left:0;right:0;max-height:min(420px,52vh);overflow:auto;overscroll-behavior:contain;padding:7px;border:1px solid var(--mb-border);border-radius:12px;background:var(--mb-surface);box-shadow:0 14px 35px rgba(17,38,49,.16)}.mbsf-option{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:14px;width:100%;padding:11px 12px;border:0;border-radius:8px;background:transparent;color:var(--mb-text);font:inherit;text-align:left;cursor:pointer}.mbsf-option+.mbsf-option{border-top:1px solid color-mix(in srgb,var(--mb-border) 65%,transparent)}.mbsf-option:hover,.mbsf-option:focus{background:color-mix(in srgb,var(--mb-accent) 9%,var(--mb-surface));outline:0}.mbsf-option-main{display:grid;gap:5px;min-width:0}.mbsf-option small{color:var(--mb-muted);overflow-wrap:anywhere;line-height:1.35}.mbsf-option-route{align-self:start;margin-top:2px;color:var(--mb-accent);font-size:13px;font-weight:750;white-space:nowrap}.mbsf-option-badges{display:flex;flex-wrap:wrap;gap:5px}.mbsf-option-badge{padding:2px 7px;border:1px solid var(--mb-border);border-radius:999px;color:var(--mb-muted);font-size:11px;line-height:1.35}.mbsf-option-affiliates{display:block}.mbsf-option-affiliates strong{color:var(--mb-text);font-size:12px}.mbsf-menu-status{padding:12px;text-align:center;color:var(--mb-muted);font-size:13px}.mbsf-directory-link{justify-self:start;border:0;padding:0;background:transparent;color:var(--mb-accent);font:inherit;font-weight:700;text-align:left;text-decoration:underline;cursor:pointer}
.mbsf-payer-status{display:flex;align-items:center;gap:7px;color:#087f5b;font-size:13px;font-weight:650}.mbsf-payer-intro{margin:4px 0 0;color:var(--mb-muted)}.mbsf-payer-list{display:grid;gap:8px}.mbsf-payer-option{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 12px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-accent) 3%,var(--mb-surface))}.mbsf-payer-option-main{display:grid;gap:5px;min-width:0}.mbsf-payer-option-main strong{overflow-wrap:anywhere}.mbsf-payer-signals{display:flex;flex-wrap:wrap;gap:6px}.mbsf-payer-signal{padding:2px 7px;border:1px solid var(--mb-border);border-radius:999px;color:var(--mb-muted);font-size:12px}.mbsf-payer-signal[data-state=match]{border-color:color-mix(in srgb,#159447 45%,var(--mb-border));color:#087f5b}.mbsf-payer-signal[data-state=warning]{border-color:color-mix(in srgb,#c56a00 55%,var(--mb-border));color:#9a5200}
.mbsf-source-evidence{display:grid;gap:4px;color:var(--mb-muted);font-size:13px}.mbsf-source-evidence a{color:var(--mb-accent);font-weight:700}.mbsf-source-evidence q{color:var(--mb-text)}.mbsf-suggestions{display:flex;align-items:center;flex-wrap:wrap;gap:7px;color:var(--mb-muted);font-size:13px}.mbsf-suggestion{padding:5px 10px;border:1px solid color-mix(in srgb,var(--mb-accent) 55%,var(--mb-border));border-radius:999px;background:color-mix(in srgb,var(--mb-accent) 7%,var(--mb-surface));color:var(--mb-accent);font:inherit;font-weight:700;cursor:pointer}.mbsf-suggestion:hover,.mbsf-suggestion:focus{outline:2px solid color-mix(in srgb,var(--mb-accent) 25%,transparent)}.mbsf-claim-patterns{display:grid;gap:4px;margin-top:2px;font-size:13px}.mbsf-claim-patterns[data-state=match]{color:#087f5b}.mbsf-claim-patterns[data-state=warning]{color:#9a5200}.mbsf-claim-pattern-list{color:var(--mb-muted)}
.mbsf-chips,.mbsf-quick-picks{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:8px}.mbsf-chip,.mbsf-quick-pick{display:inline-flex;align-items:center;gap:7px;padding:5px 9px;border:1px solid var(--mb-border);border-radius:999px;background:var(--mb-input)}.mbsf-chip button{border:0;background:transparent;color:var(--mb-muted);cursor:pointer;font:inherit}.mbsf-quick-pick{color:var(--mb-text);font:inherit;cursor:pointer}.mbsf-quick-pick[data-selected=true]{border-color:var(--mb-accent);color:var(--mb-accent)}
.mbsf-ct-toggle{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:14px;font-weight:600}.mbsf-ct-toggle .mbctl-check{margin:0}
.mbsf-route-preview-note{color:var(--mb-muted);font-size:13px}
.mbsf-claim-diagnoses{display:grid;gap:8px;margin:4px 0 6px}.mbsf-claim-diagnoses-label{font-weight:600;font-size:13px}
.mbsf-claim-diagnosis-list{display:flex;flex-wrap:wrap;gap:7px;margin:0;padding:0;list-style:none}
.mbsf-pointer-letter{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:var(--mb-border);color:var(--mb-text);font-size:11px;font-weight:700}
.mbsf-quick-pick[data-selected=true] .mbsf-pointer-letter{background:var(--mb-accent);color:var(--mb-accent-contrast,#fff)}
.mbsf-pointer-picks{gap:5px;margin-bottom:6px}.mbsf-pointer-pick{padding:3px 8px;gap:5px;font-size:12px}.mbsf-pointer-pick:disabled{opacity:.45;cursor:not-allowed}
.mbsf-segments{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);overflow:hidden}.mbsf-segment{min-height:44px;border:0;border-right:1px solid var(--mb-border);background:var(--mb-input);color:var(--mb-text);font:inherit;font-weight:700;cursor:pointer}.mbsf-segment:last-child{border-right:0}.mbsf-segment[aria-pressed=true]{background:var(--mb-accent);color:var(--mb-accent-contrast)}
.mbsf-lines{min-width:0;margin-top:18px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);overflow:visible}.mbsf-lines[data-invalid=true]{border-color:var(--mb-danger)}.mbsf-line-head,.mbsf-line{display:grid;grid-template-columns:minmax(190px,1.05fr) minmax(190px,1.3fr) minmax(180px,1fr) 100px 120px 42px;gap:12px;align-items:start;padding:12px}.mbsf-line-head{color:var(--mb-muted);font-size:13px;font-weight:700;border-bottom:1px solid var(--mb-border)}.mbsf-line{border-bottom:1px solid var(--mb-border)}.mbsf-line:last-child{border-bottom:0}.mbsf-line [data-invalid=true] .mbsf-input{border-color:var(--mb-danger);background:color-mix(in srgb,var(--mb-danger) 4%,var(--mb-input))}.mbsf-money{padding-top:12px;text-align:right;font-variant-numeric:tabular-nums}.mbsf-line-diagnoses{min-width:0;position:relative}.mbsf-diagnosis-select{min-width:0}.mbsf-diagnosis-select .mbsf-chip{max-width:100%;align-items:flex-start}.mbsf-diagnosis-select .mbsf-chip>span{min-width:0;overflow-wrap:anywhere}.mbsf-diagnosis-toggle{display:flex;align-items:flex-start;gap:10px;margin:18px 0;line-height:1.5}.mbsf-diagnosis-toggle input{margin-top:4px}.mbsf-lines[data-shared-diagnoses=true]>.mbsf-line,.mbsf-lines[data-shared-diagnoses=true]>.mbsf-line-head{grid-template-columns:minmax(190px,1.05fr) minmax(190px,1.3fr) 100px 120px 42px}.mbsf-line-diagnoses .mbsf-combo{position:static;min-width:0}.mbsf-line-diagnoses .mbsf-menu{left:0;right:0;min-width:100%}.mbsf-line-diagnoses .mbsf-input{padding:10px 6px;font-size:16px}.mbsf-fee-details{min-width:0;grid-column:1/-1;font-size:14px;color:var(--mb-muted);padding:8px 0}.mbsf-fee-details summary{cursor:pointer;font-weight:600}.mbsf-text-btn{padding:0;border:0;background:none;color:var(--mb-accent);font:inherit;font-size:13px;font-weight:600;cursor:pointer}.mbsf-text-btn:hover{text-decoration:underline}.mbsf-calc{min-width:0;font-size:13px}.mbsf-fee-details details.mbsf-calc[open]{grid-template-columns:minmax(0,1fr);gap:8px}.mbsf-calc>*{min-width:0}.mbsf-calc p{margin:0;overflow-wrap:anywhere}.mbsf-calc-facts{display:flex;flex-wrap:wrap;gap:4px 24px;margin:0}.mbsf-calc-facts div{display:flex;gap:6px}.mbsf-calc-facts dt{font-weight:600}.mbsf-calc-facts dd{margin:0}.mbsf-calc-table{overflow-x:auto}.mbsf-calc-table table{border-collapse:collapse;width:100%;max-width:560px;font-variant-numeric:tabular-nums}.mbsf-calc-table th,.mbsf-calc-table td{padding:4px 12px 4px 0;text-align:left;border-bottom:1px solid var(--mb-border)}.mbsf-calc-table tr:last-child td{font-weight:650;border-bottom:0}.mbsf-fee-details details[open]{display:grid;gap:12px}.mbsf-fee-details>.mbsf-field{max-width:320px}.mbsf-fee-confirm{display:flex;gap:10px;align-items:flex-start;line-height:1.5}.mbsf-fee-confirm input{margin-top:4px}.mbsf-attestation{grid-column:1/-1;padding:10px 12px;border-radius:8px;background:color-mix(in srgb,#d97706 10%,var(--mb-surface));color:#7a4a00;font-size:14px}.mbsf-dx{display:flex;flex-wrap:wrap;gap:5px;padding-top:6px}.mbsf-dx-chip{width:30px;height:30px;border:1px solid var(--mb-border);border-radius:8px;background:var(--mb-surface);color:var(--mb-muted);font:inherit;font-size:13px;font-weight:750;cursor:pointer}.mbsf-dx-chip[data-active=true]{border-color:var(--mb-accent);background:color-mix(in srgb,var(--mb-accent) 10%,var(--mb-surface));color:var(--mb-accent)}.mbsf-total{display:flex;justify-content:flex-end;gap:45px;padding:16px 56px 16px 16px;font-size:17px;font-weight:760}.mbsf-lines[data-encounter=true]>.mbsf-line,.mbsf-lines[data-encounter=true]>.mbsf-line-head{grid-template-columns:minmax(170px,1.05fr) minmax(170px,1.2fr) minmax(160px,1fr) 72px 104px 124px 104px 42px}.mbsf-lines[data-encounter=true][data-shared-diagnoses=true]>.mbsf-line,.mbsf-lines[data-encounter=true][data-shared-diagnoses=true]>.mbsf-line-head{grid-template-columns:minmax(170px,1.05fr) minmax(170px,1.3fr) 72px 104px 124px 104px 42px}.mbsf-num{text-align:right}.mbsf-money-group{display:contents}
.mbsf-lines[data-encounter=true][data-estimates=false]>.mbsf-line,.mbsf-lines[data-encounter=true][data-estimates=false]>.mbsf-line-head{grid-template-columns:minmax(170px,1.05fr) minmax(170px,1.2fr) minmax(160px,1fr) 72px 104px 42px}
.mbsf-lines[data-encounter=true][data-estimates=false][data-shared-diagnoses=true]>.mbsf-line,.mbsf-lines[data-encounter=true][data-estimates=false][data-shared-diagnoses=true]>.mbsf-line-head{grid-template-columns:minmax(170px,1.05fr) minmax(170px,1.3fr) 72px 104px 42px}
.mbsf-lines[data-estimates=false] .mbsf-encounter-total{grid-template-columns:1fr 104px 42px}
.mbsf-lines[data-stacked=true][data-estimates=false] .mbsf-money-group,.mbsf-lines[data-stacked=true][data-estimates=false] .mbsf-encounter-total{grid-template-columns:minmax(0,1fr)}.mbsf-money small{display:block;margin-top:2px;color:var(--mb-muted);font-size:12px;font-weight:500}.mbsf-expected{font-weight:650}.mbsf-charge{padding-top:0}.mbsf-charge .mbsf-input{text-align:right;font-variant-numeric:tabular-nums}.mbsf-difference{color:var(--mb-muted)}.mbsf-review{color:#9a5b00;font-weight:600}.mbsf-at-charge{color:var(--mb-muted);font-size:12px;font-weight:600}.mbsf-line-notes{grid-column:1/-1;margin:0;padding:8px 12px 8px 28px;border-radius:8px;background:color-mix(in srgb,var(--mb-muted) 8%,var(--mb-surface));color:var(--mb-muted);font-size:13px;line-height:1.45}.mbsf-line-notes[data-review=true]{background:color-mix(in srgb,#d97706 10%,var(--mb-surface));color:#7a4a00}.mbsf-line-notes li+li{margin-top:4px}.mbsf-encounter-total{display:grid;grid-template-columns:1fr 104px 124px 104px 42px;gap:12px;align-items:start;padding:16px 12px;font-size:16px;font-weight:760;font-variant-numeric:tabular-nums;border-top:1px solid var(--mb-border)}.mbsf-encounter-total>span{text-align:right}.mbsf-encounter-total>span:first-child{text-align:left}.mbsf-encounter-total>span:after{content:""}.mbsf-encounter-total small{display:block;color:#9a5b00;font-size:12px;font-weight:600}
.mbsf-icon-btn{width:40px;height:42px;border:0;background:transparent;color:var(--mb-text);font-size:22px;cursor:pointer}.mbsf-secondary{min-height:40px;padding:8px 14px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);color:var(--mb-text);font:inherit;font-weight:680;cursor:pointer}.mbsf-attach-list{display:grid;gap:10px;margin-bottom:18px}.mbsf-attach-row{padding:14px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius)}.mbsf-attach-row[data-auto=true]{border-color:color-mix(in srgb,#159447 45%,var(--mb-border));background:color-mix(in srgb,#159447 5%,var(--mb-surface))}.mbsf-attach-main{display:flex;align-items:center;gap:12px;min-width:0;flex:1}.mbsf-attach-type{width:min(360px,32vw);flex:0 1 360px}.mbsf-attach-type .mbsf-label{display:block;margin-bottom:6px;font-size:12px}.mbsf-attach-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto}.mbsf-file{min-width:0}.mbsf-file strong{overflow-wrap:anywhere}.mbsf-badge{display:inline-block;margin-left:8px;padding:2px 7px;border:1px solid var(--mb-border);border-radius:7px;color:var(--mb-muted);font-size:12px;font-weight:600}.mbsf-drop{display:grid;width:100%;place-items:center;min-height:210px;padding:30px;border:2px dashed color-mix(in srgb,var(--mb-muted) 55%,transparent);border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-accent) 3%,var(--mb-surface));color:var(--mb-text);font:inherit;text-align:center;cursor:pointer}.mbsf-drop[data-active=true]{border-color:var(--mb-accent);background:color-mix(in srgb,var(--mb-accent) 10%,var(--mb-surface))}.mbsf-alert{padding:12px 14px;border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-danger) 10%,transparent);color:var(--mb-danger)}.mbsf-actions{justify-content:flex-end}.mbsf-submit{min-width:180px;min-height:48px;padding:11px 24px;border:0;border-radius:var(--mb-control-radius);background:var(--mb-accent);color:var(--mb-accent-contrast);font:inherit;font-weight:780;cursor:pointer}
.mbsf-cms-preview{padding:16px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);min-width:0}.mbsf-cms-preview header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.mbsf-cms-preview h3{margin:0}.mbsf-preview-details{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin:16px 0}.mbsf-cms-preview iframe{width:100%;height:600px;max-height:75vh;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius)}.mbsf-preview-stale{padding:20px 0;color:var(--mb-muted)}
.mbsf-actions{flex-direction:column;align-items:flex-end}.mbsf-actions>.mbsf-secondary{min-width:180px}
.mbsf-lines[data-stacked=true] .mbsf-line-head,.mbsf-lines[data-stacked=true][data-shared-diagnoses=true]>.mbsf-line-head{display:none}.mbsf-lines[data-stacked=true] .mbsf-line,.mbsf-lines[data-stacked=true][data-shared-diagnoses=true]>.mbsf-line{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 86px;gap:14px;padding:18px 16px}.mbsf-lines[data-stacked=true] .mbsf-line>div:before{display:block;margin-bottom:6px;color:var(--mb-muted);font-size:12px;font-weight:700;content:attr(data-label)}.mbsf-lines[data-stacked=true] .mbsf-line>div:nth-child(1),.mbsf-lines[data-stacked=true] .mbsf-line>div:nth-child(2),.mbsf-lines[data-stacked=true] .mbsf-line>.mbsf-line-diagnoses{grid-column:1/-1}.mbsf-lines[data-stacked=true] .mbsf-money{align-self:end;padding:0 0 12px;text-align:right}.mbsf-lines[data-stacked=true] .mbsf-line .mbsf-icon-btn{position:absolute;right:8px;bottom:3px}.mbsf-lines[data-stacked=true] .mbsf-total{padding:16px 18px;gap:24px}.mbsf-line>.mbsf-money-group:before{content:none!important;display:none!important}.mbsf-lines[data-stacked=true][data-encounter=true] .mbsf-money-group{display:grid;grid-column:1/-1;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr) minmax(0,1fr);gap:8px}.mbsf-lines[data-stacked=true] .mbsf-money-group>div:before{display:block;margin-bottom:4px;color:var(--mb-muted);font-size:12px;font-weight:700;white-space:nowrap;content:attr(data-label)}.mbsf-lines[data-stacked=true] .mbsf-money-group .mbsf-money{align-self:start;padding:0;text-align:left}.mbsf-lines[data-stacked=true] .mbsf-encounter-total{grid-template-columns:minmax(0,1fr) minmax(0,1.25fr) minmax(0,1fr);gap:8px;padding:16px 18px}.mbsf-lines[data-stacked=true] .mbsf-encounter-total>span:first-child{grid-column:1/-1}.mbsf-lines[data-stacked=true] .mbsf-encounter-total>span{text-align:left}.mbsf-lines[data-stacked=true] .mbsf-encounter-total>span:not(:first-child):before{display:block;color:var(--mb-muted);font-size:12px;font-weight:700;white-space:nowrap;content:attr(data-label)}
@media(max-width:820px){.mbsf{gap:16px}.mbsf-grid{grid-template-columns:1fr}.mbsf-span{grid-column:auto}.mbsf-card{padding:18px 16px}.mbsf-line-head,.mbsf-lines[data-shared-diagnoses=true]>.mbsf-line-head{display:none}.mbsf-line,.mbsf-lines[data-shared-diagnoses=true]>.mbsf-line{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 86px;gap:14px;padding:18px 16px}.mbsf-line>div:before{display:block;margin-bottom:6px;color:var(--mb-muted);font-size:12px;font-weight:700;content:attr(data-label)}.mbsf-line>div:nth-child(1),.mbsf-line>div:nth-child(2),.mbsf-line>.mbsf-line-diagnoses{grid-column:1/-1}.mbsf-money{align-self:end;padding:0 0 12px;text-align:right}.mbsf-line .mbsf-icon-btn{position:absolute;right:8px;bottom:3px}.mbsf-total{padding:16px 18px;gap:24px}.mbsf-head{align-items:flex-start}.mbsf-segments{grid-template-columns:repeat(3,minmax(0,1fr))}.mbsf-segment{min-width:0;padding:8px 4px;border-right:1px solid var(--mb-border);border-bottom:0;font-size:13px}.mbsf-segment:last-child{border-right:0}.mbsf-payer-option{align-items:flex-start}.mbsf-attach-row{align-items:flex-start;flex-wrap:wrap}.mbsf-attach-main{align-items:flex-start;flex-basis:calc(100% - 150px)}.mbsf-attach-type{width:100%;flex-basis:100%;order:3}.mbsf-attach-actions{margin-left:auto}.mbsf-drop{min-height:190px;padding:24px 18px}.mbsf-actions{position:sticky;bottom:86px;z-index:10}.mbsf.mbsf-lifecycle-correction .mbsf-actions{position:static;bottom:auto}.mbsf-submit{width:100%}}
`;

function RequiredMark(): ReactElement { return <span className="mbsf-star"> *</span>; }
function Field({ label, required, error, invalid, path, span, children }: { label: string; required?: boolean; error?: string | undefined; invalid?: boolean; path?: string; span?: boolean; children: ReactNode }): ReactElement {
  return <label className={`mbsf-field${span ? " mbsf-span" : ""}`} data-field-path={path} data-invalid={Boolean(error) || invalid}><span className="mbsf-label">{label}{required ? <RequiredMark /> : null}</span>{children}{error ? <small className="mbsf-error" role="alert">{error}</small> : null}</label>;
}
function TextDateInput({ value, onChange, disabled, required, ariaLabel }: { value?: string | null | undefined; onChange: (value: string) => void; disabled: boolean; required?: boolean; ariaLabel: string }): ReactElement {
  const [display, setDisplay] = useState(() => formatBillSubmissionDate(value));
  const [invalid, setInvalid] = useState(false);
  const emittedValue = useRef<string | undefined>(undefined);
  useEffect(() => {
    // Preserve the partially typed text when the parent echoes our cleared model.
    if (emittedValue.current !== undefined && value === emittedValue.current) { emittedValue.current = undefined; return; }
    emittedValue.current = undefined;
    setDisplay(formatBillSubmissionDate(value)); setInvalid(false);
  }, [value]);
  return <><input className="mbsf-input" type="text" inputMode="numeric" autoComplete="off" placeholder="MM/DD/YYYY" aria-label={ariaLabel} aria-invalid={invalid} required={required} disabled={disabled} value={display} onChange={(event) => {
    const next = event.target.value; const parsed = parseBillSubmissionDate(next); setDisplay(next); setInvalid(Boolean(next && !parsed));
    emittedValue.current = parsed ?? ""; onChange(emittedValue.current);
  }} onBlur={() => setInvalid(Boolean(display && !parseBillSubmissionDate(display)))} />{invalid ? <small className="mbsf-error">Use MM/DD/YYYY</small> : null}</>;
}

type ComboOption = { id: string; label: string; detail?: string; badges?: string[]; affiliatedEntities?: string[]; trailing?: string };
function ComboBox({ value, placeholder, options, disabled, loading, loadingMore, invalid, preserveValueOnOpen = false, filterOptions = true, matchCodeIgnoringSeparators = false, onOpen, onQuery, onEndReached, onSelect, createOption, ariaLabel }: { matchCodeIgnoringSeparators?: boolean; value: string; placeholder: string; options: ComboOption[]; disabled: boolean; loading?: boolean; loadingMore?: boolean; invalid?: boolean; preserveValueOnOpen?: boolean; filterOptions?: boolean; onOpen?: () => void; onQuery?: (query: string) => void; onEndReached?: () => void; onSelect: (option: ComboOption) => void; createOption?: (query: string) => ComboOption | null; ariaLabel: string }): ReactElement {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q && filterOptions ? options.filter((option) => `${option.id} ${option.label} ${option.detail ?? ""} ${(option.badges ?? []).join(" ")} ${(option.affiliatedEntities ?? []).join(" ")} ${option.trailing ?? ""}`.toLowerCase().includes(q)
      // "ML-203" and "ML 203" are the same code as "ML203".
      || (matchCodeIgnoringSeparators && /[\s-]/.test(q) && option.id.toLowerCase().includes(q.replace(/[\s-]+/g, "")))) : options;
    // An exact code match ("RT", "25") is listed first, ahead of descriptions that merely contain the text.
    if (q && filterOptions) matches.sort((a, b) => Number(b.id.toLowerCase() === q.replace(/^[-−]/, "")) - Number(a.id.toLowerCase() === q.replace(/^[-−]/, "")));
    const custom = createOption?.(query) ?? null;
    return custom && !matches.some((option) => option.id.toUpperCase() === custom.id.toUpperCase()) ? [...matches, custom] : matches;
  }, [createOption, filterOptions, matchCodeIgnoringSeparators, options, query]);
  const showMenu = open;
  return <div className="mbsf-combo"><input className="mbsf-input" role="combobox" aria-label={ariaLabel} aria-invalid={invalid} aria-expanded={showMenu} autoComplete="off" disabled={disabled} placeholder={placeholder} value={open ? query : value} onFocus={() => { const next = preserveValueOnOpen ? value : ""; setOpen(true); setQuery(next); onOpen?.(); if (next) onQuery?.(next); }} onChange={(event) => { setOpen(true); setQuery(event.target.value); onQuery?.(event.target.value); }} onBlur={() => setTimeout(() => setOpen(false), 120)} />{showMenu ? <div className="mbsf-menu" role="listbox" onScroll={(event) => { const menu = event.currentTarget; if (menu.scrollHeight - menu.scrollTop - menu.clientHeight < 120) onEndReached?.(); }}>{loading && !visible.length ? <div className="mbsf-menu-status">Loading…</div> : visible.length ? visible.map((option) => <button className="mbsf-option" type="button" role="option" key={option.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(option); setOpen(false); setQuery(""); }}><span className="mbsf-option-main"><strong>{option.label}</strong>{option.detail ? <small>{option.detail}</small> : null}{option.badges?.length ? <span className="mbsf-option-badges">{option.badges.map((badge) => <span className="mbsf-option-badge" key={badge}>{badge}</span>)}</span> : null}{option.affiliatedEntities?.length ? <small className="mbsf-option-affiliates"><strong>Affiliated entities:</strong> {option.affiliatedEntities.join(", ")}</small> : null}</span>{option.trailing ? <span className="mbsf-option-route">{option.trailing}</span> : null}</button>) : <div className="mbsf-option">No matches</div>}{loadingMore ? <div className="mbsf-menu-status">Loading more…</div> : null}</div> : null}</div>;
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
  const code = query.trim().toUpperCase().replace(/[\s-]+/g, "");
  if (!/^(?:\d{5}|[A-Z]\d{4}|WC\d{3}|ML(?:20[0-5]|PRR))$/.test(code)) return null;
  return { id: code, label: code, detail: "Use this CPT, HCPCS, or medical-legal code" };
}

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

/** Encounter warnings stay visible below the line without hiding its expected amount. */
function EncounterLineNotes({ quote, reviewMessage, billedAtCharge = false }: { quote: BillFeeQuote | { status: "error"; reason: string } | undefined; reviewMessage?: string | undefined; billedAtCharge?: boolean }) {
  const messages = [...new Set([...(reviewMessage ? [reviewMessage] : []), ...(quote && quote.status !== "error" ? quote.findings?.map((finding) => finding.message) ?? [] : [])])];
  if (!messages.length) return null;
  // With a billed charge entered, an unquotable line is billed at that charge: the reason is information, not a blocker.
  return <ul className="mbsf-line-notes" data-review={quote?.status === "requires_review" && !billedAtCharge}>{billedAtCharge && quote?.status !== "priced" ? <li>The fee schedule could not estimate this line; it is billed at the charge you entered.</li> : null}{messages.map((message) => <li key={message}>{message}</li>)}</ul>;
}

/** Currency entry without the browser number spinner; keeps a partial entry such as "12." while typing. */
function DecimalInput({ ariaLabel, value, onChange, disabled, placeholder }: { ariaLabel: string; value: number | undefined; onChange: (value: number | undefined) => void; disabled?: boolean | undefined; placeholder?: string | undefined }) {
  const [draft, setDraft] = useState<string | null>(null);
  // Shown as dollars and cents ("650.00") except while the biller is typing.
  const shown = value == null || !Number.isFinite(value) ? "" : value.toFixed(2);
  return <input className="mbsf-input" aria-label={ariaLabel} disabled={disabled} type="text" inputMode="decimal" autoComplete="off" placeholder={placeholder}
    value={draft ?? shown} onFocus={() => setDraft(shown)} onBlur={() => setDraft(null)}
    onChange={(event) => {
      const next = event.target.value.replace(/[$,\s]/g, "");
      if (!/^\d*(?:\.\d{0,2})?$/.test(next)) return;
      setDraft(next); onChange(next === "" || next === "." ? undefined : Number(next));
    }} />;
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

export function claimNumberPatternMatches(
  pattern: NonNullable<BillReviewPayer["claimNumberPatterns"]>[number],
  claimNumber: string,
): boolean | null {
  const example = pattern.example?.trim();
  if (example && /9{2,}/.test(example)) {
    const expression = [...example].map((character) => character === "9"
      ? "\\d"
      : character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("");
    return new RegExp(`^${expression}$`, "i").test(claimNumber.trim());
  }
  return pattern.matches ?? null;
}

/**
 * Form-state claims administrator for a directory pick. When the administrator
 * requires payer selection it carries the payer (routing payer) choices and
 * requires an explicit user choice; administrators without routing payers stay a
 * plain `{ id, name }` reference.
 */
export function chooseClaimsAdministrator(
  payer: Pick<BillReviewPayer, "id" | "name" | "payerSelectionRequired" | "payers">,
  selectedPayerId?: string,
): NonNullable<BillSubmissionInput["claim"]["claimsAdministrator"]> {
  if (!payer.payerSelectionRequired) return { id: payer.id, name: payer.name };
  const payers = (payer.payers ?? []).map((option) => ({ ...option }));
  const resolvedPayerId = selectedPayerId && payers.some((option) => option.id === selectedPayerId)
    ? selectedPayerId
    : undefined;
  return {
    id: payer.id,
    name: payer.name,
    payerSelectionRequired: true,
    ...(payers.length ? { payers } : {}),
    ...(resolvedPayerId ? { payerId: resolvedPayerId } : {}),
  };
}

/** Why a payer (subpayor) was preselected under a multi-payer claims administrator. */
export type BillSubmissionPayerSuggestionReason = "only_payer" | "single_ebill" | "carrier_match" | "most_used";
export type BillSubmissionPayerSuggestion = { payerId: string; reason: BillSubmissionPayerSuggestionReason };

function payerOptionNames(option: BillReviewPayerOption): string[] {
  return [option.label, ...(option.aliases ?? []), ...(option.affiliatedEntities ?? [])].map(normalizeClaimsAdministratorName).filter(Boolean);
}

/**
 * The payer to preselect under a claims administrator that administers several payers, or null when nothing
 * identifies one: (1) its only payer, or the only payer MindBill can e-bill; (2) the payer matching an insurance
 * carrier named by the host or the report; (3) the payer MindBill bills most often for that administrator.
 * The selection is a suggestion: the biller can change it.
 */
export function suggestBillSubmissionPayer(
  administrator: Pick<BillReviewPayer, "payers" | "suggestedPayerId" | "suggestedPayerReason">,
  carrierNames: readonly (string | null | undefined)[] = [],
): BillSubmissionPayerSuggestion | null {
  const options = (administrator.payers ?? []).filter((option) => option.active !== false);
  if (!options.length) return null;
  if (options.length === 1) return { payerId: options[0]!.id, reason: "only_payer" };
  const offered = (id: string | undefined) => Boolean(id && options.some((option) => option.id === id));
  if (administrator.suggestedPayerReason === "single_ebill" && offered(administrator.suggestedPayerId)) return { payerId: administrator.suggestedPayerId!, reason: "single_ebill" };
  const electronic = options.filter((option) => option.electronic === true);
  if (electronic.length === 1 && options.every((option) => option.electronic !== undefined)) return { payerId: electronic[0]!.id, reason: "single_ebill" };
  for (const carrier of carrierNames.map((name) => normalizeClaimsAdministratorName(name ?? "")).filter((name) => name.length >= 3)) {
    const exact = options.filter((option) => payerOptionNames(option).includes(carrier));
    const partial = exact.length ? exact : options.filter((option) => payerOptionNames(option).some((name) => name.length >= 4 && carrier.length >= 4 && (name.includes(carrier) || carrier.includes(name))));
    if (partial.length === 1) return { payerId: partial[0]!.id, reason: "carrier_match" };
  }
  if (administrator.suggestedPayerReason === "most_used" && offered(administrator.suggestedPayerId)) return { payerId: administrator.suggestedPayerId!, reason: "most_used" };
  return null;
}

const PAYER_SUGGESTION_TEXT: Record<BillSubmissionPayerSuggestionReason, string> = {
  only_payer: "the only payer for this claims administrator",
  single_ebill: "the only payer MindBill can e-bill for this claims administrator",
  carrier_match: "matches the insurance carrier named for this claim",
  most_used: "the payer most often billed for this claims administrator",
};

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

/**
 * The claim exactly as submitted: directory metadata is stripped and the cumulative trauma fields ride on the wire
 * only for a CT claim (`injuryType: "cumulative"` with the period's `injuryEndDate`).
 */
export function submittedBillSubmissionClaim(claim: BillSubmissionInput["claim"]): BillSubmissionInput["claim"] {
  const next = { ...claim };
  delete next.injuryType;
  delete next.injuryEndDate;
  if (claim.injuryType === "cumulative") {
    next.injuryType = "cumulative";
    const end = claim.injuryEndDate ? parseBillSubmissionDate(claim.injuryEndDate) ?? claim.injuryEndDate : undefined;
    if (end) next.injuryEndDate = end;
  }
  if (claim.claimsAdministrator) next.claimsAdministrator = submittedClaimsAdministrator(claim.claimsAdministrator);
  return next;
}

/** Turn a claim into (or out of) a cumulative trauma claim; the entered dates are kept. */
export function setBillSubmissionCumulativeTrauma(claim: BillSubmissionInput["claim"], cumulative: boolean): BillSubmissionInput["claim"] {
  if (cumulative) return { ...claim, injuryType: "cumulative", injuryEndDate: claim.injuryEndDate ?? "" };
  const next = { ...claim };
  delete next.injuryType;
  delete next.injuryEndDate;
  return next;
}

/** Turn a validated form bill into the submission contract (saved-provider references, wire claim). */
export function completeBillSubmissionInput(bill: BillSubmissionInput): CompleteBillSubmissionInput {
  return {
    ...bill,
    ...(bill.billingProvider?.savedProviderId ? { billingProvider: { savedProviderId: bill.billingProvider.savedProviderId } } : {}),
    ...(bill.billingProvider?.sourceBillId ? { billingProvider: { sourceBillId: bill.billingProvider.sourceBillId } } : {}),
    claim: submittedBillSubmissionClaim(bill.claim),
  } as CompleteBillSubmissionInput;
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
  initialBill, idempotencyKey, attachments = EMPTY_ATTACHMENTS, onSubmit, onSubmitted, getSession, sessionEndpoint, apiBaseUrl,
  profileOptions, billingSettings, onManageSettings, reportAutofill, profileDisplay = "auto",
  fetch: fetchOverride, onListMedicalProviderNetworks, onListClaimsAdministrators, onSearchClaimsAdministrators, onGetClaimsAdministratorDirectory, claimsAdministratorSources, claimsAdministratorHint,
  diagnosisOptions = [], onSearchDiagnoses,
  onLookupPostalCode, procedureOptions, draft, onSaveDraft, saveDraftLabel = "Save draft", treatmentBilling = false, companionLines, linkedAuthorizations, evaluationTypes, editableTreatmentCharges = false, showFeeEstimates = true, onSearchProcedureCodes, onQuoteFee, onQuoteEncounter, describeProcedureCode, modifierOptions, taxonomyOptions, deliveryRoutePicker = "auto", deliveryRouteDialogTitle = "Send bill", attachmentReportTypeMode = "auto",
  attachmentReportTypes = BILL_SUBMISSION_REPORT_TYPES, defaultAttachmentReportType: hostDefaultAttachmentReportType, initialUploads,
  appearance, className = "bill-submission-form",
  style, disabled = false, submitLabel = "Submit bill", heading = "Bill information",
  description = "Review the bill details, add attachments, and submit.",
  attentionFields = [], attentionMessage, insuranceCarrierName, analytics, onAnalyticsEvent,
  children,
}: BillSubmissionFormProps): ReactElement {
  const track = useMindBillAnalytics("BillSubmissionForm", { ...(analytics !== undefined ? { analytics } : {}), ...(onAnalyticsEvent ? { onAnalyticsEvent } : {}) });
  const [bill, setBill] = useState(() => cloneInitialBill(initialBill, treatmentBilling));
  const [diagnosisLimitNotice, setDiagnosisLimitNotice] = useState(() => limitBillSubmissionDiagnoses(initialBill).notice);
  const [sharedDiagnoses, setSharedDiagnoses] = useState(() => billSubmissionUsesSharedDiagnoses(cloneInitialBill(initialBill, treatmentBilling)));
  const individualDiagnoses = useRef<string[][] | null>(null);
  const [providerEditing, setProviderEditing] = useState(false);
  /** Saved provider and location choices the user opened with Edit. */
  const [openSections, setOpenSections] = useState<BillSubmissionProfileSection[]>([]);
  const formId = useId();
  const [selectedIds, setSelectedIds] = useState(() => attachments.map((item) => item.id));
  const [removedSourceIds, setRemovedSourceIds] = useState<string[]>([]);
  const [uploads, setUploads] = useState<BillSubmissionUpload[]>(() => [...(initialUploads ?? [])]); const [errors, setErrors] = useState<Record<string, string>>({});
  const [sourceAttachmentReportTypes, setSourceAttachmentReportTypes] = useState<Record<string, string>>(() => Object.fromEntries(attachments.flatMap((item) => item.reportTypeCode ? [[item.id, item.reportTypeCode]] : [])));
  const [validationActive, setValidationActive] = useState(false);
  const [formError, setFormError] = useState<string | null>(null); const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [cmsPreview, setCmsPreview] = useState<{ url: string; billKey: string } | null>(null);
  const previewRequest = useRef(0);
  useEffect(() => () => { previewRequest.current++; }, []);
  useEffect(() => {
    return () => { if (cmsPreview) URL.revokeObjectURL(cmsPreview.url); };
  }, [cmsPreview]);
  // The delivery-method dialog staged with the validated bill.
  const [routeDialog, setRouteDialog] = useState<{ delivery: BillDeliveryOptions; value: BillSubmissionFormValue } | null>(null);
  /** Facts MindBill asked the biller to confirm for a line at submission, keyed by line index (cleared when its code changes). */
  const [lineAttestations, setLineAttestations] = useState<Record<number, LineAttestation>>({});
  const [routeError, setRouteError] = useState<string | null>(null);
  const [payerResults, setPayerResults] = useState<BillReviewPayer[]>([]); const [payerLoading, setPayerLoading] = useState(false);
  const [payerSuggestions, setPayerSuggestions] = useState<BillReviewPayerSuggestion[]>([]);
  const [selectedPayerMetadata, setSelectedPayerMetadata] = useState<BillReviewPayer | null>(null);
  const [payerLoadingMore, setPayerLoadingMore] = useState(false); const [payerQuery, setPayerQuery] = useState<string | null>(null); const [payerHasMore, setPayerHasMore] = useState(true);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [payerAutoPick, setPayerAutoPick] = useState<BillSubmissionPayerSuggestion | null>(null);
  const [autofillCarrier, setAutofillCarrier] = useState<string | undefined>(undefined);
  /** Administrators whose payer list was already loaded for a host- or correction-supplied selection. */
  const hydratedAdministrators = useRef(new Set<string>());
  const [directory, setDirectory] = useState<BillClaimsAdministratorDirectory | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [diagnosisResults, setDiagnosisResults] = useState<BillSubmissionDiagnosisOption[]>([]);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false); const [diagnosisLoadingMore, setDiagnosisLoadingMore] = useState(false);
  const [diagnosisQuery, setDiagnosisQuery] = useState<string | null>(null); const [diagnosisHasMore, setDiagnosisHasMore] = useState(true);
  const [procedureResults, setProcedureResults] = useState<BillSubmissionProcedureOption[]>([]);
  const [procedureLoading, setProcedureLoading] = useState(false);
  const [procedureError, setProcedureError] = useState<string | null>(null);
  const procedureRequest = useRef(0);
  const [professionalComponentCodes, setProfessionalComponentCodes] = useState<string[]>([]);
  const componentIdentity = (code: string, modifiers: readonly string[] = []) => JSON.stringify([code.trim().toUpperCase(), [...modifiers].sort()]);
  const [feeDetails, setFeeDetails] = useState<Record<number, FeeDetails>>({});
  // Line dates follow the bill date of service; a line shows its own dates only when they differ or are requested.
  const [separateLineDates, setSeparateLineDates] = useState<number[]>([]);
  const [feeQuotes, setFeeQuotes] = useState<Record<string, BillFeeQuote | { status: "error"; reason: string }>>({});
  // One result per line for the exact batch it was calculated from; another line's change re-prices every line.
  // Lines whose billed charge the biller or host entered. Only the other lines are prefilled from the practice charge.
  const enteredCharges = useRef<Set<number> | null>(null);
  if (!enteredCharges.current) enteredCharges.current = new Set(initialBill.serviceLines.flatMap((line, index) => Number.isFinite(line.charge) ? [index] : []));
  const [encounterQuotes, setEncounterQuotes] = useState<{ batch: string; quotes: Array<BillFeeQuote | { status: "error"; reason: string } | null> } | null>(null);
  const [postalStatus, setPostalStatus] = useState<string | null>(null); const [dragActive, setDragActive] = useState(false);
  const serviceLinesRef = useRef<HTMLDivElement>(null);
  const [stackedServiceLines, setStackedServiceLines] = useState(true);
  // Charge, Expected (OMFS) and Difference need more room before the table stacks.
  const wideServiceLines = Boolean(onQuoteEncounter) && treatmentBilling && editableTreatmentCharges && showFeeEstimates;
  useEffect(() => {
    const element = serviceLinesRef.current;
    if (!element) return;
    const update = () => setStackedServiceLines(element.clientWidth <= (wideServiceLines ? 1040 : 906));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [wideServiceLines]);
  const formRef = useRef<HTMLFormElement>(null); const fileInput = useRef<HTMLInputElement>(null);
  // form_viewed fires once, when the form first becomes visible (or on mount without IntersectionObserver).
  useEffect(() => {
    const element = formRef.current;
    if (!element || typeof IntersectionObserver === "undefined") { track("form_viewed"); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { track("form_viewed"); observer.disconnect(); }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [track]);
  const diagnosisRequest = useRef(0); const diagnosisAppendPending = useRef(false); const payerRequest = useRef(0); const payerAppendPending = useRef(false);
  const procedures = useMemo(() => mergeOptions(DEFAULT_BILL_SUBMISSION_PROCEDURES, [...procedureResults.filter((result) => !DEFAULT_BILL_SUBMISSION_PROCEDURES.some((item) => item.code.toUpperCase() === result.code.toUpperCase())), ...(procedureOptions ?? []), ...(treatmentBilling ? [{code: "WC002", description: "Progress report"}, {code: "WC003", description: "Permanent and stationary report (PR-3)"}, {code: "WC004", description: "Permanent and stationary report (PR-4)"}] : [])]), [procedureOptions, procedureResults, treatmentBilling]);
  const orderedClaimsAdministratorSources = useMemo(() => [...(claimsAdministratorSources ?? [])]
    .filter((source) => source.name.trim())
    .sort((left, right) => Number(right.source.toLowerCase() === "eams") - Number(left.source.toLowerCase() === "eams")), [claimsAdministratorSources]);
  const sourceClaimsAdministratorName = orderedClaimsAdministratorSources[0]?.name.trim() ?? "";
  const initializationKey = useMemo(
    () => `${treatmentBilling}:${billSubmissionInitializationKey(initialBill, attachments, sourceClaimsAdministratorName)}`,
    [initialBill, attachments, sourceClaimsAdministratorName, treatmentBilling],
  );
  const previousInitializationKey = useRef(initializationKey);

  const taxonomies = useMemo(() => mergeOptions(DEFAULT_BILL_SUBMISSION_TAXONOMIES, taxonomyOptions), [taxonomyOptions]);
  void evaluationTypes;
  const connected = !onSubmit;
  const referenceClient = useMemo(() => (getSession || sessionEndpoint || connected) ? createBillReferenceClient({ getSession, sessionEndpoint, apiBaseUrl, fetch: fetchOverride }) : null, [getSession, sessionEndpoint, apiBaseUrl, fetchOverride, connected]);
  const submissionClient = useMemo(() => connected ? createBillSubmissionClient({ getSession, sessionEndpoint, apiBaseUrl, fetch: fetchOverride }) : null, [getSession, sessionEndpoint, apiBaseUrl, fetchOverride, connected]);
  const previewClient = useMemo(() => (getSession || sessionEndpoint || connected) ? createBillSubmissionClient({ getSession, sessionEndpoint, apiBaseUrl, fetch: fetchOverride }) : null, [getSession, sessionEndpoint, apiBaseUrl, fetchOverride, connected]);
  const profileClient = useMemo(() => profileOptions === undefined && (getSession || sessionEndpoint || connected)
    ? createOrganizationClient({ ...(getSession ? { getSession } : {}), ...(sessionEndpoint ? { sessionEndpoint } : {}), ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}) }) : null,
  [profileOptions, getSession, sessionEndpoint, apiBaseUrl, fetchOverride, connected]);
  const [loadedProfiles, setLoadedProfiles] = useState<{ client: typeof profileClient; options?: BillSubmissionProfileOptions; error?: string } | null>(null);
  const [profileRetry, setProfileRetry] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsPanel = useRef<HTMLElement | null>(null);
  const [doctorPanel, setDoctorPanel] = useState<null | "add" | "signature">(null);
  const [doctorNote, setDoctorNote] = useState("");
  // Saving doctors/signatures from the bill form uses the separate organization:manage connection only.
  const settingsClient = useMemo(() => billingSettings ? createOrganizationClient({
    ...(billingSettings.getSession ? { getSession: billingSettings.getSession } : {}),
    ...(billingSettings.sessionEndpoint ? { sessionEndpoint: billingSettings.sessionEndpoint } : {}),
    ...(billingSettings.apiBaseUrl ? { apiBaseUrl: billingSettings.apiBaseUrl } : {}),
    ...(billingSettings.fetch ? { fetch: billingSettings.fetch } : {}),
  }) : null, [billingSettings?.getSession, billingSettings?.sessionEndpoint, billingSettings?.apiBaseUrl, billingSettings?.fetch]);
  // Without billingSettings, the form's own organization-wide bills:create session adds doctors and
  // saves their signatures (servers from 2026-10-28). Older servers refuse; then details fill this bill only.
  const billDoctorClient = useMemo(() => !billingSettings && (getSession || sessionEndpoint || connected)
    ? createOrganizationClient({ ...(getSession ? { getSession } : {}), ...(sessionEndpoint ? { sessionEndpoint } : {}), ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}) }) : null,
  [billingSettings, getSession, sessionEndpoint, apiBaseUrl, fetchOverride, connected]);
  const [billDoctorWrites, setBillDoctorWrites] = useState(true);
  const doctorClient = settingsClient ?? (billDoctorWrites ? billDoctorClient : null);
  // The settings panel renders below the form; bring it into view when opened.
  useEffect(() => { if (settingsOpen) settingsPanel.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); }, [settingsOpen]);
  useEffect(() => {
    let alive = true;
    if (profileClient) {
      setLoadedProfiles(null);
      void profileClient.getBillingProfile().then((profile) => {
        if (alive) setLoadedProfiles({ client: profileClient, options: organizationProfileOptions(profile) });
      }).catch(() => { if (alive) setLoadedProfiles({ client: profileClient, error: "Saved practice settings could not be loaded. You can retry or enter the details below." }); });
    }
    return () => { alive = false; };
  }, [profileClient, profileRetry]);
  const availableProfiles = loadedProfiles?.client === profileClient && loadedProfiles.options ? loadedProfiles.options : profileOptions;
  const [savingDraft, setSavingDraft] = useState(false);
  const locked = disabled || submitting || savingDraft;
  const medLegal = isMedicalLegalBillSubmission(bill, treatmentBilling);
  const analyticsBillingMode = medLegal ? "med_legal" as const : "professional" as const;
  const showAttachmentReportTypes = attachmentReportTypeMode === "visible" || (attachmentReportTypeMode === "auto" && !medLegal);
  // A treatment (professional) bill's supporting report is normally the PR-2 progress report (PWK 09).
  const defaultAttachmentReportType = hostDefaultAttachmentReportType ?? (treatmentBilling && bill.billingMode === "professional" ? TREATMENT_PROGRESS_REPORT_TYPE_CODE : undefined);
  const forcedAttachmentReportType = showAttachmentReportTypes ? undefined : (defaultAttachmentReportType ?? MED_LEGAL_REPORT_TYPE_CODE);
  const reportTypeOptions = useMemo(() => attachmentReportTypes.map((item) => ({ id: item.code, label: item.code.replace(/^OZ:/, ""), detail: item.label })), [attachmentReportTypes]);
  const missingAttachmentReportType = showAttachmentReportTypes && (
    selectedIds.some((id) => !(sourceAttachmentReportTypes[id] || attachments.find((item) => item.id === id)?.reportTypeCode || defaultAttachmentReportType))
    || uploads.some((upload) => !(upload.reportTypeCode || defaultAttachmentReportType))
  );

  useEffect(() => {
    if (previousInitializationKey.current === initializationKey) return;
    previousInitializationKey.current = initializationKey;
    setFeeDetails({}); setFeeQuotes({}); setProfessionalComponentCodes([]);
    setSharedDiagnoses(billSubmissionUsesSharedDiagnoses(cloneInitialBill(initialBill, treatmentBilling))); individualDiagnoses.current = null;
    setBill(cloneInitialBill(initialBill, treatmentBilling)); setDiagnosisLimitNotice(limitBillSubmissionDiagnoses(initialBill).notice); setSelectedIds(attachments.map((item) => item.id));
    setOpenSections([]);
    enteredCharges.current = new Set(initialBill.serviceLines.flatMap((line, index) => Number.isFinite(line.charge) ? [index] : []));
    setRemovedSourceIds([]); setUploads([]); setSourceAttachmentReportTypes(Object.fromEntries(attachments.flatMap((item) => item.reportTypeCode ? [[item.id, item.reportTypeCode]] : []))); setErrors({}); setValidationActive(false); setFormError(null); setDiagnosisResults([]);
    setDiagnosisQuery(null); setDiagnosisHasMore(true); diagnosisRequest.current += 1; diagnosisAppendPending.current = false;
    setPayerResults([]); setPayerSuggestions([]); setSelectedPayerMetadata(null); setPayerQuery(null); setPayerHasMore(true); payerRequest.current += 1; payerAppendPending.current = false;
    setPayerAutoPick(null); hydratedAdministrators.current.clear();
  }, [initialBill, attachments, initializationKey, treatmentBilling]);
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
    setUploads((current) => [...current, ...files.map((file) => ({ file, documentType: medLegal ? medicalLegalUploadDocumentType(file.name) : "other" as const, ...(defaultAttachmentReportType ? { reportTypeCode: defaultAttachmentReportType } : {}) }))]);
  }, [defaultAttachmentReportType, medLegal, selectedIds.length, uploads]);
  useEffect(() => {
    const over = (event: DragEvent) => { if (event.dataTransfer?.types.includes("Files")) { event.preventDefault(); setDragActive(true); } };
    const leave = (event: DragEvent) => { if (!event.relatedTarget) setDragActive(false); };
    const drop = (event: DragEvent) => { if (event.dataTransfer?.files.length) { event.preventDefault(); setDragActive(false); addFiles(event.dataTransfer.files); } };
    window.addEventListener("dragover", over); window.addEventListener("dragleave", leave); window.addEventListener("drop", drop);
    return () => { window.removeEventListener("dragover", over); window.removeEventListener("dragleave", leave); window.removeEventListener("drop", drop); };
  }, [addFiles]);

  const setAddress = (patch: Partial<BillSubmissionAddress>) => setBill((current) => ({ ...current, patient: { ...current.patient, address: { ...current.patient.address, ...patch } } }));
  const setLine = (index: number, patch: Partial<BillSubmissionInput["serviceLines"][number]>) => {
    if (patch.code != null && patch.code !== bill.serviceLines[index]?.code) enteredCharges.current?.delete(index);
    if (Object.hasOwn(patch, "code") || Object.hasOwn(patch, "modifiers")) setProfessionalComponentCodes([]);
    if (Object.hasOwn(patch, "modifiers")) setFeeDetails((current) => ({ ...current, [index]: { ...detailsForLine(index), interpretationLocation: "", professionalComponentBasis: "" } }));
    if (Object.hasOwn(patch, "code")) setFeeDetails((current) => ({ ...current, [index]: {} }));
    setBill((current) => {
      const added = patch.code != null && patch.code !== current.serviceLines[index]?.code
        ? Object.entries(companionLines ?? {}).find(([code]) => code.trim().toUpperCase() === patch.code!.trim().toUpperCase())?.[1] : undefined;
      const serviceLines = ensureTrailingBillSubmissionLine(withAddedBillSubmissionLines(current.serviceLines.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, ...patch };
        if (patch.code != null && patch.code !== line.code) { delete next.rfaItemId; delete next.feeContext; delete next.drug; }
        // A new professional line starts pointed at the claim's first diagnoses (A–D), like the case's.
        if (!sharedDiagnoses && patch.code?.trim() && !line.code.trim() && !line.diagnosisPointers?.length && !isMedicalLegalCode(patch.code)) {
          next.diagnosisPointers = defaultBillSubmissionLinePointers(current);
        }
        if (patch.code != null && patch.code !== line.code && (patch.units === undefined || patch.units === line.units)) {
          const startingUnits = (code: string) => procedures.find((item) => item.code.toUpperCase() === code.trim().toUpperCase())?.defaultUnits ?? 1;
          // Replace only an untouched quantity; a quantity the biller entered stays.
          if ((line.units ?? 1) === startingUnits(line.code)) next.units = startingUnits(patch.code);
        }
        if (treatmentBilling && next.code && !isMedicalLegalCode(next.code)) {
          if (!editableTreatmentCharges || (patch.code != null && patch.code !== line.code)) delete next.charge;
          return next;
        }
        const charge = calculateBillSubmissionAllowedAmount(next, procedures);
        if (charge != null) return { ...next, charge };
        if (Object.hasOwn(patch, "code")) delete next.charge;
        return next;
      }), added));
      const populated = serviceLines.filter((line) => line.code.trim());
      const replaced = linkBillSubmissionAuthorizations(replaceBillSubmissionServiceLines(current, serviceLines), linkedAuthorizations);
      return { ...(sharedDiagnoses ? setBillSubmissionSharedDiagnoses(replaced, current.diagnoses ?? []) : replaced), ...(treatmentBilling && populated.length ? { billingMode: billingModeForLines(populated) } : {}) };
    });
  };
  const setLineCharge = (index: number, charge: number | undefined) => { enteredCharges.current?.add(index); setBill((current) => ({
    ...current,
    serviceLines: current.serviceLines.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      const next = { ...line };
      if (charge === undefined) delete next.charge;
      else next.charge = charge;
      return next;
    }),
  })); };
  const text = (value: string | null | undefined, onChange: (value: string) => void, options: Pick<React.InputHTMLAttributes<HTMLInputElement>, "placeholder" | "maxLength" | "type" | "inputMode"> = {}) => <input className="mbsf-input" disabled={locked} value={value ?? ""} onChange={(event) => onChange(event.target.value)} {...options} />;
  const loadPayers = useCallback((query: string, append = false): void => {
    const trimmed = query.trim();
    const list = onListClaimsAdministrators ?? referenceClient?.listClaimsAdministrators;
    const legacySearch = onSearchClaimsAdministrators ?? referenceClient?.searchClaimsAdministrators;
    if (!list && !legacySearch) return;
    const continuing = append && payerQuery === trimmed;
    if (continuing && (!payerHasMore || payerAppendPending.current)) return;
    const offset = continuing ? payerResults.length : 0;
    const request = ++payerRequest.current;
    if (continuing) { payerAppendPending.current = true; setPayerLoadingMore(true); }
    else { setPayerLoading(true); setPayerLoadingMore(false); setPayerQuery(trimmed); setPayerHasMore(true); }
    const page: Promise<BillReviewPayerPage> = list
      ? list({ query: trimmed, claimNumber: bill.claim.claimNumber, ...(sourceClaimsAdministratorName ? { sourceClaimsAdministratorName } : {}), ...(bill.claim.employer ? { employerName: bill.claim.employer } : {}), limit: PAYER_PAGE_SIZE, offset })
      : legacySearch!(trimmed, bill.claim.claimNumber).then((results): BillReviewPayerPage => ({ results, total: results.length }));
    void page.then((result) => {
      if (request !== payerRequest.current) return;
      setPayerResults((current) => {
        const combined = continuing ? [...current, ...result.results] : result.results;
        return [...new Map(combined.map((payer) => [payer.id, payer])).values()];
      });
      if (!continuing) setPayerSuggestions(result.suggestions ?? []);
      setPayerHasMore(result.nextOffset != null ? result.nextOffset > offset : offset + result.results.length < result.total);
    }).catch((caught: unknown) => {
      if (request === payerRequest.current) setFormError(caught instanceof Error ? caught.message : "Claims administrator search is unavailable.");
    }).finally(() => {
      if (request !== payerRequest.current) return;
      payerAppendPending.current = false; setPayerLoading(false); setPayerLoadingMore(false);
    });
  }, [bill.claim.claimNumber, bill.claim.employer, onListClaimsAdministrators, onSearchClaimsAdministrators, payerHasMore, payerQuery, payerResults.length, referenceClient, sourceClaimsAdministratorName]);
  // A claims administrator supplied by the host or carried over by a correction arrives without its payer list.
  // Load it once so a multi-payer administrator shows the payer picker with the carried-over (or suggested) payer.
  const latestBill = useRef(bill); latestBill.current = bill;
  const latestCarriers = useRef<(string | undefined)[]>([]); latestCarriers.current = [insuranceCarrierName, autofillCarrier];
  const hydrateAdministrator = bill.claim.claimsAdministrator?.id && bill.claim.claimsAdministrator.payerSelectionRequired === undefined && !bill.claim.claimsAdministrator.payers
    ? JSON.stringify([bill.claim.claimsAdministrator.id, bill.claim.claimsAdministrator.name]) : "";
  useEffect(() => {
    if (!hydrateAdministrator) return;
    const [id, name] = JSON.parse(hydrateAdministrator) as [string, string];
    if (hydratedAdministrators.current.has(id)) return;
    const list = onListClaimsAdministrators ?? referenceClient?.listClaimsAdministrators;
    const legacySearch = onSearchClaimsAdministrators ?? referenceClient?.searchClaimsAdministrators;
    if (!list && !legacySearch) return;
    hydratedAdministrators.current.add(id);
    const lookup = list ? list({ query: name, limit: PAYER_PAGE_SIZE }).then((page) => page.results) : legacySearch!(name);
    void Promise.resolve(lookup).then((results) => {
      const payer = results.find((candidate) => candidate.id === id);
      const selected = latestBill.current.claim.claimsAdministrator;
      if (!payer || selected?.id !== id || selected.payerSelectionRequired !== undefined) return;
      setSelectedPayerMetadata(payer);
      if (!payer.payerSelectionRequired) return;
      const carried = selected.payerId && payer.payers?.some((option) => option.id === selected.payerId) ? selected.payerId : undefined;
      const suggestion = carried ? null : suggestBillSubmissionPayer(payer, latestCarriers.current);
      setPayerAutoPick(suggestion);
      setBill((current) => current.claim.claimsAdministrator?.id === id && current.claim.claimsAdministrator.payerSelectionRequired === undefined
        ? { ...current, claim: { ...current.claim, claimsAdministrator: chooseClaimsAdministrator(payer, carried ?? suggestion?.payerId) } }
        : current);
    }).catch(() => { hydratedAdministrators.current.delete(id); });
  }, [hydrateAdministrator, onListClaimsAdministrators, onSearchClaimsAdministrators, referenceClient]);
  const searchPayers = (query: string) => {
    setSelectedPayerMetadata(null);
    setBill((current) => {
      const selected = current.claim.claimsAdministrator;
      if (selected?.id && selected.name === query) return current;
      return { ...current, claim: { ...current.claim, claimsAdministrator: { name: query } } };
    });
    loadPayers(query);
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
  const loadProcedures = (query: string) => {
    if (!treatmentBilling) return;
    const search = onSearchProcedureCodes ?? referenceClient?.searchProcedureCodes;
    if (!search) return;
    const normalized = query.trim().toUpperCase();
    const request = ++procedureRequest.current;
    if (!/^[A-Z0-9]{0,5}$/.test(normalized) || /^ML/.test(normalized)) { setProcedureResults([]); setProcedureLoading(false); return; }
    setProcedureLoading(true); setProcedureError(null);
    void search({ query: normalized, limit: 30, jurisdiction: bill.claim.injuryState === "NY" ? "NY" : "CA" }).then((page) => {
      if (request === procedureRequest.current) setProcedureResults(page.results.map((item) => ({ code: item.code, description: describeProcedureCode?.(item.code) ?? item.description ?? "Treatment procedure" })));
    }).catch(() => { if (request === procedureRequest.current) { setProcedureResults([]); setProcedureError("Treatment code search is unavailable. Try again."); } }).finally(() => { if (request === procedureRequest.current) setProcedureLoading(false); });
  };
  const searchDiagnoses = (query: string) => loadDiagnoses(query);
  const diagnosisChoices = useMemo(() => mergeDiagnosisOptions([...diagnosisOptions, ...diagnosisResults]), [diagnosisOptions, diagnosisResults]);
  const updatePostalCode = (postalCode: string) => {
    setAddress({ postalCode }); setPostalStatus(null); const lookup = onLookupPostalCode ?? referenceClient?.lookupPostalCode;
    if (!lookup || !/^\d{5}$/.test(postalCode)) return;
    setPostalStatus("Looking up ZIP…"); void lookup(postalCode).then((place) => { if (!place) return setPostalStatus("ZIP not found"); setAddress({ city: place.city, state: place.state.toUpperCase() }); setPostalStatus(`${place.city}, ${place.state.toUpperCase()} filled from ZIP`); }).catch(() => setPostalStatus("ZIP lookup unavailable"));
  };
  const supportedFeeJurisdiction = (bill.claim.injuryState ?? "CA").trim().toUpperCase() === "CA";
  const prolongedLeader = (index: number) => bill.serviceLines.findIndex((candidate) => isProlongedCode(candidate.code) && parseBillSubmissionDate(candidate.serviceDate ?? bill.service.date) === parseBillSubmissionDate(bill.serviceLines[index]!.serviceDate ?? bill.service.date));
  const detailsForLine = (index: number): FeeDetails => {
    const line = bill.serviceLines[index]!;
    const detailsIndex = isProlongedCode(line.code) ? prolongedLeader(index) : index;
    const saved = bill.serviceLines[detailsIndex]?.feeContext;
    const prolonged = saved?.prolongedServiceContext;
    const details: FeeDetails = feeDetails[detailsIndex] ?? {
      ...drugDetailsFromSaved(line.drug, saved),
      ...anesthesiaDetailsFromSaved(saved),
      ...therapyDetailsFromSaved(saved),
      interpretationLocation: saved?.professionalComponentContext?.interpretationLocation,
      professionalComponentBasis: saved?.catalogContext?.codingRequirementsSatisfied && saved.physicianContext?.standaloneService && saved.physicianContext.globalPeriodApplies === false && saved.physicianContext.hpsaBonusEligible === false && saved.physicianContext.incidentToPhysicianService !== true ? "standard" : "",
      residenceZip: saved?.dmeposContext?.residenceZip,
      rentalMonth: saved?.dmeposContext?.rentalMonth?.toString(),
      priorPayments: saved?.dmeposContext?.priorPaymentsCents !== undefined ? (saved.dmeposContext.priorPaymentsCents / 100).toFixed(2) : undefined,
      providerKind: saved?.physicianContext?.providerKind ?? saved?.therapyContext?.providerKind,
      minutes: saved?.therapyContext?.directOneOnOneMinutes,
      totalMinutes: prolonged?.totalMinutes ?? saved?.therapyContext?.totalVisitMinutes,
      relatedEvaluationDate: prolonged?.relatedEvaluationDate,
      prolongedTimeBasis: prolonged?.ongoingPatientManagement && prolonged.personallyPerformed && !prolonged.timeCountedInOtherServices && prolonged.completeSameDayServices ? "documented" : "",
    };
    // The rendering provider already identifies the provider type; the line selector remains an override.
    const impliedKind = isTherapyEditorCode(line.code) ? undefined : billSubmissionProviderKindForTaxonomy(bill.renderingProvider?.taxonomy);
    return details.providerKind === undefined && impliedKind ? { ...details, providerKind: impliedKind } : details;
  };
  const quoteInputs = bill.serviceLines.map((line, index) => {
    if (!treatmentBilling || !line.code.trim() || isMedicalLegalCode(line.code)) return null;
    const details = detailsForLine(index);
    const baseContext = billSubmissionCalculationContext(line.code, bill.serviceLocation?.placeOfServiceCode ?? "", details, line.feeContext, line.modifiers);
    const component = isProfessionalComponentCandidate(line.code, line.modifiers) || professionalComponentCodes.includes(componentIdentity(line.code, line.modifiers));
    const context = details.basis === "adjustment" ? {} : professionalComponentCalculationContext(baseContext, details, component);
    const currentLine = { ...line };
    if (line.drug?.administered || drugFieldsEnabled(line.code, details) || details.drugEnabled !== undefined) delete currentLine.drug;
    const drug = details.basis === "adjustment" ? undefined : drugRequestDetails(line.code, bill.serviceLocation?.placeOfServiceCode ?? "", details).drug;
    if (drug) currentLine.drug = drug;
    return billSubmissionFeeRequest(bill, currentLine, context);
  });
  const quoteKeys = quoteInputs.map((input) => input ? JSON.stringify(input) : null);
  const quoteBatch = JSON.stringify(quoteInputs);
  const quoteFee = onQuoteFee ?? referenceClient?.quoteFee;
  const [feeRetry, setFeeRetry] = useState(0);
  const encounterQuoting = Boolean(onQuoteEncounter) && treatmentBilling;
  // Treatment encounters show charge, expected OMFS payment and difference side by side.
  const encounterColumns = encounterQuoting && editableTreatmentCharges;
  const estimateColumns = encounterColumns && showFeeEstimates;
  useEffect(() => {
    if (!onQuoteEncounter || !treatmentBilling) return;
    let active = true;
    const inputs = JSON.parse(quoteBatch) as Array<BillFeeQuoteInput | null>;
    const indexes = inputs.flatMap((input, index) => input && input.dateOfService && supportedFeeJurisdiction ? [index] : []);
    if (!indexes.length) { setEncounterQuotes({ batch: quoteBatch, quotes: inputs.map(() => null) }); return; }
    const timer = setTimeout(() => {
      void onQuoteEncounter(indexes.map((index) => inputs[index]!)).then((results) => {
        if (!active) return;
        const quotes: Array<BillFeeQuote | null> = inputs.map(() => null);
        indexes.forEach((lineIndex, position) => { quotes[lineIndex] = results[position] ?? null; });
        setEncounterQuotes({ batch: quoteBatch, quotes });
      }).catch(() => { if (active) setEncounterQuotes({ batch: quoteBatch, quotes: inputs.map((input) => input ? { status: "error" as const, reason: "Fee lookup is unavailable. Retry the fee check." } : null) }); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [quoteBatch, onQuoteEncounter, treatmentBilling, feeRetry, supportedFeeJurisdiction]);
  /** The quote shown for a line: the encounter result for this exact batch, or the per-line quote. */
  const quoteAt = (index: number) => {
    if (encounterQuoting) return encounterQuotes?.batch === quoteBatch ? encounterQuotes.quotes[index] ?? undefined : undefined;
    const key = quoteKeys[index]; return key ? feeQuotes[key] : undefined;
  };
  useEffect(() => {
    if (encounterQuoting) return;
    let active = true;
    const inputs = JSON.parse(quoteBatch) as Array<BillFeeQuoteInput | null>;
    const unique = new Map(inputs.filter((input): input is BillFeeQuoteInput => Boolean(input)).map((input) => [JSON.stringify(input), input]));
    const timer = setTimeout(() => { for (const [key, input] of unique) {
      if (!quoteFee || !input.dateOfService || !supportedFeeJurisdiction || (isTherapyEditorCode(input.code) && !input.therapyContext)) continue;
      void quoteFee(input).then((result) => { if (active) { setFeeQuotes((current) => ({ ...current, [key]: result })); if (isProfessionalComponentCandidate(input.code, input.modifiers, result)) { const identity = componentIdentity(input.code, input.modifiers); setProfessionalComponentCodes((current) => current.includes(identity) ? current : [...current, identity]); } } }).catch(() => { if (active) setFeeQuotes((current) => ({ ...current, [key]: { status: "error", reason: "Fee lookup is unavailable. Retry the fee check." } })); });
    }
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [quoteBatch, quoteFee, feeRetry, supportedFeeJurisdiction, encounterQuoting]);
  const lineCharge = (line: BillSubmissionInput["serviceLines"][number], index: number) => {
    if (treatmentBilling && line.code && !isMedicalLegalCode(line.code)) {
      if (editableTreatmentCharges) return Number.isFinite(line.charge) ? Number(line.charge) : undefined;
      const quote = quoteAt(index);
      return supportedFeeJurisdiction && detailsForLine(index).basis !== "adjustment" && quote?.status === "priced" ? quote.amountCents / 100 : undefined;
    }
    return calculateBillSubmissionAllowedAmount(line, procedures) ?? (Number.isFinite(line.charge) ? Number(line.charge) : undefined);
  };
  // In the encounter editor, an empty treatment charge starts at the practice's saved charge for the code, else the expected OMFS amount,
  // so totals and Difference are meaningful. A charge the biller typed is never replaced. The charge is not part
  // of the quote request, so filling it does not re-price the visit.
  const suggestedCharges = bill.serviceLines.map((line, index) => {
    if (!encounterColumns || !line.code.trim() || isMedicalLegalCode(line.code) || enteredCharges.current?.has(index)) return null;
    if (!supportedFeeJurisdiction || detailsForLine(index).basis === "adjustment") return null;
    const quote = quoteAt(index);
    if (quote?.status !== "priced") return null;
    // Without visible estimates, only the practice's own saved charge is suggested: the biller enters the rest.
    const cents = showFeeEstimates ? quote.practiceChargeCents ?? quote.chargeAmountCents ?? quote.amountCents : quote.practiceChargeCents;
    return cents != null && cents > 0 ? { code: line.code, charge: cents / 100 } : null;
  });
  const suggestedChargeKey = JSON.stringify(suggestedCharges);
  useEffect(() => {
    const suggested = JSON.parse(suggestedChargeKey) as Array<{ code: string; charge: number } | null>;
    if (!suggested.some(Boolean)) return;
    setBill((current) => {
      let changed = false;
      const serviceLines = current.serviceLines.map((line, index) => {
        const suggestion = suggested[index];
        if (!suggestion || suggestion.code !== line.code || enteredCharges.current?.has(index) || line.charge === suggestion.charge) return line;
        changed = true;
        return { ...line, charge: suggestion.charge };
      });
      return changed ? { ...current, serviceLines } : current;
    });
  }, [suggestedChargeKey]);
  const feeDetailsFor = (line: BillSubmissionInput["serviceLines"][number], index: number): ReactNode => {
    const key = quoteKeys[index];
    if (!key && !(editableTreatmentCharges && treatmentBilling && line.code && !isMedicalLegalCode(line.code))) return null;
    const quote = supportedFeeJurisdiction && key ? quoteAt(index) : undefined;
    const details = detailsForLine(index);
    const prolonged = isProlongedCode(line.code);
    const anesthesia = isAnesthesiaCandidate(line.code);
    const detailsIndex = prolonged ? prolongedLeader(index) : index;
    const update = (patch: Partial<FeeDetails>) => setFeeDetails((current) => ({ ...current, [detailsIndex]: { ...details, ...patch } }));
    if (prolonged && detailsIndex !== index) return <p className="mbsf-help mbsf-fee-details">Uses the prolonged-service details on line {detailsIndex + 1}.{quote?.status !== "priced" ? ` ${feeReviewMessage(quote?.reason)}` : ""}</p>;
    const component = supportedFeeJurisdiction && (isProfessionalComponentCandidate(line.code, line.modifiers, quote?.status === "error" ? undefined : quote) || professionalComponentCodes.includes(componentIdentity(line.code, line.modifiers)));
    const therapy = isTherapyEditorCode(line.code);
    const equipment = supportedFeeJurisdiction ? equipmentFields(line.code, line.modifiers) : { residence: false, rental: false, priorPayments: false };
    // The rendering provider's taxonomy already identifies the provider type; ask only when it does not.
    const impliedKind = billSubmissionProviderKindForTaxonomy(bill.renderingProvider?.taxonomy);
    // An encounter quote uses the saved rendering provider and allocates therapy by units.
    const showProviderKind = !encounterQuoting && (therapy || !impliedKind || details.providerKind !== impliedKind);
    const therapyFields = therapy && !encounterQuoting;
    return <div className="mbsf-fee-details">
      {editableTreatmentCharges && treatmentBilling && !isMedicalLegalCode(line.code) && !encounterColumns ? <label className="mbsf-field"><span>Billed charge ($)</span><DecimalInput ariaLabel={`Billed charge for line ${index + 1}`} disabled={locked} value={line.charge} placeholder={quote?.status === "priced" && quote.chargeAmountCents != null ? (quote.chargeAmountCents / 100).toFixed(2) : undefined} onChange={(charge) => setLineCharge(index, charge)} /></label> : null}
      {prolonged ? <div className="mbsf-grid" aria-label={`Prolonged-service details for line ${index + 1}`}>
        <label className="mbsf-field"><span>Total prolonged minutes on this service date</span><input className="mbsf-input" aria-label={`Total prolonged minutes for line ${index + 1}`} type="number" min="30" max="1440" step="1" value={details.totalMinutes ?? ""} onChange={(event) => update({ totalMinutes: Number(event.target.value) })} /></label>
        <label className="mbsf-field"><span>Related evaluation date</span><DateField aria-label={`Related evaluation date for line ${index + 1}`} value={details.relatedEvaluationDate ?? ""} onChange={(choice) => update({ relatedEvaluationDate: choice })} /></label>
        <label className="mbsf-field mbsf-span"><span>Documented time basis</span><Select aria-label={`Documented time basis for line ${index + 1}`} value={details.prolongedTimeBasis ?? ""} onChange={(choice) => update({ prolongedTimeBasis: choice as FeeDetails["prolongedTimeBasis"] })}><option value="">Select from the service documentation…</option><option value="documented">Qualifying prolonged care; time counted only here</option><option value="review">Other circumstances — review needed</option></Select></label>
        <p className="mbsf-help mbsf-span">Qualifying time was personally provided for ongoing patient care related to an evaluation on a different date, and is not counted toward another service. Include every service on this date in the bill. The same time details apply to 99358 and 99359; the fee check validates minutes and units together.</p>
      </div> : null}
      {equipment.residence ? <div className="mbsf-grid" aria-label={`Equipment details for line ${index + 1}`}>
        <label className="mbsf-field"><span>Worker residence ZIP</span><input className="mbsf-input" aria-label={`Worker residence ZIP for line ${index + 1}`} inputMode="numeric" autoComplete="off" maxLength={10} value={details.residenceZip ?? ""} onChange={(event) => update({ residenceZip: event.target.value })} /></label>
        {equipment.rental ? <label className="mbsf-field"><span>Continuous rental month</span><input className="mbsf-input" aria-label={`Continuous rental month for line ${index + 1}`} type="number" min="1" max="1000" step="1" value={details.rentalMonth ?? ""} onChange={(event) => update({ rentalMonth: event.target.value })} /></label> : null}
        {equipment.priorPayments ? <label className="mbsf-field"><span>Prior payments for this item ($)</span><input className="mbsf-input" aria-label={`Prior payments for line ${index + 1}`} type="number" min="0" step="0.01" value={details.priorPayments ?? ""} onChange={(event) => update({ priorPayments: event.target.value })} /></label> : null}
        <p className="mbsf-help mbsf-span">Use the injured worker’s residence ZIP to determine the rural rate.{equipment.rental ? " Count continuous rental months for this same equipment item." : ""}{equipment.priorPayments ? " Enter actual payments already made for this item, including rentals. Enter 0 only if there were no prior payments." : ""}</p>
      </div> : null}
      {anesthesia ? <AnesthesiaLineFields index={index} details={details} update={update} /> : null}
      {!anesthesia && !equipment.residence && !prolonged && (/^[A-FH-Z]\d{4}$/.test(line.code.trim().toUpperCase()) || details.drugEnabled) ? <DrugLineFields code={line.code} index={index} details={details} update={update} showFeeEstimates={showFeeEstimates} /> : null}
      {!anesthesia && !equipment.residence && !drugFieldsEnabled(line.code, details) && (showProviderKind || component || therapyFields) ? <details open={therapyFields}><summary>Fee schedule details</summary>
      {showProviderKind ? <label className="mbsf-field"><span>Provider type</span><Select aria-label={`Provider type for line ${index + 1}`} value={details.providerKind ?? ""} onChange={(choice) => update({ providerKind: choice as NonNullable<FeeDetails["providerKind"]> })}><option value="">Select provider type…</option>{!therapy ? <><option value="physician">Physician</option><option value="physician_assistant">Physician assistant</option><option value="nurse_practitioner">Nurse practitioner</option><option value="clinical_nurse_specialist">Clinical nurse specialist</option></> : <option value="physical_therapist">Physical therapist</option>}<option value="other">Other</option></Select></label> : null}
      {component ? <div className="mbsf-grid" aria-label={`Interpretation details for line ${index + 1}`}>
        <label className="mbsf-field"><span>Interpretation location</span><Select aria-label={`Interpretation location for line ${index + 1}`} value={details.interpretationLocation ?? ""} onChange={(choice) => update({ interpretationLocation: choice as FeeDetails["interpretationLocation"] })}><option value="">Select interpretation location…</option><option value="same_as_patient_service">Same physical address as patient service</option><option value="different_from_patient_service">Different physical address</option></Select></label>
        <label className="mbsf-field"><span>Interpretation circumstances</span><Select aria-label={`Interpretation circumstances for line ${index + 1}`} value={details.professionalComponentBasis ?? ""} onChange={(choice) => update({ professionalComponentBasis: choice as FeeDetails["professionalComponentBasis"] })}><option value="">Select documented circumstances…</option><option value="standard">Standard standalone physician interpretation</option><option value="review">Other circumstances — review needed</option></Select></label>
        <p className="mbsf-help mbsf-span">Standard means one physician interpretation on this date, documented coding requirements and signed report, with no other same-day services, incident-to service, global-period adjustment or HPSA bonus. Include the report with the bill. Different interpretation addresses require fee review.</p>
      </div> : null}
      {therapyFields && !isInitialPtEvaluationCode(line.code) ? <div className="mbsf-grid"><label className="mbsf-field"><span>Direct one-on-one minutes</span><input className="mbsf-input" aria-label={`Direct one-on-one minutes for line ${index + 1}`} type="number" min="1" value={details.minutes ?? ""} onChange={(event) => update({ minutes: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="mbsf-field"><span>Total visit minutes</span><input className="mbsf-input" aria-label={`Total visit minutes for line ${index + 1}`} type="number" min="1" step="1" value={details.totalMinutes ?? ""} onChange={(event) => update({ totalMinutes: event.target.value ? Number(event.target.value) : undefined })} /></label></div> : null}
      {therapyFields ? <TherapyLineFields code={line.code} index={index} details={details} update={update} /> : null}
      </details> : null}
      {encounterQuoting && showFeeEstimates ? <EncounterLineNotes quote={quote} billedAtCharge={Number.isFinite(line.charge)} reviewMessage={quote && quote.status !== "priced" && quote.status !== "error" ? quote.message ?? feeReviewMessage(quote.reason) : undefined} /> : null}
      {encounterQuoting ? null : (() => { const message = details.basis === "adjustment" || !supportedFeeJurisdiction ? "This service requires fee review before submission." : therapy && missingTherapyDetails(details, line.code).length ? `Enter therapy details: ${missingTherapyDetails(details, line.code).join(", ")}.` : !quoteFee ? "Connect fee lookup to estimate this service." : !quoteInputs[index]?.dateOfService ? "Enter a valid service date to estimate the fee." : quote?.status === "priced" ? editableTreatmentCharges && treatmentBilling ? `${quote.basis === "payer_contract" ? quote.statutoryMaximumCents == null ? "" : `OMFS maximum: ${(quote.statutoryMaximumCents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })}. ` : `OMFS maximum: ${(quote.scheduleMaximumCents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })}. `}Estimated reimbursement: ${(quote.amountCents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })}. Billed charge can differ.` : null : feeReviewMessage(quote?.reason); return message ? <p className="mbsf-help" role="status">{message}</p> : null; })()}
      {showFeeEstimates && quote?.status === "priced" && details.basis !== "adjustment" ? <><AnesthesiaCalculationDetails quote={quote} /><FeeCalculationDetails quote={quote} providerLabel={details.providerKind ? PROVIDER_KIND_LABELS[details.providerKind] : undefined} /></> : null}
      {showFeeEstimates && quote?.status === "error" ? <button type="button" className="mbsf-secondary" onClick={() => setFeeRetry((value) => value + 1)}>Retry fee check</button> : null}
    </div>;

  };
  const total = bill.serviceLines.reduce((sum, line, index) => sum + (lineHasContent(line) ? lineCharge(line, index) ?? 0 : 0), 0);
  const procedureDescription = (code: string) => {
    const normalized = code.trim().toUpperCase();
    return describeProcedureCode?.(normalized) ?? procedures.find((item) => item.code.toUpperCase() === normalized)?.description
      ?? (isMedicalLegalCode(normalized) ? "Medical-legal procedure" : "Procedure code");
  };
  const expectedAt = (index: number): number | undefined => {
    const quote = quoteAt(index);
    return quote?.status === "priced" ? quote.amountCents / 100 : quote?.status === "not_separately_payable" ? 0 : undefined;
  };
  const expectedCell = (line: BillSubmissionInput["serviceLines"][number], index: number): ReactNode => {
    if (!lineHasContent(line) || !quoteInputs[index]) return isMedicalLegalCode(line.code) && lineHasContent(line) ? "Medical-legal" : "—";
    const quote = quoteAt(index);
    if (!quote) return quoteInputs[index]?.dateOfService ? "Checking…" : "Needs date";
    if (quote.status === "error") return Number.isFinite(line.charge) ? <span className="mbsf-at-charge">Billed at your charge</span> : "Unavailable";
    if (quote.status === "priced") return <>{formatUsd(quote.amountCents / 100)}{quote.findings?.length ? <small>See note</small> : null}</>;
    if (quote.status === "not_separately_payable") return <>{formatUsd(0)}<small>{/bundl|ptp/i.test(quote.reason) ? "Bundled" : "Not payable"}</small></>;
    if (Number.isFinite(line.charge)) return <span className="mbsf-at-charge">Billed at your charge</span>;
    return <span className="mbsf-review">Needs review</span>;
  };
  const encounterTotals = bill.serviceLines.reduce((sum, line, index) => {
    if (!lineHasContent(line) || !quoteInputs[index]) return sum;
    const quote = quoteAt(index); const expected = expectedAt(index);
    if (!quote) return { ...sum, pending: true };
    if (expected != null) return { ...sum, expected: sum.expected + expected };
    return Number.isFinite(line.charge) ? { ...sum, atCharge: sum.atCharge + 1 } : { ...sum, review: sum.review + 1 };
  }, { expected: 0, review: 0, atCharge: 0, pending: false });

  const pricedLines = bill.serviceLines.map((line, index) => {
    const charge = lineCharge(line, index); const next = { ...line };
    if (treatmentBilling && !isMedicalLegalCode(line.code)) {
      delete next.feeContext;
      if (next.drug?.administered || drugFieldsEnabled(line.code, detailsForLine(index)) || detailsForLine(index).drugEnabled !== undefined) delete next.drug;
      if (quoteInputs[index]?.drug) next.drug = quoteInputs[index]!.drug!;
      if (charge == null) delete next.charge;
      else {
        next.charge = charge;
        if (quoteInputs[index]) {
          const context = billSubmissionQuoteContext(quoteInputs[index]!);
          // An encounter quote prices standard lines with MindBill's own professional context. Sending the
          // form's estimate assumptions instead would price the saved bill differently from what was shown.
          if (!(encounterQuoting && isEstimateOnlyFeeContext(context))) next.feeContext = context;
          const attestation = lineAttestations[index];
          if (attestation?.confirmed && attestation.code === line.code.trim().toUpperCase()) {
            const sameDate = bill.serviceLines.filter((other) => lineHasContent(other) && (other.serviceDate || bill.service.date) === (line.serviceDate || bill.service.date)).length;
            next.feeContext = attestedFeeContext(context, attestation, sameDate === 1);
          }
        }
      }
    } else if (charge != null) next.charge = charge;
    return next;
  }).filter(lineHasContent);
  const cleanBill: BillSubmissionInput = { ...cloneBill(bill), serviceLines: pricedLines, ...(treatmentBilling && pricedLines.length ? { billingMode: billingModeForLines(pricedLines) } : {}) };
  // Every diagnosis applies to every line of a medical-legal bill: each line points to the first four.
  const clean: BillSubmissionInput = isMedicalLegalBillSubmission(cleanBill, treatmentBilling) ? withMedicalLegalLinePointers(cleanBill) : cleanBill;
  const previewBillKey = JSON.stringify(clean);
  const previewCurrent = cmsPreview?.billKey === previewBillKey;
  // An NDC that was started but is incomplete would otherwise be left off the claim silently.
  const drugFieldErrors: Record<string, string> = Object.fromEntries(bill.serviceLines.flatMap((line, index) => {
    if (!treatmentBilling || !lineHasContent(line) || isMedicalLegalCode(line.code)) return [];
    const problem = drugClaimFactsProblem(line.code, detailsForLine(index));
    return problem ? [[`serviceLines.${index}.drug.${problem.field}`, `Line ${index + 1}: ${problem.message}`]] : [];
  }));
  const liveErrors = JSON.stringify({ ...validateBillSubmission(clean).fieldErrors, ...drugFieldErrors });
  useEffect(() => {
    if (!validationActive) return;
    const next = JSON.parse(liveErrors) as Record<string, string>;
    setErrors(missingAttachmentReportType ? { ...next, attachments: "Select a report type for every attachment." } : next);
  }, [liveErrors, missingAttachmentReportType, validationActive]);

  async function submit(): Promise<void> {
    track("submit_clicked", { billingMode: analyticsBillingMode });
    const validation = validateBillSubmission(clean);
    const fieldErrors = { ...validation.fieldErrors, ...drugFieldErrors, ...(missingAttachmentReportType ? { attachments: "Select a report type for every attachment." } : {}) };
    setValidationActive(true); setErrors(fieldErrors); setFormError(null);
    if (Object.keys(fieldErrors).length) {
      track("validation_failed", { fieldPaths: Object.keys(fieldErrors), billingMode: analyticsBillingMode });
      const count = Object.keys(fieldErrors).length;
      const first = Object.values(fieldErrors)[0];
      setFormError(`Fix ${count} highlighted field${count === 1 ? "" : "s"} before submitting. ${first}`);
      window.requestAnimationFrame(() => { if (formRef.current) focusFirstInvalid(formRef.current); });
      return;
    }
    if (selectedIds.length + uploads.length > MAX_DOCUMENTS) return setFormError(`A bill can include at most ${MAX_DOCUMENTS} attachments.`);
    const complete = completeBillSubmissionInput(clean);
    const value: BillSubmissionFormValue = { bill: complete, sourceAttachmentIds: selectedIds, sourceAttachmentReportTypes, uploads };
    // Show the delivery-method dialog (e-bill / email / fax / mail with
    // recipient overrides) before either connected or host-owned submission.
    // Required mode deliberately fails closed so correction workflows cannot
    // silently reuse the previous route when previewing the newly selected
    // claims administrator fails.
    if (deliveryRoutePicker !== "off" && referenceClient) {
      setSubmitting(true);
      try {
        const delivery = await referenceClient.getDeliveryPreview({
          claimsAdministratorId: complete.claim.claimsAdministrator.id,
          ...(complete.claim.claimsAdministrator.payerId ? { payerId: complete.claim.claimsAdministrator.payerId } : {}),
          ...(complete.claim.injuryState ? { injuryState: complete.claim.injuryState } : {}),
        });
        setSubmitting(false);
        setRouteError(null);
        setRouteDialog({ delivery, value });
        track("delivery_route_dialog_opened", { billingMode: analyticsBillingMode });
        return;
      } catch (caught) {
        setSubmitting(false);
        if (deliveryRoutePicker === "required") {
          setFormError(caught instanceof Error ? caught.message : "Delivery routes could not be loaded. Nothing was sent.");
          return;
        }
      }
    }
    if (deliveryRoutePicker === "required") {
      setFormError("Delivery confirmation is unavailable. Nothing was sent.");
      return;
    }
    await performSubmit(value);
  }

  async function previewCms1500(): Promise<void> {
    const validation = validateBillSubmission(clean);
    const fieldErrors = { ...validation.fieldErrors, ...drugFieldErrors };
    delete fieldErrors.attachments;
    setValidationActive(true); setErrors(fieldErrors); setFormError(null);
    if (Object.keys(fieldErrors).length) {
      track("validation_failed", { fieldPaths: Object.keys(fieldErrors), billingMode: analyticsBillingMode });
      const count = Object.keys(fieldErrors).length;
      setFormError(`Fix ${count} highlighted field${count === 1 ? "" : "s"} before previewing.`);
      window.requestAnimationFrame(() => { if (formRef.current) focusFirstInvalid(formRef.current); });
      return;
    }
    if (!previewClient) {
      setFormError("A billing session is needed to preview the CMS-1500.");
      return;
    }
    const complete = completeBillSubmissionInput(clean);
    const requestId = ++previewRequest.current;
    setPreviewing(true);
    try {
      const pdf = await previewClient.previewCms1500(complete);
      track("cms1500_preview_opened", { billingMode: analyticsBillingMode });
      if (requestId !== previewRequest.current) return;
      setCmsPreview({ url: URL.createObjectURL(pdf), billKey: previewBillKey });
    } catch (caught) {
      if (requestId === previewRequest.current) setFormError(caught instanceof Error ? caught.message : "The CMS-1500 preview could not be generated.");
    } finally {
      if (requestId === previewRequest.current) setPreviewing(false);
    }
  }

  /** The full packet for the confirmed route, rendered from the unsaved bill. Nothing is created or sent. */
  async function previewPacket(value: BillSubmissionFormValue, submission: SendRouteSubmission): Promise<{ pdf: Blob; sections: string[] }> {
    if (!previewClient) throw new Error("A billing session is needed to preview the packet.");
    try {
      const documents = await prepareBillSubmissionDocuments({
        attachments,
        selectedIds: value.sourceAttachmentIds,
        uploads: value.uploads,
        reportTypeCodeByAttachmentId: value.sourceAttachmentReportTypes,
        ...(forcedAttachmentReportType ? { defaultReportTypeCode: forcedAttachmentReportType } : {}),
        ...(fetchOverride ? { fetch: fetchOverride } : {}),
      });
      const preview = await previewClient.previewPacket({
        bill: value.bill, documents, route: submission.route,
        ...(submission.route === "fax" && submission.attention ? { attention: submission.attention } : {}),
      });
      track("packet_preview_opened", { route: submission.route, billingMode: analyticsBillingMode });
      return preview;
    } catch (caught) {
      track("packet_preview_failed", { route: submission.route, errorCode: analyticsErrorCode(caught), billingMode: analyticsBillingMode });
      throw caught;
    }
  }

  async function performSubmit(value: BillSubmissionFormValue): Promise<void> {
    setSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(value);
        setRouteDialog(null);
        setRouteError(null);
        return;
      }
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
        bill: value.bill,
        ...(draft ? { draft } : {}),
        ...(value.submission ? { submission: value.submission } : {}),
        documents,
      }, idempotencyKey ? { idempotencyKey } : undefined);
      setRouteDialog(null);
      setRouteError(null);
      track("submit_succeeded", { ...(value.submission ? { route: value.submission.route } : {}), billingMode: analyticsBillingMode });
      await onSubmitted?.(result);
    } catch (caught) {
      if (!onSubmit) track("submit_failed", { ...(value.submission ? { route: value.submission.route } : {}), errorCode: analyticsErrorCode(caught), billingMode: analyticsBillingMode });
      const message = caught instanceof Error ? caught.message : "Unable to submit the bill.";
      const requested = attestationRequest(message, bill.serviceLines);
      if (requested) {
        // Nothing was sent. Ask for the confirmation on the line itself, then let the biller submit again.
        setLineAttestations((current) => ({ ...current, [requested.index]: {
          code: requested.code, confirmed: false,
          reasons: [...new Set([...(current[requested.index]?.code === requested.code ? current[requested.index]!.reasons : []), requested.reason])],
        } }));
        setRouteDialog(null); setRouteError(null);
        setFormError(`Line ${requested.position} (${requested.code}) needs your confirmation below before it can be billed. Nothing was sent.`);
        return;
      }
      if (value.submission) setRouteError(message); else setFormError(message);
    }
    finally { setSubmitting(false); }
  }

  const cumulativeTrauma = bill.claim.injuryType === "cumulative";
  const claimsAdministratorError = errors["claim.claimsAdministrator"];
  const carrierNames = [insuranceCarrierName, autofillCarrier];
  const choosePayer = (payer: BillReviewPayer, selectedPayerId?: string) => {
    setSelectedPayerMetadata(payer);
    // A multi-payer administrator starts with a suggested payer when one is identified; the biller can change it.
    const suggestion = payer.payerSelectionRequired && !selectedPayerId ? suggestBillSubmissionPayer(payer, carrierNames) : null;
    setPayerAutoPick(suggestion);
    setBill((current) => ({ ...current, claim: { ...current.claim, claimsAdministrator: chooseClaimsAdministrator(payer, selectedPayerId ?? suggestion?.payerId) } }));
  };
  const administrator = bill.claim.claimsAdministrator;
  const displayedPayerMetadata = selectedPayerMetadata?.id === administrator?.id ? selectedPayerMetadata : null;
  const displayedClaimPatterns = (displayedPayerMetadata?.claimNumberPatterns ?? []).map((pattern) => ({
    ...pattern,
    matches: claimNumberPatternMatches(pattern, bill.claim.claimNumber),
  }));
  const evaluatedClaimPatterns = displayedClaimPatterns.filter((pattern) => pattern.matches != null);
  const claimNumberMatches = evaluatedClaimPatterns.some((pattern) => pattern.matches);
  const claimNumberPatternState = evaluatedClaimPatterns.length ? (claimNumberMatches ? "match" : "warning") : null;
  const subpayorOptions = administrator?.payerSelectionRequired ? administrator.payers ?? [] : [];
  const subpayorError = errors["claim.claimsAdministrator.payerId"];
  const selectedSubpayor = subpayorOptions.find((option) => option.id === administrator?.payerId);
  const chooseSubpayor = (payerId: string) => { setPayerAutoPick(null); setBill((current) => current.claim.claimsAdministrator
    ? { ...current, claim: { ...current.claim, claimsAdministrator: { ...current.claim.claimsAdministrator, payerId } } }
    : current); };
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
      <Field path="service.date" label="Date of service" required error={errors["service.date"]}><TextDateInput ariaLabel="Date of service" value={bill.service.date} disabled={locked} required onChange={(date) => setBill((c) => setBillSubmissionServiceDate(c, date))} /></Field>
      <Field label="Treatment authorization # (optional)">{text(bill.service.authorizationNumber, (authorizationNumber) => setBill((c) => ({ ...c, service: { ...c.service, authorizationNumber } })), { placeholder: "Utilization-review authorization number" })}<small className="mbsf-help">If the approval has no authorization number, leave this blank and attach the approval.</small></Field>
      <Field path="claim.dateOfInjury" label={cumulativeTrauma ? "CT start date" : "Date of injury"} required error={errors["claim.dateOfInjury"]}><TextDateInput ariaLabel={cumulativeTrauma ? "Cumulative trauma start date" : "Date of injury"} value={bill.claim.dateOfInjury} disabled={locked} required onChange={(dateOfInjury) => setBill((c) => ({ ...c, claim: { ...c.claim, dateOfInjury } }))} /></Field>
      {cumulativeTrauma ? <Field path="claim.injuryEndDate" label="CT end date" required error={errors["claim.injuryEndDate"]}><TextDateInput ariaLabel="Cumulative trauma end date" value={bill.claim.injuryEndDate ?? ""} disabled={locked} required onChange={(injuryEndDate) => setBill((c) => ({ ...c, claim: { ...c.claim, injuryEndDate } }))} /></Field> : null}
      <div className="mbsf-field mbsf-span"><label className="mbsf-ct-toggle"><Checkbox checked={cumulativeTrauma} disabled={locked} onChange={(event) => { const checked = event.target.checked; setBill((c) => ({ ...c, claim: setBillSubmissionCumulativeTrauma(c.claim, checked) })); }} /><span>Cumulative trauma (CT)</span></label>{cumulativeTrauma ? <small className="mbsf-help">For CT, enter the injury period. The bill uses the end date unless the claims administrator has a different date of injury on file.</small> : null}</div>
      <Field path="claim.employer" label="Employer name" required error={errors["claim.employer"]}>{text(bill.claim.employer, (employer) => setBill((c) => ({ ...c, claim: { ...c.claim, employer } })))}</Field>
      <Field path="claim.claimNumber" label="Claim number" required error={errors["claim.claimNumber"]}>{text(bill.claim.claimNumber, (claimNumber) => setBill((c) => ({ ...c, claim: { ...c.claim, claimNumber } })))}
        {displayedClaimPatterns.length ? <div className="mbsf-claim-patterns" data-state={claimNumberPatternState ?? undefined} role="status">
          {claimNumberPatternState === "match" ? <strong>✓ Matches a known claim number pattern</strong> : claimNumberPatternState === "warning" ? <strong>⚠ Does not match the known claim number patterns</strong> : <strong>Known claim number patterns</strong>}
          <span className="mbsf-claim-pattern-list">{displayedClaimPatterns.map((pattern) => `${pattern.pattern}${pattern.example ? ` (example: ${pattern.example})` : ""}`).join(" · ")}</span>
        </div> : null}
      </Field>
      <Field label="WCAB / ADJ number (optional)">{text(bill.claim.adjNumber, (adjNumber) => setBill((c) => ({ ...c, claim: { ...c.claim, adjNumber } })))}</Field>
      <div className="mbsf-field mbsf-span"><MedicalProviderNetworkSelect value={bill.claim.medicalProviderNetworkId ?? ""} disabled={locked} loadOptions={onListMedicalProviderNetworks ?? referenceClient?.listMedicalProviderNetworks} onChange={(medicalProviderNetworkId) => setBill((current) => ({ ...current, claim: { ...current.claim, medicalProviderNetworkId: medicalProviderNetworkId || null } }))} /></div>
      <Field path="claim.claimsAdministrator" label="Claims administrator" required span error={claimsAdministratorError} invalid={!administrator?.id}>
        <ComboBox ariaLabel="Claims administrator" invalid={Boolean(claimsAdministratorError) || !administrator?.id} disabled={locked} loading={payerLoading} loadingMore={payerLoadingMore} filterOptions={false} value={administrator?.name ?? ""} placeholder="Browse or search claims administrators…" options={payerResults.map((payer) => { const patternDetail = payer.claimNumberPatterns?.map((pattern) => `${pattern.pattern}${pattern.example ? ` (example: ${pattern.example})` : ""}`).join(" · ") ?? payer.claimNumberHint ?? ""; return { id: payer.id, label: payer.name, detail: [payer.aliases?.length ? `Also known as ${payer.aliases.join(", ")}` : "", patternDetail].filter(Boolean).join(" · ") || "Claims administrator", ...(payer.affiliatedEntities?.length ? { affiliatedEntities: payer.affiliatedEntities } : {}), ...(payer.route ? { trailing: payer.route } : {}) }; })} onOpen={() => { if (payerQuery !== "") loadPayers(""); }} onQuery={searchPayers} onEndReached={() => loadPayers(payerQuery ?? "", true)} onSelect={(option) => choosePayer(payerResults.find((payer) => payer.id === option.id) ?? { id: option.id, name: option.label })} />
        {orderedClaimsAdministratorSources.length ? <div className="mbsf-source-evidence">{orderedClaimsAdministratorSources.map((source, index) => <span key={`${source.source}-${source.name}-${index}`}>{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a> : <strong>{source.label}</strong>}: <q>{source.name}</q></span>)}</div> : null}
        {claimsAdministratorHint ? <small className="mbsf-help">Claims administrator in your system: {claimsAdministratorHint}</small> : null}
        {payerSuggestions.length ? <div className="mbsf-suggestions"><strong>Suggested:</strong>{payerSuggestions.slice(0, 5).map((suggestion) => { const suggestedSubpayor = suggestion.payers?.find((option) => option.id === suggestion.selectedPayerId); return <button className="mbsf-suggestion" type="button" key={`${suggestion.id}-${suggestion.selectedPayerId ?? "admin"}`} title={suggestion.reason} onClick={() => choosePayer(suggestion, suggestion.selectedPayerId)}>{suggestion.name}{suggestedSubpayor ? ` · ${suggestedSubpayor.label}` : ""}</button>; })}</div> : null}
        {administrator?.id ? <button className="mbsf-directory-link" type="button" onClick={() => { void openAdministratorDirectory(); }}>View contacts and routing details for {administrator.name}</button> : <small className="mbsf-help">Search the directory and choose a claims administrator.</small>}
      </Field>
      {administrator?.payerSelectionRequired ? <Field path="claim.claimsAdministrator.payerId" label="Payer" required span error={subpayorError}>
        {subpayorOptions.length ? <ComboBox ariaLabel="Payer" invalid={Boolean(subpayorError)} disabled={locked} value={selectedSubpayor?.label ?? ""} placeholder="Select the payer named on the claim or report…" options={subpayorOptions.map((option) => ({ id: option.id, label: option.label, ...(option.hint ? { detail: option.hint } : {}), ...(option.affiliatedEntities?.length ? { affiliatedEntities: option.affiliatedEntities } : {}) }))} onSelect={(option) => chooseSubpayor(option.id)} /> : <div className="mbsf-error" role="alert">No routing payers are available for {administrator.name}. Electronic submission remains blocked; contact support to correct the payer directory.</div>}
        {selectedSubpayor && payerAutoPick?.payerId === selectedSubpayor.id ? <div className="mbsf-payer-status" role="status" data-suggested="true"><strong>Suggested payer:</strong> {selectedSubpayor.label} — {PAYER_SUGGESTION_TEXT[payerAutoPick.reason]}. Change it if the claim names a different payer.</div> : selectedSubpayor ? <div className="mbsf-payer-status" role="status"><strong>✓ Payer set:</strong> {selectedSubpayor.label}</div> : <small className="mbsf-help">{administrator.name} administers multiple payers. Choose the payer named on the claim or report so MindBill can route the bill correctly.</small>}
      </Field> : null}
      <Field label="Injury description (optional)" span>{text(bill.claim.description, (description) => setBill((c) => ({ ...c, claim: { ...c.claim, description } })))}</Field>
    </div></fieldset>;

  const compactProviders = profileDisplay === "compact";
  const providerErrors = Object.keys(errors).some((path) => /^(billingProvider|renderingProvider|serviceLocation)\./.test(path));
  const incompleteFields = Object.keys(JSON.parse(liveErrors) as Record<string, string>);
  const profileSections = [["billingProviders", "billingProvider", "Billing provider"], ["renderingProviders", "renderingProvider", "Rendering provider"], ["serviceLocations", "serviceLocation", "Service facility"]] as const;
  /** A section must show its fields when it is not a saved choice, or is incomplete, invalid or flagged by the host. */
  const sectionNeedsFields = (key: BillSubmissionProfileSection, collection: (typeof profileSections)[number][0]): boolean => {
    if (!matchingBillSubmissionProfileOption(availableProfiles?.[collection] as never, bill[key] as never)) return true;
    const inSection = (path: string) => { const normalized = path.replace(/\[\]/g, ""); return normalized === key || normalized.startsWith(`${key}.`); };
    return Object.keys(errors).some(inSection) || incompleteFields.some(inSection) || attentionFields.some(inSection);
  };
  const openSection = (key: BillSubmissionProfileSection) => setOpenSections((current) => current.includes(key) ? current : [...current, key]);
  const sectionFields: Record<BillSubmissionProfileSection, ReactNode> = {
    billingProvider: <>
      {bill.billingProvider?.savedProviderId || bill.billingProvider?.sourceBillId ? <div className="mbsf-span"><p>Using {bill.billingProvider.sourceBillId ? "this bill’s original" : "saved"} billing provider: {bill.billingProvider.name}. SSN ending in {bill.billingProvider.taxIdLast4 || "••••"} stays on MindBill’s server.</p><button type="button" className="mbsf-secondary" disabled={locked} onClick={() => setBill((c) => {
        const billingProvider = { ...c.billingProvider, taxIdType: "EIN" as const, taxId: "" };
        delete billingProvider.savedProviderId;
        delete billingProvider.sourceBillId;
        delete billingProvider.taxIdLast4;
        return { ...c, billingProvider };
      })}>Enter different billing provider details</button></div> : null}
      <fieldset disabled={locked || Boolean(bill.billingProvider?.savedProviderId || bill.billingProvider?.sourceBillId)} style={{ display: "contents" }}>
      <Field path="billingProvider.name" label="Billing provider name" required error={errors["billingProvider.name"]}>{text(bill.billingProvider?.name, (name) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, name } })))}</Field>
      <Field label="Tax ID type"><Select value={bill.billingProvider?.taxIdType ?? "EIN"} onChange={(choice) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, taxIdType: choice as "EIN" | "SSN", taxId: "" } }))}><option value="EIN">EIN (business)</option><option value="SSN">SSN (individual)</option></Select></Field>
      <Field path="billingProvider.taxId" label={bill.billingProvider?.taxIdType === "SSN" ? "SSN" : "EIN"} required error={errors["billingProvider.taxId"]}><input className="mbsf-input" autoComplete="off" type={bill.billingProvider?.taxIdType === "SSN" ? "password" : "text"} inputMode="numeric" value={bill.billingProvider?.taxId ?? ""} onChange={(event) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, taxId: event.target.value } }))} /></Field>
      <Field path="billingProvider.npi" label="Billing provider NPI" required error={errors["billingProvider.npi"]}>{text(bill.billingProvider?.npi, (npi) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, npi } })), { inputMode: "numeric", maxLength: 10 })}</Field>
      <Field path="billingProvider.phone" label="Billing provider phone" required error={errors["billingProvider.phone"]}>{text(bill.billingProvider?.phone, (phone) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, phone } })), { type: "tel" })}</Field>
      <Field path="billingProvider.address.line1" label="Billing address line 1" required span error={errors["billingProvider.address.line1"]}>{text(bill.billingProvider?.address?.line1, (line1) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, address: { line1, line2: c.billingProvider?.address?.line2 ?? "", city: c.billingProvider?.address?.city ?? "", state: c.billingProvider?.address?.state ?? "", postalCode: c.billingProvider?.address?.postalCode ?? "" } } })))}</Field>
      <Field label="Billing address line 2 (optional)" span>{text(bill.billingProvider?.address?.line2, (line2) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, address: { line1: c.billingProvider?.address?.line1 ?? "", line2, city: c.billingProvider?.address?.city ?? "", state: c.billingProvider?.address?.state ?? "", postalCode: c.billingProvider?.address?.postalCode ?? "" } } })))}</Field>
      <Field path="billingProvider.address.city" label="Billing city" required error={errors["billingProvider.address.city"]}>{text(bill.billingProvider?.address?.city, (city) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, address: { line1: c.billingProvider?.address?.line1 ?? "", line2: c.billingProvider?.address?.line2 ?? "", city, state: c.billingProvider?.address?.state ?? "", postalCode: c.billingProvider?.address?.postalCode ?? "" } } })))}</Field>
      <Field path="billingProvider.address.state" label="Billing state" required error={errors["billingProvider.address.state"]}>{text(bill.billingProvider?.address?.state, (state) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, address: { line1: c.billingProvider?.address?.line1 ?? "", line2: c.billingProvider?.address?.line2 ?? "", city: c.billingProvider?.address?.city ?? "", state: state.toUpperCase(), postalCode: c.billingProvider?.address?.postalCode ?? "" } } })), { maxLength: 2 })}</Field>
      <Field path="billingProvider.address.postalCode" label="Billing ZIP" required error={errors["billingProvider.address.postalCode"]}>{text(bill.billingProvider?.address?.postalCode, (postalCode) => setBill((c) => ({ ...c, billingProvider: { ...c.billingProvider, address: { line1: c.billingProvider?.address?.line1 ?? "", line2: c.billingProvider?.address?.line2 ?? "", city: c.billingProvider?.address?.city ?? "", state: c.billingProvider?.address?.state ?? "", postalCode } } })))}</Field>
      </fieldset>
    </>,
    renderingProvider: <>
      <Field path="renderingProvider.name" label="Rendering provider name" required error={errors["renderingProvider.name"]}>{text(bill.renderingProvider?.name, (name) => setBill((c) => ({ ...c, renderingProvider: { ...c.renderingProvider, name } })))}</Field>
      <Field path="renderingProvider.npi" label="Rendering provider NPI" required error={errors["renderingProvider.npi"]}>{text(bill.renderingProvider?.npi, (npi) => setBill((c) => ({ ...c, renderingProvider: { ...c.renderingProvider, npi } })), { inputMode: "numeric", maxLength: 10 })}</Field>
      <Field path="renderingProvider.taxonomy" label="Rendering taxonomy" required error={errors["renderingProvider.taxonomy"]}><ComboBox ariaLabel="Rendering taxonomy" invalid={Boolean(errors["renderingProvider.taxonomy"])} disabled={locked} preserveValueOnOpen value={bill.renderingProvider?.taxonomy ?? ""} placeholder="Search specialty name or taxonomy code…" options={taxonomies.map((item) => ({ id: item.code, label: item.description, detail: item.code }))} createOption={(query) => { const code = query.trim().toUpperCase(); return /^[A-Z0-9]{10}$/.test(code) ? { id: code, label: code, detail: "Use this taxonomy code" } : null; }} onSelect={(option) => setBill((c) => ({ ...c, renderingProvider: { ...c.renderingProvider, taxonomy: option.id } }))} /><small className="mbsf-help">Search by specialty name or 10-character taxonomy code.</small></Field>
    </>,
    serviceLocation: <>
      <Field path="serviceLocation.placeOfServiceCode" label="Place of service code" required error={errors["serviceLocation.placeOfServiceCode"]}>{text(bill.serviceLocation?.placeOfServiceCode, (placeOfServiceCode) => setBill((c) => ({ ...c, serviceLocation: { ...c.serviceLocation, placeOfServiceCode } })), { inputMode: "numeric", maxLength: 2, placeholder: "11" })}</Field>
      <Field path="serviceLocation.address.line1" label="Service address line 1" required span error={errors["serviceLocation.address.line1"]}>{text(bill.serviceLocation?.address?.line1, (line1) => setBill((c) => ({ ...c, serviceLocation: { ...c.serviceLocation, address: { line1, line2: c.serviceLocation?.address?.line2 ?? "", city: c.serviceLocation?.address?.city ?? "", state: c.serviceLocation?.address?.state ?? "", postalCode: c.serviceLocation?.address?.postalCode ?? "" } } })))}</Field>
      <Field label="Service address line 2 (optional)" span>{text(bill.serviceLocation?.address?.line2, (line2) => setBill((c) => ({ ...c, serviceLocation: { ...c.serviceLocation, address: { line1: c.serviceLocation?.address?.line1 ?? "", line2, city: c.serviceLocation?.address?.city ?? "", state: c.serviceLocation?.address?.state ?? "", postalCode: c.serviceLocation?.address?.postalCode ?? "" } } })))}</Field>
      <Field path="serviceLocation.address.city" label="Service city" required error={errors["serviceLocation.address.city"]}>{text(bill.serviceLocation?.address?.city, (city) => setBill((c) => ({ ...c, serviceLocation: { ...c.serviceLocation, address: { line1: c.serviceLocation?.address?.line1 ?? "", line2: c.serviceLocation?.address?.line2 ?? "", city, state: c.serviceLocation?.address?.state ?? "", postalCode: c.serviceLocation?.address?.postalCode ?? "" } } })))}</Field>
      <Field path="serviceLocation.address.state" label="Service state" required error={errors["serviceLocation.address.state"]}>{text(bill.serviceLocation?.address?.state, (state) => setBill((c) => ({ ...c, serviceLocation: { ...c.serviceLocation, address: { line1: c.serviceLocation?.address?.line1 ?? "", line2: c.serviceLocation?.address?.line2 ?? "", city: c.serviceLocation?.address?.city ?? "", state: state.toUpperCase(), postalCode: c.serviceLocation?.address?.postalCode ?? "" } } })), { maxLength: 2 })}</Field>
      <Field path="serviceLocation.address.postalCode" label="Service ZIP" required error={errors["serviceLocation.address.postalCode"]}>{text(bill.serviceLocation?.address?.postalCode, (postalCode) => setBill((c) => ({ ...c, serviceLocation: { ...c.serviceLocation, address: { line1: c.serviceLocation?.address?.line1 ?? "", line2: c.serviceLocation?.address?.line2 ?? "", city: c.serviceLocation?.address?.city ?? "", state: c.serviceLocation?.address?.state ?? "", postalCode } } })))}</Field>
    </>,
  };
  // Box 31: whether the chosen doctor's saved signature will print (matched by rendering NPI, as the server does).
  const chosenRendering = bill.renderingProvider?.npi?.trim()
    ? availableProfiles?.renderingProviders?.find((option) => option.value.npi?.trim() === bill.renderingProvider?.npi?.trim()) : undefined;
  const adoptSavedDoctor = (profile: OrganizationProfileData, providerId?: string) => {
    const options = organizationProfileOptions(profile);
    setLoadedProfiles({ client: profileClient, options });
    const option = providerId ? options.renderingProviders?.find((item) => item.id === providerId) : undefined;
    if (option) setBill((current) => ({ ...current, renderingProvider: structuredClone(option.value) }));
  };
  const renderingSignatureHint = chosenRendering && chosenRendering.signatureOnClaimForm !== undefined ? <p className="mbsf-help mbsf-span" data-signature-hint={chosenRendering.signatureOnClaimForm ? "saved" : "missing"} role="note">
    {chosenRendering.signatureOnClaimForm
      ? <>✓ {chosenRendering.label}’s saved signature prints in Box 31 of the claim form.</>
      : <>No signature saved for {chosenRendering.label} — Box 31 prints “Signature on File”. {doctorClient ? null : onManageSettings ? <button type="button" className="mbsf-text-btn" onClick={onManageSettings}>Add a signature</button> : "An administrator can add one in Billing settings."}</>}
  </p> : null;
  const doctorActions = <div className="mbsf-span mbsf-doctor-actions" style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
    <button type="button" className="mbsf-text-btn" disabled={locked} aria-expanded={doctorPanel === "add"} onClick={() => { setDoctorNote(""); setDoctorPanel((current) => current === "add" ? null : "add"); }}>+ Add new doctor</button>
    {doctorClient && chosenRendering ? <button type="button" className="mbsf-text-btn" disabled={locked} aria-expanded={doctorPanel === "signature"} onClick={() => { setDoctorNote(""); setDoctorPanel((current) => current === "signature" ? null : "signature"); }}>{chosenRendering.signatureOnClaimForm ? "Replace signature" : "Add signature"}</button> : null}
    {doctorNote ? <span className="mbsf-help" role="status">{doctorNote}</span> : null}
  </div>;
  const doctorPanelView = doctorPanel ? <div className="mbob mbsf-span" style={{ fontSize: 15 }}><style>{organizationOnboardingCss + renderingProvidersCss}</style>
    {doctorPanel === "add" ? <BillDoctorQuickAdd settingsClient={settingsClient} billClient={settingsClient ? null : doctorClient} onUnsupported={() => setBillDoctorWrites(false)} disabled={locked}
      onClose={() => setDoctorPanel(null)}
      onSaved={(profile, providerId) => { adoptSavedDoctor(profile, providerId); setDoctorPanel(null); setDoctorNote("Doctor saved and selected for this bill."); }}
      onUseForBill={(provider) => {
        setBill((current) => ({ ...current, renderingProvider: { name: provider.name, npi: provider.npi,
          ...(provider.taxonomy ? { taxonomy: provider.taxonomy } : {}), ...(provider.specialty ? { specialty: provider.specialty } : {}),
          ...(provider.licenseNumber ? { licenseNumber: provider.licenseNumber } : {}), ...(provider.licenseState ? { licenseState: provider.licenseState } : {}) } }));
        setDoctorPanel(null); setDoctorNote("Doctor details filled for this bill only.");
      }} />
      : doctorClient && chosenRendering ? <div className="mbrp-editor"><ProviderSignature key={chosenRendering.id} client={doctorClient} providerId={chosenRendering.id} providerName={chosenRendering.label}
        configured={chosenRendering.signatureOnClaimForm === true} onClaimForm={chosenRendering.signatureOnClaimForm === true} disabled={locked}
        onSaved={(profile) => { adoptSavedDoctor(profile); setDoctorNote("Signature saved."); }}
        onError={(error) => { if (!settingsClient && (error as Error & { status?: number }).status === 403) { setBillDoctorWrites(false); setDoctorPanel(null); setDoctorNote("Signatures can’t be saved from this bill. An administrator can add one in Billing settings."); } }} />
        <div className="mbob-actions"><span /><button type="button" className="mbob-secondary" onClick={() => setDoctorPanel(null)}>Close</button></div></div> : null}
  </div> : null;
  const providersSection = <fieldset className="mbsf-card" disabled={locked}><legend className="mbsf-legend">Providers &amp; place of service</legend>
    {profileClient && !loadedProfiles ? <p role="status" className="mbsf-help">Loading saved practice settings…</p> : null}
    {loadedProfiles?.client === profileClient && loadedProfiles.error ? <p role="status">{loadedProfiles.error} <button type="button" onClick={() => setProfileRetry((value) => value + 1)}>Retry</button></p> : null}
    {billingSettings ? <button type="button" className="mbsf-secondary" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((value) => !value)}>Add or manage doctors, signatures, locations &amp; W-9</button>
      : onManageSettings ? <button type="button" className="mbsf-secondary" onClick={onManageSettings}>Manage doctors &amp; signatures</button>
      : <p className="mbsf-help">{doctorClient ? "Choose the doctor below, or use + Add new doctor. Edit saved doctors in Billing settings." : "To add a doctor or a doctor’s signature, open your practice’s Billing settings."}</p>}
    {compactProviders ? <p className="mbsf-help">{[bill.billingProvider?.name, bill.renderingProvider?.name, bill.serviceLocation?.name].filter(Boolean).join(" · ") || "Enter provider details or choose saved profiles."}</p> : null}
    <details open={!compactProviders || providerEditing || providerErrors}>
      <summary hidden={!compactProviders} onClick={(event) => { event.preventDefault(); setProviderEditing((current) => !current); }} style={{ cursor: "pointer", marginBottom: 12 }}>Review or edit provider details</summary>
      <div className="mbsf-grid" onInput={(event) => { const section = (event.target as HTMLElement).closest<HTMLElement>("[data-profile-section]")?.dataset.profileSection as BillSubmissionProfileSection | undefined; if (section) openSection(section); }}>
      {profileSections.map(([collection, key, label]) => {
        const options = availableProfiles?.[collection];
        const needsFields = sectionNeedsFields(key, collection);
        const expanded = profileDisplay === "expanded" || needsFields || openSections.includes(key);
        const summary = billSubmissionProfileSummary(key, bill);
        const fieldsId = `${formId}-${key}`;
        return <Fragment key={key}>
          <h4 className="mbsf-subhead">{label}</h4>
          {expanded ? <>
            {options?.length ? <Field label={key === "renderingProvider" ? "Which doctor rendered this service?" : `Saved ${label === "Service facility" ? "service location" : label.toLowerCase()}`} span>
              <ComboBox ariaLabel={`Saved ${label === "Service facility" ? "service location" : label.toLowerCase()}`} disabled={locked} value="" placeholder={bill[key]?.name || (key === "renderingProvider" ? "Choose the doctor…" : `Choose ${label.toLowerCase()}…`)} options={options.map(({ id, label: optionLabel, detail }) => ({ id, label: optionLabel, ...(detail ? { detail } : {}) }))} onSelect={({ id }) => {
                const option = options.find((candidate) => candidate.id === id);
                if (option) setBill((current) => ({ ...current, [key]: structuredClone(option.value) }));
              }} />
              <small className="mbsf-help">{bill[key]?.name ? `Current: ${bill[key]?.name}` : "Select a profile or enter details below."}</small>
            </Field> : null}
            <div className="mbsf-profile-fields" id={fieldsId} data-profile-section={key}>{sectionFields[key]}</div>
            {profileDisplay !== "expanded" && !needsFields ? <div className="mbsf-span"><button type="button" className="mbsf-text-btn" aria-controls={fieldsId} onClick={() => setOpenSections((current) => current.filter((item) => item !== key))}>Done editing {label.toLowerCase()}</button></div> : null}
          </> : <div className="mbsf-saved-choice mbsf-span" data-profile-summary={key}>
            <p className="mbsf-saved-text">{summary.length ? <><strong>{summary[0]}</strong>{summary.slice(1).map((part, index) => <Fragment key={index}><span aria-hidden="true"> · </span><span>{part}</span></Fragment>)}</> : "Saved choice"}</p>
            <button type="button" className="mbsf-text-btn mbsf-edit-btn" aria-expanded="false" aria-controls={fieldsId} aria-label={`Edit ${label.toLowerCase()}`} disabled={locked} onClick={() => openSection(key)}>{key === "renderingProvider" && (options?.length ?? 0) > 1 ? "Change doctor" : "Edit"}</button>
          </div>}
          {key === "renderingProvider" ? <>{renderingSignatureHint}{doctorActions}{doctorPanelView}</> : null}
        </Fragment>;
      })}
    </div></details></fieldset>;

  const diagnosisSelector = (codes: string[], onChange: (codes: string[]) => void, lineIndex?: number) => {
    const invalid = Boolean(lineIndex === undefined ? errors.diagnoses : errors[`serviceLines.${lineIndex}.diagnosisPointers`]);
    const available = mergeDiagnosisOptions([...(bill.diagnoses ?? []).map((code) => ({ code, description: diagnosisChoices.find((item) => item.code === code)?.description ?? "" })), ...diagnosisChoices]);
    const canAdd = (code: string) => codes.length < 4 && (sharedDiagnoses || (bill.diagnoses?.length ?? 0) < 12 || Boolean(bill.diagnoses?.includes(code)));
    return <div className="mbsf-diagnosis-select">
      {lineIndex === undefined ? <div className="mbsf-quick-picks" aria-label="Common diagnosis codes">{BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS.map((option) => { const selected = codes.includes(option.code); return <button className="mbsf-quick-pick" disabled={locked || (!selected && !canAdd(option.code))} data-selected={selected} type="button" key={option.code} aria-pressed={selected} title={`${option.code} — ${option.description}`} onClick={() => onChange(selected ? codes.filter((code) => code !== option.code) : [...codes, option.code])}>{selected ? "✓" : "+"} {option.label}</button>; })}</div> : null}
      <div className="mbsf-chips">{codes.map((code) => { const option = [...BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS, ...available].find((item) => item.code === code); return <span className="mbsf-chip" key={code}><span><strong>{code}</strong>{option?.description ? ` ${option.description}` : ""}</span><button type="button" disabled={locked} aria-label={`Remove ${code}${lineIndex === undefined ? "" : ` from service line ${lineIndex + 1}`}`} onClick={() => onChange(codes.filter((item) => item !== code))}>×</button></span>; })}</div>
      <ComboBox ariaLabel={lineIndex === undefined ? "Add diagnosis code" : `Diagnosis codes for service line ${lineIndex + 1}`} invalid={invalid} disabled={locked || codes.length >= 4} loading={diagnosisLoading} loadingMore={diagnosisLoadingMore} value="" placeholder={codes.length >= 4 ? "4 selected (maximum)" : codes.length ? `${codes.length} selected — add more…` : "Search ICD-10 codes…"} options={available.filter((item) => !codes.includes(item.code) && canAdd(item.code)).map((item) => ({ id: item.code, label: item.code, detail: item.description }))} onOpen={() => loadDiagnoses("")} onQuery={searchDiagnoses} onEndReached={() => loadDiagnoses(diagnosisQuery ?? "", true)} onSelect={(option) => onChange([...codes, option.id])} />
    </div>;
  };
  const diagnosisDescription = (code: string) => [...BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS, ...diagnosisChoices].find((item) => item.code === code)?.description ?? "";
  const claimDiagnoses = (bill.diagnoses ?? []).map((code) => code.trim().toUpperCase());
  // Box 21: the bill's diagnoses lettered A–L. Lines point to up to four of them.
  const claimDiagnosisList = <div className="mbsf-claim-diagnoses" data-field-path="diagnoses">
    <span className="mbsf-claim-diagnoses-label">Bill diagnoses (Box 21)</span>
    {claimDiagnoses.length ? <ol className="mbsf-claim-diagnosis-list" aria-label="Bill diagnoses">{claimDiagnoses.map((code, index) => <li className="mbsf-chip" key={code}>
      <span className="mbsf-pointer-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
      <span><strong>{code}</strong>{diagnosisDescription(code) ? ` ${diagnosisDescription(code)}` : ""}</span>
      <button type="button" disabled={locked} aria-label={`Remove ${code} from the bill`} onClick={() => setBill((current) => removeBillSubmissionClaimDiagnosis(current, code))}>×</button>
    </li>)}</ol> : <p className="mbsf-help">Add the visit's diagnoses, then choose up to four for each line.</p>}
    {claimDiagnoses.length < 12 ? <ComboBox ariaLabel="Add diagnosis to the bill" disabled={locked} loading={diagnosisLoading} loadingMore={diagnosisLoadingMore} value="" placeholder={`Add a diagnosis (${claimDiagnoses.length} of 12)…`} options={mergeDiagnosisOptions(diagnosisChoices).filter((item) => !claimDiagnoses.includes(item.code)).map((item) => ({ id: item.code, label: item.code, detail: item.description }))} onOpen={() => loadDiagnoses("")} onQuery={searchDiagnoses} onEndReached={() => loadDiagnoses(diagnosisQuery ?? "", true)} onSelect={(option) => setBill((current) => addBillSubmissionClaimDiagnosis(current, option.id))} /> : null}
  </div>;
  // Medical-legal Box 21: common codes, the lettered list and a search, up to 12. Lines are not picked individually.
  const medicalLegalDiagnosisEditor = <div className="mbsf-claim-diagnoses" data-field-path="diagnoses" data-invalid={Boolean(errors.diagnoses)}>
    <span className="mbsf-claim-diagnoses-label">Bill diagnoses (Box 21)<RequiredMark /></span>
    <div className="mbsf-quick-picks" aria-label="Common diagnosis codes">{BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS.map((option) => { const selected = claimDiagnoses.includes(option.code); return <button className="mbsf-quick-pick" disabled={locked || (!selected && claimDiagnoses.length >= BILL_SUBMISSION_MAX_DIAGNOSES)} data-selected={selected} type="button" key={option.code} aria-pressed={selected} title={`${option.code} — ${option.description}`} onClick={() => setBill((current) => selected ? removeBillSubmissionClaimDiagnosis(current, option.code) : addBillSubmissionClaimDiagnosis(current, option.code))}>{selected ? "✓" : "+"} {option.label}</button>; })}</div>
    {claimDiagnoses.length ? <ol className="mbsf-claim-diagnosis-list" aria-label="Bill diagnoses">{claimDiagnoses.map((code, index) => <li className="mbsf-chip" key={code} data-pointed={index < BILL_SUBMISSION_MAX_LINE_POINTERS}>
      <span className="mbsf-pointer-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
      <span><strong>{code}</strong>{diagnosisDescription(code) ? ` ${diagnosisDescription(code)}` : ""}</span>
      <button type="button" disabled={locked} aria-label={`Remove ${code} from the bill`} onClick={() => setBill((current) => removeBillSubmissionClaimDiagnosis(current, code))}>×</button>
    </li>)}</ol> : null}
    {claimDiagnoses.length < BILL_SUBMISSION_MAX_DIAGNOSES ? <ComboBox ariaLabel="Add diagnosis to the bill" invalid={Boolean(errors.diagnoses)} disabled={locked} loading={diagnosisLoading} loadingMore={diagnosisLoadingMore} value="" placeholder={claimDiagnoses.length ? `Add a diagnosis (${claimDiagnoses.length} of 12)…` : "Search ICD-10 codes…"} options={mergeDiagnosisOptions(diagnosisChoices).filter((item) => !claimDiagnoses.includes(item.code)).map((item) => ({ id: item.code, label: item.code, detail: item.description }))} onOpen={() => loadDiagnoses("")} onQuery={searchDiagnoses} onEndReached={() => loadDiagnoses(diagnosisQuery ?? "", true)} onSelect={(option) => setBill((current) => addBillSubmissionClaimDiagnosis(current, option.id))} /> : <small className="mbsf-help">12 diagnoses (maximum).</small>}
    {claimDiagnoses.length > BILL_SUBMISSION_MAX_LINE_POINTERS ? <small className="mbsf-help">Diagnoses E–{String.fromCharCode(64 + claimDiagnoses.length)} are listed in Box 21 but no service line points to them.</small> : null}
  </div>;
  // One line's pointers: toggle any four of the bill's diagnoses (ABCD, ABCF, ABEG …), or search a code not on the bill yet.
  const lineDiagnosisPicker = (index: number) => {
    const codes = billSubmissionLineDiagnosisCodes(bill, index);
    const invalid = Boolean(errors[`serviceLines.${index}.diagnosisPointers`]);
    const setCodes = (next: string[]) => setBill((current) => setBillSubmissionLineDiagnoses(current, index, next));
    return <div className="mbsf-diagnosis-select">
      {claimDiagnoses.length ? <div className="mbsf-quick-picks mbsf-pointer-picks" role="group" aria-label={`Diagnosis pointers for service line ${index + 1}`}>{claimDiagnoses.map((code, claimIndex) => {
        const selected = codes.includes(code);
        const position = codes.indexOf(code);
        return <button className="mbsf-quick-pick mbsf-pointer-pick" type="button" key={code} data-selected={selected} aria-pressed={selected} disabled={locked || (!selected && codes.length >= 4)} title={`${code}${diagnosisDescription(code) ? ` — ${diagnosisDescription(code)}` : ""}${selected ? ` (pointer ${position + 1})` : ""}`} onClick={() => setCodes(selected ? codes.filter((item) => item !== code) : [...codes, code])}>
          <span className="mbsf-pointer-letter" aria-hidden="true">{String.fromCharCode(65 + claimIndex)}</span>{code}
        </button>;
      })}</div> : null}
      <ComboBox ariaLabel={`Diagnosis codes for service line ${index + 1}`} invalid={invalid} disabled={locked || codes.length >= 4 || claimDiagnoses.length >= 12} loading={diagnosisLoading} loadingMore={diagnosisLoadingMore} value="" placeholder={codes.length >= 4 ? "4 selected (maximum)" : claimDiagnoses.length >= 12 ? "12 bill diagnoses (maximum)" : claimDiagnoses.length ? "Add a code not on the bill…" : "Search ICD-10 codes…"} options={mergeDiagnosisOptions(diagnosisChoices).filter((item) => !claimDiagnoses.includes(item.code)).map((item) => ({ id: item.code, label: item.code, detail: item.description }))} onOpen={() => loadDiagnoses("")} onQuery={searchDiagnoses} onEndReached={() => loadDiagnoses(diagnosisQuery ?? "", true)} onSelect={(option) => setCodes([...codes, option.id])} />
    </div>;
  };
  const toggleSharedDiagnoses = (checked: boolean) => {
    if (checked) {
      individualDiagnoses.current = bill.serviceLines.map((_, index) => billSubmissionLineDiagnosisCodes(bill, index));
      const codes = individualDiagnoses.current.find((selection) => selection.length) ?? (bill.diagnoses ?? []).slice(0, 4);
      setBill(setBillSubmissionSharedDiagnoses(bill, codes));
    } else if (individualDiagnoses.current) {
      setBill(setBillSubmissionDiagnosisAssignments(bill, bill.serviceLines.map((_, index) => individualDiagnoses.current?.[index] ?? billSubmissionLineDiagnosisCodes(bill, index))));
      individualDiagnoses.current = null;
    }
    setSharedDiagnoses(checked);
  };

  const showEvaluation = !treatmentBilling || bill.serviceLines.some((line) => isMedicalLegalCode(line.code));
  const serviceLinesSection = <fieldset className="mbsf-card" disabled={locked}><legend className="mbsf-legend">{showEvaluation ? "Evaluation & service lines" : "Service lines"}</legend>
      {showEvaluation ? <p className="mbsf-help">Each line's modifiers identify the evaluation: −94 AME, −95 QME, −96 psychiatric/psychological, −93 interpreter. A medical-legal evaluation code without an evaluator modifier starts with −95 (QME).</p> : null}
      {diagnosisLimitNotice ? <div className="mbsf-attention" role="status" data-diagnosis-limit="true">{diagnosisLimitNoticeText(diagnosisLimitNotice)} <button type="button" className="mbsf-text-btn" onClick={() => setDiagnosisLimitNotice(null)}>Dismiss</button></div> : null}
      {medLegal ? <>
        {medicalLegalDiagnosisEditor}
        <p className="mbsf-help">List up to 12 diagnoses for the bill. Every service line points to the first four (A–D), the most a CMS-1500 line can carry.</p>
        {errors.diagnoses ? <p className="mbsf-error" role="alert">{errors.diagnoses}</p> : null}
      </> : <>
      <label className="mbsf-diagnosis-toggle"><Checkbox checked={sharedDiagnoses} onChange={(event) => toggleSharedDiagnoses(event.target.checked)} /><span>Apply the same diagnosis codes to all service lines</span></label>
      {sharedDiagnoses ? <Field path="diagnoses" label="Diagnosis codes (ICD-10)" required error={errors.diagnoses}>{diagnosisSelector(bill.diagnoses ?? [], (codes) => { individualDiagnoses.current = null; setBill((current) => setBillSubmissionSharedDiagnoses(current, codes)); })}</Field> : null}
      {!sharedDiagnoses ? claimDiagnosisList : null}
      <p className="mbsf-help">{sharedDiagnoses ? "Choose up to 4 diagnosis codes per service line and 12 across the bill." : "List up to 12 diagnoses for the bill, then pick up to 4 of them (by letter) for each service line."}</p>
      {!sharedDiagnoses && errors.diagnoses ? <p className="mbsf-error" role="alert">{errors.diagnoses}</p> : null}
      </>}
      {procedureError ? <p className="mbsf-error" role="alert">{procedureError}</p> : null}
      <div className="mbsf-lines" ref={serviceLinesRef} data-stacked={stackedServiceLines} data-shared-diagnoses={sharedDiagnoses || medLegal} data-encounter={encounterColumns} data-estimates={estimateColumns} data-field-path="serviceLines" data-invalid={Boolean(errors.serviceLines)}><div className="mbsf-line-head"><span>Procedure code<RequiredMark /></span><span>Modifiers</span>{!sharedDiagnoses && !medLegal ? <span>Diagnosis codes</span> : null}<span>Units<RequiredMark /></span>{encounterColumns ? <><span className="mbsf-num">Charge</span>{estimateColumns ? <><span className="mbsf-num">Expected (OMFS)</span><span className="mbsf-num">Difference</span></> : null}</> : <span>{editableTreatmentCharges && treatmentBilling ? "Billed charge" : "Allowed"}</span>}<span /> </div>
        {bill.serviceLines.map((line, index) => <div className="mbsf-line" key={index}>
          <div data-label="Procedure code" data-field-path={`serviceLines.${index}.code`} data-invalid={Boolean(errors[`serviceLines.${index}.code`])}><ComboBox ariaLabel={`Procedure code ${index + 1}`} invalid={Boolean(errors[`serviceLines.${index}.code`])} disabled={locked} value={line.code} placeholder="Search or enter code…" matchCodeIgnoringSeparators loading={procedureLoading} onOpen={() => loadProcedures("")} onQuery={loadProcedures} options={procedures.map((item) => ({ id: item.code, label: item.code, detail: item.description }))} createOption={customProcedureOption} onSelect={(option) => { const switched = isMedicalLegalCode(line.code) && !isMedicalLegalCode(option.id); const updated = switched ? { ...line, code: option.id, modifiers: (line.modifiers ?? []).filter((value) => !["92", "94", "95", "96"].includes(value.replace(/^-/, ""))) } : withDefaultBillSubmissionEvaluatorModifiers({ ...line, code: option.id }, billSubmissionDefaultEvaluationType(bill)); setLine(index, updated); }} />{line.code ? <small className="mbsf-help">{procedureDescription(line.code)}</small> : null}{errors[`serviceLines.${index}.code`] ? <small className="mbsf-error" role="alert">{errors[`serviceLines.${index}.code`]}</small> : null}</div>
          <div data-label="Modifiers"><div className="mbsf-chips">{(line.modifiers ?? []).map((modifier) => <span className="mbsf-chip" key={modifier}>−{modifier.replace(/^-/, "")}<button type="button" aria-label={`Remove modifier ${modifier}`} onClick={() => setLine(index, { modifiers: (line.modifiers ?? []).filter((item) => item !== modifier) })}>×</button></span>)}</div><ComboBox ariaLabel={`Modifiers ${index + 1}`} disabled={locked} value="" placeholder={(line.modifiers?.length ?? 0) ? `${line.modifiers!.length} modifier${line.modifiers!.length === 1 ? "" : "s"}` : "Add modifiers…"} options={billSubmissionModifierOptions(isMedicalLegalCode(line.code) || (!line.code.trim() && !treatmentBilling), line.serviceDate || bill.service?.date, modifierOptions).filter((item) => !(line.modifiers ?? []).includes(item.code) && (!isMedicalLegalCode(line.code) || medicalLegalModifierApplies(item.code, line.code))).map((item) => ({ id: item.code, label: `−${item.code}`, detail: item.description }))} onSelect={(option) => setLine(index, { modifiers: [...new Set([...(line.modifiers ?? []), option.id])] })} /></div>
          {!sharedDiagnoses && !medLegal ? <div className="mbsf-line-diagnoses" data-label="Diagnosis codes (ICD-10)" data-field-path={`serviceLines.${index}.diagnosisPointers`} data-invalid={Boolean(errors[`serviceLines.${index}.diagnosisPointers`])}>
            {lineDiagnosisPicker(index)}
            {errors[`serviceLines.${index}.diagnosisPointers`] ? <small className="mbsf-error" role="alert">{errors[`serviceLines.${index}.diagnosisPointers`]}</small> : null}
          </div> : null}
          <div data-label={treatmentBilling && isAnesthesiaCandidate(line.code) ? "Services" : "Units"} data-field-path={`serviceLines.${index}.units`} data-invalid={Boolean(errors[`serviceLines.${index}.units`])}><input className="mbsf-input" aria-label={`Units ${index + 1}`} aria-invalid={Boolean(errors[`serviceLines.${index}.units`])} type="number" min={1} max={treatmentBilling && isAnesthesiaCandidate(line.code) ? 1 : undefined} value={line.units ?? 1} onChange={(event) => setLine(index, { units: Number(event.target.value) })} />{errors[`serviceLines.${index}.units`] ? <small className="mbsf-error" role="alert">{errors[`serviceLines.${index}.units`]}</small> : null}</div>
          {encounterColumns ? <div className="mbsf-money-group" data-field-path={`serviceLines.${index}.charge`} data-invalid={Boolean(errors[`serviceLines.${index}.charge`])}>
            <div className="mbsf-money mbsf-charge" data-label="Charge">{lineHasContent(line) && !isMedicalLegalCode(line.code)
              ? <DecimalInput ariaLabel={`Billed charge for line ${index + 1}`} disabled={locked} value={line.charge} placeholder={(() => { const quote = quoteAt(index); return quote?.status === "priced" && quote.chargeAmountCents != null ? (quote.chargeAmountCents / 100).toFixed(2) : "0.00"; })()} onChange={(charge) => setLineCharge(index, charge)} />
              : lineHasContent(line) && lineCharge(line, index) != null ? formatUsd(lineCharge(line, index)!) : "—"}</div>
            {estimateColumns ? <><div className="mbsf-money mbsf-expected" data-label="Expected (OMFS)">{expectedCell(line, index)}</div>
            <div className="mbsf-money mbsf-difference" data-label="Difference">{(() => { const charge = lineCharge(line, index); const expected = expectedAt(index); return charge != null && expected != null ? formatUsd(charge - expected) : "—"; })()}</div></> : null}
          </div> : <div className="mbsf-money" data-label={editableTreatmentCharges && treatmentBilling ? "Billed charge" : "Allowed"} data-field-path={`serviceLines.${index}.charge`} data-invalid={Boolean(errors[`serviceLines.${index}.charge`])}>{lineCharge(line, index) == null ? (quoteKeys[index] ? (!supportedFeeJurisdiction || !quoteFee || !quoteInputs[index]?.dateOfService || (isTherapyEditorCode(line.code) && !quoteInputs[index]?.therapyContext) ? "Needs review" : feeQuotes[quoteKeys[index]!]?.status === "error" ? "Fee unavailable" : feeQuotes[quoteKeys[index]!] ? "Needs review" : "Checking…") : "—") : lineCharge(line, index)!.toLocaleString(undefined, { style: "currency", currency: "USD" })}</div>}
          <button className="mbsf-icon-btn" type="button" aria-label={`Remove service line ${index + 1}`} disabled={locked || (!lineHasContent(line) && index === bill.serviceLines.length - 1)} onClick={() => { setFeeDetails({}); setSeparateLineDates([]); if (individualDiagnoses.current) individualDiagnoses.current.splice(index, 1); enteredCharges.current = new Set([...(enteredCharges.current ?? [])].filter((item) => item !== index).map((item) => item > index ? item - 1 : item)); setBill((c) => { const lines = c.serviceLines.filter((_, itemIndex) => itemIndex !== index); const populated = lines.filter((item) => item.code.trim()); return { ...replaceBillSubmissionServiceLines(c, ensureTrailingBillSubmissionLine(lines)), ...(treatmentBilling && populated.length ? { billingMode: populated.every((item) => isMedicalLegalCode(item.code)) ? "med_legal" as const : "professional" as const } : {}) }; }); }}>×</button>
          {lineHasContent(line) && !(separateLineDates.includes(index) || line.serviceDateEnd || (line.serviceDate && parseBillSubmissionDate(line.serviceDate) !== parseBillSubmissionDate(bill.service.date)) || errors[`serviceLines.${index}.serviceDate`] || errors[`serviceLines.${index}.serviceDateEnd`]) ? <div className="mbsf-fee-details"><button className="mbsf-text-btn" type="button" disabled={locked} onClick={() => setSeparateLineDates((current) => [...current, index])}>Use a different service date for this line</button></div> : null}
          {lineHasContent(line) && (separateLineDates.includes(index) || line.serviceDateEnd || (line.serviceDate && parseBillSubmissionDate(line.serviceDate) !== parseBillSubmissionDate(bill.service.date)) || errors[`serviceLines.${index}.serviceDate`] || errors[`serviceLines.${index}.serviceDateEnd`]) ? <div className="mbsf-fee-details"><div className="mbsf-grid"><Field path={`serviceLines.${index}.serviceDate`} label="Service date" error={errors[`serviceLines.${index}.serviceDate`]}><TextDateInput ariaLabel={`Service date for line ${index + 1}`} value={line.serviceDate || bill.service.date} disabled={locked} onChange={(serviceDate) => setLine(index, { serviceDate })} /></Field><Field path={`serviceLines.${index}.serviceDateEnd`} label="Through date (optional)" error={errors[`serviceLines.${index}.serviceDateEnd`]}><TextDateInput ariaLabel={`Through date for line ${index + 1}`} value={line.serviceDateEnd || ""} disabled={locked} onChange={(serviceDateEnd) => setLine(index, { serviceDateEnd: serviceDateEnd || null })} /></Field></div></div> : null}
          {feeDetailsFor(line, index)}
          {lineAttestations[index] && lineAttestations[index]!.code === line.code.trim().toUpperCase() ? <label className="mbsf-fee-confirm mbsf-attestation" data-field-path={`serviceLines.${index}.attestation`}>
            <Checkbox disabled={locked} checked={lineAttestations[index]!.confirmed}
              onChange={(event) => { const confirmed = event.target.checked; setLineAttestations((current) => ({ ...current, [index]: { ...current[index]!, confirmed } })); }} />
            <span>{lineAttestationText(lineAttestations[index]!)}</span>
          </label> : null}
        </div>)}
        {encounterColumns ? <div className="mbsf-encounter-total" aria-label="Encounter totals"><span>Total</span>
          <span data-label="Charge">{formatUsd(total)}</span>
          {estimateColumns ? <><span data-label="Expected (OMFS)">{encounterTotals.pending ? "Checking…" : formatUsd(encounterTotals.expected)}{encounterTotals.review ? <small>+ {encounterTotals.review} {encounterTotals.review === 1 ? "line needs" : "lines need"} review</small> : null}{encounterTotals.atCharge ? <small>{encounterTotals.atCharge} {encounterTotals.atCharge === 1 ? "line" : "lines"} billed at your charge</small> : null}</span>
          <span data-label="Difference">{encounterTotals.pending || encounterTotals.review ? "—" : formatUsd(total - encounterTotals.expected)}</span></> : null}
        </div> : <div className="mbsf-total"><span>Total</span><span>{total.toLocaleString(undefined, { style: "currency", currency: "USD" })}</span></div>}
      </div>{errors.serviceLines ? <p className="mbsf-error" role="alert">{errors.serviceLines}</p> : null}
    </fieldset>;

  const attachmentsSection = <fieldset className="mbsf-card" data-field-path="attachments" data-invalid={Boolean(errors.attachments)} disabled={locked}><legend className="mbsf-legend">Attachments</legend><div className="mbsf-attach-list">
      {attachments.filter((attachment) => !removedSourceIds.includes(attachment.id)).map((attachment) => { const auto = attachment.autoAttached || attachment.documentType === "w9"; const removable = attachment.removable ?? !auto; const reportTypeCode = sourceAttachmentReportTypes[attachment.id] || attachment.reportTypeCode || defaultAttachmentReportType || ""; return <div className="mbsf-attach-row" data-auto={auto} key={attachment.id}><div className="mbsf-attach-main">{auto ? <span aria-label="Auto-attached" role="img">✓</span> : null}<span className="mbsf-file"><strong>{attachment.fileName}</strong><span className="mbsf-badge">{auto ? "Auto-attached" : documentLabels[attachment.documentType]}</span><span className="mbsf-help" style={{ display: "block" }}>{attachment.description || (auto ? "Included automatically with every bill." : documentLabels[attachment.documentType])}</span></span></div>{showAttachmentReportTypes ? <div className="mbsf-attach-type"><ComboBox ariaLabel={`Report type for ${attachment.fileName}`} invalid={!reportTypeCode} disabled={locked} preserveValueOnOpen value={reportTypeCode} placeholder="Select report type…" options={reportTypeOptions} onSelect={(option) => setSourceAttachmentReportTypes((current) => ({ ...current, [attachment.id]: option.id }))} /></div> : null}<div className="mbsf-attach-actions">{attachment.previewUrl ? <a className="mbsf-secondary" href={attachment.previewUrl} target="_blank" rel="noopener noreferrer">Preview</a> : null}{removable ? <button className="mbsf-icon-btn" type="button" aria-label={`Remove ${attachment.fileName}`} disabled={locked} onClick={() => { setSelectedIds((current) => current.filter((id) => id !== attachment.id)); setRemovedSourceIds((current) => [...new Set([...current, attachment.id])]); }}>×</button> : null}</div></div>; })}
      {uploads.map((upload, index) => { const reportTypeCode = upload.reportTypeCode || defaultAttachmentReportType || ""; return <div className="mbsf-attach-row" key={`${upload.file.name}-${index}`}><div className="mbsf-attach-main"><span className="mbsf-file"><strong>{upload.file.name}</strong><span className="mbsf-help" style={{ display: "block" }}>{(upload.file.size / 1024 / 1024).toFixed(1)} MB</span></span></div>{medLegal ? null : <label className="mbsf-attach-type">Document purpose<Select aria-label={`Document purpose for ${upload.file.name}`} value={upload.description ?? ""} onChange={(choice) => setUploads((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, description: choice } : item))}><option value="">Supporting document</option><option value="Authorization / UR response">Authorization / UR response</option><option value="MPN / network documentation">MPN / network documentation</option></Select></label>}{showAttachmentReportTypes ? <div className="mbsf-attach-type"><ComboBox ariaLabel={`Report type for ${upload.file.name}`} invalid={!reportTypeCode} disabled={locked} preserveValueOnOpen value={reportTypeCode} placeholder="Select report type…" options={reportTypeOptions} onSelect={(option) => setUploads((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reportTypeCode: option.id } : item))} /></div> : null}<div className="mbsf-attach-actions"><button className="mbsf-secondary" type="button" onClick={() => previewUploadedPdf(upload.file)}>Preview</button><button className="mbsf-icon-btn" type="button" aria-label={`Remove ${upload.file.name}`} onClick={() => setUploads((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></div></div>; })}
    </div>{errors.attachments ? <p className="mbsf-error" role="alert">{errors.attachments}</p> : null}<input ref={fileInput} hidden type="file" accept="application/pdf,.pdf" multiple onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} /><button className="mbsf-drop" data-active={dragActive} type="button" onClick={() => fileInput.current?.click()}><span><strong style={{ fontSize: 18 }}>Drop additional PDF files here, or click to choose</strong><span className="mbsf-help" style={{ display: "block", marginTop: 8 }}>{medLegal ? "Attach the signed report, proof of service, and any other supporting documents." : "Add supporting documents anywhere on this screen."}</span></span></button></fieldset>;

  const actionsSection = <>{cmsPreview ? <section className="mbsf-cms-preview" aria-label="CMS-1500 preview"><header><div><h3>CMS-1500 preview</h3><p className="mbsf-help">{previewCurrent ? "Generated from the current bill edits. Nothing has been sent." : "Bill details changed. Refresh the preview to review your latest edits."}</p></div><button type="button" className="mbsf-secondary" onClick={() => setCmsPreview(null)}>Close preview</button></header>{previewCurrent ? <><div className="mbsf-preview-details"><span>Service dates: <strong>{[...new Set(clean.serviceLines.map((line) => `${line.serviceDate || clean.service.date}${line.serviceDateEnd && line.serviceDateEnd !== (line.serviceDate || clean.service.date) ? ` – ${line.serviceDateEnd}` : ""}`))].join(", ") || "Not entered"}</strong></span><span>Claims administrator: <strong>{clean.claim.claimsAdministrator?.name || "Not selected"}</strong></span><a className="mbsf-secondary" href={cmsPreview.url} target="_blank" rel="noopener noreferrer">Open PDF in new tab</a><a className="mbsf-secondary" href={cmsPreview.url} download="cms-1500-preview.pdf">Download PDF</a></div><iframe title="CMS-1500 PDF preview" src={cmsPreview.url} /></> : <div role="status" className="mbsf-preview-stale">Preview out of date — select Refresh CMS-1500 preview below.</div>}</section> : null}{formError ? <div className="mbsf-alert" role="alert">{formError}</div> : null}<div className="mbsf-actions">{(!clean.claimForm || clean.claimForm === "cms1500") ? <button className="mbsf-secondary" type="button" disabled={locked || previewing || !previewClient} onClick={() => void previewCms1500()}>{previewing ? "Generating preview…" : cmsPreview ? "Refresh CMS-1500 preview" : "Preview CMS-1500"}</button> : null}{onSaveDraft ? <button className="mbsf-secondary" type="button" disabled={locked} onClick={() => {
    setSavingDraft(true); setFormError(null);
    void Promise.resolve(onSaveDraft(bill)).catch((caught: unknown) => setFormError(caught instanceof Error ? caught.message : "The draft could not be saved."))
      .finally(() => setSavingDraft(false));
  }}>{savingDraft ? "Saving draft…" : saveDraftLabel}</button> : null}<button className="mbsf-submit" type="submit" disabled={locked}>{submitting ? "Submitting…" : submitLabel}</button></div></>;
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
      {reportAutofill ? <ReportAutofill {...(analytics !== undefined ? { analytics } : {})} {...(onAnalyticsEvent ? { onAnalyticsEvent } : {})} {...reportAutofill} disabled={disabled || submitting} onApply={(result) => { const carrier = reportAutofillInsuranceCarrier(result); if (carrier) setAutofillCarrier(carrier); setBill((current) => applyReportAutofill(current, result, availableProfiles)); }} /> : null}
      {children ?? defaultLayout}
      {routeDialog ? (
        <SendRouteDialog
          title={deliveryRouteDialogTitle}
          delivery={routeDialog.delivery}
          submitting={submitting}
          error={routeError}
          onCancel={() => { if (!submitting) { setRouteDialog(null); setRouteError(null); } }}
          onConfirm={(submission) => { track("route_selected", { route: submission.route, billingMode: analyticsBillingMode }); void performSubmit({ ...routeDialog.value, submission }); }}
          {...(previewClient ? { onPreviewPacket: (submission: SendRouteSubmission) => previewPacket(routeDialog.value, submission) } : {})}
        />
      ) : null}
    </form>
    {settingsOpen && billingSettings ? <section aria-label="Practice settings" ref={settingsPanel}><button type="button" onClick={() => setSettingsOpen(false)}>Close practice settings</button><BillingSettings {...billingSettings} {...(appearance ? { appearance } : {})} onSaved={(profile) => { setLoadedProfiles({ client: profileClient, options: organizationProfileOptions(profile) }); }} /></section> : null}
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
