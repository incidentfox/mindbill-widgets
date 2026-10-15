"use client";
import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactElement } from "react";

/** Styled replacements for the browser's built-in dropdown and date pickers. Each writes a hidden input,
 * so forms keep reading their values from FormData. */

export type RfaSelectOption = { value: string; label: string; group?: string; disabled?: boolean };

const css = `.mbrfa-control{position:relative;display:block}.mbtd .mbrfa-control>button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;min-height:40px;padding:8px 12px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);font:inherit;font-size:14px;font-weight:400;color:var(--mb-text);text-align:left;cursor:pointer}
.mbtd .mbrfa-control>button:hover,.mbtd .mbrfa-control>button[aria-expanded=true]{border-color:var(--mb-accent)}.mbtd .mbrfa-control>button:focus-visible{outline:2px solid var(--mb-accent);outline-offset:1px}.mbtd .mbrfa-control>button:disabled{opacity:.6;cursor:not-allowed}
.mbrfa-control-placeholder{color:var(--mb-muted)}.mbrfa-control>button svg{flex-shrink:0;opacity:.6}.mbrfa-control-value{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mbrfa-control-pop{position:absolute;top:calc(100% + 4px);left:0;z-index:40;min-width:100%;background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-radius);box-shadow:0 12px 30px -10px rgba(0,0,0,.3)}
.mbrfa-control-pop ul{margin:0;padding:4px;list-style:none;max-height:280px;overflow:auto}.mbrfa-control-pop li[role=option]{display:flex;justify-content:space-between;gap:12px;padding:8px 10px;border-radius:6px;font-size:14px;cursor:pointer}.mbrfa-control-pop li[role=option][data-active]{background:var(--mb-soft)}.mbrfa-control-pop li[aria-selected=true]{color:var(--mb-accent);font-weight:600}.mbrfa-control-pop li[aria-disabled=true]{opacity:.45;cursor:not-allowed}.mbrfa-control-pop li.mbrfa-control-group{padding:8px 10px 2px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--mb-muted)}
.mbrfa-cal{padding:10px;width:260px}.mbrfa-cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-size:14px;font-weight:600}.mbtd .mbrfa-cal-head button{border:0;background:transparent;min-height:28px;width:28px;padding:0;border-radius:6px;font-size:16px;color:var(--mb-text)}.mbtd .mbrfa-cal-head button:hover{background:var(--mb-soft)}
.mbrfa-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center}.mbrfa-cal-grid span{font-size:11px;color:var(--mb-muted);padding:4px 0}.mbtd .mbrfa-cal-grid button{border:0;background:transparent;min-height:30px;padding:0;border-radius:6px;font-size:13px;color:var(--mb-text)}.mbtd .mbrfa-cal-grid button:hover{background:var(--mb-soft)}.mbtd .mbrfa-cal-grid button[data-other]{color:var(--mb-muted)}.mbtd .mbrfa-cal-grid button[data-today]{box-shadow:inset 0 0 0 1px var(--mb-border)}.mbtd .mbrfa-cal-grid button[aria-pressed=true]{background:var(--mb-accent);color:var(--mb-accent-contrast,#fff);font-weight:600}.mbtd .mbrfa-cal-grid button:disabled{opacity:.3;cursor:not-allowed}
.mbrfa-cal-foot{display:flex;justify-content:space-between;margin-top:8px}.mbtd .mbrfa-cal-foot button{border:0;background:transparent;min-height:28px;padding:2px 6px;font-size:13px;color:var(--mb-accent)}
.mbrfa-datetime{display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:8px}.mbtd .mbrfa-datetime>input{min-height:40px;font-size:14px}`;

const chevron = <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const calendarIcon = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;

function usePopover() {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); setOpen(false); } };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape, true); };
  }, [open]);
  return { open, setOpen, ref };
}

/** A styled dropdown. Pass `value` and `onChange` to control it, or `defaultValue` to let it keep its own state. */
export function RfaSelect({ name, value, defaultValue = "", onChange, options, placeholder = "Choose…", required, disabled, label }: {
  name?: string; value?: string; defaultValue?: string; onChange?: (value: string) => void; options: readonly RfaSelectOption[];
  placeholder?: string; required?: boolean; disabled?: boolean; label?: string;
}): ReactElement {
  const [own, setOwn] = useState(defaultValue); const current = value ?? own;
  const { open, setOpen, ref } = usePopover(); const [active, setActive] = useState(0); const id = useId();
  const choices = options;
  const pick = (next: string) => { setOpen(false); if (value === undefined) setOwn(next); onChange?.(next); };
  const selected = choices.find(option => option.value === current && option.value !== "");
  return <div className="mbrfa-control" ref={ref}>
    <style>{css}</style>
    {name ? <input type="hidden" name={name} value={current} /> : null}
    <button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} {...(label ? { "aria-label": `${label}: ${selected?.label ?? placeholder}` } : {})} data-required={required || undefined}
      onClick={() => { setActive(Math.max(0, choices.findIndex(option => option.value === current))); setOpen(state => !state); }}
      onKeyDown={event => {
        if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) { event.preventDefault(); setActive(Math.max(0, choices.findIndex(option => option.value === current))); setOpen(true); return; }
        if (!open) return;
        if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => Math.min(choices.length - 1, index + 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
        if (event.key === "Enter") { event.preventDefault(); const option = choices[active]; if (option && !option.disabled) pick(option.value); }
      }}>
      <span className={`mbrfa-control-value${selected ? "" : " mbrfa-control-placeholder"}`}>{selected?.label ?? placeholder}</span>{chevron}
    </button>
    {open ? <div className="mbrfa-control-pop"><ul role="listbox" id={`${id}-list`}>{choices.map((option, index) => <Fragment key={option.value || "__empty"}>
      {option.group && option.group !== choices[index - 1]?.group ? <li role="presentation" className="mbrfa-control-group">{option.group}</li> : null}
      <li role="option" aria-selected={option.value === current} aria-disabled={option.disabled || undefined} data-active={index === active || undefined} onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => { if (!option.disabled) pick(option.value); }}>{option.label}{option.value === current && option.value ? <span aria-hidden="true">✓</span> : null}</li>
    </Fragment>)}</ul></div> : null}
  </div>;
}

