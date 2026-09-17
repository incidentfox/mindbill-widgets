import { expect, it } from "vitest";
import { billSubmissionModifierOptions } from "../packages/react/src/billing-catalog";
import { feeReviewMessage } from "../packages/react/src/fee-review-message";

it("offers treatment modifiers with their treatment meanings and preserves med-legal meanings", () => {
  const treatment = billSubmissionModifierOptions(false, "2026-09-17", undefined);
  for (const code of ["25", "GP", "GO", "GN", "CQ", "CO"]) expect(treatment.some((item) => item.code === code)).toBe(true);
  expect(treatment.find((item) => item.code === "93")?.description).toContain("Audio-only");
  expect(treatment.find((item) => item.code === "95")?.description).toContain("audio/video");
  expect(treatment.some((item) => item.code === "94")).toBe(false);
  const medicalLegal = billSubmissionModifierOptions(true, "2026-09-17", undefined);
  expect(medicalLegal.find((item) => item.code === "93")?.description).toBe("Interpreter required");
  expect(medicalLegal.find((item) => item.code === "95")?.description).toBe("Qualified Medical Evaluator");
  expect(medicalLegal.some((item) => item.code === "94")).toBe(true);
});

it("distinguishes the historical telehealth 95 meaning and retains supplied overrides", () => {
  const old = billSubmissionModifierOptions(false, "2025-01-31", undefined);
  expect(old.find((item) => item.code === "95")?.description).toContain("audio-only or audio/video");
  const modern = billSubmissionModifierOptions(false, "2025-02-01", undefined);
  expect(modern.find((item) => item.code === "95")?.description).toBe("Real-time audio/video telehealth");
  expect(billSubmissionModifierOptions(false, undefined, undefined).find((item) => item.code === "95")?.description).toContain("depends on the service date");
  const custom = billSubmissionModifierOptions(false, "2026-09-17", [{ code: "95", description: "Practice description" }]);
  expect(custom.filter((item) => item.code === "95")).toEqual([{ code: "95", description: "Practice description" }]);
});

it("explains review reasons without changing readiness or displaying unknown machine codes", () => {
  expect(feeReviewMessage("therapy_no_fee_agreement_confirmation_required")).toContain("fee agreement");
  expect(feeReviewMessage("future_long_machine_reason")).toBe("This service needs fee review before an estimate is available.");
  expect(feeReviewMessage("Fee lookup is unavailable. Retry the fee check.")).toBe("Fee lookup is unavailable. Retry the fee check.");
  expect(feeReviewMessage(undefined)).toBe("Checking the fee schedule…");
});
