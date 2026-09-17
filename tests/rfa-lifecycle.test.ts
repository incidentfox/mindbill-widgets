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

it("uses versioned appointment contracts and rejects invalid response envelopes", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ data: [] })).mockResolvedValueOnce(Response.json({ data: [] })).mockResolvedValueOnce(Response.json({ data: {} }));
  const client = createRfaLifecycleClient({ getSession: async () => ({ token: "synthetic_token" }), fetch: fetcher });
  expect(await client.listScheduling("rfa/one")).toEqual([]);
  const input = { expectedVersion: 3, authorizationToken: "a".repeat(64), disposition: "canceled" as const, reason: "Synthetic patient rescheduled" };
  expect(await client.updateScheduling("rfa/one", "item/one", input, "appointment_key")).toEqual([]);
  const mutation = fetcher.mock.calls[1];
  expect(String(mutation?.[0])).toContain("rfa%2Fone/items/item%2Fone/scheduling");
  expect(mutation?.[1]?.method).toBe("PATCH");
  expect(JSON.parse(String(mutation?.[1]?.body))).toEqual(input);
  expect(new Headers(mutation?.[1]?.headers).get("idempotency-key")).toBe("appointment_key");
  await expect(client.listHistory("rfa/one")).rejects.toThrow("invalid");
  await expect(client.updateScheduling("rfa/one", "item/one", input, "")).rejects.toThrow("idempotency");
});
it("adds nonempty notes and preserves correction evidence and decision concurrency references", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ data: { id: "synthetic" } }));
  const client = createRfaLifecycleClient({ getSession: async () => ({ token: "synthetic_token" }), fetch: fetcher });
  await expect(client.addNote("rfa_one", "  ", "note_key")).rejects.toThrow("Enter a note");
  expect(fetcher).not.toHaveBeenCalled();
  await client.addNote("rfa_one", " Synthetic note ", "note_key");
  expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ text: "Synthetic note" });
  const correction = { itemId: "item_one", expectedDecisionEventId: "decision_one", reason: "Synthetic correction", replacement: { decidedAt: "2026-09-16T00:00:00Z", responseDocumentId: "ur_one", decisions: [{ itemId: "item_one", outcome: "approved" as const, authorizationNumber: "SYNTHETIC" }] } };
  await client.correctDecision("rfa_one", correction, "correction_key");
  expect(String(fetcher.mock.calls[1]?.[0])).toContain("/decision-corrections");
  expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual(correction);
});
it("paginates the scoped response inbox, authenticates PDFs, and requires an explicit idempotent match", async () => {
  const fetcher = vi.fn<typeof fetch>(async (url, init) => String(url).endsWith("/content") ? new Response("%PDF-synthetic", { headers: { "content-type": "application/pdf" } }) : init?.method === "POST" ? Response.json({ data: { faxId: "fax/one", rfaId: "rfa_one", documentId: "ur_one", alreadyAttached: false } }) : Response.json({ data: [], hasMore: true, nextCursor: "page_two" }));
  const client = createRfaLifecycleClient({ getSession: async () => ({ token: "synthetic_token" }), fetch: fetcher });
  expect(await client.listInboundFaxes({ cursor: "page_one", limit: 50 })).toMatchObject({ nextCursor: "page_two" });
  expect(String(fetcher.mock.calls[0]?.[0])).toContain("cursor=page_one&limit=50");
  expect(await (await client.getInboundFaxContent("fax/one")).text()).toBe("%PDF-synthetic");
  expect(String(fetcher.mock.calls[1]?.[0])).toContain("fax%2Fone/content");
  expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).get("authorization")).toBe("Bearer synthetic_token");
  await expect(client.matchInboundFax("fax/one", "rfa_one", " ")).rejects.toThrow("idempotency");
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(await client.matchInboundFax("fax/one", "rfa_one", "stable_key")).toMatchObject({ documentId: "ur_one" });
  expect(JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body))).toEqual({ rfaId: "rfa_one" });
  expect(new Headers(fetcher.mock.calls[2]?.[1]?.headers).get("idempotency-key")).toBe("stable_key");
});
