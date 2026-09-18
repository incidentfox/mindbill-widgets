// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RfaLifecycleControls, type RfaLifecycleControlsProps } from "../packages/react/src/rfa-lifecycle-controls";
import type { RfaRecord } from "../packages/browser/src/index";
vi.mock("../packages/react/src/rfa-delivery-panel", () => ({ RfaPdfReview: ({ title }: { title: string }) => createElement("div", { "data-testid": "pdf-preview" }, title) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const record: RfaRecord = { patientId: "patient_synthetic", renderingProviderId: "provider_synthetic", claimsAdminId: null, employeeName: "Synthetic patient", providerName: "Synthetic physician", claimNumber: "SYNTHETIC", reviewType: "prospective", expedited: false, createdAt: null, updatedAt: null, signedAt: null, submittedAt: null, incompleteReason: null, deferredReason: null, closedReason: null, readiness: { ready: true, missing: [] }, transmissions: [], events: [], id: "rfa_synthetic", claimId: "claim_synthetic", contentRevision: 1, status: "under_review", receivedAt: "2026-09-15T00:00:00Z", decisionDueAt: null, decisionDeadlineBasis: null, documents: [{ id: "ur_one", documentType: "ur_response", filename: "Synthetic response.pdf", contentUrl: "", contentRevision: 1, createdAt: null }, { id: "imr_one", documentType: "imr_form", filename: "Synthetic IMR.pdf", contentUrl: "", contentRevision: 1, createdAt: null }], informationRequests: [], items: [{ id: "item_one", procedureCode: "97110", serviceDescription: "Synthetic therapy", outcome: "pending", diagnosisCode: "M54.5", quantity: 1, units: 1, authorizationNumber: null, decisionReason: null }, { id: "item_two", procedureCode: "99213", serviceDescription: "Synthetic visit", outcome: "pending", diagnosisCode: "M54.5", quantity: 1, units: 1, authorizationNumber: null, decisionReason: null }] };
const getSession = async () => ({ token: "synthetic_token" });
async function setup(props: Partial<RfaLifecycleControlsProps> = {}) {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const fetcher = vi.fn<typeof fetch>(async url => String(url).includes("rfa-follow-ups") ? Response.json({ data: [], nextCursor: null }) : Response.json({ data: record }));
  const options = { rfa: record, getSession, fetch: fetcher, ...props };
  await act(async () => root.render(createElement(RfaLifecycleControls, options)));
  return { container, root, fetcher, rerender: (next: Partial<RfaLifecycleControlsProps>) => act(async () => root.render(createElement(RfaLifecycleControls, { ...options, ...next }))), close: async () => { await act(async () => root.unmount()); container.remove(); } };
}
function set(container: HTMLElement, name: string, value: string) {
  const element = container.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
  element.value = value; element.dispatchEvent(new Event("change", { bubbles: true }));
}
it("defaults to read-only without mutation or upload controls", async () => {
  const view = await setup();
  try {
    expect(view.container.textContent).toContain("requires authorization");
    expect(view.container.querySelector('button[type="submit"]')).toBeNull();
    expect(view.fetcher.mock.calls.every(call => !call[1]?.method)).toBe(true);
  } finally { await view.close(); }
});
it("records a partial treatment decision and keeps unselected treatments pending", async () => {
  const onUpdated = vi.fn(); const view = await setup({ permissions: ["act"], onUpdated });
  try {
    const outcome = [...view.container.querySelectorAll("select")].find(node => node.parentElement?.textContent?.startsWith("Decision for 97110"))!;
    await act(async () => { outcome.value = "approved"; outcome.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => {
      set(view.container, "decidedAt", "2026-09-16T10:00"); set(view.container, "responseDocumentId", "ur_one"); set(view.container, "item_one:authorizationNumber", "SYNTHETIC-AUTH");
      outcome.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    const mutation = view.fetcher.mock.calls.find(call => String(call[0]).endsWith("/decisions"));
    expect(JSON.parse(String(mutation?.[1]?.body)).decisions).toEqual([{ itemId: "item_one", outcome: "approved", authorizationNumber: "SYNTHETIC-AUTH" }]);
    expect(onUpdated).toHaveBeenCalledWith(record);
  } finally { await view.close(); }
});
it("requires IMR evidence for denied treatment and surfaces server scope errors", async () => {
  const fetcher = vi.fn<typeof fetch>(async url => String(url).includes("rfa-follow-ups") ? Response.json({ data: [], nextCursor: null }) : Response.json({ detail: "rfas:act is required" }, { status: 403 }));
  const view = await setup({ permissions: ["act"], fetch: fetcher });
  try {
    const outcome = [...view.container.querySelectorAll("select")].find(node => node.parentElement?.textContent?.startsWith("Decision for 97110"))!;
    await act(async () => { outcome.value = "denied"; outcome.dispatchEvent(new Event("change", { bubbles: true })); });
    const submit = () => outcome.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await act(async () => { set(view.container, "decidedAt", "2026-09-16T10:00"); set(view.container, "responseDocumentId", "ur_one"); submit(); });
    expect(view.container.textContent).toContain("independent medical review form is required");
    expect(fetcher.mock.calls.some(call => call[1]?.method === "POST")).toBe(false);
    await act(async () => { set(view.container, "imrDocumentId", "imr_one"); submit(); });
    expect(view.container.textContent).toContain("rfas:act is required");
    await view.rerender({ rfa: { ...record, id: "rfa_other" } });
    expect(view.container.textContent).not.toContain("rfas:act is required");
  } finally { await view.close(); }
});
it("follows claim pagination, isolates this RFA's tasks, and never reconciles notification queues", async () => {
  const task = { id: "task_one", rfaId: record.id, claimId: record.claimId, kind: "decision_follow_up", status: "pending", dueAt: "2026-09-16T00:00:00Z", responseDocumentId: null, responseFilename: null, assigneeReference: null, snoozedUntil: null, lastOutcome: null, lastNote: "Synthetic matching task", createdAt: "", updatedAt: "", resolvedAt: null };
  const fetcher = vi.fn<typeof fetch>(async url => String(url).includes("cursor=page_two") ? Response.json({ data: [task], nextCursor: null }) : Response.json({ data: [{ ...task, id: "foreign_task", rfaId: "other_rfa", lastNote: "Other request note" }], nextCursor: "page_two" }));
  const view = await setup({ fetch: fetcher });
  try {
    expect(view.container.textContent).toContain("Synthetic matching task"); expect(view.container.textContent).not.toContain("Other request note");
    expect(fetcher).toHaveBeenCalledTimes(2); expect(fetcher.mock.calls.every(call => !call[1]?.method)).toBe(true);
  } finally { await view.close(); }
});
it("requires evidence for confirmed receipt and uses a stable key when retrying", async () => {
  const fetcher = vi.fn<typeof fetch>(async url => String(url).includes("rfa-follow-ups") ? Response.json({ data: [], nextCursor: null }) : Response.json({ detail: "Synthetic temporary failure" }, { status: 503 }));
  const view = await setup({ rfa: { ...record, status: "submitted", receivedAt: null }, permissions: ["act"], fetch: fetcher });
  try {
    const button = [...view.container.querySelectorAll("button")].find(node => node.textContent === "Save confirmed receipt")!;
    const submit = () => button.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await act(async () => { set(view.container, "receivedAt", "2026-09-16T10:00"); submit(); });
    expect(view.container.textContent).toContain("Receipt requires a proof document");
    await act(async () => { set(view.container, "providerMessageId", "SYNTHETIC-RECEIPT"); submit(); });
    await act(async () => { submit(); });
    const calls = fetcher.mock.calls.filter(call => String(call[0]).endsWith("/transmissions"));
    expect(calls).toHaveLength(2); expect(new Headers(calls[0]?.[1]?.headers).get("idempotency-key")).toBe(new Headers(calls[1]?.[1]?.headers).get("idempotency-key"));
  } finally { await view.close(); }
});
it("records delivered information responses without sending documents", async () => {
  const rfa = { ...record, status: "information_requested", informationRequests: [{ id: "request_one", requestText: "Synthetic clinical request", requestedAt: "2026-09-15T00:00:00Z", dueAt: null, respondedAt: null }] };
  const view = await setup({ rfa, permissions: ["act"] });
  try {
    expect(view.container.textContent).toContain("It does not send these documents");
    const button = [...view.container.querySelectorAll("button")].find(node => node.textContent === "Record delivered response")!;
    expect(button.closest("form")!.querySelector('input[type="checkbox"][required]')).not.toBeNull();
    await act(async () => { set(view.container, "respondedAt", "2026-09-16T10:00"); set(view.container, "responseDocumentIds", "ur_one"); button.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    const request = view.fetcher.mock.calls.find(call => String(call[0]).endsWith("information-requests/request_one"));
    expect(JSON.parse(String(request?.[1]?.body)).responseDocumentIds).toEqual(["ur_one"]);
    expect(view.fetcher.mock.calls.some(call => String(call[0]).endsWith("/fax"))).toBe(false);
  } finally { await view.close(); }
});
it("updates a follow-up with the next date and reloads the full RFA", async () => {
  const task = { id: "task_one", rfaId: record.id, claimId: record.claimId, kind: "decision_follow_up", status: "pending", dueAt: "2026-09-16T00:00:00Z", responseDocumentId: null, responseFilename: null, assigneeReference: null, snoozedUntil: null, lastOutcome: null, lastNote: null, createdAt: "", updatedAt: "", resolvedAt: null };
  const fetcher = vi.fn<typeof fetch>(async (url, init) => String(url).includes("rfa-follow-ups") ? init?.method === "PATCH" ? Response.json({ data: task }) : Response.json({ data: [task], nextCursor: null }) : Response.json({ data: record }));
  const onUpdated = vi.fn(); const view = await setup({ fetch: fetcher, permissions: ["act"], onUpdated });
  try {
    const button = [...view.container.querySelectorAll("button")].find(node => node.textContent === "Save follow-up")!;
    await act(async () => { set(view.container, "snoozedUntil", "2026-09-18T10:00"); set(view.container, "note", "Synthetic follow-up contact"); button.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    const request = fetcher.mock.calls.find(call => call[1]?.method === "PATCH");
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({ outcome: "message_left", note: "Synthetic follow-up contact", snoozedUntil: "2026-09-18T10:00:00.000Z" });
    expect(onUpdated).toHaveBeenCalledWith(record);
  } finally { await view.close(); }
});

it("requires a saved decision and explicit confirmation before completing Post UR", async () => {
  const task = { id: "task_ur", rfaId: record.id, claimId: record.claimId, kind: "post_ur_decision", status: "open", dueAt: "2026-09-16T00:00:00Z", responseDocumentId: "ur_one", responseFilename: "Synthetic response.pdf", assigneeReference: null, snoozedUntil: null, lastOutcome: null, lastNote: null, createdAt: "", updatedAt: "", resolvedAt: null };
  const fetcher = vi.fn<typeof fetch>(async (url, init) => String(url).includes("rfa-follow-ups") ? Response.json({ data: init?.method === "PATCH" ? task : [task], nextCursor: null }) : String(url).includes("/documents/") ? new Response("%PDF-synthetic", { headers: { "Content-Type": "application/pdf" } }) : Response.json({ data: record }));
  const view = await setup({ fetch: fetcher, permissions: ["act"], selectedResponseDocumentId: "ur_one" });
  try {
    expect(view.container.querySelector('[data-testid="pdf-preview"]')?.textContent).toContain("Utilization review response");
    const savedChoice = () => view.container.querySelector<HTMLOptionElement>('option[value="decisions_recorded"]')!;
    expect(savedChoice().disabled).toBe(true);
    await view.rerender({ rfa: { ...record, items: record.items.map(item => item.id === "item_one" ? { ...item, outcome: "approved", currentResponseDocumentId: "ur_one" } : item) } });
    expect(savedChoice().disabled).toBe(false);
    const choice = savedChoice().parentElement as HTMLSelectElement;
    await act(async () => { choice.value = "decisions_recorded"; choice.dispatchEvent(new Event("change", { bubbles: true })); });
    const form = choice.closest("form")!;
    await act(async () => { set(form, "note", "Recorded the one decision in the synthetic response"); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(fetcher.mock.calls.some(call => call[1]?.method === "PATCH")).toBe(false);
    await act(async () => form.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    const patch = fetcher.mock.calls.find(call => call[1]?.method === "PATCH");
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ note: "Recorded the one decision in the synthetic response", responseReview: { disposition: "decisions_recorded", allDecisionsRecordedConfirmed: true } });
    expect(record.items[1]?.outcome).toBe("pending");
  } finally { await view.close(); }
});

it("excludes administratively closed treatments from Post UR and reloads tasks after a closure update",async()=>{
 const rfa={...record,items:record.items.map((item,index)=>index===0?{...item,decisionClosure:{closed:true,reason:"Synthetic administrative closure",version:1,updatedAt:"2026-09-18T00:00:00Z",updatedBy:"Synthetic operator"}}:item)};
 const view=await setup({rfa,permissions:["act"]});
 try{
  expect(view.container.querySelector('[name="item_one:outcome"]')).toBeNull();
  const labels=[...view.container.querySelectorAll("label")].map(label=>label.textContent);
  expect(labels.some(label=>label?.startsWith("Decision for 97110"))).toBe(false);
  expect(labels.some(label=>label?.startsWith("Decision for 99213"))).toBe(true);
  const before=view.fetcher.mock.calls.length;
  await view.rerender({rfa:{...rfa,updatedAt:"2026-09-18T01:00:00Z"}});
  expect(view.fetcher.mock.calls.length).toBeGreaterThan(before);
 }finally{await view.close();}
});
