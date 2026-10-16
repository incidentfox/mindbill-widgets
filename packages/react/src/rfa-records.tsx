"use client";
import { rfaPacificDate } from "./rfa-decision-due";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactElement, type ReactNode } from "react";
import {
  createRfaRecordsClient,
  type BillUrDecision,
  type BillUrDecisionsAttachInput,
  type BillUrDecisionsAttachResult,
  type BillUrDecisionsResult,
  type ClaimRfaSummary,
  type LinkedRfaEvidence,
  type OrganizationClientOptions,
  type RelatedAuthorizationRecord,
  type RelatedAuthorizationResult,
  type RfaEvidenceState,
} from "@mindbill/browser";
import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";
import { Checkbox } from "./form-controls";

type Appearance = { appearance?: MindBillReactAppearance; className?: string; style?: CSSProperties };

/** Short, stable display reference for an `rfa_<id>` identifier. */
export function rfaReference(id: string): string {
  return id.replace(/^rfa_/, "").slice(0, 8).toUpperCase();
}

const css = `
.mbrr{font-family:var(--mb-font,inherit);color:var(--mb-text,#1f2937);font-size:14px}
.mbrr *{box-sizing:border-box}
.mbrr-card{border:1px solid var(--mb-border,#e5e7eb);border-radius:var(--mb-radius,8px);background:var(--mb-surface,#fff);box-shadow:var(--mb-shadow,none)}
.mbrr-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;border-bottom:1px solid var(--mb-border,#e5e7eb)}
.mbrr-head h2{margin:0;font-size:14px;font-weight:600}
.mbrr-pad{padding:14px}
.mbrr-pad>.mbrr-head{padding:0 0 4px;border-bottom:0}
.mbrr-muted{color:var(--mb-muted,#6b7280)}
.mbrr-small{font-size:12px}
.mbrr-empty{padding:24px 14px;text-align:center;color:var(--mb-muted,#6b7280);margin:0}
.mbrr-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.mbrr-button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:0 12px;border-radius:var(--mb-control-radius,6px);border:1px solid var(--mb-border,#d1d5db);background:var(--mb-surface,#fff);color:var(--mb-text,#111827);font:inherit;font-size:13px;font-weight:500;text-decoration:none;cursor:pointer;white-space:nowrap}
.mbrr-button[data-primary=true]{background:var(--mb-accent,#245d5b);border-color:var(--mb-accent,#245d5b);color:var(--mb-accent-contrast,#fff)}
.mbrr-button:disabled{opacity:.55;cursor:not-allowed}
.mbrr-link{color:var(--mb-accent,#245d5b);text-decoration:none;background:none;border:0;padding:0;font:inherit;cursor:pointer}
.mbrr-link:hover{text-decoration:underline}
.mbrr-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.mbrr-counts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;padding:12px 14px;border-bottom:1px solid var(--mb-border,#e5e7eb)}
.mbrr-count span{display:block;font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--mb-muted,#6b7280)}
.mbrr-count strong{display:block;font-size:18px;font-weight:600;font-variant-numeric:tabular-nums}
.mbrr-count[data-zero=true] strong{color:var(--mb-muted,#6b7280)}
.mbrr-count[data-tone=warn] strong{color:var(--mb-warning,#8a5c17)}
.mbrr-count[data-tone=ok] strong{color:var(--mb-success,#217449)}
.mbrr-count[data-tone=bad] strong{color:var(--mb-danger,#b63d35)}
.mbrr-tabs{display:flex;gap:4px;padding:8px 14px 0;border-bottom:1px solid var(--mb-border,#e5e7eb);overflow-x:auto}
.mbrr-tab{margin-bottom:-1px;border:0;border-bottom:2px solid transparent;background:none;padding:6px 12px;font:inherit;font-size:14px;color:var(--mb-muted,#6b7280);cursor:pointer;white-space:nowrap}
.mbrr-tab[aria-selected=true]{border-bottom-color:var(--mb-accent,#245d5b);color:var(--mb-text,#111827);font-weight:500}
.mbrr-scroll{overflow-x:auto}
.mbrr-table{width:100%;border-collapse:collapse;font-size:14px}
.mbrr-table th{padding:8px 12px;text-align:left;font-size:12px;font-weight:500;color:var(--mb-muted,#6b7280);white-space:nowrap;border-bottom:1px solid var(--mb-border,#e5e7eb)}
.mbrr-table td{padding:8px 12px;vertical-align:top;border-bottom:1px solid var(--mb-border,#e5e7eb)}
.mbrr-table tbody tr:last-child td{border-bottom:0}
.mbrr-table tr[data-clickable=true]{cursor:pointer}
.mbrr-table tr[data-clickable=true]:hover td{background:var(--mb-soft,#f9fafb)}
.mbrr-table[data-min=decisions]{min-width:680px}
.mbrr-nowrap{white-space:nowrap}
.mbrr-clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:18rem}
.mbrr-sort{display:inline-flex;align-items:center;gap:4px;border:0;background:none;padding:0;font:inherit;color:inherit;cursor:pointer}
.mbrr-sort:hover{color:var(--mb-text,#111827)}
.mbrr-sort svg{opacity:.45}.mbrr-sort[data-active=true] svg{opacity:1}
.mbrr-pill{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:500;line-height:18px;padding:0 8px;border-radius:999px;border:1px solid var(--mb-border,#e5e7eb);background:var(--mb-soft,#f3f4f6);white-space:nowrap;text-transform:none}
.mbrr-pill[data-tone=ok]{background:color-mix(in srgb,#16a34a 12%,var(--mb-surface,#fff));border-color:color-mix(in srgb,#16a34a 35%,var(--mb-surface,#fff));color:#166534}
.mbrr-pill[data-tone=warn]{background:color-mix(in srgb,#d97706 14%,var(--mb-surface,#fff));border-color:color-mix(in srgb,#d97706 35%,var(--mb-surface,#fff));color:#92400e}
.mbrr-pill[data-tone=bad]{background:color-mix(in srgb,var(--mb-danger,#b63d35) 10%,var(--mb-surface,#fff));border-color:color-mix(in srgb,var(--mb-danger,#b63d35) 35%,var(--mb-surface,#fff));color:var(--mb-danger,#b63d35)}
.mbrr-pill[data-tone=accent]{background:color-mix(in srgb,var(--mb-accent,#245d5b) 10%,var(--mb-surface,#fff));border-color:color-mix(in srgb,var(--mb-accent,#245d5b) 30%,var(--mb-surface,#fff));color:var(--mb-accent,#245d5b)}
.mbrr-list{list-style:none;margin:8px 0 0;padding:0}
.mbrr-list li+li{border-top:1px solid var(--mb-border,#e5e7eb)}
.mbrr-row{display:flex;align-items:center;gap:12px;padding:10px 8px;border-radius:var(--mb-control-radius,6px);color:inherit;text-decoration:none}
a.mbrr-row:hover,button.mbrr-row:hover{background:var(--mb-soft,#f3f4f6)}
button.mbrr-row{width:100%;border:0;background:none;font:inherit;text-align:left;cursor:pointer}
.mbrr-row-main{min-width:0;flex:1}
.mbrr-row-main strong{display:block;font-size:14px;font-weight:500}
.mbrr-row-main span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mb-muted,#6b7280)}
.mbrr-details{margin-top:12px;border-top:1px solid var(--mb-border,#e5e7eb);padding-top:12px}
.mbrr-details summary{cursor:pointer;color:var(--mb-muted,#6b7280)}
.mbrr-linked{list-style:none;margin:12px 0 0;padding:0;border:1px solid var(--mb-border,#e5e7eb);border-radius:var(--mb-control-radius,6px)}
.mbrr-linked li{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:8px;padding:10px 12px}
.mbrr-linked li+li{border-top:1px solid var(--mb-border,#e5e7eb)}
.mbrr-chips{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.mbrr-check{width:16px;height:16px;accent-color:var(--mb-accent,#245d5b);margin:2px 0 0}
.mbrr-notice{margin:8px 0 0;font-size:13px}
.mbrr-notice[data-tone=bad]{color:var(--mb-danger,#b63d35)}
.mbrr-notice[data-tone=ok]{color:var(--mb-success,#217449)}
@media (max-width:640px){.mbrr-counts{grid-template-columns:repeat(3,minmax(0,1fr))}.mbrr-linked li{flex-direction:column}}
`;

