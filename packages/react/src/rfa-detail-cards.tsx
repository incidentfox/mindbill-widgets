import type { ReactElement, ReactNode } from "react";
import { getRfaLifecycleStatus, RFA_LIFECYCLE_LABELS, type RfaRecord } from "@mindbill/browser";
import { rfaDecisionDueText } from "./rfa-decision-due";

const DECIDED = ["approved", "modified", "denied", "mixed", "closed"];
export const rfaShortDate = (value: string | null | undefined): string => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—";
/** Preserve calendar dates without shifting them into the viewer's time zone. */
export const rfaCalendarDate = (value: string | null | undefined): string => { const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? ""); return match ? `${match[2]}/${match[3]}/${match[1]}` : value ?? ""; };
const sentence = (value: string) => { const text = value.replaceAll("_", " "); return text.charAt(0).toUpperCase() + text.slice(1); };

/** Decision wording and tone for one requested treatment. */
export function rfaOutcome(item: RfaRecord["items"][number]): { label: string; tone: "ok" | "warn" | "bad" | "muted" } {
  if (item.decisionClosure?.closed) return { label: "No decision required", tone: "muted" };
  if (item.outcome === "approved") return { label: "Approved", tone: "ok" };
  if (item.outcome === "modified") return { label: "Modified", tone: "warn" };
  if (item.outcome === "denied") return { label: "Denied", tone: "bad" };
  return { label: sentence(item.outcome || "pending"), tone: "muted" };
}
/** What the reviewer decided, across the whole request, in a word. Null until at least one treatment is decided.
 * "Partially decided" means the response left treatments without a decision; those are still being waited on. */
export function rfaDecisionSummary(rfa: Pick<RfaRecord, "items">): { label: string; tone: "ok" | "warn" | "bad" } | null {
  const items = rfa.items.filter(item => !item.decisionClosure?.closed);
  const decided = items.filter(item => item.outcome !== "pending");
  if (!decided.length) return null;
  if (decided.length < items.length) return { label: "Partially decided", tone: "warn" };
  if (decided.every(item => item.outcome === "approved")) return { label: "Approved", tone: "ok" };
  if (decided.every(item => item.outcome === "denied")) return { label: "Denied", tone: "bad" };
  if (decided.every(item => item.outcome === "modified")) return { label: "Modified", tone: "warn" };
  return { label: "Partially approved", tone: "warn" };
}
const FAX_FAILURES: Record<string, string> = { busy: "The line was busy", no_answer: "No answer", not_a_fax_machine: "The number did not answer as a fax machine", invalid_number: "The number is not in service", rejected: "The call was rejected", carrier_error: "The fax carrier could not complete the call" };
/** Why a send failed, in plain words, when the carrier gave a reason. */
export function rfaFailureReason(transmission: RfaRecord["transmissions"][number]): string {
  const reason = (transmission as { metadata?: { failureReason?: unknown } }).metadata?.failureReason;
  return transmission.status === "failed" && typeof reason === "string" ? FAX_FAILURES[reason] ?? "" : "";
}
export function RfaPill({ tone = "muted", children }: { tone?: "ok" | "warn" | "bad" | "muted" | "accent" | "mono"; children: ReactNode }): ReactElement {
  return <span className="mbrfa-pill" data-tone={tone}>{children}</span>;
}
export function rfaLifecycleTone(rfa: RfaRecord): "ok" | "warn" | "bad" | "muted" | "accent" {
  const status = getRfaLifecycleStatus(rfa);
  if (status === "failed") return "bad";
  if (status === "canceled" || status === "closed") return "muted";
  if (rfa.status === "approved") return "ok";
  if (rfa.status === "denied") return "bad";
  return rfa.submittedAt ? "accent" : "warn";
}

