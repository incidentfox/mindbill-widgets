// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import type { BillLifecycleData } from "../packages/browser/src/index";
import { ConnectedBillLifecycle, billLifecycleValidationIssues } from "../packages/react/src/connected-bill-lifecycle";
const data = {
  bill: { id: "synthetic_bill", billingMode: "professional", dos: "", attachments: [], lineItems: [] },
  patient: { name: "Synthetic Patient" }, injury: {},
  lifecycle: { state: "rejected", actions: [{ id: "resubmit", enabled: true }] },
  rejection: { reason: "Review fields", issues: [{ description: "The payer requires a corrected birth date.", fieldPaths: ["patient.dateOfBirth"] }] },
} as unknown as BillLifecycleData;
it("groups current editable rejection and correction validation by section", () => {
  const issues = billLifecycleValidationIssues(data)!;
  expect(issues.patient?.map(issue => issue.message)).toContain("The payer requires a corrected birth date.");
  expect(issues.patient?.map(issue => issue.message)).toContain("Enter the patient's date of birth.");
  expect(issues.claim?.length).toBeGreaterThan(0);
  expect(issues.providers?.length).toBeGreaterThan(0);
  expect(issues.services?.map(issue => issue.message)).toContain("Add at least one service line");
});
it("does not apply current submission requirements to paid, imported or noneditable records", () => {
  for (const state of ["paid", "accepted", "submitted", "closed", "imported"]) {
    expect(billLifecycleValidationIssues({ ...data, lifecycle: { ...data.lifecycle, state } })).toBeUndefined();
  }
  expect(billLifecycleValidationIssues({ ...data, lifecycle: { ...data.lifecycle, actions: [] } })).toBeUndefined();
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("renders default errors without host wiring and honors an explicit empty override", async () => {
  const container = document.createElement("div"); const root = createRoot(container);
  const record = { ...data, environment: "sandbox", bill: { ...data.bill, totalCharge: 0, balanceDue: 0 }, eors: [], payments: [], activity: [], history: [], remittance: { payerReportedPaid: null, postedPrincipal: 0 }, delivery: { contacts: {} } };
  const props = { billId: "synthetic_bill", refreshInterval: 0, getSession: async () => ({ token: "synthetic-only" }), fetch: async () => Response.json({ data: record }) };
  try {
    await act(async () => root.render(createElement(ConnectedBillLifecycle, props)));
    expect(container.querySelector('[aria-label="Bill details"]')?.textContent).toContain("Enter the patient's date of birth.");
    await act(async () => root.render(createElement(ConnectedBillLifecycle, { ...props, validationIssues: {} })));
    expect(container.querySelector('[aria-label="Bill details"]')?.textContent).not.toContain("Enter the patient's date of birth.");
  } finally { await act(async () => root.unmount()); }
});
