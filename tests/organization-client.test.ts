import { describe, expect, it, vi } from "vitest";

import { createOrganizationClient, organizationTaxIdWrite } from "../packages/browser/src/index";

const profile = {
  organizationId: "org-1",
  practiceIdentity: { name: "P" },
  billingProviders: [],
  locations: [],
  w9: null,
  onboarding: { status: "configuring", complete: false, checklist: [] },
};

function sessionResponse() {
  return new Response(JSON.stringify({ token: "tok-12345", expiresAt: new Date(Date.now() + 600000).toISOString() }), { status: 200 });
}

describe("organization client", () => {
  it("loads masked billing choices through the read-only billing profile route", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(sessionResponse()).mockResolvedValueOnce(new Response(JSON.stringify({ data: profile }), { status: 200 }));
    const client = createOrganizationClient({ apiBaseUrl: "https://api.test", fetch: fetchMock });
    expect(await client.getBillingProfile()).toEqual(profile);
    expect(fetchMock.mock.calls[1]![0]).toBe("https://api.test/partner/v2/browser/organization/billing-profile");
    expect(fetchMock.mock.calls[1]![1].method).toBeUndefined();
  });
  it("preserves masked SSNs and strips read-only metadata without mutating state", () => {
    const state = { name: "Synthetic", taxIdType: "SSN" as const, taxId: "", taxIdLast4: "0000", taxIdConfigured: true };
    expect(organizationTaxIdWrite(state)).toEqual({ name: "Synthetic", taxIdType: "SSN" });
    expect(state.taxIdConfigured).toBe(true);
    expect(organizationTaxIdWrite({ ...state, taxId: "000-00-0000" })).toEqual({ name: "Synthetic", taxIdType: "SSN", taxId: "000-00-0000" });
    expect(organizationTaxIdWrite({ ...state, taxIdConfigured: false })).toEqual({ name: "Synthetic", taxIdType: "SSN", taxId: "" });
    expect(organizationTaxIdWrite({ taxIdType: "EIN", taxId: "94-1234567" })).toEqual({ taxIdType: "EIN", taxId: "94-1234567" });
  });

  it("round-trips masked profile reads as preserve operations", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve(String(url).includes("/session") ? sessionResponse() : new Response(JSON.stringify({ data: profile }), { status: 200 })));
    const client = createOrganizationClient({ apiBaseUrl: "https://api.test", fetch: fetchMock });
    const masked = { taxIdType: "SSN" as const, taxId: "", taxIdLast4: "0000", taxIdConfigured: true };
    await client.saveBillingProfile({ practiceIdentity: masked, billingProviders: [{ id: "bp-1", name: "Synthetic", npi: "1111111111", ...masked }] });
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(JSON.parse(put[1].body as string)).toEqual({ practiceIdentity: { taxIdType: "SSN" }, billingProviders: [{ id: "bp-1", name: "Synthetic", npi: "1111111111", taxIdType: "SSN" }] });
  });
  it("mints a session then GETs the profile with the bearer token", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: profile }), { status: 200 }));
    const client = createOrganizationClient({ sessionEndpoint: "/api/mindbill/session", apiBaseUrl: "https://api.test", fetch: fetchMock });
    const result = await client.getOrganization();
    expect(result.organizationId).toBe("org-1");
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/mindbill/session");
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe("https://api.test/partner/v2/browser/organization");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok-12345");
  });

  it("PUTs billing profile, locations, and W-9 to the browser organization routes", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        String(url).includes("/session")
          ? sessionResponse()
          : new Response(JSON.stringify({ data: profile }), { status: 200 }),
      ),
    );
    const client = createOrganizationClient({ apiBaseUrl: "https://api.test", fetch: fetchMock });
    await client.saveBillingProfile({ practiceIdentity: { taxId: "94-1234567" } });
    await client.saveLocations([{ name: "A", street: "1 St", city: "SF", state: "CA", zip: "94103" }]);
    await client.saveW9({ filename: "w9.pdf", contentBase64: "JVBERi0=" });
    const putCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(putCalls.map(([url]) => String(url).replace("https://api.test", ""))).toEqual([
      "/partner/v2/browser/organization/billing-profile",
      "/partner/v2/browser/organization/locations",
      "/partner/v2/browser/organization/w9",
    ]);
    expect(JSON.parse(putCalls[1]![1].body as string)).toEqual({ locations: [{ name: "A", street: "1 St", city: "SF", state: "CA", zip: "94103" }] });
  });

  it("re-mints the session once on a 401 and retries", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: profile }), { status: 200 }));
    const client = createOrganizationClient({ apiBaseUrl: "https://api.test", fetch: fetchMock });
    const result = await client.getOrganization();
    expect(result.organizationId).toBe("org-1");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
