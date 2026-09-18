// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RfaTaskBoard, rfaTaskState } from "../packages/react/src/rfa-task-board";
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
    expect(h.container.textContent).toContain("Due (2)"); expect(h.container.textContent).toContain("No response");
    expect(fetcher).toHaveBeenCalledTimes(2); expect(fetcher.mock.calls.every(call => String(call[0]).includes("patientId=patient_synthetic") && String(call[0]).includes("renderingProviderId=provider_synthetic"))).toBe(true);
    expect(h.container.querySelector('[aria-label="Match UR"]')).toBeNull();
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
    await act(async () => h.button("Next fax page").click()); expect(fetcher.mock.calls.some(call => String(call[0]).includes("cursor=two"))).toBe(true);
    expect(h.button("Next fax page").disabled).toBe(true); await act(async () => h.button("Previous fax page").click());
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
