// @vitest-environment happy-dom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { BillingDashboard, type BillingDashboardBill } from "../packages/react/src/billing-dashboard";
import { ConnectedBillSearch } from "../packages/react/src/connected-billing-workspace";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const bills: BillingDashboardBill[] = [
  { id: "bill-one", patientId: "patient-one", patientName: "Alex Example", claimsAdministratorId: "admin-one", payerName: "Northstar Claims", renderingProviderId: "doctor-one", renderingProviderName: "Dr. Example", state: "paid", totalCharge: 100, totalPaid: 100, balanceDue: 0 },
  { id: "bill-two", patientId: "patient-two", patientName: "Alex Example", claimsAdministratorId: "admin-two", payerName: "Harbor Claims", renderingProviderId: "doctor-two", renderingProviderName: "Dr. Sample", state: "draft", totalCharge: 200, totalPaid: 0, balanceDue: 200 },
];
async function mounted(element: ReactElement, run: (container: HTMLDivElement) => Promise<void>) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try { await act(async () => root.render(element)); await run(container); }
  finally { await act(async () => root.unmount()); container.remove(); }
}
function select(container: HTMLElement, label: string) { return container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!; }
async function change(element: HTMLSelectElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function clear(container: HTMLElement) {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent === "Clear filters")!;
  await act(async () => button.click());
}

describe("bill entity filters", () => {
  it("distinguishes same-named patients by stable IDs and combines entity and status filters", async () => {
    await mounted(createElement(BillingDashboard, { bills }), async (container) => {
      const patient = select(container, "Patient filter");
      expect([...patient.options].map((item) => item.value)).toEqual(["", "id:patient-one", "id:patient-two"]);
      await change(patient, "id:patient-one");
      expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
      expect(container.querySelector("tbody")?.textContent).toContain("Northstar Claims");
      expect(select(container, "Claims administrator filter").options).toHaveLength(3);
      await change(select(container, "Rendering provider filter"), "id:doctor-two");
      expect(container.textContent).toContain("No bills match these filters.");
      await change(select(container, "Rendering provider filter"), "id:doctor-one");
      await change(select(container, "Claims administrator filter"), "id:admin-one");
      await change(select(container, "Filter bills by status"), "draft");
      expect(container.textContent).toContain("No bills match these filters.");
      await clear(container);
      expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
      expect(patient.value).toBe("");
    });
  });
  it("supports host-supplied names when optional entity IDs are unavailable", async () => {
    const namedBills = bills.map((bill) => {
      const copy = { ...bill };
      delete copy.patientId; delete copy.claimsAdministratorId; delete copy.renderingProviderId;
      return copy;
    });
    await mounted(createElement(BillingDashboard, { bills: namedBills }), async (container) => {
      await change(select(container, "Rendering provider filter"), "name:Dr. Sample");
      expect(container.querySelector("tbody")?.textContent).toContain("Harbor Claims");
      expect(container.querySelector("tbody")?.textContent).not.toContain("Northstar Claims");
      expect(select(container, "Patient filter").options).toHaveLength(2);
    });
  });
  it("uses full server inventories, serializes stable entity IDs, resets pagination, and clears all filters", async () => {
    const queries: Record<string, string>[] = [];
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      queries.push(Object.fromEntries(new URL(String(input)).searchParams));
      return Response.json({ data: { items: [], total: 0, balanceTotal: 0, page: 1, pageSize: 25, filters: {
        patients: [{ id: "patient-one", name: "Alex Example" }, { id: "patient-two", name: "Alex Example" }],
        claimsAdministrators: [{ id: "admin-one", name: "Northstar Claims" }],
        renderingProviders: [{ id: "doctor-one", name: "Dr. Example" }],
      } } });
    });
    await mounted(createElement(ConnectedBillSearch, { fetch: fetcher, getSession: async () => ({ token: "synthetic" }), initialQuery: { page: 4 } }), async (container) => {
      expect(select(container, "Patient filter").options).toHaveLength(3);
      await change(select(container, "Patient filter"), "patient-two");
      await change(select(container, "Claims administrator filter"), "admin-one");
      await change(select(container, "Rendering provider filter"), "doctor-one");
      expect(queries.at(-1)).toMatchObject({ patientId: "patient-two", claimsAdminId: "admin-one", renderingProviderId: "doctor-one", page: "1" });
      expect(select(container, "Patient filter").options).toHaveLength(3);
      await clear(container);
      expect(queries.at(-1)).not.toHaveProperty("patientId");
      expect(queries.at(-1)).not.toHaveProperty("claimsAdminId");
      expect(queries.at(-1)).not.toHaveProperty("renderingProviderId");
    });
  });
  it("keeps initial selected identities visible when absent from returned inventories", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ data: { items: [], total: 0, balanceTotal: 0, page: 1, pageSize: 25, filters: { patients: [], claimsAdministrators: [], renderingProviders: [] } } }));
    await mounted(createElement(ConnectedBillSearch, { fetch: fetcher, getSession: async () => ({ token: "synthetic" }), initialQuery: { patientId: "patient-archived", claimsAdministrator: "admin-archived" } }), async (container) => {
      expect(select(container, "Patient filter").value).toBe("patient-archived");
      expect(select(container, "Patient filter").selectedOptions[0]?.textContent).toBe("Selected patient");
      expect(select(container, "Claims administrator filter").value).toBe("admin-archived");
    });
  });
});
