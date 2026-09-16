// @vitest-environment happy-dom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { BillingDashboard, type BillingDashboardBill } from "../packages/react/src/billing-dashboard";
import { ConnectedBillSearch } from "../packages/react/src/connected-billing-workspace";
import { billDateInRange, billSearchDateText, matchesBillSearch } from "../packages/react/src/bill-search";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const bills: BillingDashboardBill[] = [
  { id: "bill-alpha", billNumber: 2041, externalId: "EXT-202", patientName: "Alex Example", claimNumber: "CLM-902", payerName: "Northstar Claims", state: "accepted_no_response", dateOfService: "2026-08-01", submittedAt: "2026-08-03T23:45:00-07:00", procedureCodes: ["99213"], totalCharge: 100, totalPaid: 0, balanceDue: 100 },
  { id: "bill-beta", billNumber: 2042, patientName: "Jordan Sample", claimNumber: "CLM-903", payerName: "Harbor Claims", state: "paid", dateOfService: "2026-08-02", submittedAt: "2026-08-05", totalCharge: 200, totalPaid: 200, balanceDue: 0 },
];
async function mounted(element: ReactElement, run: (container: HTMLDivElement) => Promise<void>) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try { await act(async () => root.render(element)); await run(container); }
  finally { await act(async () => root.unmount()); container.remove(); }
}
function control(container: HTMLElement, label: string) {
  return [...container.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select")].find((item) => item.getAttribute("aria-label") === label || item.closest("label")?.textContent?.startsWith(label))!;
}
async function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype = element.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
function button(container: HTMLElement, name: string) { return [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === name)!; }

describe("bill search", () => {
  it("matches every case-insensitive word across fields and treats punctuation literally", () => {
    expect(matchesBillSearch("  ALEX   northstar CLM-902 ", ["Alex Example", "Northstar Claims", "CLM-902"])).toBe(true);
    expect(matchesBillSearch("Alex Harbor", ["Alex Example", "Northstar Claims"])).toBe(false);
    expect(matchesBillSearch(".*", ["Alex Example"])).toBe(false);
    expect(matchesBillSearch("accepted_no_response", ["accepted_no_response"])).toBe(true);
  });
  it("searches date aliases without changing the recorded calendar day", () => {
    expect(billSearchDateText("2026-08-03T23:45:00-07:00")).toContain("08/03/2026 8/3/2026");
    expect(billDateInRange("2026-08-03T23:45:00-07:00", "2026-08-03", "2026-08-03")).toBe(true);
    expect(billDateInRange(null, "2026-08-03", "")).toBe(false);
    expect(billDateInRange(undefined, "", "")).toBe(true);
    expect(billDateInRange("2026-08-04", "", "2026-08-03")).toBe(false);
  });
  it.each(["Alex northstar", "CLM-902", "2041", "EXT-202", "response overdue", "accepted_no_response", "99213", "08/01/2026", "8/3/2026", "2026-08-03"])("filters static bills using %s", async (initialSearch) => {
    await mounted(createElement(BillingDashboard, { bills, initialSearch }), async (container) => {
      expect(container.querySelector("tbody")?.textContent).toContain("Alex Example");
      expect(container.querySelector("tbody")?.textContent).not.toContain("Jordan Sample");
    });
  });
  it("combines static service-date boundaries and status, then clears all filters", async () => {
    await mounted(createElement(BillingDashboard, { bills }), async (container) => {
      await change(control(container, "Date type"), "service");
      await change(control(container, "From date"), "2026-08-01");
      await change(control(container, "Through date"), "2026-08-01");
      expect(container.querySelector("tbody")?.textContent).toContain("Alex Example");
      expect(container.querySelector("tbody")?.textContent).not.toContain("Jordan Sample");
      await change(control(container, "Filter bills by status"), "paid");
      expect(container.textContent).toContain("No bills match these filters.");
      await act(async () => button(container, "Clear filters").click());
      expect(container.querySelector("tbody")?.textContent).toContain("Jordan Sample");
      expect(control(container, "From date").value).toBe("");
    });
  });
  it("submits connected text and inclusive dates, resets pagination, and clears previous filters", async () => {
    const queries: Record<string, string>[] = [];
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      queries.push(Object.fromEntries(new URL(String(input)).searchParams));
      return Response.json({ data: { items: [], total: 0, balanceTotal: 0, page: 1, pageSize: 25 } });
    });
    await mounted(createElement(ConnectedBillSearch, { fetch: fetcher, getSession: async () => ({ token: "synthetic" }), initialQuery: { page: 3, status: "paid", renderingProviderId: "synthetic-provider", age: "31-60", taskType: "send_bill" } }), async (container) => {
      await change(control(container, "Search bills"), " Alex Northstar ");
      await change(control(container, "Date type"), "service");
      await change(control(container, "From date"), "2026-08-01");
      await change(control(container, "Through date"), "2026-08-31");
      expect(queries).toHaveLength(1);
      await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
      expect(queries.at(-1)).toMatchObject({ q: "Alex Northstar", dateField: "service", from: "2026-08-01", to: "2026-08-31", page: "1", status: "paid", renderingProviderId: "synthetic-provider", age: "31-60", taskKind: "send_bill" });
      await change(control(container, "From date"), "2026-09-01");
      expect(button(container, "Search").disabled).toBe(true);
      expect(container.querySelector('[role="alert"]')?.textContent).toContain("From date must be on or before");
      await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
      expect(queries).toHaveLength(2);
      await act(async () => button(container, "Clear filters").click());
      expect(queries.at(-1)).toEqual({ status: "all", age: "all", page: "1", pageSize: "25", sort: "submitted", dir: "desc" });
      expect(control(container, "Search bills").value).toBe("");
    });
  });
  it("does not request bills for an inverted initial range", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await mounted(createElement(ConnectedBillSearch, { fetch: fetcher, getSession: async () => ({ token: "synthetic" }), initialQuery: { from: "2026-09-01", to: "2026-08-01" } }), async (container) => {
      expect(fetcher).not.toHaveBeenCalled();
      expect(container.textContent).toContain("From date must be on or before through date.");
      expect(button(container, "Search").disabled).toBe(true);
    });
  });

});