/** Milestones are evidence-based: a later step is never inferred from an earlier one. */
export function RfaStatusCard({ rfa }: { rfa: RfaRecord }): ReactElement {
  const status = getRfaLifecycleStatus(rfa);
  const decided = DECIDED.includes(rfa.status) || (rfa.items.length > 0 && rfa.items.every(item => item.outcome !== "pending" || item.decisionClosure?.closed));
  // Signing is part of sending, so it is not a step of its own.
  const stages = ["Draft", "Sent", "Received", "Decided"];
  const current = rfa.submittedAt && decided ? 3 : rfa.receivedAt ? 2 : rfa.submittedAt ? 1 : 0;
  const stopped = status === "canceled" || status === "failed";
  const failure = status === "failed" ? rfa.transmissions.map(rfaFailureReason).filter(Boolean).at(-1) : "";
  const detail = status === "canceled" ? "This request was canceled" : status === "failed" ? `Delivery needs attention${failure ? `: ${failure.charAt(0).toLowerCase()}${failure.slice(1)}` : ""}` : rfa.submittedAt ? `Sent ${rfaShortDate(rfa.submittedAt)}` : "Not sent yet";
  return <section className="mbrfa-status" aria-label="Request status" data-stopped={stopped || undefined}>
    <div className="mbrfa-status-heading"><div><h3>{!rfa.submittedAt && !stopped ? "Draft" : !stopped && rfaDecisionSummary(rfa) ? rfaDecisionSummary(rfa)!.label : RFA_LIFECYCLE_LABELS[status]}</h3><p>{detail}</p></div>{rfa.submittedAt && !stopped ? <div className="mbrfa-status-due"><span>Decision due</span><strong>{rfaDecisionDueText(rfa)}</strong></div> : null}</div>
    <ol aria-label="Authorization progress">{stages.map((stage, index) => <li key={stage} data-state={index < current ? "done" : index === current ? "current" : "todo"} aria-current={index === current ? "step" : undefined}><span>{index < current ? "✓" : index + 1}</span><strong>{stage}</strong></li>)}</ol>
  </section>;
}

