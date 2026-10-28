// @vitest-environment happy-dom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { BillingSettings } from "../packages/react/src/organization-onboarding";
import { createOrganizationClient } from "../packages/browser/src/index";
import { MindBillClient } from "../packages/node/src/index";
import { choose, selects } from "./form-control-helpers";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const getSession = async () => ({ token: "synthetic" });
const admin = { id: "custom_1", name: "Synthetic administrator", fax: "5550001234", email: null, mailingAddress: null, notes: null, submissionMethod: "fax", active: true, createdAt: "2026-09-16" };
const member = { id: "user_1", name: "Synthetic member", email: "member@example.test", role: "viewer", active: true, createdAt: "2026-09-16", canManage: true };
const profile = { organizationId: "synthetic", practiceIdentity: {}, billingProviders: [], locations: [], w9: null, onboarding: { status: null, complete: false, checklist: [] } };
const team = { members: [member], roles: [{ id: "viewer", label: "Viewer", permissions: [] }, { id: "biller", label: "Biller", permissions: ["bills.create"] }], capabilities: { canManage: true, canAdd: false }, identityDomain: "mindbill" };
async function mounted(element: ReactElement, run: (container: HTMLDivElement, render: (next: ReactElement) => Promise<void>) => Promise<void>) {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const render = async (next: ReactElement) => { await act(async () => root.render(next)); };
  try { await render(element); await run(container, render); } finally { await act(async () => root.unmount()); container.remove(); }
}
async function click(container: HTMLElement, label: string) { const button = [...container.querySelectorAll("button")].find(button => button.textContent === label); expect(button).toBeTruthy(); await act(async () => button!.click()); }

describe("organization administration", () => {
  it("loads each administrative section only when selected and saves existing roles", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (init?.method === "PATCH") return Response.json({ data: { ...member, ...JSON.parse(String(init.body)) } });
      return Response.json({ data: path.endsWith("/team") ? team : path.endsWith("/claims-administrators") ? [admin] : profile });
    });
    await mounted(createElement(BillingSettings, { getSession, fetch: fetcher }), async container => {
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(container.querySelector("details")?.textContent).toContain("Organization details");
      await click(container, "Claims administrators"); expect(container.textContent).toContain(admin.name);
      await click(container, "Team"); expect(container.textContent).toContain(member.email);
      await choose(selects(container)[0]!, "biller");
      expect(fetcher.mock.calls.at(-1)?.[1]?.body).toBe(JSON.stringify({ role: "biller" }));
      expect(container.textContent).toContain("Saved to MindBill.");
    });
  });
  it("shows no team mutation controls when access is denied", async () => {
    const fetcher = vi.fn<typeof fetch>(async input => String(input).endsWith("/team") ? Response.json({ detail: "Team access denied" }, { status: 403 }) : Response.json({ data: profile }));
    await mounted(createElement(BillingSettings, { getSession, fetch: fetcher }), async container => {
      await click(container, "Team"); expect(container.querySelector('[role="alert"]')?.textContent).toContain("Team access denied");
      expect(selects(container)).toHaveLength(0); expect(container.textContent).not.toContain("Deactivate");
    });
  });
  it("requires confirmation before removing a custom administrator", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => Response.json({ data: init?.method === "DELETE" ? { id: admin.id, deleted: true } : String(input).endsWith("/claims-administrators") ? [admin] : profile }));
    await mounted(createElement(BillingSettings, { getSession, fetch: fetcher }), async container => {
      await click(container, "Claims administrators"); await click(container, admin.name); await click(container, "Remove administrator");
      expect(fetcher.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
      await click(container, "Confirm removal"); expect(fetcher.mock.calls.at(-1)?.[1]?.method).toBe("DELETE"); expect(container.textContent).not.toContain(admin.name);
    });
  });
  it("edits a custom administrator's mailing address as separate fields", async () => {
    const withMail = { ...admin, mailingAddress: "PO Box 1, Sacramento, CA 95814" };
    const fetcher = vi.fn<typeof fetch>(async (input, init) => init?.method === "PATCH"
      ? Response.json({ data: { ...withMail, ...JSON.parse(String(init.body)) } })
      : Response.json({ data: String(input).endsWith("/claims-administrators") ? [withMail] : profile }));
    await mounted(createElement(BillingSettings, { getSession, fetch: fetcher }), async container => {
      await click(container, "Claims administrators"); await click(container, withMail.name);
      const field = (name: string) => container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
      expect([field("line1").value, field("city").value, field("state").value, field("postalCode").value]).toEqual(["PO Box 1", "Sacramento", "CA", "95814"]);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      await act(async () => { setter.call(field("line2"), "Suite 2"); field("line2").dispatchEvent(new Event("input", { bubbles: true })); });
      await act(async () => { setter.call(field("postalCode"), "958"); field("postalCode").dispatchEvent(new Event("input", { bubbles: true })); });
      const save = [...container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Save claims administrator")!;
      expect(save.disabled).toBe(true);
      await act(async () => { setter.call(field("postalCode"), "95814"); field("postalCode").dispatchEvent(new Event("input", { bubbles: true })); });
      expect(save.disabled).toBe(false);
      await click(container, "Save claims administrator");
      const patch = fetcher.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(JSON.parse(String(patch?.[1]?.body)).mailingAddress).toBe("PO Box 1, Suite 2, Sacramento, CA 95814");
    });
  });
  it("discards a previous organization response after the connection changes", async () => {
    let resolve!: (response: Response) => void;
    const oldFetch = vi.fn<typeof fetch>(async input => String(input).endsWith("/team") ? new Promise<Response>(done => { resolve = done; }) : Response.json({ data: profile }));
    const newFetch = vi.fn<typeof fetch>(async () => Response.json({ data: { ...team, members: [] } }));
    await mounted(createElement(BillingSettings, { getSession, fetch: oldFetch }), async (container, render) => {
      await click(container, "Team"); await render(createElement(BillingSettings, { getSession, fetch: newFetch }));
      await act(async () => resolve(Response.json({ data: team })));
      expect(container.textContent).not.toContain(member.email); expect(container.textContent).toContain("No MindBill accounts");
    });
  });
  it("supports custom administrator CRUD without changing request payloads", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => Response.json({ data: init?.method === "DELETE" ? { id: admin.id, deleted: true } : admin }));
    const client = createOrganizationClient({ getSession, fetch: fetcher });
    await client.createClaimsAdministrator({ name: admin.name, fax: admin.fax });
    await client.updateClaimsAdministrator("custom/id", { name: admin.name, email: "synthetic@example.test" });
    await client.deleteClaimsAdministrator("custom/id");
    expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual(["POST", "PATCH", "DELETE"]);
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("custom%2Fid");
    expect(fetcher.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ name: admin.name, email: "synthetic@example.test" }));
  });
  it("rejects team management in a customer-restricted session before any network request", () => {
    const fetcher = vi.fn<typeof fetch>(); const client = new MindBillClient({ apiKey: "synthetic", fetch: fetcher });
    expect(() => client.createBrowserSession({ subject: "synthetic", allowedOrigin: "https://example.test", permissions: ["team:manage"], resource: { customerExternalId: "customer1" } })).toThrow("unscoped administrator session");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
