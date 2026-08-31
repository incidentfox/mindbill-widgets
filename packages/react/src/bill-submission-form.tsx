"use client";

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  mindBillAppearanceStyle,
  type MindBillReactAppearance,
} from "./appearance";

export const BILL_SUBMISSION_DOCUMENT_TYPES = [
  "final_report",
  "proof_of_service",
  "letter_of_attestation",
  "form_122",
  "return_to_work_voucher",
  "w9",
  "medical_records",
  "appeal",
  "other",
] as const;

export type BillSubmissionDocumentType =
  (typeof BILL_SUBMISSION_DOCUMENT_TYPES)[number];

export type BillSubmissionAddress = {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
};

export type BillSubmissionInput = {
  externalId?: string;
  billingMode?: "med_legal" | "professional";
  patient: {
    id?: string;
    externalId?: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth?: string;
    ssn?: string;
    gender?: "M" | "F" | "X";
    phone?: string;
    address: BillSubmissionAddress;
  };
  claim: {
    id?: string;
    externalId?: string;
    claimNumber: string;
    adjNumber?: string;
    employer?: string;
    dateOfInjury?: string;
    injuryState?: string;
    description?: string;
    claimsAdministrator?: { id?: string; name: string };
  };
  service: {
    date: string;
    endDate?: string | null;
    authorizationNumber?: string | null;
  };
  billingProvider?: {
    name?: string;
    taxId?: string;
    npi?: string;
    phone?: string;
    address?: BillSubmissionAddress;
  };
  renderingProvider?: {
    name?: string;
    specialty?: string;
    npi?: string;
    taxonomy?: string;
    licenseNumber?: string;
    licenseState?: string;
    isQme?: boolean;
    isAme?: boolean;
  };
  serviceLocation?: {
    name?: string;
    address?: BillSubmissionAddress;
    placeOfServiceCode?: string;
  };
  diagnoses?: string[];
  serviceLines: Array<{
    code: string;
    modifiers?: string[];
    units?: number;
    serviceDate?: string;
    serviceDateEnd?: string | null;
    charge?: number;
    diagnosisPointers?: number[];
  }>;
};

export type BillSubmissionSourceAttachment = {
  id: string;
  fileName: string;
  documentType: BillSubmissionDocumentType;
  description?: string;
  selected?: boolean;
};

export type BillSubmissionUpload = {
  file: File;
  documentType: BillSubmissionDocumentType;
  description?: string;
};

export type BillSubmissionFormValue = {
  bill: BillSubmissionInput;
  sourceAttachmentIds: string[];
  uploads: BillSubmissionUpload[];
};

export type BillSubmissionFormProps = {
  initialBill: BillSubmissionInput;
  attachments?: BillSubmissionSourceAttachment[];
  onSubmit: (value: BillSubmissionFormValue) => void | Promise<void>;
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  submitLabel?: string;
  heading?: ReactNode;
  description?: ReactNode;
};

export const BILL_SUBMISSION_REQUIRED_FIELDS = [
  "patient.firstName",
  "patient.lastName",
  "patient.address.line1",
  "patient.address.city",
  "patient.address.state",
  "patient.address.postalCode",
  "claim.claimNumber",
  "service.date",
  "serviceLines[].code",
  "serviceLines[].units",
] as const;

export type BillSubmissionValidation = {
  valid: boolean;
  fieldErrors: Record<string, string>;
};

export function validateBillSubmission(
  bill: BillSubmissionInput,
): BillSubmissionValidation {
  const errors: Record<string, string> = {};
  const required = (path: string, value: unknown) => {
    if (typeof value !== "string" || !value.trim()) errors[path] = "Required";
  };
  required("patient.firstName", bill.patient.firstName);
  required("patient.lastName", bill.patient.lastName);
  required("patient.address.line1", bill.patient.address.line1);
  required("patient.address.city", bill.patient.address.city);
  required("patient.address.state", bill.patient.address.state);
  required("patient.address.postalCode", bill.patient.address.postalCode);
  required("claim.claimNumber", bill.claim.claimNumber);
  required("service.date", bill.service.date);
  if (bill.patient.address.state.trim().length !== 2)
    errors["patient.address.state"] = "Use a 2-letter state code";
  if (!bill.serviceLines.length) errors.serviceLines = "Add at least one service line";
  bill.serviceLines.forEach((line, index) => {
    required(`serviceLines.${index}.code`, line.code);
    if (!Number.isInteger(line.units) || (line.units ?? 0) < 1)
      errors[`serviceLines.${index}.units`] = "Enter at least 1 unit";
    if (
      bill.billingMode === "professional" &&
      (!Number.isFinite(line.charge) || (line.charge ?? 0) < 0)
    )
      errors[`serviceLines.${index}.charge`] = "Enter the billed charge";
  });
  return { valid: Object.keys(errors).length === 0, fieldErrors: errors };
}

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_DOCUMENTS = 25;
const EMPTY_ATTACHMENTS: BillSubmissionSourceAttachment[] = [];

