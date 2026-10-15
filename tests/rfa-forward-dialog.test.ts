// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { createRfaClient, createRfaPacketsClient, type RfaPacketHistory, type RfaRecord } from "@mindbill/browser";
import { RfaDuplicateDialog, rfaForwardDefaultSelection, rfaForwardDocuments } from "../packages/react/src/rfa-duplicate-dialog";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// Synthetic data only.
const doc = (id: string, documentType: string, extra: Partial<RfaRecord["documents"][number]> = {}) => ({ id, documentType, filename: `${id}.pdf`, contentUrl: "", contentRevision: 1, createdAt: "2026-10-01T00:00:00Z", sizeBytes: 24_000, ...extra });
const record: RfaRecord = { id: "rfa_synthetic", contentRevision: 1, claimId: "claim_synthetic", patientId: "patient_synthetic", renderingProviderId: "provider_synthetic", claimsAdminId: null, employeeName: "Synthetic patient", providerName: "Synthetic physician", claimNumber: "SYNTHETIC-001", status: "received", reviewType: "prospective", expedited: false, signedAt: null, submittedAt: "2026-10-01T16:00:00Z", receivedAt: "2026-10-01T16:05:00Z", createdAt: null, updatedAt: null, decisionDueAt: "2026-10-06T07:00:00Z", decisionDeadlineBasis: null, incompleteReason: null, deferredReason: null, closedReason: null, readiness: { ready: true, missing: [] }, items: [],
  authorizationContact: { name: "Synthetic Claims", fax: "+15555550100" },
  documents: [doc("other_doc", "other"), doc("report_doc", "clinical_report"), doc("form_old", "rfa_form", { contentRevision: 0 }), doc("form_doc", "rfa_form"), doc("preview_doc", "rfa_form", { internal: true }), doc("cover_doc", "fax_cover")],
  transmissions: [], informationRequests: [], events: [] };
const sentPacket: RfaPacketHistory = { packets: [{ id: "packet_sent", source: "submission", sha256: "a".repeat(64), sizeBytes: 50_000, contentRevision: 1, createdAt: "2026-10-01T16:00:00Z" }], transmissions: [{ id: "t_sent", packetId: "packet_sent", purpose: "submission", channel: "fax", status: "delivered", destination: "+15555550100", occurredAt: "2026-10-01T16:00:00Z", receivedAt: null }] };
const getSession = async () => ({ token: "synthetic_token" });
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); vi.restoreAllMocks(); });

function fetcherFor(history: RfaPacketHistory, uploaded?: RfaRecord) {
  return vi.fn<typeof fetch>(async (url, init) => {
    const path = String(url);
    if (path.endsWith("/forwards")) return Response.json({ data: { packetId: "packet_forward_new", transmissionId: "t_forward" } });
    if (path.endsWith("/documents") && init?.method === "POST") return Response.json({ data: uploaded }, { status: 201 });
    if (path.endsWith("/packets")) return Response.json({ data: history });
    return new Response("%PDF-synthetic", { headers: { "content-type": "application/pdf" } });
  });
}
async function mount(fetcher: ReturnType<typeof fetcherFor>, props: { environment?: string; canUpload?: boolean; rfa?: RfaRecord } = {}) {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const options = { getSession, fetch: fetcher };
  const onSent = vi.fn(); const onUpdated = vi.fn();
  await act(async () => root.render(createElement(RfaDuplicateDialog, { rfa: props.rfa ?? record, options, records: createRfaClient(options), canUpload: props.canUpload ?? true, directory: null, directoryLoading: false, directoryError: null, environment: props.environment ?? "live", canAct: true, onUpdated, onSent, onClose: () => undefined })));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  const box = (name: string) => [...container.querySelectorAll<HTMLInputElement>(".mbrfa-fwd-doc input[type=checkbox]")].find(input => input.closest("label")?.textContent?.includes(name));
  const forward = () => [...container.querySelectorAll("button")].find(button => button.textContent === "Forward" || button.textContent === "Forwarding…")!;
  const confirm = async () => act(async () => container.querySelector<HTMLInputElement>(".mbrfa-send-confirm input")!.click());
  const posted = () => fetcher.mock.calls.filter(([url]) => String(url).endsWith("/forwards")).map(([, init]) => JSON.parse(String(init?.body)));
  return { container, box, forward, confirm, posted, onSent, onUpdated };
}

it("lists forwardable documents form first and starts with the signed form chosen", () => {
  const documents = rfaForwardDocuments(record);
  expect(documents.map(document => document.id)).toEqual(["form_doc", "report_doc", "other_doc"]);
  expect(rfaForwardDefaultSelection(documents)).toEqual(["form_doc"]);
});

