// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { RfaRecord } from "@mindbill/browser";
import { RfaDraftActions, type RfaDraftActionsProps } from "../packages/react/src/rfa-draft-actions";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const record: RfaRecord = { id: "rfa_synthetic", contentRevision: 1, claimId: "claim_synthetic", patientId: "patient_synthetic", renderingProviderId: "provider_synthetic", claimsAdminId: null, employeeName: "Synthetic patient", providerName: "Synthetic physician", claimNumber: "SYNTHETIC-001", status: "draft", reviewType: "prospective", expedited: false, signedAt: null, submittedAt: null, receivedAt: null, createdAt: null, updatedAt: null, decisionDueAt: null, decisionDeadlineBasis: null, incompleteReason: null, deferredReason: null, closedReason: null, readiness: { ready: false, missing: [] }, items: [], documents: [], transmissions: [], informationRequests: [], events: [] };
const getSession = async () => ({ token: "synthetic_token" });
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function mount(props: Partial<RfaDraftActionsProps> = {}) {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const render = async (extra: Partial<RfaDraftActionsProps> = {}) => act(async () => root.render(createElement(RfaDraftActions, { rfa: record, getSession, permissions: ["create", "edit"], ...props, ...extra })));
  const button = (text: string) => [...container.querySelectorAll("button")].find(item => item.textContent === text);
  const click = async (text: string) => act(async () => { const target = button(text); expect(target).toBeDefined(); target!.click(); });
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  await render(); return { container, render, button, click };
}
it("requires copy confirmation and opens the new unsigned draft through the callback", async () => {
  const draft = { ...record, id: "rfa_synthetic_copy" };
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ data: draft })); const onCopied = vi.fn();
  const ui = await mount({ fetch: fetcher, onCopied });
  await ui.click("Copy to new draft"); expect(fetcher).not.toHaveBeenCalled();
  expect(ui.container.textContent).toContain("Signatures, supporting documents, decisions, and delivery history remain on the original");
  await ui.click("Create draft copy"); expect(onCopied).toHaveBeenCalledExactlyOnceWith(draft);
  expect(ui.container.textContent).toContain("A new unsigned draft was created");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("retains one idempotency key on copy retry after an ambiguous failure", async () => {
  const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("Connection interrupted")).mockResolvedValueOnce(Response.json({ data: { ...record, id: "rfa_synthetic_copy" } }));
  const ui = await mount({ fetch: fetcher });
  await ui.click("Copy to new draft"); await ui.click("Create draft copy");
  expect(ui.container.querySelector('[role="alert"]')?.textContent).toContain("Connection interrupted");
  await ui.click("Create draft copy");
  const keys = fetcher.mock.calls.map(([, init]) => new Headers(init?.headers).get("idempotency-key"));
  expect(keys[0]).toBeTruthy(); expect(keys[0]).toBe(keys[1]);
});
it("requires a separate draft cancellation confirmation and keeps audit history", async () => {
  const canceled = { ...record, status: "canceled" }; const onCanceled = vi.fn();
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ data: canceled }));
  const ui = await mount({ fetch: fetcher, onCanceled });
  await ui.click("Cancel draft"); expect(fetcher).not.toHaveBeenCalled();
  expect(ui.container.textContent).toContain("audit history will be retained");
  await ui.click("Confirm cancellation"); expect(onCanceled).toHaveBeenCalledExactlyOnceWith(canceled);
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({ status: "canceled", draftOnly: true, expectedRevision: 1 });
});
it("never exposes cancellation for signed, submitted, or transmitted records", async () => {
  const ui = await mount();
  for (const current of [{ ...record, status: "sent" }, { ...record, signedAt: "2026-09-01T00:00:00Z" }, { ...record, submittedAt: "2026-09-01T00:00:00Z" }, { ...record, receivedAt: "2026-09-01T00:00:00Z" }, { ...record, transmissions: [{ id: "transmission_synthetic", direction: "outbound", channel: "fax", status: "queued", destination: null, occurredAt: null, receivedAt: null, proofDocumentId: null, providerMessageId: null }] }]) {
    await ui.render({ rfa: current }); expect(ui.button("Cancel draft")).toBeUndefined(); expect(ui.button("Copy to new draft")).toBeDefined();
  }
  await ui.render({ permissions: [] }); expect(ui.container.textContent).toBe("");
  await ui.render({ permissions: ["edit"] }); expect(ui.button("Copy to new draft")).toBeUndefined(); expect(ui.button("Cancel draft")).toBeDefined();
});
it("discards stale pending callbacks when the selected record changes", async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi.fn<typeof fetch>(() => new Promise(response => { resolve = response; })); const onCopied = vi.fn();
  const ui = await mount({ fetch: fetcher, onCopied });
  await ui.click("Copy to new draft"); await ui.click("Create draft copy");
  await ui.render({ rfa: { ...record, id: "rfa_other_synthetic" } });
  await act(async () => resolve(Response.json({ data: { ...record, id: "rfa_synthetic_copy" } })));
  expect(onCopied).not.toHaveBeenCalled(); expect(ui.button("Copy to new draft")).toBeDefined();
});
