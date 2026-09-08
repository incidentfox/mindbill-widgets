import { describe, expect, it } from "vitest";
import type { BillFeeContext } from "@mindbill/browser";
import { isProfessionalComponentCandidate, professionalComponentCalculationContext } from "../packages/react/src/professional-component-context";
const context: BillFeeContext = {
  hasFeeAgreement: false,
  physicianContext: { providerKind: "physician", placeOfService: "11", standaloneService: true, globalPeriodApplies: false, hpsaBonusEligible: false },
  catalogContext: { codingRequirementsSatisfied: true },
  professionalComponentContext: { interpretationLocation: "same_as_patient_service" },
};
describe("professional component calculation context", () => {
  it("recognizes explicit professional components without treating TC or global fees as interpretations", () => {
    expect(isProfessionalComponentCandidate("71045", ["26"])).toBe(true);
    expect(isProfessionalComponentCandidate("93010")).toBe(true);
    expect(isProfessionalComponentCandidate("71045", ["TC"])).toBe(false);
    expect(isProfessionalComponentCandidate("71045")).toBe(false);
    expect(isProfessionalComponentCandidate("93010", ["TC"])).toBe(false);
  });
  it("retains the explicitly selected physical interpretation location", () => {
    const next = professionalComponentCalculationContext(context, { interpretationLocation: "same_as_patient_service", professionalComponentBasis: "standard" }, true);
    expect(next).toEqual(context);
    const remote = professionalComponentCalculationContext(context, { interpretationLocation: "different_from_patient_service", professionalComponentBasis: "standard" }, true);
    expect(remote.professionalComponentContext?.interpretationLocation).toBe("different_from_patient_service");
  });
  it("clearing either confirmation removes stale pricing facts", () => {
    const empty = professionalComponentCalculationContext(context, {}, true);
    expect(empty.physicianContext).toBeUndefined();
    expect(empty.catalogContext).toBeUndefined();
    expect(empty.professionalComponentContext).toBeUndefined();
    const clearedLocation = professionalComponentCalculationContext(context, { professionalComponentBasis: "standard", interpretationLocation: "" }, true);
    expect(clearedLocation.professionalComponentContext).toBeUndefined();
    const review = professionalComponentCalculationContext(context, { interpretationLocation: "same_as_patient_service", professionalComponentBasis: "review" }, true);
    expect(review.physicianContext).toBeUndefined();
  });
  it("removes professional interpretation facts when code or modifier no longer qualifies", () => {
    const next = professionalComponentCalculationContext(context, { interpretationLocation: "same_as_patient_service", professionalComponentBasis: "standard" }, false);
    expect(next.professionalComponentContext).toBeUndefined();
  });
});
