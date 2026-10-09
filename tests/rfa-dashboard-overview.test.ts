// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RfaDashboard } from "../packages/react/src/rfa-dashboard";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
function taskResponse(input: RequestInfo | URL): Response | undefined {
 const url = String(input);
 if (url.includes("/rfa-follow-ups") || url.includes("/rfa-inbound-faxes")) return Response.json({ data: [], nextCursor: null, hasMore: false });
}
const row = { id: "rfa_synthetic", employeeName: "Synthetic Patient", providerName: "Synthetic Physician", status: "received", lifecycleStatus: "received", submittedAt: "2026-09-01T00:00:00Z", decisionDueAt: "2026-09-10T00:00:00Z", items: [{ id: "item_synthetic", serviceDescription: "Synthetic therapy", diagnosisCode: "M54.50", outcome: "pending", decisionClosure: { closed: true, reason: "Treatment withdrawn", version: 1, updatedAt: "2026-09-18T00:00:00Z", updatedBy: "synthetic_actor" } }] };
const result = { data: [row], nextCursor: null, summary: { total: 150, byStatus: { received: 150 }, byLifecycleStatus: { received: 150 }, aging: { byBucket: { "0_5": 0, "6_14": 0, "15_30": 150, "31_plus": 0 }, byLifecycleStatus: { received: { "0_5": 0, "6_14": 0, "15_30": 150, "31_plus": 0 } } } } };
function mount(fetcher: typeof fetch) { const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); const click = async (text: string) => act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === text)!.click()); return { container, root, click, render: () => act(async () => root.render(createElement(RfaDashboard, { getSession: async () => ({ token: "synthetic_token" }), fetch: fetcher, patientId: "patient_synthetic", claimId: "claim_synthetic" }))), cleanup: async () => { await act(async () => root.unmount()); container.remove(); } }; }
it("opens with global lifecycle and aging counts and drills into scoped server-filtered requests", async () => {
 const urls: URL[] = []; const h = mount(async input => { const empty = taskResponse(input); if (empty) return empty; urls.push(new URL(String(input))); return Response.json(result); });
 try { await h.render(); expect(h.container.textContent).toContain("150 total requests"); expect(h.container.textContent).not.toContain("Synthetic Patient"); expect(h.container.textContent).not.toContain("Refresh requests");
 expect(h.container.querySelector('.mbrfa-finished-links')).toBeNull();
 expect(h.container.textContent).not.toContain("Incomplete"); expect(h.container.textContent).not.toContain("Canceled");
 await act(async () => h.container.querySelector<HTMLButtonElement>('[aria-label="Received · 15–30 days since submission: 150 requests"]')!.click());
 expect(urls.at(-1)!.searchParams.get("lifecycleStatus")).toBe("received"); expect(urls.at(-1)!.searchParams.get("agingBucket")).toBe("15_30"); expect(urls.at(-1)!.searchParams.get("claimId")).toBe("claim_synthetic"); expect(h.container.textContent).toContain("15–30 days since submission"); expect(h.container.textContent).toContain("RFA status"); expect(h.container.querySelector('option[value="incomplete"]')).not.toBeNull();
 await act(async () => { const select = h.container.querySelector<HTMLSelectElement>('.mbrfa-list-mode select')!; select.value = "treatments"; select.dispatchEvent(new Event("change", { bubbles: true })); }); expect(h.container.textContent).toContain("Decision no longer required"); expect(h.container.textContent).not.toContain("9/10/2026");
 } finally { await h.cleanup(); }
});
it("debounces search, refreshes quietly on focus, and hides stale results after a failed filter load", async () => {
 vi.useFakeTimers(); let fail = false; const urls: URL[] = []; const h = mount(async input => { const empty = taskResponse(input); if (empty) return empty; urls.push(new URL(String(input))); if (fail) return Response.json({ error: { message: "Unavailable" } }, { status: 503 }); return Response.json(result); });
 try { await h.render(); await h.click("All RFAs"); const input = h.container.querySelector<HTMLInputElement>('input[type="search"]')!; const change = async (value: string) => act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,value); input.dispatchEvent(new Event("input",{ bubbles:true })); }); const count = urls.length;
 await change("S"); await act(async () => vi.advanceTimersByTime(100)); await change("Synthetic"); expect(urls).toHaveLength(count); await act(async () => vi.advanceTimersByTime(300)); expect(urls).toHaveLength(count+1); expect(urls.at(-1)!.searchParams.get("search")).toBe("Synthetic");
 await act(async () => window.dispatchEvent(new Event("focus"))); expect(urls).toHaveLength(count+2); expect(h.container.textContent).toContain("Synthetic Patient");
 fail=true; await change("Missing"); await act(async () => vi.advanceTimersByTime(300)); expect(h.container.textContent).not.toContain("Synthetic Patient"); expect(h.container.textContent).toContain("Requests could not be loaded");
 fail=false; await act(async () => vi.advanceTimersByTime(30_000)); expect(h.container.textContent).toContain("Synthetic Patient");
 } finally { await h.cleanup(); vi.useRealTimers(); }
});
it("opens simple task overview with native links and preserves filters in routed drilldowns", async () => {
 const h=mount(async input=>taskResponse(input)??Response.json(result)); const onNavigate=vi.fn();
 const navigation={createHref:"/tasks/rfas/new?claimId=claim_synthetic",allRfasHref:"/tasks/rfas/all?claimId=claim_synthetic",tasksHref:"/tasks/rfas",backHref:"/tasks/rfas/all",onNavigate};
 try {
  await act(async()=>h.root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:async input=>taskResponse(input)??Response.json(result),layout:"simple",initialOverviewView:"tasks",permissions:["create"],navigation})));
  expect(h.container.querySelector('.mbrfa-nav')).toBeNull(); expect(h.container.textContent).toContain("150 total requests");
  const link=h.container.querySelector<HTMLAnchorElement>('a[href="/tasks/rfas/new?claimId=claim_synthetic"]')!;
  expect(link.textContent).toBe("+ Add RFA");
  await act(async()=>link.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,ctrlKey:true}))); expect(onNavigate).not.toHaveBeenCalled();
  await act(async()=>link.click()); expect(onNavigate).toHaveBeenLastCalledWith("/tasks/rfas/new?claimId=claim_synthetic");
  expect(h.container.textContent).not.toContain("New authorization request");
  await act(async()=>h.container.querySelector<HTMLButtonElement>('[aria-label="Received · 15–30 days since submission: 150 requests"]')!.click());
  expect(onNavigate).toHaveBeenLastCalledWith("/tasks/rfas/all?claimId=claim_synthetic&status=received&agingBucket=15_30");
 } finally {await h.cleanup();}
});
it("restores native list filters and links creation back to the supplied route", async () => {
 const urls:URL[]=[];const h=mount(async input=>{urls.push(new URL(String(input)));return taskResponse(input)??Response.json(result);}); const fetcher=async(input:RequestInfo|URL)=>{urls.push(new URL(String(input)));return taskResponse(input)??Response.json(result);}; const getSession=async()=>({token:"synthetic_token"});
 try {
  await act(async()=>h.root.render(createElement(RfaDashboard,{getSession,fetch:fetcher,layout:"simple",initialOverviewView:"list",initialStatus:"received",initialAgingBucket:"15_30",navigation:{allRfasHref:"/tasks/rfas/all",tasksHref:"/tasks/rfas"}})));
  expect(urls.some(url=>url.searchParams.get("lifecycleStatus")==="received"&&url.searchParams.get("agingBucket")==="15_30")).toBe(true);
  expect(h.container.querySelector('a[href="/tasks/rfas"]')?.textContent).toBe("← RFA Tasks");
  await act(async()=>h.root.render(createElement(RfaDashboard,{getSession:async()=>({token:"synthetic_token"}),fetch:fetcher,initialView:"create",permissions:["create"],navigation:{backHref:"/tasks/rfas",backLabel:"← RFA Tasks"}})));
  expect(h.container.querySelector('a[href="/tasks/rfas"]')?.textContent).toBe("← RFA Tasks");
 } finally {await h.cleanup();}
});
