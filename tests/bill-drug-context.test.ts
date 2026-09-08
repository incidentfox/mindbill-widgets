import { describe, expect, it } from "vitest";
import { drugDetailsFromSaved, drugRequestDetails, type DrugDetails } from "../packages/react/src/bill-drug-context";
import { billSubmissionCalculationContext, billSubmissionFeeRequest, billSubmissionQuoteContext, type BillSubmissionInput } from "../packages/react/src/bill-submission-form";
const details: DrugDetails = { ndcNumber: "00000000001", drugName: "Synthetic drug", administeredAmount: "10", doseUnit: "mg", amountPerHcpcsUnit: "1", amountPerNdcUnit: "4", metricQuantity: "2.5", drugQuantityUnit: "ML", hcpcsUnitSource: "https://example.org/hcpcs", productLabelSource: "https://example.org/label", drugDocumentation: "verified" };
describe("administered drug line details", () => {
  it("keeps procedure units, administered dose and NDC quantity distinct through quote and submission context", () => {
    const input = drugRequestDetails("J1100", "11", details);
    const bill: BillSubmissionInput = { patient: { firstName: "Synthetic", lastName: "Example", dateOfBirth: "1980-01-02", address: { line1: "1 Example Street", city: "Example", state: "CA", postalCode: "95814" } }, claim: { claimNumber: "SYNTHETIC" }, service: { date: "2026-07-01" }, serviceLines: [{ code: "J1100", units: 10, drug: input.drug! }] };
    const quote = billSubmissionFeeRequest(bill, bill.serviceLines[0]!, { padbContext: input.padbContext! });
    expect(quote.units).toBe(10);
    expect(quote.drug?.metricQuantity).toBe("2.5");
    expect(quote.drug?.administered?.administeredAmount).toBe("10");
    expect(quote.padbContext?.sameDayServices).toEqual([{ code: "J1100", units: 10 }]);
    expect(billSubmissionQuoteContext(quote)).toEqual({ padbContext: quote.padbContext });
    expect(drugRequestDetails("J1100", "11", drugDetailsFromSaved(input.drug, billSubmissionQuoteContext(quote)))).toEqual(input);
  });
  it("includes overlapping or undated lines in bundling evidence", () => {
    const input = drugRequestDetails("J1100", "11", details);
    const bill: BillSubmissionInput = { patient: { firstName: "Synthetic", lastName: "Example", dateOfBirth: "1980-01-02", address: { line1: "1 Example Street", city: "Example", state: "CA", postalCode: "95814" } }, claim: { claimNumber: "SYNTHETIC" }, service: { date: "2026-07-01" }, serviceLines: [{ code: "J1100", units: 10 }, { code: "99213", serviceDate: "2026-06-30", serviceDateEnd: "2026-07-02" }, { code: "96372", serviceDate: "" }, { code: "99214", serviceDate: "2026-07-03" }] };
    expect(billSubmissionFeeRequest(bill, bill.serviceLines[0]!, { padbContext: input.padbContext! }).padbContext?.sameDayServices.map((line) => line.code)).toEqual(["J1100", "99213", "96372"]);
  });
  it("clears previous drug context when evidence, setting or service type changes", () => {
    const saved = { padbContext: drugRequestDetails("J1100", "11", details).padbContext! };
    for (const patch of [{ ndcNumber: "" }, { productLabelSource: "" }, { hcpcsUnitSource: "javascript:alert(1)" }, { drugDocumentation: "review" as const }, { amountPerNdcUnit: "0" }, { drugEnabled: false }]) {
      expect(drugRequestDetails("J1100", "11", { ...details, ...patch })).toEqual({});
      expect(billSubmissionCalculationContext("J1100", "11", { ...details, ...patch }, saved).padbContext).toBeUndefined();
    }
    expect(billSubmissionCalculationContext("J1100", "22", details, saved).padbContext).toBeUndefined();
    expect(billSubmissionCalculationContext("99213", "11", {}, saved).padbContext).toBeUndefined();
    expect(billSubmissionCalculationContext("J1100", "11", { ...details, basis: "adjustment" }, saved)).toEqual({});
  });
});
