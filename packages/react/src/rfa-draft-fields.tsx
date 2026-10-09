"use client";
import { useEffect, useId, useState } from "react";
import { RfaIdentitySelect } from "./rfa-identity-select";
import type { BillDiagnosisCode, RfaContact } from "@mindbill/browser";

export function RfaContactFields({ title, value, onChange, officialForm = false }: { officialForm?: boolean; title: string; value?: RfaContact | null | undefined; onChange: (value: RfaContact) => void }) {
  return <fieldset><legend>{title}</legend><div className="mbtd-grid">{([
    ["name", "Organization / practice", 200], ["contactName", "Contact name", 200],
    ["address", "Street address", 500], ["city", "City", 100], ["state", "State", 2],
    ["zip", "ZIP code", 20], ["phone", "Telephone", 30], ["fax", "Fax", 30], ["email", "Email", 254],
  ] as const).map(([field, label, max]) => <label key={field}>{officialForm ? ({ name: title.includes("Administrator") ? "Company Name" : "Practice Name", contactName: "Contact Name", address: "Address", phone: "Telephone Number", fax: "Fax Number", email: "E-mail Address" } as Record<string, string>)[field] ?? label : label}<input type={field === "email" ? "email" : field === "phone" || field === "fax" ? "tel" : "text"} maxLength={max} value={value?.[field] ?? ""} onChange={event => onChange({ ...value, [field]: event.target.value })} /></label>)}</div></fieldset>;
}

export function RfaDiagnosisFields({ code, description, onChange, search, officialForm = false }: {
  officialForm?: boolean; code: string; description?: string; onChange: (value: { diagnosisCode: string; diagnosisDescription: string }) => void;
  search?: (query: string) => Promise<BillDiagnosisCode[]>;
}) {
  const id = useId(); const [query, setQuery] = useState(""); const [results, setResults] = useState<BillDiagnosisCode[]>([]); const [error, setError] = useState("");
  useEffect(() => {
    let active = true; setResults([]); setError("");
    if (!search || query.trim().length < 2) return;
    const timer = setTimeout(() => { void search(query.trim()).then(items => { if (active) setResults(items); }).catch(() => { if (active) setError("Diagnosis search is unavailable. Enter the code and description below."); }); }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, search]);
  if (officialForm && search && !error) return <div className="mbtd-wide"><RfaIdentitySelect label="ICD-Code (required)" placeholder="Choose a diagnosis" searchPlaceholder="Search ICD code or diagnosis" query={query} onSearch={setQuery} searchable value={code} options={[...(code ? [{ id: code, label: `${code} — ${description || "Description needed"}` }] : []), ...results.filter(item => item.code !== code).map(item => ({ id: item.code, label: `${item.code} — ${item.description}` }))]} onSelect={value => { const item = results.find(item => item.code === value); if (item) onChange({ diagnosisCode: item.code, diagnosisDescription: item.description }); setQuery(""); }} error={error} />{code ? <label>Diagnosis (required)<input required maxLength={1000} value={description ?? ""} onChange={event => onChange({ diagnosisCode: code, diagnosisDescription: event.target.value })} /></label> : null}</div>;
  return <>{search ? <label className="mbtd-wide">Find diagnosis by code or description<input value={query} aria-controls={id} onChange={event => setQuery(event.target.value)} />{error ? <small role="status">{error}</small> : null}<span id={id}>{results.map(item => <button type="button" key={item.code} onClick={() => { onChange({ diagnosisCode: item.code, diagnosisDescription: item.description }); setQuery(""); }}>{item.code} — {item.description}</button>)}</span></label> : null}
    <label>{officialForm ? "ICD-Code (required)" : "Diagnosis code"}<input required maxLength={16} value={code} onChange={event => onChange({ diagnosisCode: event.target.value, diagnosisDescription: "" })} /></label>
    <label>{officialForm ? "Diagnosis (required)" : "Diagnosis description"}<input required={officialForm} maxLength={1000} value={description ?? ""} onChange={event => onChange({ diagnosisCode: code, diagnosisDescription: event.target.value })} /><small>Included on the reviewed DWC-RFA form.</small></label>
  </>;
}
