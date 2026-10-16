// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import {
  createBillReferenceClient, createEncounterQuoter, encounterBillFeeQuotes, encounterQuoteRequest,
  type EncounterQuoteResult,
} from "../packages/browser/src/index";
import { ConnectedTreatmentBillForm } from "../packages/react/src/connected-treatment-bill-form";
import type { BillSubmissionInput } from "../packages/react/src/bill-submission-form";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const identity = { renderingProviderId: "rp_synthetic", placeOfServiceId: "loc_synthetic", claimId: "clm_synthetic" };
const result: EncounterQuoteResult = {
  status: "requires_review",
  lines: [
    { id: "line-0", assessment: "priced", findings: [], displayNotes: ["Modifier 25: document a separately identifiable visit."],
      quote: { status: "priced", amountCents: 9000, scheduleMaximumCents: 9000, basis: "ca_physician_rbrvs", notes: [], provenance: [] } },
    { id: "line-1", assessment: "priced", findings: [], displayNotes: [],
      quote: { status: "priced", amountCents: 20000, scheduleMaximumCents: 20000, basis: "ca_physician_rbrvs", notes: [], provenance: [] },
      paymentAdjustment: { rule: "ca_multiple_surgery", rank: 2, percent: 50, unadjustedScheduleMaximumCents: 20000, scheduleMaximumCents: 10000, amountCents: 10000, citationUrl: "https://example.test/rule" } },
    { id: "line-2", assessment: "not_separately_payable", findings: [{ code: "ptp_bundled", lineIds: ["line-2"], message: "Bundled." }],
      displayNotes: ["Bundled into 97110 (NCCI); add 59/X only for a documented distinct service."], quote: { status: "not_separately_payable", reason: "ptp_bundled", provenance: [] } },
  ],
  totals: { submittedChargeCents: 50000, pricedSubtotalCents: 19000, estimatedPayableCents: null, scheduleMaximumCents: null, reviewLineCount: 1 },
  claimEdits: [], limitations: [], medicalLegalLineIds: [], visitNotes: ["Visit 3 of 24 (LC 4604.5)"],
};

it("builds one encounter request from form lines and maps each line back, with the multiple-procedure amount", () => {
  const request = encounterQuoteRequest([
    { code: " 99213 ", dateOfService: "2026-10-08", units: 1, modifiers: ["-25", "25"], chargeCents: 15000 },
    { code: "29881", dateOfService: "2026-10-08", units: 1 },
    { code: "97140", dateOfService: "2026-10-09" },
  ], identity);
  expect(request).toEqual({ ...identity, dateOfService: "2026-10-08", lines: [
    { id: "line-0", code: "99213", units: 1, modifiers: ["25"], chargeCents: 15000 },
    { id: "line-1", code: "29881", units: 1, modifiers: [] },
    { id: "line-2", code: "97140", units: 1, modifiers: [], dateOfService: "2026-10-09" },
  ] });
  const quotes = encounterBillFeeQuotes(result, 4);
  expect(quotes[0]).toMatchObject({ status: "priced", amountCents: 9000, findings: [{ message: "Modifier 25: document a separately identifiable visit." }] });
  expect(quotes[1]).toMatchObject({ status: "priced", amountCents: 10000, scheduleMaximumCents: 10000 });
  expect(quotes[2]).toMatchObject({ status: "not_separately_payable", reason: "ptp_bundled", message: "Bundled into 97110 (NCCI); add 59/X only for a documented distinct service." });
  expect(quotes[3]).toMatchObject({ status: "requires_review", reason: "fee_calculation_unavailable" });
});

