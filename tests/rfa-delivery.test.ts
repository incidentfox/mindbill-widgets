// @vitest-environment happy-dom
// @vitest-environment-options {"happyDOM":{"settings":{"disableIframePageLoading":true}}}
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { RfaClient, RfaRecord } from "../packages/browser/src/index";
import { RfaDeliveryPanel } from "../packages/react/src/rfa-delivery-panel";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const record: RfaRecord = { claimId: "claim_synthetic", patientId: "patient_synthetic", renderingProviderId: "provider_synthetic", employeeName: "Synthetic Patient", providerName: "Synthetic Physician", claimNumber: "SYNTHETIC", status: "signed", reviewType: "prospective", expedited: false, createdAt: null, updatedAt: null, receivedAt: null, decisionDueAt: null, decisionDeadlineBasis: null, incompleteReason: null, deferredReason: null, closedReason: null, items: [], documents: [], transmissions: [], informationRequests: [], events: [], id: "rfa_synthetic", contentRevision: 2, signedAt: "2026-09-17T00:00:00Z", submittedAt: null, claimsAdminId: null, readiness: { ready: true, missing: [] }, authorizationContact: { email: "authorization@example.test", fax: "+18005550100" } };
async function setup(environment = "live") {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const prepareDelivery = vi.fn().mockResolvedValue({ packetId: "packet_synthetic", sha256: "a".repeat(64), contentRevision: 2 });
  const getPacket = vi.fn().mockResolvedValue(new Blob(["%PDF-synthetic"], { type: "application/pdf" }));
  const submit = vi.fn().mockResolvedValue({ ...record, submittedAt: "2026-09-17T01:00:00Z" }); const updated = vi.fn();
  const client = { prepareDelivery, getPacket, submit } as unknown as RfaClient;
  const render = async (documentIds = ["form_synthetic", "clinical_synthetic"]) => act(async () => root.render(createElement(RfaDeliveryPanel, { rfa: record, client, documentIds, directory: null, directoryLoading: false, directoryError: null, locked: false, environment, canSend: true, run: async work => work(), onUpdated: updated })));
  await render();
  const button = (text: string) => [...container.querySelectorAll("button")].find(node => node.textContent === text)!;
  const click = async (text: string) => act(async () => button(text).click());
  const select = async (index: number, value: string) => act(async () => { const node = container.querySelectorAll("select")[index]!; node.value = value; node.dispatchEvent(new Event("change", { bubbles: true })); });
  const prepare = () => click("Prepare packet with cover sheet");
  const attest = async () => { for (const node of container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) await act(async () => node.click()); };
  const destroy = async () => { await act(async () => root.unmount()); container.remove(); };
  return { container, prepareDelivery, getPacket, submit, updated, render, button, click, select, prepare, attest, destroy };
}
it("binds email sending to the prepared packet and explicit human review", async () => {
  const ui = await setup();
  try {
    await ui.select(1, "0");
    expect(ui.submit).not.toHaveBeenCalled();
    await ui.prepare();
    expect(ui.prepareDelivery).toHaveBeenCalledWith(record.id, { documentIds: ["form_synthetic", "clinical_synthetic"], channel: "email", to: "authorization@example.test" });
    expect(ui.button("Send authorization email").disabled).toBe(true);
    await ui.attest(); await ui.click("Send authorization email");
    expect(ui.submit).toHaveBeenCalledWith(record.id, { packetId: "packet_synthetic", sha256: "a".repeat(64), channel: "email", to: "authorization@example.test" }, expect.any(String));
    expect(ui.updated).toHaveBeenCalledOnce();
  } finally { await ui.destroy(); }
});
it("invalidates packet review on recipient, message, and attachment changes", async () => {
  const ui = await setup();
  try {
    await ui.select(1, "0"); await ui.prepare(); await ui.attest();
    await ui.select(1, "1"); expect(ui.container.querySelector("iframe")).toBeNull(); expect(ui.button("Send authorization fax").disabled).toBe(true);
    await ui.prepare(); await ui.attest();
    await act(async () => { const node = ui.container.querySelector("textarea")!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(node, "Synthetic cover message"); node.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(ui.container.querySelector("iframe")).toBeNull(); expect(ui.button("Send authorization fax").disabled).toBe(true);
    await ui.prepare(); expect(ui.prepareDelivery.mock.lastCall?.[1]).toMatchObject({ message: "Synthetic cover message" }); await ui.attest();
    await ui.render(["form_synthetic", "clinical_other"]); expect(ui.container.querySelector("iframe")).toBeNull(); expect(ui.button("Send authorization fax").disabled).toBe(true);
    expect(ui.submit).not.toHaveBeenCalled();
  } finally { await ui.destroy(); }
});
it("downloads an authenticated packet without submitting and blocks sandbox sending", async () => {
  const ui = await setup("sandbox");
  try {
    await ui.select(1, "0"); await ui.prepare();
    expect(ui.container.textContent).toContain("Email sending is also disabled"); expect(ui.button("Send authorization email")).toBeUndefined();
    await ui.select(0, "download"); await ui.prepare();
    expect(ui.prepareDelivery.mock.lastCall?.[1]).toEqual({ documentIds: ["form_synthetic", "clinical_synthetic"], channel: "download" });
    expect(ui.container.querySelector('a[download]')).not.toBeNull(); expect(ui.submit).not.toHaveBeenCalled(); expect(ui.updated).not.toHaveBeenCalled();
  } finally { await ui.destroy(); }
});
it("discards a slow preview response after the selected documents change", async () => {
  const ui = await setup();
  try {
    await ui.select(1, "0"); let resolve!: (value: unknown) => void;
    ui.prepareDelivery.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await ui.prepare(); await ui.render(["form_synthetic", "clinical_new"]);
    await act(async () => resolve({ packetId: "stale", sha256: "a".repeat(64), contentRevision: 2 }));
    expect(ui.container.querySelector("iframe")).toBeNull(); expect(ui.button("Send authorization email").disabled).toBe(true);
  } finally { await ui.destroy(); }
});

it("binds the attention name to preview and delivery and invalidates review when it changes", async () => {
  const ui = await setup();
  const type = (selector: string, value: string) => act(async () => { const input = ui.container.querySelector<HTMLInputElement>(selector)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
  try {
    await ui.select(1, "manual");
    await type('input[type="tel"]', "8005550100");
    await type('input:not([type])', "Synthetic Adjuster");
    await ui.prepare(); await ui.attest();
    expect(ui.prepareDelivery.mock.lastCall?.[1]).toMatchObject({ channel: "fax", to: "+18005550100", recipientName: "Synthetic Adjuster" });
    await type('input:not([type])', "Another Synthetic Adjuster");
    expect(ui.container.querySelector("iframe")).toBeNull();
    expect(ui.button("Send authorization fax").disabled).toBe(true);
    await ui.prepare(); await ui.attest(); await ui.click("Send authorization fax");
    expect(ui.submit).toHaveBeenCalledWith(record.id, expect.objectContaining({ channel: "fax", to: "+18005550100", recipientName: "Another Synthetic Adjuster" }), expect.any(String));
  } finally { await ui.destroy(); }
});
