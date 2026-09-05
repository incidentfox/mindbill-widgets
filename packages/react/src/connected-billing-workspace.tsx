"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
  type ReactElement,
  type ReactNode,
} from "react";
import type { BillTasksDashboardCell } from "./bill-tasks-dashboard";
import { BillTasksDashboard } from "./bill-tasks-dashboard";
import { ConnectedBillLifecycle } from "./connected-bill-lifecycle";
import { ConnectedPaymentReview } from "./payment-review";
import type { CourtesyCopyRecipientOption } from "./bill-courtesy-copy-form";
import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";
import {
  createBillingOperationsClient,
  type BillingOperationsClientOptions,
  type BillRegistryAge,
  type BillRegistryItem,
  type BillRegistryQuery,
  type BillRegistryResult,
  type BillTasksResult,
  type ProductivityReport,
  type ServiceLineItemsReport,
} from "./billing-operations-client";

type ConnectedSurfaceProps = BillingOperationsClientOptions & {
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
};

const css = `
.mbow-select{max-width:100%}
.mbow{color:var(--mb-text);font:14px/1.45 var(--mb-font);background:var(--mb-soft);border-radius:var(--mb-radius);padding:20px}.mbow,.mbow *{box-sizing:border-box}.mbow h2,.mbow h3,.mbow p{margin:0}.mbow a{color:var(--mb-accent)}
.mbow-workspace{width:100%;height:100%;max-height:var(--mbow-available-height,100dvh);min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
.mbow-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}.mbow-head h2{font-size:24px;line-height:1.2}.mbow-sub{color:var(--mb-muted);margin-top:4px!important}.mbow-actions{display:flex;gap:8px;flex-wrap:wrap}
.mbow-button,.mbow-input,.mbow-select{min-height:38px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-input);color:var(--mb-text);font:inherit}.mbow-button{padding:7px 12px;cursor:pointer;font-weight:650}.mbow-button:hover{border-color:var(--mb-accent)}.mbow-button.primary{background:var(--mb-accent);border-color:var(--mb-accent);color:var(--mb-accent-contrast)}.mbow-button:disabled{opacity:.55;cursor:not-allowed}.mbow-input,.mbow-select{padding:7px 10px}.mbow-input{min-width:260px;flex:1}
.mbow-tabs{display:flex;gap:4px;border-bottom:1px solid var(--mb-border);margin-bottom:18px;overflow:auto}.mbow-tab{border:0;border-bottom:3px solid transparent;background:transparent;color:var(--mb-muted);padding:10px 13px;font:inherit;font-weight:700;white-space:nowrap;cursor:pointer}.mbow-tab.active{color:var(--mb-text);border-bottom-color:var(--mb-accent)}
.mbow-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px}.mbow-card{background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-radius);box-shadow:var(--mb-shadow);overflow:hidden}.mbow-scroll{overflow:auto}.mbow-table{width:100%;border-collapse:collapse;min-width:820px}.mbow-table th,.mbow-table td{padding:11px 12px;border-bottom:1px solid var(--mb-border);text-align:left;vertical-align:middle}.mbow-table th{color:var(--mb-muted);font-size:11px;letter-spacing:.045em;text-transform:uppercase;font-weight:800;background:color-mix(in srgb,var(--mb-soft) 60%,var(--mb-surface))}.mbow-table tr:last-child td{border-bottom:0}.mbow-table tbody tr.clickable{cursor:pointer}.mbow-table tbody tr.clickable:hover{background:color-mix(in srgb,var(--mb-accent) 6%,var(--mb-surface))}.mbow-money{text-align:right!important;font-variant-numeric:tabular-nums}.mbow-strong{font-weight:760}.mbow-muted{color:var(--mb-muted);font-size:12px}.mbow-badge{display:inline-flex;border:1px solid var(--mb-border);border-radius:999px;padding:2px 8px;font-size:12px;background:var(--mb-soft);white-space:nowrap}.mbow-badge.success{color:var(--mb-success);border-color:color-mix(in srgb,var(--mb-success) 35%,var(--mb-border));background:color-mix(in srgb,var(--mb-success) 8%,var(--mb-surface))}.mbow-badge.danger{color:var(--mb-danger)}.mbow-badge.warning{color:var(--mb-warning)}
.mbow-state{padding:28px;text-align:center;color:var(--mb-muted)}.mbow-error{color:var(--mb-danger)}.mbow-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;color:var(--mb-muted)}
.mbow-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0 18px}.mbow-metric{padding:16px;background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-radius);box-shadow:var(--mb-shadow)}.mbow-metric span{display:block;color:var(--mb-muted);font-size:11px;text-transform:uppercase;letter-spacing:.05em}.mbow-metric strong{display:block;font-size:24px;margin-top:5px}.mbow-section-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--mb-border)}
.mbow-back{margin-bottom:12px}.mbow-task-note{color:var(--mb-muted);font-size:13px;margin-bottom:14px!important}.mbow-bar{height:7px;min-width:70px;background:var(--mb-soft);border-radius:99px;overflow:hidden}.mbow-bar i{display:block;height:100%;background:var(--mb-accent);border-radius:inherit}
@media(max-width:760px){.mbow{padding:14px}.mbow-head{display:block}.mbow-actions{margin-top:12px}.mbow-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.mbow-input{min-width:100%}}
`;

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function RenderingProviderFilter({ value, options, onChange }: {
  value: string;
  options: Array<{ id: string; name: string }> | undefined;
  onChange: (value: string) => void;
}): ReactElement | null {
  if (!options && !value) return null;
  return <select className="mbow-select" aria-label="Rendering provider filter" value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">All rendering providers</option>
    {value && !options?.some((option) => option.id === value) ? <option value={value}>Selected rendering provider</option> : null}
    {options?.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
  </select>;
}

function shortDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US");
}

