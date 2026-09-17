"use client";
import type { ReactElement } from "react";
import type { RfaContact, RfaRecord } from "@mindbill/browser";

type Detail = readonly [string, string | number | null | undefined];
const readable = (value: string) => value.replaceAll("_", " ");
// Preserve calendar dates without shifting them into the viewer's time zone.
const calendarDate = (value: string | null | undefined) => value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? value;
function Details({ entries }: { entries: readonly Detail[] }): ReactElement {
  return <dl className="mbrfa-request-details">{entries.filter(([, value]) => value !== null && value !== undefined && value !== "").map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>;
}
function Contact({ title, contact }: { title: string; contact: RfaContact | null | undefined }): ReactElement {
  const entries: Detail[] = [["Name", contact?.name], ["Contact", contact?.contactName], ["Address", contact?.address], ["City", contact?.city], ["State", contact?.state], ["ZIP", contact?.zip], ["Phone", contact?.phone], ["Fax", contact?.fax], ["Email", contact?.email]];
  return <fieldset><legend>{title}</legend>{entries.some(([, value]) => value) ? <Details entries={entries} /> : <p>Not recorded.</p>}</fieldset>;
}

/** Read-only saved request values; the retained packet remains the exact submitted document. */
export function RfaRequestSummary({ rfa, onViewClaimsAdministrator }: { rfa: RfaRecord; onViewClaimsAdministrator?: () => void }): ReactElement {
  return <section className="mbrfa-stack mbrfa-request" aria-label="Saved request details">
    <style>{`.mbrfa-request-details{display:grid;gap:9px;margin:0}.mbrfa-request-details>div{min-width:0}.mbrfa-request-details dt{font-size:12px;color:var(--mb-muted)}.mbrfa-request-details dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.mbrfa-request h3{font-size:16px;margin:0}.mbrfa-request-treatments{display:grid;gap:14px}.mbrfa-request-treatments article{border-top:1px solid var(--mb-border);padding-top:12px}.mbrfa-request-treatments article:first-child{border-top:0;padding-top:0}.mbrfa-request-treatments h4{margin:0 0 10px;overflow-wrap:anywhere}.mbrfa-request-treatments dl{grid-template-columns:repeat(2,minmax(0,1fr))}@media(max-width:520px){.mbrfa-request-treatments dl{grid-template-columns:minmax(0,1fr)}}`}</style>
    <h3>Saved request details</h3>
    <div className="mbtd-grid">
      <fieldset><legend>Patient and claim</legend><Details entries={[["RFA ID", rfa.id], ["Patient", rfa.employeeName], ["Claim number", rfa.claimNumber || "Not recorded"], ["Date of injury", calendarDate(rfa.dateOfInjury) || "Not recorded"]]} /></fieldset>
      <fieldset><legend>Requesting physician</legend><Details entries={[["Name", rfa.providerName], ["NPI", rfa.providerNpi], ["Phone", rfa.providerPhone], ["Fax", rfa.providerFax]]} /></fieldset>
      <Contact title="Requesting practice" contact={rfa.requestingPractice} />
      <div className="mbrfa-stack"><Contact title="Saved claims administrator contact" contact={rfa.authorizationContact} />{onViewClaimsAdministrator ? <div><button type="button" onClick={onViewClaimsAdministrator}>View current claims administrator directory</button><p>Current directory information may differ from the contact saved on this request.</p></div> : null}</div>
    </div>
    <fieldset><legend>Request information</legend><Details entries={[["Request", rfa.requestType ? readable(rfa.requestType) : "Not recorded"], ["Review type", readable(rfa.reviewType)], ["Expedited review", rfa.expedited ? "Yes" : "No"], ["Written confirmation of prior oral request", rfa.writtenConfirmation || rfa.requestType === "oral_authorization_confirmation" ? "Yes" : "No"], ["Place of service", rfa.placeOfServiceCode], ["Clinical rationale", rfa.rationale], ["Change in material facts", rfa.materialChange]]} /></fieldset>
    <fieldset><legend>Requested services</legend><div className="mbrfa-request-treatments">{rfa.items.map((item, index) => <article key={item.id}><h4>{index + 1}. {item.serviceDescription}</h4><Details entries={[["Diagnosis", item.diagnosisCode], ["Diagnosis description", item.diagnosisDescription], ["CPT / HCPCS", item.procedureCode || "Not specified"], ["Quantity", item.quantity], ["Units", item.units], ["Frequency", item.frequency], ["Duration", item.duration], ["Requested from", calendarDate(item.requestedFrom)], ["Requested through", calendarDate(item.requestedTo)]]} /></article>)}</div>{rfa.items.length === 0 ? <p>No services recorded.</p> : null}</fieldset>
  </section>;
}
