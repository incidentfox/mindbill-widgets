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

it("offers the professional modifier directory on treatment lines only", () => {
  const treatment = billSubmissionModifierOptions(false, "2026-10-14", undefined);
  const codes = treatment.map((item) => item.code);
  for (const code of ["22", "24", "25", "26", "27", "50", "51", "52", "53", "57", "58", "59", "62", "76", "77", "78", "79", "80", "81", "82", "91", "95", "96", "97", "AS", "AT", "CR", "CS",
    "E1", "E2", "E3", "E4", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "FA", "GA", "GC", "GN", "GO", "GP", "GT", "GX", "GY", "GZ", "JW", "JZ", "JA", "JB", "KX", "LT", "RT",
    "LC", "LD", "LM", "RC", "RI", "NU", "RR", "UE", "KJ", "KH", "KI", "TC", "QW", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "TA", "XE", "XP", "XS", "XU", "Q5", "Q6", "93",
    "SA", "SB", "SH", "UN", "UP", "UQ", "UR", "US", "99"]) expect(codes, code).toContain(code);
  expect(new Set(codes).size).toBe(codes.length);
  expect(treatment.find((item) => item.code === "96")?.description).toBe("Habilitative services");
  expect(treatment.find((item) => item.code === "JZ")?.description).toContain("Zero drug amount");
  const medicalLegal = billSubmissionModifierOptions(true, "2026-10-14", undefined);
  expect(medicalLegal.some((item) => item.code === "LT")).toBe(false);
  expect(medicalLegal.find((item) => item.code === "96")?.description).toBe("Psychiatric/psychological evaluation");
});
