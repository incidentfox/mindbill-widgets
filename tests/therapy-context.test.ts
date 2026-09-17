import { describe, expect, expectTypeOf, it } from "vitest";
import type { BillFeeContext, CaTherapyContext } from "../packages/browser/src/index";
import type { CaTherapyContext as NodeTherapy, ServiceLine as NodeLine } from "../packages/node/src/index";
import { missingTherapyDetails, therapyCalculationContext, therapyDetailsFromSaved } from "../packages/react/src/therapy-line-fields";
import { billSubmissionCalculationContext, billSubmissionFeeRequest } from "../packages/react/src/bill-submission-form";
import type { BillSubmissionInput } from "../packages/react/src/bill-submission-form";

const facts: CaTherapyContext = { providerKind: "physical_therapist", personallyPerformed: true, hospitalPatient: false, incidentToPhysicianService: false, assistantInvolved: false, placeOfService: "11", directOneOnOneMinutes: 60, totalVisitMinutes: 60, visitsOnDate: 1, completeSameDayServices: true, otherSameDayServices: false, globalPeriodApplies: false, hpsaBonusEligible: false };
const saved: BillFeeContext = { hasFeeAgreement: false, therapyContext: facts };
const details = { ...therapyDetailsFromSaved(saved), providerKind: facts.providerKind, minutes: 60, totalMinutes: 60 };

describe("documented therapy context", () => {
  it("keeps browser and Node service-line contracts equivalent", () => {
    expectTypeOf<NodeTherapy>().toEqualTypeOf<CaTherapyContext>();
    expectTypeOf<NonNullable<NonNullable<NodeLine["feeContext"]>["therapyContext"]>>().toEqualTypeOf<CaTherapyContext>();
  });
  it("requires pricing and service facts rather than inferring them from minutes", () => {
    expect(therapyCalculationContext("11", { providerKind: "physical_therapist", minutes: 60, totalMinutes: 60 })).toEqual({});
    expect(missingTherapyDetails(details)).toEqual([]);
    expect(therapyCalculationContext("11", details)).toEqual(saved);
  });
  it.each(["personallyPerformed", "assistantInvolved", "hospitalPatient", "incidentToPhysicianService", "globalPeriodApplies", "hpsaBonusEligible", "visitsOnDate"] as const)("clearing %s cannot reuse a saved priced context", key => {
    expect(billSubmissionCalculationContext("97110", "11", { ...details, therapy: { ...facts, [key]: undefined } }, saved)).toEqual({});
  });
  it.each([{ therapyPricingBasis: "" as const }, { providerKind: "" }, { minutes: undefined }, { totalMinutes: 0 }, { minutes: 15.5 }])("keeps a partial draft unpriced: %j", patch => {
    expect(therapyCalculationContext("11", { ...details, ...patch }, saved)).toEqual({});
  });
  it("preserves documented unsupported circumstances for review rather than changing them", () => {
    const supplied = { hasFeeAgreement: true, therapyContext: { ...facts, assistantInvolved: true, completeSameDayServices: false, otherSameDayServices: true, visitsOnDate: 2, globalPeriodApplies: true } };
    const hydrated = { ...details, ...therapyDetailsFromSaved(supplied) };
    expect(therapyCalculationContext("11", hydrated, supplied)).toEqual(supplied);
    expect(supplied.therapyContext).not.toBe(hydrated.therapy);
  });
  it("uses edited pricing, location and minutes without reviving stale supplied facts", () => {
    const edited = therapyCalculationContext("22", { ...details, therapyPricingBasis: "agreement", minutes: 45, totalMinutes: 50 }, saved);
    expect(edited).toMatchObject({ hasFeeAgreement: true, therapyContext: { placeOfService: "22", directOneOnOneMinutes: 45, totalVisitMinutes: 50 } });
    expect(saved.therapyContext).toEqual(facts);
    expect(billSubmissionCalculationContext(" 97110 ", "11", details)).toEqual(saved);
  });
  it("includes overlapping and unknown-date service rows in the same-day review", () => {
    const bill = { billingMode: "professional", patient: { firstName: "Synthetic", lastName: "Example" }, claim: {}, service: { date: "2026-09-17" }, serviceLocation: { placeOfServiceCode: "11" }, serviceLines: [{ code: "97110", units: 4 }] } as BillSubmissionInput;
    for (const other of [{ code: "97140", serviceDate: "2026-09-16", serviceDateEnd: "2026-09-18" }, { code: "97140", serviceDate: "invalid" }]) {
      const request = billSubmissionFeeRequest({ ...bill, serviceLines: [...bill.serviceLines, other] }, bill.serviceLines[0]!, saved);
      expect(request.therapyContext?.otherSameDayServices).toBe(true);
    }
    const ranged = { ...bill.serviceLines[0]!, serviceDateEnd: "2026-09-18" };
    expect(billSubmissionFeeRequest({ ...bill, serviceLines: [ranged] }, ranged, saved).therapyContext?.otherSameDayServices).toBe(true);
    expect(billSubmissionFeeRequest(bill, bill.serviceLines[0]!, saved).therapyContext?.otherSameDayServices).toBe(false);
  });
});
