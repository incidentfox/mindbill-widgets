"use client";

import type { MindBillAppearance } from "@mindbill/embed";
import type { CSSProperties, FormEvent, ReactElement } from "react";
import { useEffect, useId, useMemo, useState } from "react";

export type BillReviewDocumentType =
  | "final_report"
  | "letter_of_attestation"
  | "proof_of_service"
  | "form_122"
  | "return_to_work_voucher"
  | "w9"
  | "medical_records"
  | "appeal"
  | "other";

export type BillReviewBillingProvider = {
  id?: string;
  name: string;
  taxId: string;
  npi: string;
  billType: "Professional" | "Institutional";
  phone?: string;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
};

export type BillReviewClinician = {
  id?: string;
  name: string;
  specialty: string;
  npi: string;
  taxonomy?: string;
  licenseNumber?: string;
  licenseState?: string;
  signaturePng?: string;
  signatureKey?: string;
  isQME?: boolean;
  isAME?: boolean;
  email?: string;
  active?: boolean;
};

export type BillReviewLocation = {
  id?: string;
  billingProviderId?: string;
  name: string;
  nickname?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
  posCode?: string;
  isPrimary?: boolean;
  active?: boolean;
};

export type BillReviewLineItem = {
  id?: string;
  code: string;
  modifiers: string[];
  units: number;
  charge: number;
  feeSchedule?: number;
};

export type BillReviewAttachment = {
  id: string;
  filename: string;
  description?: string | null;
  documentType: string;
  reportType?: string | null;
  source?: string;
  addedAt?: string;
  contentUrl?: string;
};

export type BillReviewData = {
  bill: {
    id: string;
    billNumber: string | number;
    status: string;
    transmissionState?: string;
    dos: string;
    dosEnd?: string | null;
    placeOfServiceId?: string;
    authorizationNumber?: string | null;
    billingProviderId?: string;
    renderingProviderId?: string;
    billingSnapshot?: {
      billingProvider?: BillReviewBillingProvider;
      renderingProvider?: BillReviewClinician;
      placeOfService?: BillReviewLocation;
    } | null;
    lineItems: BillReviewLineItem[];
    attachments: BillReviewAttachment[];
    totalCharge: number;
    totalPaid: number;
    balanceDue: number;
  };
  patient: { name: string; dob?: string };
  injury: {
    claimNumber?: string;
    employer?: string;
    doi?: string;
    claimsAdminId?: string;
  };
  options?: {
    billingProviders?: BillReviewBillingProvider[];
    renderingProviders?: BillReviewClinician[];
    locations?: BillReviewLocation[];
  };
};

export type BillReviewSaveInput = {
  dos: string;
  dosEnd?: string | null;
  authorizationNumber?: string | null;
  billingProviderId?: string;
  billingProvider?: Omit<BillReviewBillingProvider, "id">;
  renderingProviderId?: string;
  renderingProvider?: Omit<BillReviewClinician, "id">;
  placeOfServiceId?: string;
  placeOfService?: Omit<BillReviewLocation, "id">;
  lineItems: Array<{
    id?: string;
    code: string;
    modifiers: string[];
    units: number;
  }>;
};

export type BillSubmissionRoute = "ebill" | "fax" | "mail" | "email";

export type BillReviewFormProps = {
  data: BillReviewData;
  onSave: (input: BillReviewSaveInput) => Promise<BillReviewData | void>;
  onSubmit: (
    input: BillReviewSaveInput,
    route: BillSubmissionRoute,
  ) => Promise<void>;
  onAddAttachment: (
    file: File,
    documentType: BillReviewDocumentType,
    description?: string,
  ) => Promise<void>;
  onRemoveAttachment: (attachmentId: string) => Promise<void>;
  onOpenAttachment?: (attachment: BillReviewAttachment) => void;
  className?: string;
  style?: CSSProperties;
  appearance?: MindBillAppearance;
  disabled?: boolean;
};

export type BillReviewDraft = {
  dos: string;
  dosEnd: string;
  authorizationNumber: string;
  billingProvider: BillReviewBillingProvider;
  clinician: BillReviewClinician;
  location: BillReviewLocation;
  lineItems: BillReviewLineItem[];
};

