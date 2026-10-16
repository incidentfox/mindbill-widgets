// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { rfaReadDecisionDefault } from "../packages/react/src/rfa-lifecycle-controls";
import { BillReadOnlyForm } from "../packages/react/src/bill-read-only-form";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const local = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

it("defaults a date-only UR letter to the start of that day, never later than now", () => {
  const now = new Date(2026, 9, 16, 5, 30);
  expect(rfaReadDecisionDefault({ decidedOn: "2026-10-14" }, now)).toBe(local(new Date(2026, 9, 14, 0, 0)));
  // Older servers send the letter date as 19:00Z on that date.
  expect(rfaReadDecisionDefault({ decidedAt: "2026-10-14T19:00:00.000Z" }, now)).toBe(local(new Date(2026, 9, 14, 0, 0)));
  // Today's letter starts at midnight, which is before now.
  expect(rfaReadDecisionDefault({ decidedAt: "2026-10-16T19:00:00.000Z" }, now)).toBe(local(new Date(2026, 9, 16, 0, 0)));
  // A future date is clamped to now.
  expect(rfaReadDecisionDefault({ decidedOn: "2026-10-20" }, now)).toBe(local(now));
  // A real time is kept unless it is in the future.
  expect(rfaReadDecisionDefault({ decidedAt: new Date(2026, 9, 15, 9, 15).toISOString() }, now)).toBe(local(new Date(2026, 9, 15, 9, 15)));
  expect(rfaReadDecisionDefault({ decidedAt: new Date(2026, 9, 16, 9, 15).toISOString() }, now)).toBe(local(now));
  expect(rfaReadDecisionDefault(null, now)).toBe("");
  // Never before the request was sent or received that same day.
  const sent = new Date(2026, 9, 16, 5, 2, 30);
  expect(rfaReadDecisionDefault({ decidedOn: "2026-10-16" }, now, sent.toISOString())).toBe(local(new Date(2026, 9, 16, 5, 3)));
  expect(rfaReadDecisionDefault({ decidedOn: "2026-10-16" }, new Date(2026, 9, 16, 5, 2, 40), sent.toISOString())).toBe(local(new Date(2026, 9, 16, 5, 2, 40)));
});

it("shows charge, expected, paid and balance so the balance is never mistaken for the charge", async () => {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const data = {
    bill: { id: "bill_synthetic", billNumber: 1, status: "sent", billingMode: "professional", dos: "2026-10-16", lineItems: [{ code: "64483", modifiers: [], units: 1, charge: 650 }], attachments: [], totalCharge: 650, totalPaid: 0, balanceDue: 458.34 },
    patient: { name: "Synthetic Patient" }, injury: { claimNumber: "SYN-1", diagnosisCodes: [] },
  };
  try {
    await act(async () => root.render(createElement(BillReadOnlyForm, { data: data as never, expectedAmount: 458.34 })));
    const totals = container.querySelector(".mb-read-total")!.textContent!;
    expect(totals).toContain("Charge$650.00");
    expect(totals).toContain("Expected (OMFS)$458.34");
    expect(totals).toContain("Paid$0.00");
    expect(totals).toContain("Balance (expected − paid)$458.34");
    await act(async () => root.render(createElement(BillReadOnlyForm, { data: data as never })));
    expect(container.querySelector(".mb-read-total")!.textContent).not.toContain("Expected");
  } finally { await act(async () => root.unmount()); container.remove(); }
});