function defaultRange(days = 29): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - days);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function Surface({ appearance, className = "", style, children, surfaceRef }: {
  appearance?: MindBillReactAppearance | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  children: ReactNode;
  surfaceRef?: Ref<HTMLDivElement> | undefined;
}): ReactElement {
  return <div ref={surfaceRef} className={`mbow ${className}`.trim()} style={mindBillAppearanceStyle(appearance, style)}><style>{css}</style>{children}</div>;
}

function useAvailableViewportHeight() {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = workspaceRef.current;
    if (!element || typeof window === "undefined") return;
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const top = Math.max(0, element.getBoundingClientRect().top);
        setAvailableHeight(Math.max(240, viewportHeight - top - 16));
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);
  return { workspaceRef, availableHeight };
}

function useClient(options: BillingOperationsClientOptions) {
  return useMemo(() => createBillingOperationsClient(options), [options.apiBaseUrl, options.fetch, options.getSession, options.sessionEndpoint]);
}

export type ConnectedBillSearchProps = ConnectedSurfaceProps & {
  initialQuery?: BillRegistryQuery;
  onSelectBill?: (bill: BillRegistryItem) => void;
  heading?: ReactNode;
  compact?: boolean;
};

function BillSearchContent({
  client,
  initialQuery,
  onSelectBill,
  heading,
}: {
  client: ReturnType<typeof createBillingOperationsClient>;
  initialQuery?: BillRegistryQuery | undefined;
  onSelectBill?: ((bill: BillRegistryItem) => void) | undefined;
  heading?: ReactNode | undefined;
}): ReactElement {
  const [query, setQuery] = useState<BillRegistryQuery>({ age: "all", page: 1, pageSize: 25, sort: "submitted_desc", ...initialQuery, status: initialQuery?.status === "submitted" ? "sent" : initialQuery?.status ?? "all" });
  const [draft, setDraft] = useState(initialQuery?.q ?? "");
  const [result, setResult] = useState<BillRegistryResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try { setResult(await client.getBills(query, signal)); }
    catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause : new Error("Bills could not be loaded.")); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [client, query]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const update = (next: Partial<BillRegistryQuery>) => setQuery((current) => ({ ...current, ...next, page: next.page ?? 1 }));
  const pageCount = Math.max(1, Math.ceil((result?.total ?? 0) / (result?.pageSize ?? 25)));

  return <>
    {heading ? <div className="mbow-head"><div>{typeof heading === "string" ? <h2>{heading}</h2> : heading}</div></div> : null}
    <form className="mbow-toolbar" onSubmit={(event) => { event.preventDefault(); update({ q: draft.trim() }); }}>
      <input className="mbow-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Search patient, bill ID, claim, or external ID…" aria-label="Search bills" />
      <select className="mbow-select" value={query.status ?? "all"} onChange={(event) => update({ status: event.target.value })} aria-label="Bill status">
        <option value="all">All statuses</option><option value="incomplete">Incomplete</option><option value="sent">Sent</option><option value="accepted">Accepted</option><option value="accepted_no_response">Accepted — response overdue</option><option value="rejected">Rejected</option><option value="processed">Processed</option><option value="paid">Paid</option><option value="closed">Closed</option>
      </select>
      <select className="mbow-select" value={query.age ?? "all"} onChange={(event) => update({ age: event.target.value as BillRegistryAge })} aria-label="A/R age">
        <option value="all">All A/R ages</option><option value="0-30">0–30 days</option><option value="31-60">31–60 days</option><option value="61-90">61–90 days</option><option value="91+">91+ days</option><option value="91-180">91–180 days</option><option value="181+">181+ days</option>
      </select>
      <button className="mbow-button" type="submit">Search</button>
      <RenderingProviderFilter value={query.renderingProviderId ?? ""} options={result?.filters?.renderingProviders} onChange={(value) => update({ renderingProviderId: value })} />
    </form>
    <div className="mbow-card mbow-scroll">
      {loading ? <div className="mbow-state" role="status">Loading bills…</div> : error ? <div className="mbow-state mbow-error" role="alert">{error.message} <button className="mbow-button" type="button" onClick={() => void load()}>Retry</button></div> : result?.items.length === 0 ? <div className="mbow-state">No bills match these filters.</div> : <table className="mbow-table">
        <thead><tr><th>Bill</th><th>Patient</th><th>DOS</th><th>Codes</th><th>Claims administrator</th><th>Status</th><th>Submitted / A/R age</th><th className="mbow-money">Balance due</th></tr></thead>
        <tbody>{result?.items.map((bill) => <tr key={bill.id} className={onSelectBill ? "clickable" : ""} onClick={() => onSelectBill?.(bill)}>
          <td className="mbow-strong">#{bill.billNumber}</td><td>{bill.patientName}</td><td>{shortDate(bill.dateOfService)}</td><td>{bill.procedureCodes.join(", ") || "—"}</td><td>{bill.claimsAdministrator || "—"}</td><td><span className={`mbow-badge ${bill.status.tone ?? ""}`}>{bill.status.label}</span></td><td>{shortDate(bill.submittedAt)}<div className="mbow-muted">{bill.arAgeDays == null ? "—" : `${bill.arAgeDays} days`}</div></td><td className="mbow-money mbow-strong">{money(bill.balanceDue)}</td>
        </tr>)}</tbody>
      </table>}
      {result && !loading && !error ? <div className="mbow-pager"><span>Showing {result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1}–{Math.min(result.page * result.pageSize, result.total)} of {result.total}</span><span><button className="mbow-button" type="button" disabled={result.page <= 1} onClick={() => update({ page: result.page - 1 })}>Previous</button> {result.page} / {pageCount} <button className="mbow-button" type="button" disabled={result.page >= pageCount} onClick={() => update({ page: result.page + 1 })}>Next</button></span></div> : null}
    </div>
  </>;
}

