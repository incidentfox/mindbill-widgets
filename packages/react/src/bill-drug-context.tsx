import type { BilledDrug, BillFeeContext } from "@mindbill/browser";
import { Select } from "./form-controls";

export type DrugDetails = {
  drugEnabled?: boolean | undefined;
  ndcNumber?: string | undefined;
  drugName?: string | undefined;
  administeredAmount?: string | undefined;
  doseUnit?: NonNullable<BilledDrug["administered"]>["doseUnit"] | "" | undefined;
  amountPerHcpcsUnit?: string | undefined;
  amountPerNdcUnit?: string | undefined;
  metricQuantity?: string | undefined;
  drugQuantityUnit?: BilledDrug["unitOfMeasure"] | "" | undefined;
  hcpcsUnitSource?: string | undefined;
  productLabelSource?: string | undefined;
  drugDocumentation?: "verified" | "review" | "" | undefined;
};

export function drugDetailsFromSaved(drug?: BilledDrug, context?: BillFeeContext): DrugDetails {
  if (!drug) return {};
  const claim = { drugEnabled: true, ndcNumber: drug.ndcNumber, metricQuantity: drug.metricQuantity, drugQuantityUnit: drug.unitOfMeasure };
  if (!drug.administered) return claim;
  return { ...claim, ...drug.administered, drugDocumentation: context?.padbContext ? "verified" : "" };
}
/** "70069-0021-25" or "70069002125" → "70069002125". Other formats are left for the user to correct. */
export function normalizedNdc(value: string | undefined): string {
  const digits = (value ?? "").replace(/[\s-]/g, "");
  return /^\d{11}$/.test(digits) ? digits : (value ?? "").trim();
}
export function drugFieldsEnabled(code: string, details: DrugDetails): boolean {
  return details.drugEnabled ?? /^J\d{4}$/.test(code.trim().toUpperCase());
}
const positive = (value: string | undefined, decimals: number) => Boolean(value && new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(value) && Number(value) > 0);
const sourceUrl = (value: string | undefined) => { try { return Boolean(value && value.length <= 500 && ["https:", "http:"].includes(new URL(value).protocol)); } catch { return false; } };

/** The NDC claim facts (Box 24 shaded N4 row / 837 LIN-CTP): NDC, unit and quantity. */
export function drugClaimFacts(code: string, details: DrugDetails): BilledDrug | undefined {
  const ndcNumber = normalizedNdc(details.ndcNumber);
  if (!drugFieldsEnabled(code, details) || !/^\d{11}$/.test(ndcNumber) || !positive(details.metricQuantity, 3) || !details.drugQuantityUnit) return undefined;
  return { ndcNumber, metricQuantity: details.metricQuantity!, unitOfMeasure: details.drugQuantityUnit };
}
/** The first NDC claim fact still missing on a drug line that has started one; null when complete or unused. */
export function drugClaimFactsProblem(code: string, details: DrugDetails): { field: "ndcNumber" | "metricQuantity" | "drugQuantityUnit"; message: string } | null {
  if (!drugFieldsEnabled(code, details)) return null;
  if (!details.ndcNumber?.trim() && !details.metricQuantity?.trim() && !details.drugQuantityUnit) return null;
  if (!/^\d{11}$/.test(normalizedNdc(details.ndcNumber))) return { field: "ndcNumber", message: "Enter the 11-digit NDC (5-4-2 format, including leading zeros)." };
  if (!positive(details.metricQuantity, 3)) return { field: "metricQuantity", message: "Enter the NDC quantity given (up to 3 decimals)." };
  if (!details.drugQuantityUnit) return { field: "drugQuantityUnit", message: "Select the NDC quantity unit." };
  return null;
}

/**
 * The NDC claim facts are sent whenever they are complete, so the NDC always reaches the claim.
 * The OMFS drug fee check additionally needs the documented dose evidence; incomplete edits never
 * reuse previously verified identifiers or dosing evidence.
 */
export function drugRequestDetails(code: string, placeOfService: string, details: DrugDetails): { drug?: BilledDrug; padbContext?: NonNullable<BillFeeContext["padbContext"]> } {
  const claim = drugClaimFacts(code, details);
  if (!claim) return {};
  if (details.drugDocumentation !== "verified" || placeOfService !== "11" ||
    !details.drugName || !/^[A-Za-z0-9 .(),/%+-]{1,80}$/.test(details.drugName) ||
    !positive(details.administeredAmount, 6) || !positive(details.amountPerHcpcsUnit, 6) || !positive(details.amountPerNdcUnit, 6) ||
    Number(details.metricQuantity) > 10000 || !details.doseUnit ||
    !sourceUrl(details.hcpcsUnitSource) || !sourceUrl(details.productLabelSource)) return { drug: claim };
  return {
    drug: { ...claim,
      administered: { drugName: details.drugName.trim(), administeredAmount: details.administeredAmount!, doseUnit: details.doseUnit,
        hcpcsCode: code.trim().toUpperCase(), amountPerHcpcsUnit: details.amountPerHcpcsUnit!, amountPerNdcUnit: details.amountPerNdcUnit!,
        hcpcsUnitSource: details.hcpcsUnitSource!, productLabelSource: details.productLabelSource!, unitDefinitionsVerified: true } },
    padbContext: { providerKind: "physician", placeOfService: "11", productKind: "injectable", bundledOrPackaged: false,
      codingRequirementsSatisfied: true, completeSameDayServices: true, sameDayServices: [] },
  };
}

