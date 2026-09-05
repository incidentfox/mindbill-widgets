import { describe, expect, it } from "vitest";
import { parseSecondReviewCorrection, type CorrectionDraft } from "../packages/react/src/second-review-corrections";

const draft = (): CorrectionDraft => ({ correctBilling: true, units: "3", modifiers: "93, 95", charge: "125.10", chargeReviewed: true });
describe("Second Review explicit billing corrections", () => {
  it("normal disputes omit corrections and enabled corrections preserve the reviewed charge", () => {
    expect(parseSecondReviewCorrection({ ...draft(), correctBilling: false })).toBeUndefined();
    expect(parseSecondReviewCorrection(draft())).toEqual({ units: 3, modifiers: ["93", "95"], charge: 125.1 });
    expect(parseSecondReviewCorrection({ ...draft(), modifiers: " " })?.modifiers).toEqual([]);
  });
  it("requires valid bounded units, distinct modifiers, cents, and explicit review", () => {
    for (const patch of [{ units: "" }, { units: "0" }, { units: "1.5" }, { units: "10001" }, { modifiers: "95,95" }, { modifiers: "X" }, { charge: "" }, { charge: "-1" }, { charge: "1.001" }, { charge: "Infinity" }, { chargeReviewed: false }]) {
      expect(() => parseSecondReviewCorrection({ ...draft(), ...patch })).toThrow();
    }
  });
});
