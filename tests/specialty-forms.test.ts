// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { sanitizeBillReviewSaveInput, type BillLifecycleData, type BillItemFormData } from "../packages/browser/src/index";
import { BillSubmissionForm, validateBillSubmission, type BillSubmissionInput } from "../packages/react/src/bill-submission-form";
import { buildBillReviewSaveInput, type BillReviewDraft } from "../packages/react/src/native-bill-review";
import { correctionBill } from "../packages/react/src/connected-bill-lifecycle";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const address = { line1: "100 Synthetic Way", city: "Sacramento", state: "CA", postalCode: "95814" };
const pharmacy: BillItemFormData = { pharmacy: { prescriptionNumber: "SYNTHETIC-RX", compoundCode: "2", compound: {
  name: "Synthetic compound", metricQuantity: "1.230", unitOfMeasure: "GR",
  ingredients: [{ ndcNumber: "00000000001", metricQuantity: "1.230", ingredientCost: "12.340" }],
} } };
const bill: BillSubmissionInput = {
  claimForm: "ncpdp", externalId: "synthetic-specialty",
  patient: { firstName: "Ada", lastName: "Example", dateOfBirth: "1980-01-02", address },
  claim: { claimNumber: "SYNTHETIC-7", employer: "Synthetic Foods", dateOfInjury: "2026-08-01", claimsAdministrator: { id: "payer_synthetic", name: "Synthetic Administrator" } },
  service: { date: "2026-08-24" },
  billingProvider: { name: "Synthetic Pharmacy", taxId: "123456789", npi: "1234567890", phone: "9165550100", address },
  formData: { pharmacy: { pharmacyServiceType: "01", paperDetails: { prescriptionOriginCode: "3" } } },
  serviceLines: [{ code: "", units: 1.23, charge: 12.34, formData: pharmacy, drug: { ndcNumber: "00000000001", metricQuantity: "1.230", unitOfMeasure: "GR" } }],
};

it("preserves compound precision through review sanitization and correction", () => {
  const line = { ...bill.serviceLines[0]!, modifiers: [], units: 1.23, charge: 12.34 };
  const draft: BillReviewDraft = {
    claimForm: "ncpdp", formData: bill.formData!, claimsAdminId: "payer_synthetic", claimsAdminName: "Synthetic Administrator",
    patientFirstName: "Ada", patientMiddleName: "", patientLastName: "Example", patientDob: "1980-01-02",
    claimNumber: "SYNTHETIC-7", employer: "Synthetic Foods", doi: "2026-08-01", injuryEndDate: "", cumulativeTrauma: false, adjNumber: "",
    dos: "2026-08-24", dosEnd: "", authorizationNumber: "",
    billingProvider: { name: "Synthetic Pharmacy", taxId: "123456789", npi: "1234567890", billType: "Pharmacy" },
    clinician: { name: "", specialty: "", npi: "" }, location: { name: "", street: "", city: "", state: "", zip: "", posCode: "" },
    lineItems: [line, { code: "", modifiers: [], units: 1, charge: 0 }],
  };
  const saved = sanitizeBillReviewSaveInput(buildBillReviewSaveInput(draft));
  expect(saved.formData).toEqual(bill.formData);
  expect(saved.lineItems).toHaveLength(1);
  expect(saved.lineItems[0]).toMatchObject(line);
  const corrected = correctionBill({ bill: { claimForm: "ncpdp", formData: bill.formData, dos: "2026-08-24", lineItems: saved.lineItems }, patient: { name: "Ada Example" }, injury: {} } as BillLifecycleData);
  expect(corrected.claimForm).toBe("ncpdp");
  expect(corrected.formData).toEqual(bill.formData);
  expect(corrected.serviceLines[0]?.formData).toEqual(pharmacy);
  expect(corrected.serviceLines[0]?.drug?.metricQuantity).toBe("1.230");
});

it("permits revenue-only institutional lines and fractional specialty quantities", () => {
  expect(validateBillSubmission(bill).fieldErrors).toEqual({});
  const institutional = { ...bill, claimForm: "ub04" as const, serviceLines: [{ code: "", units: 1.25, charge: 50, formData: { institutional: { revenueCode: "0250" } } }] };
  expect(validateBillSubmission(institutional).fieldErrors).toEqual({});
  expect(validateBillSubmission({ ...institutional, claimForm: "ada" }).fieldErrors["serviceLines.0.code"]).toBeTruthy();
});

it("submits specialty data without med-legal defaults or professional fee repricing", async () => {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const onSubmit = vi.fn(); const quoteFee = vi.fn();
  try {
    await act(async () => root.render(createElement(BillSubmissionForm, { initialBill: bill, onSubmit, onQuoteFee: quoteFee, treatmentBilling: true, deliveryRoutePicker: "off" })));
    expect(container.textContent).toContain("NCPDP · Pharmacy");
    expect(container.querySelector('[aria-label="Billed charge 1"]')).not.toBeNull();
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(onSubmit).toHaveBeenCalledOnce();
    const value = onSubmit.mock.calls[0]![0];
    expect(value.bill.claimForm).toBe("ncpdp");
    expect(value.bill.diagnoses ?? []).toEqual([]);
    expect(value.bill.serviceLines).toHaveLength(1);
    expect(value.bill.serviceLines[0]).toMatchObject(bill.serviceLines[0]!);
    expect(quoteFee).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); container.remove(); }
});
