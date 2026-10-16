// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { claimRfaSummary, createRfaRecordsClient, type BillUrDecisionsResult, type ClaimRfaSummary, type RfaRecord } from "@mindbill/browser";
import { BillUrDecisions, RelatedAuthorizationRecords, RfaClaimIndex, claimRfaCounts, claimRfaLifecycle, rfaReference } from "../packages/react/src/rfa-records";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const getSession = async () => ({ token: "synthetic_token", apiBaseUrl: "https://api.example.test" });
const item = (id: string, outcome: string, extra: Partial<ClaimRfaSummary["items"][number]> = {}): ClaimRfaSummary["items"][number] => ({
  id, ordinal: 1, serviceDescription: `Service ${id}`, procedureCode: "97110", diagnosisCode: "M54.50", quantity: 8, frequency: "2x/week", duration: "4 weeks",
  outcome, notRequired: false, authorizationNumber: outcome === "approved" ? "AUTH-1" : null, decidedAt: outcome === "pending" ? null : "2026-09-10T17:00:00Z", ...extra,
});
const rfas: ClaimRfaSummary[] = [
  { id: "rfa_aaaaaaaa1111", status: "approved", lifecycleStatus: "closed", renderingProviderId: "rp_1", providerName: "Synthetic Physician B", expedited: false, requestType: "initial",
    createdAt: "2026-09-01T10:00:00Z", submittedAt: "2026-09-01T11:00:00Z", decisionDueAt: "2026-09-06T00:00:00Z", decidedAt: "2026-09-05T00:00:00Z", items: [item("i1", "approved"), item("i2", "denied")] },
  { id: "rfa_bbbbbbbb2222", status: "submitted", lifecycleStatus: "sent", renderingProviderId: "rp_2", providerName: "Synthetic Physician A", expedited: true, requestType: "initial",
    createdAt: "2026-09-08T10:00:00Z", submittedAt: "2026-09-08T11:00:00Z", decisionDueAt: "2026-09-13T00:00:00Z", decidedAt: null, items: [item("i3", "pending"), item("i4", "pending", { notRequired: true })] },
  { id: "rfa_cccccccc3333", status: "draft", lifecycleStatus: "incomplete", renderingProviderId: "rp_1", providerName: "Synthetic Physician B", expedited: false, requestType: "initial",
    createdAt: "2026-09-09T10:00:00Z", submittedAt: null, decisionDueAt: null, decidedAt: null, items: [item("i5", "pending")] },
];
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); vi.restoreAllMocks(); });
async function mount(element: ReturnType<typeof createElement>) {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  await act(async () => root.render(element));
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  const button = (text: string) => [...container.querySelectorAll("button")].find(target => target.textContent?.trim().startsWith(text));
  return { container, button, rerender: (next: ReturnType<typeof createElement>) => act(async () => root.render(next)) };
}

describe("RFA records client", () => {
  it("pages the claim RFA list with a browser token and projects the claim summary", async () => {
    const record = { id: "rfa_x", status: "approved", lifecycleStatus: "closed", renderingProviderId: "rp", providerName: "P", expedited: false, requestType: "initial",
      createdAt: null, submittedAt: null, decisionDueAt: null, items: [{ id: "i", diagnosisCode: "M54.50", serviceDescription: "PT", procedureCode: "97110", authorizedProcedureCode: "97140",
        outcome: "approved", quantity: 6, authorizedQuantity: 4, units: null, authorizationNumber: "A1", decisionReason: null, decisionClosure: { closed: false }, decidedAt: "2026-09-02T00:00:00Z" }] } as unknown as RfaRecord;
    const fetcher = vi.fn<typeof fetch>(async url => String(url).includes("cursor=") ? Response.json({ data: [record], nextCursor: null, summary: { total: 2, byStatus: {} } })
      : Response.json({ data: [record], nextCursor: "next", summary: { total: 2, byStatus: {} } }));
    const result = await createRfaRecordsClient({ getSession, fetch: fetcher }).listClaimRfas("claim_1");
    expect(result).toHaveLength(2);
    expect(String(fetcher.mock.calls[0]![0])).toBe("https://api.example.test/partner/v2/rfas?claimId=claim_1&limit=200&sortBy=createdAt&sortDirection=desc");
    expect(new Headers(fetcher.mock.calls[0]![1]!.headers).get("authorization")).toBe("Bearer synthetic_token");
    expect(result[0]).toMatchObject({ decidedAt: "2026-09-02T00:00:00Z", items: [{ procedureCode: "97140", quantity: 4, notRequired: false, authorizationNumber: "A1" }] });
    expect(claimRfaSummary(record).requestType).toBe("initial");
  });

  it("calls related, UR decision and document endpoints and retries an expired session once", async () => {
    let tokens = 0;
    const session = async () => ({ token: `synthetic_token_${++tokens}` });
    let first = true;
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      if (first) { first = false; return new Response(null, { status: 401 }); }
      if (String(url).includes("/rfas/related")) return Response.json({ data: [], claimId: "claim_1", hasMore: false });
      if (String(url).includes("/documents/")) return new Response("%PDF-synthetic", { headers: { "content-type": "application/pdf" } });
      if (init?.method === "POST") return Response.json({ data: { attached: 1 } });
      return Response.json({ data: { editable: true, decisions: [], linked: [] } });
    });
    const client = createRfaRecordsClient({ getSession: session, fetch: fetcher });
    expect(await client.listRelated({ billId: "bill 1" })).toEqual({ data: [], claimId: "claim_1", hasMore: false });
    expect(String(fetcher.mock.calls[1]![0])).toBe("https://app.mindbill.org/partner/v2/rfas/related?billId=bill+1");
    expect(tokens).toBe(2);
    await client.listBillUrDecisions("bill_1");
    expect(await client.attachBillUrDecisions("bill_1", { documentIds: ["doc_1"] }, "key_1")).toEqual({ attached: 1 });
    const post = fetcher.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(String(post[0])).toBe("https://app.mindbill.org/partner/v2/bills/bill_1/ur-decisions");
    expect(JSON.parse(String(post[1]!.body))).toEqual({ documentIds: ["doc_1"] });
    expect(new Headers(post[1]!.headers).get("idempotency-key")).toBe("key_1");
    expect(await (await client.getRfaDocument("rfa_1", "doc_1")).text()).toBe("%PDF-synthetic");
    await expect(client.attachBillUrDecisions("bill_1", { documentIds: [] })).rejects.toThrow(/one to eight/);
  });
});