const EMPTY_BILLING_PROVIDER: BillReviewBillingProvider = {
  name: "",
  taxId: "",
  npi: "",
  billType: "Professional",
};
const EMPTY_CLINICIAN: BillReviewClinician = {
  name: "",
  specialty: "",
  npi: "",
};
const EMPTY_LOCATION: BillReviewLocation = {
  name: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  posCode: "11",
};

const DOCUMENT_LABELS: Record<BillReviewDocumentType, string> = {
  final_report: "Final medical-legal report",
  letter_of_attestation: "Letter of attestation",
  proof_of_service: "Proof of service",
  form_122: "DWC Form 122",
  return_to_work_voucher: "Return-to-work voucher",
  w9: "W-9",
  medical_records: "Medical records",
  appeal: "Appeal or review support",
  other: "Other supporting document",
};

function withoutId<T extends { id?: string }>(value: T): Omit<T, "id"> {
  const result = { ...value };
  delete result.id;
  return result;
}

function toDraft(data: BillReviewData): BillReviewDraft {
  const snapshot = data.bill.billingSnapshot;
  return {
    dos: data.bill.dos || "",
    dosEnd: data.bill.dosEnd || "",
    authorizationNumber: data.bill.authorizationNumber || "",
    billingProvider: {
      ...EMPTY_BILLING_PROVIDER,
      ...(snapshot?.billingProvider ?? {}),
    },
    clinician: { ...EMPTY_CLINICIAN, ...(snapshot?.renderingProvider ?? {}) },
    location: { ...EMPTY_LOCATION, ...(snapshot?.placeOfService ?? {}) },
    lineItems: data.bill.lineItems.map((line) => ({ ...line })),
  };
}

