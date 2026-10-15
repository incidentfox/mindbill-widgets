// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { BillFeeQuote, BillFeeQuoteInput } from "../packages/browser/src/index";
import { BillSubmissionForm, type BillSubmissionInput } from "../packages/react/src/bill-submission-form";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const address = { line1: "100 Synthetic Way", city: "Oakland", state: "CA", postalCode: "94612" };
const line = (code: string, charge: number, units = 1, modifiers?: string[]) => ({ code, units, charge, serviceDate: "2026-10-08", diagnosisPointers: [1], ...(modifiers ? { modifiers } : {}) });
const bill: BillSubmissionInput = {
  externalId: "synthetic_encounter", billingMode: "professional",
  patient: { firstName: "Ada", lastName: "Example", dateOfBirth: "1980-01-02", address },
  claim: { claimNumber: "SYNTHETIC-9", employer: "Synthetic Foods", dateOfInjury: "2026-08-01",
    claimsAdministrator: { id: "payer_synthetic", name: "Synthetic Claims Administrator" } },
  service: { date: "2026-10-08" },
  billingProvider: { name: "Synthetic Spine Group", taxId: "123456789", npi: "1234567890", phone: "5105550100", address },
  renderingProvider: { name: "Sam Example, D.C.", npi: "1098765432", taxonomy: "111N00000X" },
  serviceLocation: { name: "Synthetic Office", placeOfServiceCode: "11", address },
  diagnoses: ["M54.50"],
  serviceLines: [line("99213", 250, 1, ["25"]), line("98941", 120), line("97110", 180, 2), line("97140", 90), line("97014", 50)],
};
const priced = (amountCents: number, findings?: BillFeeQuote extends infer Q ? Q extends { status: "priced"; findings?: infer F } ? F : never : never): BillFeeQuote =>
  ({ status: "priced", amountCents, scheduleMaximumCents: amountCents, basis: "ca_physician_rbrvs", provenance: [], notes: [], ...(findings ? { findings } : {}) });

async function render(onQuoteEncounter: (inputs: BillFeeQuoteInput[]) => Promise<BillFeeQuote[]>, width = 1200) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => width });
  await act(async () => root.render(createElement(BillSubmissionForm, {
    initialBill: bill, getSession: async () => ({ token: "synthetic_session" }), fetch: vi.fn<typeof fetch>(async () => Response.json({ data: [] })),
    treatmentBilling: true, editableTreatmentCharges: true, deliveryRoutePicker: "off", onQuoteEncounter,
    describeProcedureCode: (code: string) => ({ "99213": "Office visit, established patient, low", "98941": "Chiropractic manipulation, 3-4 regions" } as Record<string, string>)[code],
  })));
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  return { container, unmount: async () => { await act(async () => root.unmount()); container.remove(); } };
}

it("quotes the whole encounter once and shows charge, expected (OMFS) and difference with totals", async () => {
  vi.useFakeTimers();
  const onQuoteEncounter = vi.fn(async (inputs: BillFeeQuoteInput[]) => {
    expect(inputs.map((input) => input.code)).toEqual(["99213", "98941", "97110", "97140", "97014"]);
    return [priced(18168, [{ code: "modifier_conditional_estimate", message: "Modifier 25 requires a separately identifiable visit." }]),
      priced(5559), priced(8113), { status: "not_separately_payable", reason: "ptp_bundled", provenance: [], message: "Bundled with 97110." },
      { status: "requires_review", reason: "code_not_payable", provenance: [], message: "97014 is not payable in California workers' comp. Bill G0283." }] satisfies BillFeeQuote[];
  });
  const view = await render(onQuoteEncounter);
  try {
    expect(onQuoteEncounter).toHaveBeenCalledTimes(1);
    const head = view.container.querySelector(".mbsf-line-head")!.textContent!;
    expect(head).toContain("Charge"); expect(head).toContain("Expected (OMFS)"); expect(head).toContain("Difference");
    const expected = [...view.container.querySelectorAll(".mbsf-expected")].map((cell) => cell.textContent);
    expect(expected.slice(0, 5)).toEqual(["$181.68See note", "$55.59", "$81.13", "$0.00Bundled", "Needs review"]);
    const differences = [...view.container.querySelectorAll(".mbsf-difference")].map((cell) => cell.textContent);
    expect(differences.slice(0, 5)).toEqual(["$68.32", "$64.41", "$98.87", "$90.00", "—"]);
    const totals = view.container.querySelector(".mbsf-encounter-total")!.textContent!;
    expect(view.container.textContent).not.toContain("Billed charge ($)");
    expect(totals).toContain("$690.00"); expect(totals).toContain("$318.40"); expect(totals).toContain("+ 1 line needs review");
    expect(view.container.textContent).toContain("Modifier 25 requires a separately identifiable visit.");
    expect(view.container.textContent).toContain("97014 is not payable in California workers' comp. Bill G0283.");
    // Known codes are described; therapy minutes are not requested for an encounter quote.
    expect(view.container.textContent).toContain("Chiropractic manipulation, 3-4 regions");
    expect(view.container.textContent).not.toContain("Custom CPT, HCPCS, or medical-legal code");
    expect(view.container.textContent).not.toContain("Direct one-on-one minutes");
    expect(view.container.textContent).not.toContain("Estimated reimbursement");
  } finally { await view.unmount(); vi.useRealTimers(); }
});

it("shows the difference total when every line is priced, and Unavailable on a failed lookup", async () => {
  vi.useFakeTimers();
  const view = await render(async (inputs) => inputs.map(() => priced(1000)));
  try {
    const totals = view.container.querySelector(".mbsf-encounter-total")!.textContent!;
    expect(totals).toContain("$50.00"); expect(totals).toContain("$640.00");
  } finally { await view.unmount(); vi.useRealTimers(); }
  vi.useFakeTimers();
  const failed = await render(async () => { throw new Error("offline"); });
  try {
    expect(failed.container.querySelector(".mbsf-expected")?.textContent).toBe("Unavailable");
  } finally { await failed.unmount(); vi.useRealTimers(); }
});

it("billed charge entry has no number spinner and keeps a partial decimal", async () => {
  vi.useFakeTimers();
  const view = await render(async (inputs) => inputs.map(() => priced(1000)));
  try {
    const charge = view.container.querySelector<HTMLInputElement>('[aria-label="Billed charge for line 1"]')!;
    expect(charge.type).toBe("text"); expect(charge.inputMode).toBe("decimal");
    await act(async () => { charge.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(charge, "260."); charge.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(charge.value).toBe("260.");
    expect(charge.closest(".mbsf-charge")).not.toBeNull();
    expect(view.container.querySelector(".mbsf-difference")?.textContent).toBe("$250.00");
  } finally { await view.unmount(); vi.useRealTimers(); }
});
