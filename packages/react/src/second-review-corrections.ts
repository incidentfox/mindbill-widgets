import type { SecondReviewLineInput } from "@mindbill/browser";

export type CorrectionDraft = {
  correctBilling: boolean;
  units: string;
  modifiers: string;
  charge: string;
  chargeReviewed: boolean;
};

export function parseSecondReviewCorrection(draft: CorrectionDraft): SecondReviewLineInput["correction"] {
  if (!draft.correctBilling) return undefined;
  const units = Number(draft.units);
  const charge = Number(draft.charge);
  const modifiers = draft.modifiers.trim().toUpperCase().split(/[\s,]+/).filter(Boolean);
  if (!draft.units.trim() || !Number.isInteger(units) || units < 1 || units > 10_000) {
    throw new Error("Corrected units must be a whole number from 1 to 10,000.");
  }
  if (modifiers.length > 4 || new Set(modifiers).size !== modifiers.length || modifiers.some((value) => !/^[A-Z0-9]{2}$/.test(value))) {
    throw new Error("Enter up to four unique two-character modifiers, separated by commas. Leave blank to remove modifiers.");
  }
  if (!draft.charge.trim() || !Number.isFinite(charge) || charge < 0 || charge > 999_999.99 || Math.abs(charge * 100 - Math.round(charge * 100)) > 0.000001) {
    throw new Error("Enter the corrected charge in dollars and cents.");
  }
  if (!draft.chargeReviewed) throw new Error("Confirm that you reviewed the corrected charge. It is not recalculated automatically.");
  return { units, modifiers, charge };
}
