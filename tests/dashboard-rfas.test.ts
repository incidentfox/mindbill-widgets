// @vitest-environment happy-dom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { BillingDashboard } from "../packages/react/src/billing-dashboard";
import { ConnectedBillingWorkspace } from "../packages/react/src/connected-billing-workspace";
import type { RfaDashboardProps } from "../packages/react/src/rfa-dashboard";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const initialDraft = { claimId: "claim_synthetic", patientId: "patient_synthetic", renderingProviderId: "provider_synthetic", employeeName: "Synthetic patient", providerName: "Synthetic physician", items: [{ diagnosisCode: "M54.5", serviceDescription: "Synthetic treatment" }] };
const record = { ...initialDraft, id: "rfa_synthetic", contentRevision: 1, claimsAdminId: null, status: "draft", reviewType: "prospective", expedited: false, signedAt: null, submittedAt: null, receivedAt: null, createdAt: null, updatedAt: null, decisionDueAt: null, decisionDeadlineBasis: null, incompleteReason: null, deferredReason: null, closedReason: null, readiness: { ready: false, missing: ["physician_signature"] }, documents: [], transmissions: [], informationRequests: [], events: [], items: initialDraft.items.map(item => ({ ...item, id: "item_synthetic", outcome: "pending" })) };
function connection() {
  const getSession = vi.fn(async () => ({ token: "synthetic_token" }));
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), "https://synthetic.example.test");
    if (url.pathname === "/rfa-session") return Response.json({ token: "synthetic_rfa_token" });
    if (url.pathname.endsWith("/bill-dashboard")) return Response.json({ data: { items: [], total: 0, balanceTotal: 0, page: 1, pageSize: 25 } });
    if (url.pathname.endsWith("/bill-tasks")) return Response.json({ data: { dashboard: { sections: [], grandTotals: [], grandTotal: 0 }, filters: { claimsAdministrators: [], renderingProviders: [] } } });
    if (url.pathname.endsWith("/rfas") && init?.method !== "POST") return Response.json({ data: [record], summary: { total: 1, byStatus: { draft: 1 } }, nextCursor: null });
    if (url.pathname.includes("/rfas")) return Response.json({ data: record });
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
  return { getSession, fetch: fetcher, apiBaseUrl: "https://synthetic.example.test" };
}
const tab = (container: HTMLElement, name: string) => [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(item => item.textContent === name);
const button = (container: HTMLElement, name: string) => [...container.querySelectorAll("button")].find(item => item.textContent === name);
async function mounted(element: ReactElement, run: (container: HTMLElement, render: (element: ReactElement) => Promise<void>) => Promise<void>) {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const render = async (next: ReactElement) => { await act(async () => root.render(next)); };
  try { await render(element); await run(container, render); } finally { await act(async () => root.unmount()); container.remove(); }
}

describe.each(["BillingDashboard", "ConnectedBillingWorkspace"] as const)("%s RFA tab", kind => {
  function surface(props: { showRfas?: boolean; rfaDashboard?: RfaDashboardProps }, options = connection()) {
    return kind === "BillingDashboard" ? createElement(BillingDashboard, { bills: [], showSettings: false, ...props }) : createElement(ConnectedBillingWorkspace, { ...options, initialView: "bills", showSettings: false, ...props });
  }
  it("is opt-in and lazily loads with an accessible panel even when Settings is hidden", async () => {
    const options = connection(); const props = { rfaDashboard: options };
    await mounted(surface(props), async (container, render) => {
      expect(tab(container, "Requests for authorization")).toBeUndefined();
      expect(options.fetch).not.toHaveBeenCalled();
      await render(surface({ ...props, showRfas: true }));
      expect(options.fetch).not.toHaveBeenCalled();
      await act(async () => tab(container, "Requests for authorization")!.click());
      expect(container.textContent).toContain("Synthetic patient");
      const selected = tab(container, "Requests for authorization")!;
      expect(selected.getAttribute("aria-selected")).toBe("true");
      expect(container.querySelector('[role="tabpanel"]')?.getAttribute("aria-labelledby")).toBe(selected.id);
      expect(options.getSession).toHaveBeenCalledTimes(1);
      expect(button(container, "New authorization request")).toBeUndefined();
      await render(surface({ ...props, showRfas: false }));
      expect(container.textContent).not.toContain("Synthetic patient");
      expect(tab(container, "Requests for authorization")).toBeUndefined();
    });
  });
  it("creates an unsigned draft and forwards callbacks, without sending a fax", async () => {
    const options = connection(); const onCreated = vi.fn();
    await mounted(surface({ showRfas: true, rfaDashboard: { ...options, initialDraft, permissions: ["create", "send"], onCreated } }), async container => {
      await act(async () => tab(container, "Requests for authorization")!.click());
      await act(async () => button(container, "New authorization request")!.click());
      await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
      expect(onCreated).toHaveBeenCalledExactlyOnceWith(record);
      const mutations = options.fetch.mock.calls.filter(([, init]) => init?.method === "POST");
      expect(mutations).toHaveLength(1);
      expect(JSON.parse(String(mutations[0]?.[1]?.body))).toMatchObject(initialDraft);
      expect(new Headers(mutations[0]?.[1]?.headers).get("Idempotency-Key")).toBeTruthy();
      expect(container.textContent).toContain("External fax delivery is disabled");
      expect(button(container, "Send authorization fax")).toBeUndefined();
    });
  });
  it("requires create permission even with a prefilled draft", async () => {
    await mounted(surface({ showRfas: true, rfaDashboard: { ...connection(), initialDraft } }), async container => {
      await act(async () => tab(container, "Requests for authorization")!.click());
      expect(button(container, "New authorization request")).toBeUndefined();
    });
  });
});

it("inherits the workspace connection and can start on RFAs", async () => {
  const options = connection();
  await mounted(createElement(ConnectedBillingWorkspace, { ...options, showRfas: true, initialView: "rfas" }), async container => {
    expect(container.textContent).toContain("Synthetic patient");
    expect(options.getSession).toHaveBeenCalledTimes(1);
    expect(options.fetch.mock.calls).toHaveLength(1);
    expect(String(options.fetch.mock.calls[0]?.[0])).toContain("/rfas?");
  });
});

it("uses a dedicated RFA endpoint instead of the workspace credential callback", async () => {
  const options = connection();
  await mounted(createElement(ConnectedBillingWorkspace, { ...options, showRfas: true, initialView: "rfas", rfaDashboard: { sessionEndpoint: "/rfa-session" } }), async container => {
    expect(container.textContent).toContain("Synthetic patient");
    expect(options.getSession).not.toHaveBeenCalled();
    expect(options.fetch.mock.calls[0]?.[0]).toBe("/rfa-session");
    expect(new Headers(options.fetch.mock.calls[1]?.[1]?.headers).get("Authorization")).toBe("Bearer synthetic_rfa_token");
  });
});

it("falls back to tasks when initialView requests a disabled RFA tab", async () => {
  const options = connection();
  await mounted(createElement(ConnectedBillingWorkspace, { ...options, initialView: "rfas" }), async container => {
    expect(tab(container, "Bill tasks")?.getAttribute("aria-selected")).toBe("true");
    expect(options.fetch.mock.calls.every(([url]) => !String(url).includes("/rfas"))).toBe(true);
  });
});