function Shell({ appearance, className = "", style, label, id, children }: Appearance & { label: string; id?: string; children: ReactNode }): ReactElement {
  return <section id={id} aria-label={label} className={`mbrr ${className}`.trim()} style={{ ...mindBillAppearanceStyle(appearance), ...style }}>
    <style>{css}</style>{children}
  </section>;
}

const shortDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
};

const isPlainClick = (event: MouseEvent) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/* ------------------------------------------------------------------ RfaClaimIndex */

const LIFECYCLE_LABELS: Record<string, string> = { incomplete: "Incomplete", sent: "Sent", failed: "Failed", received: "Received", closed: "Closed", canceled: "Canceled" };
const OUTCOME_LABELS: Record<string, string> = { pending: "No response", approved: "Approved", modified: "Modified", denied: "Denied" };
const UNSENT = new Set(["draft", "ready"]);
type Tone = "ok" | "warn" | "bad" | "accent" | "muted";

/** The request's lifecycle label (daisyBill-style: Incomplete, Sent, Failed, Received, Closed, Canceled). */
export function claimRfaLifecycle(rfa: Pick<ClaimRfaSummary, "lifecycleStatus" | "status" | "submittedAt">): { key: string; label: string } {
  const key = LIFECYCLE_LABELS[rfa.lifecycleStatus] ? rfa.lifecycleStatus
    : rfa.status === "canceled" ? "canceled" : UNSENT.has(rfa.status) ? "incomplete"
    : ["approved", "modified", "denied", "mixed", "closed"].includes(rfa.status) ? "closed"
    : rfa.submittedAt ? "sent" : "incomplete";
  return { key, label: LIFECYCLE_LABELS[key] ?? key };
}
const lifecycleTone = (key: string): Tone => key === "failed" ? "bad" : key === "incomplete" ? "warn" : key === "sent" || key === "received" ? "accent" : "muted";
const outcomeTone = (outcome: string): Tone => outcome === "approved" ? "ok" : outcome === "modified" ? "warn" : outcome === "denied" ? "bad" : "muted";