const documentLabels: Record<BillSubmissionDocumentType, string> = {
  final_report: "Final report",
  proof_of_service: "Proof of service",
  letter_of_attestation: "Letter of attestation",
  form_122: "Form 122",
  return_to_work_voucher: "Return-to-work voucher",
  w9: "W-9",
  medical_records: "Medical records",
  appeal: "Appeal",
  other: "Other",
};

function cloneBill(bill: BillSubmissionInput): BillSubmissionInput {
  return {
    ...bill,
    patient: { ...bill.patient, address: { ...bill.patient.address } },
    claim: {
      ...bill.claim,
      ...(bill.claim.claimsAdministrator
        ? { claimsAdministrator: { ...bill.claim.claimsAdministrator } }
        : {}),
    },
    service: { ...bill.service },
    ...(bill.billingProvider
      ? {
          billingProvider: {
            ...bill.billingProvider,
            ...(bill.billingProvider.address
              ? { address: { ...bill.billingProvider.address } }
              : {}),
          },
        }
      : {}),
    ...(bill.renderingProvider
      ? { renderingProvider: { ...bill.renderingProvider } }
      : {}),
    ...(bill.serviceLocation
      ? {
          serviceLocation: {
            ...bill.serviceLocation,
            ...(bill.serviceLocation.address
              ? { address: { ...bill.serviceLocation.address } }
              : {}),
          },
        }
      : {}),
    diagnoses: [...(bill.diagnoses ?? [])],
    serviceLines: bill.serviceLines.length
      ? bill.serviceLines.map((line) => ({
          ...line,
          modifiers: [...(line.modifiers ?? [])],
          diagnosisPointers: [...(line.diagnosisPointers ?? [])],
          units: line.units ?? 1,
        }))
      : [{ code: "", modifiers: [], units: 1 }],
  };
}

const styles: Record<string, CSSProperties> = {
  root: {
    display: "grid",
    gap: 18,
    color: "var(--mb-text)",
    fontFamily: "var(--mb-font)",
  },
  heading: {
    display: "flex",
    alignItems: "start",
    justifyContent: "space-between",
    gap: 20,
  },
  title: { margin: 0, fontSize: 22, lineHeight: 1.2 },
  copy: { margin: "5px 0 0", color: "var(--mb-muted)", fontSize: 14 },
  requiredNote: { color: "var(--mb-muted)", fontSize: 13, whiteSpace: "nowrap" },
  section: {
    minWidth: 0,
    margin: 0,
    padding: 20,
    border: "1px solid var(--mb-border)",
    borderRadius: "var(--mb-radius)",
    background: "var(--mb-surface)",
    boxShadow: "var(--mb-shadow)",
  },
  legend: { padding: "0 8px", fontWeight: 700, fontSize: 15 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))",
    gap: 14,
  },
  field: { display: "grid", alignContent: "start", gap: 6, minWidth: 0 },
  label: { color: "var(--mb-muted)", fontSize: 12, fontWeight: 700 },
  input: {
    boxSizing: "border-box",
    width: "100%",
    minHeight: 40,
    padding: "9px 11px",
    border: "1px solid var(--mb-border)",
    borderRadius: "var(--mb-control-radius)",
    background: "var(--mb-input)",
    color: "var(--mb-text)",
    font: "inherit",
  },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", minWidth: 610, borderCollapse: "collapse" },
  th: {
    padding: "0 8px 8px",
    color: "var(--mb-muted)",
    fontSize: 12,
    textAlign: "left",
  },
  td: { padding: "7px 8px", borderTop: "1px solid var(--mb-border)" },
  secondaryButton: {
    minHeight: 36,
    padding: "7px 11px",
    border: "1px solid var(--mb-border)",
    borderRadius: "var(--mb-control-radius)",
    background: "var(--mb-surface)",
    color: "var(--mb-text)",
    font: "inherit",
    fontWeight: 650,
    cursor: "pointer",
  },
  attachment: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "11px 0",
    borderBottom: "1px solid var(--mb-border)",
  },
  attachmentName: { display: "grid", gap: 2, minWidth: 0, flex: 1 },
  attachmentMeta: { color: "var(--mb-muted)", fontSize: 12 },
  error: {
    padding: "11px 13px",
    borderRadius: "var(--mb-control-radius)",
    background: "color-mix(in srgb, var(--mb-danger) 10%, transparent)",
    color: "var(--mb-danger)",
    fontSize: 13,
  },
  actions: { display: "flex", justifyContent: "flex-end" },
  submit: {
    minWidth: 150,
    minHeight: 42,
    padding: "10px 20px",
    border: 0,
    borderRadius: "var(--mb-control-radius)",
    background: "var(--mb-accent)",
    color: "var(--mb-accent-contrast)",
    font: "inherit",
    fontWeight: 750,
    cursor: "pointer",
  },
};

