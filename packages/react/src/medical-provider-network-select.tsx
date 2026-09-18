"use client";

import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import type { MedicalProviderNetwork } from "@mindbill/browser";

export type MedicalProviderNetworkSelectProps = {
  /** DWC identifier, including leading zeros. Blank is valid. */
  value: string;
  onChange: (id: string) => void;
  loadOptions?: (() => Promise<MedicalProviderNetwork[]>) | undefined;
  disabled?: boolean;
  label?: string;
};

const STYLE = `.mb-mpn{position:relative;min-width:0;display:grid;gap:6px;font:inherit;color:inherit}.mb-mpn label{font-size:13px;font-weight:600}.mb-mpn-control{display:flex;align-items:center;border:1px solid var(--mb-border,#d6dce5);border-radius:6px;background:var(--mb-surface,#fff)}.mb-mpn-control:focus-within{outline:2px solid var(--mb-accent,#2563eb);outline-offset:1px}.mb-mpn input{width:100%;min-width:0;border:0!important;outline:0!important;box-shadow:none!important;padding:10px 12px;font:inherit;font-size:14px;background:transparent;color:inherit}.mb-mpn button{font:inherit;cursor:pointer}.mb-mpn-clear{border:0;background:transparent;color:inherit;padding:8px 10px;font-size:18px!important}.mb-mpn-list{position:absolute;top:100%;left:0;right:0;z-index:30;margin:4px 0 0;padding:4px;list-style:none;border:1px solid var(--mb-border,#d6dce5);border-radius:6px;background:var(--mb-surface,#fff);box-shadow:0 8px 20px #0002;max-height:260px;overflow:auto}.mb-mpn-option{padding:9px 10px;cursor:pointer;border-radius:4px;overflow-wrap:anywhere}.mb-mpn-option[aria-selected=true]{background:var(--mb-accent-soft,#eff6ff)}.mb-mpn-option strong,.mb-mpn-option small{display:block}.mb-mpn-option strong{font-size:14px}.mb-mpn-option small,.mb-mpn-message{font-size:12px;color:var(--mb-muted,#596779)}.mb-mpn-message{padding:10px}.mb-mpn input:disabled{cursor:not-allowed;opacity:.7}`;

/** Optional active-only directory picker. Free text never becomes a saved identifier. */
export function MedicalProviderNetworkSelect({ value, onChange, loadOptions, disabled = false, label = "Medical provider network (optional)" }: MedicalProviderNetworkSelectProps): ReactElement {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [options, setOptions] = useState<MedicalProviderNetwork[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Load once per provider, even before opening, so saved IDs hydrate to names.
  useEffect(() => {
    let current = true;
    setOptions([]); setError(false);
    if (!loadOptions) { setLoading(false); return; }
    setLoading(true);
    void Promise.resolve().then(loadOptions).then((rows) => {
      if (current) setOptions(rows.filter((row) => row.status === "Approved"));
    }).catch(() => { if (current) setError(true); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [loadOptions, attempt]);
  const selected = options.find((option) => option.id === value);
  const selectedLabel = selected ? `${selected.name || selected.applicantName} · ${selected.id}` : value ? `MPN ${value}` : "";
  const needle = query.trim().toLocaleLowerCase();
  const matches = options.filter((option) => `${option.id} ${option.name} ${option.applicantName}`.toLocaleLowerCase().includes(needle));
  const activeIndex = Math.min(active, matches.length - 1);
  useEffect(() => { if (open && activeIndex >= 0) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" }); }, [activeIndex, id, open]);
  const close = () => { setOpen(false); setQuery(""); setActive(0); };
  const choose = (option: MedicalProviderNetwork) => { onChange(option.id); close(); };
  return <div className="mb-mpn" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}>
    <style>{STYLE}</style>
    <label htmlFor={id}>{label}</label>
    <div className="mb-mpn-control">
      <input id={id} ref={input} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined} autoComplete="off" disabled={disabled} value={open ? query : selectedLabel} placeholder={selectedLabel || "Search by network, applicant, or MPN ID"} onFocus={() => { setOpen(true); setQuery(""); }} onClick={() => { if (!open) { setOpen(true); setQuery(""); setActive(0); } }} onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }} onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); close(); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive((index) => !open ? 0 : Math.max(0, Math.min(matches.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))); }
        if (event.key === "Enter" && open) { event.preventDefault(); if (matches[activeIndex]) choose(matches[activeIndex]); }
      }} />
      {value && !disabled ? <button className="mb-mpn-clear" type="button" aria-label="Clear medical provider network" onClick={() => { onChange(""); setQuery(""); setActive(0); input.current?.focus(); }}>×</button> : null}
    </div>
    {open && !disabled ? <div className="mb-mpn-list">
      <ul id={`${id}-list`} role="listbox" aria-label="Medical provider networks" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {!loading && !error ? matches.map((option, index) => <li id={`${id}-option-${index}`} className="mb-mpn-option" key={option.id} role="option" aria-selected={index === activeIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}><strong>{option.name || option.applicantName}</strong><small>{option.applicantName} · MPN {option.id}</small></li>) : null}
      </ul>
      {loading ? <div className="mb-mpn-message" role="status">Loading networks…</div> : error ? <div className="mb-mpn-message" role="status">Networks could not be loaded. <button type="button" onClick={() => setAttempt((count) => count + 1)}>Retry</button></div> : !matches.length ? <div className="mb-mpn-message" role="status">{loadOptions ? "No active networks found." : "The network directory is unavailable."}</div> : null}
    </div> : null}
  </div>;
}
