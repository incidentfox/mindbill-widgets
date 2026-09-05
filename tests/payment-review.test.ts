import { describe, expect, it, vi } from "vitest";
import { createBillingOperationsClient, type PaymentReviewItem } from "../packages/react/src/billing-operations-client";
import { paymentReviewCsv, paymentReviewDateRange } from "../packages/react/src/payment-review";
import { validateW9File } from "../packages/react/src/w9-upload";

describe("confirmed payment review", () => {
  it("uses local received dates and Monday-based weeks across year boundaries", () => {
    const now = new Date(2027, 0, 3, 23, 30);
    expect(paymentReviewDateRange("today", now)).toEqual({ receivedFrom: "2027-01-03", receivedTo: "2027-01-03" });
    expect(paymentReviewDateRange("week", now)).toEqual({ receivedFrom: "2026-12-28", receivedTo: "2027-01-03" });
    expect(paymentReviewDateRange("month", now)).toEqual({ receivedFrom: "2027-01-01", receivedTo: "2027-01-03" });
    expect(paymentReviewDateRange("year", new Date(2026, 7, 31))).toEqual({ receivedFrom: "2026-01-01", receivedTo: "2026-08-31" });
    expect(paymentReviewDateRange("all", now)).toEqual({});
  });

  it("quotes CSV cells and neutralizes spreadsheet formulas in every string column", () => {
    const row: PaymentReviewItem = { id: "payment-demo", billId: "bill-demo", billNumber: 42,
      patientName: '=HYPERLINK("example")', claimNumber: "\tformula", dateOfService: "2026-08-01",
      receivedDate: "2026-09-01", postedDate: "2026-09-02", status: "received", method: "Check",
      source: "paper\nrecord", checkNumber: "+123", amount: 123.45 };
    const csv = paymentReviewCsv([row]);
    expect(csv).toContain('"\'=HYPERLINK(""example"")"');
    expect(csv).toContain('"\'\tformula"');
    expect(csv).toContain('"\'+123"');
    expect(csv).toContain('"paper\nrecord"');
    expect(csv).toContain('"123.45"');
    expect(csv).not.toContain("payment-demo");
  });

  it("uses the authenticated reporting contract without mutating payments or losing full-filter totals", async () => {
    const data = { items: [], total: 26, page: 3, pageSize: 25, summary: { postedTotal: 4000, entryCount: 26, uniquePatients: 20 } };
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/partner/v2/reports/payments");
      expect(Object.fromEntries(url.searchParams)).toEqual({ q: "demo check", receivedFrom: "2026-09-01", receivedTo: "2026-09-05", page: "3", pageSize: "25", renderingProviderId: "provider-demo" });
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test_browser_token");
      expect(init?.method ?? "GET").toBe("GET");
      return new Response(JSON.stringify({ data }), { headers: { "content-type": "application/json" } });
    });
    const client = createBillingOperationsClient({ fetch: fetcher, getSession: async () => ({ token: "test_browser_token" }) });
    expect(await client.getPaymentReview({ q: "demo check", receivedFrom: "2026-09-01", receivedTo: "2026-09-05", page: 3, pageSize: 25, renderingProviderId: "provider-demo" })).toEqual(data);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("host-adapter W-9 validation", () => {
  it("accepts PDFs with known or missing MIME types and case-insensitive extension", () => {
    expect(validateW9File({ name: "practice.PDF", size: 100, type: "application/pdf" })).toBeNull();
    expect(validateW9File({ name: "practice.pdf", size: 100, type: "" })).toBeNull();
  });
  it("rejects empty, non-PDF, and oversized documents before calling a host", () => {
    expect(validateW9File({ name: "practice.pdf", size: 0, type: "application/pdf" })).toMatch(/empty/);
    expect(validateW9File({ name: "practice.pdf", size: 100, type: "text/plain" })).toMatch(/PDF/);
    expect(validateW9File({ name: "practice.txt", size: 100, type: "application/pdf" })).toMatch(/PDF/);
    expect(validateW9File({ name: "practice.pdf", size: 10_000_001, type: "application/pdf" }, 10_000_000)).toMatch(/smaller/);
    expect(validateW9File({ name: "practice.pdf", size: 21 * 1024 * 1024, type: "application/pdf" })).toMatch(/20 MB/);
  });
});
