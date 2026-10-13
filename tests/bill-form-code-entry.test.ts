// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { BillSubmissionForm, BillSubmissionServiceLinesSection, type BillSubmissionInput } from "../packages/react/src/bill-submission-form";
import { feeReviewMessage } from "../packages/react/src/fee-review-message";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const address = { line1: "100 Synthetic Way", city: "Concord", state: "CA", postalCode: "94520" };
const bill: BillSubmissionInput = {
  externalId: "synthetic", billingMode: "med_legal",
  patient: { firstName: "Ada", lastName: "Example", dateOfBirth: "1980-01-02", address },
  claim: { claimNumber: "SYN-7", employer: "Synthetic Foods", dateOfInjury: "2026-08-01", injuryState: "CA" },
  service: { date: "2026-09-17" },
  billingProvider: { name: "Synthetic Practice", taxId: "123456789", npi: "1234567890", phone: "2135550100", address },
  renderingProvider: { name: "Ada Evaluator", npi: "1098765432", taxonomy: "2084P0800X" },
  serviceLocation: { name: "Concord", placeOfServiceCode: "11", address },
  diagnoses: [], serviceLines: [{ code: "ML201", units: 1 }],
};
const procedureOptions = [
  { code: "ML204", description: "Medical-legal testimony, $455 per hour in 15-minute units", allowedAmount: 113.75, defaultUnits: 8 },
  { code: "96130", description: "Psychological testing evaluation, first hour" },
];

async function mount(onQuoteFee: (input: unknown) => Promise<never>) {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  await act(async () => root.render(createElement(BillSubmissionForm, {
    initialBill: bill, treatmentBilling: true, procedureOptions, onQuoteFee, deliveryRoutePicker: "off",
    fetch: async () => Response.json({}, { status: 503 }),
  } as never, createElement(BillSubmissionServiceLinesSection))));
  const input = (label: string) => container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  const setValue = async (element: HTMLInputElement, value: string) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const choose = async (line: number, typed: string) => {
    const box = input(`Procedure code ${line}`);
    await act(async () => { box.focus(); box.click(); });
    await setValue(box, typed);
    const option = container.querySelector<HTMLElement>('[role="option"]');
    expect(option, `an option for ${typed}`).not.toBeNull();
    await act(async () => { option!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); option!.click(); });
  };
  const money = () => [...container.querySelectorAll(".mbsf-money")].map((cell) => cell.textContent);
  const units = (line: number) => container.querySelectorAll<HTMLInputElement>('.mbsf-lines input[type="number"]')[line - 1]!;
  return { container, choose, money, units, setValue, close: async () => { await act(async () => root.unmount()); container.remove(); } };
}

it("finds a medical-legal code typed with a hyphen or space and prices it", async () => {
  const form = await mount(async () => { throw new Error("unused"); });
  try {
    expect(form.money()[0]).toBe("$2,015.00");
    await form.choose(1, "ML-203");
    expect(form.money()[0]).toBe("$650.00");
    await form.choose(1, "ml 204");
    expect(form.units(1).value).toBe("8");
    expect(form.money()[0]).toBe("$910.00");
  } finally { await form.close(); }
});

it("starts a code at its default units without replacing a quantity the biller entered", async () => {
  const form = await mount(async () => { throw new Error("unused"); });
  try {
    await form.choose(1, "ML204");
    await form.choose(1, "ML203");
    expect(form.units(1).value).toBe("1");
    await form.setValue(form.units(1), "3");
    await form.choose(1, "ML204");
    expect(form.units(1).value).toBe("3");
  } finally { await form.close(); }
});

it("says the fee is unavailable when the lookup fails instead of asking for review", async () => {
  const form = await mount(async () => { throw new Error("lookup failed"); });
  try {
    await form.choose(2, "96130");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    expect(form.money()[1]).toBe("Fee unavailable");
    expect(form.container.textContent).toContain("Fee lookup is unavailable");
  } finally { await form.close(); }
});

it("explains timed testing reviews in plain words", () => {
  expect(feeReviewMessage("timed_testing_units_exceed_adopted_mue")).toContain("daily limit");
  expect(feeReviewMessage("timed_testing_add_on_requires_primary_service")).toContain("same date");
});
