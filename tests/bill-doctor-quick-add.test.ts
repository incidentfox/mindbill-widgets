// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { BillDoctorQuickAdd } from "../packages/react/src/bill-doctor-quick-add";
import { createOrganizationClient } from "../packages/browser/src/index";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const profile = { organizationId: "synthetic", practiceIdentity: {}, billingProviders: [], renderingProviders: [] as Array<Record<string, unknown>>, locations: [], w9: null, onboarding: { status: null, complete: false, checklist: [] } };
const setValue = (element: HTMLInputElement, value: string) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); };

async function fill(container: HTMLElement) {
  const inputs = container.querySelectorAll<HTMLInputElement>("input:not([type])");
  await act(async () => { setValue(inputs[0]!, "Dr Synthetic New"); setValue(inputs[1]!, "1245319607"); setValue(inputs[2]!, "207x00000x"); });
}
const click = async (container: HTMLElement, label: string) => { const button = [...container.querySelectorAll("button")].find((item) => item.textContent === label)!; await act(async () => { button.click(); await new Promise((resolve) => setTimeout(resolve, 0)); }); };

describe("bill form: add new doctor", () => {
  it("saves the doctor through the settings connection and reports the new id", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "PUT") { const body = JSON.parse(String(init.body)); return Response.json({ data: { ...profile, renderingProviders: [{ ...body.renderingProviders[0], id: "rp_new", signatureConfigured: false, signatureOnClaimForm: false }] } }); }
      return Response.json({ data: profile });
    });
    const onSaved = vi.fn(); const onUseForBill = vi.fn();
    const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
    await act(async () => root.render(createElement(BillDoctorQuickAdd, { settingsClient: createOrganizationClient({ getSession: async () => ({ token: "synthetic" }), fetch: fetcher }), onSaved, onUseForBill, onClose: () => undefined })));
    await fill(container);
    await click(container, "Save doctor and use on this bill");
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "synthetic" }), "rp_new");
    expect(onUseForBill).not.toHaveBeenCalled();
    await act(async () => root.unmount()); container.remove();
  });
  it("without a settings connection fills this bill only and says so", async () => {
    const onUseForBill = vi.fn();
    const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
    await act(async () => root.render(createElement(BillDoctorQuickAdd, { settingsClient: null, onSaved: () => undefined, onUseForBill, onClose: () => undefined })));
    expect(container.textContent).toContain("These details fill this bill only");
    expect(container.querySelector("input[type=file]")).toBeNull();
    await fill(container);
    await click(container, "Use on this bill");
    expect(onUseForBill).toHaveBeenCalledWith(expect.objectContaining({ name: "Dr Synthetic New", npi: "1245319607", taxonomy: "207X00000X" }));
    await act(async () => root.unmount()); container.remove();
  });
  it("with only the bill session, adds the doctor (no billingSettings) and selects it", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      if (init?.method === "POST" && String(input).endsWith("/rendering-providers")) return Response.json({ data: { providerId: "rp_bill", profile } });
      return Response.json({ data: profile });
    });
    const onSaved = vi.fn(); const onUseForBill = vi.fn();
    const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
    await act(async () => root.render(createElement(BillDoctorQuickAdd, { settingsClient: null, billClient: createOrganizationClient({ getSession: async () => ({ token: "synthetic" }), fetch: fetcher }), onSaved, onUseForBill, onClose: () => undefined })));
    expect(container.querySelector("input[type=file]")).not.toBeNull();
    await fill(container);
    await click(container, "Save doctor and use on this bill");
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "synthetic" }), "rp_bill");
    const post = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({ name: "Dr Synthetic New", npi: "1245319607", taxonomy: "207X00000X" });
    await act(async () => root.unmount()); container.remove();
  });
  it("selects an already-saved doctor on a 409 and falls back to this bill only on an older server (403)", async () => {
    for (const [status, body] of [[409, { error: "rendering_provider_exists", providerId: "rp_existing" }], [403, { error: "insufficient_permission" }]] as const) {
      const fetcher = vi.fn<typeof fetch>(async (_input, init) => init?.method === "POST" ? Response.json(body, { status }) : Response.json({ data: profile }));
      const onSaved = vi.fn(); const onUseForBill = vi.fn(); const onUnsupported = vi.fn();
      const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
      await act(async () => root.render(createElement(BillDoctorQuickAdd, { settingsClient: null, billClient: createOrganizationClient({ getSession: async () => ({ token: "synthetic" }), fetch: fetcher }), onSaved, onUseForBill, onUnsupported, onClose: () => undefined })));
      await fill(container);
      await click(container, "Save doctor and use on this bill");
      if (status === 409) { expect(onSaved).toHaveBeenCalledWith(expect.anything(), "rp_existing"); expect(onUseForBill).not.toHaveBeenCalled(); }
      else { expect(onUnsupported).toHaveBeenCalled(); expect(onUseForBill).toHaveBeenCalled(); expect(onSaved).not.toHaveBeenCalled(); }
      await act(async () => root.unmount()); container.remove();
    }
  });
});
