"use client";
import { useEffect, useId, useState, type ReactElement } from "react";
import type { BillClaimsAdministratorDirectory, BillReviewPayer, RfaContact } from "@mindbill/browser";
import { RfaAuthorizationDestination } from "./rfa-authorization-destination";
import { RfaContactFields } from "./rfa-draft-fields";
export type RfaContactDirectoryProps = {
  searchClaimsAdministrators?: (query: string, claimNumber?: string) => Promise<BillReviewPayer[]>;
  getClaimsAdministratorDirectory?: (id: string, injuryState?: string) => Promise<BillClaimsAdministratorDirectory>;
};
export function RfaContactPicker({ administratorId, claimNumber, contextKey, value, onChange, searchClaimsAdministrators, getClaimsAdministratorDirectory, disabled }: RfaContactDirectoryProps & {
  administratorId?: string; claimNumber?: string; contextKey: string; value?: RfaContact | null | undefined;
  disabled: boolean; onChange: (id: string | undefined, contact: RfaContact | null) => void;
}): ReactElement {
  const listId = useId();
  const [query, setQuery] = useState(""); const [options, setOptions] = useState<BillReviewPayer[]>([]);
  const [directory, setDirectory] = useState<BillClaimsAdministratorDirectory | null>(null);
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const choose = (option: BillReviewPayer) => { setQuery(""); setActiveIndex(-1); if (option.id !== administratorId) onChange(option.id, null); };
  useEffect(() => {
    let active = true; setDirectory(null); setError(""); setQuery("");
    if (!administratorId || !getClaimsAdministratorDirectory) { setLoading(false); return; }
    setLoading(true);
    getClaimsAdministratorDirectory(administratorId).then(result => { if (active) setDirectory(result); }).catch(() => { if (active) setError("Directory unavailable"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [administratorId, contextKey, getClaimsAdministratorDirectory]);
  useEffect(() => {
    let active = true; setOptions([]); setSearchError(""); setActiveIndex(-1); setSearching(Boolean(query.trim() && searchClaimsAdministrators));
    if (!query.trim() || !searchClaimsAdministrators) return;
    const timer = setTimeout(() => { void searchClaimsAdministrators(query.trim(), claimNumber).then(result => { if (active) setOptions(result); }).catch(() => { if (active) setSearchError("Claims administrators could not be loaded. Try another search."); }).finally(() => { if (active) setSearching(false); }); }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query, claimNumber, searchClaimsAdministrators]);
  return <fieldset disabled={disabled}><legend>Claims administrator authorization contact</legend>
    {searchClaimsAdministrators ? <label>Claims administrator<input role="combobox" aria-autocomplete="list" aria-expanded={Boolean(query && options.length)} aria-controls={listId} aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} autoComplete="off" placeholder={directory?.name || "Search claims administrators"} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
      if (event.key === "Escape") { setQuery(""); setActiveIndex(-1); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActiveIndex(index => options.length ? (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length : -1); }
      if (event.key === "Enter" && query) { event.preventDefault(); if (options[activeIndex]) choose(options[activeIndex]!); }
    }} /></label> : null}
    {query && options.length ? <div id={listId} role="listbox" aria-label="Claims administrators" style={{ border: "1px solid var(--mbtd-border, #d8d8d2)", borderRadius: 8, maxHeight: 240, overflowY: "auto", padding: 4 }}>{options.map((option, index) => <button type="button" role="option" id={`${listId}-${index}`} aria-selected={index === activeIndex} key={option.id} style={{ display: "block", width: "100%", textAlign: "left", border: 0, background: index === activeIndex ? "var(--mbtd-muted, #edf2f1)" : "transparent" }} onClick={() => choose(option)}>{option.name}</button>)}</div> : null}
    {query.trim() && !searchError ? <p role="status">{searching ? "Searching claims administrators…" : options.length === 0 ? "No claims administrators match. Try another name or enter a custom contact below." : `${options.length} matching claims administrators`}</p> : null}
    {searchError ? <p role="alert">{searchError}</p> : null}
    {directory?.name ? <p><strong>{directory.name}</strong></p> : null}
    <RfaAuthorizationDestination contextKey={`${contextKey}:${administratorId ?? ""}`} directory={directory} loading={loading} error={error} disabled={disabled} onSelectionStart={() => onChange(administratorId, null)} onChange={destination => {
      if (destination) onChange(administratorId, { name: directory?.name ?? "", contactName: destination.recipientName ?? destination.label, ...(destination.phone ? { phone: destination.phone } : {}), ...(destination.method === "fax" ? { fax: destination.destination } : { email: destination.destination }) });
    }} />
    {value ? <p>Saved contact: {value.contactName || value.name} · {value.fax || value.email || "No destination recorded"}</p> : null}
    <details><summary>Edit contact details or enter a custom contact</summary><RfaContactFields title="Authorization contact details" value={value} onChange={contact => onChange(administratorId, contact)} /></details>
  </fieldset>;
}
