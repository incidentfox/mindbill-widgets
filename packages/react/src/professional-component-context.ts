import type { BillFeeContext, BillFeeQuote } from "@mindbill/browser";

export type ProfessionalComponentDetails = {
  interpretationLocation?: "same_as_patient_service" | "different_from_patient_service" | "" | undefined;
  professionalComponentBasis?: "standard" | "review" | "" | undefined;
};

/** UI discovery only; the server checks the adopted code and component indicators. */
export function isProfessionalComponentCandidate(code: string, modifiers: readonly string[] = [], quote?: BillFeeQuote): boolean {
  const normalized = modifiers.map((value) => value.replace(/^-/, ""));
  return (normalized.length === 1 && normalized[0] === "26") ||
    (code.trim() === "93010" && normalized.length === 0) ||
    Boolean(quote && "provenance" in quote && quote.provenance?.some((source) => source.id === "ca-professional-component"));
}

/** Always rebuild confirmations so clearing an input cannot retain a saved priced context. */
export function professionalComponentCalculationContext(context: BillFeeContext, details: ProfessionalComponentDetails, eligible: boolean): BillFeeContext {
  const next = { ...context };
  delete next.professionalComponentContext;
  if (context.professionalComponentContext) delete next.catalogContext;
  if (!eligible) return next;
  delete next.catalogContext;
  if (details.interpretationLocation) next.professionalComponentContext = { interpretationLocation: details.interpretationLocation };
  if (details.professionalComponentBasis === "standard") {
    next.catalogContext = { codingRequirementsSatisfied: true };
  } else {
    // Explicitly selecting the documented standard circumstances is required for pricing.
    delete next.physicianContext;
  }
  return next;
}