export function ConnectedBillSearch({ appearance, className, style, initialQuery, onSelectBill, heading = "All bills", ...options }: ConnectedBillSearchProps): ReactElement {
  const client = useClient(options);
  return <Surface appearance={appearance} className={className} style={style}><BillSearchContent client={client} initialQuery={initialQuery} onSelectBill={onSelectBill} heading={heading} /></Surface>;
}

export type ConnectedBillTasksDashboardProps = ConnectedSurfaceProps & {
  onDrillDown?: (query: BillRegistryQuery) => void;
};

function taskQuery(cell: BillTasksDashboardCell): BillRegistryQuery {
  const [taskType, taskLabel] = cell.rowId.split("::", 2);
  const age = cell.bucketId === "1-30" ? "0-30" : cell.bucketId as BillRegistryAge | null;
  if (cell.sectionId === "waiting_sent" || cell.sectionId === "waiting_accepted") {
    return { status: cell.rowId, ...(age ? { age } : {}) };
  }
  return { status: "all", taskSection: cell.sectionId, ...(taskType ? { taskType } : {}), ...(taskLabel ? { taskLabel } : {}), ...(age ? { age } : {}) };
}

function BillTasksContent({ client, onDrillDown, appearance }: { client: ReturnType<typeof createBillingOperationsClient>; onDrillDown?: ((query: BillRegistryQuery) => void) | undefined; appearance?: MindBillReactAppearance | undefined }): ReactElement {
  const [claimsAdminId, setClaimsAdminId] = useState("");
  const [renderingProviderId, setRenderingProviderId] = useState("");
  const [result, setResult] = useState<BillTasksResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (signal?: AbortSignal) => { setLoading(true); setError(null); try { setResult(await client.getBillTasks(claimsAdminId || undefined, signal, renderingProviderId || undefined)); } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause : new Error("Bill tasks could not be loaded.")); } finally { if (!signal?.aborted) setLoading(false); } }, [claimsAdminId, renderingProviderId, client]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  if (loading && !result) return <div className="mbow-state">Loading bill tasks…</div>;
  if (error && !result) return <div className="mbow-state mbow-error">{error.message}</div>;
  if (!result) return <></>;
  const selectionProps = loading || error ? {} : {
    onSelectCell: (cell: BillTasksDashboardCell) => onDrillDown?.({ ...taskQuery(cell), ...(claimsAdminId ? { claimsAdministrator: claimsAdminId } : {}), ...(renderingProviderId ? { renderingProviderId } : {}) }),
  };
  return <>
    <p className="mbow-task-note">Open follow-up work grouped by task and age. {result.waiting ? "Sent and accepted bills waiting for a payer are shown below." : "Find sent and accepted bills in All bills."}</p>
    {loading ? <p role="status">Updating bill tasks…</p> : null}
    {error ? <p role="alert" className="mbow-error">{error.message}</p> : null}
    <BillTasksDashboard data={result.dashboard} appearance={appearance ?? { preset: "mindbill" }} toolbar={<div className="mbow-toolbar"><select aria-label="Claims administrator filter" className="mbow-select" value={claimsAdminId} onChange={(event) => setClaimsAdminId(event.target.value)}><option value="">All claims administrators</option>{result.filters.claimsAdministrators.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><RenderingProviderFilter value={renderingProviderId} options={result.filters.renderingProviders} onChange={setRenderingProviderId} /></div>} {...selectionProps} />
    {result.waiting ? <BillTasksDashboard data={result.waiting} appearance={appearance ?? { preset: "mindbill" }}
      heading="Bills waiting for payer" totalLabel="Bill Total" itemLabel="bills" grandTotalLabel="Waiting Bills Total" emptyLabel="No waiting bills"
      {...selectionProps}
      footnote="Waiting bills can also have overdue follow-up tasks above. These bill totals are separate from task totals." /> : null}
  </>;
}

