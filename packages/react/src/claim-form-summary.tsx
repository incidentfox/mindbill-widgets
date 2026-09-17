import type { ReactElement } from "react";
import type { BillReviewLineItem, ClaimForm } from "@mindbill/browser";

export const CLAIM_FORM_LABELS: Record<ClaimForm, string> = { cms1500: "CMS-1500", ub04: "UB-04", ada: "ADA", ncpdp: "NCPDP" };

/** Identifiers remain visible even when a revenue or drug line has no procedure code. */
export function ClaimLineSummary({ line }: { line: BillReviewLineItem }): ReactElement | null {
  const revenue = line.formData?.institutional?.revenueCode;
  const tooth = line.formData?.dental?.toothNumber;
  const surfaces = line.formData?.dental?.toothSurfaces;
  const prescription = line.formData?.pharmacy?.prescriptionNumber;
  const parts = [
    typeof revenue === "string" && revenue ? `Revenue ${revenue}` : "",
    line.drug ? `NDC ${line.drug.ndcNumber} · ${line.drug.metricQuantity} ${line.drug.unitOfMeasure}` : "",
    typeof tooth === "string" && tooth ? `Tooth ${tooth}` : "",
    Array.isArray(surfaces) ? surfaces.filter((value) => typeof value === "string").join(", ") : "",
    typeof prescription === "string" && prescription ? `Rx ${prescription}` : "",
  ].filter(Boolean);
  return parts.length ? <small className="mb-claim-line-summary" style={{ display: "block", overflowWrap: "anywhere", fontWeight: 400 }}>{parts.join(" · ")}</small> : null;
}
