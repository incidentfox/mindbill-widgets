"use client";
import type { ReactElement, ReactNode } from "react";
import type { RfaContact, RfaRecord } from "@mindbill/browser";

import { RfaLink, type RfaRelatedLinks } from "./rfa-display";
type Detail = readonly [string, ReactNode];
const readable = (value: string) => value.replaceAll("_", " ");
// Preserve calendar dates without shifting them into the viewer's time zone.
const calendarDate = (value: string | null | undefined) => value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? value;
function Details({ entries }: { entries: readonly Detail[] }): ReactElement {
  return <dl className="mbrfa-request-details">{entries.filter(([, value]) => value !== null && value !== undefined && value !== "").map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>;
}
function Contact({ title, contact }: { title: string; contact: RfaContact | null | undefined }): ReactElement {
  const entries: Detail[] = [["Name", contact?.name], ["Contact", contact?.contactName], ["Address", contact?.address], ["City", contact?.city], ["State", contact?.state], ["ZIP", contact?.zip], ["Phone", contact?.phone], ["Fax", contact?.fax], ["Email", contact?.email]];
  return <section className="mbrfa-info-card"><h3>{title}</h3><div className="mbrfa-info-body">{entries.some(([, value]) => value) ? <Details entries={entries} /> : <p>Not recorded.</p>}</div></section>;
}

/** Read-only saved request values; the retained packet remains the exact submitted document. */
export function RfaRequestSummary({ rfa, onViewClaimsAdministrator, getPatientHref, getClaimHref, getProviderHref, hideTreatments = false, collapseContacts = false }: RfaRelatedLinks & { rfa: RfaRecord; onViewClaimsAdministrator?: () => void; hideTreatments?: boolean; collapseContacts?: boolean }): ReactElement {
  const contacts = <div className="mbtd-grid">
      <section className="mbrfa-info-card"><h3>Patient and injury</h3><div className="mbrfa-info-body"><Details entries={[["Patient", <RfaLink href={getPatientHref?.(rfa)}>{rfa.employeeName}</RfaLink>], ["Claim number", <RfaLink href={getClaimHref?.(rfa)}>{rfa.claimNumber || "Not recorded"}</RfaLink>], ["Injury", rfa.injuryDescription ? <RfaLink href={getClaimHref?.(rfa)}>{rfa.injuryDescription}</RfaLink> : null], ["Date of injury", calendarDate(rfa.dateOfInjury) || "Not recorded"]]} /></div></section>
      <section className="mbrfa-info-card"><h3>Requesting physician</h3><div className="mbrfa-info-body"><Details entries={[["Name", <RfaLink href={getProviderHref?.(rfa)}>{rfa.providerName}</RfaLink>], ["NPI", rfa.providerNpi], ["Phone", rfa.providerPhone], ["Fax", rfa.providerFax]]} /></div></section>
      <Contact title="Requesting practice" contact={rfa.requestingPractice} />
      <section className="mbrfa-info-card"><h3>Claims administrator</h3><div className="mbrfa-info-body"><Details entries={[["Name", <RfaLink onSelect={onViewClaimsAdministrator}>{rfa.claimsAdminName || rfa.authorizationContact?.name || "Not recorded"}</RfaLink>], ["Contact", rfa.authorizationContact?.contactName], ["Phone", rfa.authorizationContact?.phone], ["Fax", rfa.authorizationContact?.fax], ["Email", rfa.authorizationContact?.email], ["Address", [rfa.authorizationContact?.address, rfa.authorizationContact?.city, rfa.authorizationContact?.state, rfa.authorizationContact?.zip].filter(Boolean).join(", ")]]} /></div></section>
    </div>;
  return <section className="mbrfa-stack mbrfa-request" aria-label="Saved request details">
    <style>{`.mbrfa-request-details{display:grid;gap:9px;margin:0}.mbrfa-request-details>div{min-width:0}.mbrfa-request-details dt{font-size:12px;color:var(--mb-muted)}.mbrfa-request-details dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.mbrfa-request h3{font-size:16px;margin:0}.mbrfa-request-treatments{display:grid;gap:14px}.mbrfa-request-treatments article{border-top:1px solid var(--mb-border);padding-top:12px}.mbrfa-request-treatments article:first-child{border-top:0;padding-top:0}.mbrfa-request-treatments h4{margin:0 0 10px;overflow-wrap:anywhere}.mbrfa-request-treatments dl{grid-template-columns:repeat(2,minmax(0,1fr))}@media(max-width:520px){.mbrfa-request-treatments dl{grid-template-columns:minmax(0,1fr)}}`}</style>
    {!collapseContacts ? contacts : null}
    <section className="mbrfa-info-card"><h3>Request information</h3><div className="mbrfa-info-body"><Details entries={[["Request", rfa.requestType ? readable(rfa.requestType) : "Not recorded"], ["Review type", readable(rfa.reviewType)], ["Expedited review", rfa.expedited ? "Yes" : "No"], ["Written confirmation of prior oral request", rfa.writtenConfirmation || rfa.requestType === "oral_authorization_confirmation" ? "Yes" : "No"], ["Place of service", rfa.placeOfServiceCode], ["Clinical rationale", rfa.rationale], ["Change in material facts", rfa.materialChange]]} /></div></section>
    {collapseContacts ? <details className="mbrfa-detail-card"><summary>Patient, physician &amp; claim details</summary>{contacts}</details> : null}
    {!hideTreatments ? <fieldset><legend>Requested services</legend><div className="mbrfa-request-treatments">{rfa.items.map((item, index) => <article key={item.id}><h4>{index + 1}. {item.serviceDescription}</h4><Details entries={[["Diagnosis", item.diagnosisCode], ["Diagnosis description", item.diagnosisDescription], ["CPT / HCPCS", item.procedureCode || "Not specified"], ["Quantity", item.quantity], ["Units", item.units], ["Frequency", item.frequency], ["Duration", item.duration], ["Requested from", calendarDate(item.requestedFrom)], ["Requested through", calendarDate(item.requestedTo)]]} /></article>)}</div>{rfa.items.length === 0 ? <p>No services recorded.</p> : null}</fieldset> : null}
  </section>;
}
