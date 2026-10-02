"use client";
import { type ReactElement } from "react";
import { getRfaLifecycleStatus, RFA_LIFECYCLE_LABELS, type RfaListQuery, type RfaRecord } from "@mindbill/browser";
import { rfaDecisionDueText } from "./rfa-decision-due";
import { RfaLink, rfaTitle, type RfaSelectionContext, type RfaRelatedLinks } from "./rfa-display";
type Sort = NonNullable<RfaListQuery["sortBy"]>;
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString() : "—";
const label = (value: string) => value.replaceAll("_", " ");
/** Both views use the same server-filtered, globally sorted request page. */
export function RfaListView({ records, view, onViewChange, sortBy, sortDirection, onSort, onSelect, lifecycleAvailable = true, hideViewSwitch = false, getRfaHref, getPatientHref, getClaimHref, getProviderHref }: RfaRelatedLinks & {
  getRfaHref?: ((id: string, context?: RfaSelectionContext) => string) | undefined;
  lifecycleAvailable?: boolean; hideViewSwitch?: boolean;
  view: "rfas" | "treatments"; onViewChange: (view: "rfas" | "treatments") => void;
  records: RfaRecord[]; sortBy: Sort; sortDirection: "asc" | "desc";
  onSort: (field: Sort) => void; onSelect: (id: string, itemId?: string) => void;
}): ReactElement {
  const heading = (field: Sort, title: string) => <th scope="col" aria-sort={sortBy === field ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}><button type="button" onClick={() => onSort(field)}>{title}{sortBy === field ? (sortDirection === "asc" ? " ↑" : " ↓") : " ↕"}</button></th>;
  return <div className="mbrfa-list">
    <style>{`.mbrfa-table-scroll{overflow-x:auto;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius)}.mbrfa-table{width:100%;border-collapse:collapse;text-align:left;font-size:13px}.mbrfa-table th,.mbrfa-table td{padding:12px;border-bottom:1px solid var(--mb-border);vertical-align:top;min-width:110px}.mbrfa-table th{background:var(--mb-soft)}.mbrfa-table td small{display:block;color:var(--mb-muted);margin-top:4px}.mbrfa-table tr:last-child td{border-bottom:0}.mbtd .mbrfa-table th button{white-space:nowrap;border:0;background:transparent;padding:0;min-height:28px;font-size:12px;font-weight:650;color:var(--mb-muted)}.mbrfa-table th{font-size:12px;font-weight:650;color:var(--mb-muted)}.mbrfa-table tbody tr:hover{background:var(--mb-soft)}.mbrfa-table td{overflow-wrap:anywhere}.mbrfa-table td:first-child button{color:var(--mb-accent);font-weight:600;background:transparent;border-color:var(--mb-border)}.mbtd .mbrfa-text-link{border:0;background:transparent;padding:0;min-height:0;color:var(--mb-accent);font-weight:600;text-decoration:none;text-align:left;line-height:1.5}.mbtd .mbrfa-text-link:hover{text-decoration:underline}.mbrfa-view button[aria-pressed=true]{background:var(--mb-soft);font-weight:600}`}</style>
    {!hideViewSwitch ? <div className="mbrfa-list-mode">
      <label>Show<select value={view} onChange={event => onViewChange(event.target.value as "rfas" | "treatments")}><option value="rfas">RFAs — one row per request</option><option value="treatments">Treatments — one row per service</option></select></label>
      <p>{view === "rfas" ? "One RFA can request several treatments. Open a request to review its treatments and decisions." : "Each treatment belongs to an RFA and can receive its own decision. Page controls move between requests."}</p>
    </div> : null}
    {!records.length ? <p>No requests match this view.</p> : <div className="mbrfa-table-scroll" tabIndex={0} role="region" aria-label={view === "rfas" ? "RFA table" : "Requested treatments table"}>
      <table className="mbrfa-table"><thead><tr><th scope="col">{view === "rfas" ? "Request" : "Request / treatment"}</th>{heading("employeeName", "Patient")}{heading("providerName", "Requesting physician")}<th scope="col">{view === "rfas" ? "Claims administrator" : "Service / diagnosis"}</th>{heading("submittedAt", "Sent")}<th scope="col">Decision due</th>{view === "rfas" ? heading(lifecycleAvailable ? "lifecycleStatus" : "status", lifecycleAvailable ? "Status" : "Clinical status") : <th scope="col">Treatment decision</th>}{heading("createdAt", "Created")}</tr></thead><tbody>
        {records.flatMap(rfa => view === "rfas" ? [<tr key={rfa.id}>
          <td><RfaLink href={getRfaHref?.(rfa.id)} onSelect={() => onSelect(rfa.id)}>{rfaTitle(rfa)}</RfaLink>{rfa.displayReference ? <small>{rfa.displayReference}</small> : null}</td>
          <td><RfaLink href={getPatientHref?.(rfa)}>{rfa.employeeName}</RfaLink><small><RfaLink href={getClaimHref?.(rfa)}>Claim {rfa.claimNumber || "not recorded"}</RfaLink></small></td><td><RfaLink href={getProviderHref?.(rfa)}>{rfa.providerName}</RfaLink></td>
          <td>{rfa.claimsAdminName || rfa.authorizationContact?.name || "Not recorded"}</td>
          <td>{date(rfa.submittedAt)}</td><td>{rfaDecisionDueText(rfa)}</td><td>{RFA_LIFECYCLE_LABELS[getRfaLifecycleStatus(rfa)]}</td><td>{date(rfa.createdAt)}</td>
        </tr>] : rfa.items.map((item) => <tr key={`${rfa.id}:${item.id}`}>
          <td><RfaLink href={getRfaHref?.(rfa.id, { treatmentId: item.id })} onSelect={() => onSelect(rfa.id, item.id)}>{item.serviceDescription}</RfaLink>{rfa.displayReference ? <small>{rfa.displayReference}</small> : null}</td>
          <td><RfaLink href={getPatientHref?.(rfa)}>{rfa.employeeName}</RfaLink><small><RfaLink href={getClaimHref?.(rfa)}>Claim {rfa.claimNumber || "not recorded"}</RfaLink></small></td><td><RfaLink href={getProviderHref?.(rfa)}>{rfa.providerName}</RfaLink></td>
          <td>{item.serviceDescription}<small>{item.procedureCode || "No procedure code"} · {item.diagnosisCode}</small></td>
          <td>{date(rfa.submittedAt)}</td><td>{item.decisionClosure?.closed ? "—" : rfaDecisionDueText(rfa)}</td><td>{item.decisionClosure?.closed ? "Decision no longer required" : label(item.outcome)}<small>{date(item.decidedAt)}</small>{item.authorizationNumber ? <small>Authorization {item.authorizationNumber}</small> : null}</td><td>{date(rfa.createdAt)}</td>
        </tr>))}
      </tbody></table>
    </div>}
  </div>;
}
