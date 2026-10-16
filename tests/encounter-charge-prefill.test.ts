// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { encounterBillFeeQuotes, type BillFeeQuote, type BillFeeQuoteInput, type EncounterQuoteResult } from "../packages/browser/src/index";
import { BillSubmissionForm, type BillSubmissionInput } from "../packages/react/src/bill-submission-form";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const address = { line1: "100 Synthetic Way", city: "Oakland", state: "CA", postalCode: "94612" };
// Lines created from an approved RFA: code, units, RFA item and diagnoses, but no charge.
const rfaLine = (code: string, units = 1) => ({ code, units, rfaItemId: `rfa_item_${code}`, diagnosisPointers: [1] });
const bill: BillSubmissionInput = {
  externalId: "synthetic_prefill", billingMode: "professional",
  patient: { firstName: "Ada", lastName: "Example", dateOfBirth: "1980-01-02", address },
  claim: { claimNumber: "SYNTHETIC-9", employer: "Synthetic Foods", dateOfInjury: "2026-08-01", claimsAdministrator: { id: "payer_synthetic", name: "Synthetic Claims Administrator" } },
  service: { date: "2026-10-08" },
  billingProvider: { name: "Synthetic Spine Group", taxId: "123456789", npi: "1234567890", phone: "5105550100", address },
  renderingProvider: { name: "Sam Example, MD", npi: "1098765432", taxonomy: "208VP0014X" },
  serviceLocation: { name: "Synthetic Office", placeOfServiceCode: "11", address },
  diagnoses: ["M54.50"],
  serviceLines: [rfaLine("64483"), rfaLine("99213"), { code: "97110", units: 2, charge: 180, diagnosisPointers: [1] }],
};
const priced = (amountCents: number, practiceChargeCents?: number): BillFeeQuote => ({ status: "priced", amountCents, scheduleMaximumCents: amountCents, basis: "ca_physician_rbrvs", provenance: [], notes: [],
  ...(practiceChargeCents !== undefined ? { chargeAmountCents: practiceChargeCents, practiceChargeCents } : {}) });

async function render(onQuoteEncounter: (inputs: BillFeeQuoteInput[]) => Promise<BillFeeQuote[]>, initialBill = bill) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container); const onSubmit = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 1200 });
  await act(async () => root.render(createElement(BillSubmissionForm, {
    initialBill, onSubmit, profileOptions: {}, treatmentBilling: true, editableTreatmentCharges: true, deliveryRoutePicker: "off", onQuoteEncounter,
  })));
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  const charge = (line: number) => container.querySelector<HTMLInputElement>(`[aria-label="Billed charge for line ${line}"]`)!;
  const type = async (input: HTMLInputElement, value: string) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const settle = async () => act(async () => { await vi.advanceTimersByTimeAsync(300); });
  return { container, onSubmit, charge, type, settle, unmount: async () => { await act(async () => root.unmount()); container.remove(); } };
}

it("prefills an empty charge from the practice charge, else the OMFS expected amount, without re-quoting", async () => {
  vi.useFakeTimers();
  // 64483: the practice charges $650.00; 99213 has no saved practice charge, so it starts at the expected $93.22.
  const onQuoteEncounter = vi.fn(async (inputs: BillFeeQuoteInput[]) => inputs.map((input) => input.code === "64483" ? priced(45834, 65000) : input.code === "99213" ? priced(9322) : priced(8113, 9000)));
  const view = await render(onQuoteEncounter);
  try {
    expect(view.charge(1).value).toBe("650");
    expect(view.charge(2).value).toBe("93.22");
    // A charge already on the line is never replaced by the practice charge.
    expect(view.charge(3).value).toBe("180");
    const differences = [...view.container.querySelectorAll(".mbsf-difference")].map((cell) => cell.textContent);
    expect(differences.slice(0, 3)).toEqual(["$191.66", "$0.00", "$98.87"]);
    const totals = view.container.querySelector(".mbsf-encounter-total")!.textContent!;
    expect(totals).toContain("$923.22"); expect(totals).toContain("$632.69"); expect(totals).toContain("$290.53");
    await view.settle(); await view.settle();
    expect(onQuoteEncounter).toHaveBeenCalledTimes(1);
  } finally { await view.unmount(); vi.useRealTimers(); }
});

it("keeps a typed or cleared charge, follows units while untouched, and submits the shown charge", async () => {
  vi.useFakeTimers();
  const onQuoteEncounter = vi.fn(async (inputs: BillFeeQuoteInput[]) => inputs.map((input) => priced(10000 * (input.units ?? 1), 20000 * (input.units ?? 1))));
  const view = await render(onQuoteEncounter);
  try {
    expect(view.charge(1).value).toBe("200");
    // The biller edits line 2; re-pricing must not overwrite it.
    await view.type(view.charge(2), "155.5");
    const units = view.container.querySelector<HTMLInputElement>('[aria-label="Units 1"]')!;
    await view.type(units, "2"); await view.settle();
    expect(view.charge(1).value).toBe("400");
    expect(view.charge(2).value).toBe("155.5");
    await view.type(view.charge(1), ""); await view.settle();
    expect(view.charge(1).value).toBe("");
    await view.type(view.charge(1), "390"); await view.settle();
    await act(async () => { view.container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(view.onSubmit).toHaveBeenCalledTimes(1);
    const submitted = view.onSubmit.mock.calls[0]![0].bill as BillSubmissionInput;
    expect(submitted.serviceLines.map((line) => line.charge)).toEqual([390, 155.5, 180]);
  } finally { await view.unmount(); vi.useRealTimers(); }
  vi.useFakeTimers();
  const untouched = await render(onQuoteEncounter);
  try {
    await act(async () => { untouched.container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect((untouched.onSubmit.mock.calls[0]![0].bill as BillSubmissionInput).serviceLines.map((line) => line.charge)).toEqual([200, 200, 180]);
  } finally { await untouched.unmount(); vi.useRealTimers(); }
});

it("leaves the charge empty while a line needs review", async () => {
  vi.useFakeTimers();
  const view = await render(async (inputs) => inputs.map(() => ({ status: "requires_review", reason: "code_not_payable", provenance: [] }) satisfies BillFeeQuote));
  try {
    expect(view.charge(1).value).toBe("");
  } finally { await view.unmount(); vi.useRealTimers(); }
});

it("encounter quotes expose the practice charge separately", () => {
  const line = (id: string, quote: Record<string, unknown>) => ({ id, assessment: "priced", quote: { status: "priced", amountCents: 45834, scheduleMaximumCents: 45834, basis: "ca_physician_rbrvs", provenance: [], notes: [], ...quote }, findings: [], displayNotes: [] });
  const result = { status: "priced", lines: [line("line-0", { chargeAmountCents: 65000 }), line("line-1", {})], totals: { submittedChargeCents: null, pricedSubtotalCents: 0, estimatedPayableCents: null, scheduleMaximumCents: null, reviewLineCount: 0 },
    claimEdits: [], limitations: [], medicalLegalLineIds: [], visitNotes: [] } as unknown as EncounterQuoteResult;
  const [withCharge, without] = encounterBillFeeQuotes(result, 2);
  expect(withCharge).toMatchObject({ status: "priced", amountCents: 45834, practiceChargeCents: 65000, chargeAmountCents: 65000 });
  expect(without).not.toHaveProperty("practiceChargeCents");
});
