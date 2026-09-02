import type { MindBillAgingBucketId, MindBillDashboardBill } from "./billing-dashboard.component";

export type MindBillStatusAgingCell = {
  state: string;
  bucket: MindBillAgingBucketId | "total";
  count: number;
  balance: number;
  bills: MindBillDashboardBill[];
};

export type MindBillStatusAgingRow = {
  state: string;
  label: string;
  cells: MindBillStatusAgingCell[];
  total: MindBillStatusAgingCell;
};

export type MindBillStatusAgingMatrix = {
  rows: MindBillStatusAgingRow[];
  columnTotals: MindBillStatusAgingCell[];
  grandTotal: MindBillStatusAgingCell;
};

export const MINDBILL_STATUS_AGING_BUCKETS: { id: MindBillAgingBucketId; label: string }[] = [
  { id: "current", label: "0–30 days" },
  { id: "31-60", label: "31–60 days" },
  { id: "61-90", label: "61–90 days" },
  { id: "91+", label: "91+ days" },
];

const DEFAULT_STATE_ORDER = [
  "draft", "incomplete", "created", "sent", "submitted", "accepted", "processed",
  "paid", "underpaid", "denied", "rejected", "appealing", "second_review", "ibr", "lien", "closed",
];

const agingDays = (bill: MindBillDashboardBill, now: Date): number => {
  if (bill.agingDays != null) return Math.max(0, Math.floor(bill.agingDays));
  const source = bill.submittedAt ?? bill.updatedAt;
  if (!source) return 0;
  const time = new Date(source).getTime();
  return Number.isFinite(time) ? Math.max(0, Math.floor((now.getTime() - time) / 86_400_000)) : 0;
};

const agingBucketIndex = (days: number): number => (days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3);

const stateLabel = (state: string) => state.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const emptyCell = (state: string, bucket: MindBillAgingBucketId | "total"): MindBillStatusAgingCell => ({ state, bucket, count: 0, balance: 0, bills: [] });

export function buildMindBillStatusAgingMatrix(
  bills: MindBillDashboardBill[],
  stateOrder: string[] = DEFAULT_STATE_ORDER,
  now = new Date(),
): MindBillStatusAgingMatrix {
  const orderIndex = new Map(stateOrder.map((state, index) => [state.toLowerCase(), index]));
  const states = [...new Set(bills.map((bill) => bill.state))].sort((a, b) => {
    const left = orderIndex.get(a.toLowerCase()) ?? stateOrder.length;
    const right = orderIndex.get(b.toLowerCase()) ?? stateOrder.length;
    return left - right || a.localeCompare(b);
  });
  const columnTotals = MINDBILL_STATUS_AGING_BUCKETS.map((bucket) => emptyCell("all", bucket.id));
  const grandTotal = emptyCell("all", "total");
  const rows = states.map((state) => ({
    state,
    label: stateLabel(state),
    cells: MINDBILL_STATUS_AGING_BUCKETS.map((bucket) => emptyCell(state, bucket.id)),
    total: emptyCell(state, "total"),
  }));
  const rowByState = new Map(rows.map((row) => [row.state, row]));
  for (const bill of bills) {
    const row = rowByState.get(bill.state)!;
    const bucketIndex = agingBucketIndex(agingDays(bill, now));
    for (const cell of [row.cells[bucketIndex]!, row.total, columnTotals[bucketIndex]!, grandTotal]) {
      cell.count += 1;
      cell.balance += bill.balanceDue;
      cell.bills.push(bill);
    }
  }
  return { rows, columnTotals, grandTotal };
}

export function buildMindBillStatusAgingCsv(bills: MindBillDashboardBill[], stateOrder?: string[]): string {
  const matrix = buildMindBillStatusAgingMatrix(bills, stateOrder);
  const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const header = ["Status", ...MINDBILL_STATUS_AGING_BUCKETS.map((bucket) => bucket.label), "Total"];
  const lines = matrix.rows.map((row) => [row.label, ...row.cells.map((cell) => cell.count), row.total.count]);
  lines.push(["Total", ...matrix.columnTotals.map((cell) => cell.count), matrix.grandTotal.count]);
  return [header, ...lines].map((line) => line.map(quote).join(",")).join("\n");
}