/** Treatment counts for the claim summary: unsent requests count once as incomplete; canceled requests are left out. */
export function claimRfaCounts(rfas: readonly ClaimRfaSummary[]): { drafts: number; noResponse: number; approved: number; modified: number; denied: number } {
  const result = { drafts: 0, noResponse: 0, approved: 0, modified: 0, denied: 0 };
  for (const rfa of rfas) {
    if (UNSENT.has(rfa.status)) { result.drafts++; continue; }
    if (rfa.status === "canceled") continue;
    for (const item of rfa.items) {
      if (item.outcome === "approved") result.approved++;
      else if (item.outcome === "modified") result.modified++;
      else if (item.outcome === "denied") result.denied++;
      else if (!item.notRequired) result.noResponse++;
    }
  }
  return result;
}

type RfaSortKey = "reference" | "sent" | "physician" | "status" | "due" | "decided";
type TreatmentSortKey = "reference" | "physician" | "service" | "code" | "sent" | "due" | "decided" | "outcome" | "auth";
type Sort<K> = { key: K; desc: boolean };
const DATE_KEYS = new Set(["sent", "due", "decided"]);
// Blank values (not sent, no decision yet) stay at the bottom in either direction.
const compareValues = (a: string, b: string, desc: boolean) => (!a || !b) ? (a ? -1 : b ? 1 : 0) : a.localeCompare(b, undefined, { numeric: true }) * (desc ? -1 : 1);
const newestFirst = (a: ClaimRfaSummary, b: ClaimRfaSummary) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "");

function SortHeader({ label, active, desc, onClick }: { label: string; active: boolean; desc: boolean; onClick: () => void }): ReactElement {
  return <button type="button" className="mbrr-sort" data-active={active} onClick={onClick}>{label}
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {active ? (desc ? <path d="M12 5v14M19 12l-7 7-7-7" /> : <path d="M12 19V5M5 12l7-7 7 7" />) : <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />}
    </svg></button>;
}

export type RfaClaimIndexProps = OrganizationClientOptions & Appearance & {
  claimId: string;
  /** Shows the "Add RFA" action. Server authorization remains authoritative. */
  canCreate?: boolean;
  /** Host-supplied loader; defaults to `GET /partner/v2/rfas?claimId=` through a browser session. */
  loadRfas?: (claimId: string) => Promise<ClaimRfaSummary[]>;
  /** Initial rows the host already loaded; refreshed after mount unless `loadRfas`/client fails. */
  initialRfas?: ClaimRfaSummary[];
  /** Link target for a request; `treatmentId` is set from the treatments tab. */
  getRfaHref?: (rfaId: string, context?: { treatmentId?: string }) => string;
  /** Called for a plain click on a row or reference instead of following the link. */
  onSelectRfa?: (rfaId: string, context?: { treatmentId?: string }) => void;
  createHref?: string;
  onCreateRfa?: () => void;
  getPhysicianHref?: (renderingProviderId: string) => string | undefined;
  /** Section element id, for deep links such as `#rfas`. */
  id?: string;
};

