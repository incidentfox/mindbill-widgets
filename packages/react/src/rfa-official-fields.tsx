"use client";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import type { RfaClient, RfaContact } from "@mindbill/browser";

/** Saved values printed on the DWC Form RFA that the request itself does not store. */
export type RfaFormDetails = {
  employee?: { formName?: string | undefined; dateOfBirth?: string | undefined; employer?: string | undefined };
  physician?: { specialty?: string | undefined };
  /** The organization's own fax line for responses; fills a blank Fax Number. */
  returnFax?: string | undefined;
  /** The organization's monitored e-mail address; fills a blank E-mail Address. */
  returnEmail?: string | undefined;
};
/** Host-rendered lookups placed inside the matching official form section. */
export type RfaFormSelectors = { claim?: ReactNode; physician?: ReactNode };

const formDate = (value: string | undefined) => { const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? ""); return match ? `${match[2]}/${match[3]}/${match[1]}` : value ?? ""; };

/** Marks a field the request cannot be sent without. */
export function RfaRequired(): ReactElement { return <span className="mbrfa-req" title="Required"> *</span>; }

export function RfaPicker({ label, children, required }: { label: string; children: ReactNode; required?: boolean }): ReactElement {
  return <div className="mbrfa-picker"><span>{label}{required ? <RfaRequired /> : null}</span>{children}</div>;
}

/** A saved value shown exactly as it prints; it changes only through its lookup. */
export function RfaSavedField({ label, value, span }: { label: string; value: string | undefined; span: 1 | 2 | 3 | 4 | 6 }): ReactElement {
  // Plain text, not a control: a boxed value reads as something to type into.
  return <div className={`mbrfa-s${span} mbrfa-saved`}><span>{label}</span><strong>{value || "—"}</strong></div>;
}

export function RfaEmployeeFields({ name, dateOfInjury, claimNumber, details }: { name: string; dateOfInjury: string | undefined; claimNumber: string | undefined; details: RfaFormDetails["employee"] }): ReactElement {
  return <div className="mbrfa-form-grid">
    <RfaSavedField span={6} label="Name (Last, First, Middle)" value={details?.formName || name} />
    <RfaSavedField span={3} label="Date of Injury (MM/DD/YYYY)" value={formDate(dateOfInjury)} />
    <RfaSavedField span={3} label="Date of Birth (MM/DD/YYYY)" value={formDate(details?.dateOfBirth)} />
    <RfaSavedField span={3} label="Claim Number" value={claimNumber} />
    <RfaSavedField span={3} label="Employer" value={details?.employer} />
  </div>;
}

/** Formats a US number as typed or pasted: (###) ###-####. Anything else (extensions, international) is left as entered. */
export function formatRfaPhone(value: string | undefined): string {
  const raw = value ?? ""; if (/[^\d\s().+-]/.test(raw)) return raw;
  let digits = raw.replace(/\D/g, ""); if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length > 10) return raw;
  if (digits.length < 4) return digits;
  return digits.length < 7 ? `(${digits.slice(0, 3)}) ${digits.slice(3)}` : `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
const contactRows = [
  ["address", "Address", 500, 3], ["city", "City", 100, 2], ["state", "State", 2, 1],
  ["zip", "Zip Code", 20, 2], ["phone", "Phone", 30, 2], ["fax", "Fax Number", 30, 2],
] as const;
/** Contact fields in DWC Form RFA order; `before` and `beforeEmail` hold the section's saved values. */
export function RfaOfficialContactFields({ nameLabel, value, onChange, before, beforeEmail, required = [], editable = true }: {
  nameLabel: "Practice Name" | "Company Name"; value: RfaContact | null | undefined; onChange: (value: RfaContact) => void;
  before?: ReactNode; beforeEmail?: ReactNode; /** Fields the request cannot be sent without. */ required?: Array<keyof RfaContact>;
  /** False shows the values as information; they change through the section's lookups. */ editable?: boolean;
}): ReactElement {
  const dial = (key: keyof RfaContact) => key === "phone" || key === "fax";
  const mark = (key: keyof RfaContact) => required.includes(key) ? <RfaRequired /> : null;
  const field = (key: keyof RfaContact, label: string, max: number, span: 1 | 2 | 3 | 6) => editable
    ? <label key={key} className={`mbrfa-s${span}`}><span>{label}{mark(key)}</span><input type={key === "email" ? "email" : key === "phone" || key === "fax" ? "tel" : "text"} maxLength={max} value={dial(key) ? formatRfaPhone(value?.[key]) : value?.[key] ?? ""} onChange={event => onChange({ ...value, [key]: dial(key) ? formatRfaPhone(event.target.value) : event.target.value })} /></label>
    : <div key={key} className={`mbrfa-s${span} mbrfa-saved`}><span>{label}{mark(key)}</span><strong>{(dial(key) ? formatRfaPhone(value?.[key]) : value?.[key])?.trim() || "—"}</strong></div>;
  return <div className="mbrfa-form-grid mbrfa-contact-grid">
    {before}{field("name", nameLabel, 200, 3)}{field("contactName", "Contact Name", 200, 3)}
    {contactRows.map(([key, label, max, span]) => field(key, label, max, span))}
    {beforeEmail}{field("email", "E-mail Address", 254, 6)}
  </div>;
}
/** Switches a section between saved information and manual entry. */
export function RfaManualToggle({ manual, onChange, disabled }: { manual: boolean; onChange: (manual: boolean) => void; disabled?: boolean }): ReactElement {
  return <div className="mbrfa-section-actions"><button type="button" className={manual ? "mbtd-primary" : undefined} disabled={disabled} aria-pressed={manual} onClick={() => onChange(!manual)}>{manual ? "Save" : "Edit manually"}</button>{manual ? <span>Applies to this request only. The saved record is not changed.</span> : null}</div>;
}

/** Loads the saved employee and physician values for a request that is already drafted. */
export function useRfaFormDetails(client: RfaClient, claimId: string, renderingProviderId: string, enabled: boolean): RfaFormDetails | undefined {
  const [details, setDetails] = useState<RfaFormDetails>();
  useEffect(() => {
    let active = true; setDetails(undefined);
    if (!enabled || !claimId) return;
    // Display only: the request stays editable when these saved values cannot be loaded.
    void client.getCreationContext({ claimId, renderingProviderId, limit: 1 }).then(context => {
      if (!active) return;
      const claim = context.claims.find(value => value.claimId === claimId), provider = context.renderingProviders.find(value => value.id === renderingProviderId);
      setDetails({ ...(context.returnFax ? { returnFax: context.returnFax } : {}), ...(context.returnEmail ? { returnEmail: context.returnEmail } : {}), ...(claim ? { employee: { formName: claim.employeeFormName, dateOfBirth: claim.dateOfBirth, employer: claim.employer } } : {}), ...(provider ? { physician: { specialty: provider.specialty } } : {}) });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [client, claimId, renderingProviderId, enabled]);
  return details;
}
