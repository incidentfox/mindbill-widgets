// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { BillDetailLayout, BillDetailSection } from "../packages/react/src/bill-detail-layout";
import { BillReadOnlyForm } from "../packages/react/src/bill-read-only-form";
import type { HistoricalBillReviewData } from "../packages/browser/src/index";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("keeps errors and warnings distinct and preserves host editing/actions", async () => {
  const container = document.createElement("div"); const root = createRoot(container); const action = vi.fn();
  try {
    await act(async () => root.render(createElement(BillDetailLayout, { header: "Synthetic bill", sidebar: "History", children: createElement(BillDetailSection, {
      title: "Patient", headerClassName: "host-header", bodyClassName: "host-body", validationIssues: [{ severity: "error", message: "Date of birth is required" }, { severity: "warning", message: "Confirm address" }], actions: createElement("button", { onClick: action }, "Edit"), children: createElement("input", { defaultValue: "Synthetic patient" }),
    }) })));
    const section = container.querySelector("section")!;
    expect(section.className).toContain("mb-detail-section-error");
    expect(container.querySelector('[aria-label="Errors"]')?.textContent).toContain("Date of birth is required");
    expect(container.querySelector('[aria-label="Warnings"]')?.textContent).toContain("Confirm address");
    expect(container.querySelector(".host-header")).not.toBeNull(); expect(container.querySelector(".host-body input")).not.toBeNull();
    expect(container.querySelector("aside")?.textContent).toBe("History");
    await act(async () => container.querySelector("button")!.click()); expect(action).toHaveBeenCalledOnce();
    await act(async () => root.render(createElement(BillDetailSection, { title: "Patient", validationIssues: [{ severity: "warning", message: "Confirm address" }], children: "Values" })));
    expect(container.querySelector("section")?.className).toContain("mb-detail-section-warning"); expect(container.querySelector('[aria-label="Errors"]')).toBeNull();
  } finally { await act(async () => root.unmount()); }
});

const detail: HistoricalBillReviewData = {
  bill: { id: "bill_synthetic", billNumber: "SYNTHETIC", status: "draft", billingMode: "professional", dos: "2026-09-01", billingSnapshot: { renderingProvider: { id: "provider_synthetic", name: "Synthetic physician", npi: "1234567893", specialty: "Test" } }, lineItems: [], attachments: [], totalCharge: 0, totalPaid: 0, balanceDue: 0 },
  patient: { id: "patient_synthetic", name: "Synthetic patient" }, injury: { claimsAdminId: "admin_synthetic", claimsAdminName: "Synthetic administrator" },
};
it("returns canonical entity references on opt-in links while retaining administrator contacts", async () => {
  const container = document.createElement("div"); const root = createRoot(container);
  const onPatientClick = vi.fn(); const onRenderingProviderClick = vi.fn(); const onClaimsAdministratorClick = vi.fn();
  try {
    await act(async () => root.render(createElement(BillReadOnlyForm, { data: detail, onPatientClick, onRenderingProviderClick, onClaimsAdministratorClick, validationIssues: { services: [{ severity: "error", message: "Add a service line" }] } })));
    const button = (label: string) => [...container.querySelectorAll("button")].find((entry) => entry.textContent === label)!;
    for (const label of ["Synthetic patient", "Synthetic physician", "Synthetic administrator"]) await act(async () => button(label).click());
    expect(onPatientClick).toHaveBeenCalledWith(detail.patient); expect(onRenderingProviderClick).toHaveBeenCalledWith(detail.bill.billingSnapshot?.renderingProvider);
    expect(onClaimsAdministratorClick).toHaveBeenCalledWith({ id: "admin_synthetic", name: "Synthetic administrator" });
    const error = container.querySelector('[aria-label="Errors"]')!; expect(error.textContent).toContain("Add a service line"); expect(error.closest("section")?.querySelector("h3")?.textContent).toBe("Service lines");
    await act(async () => button("Contact details").click()); expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => root.render(createElement(BillReadOnlyForm, { data: detail })));
    expect(container.querySelectorAll(".mb-read-payer")).toHaveLength(1);
  } finally { await act(async () => root.unmount()); }
});
