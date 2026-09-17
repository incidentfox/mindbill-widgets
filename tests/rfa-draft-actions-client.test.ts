import { describe, expect, it, vi } from "vitest";
import { createRfaDraftActionsClient } from "../packages/browser/src/rfa-draft-actions";

describe("RFA draft actions contract", () => {
  it("copies content through the revision-guarded endpoint without signing or sending", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ data: { id: "synthetic_copy", status: "draft", signedAt: null, documents: [] } }));
    const client = createRfaDraftActionsClient({ getSession: async () => ({ token: "synthetic_token", apiBaseUrl: "https://synthetic.example/" }), fetch: fetcher });
    await expect(client.copy("synthetic/source", 3, "synthetic-copy-key")).resolves.toMatchObject({ id: "synthetic_copy", signedAt: null });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://synthetic.example/partner/v2/rfas/synthetic%2Fsource/copy");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ expectedRevision: 3 });
    expect(new Headers(init?.headers).get("idempotency-key")).toBe("synthetic-copy-key");
  });
  it("cancels only through the server's atomic unsigned-draft guard", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ data: { id: "synthetic_source", status: "canceled" } }));
    const client = createRfaDraftActionsClient({ getSession: async () => ({ token: "synthetic_token" }), fetch: fetcher });
    await client.cancelDraft("synthetic_source", 5, "synthetic-cancel-key");
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toMatch(/\/rfas\/synthetic_source$/);
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ status: "canceled", draftOnly: true, expectedRevision: 5 });
  });
  it("rejects invalid revision, ID and idempotency key before requesting credentials", async () => {
    const getSession = vi.fn(async () => ({ token: "synthetic_token" }));
    const client = createRfaDraftActionsClient({ getSession });
    for (const method of [client.copy, client.cancelDraft]) {
      await expect(method("", 1, "key")).rejects.toThrow("ID");
      await expect(method("id", 0, "key")).rejects.toThrow("revision");
      await expect(method("id", 1.1, "key")).rejects.toThrow("revision");
      await expect(method("id", 1, " ")).rejects.toThrow("idempotency");
    }
    expect(getSession).not.toHaveBeenCalled();
  });
  it("refreshes expired credentials once while retaining the exact mutation identity", async () => {
    const getSession = vi.fn().mockResolvedValueOnce({ token: "synthetic_expired" }).mockResolvedValueOnce({ token: "synthetic_fresh" });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({}, { status: 401 })).mockResolvedValueOnce(Response.json({ data: { id: "synthetic_copy" } }));
    await createRfaDraftActionsClient({ getSession, fetch: fetcher }).copy("source", 2, "retry-key");
    expect(getSession).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map(([, init]) => init?.body)).toEqual(['{"expectedRevision":2}', '{"expectedRevision":2}']);
    expect(fetcher.mock.calls.map(([, init]) => new Headers(init?.headers).get("idempotency-key"))).toEqual(["retry-key", "retry-key"]);
    expect(new Headers(fetcher.mock.calls[1]![1]?.headers).get("authorization")).toBe("Bearer synthetic_fresh");
  });
  it("surfaces stale-draft and scope failures without retrying mutations", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ error: { message: "Draft changed; refresh before canceling." } }, { status: 409 }));
    await expect(createRfaDraftActionsClient({ getSession: async () => ({ token: "synthetic_token" }), fetch: fetcher }).cancelDraft("source", 1, "key")).rejects.toThrow("Draft changed");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