/** Every request for authorization on one claim, with a treatment summary and a requested-treatments view. */
export function RfaClaimIndex({ claimId, canCreate = false, loadRfas, initialRfas, getRfaHref, onSelectRfa, createHref, onCreateRfa, getPhysicianHref, id = "rfas",
  sessionEndpoint, getSession, apiBaseUrl, fetch: fetchOverride, ...appearance }: RfaClaimIndexProps): ReactElement {
  const client = useMemo(() => loadRfas ? null : createRfaRecordsClient({ ...(sessionEndpoint ? { sessionEndpoint } : {}), ...(getSession ? { getSession } : {}), ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}) }),
    [loadRfas, sessionEndpoint, getSession, apiBaseUrl, fetchOverride]);
  const [rfas, setRfas] = useState<ClaimRfaSummary[] | null>(initialRfas ?? null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<"rfas" | "treatments">("rfas");
  const [sort, setSort] = useState<Sort<RfaSortKey> | null>(null);
  const [treatmentSort, setTreatmentSort] = useState<Sort<TreatmentSortKey> | null>(null);
  useEffect(() => {
    let active = true;
    if (!initialRfas) setRfas(null);
    setFailed(false);
    const load = loadRfas ?? ((value: string) => client!.listClaimRfas(value));
    load(claimId).then(value => { if (active) setRfas(value); }).catch(() => { if (active && !initialRfas) setFailed(true); });
    return () => { active = false; };
  }, [claimId, loadRfas, client, initialRfas]);

  const counts = useMemo(() => claimRfaCounts(rfas ?? []), [rfas]);
  const sortedRfas = useMemo(() => {
    const rows = [...(rfas ?? [])].sort(newestFirst);
    if (!sort) return rows;
    const value = (rfa: ClaimRfaSummary) => sort.key === "reference" ? rfaReference(rfa.id) : sort.key === "sent" ? rfa.submittedAt ?? ""
      : sort.key === "physician" ? rfa.providerName : sort.key === "due" ? rfa.decisionDueAt ?? "" : sort.key === "decided" ? rfa.decidedAt ?? "" : claimRfaLifecycle(rfa).label;
    return rows.sort((a, b) => compareValues(value(a), value(b), sort.desc));
  }, [rfas, sort]);
  // Requested treatments keep request order (newest first) then service order, like the request itself.
  const treatments = useMemo(() => {
    const rows = [...(rfas ?? [])].sort(newestFirst).flatMap(rfa => rfa.items.map((item, index) => {
      const unsent = UNSENT.has(rfa.status) || rfa.status === "canceled";
      return { rfa, item, unsent, reference: `${rfaReference(rfa.id)}-${index + 1}`,
        decision: unsent ? (rfa.status === "canceled" ? "Canceled" : "Not sent") : item.notRequired ? "Not required" : OUTCOME_LABELS[item.outcome] ?? item.outcome };
    }));
    if (!treatmentSort) return rows;
    const value = (row: (typeof rows)[number]) => treatmentSort.key === "reference" ? row.reference : treatmentSort.key === "physician" ? row.rfa.providerName
      : treatmentSort.key === "service" ? row.item.serviceDescription : treatmentSort.key === "code" ? row.item.procedureCode ?? ""
      : treatmentSort.key === "sent" ? row.rfa.submittedAt ?? "" : treatmentSort.key === "due" ? row.rfa.decisionDueAt ?? ""
      : treatmentSort.key === "decided" ? row.item.decidedAt ?? "" : treatmentSort.key === "auth" ? row.item.authorizationNumber ?? "" : row.decision;
    return rows.sort((a, b) => compareValues(value(a), value(b), treatmentSort.desc));
  }, [rfas, treatmentSort]);

  const clickable = Boolean(onSelectRfa || getRfaHref);
  const open = (rfaId: string, context?: { treatmentId?: string }) => (event: MouseEvent<HTMLTableRowElement>) => {
    if ((event.target as HTMLElement).closest("a,button") || globalThis.getSelection?.()?.toString()) return;
    if (onSelectRfa && isPlainClick(event)) { onSelectRfa(rfaId, context); return; }
    const href = getRfaHref?.(rfaId, context);
    if (!href) return;
    if (event.metaKey || event.ctrlKey) globalThis.open?.(href, "_blank", "noopener");
    else globalThis.location?.assign(href);
  };
  const reference = (rfaId: string, label: string, context?: { treatmentId?: string }) => {
    const href = getRfaHref?.(rfaId, context);
    if (!href && !onSelectRfa) return <span className="mbrr-mono">{label}</span>;
    if (!href) return <button type="button" className="mbrr-link mbrr-mono" onClick={() => onSelectRfa?.(rfaId, context)}>{label}</button>;
    return <a className="mbrr-link mbrr-mono" href={href} onClick={event => { if (onSelectRfa && isPlainClick(event)) { event.preventDefault(); onSelectRfa(rfaId, context); } }}>{label}</a>;
  };
  const physician = (rfa: ClaimRfaSummary) => {
    const href = rfa.renderingProviderId ? getPhysicianHref?.(rfa.renderingProviderId) : undefined;
    return href ? <a className="mbrr-link" href={href}>{rfa.providerName}</a> : <>{rfa.providerName}</>;
  };
  const header = (key: RfaSortKey, label: string) => <SortHeader label={label} active={sort?.key === key} desc={sort?.desc ?? false}
    onClick={() => setSort(current => ({ key, desc: current?.key === key ? !current.desc : DATE_KEYS.has(key) }))} />;
  const treatmentHeader = (key: TreatmentSortKey, label: string) => <SortHeader label={label} active={treatmentSort?.key === key} desc={treatmentSort?.desc ?? false}
    onClick={() => setTreatmentSort(current => ({ key, desc: current?.key === key ? !current.desc : DATE_KEYS.has(key) }))} />;
  const add = canCreate && (createHref || onCreateRfa)
    ? createHref ? <a className="mbrr-button" data-primary="true" href={createHref} onClick={event => { if (onCreateRfa && isPlainClick(event)) { event.preventDefault(); onCreateRfa(); } }}>+ Add RFA</a>
      : <button type="button" className="mbrr-button" data-primary="true" onClick={onCreateRfa}>+ Add RFA</button>
    : null;
  const count = (label: string, value: number, tone?: Tone) => <div className="mbrr-count" data-zero={value === 0} data-tone={tone}><span>{label}</span><strong>{value}</strong></div>;

  return <Shell {...appearance} id={id} label="Requests for Authorization"><div className="mbrr-card">
    <div className="mbrr-head"><h2>Requests for Authorization{rfas ? ` (${rfas.length})` : ""}</h2>{add}</div>
    {failed ? <p className="mbrr-empty" role="status">Requests for authorization could not be loaded. Refresh to try again.</p>
      : !rfas ? <p className="mbrr-empty" role="status">Loading requests for authorization…</p>
      : rfas.length === 0 ? <p className="mbrr-empty">No RFAs on this claim yet.{add ? " Click \"Add RFA\" to request treatment authorization." : ""}</p>
      : <>
        <div className="mbrr-counts">
          {count("Incomplete", counts.drafts)}{count("No response", counts.noResponse, "warn")}{count("Approved", counts.approved, "ok")}
          {count("Modified", counts.modified)}{count("Denied", counts.denied, "bad")}
        </div>
        <div className="mbrr-tabs" role="tablist" aria-label="RFA views">
          <button type="button" role="tab" className="mbrr-tab" aria-selected={tab === "rfas"} onClick={() => setTab("rfas")}>RFAs ({rfas.length})</button>
          <button type="button" role="tab" className="mbrr-tab" aria-selected={tab === "treatments"} onClick={() => setTab("treatments")}>Requested treatments ({treatments.length})</button>
        </div>
        <div className="mbrr-scroll">{tab === "rfas" ? <table className="mbrr-table">
          <thead><tr>
            <th>{header("reference", "RFA ID")}</th><th>{header("physician", "Requesting physician")}</th><th>Requested treatment</th>
            <th>{header("sent", "RFA sent")}</th><th>{header("due", "Decision due")}</th><th>{header("decided", "Decision date")}</th><th>{header("status", "Status")}</th>
          </tr></thead>
          <tbody>{sortedRfas.map(rfa => { const lifecycle = claimRfaLifecycle(rfa); return <tr key={rfa.id} data-clickable={clickable} onClick={open(rfa.id)}>
            <td className="mbrr-nowrap">{reference(rfa.id, rfaReference(rfa.id))}{rfa.expedited ? <> <span className="mbrr-pill">Expedited</span></> : null}</td>
            <td>{physician(rfa)}</td>
            <td><span className="mbrr-clamp">{rfa.items.map(item => item.serviceDescription).join(" · ") || "—"}</span></td>
            <td className="mbrr-nowrap">{shortDate(rfa.submittedAt)}</td><td className="mbrr-nowrap">{rfaPacificDate(rfa.decisionDueAt) || "—"}</td><td className="mbrr-nowrap">{shortDate(rfa.decidedAt)}</td>
            <td><span className="mbrr-pill" data-tone={lifecycleTone(lifecycle.key)}>{lifecycle.label}</span></td>
          </tr>; })}</tbody>
        </table> : <table className="mbrr-table">
          <thead><tr>
            <th>{treatmentHeader("reference", "RFA ID")}</th><th>{treatmentHeader("physician", "Requesting physician")}</th><th>{treatmentHeader("service", "Service / good")}</th>
            <th>{treatmentHeader("code", "CPT/HCPCS")}</th><th>Quantity / frequency / duration</th><th>{treatmentHeader("sent", "RFA sent")}</th>
            <th>{treatmentHeader("due", "Decision due")}</th><th>{treatmentHeader("decided", "Decision date")}</th><th>{treatmentHeader("outcome", "Decision")}</th><th>{treatmentHeader("auth", "Auth #")}</th>
          </tr></thead>
          <tbody>{treatments.map(({ rfa, item, unsent, reference: label, decision }) => <tr key={item.id} data-clickable={clickable} onClick={open(rfa.id, { treatmentId: item.id })}>
            <td className="mbrr-nowrap">{reference(rfa.id, label, { treatmentId: item.id })}</td>
            <td>{physician(rfa)}</td>
            <td style={{ minWidth: "12rem" }}>{item.serviceDescription}{item.diagnosisCode ? <div className="mbrr-mono mbrr-small mbrr-muted">ICD-10 {item.diagnosisCode}</div> : null}</td>
            <td className="mbrr-mono">{item.procedureCode ?? "—"}</td>
            <td>{[item.quantity, item.frequency, item.duration].filter(part => part != null && part !== "").join(" · ") || "—"}</td>
            <td className="mbrr-nowrap">{shortDate(rfa.submittedAt)}</td><td className="mbrr-nowrap">{rfaPacificDate(rfa.decisionDueAt) || "—"}</td><td className="mbrr-nowrap">{shortDate(item.decidedAt)}</td>
            <td><span className="mbrr-pill" data-tone={unsent || item.notRequired ? "muted" : outcomeTone(item.outcome)}>{decision}</span></td>
            <td className="mbrr-mono mbrr-nowrap">{item.authorizationNumber ?? "—"}</td>
          </tr>)}</tbody>
        </table>}</div>
      </>}
  </div></Shell>;
}

