"use client";

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useMemo, useState } from "react";

import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";

export type BillingDashboardBill = {
  id: string;
  billNumber?: string | number;
  externalId?: string;
  patientName: string;
  claimNumber?: string;
  payerName?: string;
  state: string;
  submittedAt?: string;
  updatedAt?: string;
  agingDays?: number;
  totalCharge: number;
  totalPaid: number;
  balanceDue: number;
  href?: string;
  workItemLabel?: string;
};

export type BillAgingBucketId = "current" | "31-60" | "61-90" | "91+";
export type BillAgingBucket = {
  id: BillAgingBucketId;
  label: string;
  count: number;
  balance: number;
};
export type BillingDashboardSummary = {
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  openCount: number;
  bills: number;
  aging: BillAgingBucket[];
};

export type BillingComponentProps = {
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
};

export type BillListProps = BillingComponentProps & {
  bills: BillingDashboardBill[];
  onSelectBill?: (bill: BillingDashboardBill) => void;
  emptyState?: ReactNode;
};

export type BillAgingSummaryProps = BillingComponentProps & {
  bills: BillingDashboardBill[];
  heading?: ReactNode;
};

export type BillingDashboardProps = BillingComponentProps & {
  bills: BillingDashboardBill[];
  heading?: ReactNode;
  description?: ReactNode;
  onSelectBill?: (bill: BillingDashboardBill) => void;
  initialSearch?: string;
  initialState?: string;
  hideFilters?: boolean;
};

export type BillingReportDimension = "status" | "payer" | "aging";
export type BillingReportRow = {
  key: string;
  label: string;
  billCount: number;
  totalBilled: number;
  totalPaid: number;
  balanceDue: number;
};
export type BillingReportProps = BillingComponentProps & {
  bills: BillingDashboardBill[];
  groupBy?: BillingReportDimension;
  heading?: ReactNode;
  description?: ReactNode;
};

const css = `
.mbdash{display:grid;gap:20px;color:var(--mb-text);font-family:var(--mb-font);font-size:15px}.mbdash *{box-sizing:border-box}.mbdash h2,.mbdash h3,.mbdash p{margin:0}.mbdash-copy{color:var(--mb-muted);margin-top:5px!important}.mbdash-card{min-width:0;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);box-shadow:var(--mb-shadow)}
.mbdash-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px}.mbdash-head h2{font-size:24px}.mbdash-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));overflow:hidden}.mbdash-stat{display:grid;gap:7px;padding:20px 22px;border-right:1px solid var(--mb-border)}.mbdash-stat:last-child{border:0}.mbdash-label{color:var(--mb-muted);font-size:12px;font-weight:760;letter-spacing:.06em;text-transform:uppercase}.mbdash-value{font-size:24px;font-weight:780;font-variant-numeric:tabular-nums}.mbdash-aging{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));overflow:hidden}.mbdash-aging-item{display:grid;gap:5px;padding:16px 20px;border-right:1px solid var(--mb-border)}.mbdash-aging-item:last-child{border:0}.mbdash-aging-item strong{font-size:18px;font-variant-numeric:tabular-nums}.mbdash-aging-item span:last-child{color:var(--mb-muted);font-size:13px}
.mbdash-filters{display:grid;grid-template-columns:minmax(240px,1fr) minmax(180px,260px);gap:12px}.mbdash-control{width:100%;min-height:46px;padding:10px 12px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-input);color:var(--mb-text);font:inherit}.mbdash-control:focus{outline:3px solid color-mix(in srgb,var(--mb-accent) 22%,transparent);border-color:var(--mb-accent)}
.mbdash-table-wrap{overflow:auto}.mbdash-table{width:100%;border-collapse:collapse}.mbdash-table th{padding:13px 16px;border-bottom:1px solid var(--mb-border);color:var(--mb-muted);font-size:12px;letter-spacing:.04em;text-align:left;text-transform:uppercase;white-space:nowrap}.mbdash-table td{padding:16px;border-bottom:1px solid var(--mb-border);vertical-align:top}.mbdash-table tr:last-child td{border-bottom:0}.mbdash-table tbody tr[data-clickable=true]{cursor:pointer}.mbdash-table tbody tr[data-clickable=true]:hover{background:color-mix(in srgb,var(--mb-accent) 5%,var(--mb-surface))}.mbdash-primary{display:block;color:var(--mb-text);font-weight:720;text-decoration:none}.mbdash-secondary{display:block;margin-top:4px;color:var(--mb-muted);font-size:13px}.mbdash-state{display:inline-flex;padding:4px 9px;border-radius:999px;background:color-mix(in srgb,var(--mb-accent) 10%,var(--mb-surface));color:var(--mb-text);font-size:12px;font-weight:720}.mbdash-money{text-align:right!important;font-variant-numeric:tabular-nums;white-space:nowrap}.mbdash-empty{padding:46px 22px;color:var(--mb-muted);text-align:center}.mbdash-mobile-list{display:none}.mbdash-mobile-card{display:grid;gap:14px;padding:18px;border-bottom:1px solid var(--mb-border)}.mbdash-mobile-card:last-child{border:0}.mbdash-mobile-top,.mbdash-mobile-money{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.mbdash-mobile-money>span{display:grid;gap:3px}.mbdash-mobile-money small{color:var(--mb-muted)}
.mbdash-report-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 22px;border-bottom:1px solid var(--mb-border)}.mbdash-report-total td{font-weight:780;background:var(--mb-soft)}
@media(max-width:900px){.mbdash-summary{grid-template-columns:repeat(2,1fr)}.mbdash-stat:nth-child(2){border-right:0}.mbdash-stat:nth-child(-n+2){border-bottom:1px solid var(--mb-border)}.mbdash-aging{grid-template-columns:repeat(2,1fr)}.mbdash-aging-item:nth-child(2){border-right:0}.mbdash-aging-item:nth-child(-n+2){border-bottom:1px solid var(--mb-border)}}
@media(max-width:700px){.mbdash{gap:16px}.mbdash-head{align-items:flex-start;flex-direction:column}.mbdash-filters{grid-template-columns:1fr}.mbdash-table-wrap{display:none}.mbdash-mobile-list{display:block}.mbdash-value{font-size:20px}.mbdash-stat,.mbdash-aging-item{padding:16px}.mbdash-report .mbdash-table-wrap{display:block}.mbdash-report .mbdash-table th:nth-child(2),.mbdash-report .mbdash-table td:nth-child(2),.mbdash-report .mbdash-table th:nth-child(3),.mbdash-report .mbdash-table td:nth-child(3){display:none}}
`;

