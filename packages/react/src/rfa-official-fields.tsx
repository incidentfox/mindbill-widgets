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

export function RfaPicker({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return <div className="mbrfa-picker"><span>{label}</span>{children}</div>;
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

const contactRows = [
  ["address", "Address", 500, 3], ["city", "City", 100, 2], ["state", "State", 2, 1],
  ["zip", "Zip Code", 20, 2], ["phone", "Phone", 30, 2], ["fax", "Fax Number", 30, 2],
] as const;
/** Contact fields in DWC Form RFA order; `before` and `beforeEmail` hold the section's saved values. */
export function RfaOfficialContactFields({ nameLabel, value, onChange, before, beforeEmail, faxHint }: {
  nameLabel: "Practice Name" | "Company Name"; value: RfaContact | null | undefined; onChange: (value: RfaContact) => void;
  before?: ReactNode; beforeEmail?: ReactNode; /** Shown under an empty Fax Number. */ faxHint?: string;
}): ReactElement {
  const field = (key: keyof RfaContact, label: string, max: number, span: number) => <label key={key} className={`mbrfa-s${span}`}>{label}<input type={key === "email" ? "email" : key === "phone" || key === "fax" ? "tel" : "text"} maxLength={max} value={value?.[key] ?? ""} onChange={event => onChange({ ...value, [key]: event.target.value })} />{key === "fax" && faxHint && !value?.fax?.trim() ? <small className="mbrfa-field-hint">{faxHint}</small> : null}</label>;
  return <div className="mbrfa-form-grid">
    {before}{field("name", nameLabel, 200, 3)}{field("contactName", "Contact Name", 200, 3)}
    {contactRows.map(([key, label, max, span]) => field(key, label, max, span))}
    {beforeEmail}{field("email", "E-mail Address", 254, 6)}
  </div>;
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