/* ------------------------------------------------------- RelatedAuthorizationRecords */

export type RelatedAuthorizationRecordsProps = OrganizationClientOptions & Appearance & ({ rfaId: string; billId?: never } | { billId: string; rfaId?: never }) & {
  /** Host-supplied loader; defaults to `GET /partner/v2/rfas/related` through a browser session. */
  load?: (query: { rfaId: string } | { billId: string }) => Promise<RelatedAuthorizationResult>;
  /** Result the host already loaded (e.g. with the page); no request is made. */
  initial?: RelatedAuthorizationResult;
  getBillHref?: (billId: string) => string | undefined;
  getRfaHref?: (rfaId: string) => string | undefined;
  onSelectBill?: (billId: string) => void;
  onSelectRfa?: (rfaId: string) => void;
  getClaimHref?: (claimId: string) => string | undefined;
  /** Extra claim-level actions, such as a case file export, shown beside "View claim". */
  renderClaimActions?: (claimId: string) => ReactNode;
};

/** Bills related to an RFA (`rfaId`), or authorizations related to a bill (`billId`), on the same claim. Linked records first. */
export function RelatedAuthorizationRecords({ rfaId, billId, load, initial, getBillHref, getRfaHref, onSelectBill, onSelectRfa, getClaimHref, renderClaimActions,
  sessionEndpoint, getSession, apiBaseUrl, fetch: fetchOverride, ...appearance }: RelatedAuthorizationRecordsProps): ReactElement | null {
  const client = useMemo(() => load ? null : createRfaRecordsClient({ ...(sessionEndpoint ? { sessionEndpoint } : {}), ...(getSession ? { getSession } : {}), ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}) }),
    [load, sessionEndpoint, getSession, apiBaseUrl, fetchOverride]);
  const [result, setResult] = useState<RelatedAuthorizationResult | null>(initial ?? null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (initial) { setResult(initial); return; }
    let active = true;
    setResult(null); setUnavailable(false);
    const query = rfaId ? { rfaId } : { billId: billId ?? "" };
    (load ? load(query) : client!.listRelated(query)).then(value => { if (active) setResult(value); }).catch(() => { if (active) setUnavailable(true); });
    return () => { active = false; };
  }, [rfaId, billId, initial, load, client]);
  const title = rfaId ? "Related bills" : "Related authorizations";
  if (unavailable) return <Shell {...appearance} label={title}><p className="mbrr-muted" role="status">{title} could not be loaded. Refresh to try again.</p></Shell>;
  if (!result) return rfaId ? null : <Shell {...appearance} label={title}><p className="mbrr-muted" role="status">Loading {title.toLowerCase()}…</p></Shell>;
  // On a request page an empty list is just noise above the request.
  if (rfaId && !result.data.length) return null;
  const linked = result.data.filter(record => record.relationship === "Linked authorization");
  const sameInjury = result.data.filter(record => record.relationship !== "Linked authorization");
  const noun = rfaId ? "bills" : "authorizations";
  const row = (record: RelatedAuthorizationRecord) => {
    const href = rfaId ? getBillHref?.(record.id) : getRfaHref?.(record.id);
    const select = rfaId ? onSelectBill : onSelectRfa;
    const content = <>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="mbrr-muted"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>
      <span className="mbrr-row-main"><strong>{record.label}{record.serviceDate ? <span style={{ display: "inline", marginLeft: 8, fontWeight: 400 }} className="mbrr-muted">{record.serviceDate}</span> : null}</strong>
        <span>{record.treatments.join(" · ")}</span></span>
      {record.status ? <span className="mbrr-pill" style={{ textTransform: "capitalize" }}>{record.status.replaceAll("_", " ")}</span> : null}
    </>;
    if (href) return <a className="mbrr-row" href={href} onClick={event => { if (select && isPlainClick(event)) { event.preventDefault(); select(record.id); } }}>{content}</a>;
    if (select) return <button type="button" className="mbrr-row" onClick={() => select(record.id)}>{content}</button>;
    return <div className="mbrr-row">{content}</div>;
  };
  const rows = (records: RelatedAuthorizationRecord[]) => <ul className="mbrr-list">{records.map(record => <li key={record.id}>{row(record)}</li>)}</ul>;
  const claimHref = getClaimHref?.(result.claimId);
  return <Shell {...appearance} label={title}><div className="mbrr-card mbrr-pad">
    <div className="mbrr-head"><h2>{title}{linked.length > 0 ? ` (${linked.length})` : ""}</h2>
      <div className="mbrr-actions">{claimHref ? <a className="mbrr-link" href={claimHref}>View claim</a> : null}{renderClaimActions?.(result.claimId)}</div></div>
    {linked.length ? rows(linked) : <p className="mbrr-muted" style={{ margin: "8px 0 0" }}>No {noun} linked yet.</p>}
    {sameInjury.length > 0 ? <details className="mbrr-details"><summary>Other {noun} for this injury ({sameInjury.length})</summary>{rows(sameInjury)}</details> : null}
    {result.hasMore ? <p className="mbrr-muted" style={{ margin: "8px 0 0" }}>Showing the first 100 records. Open the claim to see more.</p> : null}
  </div></Shell>;
}

