"use client";

import type { ClaimForm, BillFormData, BillLineFormData, BilledDrug } from "@mindbill/browser";
import type { MindBillReactAppearance } from "./appearance";
import { mindBillAppearanceStyle } from "./appearance";
import { acceptedNoResponseLabel } from "./bill-status-label";
import type { CSSProperties, ReactElement } from "react";

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
  name: string;
  taxId: string;
  taxIdType?: "EIN" | "SSN";
  taxIdConfigured?: boolean;
  taxIdLast4?: string;
  npi: string;
  billType: "Professional" | "Institutional" | "Dental" | "Pharmacy";
  phone?: string;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
};

export type BillReviewClinician = {
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
  formData?: BillLineFormData;
  drug?: BilledDrug;
  id?: string;
  code: string;
  modifiers: string[];
  units: number;
  charge: number;
  feeSchedule?: number;
  serviceDate?: string | null;
  serviceDateEnd?: string | null;
  diagnosisPointers?: number[];
};

/** A revenue code or NDC identifies a service even without a CPT/HCPCS code. */
export function hasBillReviewService(line: BillReviewLineItem): boolean {
  return Boolean(line.code.trim() || line.drug?.ndcNumber.trim()
    || (typeof line.formData?.institutional?.revenueCode === "string" && line.formData.institutional.revenueCode.trim()));
}

const EMPTY_PROCEDURE_LINE: BillReviewLineItem = {
  code: "",
  modifiers: [],
  units: 1,
  charge: 0,
};

function isEmptyProcedureLine(line: BillReviewLineItem): boolean {
  return !line.formData && !line.drug && !line.code.trim() && line.modifiers.length === 0 && line.units === 1 && !line.serviceDate && !line.serviceDateEnd && !line.charge && !(line.diagnosisPointers?.length);
}

/** Keeps completed/partial lines plus one keyboard-ready empty row. */
export function ensureTrailingProcedureLine(
  lines: readonly BillReviewLineItem[],
): BillReviewLineItem[] {
  const entered = lines
    .filter((line) => !isEmptyProcedureLine(line))
    .map((line) => ({ ...line, modifiers: [...line.modifiers] }));

  return entered.length < 50
    ? [...entered, { ...EMPTY_PROCEDURE_LINE, modifiers: [] }]
    : entered;
}

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

export type BillReviewPayer = {
  id: string;
  name: string;
  hasElectronic?: boolean;
  states?: string[];
  confidence?: "high" | "medium" | "directory";
  recommended?: boolean;
  signals?: Array<{
    kind: "name" | "claim_number";
    state: "match" | "warning";
    label: string;
  }>;
  /** True when a bill for this claims administrator must name one of `payers`. */
  payerSelectionRequired?: boolean;
  /** Selectable payers (subpayors) under this claims administrator. */
  payers?: Array<{ id: string; label: string; default?: boolean }>;
};

export type BillReviewFeatures = {
  authorizationNumber?: boolean;
  serviceDateRange?: boolean;
  wcabNumber?: boolean;
  codingPresets?: boolean;
};

export type BillReviewClaimPatternStatus = {
  state: "match" | "warning" | "unknown";
  label: string;
  detail?: string;
  suggestion?: string;
};

