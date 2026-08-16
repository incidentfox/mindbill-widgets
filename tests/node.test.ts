import { describe, expect, it, vi } from "vitest";
import {
  createDeveloperSandbox,
  MINDBILL_TERMS_VERSION,
  MindBillClient,
  MindBillError,
} from "../packages/node/src/index.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("@mindbill/node", () => {
  it("creates a sandbox without sending authorization", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      partnerId: "partner_1",
      partnerSlug: "example",
      accountId: "account_1",
      credentialId: "credential_1",
      apiKey: "mb_sandbox_secret",
      environment: "sandbox",
    }));
    await createDeveloperSandbox({
      companyName: "Example",
      contactName: "Developer",
      email: "developer@example.test",
      termsAccepted: true,
    }, { fetch: fetcher });

    const [, request] = fetcher.mock.calls[0]!;
    const headers = new Headers(request?.headers);
    expect(headers.has("authorization")).toBe(false);
    expect(JSON.parse(String(request?.body))).toMatchObject({ termsVersion: MINDBILL_TERMS_VERSION });
  });

  it("applies bearer auth, organization context, and idempotency", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ bill: { id: "bill_1" } }));
    const client = new MindBillClient({
      apiKey: "mb_sandbox_secret",
      organizationId: "org_1",
      baseUrl: "https://example.test/partner/v1/",
      fetch: fetcher,
    });
    await client.createBill({ externalId: "example-1" }, "example-idempotency-key");

    const [url, request] = fetcher.mock.calls[0]!;
    const headers = new Headers(request?.headers);
    expect(url).toBe("https://example.test/partner/v1/bills");
    expect(headers.get("authorization")).toBe("Bearer mb_sandbox_secret");
    expect(headers.get("x-mindbill-org-id")).toBe("org_1");
    expect(headers.get("idempotency-key")).toBe("example-idempotency-key");
  });

  it("surfaces RFC 9457-style API errors with request IDs", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(
      { title: "Invalid request", detail: "The bill is invalid" },
      { status: 422, headers: { "content-type": "application/problem+json", "x-request-id": "req_123" } },
    ));
    const client = new MindBillClient({ apiKey: "mb_sandbox_secret", fetch: fetcher });
    const error = await client.getBill("bill_1").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MindBillError);
    expect(error).toMatchObject({ status: 422, requestId: "req_123", message: "The bill is invalid" });
  });

  it("requires billId for a timeline embed before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new MindBillClient({ apiKey: "mb_sandbox_secret", fetch: fetcher });
    expect(() => client.createEmbedSession({
      component: "bill-timeline",
      allowedOrigin: "https://partner.example.test",
    })).toThrow("billId is required");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("normalizes an exact embed origin and submits a bounded expiry", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      sessionId: "session_1",
      component: "collections",
      token: "single-use-session-token",
      embedUrl: "https://embed.mindbill.org/v1/collections",
      expiresAt: "2026-08-16T01:00:00.000Z",
    }));
    const client = new MindBillClient({ apiKey: "mb_sandbox_secret", fetch: fetcher });
    await client.createEmbedSession({
      component: "collections",
      allowedOrigin: "https://partner.example.test",
      expiresIn: 300,
    });

    const [url, request] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://app.mindbill.org/partner/v1/embed/sessions");
    expect(JSON.parse(String(request?.body))).toEqual({
      component: "collections",
      allowedOrigin: "https://partner.example.test",
      expiresIn: 300,
    });
  });

  it("rejects invalid embed origins and expiries before making a request", () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new MindBillClient({ apiKey: "mb_sandbox_secret", fetch: fetcher });
    expect(() => client.createEmbedSession({
      component: "collections",
      allowedOrigin: "https://partner.example.test/path",
    })).toThrow("allowedOrigin must be an exact HTTPS origin");
    expect(() => client.createEmbedSession({
      component: "collections",
      allowedOrigin: "https://partner.example.test",
      expiresIn: 59,
    })).toThrow("expiresIn must be an integer from 60 through 3600 seconds");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
