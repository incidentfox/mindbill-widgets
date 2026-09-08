import type { BillFeeContext } from "@mindbill/browser";

export type AnesthesiaDetails = {
  anesthesiaMinutes?: string | undefined;
  anesthesiaDocumentation?: "verified" | "review" | "" | undefined;
};

/** Candidates disclose inputs; the server validates membership in the adopted code set. */
export const isAnesthesiaCandidate = (code: string): boolean => /^0[01]\d{3}$/.test(code.trim().toUpperCase());

export function anesthesiaDetailsFromSaved(context?: BillFeeContext): AnesthesiaDetails {
  const saved = context?.anesthesiaContext;
  if (!saved) return {};
  return { anesthesiaMinutes: String(saved.actualMinutes), anesthesiaDocumentation:
    saved.providerKind === "physician" && saved.personallyPerformedAlone === true &&
    saved.completeSameDayServices === true && saved.otherSameDayServices === false &&
    saved.codingRequirementsSatisfied === true ? "verified" : "review" };
}

/** Clearing documentation or minutes removes a previously verified calculation context. */
export function anesthesiaCalculationContext(placeOfService: string, details: AnesthesiaDetails): BillFeeContext {
  if (details.anesthesiaDocumentation !== "verified" || !/^\d{1,4}$/.test(details.anesthesiaMinutes ?? "") ||
    Number(details.anesthesiaMinutes) < 1 || Number(details.anesthesiaMinutes) > 1440 ||
    !["11", "19", "21", "22", "23", "24"].includes(placeOfService)) return {};
  return { anesthesiaContext: { providerKind: "physician", personallyPerformedAlone: true,
    actualMinutes: Number(details.anesthesiaMinutes), placeOfService, completeSameDayServices: true,
    otherSameDayServices: false, codingRequirementsSatisfied: true } };
}

export function AnesthesiaLineFields({ index, details, update }: {
  index: number; details: AnesthesiaDetails; update: (patch: Partial<AnesthesiaDetails>) => void;
}) {
  return <details open><summary>Anesthesia details</summary><div className="mbsf-grid">
    <label className="mbsf-field"><span>Actual anesthesia minutes</span><input className="mbsf-input" aria-label={`Actual anesthesia minutes for line ${index + 1}`} type="number" inputMode="numeric" min={1} max={1440} step={1} value={details.anesthesiaMinutes ?? ""} onChange={(event) => update({ anesthesiaMinutes: event.target.value })} /></label>
    <label className="mbsf-field"><span>Documented anesthesia circumstances</span><select className="mbsf-input" aria-label={`Documented anesthesia circumstances for line ${index + 1}`} value={details.anesthesiaDocumentation ?? ""} onChange={(event) => update({ anesthesiaDocumentation: event.target.value as AnesthesiaDetails["anesthesiaDocumentation"] })}><option value="">Select from the service documentation…</option><option value="verified">Physician alone for the entire service (AA)</option><option value="review">Other circumstances — review needed</option></select></label>
    <p className="mbsf-help mbsf-span">Enter elapsed minutes and use AA with 1 service. Confirm the physician performed the entire case alone, coding and timing requirements are met, and all same-day services are included. Additional services, directed care, obstetric or burn anesthesia need review. Claims report minutes; pricing converts them to time units.</p>
  </div></details>;
}
