import { describe, expect, it } from "vitest";

import {
  buildBillStatusAgingCsv,
  buildBillStatusAgingMatrix,
} from "../packages/react/src/status-aging-matrix";
import type { BillingDashboardBill } from "../packages/react/src/billing-dashboard";
import {
  buildMindBillStatusAgingCsv,
  buildMindBillStatusAgingMatrix,
} from "../packages/angular/src/lib/status-aging-matrix";

const bill = (overrides: Partial<BillingDashboardBill>): BillingDashboardBill => ({
  id: `bill_${Math.random().toString(36).slice(2)}`,
  patientName: "Sample Patient",
  state: "sent",
  totalCharge: 100,
  totalPaid: 0,
  balanceDue: 100,
  ...overrides,
});

const fixtures = [
  bill({ id: "b1", state: "sent", agingDays: 4, balanceDue: 150 }),
  bill({ id: "b2", state: "sent", agingDays: 45, balanceDue: 250 }),
  bill({ id: "b3", state: "denied", agingDays: 95, balanceDue: 500 }),
  bill({ id: "b4", state: "closed", agingDays: 200, balanceDue: 0 }),
  bill({ id: "b5", state: "accepted", agingDays: 70, balanceDue: 320 }),
  bill({ id: "b6", state: "custom_partner_state", agingDays: 10, balanceDue: 75 }),
];

describe("React status × aging matrix", () => {
  it("buckets bills by lifecycle state and aging days with totals", () => {
    const matrix = buildBillStatusAgingMatrix(fixtures);
    expect(matrix.rows.map((row) => row.state)).toEqual([
      "sent", "accepted", "denied", "closed", "custom_partner_state",
    ]);
    const sent = matrix.rows[0]!;
    expect(sent.cells.map((cell) => cell.count)).toEqual([1, 1, 0, 0]);
    expect(sent.total.count).toBe(2);
    expect(sent.total.balance).toBe(400);
    const denied = matrix.rows.find((row) => row.state === "denied")!;
    expect(denied.cells[3]!.count).toBe(1);
    expect(denied.cells[3]!.bills[0]!.id).toBe("b3");
    expect(matrix.columnTotals.map((cell) => cell.count)).toEqual([2, 1, 1, 2]);
    expect(matrix.grandTotal.count).toBe(6);
    expect(matrix.grandTotal.balance).toBe(1295);
  });

  it("falls back to submittedAt when agingDays is absent", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    const matrix = buildBillStatusAgingMatrix(
      [bill({ id: "b7", state: "sent", submittedAt: "2026-07-01T00:00:00Z" })],
      undefined,
      now,
    );
    expect(matrix.rows[0]!.cells.map((cell) => cell.count)).toEqual([0, 0, 1, 0]);
  });

  it("exports a CSV with header, per-state rows, and a totals row", () => {
    const csv = buildBillStatusAgingCsv(fixtures);
    const lines = csv.split("\n");
    expect(lines[0]).toBe('"Status","0–30 days","31–60 days","61–90 days","91+ days","Total"');
    expect(lines[1]).toBe('"Sent","1","1","0","0","2"');
    expect(lines.at(-1)).toBe('"Total","2","1","1","2","6"');
  });
});

describe("Angular status × aging matrix", () => {
  it("matches the React matrix shape for the same input", () => {
    const angular = buildMindBillStatusAgingMatrix(fixtures);
    const react = buildBillStatusAgingMatrix(fixtures);
    expect(angular.rows.map((row) => [row.state, row.total.count])).toEqual(
      react.rows.map((row) => [row.state, row.total.count]),
    );
    expect(angular.columnTotals.map((cell) => cell.count)).toEqual(
      react.columnTotals.map((cell) => cell.count),
    );
    expect(buildMindBillStatusAgingCsv(fixtures)).toBe(buildBillStatusAgingCsv(fixtures));
  });

  it("respects a custom state order", () => {
    const matrix = buildMindBillStatusAgingMatrix(fixtures, ["denied", "sent"]);
    expect(matrix.rows[0]!.state).toBe("denied");
    expect(matrix.rows[1]!.state).toBe("sent");
  });
});