export function buildBillReviewSaveInput(
  draft: BillReviewDraft,
): BillReviewSaveInput {
  return {
    dos: draft.dos,
    dosEnd: draft.dosEnd || null,
    authorizationNumber: draft.authorizationNumber.trim() || null,
    ...(draft.billingProvider.id
      ? { billingProviderId: draft.billingProvider.id }
      : {}),
    billingProvider: withoutId(draft.billingProvider),
    ...(draft.clinician.id
      ? { renderingProviderId: draft.clinician.id }
      : {}),
    renderingProvider: withoutId(draft.clinician),
    ...(draft.location.id ? { placeOfServiceId: draft.location.id } : {}),
    placeOfService: withoutId(draft.location),
    lineItems: draft.lineItems.map(({ id, code, modifiers, units }) => ({
      ...(id ? { id } : {}),
      code: code.trim().toUpperCase(),
      modifiers,
      units,
    })),
  };
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function appearanceStyle(
  appearance: MindBillAppearance | undefined,
  style: CSSProperties | undefined,
): CSSProperties {
  return {
    ...(appearance?.accentColor
      ? { "--mb-accent": appearance.accentColor }
      : {}),
    ...(appearance?.textColor ? { "--mb-text": appearance.textColor } : {}),
    ...(appearance?.mutedColor
      ? { "--mb-muted": appearance.mutedColor }
      : {}),
    ...(appearance?.borderColor
      ? { "--mb-border": appearance.borderColor }
      : {}),
    ...(appearance?.backgroundColor
      ? { "--mb-soft": appearance.backgroundColor }
      : {}),
    ...(appearance?.surfaceColor
      ? { "--mb-surface": appearance.surfaceColor }
      : {}),
    ...(appearance?.fontFamily
      ? { "--mb-font": appearance.fontFamily }
      : {}),
    ...style,
  } as CSSProperties;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  optional,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  optional?: boolean;
  required?: boolean;
}): ReactElement {
  return (
    <label className="mb-native-field">
      <span>
        {label} {optional ? <small>Optional</small> : null}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function BillReviewForm({
  data,
  onSave,
  onSubmit,
  onAddAttachment,
  onRemoveAttachment,
  onOpenAttachment,
  className,
  style,
  appearance,
  disabled = false,
}: BillReviewFormProps): ReactElement {
  const [draft, setDraft] = useState(() => toDraft(data));
  const [route, setRoute] = useState<BillSubmissionRoute>("ebill");
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] =
    useState<BillReviewDocumentType>("other");
  const [busy, setBusy] = useState<"save" | "submit" | "attachment" | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const routeName = useId();
  const editable = data.bill.status === "incomplete" && !disabled;

  useEffect(() => setDraft(toDraft(data)), [data]);

  const canSubmit = useMemo(
    () =>
      Boolean(
        draft.dos &&
          draft.billingProvider.name.trim() &&
          draft.billingProvider.taxId.trim() &&
          draft.billingProvider.npi.trim() &&
          draft.clinician.name.trim() &&
          draft.clinician.npi.trim() &&
          draft.location.name.trim() &&
          draft.location.street.trim() &&
          draft.location.city.trim() &&
          draft.location.state.trim() &&
          draft.location.zip.trim() &&
          draft.lineItems.length &&
          draft.lineItems.every((line) => line.code.trim() && line.units > 0),
      ),
    [draft],
  );

  const updateBillingProvider = <K extends keyof BillReviewBillingProvider>(
    key: K,
    value: BillReviewBillingProvider[K],
  ) =>
    setDraft((current) => ({
      ...current,
      billingProvider: { ...current.billingProvider, [key]: value },
    }));
  const updateClinician = <K extends keyof BillReviewClinician>(
    key: K,
    value: BillReviewClinician[K],
  ) =>
    setDraft((current) => ({
      ...current,
      clinician: { ...current.clinician, [key]: value },
    }));
  const updateLocation = <K extends keyof BillReviewLocation>(
    key: K,
    value: BillReviewLocation[K],
  ) =>
    setDraft((current) => ({
      ...current,
      location: { ...current.location, [key]: value },
    }));

  async function run(action: "save" | "submit", task: () => Promise<void>) {
    setBusy(action);
    setError("");
    setNotice("");
    try {
      await task();
      setNotice(action === "save" ? "Changes saved." : "Bill submitted.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "MindBill could not complete this request.",
      );
    } finally {
      setBusy("");
    }
  }

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    void run("save", async () => {
      const updated = await onSave(buildBillReviewSaveInput(draft));
      if (updated) setDraft(toDraft(updated));
    });
  };

  const handleSubmit = () =>
    run("submit", () => onSubmit(buildBillReviewSaveInput(draft), route));

  const attach = async () => {
    if (!file) return;
    setBusy("attachment");
    setError("");
    try {
      await onAddAttachment(file, documentType, DOCUMENT_LABELS[documentType]);
      setFile(null);
      setDocumentType("other");
      setNotice("Document added to the payer packet.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Document could not be attached.");
    } finally {
      setBusy("");
    }
  };

  const sectionClass = "mb-native-section";
  return (
    <form
      className={["mb-native-review", className].filter(Boolean).join(" ")}
      style={appearanceStyle(appearance, style)}
      onSubmit={handleSave}
    >
      <style>{NATIVE_BILL_REVIEW_STYLES}</style>
      <header className="mb-native-heading">
        <div>
          <span className="mb-native-eyebrow">Billing review</span>
          <h2>Bill #{data.bill.billNumber}</h2>
          <p>Review the prefilled claim and payer packet, then submit.</p>
        </div>
        <div className="mb-native-total">
          <span>{data.bill.status}</span>
          <strong>{money(data.bill.totalCharge)}</strong>
        </div>
      </header>

      <dl className="mb-native-summary">
        <div><dt>Patient</dt><dd>{data.patient.name || "—"}</dd></div>
        <div><dt>Claim</dt><dd>{data.injury.claimNumber || "—"}</dd></div>
        <div><dt>Employer</dt><dd>{data.injury.employer || "—"}</dd></div>
        <div><dt>Date of injury</dt><dd>{data.injury.doi || "—"}</dd></div>
      </dl>

      <section className={sectionClass}>
        <div className="mb-native-section-head"><div><h3>Claim and service</h3><p>These values print on the bill.</p></div></div>
        <div className="mb-native-grid three">
          <Field label="Date of service" type="date" required value={draft.dos} onChange={(dos) => setDraft((current) => ({ ...current, dos }))} />
          <Field label="End date" type="date" optional value={draft.dosEnd} onChange={(dosEnd) => setDraft((current) => ({ ...current, dosEnd }))} />
          <Field label="Authorization number" optional value={draft.authorizationNumber} onChange={(authorizationNumber) => setDraft((current) => ({ ...current, authorizationNumber }))} />
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mb-native-section-head"><div><h3>Billing practice</h3><p>Payee identity and billing address for this claim.</p></div><span>Prefilled</span></div>
        <div className="mb-native-grid three">
          <Field label="Practice name" required value={draft.billingProvider.name} onChange={(value) => updateBillingProvider("name", value)} />
          <Field label="Tax ID" required value={draft.billingProvider.taxId} onChange={(value) => updateBillingProvider("taxId", value)} />
          <Field label="Group NPI" required value={draft.billingProvider.npi} onChange={(value) => updateBillingProvider("npi", value)} />
          <Field label="Phone" optional value={draft.billingProvider.phone || ""} onChange={(value) => updateBillingProvider("phone", value)} />
          <Field label="Billing street" required value={draft.billingProvider.billingStreet || ""} onChange={(value) => updateBillingProvider("billingStreet", value)} />
          <Field label="City" required value={draft.billingProvider.billingCity || ""} onChange={(value) => updateBillingProvider("billingCity", value)} />
          <Field label="State" required value={draft.billingProvider.billingState || ""} onChange={(value) => updateBillingProvider("billingState", value)} />
          <Field label="ZIP" required value={draft.billingProvider.billingZip || ""} onChange={(value) => updateBillingProvider("billingZip", value)} />
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mb-native-section-head"><div><h3>Clinician</h3><p>Provider identity printed on the claim.</p></div><span>Prefilled</span></div>
        <div className="mb-native-grid three">
          <Field label="Clinician name" required value={draft.clinician.name} onChange={(value) => updateClinician("name", value)} />
          <Field label="Specialty" value={draft.clinician.specialty} onChange={(value) => updateClinician("specialty", value)} />
          <Field label="NPI" required value={draft.clinician.npi} onChange={(value) => updateClinician("npi", value)} />
          <Field label="Taxonomy" optional value={draft.clinician.taxonomy || ""} onChange={(value) => updateClinician("taxonomy", value)} />
          <Field label="License number" optional value={draft.clinician.licenseNumber || ""} onChange={(value) => updateClinician("licenseNumber", value)} />
          <Field label="License state" optional value={draft.clinician.licenseState || ""} onChange={(value) => updateClinician("licenseState", value)} />
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mb-native-section-head"><div><h3>Service location</h3><p>The exact place of service for this bill.</p></div><span>Prefilled</span></div>
        <div className="mb-native-grid three">
          <Field label="Location name" required value={draft.location.name} onChange={(value) => updateLocation("name", value)} />
          <Field label="Street" required value={draft.location.street} onChange={(value) => updateLocation("street", value)} />
          <Field label="City" required value={draft.location.city} onChange={(value) => updateLocation("city", value)} />
          <Field label="State" required value={draft.location.state} onChange={(value) => updateLocation("state", value)} />
          <Field label="ZIP" required value={draft.location.zip} onChange={(value) => updateLocation("zip", value)} />
          <Field label="Place of service code" required value={draft.location.posCode || "11"} onChange={(value) => updateLocation("posCode", value)} />
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mb-native-section-head"><div><h3>Procedure lines</h3><p>MindBill recalculates the allowed amount when changes are saved.</p></div><button type="button" className="mb-native-button quiet" disabled={!editable} onClick={() => setDraft((current) => ({ ...current, lineItems: [...current.lineItems, { code: "", modifiers: [], units: 1, charge: 0 }] }))}>+ Add line</button></div>
        <div className="mb-native-lines">
          {draft.lineItems.map((line, index) => (
            <div className="mb-native-line" key={line.id || index}>
              <Field label="Procedure" required value={line.code} onChange={(value) => setDraft((current) => ({ ...current, lineItems: current.lineItems.map((item, itemIndex) => itemIndex === index ? { ...item, code: value } : item) }))} />
              <Field label="Modifiers" value={line.modifiers.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, lineItems: current.lineItems.map((item, itemIndex) => itemIndex === index ? { ...item, modifiers: value.split(",").map((part) => part.trim()).filter(Boolean) } : item) }))} />
              <label className="mb-native-field"><span>Units</span><input type="number" min="1" required value={line.units} onChange={(event) => setDraft((current) => ({ ...current, lineItems: current.lineItems.map((item, itemIndex) => itemIndex === index ? { ...item, units: Number(event.target.value) } : item) }))} /></label>
              <div className="mb-native-allowed"><span>Allowed</span><strong>{money(line.charge)}</strong></div>
              <button type="button" className="mb-native-remove" aria-label={`Remove ${line.code || "procedure"}`} disabled={!editable || draft.lineItems.length === 1} onClick={() => setDraft((current) => ({ ...current, lineItems: current.lineItems.filter((_, itemIndex) => itemIndex !== index) }))}>×</button>
            </div>
          ))}
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mb-native-section-head"><div><h3>Payer billing packet</h3><p>Review exactly what will be sent with this bill.</p></div><span>{data.bill.attachments.length} files</span></div>
        <div className="mb-native-note"><strong>Separate from attorney report service.</strong> Final reports, proof of service, and required billing forms may be preselected. Medical records are never silently attached.</div>
        <ul className="mb-native-documents">
          {data.bill.attachments.map((attachment) => (
            <li key={attachment.id}>
              <span className="mb-native-file">PDF</span>
              <div><strong>{attachment.filename}</strong><span>{DOCUMENT_LABELS[attachment.documentType as BillReviewDocumentType] || attachment.description || "Supporting document"}</span></div>
              {onOpenAttachment ? <button type="button" className="mb-native-button quiet" onClick={() => onOpenAttachment(attachment)}>View</button> : null}
              <button type="button" className="mb-native-remove" disabled={!editable || busy === "attachment"} aria-label={`Remove ${attachment.filename}`} onClick={() => void onRemoveAttachment(attachment.id).catch((cause) => setError(cause instanceof Error ? cause.message : "Document could not be removed."))}>×</button>
            </li>
          ))}
        </ul>
        <div className="mb-native-attach">
          <div><strong>Add supporting PDF</strong><span>Choose any additional document intentionally. Up to 25 MB.</span></div>
          <select aria-label="Document type" value={documentType} disabled={!editable} onChange={(event) => setDocumentType(event.target.value as BillReviewDocumentType)}>{Object.entries(DOCUMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <input aria-label="Choose supporting PDF" type="file" accept="application/pdf,.pdf" disabled={!editable} onChange={(event) => setFile(event.target.files?.[0] || null)} />
          <button className="mb-native-button secondary" type="button" disabled={!editable || !file || busy === "attachment"} onClick={() => void attach()}>{busy === "attachment" ? "Attaching…" : "Attach document"}</button>
        </div>
      </section>

      <section className="mb-native-submit">
        <div><span className="mb-native-eyebrow">Delivery</span><h3>Submit this bill</h3><p>MindBill will send the claim and own status, payment, denial, and resubmission.</p></div>
        <fieldset><legend>Send via</legend>{(["ebill", "fax", "mail", "email"] as const).map((value) => <label key={value}><input type="radio" name={routeName} value={value} checked={route === value} onChange={() => setRoute(value)} />{value === "ebill" ? "E-bill" : value.charAt(0).toUpperCase() + value.slice(1)}</label>)}</fieldset>
        {error ? <div className="mb-native-message error" role="alert">{error}</div> : null}
        {notice ? <div className="mb-native-message success" role="status">{notice}</div> : null}
        <div className="mb-native-actions">
          <button className="mb-native-button secondary" type="submit" disabled={!editable || busy !== ""}>{busy === "save" ? "Saving…" : "Save changes"}</button>
          <button className="mb-native-button primary" type="button" disabled={!editable || !canSubmit || busy !== ""} onClick={() => void handleSubmit()}>{busy === "submit" ? "Submitting…" : "Submit bill"}</button>
        </div>
      </section>
    </form>
  );
}

