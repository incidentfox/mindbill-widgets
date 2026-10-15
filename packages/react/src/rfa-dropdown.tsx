"use client";
import { Fragment, useEffect, useId, useRef, useState, type ReactElement } from "react";

export type RfaDropdownOption = { value: string; label: string; group?: string; indent?: boolean };

const css = `.mbrfa-dropdown{position:relative;display:grid;gap:4px;min-width:200px}.mbrfa-dropdown-label{font-size:12px;font-weight:600;color:var(--mb-muted)}
.mbtd .mbrfa-dropdown>button{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:36px;padding:6px 10px 6px 12px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);font-size:13px;font-weight:500;color:var(--mb-text);text-align:left}.mbtd .mbrfa-dropdown>button:hover,.mbtd .mbrfa-dropdown>button[aria-expanded=true]{border-color:var(--mb-accent)}.mbrfa-dropdown>button svg{flex-shrink:0;opacity:.6}
.mbrfa-dropdown ul{position:absolute;top:calc(100% + 4px);left:0;z-index:30;min-width:100%;max-height:320px;overflow:auto;margin:0;padding:4px;list-style:none;background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-radius);box-shadow:0 10px 28px -8px rgba(0,0,0,.25)}
.mbrfa-dropdown li[role=option]{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:7px 10px;border-radius:6px;font-size:13px;cursor:pointer;white-space:nowrap}.mbrfa-dropdown li[role=option][data-indent]{padding-left:22px}.mbrfa-dropdown li[role=option]:hover,.mbrfa-dropdown li[role=option][data-active]{background:var(--mb-soft)}.mbrfa-dropdown li[aria-selected=true]{font-weight:600;color:var(--mb-accent)}
.mbrfa-dropdown li.mbrfa-dropdown-group{padding:8px 10px 2px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--mb-muted)}`;

/** A styled single-choice dropdown; keyboard: arrows move, Enter picks, Escape closes. */
export function RfaDropdown({ label, value, options, onChange }: { label: string; value: string; options: readonly RfaDropdownOption[]; onChange: (value: string) => void }): ReactElement {
  const [open, setOpen] = useState(false); const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null); const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const pick = (next: string) => { setOpen(false); if (next !== value) onChange(next); };
  const current = options.find(option => option.value === value);
  return <div className="mbrfa-dropdown" ref={ref}>
    <style>{css}</style>
    <span className="mbrfa-dropdown-label" id={`${id}-label`}>{label}</span>
    <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`${id}-label ${id}-value`} onClick={() => { setActive(Math.max(0, options.findIndex(option => option.value === value))); setOpen(state => !state); }}
      onKeyDown={event => {
        if (event.key === "Escape") { setOpen(false); return; }
        if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) { event.preventDefault(); setActive(Math.max(0, options.findIndex(option => option.value === value))); setOpen(true); return; }
        if (!open) return;
        if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => Math.min(options.length - 1, index + 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
        if (event.key === "Enter") { event.preventDefault(); const option = options[active]; if (option) pick(option.value); }
      }}>
      <span id={`${id}-value`}>{current?.label ?? ""}</span>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {open ? <ul role="listbox" aria-labelledby={`${id}-label`}>{options.map((option, index) => <Fragment key={option.value || "__all"}>
      {option.group && option.group !== options[index - 1]?.group ? <li role="presentation" className="mbrfa-dropdown-group">{option.group}</li> : null}
      <li role="option" aria-selected={option.value === value} data-indent={option.indent || undefined} data-active={index === active || undefined} onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => pick(option.value)}>{option.label}{option.value === value ? <span aria-hidden="true">✓</span> : null}</li>
    </Fragment>)}</ul> : null}
  </div>;
}
