// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ConnectedBillingWorkspace } from "../packages/react/src/connected-billing-workspace";
import type { ConnectedBillLifecycleProps } from "../packages/react/src/connected-bill-lifecycle";
const lifecycle = vi.hoisted(() => ({ props: null as ConnectedBillLifecycleProps | null }));
vi.mock("../packages/react/src/connected-bill-lifecycle", () => ({ ConnectedBillLifecycle: (props: ConnectedBillLifecycleProps) => { lifecycle.props = props; return createElement("div", null, "Synthetic detail"); } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("drills from details to canonical entity filters and permits host overrides", async () => {
  const container = document.createElement("div"); const root = createRoot(container); const urls: URL[] = [];
  const fetcher: typeof fetch = async input => {
    urls.push(new URL(String(input)));
    return Response.json({ data: { items: [{ id: "bill-synthetic", billNumber: "SYNTHETIC", patientName: "Synthetic patient", status: { id: "draft", label: "Draft" }, procedureCodes: [], totalCharge: 100, balanceDue: 100, renderingProviderName: "Synthetic physician" }], total: 1, balanceTotal: 100, page: 1, pageSize: 25, filters: {} } });
  };
  const props = { initialView: "bills" as const, getSession: async () => ({ token: "synthetic-token" }), fetch: fetcher };
  const open = async () => { await act(async () => container.querySelector<HTMLTableRowElement>("tbody tr")!.click()); expect(container.textContent).toContain("Synthetic detail"); };
  try {
    await act(async () => root.render(createElement(ConnectedBillingWorkspace, props)));
    await open(); expect(lifecycle.props?.requireLinkedEntityIds).toEqual({ patient: true, renderingProvider: true, claimsAdministrator: true });
    await act(async () => lifecycle.props!.onPatientClick!({ id: "patient-synthetic", name: "Synthetic patient" }));
    expect(urls.at(-1)?.searchParams.get("patientId")).toBe("patient-synthetic"); expect(urls.at(-1)?.searchParams.get("page")).toBe("1");
    await open(); await act(async () => lifecycle.props!.onRenderingProviderClick!({ id: "doctor-synthetic", name: "Synthetic physician", specialty: "", npi: "" }));
    expect(urls.at(-1)?.searchParams.get("renderingProviderId")).toBe("doctor-synthetic"); expect(urls.at(-1)?.searchParams.has("patientId")).toBe(false);
    await open(); await act(async () => lifecycle.props!.onClaimsAdministratorClick!({ id: "admin-synthetic", name: "Synthetic administrator" }));
    expect(urls.at(-1)?.searchParams.get("claimsAdminId")).toBe("admin-synthetic");
    const onPatientClick = vi.fn(); await act(async () => root.render(createElement(ConnectedBillingWorkspace, { ...props, onPatientClick })));
    await open(); expect(lifecycle.props?.requireLinkedEntityIds?.patient).toBe(false);
    await act(async () => lifecycle.props!.onPatientClick!({ name: "Legacy patient" })); expect(onPatientClick).toHaveBeenCalledWith({ name: "Legacy patient" });
    expect(container.textContent).toContain("Synthetic detail");
  } finally { await act(async () => root.unmount()); }
});