export type BillReviewData = {
  bill: {
    claimForm?: ClaimForm;
    formData?: BillFormData;
    id: string;
    billingMode: "med_legal" | "professional";
    billNumber: string | number;
    status: string;
    transmissionState?: string;
    dos: string;
    dosEnd?: string | null;
    authorizationNumber?: string | null;
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
  patient: {
    name: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    dob?: string;
  };
  injury: {
    claimNumber?: string;
    employer?: string;
    doi?: string;
    injuryEndDate?: string;
    cumulativeTrauma?: boolean;
    adjNumber?: string;
    medicalProviderNetworkId?: string | null;
    claimsAdminId?: string;
    claimsAdminName?: string;
    claimPatternStatus?: BillReviewClaimPatternStatus;
  };
};

export type BillReviewSaveInput = {
  formData?: BillFormData;
  claimsAdminId: string;
  /** The chosen payer (subpayor) when the claims administrator requires payer selection. */
  payerId?: string;
  patientOverrides?: {
    firstName: string;
    middleName?: string;
    lastName: string;
    dob?: string;
  };
  injuryOverrides?: {
    claimNumber?: string;
    employer?: string;
    doi?: string;
    injuryEndDate?: string;
    cumulativeTrauma?: boolean;
    adjNumber?: string;
    medicalProviderNetworkId?: string | null;
  };
  dos: string;
  dosEnd?: string | null;
  authorizationNumber?: string | null;
  billingProvider?: BillReviewBillingProvider;
  renderingProvider?: BillReviewClinician;
  placeOfService?: BillReviewLocation;
  lineItems: Array<{
    formData?: BillLineFormData;
    drug?: BilledDrug;
    id?: string;
    code: string;
    modifiers: string[];
    units: number;
    charge?: number;
    serviceDate?: string | null;
    serviceDateEnd?: string | null;
    diagnosisPointers?: number[];
  }>;
};

export type BillSubmissionRoute = "ebill" | "fax" | "mail" | "email";

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export type BillStatusSummaryProps = {
  status: string;
  /** Detailed server status, preserved when the canonical status is accepted. */
  nativeStatus?: string;
  submittedAt?: string | null;
  agingDays?: number | null;
  updatedAt?: string | null;
  totalCharge: number;
  totalPaid: number;
  balanceDue: number;
  actions?: BillStatusAction[];
  className?: string;
  style?: CSSProperties;
  appearance?: MindBillReactAppearance;
};

export type BillStatusAction = {
  id: string;
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
};

export function BillStatusSummary({ status, nativeStatus, submittedAt, agingDays, updatedAt, totalCharge, totalPaid, balanceDue, actions = [], className, style, appearance }: BillStatusSummaryProps): ReactElement {
  return <section className={["mb-native-status", className].filter(Boolean).join(" ")} style={mindBillAppearanceStyle(appearance, style)}>
    <style>{NATIVE_BILL_REVIEW_STYLES}</style>
    <style>{NATIVE_THEME_OVERRIDE_STYLES}</style>
    <div className="mb-native-status-copy"><span className="mb-native-eyebrow">Bill status</span><h3>{acceptedNoResponseLabel(status, nativeStatus) ?? status.replaceAll("_", " ")}</h3><p>{submittedAt ? `Submitted ${new Date(submittedAt).toLocaleDateString()}` : "Not submitted"}{agingDays == null ? "" : ` · ${agingDays} day${agingDays === 1 ? "" : "s"} old`}{updatedAt ? ` · Updated ${new Date(updatedAt).toLocaleDateString()}` : ""}</p></div>
    <dl><div><dt>Charged</dt><dd>{money(totalCharge)}</dd></div><div><dt>Paid</dt><dd>{money(totalPaid)}</dd></div><div><dt>Balance</dt><dd>{money(balanceDue)}</dd></div></dl>
    {actions.length ? <div className="mb-native-status-actions">{actions.map((action) => <button key={action.id} type="button" className={`mb-native-button ${action.primary ? "primary" : "secondary"}`} disabled={action.disabled} onClick={action.onClick}>{action.label}</button>)}</div> : null}
  </section>;
}


const NATIVE_BILL_REVIEW_STYLES = `
.mb-native-review,.mb-native-status{font-family:var(--mb-font,Inter,ui-sans-serif,system-ui,sans-serif)}
.mb-native-review,.mb-native-status{--mb-accent:#238dbd;--mb-accent-dark:#176f98;--mb-text:#203743;--mb-muted:#657982;--mb-border:#dbe6ea;--mb-soft:#f3f8fa;--mb-surface:#fff;color:var(--mb-text);font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}.mb-native-review *,.mb-native-status *{box-sizing:border-box}.mb-native-review{display:grid;gap:16px}.mb-native-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:6px 2px}.mb-native-heading h2,.mb-native-section h3,.mb-native-submit h3,.mb-native-status h3{margin:3px 0 2px;line-height:1.2}.mb-native-heading h2{font-size:25px}.mb-native-heading p,.mb-native-section p,.mb-native-submit p,.mb-native-status p{margin:0;color:var(--mb-muted)}.mb-native-eyebrow{color:#59727d;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.mb-native-total{display:flex;align-items:center;gap:18px}.mb-native-total span,.mb-native-section-head>span{border-radius:999px;background:var(--mb-soft);color:#58717c;font-size:11px;font-weight:800;padding:6px 10px;text-transform:capitalize}.mb-native-total strong{font-size:24px}.mb-native-summary{display:grid;grid-template-columns:repeat(4,1fr);margin:0;border:1px solid var(--mb-border);border-radius:12px;background:var(--mb-surface);overflow:hidden}.mb-native-summary div{padding:17px 20px;border-right:1px solid var(--mb-border)}.mb-native-summary div:last-child{border:0}.mb-native-summary dt,.mb-native-allowed span{color:#647982;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.mb-native-summary dd{margin:5px 0 0;font-weight:750}.mb-native-section{padding:20px;border:1px solid var(--mb-border);border-radius:14px;background:var(--mb-surface);box-shadow:0 8px 24px rgba(28,58,72,.04)}.mb-native-section-head{display:flex;align-items:start;justify-content:space-between;gap:16px;margin-bottom:17px}.mb-native-section h3,.mb-native-submit h3,.mb-native-status h3{font-size:19px}.mb-native-grid{display:grid;gap:14px}.mb-native-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.mb-native-field{display:grid;gap:6px;min-width:0;color:var(--mb-text);font-size:12px;font-weight:750}.mb-native-required{color:#c5352e}.mb-native-field small{color:var(--mb-muted);font-size:inherit;font-weight:500}.mb-native-field input,.mb-native-attach select,.mb-native-attach input{width:100%;min-height:43px;border:1px solid var(--mb-border);border-radius:8px;background:#fff;color:var(--mb-text);font:inherit;padding:10px 12px}.mb-native-field input:focus,.mb-native-attach select:focus,.mb-native-attach input:focus{border-color:var(--mb-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--mb-accent) 14%,transparent);outline:0}.mb-native-lines{display:grid;gap:10px}.mb-native-line{display:grid;grid-template-columns:1.1fr 1.1fr 110px 120px 28px;align-items:end;gap:12px;padding:13px;background:var(--mb-soft);border:1px solid #e3edf0;border-radius:10px}.mb-native-allowed{display:grid;gap:5px;padding:0 8px 11px;text-align:right}.mb-native-allowed strong{font-size:16px}.mb-native-remove{border:0;background:transparent;color:#667d86;cursor:pointer;font-size:20px;padding:7px}.mb-native-note{padding:13px 15px;border:1px solid #bdd9e4;border-radius:9px;background:#f2f9fc;color:#526d78}.mb-native-note strong{color:var(--mb-text);margin-right:12px}.mb-native-documents{list-style:none;margin:14px 0;padding:0}.mb-native-documents li{display:grid;grid-template-columns:42px 1fr auto 28px;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid var(--mb-border)}.mb-native-documents li>div{display:grid}.mb-native-documents li span{color:var(--mb-muted);font-size:12px}.mb-native-file{display:grid;place-items:center;width:40px;height:40px;border-radius:8px;background:#eaf5f9;color:var(--mb-accent)!important;font-size:11px!important;font-weight:850}.mb-native-attach{display:grid;grid-template-columns:1fr 230px minmax(220px,1fr) auto;align-items:end;gap:12px;padding:15px;border-radius:10px;background:var(--mb-soft)}.mb-native-attach>div{display:grid;gap:3px}.mb-native-attach span{color:var(--mb-muted);font-size:12px}.mb-native-button{min-height:40px;border:1px solid var(--mb-border);border-radius:8px;background:#fff;color:var(--mb-text);cursor:pointer;font:inherit;font-weight:750;padding:9px 14px}.mb-native-button.primary{border-color:var(--mb-accent);background:var(--mb-accent);color:#fff}.mb-native-button.primary:hover{background:var(--mb-accent-dark)}.mb-native-button.secondary{background:#fff}.mb-native-button.quiet{min-height:auto;background:var(--mb-soft);padding:7px 11px}.mb-native-button:disabled,.mb-native-remove:disabled{cursor:not-allowed;opacity:.5}.mb-native-submit{display:grid;grid-template-columns:1fr auto;align-items:end;gap:18px;padding:22px;border:1px solid #bcd8e2;border-radius:14px;background:linear-gradient(135deg,#f3fafc,#eaf6fa)}.mb-native-submit fieldset{display:flex;gap:6px;margin:0;padding:0;border:0}.mb-native-submit legend{position:absolute;width:1px;height:1px;overflow:hidden}.mb-native-submit fieldset label{display:flex;align-items:center;gap:6px;padding:9px 11px;border:1px solid #c9dce3;border-radius:8px;background:#fff;font-weight:700}.mb-native-actions{display:flex;justify-content:flex-end;gap:10px;grid-column:1/-1}.mb-native-message{grid-column:1/-1;padding:10px 12px;border-radius:8px}.mb-native-message.error{background:#fff0ef;color:#9d3029}.mb-native-message.success{background:#edf9f2;color:#217449}.mb-native-status{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px;border:1px solid var(--mb-border);border-radius:12px;background:#fff}.mb-native-status h3{text-transform:capitalize}.mb-native-status dl{display:flex;margin:0}.mb-native-status dl div{min-width:110px;padding:0 18px;border-left:1px solid var(--mb-border)}.mb-native-status dt{color:var(--mb-muted);font-size:11px}.mb-native-status dd{margin:4px 0 0;font-size:17px;font-weight:800}@media(max-width:900px){.mb-native-grid.three{grid-template-columns:repeat(2,minmax(0,1fr))}.mb-native-summary{grid-template-columns:repeat(2,1fr)}.mb-native-summary div:nth-child(2){border-right:0}.mb-native-summary div:nth-child(-n+2){border-bottom:1px solid var(--mb-border)}.mb-native-line{grid-template-columns:1fr 1fr 90px}.mb-native-allowed{align-self:center}.mb-native-attach{grid-template-columns:1fr 1fr}.mb-native-submit{grid-template-columns:1fr}.mb-native-submit fieldset,.mb-native-actions{grid-column:1}.mb-native-actions{justify-content:start}}@media(max-width:620px){.mb-native-heading,.mb-native-total,.mb-native-status{align-items:start;flex-direction:column}.mb-native-grid.three,.mb-native-summary,.mb-native-line,.mb-native-attach{grid-template-columns:1fr}.mb-native-summary div,.mb-native-summary div:nth-child(2){border-right:0;border-bottom:1px solid var(--mb-border)}.mb-native-line{align-items:stretch}.mb-native-allowed{text-align:left}.mb-native-submit fieldset{display:grid;grid-template-columns:1fr 1fr}.mb-native-status dl{width:100%}.mb-native-status dl div{min-width:0;flex:1;padding:0 10px}.mb-native-status dl div:first-child{padding-left:0;border-left:0}}
.mb-native-status-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.mb-native-status-copy{min-width:150px}.mb-native-review,.mb-native-status{font-family:var(--mb-font,Inter,ui-sans-serif,system-ui,sans-serif)}
.mb-native-review{padding:clamp(16px,2vw,24px)}
.mb-native-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}
.mb-native-payer-picker{position:relative;max-width:760px}
.mb-native-payer-help{display:block;margin-top:7px;color:var(--mb-muted);font-size:12px}
.mb-native-payer-results{position:absolute;z-index:5;top:calc(100% + 6px);right:0;left:0;max-height:280px;overflow:auto;list-style:none;margin:0;padding:6px;border:1px solid var(--mb-border);border-radius:10px;background:var(--mb-surface);box-shadow:0 16px 40px rgba(28,58,72,.16)}
.mb-native-payer-results li{margin:0;padding:0}
.mb-native-payer-results button{display:grid;width:100%;gap:2px;padding:11px 12px;border:0;border-radius:7px;background:transparent;color:var(--mb-text);font:inherit;text-align:left;cursor:pointer}
.mb-native-payer-results button:hover,.mb-native-payer-results button:focus{background:var(--mb-soft);outline:0}
.mb-native-payer-results span{color:var(--mb-muted);font-size:12px}
.mb-native-grid.one{grid-template-columns:minmax(0,1fr)}
.mb-native-field select{width:100%;min-height:43px;border:1px solid var(--mb-border);border-radius:8px;background:#fff;color:var(--mb-text);font:inherit;padding:10px 36px 10px 12px}
.mb-native-field select:focus{border-color:var(--mb-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--mb-accent) 14%,transparent);outline:0}
.mb-native-field input:disabled,.mb-native-field select:disabled{cursor:not-allowed;background:#f6f8f9;color:#667982}
.mb-native-hint{color:var(--mb-muted);font-size:12px;font-weight:500}
.mb-native-combo{position:relative;min-width:0}
.mb-native-combo-list{position:absolute;z-index:20;top:calc(100% + 6px);right:0;left:0;max-height:300px;overflow:auto;list-style:none;margin:0;padding:6px;border:1px solid var(--mb-border);border-radius:10px;background:var(--mb-surface);box-shadow:0 18px 42px rgba(28,58,72,.18)}
.mb-native-combo-list li{margin:0;padding:0}.mb-native-combo-list button{display:grid;width:100%;gap:4px;padding:11px 12px;border:0;border-radius:7px;background:transparent;color:var(--mb-text);font:inherit;text-align:left;cursor:pointer}.mb-native-combo-list button:hover,.mb-native-combo-list button.active{background:var(--mb-soft);outline:0}.mb-native-combo-list button>span{color:var(--mb-muted);font-size:12px;font-weight:500}.mb-native-combo-list .mb-native-combo-title{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--mb-text);font-size:14px}.mb-native-combo-title em{border-radius:999px;background:#e9f6f3;color:#24725f;font-size:10px;font-style:normal;font-weight:800;letter-spacing:.03em;padding:3px 7px;text-transform:uppercase}
.mb-native-payer-insight{display:grid;gap:5px;margin-top:10px;padding:11px 13px;border:1px solid #c9dfe7;border-radius:9px;background:#f4fafc}.mb-native-payer-insight span{color:#426570;font-size:12px}.mb-native-payer-insight span.warning{color:#8a5c17}
.mb-native-presets{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin:-2px 0 14px}.mb-native-presets button{min-height:36px;border:1px solid var(--mb-border);border-radius:8px;background:#fff;color:var(--mb-text);cursor:pointer;font:inherit;font-weight:750;padding:7px 13px}.mb-native-presets button.active{border-color:var(--mb-accent);background:var(--mb-accent);color:#fff}.mb-native-presets span{margin-left:5px;color:var(--mb-muted);font-size:12px}
.mb-native-modifiers{display:grid;gap:7px}.mb-native-chips{display:flex;flex-wrap:wrap;gap:5px}.mb-native-chips button{border:1px solid #c9dce3;border-radius:999px;background:#fff;color:var(--mb-text);cursor:pointer;font:inherit;font-size:11px;font-weight:750;padding:4px 8px}
.mb-native-blockers{grid-column:1/-1;display:grid;gap:2px;padding:11px 13px;border:1px solid #e8cf9a;border-radius:8px;background:#fff9ea;color:#74531b}.mb-native-blockers span{font-size:12px}
.mb-native-eams{margin-top:13px!important;font-size:12px}.mb-native-eams a{color:var(--mb-accent);font-weight:750}
@media(max-width:620px){.mb-native-review{padding:12px}.mb-native-grid.two{grid-template-columns:1fr}}
`;

const NATIVE_THEME_OVERRIDE_STYLES = `
.mb-native-review,.mb-native-status{color:var(--mb-text);font-family:var(--mb-font,Inter,ui-sans-serif,system-ui,sans-serif)}
.mb-native-review{background:var(--mb-soft)}
.mb-native-heading>div:first-child>p,.mb-native-section>header p,.mb-native-total span,.mb-native-status-copy p,.mb-native-status dt{color:var(--mb-muted)}
.mb-native-summary,.mb-native-section,.mb-native-status{border-color:var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);box-shadow:var(--mb-shadow)}
.mb-native-field input,.mb-native-field select,.mb-native-field textarea,.mb-native-attachment-form input,.mb-native-attachment-form select{border-color:var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-input);color:var(--mb-text)}
.mb-native-line,.mb-native-note,.mb-native-file,.mb-native-attachment-form,.mb-native-payer-insight,.mb-native-blockers,.mb-native-message{border-radius:var(--mb-control-radius)}
.mb-native-line,.mb-native-note,.mb-native-attachment-form,.mb-native-payer-insight{border-color:var(--mb-border);background:var(--mb-soft)}
.mb-native-file{border-color:var(--mb-border);background:var(--mb-surface)}
.mb-native-button.primary,.mb-native-presets button.active{border-color:var(--mb-accent);background:var(--mb-accent);color:var(--mb-accent-contrast)}
.mb-native-button.primary:hover,.mb-native-presets button.active:hover{filter:brightness(.96)}
.mb-native-button.secondary,.mb-native-presets button,.mb-native-chips button{border-color:var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-input);color:var(--mb-text)}
.mb-native-message.error{background:color-mix(in srgb,var(--mb-danger) 10%,white);color:var(--mb-danger)}
.mb-native-message.success{background:color-mix(in srgb,var(--mb-success) 10%,white);color:var(--mb-success)}
.mb-native-blockers{border-color:color-mix(in srgb,var(--mb-warning) 35%,white);background:color-mix(in srgb,var(--mb-warning) 8%,white);color:var(--mb-warning)}
.mb-native-combo-list{border-color:var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);box-shadow:var(--mb-shadow)}
`;
