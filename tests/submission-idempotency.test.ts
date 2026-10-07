// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { BillSubmissionForm, setBillSubmissionServiceDate, type BillSubmissionInput } from "../packages/react/src/bill-submission-form";

const { submitBill, previewCms1500 } = vi.hoisted(() => ({
  submitBill: vi.fn().mockResolvedValue({ bill: { id: "synthetic-bill" } }),
  previewCms1500: vi.fn().mockResolvedValue(new Blob(["synthetic pdf"], { type: "application/pdf" })),
}));
vi.mock("@mindbill/browser", async (original) => ({
  ...await original<typeof import("@mindbill/browser")>(),
  createBillSubmissionClient: () => ({ submitBill, previewCms1500 }),
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
      profileOptions: {}, // A scoped host supplies its permitted options; do not read organization profiles.
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

it("previews the current CMS-1500 above submit without submitting", async () => {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:synthetic-preview");
  try {
    submitBill.mockClear(); previewCms1500.mockClear();
    await act(async () => root.render(createElement(BillSubmissionForm, {
      initialBill: { ...validBill, serviceLines: [{ code: "ML201", units: 1, serviceDate: "2026-08-23", serviceDateEnd: "2026-08-23" }] },
      profileOptions: {},
      getSession: async () => ({ token: "synthetic-token" }),
      fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: [] })),
      deliveryRoutePicker: "off",
    })));
    const previewButton = [...container.querySelectorAll("button")].find(button => button.textContent === "Preview CMS-1500");
    const submitButton = container.querySelector("button[type=submit]");
    expect(previewButton).toBeDefined();
    expect(submitButton).not.toBeNull();
    expect(previewButton!.compareDocumentPosition(submitButton!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await act(async () => previewButton!.click());
    expect(previewCms1500).toHaveBeenCalledWith(expect.objectContaining({ externalId: validBill.externalId }));
    expect(submitBill).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(container.querySelector('iframe[title="CMS-1500 PDF preview"]')?.getAttribute("src")).toBe("blob:synthetic-preview");
    expect(container.querySelector('a[download="cms-1500-preview.pdf"]')).not.toBeNull();
    const serviceDate = container.querySelector<HTMLInputElement>('input[aria-label="Date of service"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(serviceDate, "08/25/2026");
      serviceDate.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Preview out of date");
    const refresh = [...container.querySelectorAll("button")].find(button => button.textContent === "Refresh CMS-1500 preview")!;
    await act(async () => refresh.click());
    expect(previewCms1500).toHaveBeenLastCalledWith(expect.objectContaining({ service: { date: "2026-08-25" }, serviceLines: [expect.objectContaining({ serviceDate: "2026-08-25", serviceDateEnd: "2026-08-25" })] }));
    expect(container.querySelector('iframe')).not.toBeNull();
    expect(submitBill).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount()); container.remove();
    open.mockRestore(); createObjectURL.mockRestore();
  }
});

it("preserves distinct service dates and ranges when editing the bill date", () => {
  const bill = { ...validBill, serviceLines: [
    { code: "ML201", units: 1, serviceDate: validBill.service.date },
    { code: "ML203", units: 1, serviceDate: "2026-08-20", serviceDateEnd: "2026-08-22" },
  ] };
  const next = setBillSubmissionServiceDate(bill, "2026-08-25");
  expect(next.serviceLines[0]!.serviceDate).toBe("2026-08-25");
  expect(next.serviceLines[1]).toEqual(bill.serviceLines[1]);
  expect(bill.service.date).toBe("2026-08-24");
});
