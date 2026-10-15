import type { ReactElement } from "react";
import type { BillSearchDateField } from "./bill-search";
import { DateField, Select } from "./form-controls";

export function BillDateFilters({ dateField, from, to, onChange }: {
  dateField: BillSearchDateField;
  from: string;
  to: string;
  onChange: (next: { dateField?: BillSearchDateField; from?: string; to?: string }) => void;
}): ReactElement {
  return <div className="mb-date-filters">
    <style>{`.mb-date-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:end}.mb-date-filters label{display:grid;gap:5px;font-size:12px;color:var(--mb-muted);flex:1;min-width:140px}.mb-date-filters input,.mb-date-filters select{width:100%;min-width:0;min-height:44px;padding:9px 10px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-input);color:var(--mb-text);font:inherit;font-size:14px}.mb-date-filters input:focus,.mb-date-filters select:focus{outline:2px solid var(--mb-accent);outline-offset:2px}`}</style>
    <label>Date type<Select value={dateField} onChange={(choice) => onChange({ dateField: choice as BillSearchDateField })}><option value="service">Service date</option><option value="submitted">Submission date</option></Select></label>
    <label>From date<DateField value={from} max={to || undefined} onChange={(choice) => onChange({ from: choice })} /></label>
    <label>Through date<DateField value={to} min={from || undefined} onChange={(choice) => onChange({ to: choice })} /></label>
  </div>;
}
