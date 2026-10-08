"use client";
import { useId, useRef, useState, type ReactElement } from "react";

type Option = { id: string; label: string; detail: string };
/** Search lives inside the choice menu, so results are visible as the user types. */
export function RfaIdentitySelect({ label, placeholder, searchPlaceholder, query, searchable, disabled, loading, error, value, options, onSearch, onSelect }: {
  label: string; placeholder: string; searchPlaceholder: string; query: string;
  searchable: boolean; disabled: boolean; loading: boolean; error: string;
  value: string; options: Option[]; onSearch: (value: string) => void; onSelect: (id: string) => void;
}): ReactElement {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.find(option => option.id === value);
  const choose = (option: Option) => { onSelect(option.id); setOpen(false); trigger.current?.focus(); };
  return <div className="mbrfa-identity-select" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
  }}>
    <style>{`.mbrfa-identity-select{position:relative;min-width:0}.mbrfa-identity-select>button{display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;gap:12px;min-height:44px}.mbrfa-identity-select small{display:block;opacity:.75;font-size:12px;margin-top:3px}.mbrfa-identity-menu{position:absolute;z-index:40;top:calc(100% + 6px);left:0;right:0;padding:10px;background:var(--mbtd-surface,#fff);color:inherit;border:1px solid var(--mbtd-border,#d6d3cc);border-radius:8px;box-shadow:0 8px 24px #0002}.mbrfa-identity-menu input{width:100%;box-sizing:border-box}.mbrfa-identity-options{max-height:280px;overflow:auto;margin-top:6px}.mbrfa-identity-options button{display:block;width:100%;text-align:left;padding:10px 12px;border:0;border-radius:4px;min-height:44px}.mbrfa-identity-options button:hover,.mbrfa-identity-options button[data-active=true]{background:#1c595918}.mbrfa-identity-menu p{padding:8px;margin:0}`}</style>
    <button ref={trigger} type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} disabled={disabled} onClick={() => { setOpen(!open); setActive(0); }}>
      <span>{selected ? <>{selected.label}{selected.detail ? <small>{selected.detail}</small> : null}</> : placeholder}</span><span aria-hidden="true">⌄</span>
    </button>
    {open ? <div className="mbrfa-identity-menu">
      {searchable ? <input autoFocus role="combobox" aria-label={searchPlaceholder} aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={!loading && !error && options[active] ? `${id}-${active}` : undefined} type="search" autoComplete="off" maxLength={200} placeholder={searchPlaceholder} value={query} onChange={event => { setActive(0); onSearch(event.target.value); }} onKeyDown={event => {
        if (loading || error || !options.length) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); const next = (active + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length; setActive(next); document.getElementById(`${id}-${next}`)?.scrollIntoView({ block: "nearest" }); }
        if (event.key === "Enter" && options[active]) { event.preventDefault(); choose(options[active]!); }
      }} /> : null}
      <div className="mbrfa-identity-options" id={`${id}-list`} role="listbox" aria-label={label} aria-busy={loading}>
        {loading ? <p role="status">Searching…</p> : error ? <p role="alert">{error}</p> : options.length ? options.map((option, index) => <button type="button" role="option" id={`${id}-${index}`} key={option.id} aria-selected={option.id === value} data-active={index === active} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>{option.label}{option.detail ? <small>{option.detail}</small> : null}</button>) : <p>No matches. Try another search.</p>}
      </div>
    </div> : null}
  </div>;
}
