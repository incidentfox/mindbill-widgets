"use client";

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useMemo } from "react";

import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";
import { billAgingBucket, type BillAgingBucketId, type BillingDashboardBill } from "./billing-dashboard";

export type BillStatusAgingCell = {
  state: string;
  bucket: BillAgingBucketId | "total";
  count: number;
  balance: number;
  bills: BillingDashboardBill[];
};

export type BillStatusAgingRow = {
  state: string;
  label: string;
  cells: BillStatusAgingCell[];
  total: BillStatusAgingCell;
};

export type BillStatusAgingMatrixData = {
  rows: BillStatusAgingRow[];
  columnTotals: BillStatusAgingCell[];
  grandTotal: BillStatusAgingCell;
};

export type BillStatusAgingMatrixProps = {
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
  bills: BillingDashboardBill[];
  heading?: ReactNode;
  description?: ReactNode;
  /** Lifecycle-first row order; unknown states append alphabetically. */
  stateOrder?: string[];
  /** Show outstanding balance under each count. Default true. */
  showBalances?: boolean;
  onSelectCell?: (cell: BillStatusAgingCell) => void;
};

export const BILL_STATUS_AGING_BUCKETS: { id: BillAgingBucketId; label: string }[] = [
  { id: "current", label: "0–30 days" },
  { id: "31-60", label: "31–60 days" },
  { id: "61-90", label: "61–90 days" },
  { id: "91+", label: "91+ days" },
];

const DEFAULT_STATE_ORDER = [
  "draft",
  "incomplete",
  "created",
  "sent",
  "submitted",
  "accepted",
  "processed",
  "paid",
  "underpaid",
  "denied",
  "rejected",
  "appealing",
  "second_review",
  "ibr",
  "lien",
  "closed",
];

const money = (value: number) => Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
const stateLabel = (state: string) => state.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const emptyCell = (state: string, bucket: BillAgingBucketId | "total"): BillStatusAgingCell => ({ state, bucket, count: 0, balance: 0, bills: [] });

export function buildBillStatusAgingMatrix(
  bills: BillingDashboardBill[],
  stateOrder: string[] = DEFAULT_STATE_ORDER,
  now = new Date(),
): BillStatusAgingMatrixData {
  const orderIndex = new Map(stateOrder.map((state, index) => [state.toLowerCase(), index]));
  const states = [...new Set(bills.map((bill) => bill.state))].sort((a, b) => {
    const left = orderIndex.get(a.toLowerCase()) ?? stateOrder.length;
    const right = orderIndex.get(b.toLowerCase()) ?? stateOrder.length;
    return left - right || a.localeCompare(b);
  });
  const columnTotals = BILL_STATUS_AGING_BUCKETS.map((bucket) => emptyCell("all", bucket.id));
  const grandTotal = emptyCell("all", "total");
  const rows = states.map((state) => {
    const cells = BILL_STATUS_AGING_BUCKETS.map((bucket) => emptyCell(state, bucket.id));
    const total = emptyCell(state, "total");
    return { state, label: stateLabel(state), cells, total };
  });
  const rowByState = new Map(rows.map((row) => [row.state, row]));
  for (const bill of bills) {
    const row = rowByState.get(bill.state)!;
    const bucketIndex = BILL_STATUS_AGING_BUCKETS.findIndex((bucket) => bucket.id === billAgingBucket(bill, now));
    const balance = Number(bill.balanceDue || 0);
    for (const cell of [row.cells[bucketIndex]!, row.total, columnTotals[bucketIndex]!, grandTotal]) {
      cell.count += 1;
      cell.balance += balance;
      cell.bills.push(bill);
    }
  }
  return { rows, columnTotals, grandTotal };
}

export function buildBillStatusAgingCsv(bills: BillingDashboardBill[], stateOrder?: string[]): string {
  const matrix = buildBillStatusAgingMatrix(bills, stateOrder);
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const header = ["Status", ...BILL_STATUS_AGING_BUCKETS.map((bucket) => bucket.label), "Total"];
  const lines = matrix.rows.map((row) => [row.label, ...row.cells.map((cell) => cell.count), row.total.count]);
  lines.push(["Total", ...matrix.columnTotals.map((cell) => cell.count), matrix.grandTotal.count]);
  return [header, ...lines].map((line) => line.map(escape).join(",")).join("\n");
}