describe("RfaClaimIndex", () => {
  it("summarizes treatments, sorts columns and opens a request", async () => {
    expect(rfaReference("rfa_abcdef123456")).toBe("ABCDEF12");
    expect(claimRfaCounts(rfas)).toEqual({ drafts: 1, noResponse: 1, approved: 1, modified: 0, denied: 1 });
    expect(claimRfaLifecycle({ lifecycleStatus: "", status: "ready", submittedAt: null }).label).toBe("Incomplete");
    const selected: Array<[string, unknown]> = [];
    const ui = await mount(createElement(RfaClaimIndex, { claimId: "claim_1", canCreate: true, loadRfas: async () => rfas, getRfaHref: id => `/rfas/${id}`,
      onSelectRfa: (id, context) => selected.push([id, context]), createHref: "/rfas/new?claimId=claim_1" }));
    expect(ui.container.textContent).toContain("Requests for Authorization (3)");
    expect(ui.container.querySelector('a[href="/rfas/new?claimId=claim_1"]')?.textContent).toContain("Add RFA");
    const references = () => [...ui.container.querySelectorAll("tbody tr td:first-child a")].map(link => link.textContent);
    expect(references()).toEqual(["CCCCCCCC", "BBBBBBBB", "AAAAAAAA"]);
    await act(async () => ui.button("Requesting physician")!.click());
    expect(references()).toEqual(["BBBBBBBB", "CCCCCCCC", "AAAAAAAA"]);
    await act(async () => ui.button("Decision date")!.click());
    expect(references()[0]).toBe("AAAAAAAA");
    await act(async () => (ui.container.querySelector("tbody tr td:nth-child(3)") as HTMLElement).click());
    expect(selected[0]![0]).toBe("rfa_aaaaaaaa1111");
    await act(async () => ui.button("Requested treatments")!.click());
    const decisions = [...ui.container.querySelectorAll("tbody tr td:nth-child(9)")].map(cell => cell.textContent);
    expect(decisions).toEqual(["Not sent", "No response", "Not required", "Approved", "Denied"]);
    expect(ui.container.textContent).toContain("ICD-10 M54.50");
  });

  it("explains an empty claim and a failed load", async () => {
    const empty = await mount(createElement(RfaClaimIndex, { claimId: "c", canCreate: true, onCreateRfa: () => undefined, loadRfas: async () => [] }));
    expect(empty.container.textContent).toContain('No RFAs on this claim yet. Click "Add RFA"');
    const failed = await mount(createElement(RfaClaimIndex, { claimId: "c", loadRfas: async () => { throw new Error("x"); } }));
    expect(failed.container.textContent).toContain("could not be loaded");
  });
});

describe("RelatedAuthorizationRecords", () => {
  const result = { claimId: "claim_1", hasMore: true, data: [
    { id: "bill_1", label: "Bill #12", treatments: ["Physical therapy"], relationship: "Linked authorization", status: "submitted", serviceDate: "2026-09-12" },
    { id: "bill_2", label: "Bill #11", treatments: ["Evaluation"], relationship: "Same injury", status: "paid", serviceDate: "2026-08-01" },
  ] };
  it("lists linked bills first and folds the other bills for the injury", async () => {
    const ui = await mount(createElement(RelatedAuthorizationRecords, { rfaId: "rfa_1", load: async () => result, getBillHref: id => `/bills/${id}`, getClaimHref: id => `/claims/${id}`,
      renderClaimActions: () => createElement("button", { type: "button" }, "Case file") }));
    expect(ui.container.textContent).toContain("Related bills (1)");
    expect(ui.container.querySelector('a[href="/bills/bill_1"]')?.textContent).toContain("Bill #12");
    expect(ui.container.querySelector("details summary")?.textContent).toBe("Other bills for this injury (1)");
    expect(ui.container.querySelector('a[href="/claims/claim_1"]')?.textContent).toBe("View claim");
    expect(ui.button("Case file")).toBeDefined();
    expect(ui.container.textContent).toContain("Showing the first 100 records");
  });
  it("hides an empty list on a request page but explains it on a bill", async () => {
    const onRfa = await mount(createElement(RelatedAuthorizationRecords, { rfaId: "rfa_1", load: async () => ({ claimId: "c", hasMore: false, data: [] }) }));
    expect(onRfa.container.textContent).toBe("");
    const onBill = await mount(createElement(RelatedAuthorizationRecords, { billId: "bill_1", load: async () => ({ claimId: "c", hasMore: false, data: [] }) }));
    expect(onBill.container.textContent).toContain("No authorizations linked yet.");
  });
});