export function ConnectedBillTasksDashboard({ appearance, className, style, onDrillDown, ...options }: ConnectedBillTasksDashboardProps): ReactElement {
  const client = useClient(options);
  return <Surface appearance={appearance} className={className} style={style}><BillTasksContent client={client} onDrillDown={onDrillDown} appearance={appearance} /></Surface>;
}

type ReportProps = ConnectedSurfaceProps & { initialFrom?: string; initialTo?: string; onSelectBill?: (billId: string) => void };

function RangeToolbar({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (value: string) => void; setTo: (value: string) => void }): ReactElement {
  return <div className="mbow-toolbar"><label>From <input className="mbow-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>To <input className="mbow-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>;
}

export function ConnectedServiceLineItemsReport({ appearance, className, style, initialFrom, initialTo, onSelectBill, ...options }: ReportProps): ReactElement {
  const defaults = useMemo(() => defaultRange(), []); const client = useClient(options);
  const [from, setFrom] = useState(initialFrom ?? defaults.from); const [to, setTo] = useState(initialTo ?? defaults.to); const [data, setData] = useState<ServiceLineItemsReport | null>(null); const [error, setError] = useState<Error | null>(null);
  useEffect(() => { const controller = new AbortController(); setError(null); void client.getServiceLineItems({ from, to }, controller.signal).then(setData).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause : new Error("Report could not be loaded.")); }); return () => controller.abort(); }, [client, from, to]);
  return <Surface appearance={appearance} className={className} style={style}><div className="mbow-head"><div><h2>Original submissions by procedure</h2><p className="mbow-sub">First payer submission for each patient and date of service.</p></div></div><RangeToolbar from={from} to={to} setFrom={setFrom} setTo={setTo} />{error ? <div className="mbow-state mbow-error">{error.message}</div> : !data ? <div className="mbow-state">Loading report…</div> : <><div className="mbow-metrics"><Metric label="Original bills" value={String(data.totalBills)} /><Metric label="Service lines" value={String(data.totalLines)} /><Metric label="Total billed" value={money(data.totalBilled)} /><Metric label="Report window" value={data.windowLabel} /></div><div className="mbow-card mbow-scroll"><div className="mbow-section-head"><h3>Procedure summary</h3></div><table className="mbow-table"><thead><tr><th>Procedure code</th><th>Bills</th><th>Service lines</th><th className="mbow-money">Total billed</th></tr></thead><tbody>{data.cptRows.map((row) => <tr key={row.code}><td className="mbow-strong">{row.code}</td><td>{row.bills}</td><td>{row.lines}</td><td className="mbow-money">{money(row.billed)}</td></tr>)}</tbody></table></div><div className="mbow-card mbow-scroll" style={{ marginTop: 16 }}><div className="mbow-section-head"><h3>All original bills</h3></div><table className="mbow-table"><thead><tr><th>Bill</th><th>First submitted</th><th>Patient · Claim</th><th>DOS</th><th>Claims administrator</th><th>Codes</th><th className="mbow-money">Billed</th><th>Status</th></tr></thead><tbody>{data.billRows.map((row) => <tr key={row.billId} className={onSelectBill ? "clickable" : ""} onClick={() => onSelectBill?.(row.billId)}><td className="mbow-strong">#{row.billNumber}</td><td>{shortDate(row.submittedDate)}</td><td>{row.patient}<div className="mbow-muted">{row.claim}</div></td><td>{shortDate(row.dos)}</td><td>{row.claimsAdmin}</td><td>{row.codes.join(", ")}</td><td className="mbow-money">{money(row.billed)}</td><td>{row.status}</td></tr>)}</tbody></table></div></>}</Surface>;
}

function Metric({ label, value }: { label: string; value: string }): ReactElement { return <div className="mbow-metric"><span>{label}</span><strong>{value}</strong></div>; }

export function ConnectedProductivityReport({ appearance, className, style, initialFrom, initialTo, ...options }: Omit<ReportProps, "onSelectBill">): ReactElement {
  const defaults = useMemo(() => defaultRange(13), []); const client = useClient(options);
  const [from, setFrom] = useState(initialFrom ?? defaults.from); const [to, setTo] = useState(initialTo ?? defaults.to); const [data, setData] = useState<ProductivityReport | null>(null); const [error, setError] = useState<Error | null>(null);
  useEffect(() => { const controller = new AbortController(); setError(null); void client.getProductivity({ from, to }, controller.signal).then(setData).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause : new Error("Report could not be loaded.")); }); return () => controller.abort(); }, [client, from, to]);
  const maxSent = data ? Math.max(1, ...Object.values(data.sentTotal)) : 1;
  return <Surface appearance={appearance} className={className} style={style}><div className="mbow-head"><div><h2>Productivity</h2><p className="mbow-sub">Bills created and sent per biller, plus accepted-first-try rate.</p></div></div><RangeToolbar from={from} to={to} setFrom={setFrom} setTo={setTo} />{error ? <div className="mbow-state mbow-error">{error.message}</div> : !data ? <div className="mbow-state">Loading report…</div> : <><div className="mbow-metrics"><Metric label="Bills created" value={String(data.totalCreated)} /><Metric label="Transmissions" value={String(data.totalSent)} /><Metric label="Bills submitted" value={String(data.totalSubmitted)} /><Metric label="Accepted first try" value={data.totalSubmitted ? `${Math.round(data.totalClean / data.totalSubmitted * 100)}%` : "—"} /></div><div className="mbow-card mbow-scroll"><div className="mbow-section-head"><h3>Per-biller summary</h3></div><table className="mbow-table"><thead><tr><th>Biller</th><th>Created</th><th>Transmissions</th><th>Submitted</th><th>Accepted first try</th><th>Volume</th></tr></thead><tbody>{data.billers.map((biller) => { const sent = data.sentTotal[biller.name] ?? 0; const submitted = data.submittedTotal[biller.name] ?? 0; const clean = data.cleanTotal[biller.name] ?? 0; return <tr key={biller.name}><td className="mbow-strong">{biller.name}</td><td>{data.createdTotal[biller.name] ?? 0}</td><td>{sent}</td><td>{submitted}</td><td>{submitted ? `${Math.round(clean / submitted * 100)}%` : "—"}</td><td><div className="mbow-bar"><i style={{ width: `${sent / maxSent * 100}%` }} /></div></td></tr>; })}</tbody></table></div></>}</Surface>;
}