export type BillStatusSummaryProps = {
  status: string;
  submittedAt?: string | null;
  totalCharge: number;
  totalPaid: number;
  balanceDue: number;
  className?: string;
  style?: CSSProperties;
  appearance?: MindBillAppearance;
};

export function BillStatusSummary({ status, submittedAt, totalCharge, totalPaid, balanceDue, className, style, appearance }: BillStatusSummaryProps): ReactElement {
  return <section className={["mb-native-status", className].filter(Boolean).join(" ")} style={appearanceStyle(appearance, style)}>
    <style>{NATIVE_BILL_REVIEW_STYLES}</style>
    <div><span className="mb-native-eyebrow">Bill status</span><h3>{status.replaceAll("_", " ")}</h3>{submittedAt ? <p>Submitted {new Date(submittedAt).toLocaleDateString()}</p> : null}</div>
    <dl><div><dt>Charged</dt><dd>{money(totalCharge)}</dd></div><div><dt>Paid</dt><dd>{money(totalPaid)}</dd></div><div><dt>Balance</dt><dd>{money(balanceDue)}</dd></div></dl>
  </section>;
}

const NATIVE_BILL_REVIEW_STYLES = `
.mb-native-review,.mb-native-status{font-family:var(--mb-font,Inter,ui-sans-serif,system-ui,sans-serif)}
.mb-native-review,.mb-native-status{--mb-accent:#238dbd;--mb-accent-dark:#176f98;--mb-text:#203743;--mb-muted:#657982;--mb-border:#dbe6ea;--mb-soft:#f3f8fa;--mb-surface:#fff;color:var(--mb-text);font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}.mb-native-review *,.mb-native-status *{box-sizing:border-box}.mb-native-review{display:grid;gap:16px}.mb-native-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:6px 2px}.mb-native-heading h2,.mb-native-section h3,.mb-native-submit h3,.mb-native-status h3{margin:3px 0 2px;line-height:1.2}.mb-native-heading h2{font-size:25px}.mb-native-heading p,.mb-native-section p,.mb-native-submit p,.mb-native-status p{margin:0;color:var(--mb-muted)}.mb-native-eyebrow{color:#59727d;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.mb-native-total{display:flex;align-items:center;gap:18px}.mb-native-total span,.mb-native-section-head>span{border-radius:999px;background:var(--mb-soft);color:#58717c;font-size:11px;font-weight:800;padding:6px 10px;text-transform:capitalize}.mb-native-total strong{font-size:24px}.mb-native-summary{display:grid;grid-template-columns:repeat(4,1fr);margin:0;border:1px solid var(--mb-border);border-radius:12px;background:var(--mb-surface);overflow:hidden}.mb-native-summary div{padding:17px 20px;border-right:1px solid var(--mb-border)}.mb-native-summary div:last-child{border:0}.mb-native-summary dt,.mb-native-allowed span{color:#647982;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.mb-native-summary dd{margin:5px 0 0;font-weight:750}.mb-native-section{padding:20px;border:1px solid var(--mb-border);border-radius:14px;background:var(--mb-surface);box-shadow:0 8px 24px rgba(28,58,72,.04)}.mb-native-section-head{display:flex;align-items:start;justify-content:space-between;gap:16px;margin-bottom:17px}.mb-native-section h3,.mb-native-submit h3,.mb-native-status h3{font-size:19px}.mb-native-grid{display:grid;gap:14px}.mb-native-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.mb-native-field{display:grid;gap:6px;min-width:0;color:var(--mb-text);font-size:12px;font-weight:750}.mb-native-field small{color:var(--mb-muted);font-size:inherit;font-weight:500}.mb-native-field input,.mb-native-attach select,.mb-native-attach input{width:100%;min-height:43px;border:1px solid var(--mb-border);border-radius:8px;background:#fff;color:var(--mb-text);font:inherit;padding:10px 12px}.mb-native-field input:focus,.mb-native-attach select:focus,.mb-native-attach input:focus{border-color:var(--mb-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--mb-accent) 14%,transparent);outline:0}.mb-native-lines{display:grid;gap:10px}.mb-native-line{display:grid;grid-template-columns:1.1fr 1.1fr 110px 120px 28px;align-items:end;gap:12px;padding:13px;background:var(--mb-soft);border:1px solid #e3edf0;border-radius:10px}.mb-native-allowed{display:grid;gap:5px;padding:0 8px 11px;text-align:right}.mb-native-allowed strong{font-size:16px}.mb-native-remove{border:0;background:transparent;color:#667d86;cursor:pointer;font-size:20px;padding:7px}.mb-native-note{padding:13px 15px;border:1px solid #bdd9e4;border-radius:9px;background:#f2f9fc;color:#526d78}.mb-native-note strong{color:var(--mb-text);margin-right:12px}.mb-native-documents{list-style:none;margin:14px 0;padding:0}.mb-native-documents li{display:grid;grid-template-columns:42px 1fr auto 28px;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid var(--mb-border)}.mb-native-documents li>div{display:grid}.mb-native-documents li span{color:var(--mb-muted);font-size:12px}.mb-native-file{display:grid;place-items:center;width:40px;height:40px;border-radius:8px;background:#eaf5f9;color:var(--mb-accent)!important;font-size:11px!important;font-weight:850}.mb-native-attach{display:grid;grid-template-columns:1fr 230px minmax(220px,1fr) auto;align-items:end;gap:12px;padding:15px;border-radius:10px;background:var(--mb-soft)}.mb-native-attach>div{display:grid;gap:3px}.mb-native-attach span{color:var(--mb-muted);font-size:12px}.mb-native-button{min-height:40px;border:1px solid var(--mb-border);border-radius:8px;background:#fff;color:var(--mb-text);cursor:pointer;font:inherit;font-weight:750;padding:9px 14px}.mb-native-button.primary{border-color:var(--mb-accent);background:var(--mb-accent);color:#fff}.mb-native-button.primary:hover{background:var(--mb-accent-dark)}.mb-native-button.secondary{background:#fff}.mb-native-button.quiet{min-height:auto;background:var(--mb-soft);padding:7px 11px}.mb-native-button:disabled,.mb-native-remove:disabled{cursor:not-allowed;opacity:.5}.mb-native-submit{display:grid;grid-template-columns:1fr auto;align-items:end;gap:18px;padding:22px;border:1px solid #bcd8e2;border-radius:14px;background:linear-gradient(135deg,#f3fafc,#eaf6fa)}.mb-native-submit fieldset{display:flex;gap:6px;margin:0;padding:0;border:0}.mb-native-submit legend{position:absolute;width:1px;height:1px;overflow:hidden}.mb-native-submit fieldset label{display:flex;align-items:center;gap:6px;padding:9px 11px;border:1px solid #c9dce3;border-radius:8px;background:#fff;font-weight:700}.mb-native-actions{display:flex;justify-content:flex-end;gap:10px;grid-column:1/-1}.mb-native-message{grid-column:1/-1;padding:10px 12px;border-radius:8px}.mb-native-message.error{background:#fff0ef;color:#9d3029}.mb-native-message.success{background:#edf9f2;color:#217449}.mb-native-status{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px;border:1px solid var(--mb-border);border-radius:12px;background:#fff}.mb-native-status h3{text-transform:capitalize}.mb-native-status dl{display:flex;margin:0}.mb-native-status dl div{min-width:110px;padding:0 18px;border-left:1px solid var(--mb-border)}.mb-native-status dt{color:var(--mb-muted);font-size:11px}.mb-native-status dd{margin:4px 0 0;font-size:17px;font-weight:800}@media(max-width:900px){.mb-native-grid.three{grid-template-columns:repeat(2,minmax(0,1fr))}.mb-native-summary{grid-template-columns:repeat(2,1fr)}.mb-native-summary div:nth-child(2){border-right:0}.mb-native-summary div:nth-child(-n+2){border-bottom:1px solid var(--mb-border)}.mb-native-line{grid-template-columns:1fr 1fr 90px}.mb-native-allowed{align-self:center}.mb-native-attach{grid-template-columns:1fr 1fr}.mb-native-submit{grid-template-columns:1fr}.mb-native-submit fieldset,.mb-native-actions{grid-column:1}.mb-native-actions{justify-content:start}}@media(max-width:620px){.mb-native-heading,.mb-native-total,.mb-native-status{align-items:start;flex-direction:column}.mb-native-grid.three,.mb-native-summary,.mb-native-line,.mb-native-attach{grid-template-columns:1fr}.mb-native-summary div,.mb-native-summary div:nth-child(2){border-right:0;border-bottom:1px solid var(--mb-border)}.mb-native-line{align-items:stretch}.mb-native-allowed{text-align:left}.mb-native-submit fieldset{display:grid;grid-template-columns:1fr 1fr}.mb-native-status dl{width:100%}.mb-native-status dl div{min-width:0;flex:1;padding:0 10px}.mb-native-status dl div:first-child{padding-left:0;border-left:0}}
.mb-native-review,.mb-native-status{font-family:var(--mb-font,Inter,ui-sans-serif,system-ui,sans-serif)}
`;
