"use client";
import { useEffect, useId, useState } from "react";
import { RfaIdentitySelect } from "./rfa-identity-select";
import { RfaPicker, RfaRequired } from "./rfa-official-fields";
import type { BillDiagnosisCode, RfaContact } from "@mindbill/browser";

export function RfaContactFields({ title, value, onChange }: { title: string; value?: RfaContact | null | undefined; onChange: (value: RfaContact) => void }) {
  return <fieldset><legend>{title}</legend><div className="mbtd-grid">{([
    ["name", "Organization / practice", 200], ["contactName", "Contact name", 200],
    ["address", "Street address", 500], ["city", "City", 100], ["state", "State", 2],
    ["zip", "ZIP code", 20], ["phone", "Telephone", 30], ["fax", "Fax", 30], ["email", "Email", 254],
  ] as const).map(([field, label, max]) => <label key={field}>{label}<input type={field === "email" ? "email" : field === "phone" || field === "fax" ? "tel" : "text"} maxLength={max} value={value?.[field] ?? ""} onChange={event => onChange({ ...value, [field]: event.target.value })} /></label>)}</div></fieldset>;
}

export function RfaDiagnosisFields({ code, description, onChange, search, officialForm = false }: {
  officialForm?: boolean; code: string; description?: string; onChange: (value: { diagnosisCode: string; diagnosisDescription: string }) => void;
  search?: (query: string) => Promise<BillDiagnosisCode[]>;
}) {
  const id = useId(); const [query, setQuery] = useState(""); const [results, setResults] = useState<BillDiagnosisCode[]>([]); const [error, setError] = useState("");
  // Stays open once the user starts typing a diagnosis, so the field does not vanish under the cursor.
  const [manualDiagnosis, setManualDiagnosis] = useState(false);
  useEffect(() => {
    let active = true; setResults([]); setError("");
    if (!search || query.trim().length < 2) return;
    const timer = setTimeout(() => { void search(query.trim()).then(items => { if (active) setResults(items); }).catch(() => { if (active) setError("Diagnosis search is unavailable."); }); }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, search]);
  // One ICD-10 lookup fills both printed columns (Diagnosis and ICD-Code). A code the lookup
  // does not know can still be entered, and then its diagnosis is typed beside it.
  if (officialForm && search) {
    const typed = query.trim().toUpperCase(), known = results.some(item => item.code.toUpperCase() === typed);
    const options = [
      ...(code && !typed && !results.some(item => item.code === code) ? [{ id: code, label: code, ...(description ? { detail: description } : {}) }] : []),
      ...results.map(item => ({ id: item.code, label: item.code, detail: item.description })),
      ...(/^[A-Z]\d[0-9A-Z](\.?[0-9A-Z]{1,4})?$/.test(typed) && !known && typed !== code ? [{ id: `entered:${typed}`, label: `Use ${typed}`, detail: "Enter the diagnosis yourself" }] : []),
    ];
    const listed = results.find(item => item.code === code);
    return <>
      <div className="mbrfa-s3"><RfaPicker required label="ICD-10 Code"><RfaIdentitySelect label="ICD-10 Code" placeholder="Enter code" searchPlaceholder="Search by code or diagnosis" query={query} onSearch={setQuery} searchable value={code} current={code ? { id: code, label: code, ...(description ? { detail: description } : {}) } : undefined} options={options} error={error}
        onSelect={value => { const item = results.find(item => item.code === value); if (item) onChange({ diagnosisCode: item.code, diagnosisDescription: item.description }); else if (value.startsWith("entered:")) onChange({ diagnosisCode: value.slice(8), diagnosisDescription: "" }); setQuery(""); }} /></RfaPicker></div>
      {code && !listed && (manualDiagnosis || !description) ? <label className="mbrfa-s3"><span>Diagnosis<RfaRequired /></span><input required autoFocus={manualDiagnosis} maxLength={1000} placeholder="Diagnosis for this code" value={description ?? ""} onFocus={() => setManualDiagnosis(true)} onChange={event => onChange({ diagnosisCode: code, diagnosisDescription: event.target.value })} /></label> : null}
    </>;
  }
  if (officialForm) return <>
    <label className="mbrfa-s2"><span>ICD-10 Code<RfaRequired /></span><input required maxLength={16} placeholder="Enter code" value={code} onChange={event => onChange({ diagnosisCode: event.target.value, diagnosisDescription: description ?? "" })} /></label>
    <label className="mbrfa-s4"><span>Diagnosis<RfaRequired /></span><input required maxLength={1000} value={description ?? ""} onChange={event => onChange({ diagnosisCode: code, diagnosisDescription: event.target.value })} /></label>
  </>;
  return <>{search ? <label className="mbtd-wide">Find diagnosis by code or description<input value={query} aria-controls={id} onChange={event => setQuery(event.target.value)} />{error ? <small role="status">{error}</small> : null}<span id={id}>{results.map(item => <button type="button" key={item.code} onClick={() => { onChange({ diagnosisCode: item.code, diagnosisDescription: item.description }); setQuery(""); }}>{item.code} — {item.description}</button>)}</span></label> : null}
    <label>Diagnosis code<input required maxLength={16} value={code} onChange={event => onChange({ diagnosisCode: event.target.value, diagnosisDescription: "" })} /></label>
    <label>Diagnosis description<input maxLength={1000} value={description ?? ""} onChange={event => onChange({ diagnosisCode: code, diagnosisDescription: event.target.value })} /><small>Included on the reviewed DWC-RFA form.</small></label>
  </>;
}
