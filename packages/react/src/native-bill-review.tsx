"use client";

import type { MindBillReactAppearance } from "./appearance";
import { mindBillAppearanceStyle } from "./appearance";
import type { CSSProperties, FormEvent, KeyboardEvent, ReactElement } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

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
  npi: string;
  billType: "Professional" | "Institutional";
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

const EMPTY_PROCEDURE_LINE: BillReviewLineItem = {
  code: "",
  modifiers: [],
  units: 1,
  charge: 0,
};

function isEmptyProcedureLine(line: BillReviewLineItem): boolean {
  return !line.code.trim() && line.modifiers.length === 0 && line.units === 1;
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
    id: string;
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
    claimsAdminId?: string;
    claimsAdminName?: string;
    claimPatternStatus?: BillReviewClaimPatternStatus;
  };
};

export type BillReviewSaveInput = {
  claimsAdminId: string;
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
  };
  dos: string;
  dosEnd?: string | null;
  authorizationNumber?: string | null;
  billingProvider?: BillReviewBillingProvider;
  renderingProvider?: BillReviewClinician;
  placeOfService?: BillReviewLocation;
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
  onSearchClaimsAdministrators?: (
    query: string,
    claimNumber?: string,
  ) => Promise<BillReviewPayer[]>;
  className?: string;
  style?: CSSProperties;
  appearance?: MindBillReactAppearance;
  features?: BillReviewFeatures;
  disabled?: boolean;
};

export type BillReviewDraft = {
  claimsAdminId: string;
  claimsAdminName: string;
  patientFirstName: string;
  patientMiddleName: string;
  patientLastName: string;
  patientDob: string;
  claimNumber: string;
  employer: string;
  doi: string;
  injuryEndDate: string;
  cumulativeTrauma: boolean;
  adjNumber: string;
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

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];
const PROCEDURES = [
  ["ML200", "Missed med-legal appointment"],
  ["ML201", "Comprehensive med-legal evaluation"],
  ["ML202", "Follow-up med-legal evaluation"],
  ["ML203", "Supplemental med-legal evaluation"],
  ["ML204", "Medical-legal testimony"],
  ["ML205", "Sub rosa recording review"],
  ["MLPRR", "Medical record review"],
] as const;
const MODIFIERS = [
  ["92", "Primary treating physician"], ["93", "Interpreter required"],
  ["94", "Agreed medical evaluator (AME)"], ["95", "Qualified medical evaluator (QME)"],
  ["96", "Psychiatric or psychological evaluation"], ["97", "Toxicology evaluation"],
  ["98", "Oncology evaluation"],
] as const;
type CodingPreset = "qme" | "ame" | "psych_qme";
const MANAGED_EVALUATOR_MODIFIERS = new Set(["94", "95", "96"]);
const MODIFIER_CODES: Record<string, readonly string[]> = {
  "92": ["ML201", "ML202", "ML203"],
  "93": ["ML201", "ML202"],
  "94": ["ML201", "ML202", "ML203"],
  "95": ["ML200", "ML201", "ML202", "ML203", "MLPRR"],
  "96": ["ML201", "ML202", "ML203"],
  "97": ["ML201", "ML202", "ML203"],
  "98": ["ML201", "ML202", "ML203"],
};

function toDraft(data: BillReviewData): BillReviewDraft {
  const snapshot = data.bill.billingSnapshot;
  const nameParts = data.patient.name.trim().split(/\s+/);
  return {
    claimsAdminId: data.injury.claimsAdminId || "",
    claimsAdminName: data.injury.claimsAdminName || "",
    patientFirstName: data.patient.firstName || nameParts[0] || "",
    patientMiddleName: data.patient.middleName || (nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : ""),
    patientLastName: data.patient.lastName || (nameParts.length > 1 ? (nameParts.at(-1) || "") : ""),
    patientDob: data.patient.dob || "",
    claimNumber: data.injury.claimNumber || "",
    employer: data.injury.employer || "",
    doi: data.injury.doi || "",
    injuryEndDate: data.injury.injuryEndDate || "",
    cumulativeTrauma: Boolean(data.injury.cumulativeTrauma),
    adjNumber: data.injury.adjNumber || "",
    dos: data.bill.dos || "",
    dosEnd: data.bill.dosEnd || "",
    authorizationNumber: data.bill.authorizationNumber || "",
    billingProvider: {
      ...EMPTY_BILLING_PROVIDER,
      ...(snapshot?.billingProvider ?? {}),
    },
    clinician: { ...EMPTY_CLINICIAN, ...(snapshot?.renderingProvider ?? {}) },
    location: { ...EMPTY_LOCATION, ...(snapshot?.placeOfService ?? {}) },
    lineItems: ensureTrailingProcedureLine(data.bill.lineItems),
  };
}

