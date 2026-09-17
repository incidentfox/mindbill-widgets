// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RfaDashboard } from "../packages/react/src/rfa-dashboard";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const record = { id: "rfa_synthetic", employeeName: "Synthetic Patient", providerName: "Synthetic Physician", claimNumber: "TEST-CLAIM", status: "received", createdAt: null, submittedAt: null, decisionDueAt: null, items: [{ id: "item_synthetic", serviceDescription: "Synthetic therapy", procedureCode: "97110", diagnosisCode: "M54.50", outcome: "approved", decidedAt: "2026-09-01T00:00:00Z" }] };
it("keeps patient filters through server search, sorting and cursor navigation and exposes treatments", async () => {
 const urls: URL[] = [];
 const fetcher = vi.fn<typeof fetch>(async input => { const url = new URL(String(input)); urls.push(url); return Response.json({ data: [record], summary: { total: 51, byStatus: { received: 51 } }, nextCursor: url.searchParams.has("cursor") ? null : "synthetic_cursor" }); });
 const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
 const click = async (text: string) => act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === text)!.click());
 try {
  await act(async () => root.render(createElement(RfaDashboard, { getSession: async () => ({ token: "synthetic_token" }), fetch: fetcher, patientId: "patient_synthetic" })));
  await click("Requested treatments"); expect(container.textContent).toContain("Synthetic therapy"); expect(container.textContent).toContain("Page controls move between requests");
  await click("Next page"); expect(container.querySelector('[aria-label="Requested treatments table"]')).not.toBeNull(); expect(urls.at(-1)!.searchParams.get("cursor")).toBe("synthetic_cursor");
  await click("Patient ↕"); expect(urls.at(-1)!.searchParams.get("sortBy")).toBe("employeeName"); expect(urls.at(-1)!.searchParams.get("sortDirection")).toBe("asc"); expect(urls.at(-1)!.searchParams.has("cursor")).toBe(false);
  expect(container.querySelector('[aria-label="Requested treatments table"]')).not.toBeNull();
  const input = container.querySelector<HTMLInputElement>('input[type="search"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "TEST-CLAIM"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(container.querySelector('[aria-label="Requested treatments table"]')).not.toBeNull();
  expect(urls.at(-1)!.searchParams.get("search")).toBe("TEST-CLAIM"); expect(urls.every(url => url.searchParams.get("patientId") === "patient_synthetic")).toBe(true);
  await click("Next page"); await click("Previous page"); expect(urls.at(-1)!.searchParams.has("cursor")).toBe(false); expect(urls.at(-1)!.searchParams.get("search")).toBe("TEST-CLAIM");
 } finally { await act(async () => root.unmount()); container.remove(); }
});
