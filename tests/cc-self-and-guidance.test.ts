// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { BillDeliveryOptions } from "@mindbill/browser";
import { SendRouteDialog, type SendRouteSubmission } from "../packages/react/src/send-route-dialog";
import { BillCourtesyCopyForm } from "../packages/react/src/bill-courtesy-copy-form";
import { BillSubmissionForm, type BillSubmissionInput } from "../packages/react/src/bill-submission-form";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function render(element: ReturnType<typeof createElement>) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, unmount: async () => { await act(async () => root.unmount()); container.remove(); } };
}

const delivery = {
  payerName: "Synthetic Claims", recommended: { route: "email" },
  options: [{ route: "email", label: "Email" }],
  contacts: { claimsEmail: "claims@example.test" },
} as unknown as BillDeliveryOptions;

const ccSelfLabel = (container: HTMLElement) =>
  [...container.querySelectorAll("label")].find((label) => label.textContent?.startsWith("CC me"));

describe("CC me", () => {
  it("copies the sender on an emailed bill only when checked", async () => {
    const onConfirm = vi.fn<(submission: SendRouteSubmission) => void>();
    const view = await render(createElement(SendRouteDialog, { delivery, ccSelfEmail: "biller@example.test", onCancel: () => undefined, onConfirm }));
    try {
      const label = ccSelfLabel(view.container)!;
      expect(label.textContent).toContain("biller@example.test");
      const confirm = view.container.querySelector<HTMLButtonElement>(".mbrd-confirm")!;
      await act(async () => { confirm.click(); });
      expect(onConfirm.mock.calls[0]![0].cc).toBeUndefined();
      await act(async () => { label.querySelector("input")!.click(); });
      await act(async () => { confirm.click(); });
      expect(onConfirm.mock.calls[1]![0].cc).toEqual(["biller@example.test"]);
    } finally { await view.unmount(); }
  });

  it("is absent without a sender email", async () => {
    const view = await render(createElement(SendRouteDialog, { delivery, onCancel: () => undefined, onConfirm: () => undefined }));
    try { expect(ccSelfLabel(view.container)).toBeUndefined(); } finally { await view.unmount(); }
  });

  it("is offered on the courtesy copy form", async () => {
    const onPreview = vi.fn(async () => { throw new Error("stop"); });
    const view = await render(createElement(BillCourtesyCopyForm, {
      documents: [], environment: "sandbox", ccSelfEmail: "biller@example.test",
      onPreview, onSend: async () => { throw new Error("unused"); },
    }));
    try {
      const label = ccSelfLabel(view.container)!;
      expect(label).toBeDefined();
      await act(async () => { (label.querySelector("input,button,[role=checkbox]") as HTMLElement).click(); });
      const to = view.container.querySelector<HTMLInputElement>("input[required]")!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(to, "adjuster@example.test");
        to.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => { view.container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
      expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ cc: ["biller@example.test"] }));
    } finally { await view.unmount(); }
  });
});

describe("guidance", () => {
  const address = { line1: "100 Synthetic Way", city: "Sacramento", state: "CA", postalCode: "95814" };
  const bill: BillSubmissionInput = {
    externalId: "synthetic-guidance", billingMode: "med_legal",
    patient: { firstName: "Ada", lastName: "Example", dateOfBirth: "1980-01-02", address },
    claim: { claimNumber: "SYN-1", employer: "Synthetic Foods", dateOfInjury: "2026-08-01", injuryState: "CA" },
    service: { date: "2026-10-14" },
    billingProvider: { name: "Synthetic Practice", taxId: "123456789", npi: "1234567890", phone: "2135550100", address },
    renderingProvider: { name: "Ada Evaluator", npi: "1098765432", taxonomy: "103T00000X" },
    serviceLocation: { name: "Sacramento", placeOfServiceCode: "11", address },
    diagnoses: ["Z04.6"], serviceLines: [{ code: "ML201", units: 1, modifiers: ["95", "96"] }],
  };

  it("marks explanatory hints and hides them in minimal mode", async () => {
    const view = await render(createElement(BillSubmissionForm, { initialBill: bill, guidance: "minimal", onSubmit: () => undefined }));
    try {
      const form = view.container.querySelector("form")!;
      expect(form.getAttribute("data-guidance-level")).toBe("minimal");
      expect(form.querySelectorAll("[data-guidance]").length).toBeGreaterThan(0);
      expect(view.container.querySelector("style")!.textContent).toContain('[data-guidance-level="minimal"] [data-guidance]{display:none}');
    } finally { await view.unmount(); }
  });

  it("defaults to full guidance", async () => {
    const view = await render(createElement(BillSubmissionForm, { initialBill: bill, onSubmit: () => undefined }));
    try { expect(view.container.querySelector("form")!.getAttribute("data-guidance-level")).toBe("full"); } finally { await view.unmount(); }
  });
});
