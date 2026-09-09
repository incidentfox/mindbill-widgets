// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { createBillReferenceClient, normalizeRfaFax, rfaAuthorizationDestinations, type BillClaimsAdministratorDirectory } from "../packages/browser/src/index";
import { RfaAuthorizationDestination } from "../packages/react/src/rfa-authorization-destination";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const directory: BillClaimsAdministratorDirectory = {
  id: "administrator_synthetic", authorizationStatus: "claim_handling_location_routes",
  authorizationSource: { url: "https://example.test/directory", observedAt: "2026-09-09T00:00:00Z" },
  authorization: [
    { location: "North office", method: "fax", fax: "(800) 555-0100", phone: "8005550199" },
    { location: "South office", method: "email", email: "authorization@example.test", phone: "8005550198" },
    { name: "Telephone only", phone: "8005550111" },
  ],
};
it("retains separate fax/email routes and never converts a telephone into a fax", () => {
  expect(rfaAuthorizationDestinations(directory)).toEqual([
    { label: "North office", method: "fax", destination: "+18005550100", phone: "8005550199" },
    { label: "South office", method: "email", destination: "authorization@example.test", phone: "8005550198" },
  ]);
  for (const status of ["profile_not_published", "adjuster_specific_required", "daisybill_unverified"] as const) {
    expect(rfaAuthorizationDestinations({ ...directory, authorizationStatus: status })).toEqual([]);
  }
  for (const input of ["8005550100 ext 9", "fax:8005550100", "8005550100@example.test"]) expect(normalizeRfaFax(input)).toBeNull();
});
it("preserves directory metadata through the browser client and surfaces unavailable endpoints", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ data: directory }));
  const client = createBillReferenceClient({ getSession: async () => ({ token: "synthetic_token" }), fetch: fetcher });
  expect(await client.getClaimsAdministratorDirectory("synthetic/id", "CA")).toEqual(directory);
  expect(String(fetcher.mock.calls[0]?.[0])).toContain("synthetic%2Fid?injuryState=CA");
  fetcher.mockResolvedValueOnce(Response.json({ error: "Unavailable" }, { status: 404 }));
  await expect(client.getClaimsAdministratorDirectory("missing_synthetic", "CA")).rejects.toThrow();
});
it("requires explicit choice, separates email, clears retired destinations and tolerates inline callbacks", async () => {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container); const changed = vi.fn();
  const render = (data: BillClaimsAdministratorDirectory | null, key = "synthetic_request") => act(async () => root.render(createElement(RfaAuthorizationDestination, { contextKey: key, directory: data, onChange: value => changed(value) })));
  const choose = async (value: string) => act(async () => { const select = container.querySelector("select")!; select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
  try {
    await render(directory); expect(changed).toHaveBeenLastCalledWith(null);
    expect(container.querySelector("select")?.value).toBe("");
    await choose("0"); expect(changed.mock.lastCall?.[0]?.destination).toBe("+18005550100");
    const calls = changed.mock.calls.length;
    await render(structuredClone(directory)); expect(changed.mock.calls).toHaveLength(calls);
    expect(container.querySelector("select")?.value).toBe("0");
    await choose("1"); expect(changed.mock.lastCall?.[0]?.method).toBe("email");
    expect(container.textContent).toContain("This selection does not send an email");
    await render({ ...directory, authorizationStatus: "profile_not_published" });
    expect(changed).toHaveBeenLastCalledWith(null); expect(container.querySelectorAll("option")).toHaveLength(2);
    await choose("manual");
    expect(container.querySelector('input[type="tel"]')).not.toBeNull();
    await render(null, "different_synthetic_request"); expect(container.querySelector("select")?.value).toBe("");
  } finally { await act(async () => root.unmount()); container.remove(); }
});