const terminalStates = new Set(["closed", "voided", "cancelled"]);
const money = (value: number) => Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
const stateLabel = (state: string) => state.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function billAgingDays(bill: BillingDashboardBill, now = new Date()): number {
  if (Number.isFinite(bill.agingDays)) return Math.max(0, Math.floor(bill.agingDays!));
  if (!bill.submittedAt) return 0;
  const submitted = new Date(bill.submittedAt);
  if (Number.isNaN(submitted.valueOf())) return 0;
  return Math.max(0, Math.floor((now.valueOf() - submitted.valueOf()) / 86_400_000));
}

export function billAgingBucket(bill: BillingDashboardBill, now = new Date()): BillAgingBucketId {
  const days = billAgingDays(bill, now);
  if (days <= 30) return "current";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "91+";
}

export function summarizeBillingDashboard(bills: BillingDashboardBill[], now = new Date()): BillingDashboardSummary {
  const aging: BillAgingBucket[] = [
    { id: "current", label: "0–30 days", count: 0, balance: 0 },
    { id: "31-60", label: "31–60 days", count: 0, balance: 0 },
    { id: "61-90", label: "61–90 days", count: 0, balance: 0 },
    { id: "91+", label: "91+ days", count: 0, balance: 0 },
  ];
  let totalBilled = 0; let totalPaid = 0; let outstanding = 0; let openCount = 0;
  for (const bill of bills) {
    totalBilled += Number(bill.totalCharge || 0); totalPaid += Number(bill.totalPaid || 0); outstanding += Number(bill.balanceDue || 0);
    if (!terminalStates.has(bill.state.toLowerCase()) && bill.balanceDue > 0) {
      openCount += 1; const bucket = aging.find((item) => item.id === billAgingBucket(bill, now))!;
      bucket.count += 1; bucket.balance += Number(bill.balanceDue || 0);
    }
  }
  return { totalBilled, totalPaid, outstanding, openCount, bills: bills.length, aging };
}

function Shell({ appearance, className = "", style, children }: BillingComponentProps & { children: ReactNode }): ReactElement {
  return <div className={`mbdash ${className}`.trim()} style={{ ...mindBillAppearanceStyle(appearance), ...style }}><style>{css}</style>{children}</div>;
}

