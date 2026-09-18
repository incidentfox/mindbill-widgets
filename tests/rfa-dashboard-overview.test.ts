// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RfaDashboard } from "../packages/react/src/rfa-dashboard";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const row = { id: "rfa_synthetic", employeeName: "Synthetic Patient", providerName: "Synthetic Physician", status: "received", lifecycleStatus: "received", submittedAt: "2026-09-01T00:00:00Z", decisionDueAt: "2026-09-10T00:00:00Z", items: [{ id: "item_synthetic", serviceDescription: "Synthetic therapy", diagnosisCode: "M54.50", outcome: "pending", decisionClosure: { closed: true, reason: "Treatment withdrawn", version: 1, updatedAt: "2026-09-18T00:00:00Z", updatedBy: "synthetic_actor" } }] };
const result = { data: [row], nextCursor: null, summary: { total: 150, byStatus: { received: 150 }, byLifecycleStatus: { received: 150 }, aging: { byBucket: { "0_5": 0, "6_14": 0, "15_30": 150, "31_plus": 0 }, byLifecycleStatus: { received: { "0_5": 0, "6_14": 0, "15_30": 150, "31_plus": 0 } } } } };
function mount(fetcher: typeof fetch) { const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); const click = async (text: string) => act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === text)!.click()); return { container, root, click, render: () => act(async () => root.render(createElement(RfaDashboard, { getSession: async () => ({ token: "synthetic_token" }), fetch: fetcher, patientId: "patient_synthetic", claimId: "claim_synthetic" }))), cleanup: async () => { await act(async () => root.unmount()); container.remove(); } }; }
it("opens with global lifecycle and aging counts and drills into scoped server-filtered requests", async () => {
 const urls: URL[] = []; const h = mount(async input => { urls.push(new URL(String(input))); return Response.json(result); });
 try { await h.render(); expect(h.container.textContent).toContain("150 total requests"); expect(h.container.textContent).not.toContain("Synthetic Patient"); expect(h.container.textContent).not.toContain("Refresh requests");
 await act(async () => h.container.querySelector<HTMLButtonElement>('[aria-label="Received · 15–30 days since sent: 150 requests"]')!.click());
 expect(urls.at(-1)!.searchParams.get("lifecycleStatus")).toBe("received"); expect(urls.at(-1)!.searchParams.get("agingBucket")).toBe("15_30"); expect(urls.at(-1)!.searchParams.get("claimId")).toBe("claim_synthetic"); expect(h.container.textContent).toContain("15–30 days since sent");
 await h.click("Requested treatments"); expect(h.container.textContent).toContain("Decision no longer required"); expect(h.container.textContent).not.toContain("9/10/2026");
 } finally { await h.cleanup(); }
});
it("debounces search, refreshes quietly on focus, and hides stale results after a failed filter load", async () => {
 vi.useFakeTimers(); let fail = false; const urls: URL[] = []; const h = mount(async input => { urls.push(new URL(String(input))); if (fail) return Response.json({ error: { message: "Unavailable" } }, { status: 503 }); return Response.json(result); });
 try { await h.render(); await h.click("RFAs"); const input = h.container.querySelector<HTMLInputElement>('input[type="search"]')!; const change = async (value: string) => act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,value); input.dispatchEvent(new Event("input",{ bubbles:true })); }); const count = urls.length;
 await change("S"); await act(async () => vi.advanceTimersByTime(100)); await change("Synthetic"); expect(urls).toHaveLength(count); await act(async () => vi.advanceTimersByTime(300)); expect(urls).toHaveLength(count+1); expect(urls.at(-1)!.searchParams.get("search")).toBe("Synthetic");
 await act(async () => window.dispatchEvent(new Event("focus"))); expect(urls).toHaveLength(count+2); expect(h.container.textContent).toContain("Synthetic Patient");
 fail=true; await change("Missing"); await act(async () => vi.advanceTimersByTime(300)); expect(h.container.textContent).not.toContain("Synthetic Patient"); expect(h.container.textContent).toContain("Requests could not be loaded");
 fail=false; await act(async () => vi.advanceTimersByTime(30_000)); expect(h.container.textContent).toContain("Synthetic Patient");
 } finally { await h.cleanup(); vi.useRealTimers(); }
});