export type ConnectedBillingWorkspaceProps = ConnectedSurfaceProps & {
  initialView?: "tasks" | "bills" | "procedures" | "productivity" | "payments";
  /** Optional host-owned payment entry action. Review itself is read-only. */
  onPostPayment?: () => void;
  onCreateBill?: () => void;
  /** Show simulation controls on selected sandbox bills. Never enables live simulations. */
  sandboxControls?: boolean;
  /** Return contacts for the selected bill only; never auto-selects recipients. */
  getCourtesyCopyRecipientOptions?: (billId: string) => readonly CourtesyCopyRecipientOption[];
};

export function ConnectedBillingWorkspace({ appearance, className, style, initialView = "tasks", onCreateBill, onPostPayment, sandboxControls = false, getCourtesyCopyRecipientOptions, ...options }: ConnectedBillingWorkspaceProps): ReactElement {
  const client = useClient(options); const [view, setView] = useState(initialView); const [billQuery, setBillQuery] = useState<BillRegistryQuery>({ status: "all" }); const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const { workspaceRef, availableHeight } = useAvailableViewportHeight();
  const workspaceClassName = ["mbow-workspace", className].filter(Boolean).join(" ");
  const hasExplicitHeight = style?.height != null || style?.maxHeight != null;
  const workspaceStyle = availableHeight == null || hasExplicitHeight ? style : { ...style, maxHeight: availableHeight };
  if (selectedBillId) return <Surface surfaceRef={workspaceRef} appearance={appearance} className={workspaceClassName} style={workspaceStyle}><button className="mbow-button mbow-back" type="button" onClick={() => setSelectedBillId(null)}>← Back to bills</button><ConnectedBillLifecycle billId={selectedBillId} sandboxControls={sandboxControls} courtesyCopyRecipientOptions={getCourtesyCopyRecipientOptions?.(selectedBillId) ?? []} {...options} {...(appearance ? { appearance } : {})} /></Surface>;
  const selectView = (next: typeof view) => { setView(next); setSelectedBillId(null); };
  const appearanceProps = appearance ? { appearance } : {};
  return <Surface surfaceRef={workspaceRef} appearance={appearance} className={workspaceClassName} style={workspaceStyle}><div className="mbow-head"><div><h2>Billing</h2><p className="mbow-sub">Follow up on open work or find any bill and its current status.</p></div>{onCreateBill ? <div className="mbow-actions"><button className="mbow-button primary" type="button" onClick={onCreateBill}>+ Add bill</button></div> : null}</div><div className="mbow-tabs" role="tablist">{([['tasks','Bill tasks'],['bills','All bills'],['procedures','Procedures'],['productivity','Productivity'],['payments','Payment review']] as const).map(([id,label]) => <button key={id} className={`mbow-tab ${view === id ? "active" : ""}`} type="button" role="tab" aria-selected={view === id} onClick={() => selectView(id)}>{label}</button>)}</div>{view === "tasks" ? <BillTasksContent client={client} onDrillDown={(query) => { setBillQuery(query); setView("bills"); }} appearance={appearance} /> : view === "bills" ? <BillSearchContent client={client} initialQuery={billQuery} onSelectBill={(bill) => setSelectedBillId(bill.id)} /> : view === "procedures" ? <ConnectedServiceLineItemsReport {...options} {...appearanceProps} onSelectBill={setSelectedBillId} /> : view === "payments" ? <ConnectedPaymentReview {...options} {...appearanceProps} {...(onPostPayment ? { onPostPayment } : {})} onSelectBill={setSelectedBillId} /> : <ConnectedProductivityReport {...options} {...appearanceProps} />}</Surface>;
}
