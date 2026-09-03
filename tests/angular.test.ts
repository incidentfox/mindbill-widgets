import { describe, expect, it } from "vitest";

import { mindBillAngularAppearanceStyle } from "../packages/angular/src/lib/appearance";
import { billRejectionIssues, billRejectionIssueSummary } from "../packages/angular/src/lib/bill-rejection";
import { ensureTrailingProcedureLine } from "../packages/angular/src/lib/procedure-lines";

describe("Angular bill rejection notice", () => {
  it("preserves ordered actionable issues and clearinghouse context", () => {
    const rejection = {
      reason: "Correct the submitted dates.",
      source: "Jopari",
      issues: [
        { code: "A6:187", description: "From Date of Service cannot be in the future" },
        { code: "A6:88", description: "Thru Date of Service cannot be in the future" },
        { code: "A7:188", description: "Service From date cannot be in the future" },
        { code: "A7:188", description: "Service Thru date cannot be in the future" },
      ],
    };

    const issues = billRejectionIssues(rejection);
    expect(issues.map((issue) => issue.description)).toEqual([
      "From Date of Service cannot be in the future",
      "Thru Date of Service cannot be in the future",
      "Service From date cannot be in the future",
      "Service Thru date cannot be in the future",
    ]);
    expect(billRejectionIssueSummary(rejection, issues.length)).toBe("4 validation errors returned by Jopari.");
    expect(issues.some((issue) => Boolean(issue.code))).toBe(true);
    expect(mindBillAngularAppearanceStyle({ preset: "mindbill" })["--danger"]).toBe("#b63d35");
    expect(billRejectionIssueSummary(rejection, 1)).toBe("1 validation error returned by Jopari.");
  });
});

describe("Angular procedure lines", () => {
  it("keeps one empty row after every entered row", () => {
    expect(ensureTrailingProcedureLine([])).toEqual([
      { code: "", modifiers: [], units: 1, charge: 0 },
    ]);

    expect(ensureTrailingProcedureLine([
      { code: "ML201", modifiers: ["95"], units: 1, charge: 2015 },
      { code: "MLPRR", modifiers: [], units: 3, charge: 0 },
      { code: "", modifiers: [], units: 1, charge: 0 },
      { code: "", modifiers: [], units: 1, charge: 0 },
    ])).toEqual([
      { code: "ML201", modifiers: ["95"], units: 1, charge: 2015 },
      { code: "MLPRR", modifiers: [], units: 3, charge: 0 },
      { code: "", modifiers: [], units: 1, charge: 0 },
    ]);
  });

  it("treats modifiers and non-default units as partial input", () => {
    expect(ensureTrailingProcedureLine([
      { code: "", modifiers: ["93"], units: 1, charge: 0 },
    ])).toHaveLength(2);
    expect(ensureTrailingProcedureLine([
      { code: "", modifiers: [], units: 2, charge: 0 },
    ])).toHaveLength(2);
  });
});

describe("Angular bill tasks dashboard", () => {
  it("shares the browser builder and produces typed click-through cells", async () => {
    const { mindBillBillTasksCell, mindBillBillTasksTone } = await import("../packages/angular/src/lib/bill-tasks-dashboard");
    const { BILL_TASKS_AGING_BUCKETS, buildBillTasksDashboard } = await import("../packages/browser/src/index");

    const data = buildBillTasksDashboard(
      [{ sectionId: "payment_due", rowId: "no_response", rowLabel: "No payer response", ageDays: 45, ref: "bill_a" }],
      [{ id: "payment_due", label: "Payment Due", agingBasisLabel: "Bill Sent Date", tone: "violet" }],
    );
    const section = data.sections[0]!;
    const row = section.rows[0]!;

    expect(mindBillBillTasksTone(section.tone)).toBe("#7c53c3");
    expect(mindBillBillTasksCell(section, row, 1, BILL_TASKS_AGING_BUCKETS)).toEqual({
      sectionId: "payment_due",
      rowId: "no_response",
      bucketId: "31-60",
      refs: ["bill_a"],
      count: 1,
    });
    expect(mindBillBillTasksCell(section, row, null, BILL_TASKS_AGING_BUCKETS)).toEqual({
      sectionId: "payment_due",
      rowId: "no_response",
      bucketId: null,
      refs: ["bill_a"],
      count: 1,
    });
  });
});
