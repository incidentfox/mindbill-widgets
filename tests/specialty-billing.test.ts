import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { sanitizeBillReviewSaveInput, type BillReviewLineItem, type HistoricalBillReviewData } from "../packages/browser/src/index";
import { buildBillReviewSaveInput, ensureTrailingProcedureLine, type BillReviewDraft } from "../packages/react/src/native-bill-review";
import { BillReadOnlyForm } from "../packages/react/src/bill-read-only-form";

const revenue: BillReviewLineItem = { code: "", modifiers: [], units: 1, charge: 150, serviceDate: "2026-09-01", formData: { institutional: { revenueCode: "0450" } } };
const drug: BillReviewLineItem = { code: "", modifiers: [], units: 2.5, charge: 25, serviceDate: "2026-09-01", drug: { ndcNumber: "00000000001", metricQuantity: "2.5", unitOfMeasure: "GR" }, formData: { pharmacy: { prescriptionNumber: "123456", compoundCode: "2" } } };
const dental: BillReviewLineItem = { code: "D2392", modifiers: [], units: 1, charge: 100, serviceDate: "2026-09-01", formData: { dental: { toothNumber: "2", toothSurfaces: ["M", "O"] } } };
const draft: BillReviewDraft = {
  claimForm: "ub04", formData: { institutional: { typeOfBill: "0131" } }, claimsAdminId: "payer_synthetic", claimsAdminName: "Sample payer",
  patientFirstName: "Synthetic", patientMiddleName: "", patientLastName: "Example", patientDob: "1980-01-01", claimNumber: "SYNTHETIC", employer: "Sample employer", doi: "2026-08-01", injuryEndDate: "", cumulativeTrauma: false, adjNumber: "", dos: "2026-09-01", dosEnd: "", authorizationNumber: "",
  billingProvider: { name: "Sample practice", taxId: "000000000", npi: "0000000000", billType: "Institutional" }, clinician: { name: "Sample clinician", specialty: "", npi: "0000000000" }, location: { name: "Sample facility", street: "1 Example Street", city: "Example", state: "CA", zip: "90001", posCode: "22" }, lineItems: [],
};

describe("specialty review round trips", () => {
  it.each([revenue, drug, dental])("retains the service identifier, quantities and metadata: $code", (line) => {
    const saved = buildBillReviewSaveInput({ ...draft, lineItems: ensureTrailingProcedureLine([line]) });
    expect(saved.formData).toEqual(draft.formData);
    expect(saved.lineItems).toHaveLength(1);
    expect(saved.lineItems[0]).toMatchObject(line);
  });
  it("retains partially entered metadata in the editor but excludes rows without a service identifier from saves", () => {
    const partial = { code: "", modifiers: [], units: 1, charge: 0, formData: { dental: { toothNumber: "2" } } };
    expect(ensureTrailingProcedureLine([partial])).toHaveLength(2);
    expect(buildBillReviewSaveInput({ ...draft, lineItems: [partial] }).lineItems).toEqual([]);
  });
  it("preserves compound ingredient lines sharing an Rx number instead of collapsing them", () => {
    const second = { ...drug, drug: { ...drug.drug!, ndcNumber: "00000000002" } };
    const saved = buildBillReviewSaveInput({ ...draft, claimForm: "ncpdp", lineItems: [drug, second] });
    expect(saved.lineItems).toHaveLength(2);
    expect(saved.lineItems.map((line) => line.drug?.ndcNumber)).toEqual(["00000000001", "00000000002"]);
    expect(saved.lineItems.every((line) => line.formData?.pharmacy?.prescriptionNumber === "123456")).toBe(true);
  });
  it("sanitizes readonly snapshots while preserving new editable metadata", () => {
    const input = { ...buildBillReviewSaveInput({ ...draft, lineItems: [drug] }), billingSnapshot: { readonly: true }, totalCharge: 999 };
    const saved = sanitizeBillReviewSaveInput(input);
    expect(saved).not.toHaveProperty("billingSnapshot");
    expect(saved).not.toHaveProperty("totalCharge");
    expect(saved.formData).toEqual(draft.formData);
    expect(saved.lineItems[0]?.drug).toEqual(drug.drug);
    expect(saved.lineItems[0]?.formData).toEqual(drug.formData);
  });
  it.each([["ub04", "UB-04", revenue, "Revenue 0450"], ["ncpdp", "NCPDP", drug, "NDC 00000000001"], ["ada", "ADA", dental, "Tooth 2"]] as const)("shows the %s form and line identifiers", (claimForm, label, line, identifier) => {
    const data: HistoricalBillReviewData = { bill: { id: "bill_synthetic", billNumber: "SYNTHETIC", status: "draft", billingMode: "professional", claimForm, dos: "2026-09-01", lineItems: [line], attachments: [], totalCharge: line.charge, totalPaid: 0, balanceDue: line.charge }, patient: { name: "Synthetic Example" }, injury: {} };
    const html = renderToStaticMarkup(createElement(BillReadOnlyForm, { data }));
    expect(html).toContain(label);
    expect(html).toContain(identifier);
  });
});