function BillIdentity({ bill }: { bill: BillingDashboardBill }): ReactElement {
  const label = bill.billNumber == null ? bill.externalId ?? "Bill" : `Bill #${bill.billNumber}`;
  const content = <><span className="mbdash-primary">{label}</span><span className="mbdash-secondary">{[bill.patientName, bill.claimNumber ? `Claim ${bill.claimNumber}` : null].filter(Boolean).join(" · ")}</span></>;
  return bill.href ? <a href={bill.href} className="mbdash-primary">{content}</a> : <>{content}</>;
}

function BillListContent({ bills, onSelectBill, emptyState = "No bills match these filters." }: BillListProps): ReactElement {
  if (!bills.length) return <div className="mbdash-card mbdash-empty">{emptyState}</div>;
  return <div className="mbdash-card">
    <div className="mbdash-table-wrap"><table className="mbdash-table"><thead><tr><th>Bill</th><th>Payer</th><th>Status</th><th>Age</th><th className="mbdash-money">Billed</th><th className="mbdash-money">Paid</th><th className="mbdash-money">Balance</th></tr></thead><tbody>
      {bills.map((bill) => <tr key={bill.id} data-clickable={Boolean(onSelectBill)} onClick={() => onSelectBill?.(bill)}><td><BillIdentity bill={bill} /></td><td>{bill.payerName || "—"}</td><td><span className="mbdash-state">{stateLabel(bill.state)}</span></td><td>{billAgingDays(bill)} days</td><td className="mbdash-money">{money(bill.totalCharge)}</td><td className="mbdash-money">{money(bill.totalPaid)}</td><td className="mbdash-money"><strong>{money(bill.balanceDue)}</strong></td></tr>)}
    </tbody></table></div>
    <div className="mbdash-mobile-list">{bills.map((bill) => <article className="mbdash-mobile-card" key={bill.id} onClick={() => onSelectBill?.(bill)}><div className="mbdash-mobile-top"><div><BillIdentity bill={bill} /></div><span className="mbdash-state">{stateLabel(bill.state)}</span></div><div className="mbdash-mobile-money"><span><small>Age</small>{billAgingDays(bill)} days</span><span><small>Paid</small>{money(bill.totalPaid)}</span><span><small>Balance</small><strong>{money(bill.balanceDue)}</strong></span></div></article>)}</div>
  </div>;
}

export function BillList(props: BillListProps): ReactElement {
  const shellProps = {
    ...(props.appearance === undefined ? {} : { appearance: props.appearance }),
    ...(props.className === undefined ? {} : { className: props.className }),
    ...(props.style === undefined ? {} : { style: props.style }),
  };
  return <Shell {...shellProps}><BillListContent {...props} /></Shell>;
}

function AgingContent({ bills, heading = "Accounts receivable" }: Pick<BillAgingSummaryProps, "bills" | "heading">): ReactElement {
  const summary = useMemo(() => summarizeBillingDashboard(bills), [bills]);
  return <><div className="mbdash-head"><div><h2>{heading}</h2><p className="mbdash-copy">Current balances and aging at a glance.</p></div></div><div className="mbdash-card mbdash-summary"><div className="mbdash-stat"><span className="mbdash-label">Outstanding</span><span className="mbdash-value">{money(summary.outstanding)}</span></div><div className="mbdash-stat"><span className="mbdash-label">Open bills</span><span className="mbdash-value">{summary.openCount}</span></div><div className="mbdash-stat"><span className="mbdash-label">Collected</span><span className="mbdash-value">{money(summary.totalPaid)}</span></div><div className="mbdash-stat"><span className="mbdash-label">Total billed</span><span className="mbdash-value">{money(summary.totalBilled)}</span></div></div><div className="mbdash-card mbdash-aging">{summary.aging.map((bucket) => <div className="mbdash-aging-item" key={bucket.id}><span className="mbdash-label">{bucket.label}</span><strong>{money(bucket.balance)}</strong><span>{bucket.count} bill{bucket.count === 1 ? "" : "s"}</span></div>)}</div></>;
}

export function BillAgingSummary(props: BillAgingSummaryProps): ReactElement {
  const shellProps = {
    ...(props.appearance === undefined ? {} : { appearance: props.appearance }),
    ...(props.className === undefined ? {} : { className: props.className }),
    ...(props.style === undefined ? {} : { style: props.style }),
  };
  return <Shell {...shellProps}><AgingContent bills={props.bills} {...(props.heading === undefined ? {} : { heading: props.heading })} /></Shell>;
}