export function DrugLineFields({ code, index, details, update }: { code: string; index: number; details: DrugDetails; update: (patch: Partial<DrugDetails>) => void }) {
  const enabled = drugFieldsEnabled(code, details);
  const problem = drugClaimFactsProblem(code, details);
  const field = (key: keyof DrugDetails, label: string, mode: "text" | "decimal" = "text", invalid = false) => <label className="mbsf-field" data-invalid={invalid || undefined}><span>{label}</span><input className="mbsf-input" aria-label={`${label} for line ${index + 1}`} aria-invalid={invalid || undefined} inputMode={mode} value={String(details[key] ?? "")} onChange={(event) => update({ [key]: event.target.value })} /></label>;
  return <details open={enabled}><summary>Injectable drug details</summary>
    <label className="mbsf-field"><span>Service type</span><Select aria-label={`Drug service type for line ${index + 1}`} value={enabled ? "injectable" : "other"} onChange={(choice) => update({ drugEnabled: choice === "injectable", drugDocumentation: "" })}><option value="other">Other procedure</option><option value="injectable">Physician-administered injectable drug</option></Select></label>
    {enabled ? <>
      <div className="mbsf-grid" aria-label={`NDC for line ${index + 1}`}>
        {field("ndcNumber", "11-digit NDC", "text", problem?.field === "ndcNumber")}
        {field("metricQuantity", "NDC quantity", "decimal", problem?.field === "metricQuantity")}
        <label className="mbsf-field" data-invalid={problem?.field === "drugQuantityUnit" || undefined}><span>NDC quantity unit</span><Select aria-label={`NDC quantity unit for line ${index + 1}`} value={details.drugQuantityUnit ?? ""} onChange={(choice) => update({ drugQuantityUnit: choice as DrugDetails["drugQuantityUnit"] })}><option value="">Select unit…</option><option value="ML">mL</option><option value="UN">Units</option><option value="GR">Grams</option></Select></label>
        <p className="mbsf-help mbsf-span" role={problem ? "alert" : undefined}>{problem?.message ?? "Printed on the claim as N4 + NDC + unit + quantity (CMS-1500 Box 24 shaded row and Box 19; 837 LIN/CTP). The NDC quantity is the amount of product given, separate from the procedure units."}</p>
      </div>
      <details><summary>Dose evidence for the OMFS drug fee check (optional)</summary>
        <div className="mbsf-grid" aria-label={`Drug details for line ${index + 1}`}>
          {field("drugName", "Drug name")}
          {field("administeredAmount", "Administered dose", "decimal")}
          <label className="mbsf-field"><span>Dose unit</span><Select aria-label={`Dose unit for line ${index + 1}`} value={details.doseUnit ?? ""} onChange={(choice) => update({ doseUnit: choice as DrugDetails["doseUnit"] })}><option value="">Select unit…</option>{["mg", "mcg", "g", "mL", "units"].map((unit) => <option key={unit}>{unit}</option>)}</Select></label>
          {field("amountPerHcpcsUnit", "Dose per procedure billing unit", "decimal")}
          {field("amountPerNdcUnit", "Dose per NDC quantity unit", "decimal")}
          {field("hcpcsUnitSource", "Procedure unit reference URL")}{field("productLabelSource", "Product label URL")}
          <label className="mbsf-field mbsf-span"><span>Documented drug circumstances</span><Select aria-label={`Documented drug circumstances for line ${index + 1}`} value={details.drugDocumentation ?? ""} onChange={(choice) => update({ drugDocumentation: choice as DrugDetails["drugDocumentation"] })}><option value="">Select from the documentation…</option><option value="verified">Verified units and separately payable office injection</option><option value="review">Other circumstances — review needed</option></Select></label>
          <p className="mbsf-help mbsf-span">Without this evidence the line is billed at your charge with its NDC. To calculate the OMFS maximum, confirm the procedure billing unit and product concentration from the references. Both dose-per-unit values use the selected dose unit. Include every same-day service. The product must be a documented physician-administered office injection, separately payable rather than bundled or packaged. Administration is a separate procedure line.</p>
        </div>
      </details>
    </> : null}
  </details>;
}
