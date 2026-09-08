// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { BillSubmissionForm, type BillSubmissionInput } from "../packages/react/src/bill-submission-form";

const { submitBill } = vi.hoisted(() => ({ submitBill: vi.fn().mockResolvedValue({ bill: { id: "synthetic-bill" } }) }));
vi.mock("@mindbill/browser", async (original) => ({
  ...await original<typeof import("@mindbill/browser")>(),
  createBillSubmissionClient: () => ({ submitBill }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const validBill = {
    externalId: "evaluation_123",
    billingMode: "med_legal",
    patient: {
      firstName: "Ada",
      lastName: "Example",
      dateOfBirth: "1980-01-02",
      address: {
        line1: "100 Main Street",
        city: "Sacramento",
        state: "CA",
        postalCode: "95814",
      },
    },
    claim: {
      claimNumber: "CLAIM-7",
      employer: "Synthetic Foods",
      dateOfInjury: "2026-08-01",
      claimsAdministrator: { id: "payer_7", name: "Synthetic Claims Administrator" },
    },
    service: { date: "2026-08-24" },
    billingProvider: {
      name: "Synthetic Medical Group",
      taxId: "123456789",
      npi: "1234567890",
      phone: "9165550100",
      address: {
        line1: "200 Billing Avenue",
        city: "Sacramento",
        state: "CA",
        postalCode: "95814",
      },
    },
    renderingProvider: {
      name: "Ada Physician",
      npi: "1098765432",
      taxonomy: "2084P0800X",
    },
    serviceLocation: {
      name: "Sacramento Exam Office",
      placeOfServiceCode: "11",
      address: {
        line1: "300 Service Street",
        city: "Sacramento",
        state: "CA",
        postalCode: "95814",
      },
    },
    diagnoses: ["M79.641"],
    serviceLines: [{ code: "ML201", units: 1 }],
  } satisfies BillSubmissionInput;

it("forwards a persisted host key when the connected form is submitted and retried", async () => {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: [] }));
    await act(async () => root.render(createElement(BillSubmissionForm, {
      initialBill: validBill,
      idempotencyKey: "host-case-persisted-key",
      getSession: async () => ({ token: "synthetic-token" }),
      fetch: fetcher, deliveryRoutePicker: "off",
    })));
    for (let attempt = 0; attempt < 2; attempt++) {
      await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    }
    expect(submitBill).toHaveBeenCalledTimes(2);
    for (const call of submitBill.mock.calls) expect(call[1]).toEqual({ idempotencyKey: "host-case-persisted-key" });
    expect(submitBill.mock.calls[0]![0]).toMatchObject({ bill: { externalId: validBill.externalId } });
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("billing-profile"))).toBe(false);
  } finally {
    await act(async () => root.unmount()); container.remove();
  }
});
