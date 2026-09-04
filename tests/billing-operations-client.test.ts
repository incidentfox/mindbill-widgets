import { describe, expect, it, vi } from "vitest";

import { createBillingOperationsClient } from "../packages/react/src/billing-operations-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("billing operations client", () => {
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
        expect(url).toBe("https://sandbox-api.mindbill.org/partner/v2/browser/bills?status=all&age=61-90&taskLabel=Send+Bill&page=2");
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
});
