// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createBillReferenceClient, type CaClaimFeeQuoteInput, type CaClaimFeeQuoteResult } from "../packages/browser/src/index";
import { parseCaClaimFeeQuote } from "../packages/browser/src/claim-fees";
import { FeeScheduleCalculator } from "../packages/react/src/fee-schedule-calculator";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const input: CaClaimFeeQuoteInput = { completeDateOfServiceContext: true, lines: [{ id: "synthetic-line-1", code: "99214", dateOfService: "2024-02-15", units: 1, modifiers: ["95"], serviceZip: "90012" }] };
function result(request = input): CaClaimFeeQuoteResult { return { status: "requires_review", lines: request.lines.map((line) => ({ id: line.id, input: line, assessment: "requires_review", findings: [{ code: "synthetic_missing_source", lineIds: [line.id], message: "Synthetic edit source requires review.", citationUrl: "https://www.dir.ca.gov/dwc/omfs.htm" }], quote: { status: "priced", amountCents: 20207, scheduleMaximumCents: 20207, basis: "ca_physician_rbrvs", notes: [], provenance: [{ id: "Synthetic regulation", url: "https://www.dir.ca.gov/dwc/omfs.htm", effectiveFrom: "2024-02-15" }] } })), totals: { submittedChargeCents: null, pricedSubtotalCents: 20207 * request.lines.length, scheduleMaximumCents: null, estimatedPayableCents: null, reviewLineCount: request.lines.length }, claimEdits: [{ dateOfService: "2024-02-15", lineIds: request.lines.map((l) => l.id), status: "source_unavailable", reason: "Synthetic missing edit file", findings: [] }], limitations: ["Synthetic test: no real fee determination."] }; }
describe("claim fee quote transport", () => {
  it("posts the complete services to the origin-bound read endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ data: result() }));
    const client = createBillReferenceClient({ getSession: async () => ({ token: "synthetic_session" }), fetch: fetcher });
    expect(await client.quoteClaimFees(input)).toEqual(result());
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toMatch(/\/partner\/v2\/fee-quotes\/ca\/claim$/);
    expect(init?.method).toBe("POST"); expect(JSON.parse(init!.body as string)).toEqual(input);
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic_session");
  });
  it.each([
    (v: CaClaimFeeQuoteResult) => { v.totals.estimatedPayableCents = 20207; },
    (v: CaClaimFeeQuoteResult) => { v.lines[0]!.id = "different-line"; },
    (v: CaClaimFeeQuoteResult) => { v.lines[0]!.input = { ...v.lines[0]!.input, code: "97110" }; },
    (v: CaClaimFeeQuoteResult) => { v.lines = []; },
    (v: CaClaimFeeQuoteResult) => { v.totals.pricedSubtotalCents = NaN; },
  ])("rejects a malformed or mismatched allowance", (mutate) => { const data = result(); mutate(data); expect(() => parseCaClaimFeeQuote(data, input)).toThrow("invalid response"); });
  it("preserves structured API errors", async () => {
    const client = createBillReferenceClient({ getSession: async () => ({ token: "synthetic_session" }), fetch: async () => Response.json({ code: "invalid_claim_fee_quote", detail: "Invalid service date." }, { status: 422 }) });
    await expect(client.quoteClaimFees(input)).rejects.toThrow("Invalid service date");
  });
});
async function mount(client: { quoteClaimFees: (input: CaClaimFeeQuoteInput) => Promise<CaClaimFeeQuoteResult> }, lines = input.lines) {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  await act(async () => root.render(createElement(FeeScheduleCalculator, { client, initialLines: lines })));
  return { container, cleanup: async () => { await act(async () => root.unmount()); container.remove(); }, submit: async () => { await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); } };
}
it("sends multiple services with modifiers and omits blank optional values without extra attestations", async () => {
  const client = { quoteClaimFees: vi.fn(async (request: CaClaimFeeQuoteInput) => result(request)) };
  const lines = [...input.lines, { id: "synthetic-line-2", code: "99213", dateOfService: "2024-02-15", units: 1, serviceZip: "", serviceCounty: "" }];
  const ui = await mount(client, lines);
  try { await ui.submit(); const request = client.quoteClaimFees.mock.calls[0]![0]; expect(request.lines).toHaveLength(2); expect(request.lines[0]!.modifiers).toEqual(["95"]); expect(request.lines[1]).not.toHaveProperty("serviceZip"); expect(request.lines[1]).not.toHaveProperty("chargeCents"); expect(request.lines[0]!.physicianContext?.standaloneService).toBe(false); expect(request.completeDateOfServiceContext).toBe(true); expect(ui.container.querySelector('input[type="checkbox"]')).toBeNull(); expect(ui.container.querySelector(".mbfc-total strong")?.textContent).toBe("Needs review"); expect(ui.container.textContent).toContain("Reference amount only"); expect(ui.container.textContent).toContain("Source unavailable"); expect(ui.container.textContent).not.toContain("Powered by MindBill"); } finally { await ui.cleanup(); }
});
it("does not restore an obsolete quote after a service is removed", async () => {
  let resolve!: (v: CaClaimFeeQuoteResult) => void;
  const client = { quoteClaimFees: () => new Promise<CaClaimFeeQuoteResult>((r) => { resolve = r; }) };
  const lines = [...input.lines, { ...input.lines[0]!, id: "synthetic-line-2" }];
  const ui = await mount(client, lines);
  try { await ui.submit(); await act(async () => (ui.container.querySelector(".mbfc-remove") as HTMLButtonElement).click()); await act(async () => resolve(result({ ...input, lines }))); expect(ui.container.querySelector(".mbfc-results")).toBeNull(); } finally { await ui.cleanup(); }
});
it("renders untrusted citation text without executable links", async () => {
  const data = result(); data.lines[0]!.quote.provenance[0]!.url = "javascript:alert(1)";
  const ui = await mount({ quoteClaimFees: async () => data });
  try { await ui.submit(); expect(ui.container.querySelector('a[href^="javascript:"]')).toBeNull(); expect(ui.container.textContent).toContain("Synthetic regulation"); } finally { await ui.cleanup(); }
});