it("forwards chosen documents when no packet was saved, with no 'send them yourself' dead end", async () => {
  const fetcher = fetcherFor({ packets: [], transmissions: [] });
  const ui = await mount(fetcher);
  expect(ui.container.textContent).not.toMatch(/send them yourself|cannot be forwarded/i);
  expect(ui.container.textContent).not.toContain("Packet as sent");
  expect(ui.box("form_doc.pdf")?.checked).toBe(true);
  expect(ui.box("report_doc.pdf")?.checked).toBe(false);
  expect(ui.container.textContent).toContain("Signed DWC Form RFA");
  // The saved fax destination is preselected; the button waits for the confirmation.
  expect(ui.forward().disabled).toBe(true);
  await act(async () => ui.box("report_doc.pdf")!.click());
  await ui.confirm();
  expect(ui.forward().disabled).toBe(false);
  // Nothing chosen: Forward stays disabled.
  await act(async () => { ui.box("form_doc.pdf")!.click(); ui.box("report_doc.pdf")!.click(); });
  expect(ui.forward().disabled).toBe(true);
  expect(ui.container.textContent).toContain("Choose at least one document.");
  await act(async () => { ui.box("form_doc.pdf")!.click(); ui.box("report_doc.pdf")!.click(); });
  await act(async () => ui.forward().click());
  expect(ui.posted()).toEqual([{ documentIds: ["form_doc", "report_doc"], channel: "fax", to: "+15555550100" }]);
  expect(ui.onSent).toHaveBeenCalledOnce();
  expect(ui.container.textContent).toContain("Forwarded to fax");
});

it("offers the packet as sent when one exists, unchosen by default, and sends it with the documents", async () => {
  const fetcher = fetcherFor(sentPacket);
  const ui = await mount(fetcher);
  expect(ui.box("Packet as sent")?.checked).toBe(false);
  await act(async () => { ui.box("Packet as sent")!.click(); ui.box("form_doc.pdf")!.click(); });
  await ui.confirm();
  await act(async () => ui.forward().click());
  expect(ui.posted()[0]).toMatchObject({ packetId: "packet_sent", documentIds: [], channel: "fax" });
});

it("uploads a dropped-in PDF attachment to the request, then includes it checked", async () => {
  const uploaded = { ...record, documents: [...record.documents, doc("attachment_doc", "other", { filename: "Synthetic attachment.pdf" })] };
  const fetcher = fetcherFor({ packets: [], transmissions: [] }, uploaded);
  const ui = await mount(fetcher);
  const input = ui.container.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File(["%PDF-1.7 synthetic"], "Synthetic attachment.pdf", { type: "application/pdf" });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 0)); });
  const upload = fetcher.mock.calls.find(([url, init]) => String(url).endsWith("/documents") && init?.method === "POST")!;
  expect((upload[1]!.body as FormData).get("documentType")).toBe("other");
  expect(ui.onUpdated).toHaveBeenCalledWith(uploaded);
  expect(ui.box("Synthetic attachment.pdf")?.checked).toBe(true);
  await ui.confirm();
  await act(async () => ui.forward().click());
  expect(ui.posted()[0].documentIds).toEqual(["form_doc", "attachment_doc"]);
});

it("refuses non-PDF attachments and hides uploads without permission", async () => {
  const fetcher = fetcherFor({ packets: [], transmissions: [] });
  const ui = await mount(fetcher);
  const input = ui.container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [new File(["text"], "notes.txt", { type: "text/plain" })], configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(ui.container.textContent).toContain("Only PDF files can be attached.");
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  const readOnly = await mount(fetcherFor({ packets: [], transmissions: [] }), { canUpload: false });
  expect(readOnly.container.querySelector('input[type="file"]')).toBeNull();
});

it("blocks Incomplete requests and sandboxes", async () => {
  const incomplete = await mount(fetcherFor({ packets: [], transmissions: [] }), { rfa: { ...record, status: "incomplete" } });
  expect(incomplete.container.textContent).toContain("This request is Incomplete");
  expect(incomplete.forward().disabled).toBe(true);
  const sandbox = await mount(fetcherFor({ packets: [], transmissions: [] }), { environment: "sandbox" });
  expect(sandbox.container.textContent).toContain("This is a sandbox");
  expect(sandbox.forward().disabled).toBe(true);
});

it("client: composed forwards accept the new packet; an exact re-send must echo its packet", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ data: { packetId: "packet_new", transmissionId: "t" } }));
  const client = createRfaPacketsClient({ getSession, fetch: fetcher });
  await expect(client.forward(record.id, { channel: "fax", to: "+15555550100" }, "key")).rejects.toThrow("Choose at least one document");
  await expect(client.forward(record.id, { documentIds: ["a", "a"], channel: "fax", to: "+15555550100" }, "key")).rejects.toThrow("once");
  expect(fetcher).not.toHaveBeenCalled();
  expect(await client.forward(record.id, { documentIds: ["form_doc"], channel: "email", to: " Adjuster@Example.test ", message: " Synthetic note " }, "key")).toEqual({ packetId: "packet_new", transmissionId: "t" });
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]!.body))).toEqual({ documentIds: ["form_doc"], channel: "email", to: "adjuster@example.test", message: "Synthetic note" });
  await expect(client.forward(record.id, { packetId: "packet_sent", channel: "fax", to: "+15555550100" }, "key")).rejects.toThrow("invalid");
});