it("quoteEncounter posts to the partner encounter endpoint with the browser session and validates the response", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async (_input, _init) => Response.json({ data: result }));
  const client = createBillReferenceClient({ getSession: async () => ({ token: "mbes_synthetic", apiBaseUrl: "https://api.example.test" }), fetch });
  const input = encounterQuoteRequest([{ code: "99213", dateOfService: "2026-10-08" }, { code: "29881", dateOfService: "2026-10-08" }, { code: "97140", dateOfService: "2026-10-08" }], identity);
  await expect(client.quoteEncounter(input)).resolves.toMatchObject({ visitNotes: ["Visit 3 of 24 (LC 4604.5)"] });
  const [url, init] = fetch.mock.calls[0]!;
  expect(String(url)).toBe("https://api.example.test/partner/v2/fee-quotes/encounter");
  expect(new Headers(init?.headers).get("authorization")).toBe("Bearer mbes_synthetic");
  expect(JSON.parse(String(init?.body))).toEqual(input);
  fetch.mockResolvedValueOnce(Response.json({ data: { ...result, lines: [{ id: "line-9" }] } }));
  await expect(client.quoteEncounter(input)).rejects.toThrow(/invalid/);
});

it("the quoter shows every line as needing review when pricing is unavailable", async () => {
  const onResult = vi.fn();
  const quote = createEncounterQuoter({ quoteEncounter: async () => { throw new Error("offline"); } }, identity, onResult);
  const quotes = await quote([{ code: "99213", dateOfService: "2026-10-08" }]);
  expect(quotes).toEqual([expect.objectContaining({ status: "requires_review", reason: "fee_calculation_unavailable" })]);
  expect(onResult).toHaveBeenCalledWith(null);
});

it("ConnectedTreatmentBillForm prices the visit through the encounter endpoint and shows visit notes", async () => {
  vi.useFakeTimers();
  const address = { line1: "100 Synthetic Way", city: "Oakland", state: "CA", postalCode: "94612" };
  const bill: BillSubmissionInput = {
    externalId: "synthetic_visit", billingMode: "professional",
    patient: { firstName: "Ada", lastName: "Example", dateOfBirth: "1980-01-02", address },
    claim: { claimNumber: "SYNTHETIC-9", employer: "Synthetic Foods", dateOfInjury: "2026-08-01", claimsAdministrator: { id: "payer_synthetic", name: "Synthetic Claims Administrator" } },
    service: { date: "2026-10-08" },
    billingProvider: { name: "Synthetic Spine Group", taxId: "123456789", npi: "1234567890", phone: "5105550100", address },
    renderingProvider: { name: "Sam Example, D.C.", npi: "1098765432", taxonomy: "111N00000X" },
    serviceLocation: { name: "Synthetic Office", placeOfServiceCode: "11", address },
    diagnoses: ["M54.50"],
    serviceLines: [{ code: "99213", units: 1, charge: 150, serviceDate: "2026-10-08", diagnosisPointers: [1] }, { code: "29881", units: 1, charge: 300, serviceDate: "2026-10-08", diagnosisPointers: [1] },
      { code: "97140", units: 1, charge: 50, serviceDate: "2026-10-08", diagnosisPointers: [1] }],
  };
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => String(input).endsWith("/fee-quotes/encounter") ? Response.json({ data: result }) : Response.json({ data: [] }));
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(ConnectedTreatmentBillForm, {
    initialBill: bill, encounter: identity, getSession: async () => ({ token: "mbes_synthetic" }), fetch, deliveryRoutePicker: "off",
  })));
  await act(async () => { await vi.advanceTimersByTimeAsync(400); });
  try {
    const calls = fetch.mock.calls.filter(([url]) => String(url).endsWith("/partner/v2/fee-quotes/encounter"));
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(JSON.parse(String(calls[0]![1]?.body))).toMatchObject({ renderingProviderId: "rp_synthetic", placeOfServiceId: "loc_synthetic", claimId: "clm_synthetic" });
    expect(container.querySelector("[aria-label='Visit notes']")?.textContent).toBe("Visit 3 of 24 (LC 4604.5)");
    expect([...container.querySelectorAll(".mbsf-expected")].map(cell => cell.textContent).slice(0, 2)).toEqual(["$90.00See note", "$100.00"]);
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.useRealTimers();
  }
});
