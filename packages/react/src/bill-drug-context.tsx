import type { BilledDrug, BillFeeContext } from "@mindbill/browser";

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
  if (!drug?.administered) return {};
  return { drugEnabled: true, ...drug.administered, ndcNumber: drug.ndcNumber, metricQuantity: drug.metricQuantity,
    drugQuantityUnit: drug.unitOfMeasure, drugDocumentation: context?.padbContext ? "verified" : "" };
}
export function drugFieldsEnabled(code: string, details: DrugDetails): boolean {
  return details.drugEnabled ?? /^J\d{4}$/.test(code.trim().toUpperCase());
}
const positive = (value: string | undefined, decimals: number) => Boolean(value && new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(value) && Number(value) > 0);
const sourceUrl = (value: string | undefined) => { try { return Boolean(value && value.length <= 500 && ["https:", "http:"].includes(new URL(value).protocol)); } catch { return false; } };

/** Incomplete edits never reuse previously verified identifiers or dosing evidence. */
export function drugRequestDetails(code: string, placeOfService: string, details: DrugDetails): { drug?: BilledDrug; padbContext?: NonNullable<BillFeeContext["padbContext"]> } {
  if (!drugFieldsEnabled(code, details) || details.drugDocumentation !== "verified" || placeOfService !== "11" ||
    !/^\d{11}$/.test(details.ndcNumber ?? "") || !details.drugName || !/^[A-Za-z0-9 .(),/%+-]{1,80}$/.test(details.drugName) ||
    !positive(details.administeredAmount, 6) || !positive(details.amountPerHcpcsUnit, 6) || !positive(details.amountPerNdcUnit, 6) ||
    !positive(details.metricQuantity, 3) || Number(details.metricQuantity) > 10000 || !details.doseUnit || !details.drugQuantityUnit ||
    !sourceUrl(details.hcpcsUnitSource) || !sourceUrl(details.productLabelSource)) return {};
  return {
    drug: { ndcNumber: details.ndcNumber!, metricQuantity: details.metricQuantity!, unitOfMeasure: details.drugQuantityUnit,
      administered: { drugName: details.drugName.trim(), administeredAmount: details.administeredAmount!, doseUnit: details.doseUnit,
        hcpcsCode: code.trim().toUpperCase(), amountPerHcpcsUnit: details.amountPerHcpcsUnit!, amountPerNdcUnit: details.amountPerNdcUnit!,
        hcpcsUnitSource: details.hcpcsUnitSource!, productLabelSource: details.productLabelSource!, unitDefinitionsVerified: true } },
    padbContext: { providerKind: "physician", placeOfService: "11", productKind: "injectable", bundledOrPackaged: false,
      codingRequirementsSatisfied: true, completeSameDayServices: true, sameDayServices: [] },
  };
}

export function DrugLineFields({ code, index, details, update }: { code: string; index: number; details: DrugDetails; update: (patch: Partial<DrugDetails>) => void }) {
  const enabled = drugFieldsEnabled(code, details);
  const field = (key: keyof DrugDetails, label: string, mode: "text" | "decimal" = "text") => <label className="mbsf-field"><span>{label}</span><input className="mbsf-input" aria-label={`${label} for line ${index + 1}`} inputMode={mode} value={String(details[key] ?? "")} onChange={(event) => update({ [key]: event.target.value })} /></label>;
  return <details open={enabled}><summary>Injectable drug details</summary>
    <label className="mbsf-field"><span>Service type</span><select className="mbsf-input" aria-label={`Drug service type for line ${index + 1}`} value={enabled ? "injectable" : "other"} onChange={(event) => update({ drugEnabled: event.target.value === "injectable", drugDocumentation: "" })}><option value="other">Other procedure</option><option value="injectable">Physician-administered injectable drug</option></select></label>
    {enabled ? <div className="mbsf-grid" aria-label={`Drug details for line ${index + 1}`}>
      {field("ndcNumber", "11-digit NDC")}{field("drugName", "Drug name")}
      {field("administeredAmount", "Administered dose", "decimal")}
      <label className="mbsf-field"><span>Dose unit</span><select className="mbsf-input" aria-label={`Dose unit for line ${index + 1}`} value={details.doseUnit ?? ""} onChange={(event) => update({ doseUnit: event.target.value as DrugDetails["doseUnit"] })}><option value="">Select unit…</option>{["mg", "mcg", "g", "mL", "units"].map((unit) => <option key={unit}>{unit}</option>)}</select></label>
      {field("amountPerHcpcsUnit", "Dose per procedure billing unit", "decimal")}
      {field("amountPerNdcUnit", "Dose per NDC quantity unit", "decimal")}
      {field("metricQuantity", "NDC quantity", "decimal")}
      <label className="mbsf-field"><span>NDC quantity unit</span><select className="mbsf-input" aria-label={`NDC quantity unit for line ${index + 1}`} value={details.drugQuantityUnit ?? ""} onChange={(event) => update({ drugQuantityUnit: event.target.value as DrugDetails["drugQuantityUnit"] })}><option value="">Select unit…</option><option value="ML">mL</option><option value="UN">Units</option><option value="GR">Grams</option></select></label>
      {field("hcpcsUnitSource", "Procedure unit reference URL")}{field("productLabelSource", "Product label URL")}
      <label className="mbsf-field mbsf-span"><span>Documented drug circumstances</span><select className="mbsf-input" aria-label={`Documented drug circumstances for line ${index + 1}`} value={details.drugDocumentation ?? ""} onChange={(event) => update({ drugDocumentation: event.target.value as DrugDetails["drugDocumentation"] })}><option value="">Select from the documentation…</option><option value="verified">Verified units and separately payable office injection</option><option value="review">Other circumstances — review needed</option></select></label>
      <p className="mbsf-help mbsf-span">Confirm the procedure billing unit and product concentration from the references. Both dose-per-unit values use the selected dose unit. Include every same-day service. The product must be a documented physician-administered office injection, separately payable rather than bundled or packaged. Administration is a separate procedure line. The fee check validates procedure units against the dose and NDC quantity.</p>
    </div> : null}
  </details>;
}
