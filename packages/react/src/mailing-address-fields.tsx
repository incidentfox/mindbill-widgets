"use client";

// Structured mailing-address entry (street, line 2, city, state, ZIP) used by the
// send-route dialog and organization administration. Pair with the
// `@mindbill/browser` helpers: `parseMailingAddress` to prefill from an on-file
// string and `composeMailingAddress` to send `destination.mailingAddress`.

import type { ReactElement } from "react";
import { useId, useState } from "react";
import { validateMailingAddress, type MailingAddressField, type MailingAddressParts } from "@mindbill/browser";

export type MailingAddressFieldsProps = {
  value: MailingAddressParts;
  onChange: (value: MailingAddressParts) => void;
  /** When false, an entirely blank address is accepted (no errors shown). Default true. */
  required?: boolean;
  /** Show every field error immediately instead of after the field is left. */
  showErrors?: boolean;
  disabled?: boolean;
  /** Optional group label, e.g. "Mailing address". */
  label?: string;
  className?: string;
};

export function MailingAddressFields({
  value,
  onChange,
  required = true,
  showErrors = false,
  disabled = false,
  label,
  className,
}: MailingAddressFieldsProps): ReactElement {
  const id = useId();
  const [touched, setTouched] = useState<Partial<Record<MailingAddressField, boolean>>>({});
  const blank = !Object.values(value).some((part) => part.trim());
  const errors = !required && blank ? {} : validateMailingAddress(value);
  const errorFor = (field: MailingAddressField) => (showErrors || touched[field]) ? errors[field] : undefined;
  const set = (field: MailingAddressField, next: string) => onChange({ ...value, [field]: next });
  const leave = (field: MailingAddressField) => setTouched((current) => ({ ...current, [field]: true }));
  const star = required ? <span className="mbma-star" aria-hidden="true"> *</span> : null;

  const input = (field: MailingAddressField, text: string, options: {
    placeholder?: string; autoComplete?: string; maxLength?: number; inputMode?: "numeric"; transform?: (raw: string) => string; optional?: boolean;
  } = {}) => {
    const error = errorFor(field);
    const inputId = `${id}-${field}`;
    return (
      <label className="mbma-field" data-field={field} htmlFor={inputId}>
        <span className="mbma-label">{text}{options.optional ? <span className="mbma-optional"> — optional</span> : star}</span>
        <input
          id={inputId}
          className="mbma-input"
          name={field}
          value={value[field]}
          disabled={disabled}
          placeholder={options.placeholder}
          autoComplete={options.autoComplete}
          maxLength={options.maxLength}
          inputMode={options.inputMode}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={(event) => set(field, options.transform ? options.transform(event.target.value) : event.target.value)}
          onBlur={() => leave(field)}
        />
        {error ? <span id={`${inputId}-error`} className="mbma-error">{error}</span> : null}
      </label>
    );
  };

  return (
    <fieldset className={["mbma", className].filter(Boolean).join(" ")} disabled={disabled}>
      <style>{css}</style>
      {label ? <legend className="mbma-legend">{label}{star}</legend> : null}
      {input("line1", "Address line 1", { placeholder: "Street address or PO box", autoComplete: "address-line1", maxLength: 120 })}
      {input("line2", "Address line 2", { placeholder: "Suite, floor, PMB, or attention", autoComplete: "address-line2", maxLength: 120, optional: true })}
      <div className="mbma-row">
        {input("city", "City", { autoComplete: "address-level2", maxLength: 60 })}
        {input("state", "State", { placeholder: "CA", autoComplete: "address-level1", maxLength: 2, transform: (raw) => raw.replace(/[^A-Za-z]/g, "").toUpperCase() })}
        {input("postalCode", "ZIP", { placeholder: "00000", autoComplete: "postal-code", maxLength: 10, inputMode: "numeric", transform: (raw) => raw.replace(/[^\d-]/g, "") })}
      </div>
    </fieldset>
  );
}

const css = `
.mbma{display:grid;gap:10px;margin:0;padding:0;border:0;min-width:0}
.mbma-legend{padding:0;margin-bottom:2px;font-size:13px;font-weight:600;color:var(--mb-text,inherit)}
.mbma-row{display:grid;grid-template-columns:minmax(0,1fr) 4.75rem 7rem;gap:10px}
.mbma-field{display:grid;gap:5px;font-size:13px;min-width:0;align-content:start}
.mbma-label{font-weight:600;color:var(--mb-text,inherit)}
.mbma-star{color:var(--mb-danger,#b42318)}
.mbma-optional{font-weight:400;color:var(--mb-muted,#667085)}
.mbma-input{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid var(--mb-border,#d0d5dd);border-radius:calc(var(--mb-control-radius,8px) - 2px);background:var(--mb-input,#fff);color:var(--mb-text,inherit);font:inherit;font-size:14px}
.mbma-input:focus{outline:3px solid color-mix(in srgb,var(--mb-accent,#2563eb) 22%,transparent);border-color:var(--mb-accent,#2563eb)}
.mbma-input[aria-invalid=true]{border-color:var(--mb-danger,#b42318)}
.mbma-error{color:var(--mb-danger,#b42318);font-size:12px}
@media (max-width:520px){.mbma-row{grid-template-columns:5rem minmax(0,1fr)}.mbma-row .mbma-field[data-field=city]{grid-column:1 / -1}}
`;
