"use client";
import { type ReactElement } from "react";
import type { RfaListQuery, RfaRecord } from "@mindbill/browser";
type Sort = NonNullable<RfaListQuery["sortBy"]>;
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString() : "—";
const label = (value: string) => value.replaceAll("_", " ");
/** Both views use the same server-filtered, globally sorted request page. */
export function RfaListView({ records, view, onViewChange, sortBy, sortDirection, onSort, onSelect }: {
  view: "rfas" | "treatments"; onViewChange: (view: "rfas" | "treatments") => void;
  records: RfaRecord[]; sortBy: Sort; sortDirection: "asc" | "desc";
  onSort: (field: Sort) => void; onSelect: (id: string, itemId?: string) => void;
}): ReactElement {
  const heading = (field: Sort, title: string) => <th scope="col" aria-sort={sortBy === field ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}><button type="button" onClick={() => onSort(field)}>{title}{sortBy === field ? (sortDirection === "asc" ? " ↑" : " ↓") : " ↕"}</button></th>;
  return <div className="mbrfa-list">
    <style>{`.mbrfa-table-scroll{overflow-x:auto;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius)}.mbrfa-table{width:100%;border-collapse:collapse;text-align:left;font-size:13px}.mbrfa-table th,.mbrfa-table td{padding:12px;border-bottom:1px solid var(--mb-border);vertical-align:top;min-width:110px}.mbrfa-table th{background:var(--mb-soft)}.mbrfa-table td small{display:block;color:var(--mb-muted);margin-top:4px}.mbrfa-table tr:last-child td{border-bottom:0}.mbrfa-table th button{white-space:nowrap}.mbrfa-view button[aria-pressed=true]{background:var(--mb-soft);font-weight:600}`}</style>
    <div className="mbtd-actions mbrfa-view" role="group" aria-label="Request list view">
      <button type="button" aria-pressed={view === "rfas"} onClick={() => onViewChange("rfas")}>RFAs</button>
      <button type="button" aria-pressed={view === "treatments"} onClick={() => onViewChange("treatments")}>Requested treatments</button>
    </div>
    {view === "treatments" ? <p>All treatments from the requests on this page. Search matches whole requests; every treatment on a matching request is shown. Page controls move between requests.</p> : null}
    {!records.length ? <p>No requests match this view.</p> : <div className="mbrfa-table-scroll" tabIndex={0} role="region" aria-label={view === "rfas" ? "RFA table" : "Requested treatments table"}>
      <table className="mbrfa-table"><thead><tr><th scope="col">{view === "rfas" ? "Request" : "Request / treatment"}</th>{heading("employeeName", "Patient")}{heading("providerName", "Requesting physician")}<th scope="col">{view === "rfas" ? "Practice / recipient" : "Service / diagnosis"}</th>{heading("submittedAt", "Sent")}<th scope="col">Decision due</th>{view === "rfas" ? heading("status", "Status") : <th scope="col">Treatment decision</th>}{heading("createdAt", "Created")}</tr></thead><tbody>
        {records.flatMap(rfa => view === "rfas" ? [<tr key={rfa.id}>
          <td><button type="button" onClick={() => onSelect(rfa.id)}>Review request</button><small>{rfa.id}</small></td>
          <td>{rfa.employeeName}<small>Claim {rfa.claimNumber || "not recorded"}</small></td><td>{rfa.providerName}</td>
          <td>{rfa.requestingPractice?.name || "—"}<small>{rfa.authorizationContact?.name || rfa.authorizationContact?.contactName || "Recipient not recorded"}</small></td>
          <td>{date(rfa.submittedAt)}</td><td>{date(rfa.decisionDueAt)}</td><td>{label(rfa.status)}<small>{rfa.items.map(item => item.serviceDescription).join("; ")}</small></td><td>{date(rfa.createdAt)}</td>
        </tr>] : rfa.items.map((item, index) => <tr key={`${rfa.id}:${item.id}`}>
          <td><button type="button" onClick={() => onSelect(rfa.id, item.id)} aria-label={`Review ${item.serviceDescription} on request ${rfa.id}`}>{rfa.id} · {index + 1}</button></td>
          <td>{rfa.employeeName}<small>Claim {rfa.claimNumber || "not recorded"}</small></td><td>{rfa.providerName}</td>
          <td>{item.serviceDescription}<small>{item.procedureCode || "No procedure code"} · {item.diagnosisCode}</small></td>
          <td>{date(rfa.submittedAt)}</td><td>{date(rfa.decisionDueAt)}</td><td>{label(item.outcome)}<small>{date(item.decidedAt)}</small>{item.authorizationNumber ? <small>Authorization {item.authorizationNumber}</small> : null}</td><td>{date(rfa.createdAt)}</td>
        </tr>))}
      </tbody></table>
    </div>}
  </div>;
}