export function BillingDashboard({ bills, heading = "Billing", description = "Track submitted bills, payments, and outstanding balances.", onSelectBill, initialSearch = "", initialState = "all", hideFilters = false, appearance, className, style }: BillingDashboardProps): ReactElement {
  const [search, setSearch] = useState(initialSearch); const [state, setState] = useState(initialState);
  const states = useMemo(() => [...new Set(bills.map((bill) => bill.state))].sort((a, b) => a.localeCompare(b)), [bills]);
  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return bills.filter((bill) => (state === "all" || bill.state === state) && (!query || [bill.billNumber, bill.externalId, bill.patientName, bill.claimNumber, bill.payerName, bill.workItemLabel].some((value) => String(value ?? "").toLowerCase().includes(query)))); }, [bills, search, state]);
  const shellProps = {
    ...(appearance === undefined ? {} : { appearance }),
    ...(className === undefined ? {} : { className }),
    ...(style === undefined ? {} : { style }),
  };
  const listProps = { bills: filtered, ...(onSelectBill === undefined ? {} : { onSelectBill }) };
  return <Shell {...shellProps}><div className="mbdash-head"><div><h2>{heading}</h2><p className="mbdash-copy">{description}</p></div></div><AgingContent bills={filtered} heading="Receivables" />{hideFilters ? null : <div className="mbdash-filters"><input className="mbdash-control" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient, claim, payer, or bill…" aria-label="Search bills" /><select className="mbdash-control" value={state} onChange={(event) => setState(event.target.value)} aria-label="Filter bills by status"><option value="all">All statuses</option>{states.map((item) => <option value={item} key={item}>{stateLabel(item)}</option>)}</select></div>}<BillListContent {...listProps} /></Shell>;
}

export function buildBillingReportRows(bills: BillingDashboardBill[], groupBy: BillingReportDimension = "status"): BillingReportRow[] {
  const rows = new Map<string, BillingReportRow>();
  for (const bill of bills) {
    const key = groupBy === "payer" ? bill.payerName || "Unassigned payer" : groupBy === "aging" ? billAgingBucket(bill) : bill.state;
    const label = groupBy === "status" ? stateLabel(key) : groupBy === "aging" ? ({ current: "0–30 days", "31-60": "31–60 days", "61-90": "61–90 days", "91+": "91+ days" } as Record<string, string>)[key] ?? key : key;
    const row = rows.get(key) ?? { key, label, billCount: 0, totalBilled: 0, totalPaid: 0, balanceDue: 0 };
    row.billCount += 1; row.totalBilled += Number(bill.totalCharge || 0); row.totalPaid += Number(bill.totalPaid || 0); row.balanceDue += Number(bill.balanceDue || 0); rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

export function buildBillingReportCsv(bills: BillingDashboardBill[], groupBy: BillingReportDimension = "status"): string {
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  return [["Group", "Bills", "Total billed", "Total paid", "Balance due"].map(escape).join(","), ...buildBillingReportRows(bills, groupBy).map((row) => [row.label, row.billCount, row.totalBilled.toFixed(2), row.totalPaid.toFixed(2), row.balanceDue.toFixed(2)].map(escape).join(","))].join("\n");
}

export function BillingReport({ bills, groupBy = "status", heading = "Billing report", description = "Billed, paid, and outstanding totals.", appearance, className, style }: BillingReportProps): ReactElement {
  const rows = useMemo(() => buildBillingReportRows(bills, groupBy), [bills, groupBy]); const total = useMemo(() => summarizeBillingDashboard(bills), [bills]);
  const shellProps = {
    ...(appearance === undefined ? {} : { appearance }),
    className: `mbdash-report ${className ?? ""}`.trim(),
    ...(style === undefined ? {} : { style }),
  };
  return <Shell {...shellProps}><div className="mbdash-card"><div className="mbdash-report-head"><div><h2>{heading}</h2><p className="mbdash-copy">{description}</p></div><span className="mbdash-state">By {groupBy}</span></div><div className="mbdash-table-wrap"><table className="mbdash-table"><thead><tr><th>Group</th><th>Bills</th><th className="mbdash-money">Billed</th><th className="mbdash-money">Paid</th><th className="mbdash-money">Balance</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key}><td><strong>{row.label}</strong></td><td>{row.billCount}</td><td className="mbdash-money">{money(row.totalBilled)}</td><td className="mbdash-money">{money(row.totalPaid)}</td><td className="mbdash-money">{money(row.balanceDue)}</td></tr>)}<tr className="mbdash-report-total"><td>Total</td><td>{total.bills}</td><td className="mbdash-money">{money(total.totalBilled)}</td><td className="mbdash-money">{money(total.totalPaid)}</td><td className="mbdash-money">{money(total.outstanding)}</td></tr></tbody></table></div></div></Shell>;
}
