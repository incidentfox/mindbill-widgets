import { describe, expect, it } from "vitest";
import { equipmentCalculationContext, equipmentFields } from "../packages/react/src/bill-equipment-context";
import { billSubmissionCalculationContext, billSubmissionFeeRequest, billSubmissionQuoteContext, type BillSubmissionInput } from "../packages/react/src/bill-submission-form";

describe("California equipment context", () => {
  it("matches catalog membership and rental payment category, not code prefixes", () => {
    expect(equipmentFields("E0601", ["KJ", "RR"])).toEqual({ residence: true, rental: true, priorPayments: false });
    expect(equipmentFields("E0100", ["RR"])).toEqual({ residence: true, rental: true, priorPayments: true });
    expect(equipmentFields("E0100", ["NU"])).toEqual({ residence: true, rental: false, priorPayments: true });
    expect(equipmentFields("B4034")).toEqual({ residence: true, rental: false, priorPayments: false });
    expect(equipmentFields("E9999")).toEqual({ residence: false, rental: false, priorPayments: false });
    expect(equipmentFields("99213").residence).toBe(false);
  });
  it("keeps missing rental history missing and requires an explicit zero", () => {
    expect(equipmentCalculationContext("E0100", ["RR"], { residenceZip: "90704", rentalMonth: "1", priorPayments: "" })).toEqual({ dmeposContext: { residenceZip: "90704", rentalMonth: 1 } });
    expect(equipmentCalculationContext("E0100", ["RR"], { residenceZip: "90704", rentalMonth: "1", priorPayments: "0" })).toEqual({ dmeposContext: { residenceZip: "90704", rentalMonth: 1, priorPaymentsCents: 0 } });
    expect(equipmentCalculationContext("E0100", ["NU"], { residenceZip: "90704", rentalMonth: "4", priorPayments: "30.15" })).toEqual({ dmeposContext: { residenceZip: "90704", priorPaymentsCents: 3015 } });
  });
  it("clears saved context and excludes fields that no longer apply", () => {
    const saved = { dmeposContext: { residenceZip: "90704", rentalMonth: 4, priorPaymentsCents: 3000 } };
    expect(billSubmissionCalculationContext("E0100", "11", { residenceZip: "" }, saved, ["RR"])).toEqual({});
    expect(billSubmissionCalculationContext("B4034", "11", { residenceZip: "95814", rentalMonth: "4", priorPayments: "30" }, saved)).toEqual({ dmeposContext: { residenceZip: "95814" } });
    expect(billSubmissionCalculationContext("99213", "11", {}, saved).dmeposContext).toBeUndefined();
  });
  it("keeps residence separate from service ZIP and preserves context for submission", () => {
    const bill: BillSubmissionInput = { patient: { firstName: "Synthetic", lastName: "Example", dateOfBirth: "1980-01-02", address: { line1: "1 Example Street", city: "Example", state: "CA", postalCode: "95814" } }, claim: { claimNumber: "SYNTHETIC" }, service: { date: "2026-07-01" }, serviceLocation: { address: { line1: "1 Example Street", city: "Example", state: "CA", postalCode: "95814" } }, serviceLines: [{ code: "E0601", modifiers: ["RR", "KJ"], units: 1 }] };
    const missing = billSubmissionFeeRequest(bill, bill.serviceLines[0]!, equipmentCalculationContext("E0601", ["RR", "KJ"], {}));
    expect(missing.serviceZip).toBe("95814");
    expect(missing.dmeposContext).toBeUndefined();
    const context = equipmentCalculationContext("E0601", ["RR", "KJ"], { residenceZip: "90704", rentalMonth: "4" });
    expect(billSubmissionQuoteContext(billSubmissionFeeRequest(bill, bill.serviceLines[0]!, context))).toEqual(context);
  });
});
