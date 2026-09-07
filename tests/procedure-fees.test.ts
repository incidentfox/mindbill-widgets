import { describe, expect, it, vi } from "vitest";

import { createBillLifecycleClient, createBillReferenceClient, type BillFeeQuoteInput } from "../packages/browser/src/index";

const catalog = {
  results: [{ code: "99213" }, { code: "99214" }],
  total: 2,
  limit: 30,
  jurisdiction: "CA",
  catalogAsOf: "2026-08-01",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("browser procedure catalog", () => {
  it("uses the canonical search route and a short-lived session before a bill exists", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic_browser_session");
      return jsonResponse(catalog);
    });
    const client = createBillReferenceClient({
      apiBaseUrl: "https://api.example",
      getSession: async () => ({ token: "synthetic_browser_session" }),
      fetch: fetcher,
    });

    await expect(client.searchProcedureCodes({ query: " 99 ", jurisdiction: "CA" })).resolves.toEqual(catalog);
    expect(String(fetcher.mock.calls[0]![0])).toBe("https://api.example/partner/v2/procedure-codes?q=99&limit=30&jurisdiction=CA");
  });

  it.each([[200, 100], [0, 1], [8.9, 8], [Number.NaN, 30]])("bounds limit %s to %s", async (limit, expected) => {
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse(catalog));
    const client = createBillReferenceClient({ fetch: fetcher, getSession: async () => ({ token: "synthetic_session" }) });

    await client.searchProcedureCodes({ limit });

    expect(new URL(String(fetcher.mock.calls[0]![0])).searchParams.get("limit")).toBe(String(expected));
  });

  it("exposes the same catalog through the lifecycle client", async () => {
    const client = createBillLifecycleClient({
      billId: "synthetic_bill",
      getSession: async () => ({ token: "synthetic_session" }),
      fetch: async () => jsonResponse({ ...catalog, catalogAsOf: null }),
    });

    await expect(client.searchProcedureCodes()).resolves.toMatchObject({ results: catalog.results, catalogAsOf: null });
  });

  it("filters malformed entries and never treats extra catalog fields as fee quotes", async () => {
    const client = createBillReferenceClient({
      getSession: async () => ({ token: "synthetic_session" }),
      fetch: async () => jsonResponse({ ...catalog, results: [null, {}, { code: 123 }, { code: "" }, { code: "99213", amount: 100 }] }),
    });

    await expect(client.searchProcedureCodes()).resolves.toMatchObject({ results: [{ code: "99213" }] });
  });

  it("rejects malformed response metadata", async () => {
    const client = createBillReferenceClient({
      getSession: async () => ({ token: "synthetic_session" }),
      fetch: async () => jsonResponse({ results: [] }),
    });

    await expect(client.searchProcedureCodes()).rejects.toThrow("invalid response");
  });

  it("preserves permission failures instead of returning an empty catalog", async () => {
    const client = createBillReferenceClient({
      getSession: async () => ({ token: "synthetic_session" }),
      fetch: async () => jsonResponse({ error: { message: "Treatment billing is unavailable." } }, 403),
    });

    await expect(client.searchProcedureCodes()).rejects.toThrow();
  });
});

describe("browser fee quotes", () => {
  const input: BillFeeQuoteInput = {
    code: "99213", dateOfService: "2026-08-24", units: 1, serviceZip: "95814",
    physicianContext: { providerKind: "physician", placeOfService: "11", standaloneService: true, globalPeriodApplies: false, hpsaBonusEligible: false },
  };
  const priced = {
    status: "priced", amountCents: 12000, scheduleMaximumCents: 15000, basis: "ca_physician_rbrvs",
    provenance: [{ id: "synthetic_schedule", url: "https://example.com/schedule", effectiveFrom: "2026-01-01", effectiveThrough: "2026-12-31" }],
    notes: ["Synthetic pricing fixture."],
  };

  it("posts the full verified service context and unwraps the quoted line total without multiplying units", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      expect(String(url)).toBe("https://api.example/partner/v2/fee-quotes");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic_session");
      expect(JSON.parse(String(init?.body))).toEqual({ ...input, units: 2, chargeCents: 12000 });
      return jsonResponse({ data: priced });
    });
    const client = createBillReferenceClient({ apiBaseUrl: "https://api.example", getSession: async () => ({ token: "synthetic_session" }), fetch: fetcher });

    await expect(client.quoteFee({ ...input, units: 2, chargeCents: 12000 })).resolves.toEqual(priced);
  });

  it.each(["requires_review", "not_separately_payable"])("preserves %s and its explanation without inventing a fee", async (status) => {
    const quote = { status, reason: "Synthetic review reason.", provenance: [] };
    const client = createBillLifecycleClient({ billId: "synthetic_bill", getSession: async () => ({ token: "synthetic_session" }), fetch: async () => jsonResponse({ data: quote }) });

    await expect(client.quoteFee({ code: "99213", dateOfService: "2026-08-24" })).resolves.toEqual(quote);
  });

  it("does not fill omitted clinical attestations", async () => {
    const minimal = { code: "99213", dateOfService: "2026-08-24" };
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      expect(JSON.parse(String(init?.body))).toEqual(minimal);
      return jsonResponse({ data: { status: "requires_review", reason: "Service context is required.", provenance: [] } });
    });
    const client = createBillReferenceClient({ getSession: async () => ({ token: "synthetic_session" }), fetch: fetcher });

    await client.quoteFee(minimal);
  });

  it.each([
    { ...priced, amountCents: null },
    { ...priced, amountCents: -1 },
    { ...priced, amountCents: 1.2 },
    { ...priced, status: "unknown" },
    { status: "requires_review", provenance: [] },
  ])("rejects malformed pricing responses %#", async (quote) => {
    const client = createBillReferenceClient({ getSession: async () => ({ token: "synthetic_session" }), fetch: async () => jsonResponse({ data: quote }) });

    await expect(client.quoteFee(input)).rejects.toThrow("invalid response");
  });

  it("refreshes an expired session once and retries the same quote payload", async () => {
    let mintCount = 0;
    const getSession = vi.fn(async () => ({ token: `synthetic_session_${++mintCount}` }));
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      expect(JSON.parse(String(init?.body))).toEqual(input);
      return mintCount === 1 ? jsonResponse({ error: "expired" }, 401) : jsonResponse({ data: priced });
    });
    const client = createBillReferenceClient({ getSession, fetch: fetcher });

    await expect(client.quoteFee(input)).resolves.toEqual(priced);
    expect(getSession).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("propagates pricing failures instead of exposing a cached or estimated amount", async () => {
    const client = createBillReferenceClient({ getSession: async () => ({ token: "synthetic_session" }), fetch: async () => jsonResponse({ error: "unavailable" }, 503) });

    await expect(client.quoteFee(input)).rejects.toThrow();
  });
});
