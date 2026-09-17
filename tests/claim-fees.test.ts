// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createBillReferenceClient, type CaClaimFeeQuoteInput, type CaClaimFeeQuoteResult } from "../packages/browser/src/index";
import { parseCaClaimFeeQuote } from "../packages/browser/src/claim-fees";
import { billSubmissionQuoteContext } from "../packages/react/src/bill-submission-form";
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

const imagingLines: CaClaimFeeQuoteInput["lines"] = ["72148", "72141"].map((code, index) => ({
  id: `imaging-${index + 1}`, code, dateOfService: "2026-09-17", units: 1, modifiers: ["26"], serviceZip: "90012",
  professionalComponentContext: { interpretationLocation: "same_as_patient_service", supervisionLevel: "general", imagingSessionReference: "session-1", completeSameDayImagingServices: true },
}));
function field(container: HTMLElement, name: string, index = 0): HTMLInputElement | HTMLSelectElement {
  return [...container.querySelectorAll("label")].filter(label => label.firstChild?.textContent === name)[index]!.querySelector("input,select")!;
}
async function edit(element: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
it.each([true, false, undefined])("uses the full encounter while preserving explicit host incompleteness %s and actual sessions", async (complete) => {
  const lines = imagingLines.map(line => { const context = { ...line.professionalComponentContext! }; delete context.completeSameDayImagingServices; return { ...line, professionalComponentContext: { ...context, ...(complete === undefined ? {} : { completeSameDayImagingServices: complete }) } }; });
  const fetcher = vi.fn<typeof fetch>(async (_url, init) => Response.json({ data: result(JSON.parse(init!.body as string)) }));
  const ui = await mount(createBillReferenceClient({ getSession: async () => ({ token: "synthetic_session" }), fetch: fetcher }), lines);
  try {
    await edit(field(ui.container, "Imaging session reference", 1), "session-2"); await ui.submit();
    const sent = JSON.parse(fetcher.mock.calls[0]![1]!.body as string) as CaClaimFeeQuoteInput;
    expect(sent.lines.map(line => line.professionalComponentContext?.imagingSessionReference)).toEqual(["session-1", "session-2"]);
    expect(sent.lines.every(line => line.professionalComponentContext?.completeSameDayImagingServices === (complete !== false))).toBe(true);
    expect(sent.lines[0]!.professionalComponentContext?.supervisionLevel).toBe("general");
    expect(sent.lines.every(line => line.physicianContext?.standaloneService === false)).toBe(true);
    expect(ui.container.querySelector('input[type="checkbox"]')).toBeNull();
  } finally { await ui.cleanup(); }
});
it.each([["Procedure code", "70551"], ["Date of service", "2026-09-18"], ["Modifiers", "TC"], ["Units", "2"]])("invalidates the full quote and allows recalculation when %s changes", async (name, value) => {
  const client = { quoteClaimFees: vi.fn(async (request: CaClaimFeeQuoteInput) => result(request)) };
  const ui = await mount(client, imagingLines);
  try {
    await ui.submit(); expect(ui.container.querySelector(".mbfc-results")).not.toBeNull();
    await edit(field(ui.container, name!), value!); expect(ui.container.querySelector(".mbfc-results")).toBeNull(); await ui.submit();
    const sent = client.quoteClaimFees.mock.calls[1]![0];
    expect(sent.lines.every(line => line.professionalComponentContext?.completeSameDayImagingServices === true)).toBe(true);
  } finally { await ui.cleanup(); }
});
it("removing an imaging service allows the surviving encounter to be recalculated", async () => {
  const client = { quoteClaimFees: vi.fn(async (request: CaClaimFeeQuoteInput) => result(request)) };
  const ui = await mount(client, imagingLines);
  try { await act(async () => (ui.container.querySelector(".mbfc-remove") as HTMLButtonElement).click()); await ui.submit(); expect(client.quoteClaimFees.mock.calls[0]![0].lines[0]!.professionalComponentContext).toHaveProperty("completeSameDayImagingServices", true); } finally { await ui.cleanup(); }
});
it("ignores a pending sibling allocation after a session reference changes", async () => {
  let resolve!: (value: CaClaimFeeQuoteResult) => void;
  const ui = await mount({ quoteClaimFees: () => new Promise(r => { resolve = r; }) }, imagingLines);
  try { await ui.submit(); await edit(field(ui.container, "Imaging session reference"), "session-2"); await act(async () => resolve(result({ lines: imagingLines, completeDateOfServiceContext: true }))); expect(ui.container.querySelector(".mbfc-results")).toBeNull(); } finally { await ui.cleanup(); }
});
it("rejects an invalid session reference before requesting a quote", async () => {
  const client = { quoteClaimFees: vi.fn(async (request: CaClaimFeeQuoteInput) => result(request)) };
  const ui = await mount(client, imagingLines);
  try { await edit(field(ui.container, "Imaging session reference"), "session with spaces"); await ui.submit(); expect(client.quoteClaimFees).not.toHaveBeenCalled(); expect(ui.container.querySelector('[role="alert"]')?.textContent).toContain("session reference"); } finally { await ui.cleanup(); }
});
it("shows the server's imaging ranking and 95% reduction without a surgery label", async () => {
  const data = result({ lines: imagingLines, completeDateOfServiceContext: true });
  if (data.lines[1]!.quote.status !== "priced") throw new Error("Expected synthetic priced quote");
  data.lines[1]!.quote.feeBreakdown = { method: "California imaging professional-component MPPR", inputs: [{ label: "Rank within actual imaging session", value: "2 of 2" }], steps: [{ label: "Professional component payment", value: "95%" }] };
  const ui = await mount({ quoteClaimFees: async () => data }, imagingLines);
  try { await ui.submit(); expect(ui.container.textContent).toContain("Rank within actual imaging session"); expect(ui.container.textContent).toContain("95%"); expect(ui.container.textContent).not.toContain("Multiple surgery adjustment"); } finally { await ui.cleanup(); }
});
it("keeps browser and Node professional-component contract fields compatible", async () => {
  const browserContext: import("../packages/browser/src/index").CaProfessionalComponentContext = { interpretationLocation: "same_as_patient_service", supervisionLevel: "personal", imagingSessionReference: "session-1", completeSameDayImagingServices: false };
  const nodeContext: import("../packages/node/src/index").CaProfessionalComponentContext = browserContext;
  const nodeLine: import("../packages/node/src/index").ServiceLine = { code: "72148", units: 1, charge: 100, feeContext: { professionalComponentContext: nodeContext } };
  expect(JSON.parse(JSON.stringify(nodeLine)).feeContext.professionalComponentContext).toEqual(browserContext);
});

it("supports imaging entered from an empty calculator without host completeness or a remount", async () => {
  const client = { quoteClaimFees: vi.fn(async (request: CaClaimFeeQuoteInput) => result(request)) };
  const ui = await mount(client, []);
  try {
    for (let index = 0; index < 2; index++) {
      if (index) await act(async () => [...ui.container.querySelectorAll("button")].find(button => button.textContent === "Add service")!.click());
      await edit(field(ui.container, "Procedure code", index), index ? "72141" : "72148");
      await edit(field(ui.container, "Date of service", index), "2026-09-17");
      await edit(field(ui.container, "Modifiers", index), "26");
      await edit(field(ui.container, "Interpretation location", index), "same_as_patient_service");
      await edit(field(ui.container, "Imaging session reference", index), "session-1");
    }
    await ui.submit();
    const sent = client.quoteClaimFees.mock.calls[0]![0];
    expect(sent.completeDateOfServiceContext).toBe(true);
    expect(sent.lines.map(line => line.professionalComponentContext)).toEqual(Array(2).fill({ interpretationLocation: "same_as_patient_service", imagingSessionReference: "session-1", completeSameDayImagingServices: true }));
    expect(ui.container.querySelector('input[type="checkbox"]')).toBeNull();
  } finally { await ui.cleanup(); }
});
it("keeps explicit incomplete imaging facts after editing and removing sibling services", async () => {
  const client = { quoteClaimFees: vi.fn(async (request: CaClaimFeeQuoteInput) => result(request)) };
  const ui = await mount(client, imagingLines.map(line => ({ ...line, professionalComponentContext: { ...line.professionalComponentContext!, completeSameDayImagingServices: false } })));
  try {
    await edit(field(ui.container, "Procedure code"), "70551");
    await act(async () => (ui.container.querySelectorAll(".mbfc-remove")[1] as HTMLButtonElement).click());
    await ui.submit();
    expect(client.quoteClaimFees.mock.calls[0]![0].lines[0]!.professionalComponentContext?.completeSameDayImagingServices).toBe(false);
    expect(ui.container.textContent).toContain("marked this imaging encounter as incomplete");
  } finally { await ui.cleanup(); }
});
it("does not invent missing session or interpretation location facts", async () => {
  const client = { quoteClaimFees: vi.fn(async (request: CaClaimFeeQuoteInput) => result(request)) };
  const ui = await mount(client, imagingLines.map(line => { const copy = { ...line }; delete copy.professionalComponentContext; return copy; }));
  try {
    await ui.submit();
    expect(client.quoteClaimFees.mock.calls[0]![0].lines.every(line => !line.professionalComponentContext)).toBe(true);
    await edit(field(ui.container, "Interpretation location"), "same_as_patient_service"); await ui.submit();
    expect(client.quoteClaimFees.mock.calls[1]![0].lines[0]!.professionalComponentContext).not.toHaveProperty("imagingSessionReference");
    await edit(field(ui.container, "Imaging session reference", 1), "session-1"); await ui.submit();
    expect(client.quoteClaimFees).toHaveBeenCalledTimes(2);
    expect(ui.container.querySelector('[role="alert"]')?.textContent).toContain("Select the interpretation location");
  } finally { await ui.cleanup(); }
});

const technicalFields = ["Furnished by billing provider or group", "Hospital patient status", "Technical service supervision", "Technical imaging session reference"] as const;
const technicalValues = ["true", "not_hospital_patient", "general", "session-1"] as const;
const technicalContext: NonNullable<CaClaimFeeQuoteInput["lines"][number]["technicalComponentContext"]> = { performedByBillingProviderGroup: true, patientHospitalStatus: "not_hospital_patient", supervisionLevel: "general", imagingSessionReference: "session-1", completeSameDayImagingServices: true };
const technicalLines: CaClaimFeeQuoteInput["lines"] = ["70551", "72148", "72141"].map((code, index) => ({ id: `technical-${index + 1}`, code, dateOfService: "2026-07-15", units: 1, modifiers: ["TC"], serviceZip: "90001", technicalComponentContext: { ...technicalContext } }));
it("collects a manual three-service technical encounter without inventing clinical facts", async () => {
  const fetcher = vi.fn<typeof fetch>(async (_url, init) => Response.json({ data: result(JSON.parse(init!.body as string)) }));
  const ui = await mount(createBillReferenceClient({ getSession: async () => ({ token: "synthetic_session" }), fetch: fetcher }), []);
  try {
    for (let index = 0; index < technicalLines.length; index++) {
      if (index) await act(async () => [...ui.container.querySelectorAll("button")].find(button => button.textContent === "Add service")!.click());
      await edit(field(ui.container, "Procedure code", index), technicalLines[index]!.code);
      await edit(field(ui.container, "Date of service", index), "2026-07-15");
      await edit(field(ui.container, "Service ZIP", index), "90001");
      await edit(field(ui.container, "Modifiers", index), "tc");
      for (const name of technicalFields) expect(field(ui.container, name, index).value).toBe("");
      for (let fact = 0; fact < technicalFields.length; fact++) await edit(field(ui.container, technicalFields[fact]!, index), technicalValues[fact]!);
    }
    await ui.submit();
    const sent = JSON.parse(fetcher.mock.calls[0]![1]!.body as string) as CaClaimFeeQuoteInput;
    expect(sent.lines.map(line => line.technicalComponentContext)).toEqual(Array(3).fill(technicalContext));
    expect(sent.lines.every(line => line.modifiers?.join() === "TC" && line.physicianContext?.standaloneService === false && line.catalogContext?.codingRequirementsSatisfied === true)).toBe(true);
    expect(sent.completeDateOfServiceContext).toBe(true);
    expect(ui.container.querySelector('input[type="checkbox"]')).toBeNull();
  } finally { await ui.cleanup(); }
});
it("leaves absent technical facts absent and stops partial drafts from becoming quotes", async () => {
  const client = { quoteClaimFees: vi.fn(async (request: CaClaimFeeQuoteInput) => result(request)) };
  const unknown = { ...technicalLines[0]! }; delete unknown.technicalComponentContext;
  const ui = await mount(client, [unknown]);
  try {
    await ui.submit(); expect(client.quoteClaimFees.mock.calls[0]![0].lines[0]).not.toHaveProperty("technicalComponentContext");
    for (let index = 0; index < technicalFields.length - 1; index++) {
      await edit(field(ui.container, technicalFields[index]!), technicalValues[index]!); await ui.submit();
      expect(client.quoteClaimFees).toHaveBeenCalledTimes(1);
      expect(ui.container.querySelector('[role="alert"]')?.textContent).toContain("Complete the technical imaging details");
    }
    await edit(field(ui.container, technicalFields[3]), "session-1"); await ui.submit(); expect(client.quoteClaimFees).toHaveBeenCalledTimes(2);
    await edit(field(ui.container, technicalFields[0]), ""); await ui.submit(); expect(client.quoteClaimFees).toHaveBeenCalledTimes(2);
    expect(ui.container.querySelector(".mbfc-results")).toBeNull();
  } finally { await ui.cleanup(); }
});
it("preserves explicit technical restrictions through edits and membership changes", async () => {
  const client = { quoteClaimFees: vi.fn(async (request: CaClaimFeeQuoteInput) => result(request)) };
  const restricted = { ...technicalContext, performedByBillingProviderGroup: false, patientHospitalStatus: "hospital_inpatient_or_outpatient" as const, supervisionLevel: "personal" as const, completeSameDayImagingServices: false };
  const ui = await mount(client, technicalLines.map(line => ({ ...line, technicalComponentContext: restricted, catalogContext: { codingRequirementsSatisfied: false } })));
  try {
    await edit(field(ui.container, "Technical imaging session reference"), "another-session");
    await act(async () => (ui.container.querySelectorAll(".mbfc-remove")[2] as HTMLButtonElement).click());
    await ui.submit();
    expect(client.quoteClaimFees.mock.calls[0]![0].lines[0]!.technicalComponentContext).toEqual({ ...restricted, imagingSessionReference: "another-session" });
    expect(client.quoteClaimFees.mock.calls[0]![0].lines[1]!.technicalComponentContext).toEqual(restricted);
    expect(client.quoteClaimFees.mock.calls[0]![0].lines.every(line => line.catalogContext?.codingRequirementsSatisfied === false)).toBe(true);
    expect(ui.container.textContent).toContain("marked this imaging encounter as incomplete");
    expect(ui.container.querySelector(".mbfc-total strong")?.textContent).toBe("Needs review");
  } finally { await ui.cleanup(); }
});
it.each(technicalFields.map((name, index) => [name, ["false", "hospital_inpatient_or_outpatient", "direct", "session-2"][index]!] as const))("invalidates every technical service when %s changes", async (name, value) => {
  const client = { quoteClaimFees: vi.fn(async (request: CaClaimFeeQuoteInput) => result(request)) };
  const ui = await mount(client, technicalLines);
  try { await ui.submit(); expect(ui.container.querySelector(".mbfc-results")).not.toBeNull(); await edit(field(ui.container, name), value); expect(ui.container.querySelector(".mbfc-results")).toBeNull(); await ui.submit(); expect(client.quoteClaimFees).toHaveBeenCalledTimes(2); } finally { await ui.cleanup(); }
});
it("discards a pending technical allocation after sibling context changes", async () => {
  let resolve!: (value: CaClaimFeeQuoteResult) => void;
  const ui = await mount({ quoteClaimFees: () => new Promise(r => { resolve = r; }) }, technicalLines);
  try { await ui.submit(); await edit(field(ui.container, "Technical service supervision", 1), "personal"); await act(async () => resolve(result({ lines: technicalLines, completeDateOfServiceContext: true }))); expect(ui.container.querySelector(".mbfc-results")).toBeNull(); } finally { await ui.cleanup(); }
});
it.each(["session with spaces", "-session", "a".repeat(65)])("rejects an invalid technical session reference %s", async (value) => {
  const client = { quoteClaimFees: vi.fn(async (request: CaClaimFeeQuoteInput) => result(request)) };
  const ui = await mount(client, technicalLines);
  try { await edit(field(ui.container, "Technical imaging session reference"), value); await ui.submit(); expect(client.quoteClaimFees).not.toHaveBeenCalled(); expect(ui.container.querySelector('[role="alert"]')?.textContent).toContain("technical imaging session reference"); } finally { await ui.cleanup(); }
});
it("renders the server technical ranking, fifty-percent reduction, cap and citations", async () => {
  const data = result({ lines: technicalLines, completeDateOfServiceContext: true });
  if (data.lines[1]!.quote.status !== "priced") throw new Error("Expected synthetic priced quote");
  data.lines[1]!.quote.feeBreakdown = { method: "California technical imaging MPPR", inputs: [{ label: "Rank within actual imaging session", value: "2 of 3" }, { label: "OPPS cap", value: "Nonbinding" }], steps: [{ label: "Technical component payment", value: "50%" }] };
  const ui = await mount({ quoteClaimFees: async () => data }, technicalLines);
  try { await ui.submit(); expect(ui.container.textContent).toContain("50%"); expect(ui.container.textContent).toContain("Nonbinding"); expect(ui.container.textContent).not.toContain("Multiple surgery adjustment"); expect(ui.container.querySelector('a[href="https://www.dir.ca.gov/dwc/omfs.htm"]')).not.toBeNull(); } finally { await ui.cleanup(); }
});
it("keeps browser and Node technical contracts compatible and preserves false facts", () => {
  const browserContext: import("../packages/browser/src/index").CaTechnicalComponentContext = { ...technicalContext, performedByBillingProviderGroup: false, completeSameDayImagingServices: false };
  const nodeContext: import("../packages/node/src/index").CaTechnicalComponentContext = browserContext;
  const nodeLine: import("../packages/node/src/index").ServiceLine = { code: "70551", units: 1, charge: 100, feeContext: { technicalComponentContext: nodeContext } };
  expect(JSON.parse(JSON.stringify(nodeLine)).feeContext.technicalComponentContext).toEqual(browserContext);
});

it("preserves host technical facts when projecting a quote into bill context", () => {
  const context = { ...technicalContext, performedByBillingProviderGroup: false, completeSameDayImagingServices: false };
  expect(billSubmissionQuoteContext({ code: "70551", dateOfService: "2026-07-15", technicalComponentContext: context })).toEqual({ technicalComponentContext: context });
});


it("collects initial PT history without timing requirements and clears stale facts", async () => {
  const client = { quoteClaimFees: vi.fn(async (request: CaClaimFeeQuoteInput) => result(request)) };
  const ui = await mount(client, [{ id: "evaluation", code: "97161", dateOfService: "2026-09-17", units: 1, therapyContext: { priorInitialEvaluationInEpisode: false, directOneOnOneMinutes: 60, totalVisitMinutes: 60, completeSameDayServices: false, otherSameDayServices: true }, hasFeeAgreement: false }]);
  try {
    expect(ui.container.textContent).not.toContain("Direct one-on-one minutes");
    expect(field(ui.container, "Prior initial evaluation in this care episode").value).toBe("false");
    await ui.submit();
    const sent = client.quoteClaimFees.mock.calls[0]![0].lines[0]!;
    expect(sent.therapyContext).toMatchObject({ priorInitialEvaluationInEpisode: false, completeSameDayServices: false, otherSameDayServices: true });
    expect(sent.therapyContext).not.toHaveProperty("directOneOnOneMinutes");
    await edit(field(ui.container, "Prior initial evaluation in this care episode"), "");
    expect(ui.container.querySelector(".mbfc-results")).toBeNull();
    await ui.submit(); expect(client.quoteClaimFees.mock.calls[1]![0].lines[0]!.therapyContext).not.toHaveProperty("priorInitialEvaluationInEpisode");
    await edit(field(ui.container, "Procedure code"), "97110");
    expect(ui.container.textContent).toContain("Direct one-on-one minutes");
  } finally { await ui.cleanup(); }
});
it("does not invent therapy facts when changing service type", async () => {
  const client = { quoteClaimFees: vi.fn(async (request: CaClaimFeeQuoteInput) => result(request)) };
  const ui = await mount(client);
  try {
    await edit(field(ui.container, "Service type"), "therapy"); await ui.submit();
    expect(client.quoteClaimFees.mock.calls[0]![0].lines[0]!.therapyContext).toEqual({ placeOfService: "11", completeSameDayServices: true, otherSameDayServices: false });
    expect(field(ui.container, "Therapy pricing basis").value).toBe("");
  } finally { await ui.cleanup(); }
});
it("ignores a pending evaluation quote when episode history changes", async () => {
  let resolve!: (value: CaClaimFeeQuoteResult) => void;
  const lines = [{ id: "evaluation", code: "97161", dateOfService: "2026-09-17", therapyContext: { priorInitialEvaluationInEpisode: false } }];
  const ui = await mount({ quoteClaimFees: () => new Promise(r => { resolve = r; }) }, lines);
  try { await ui.submit(); await edit(field(ui.container, "Prior initial evaluation in this care episode"), "true"); await act(async () => resolve(result({ lines, completeDateOfServiceContext: true }))); expect(ui.container.querySelector(".mbfc-results")).toBeNull(); } finally { await ui.cleanup(); }
});
