"use client";
import { type MouseEvent, type ReactElement } from "react";
import { getRfaLifecycleStatus, type RfaListQuery, type RfaRecord } from "@mindbill/browser";
import { RfaPill, rfaLifecycleTone, rfaOutcome, rfaPillCss, rfaStatusLabel } from "./rfa-detail-cards";
import { RfaLink, type RfaSelectionContext, type RfaRelatedLinks } from "./rfa-display";
type Sort = NonNullable<RfaListQuery["sortBy"]>;
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString() : "—";
const reference = (rfa: RfaRecord) => rfa.displayReference || rfa.id.replace(/^rfa_/, "").slice(0, 8).toUpperCase();
const latestDecision = (rfa: RfaRecord) => rfa.items.map(item => item.decidedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
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
    <style>{rfaPillCss + `.mbrfa-table-scroll{overflow-x:auto;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);transition:opacity .15s}.mbrfa-table-scroll[data-updating]{opacity:.6}.mbrfa-table{width:100%;border-collapse:collapse;text-align:left;font-size:13px}.mbrfa-table th,.mbrfa-table td{padding:12px 14px;border-bottom:1px solid var(--mb-border);vertical-align:top}.mbrfa-table th{font-size:12px;font-weight:600;color:var(--mb-muted);white-space:nowrap;background:var(--mb-surface);vertical-align:middle}.mbrfa-table td small{display:block;color:var(--mb-muted);margin-top:3px;font-size:12px}.mbrfa-table tbody tr:last-child td{border-bottom:0}.mbrfa-row-link{cursor:pointer}.mbtd .mbrfa-table .mbrfa-text-link{border:0;background:none;padding:0;min-height:0;font:inherit;font-weight:500;color:var(--mb-accent);text-align:left;cursor:pointer;text-decoration:none}.mbtd .mbrfa-table .mbrfa-text-link:hover{text-decoration:underline}.mbrfa-row-link:hover td{background:var(--mb-soft)}.mbrfa-table .mbrfa-cell-title{max-width:300px;min-width:180px}.mbrfa-table th,.mbrfa-table td{white-space:nowrap}.mbrfa-table td.mbrfa-cell-title,.mbrfa-table td:nth-child(2),.mbrfa-table td:nth-child(3){white-space:normal}.mbrfa-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.mbrfa-cell-ref .mbrfa-text-link{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.mbrfa-clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mbtd .mbrfa-sort{display:inline-flex;gap:6px;align-items:center;white-space:nowrap;border:0;background:transparent;padding:0;min-height:0;font:inherit;color:inherit;cursor:pointer}.mbrfa-sort span{opacity:.45;font-size:11px}.mbrfa-sort[data-active]{color:var(--mb-text)}.mbrfa-sort[data-active] span{opacity:1}
.mbrfa-view-tabs{display:flex;gap:4px;border-bottom:1px solid var(--mb-border);margin:4px 0 14px}.mbtd .mbrfa-view-tabs button{border:0;border-bottom:2px solid transparent;border-radius:0;background:transparent;padding:8px 12px;min-height:0;font-size:13px;color:var(--mb-muted)}.mbtd .mbrfa-view-tabs button[aria-selected=true]{color:var(--mb-text);font-weight:600;border-bottom-color:var(--mb-accent)}`}</style>
    {!hideViewSwitch ? <div className="mbrfa-view-tabs" role="tablist" aria-label="Show">
      <button type="button" role="tab" aria-selected={view === "rfas"} onClick={() => onViewChange("rfas")}>RFAs ({records.length})</button>
      <button type="button" role="tab" aria-selected={view === "treatments"} onClick={() => onViewChange("treatments")}>Requested treatments ({treatmentCount})</button>
    </div> : null}
    {!records.length ? <p>No requests match this view.</p> : <div className="mbrfa-table-scroll" data-updating={updating || undefined} tabIndex={0} role="region" aria-label={view === "rfas" ? "RFA table" : "Requested treatments table"}>
      {/* Same columns as the injury page's RFA section, plus the patient, since this list spans patients. */}
      {view === "rfas" ? <table className="mbrfa-table"><thead><tr>{heading("createdAt", "RFA ID")}{heading("employeeName", "Patient")}{heading("providerName", "Requesting physician")}<th scope="col">Requested treatment</th>{heading("submittedAt", "RFA sent")}<th scope="col">Decision due</th><th scope="col">Decision date</th>{heading(lifecycleAvailable ? "lifecycleStatus" : "status", "Status")}</tr></thead><tbody>
        {rows.map(rfa => <tr key={rfa.id} {...rowProps(rfa.id)}>
          <td className="mbrfa-cell-ref"><RfaLink href={getRfaHref?.(rfa.id)} onSelect={() => onSelect(rfa.id)}>{reference(rfa)}</RfaLink>{rfa.expedited ? <small>Expedited</small> : null}</td>
          <td><RfaLink href={getPatientHref?.(rfa)}>{rfa.employeeName}</RfaLink><small><RfaLink href={getClaimHref?.(rfa)}>Claim {rfa.claimNumber || "not recorded"}</RfaLink></small></td>
          <td><RfaLink href={getProviderHref?.(rfa)}>{rfa.providerName}</RfaLink></td>
          <td className="mbrfa-cell-title"><span className="mbrfa-clamp">{rfa.items.map(item => item.serviceDescription).filter(Boolean).join(" · ") || "—"}</span></td>
          <td>{date(rfa.submittedAt)}</td><td>{rfa.submittedAt ? date(rfa.decisionDueAt) : "—"}</td><td>{date(latestDecision(rfa))}</td>
          <td><RfaPill tone={rfaLifecycleTone(rfa)}>{rfaStatusLabel(getRfaLifecycleStatus(rfa))}</RfaPill></td>
        </tr>)}
      </tbody></table>
      : <table className="mbrfa-table"><thead><tr>{heading("createdAt", "RFA ID")}{heading("employeeName", "Patient")}{heading("providerName", "Requesting physician")}<th scope="col">Service / good</th><th scope="col">CPT/HCPCS</th><th scope="col">Quantity / frequency / duration</th>{heading("submittedAt", "RFA sent")}<th scope="col">Decision due</th><th scope="col">Decision date</th><th scope="col">Decision</th><th scope="col">Auth #</th></tr></thead><tbody>
        {rows.flatMap(rfa => rfa.items.map((item, index) => { const outcome = rfaOutcome(item); const unsent = ["draft", "ready", "canceled"].includes(rfa.status); return <tr key={`${rfa.id}:${item.id}`} {...rowProps(rfa.id, item.id)}>
          <td className="mbrfa-cell-ref"><RfaLink href={getRfaHref?.(rfa.id, { treatmentId: item.id })} onSelect={() => onSelect(rfa.id, item.id)}>{`${reference(rfa)}-${index + 1}`}</RfaLink></td>
          <td><RfaLink href={getPatientHref?.(rfa)}>{rfa.employeeName}</RfaLink><small><RfaLink href={getClaimHref?.(rfa)}>Claim {rfa.claimNumber || "not recorded"}</RfaLink></small></td>
          <td><RfaLink href={getProviderHref?.(rfa)}>{rfa.providerName}</RfaLink></td>
          <td className="mbrfa-cell-title">{item.serviceDescription}{item.diagnosisCode ? <small className="mbrfa-mono">ICD-10 {item.diagnosisCode}</small> : null}</td>
          <td className="mbrfa-mono">{item.procedureCode || "—"}</td>
          <td>{[item.quantity, item.frequency, item.duration].filter(part => part != null && part !== "").join(" · ") || "—"}</td>
          <td>{date(rfa.submittedAt)}</td><td>{unsent || item.decisionClosure?.closed ? "—" : date(rfa.decisionDueAt)}</td><td>{date(item.decidedAt)}</td>
          <td><RfaPill tone={unsent ? "muted" : outcome.tone}>{unsent ? (rfa.status === "canceled" ? "Canceled" : "Not sent") : outcome.label}</RfaPill></td>
          <td className="mbrfa-mono">{item.authorizationNumber || "—"}</td>
        </tr>; }))}
      </tbody></table>}
    </div>}
  </div>;
}
