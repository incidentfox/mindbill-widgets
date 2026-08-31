import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { BillReviewAttachment, BillReviewData } from "@mindbill/browser";
import type { MindBillReactAppearance } from "./appearance";
import { mindBillAppearanceStyle } from "./appearance";

export type BillReadOnlyFormProps = {
  data: BillReviewData;
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
  onOpenAttachment?: (attachment: BillReviewAttachment) => void | Promise<void>;
};

function money(value: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

function date(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed);
}

function Value({ label, children, wide = false }: { label: string; children?: ReactNode; wide?: boolean }): ReactElement {
  return <div className={wide ? "mb-read-value is-wide" : "mb-read-value"}><dt>{label}</dt><dd>{children || "—"}</dd></div>;
}

export function BillReadOnlyForm({ data, appearance, className, style, onOpenAttachment }: BillReadOnlyFormProps): ReactElement {
  const { bill, patient, injury } = data;
  const provider = bill.billingSnapshot?.billingProvider;
  const clinician = bill.billingSnapshot?.renderingProvider;
  const location = bill.billingSnapshot?.placeOfService;
  const address = patient.address;
  const patientAddress = [address?.line1, address?.city, address?.state, address?.postalCode].filter(Boolean).join(", ");
  const locationAddress = location ? [location.street, location.city, location.state, location.zip].filter(Boolean).join(", ") : "";

  return <section className={["mb-readonly-bill", className].filter(Boolean).join(" ")} style={mindBillAppearanceStyle(appearance, style)} aria-label="Bill details">
    <style>{READ_ONLY_STYLES}</style>
    <header className="mb-readonly-heading"><div><h2>Bill details</h2><p>Immutable snapshot submitted to the payer.</p></div><strong>{money(bill.totalCharge)}</strong></header>

    <section className="mb-read-card"><h3>Patient</h3><dl className="mb-read-grid">
      <Value label="Name">{patient.name || [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(" ")}</Value>
      <Value label="Date of birth">{date(patient.dob)}</Value>
      <Value label="Phone">{patient.phone}</Value>
      <Value label="Address" wide>{patientAddress}</Value>
    </dl></section>

    <section className="mb-read-card"><h3>Claim &amp; injury</h3><dl className="mb-read-grid">
      <Value label="Claim number">{injury.claimNumber}</Value>
      <Value label="WCAB / ADJ number">{injury.adjNumber}</Value>
      <Value label="Claims administrator">{injury.claimsAdminName}</Value>
      <Value label="Employer">{injury.employer}</Value>
      <Value label="Date of injury">{date(injury.doi)}</Value>
      <Value label="Date of service">{bill.dosEnd ? `${date(bill.dos)} – ${date(bill.dosEnd)}` : date(bill.dos)}</Value>
      <Value label="Injury description" wide>{injury.injuryDescription}</Value>
    </dl>{injury.diagnosisCodes?.length ? <div className="mb-read-chips" aria-label="Diagnosis codes">{injury.diagnosisCodes.map((code) => <span key={code}>{code}</span>)}</div> : null}</section>

    <section className="mb-read-card"><h3>Providers &amp; location</h3><dl className="mb-read-grid">
      <Value label="Billing provider">{provider?.name}</Value>
      <Value label="Billing NPI">{provider?.npi}</Value>
      <Value label="Rendering provider">{clinician?.name}</Value>
      <Value label="Rendering NPI">{clinician?.npi}</Value>
      <Value label="Specialty">{clinician?.specialty}</Value>
      <Value label="Place of service">{location?.name}</Value>
      <Value label="Service address" wide>{locationAddress}</Value>
    </dl></section>

    <section className="mb-read-card"><h3>Service lines</h3><div className="mb-read-lines" role="table" aria-label="Service lines">
      <div className="mb-read-line-header" role="row"><span>Procedure</span><span>Modifiers</span><span>Units</span><span>Charge</span></div>
      {bill.lineItems.map((line, index) => <div className="mb-read-line" role="row" key={line.id ?? `${line.code}-${index}`}>
        <strong>{line.code}</strong><div className="mb-read-chips">{line.modifiers.length ? line.modifiers.map((modifier) => <span key={modifier}>{modifier}</span>) : "—"}</div><span>{line.units}</span><strong>{money(line.charge)}</strong>
      </div>)}
      <div className="mb-read-total"><span>Paid {money(bill.totalPaid)}</span><strong>Balance {money(bill.balanceDue)}</strong></div>
    </div></section>

    <section className="mb-read-card"><h3>Attachments</h3>{bill.attachments.length ? <ul className="mb-read-documents">{bill.attachments.map((attachment) => <li key={attachment.id}><div><strong>{attachment.filename}</strong><span>{attachment.description || attachment.documentType.replace(/_/g, " ")}</span></div>{onOpenAttachment ? <button type="button" onClick={() => void onOpenAttachment(attachment)}>View</button> : null}</li>)}</ul> : <p className="mb-read-empty">No attachments.</p>}</section>
  </section>;
}

const READ_ONLY_STYLES = `
.mb-readonly-bill{--mb-accent:#176c70;--mb-border:#d7e0df;--mb-surface:#fff;--mb-muted:#607176;color:var(--mb-text,#17282d);font:inherit;display:grid;gap:16px}.mb-readonly-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.mb-readonly-heading h2,.mb-read-card h3{margin:0}.mb-readonly-heading p{margin:4px 0 0;color:var(--mb-muted)}.mb-readonly-heading>strong{font-size:1.35rem}.mb-read-card{background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-radius,14px);padding:20px;box-shadow:0 1px 2px rgba(15,40,45,.04)}.mb-read-card h3{font-size:1.05rem;margin-bottom:16px}.mb-read-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px 28px;margin:0}.mb-read-value{min-width:0}.mb-read-value.is-wide{grid-column:1/-1}.mb-read-value dt{color:var(--mb-muted);font-size:.75rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase}.mb-read-value dd{font-weight:600;margin:5px 0 0;overflow-wrap:anywhere}.mb-read-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:16px}.mb-read-chips span{border:1px solid var(--mb-border);border-radius:999px;padding:3px 9px;font-size:.82rem;background:#f7f9f8}.mb-read-lines{border:1px solid var(--mb-border);border-radius:10px;overflow:hidden}.mb-read-line-header,.mb-read-line{display:grid;grid-template-columns:1.2fr 1.5fr .45fr .7fr;gap:16px;align-items:center;padding:12px 14px}.mb-read-line-header{background:#f6f8f7;color:var(--mb-muted);font-size:.75rem;font-weight:700;text-transform:uppercase}.mb-read-line{border-top:1px solid var(--mb-border)}.mb-read-line .mb-read-chips{margin:0}.mb-read-line>span:last-child,.mb-read-line>strong:last-child{text-align:right}.mb-read-total{display:flex;justify-content:flex-end;gap:24px;border-top:1px solid var(--mb-border);padding:13px 14px}.mb-read-documents{list-style:none;padding:0;margin:0;display:grid}.mb-read-documents li{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 0;border-top:1px solid var(--mb-border)}.mb-read-documents li:first-child{border-top:0;padding-top:0}.mb-read-documents li:last-child{padding-bottom:0}.mb-read-documents div{display:grid;gap:3px;min-width:0}.mb-read-documents strong{overflow-wrap:anywhere}.mb-read-documents span,.mb-read-empty{color:var(--mb-muted)}.mb-read-documents button{border:1px solid var(--mb-border);border-radius:8px;background:transparent;color:inherit;padding:8px 13px;font:inherit;font-weight:650;cursor:pointer}.mb-read-documents button:hover{border-color:var(--mb-accent);color:var(--mb-accent)}
@media(max-width:700px){.mb-readonly-heading{align-items:flex-start}.mb-read-grid{grid-template-columns:1fr}.mb-read-value.is-wide{grid-column:auto}.mb-read-card{padding:16px}.mb-read-line-header{display:none}.mb-read-line{grid-template-columns:1fr auto;gap:8px}.mb-read-line>*:nth-child(2){grid-column:1/-1}.mb-read-total{justify-content:space-between}.mb-readonly-heading>strong{font-size:1.05rem}}
`;
