"use client";
import { useEffect, useId, useRef, useState } from "react";
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

/** Repeated searches (retyping, a second treatment row) answer at once. Keyed by the host's search function. */
const diagnosisCache = new WeakMap<object, Map<string, BillDiagnosisCode[]>>();

export function RfaDiagnosisFields({ code, description, onChange, search, officialForm = false, savedCodes = [] }: {
  /** ICD-10 codes saved on the injury, offered first. */ savedCodes?: string[];
  officialForm?: boolean; code: string; description?: string; onChange: (value: { diagnosisCode: string; diagnosisDescription: string }) => void;
  search?: (query: string) => Promise<BillDiagnosisCode[]>;
}) {
  const id = useId(); const [query, setQuery] = useState(""); const [results, setResults] = useState<BillDiagnosisCode[]>([]); const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    let active = true; const text = query.trim(); setError("");
    if (!search || text.length < 2) { setResults([]); setSearching(false); return; }
    const key = text.toLowerCase(), cached = diagnosisCache.get(search)?.get(key);
    if (cached) { setResults(cached); setSearching(false); return; }
    // Earlier matches stay on screen while the next ones load, so typing never blanks the list.
    setSearching(true);
    const timer = setTimeout(() => { void search(text).then(items => {
      let known = diagnosisCache.get(search); if (!known) diagnosisCache.set(search, known = new Map()); known.set(key, items);
      if (active) { setResults(items); setSearching(false); }
    }).catch(() => { if (active) { setError("Diagnosis search is unavailable."); setSearching(false); } }); }, 120);
    return () => { active = false; clearTimeout(timer); };
  }, [query, search]);
  // A treatment can be supported by several diagnoses. They are stored on the one treatment row the way they
  // print on the form: codes joined with ", " and their descriptions, in the same order, joined with "; ".
  const codes = code.split(",").map(part => part.trim()).filter(Boolean);
  const parts = (description ?? "").split(";").map(part => part.trim());
  const descriptions = codes.map((_, index) => parts.length === codes.length ? parts[index]! : codes.length === 1 ? (description ?? "").trim() : "");
  const emit = (nextCodes: string[], nextDescriptions: string[]) => onChange({
    diagnosisCode: nextCodes.join(", "),
    diagnosisDescription: nextDescriptions.some(Boolean) ? nextDescriptions.map(text => text.replace(/;/g, ",").trim()).join("; ") : "",
  });
  // A code that arrives without its description (prefilled from the injury, or picked from the injury's saved
  // codes) gets the description looked up once, so nobody retypes a diagnosis the directory knows.
  // Every missing description is looked up at once. Each lookup runs to completion on its own: an earlier
  // version cancelled a lookup as soon as the next one started, so none of the answers were ever used.
  const resolved = useRef(new Set<string>()); const started = useRef(new Set<string>()); const [, lookedUp] = useState(0);
  // A code that was removed is looked up afresh if it comes back.
  for (const known of [...started.current]) if (!codes.includes(known)) { started.current.delete(known); resolved.current.delete(known); }
  const missing = officialForm && search ? codes.filter((item, index) => !descriptions[index] && !started.current.has(item)) : [];
  const latest = useRef({ codes, descriptions, emit }); latest.current = { codes, descriptions, emit };
  const mounted = useRef(true); useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const missingKey = missing.join("|");
  useEffect(() => {
    if (!missing.length || !search) return;
    const same = (left: string, right: string) => left.replace(".", "").toUpperCase() === right.replace(".", "").toUpperCase();
    for (const wanted of missing) {
      started.current.add(wanted);
      void search(wanted).then(items => {
        const match = items.find(item => same(item.code, wanted)); if (!mounted.current || !match) return;
        const now = latest.current, at = now.codes.indexOf(wanted); if (at < 0 || now.descriptions[at]) return;
        // Answers can arrive together: keep the descriptions already applied by an earlier answer in this tick.
        const descriptions = now.descriptions.map((text, index) => index === at ? match.description : text);
        latest.current = { ...now, descriptions };
        now.emit(now.codes, descriptions);
      }).catch(() => undefined).finally(() => { resolved.current.add(wanted); if (mounted.current) lookedUp(count => count + 1); });
    }
  }, [missingKey, search]);
  // One ICD-10 lookup fills both printed columns (Diagnosis and ICD-Code). A code the lookup
  // does not know can still be entered, and then its diagnosis is typed beside it.
  if (officialForm && search) {
    const typed = query.trim().toUpperCase(), known = results.some(item => item.code.toUpperCase() === typed);
    const chosen = (value: string) => codes.includes(value);
    const options = [
      ...(!typed ? savedCodes.filter(saved => saved && !chosen(saved)).map(saved => ({ id: `saved:${saved}`, label: saved, detail: "Saved on this injury" })) : []),
      ...results.filter(item => !chosen(item.code)).map(item => ({ id: item.code, label: item.code, detail: item.description })),
      ...(/^[A-Z]\d[0-9A-Z](\.?[0-9A-Z]{1,4})?$/.test(typed) && !known && !chosen(typed) ? [{ id: `entered:${typed}`, label: `Use ${typed}`, detail: "Enter the diagnosis yourself" }] : []),
    ];
    const add = (value: string) => {
      const item = results.find(item => item.code === value);
      if (item) emit([...codes, item.code], [...descriptions, item.description]);
      else if (value.startsWith("entered:")) { started.current.add(value.slice(8)); resolved.current.add(value.slice(8)); emit([...codes, value.slice(8)], [...descriptions, ""]); }
      else if (value.startsWith("saved:")) emit([...codes, value.slice(6)], [...descriptions, ""]);
      setQuery("");
    };
    return <div className="mbrfa-s6"><RfaPicker required label="ICD-10 Code">
      {codes.length ? <ul className="mbrfa-dx-list" aria-label="Selected ICD-10 codes">{codes.map((item, index) => <li key={item}>
        <strong>{item}</strong>
        {descriptions[index] || !resolved.current.has(item) ? <span>{descriptions[index] || "Looking up…"}</span>
          : <input required aria-label={`Diagnosis for ${item}`} maxLength={400} placeholder="Type the diagnosis for this code" defaultValue="" onBlur={event => { if (event.target.value.trim()) emit(codes, descriptions.map((text, position) => position === index ? event.target.value : text)); }} />}
        <button type="button" aria-label={`Remove ${item}`} onClick={() => emit(codes.filter((_, position) => position !== index), descriptions.filter((_, position) => position !== index))}>×</button>
      </li>)}</ul> : null}
      {codes.length < 12 ? <RfaIdentitySelect label="ICD-10 Code" placeholder={codes.length ? "Add another ICD-10 code" : "Enter code"} searchPlaceholder="Search by code or diagnosis" query={query} onSearch={setQuery} searchable loading={searching && !options.length} error={error} value="" options={options} onSelect={add} /> : null}
    </RfaPicker></div>;
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
