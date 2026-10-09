// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RfaTaskBoard, rfaTaskState, rfaTaskAgeBucket } from "../packages/react/src/rfa-task-board";
vi.mock("../packages/react/src/rfa-delivery-panel", () => ({ RfaPdfReview: ({ title }: { title: string }) => createElement("div", {}, title) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const getSession = async () => ({ token: "synthetic_token" });
const task = { id: "task_synthetic", rfaId: "rfa_synthetic", claimId: "claim_synthetic", kind: "no_response", status: "open", dueAt: "2026-01-01T00:00:00Z", snoozedUntil: null, resolvedAt: null };
const fax = { id: "fax_synthetic", receivedAt: "2026-09-17T00:00:00Z", fromFax: "+15555550100", pages: 2, suggestedRfaIds: ["rfa_synthetic"] };
const record = { id: "rfa_synthetic", status: "submitted", submittedAt: "2026-09-16T00:00:00Z", employeeName: "Synthetic Patient", claimId: "claim_synthetic", providerName: "Synthetic Physician" };
function harness() { const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); return { container, root, button: (text: string) => [...container.querySelectorAll("button")].find(button => button.textContent === text)!, close: async () => { await act(async () => root.unmount()); container.remove(); } }; }
it("distinguishes outstanding scheduled work from completed evidence", () => {
  expect(rfaTaskState(task)).toBe("Due");
  expect(rfaTaskState({ ...task, snoozedUntil: "2099-01-01T00:00:00Z" })).toBe("Scheduled");
  expect(rfaTaskState({ ...task, status: "resolved" })).toBe("Completed");
});
it("loads all task pages with host filters and excludes the unassigned inbox in a patient view", async () => {
  const h = harness(); const onSelect = vi.fn();
  const fetcher = vi.fn<typeof fetch>(async url => Response.json(String(url).includes("cursor=two") ? { data: [{ ...task, id: "post_synthetic", kind: "post_ur_decision", responseDocumentId: "ur_synthetic" }], nextCursor: null } : { data: [task], nextCursor: "two" }));
  try {
    await act(async () => h.root.render(createElement(RfaTaskBoard, { getSession, fetch: fetcher, patientId: "patient_synthetic", renderingProviderId: "provider_synthetic", onSelect })));
    expect(h.container.textContent).toContain("Due (2)"); expect(h.container.textContent).toContain("Decision overdue");
    expect(h.container.textContent).toContain("The decision deadline passed without a recorded decision.");
    expect(fetcher).toHaveBeenCalledTimes(2); expect(fetcher.mock.calls.every(call => String(call[0]).includes("patientId=patient_synthetic") && String(call[0]).includes("renderingProviderId=provider_synthetic"))).toBe(true);
    expect(h.container.querySelector('[aria-label="Match UR"]')).toBeNull();
    await act(async () => h.button("View all due tasks (2)").click());
    await act(async () => h.button("Review response").click()); expect(onSelect).toHaveBeenCalledWith("rfa_synthetic", "ur_synthetic");
  } finally { await h.close(); }
});
it("paginates unmatched faxes and requires review, selection and confirmation before Match UR", async () => {
  const h = harness(); const onSelect = vi.fn();
  const fetcher = vi.fn<typeof fetch>(async url => {
    const value = String(url);
    if (value.includes("rfa-follow-ups")) return Response.json({ data: [], nextCursor: null });
    if (value.endsWith("/content")) return new Response("%PDF-synthetic");
    if (value.endsWith("/match")) return Response.json({ data: { faxId: fax.id, rfaId: record.id, documentId: "ur_synthetic", alreadyAttached: false } });
    if (value.includes("rfa-inbound-faxes")) return Response.json({ data: [{ ...fax, suggestedRfaIds: [record.id, "rfa_draft"] }], nextCursor: value.includes("cursor=") ? null : "two", hasMore: !value.includes("cursor=") });
    return Response.json({ data: value.endsWith("rfa_draft") ? { ...record, id: "rfa_draft", status: "draft", submittedAt: null } : record });
  });
  try {
    await act(async () => h.root.render(createElement(RfaTaskBoard, { getSession, fetch: fetcher, permissions: ["act"], onSelect })));
    expect(h.container.querySelector("summary")?.textContent).toContain("Incoming responses (1+)");
    await act(async () => h.button("Next fax page").click()); expect(fetcher.mock.calls.some(call => String(call[0]).includes("cursor=two"))).toBe(true);
    expect(h.button("Next fax page").disabled).toBe(true);
    expect(h.container.querySelector("summary")?.textContent).toContain("Incoming responses (1+)");
    const beforeRefresh = fetcher.mock.calls.length;
    await act(async () => window.dispatchEvent(new Event("focus")));
    const refreshReads = fetcher.mock.calls.slice(beforeRefresh).map(call => String(call[0])).filter(url => url.includes("rfa-inbound-faxes"));
    expect(refreshReads.some(url => url.includes("cursor=two"))).toBe(true);
    expect(refreshReads.some(url => !url.includes("cursor="))).toBe(true);
    expect(h.container.querySelector("summary")?.textContent).toContain("Incoming responses (1+)");
    await act(async () => h.button("Previous fax page").click());
    await act(async () => h.button("Review fax").click()); expect(h.container.textContent).toContain("Incoming utilization review response");
    expect(h.button("Match response and open Post UR").disabled).toBe(true);
    const select = [...h.container.querySelectorAll("select")].find(element => element.parentElement?.textContent?.startsWith("Matching request"))!;
    expect(select.querySelector<HTMLOptionElement>('option[value="rfa_draft"]')!.disabled).toBe(true);
    await act(async () => { select.value = record.id; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(h.button("Match response and open Post UR").disabled).toBe(true);
    await act(async () => h.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    const inboxReads = () => fetcher.mock.calls.filter(call => String(call[0]).includes("rfa-inbound-faxes") && !String(call[0]).endsWith("/content")).length;
    const beforeFocus = inboxReads();
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(inboxReads()).toBe(beforeFocus);
    expect(select.value).toBe(record.id);
    expect(h.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
    await act(async () => h.button("Match response and open Post UR").click());
    expect(onSelect).toHaveBeenCalledWith(record.id, "ur_synthetic");
    expect(fetcher.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
    expect(fetcher.mock.calls.some(call => String(call[0]).endsWith("/decisions"))).toBe(false);
  } finally { await h.close(); }
});

it("ages tasks by opening calendar date including boundaries and unknown dates", () => {
  const now = new Date(2026, 9, 2, 12).getTime();
  const opened = (days: number) => new Date(2026, 9, 2 - days, 23).toISOString();
  expect(rfaTaskAgeBucket(opened(5), now)).toBe("0-5");
  expect(rfaTaskAgeBucket(opened(6), now)).toBe("6-14");
  expect(rfaTaskAgeBucket(opened(14), now)).toBe("6-14");
  expect(rfaTaskAgeBucket(opened(15), now)).toBe("15-30");
  expect(rfaTaskAgeBucket(opened(30), now)).toBe("15-30");
  expect(rfaTaskAgeBucket(opened(31), now)).toBe("31+");
  expect(rfaTaskAgeBucket("", now)).toBe("unknown");
});
it("drills into exactly the chosen age and kind without mixing scheduled or completed work", async () => {
  const h = harness(); const onSelect = vi.fn();
  const old = "2020-01-01T00:00:00Z";
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ data: [
    { ...task, createdAt: old },
    { ...task, id: "post", kind: "post_ur_decision", createdAt: old, responseDocumentId: "document_synthetic" },
    { ...task, id: "scheduled", createdAt: old, snoozedUntil: "2099-01-01T00:00:00Z" },
    { ...task, id: "resolved", createdAt: old, status: "resolved" },
    ...[{}, { snoozedUntil: "2099-01-01T00:00:00Z" }, { status: "resolved" }].map((state, i) => ({ ...task, ...state, id: `hidden_${i}`, kind: "transmission_unconfirmed", createdAt: old })),
  ], nextCursor: null }));
  try {
    await act(async () => h.root.render(createElement(RfaTaskBoard, { getSession, fetch: fetcher, claimId: "claim_synthetic", onSelect })));
    expect(h.container.textContent).toContain("Task status");
    expect(h.container.textContent).toContain("Tasks that need attention now");
    expect(h.container.textContent).not.toContain("Delivery unconfirmed");
    expect(h.container.textContent).not.toContain("transmission_unconfirmed");
    expect(h.container.textContent).toContain("Due (2)");
    expect(h.container.textContent).toContain("Scheduled (1)");
    expect(h.container.textContent).toContain("Completed (1)");
    await act(async () => h.container.querySelector<HTMLButtonElement>('[aria-label="Post UR, 31+ days: 1 due tasks"]')!.click());
    expect(h.container.querySelectorAll('[aria-label="Selected tasks"] tbody tr')).toHaveLength(1);
    await act(async () => h.button("Review response").click());
    expect(onSelect).toHaveBeenCalledWith("rfa_synthetic", "document_synthetic");
    await act(async () => h.button("Scheduled (1)").click());
    expect(h.container.querySelector('[aria-label="Selected tasks"]')).toBeNull();
    expect(h.container.textContent).toContain("Open tasks with a future follow-up date");
    await act(async () => h.button("Completed (1)").click());
    expect(h.container.textContent).toContain("Completing a task does not necessarily close its RFA");
  } finally { await h.close(); }
});

it("keeps response review readable without exposing the matching write action", async () => {
  const h = harness();
  const fetcher = vi.fn<typeof fetch>(async url => String(url).includes("rfa-follow-ups") ? Response.json({ data: [], nextCursor: null }) : String(url).endsWith("/content") ? new Response("%PDF-synthetic") : String(url).includes("rfa-inbound-faxes") ? Response.json({ data: [fax], nextCursor: null, hasMore: false }) : Response.json({ data: record }));
  try {
    await act(async () => h.root.render(createElement(RfaTaskBoard, { getSession, fetch: fetcher, onSelect: vi.fn(), embedded: true })));
    expect(h.container.querySelector("h2")).toBeNull();
    await act(async () => h.button("Review fax").click());
    expect(h.container.textContent).toContain("Matching responses requires authorization");
    expect(h.button("Match response and open Post UR")).toBeUndefined();
    expect(fetcher.mock.calls.some(call => call[1]?.method === "POST")).toBe(false);
  } finally { await h.close(); }
});

it("routes counts, group totals and all tasks with state, kind and age without inline drilldown", async () => {
  const h = harness(); const onNavigate = vi.fn();
  const getTaskHref = vi.fn((query: import("../packages/react/src/rfa-task-board").RfaTaskQuery) => `/rfa-tasks?${new URLSearchParams({ state: query.state!, ...(query.kind ? { kind: query.kind } : {}), ...(query.kinds ? { kinds: query.kinds.join(",") } : {}), ...(query.bucket ? { age: query.bucket } : {}) })}`);
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ data: [{ ...task, kind: "send_rfa", createdAt: "2020-01-01" }, { ...task, id: "unknown", kind: "document_required", createdAt: "" }, { ...task, id: "scheduled", kind: "send_rfa", createdAt: "2020-01-01", snoozedUntil: "2099-01-01" }], nextCursor: null }));
  try {
    await act(async () => h.root.render(createElement(RfaTaskBoard, { getSession, fetch: fetcher, claimId: "claim_synthetic", onSelect: vi.fn(), getTaskHref, onNavigate })));
    const link = h.container.querySelector<HTMLAnchorElement>('[aria-label="Send RFA, 31+ days: 1 due tasks"]')!;
    expect(link.getAttribute("href")).toBe("/rfa-tasks?state=Due&kind=send_rfa&age=31%2B");
    await act(async () => link.click());
    expect(onNavigate).toHaveBeenCalledWith(link.getAttribute("href"));
    expect(h.container.querySelector('[aria-label="Selected tasks"]')).toBeNull();
    onNavigate.mockClear();
    const modified = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
    await act(async () => link.dispatchEvent(modified));
    expect(modified.defaultPrevented).toBe(false); expect(onNavigate).not.toHaveBeenCalled();
    expect(h.container.querySelector<HTMLAnchorElement>('[aria-label="Incomplete RFAs, Unknown age: 1 due tasks"]')?.getAttribute("href")).toContain("kinds=document_required%2Csend_rfa&age=unknown");
    const total = h.container.querySelector<HTMLAnchorElement>('[aria-label="Incomplete RFAs, Total: 2 due tasks"]')!;
    expect(total.getAttribute("href")).toBe("/rfa-tasks?state=Due&kinds=document_required%2Csend_rfa");
    expect([...h.container.querySelectorAll("a")].find(a => a.textContent === "View all due tasks (2)")?.getAttribute("href")).toBe("/rfa-tasks?state=Due");
    await act(async () => h.button("Scheduled (1)").click());
    expect(h.container.querySelector<HTMLAnchorElement>('[aria-label="Send RFA, 31+ days: 1 scheduled tasks"]')?.getAttribute("href")).toContain("state=Scheduled");
  } finally { await h.close(); }
});

it("renders a separate filtered list, retaining response context and routed state changes", async () => {
  const h = harness(); const onSelect = vi.fn(); const onNavigate = vi.fn();
  const getTaskHref = vi.fn((query: import("../packages/react/src/rfa-task-board").RfaTaskQuery) => `/rfa-tasks?state=${query.state}&kind=${query.kind}&age=${query.bucket}`);
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ data: [
    { ...task, id: "matching", kind: "post_ur_decision", responseDocumentId: "response_synthetic", createdAt: "", status: "resolved", resolvedAt: "2026-01-02", updatedAt: "2026-01-02" },
    { ...task, id: "wrong_age", kind: "post_ur_decision", createdAt: "2020-01-01", status: "resolved" },
    { ...task, id: "wrong_kind", createdAt: "", status: "resolved" },
    { ...task, id: "wrong_state", kind: "post_ur_decision", createdAt: "" },
    { ...task, id: "server_managed", kind: "transmission_unconfirmed", createdAt: "", status: "resolved" },
  ], nextCursor: null }));
  try {
    await act(async () => h.root.render(createElement(RfaTaskBoard, { getSession, fetch: fetcher, presentation: "list", query: { state: "Completed", kind: "post_ur_decision", bucket: "unknown" }, onSelect, getTaskHref, onNavigate, renderTaskIdentity: () => createElement("small", {}, "Synthetic patient · SYNTHETIC-001") })));
    expect(h.container.querySelectorAll('[aria-label="Selected tasks"] tbody tr')).toHaveLength(1);
    expect(h.container.textContent).toContain("Post UR · Unknown age (1)");
    expect(h.container.textContent).toContain("Synthetic patient · SYNTHETIC-001");
    expect(h.container.querySelector(".mbrfa-task-group")).toBeNull();
    expect(h.container.querySelector(".mbrfa-match-disclosure")).toBeNull();
    expect(fetcher.mock.calls.every(call => String(call[0]).includes("rfa-follow-ups"))).toBe(true);
    expect(fetcher.mock.calls.some(call => /lifecycleStatus=|status=/.test(String(call[0])))).toBe(false);
    await act(async () => h.button("Review response").click());
    expect(onSelect).toHaveBeenCalledWith("rfa_synthetic", "response_synthetic");
    await act(async () => h.button("Due (1)").click());
    expect(getTaskHref).toHaveBeenLastCalledWith({ state: "Due", kind: "post_ur_decision", bucket: "unknown" });
    expect(onNavigate).toHaveBeenCalledWith("/rfa-tasks?state=Due&kind=post_ur_decision&age=unknown");
  } finally { await h.close(); }
});

