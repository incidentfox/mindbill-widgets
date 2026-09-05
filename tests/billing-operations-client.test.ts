import { describe, expect, it, vi } from "vitest";

import { createBillingOperationsClient } from "../packages/react/src/billing-operations-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("billing operations client", () => {
  it.each([
    ["submitted_desc", "submitted", "desc"], ["submitted_asc", "submitted", "asc"],
    ["balance_desc", "balanceDue", "desc"], ["balance_asc", "balanceDue", "asc"],
    ["patient_asc", "patient", "asc"],
  ] as const)("maps dashboard filters and %s to the API contract", async (sort, wireSort, dir) => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      expect(Object.fromEntries(new URL(String(input)).searchParams)).toEqual({
        status: "sent", age: "0-30", claimsAdminId: "payer-demo", billingProviderId: "provider-demo", renderingProviderId: "doctor-demo",
        taskKind: "send_bill", taskLabel: "Send Bill", sort: wireSort, dir,
      });
      return jsonResponse({ data: { items: [], total: 0 } });
    });
    await createBillingOperationsClient({ fetch: fetcher, getSession: async () => ({ token: "test_browser_token" }) }).getBills({
      status: "submitted", age: "0-30", claimsAdministrator: "payer-demo", billingProviderId: "provider-demo", renderingProviderId: "doctor-demo",
      taskType: "send_bill", taskSection: "incomplete", taskLabel: "Send Bill", sort,
    });
  });
  it("filters dashboard tasks by doctor without changing the legacy payer argument", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse({ data: { filters: { claimsAdministrators: [], renderingProviders: [{ id: "doctor-demo", name: "Demo doctor" }] } } }));
    const client = createBillingOperationsClient({ fetch: fetcher, getSession: async () => ({ token: "test_browser_token" }) });
    const result = await client.getBillTasks("payer-demo", undefined, "doctor-demo");
    expect(Object.fromEntries(new URL(String(fetcher.mock.calls[0]![0])).searchParams)).toEqual({ claimsAdminId: "payer-demo", renderingProviderId: "doctor-demo" });
    expect(result.filters.renderingProviders).toEqual([{ id: "doctor-demo", name: "Demo doctor" }]);
    await client.getBillTasks("payer-demo");
    expect(Object.fromEntries(new URL(String(fetcher.mock.calls[1]![0])).searchParams)).toEqual({ claimsAdminId: "payer-demo" });
  });
  it("mints one short-lived session and sends registry filters to MindBill", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "/api/mindbill/session") {
        expect(init).toMatchObject({ method: "POST", credentials: "same-origin" });
        return jsonResponse({
          token: "browser_session_token",
          apiBaseUrl: "https://sandbox-api.mindbill.org",
          expiresAt: "2099-01-01T00:00:00.000Z",
        });
      }
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer browser_session_token");
      if (url.includes("/partner/v2/browser/bills?")) {
        expect(Object.fromEntries(new URL(url).searchParams)).toEqual({ status: "all", age: "61-90", taskLabel: "Send Bill", page: "2" });
      } else {
        expect(url).toBe("https://sandbox-api.mindbill.org/partner/v2/browser/reports/productivity?from=2026-08-01&to=2026-08-31");
      }
      return jsonResponse({ data: { items: [], total: 0, balanceTotal: 0, page: 2, pageSize: 25 } });
    });
    const client = createBillingOperationsClient({ fetch: fetcher });

    await client.getBills({ status: "all", age: "61-90", taskLabel: "Send Bill", page: 2 });
    await client.getProductivity({ from: "2026-08-01", to: "2026-08-31" });

    expect(fetcher.mock.calls.filter(([input]) => String(input) === "/api/mindbill/session")).toHaveLength(1);
  });

  it("refreshes the browser session once after a 401", async () => {
    let mintCount = 0;
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "/api/mindbill/session") {
        mintCount += 1;
        return jsonResponse({ token: `browser_token_${mintCount}`, expiresAt: "2099-01-01T00:00:00.000Z" });
      }
      if (mintCount === 1) return jsonResponse({ error: "expired" }, 401);
      return jsonResponse({ data: { items: [], total: 0, balanceTotal: 0, page: 1, pageSize: 25 } });
    });

    await createBillingOperationsClient({ apiBaseUrl: "https://api.example", fetch: fetcher }).getBills();

    expect(mintCount).toBe(2);
  });

  it("retries session minting when a Strict Mode effect aborts the pending request", async () => {
    let mintCount = 0;
    const getSession = vi.fn(({ signal }: { signal: AbortSignal }) => {
      mintCount += 1;
      if (mintCount > 1) {
        return Promise.resolve({ token: "replacement_browser_token", expiresAt: "2099-01-01T00:00:00.000Z" });
      }
      return new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
    });
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse({
      data: { items: [], total: 0, balanceTotal: 0, page: 1, pageSize: 25 },
    }));
    const client = createBillingOperationsClient({ apiBaseUrl: "https://api.example", fetch: fetcher, getSession });
    const firstController = new AbortController();
    const first = client.getBills({}, firstController.signal);

    firstController.abort();
    const second = client.getBills({}, new AbortController().signal);

    await expect(first).rejects.toMatchObject({ name: "AbortError" });
    await expect(second).resolves.toMatchObject({ total: 0 });
    expect(getSession).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
