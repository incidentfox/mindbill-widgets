import type { BillFeeContext } from "@mindbill/browser";
import catalog from "./ca-equipment-catalog.json";

// Public CMS 2026 DMEPOS/PEN code and payment-category metadata only; see docs/california-equipment.md.
const rows = Object.entries(catalog).flatMap(([category, entries]) => entries.map((entry) => ({ category, entry })));
const codes = new Set(rows.map(({ entry }) => entry.split(":")[0]));

export type EquipmentDetails = {
  residenceZip?: string | undefined;
  rentalMonth?: string | undefined;
  priorPayments?: string | undefined;
};

export function equipmentFields(code: string, modifiers: readonly string[] = []) {
  const normalized = code.trim().toUpperCase();
  const mods = modifiers.map((modifier) => modifier.trim().toUpperCase());
  const key = `${normalized}:${mods.filter((modifier) => !["KH", "KI", "KJ"].includes(modifier)).sort().join(",")}`;
  const categories = rows.filter(({ entry }) => entry === key).map(({ category }) => category);
  const category = categories.length === 1 ? categories[0] : undefined;
  return {
    residence: codes.has(normalized),
    rental: mods.includes("RR") && Boolean(category && ["CR", "IN", "FS"].includes(category)),
    priorPayments: category === "IN",
  };
}

/** Missing values remain missing; clearing a field never reuses a saved calculation. */
export function equipmentCalculationContext(code: string, modifiers: readonly string[], details: EquipmentDetails): BillFeeContext {
  const fields = equipmentFields(code, modifiers);
  const residenceZip = details.residenceZip?.trim();
  if (!fields.residence || !residenceZip) return {};
  const month = details.rentalMonth?.trim();
  const prior = details.priorPayments?.trim();
  return { dmeposContext: {
    residenceZip,
    ...(fields.rental && month && /^\d+$/.test(month) ? { rentalMonth: Number(month) } : {}),
    ...(fields.priorPayments && prior && /^\d+(?:\.\d{1,2})?$/.test(prior) ? { priorPaymentsCents: Math.round(Number(prior) * 100) } : {}),
  } };
}
