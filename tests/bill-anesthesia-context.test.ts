import { describe, expect, it } from "vitest";
import { anesthesiaCalculationContext, anesthesiaDetailsFromSaved, type AnesthesiaDetails } from "../packages/react/src/bill-anesthesia-context";
import { billSubmissionCalculationContext, billSubmissionFeeRequest, billSubmissionQuoteContext, type BillSubmissionInput } from "../packages/react/src/bill-submission-form";
const details: AnesthesiaDetails = { anesthesiaMinutes: "61", anesthesiaDocumentation: "verified" };
const bill: BillSubmissionInput = { patient: { firstName: "Synthetic", lastName: "Example", dateOfBirth: "1980-01-02", address: { line1: "1 Example Street", city: "Example", state: "CA", postalCode: "95814" } }, claim: { claimNumber: "SYNTHETIC" }, service: { date: "2026-07-01" }, serviceLocation: { placeOfServiceCode: "22", address: { line1: "1 Example Street", city: "Example", state: "CA", postalCode: "95814" } }, serviceLines: [{ code: "00100", units: 1, modifiers: ["AA"] }] };
describe("anesthesia service line context", () => {
  it("keeps actual minutes distinct from service quantity through quote and submission", () => {
    const context = anesthesiaCalculationContext("11", details);
    const request = billSubmissionFeeRequest(bill, bill.serviceLines[0]!, context);
    expect(request.units).toBe(1);
    expect(request.anesthesiaContext).toMatchObject({ actualMinutes: 61, placeOfService: "22", otherSameDayServices: false });
    expect(billSubmissionQuoteContext(request)).toEqual({ anesthesiaContext: request.anesthesiaContext });
    expect(anesthesiaDetailsFromSaved(billSubmissionQuoteContext(request))).toEqual(details);
  });
  it("does not reuse stale documentation when minutes, circumstances, setting or procedure change", () => {
    const saved = anesthesiaCalculationContext("11", details);
    for (const patch of [{ anesthesiaMinutes: "" }, { anesthesiaMinutes: "0" }, { anesthesiaMinutes: "15.5" }, { anesthesiaMinutes: "1441" }, { anesthesiaDocumentation: "review" as const }]) {
      expect(billSubmissionCalculationContext("00100", "11", { ...details, ...patch }, saved)).toEqual({});
    }
    expect(billSubmissionCalculationContext("00100", "12", details, saved)).toEqual({});
    expect(billSubmissionCalculationContext("00100", "11", { ...details, basis: "adjustment" }, saved)).toEqual({});
    expect(billSubmissionCalculationContext("99213", "11", {}, saved).anesthesiaContext).toBeUndefined();
  });
  it("requires review for overlapping, undated or multi-day services", () => {
    const context = anesthesiaCalculationContext("22", details);
    for (const other of [{ code: "99213", serviceDate: "2026-06-30", serviceDateEnd: "2026-07-02" }, { code: "99213", serviceDate: "" }]) {
      expect(billSubmissionFeeRequest({ ...bill, serviceLines: [...bill.serviceLines, other] }, bill.serviceLines[0]!, context).anesthesiaContext?.otherSameDayServices).toBe(true);
    }
    expect(billSubmissionFeeRequest(bill, { ...bill.serviceLines[0]!, serviceDateEnd: "2026-07-02" }, context).anesthesiaContext?.otherSameDayServices).toBe(true);
    expect(billSubmissionFeeRequest({ ...bill, serviceLines: [...bill.serviceLines, { code: "99213", serviceDate: "2026-07-03" }] }, bill.serviceLines[0]!, context).anesthesiaContext?.otherSameDayServices).toBe(false);
  });
});
