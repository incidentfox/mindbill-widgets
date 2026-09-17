"use client";

import { useEffect, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import type {
  BillClaimsAdministratorContact,
  BillClaimsAdministratorMailingAddress,
  BillClaimsAdministratorPattern,
  BillLifecycleDelivery,
  BillReviewAttachment,
  BillReviewClinician,
  BillReviewLineItem,
  HistoricalBillReviewData,
} from "@mindbill/browser";
import { BillDetailLayout, BillDetailSection, type BillDetailValidationIssue } from "./bill-detail-layout";
import type { MindBillReactAppearance } from "./appearance";
import { mindBillAppearanceStyle } from "./appearance";

export type BillDetailSectionKey = "patient" | "claim" | "providers" | "services" | "attachments";

export type BillDetailNavigationProps = {
  /** Suppress navigation for historical entities without canonical IDs. */
  requireLinkedEntityIds?: { patient?: boolean; renderingProvider?: boolean; claimsAdministrator?: boolean };
  onPatientClick?: (patient: HistoricalBillReviewData["patient"]) => void;
  onRenderingProviderClick?: (provider: BillReviewClinician) => void;
  onClaimsAdministratorClick?: (administrator: { id?: string; name: string }) => void;
};

export type BillReadOnlyFormProps = BillDetailNavigationProps & {
  validationIssues?: Partial<Record<BillDetailSectionKey, readonly BillDetailValidationIssue[]>>;
  data: HistoricalBillReviewData & { delivery?: BillLifecycleDelivery };
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
  onOpenAttachment?: (attachment: BillReviewAttachment) => void | Promise<void>;
};

function money(value: number | null): string {
  if (value == null) return "Not recorded";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

function date(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed);
}

function Value({ label, children, wide = false }: { label: string; children?: ReactNode; wide?: boolean }): ReactElement {
  return <div className={wide ? "mb-read-value is-wide" : "mb-read-value"}><dt>{label}</dt><dd>{children === null || children === undefined || children === "" ? "—" : children}</dd></div>;
}

function LineChargeDetails({ line }: { line: BillReviewLineItem }): ReactElement {
  const breakdown = line.pricing?.breakdown;
  return <div className="mb-read-charge-detail">
    <strong>{line.code} · Charge breakdown</strong>
    {breakdown ? <div className="mb-read-fee-calculation">
      <p>{breakdown.method}</p>
      {breakdown.inputs.length ? <dl aria-label="Fee calculation inputs">{breakdown.inputs.map((input, index) => <Value key={index} label={input.label}>{input.value}</Value>)}</dl> : null}
      {breakdown.steps.length ? <dl className="mb-read-fee-steps" aria-label="Fee calculation steps">{breakdown.steps.map((step, index) => <Value key={index} label={step.label}>{step.value}</Value>)}</dl> : null}
      {breakdown.notes.map((note, index) => <p key={index}>{note}</p>)}
    </div> : <dl>
      <Value label="Units">{line.units}</Value>
      {line.units > 0 && Number.isFinite(line.charge / line.units) ? <Value label="Average charge per unit">{new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(line.charge / line.units)}</Value> : null}
    </dl>}
    <dl><Value label="Total charge">{money(line.charge)}</Value>{line.feeSchedule != null ? <Value label="Recorded fee schedule">{money(line.feeSchedule)}</Value> : null}</dl>
    {!breakdown ? <p>Average calculated from the saved charge and units; this is not a base rate or modifier calculation. {line.feeSchedule == null ? "No fee schedule amount was recorded." : "Fee schedule shown as recorded for this line."}</p> : null}
  </div>;
}

type PayerTab = "main" | "bill-review" | "authorization" | "mailing" | "patterns";

const PAYER_TABS: ReadonlyArray<readonly [PayerTab, string]> = [
  ["main", "Main"],
  ["bill-review", "Bill Review"],
  ["authorization", "Authorization Info"],
  ["mailing", "Mailing Address"],
  ["patterns", "Claim Number Pattern"],
];

function DirectoryEmpty({ children }: { children: ReactNode }): ReactElement {
  return <p className="mb-read-directory-empty">{children}</p>;
}

function ContactTable({ contacts, empty }: { contacts: readonly BillClaimsAdministratorContact[]; empty: string }): ReactElement {
  if (!contacts.length) return <DirectoryEmpty>{empty}</DirectoryEmpty>;
  return <div className="mb-read-directory-table-wrap"><table className="mb-read-directory-table"><thead><tr><th>Name</th><th>Telephone</th><th>Portal / email</th><th>Fax</th><th>Address</th></tr></thead><tbody>{contacts.map((contact, index) => <tr key={`${contact.name || "contact"}-${index}`}><td>{contact.name || "—"}{contact.note ? <small>{contact.note}</small> : null}</td><td>{contact.phone || "—"}</td><td>{contact.portalUrl ? <a href={contact.portalUrl} target="_blank" rel="noopener noreferrer">Open portal</a> : contact.email || "—"}</td><td>{contact.fax || "—"}</td><td>{contact.address || "—"}</td></tr>)}</tbody></table></div>;
}

function MailingTable({ addresses }: { addresses: readonly BillClaimsAdministratorMailingAddress[] }): ReactElement {
  if (!addresses.length) return <DirectoryEmpty>No mailing addresses are available for this directory entry.</DirectoryEmpty>;
  return <div className="mb-read-directory-table-wrap"><table className="mb-read-directory-table"><thead><tr><th>Company</th><th>Address</th><th>Notes</th><th>Submission types</th></tr></thead><tbody>{addresses.map((entry, index) => <tr key={`${entry.address}-${index}`}><td>{entry.company || "—"}</td><td>{entry.address}</td><td>{entry.notes || "—"}</td><td>{entry.submissionTypes?.join(", ") || "—"}</td></tr>)}</tbody></table></div>;
}

function PatternTable({ patterns }: { patterns: readonly BillClaimsAdministratorPattern[] }): ReactElement {
  if (!patterns.length) return <DirectoryEmpty>No claim-number pattern is available for this directory entry.</DirectoryEmpty>;
  return <div className="mb-read-directory-table-wrap"><table className="mb-read-directory-table"><thead><tr><th>Status</th><th>Length</th><th>Pattern</th><th>Example</th></tr></thead><tbody>{patterns.map((entry, index) => <tr key={`${entry.pattern}-${index}`}><td>{entry.matches === true ? <span className="mb-read-match is-match">✓ Matches this claim</span> : entry.matches === false ? <span className="mb-read-match is-warning">Review format</span> : "Advisory"}</td><td>{entry.length ?? "—"}</td><td>{entry.pattern}</td><td>{entry.example || "—"}</td></tr>)}</tbody></table></div>;
}

export function BillReadOnlyForm({ data, appearance, className, style, onOpenAttachment, validationIssues, requireLinkedEntityIds, onPatientClick, onRenderingProviderClick, onClaimsAdministratorClick }: BillReadOnlyFormProps): ReactElement {
  const [payerOpen, setPayerOpen] = useState(false);
  const [payerTab, setPayerTab] = useState<PayerTab>("main");
  const { bill, patient, injury } = data;
  const diagnoses = injury.diagnoses?.length
    ? injury.diagnoses
    : (injury.diagnosisCodes ?? []).map((code) => ({ code, description: "" }));
  const provider = bill.billingSnapshot?.billingProvider;
  const clinician = bill.billingSnapshot?.renderingProvider;
  const location = bill.billingSnapshot?.placeOfService;
  const address = patient.address;
  const patientAddress = [address?.line1, address?.city, address?.state, address?.postalCode].filter(Boolean).join(", ");
  const billingAddress = provider ? [provider.billingStreet, provider.billingCity, provider.billingState, provider.billingZip].filter(Boolean).join(", ") : "";
  const locationAddress = location ? [location.street, location.city, location.state, location.zip].filter(Boolean).join(", ") : "";
  const payerId = injury.claimsAdminId || data.delivery?.directory?.id;
  const payerName = data.delivery?.payerName || injury.claimsAdminName || "—";
  const contacts = data.delivery?.contacts;
  const directory = data.delivery?.directory;
  const fallbackContacts: readonly BillClaimsAdministratorContact[] = contacts && Object.values(contacts).some(Boolean) ? [{
    name: contacts.adjusterName || "Claims contact",
    ...(contacts.adjusterPhone ? { phone: contacts.adjusterPhone } : {}),
    ...(contacts.adjusterEmail || contacts.claimsEmail ? { email: contacts.adjusterEmail || contacts.claimsEmail } : {}),
    ...(contacts.faxNumber ? { fax: contacts.faxNumber } : {}),
    ...(contacts.portalUrl ? { portalUrl: contacts.portalUrl } : {}),
    ...(contacts.mailingAddress ? { address: contacts.mailingAddress } : {}),
  }] : [];
  const billReview = directory?.billReview?.length ? directory.billReview : fallbackContacts;
  const mailingAddresses: readonly BillClaimsAdministratorMailingAddress[] = directory?.mailingAddresses?.length
    ? directory.mailingAddresses
    : contacts?.mailingAddress ? [{ company: payerName, address: contacts.mailingAddress }] : [];
  useEffect(() => {
    if (!payerOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setPayerOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [payerOpen]);

  return <section className={["mb-readonly-bill", className].filter(Boolean).join(" ")} style={mindBillAppearanceStyle(appearance, style)} aria-label="Bill details">
    <style>{READ_ONLY_STYLES}</style>
    <BillDetailLayout header={<h2 style={{ margin: 0 }}>Bill details</h2>} actions={<strong>{money(bill.totalCharge)}</strong>}>

    <BillDetailSection title="Bill information" validationIssues={validationIssues?.providers ?? []}><dl className="mb-read-grid">
      <Value label="Date of service">{bill.dosEnd ? `${date(bill.dos)} – ${date(bill.dosEnd)}` : date(bill.dos)}</Value>
      <Value label="Place of service">{location?.name || locationAddress}</Value>
      <Value label="Billing provider">{provider?.name}</Value>
      <Value label="Rendering provider">{clinician && onRenderingProviderClick && (!requireLinkedEntityIds?.renderingProvider || clinician.id) ? <button type="button" className="mb-read-payer" onClick={() => onRenderingProviderClick(clinician)}>{clinician.name}</button> : clinician?.name}</Value>
    </dl><details className="mb-read-provider-details"><summary>Provider identifiers and addresses</summary><dl className="mb-read-grid">
      <Value label="Billing NPI">{provider?.npi}</Value>
      <Value label="Billing tax ID">{provider?.taxId}</Value>
      <Value label="Billing phone">{provider?.phone}</Value>
      <Value label="Billing address" wide>{billingAddress}</Value>
      <Value label="Rendering NPI">{clinician?.npi}</Value>
      <Value label="Rendering taxonomy">{clinician?.taxonomy}</Value>
      <Value label="Place of service code">{location?.posCode}</Value>
      <Value label="Service address" wide>{locationAddress}</Value>
    </dl></details></BillDetailSection>

    <div className="mb-read-summary">
    <BillDetailSection title="Patient information" validationIssues={validationIssues?.patient ?? []}><dl className="mb-read-grid">
      <Value label="Name">{onPatientClick && (!requireLinkedEntityIds?.patient || patient.id) ? <button type="button" className="mb-read-payer" onClick={() => onPatientClick(patient)}>{patient.name || [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(" ") || "Patient"}</button> : patient.name || [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(" ")}</Value>
      <Value label="Date of birth">{date(patient.dob)}</Value>
      <Value label="Phone">{patient.phone}</Value>
      <Value label="Address" wide>{patientAddress}</Value>
    </dl></BillDetailSection>

    <BillDetailSection title="Injury information" validationIssues={validationIssues?.claim ?? []}><dl className="mb-read-grid">
      <Value label="Claim number">{injury.claimNumber}</Value>
      <Value label="WCAB / ADJ number">{injury.adjNumber}</Value>
      <Value label="Claims administrator">{onClaimsAdministratorClick && (!requireLinkedEntityIds?.claimsAdministrator || payerId) ? <><button type="button" className="mb-read-payer" onClick={() => onClaimsAdministratorClick({ ...(payerId ? { id: payerId } : {}), name: payerName })}>{payerName}</button>{" · "}</> : null}<button type="button" className="mb-read-payer" onClick={() => { setPayerTab("main"); setPayerOpen(true); }}>{onClaimsAdministratorClick && (!requireLinkedEntityIds?.claimsAdministrator || payerId) ? "Contact details" : payerName}</button></Value>
      <Value label="Employer">{injury.employer}</Value>
      <Value label="Date of injury">{date(injury.doi)}</Value>
      <Value label="Injury description" wide>{injury.injuryDescription}</Value>
    </dl>{diagnoses.length ? <div className="mb-read-diagnoses" aria-label="Diagnoses">{diagnoses.map((diagnosis) => <div key={diagnosis.code}><strong>{diagnosis.code}</strong>{diagnosis.description ? <span>{diagnosis.description}</span> : null}</div>)}</div> : null}</BillDetailSection>

    </div>

    <BillDetailSection title="Service lines" validationIssues={validationIssues?.services ?? []}><div className="mb-read-lines" role="table" aria-label="Service lines">
      <div className="mb-read-line-header" role="row"><span>Procedure</span><span>Modifiers</span><span>Units</span><span>Charge</span></div>
      {bill.lineItems.map((line, index) => <div className="mb-read-line" role="row" key={line.id ?? `${line.code}-${index}`}>
        <strong>{line.code}</strong><div className="mb-read-chips">{line.modifiers.length ? line.modifiers.map((modifier) => <span key={modifier}>{modifier}</span>) : "—"}</div><span>{line.units}</span><details className="mb-read-charge"><summary aria-label={`Charge breakdown for ${line.code}, line ${index + 1}`}>{money(line.charge)}</summary><LineChargeDetails line={line} /></details>
      </div>)}
      <div className="mb-read-total"><span>Paid {money(bill.totalPaid)}</span><strong>Balance {money(bill.balanceDue)}</strong></div>
    </div></BillDetailSection>

    <BillDetailSection title="Attachments" validationIssues={validationIssues?.attachments ?? []}>{bill.attachments.length ? <ul className="mb-read-documents">{bill.attachments.map((attachment) => <li key={attachment.id}><div><strong>{attachment.filename}</strong><span>{attachment.description || attachment.documentType.replace(/_/g, " ")}</span></div>{onOpenAttachment ? <button type="button" onClick={() => void onOpenAttachment(attachment)}>Preview</button> : null}</li>)}</ul> : <p className="mb-read-empty">No attachments.</p>}</BillDetailSection>
    </BillDetailLayout>
    {payerOpen ? <div className="mb-read-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPayerOpen(false); }}><section className="mb-read-dialog" role="dialog" aria-modal="true" aria-labelledby="mb-read-payer-title"><header><div><h3 id="mb-read-payer-title">{payerName}</h3><span>Claims administrator</span></div><button type="button" aria-label="Close claims administrator details" onClick={() => setPayerOpen(false)}>×</button></header>
      <label className="mb-read-dialog-mobile-nav"><span>Information section</span><select aria-label="Claims administrator information section" value={payerTab} onChange={(event) => setPayerTab(event.target.value as PayerTab)}>{PAYER_TABS.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
      <div className="mb-read-dialog-tabs" role="tablist" aria-label="Claims administrator information">
        {PAYER_TABS.map(([id, label]) => <button type="button" role="tab" aria-selected={payerTab === id} key={id} onClick={() => setPayerTab(id)}>{label}</button>)}
      </div>
      <div className="mb-read-dialog-panel" role="tabpanel">
        {payerTab === "main" ? <dl className="mb-read-directory-main"><Value label="Name">{payerName}</Value><Value label="Type">{directory?.type}</Value><Value label="Description" wide>{directory?.description}</Value><Value label="Website">{directory?.website ? <a href={directory.website} target="_blank" rel="noopener noreferrer">{directory.website}</a> : "—"}</Value><Value label="Hours of operation">{directory?.hours}</Value><Value label="Also known as" wide>{directory?.aliases?.join(", ")}</Value><Value label="Affiliated entities" wide>{directory?.affiliatedEntities?.join(", ")}</Value></dl> : null}
        {payerTab === "bill-review" ? <ContactTable contacts={billReview} empty="No bill-review contacts are available for this directory entry." /> : null}
        {payerTab === "authorization" ? <ContactTable contacts={directory?.authorization ?? []} empty="No authorization contacts are available for this directory entry." /> : null}
        {payerTab === "mailing" ? <MailingTable addresses={mailingAddresses} /> : null}
        {payerTab === "patterns" ? <PatternTable patterns={directory?.claimNumberPatterns ?? []} /> : null}
      </div>
    </section></div> : null}
  </section>;
}

const READ_ONLY_STYLES = `
.mb-readonly-bill .mb-detail-section-header{padding:11px 15px;border-bottom:1px solid var(--mb-border);background:var(--mb-soft)}.mb-readonly-bill .mb-detail-section-body{padding:14px 15px}.mb-readonly-bill .mb-detail-section-header h3{font-size:14px}.mb-readonly-bill .mb-detail-layout-header h2{font-size:15px}.mb-read-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start}.mb-read-provider-details{margin-top:12px;border-top:1px solid var(--mb-border);padding-top:8px}.mb-read-provider-details>summary{padding:6px 0;cursor:pointer;color:var(--mb-muted)}.mb-read-provider-details[open]>summary{margin-bottom:8px}.mb-read-charge{text-align:right;min-width:0}.mb-read-charge>summary{cursor:pointer;color:var(--mb-accent);font-weight:700;min-height:36px;display:flex;align-items:center;justify-content:flex-end;text-decoration:underline dotted;text-underline-offset:4px}.mb-read-charge[open]{grid-column:1/-1}.mb-read-charge-detail{text-align:left;padding:14px;background:var(--mb-soft);border:1px solid var(--mb-border);border-radius:var(--mb-control-radius)}.mb-read-charge-detail dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}.mb-read-charge-detail .mb-read-fee-steps{grid-template-columns:1fr;border-top:1px solid var(--mb-border);padding-top:10px}.mb-read-fee-calculation{margin-top:8px}.mb-read-fee-calculation p+p{margin-top:6px}.mb-read-charge-detail p{font-size:12px;color:var(--mb-muted);margin:0}@media(max-width:850px){.mb-read-summary{grid-template-columns:1fr}}

.mb-read-diagnoses{display:grid;gap:8px;margin-top:16px}.mb-read-diagnoses>div{display:grid;grid-template-columns:minmax(64px,max-content) 1fr;gap:12px;align-items:baseline;border:1px solid var(--mb-border);border-radius:9px;background:#f7f9f8;padding:9px 12px}.mb-read-diagnoses span{color:var(--mb-muted)}
.mb-readonly-bill{--mb-accent:#176c70;--mb-border:#d7e0df;--mb-surface:#fff;--mb-muted:#607176;color:var(--mb-text,#17282d);font:inherit;display:grid;gap:16px}.mb-readonly-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.mb-readonly-heading h2,.mb-read-card h3{margin:0}.mb-readonly-heading>strong{font-size:1.35rem}.mb-read-card{background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-radius,14px);padding:20px;box-shadow:0 1px 2px rgba(15,40,45,.04)}.mb-read-card h3{font-size:1.05rem;margin-bottom:16px}.mb-read-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 20px;margin:0}.mb-read-value{min-width:0}.mb-read-value.is-wide{grid-column:1/-1}.mb-read-value dt{color:var(--mb-muted);font-size:12px;font-weight:500;letter-spacing:0}.mb-read-value dd{font-weight:500;margin:3px 0 0;overflow-wrap:anywhere}.mb-read-payer{border:0;border-bottom:1px dotted currentColor;background:transparent;color:inherit;padding:0;font:inherit;font-weight:inherit;text-align:left;cursor:pointer}.mb-read-payer:hover{color:var(--mb-accent)}.mb-read-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:16px}.mb-read-chips span{border:1px solid var(--mb-border);border-radius:999px;padding:3px 9px;font-size:.82rem;background:#f7f9f8}.mb-read-lines{border:1px solid var(--mb-border);border-radius:10px;overflow:hidden}.mb-read-line-header,.mb-read-line{display:grid;grid-template-columns:1.2fr 1.5fr .45fr .7fr;gap:16px;align-items:center;padding:12px 14px}.mb-read-line-header{background:#f6f8f7;color:var(--mb-muted);font-size:.75rem;font-weight:700;text-transform:uppercase}.mb-read-line{border-top:1px solid var(--mb-border)}.mb-read-line .mb-read-chips{margin:0}.mb-read-line>span:last-child,.mb-read-line>strong:last-child{text-align:right}.mb-read-total{display:flex;justify-content:flex-end;gap:24px;border-top:1px solid var(--mb-border);padding:13px 14px}.mb-read-documents{list-style:none;padding:0;margin:0;display:grid}.mb-read-documents li{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 0;border-top:1px solid var(--mb-border)}.mb-read-documents li:first-child{border-top:0;padding-top:0}.mb-read-documents li:last-child{padding-bottom:0}.mb-read-documents div{display:grid;gap:3px;min-width:0}.mb-read-documents strong{overflow-wrap:anywhere}.mb-read-documents span,.mb-read-empty{color:var(--mb-muted)}.mb-read-documents button{border:1px solid var(--mb-border);border-radius:8px;background:transparent;color:inherit;padding:8px 13px;font:inherit;font-weight:650;cursor:pointer}.mb-read-documents button:hover{border-color:var(--mb-accent);color:var(--mb-accent)}.mb-read-dialog-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:rgba(11,28,32,.46);padding:20px}.mb-read-dialog{width:min(1040px,100%);min-height:min(620px,calc(100dvh - 40px));max-height:calc(100dvh - 40px);overflow:auto;border:1px solid var(--mb-border);border-radius:var(--mb-radius,14px);background:var(--mb-surface);padding:22px;box-shadow:0 22px 70px rgba(8,25,29,.24)}.mb-read-dialog header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px}.mb-read-dialog header span{display:block;margin-top:4px;color:var(--mb-muted);font-size:.78rem}.mb-read-dialog h3{margin:0;font-size:1.35rem}.mb-read-dialog header button{display:grid;place-items:center;width:44px;height:44px;border:0;background:transparent;color:inherit;font:inherit;font-size:1.7rem;line-height:1;cursor:pointer}.mb-read-dialog-mobile-nav{display:none}.mb-read-dialog-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-radius:10px;background:var(--mb-soft,#f4f7f6);padding:0 10px}.mb-read-dialog-tabs button{min-height:68px;border:0;border-top:4px solid transparent;background:transparent;color:var(--mb-muted);font:inherit;font-weight:750;cursor:pointer;padding:8px}.mb-read-dialog-tabs button[aria-selected=true]{border-color:var(--mb-accent);background:var(--mb-surface);color:var(--mb-text)}.mb-read-dialog-panel{padding-top:22px}.mb-read-directory-main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 28px;margin:0}.mb-read-directory-main a,.mb-read-directory-table a{color:var(--mb-accent)}.mb-read-directory-table-wrap{border:1px solid var(--mb-border);border-radius:10px;overflow:auto}.mb-read-directory-table{width:100%;border-collapse:collapse;text-align:left}.mb-read-directory-table th,.mb-read-directory-table td{padding:13px 14px;vertical-align:top;border-top:1px solid var(--mb-border)}.mb-read-directory-table th{border-top:0;background:var(--mb-soft,#f4f7f6);color:var(--mb-muted);font-size:.78rem}.mb-read-directory-table td small{display:block;margin-top:4px;color:var(--mb-muted)}.mb-read-directory-empty{margin:0;padding:26px;border:1px dashed var(--mb-border);border-radius:10px;color:var(--mb-muted);text-align:center}.mb-read-match{display:inline-flex;border-radius:999px;padding:3px 8px;font-size:.78rem;font-weight:750}.mb-read-match.is-match{background:#eaf7ef;color:#237448}.mb-read-match.is-warning{background:#fff5df;color:#8a5b00}
@media(max-width:700px){.mb-readonly-heading{align-items:flex-start}.mb-read-grid,.mb-read-directory-main{grid-template-columns:1fr}.mb-read-value.is-wide{grid-column:auto}.mb-read-card{padding:16px}.mb-read-line-header{display:none}.mb-read-line{grid-template-columns:1fr auto;gap:8px}.mb-read-line>*:nth-child(2){grid-column:1/-1}.mb-read-total{justify-content:space-between}.mb-readonly-heading>strong{font-size:1.05rem}.mb-read-dialog-backdrop{place-items:end center;padding:0}.mb-read-dialog{width:100%;min-height:0;max-height:calc(100dvh - 12px);border-radius:18px 18px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom))}.mb-read-dialog header{margin-bottom:14px}.mb-read-dialog-mobile-nav{display:grid;gap:6px;color:var(--mb-muted);font-size:.75rem;font-weight:750;letter-spacing:.05em;text-transform:uppercase}.mb-read-dialog-mobile-nav select{width:100%;min-height:48px;border:1px solid var(--mb-border);border-radius:10px;background:var(--mb-surface);color:var(--mb-text);font:inherit;font-size:1rem;font-weight:700;padding:10px 12px;text-transform:none}.mb-read-dialog-tabs{display:none}.mb-read-dialog-panel{padding-top:16px}.mb-read-directory-table-wrap{border:0;overflow:visible}.mb-read-directory-table,.mb-read-directory-table thead,.mb-read-directory-table tbody,.mb-read-directory-table tr,.mb-read-directory-table th,.mb-read-directory-table td{display:block}.mb-read-directory-table thead{display:none}.mb-read-directory-table tr{border:1px solid var(--mb-border);border-radius:10px;margin-bottom:10px;overflow:hidden}.mb-read-directory-table td{border-top:1px solid var(--mb-border)}.mb-read-directory-table td:first-child{border-top:0}}
`;