it("enriches only visible requests once with scoped patient, claim and treatment identity", async () => {
  const h = harness(); const onSelect = vi.fn();
  const fetcher = vi.fn<typeof fetch>(async url => String(url).includes("rfa-follow-ups") ? Response.json({ data: [
    { ...task, id: "visible_one", kind: "post_ur_decision", responseDocumentId: "response_synthetic" },
    { ...task, id: "visible_two", kind: "post_ur_decision" },
    { ...task, id: "hidden_task", rfaId: "rfa_hidden", kind: "send_rfa" },
  ], nextCursor: null }) : Response.json({ data: { ...record, patientId: "patient_synthetic", claimNumber: "CLAIM-SYNTHETIC", items: [{ serviceDescription: "Synthetic therapeutic exercise" }] } }));
  try {
    await act(async () => h.root.render(createElement(RfaTaskBoard, { getSession, fetch: fetcher, patientId: "patient_synthetic", presentation: "list", query: { state: "Due", kind: "post_ur_decision" }, onSelect })));
    expect(h.container.textContent).toContain("Synthetic Patient");
    expect(h.container.textContent).toContain("CLAIM-SYNTHETIC");
    expect(h.container.textContent).toContain("Synthetic therapeutic exercise");
    expect(fetcher.mock.calls.filter(call => !String(call[0]).includes("rfa-follow-ups"))).toHaveLength(1);
    expect(fetcher.mock.calls.some(call => String(call[0]).includes("rfa_hidden"))).toBe(false);
    expect(fetcher.mock.calls.every(call => !call[1]?.method || call[1].method === "GET")).toBe(true);
    await act(async () => h.button("Review response").click());
    expect(onSelect).toHaveBeenCalledWith("rfa_synthetic", "response_synthetic");
  } finally { await h.close(); }
});

it("keeps task actions available without showing mismatched scoped request identity", async () => {
  const h = harness();
  const fetcher = vi.fn<typeof fetch>(async url => String(url).includes("rfa-follow-ups") ? Response.json({ data: [task], nextCursor: null }) : Response.json({ data: { ...record, patientId: "patient_other" } }));
  try {
    await act(async () => h.root.render(createElement(RfaTaskBoard, { getSession, fetch: fetcher, patientId: "patient_synthetic", presentation: "list", onSelect: vi.fn() })));
    expect(h.container.textContent).not.toContain("Synthetic Patient");
    expect(h.container.textContent).toContain("Request rfa_synthetic · Claim claim_synthetic");
    expect(h.button("Open request")).toBeDefined();
  } finally { await h.close(); }
});
