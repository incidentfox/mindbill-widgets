"use client";
import type { ReactElement } from "react";
import { Select, type SelectOption } from "./form-controls";

type Option = { id: string; label: string; detail?: string; /** An action rather than a saved choice (e.g. manual entry); set apart at the end of the list. */ action?: boolean };
/** A saved identity (claim, physician, practice, template…) chosen from a searchable list. A thin adapter over the shared `Select`. */
export function RfaIdentitySelect({ label, placeholder, searchPlaceholder, query, searchable, disabled = false, loading = false, error = "", value, options, onSearch, onSelect, current }: {
  label: string; placeholder: string; searchPlaceholder: string; query: string;
  searchable: boolean; disabled?: boolean; loading?: boolean; error?: string;
  value: string; options: Option[]; onSearch: (value: string) => void; onSelect: (id: string) => void;
  /** The chosen value to show when the filtered options no longer include it. */ current?: Option | undefined;
}): ReactElement {
  const choices: SelectOption[] = options.map(option => ({ value: option.id, label: option.label, ...(option.detail ? { description: option.detail } : {}), ...(option.action ? { action: true } : {}) }));
  if (value && !options.some(option => option.id === value) && current?.id === value) choices.push({ value: current.id, label: current.label, ...(current.detail ? { description: current.detail } : {}), hidden: true });
  void query;
  return <Select aria-label={label} label={label} placeholder={placeholder} searchPlaceholder={searchPlaceholder} searchable={searchable} disabled={disabled} loading={loading} error={error || undefined}
    value={options.some(option => option.id === value) || current?.id === value ? value : ""} options={choices} allowEmpty onSearch={onSearch} onChange={onSelect} />;
}