export function buildBillReviewSaveInput(
  draft: BillReviewDraft,
): BillReviewSaveInput {
  return {
    claimsAdminId: draft.claimsAdminId,
    patientOverrides: {
      firstName: draft.patientFirstName.trim(),
      ...(draft.patientMiddleName.trim() ? { middleName: draft.patientMiddleName.trim() } : {}),
      lastName: draft.patientLastName.trim(),
      ...(draft.patientDob ? { dob: draft.patientDob } : {}),
    },
    injuryOverrides: {
      ...(draft.claimNumber.trim() ? { claimNumber: draft.claimNumber.trim() } : {}),
      ...(draft.employer.trim() ? { employer: draft.employer.trim() } : {}),
      ...(draft.doi ? { doi: draft.doi } : {}),
      ...(draft.injuryEndDate ? { injuryEndDate: draft.injuryEndDate } : {}),
      cumulativeTrauma: draft.cumulativeTrauma,
      ...(draft.adjNumber.trim() ? { adjNumber: draft.adjNumber.trim().toUpperCase().replace(/\s+/g, "") } : {}),
    },
    dos: draft.dos,
    dosEnd: draft.dosEnd || null,
    authorizationNumber: draft.authorizationNumber.trim() || null,
    billingProvider: { ...draft.billingProvider },
    renderingProvider: { ...draft.clinician },
    placeOfService: { ...draft.location },
    lineItems: draft.lineItems.filter((line) => line.code.trim()).map(({ id, code, modifiers, units }) => ({
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

function Field({
  label,
  value,
  onChange,
  type = "text",
  optional,
  required,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  optional?: boolean;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
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
        disabled={disabled}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <small className="mb-native-hint">{hint}</small> : null}
    </label>
  );
}

type ComboOption = {
  value: string;
  label: string;
  detail?: string;
  badge?: string;
};

function Combobox({ label, value, options, onChange, placeholder, required, disabled, name }: {
  label: string;
  value: string;
  options: ComboOption[];
  onChange: (value: string, option?: ComboOption) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
}): ReactElement {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    return options.filter((option) => !query || option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query)).slice(0, 40);
  }, [options, value]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const select = (option: ComboOption) => {
    onChange(option.value, option);
    setOpen(false);
    setActive(0);
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive((value) => Math.min(value + 1, filtered.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
    if (event.key === "Enter" && open && filtered[active]) { event.preventDefault(); select(filtered[active]); }
    if (event.key === "Escape") setOpen(false);
  };
  return <div className="mb-native-combo" ref={root}>
    <label className="mb-native-field">
      <span>{label}</span>
      <input
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open && filtered.length > 0}
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        name={name || "mindbill-search-value"}
        autoComplete="new-password"
        data-1p-ignore="true"
        data-lpignore="true"
        value={value}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onKeyDown={keyDown}
        onChange={(event) => { onChange(event.target.value); setOpen(true); setActive(0); }}
      />
    </label>
    {open && filtered.length ? <ul id={listId} role="listbox" className="mb-native-combo-list">
      {filtered.map((option, index) => <li id={`${listId}-${index}`} role="option" aria-selected={index === active} key={`${option.value}-${index}`}>
        <button type="button" className={index === active ? "active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => select(option)}>
          <span className="mb-native-combo-title"><strong>{option.label}</strong>{option.badge ? <em>{option.badge}</em> : null}</span>{option.detail ? <span>{option.detail}</span> : null}
        </button>
      </li>)}
    </ul> : null}
  </div>;
}

function StateCombobox({ label, value, onChange, required, disabled }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; disabled?: boolean }): ReactElement {
  return <Combobox
    label={label}
    value={value}
    onChange={(next) => onChange(next.toUpperCase().slice(0, 2))}
    options={US_STATES.map((state) => ({ value: state, label: state }))}
    {...(required === undefined ? {} : { required })}
    {...(disabled === undefined ? {} : { disabled })}
    name="mindbill-state-value"
  />;
}

function inferPreset(lines: BillReviewLineItem[]): CodingPreset {
  const modifiers = new Set(lines.flatMap((line) => line.modifiers));
  return modifiers.has("94") ? "ame" : modifiers.has("96") ? "psych_qme" : "qme";
}

function presetModifiersForCode(preset: CodingPreset, code: string): string[] {
  if (code === "MLPRR") return ["95"];
  if (preset === "qme" && ["ML200", "ML201", "ML202", "ML203"].includes(code)) return ["95"];
  if (preset === "ame" && ["ML201", "ML202", "ML203"].includes(code)) return ["94"];
  if (preset === "psych_qme") {
    if (code === "ML200") return ["95"];
    if (["ML201", "ML202", "ML203"].includes(code)) return ["96"];
  }
  return [];
}

function modifierAppliesToCode(modifier: string, code: string): boolean {
  return !code || (MODIFIER_CODES[modifier]?.includes(code) ?? true);
}

function applyPreset(lines: BillReviewLineItem[], preset: CodingPreset): BillReviewLineItem[] {
  return lines.map((line) => {
    const preserved = line.modifiers.filter(
      (value) => !MANAGED_EVALUATOR_MODIFIERS.has(value) && modifierAppliesToCode(value, line.code),
    );
    return {
      ...line,
      modifiers: [...new Set([...presetModifiersForCode(preset, line.code), ...preserved])],
    };
  });
}

export function BillReviewForm({
  data,
  onSave,
  onSubmit,
  onAddAttachment,
  onRemoveAttachment,
  onOpenAttachment,
  onSearchClaimsAdministrators,
  className,
  style,
  appearance,
  features,
  disabled = false,
}: BillReviewFormProps): ReactElement {
  const [draft, setDraft] = useState(() => toDraft(data));
  const [payerQuery, setPayerQuery] = useState(
    () => data.injury.claimsAdminName || "",
  );
  const [payerResults, setPayerResults] = useState<BillReviewPayer[]>([]);
  const [payerBusy, setPayerBusy] = useState(false);
  const [route, setRoute] = useState<BillSubmissionRoute>("ebill");
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] =
    useState<BillReviewDocumentType>("other");
  const [busy, setBusy] = useState<"save" | "submit" | "attachment" | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const routeName = useId();
  const editable = data.bill.status === "incomplete" && !disabled;

  useEffect(() => {
    setDraft(toDraft(data));
    setPayerQuery(data.injury.claimsAdminName || "");
  }, [data]);

  useEffect(() => {
    const query = payerQuery.trim();
    const claimNumber = draft.claimNumber.trim();
    if (
      !onSearchClaimsAdministrators ||
      (query.length < 2 && claimNumber.length < 4)
    ) {
      setPayerResults([]);
      setPayerBusy(false);
      return;
    }
    let current = true;
    const timer = window.setTimeout(() => {
      setPayerBusy(true);
      void onSearchClaimsAdministrators(query, claimNumber)
        .then((results) => {
          if (!current) return;
          setPayerResults(results);
          const recommendation = results.find(
            (payer) => payer.recommended && payer.confidence === "high",
          );
          if (!draft.claimsAdminId && recommendation) {
            setDraft((currentDraft) => ({
              ...currentDraft,
              claimsAdminId: recommendation.id,
              claimsAdminName: recommendation.name,
            }));
            setPayerQuery(recommendation.name);
            setNotice(
              "Claims administrator matched from the case data. Review and save to keep it on this bill.",
            );
          }
        })
        .catch((cause) => {
          if (current) {
            setPayerResults([]);
            setError(
              cause instanceof Error
                ? cause.message
                : "Claims administrator search is unavailable.",
            );
          }
        })
        .finally(() => {
          if (current) setPayerBusy(false);
        });
    }, 200);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [
    draft.claimNumber,
    draft.claimsAdminId,
    onSearchClaimsAdministrators,
    payerQuery,
  ]);

  const selectedPayer = payerResults.find(
    (payer) => payer.id === draft.claimsAdminId,
  );

  const adjFormatValid =
    !draft.adjNumber ||
    /^ADJ\d{7,}$/i.test(draft.adjNumber.replace(/[\s-]/g, ""));
  const blockers = useMemo(() => {
    const result: string[] = [];
    if (!draft.patientFirstName.trim() || !draft.patientLastName.trim()) result.push("Patient name");
    if (!draft.claimsAdminId) result.push("Claims administrator");
    if (!draft.claimNumber.trim()) result.push("Claim number");
    if (!draft.doi) result.push("Date of injury");
    if (!adjFormatValid) result.push("Valid WCAB / ADJ number");
    if (!draft.dos) result.push("Date of service");
    if (!draft.billingProvider.name.trim()) result.push("Practice name");
    if (!draft.billingProvider.taxId.trim()) result.push("Tax ID");
    if (!draft.billingProvider.npi.trim()) result.push("Billing NPI");
    if (!draft.clinician.name.trim() || !draft.clinician.npi.trim()) result.push("Clinician and NPI");
    if (![draft.location.name, draft.location.street, draft.location.city, draft.location.state, draft.location.zip].every((value) => value.trim())) result.push("Service location");
    const completedLines = draft.lineItems.filter((line) => line.code.trim());
    if (!completedLines.length || completedLines.some((line) => line.units <= 0)) result.push("Valid procedure line");
    return result;
  }, [adjFormatValid, draft]);
  const canSubmit = blockers.length === 0;

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
        cause instanceof Error
          ? cause.message
          : "The billing request could not be completed.",
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
      style={mindBillAppearanceStyle(appearance, style)}
      onSubmit={handleSave}
    >
      <style>{NATIVE_BILL_REVIEW_STYLES}</style>
      <style>{NATIVE_THEME_OVERRIDE_STYLES}</style>
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
        <div><dt>Patient</dt><dd>{[draft.patientFirstName, draft.patientMiddleName, draft.patientLastName].filter(Boolean).join(" ") || "—"}</dd></div>
        <div><dt>Claim</dt><dd>{draft.claimNumber || "—"}</dd></div>
        <div><dt>Employer</dt><dd>{draft.employer || "—"}</dd></div>
        <div><dt>Date of injury</dt><dd>{draft.doi || "—"}</dd></div>
      </dl>

      <section className={sectionClass}>
        <div className="mb-native-section-head">
          <div>
            <h3>Claims administrator</h3>
            <p>Select the carrier or administrator that should receive this bill.</p>
          </div>
          {draft.claimsAdminId ? <span>Selected</span> : <span>Required</span>}
        </div>
        <div className="mb-native-payer-picker">
          <Combobox
            label="Insurance company or claims administrator"
            value={payerQuery}
            disabled={!editable}
            placeholder="Search by payer or administrator name"
            name="mindbill-payer-query"
            options={payerResults.map((payer) => ({
              value: payer.id,
              label: payer.name,
              ...(payer.recommended
                ? { badge: "Recommended" }
                : payer.confidence === "medium"
                  ? { badge: "Claim match" }
                  : {}),
              detail: [
                ...(payer.signals ?? []).map((signal) => signal.label),
                payer.hasElectronic
                  ? "Electronic billing available."
                  : "Billing route confirmed after review.",
              ].join(" "),
            }))}
            onChange={(value, option) => {
              if (option) {
                setDraft((current) => ({ ...current, claimsAdminId: option.value, claimsAdminName: option.label }));
                setPayerQuery(option.label);
                setNotice("Claims administrator selected. Save changes to keep it on this bill.");
              } else {
                setPayerQuery(value);
                setDraft((current) => value === current.claimsAdminName ? current : { ...current, claimsAdminId: "", claimsAdminName: "" });
              }
            }}
          />
          {payerBusy ? <span className="mb-native-payer-help">Searching…</span> : null}
          {!payerBusy && payerQuery.trim().length > 1 && payerResults.length === 0 && !draft.claimsAdminId ? (
            <span className="mb-native-payer-help">No matching administrator selected yet.</span>
          ) : null}
          {selectedPayer?.signals?.length ? (
            <div className="mb-native-payer-insight" role="status">
              {selectedPayer.signals.map((signal) => (
                <span className={signal.state} key={`${signal.kind}-${signal.label}`}>
                  {signal.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mb-native-section-head"><div><h3>Patient and claim</h3><p>Prefilled from the case. Correct anything that should print differently on this bill.</p></div><span>Editable</span></div>
        <div className="mb-native-grid three">
          <Field label="Patient first name" required disabled={!editable} value={draft.patientFirstName} onChange={(patientFirstName) => setDraft((current) => ({ ...current, patientFirstName }))} />
          <Field label="Middle name" optional disabled={!editable} value={draft.patientMiddleName} onChange={(patientMiddleName) => setDraft((current) => ({ ...current, patientMiddleName }))} />
          <Field label="Patient last name" required disabled={!editable} value={draft.patientLastName} onChange={(patientLastName) => setDraft((current) => ({ ...current, patientLastName }))} />
          <Field label="Date of birth" type="date" required disabled={!editable} value={draft.patientDob} onChange={(patientDob) => setDraft((current) => ({ ...current, patientDob }))} />
          <Field label="Claim number" required disabled={!editable} value={draft.claimNumber} onChange={(claimNumber) => setDraft((current) => ({ ...current, claimNumber }))} {...((data.injury.claimPatternStatus?.detail || data.injury.claimPatternStatus?.label) ? { hint: data.injury.claimPatternStatus?.detail || data.injury.claimPatternStatus?.label || "" } : {})} />
          <Field label="Employer" disabled={!editable} value={draft.employer} onChange={(employer) => setDraft((current) => ({ ...current, employer }))} />
          <Field label="Date of injury" type="date" required disabled={!editable} value={draft.doi} onChange={(doi) => setDraft((current) => ({ ...current, doi }))} />
          {draft.cumulativeTrauma ? <Field label="Cumulative trauma end date" type="date" required disabled={!editable} value={draft.injuryEndDate} onChange={(injuryEndDate) => setDraft((current) => ({ ...current, injuryEndDate }))} /> : null}
          {features?.wcabNumber === false ? null : <Field label="WCAB / ADJ number" optional disabled={!editable} value={draft.adjNumber} onChange={(adjNumber) => setDraft((current) => ({ ...current, adjNumber }))} hint={adjFormatValid ? "Use the EAMS case number shown as ADJ followed by digits." : "Expected format: ADJ followed by at least 7 digits."} />}
        </div>
        {features?.wcabNumber === false ? null : <p className="mb-native-eams">EAMS lookup requires California DWC verification. <a href="https://eams.dwc.ca.gov/WebEnhancement/" target="_blank" rel="noreferrer">Verify in EAMS</a>.</p>}
      </section>

      <section className={sectionClass}>
        <div className="mb-native-section-head"><div><h3>Service</h3><p>The service date and optional payer authorization printed on this bill.</p></div></div>
        <div className={`mb-native-grid ${features?.serviceDateRange || features?.authorizationNumber !== false ? "three" : "one"}`}>
          <Field label="Date of service" type="date" required disabled={!editable} value={draft.dos} onChange={(dos) => setDraft((current) => ({ ...current, dos }))} />
          {features?.serviceDateRange ? <Field label="Service end date" type="date" optional disabled={!editable} value={draft.dosEnd} onChange={(dosEnd) => setDraft((current) => ({ ...current, dosEnd }))} /> : null}
          {features?.authorizationNumber === false ? null : <Field label="Authorization number" optional disabled={!editable} value={draft.authorizationNumber} onChange={(authorizationNumber) => setDraft((current) => ({ ...current, authorizationNumber }))} />}
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mb-native-section-head"><div><h3>Billing practice</h3><p>Payee identity and billing address for this claim.</p></div><span>Prefilled</span></div>
        <div className="mb-native-grid three">
          <Field label="Practice name" required value={draft.billingProvider.name} onChange={(value) => updateBillingProvider("name", value)} />
          <Field label="Tax ID" required value={draft.billingProvider.taxId} onChange={(value) => updateBillingProvider("taxId", value)} />
          <Field label="Billing NPI" required value={draft.billingProvider.npi} onChange={(value) => updateBillingProvider("npi", value)} />
          <Field label="Phone" optional value={draft.billingProvider.phone || ""} onChange={(value) => updateBillingProvider("phone", value)} />
          <Field label="Billing street" required value={draft.billingProvider.billingStreet || ""} onChange={(value) => updateBillingProvider("billingStreet", value)} />
          <Field label="City" required value={draft.billingProvider.billingCity || ""} onChange={(value) => updateBillingProvider("billingCity", value)} />
          <StateCombobox label="State" required disabled={!editable} value={draft.billingProvider.billingState || ""} onChange={(value) => updateBillingProvider("billingState", value)} />
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
          <StateCombobox label="License state (optional)" disabled={!editable} value={draft.clinician.licenseState || ""} onChange={(value) => updateClinician("licenseState", value)} />
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mb-native-section-head"><div><h3>Service location</h3><p>The exact place of service for this bill.</p></div><span>Prefilled</span></div>
        <div className="mb-native-grid three">
          <Field label="Location name" required value={draft.location.name} onChange={(value) => updateLocation("name", value)} />
          <Field label="Street" required value={draft.location.street} onChange={(value) => updateLocation("street", value)} />
          <Field label="City" required value={draft.location.city} onChange={(value) => updateLocation("city", value)} />
          <StateCombobox label="State" required disabled={!editable} value={draft.location.state} onChange={(value) => updateLocation("state", value)} />
          <Field label="ZIP" required value={draft.location.zip} onChange={(value) => updateLocation("zip", value)} />
          <Field label="Place of service code" required value={draft.location.posCode || "11"} onChange={(value) => updateLocation("posCode", value)} />
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mb-native-section-head"><div><h3>Procedure lines</h3><p>Choose a billing profile, then review the codes and modifiers. A new row appears as you type; allowed amounts recalculate on save.</p></div></div>
        {features?.codingPresets === false ? null : <div className="mb-native-presets" role="group" aria-label="Evaluation billing profile">
          {([['qme','QME'],['ame','AME'],['psych_qme','Psych QME']] as const).map(([value,label]) => <button type="button" key={value} className={inferPreset(draft.lineItems) === value ? "active" : ""} disabled={!editable} onClick={() => setDraft((current) => ({ ...current, lineItems: ensureTrailingProcedureLine(applyPreset(current.lineItems, value)) }))}>{label}</button>)}
          <span>Sets evaluator modifiers across med-legal lines. You can still edit each line.</span>
        </div>}
        <div className="mb-native-lines">
          {draft.lineItems.map((line, index) => (
            <div className="mb-native-line" key={line.id || index}>
              <label className="mb-native-field"><span>Procedure</span><select disabled={!editable} value={line.code} onChange={(event) => {
                const code = event.target.value;
                setDraft((current) => {
                  const lineItems = current.lineItems.map((item, itemIndex) => {
                    if (itemIndex !== index) return item;
                    const presetLine = applyPreset(
                      [{ ...item, code }],
                      inferPreset(current.lineItems),
                    )[0];
                    return { ...item, code, modifiers: presetLine?.modifiers || [] };
                  });
                  return { ...current, lineItems: ensureTrailingProcedureLine(lineItems) };
                });
              }}>{line.code && !PROCEDURES.some(([code]) => code === line.code) ? <option value={line.code}>{line.code}</option> : null}<option value="">Select code…</option>{PROCEDURES.map(([code,label]) => <option value={code} key={code}>{code} — {label}</option>)}</select>{line.code ? <small>{PROCEDURES.find(([code]) => code === line.code)?.[1]}</small> : null}</label>
              <div className="mb-native-modifiers"><label className="mb-native-field"><span>Modifiers</span><select disabled={!editable} value="" onChange={(event) => {
                const modifier = event.target.value;
                if (!modifier) return;
                setDraft((current) => ({ ...current, lineItems: ensureTrailingProcedureLine(current.lineItems.map((item, itemIndex) => itemIndex === index ? { ...item, modifiers: [...new Set([...item.modifiers, modifier])] } : item)) }));
              }}><option value="">Add modifier…</option>{MODIFIERS.filter(([value]) => !line.modifiers.includes(value) && modifierAppliesToCode(value, line.code)).map(([value,label]) => <option value={value} key={value}>-{value} — {label}</option>)}</select></label><div className="mb-native-chips">{line.modifiers.map((modifier) => <button type="button" disabled={!editable} key={modifier} onClick={() => setDraft((current) => ({ ...current, lineItems: ensureTrailingProcedureLine(current.lineItems.map((item, itemIndex) => itemIndex === index ? { ...item, modifiers: item.modifiers.filter((value) => value !== modifier) } : item)) }))}>-{modifier} ×</button>)}</div></div>
              <label className="mb-native-field"><span>Units</span><input type="number" min="1" required disabled={!editable} value={line.units} onChange={(event) => setDraft((current) => ({ ...current, lineItems: ensureTrailingProcedureLine(current.lineItems.map((item, itemIndex) => itemIndex === index ? { ...item, units: Number(event.target.value) } : item)) }))} /></label>
              <div className="mb-native-allowed"><span>Allowed</span><strong>{money(line.charge)}</strong></div>
              <button type="button" className="mb-native-remove" aria-label={`Remove ${line.code || "procedure"}`} disabled={!editable} onClick={() => setDraft((current) => ({ ...current, lineItems: ensureTrailingProcedureLine(current.lineItems.filter((_, itemIndex) => itemIndex !== index)) }))}>×</button>
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
        <div><span className="mb-native-eyebrow">Delivery</span><h3>Submit this bill</h3><p>After submission, status, payments, denials, and resubmissions stay available here.</p></div>
        <fieldset><legend>Send via</legend>{(["ebill", "fax", "mail", "email"] as const).map((value) => <label key={value}><input type="radio" name={routeName} value={value} checked={route === value} onChange={() => setRoute(value)} />{value === "ebill" ? "E-bill" : value.charAt(0).toUpperCase() + value.slice(1)}</label>)}</fieldset>
        {error ? <div className="mb-native-message error" role="alert">{error}</div> : null}
        {notice ? <div className="mb-native-message success" role="status">{notice}</div> : null}
        {!canSubmit ? <div className="mb-native-blockers" role="status"><strong>Before you can submit:</strong><span>{blockers.join(" · ")}</span></div> : null}
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

export function BillStatusSummary({ status, submittedAt, agingDays, updatedAt, totalCharge, totalPaid, balanceDue, actions = [], className, style, appearance }: BillStatusSummaryProps): ReactElement {
  return <section className={["mb-native-status", className].filter(Boolean).join(" ")} style={mindBillAppearanceStyle(appearance, style)}>
    <style>{NATIVE_BILL_REVIEW_STYLES}</style>
    <style>{NATIVE_THEME_OVERRIDE_STYLES}</style>
    <div className="mb-native-status-copy"><span className="mb-native-eyebrow">Bill status</span><h3>{status.replaceAll("_", " ")}</h3><p>{submittedAt ? `Submitted ${new Date(submittedAt).toLocaleDateString()}` : "Not submitted"}{agingDays == null ? "" : ` · ${agingDays} day${agingDays === 1 ? "" : "s"} old`}{updatedAt ? ` · Updated ${new Date(updatedAt).toLocaleDateString()}` : ""}</p></div>
    <dl><div><dt>Charged</dt><dd>{money(totalCharge)}</dd></div><div><dt>Paid</dt><dd>{money(totalPaid)}</dd></div><div><dt>Balance</dt><dd>{money(balanceDue)}</dd></div></dl>
    {actions.length ? <div className="mb-native-status-actions">{actions.map((action) => <button key={action.id} type="button" className={`mb-native-button ${action.primary ? "primary" : "secondary"}`} disabled={action.disabled} onClick={action.onClick}>{action.label}</button>)}</div> : null}
  </section>;
}

const NATIVE_BILL_REVIEW_STYLES = `
.mb-native-review,.mb-native-status{font-family:var(--mb-font,Inter,ui-sans-serif,system-ui,sans-serif)}
.mb-native-review,.mb-native-status{--mb-accent:#238dbd;--mb-accent-dark:#176f98;--mb-text:#203743;--mb-muted:#657982;--mb-border:#dbe6ea;--mb-soft:#f3f8fa;--mb-surface:#fff;color:var(--mb-text);font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}.mb-native-review *,.mb-native-status *{box-sizing:border-box}.mb-native-review{display:grid;gap:16px}.mb-native-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:6px 2px}.mb-native-heading h2,.mb-native-section h3,.mb-native-submit h3,.mb-native-status h3{margin:3px 0 2px;line-height:1.2}.mb-native-heading h2{font-size:25px}.mb-native-heading p,.mb-native-section p,.mb-native-submit p,.mb-native-status p{margin:0;color:var(--mb-muted)}.mb-native-eyebrow{color:#59727d;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.mb-native-total{display:flex;align-items:center;gap:18px}.mb-native-total span,.mb-native-section-head>span{border-radius:999px;background:var(--mb-soft);color:#58717c;font-size:11px;font-weight:800;padding:6px 10px;text-transform:capitalize}.mb-native-total strong{font-size:24px}.mb-native-summary{display:grid;grid-template-columns:repeat(4,1fr);margin:0;border:1px solid var(--mb-border);border-radius:12px;background:var(--mb-surface);overflow:hidden}.mb-native-summary div{padding:17px 20px;border-right:1px solid var(--mb-border)}.mb-native-summary div:last-child{border:0}.mb-native-summary dt,.mb-native-allowed span{color:#647982;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.mb-native-summary dd{margin:5px 0 0;font-weight:750}.mb-native-section{padding:20px;border:1px solid var(--mb-border);border-radius:14px;background:var(--mb-surface);box-shadow:0 8px 24px rgba(28,58,72,.04)}.mb-native-section-head{display:flex;align-items:start;justify-content:space-between;gap:16px;margin-bottom:17px}.mb-native-section h3,.mb-native-submit h3,.mb-native-status h3{font-size:19px}.mb-native-grid{display:grid;gap:14px}.mb-native-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.mb-native-field{display:grid;gap:6px;min-width:0;color:var(--mb-text);font-size:12px;font-weight:750}.mb-native-field small{color:var(--mb-muted);font-size:inherit;font-weight:500}.mb-native-field input,.mb-native-attach select,.mb-native-attach input{width:100%;min-height:43px;border:1px solid var(--mb-border);border-radius:8px;background:#fff;color:var(--mb-text);font:inherit;padding:10px 12px}.mb-native-field input:focus,.mb-native-attach select:focus,.mb-native-attach input:focus{border-color:var(--mb-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--mb-accent) 14%,transparent);outline:0}.mb-native-lines{display:grid;gap:10px}.mb-native-line{display:grid;grid-template-columns:1.1fr 1.1fr 110px 120px 28px;align-items:end;gap:12px;padding:13px;background:var(--mb-soft);border:1px solid #e3edf0;border-radius:10px}.mb-native-allowed{display:grid;gap:5px;padding:0 8px 11px;text-align:right}.mb-native-allowed strong{font-size:16px}.mb-native-remove{border:0;background:transparent;color:#667d86;cursor:pointer;font-size:20px;padding:7px}.mb-native-note{padding:13px 15px;border:1px solid #bdd9e4;border-radius:9px;background:#f2f9fc;color:#526d78}.mb-native-note strong{color:var(--mb-text);margin-right:12px}.mb-native-documents{list-style:none;margin:14px 0;padding:0}.mb-native-documents li{display:grid;grid-template-columns:42px 1fr auto 28px;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid var(--mb-border)}.mb-native-documents li>div{display:grid}.mb-native-documents li span{color:var(--mb-muted);font-size:12px}.mb-native-file{display:grid;place-items:center;width:40px;height:40px;border-radius:8px;background:#eaf5f9;color:var(--mb-accent)!important;font-size:11px!important;font-weight:850}.mb-native-attach{display:grid;grid-template-columns:1fr 230px minmax(220px,1fr) auto;align-items:end;gap:12px;padding:15px;border-radius:10px;background:var(--mb-soft)}.mb-native-attach>div{display:grid;gap:3px}.mb-native-attach span{color:var(--mb-muted);font-size:12px}.mb-native-button{min-height:40px;border:1px solid var(--mb-border);border-radius:8px;background:#fff;color:var(--mb-text);cursor:pointer;font:inherit;font-weight:750;padding:9px 14px}.mb-native-button.primary{border-color:var(--mb-accent);background:var(--mb-accent);color:#fff}.mb-native-button.primary:hover{background:var(--mb-accent-dark)}.mb-native-button.secondary{background:#fff}.mb-native-button.quiet{min-height:auto;background:var(--mb-soft);padding:7px 11px}.mb-native-button:disabled,.mb-native-remove:disabled{cursor:not-allowed;opacity:.5}.mb-native-submit{display:grid;grid-template-columns:1fr auto;align-items:end;gap:18px;padding:22px;border:1px solid #bcd8e2;border-radius:14px;background:linear-gradient(135deg,#f3fafc,#eaf6fa)}.mb-native-submit fieldset{display:flex;gap:6px;margin:0;padding:0;border:0}.mb-native-submit legend{position:absolute;width:1px;height:1px;overflow:hidden}.mb-native-submit fieldset label{display:flex;align-items:center;gap:6px;padding:9px 11px;border:1px solid #c9dce3;border-radius:8px;background:#fff;font-weight:700}.mb-native-actions{display:flex;justify-content:flex-end;gap:10px;grid-column:1/-1}.mb-native-message{grid-column:1/-1;padding:10px 12px;border-radius:8px}.mb-native-message.error{background:#fff0ef;color:#9d3029}.mb-native-message.success{background:#edf9f2;color:#217449}.mb-native-status{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px;border:1px solid var(--mb-border);border-radius:12px;background:#fff}.mb-native-status h3{text-transform:capitalize}.mb-native-status dl{display:flex;margin:0}.mb-native-status dl div{min-width:110px;padding:0 18px;border-left:1px solid var(--mb-border)}.mb-native-status dt{color:var(--mb-muted);font-size:11px}.mb-native-status dd{margin:4px 0 0;font-size:17px;font-weight:800}@media(max-width:900px){.mb-native-grid.three{grid-template-columns:repeat(2,minmax(0,1fr))}.mb-native-summary{grid-template-columns:repeat(2,1fr)}.mb-native-summary div:nth-child(2){border-right:0}.mb-native-summary div:nth-child(-n+2){border-bottom:1px solid var(--mb-border)}.mb-native-line{grid-template-columns:1fr 1fr 90px}.mb-native-allowed{align-self:center}.mb-native-attach{grid-template-columns:1fr 1fr}.mb-native-submit{grid-template-columns:1fr}.mb-native-submit fieldset,.mb-native-actions{grid-column:1}.mb-native-actions{justify-content:start}}@media(max-width:620px){.mb-native-heading,.mb-native-total,.mb-native-status{align-items:start;flex-direction:column}.mb-native-grid.three,.mb-native-summary,.mb-native-line,.mb-native-attach{grid-template-columns:1fr}.mb-native-summary div,.mb-native-summary div:nth-child(2){border-right:0;border-bottom:1px solid var(--mb-border)}.mb-native-line{align-items:stretch}.mb-native-allowed{text-align:left}.mb-native-submit fieldset{display:grid;grid-template-columns:1fr 1fr}.mb-native-status dl{width:100%}.mb-native-status dl div{min-width:0;flex:1;padding:0 10px}.mb-native-status dl div:first-child{padding-left:0;border-left:0}}
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
