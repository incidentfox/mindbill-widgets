"use client";
import { type MouseEvent, type ReactElement } from "react";
import { getRfaLifecycleStatus, type RfaListQuery, type RfaRecord } from "@mindbill/browser";
import { RfaPill, rfaLifecycleTone, rfaOutcome, rfaPillCss, rfaStatusLabel } from "./rfa-detail-cards";
import { rfaDecisionDueText } from "./rfa-decision-due";
import { RfaLink, rfaTitle, type RfaSelectionContext, type RfaRelatedLinks } from "./rfa-display";
type Sort = NonNullable<RfaListQuery["sortBy"]>;
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString() : "—";
const LIFECYCLE_ORDER = ["incomplete", "failed", "sent", "received", "closed", "canceled"];
/** Sort a complete result set in the browser so a header click reorders at once. Blank values sort last. */
export function rfaSortRecords(records: RfaRecord[], sortBy: Sort, direction: "asc" | "desc"): RfaRecord[] {
  const value = (rfa: RfaRecord): string | number | null => sortBy === "employeeName" ? rfa.employeeName?.toLowerCase() ?? null
    : sortBy === "providerName" ? rfa.providerName?.toLowerCase() ?? null
    : sortBy === "submittedAt" ? rfa.submittedAt ? Date.parse(rfa.submittedAt) : null
    : sortBy === "lifecycleStatus" ? LIFECYCLE_ORDER.indexOf(getRfaLifecycleStatus(rfa))
    : sortBy === "status" ? rfa.status
    : rfa.createdAt ? Date.parse(rfa.createdAt) : null;
  return [...records].sort((a, b) => {
    const left = value(a), right = value(b);
    if (left === right) return a.id.localeCompare(b.id) * (direction === "asc" ? 1 : -1);
    if (left === null) return 1; if (right === null) return -1;
    return (left < right ? -1 : 1) * (direction === "asc" ? 1 : -1);
  });
}
/** Both views use the same server-filtered, globally sorted request page; a complete page also sorts locally. */
export function RfaListView({ records, view, onViewChange, sortBy, sortDirection, onSort, onSelect, lifecycleAvailable = true, hideViewSwitch = false, complete = false, updating = false, getRfaHref, getPatientHref, getClaimHref, getProviderHref }: RfaRelatedLinks & {
  getRfaHref?: ((id: string, context?: RfaSelectionContext) => string) | undefined;
  lifecycleAvailable?: boolean; hideViewSwitch?: boolean;
  /** Every matching request is on this page, so sorting can happen here without waiting for the server. */
  complete?: boolean;
  /** A newer result is loading; the current rows stay visible. */
  updating?: boolean;
  view: "rfas" | "treatments"; onViewChange: (view: "rfas" | "treatments") => void;
  records: RfaRecord[]; sortBy: Sort; sortDirection: "asc" | "desc";
  onSort: (field: Sort) => void; onSelect: (id: string, itemId?: string) => void;
}): ReactElement {
  const rows = complete ? rfaSortRecords(records, sortBy, sortDirection) : records;
  const treatmentCount = records.reduce((total, rfa) => total + rfa.items.length, 0);
  const heading = (field: Sort, title: string) => <th scope="col" aria-sort={sortBy === field ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}><button type="button" className="mbrfa-sort" data-active={sortBy === field || undefined} onClick={() => onSort(field)}>{title}<span aria-hidden="true">{sortBy === field ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span></button></th>;
  // The whole row opens the request; links inside it keep their own targets.
  const rowProps = (id: string, itemId?: string) => ({ className: "mbrfa-row-link", onClick: (event: MouseEvent<HTMLTableRowElement>) => {
    if ((event.target as HTMLElement).closest("a,button") || window.getSelection()?.toString()) return;
    const href = getRfaHref?.(id, itemId ? { treatmentId: itemId } : undefined);
    if (href && (event.metaKey || event.ctrlKey)) { window.open(href, "_blank", "noopener"); return; }
    onSelect(id, itemId);
  } });
  return <div className="mbrfa-list">
    <style>{rfaPillCss + `.mbrfa-table-scroll{overflow-x:auto;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);transition:opacity .15s}.mbrfa-table-scroll[data-updating]{opacity:.6}.mbrfa-table{width:100%;border-collapse:collapse;text-align:left;font-size:13px}.mbrfa-table th,.mbrfa-table td{padding:12px 14px;border-bottom:1px solid var(--mb-border);vertical-align:top}.mbrfa-table th{font-size:12px;font-weight:600;color:var(--mb-muted);white-space:nowrap;background:var(--mb-surface)}.mbrfa-table td small{display:block;color:var(--mb-muted);margin-top:3px;font-size:12px}.mbrfa-table tbody tr:last-child td{border-bottom:0}.mbrfa-row-link{cursor:pointer}.mbtd .mbrfa-table .mbrfa-text-link{border:0;background:none;padding:0;min-height:0;font:inherit;font-weight:500;color:var(--mb-accent);text-align:left;cursor:pointer;text-decoration:none}.mbtd .mbrfa-table .mbrfa-text-link:hover{text-decoration:underline}.mbrfa-row-link:hover td{background:var(--mb-soft)}.mbrfa-table .mbrfa-cell-title{max-width:300px}
.mbtd .mbrfa-sort{display:inline-flex;gap:6px;align-items:center;white-space:nowrap;border:0;background:transparent;padding:0;min-height:0;font:inherit;color:inherit;cursor:pointer}.mbrfa-sort span{opacity:.45;font-size:11px}.mbrfa-sort[data-active]{color:var(--mb-text)}.mbrfa-sort[data-active] span{opacity:1}
.mbrfa-view-tabs{display:flex;gap:4px;border-bottom:1px solid var(--mb-border);margin:4px 0 14px}.mbtd .mbrfa-view-tabs button{border:0;border-bottom:2px solid transparent;border-radius:0;background:transparent;padding:8px 12px;min-height:0;font-size:13px;color:var(--mb-muted)}.mbtd .mbrfa-view-tabs button[aria-selected=true]{color:var(--mb-text);font-weight:600;border-bottom-color:var(--mb-accent)}`}</style>
    {!hideViewSwitch ? <div className="mbrfa-view-tabs" role="tablist" aria-label="Show">
      <button type="button" role="tab" aria-selected={view === "rfas"} onClick={() => onViewChange("rfas")}>RFAs ({records.length})</button>
      <button type="button" role="tab" aria-selected={view === "treatments"} onClick={() => onViewChange("treatments")}>Requested treatments ({treatmentCount})</button>
    </div> : null}
    {!records.length ? <p>No requests match this view.</p> : <div className="mbrfa-table-scroll" data-updating={updating || undefined} tabIndex={0} role="region" aria-label={view === "rfas" ? "RFA table" : "Requested treatments table"}>
      <table className="mbrfa-table"><thead><tr><th scope="col">{view === "rfas" ? "Request" : "Requested treatment"}</th>{heading("employeeName", "Patient")}{heading("providerName", "Requesting physician")}<th scope="col">{view === "rfas" ? "Claims administrator" : "CPT / ICD-10"}</th>{heading("submittedAt", "Sent")}<th scope="col">Decision due</th>{view === "rfas" ? heading(lifecycleAvailable ? "lifecycleStatus" : "status", "Status") : <th scope="col">Decision</th>}{heading("createdAt", "Created")}</tr></thead><tbody>
        {rows.flatMap(rfa => view === "rfas" ? [<tr key={rfa.id} {...rowProps(rfa.id)}>
          <td className="mbrfa-cell-title"><RfaLink href={getRfaHref?.(rfa.id)} onSelect={() => onSelect(rfa.id)}>{rfaTitle(rfa)}</RfaLink>{rfa.displayReference ? <small>RFA {rfa.displayReference}</small> : null}</td>
          <td><RfaLink href={getPatientHref?.(rfa)}>{rfa.employeeName}</RfaLink><small><RfaLink href={getClaimHref?.(rfa)}>Claim {rfa.claimNumber || "not recorded"}</RfaLink></small></td><td><RfaLink href={getProviderHref?.(rfa)}>{rfa.providerName}</RfaLink></td>
          <td>{rfa.claimsAdminName || rfa.authorizationContact?.name || "Not recorded"}</td>
          <td>{date(rfa.submittedAt)}</td><td>{rfa.submittedAt ? rfaDecisionDueText(rfa) : "—"}</td><td><RfaPill tone={rfaLifecycleTone(rfa)}>{rfaStatusLabel(getRfaLifecycleStatus(rfa))}</RfaPill></td><td>{date(rfa.createdAt)}</td>
        </tr>] : rfa.items.map((item) => { const outcome = rfaOutcome(item); return <tr key={`${rfa.id}:${item.id}`} {...rowProps(rfa.id, item.id)}>
          <td className="mbrfa-cell-title"><RfaLink href={getRfaHref?.(rfa.id, { treatmentId: item.id })} onSelect={() => onSelect(rfa.id, item.id)}>{item.serviceDescription}</RfaLink>{rfa.displayReference ? <small>RFA {rfa.displayReference}</small> : null}</td>
          <td><RfaLink href={getPatientHref?.(rfa)}>{rfa.employeeName}</RfaLink><small><RfaLink href={getClaimHref?.(rfa)}>Claim {rfa.claimNumber || "not recorded"}</RfaLink></small></td><td><RfaLink href={getProviderHref?.(rfa)}>{rfa.providerName}</RfaLink></td>
          <td>{item.procedureCode || "—"}<small>{item.diagnosisCode}</small></td>
          <td>{date(rfa.submittedAt)}</td><td>{item.decisionClosure?.closed || !rfa.submittedAt ? "—" : rfaDecisionDueText(rfa)}</td><td><RfaPill tone={outcome.tone}>{outcome.label}</RfaPill>{item.decidedAt ? <small>{date(item.decidedAt)}</small> : null}{item.authorizationNumber ? <small>Auth {item.authorizationNumber}</small> : null}</td><td>{date(rfa.createdAt)}</td>
        </tr>; }))}
      </tbody></table>
    </div>}
  </div>;
}
