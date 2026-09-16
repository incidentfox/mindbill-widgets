import { describe, expect, it, vi } from "vitest";
import { createRfaLifecycleClient } from "../packages/browser/src/rfa-lifecycle";

describe("RFA lifecycle browser contracts", () => {
  it("requires explicit receipt proof and records inbound confirmation without delivering anything", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ data: { id: "rfa_synthetic" } }));
    const client = createRfaLifecycleClient({ getSession: async () => ({ token: "synthetic_token", apiBaseUrl: "https://sandbox.example" }), fetch: fetcher });
    await expect(client.recordReceipt("rfa_synthetic", { channel: "fax", receivedAt: "2026-09-16T12:00:00Z" }, "receipt_key")).rejects.toThrow("proof");
    expect(fetcher).not.toHaveBeenCalled();
    await client.recordReceipt("rfa_synthetic", { channel: "fax", receivedAt: "2026-09-16T12:00:00Z", providerMessageId: "synthetic_receipt" }, "receipt_key");
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://sandbox.example/partner/v2/rfas/rfa_synthetic/transmissions");
    const init = fetcher.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get("idempotency-key")).toBe("receipt_key");
    expect(JSON.parse(String(init?.body))).toEqual({ channel: "fax", receivedAt: "2026-09-16T12:00:00Z", providerMessageId: "synthetic_receipt", direction: "inbound", status: "received", occurredAt: "2026-09-16T12:00:00Z" });
  });
  it("refreshes an expired session once, keeps the mutation key, and surfaces denied scopes", async () => {
    const mint = vi.fn().mockResolvedValueOnce({ token: "synthetic_old" }).mockResolvedValue({ token: "synthetic_new" });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(Response.json({ detail: "rfas:act is required" }, { status: 403 }));
    const client = createRfaLifecycleClient({ getSession: mint, fetch: fetcher });
    await expect(client.recordInformationRequest("id/one", { requestedAt: "2026-09-16T00:00:00Z", requestText: "Synthetic request" }, "same_key")).rejects.toThrow("rfas:act is required");
    expect(mint).toHaveBeenCalledTimes(2); expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map(call => new Headers(call[1]?.headers).get("idempotency-key"))).toEqual(["same_key", "same_key"]);
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("id%2Fone/information-requests");
  });
  it("supports partial decisions, delivered response evidence, and paginated read-only followups", async () => {
    const fetcher = vi.fn<typeof fetch>(async url => String(url).includes("rfa-follow-ups?") ? Response.json({ data: [], nextCursor: "cursor_two" }) : Response.json({ data: { id: "synthetic" } }));
    const client = createRfaLifecycleClient({ getSession: async () => ({ token: "synthetic_token" }), fetch: fetcher });
    const decisions = { decidedAt: "2026-09-16T00:00:00Z", responseDocumentId: "ur_synthetic", decisions: [{ itemId: "item_one", outcome: "approved" as const, authorizationNumber: "AUTH-SYNTHETIC" }] };
    await client.recordDecisions("rfa_synthetic", decisions, "decisions_key");
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual(decisions);
    await client.recordInformationResponse("rfa_synthetic", "request/one", { respondedAt: "2026-09-16T00:00:00Z", responseDocumentIds: ["report_synthetic"] }, "response_key");
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("information-requests/request%2Fone");
    expect(await client.listFollowUps({ claimId: "claim_synthetic", includeResolved: false, limit: 200, cursor: "first" })).toEqual({ data: [], nextCursor: "cursor_two" });
    expect(String(fetcher.mock.calls[2]?.[0])).toContain("includeResolved=false");
    expect(fetcher.mock.calls[2]?.[1]?.method).toBeUndefined();
    await client.updateFollowUp("task_synthetic", { note: "Reviewed synthetic response", responseReview: { disposition: "no_new_decision", noNewDecisionConfirmed: true } }, "review_key");
    expect(fetcher.mock.calls[3]?.[1]?.method).toBe("PATCH");
    expect(fetcher.mock.calls.every(call => !String(call[0]).endsWith("/fax"))).toBe(true);
    await expect(client.recordDecisions("rfa_synthetic", decisions, " ")).rejects.toThrow("idempotency");
  });
});
