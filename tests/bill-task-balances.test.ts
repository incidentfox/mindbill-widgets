import { isValidElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { buildBillTasksDashboard, type BillTasksDashboardData, type BillTasksDashboardSectionInput } from "../packages/browser/src/index";
import { BillTasksDashboard } from "../packages/react/src/bill-tasks-dashboard";

const sections: BillTasksDashboardSectionInput[] = [
  { id: "waiting", label: "Waiting", tone: "blue", agingBasisLabel: "Submission Date" },
  { id: "followup", label: "Follow-up", tone: "green", agingBasisLabel: "EOR Date" },
  { id: "empty", label: "Empty", tone: "neutral", agingBasisLabel: "Date of Service" },
];

function elements(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === "function") return elements((node.type as (props: Record<string, unknown>) => ReactElement)(node.props));
  return [node, ...elements(node.props.children)];
}

describe("bill-task balances", () => {
  it("aggregates balances at row, section, and grand-total levels without changing counts or refs", () => {
    const data = buildBillTasksDashboard([
      { sectionId: "waiting", rowId: "sent", rowLabel: "Sent", ageDays: 1, balanceDue: 120.25, ref: "bill_a" },
      { sectionId: "waiting", rowId: "sent", rowLabel: "Sent", ageDays: 30, balanceDue: 79.75, ref: "bill_b" },
      { sectionId: "waiting", rowId: "sent", rowLabel: "Sent", ageDays: 31, balanceDue: 50, ref: "bill_c" },
      { sectionId: "waiting", rowId: "accepted", rowLabel: "Accepted", ageDays: 181, balanceDue: 300, ref: "bill_d" },
      { sectionId: "followup", rowId: "denied", rowLabel: "Denied", ageDays: 60, balanceDue: 1000, ref: "bill_e" },
      { sectionId: "unknown", rowId: "ignored", rowLabel: "Ignored", ageDays: 1, balanceDue: 9999 },
    ], sections);
    expect(data.sections[0]?.rows[0]).toMatchObject({ counts: [2, 1, 0, 0, 0], total: 3,
      balances: [200, 50, 0, 0, 0], balanceTotal: 250, refs: [["bill_a", "bill_b"], ["bill_c"], [], [], []] });
    expect(data.sections[0]).toMatchObject({ totals: [2, 1, 0, 0, 1], total: 4, balanceTotals: [200, 50, 0, 0, 300], balanceTotal: 550 });
    expect(data).toMatchObject({ grandTotals: [2, 2, 0, 0, 1], grandTotal: 5, grandBalanceTotals: [200, 1050, 0, 0, 300], grandBalanceTotal: 1550 });
    expect(data.sections[2]).toMatchObject({ empty: true, rows: [], balanceTotals: [0, 0, 0, 0, 0], balanceTotal: 0 });
  });

  it("supports custom buckets, credits, and missing or non-finite balances", () => {
    const data = buildBillTasksDashboard([undefined, NaN, Infinity, -25, 0, 125].map((balanceDue, index) => ({
      sectionId: "waiting", rowId: "sent", rowLabel: "Sent", ageDays: index, ...(balanceDue === undefined ? {} : { balanceDue }),
    })), sections, [{ id: "all", label: "All", minDays: 0, maxDays: null }]);
    expect(data).toMatchObject({ grandTotal: 6, grandTotals: [6], grandBalanceTotal: 100, grandBalanceTotals: [100] });
    expect(data.sections[0]?.rows[0]).toMatchObject({ balances: [100], balanceTotal: 100 });
  });

  it("sums work items rather than deduplicating repeated bill references across categories", () => {
    const data = buildBillTasksDashboard(["waiting", "followup"].map((sectionId) => ({
      sectionId, rowId: "row", rowLabel: "Row", ageDays: 1, balanceDue: 200, ref: "bill_shared",
    })), sections);
    expect(data.grandTotal).toBe(2);
    expect(data.grandBalanceTotal).toBe(400);
  });

  it("renders dollar sums beneath counts, with accessible labels and unchanged drilldown payloads", () => {
    const data = buildBillTasksDashboard([
      { sectionId: "waiting", rowId: "sent", rowLabel: "Sent", ageDays: 1, balanceDue: 1234.5, ref: "bill_a" },
    ], sections);
    const onSelectCell = vi.fn();
    const rendered = elements(BillTasksDashboard({ data, onSelectCell, itemLabel: "bills" }));
    const balances = rendered.filter((element) => element.props.className === "mbtk-bal");
    expect(balances.map((element) => element.props.children)).toEqual(Array(6).fill("$1,234.50"));
    const totalButton = rendered.find((element) => element.props["aria-label"] === "Sent · all ages: 1 bills · $1,234.50 due");
    expect(totalButton).toBeDefined();
    (totalButton!.props.onClick as () => void)();
    expect(onSelectCell).toHaveBeenCalledWith({ sectionId: "waiting", rowId: "sent", bucketId: null, refs: ["bill_a"], count: 1 });
  });

  it("continues to accept and render older count-only payloads without inventing dollar amounts", () => {
    const data: BillTasksDashboardData = {
      sections: [{ ...sections[0]!, empty: false, rows: [{ id: "sent", label: "Sent", counts: [1, 0, 0, 0, 0], total: 1, refs: [["bill_a"], [], [], [], []] }], totals: [1, 0, 0, 0, 0], total: 1 }],
      grandTotals: [1, 0, 0, 0, 0], grandTotal: 1,
    };
    const rendered = elements(BillTasksDashboard({ data, onSelectCell: () => undefined }));
    expect(rendered.some((element) => element.props.className === "mbtk-bal")).toBe(false);
    expect(rendered.some((element) => element.props["aria-label"] === "Sent · all ages: 1 tasks")).toBe(true);
  });
});