describe("BillUrDecisions", () => {
  const decisions: BillUrDecisionsResult = { editable: true, linked: [
    { rfaId: "rfa_1", rfaItemId: "i1", service: "Physical therapy", form: { state: "attached" }, decision: { state: "unavailable", authorizationNumber: "AUTH-1", message: "The stored document failed validation." } },
  ], decisions: [
    { documentId: "doc_1", rfaId: "rfa_1", filename: "decision-1.pdf", decidedAt: "2026-09-05T00:00:00Z", attached: false, matchesBill: true,
      treatments: [{ service: "Physical therapy", code: "97110", outcome: "approved", authorizationNumber: "AUTH-1", effectiveFrom: "2026-09-05", effectiveTo: "2026-10-05" }] },
    { documentId: "doc_2", rfaId: "rfa_2", filename: "decision-2.pdf", decidedAt: null, attached: true, matchesBill: false,
      treatments: [{ service: "MRI", code: "72148", outcome: "denied", authorizationNumber: null, effectiveFrom: null, effectiveTo: null }] },
  ] };
  it("attaches chosen decisions, retries linked documents and reports attachment problems", async () => {
    const attach = vi.fn(async (_billId: string, input: { documentIds?: string[]; linked?: true }) => input.linked ? { attached: 0, linked: decisions.linked } : { attached: 1 });
    const load = vi.fn(async () => decisions);
    const onAttached = vi.fn();
    const ui = await mount(createElement(BillUrDecisions, { billId: "bill_1", canEdit: true, load, attach, onAttached, getRfaHref: id => `/rfas/${id}` }));
    expect(ui.container.textContent).toContain("RFAs & UR decisions (2)");
    expect(ui.container.textContent).toContain("Signed RFA: Attached");
    expect(ui.container.textContent).toContain("UR decision: Needs attention");
    expect(ui.container.textContent).toContain("The stored document failed validation.");
    expect(ui.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
    expect(ui.button("Attach UR decision")!.disabled).toBe(true);
    await act(async () => (ui.container.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
    await act(async () => ui.button("Attach UR decision")!.click());
    expect(attach).toHaveBeenCalledWith("bill_1", { documentIds: ["doc_1"] });
    expect(onAttached).toHaveBeenCalledWith({ attached: 1 }, "manual");
    expect(load).toHaveBeenCalledTimes(2);
    expect(ui.container.textContent).toContain("Utilization review decision attached.");
    await act(async () => ui.button("Attach now")!.click());
    expect(attach).toHaveBeenLastCalledWith("bill_1", { linked: true });
    expect(ui.container.querySelector('[role="alert"]')?.textContent).toContain("could not be attached");
  });
  it("is read-only once the bill was sent and hidden when there is nothing to show", async () => {
    const sent = await mount(createElement(BillUrDecisions, { billId: "bill_1", canEdit: true, load: async () => ({ ...decisions, editable: false }) }));
    expect(sent.container.textContent).toContain("This bill was already sent");
    expect(sent.button("Attach")).toBeUndefined();
    expect((sent.container.querySelector('input[type="checkbox"]') as HTMLInputElement).disabled).toBe(true);
    const none = await mount(createElement(BillUrDecisions, { billId: "bill_1", load: async () => ({ editable: true, decisions: [], linked: [] }) }));
    expect(none.container.textContent).toBe("");
  });
  it("loads through the browser session by default and opens the letter", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:synthetic"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const open = vi.spyOn(globalThis, "open").mockImplementation(() => null);
    const fetcher = vi.fn<typeof fetch>(async url => String(url).includes("/documents/") ? new Response("%PDF-x") : Response.json({ data: decisions }));
    const ui = await mount(createElement(BillUrDecisions, { billId: "bill_1", getSession, fetch: fetcher }));
    expect(String(fetcher.mock.calls[0]![0])).toBe("https://api.example.test/partner/v2/bills/bill_1/ur-decisions");
    await act(async () => ui.button("Letter")!.click());
    expect(String(fetcher.mock.calls.at(-1)![0])).toBe("https://api.example.test/partner/v2/rfas/rfa_1/documents/doc_1");
    expect(open).toHaveBeenCalledWith("blob:synthetic", "_blank", "noopener");
  });
});