const css = `
.mbmx{color:var(--mb-text);font-family:var(--mb-font);font-size:15px}.mbmx *{box-sizing:border-box}.mbmx h2,.mbmx p{margin:0}
.mbmx-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:16px}.mbmx-head h2{font-size:24px}.mbmx-copy{color:var(--mb-muted);margin-top:5px!important}
.mbmx-card{border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);box-shadow:var(--mb-shadow);overflow:auto}
.mbmx-table{width:100%;border-collapse:collapse;min-width:640px}
.mbmx-table th{padding:13px 16px;border-bottom:1px solid var(--mb-border);color:var(--mb-muted);font-size:12px;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;text-align:right}
.mbmx-table th:first-child{text-align:left}
.mbmx-table td{padding:0;border-bottom:1px solid var(--mb-border);border-left:1px solid color-mix(in srgb,var(--mb-border) 55%,transparent);text-align:right;vertical-align:middle}
.mbmx-table td:first-child{border-left:0;padding:14px 16px;text-align:left;white-space:nowrap}
.mbmx-table tr:last-child td{border-bottom:0}
.mbmx-state{display:inline-flex;padding:4px 9px;border-radius:999px;background:color-mix(in srgb,var(--mb-accent) 10%,var(--mb-surface));color:var(--mb-text);font-size:12px;font-weight:720}
.mbmx-cell{display:block;width:100%;min-height:56px;padding:9px 16px;border:0;background:none;color:var(--mb-text);font:inherit;text-align:right}
.mbmx-cell[data-clickable=true]{cursor:pointer}.mbmx-cell[data-clickable=true]:hover{background:color-mix(in srgb,var(--mb-accent) 8%,var(--mb-surface))}
.mbmx-count{display:block;font-size:17px;font-weight:760;font-variant-numeric:tabular-nums}
.mbmx-balance{display:block;margin-top:2px;color:var(--mb-muted);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
.mbmx-zero{color:var(--mb-muted)}
.mbmx-total td,.mbmx-table td.mbmx-rowtotal{background:var(--mb-soft);font-weight:760}
`;

export function BillStatusAgingMatrix({
  bills,
  heading = "Bills by status and age",
  description = "Every bill grouped by lifecycle status, then by days outstanding.",
  stateOrder,
  showBalances = true,
  onSelectCell,
  appearance,
  className = "",
  style,
}: BillStatusAgingMatrixProps): ReactElement {
  const matrix = useMemo(() => buildBillStatusAgingMatrix(bills, stateOrder), [bills, stateOrder]);
  const clickable = Boolean(onSelectCell);
  const cell = (data: BillStatusAgingCell, key: string, isTotal = false): ReactElement => (
    <td key={key} className={isTotal ? "mbmx-rowtotal" : undefined}>
      <button
        type="button"
        className="mbmx-cell"
        data-clickable={clickable && data.count > 0}
        onClick={() => data.count > 0 && onSelectCell?.(data)}
        disabled={!clickable || data.count === 0}
        aria-label={`${stateLabel(data.state)} · ${data.bucket === "total" ? "all ages" : data.bucket}: ${data.count} bills`}
      >
        <span className={`mbmx-count ${data.count === 0 ? "mbmx-zero" : ""}`.trim()}>{data.count === 0 ? "—" : data.count}</span>
        {showBalances && data.count > 0 ? <span className="mbmx-balance">{money(data.balance)}</span> : null}
      </button>
    </td>
  );
  return (
    <div className={`mbmx ${className}`.trim()} style={{ ...mindBillAppearanceStyle(appearance), ...style }}>
      <style>{css}</style>
      <div className="mbmx-head"><div><h2>{heading}</h2><p className="mbmx-copy">{description}</p></div></div>
      <div className="mbmx-card">
        <table className="mbmx-table">
          <thead><tr><th>Status</th>{BILL_STATUS_AGING_BUCKETS.map((bucket) => <th key={bucket.id}>{bucket.label}</th>)}<th>Total</th></tr></thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.state}>
                <td><span className="mbmx-state">{row.label}</span></td>
                {row.cells.map((data) => cell(data, `${row.state}-${data.bucket}`))}
                {cell(row.total, `${row.state}-total`, true)}
              </tr>
            ))}
            <tr className="mbmx-total">
              <td>Total</td>
              {matrix.columnTotals.map((data) => cell(data, `all-${data.bucket}`))}
              {cell(matrix.grandTotal, "all-total", true)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