/* ------------------------------------------------------------------ BillUrDecisions */

const STATE_VIEW: Record<RfaEvidenceState, { label: string; tone: Tone }> = {
  attached: { label: "Attached", tone: "ok" },
  ready: { label: "Not attached yet", tone: "warn" },
  awaiting_decision: { label: "Awaiting decision", tone: "muted" },
  not_signed: { label: "RFA not signed", tone: "warn" },
  denied: { label: "Denied", tone: "bad" },
  unavailable: { label: "Needs attention", tone: "bad" },
  bill_sent: { label: "Not sent with bill", tone: "muted" },
};
const evidenceChip = (label: string, state: RfaEvidenceState) => {
  const view = STATE_VIEW[state] ?? { label: state, tone: "muted" as Tone };
  return <span className="mbrr-pill" data-tone={view.tone}>{label}: {view.label}</span>;
};

export type BillUrDecisionsProps = OrganizationClientOptions & Appearance & {
  billId: string;
  /** The user may change this bill's documents. Server authorization remains authoritative. */
  canEdit?: boolean;
  /** Host-supplied loader; defaults to `GET /partner/v2/bills/{billId}/ur-decisions`. */
  load?: (billId: string) => Promise<BillUrDecisionsResult | null>;
  /** Host-supplied attach; defaults to `POST /partner/v2/bills/{billId}/ur-decisions`. */
  attach?: (billId: string, input: BillUrDecisionsAttachInput) => Promise<BillUrDecisionsAttachResult>;
  /** Opens a decision letter. Defaults to fetching the RFA document through the browser session when no host loader is given. */
  openDocument?: (decision: BillUrDecision) => void | Promise<void>;
  getRfaHref?: (rfaId: string) => string | undefined;
  onSelectRfa?: (rfaId: string) => void;
  /** Called after documents were attached, for example to reload the bill's document list. */
  onAttached?: (result: BillUrDecisionsAttachResult, kind: "manual" | "linked") => void;
};