function RequiredMark(): ReactElement {
  return <span className="required-mark" style={{ color: "var(--mb-danger)" }}> *</span>;
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | undefined;
  children: ReactNode;
}): ReactElement {
  return (
    <label style={styles.field}>
      <span style={styles.label}>
        {label}
        {required ? <RequiredMark /> : null}
      </span>
      {children}
      {error ? <span style={{ color: "var(--mb-danger)", fontSize: 12 }}>{error}</span> : null}
    </label>
  );
}

function inputValue(value: string | null | undefined): string {
  return value ?? "";
}

export function BillSubmissionForm({
  initialBill,
  attachments = EMPTY_ATTACHMENTS,
  onSubmit,
  appearance,
  className = "bill-submission-form",
  style,
  disabled = false,
  submitLabel = "Submit bill",
  heading = "Bill information",
  description = "Review the bill details, add attachments, and submit.",
}: BillSubmissionFormProps): ReactElement {
  const [bill, setBill] = useState(() => cloneBill(initialBill));
  const [selectedIds, setSelectedIds] = useState(() =>
    attachments.filter((item) => item.selected !== false).map((item) => item.id),
  );
  const [uploads, setUploads] = useState<BillSubmissionUpload[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setBill(cloneBill(initialBill));
    setSelectedIds(
      attachments.filter((item) => item.selected !== false).map((item) => item.id),
    );
    setUploads([]);
    setErrors({});
    setFormError(null);
  }, [initialBill, attachments]);

  const diagnoses = useMemo(() => (bill.diagnoses ?? []).join(", "), [bill.diagnoses]);
  const locked = disabled || submitting;
  const setPatient = (patch: Partial<BillSubmissionInput["patient"]>) =>
    setBill((current) => ({ ...current, patient: { ...current.patient, ...patch } }));
  const setOptionalPatient = (
    key: "dateOfBirth",
    value: string,
  ) =>
    setBill((current) => {
      const patient = { ...current.patient };
      if (value) patient[key] = value;
      else delete patient[key];
      return { ...current, patient };
    });
  const setAddress = (patch: Partial<BillSubmissionAddress>) =>
    setBill((current) => ({
      ...current,
      patient: {
        ...current.patient,
        address: { ...current.patient.address, ...patch },
      },
    }));
  const setClaim = (patch: Partial<BillSubmissionInput["claim"]>) =>
    setBill((current) => ({ ...current, claim: { ...current.claim, ...patch } }));
  const setOptionalClaim = (
    key: "dateOfInjury",
    value: string,
  ) =>
    setBill((current) => {
      const claim = { ...current.claim };
      if (value) claim[key] = value;
      else delete claim[key];
      return { ...current, claim };
    });
  const setService = (patch: Partial<BillSubmissionInput["service"]>) =>
    setBill((current) => ({ ...current, service: { ...current.service, ...patch } }));
  const setLine = (
    index: number,
    patch: Partial<BillSubmissionInput["serviceLines"][number]>,
  ) =>
    setBill((current) => ({
      ...current,
      serviceLines: current.serviceLines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  const setOptionalLineNumber = (
    index: number,
    key: "charge",
    value: string,
  ) =>
    setBill((current) => ({
      ...current,
      serviceLines: current.serviceLines.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line };
        if (value === "") delete next[key];
        else next[key] = Number(value);
        return next;
      }),
    }));
  const textInput = (
    value: string | null | undefined,
    onChange: (value: string) => void,
    options?: { type?: string; required?: boolean; maxLength?: number; placeholder?: string },
  ) => (
    <input
      style={styles.input}
      value={inputValue(value)}
      disabled={locked}
      onChange={(event) => onChange(event.target.value)}
      {...options}
    />
  );

  async function submit(): Promise<void> {
    const validation = validateBillSubmission(bill);
    setErrors(validation.fieldErrors);
    setFormError(null);
    if (!validation.valid) {
      setFormError("Complete the required fields before submitting.");
      return;
    }
    if (selectedIds.length + uploads.length > MAX_DOCUMENTS) {
      setFormError(`A bill can include at most ${MAX_DOCUMENTS} attachments.`);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ bill: cloneBill(bill), sourceAttachmentIds: selectedIds, uploads });
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to submit the bill.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className={className}
      style={{ ...mindBillAppearanceStyle(appearance), ...styles.root, ...style }}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      noValidate
    >
      <div style={styles.heading}>
        <div>
          <h3 style={styles.title}>{heading}</h3>
          <p style={styles.copy}>{description}</p>
        </div>
        <span style={styles.requiredNote}><RequiredMark /> Required</span>
      </div>

      <fieldset style={styles.section} disabled={locked}>
        <legend style={styles.legend}>Patient</legend>
        <div style={styles.grid}>
          <Field label="First name" required error={errors["patient.firstName"]}>
            {textInput(bill.patient.firstName, (firstName) => setPatient({ firstName }), { required: true })}
          </Field>
          <Field label="Middle name">
            {textInput(bill.patient.middleName, (middleName) => setPatient({ middleName }))}
          </Field>
          <Field label="Last name" required error={errors["patient.lastName"]}>
            {textInput(bill.patient.lastName, (lastName) => setPatient({ lastName }), { required: true })}
          </Field>
          <Field label="Date of birth">
            {textInput(bill.patient.dateOfBirth, (dateOfBirth) => setOptionalPatient("dateOfBirth", dateOfBirth), { type: "date" })}
          </Field>
          <Field label="Phone">
            {textInput(bill.patient.phone, (phone) => setPatient({ phone }), { type: "tel" })}
          </Field>
          <Field label="Address" required error={errors["patient.address.line1"]}>
            {textInput(bill.patient.address.line1, (line1) => setAddress({ line1 }), { required: true })}
          </Field>
          <Field label="City" required error={errors["patient.address.city"]}>
            {textInput(bill.patient.address.city, (city) => setAddress({ city }), { required: true })}
          </Field>
          <Field label="State" required error={errors["patient.address.state"]}>
            {textInput(bill.patient.address.state, (state) => setAddress({ state }), { required: true, maxLength: 2 })}
          </Field>
          <Field label="ZIP" required error={errors["patient.address.postalCode"]}>
            {textInput(bill.patient.address.postalCode, (postalCode) => setAddress({ postalCode }), { required: true })}
          </Field>
        </div>
      </fieldset>

      <fieldset style={styles.section} disabled={locked}>
        <legend style={styles.legend}>Claim &amp; service</legend>
        <div style={styles.grid}>
          <Field label="Claim number" required error={errors["claim.claimNumber"]}>
            {textInput(bill.claim.claimNumber, (claimNumber) => setClaim({ claimNumber }), { required: true })}
          </Field>
          <Field label="ADJ number">{textInput(bill.claim.adjNumber, (adjNumber) => setClaim({ adjNumber }))}</Field>
          <Field label="Employer">{textInput(bill.claim.employer, (employer) => setClaim({ employer }))}</Field>
          <Field label="Date of injury">
            {textInput(bill.claim.dateOfInjury, (dateOfInjury) => setOptionalClaim("dateOfInjury", dateOfInjury), { type: "date" })}
          </Field>
          <Field label="Claims administrator">
            {textInput(bill.claim.claimsAdministrator?.name, (name) => setBill((current) => {
              const claim = { ...current.claim };
              if (name) claim.claimsAdministrator = { ...claim.claimsAdministrator, name };
              else delete claim.claimsAdministrator;
              return { ...current, claim };
            }))}
          </Field>
          <Field label="Service date" required error={errors["service.date"]}>
            {textInput(bill.service.date, (date) => setService({ date }), { type: "date", required: true })}
          </Field>
          <Field label="Diagnoses">
            {textInput(diagnoses, (value) => setBill((current) => ({ ...current, diagnoses: value.split(",").map((item) => item.trim()).filter(Boolean) })), { placeholder: "Comma-separated codes" })}
          </Field>
        </div>
      </fieldset>

      <fieldset style={styles.section} disabled={locked}>
        <legend style={styles.legend}>Providers &amp; location</legend>
        <div style={styles.grid}>
          <Field label="Billing provider">{textInput(bill.billingProvider?.name, (name) => setBill((current) => ({ ...current, billingProvider: { ...current.billingProvider, name } })))}</Field>
          <Field label="Billing tax ID">{textInput(bill.billingProvider?.taxId, (taxId) => setBill((current) => ({ ...current, billingProvider: { ...current.billingProvider, taxId } })))}</Field>
          <Field label="Billing NPI">{textInput(bill.billingProvider?.npi, (npi) => setBill((current) => ({ ...current, billingProvider: { ...current.billingProvider, npi } })))}</Field>
          <Field label="Billing phone">{textInput(bill.billingProvider?.phone, (phone) => setBill((current) => ({ ...current, billingProvider: { ...current.billingProvider, phone } })))}</Field>
          <Field label="Rendering provider">{textInput(bill.renderingProvider?.name, (name) => setBill((current) => ({ ...current, renderingProvider: { ...current.renderingProvider, name } })))}</Field>
          <Field label="Specialty">{textInput(bill.renderingProvider?.specialty, (specialty) => setBill((current) => ({ ...current, renderingProvider: { ...current.renderingProvider, specialty } })))}</Field>
          <Field label="Rendering NPI">{textInput(bill.renderingProvider?.npi, (npi) => setBill((current) => ({ ...current, renderingProvider: { ...current.renderingProvider, npi } })))}</Field>
          <Field label="License number">{textInput(bill.renderingProvider?.licenseNumber, (licenseNumber) => setBill((current) => ({ ...current, renderingProvider: { ...current.renderingProvider, licenseNumber } })))}</Field>
          <Field label="License state">{textInput(bill.renderingProvider?.licenseState, (licenseState) => setBill((current) => ({ ...current, renderingProvider: { ...current.renderingProvider, licenseState } })), { maxLength: 2 })}</Field>
          <Field label="Service location">{textInput(bill.serviceLocation?.name, (name) => setBill((current) => ({ ...current, serviceLocation: { ...current.serviceLocation, name } })))}</Field>
          <Field label="Place of service">{textInput(bill.serviceLocation?.placeOfServiceCode, (placeOfServiceCode) => setBill((current) => ({ ...current, serviceLocation: { ...current.serviceLocation, placeOfServiceCode } })), { maxLength: 2 })}</Field>
        </div>
      </fieldset>

      <fieldset style={styles.section} disabled={locked}>
        <legend style={styles.legend}>Service lines</legend>
        <div style={styles.tableWrap}>
          <table aria-label="Service lines" style={styles.table}>
            <thead><tr>
              <th style={styles.th}>Code<RequiredMark /></th>
              <th style={styles.th}>Modifiers</th>
              <th style={styles.th}>Units<RequiredMark /></th>
              {bill.billingMode === "professional" ? <th style={styles.th}>Charge<RequiredMark /></th> : null}
              <th style={styles.th} aria-label="Actions" />
            </tr></thead>
            <tbody>
              {bill.serviceLines.map((line, index) => (
                <tr key={index}>
                  <td style={styles.td}>
                    {textInput(line.code, (code) => setLine(index, { code }), { required: true })}
                    {errors[`serviceLines.${index}.code`] ? <span style={{ color: "var(--mb-danger)", fontSize: 12 }}>{errors[`serviceLines.${index}.code`]}</span> : null}
                  </td>
                  <td style={styles.td}>{textInput((line.modifiers ?? []).join(", "), (value) => setLine(index, { modifiers: value.split(",").map((item) => item.trim()).filter(Boolean) }))}</td>
                  <td style={styles.td}>
                    <input style={styles.input} type="number" min={1} required value={line.units ?? 1} onChange={(event) => setLine(index, { units: Number(event.target.value) })} />
                    {errors[`serviceLines.${index}.units`] ? <span style={{ color: "var(--mb-danger)", fontSize: 12 }}>{errors[`serviceLines.${index}.units`]}</span> : null}
                  </td>
                  {bill.billingMode === "professional" ? <td style={styles.td}>
                    <input style={styles.input} type="number" min={0} step="0.01" required value={line.charge ?? ""} onChange={(event) => setOptionalLineNumber(index, "charge", event.target.value)} />
                    {errors[`serviceLines.${index}.charge`] ? <span style={{ color: "var(--mb-danger)", fontSize: 12 }}>{errors[`serviceLines.${index}.charge`]}</span> : null}
                  </td> : null}
                  <td style={styles.td}><button style={styles.secondaryButton} type="button" disabled={locked || bill.serviceLines.length === 1} onClick={() => setBill((current) => ({ ...current, serviceLines: current.serviceLines.filter((_, lineIndex) => lineIndex !== index) }))}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errors.serviceLines ? <p style={{ color: "var(--mb-danger)", fontSize: 12 }}>{errors.serviceLines}</p> : null}
        <button style={{ ...styles.secondaryButton, marginTop: 12 }} type="button" disabled={locked} onClick={() => setBill((current) => ({ ...current, serviceLines: [...current.serviceLines, { code: "", modifiers: [], units: 1 }] }))}>+ Add service line</button>
      </fieldset>

      <fieldset style={styles.section} disabled={locked}>
        <legend style={styles.legend}>Attachments</legend>
        {attachments.map((attachment) => (
          <label style={styles.attachment} key={attachment.id}>
            <input type="checkbox" checked={selectedIds.includes(attachment.id)} onChange={(event) => {
              if (event.target.checked && selectedIds.length + uploads.length >= MAX_DOCUMENTS) {
                setFormError(`A bill can include at most ${MAX_DOCUMENTS} attachments.`);
                return;
              }
              setSelectedIds((current) => event.target.checked ? [...new Set([...current, attachment.id])] : current.filter((id) => id !== attachment.id));
            }} />
            <span style={styles.attachmentName}><strong>{attachment.fileName}</strong><span style={styles.attachmentMeta}>{attachment.description || documentLabels[attachment.documentType]}</span></span>
          </label>
        ))}
        {uploads.map((upload, index) => (
          <div style={styles.attachment} key={`${upload.file.name}-${index}`}>
            <span style={styles.attachmentName}><strong>{upload.file.name}</strong><span style={styles.attachmentMeta}>{(upload.file.size / 1024 / 1024).toFixed(1)} MB</span></span>
            <select style={{ ...styles.input, width: 180 }} value={upload.documentType} onChange={(event) => setUploads((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, documentType: event.target.value as BillSubmissionDocumentType } : item))}>
              {BILL_SUBMISSION_DOCUMENT_TYPES.map((type) => <option value={type} key={type}>{documentLabels[type]}</option>)}
            </select>
            <button style={styles.secondaryButton} type="button" onClick={() => setUploads((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
          </div>
        ))}
        {!attachments.length && !uploads.length ? <p style={styles.copy}>No attachments added.</p> : null}
        <label style={{ ...styles.secondaryButton, display: "inline-flex", alignItems: "center", marginTop: 14 }}>
          Add PDF attachments
          <input hidden type="file" accept="application/pdf,.pdf" multiple onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            setFormError(null);
            const invalid = files.find((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"));
            if (invalid) return setFormError(`${invalid.name} is not a PDF.`);
            const oversized = files.find((file) => file.size > MAX_PDF_BYTES);
            if (oversized) return setFormError(`${oversized.name} is larger than 25 MB.`);
            const nextBytes = [...uploads.map((item) => item.file), ...files].reduce((sum, file) => sum + file.size, 0);
            if (nextBytes > MAX_UPLOAD_BYTES) return setFormError("Attachments exceed the 100 MB upload limit.");
            if (selectedIds.length + uploads.length + files.length > MAX_DOCUMENTS) return setFormError(`A bill can include at most ${MAX_DOCUMENTS} attachments.`);
            setUploads((current) => [...current, ...files.map((file) => ({ file, documentType: "other" as const }))]);
          }} />
        </label>
      </fieldset>

      {formError ? <div style={styles.error} role="alert">{formError}</div> : null}
      <div style={styles.actions}>
        <button style={{ ...styles.submit, opacity: locked ? 0.65 : 1 }} type="submit" disabled={locked}>{submitting ? "Submitting…" : submitLabel}</button>
      </div>
    </form>
  );
}