const pad = (value: number) => String(value).padStart(2, "0");
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseIso = (value: string) => { const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value); return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null; };
const displayDate = (value: string) => { const date = parseIso(value); return date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""; };
/** "15:30" → "3:30 PM"; accepts "3:30 pm", "3pm", "15:30". */
export function rfaParseTime(text: string): string | null {
  const match = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i.exec(text);
  if (!match) return null;
  let hour = Number(match[1]); const minute = Number(match[2] ?? "0"); const meridiem = match[3]?.toLowerCase();
  if (minute > 59 || hour > 23 || (meridiem && (hour < 1 || hour > 12))) return null;
  if (meridiem === "pm" && hour < 12) hour += 12; if (meridiem === "am" && hour === 12) hour = 0;
  return `${pad(hour)}:${pad(minute)}`;
}
const displayTime = (value: string) => { const [hour, minute] = value.split(":").map(Number); if (hour === undefined || minute === undefined || Number.isNaN(hour)) return ""; return `${hour % 12 || 12}:${pad(minute)} ${hour < 12 ? "AM" : "PM"}`; };

function Calendar({ value, max, onPick, onClear }: { value: string; max?: string; onPick: (iso: string) => void; onClear?: () => void }): ReactElement {
  const selected = parseIso(value); const today = new Date();
  const [month, setMonth] = useState(() => { const base = selected ?? today; return new Date(base.getFullYear(), base.getMonth(), 1); });
  const days = useMemo(() => { const start = new Date(month); start.setDate(1 - month.getDay()); return Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; }); }, [month]);
  const maxDate = max ? parseIso(max) : null;
  return <div className="mbrfa-cal">
    <div className="mbrfa-cal-head"><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><span>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
    <div className="mbrfa-cal-grid">{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={index}>{day}</span>)}
      {days.map(day => { const iso = isoDate(day); return <button key={iso} type="button" aria-pressed={selected ? iso === isoDate(selected) : false} aria-label={day.toLocaleDateString(undefined, { dateStyle: "long" })} data-other={day.getMonth() !== month.getMonth() || undefined} data-today={iso === isoDate(today) || undefined} disabled={Boolean(maxDate && day > maxDate)} onClick={() => onPick(iso)}>{day.getDate()}</button>; })}</div>
    <div className="mbrfa-cal-foot">{onClear ? <button type="button" onClick={onClear}>Clear</button> : <span />}<button type="button" disabled={Boolean(maxDate && today > maxDate)} onClick={() => onPick(isoDate(today))}>Today</button></div>
  </div>;
}

/** A styled date field (value "YYYY-MM-DD"), or date and time (value "YYYY-MM-DDTHH:mm") with `withTime`. */
export function RfaDateField({ name, defaultValue = "", required, max, withTime = false, label, onChange }: {
  name: string; defaultValue?: string; required?: boolean; max?: string; withTime?: boolean; label?: string; onChange?: (value: string) => void;
}): ReactElement {
  const [date, setDate] = useState(defaultValue.slice(0, 10)); const [time, setTime] = useState(withTime ? defaultValue.slice(11, 16) || "12:00" : "");
  const [timeText, setTimeText] = useState(withTime ? displayTime(defaultValue.slice(11, 16) || "12:00") : "");
  const { open, setOpen, ref } = usePopover();
  const value = date ? (withTime ? `${date}T${time || "12:00"}` : date) : "";
  useEffect(() => { onChange?.(value); }, [value]);
  const field = <div className="mbrfa-control" ref={ref}>
    <button type="button" aria-haspopup="dialog" aria-expanded={open} {...(label ? { "aria-label": `${label}: ${date ? displayDate(date) : "not set"}` } : {})} data-required={required || undefined} onClick={() => setOpen(state => !state)}>
      <span className={`mbrfa-control-value${date ? "" : " mbrfa-control-placeholder"}`}>{date ? displayDate(date) : "Select a date"}</span>{calendarIcon}
    </button>
    {open ? <div className="mbrfa-control-pop" role="dialog" aria-label={label ?? "Choose a date"}><Calendar value={date} {...(max ? { max: max.slice(0, 10) } : {})} onPick={iso => { setDate(iso); setOpen(false); }} {...(!required ? { onClear: () => { setDate(""); setOpen(false); } } : {})} /></div> : null}
  </div>;
  return <>
    <style>{css}</style>
    <input type="hidden" name={name} value={value} />
    {withTime ? <div className="mbrfa-datetime">{field}<input type="text" inputMode="text" aria-label={`${label ?? "Time"} time`} value={timeText} placeholder="12:00 PM" onChange={event => setTimeText(event.target.value)} onBlur={() => { const parsed = rfaParseTime(timeText); if (parsed) { setTime(parsed); setTimeText(displayTime(parsed)); } else setTimeText(displayTime(time || "12:00")); }} /></div> : field}
  </>;
}