/**
 * Authorizations for a bill: the signed RFA and UR decision for every RFA linked to a service line, and every
 * other UR decision on the bill's patient and claim, which a biller may attach to the unsent bill.
 */
export function BillUrDecisions({ billId, canEdit = false, load, attach, openDocument, getRfaHref, onSelectRfa, onAttached,
  sessionEndpoint, getSession, apiBaseUrl, fetch: fetchOverride, ...appearance }: BillUrDecisionsProps): ReactElement | null {
  const client = useMemo(() => createRfaRecordsClient({ ...(sessionEndpoint ? { sessionEndpoint } : {}), ...(getSession ? { getSession } : {}), ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}) }),
    [sessionEndpoint, getSession, apiBaseUrl, fetchOverride]);
  const [result, setResult] = useState<BillUrDecisionsResult | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState<"manual" | "linked" | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    (load ? load(billId) : client.listBillUrDecisions(billId)).then(value => { if (active) setResult(value); })
      .catch(() => { /* The card is optional; the bill works without it. */ });
    return () => { active = false; };
  }, [billId, load, client, revision]);
  const post = async (input: BillUrDecisionsAttachInput, kind: "manual" | "linked") => {
    const current = ++generation.current;
    setBusy(kind); setNotice(null);
    try {
      const value = attach ? await attach(billId, input) : await client.attachBillUrDecisions(billId, input);
      if (current !== generation.current) return;
      if (value.attached > 0) {
        setSelected(new Set());
        setNotice({ tone: "ok", text: kind === "linked" ? "The signed RFA and UR decision were attached to this bill." : value.attached > 1 ? "Utilization review decisions attached." : "Utilization review decision attached." });
        onAttached?.(value, kind);
        setRevision(next => next + 1);
      } else if (value.linked) {
        setResult(existing => existing ? { ...existing, linked: value.linked! } : existing);
        setNotice({ tone: "bad", text: "The authorization documents could not be attached. The reason is shown on each line." });
      } else {
        setRevision(next => next + 1);
      }
    } catch (error) {
      const code = (error as { code?: string; message?: string } | null);
      setNotice({ tone: "bad", text: code?.code === "bill_already_sent" || code?.message === "bill_already_sent" ? "This bill was already sent, so its documents can no longer change." : "The documents could not be attached. Try again." });
    } finally { if (current === generation.current) setBusy(null); }
  };
  const letter = openDocument ?? (load ? undefined : async (decision: BillUrDecision) => {
    const blob = await client.getRfaDocument(decision.rfaId, decision.documentId);
    const url = URL.createObjectURL(blob);
    globalThis.open?.(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });
  if (!result || (!result.decisions.length && !result.linked.length)) return null;
  const selectable = result.editable && canEdit;
  const retryable = selectable && result.linked.some(entry => [entry.form.state, entry.decision.state].some(state => state === "ready" || state === "unavailable"));
  const description = !result.editable
    ? "This bill was already sent; the documents sent with it are listed under Documents."
    : result.linked.length
      ? "The signed RFA and UR decision for each authorization linked to a service line are attached automatically when the draft is saved and again when it is sent. Select any other decision to send it too."
      : "Select a decision to send it with this bill.";
  const rfaLink = (rfaId: string, label: string) => {
    const href = getRfaHref?.(rfaId);
    if (href) return <a className="mbrr-link" href={href} onClick={event => { if (onSelectRfa && isPlainClick(event)) { event.preventDefault(); onSelectRfa(rfaId); } }}>{label}</a>;
    return onSelectRfa ? <button type="button" className="mbrr-link" onClick={() => onSelectRfa(rfaId)}>{label}</button> : null;
  };
  return <Shell {...appearance} label="RFAs and UR decisions"><div className="mbrr-card mbrr-pad">
    <div className="mbrr-head"><h2>RFAs &amp; UR decisions ({Math.max(result.decisions.length, result.linked.length)})</h2>
      <div className="mbrr-actions">
        {retryable ? <button type="button" className="mbrr-button" style={{ width: 128 }} disabled={busy !== null} onClick={() => void post({ linked: true }, "linked")}>{busy === "linked" ? "Attaching…" : "Attach now"}</button> : null}
        {selectable && result.decisions.some(decision => !decision.attached) ? <button type="button" className="mbrr-button" style={{ width: 176 }} disabled={busy !== null || !selected.size}
          onClick={() => void post({ documentIds: [...selected] }, "manual")}>{busy === "manual" ? "Attaching…" : `Attach UR decision${selected.size > 1 ? "s" : ""}`}</button> : null}
      </div></div>
    <p className="mbrr-muted mbrr-small" style={{ margin: 0 }}>{description}</p>
    {notice ? <p className="mbrr-notice" data-tone={notice.tone} role={notice.tone === "bad" ? "alert" : "status"}>{notice.text}</p> : null}
    {result.linked.length > 0 ? <ul className="mbrr-linked" aria-label="Authorizations linked to service lines">{result.linked.map((entry: LinkedRfaEvidence) => {
      const problems = [entry.form, entry.decision].filter(slot => slot.message && slot.state !== "attached").map(slot => slot.message);
      return <li key={entry.rfaItemId}><div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500 }}>{entry.service}{entry.decision.authorizationNumber ? <span className="mbrr-muted" style={{ fontWeight: 400, marginLeft: 8 }}>Auth {entry.decision.authorizationNumber}</span> : null}</div>
        {problems.length ? <div className="mbrr-muted mbrr-small">{[...new Set(problems)].join(" ")}</div> : null}
      </div><div className="mbrr-chips">{evidenceChip("Signed RFA", entry.form.state)}{evidenceChip("UR decision", entry.decision.state)}{entry.rfaId ? rfaLink(entry.rfaId, "View RFA") : null}</div></li>;
    })}</ul> : null}
    {result.decisions.length > 0 ? <div className="mbrr-scroll" style={{ marginTop: 8 }}><table className="mbrr-table" data-min="decisions">
      <thead><tr><th style={{ width: 32 }} /><th>Requested treatment</th><th>Decision</th><th>Authorization</th><th>Decided</th><th>Request</th></tr></thead>
      <tbody>{result.decisions.map(decision => <tr key={decision.documentId}>
        <td>{decision.attached ? null : <Checkbox className="mbrr-check" aria-label={`Select the decision in ${decision.filename}`} disabled={!selectable || busy !== null}
          checked={selected.has(decision.documentId)} onChange={event => { const checked = event.target.checked; setSelected(current => { const next = new Set(current); if (checked) next.add(decision.documentId); else next.delete(decision.documentId); return next; }); }} />}</td>
        <td>{decision.treatments.map((treatment, index) => <div key={index}>{treatment.service}{treatment.code ? <span className="mbrr-muted" style={{ marginLeft: 4 }}>{treatment.code}</span> : null}</div>)}</td>
        <td>{decision.treatments.map((treatment, index) => <div key={index}><span className="mbrr-pill" data-tone={outcomeTone(treatment.outcome)} style={{ textTransform: "capitalize" }}>{treatment.outcome}</span></div>)}</td>
        <td>{decision.treatments.map((treatment, index) => <div key={index}>{treatment.authorizationNumber ?? "—"}{treatment.effectiveFrom ? <span className="mbrr-muted mbrr-small" style={{ marginLeft: 4 }}>{shortDate(treatment.effectiveFrom)}–{shortDate(treatment.effectiveTo)}</span> : null}</div>)}</td>
        <td className="mbrr-nowrap">{decision.decidedAt ? shortDate(decision.decidedAt) : "—"}</td>
        <td className="mbrr-nowrap"><span className="mbrr-actions">{rfaLink(decision.rfaId, "View")}{letter ? <button type="button" className="mbrr-link" onClick={() => void letter(decision)}>Letter</button> : null}
          {decision.attached ? <span className="mbrr-pill" data-tone="ok">Attached</span> : null}</span></td>
      </tr>)}</tbody>
    </table></div> : null}
  </div></Shell>;
}
