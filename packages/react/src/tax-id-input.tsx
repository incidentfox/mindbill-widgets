import type { OrganizationPracticeIdentity } from "@mindbill/browser";
export { organizationTaxIdWrite as taxIdWrite } from "@mindbill/browser";

type TaxIdFields = Pick<OrganizationPracticeIdentity, "taxId" | "taxIdType" | "taxIdLast4" | "taxIdConfigured">;

export function TaxIdInput({ label, value, onChange, disabled }: {
  label: string; value: TaxIdFields; onChange: (patch: TaxIdFields) => void; disabled: boolean;
}) {
  const saved = value.taxIdType === "SSN" && value.taxIdConfigured;
  return <div className="mbob-field mbob-tax-id">
    <label>{label} type<select disabled={disabled} value={value.taxIdType ?? "EIN"} onChange={(event) => onChange({ taxIdType: event.target.value as "EIN" | "SSN", taxId: "", taxIdConfigured: false, taxIdLast4: "" })}><option value="EIN">EIN (business)</option><option value="SSN">SSN (individual)</option></select></label>
    <label>{label}<input disabled={disabled} autoComplete="off" inputMode="numeric" type={value.taxIdType === "SSN" ? "password" : "text"} value={value.taxId ?? ""} placeholder={saved ? "Leave blank to keep saved SSN" : ""} onChange={(event) => onChange({ taxId: event.target.value })} /></label>
    {saved ? <><small>Saved SSN ending in {value.taxIdLast4 ?? "••••"}. The full number is not returned to your browser.</small><button type="button" disabled={disabled} onClick={() => onChange({ taxId: "", taxIdConfigured: false, taxIdLast4: "" })}>Clear saved SSN on save</button></> : null}
  </div>;
}
