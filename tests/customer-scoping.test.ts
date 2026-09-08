import { describe, expect, it, vi } from "vitest";
import { MindBillClient, type BrowserSessionResource } from "../packages/node/src/index";
import { createBillSubmissionClient, type BrowserBillSubmissionInput } from "../packages/browser/src/index";

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
const resources: BrowserSessionResource[] = [
  { customerExternalId: "customer-synthetic" },
  { billId: "bill-synthetic" },
  { customerExternalId: "customer-synthetic", billId: "bill-synthetic" },
];

describe("workspace customer sessions", () => {
  it.each(resources)("preserves the server-authorized customer/bill restriction %j", async (resource) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ token: "synthetic-short-token", resource }));
    const client = new MindBillClient({ apiKey: "synthetic-workspace-key", fetch: fetcher });
    await client.createBrowserSession({
      subject: " user-synthetic ", allowedOrigin: "https://host.example.test",
      permissions: [resource.billId ? "bills:read" : "bills:create"], resource,
    });
    const request = fetcher.mock.calls[0]![1]!;
    expect(JSON.parse(String(request.body))).toMatchObject({ subject: "user-synthetic", resource });
    expect(new Headers(request.headers).has("x-mindbill-org-id")).toBe(false);
  });

  it("normalizes customer IDs without widening an intersection", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ token: "synthetic-short-token" }));
    const client = new MindBillClient({ apiKey: "synthetic-key", fetch: fetcher });
    await client.createBrowserSession({
      subject: "user", allowedOrigin: "http://localhost:3000", permissions: ["bills:read"],
      resource: { customerExternalId: " customer-a ", billId: " bill-a " },
    });
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]!.body)).resource).toEqual({ customerExternalId: "customer-a", billId: "bill-a" });
  });

  it.each([{}, { customerExternalId: "" }, { customerExternalId: " " }, { customerExternalId: "a".repeat(256) },
    { billId: "" }, { billId: "b".repeat(129) }, { customerExternalId: "customer", billId: "" },
    { customerExternalId: "customer", organizationId: "foreign" }])("rejects malformed or widened resource %j before transport", (resource) => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new MindBillClient({ apiKey: "synthetic-key", fetch: fetcher });
    expect(() => client.createBrowserSession({
      subject: "user", allowedOrigin: "https://host.example.test", permissions: ["bills:read"],
      resource: resource as unknown as BrowserSessionResource,
    })).toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps shared administration separate from customer or case sessions", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ token: "synthetic-admin-token" }));
    const client = new MindBillClient({ apiKey: "synthetic-key", fetch: fetcher });
    for (const resource of resources) expect(() => client.createBrowserSession({
      subject: "admin", allowedOrigin: "https://host.example.test", permissions: ["organization:manage"], resource,
    })).toThrow("separate unscoped administrator session");
    expect(fetcher).not.toHaveBeenCalled();
    await client.createBrowserSession({ subject: "admin", allowedOrigin: "https://host.example.test", permissions: ["organization:manage"] });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("retains the bill-only prohibition on creation for intersected scopes", () => {
    const client = new MindBillClient({ apiKey: "synthetic-key", fetch: vi.fn<typeof fetch>() });
    expect(() => client.createBrowserSession({
      subject: "user", allowedOrigin: "https://host.example.test", permissions: ["bills:create"],
      resource: { customerExternalId: "customer", billId: "bill" },
    })).toThrow("bill-restricted session");
  });

  it("forwards an explicit trusted customer filter in server collection reads", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ data: [], nextCursor: null }));
    await new MindBillClient({ apiKey: "synthetic-key", fetch: fetcher }).listBills({ customerExternalId: "customer/a" });
    expect(String(fetcher.mock.calls[0]![0])).toContain("customerExternalId=customer%2Fa");
  });
});

const address = { line1: "100 Example Street", city: "Example", state: "CA", postalCode: "90012" };
const submission = {
  customerExternalId: "customer-synthetic",
  bill: {
    externalId: "case-synthetic", patient: { firstName: "Synthetic", lastName: "Example", dateOfBirth: "1980-01-01", address },
    claim: { employer: "Synthetic Employer", claimNumber: "TEST-ONLY", dateOfInjury: "2026-01-01", claimsAdministrator: { id: "payer-synthetic", name: "Synthetic Payer" } },
    service: { date: "2026-02-01" }, diagnoses: ["M25.512"],
    billingProvider: { name: "Synthetic Provider", npi: "1234567893", taxId: "123456789", address, phone: "5555550100" },
    renderingProvider: { name: "Synthetic Doctor", npi: "1234567893", taxonomy: "207Q00000X" },
    serviceLocation: { address, placeOfServiceCode: "11" },
    serviceLines: [{ code: "ML201", units: 1, charge: 2015 }],
  },
} satisfies BrowserBillSubmissionInput;

describe("customer submission wire contract", () => {
  it("keeps the trusted customer reference at the top-level server submission", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ id: "bill-synthetic" }));
    await new MindBillClient({ apiKey: "synthetic-key", fetch: fetcher }).createAndSubmitBill(submission, "synthetic-retry");
    const sent = JSON.parse(String(fetcher.mock.calls[0]![1]!.body));
    expect(sent.customerExternalId).toBe("customer-synthetic");
    expect(sent.bill.customerExternalId).toBeUndefined();
  });

  it("preserves an optional customer assertion for backend enforcement in browser submissions", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ id: "bill-synthetic" }));
    const client = createBillSubmissionClient({
      getSession: async () => ({ token: "synthetic-customer-token", expiresAt: "2099-01-01T00:00:00Z" }), fetch: fetcher,
    });
    await client.submitBill(submission, { idempotencyKey: "synthetic-retry" });
    const sent = JSON.parse(String(fetcher.mock.calls[0]![1]!.body));
    expect(sent.customerExternalId).toBe("customer-synthetic");
    expect(sent.bill.customerExternalId).toBeUndefined();
    expect(new Headers(fetcher.mock.calls[0]![1]!.headers).get("authorization")).toBe("Bearer synthetic-customer-token");
  });
});