export function RfaCard({ title, count, action, children, id, flush = false }: { title: string; count?: number | undefined; action?: ReactNode; children: ReactNode; id?: string; flush?: boolean }): ReactElement {
  return <section className="mbrfa-sheet" id={id} aria-label={title}><header><h3>{title}{count !== undefined ? <span className="mbrfa-count">{count}</span> : null}</h3>{action ? <div className="mbrfa-sheet-action">{action}</div> : null}</header><div className={flush ? "mbrfa-sheet-flush" : "mbrfa-sheet-body"}>{children}</div></section>;
}
/** Label and value rows; empty values are omitted so a card never shows a blank line. */
export function RfaFacts({ entries }: { entries: ReadonlyArray<readonly [string, ReactNode]> }): ReactElement {
  const shown = entries.filter(([, value]) => value !== null && value !== undefined && value !== "" && value !== false);
  return shown.length ? <dl className="mbrfa-facts">{shown.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl> : <p className="mbrfa-empty">Not recorded.</p>;
}
export const rfaAddress = (contact: { address?: string; city?: string; state?: string; zip?: string } | null | undefined): string => [contact?.address, [contact?.city, [contact?.state, contact?.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ");
export const rfaRequestTypeLabel = (rfa: RfaRecord): string => rfa.requestType === "resubmission_material_change" ? "Resubmission – Change in Material Facts" : "New Request";

export const rfaCardsCss = `
.mbrfa-simple{font-size:13px}
.mbrfa-status{background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-radius);padding:18px 20px 16px}
.mbrfa-status-heading{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}
.mbrfa-status h3{font-size:16px!important;font-weight:600!important;line-height:1.3}
.mbrfa-status p{margin:2px 0 0!important;font-size:12px;color:var(--mb-muted);text-transform:none}
.mbrfa-status-due{display:grid;gap:2px;text-align:right;font-size:12px}.mbrfa-status-due span{color:var(--mb-muted)}.mbrfa-status-due strong{font-size:13px;font-weight:600}
.mbrfa-status ol{list-style:none;display:flex;padding:0;margin:18px 0 0}
.mbrfa-status li{position:relative;display:grid;justify-items:center;gap:8px;flex:1;font-size:12px;color:var(--mb-muted)}
.mbrfa-status li:before{content:'';position:absolute;height:1px;background:var(--mb-border);width:calc(100% - 44px);top:14px;left:calc(-50% + 22px)}
.mbrfa-status li:first-child:before{display:none}
.mbrfa-status li>span{position:relative;z-index:1;display:grid;place-items:center;width:28px;height:28px;border:1px solid var(--mb-border);border-radius:50%;background:var(--mb-surface);font-weight:600;font-size:12px}
.mbrfa-status li>strong{font-weight:500}
.mbrfa-status li[data-state=done]>span{border-color:var(--mb-accent);color:var(--mb-accent)}
.mbrfa-status li[data-state=done]:before,.mbrfa-status li[data-state=current]:before{background:var(--mb-accent)}
.mbrfa-status li[data-state=current]>span{background:var(--mb-accent);border-color:var(--mb-accent);color:var(--mb-accent-contrast)}
.mbrfa-status li[data-state=current]>strong{color:var(--mb-text);font-weight:600}
.mbrfa-status[data-stopped] li[data-state=current]>span{background:var(--mb-muted);border-color:var(--mb-muted)}
.mbrfa-status[data-stopped] li:before{background:var(--mb-border)!important}
.mbrfa-simple .mbrfa-detail-toolbar h2{font-size:20px!important;font-weight:600;letter-spacing:-.01em}
.mbrfa-simple .mbrfa-detail-toolbar .mbtd-actions{margin-top:0}
.mbrfa-simple .mbrfa-detail-toolbar button,.mbrfa-simple .mbrfa-form-link{min-height:34px;padding:6px 12px;font-size:13px;font-weight:500;background:var(--mb-surface)}
.mbrfa-pill{display:inline-flex;align-items:center;font-size:12px;font-weight:500;line-height:18px;padding:1px 9px;border-radius:999px;border:1px solid var(--mb-border);background:var(--mb-soft);color:var(--mb-text);white-space:nowrap}
.mbrfa-pill[data-tone=ok]{background:color-mix(in srgb,#16a34a 12%,var(--mb-surface));border-color:color-mix(in srgb,#16a34a 35%,var(--mb-surface));color:#166534}
.mbrfa-pill[data-tone=warn]{background:color-mix(in srgb,#d97706 14%,var(--mb-surface));border-color:color-mix(in srgb,#d97706 35%,var(--mb-surface));color:#92400e}
.mbrfa-pill[data-tone=bad]{background:color-mix(in srgb,var(--mb-danger) 10%,var(--mb-surface));border-color:color-mix(in srgb,var(--mb-danger) 35%,var(--mb-surface));color:var(--mb-danger)}
.mbrfa-pill[data-tone=accent]{background:color-mix(in srgb,var(--mb-accent) 10%,var(--mb-surface));border-color:color-mix(in srgb,var(--mb-accent) 30%,var(--mb-surface));color:var(--mb-accent)}
.mbrfa-pill[data-tone=mono]{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:400}
.mbrfa-simple .mbrfa-detail-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px}
.mbrfa-simple .mbrfa-detail-tabs button{min-height:34px;padding:6px 12px;font-size:13px}
.mbrfa-sheet{border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);min-width:0;overflow:hidden}
.mbrfa-sheet .mbrfa-table-scroll{overflow-x:auto}.mbrfa-treatment-table{min-width:640px}
.mbrfa-sheet>header{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:42px;padding:8px 14px;border-bottom:1px solid var(--mb-border)}
.mbrfa-sheet>header h3{display:flex;align-items:center;gap:8px;font-size:13px!important;font-weight:600!important}
.mbrfa-sheet section[aria-label="Saved RFA packets"]>h3{display:none}.mbrfa-sheet section[aria-label="Saved RFA packets"]>p:first-of-type{margin-top:0}
.mbrfa-simple .mbrfa-history-table th{background:none;border-bottom:1px solid var(--mb-border);padding:9px 14px}.mbrfa-simple .mbrfa-history-table td{padding:12px 14px}.mbrfa-simple .mbrfa-history-table td details>summary{cursor:pointer;color:var(--mb-accent)}
.mbrfa-count{line-height:20px;display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:var(--mb-soft);font-size:11px;font-weight:600;color:var(--mb-muted)}
.mbrfa-sheet-action{display:flex;gap:8px;align-items:center}
.mbrfa-sheet-action button,.mbrfa-sheet-action label.mbrfa-button{min-height:30px!important;padding:4px 10px!important;font-size:12px!important;font-weight:500}
.mbrfa-sheet-body{padding:12px 14px}.mbrfa-sheet-body>p:first-child{margin-top:0}.mbrfa-sheet-body>:last-child{margin-bottom:0}
.mbrfa-cards-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:stretch}
.mbrfa-facts{display:grid;gap:7px;margin:0}
.mbrfa-facts>div{display:grid;grid-template-columns:132px minmax(0,1fr);gap:12px;align-items:baseline}
.mbrfa-facts dt{font-size:11px;color:var(--mb-muted)}
.mbrfa-facts dd{margin:0;font-size:13px;overflow-wrap:anywhere;white-space:pre-wrap}
.mbrfa-empty{margin:0!important;color:var(--mb-muted)}
.mbrfa-grid-table{width:100%;border-collapse:collapse;text-align:left;font-size:13px}
.mbrfa-grid-table th{padding:9px 14px;font-size:12px;font-weight:500;color:var(--mb-muted);border-bottom:1px solid var(--mb-border);white-space:nowrap}
.mbrfa-grid-table td{padding:12px 14px;border-top:1px solid var(--mb-border);vertical-align:top}
.mbrfa-grid-table tbody tr:first-child td{border-top:0}
.mbrfa-grid-table td>input[type=checkbox]{width:16px;height:16px;min-height:16px;padding:0;margin:2px 0 0;accent-color:var(--mb-accent)}
.mbrfa-grid-table td:has(>.mbrfa-text-link),.mbrfa-grid-table td:has(>input[type=checkbox]){vertical-align:middle}
.mbrfa-sheet-body>.mbrfa-stack>fieldset{border:0;padding:0;background:none}
.mbrfa-sheet-body>.mbrfa-stack>fieldset>legend{padding:0;margin-bottom:8px;font-weight:600}
.mbrfa-sheet-body>.mbrfa-stack>fieldset+fieldset{padding-top:16px;border-top:1px solid var(--mb-border);border-radius:0}
.mbrfa-grid-table td small{display:block;margin-top:2px;font-size:12px;color:var(--mb-muted)}
.mbrfa-grid-table .mbrfa-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600}
.mbrfa-grid-table .mbrfa-row-actions{text-align:right;white-space:nowrap}
.mbrfa-grid-table .mbrfa-row-actions button{min-height:30px;padding:4px 10px;font-size:12px}
.mbrfa-grid-table tr.mbrfa-subrow td{border-top:0;padding-top:0}
.mbrfa-manage{display:grid;gap:8px;padding:10px 12px;border-radius:var(--mb-control-radius);background:var(--mb-soft)}
.mbrfa-manage p{margin:0!important}.mbrfa-manage h4{font-size:12px!important;font-weight:600}
.mbrfa-manage details>summary,.mbrfa-rows>details>summary{cursor:pointer;font-weight:500;color:var(--mb-accent)}
.mbrfa-rows{display:grid}
.mbrfa-rows>*{padding:11px 14px;border-top:1px solid var(--mb-border);margin:0!important}
.mbrfa-rows>:first-child{border-top:0}
.mbrfa-rows>details>summary{font-size:13px}
.mbrfa-rows>details[open]>summary{margin-bottom:12px}
.mbrfa-rows>details>summary{color:var(--mb-text)}
.mbrfa-simple .mbrfa-bottom-actions{position:sticky;bottom:12px;padding:10px 14px;box-shadow:0 4px 16px #0000000f}
.mbrfa-simple .mbrfa-bottom-actions>.mbrfa-pill{display:inline-flex}
.mbrfa-simple .mbrfa-bottom-actions .mbtd-actions{margin-top:0}
.mbrfa-simple .mbrfa-bottom-actions button{min-height:34px;padding:6px 14px;font-size:13px;font-weight:500}
.mbrfa-simple fieldset{padding:14px;border-radius:var(--mb-control-radius)}
.mbrfa-simple fieldset legend{font-size:13px}
.mbrfa-file-button{position:relative;display:inline-flex;align-items:center;cursor:pointer;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);min-height:30px;padding:4px 10px;font-size:12px!important;font-weight:500}
.mbrfa-file-button input{position:absolute;inset:0;opacity:0;cursor:pointer;min-height:0!important;padding:0!important}
.mbrfa-file-button:focus-within{outline:2px solid var(--mb-accent);outline-offset:2px}
@media(max-width:760px){.mbrfa-cards-2{grid-template-columns:minmax(0,1fr)}.mbrfa-facts>div{grid-template-columns:104px minmax(0,1fr)}.mbrfa-status li>strong{font-size:11px}.mbrfa-simple .mbrfa-bottom-actions{position:static}.mbrfa-status-heading{flex-direction:column;gap:8px}.mbrfa-status-due{text-align:left}}
`;
