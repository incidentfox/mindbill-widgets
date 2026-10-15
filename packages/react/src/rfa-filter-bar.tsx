"use client";
import { Fragment, useEffect, useRef, useState, type ReactElement } from "react";

export type RfaFilterOption = { value: string; label: string; group?: string; indent?: boolean };
export type RfaFilter = {
  key: string; label: string; value: string; options: readonly RfaFilterOption[];
  onChange: (value: string) => void;
  /** Called when the chip opens, for options that load on demand. */
  onOpen?: () => void; loading?: boolean;
  /** Show a search box in the list: options filter as you type, and `onSearch` can fetch matches the list does not hold yet. */
  searchable?: boolean; onSearch?: (query: string) => void;
};

const css = `.mbrfa-filterbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:14px 0 16px}.mbrfa-filterbar-search{flex:1 1 280px;min-width:220px;position:relative}
.mbtd .mbrfa-filterbar-search input{width:100%;min-height:36px;padding-left:34px;font-size:13px;background:var(--mb-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' viewBox='0 0 24 24'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E") no-repeat 11px center}
.mbrfa-chip{position:relative}.mbtd .mbrfa-chip>button{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:4px 12px;border-radius:999px;border:1px dashed var(--mb-border);background:transparent;font-size:13px;font-weight:500;color:var(--mb-muted);white-space:nowrap}
.mbtd .mbrfa-chip>button:hover{border-color:var(--mb-accent);color:var(--mb-text)}.mbtd .mbrfa-chip[data-active]>button{border-style:solid;border-color:var(--mb-accent);background:color-mix(in srgb,var(--mb-accent) 9%,var(--mb-surface));color:var(--mb-text);padding-right:6px}
.mbrfa-chip-name{color:var(--mb-muted);font-weight:500}.mbrfa-chip-value{font-weight:650;color:var(--mb-accent)}.mbtd .mbrfa-chip-clear{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:999px;font-size:14px;line-height:1;color:var(--mb-muted)}.mbtd .mbrfa-chip-clear:hover{background:var(--mb-soft);color:var(--mb-text)}
.mbrfa-chip-pop{position:absolute;top:calc(100% + 4px);left:0;z-index:30;min-width:260px;background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-radius);box-shadow:0 10px 28px -8px rgba(0,0,0,.25);overflow:hidden}.mbrfa-chip ul{max-height:300px;overflow:auto;margin:0;padding:4px;list-style:none}.mbtd .mbrfa-chip-search{display:block;width:100%;border:0;border-bottom:1px solid var(--mb-border);border-radius:0;padding:10px 12px;min-height:40px;font-size:13px;background:var(--mb-surface)}.mbtd .mbrfa-chip-search:focus{outline:none;box-shadow:inset 0 -2px 0 var(--mb-accent)}
.mbrfa-chip li[role=option]{display:flex;justify-content:space-between;gap:12px;padding:7px 10px;border-radius:6px;font-size:13px;cursor:pointer;white-space:nowrap}.mbrfa-chip li[role=option][data-indent]{padding-left:22px}.mbrfa-chip li[role=option]:hover,.mbrfa-chip li[role=option][data-active]{background:var(--mb-soft)}.mbrfa-chip li[aria-selected=true]{font-weight:600;color:var(--mb-accent)}.mbrfa-chip li.mbrfa-chip-group{padding:8px 10px 2px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--mb-muted)}.mbrfa-chip li.mbrfa-chip-note{padding:8px 10px;font-size:13px;color:var(--mb-muted)}
.mbrfa-filterbar .mbrfa-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.mbtd .mbrfa-filterbar-clear{border:0;background:transparent;min-height:32px;padding:4px 6px;font-size:13px;color:var(--mb-accent);text-decoration:underline}`;

function Chip({ filter }: { filter: RfaFilter }): ReactElement {
  const [open, setOpen] = useState(false); const [active, setActive] = useState(0); const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(""); const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open && filter.searchable) searchRef.current?.focus(); if (!open) setQuery(""); }, [open, filter.searchable]);
  useEffect(() => { if (!filter.onSearch) return; const timer = setTimeout(() => filter.onSearch?.(query.trim()), 250); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const current = filter.options.find(option => option.value === filter.value);
  const needle = query.trim().toLowerCase();
  const choices = filter.options.filter(option => option.value !== "" && (!needle || option.label.toLowerCase().includes(needle)));
  const pick = (value: string) => { setOpen(false); if (value !== filter.value) filter.onChange(value); };
  const toggle = () => { if (!open) { filter.onOpen?.(); setActive(Math.max(0, choices.findIndex(option => option.value === filter.value))); } setOpen(state => !state); };
  return <div className="mbrfa-chip" ref={ref} data-active={filter.value ? true : undefined}>
    <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={filter.value ? `${filter.label}: ${current?.label ?? filter.value}. Change` : `Filter by ${filter.label.toLowerCase()}`} onClick={toggle}
      onKeyDown={event => {
        if (event.key === "Escape") { setOpen(false); return; }
        if (!open) return;
        if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => Math.min(choices.length - 1, index + 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
        if (event.key === "Enter") { event.preventDefault(); const option = choices[active]; if (option) pick(option.value); }
      }}>
      {filter.value ? <><span className="mbrfa-chip-name">{filter.label}:</span><span className="mbrfa-chip-value">{current?.label ?? filter.value}</span>
        <span className="mbrfa-chip-clear" role="button" tabIndex={-1} aria-label={`Clear ${filter.label.toLowerCase()} filter`} onClick={event => { event.stopPropagation(); setOpen(false); filter.onChange(""); }}>×</span></>
        : <><span aria-hidden="true">+</span>{filter.label}</>}
    </button>
    {open ? <div className="mbrfa-chip-pop">{filter.searchable ? <input ref={searchRef} type="search" className="mbrfa-chip-search" placeholder={`Search ${filter.label.toLowerCase()}`} aria-label={`Search ${filter.label.toLowerCase()}`} value={query}
      onChange={event => { setQuery(event.target.value); setActive(0); }}
      onKeyDown={event => {
        if (event.key === "Escape") { setOpen(false); return; }
        if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => Math.min(choices.length - 1, index + 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
        if (event.key === "Enter") { event.preventDefault(); const option = choices[active]; if (option) pick(option.value); }
      }} /> : null}<ul role="listbox" aria-label={filter.label}>{filter.loading && !choices.length ? <li className="mbrfa-chip-note">Loading…</li> : !choices.length ? <li className="mbrfa-chip-note">{needle ? `No ${filter.label.toLowerCase()} matches “${query.trim()}”` : "No options"}</li> : choices.map((option, index) => <Fragment key={option.value}>
      {option.group && option.group !== choices[index - 1]?.group ? <li role="presentation" className="mbrfa-chip-group">{option.group}</li> : null}
      <li role="option" aria-selected={option.value === filter.value} data-indent={option.indent || undefined} data-active={index === active || undefined} onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => pick(option.value)}>{option.label}{option.value === filter.value ? <span aria-hidden="true">✓</span> : null}</li>
    </Fragment>)}</ul></div> : null}
  </div>;
}

/** One search box for free text plus a chip per structured filter. Active chips read "Label: value" and can be changed or cleared in place. */
export function RfaFilterBar({ search, onSearch, searchPlaceholder, filters, onClearAll }: { search?: string; onSearch?: (value: string) => void; searchPlaceholder?: string; filters: readonly RfaFilter[]; /** Clear everything at once, for hosts where each change navigates. */ onClearAll?: () => void }): ReactElement {
  const anyActive = filters.some(filter => filter.value) || Boolean(search);
  return <div className="mbrfa-filterbar" role="search">
    <style>{css}</style>
    {onSearch ? <label className="mbrfa-filterbar-search"><span className="mbrfa-sr-only">Search</span><input type="search" value={search ?? ""} maxLength={200} placeholder={searchPlaceholder} onChange={event => onSearch(event.target.value)} /></label> : null}
    {filters.map(filter => <Chip key={filter.key} filter={filter} />)}
    {anyActive ? <button type="button" className="mbrfa-filterbar-clear" onClick={() => { if (onClearAll) { onClearAll(); return; } onSearch?.(""); for (const filter of filters) if (filter.value) filter.onChange(""); }}>Clear all</button> : null}
  </div>;
}
