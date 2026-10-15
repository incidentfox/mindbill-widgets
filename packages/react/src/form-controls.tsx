"use client";
import {
  Children, Fragment, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode, type RefObject,
} from "react";

/**
 * The one set of form controls every MindBill widget uses instead of the browser's built-in dropdown and
 * date/time pickers. Each control renders a visually hidden form input that carries its value, so forms keep
 * reading values from FormData, `required` still blocks submission, and a programmatic
 * `input.value = …; dispatchEvent(new Event("change"))` still sets the control.
 *
 * - `Select`: single choice. Pass `options`, or `<option>`/`<optgroup>` children as with a native select.
 *   Lists longer than 12 options become searchable automatically; pass `searchable` to force it.
 * - `DateField`: value "YYYY-MM-DD". Type MM/DD/YYYY or pick from the calendar.
 * - `TimeField`: value "HH:mm". Typed as text, e.g. "3:00 PM".
 * - `DateTimeField`: value "YYYY-MM-DDTHH:mm" (local time), a date and a typed time.
 */

export type SelectOption = {
  value: string; label: string; group?: string; disabled?: boolean;
  /** Indent under the option before it, e.g. a sub-category. */ indent?: boolean;
  /** Shown for the selected value but never listed, like a native `<option hidden>`. */ hidden?: boolean;
  /** Secondary text shown under the label in the list and after it in the field. */ description?: string;
  /** An action such as "Enter manually…" rather than a saved choice; listed last, set apart. */ action?: boolean;
};

type Common = {
  id?: string | undefined; name?: string | undefined; form?: string | undefined; required?: boolean | undefined; disabled?: boolean | undefined; className?: string | undefined; style?: CSSProperties | undefined; title?: string | undefined;
  /** Accessible name when the control is not inside a `<label>`. */ "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined; "aria-describedby"?: string | undefined; autoFocus?: boolean | undefined;
  /** Message shown when a required control is empty at submit. */ requiredMessage?: string | undefined;
};

export type SelectProps = Common & {
  value?: string | undefined; defaultValue?: string | undefined; onChange?: ((value: string) => void) | undefined;
  options?: readonly SelectOption[] | undefined; children?: ReactNode | undefined;
  /** Text shown when nothing is chosen and no empty option is listed. */ placeholder?: string | undefined;
  /** Short label; used as the accessible name prefix ("Label: value") when no aria-label is given. */ label?: string | undefined;
  /** Show a search box in the list. Defaults to on for lists longer than 12 options. */ searchable?: boolean | undefined;
  /** Called as the search text changes, for lists that load matches from the server. Debounce the request yourself. */ onSearch?: ((query: string) => void) | undefined;
  /** Filter the options by the search text. Defaults to on unless `onSearch` loads matches. */ filter?: boolean | undefined;
  /** Shown in the list instead of options, e.g. when matches could not be loaded. */ error?: string | undefined;
  /** Called when the list opens, for options that load on demand. */ onOpen?: (() => void) | undefined;
  loading?: boolean | undefined; searchPlaceholder?: string | undefined;
  /** Allow a value that is not in the list: the search text can be used as typed. */ allowCustom?: boolean | undefined;
  /** Show the placeholder for an empty or unknown value instead of falling back to the first option as a native select does. */ allowEmpty?: boolean | undefined;
  /** Width of the list relative to the field. */ align?: "start" | "end" | undefined;
  /** Show the chosen option's description after its label in the field, e.g. a physician's NPI. */ detailInField?: boolean | undefined;
};

type DateCommon = Common & {
  value?: string | undefined; defaultValue?: string | undefined; onChange?: ((value: string) => void) | undefined;
  /** Earliest allowed value, same format as the value. */ min?: string | undefined; /** Latest allowed value. */ max?: string | undefined;
  label?: string | undefined; placeholder?: string | undefined;
};
export type DateFieldProps = DateCommon;
export type TimeFieldProps = Omit<DateCommon, "min" | "max">;
export type DateTimeFieldProps = DateCommon;

const css = `.mbctl{position:relative;display:block;min-width:0;width:100%;font-size:14px;text-align:left}
.mbctl .mbctl-proxy{position:absolute;left:0;bottom:0;width:100%;height:1px;margin:0;padding:0;border:0;opacity:0;pointer-events:none;min-height:0}
.mbctl.mbctl .mbctl-trigger,.mbctl.mbctl .mbctl-box{box-sizing:border-box;display:flex;width:100%;align-items:center;gap:8px;min-height:var(--mb-control-height,40px);margin:0;padding:0 12px;border:1px solid var(--mb-border,#cfd8dc);border-radius:var(--mb-control-radius,8px);background:var(--mb-input,var(--mb-surface,#fff));color:var(--mb-text,#1f2a30);font:inherit;font-size:14px;font-weight:400;line-height:1.3;text-align:left;box-shadow:none}
.mbctl.mbctl .mbctl-trigger{justify-content:space-between;padding:7px 12px;cursor:pointer}
.mbctl.mbctl .mbctl-trigger:hover:not(:disabled),.mbctl.mbctl .mbctl-trigger[aria-expanded=true],.mbctl.mbctl .mbctl-box:hover:not([data-disabled]),.mbctl.mbctl .mbctl-box[data-open]{border-color:var(--mb-accent,#1f6feb)}
.mbctl.mbctl .mbctl-trigger:focus-visible,.mbctl.mbctl .mbctl-box:focus-within{outline:0;border-color:var(--mb-accent,#1f6feb);box-shadow:0 0 0 3px color-mix(in srgb,var(--mb-accent,#1f6feb) 16%,transparent)}
.mbctl.mbctl .mbctl-trigger:disabled,.mbctl.mbctl .mbctl-box[data-disabled]{opacity:.6;cursor:not-allowed;background:var(--mb-soft,#f4f6f8)}
.mbctl.mbctl [aria-invalid=true].mbctl-trigger,.mbctl.mbctl .mbctl-box[data-invalid]{border-color:var(--mb-danger,#b91c1c)}
.mbctl-value{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mbctl-placeholder{color:var(--mb-muted,#6b7a82)}.mbctl-trigger svg,.mbctl-icon svg{flex-shrink:0;opacity:.65}
.mbctl.mbctl .mbctl-box input.mbctl-text{flex:1;min-width:0;width:100%;min-height:calc(var(--mb-control-height,40px) - 2px);margin:0;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;outline:0;color:inherit;font:inherit;font-size:14px}
.mbctl.mbctl .mbctl-box input.mbctl-text::placeholder{color:var(--mb-muted,#6b7a82);opacity:1}
.mbctl.mbctl .mbctl-icon{display:inline-grid;place-items:center;flex:none;width:28px;height:28px;min-height:0;margin:0 -6px 0 0;padding:0;border:0;border-radius:6px;background:transparent;color:var(--mb-text,#1f2a30);cursor:pointer}.mbctl.mbctl .mbctl-icon:hover:not(:disabled){background:var(--mb-soft,#f1f4f6)}.mbctl.mbctl .mbctl-icon:disabled{cursor:not-allowed}
.mbctl-detail{color:var(--mb-muted,#6b7a82);font-size:12px}.mbctl-pop li[role=option][data-action]{color:var(--mb-accent,#1f6feb);font-weight:500}.mbctl-pop li[role=option][data-action]:not([data-action]+[data-action]){margin-top:4px;border-top:1px solid var(--mb-border,#cfd8dc);border-radius:0 0 6px 6px}
.mbctl-error{display:block;margin-top:4px;font-size:12px;font-weight:500;color:var(--mb-danger,#b91c1c)}
.mbctl-pop{position:fixed;z-index:2147483000;box-sizing:border-box;max-width:calc(100vw - 16px);background:var(--mb-surface,#fff);color:var(--mb-text,#1f2a30);border:1px solid var(--mb-border,#cfd8dc);border-radius:var(--mb-radius,10px);box-shadow:0 14px 34px -10px rgba(15,23,42,.35);font-size:14px;font-weight:400;text-align:left;overflow:hidden}
.mbctl-pop ul{margin:0;padding:4px;list-style:none;max-height:min(300px,45vh);overflow:auto;overscroll-behavior:contain}
.mbctl-pop li[role=option]{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px;border-radius:6px;cursor:pointer;line-height:1.3}.mbctl-pop li[role=option][data-indent]{padding-left:24px}
.mbctl-pop li[role=option]>span:first-child{min-width:0;overflow-wrap:anywhere}.mbctl-pop li[role=option] small{display:block;margin-top:2px;font-size:12px;color:var(--mb-muted,#6b7a82);font-weight:400}
.mbctl-pop li[role=option][data-active]{background:var(--mb-soft,#eef3f6)}.mbctl-pop li[aria-selected=true]{color:var(--mb-accent,#1f6feb);font-weight:600}.mbctl-pop li[aria-disabled=true]{opacity:.45;cursor:not-allowed}
.mbctl-pop li.mbctl-group{padding:8px 10px 3px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--mb-muted,#6b7a82)}.mbctl-pop li.mbctl-note{padding:9px 10px;color:var(--mb-muted,#6b7a82)}
.mbctl-pop.mbctl-pop .mbctl-pop-search{display:block;box-sizing:border-box;width:100%;min-height:42px;margin:0;padding:10px 12px;border:0;border-bottom:1px solid var(--mb-border,#cfd8dc);border-radius:0;background:var(--mb-surface,#fff);color:inherit;font:inherit;font-size:14px;box-shadow:none;outline:0}.mbctl-pop.mbctl-pop .mbctl-pop-search:focus{outline:0;border-bottom-color:var(--mb-accent,#1f6feb);box-shadow:inset 0 -1px 0 var(--mb-accent,#1f6feb)}
.mbctl-cal{padding:10px;width:272px;box-sizing:border-box}.mbctl-cal-head{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:6px}
.mbctl-pop .mbctl-cal button{box-sizing:border-box;margin:0;border:0;background:transparent;color:var(--mb-text,#1f2a30);font:inherit;box-shadow:none;cursor:pointer}
.mbctl-pop .mbctl-cal-head button{min-height:30px;height:30px;padding:0 8px;border-radius:6px;font-size:14px;font-weight:600}.mbctl-pop .mbctl-cal-head button.mbctl-cal-step{width:30px;padding:0;font-size:18px;font-weight:400}.mbctl-pop .mbctl-cal-head button:hover{background:var(--mb-soft,#eef3f6)}
.mbctl-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center}.mbctl-cal-grid>span{font-size:11px;color:var(--mb-muted,#6b7a82);padding:4px 0}
.mbctl-cal-months{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.mbctl-pop .mbctl-cal-months button{min-height:38px;border-radius:6px;font-size:13px}
.mbctl-pop .mbctl-cal-grid button{min-height:32px;height:32px;padding:0;border-radius:6px;font-size:13px}.mbctl-pop .mbctl-cal-grid button:hover:not(:disabled),.mbctl-pop .mbctl-cal-months button:hover:not(:disabled){background:var(--mb-soft,#eef3f6)}
.mbctl-pop .mbctl-cal-grid button[data-other]{color:var(--mb-muted,#6b7a82)}.mbctl-pop .mbctl-cal-grid button[data-today]{box-shadow:inset 0 0 0 1px var(--mb-border,#cfd8dc)}
.mbctl-pop .mbctl-cal button[aria-pressed=true]{background:var(--mb-accent,#1f6feb);color:var(--mb-accent-contrast,#fff);font-weight:600}.mbctl-pop .mbctl-cal button:disabled{opacity:.3;cursor:not-allowed}
.mbctl-pop .mbctl-cal-grid button:focus-visible,.mbctl-pop .mbctl-cal-months button:focus-visible{outline:2px solid var(--mb-accent,#1f6feb);outline-offset:-2px}
.mbctl-cal-foot{display:flex;justify-content:space-between;margin-top:8px}.mbctl-pop .mbctl-cal-foot button{min-height:28px;padding:2px 6px;border-radius:6px;font-size:13px;color:var(--mb-accent,#1f6feb)}
.mbctl-scrim{position:fixed;inset:0;z-index:2147482999;background:rgba(15,23,42,.38)}
.mbctl-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px 10px 16px;border-bottom:1px solid var(--mb-border,#cfd8dc);font-size:16px}.mbctl-sheet-head strong{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mbctl-pop.mbctl-pop .mbctl-sheet-close{display:grid;place-items:center;flex:none;width:44px;height:44px;min-height:0;margin:0;padding:0;border:0;border-radius:8px;background:transparent;color:var(--mb-text,#1f2a30);font-size:26px;line-height:1;cursor:pointer}
.mbctl-pop[data-sheet]{overflow-y:auto;overscroll-behavior:contain;left:0;right:0;width:100%;max-width:100%;min-width:0!important;display:flex;flex-direction:column;border-radius:16px 16px 0 0;border-width:1px 0 0;box-shadow:0 -12px 32px -8px rgba(15,23,42,.35);padding-bottom:env(safe-area-inset-bottom)}
.mbctl-pop[data-sheet] ul{flex:1 1 auto;min-height:0;max-height:none;padding:6px 8px}.mbctl-pop[data-sheet] li[role=option]{min-height:48px;padding:10px 12px;font-size:16px;box-sizing:border-box}.mbctl-pop[data-sheet] li[role=option] small{font-size:13px}.mbctl-pop[data-sheet] li.mbctl-note{padding:14px 12px;font-size:15px}
.mbctl-pop.mbctl-pop[data-sheet] .mbctl-pop-search{flex:none;min-height:52px;padding:12px 16px;font-size:16px}
.mbctl-pop[data-sheet] .mbctl-cal{width:100%;max-width:400px;margin:0 auto;padding:12px 12px 16px}.mbctl-pop[data-sheet] .mbctl-cal-grid button{min-height:44px;height:44px;font-size:16px}@media(max-height:520px){.mbctl-pop[data-sheet] .mbctl-cal-grid button{min-height:36px;height:36px}.mbctl-pop[data-sheet] .mbctl-cal{padding-top:4px}}.mbctl-pop[data-sheet] .mbctl-cal-head button{min-height:44px;height:44px;font-size:16px}.mbctl-pop[data-sheet] .mbctl-cal-head button.mbctl-cal-step{width:44px}.mbctl-pop[data-sheet] .mbctl-cal-months button{min-height:48px;font-size:16px}.mbctl-pop[data-sheet] .mbctl-cal-foot button{min-height:44px;padding:4px 12px;font-size:16px}
@media(max-width:640px){.mbctl.mbctl .mbctl-trigger,.mbctl.mbctl .mbctl-box{min-height:44px;font-size:16px}.mbctl.mbctl .mbctl-box input.mbctl-text{font-size:16px;min-height:42px}.mbctl-detail{font-size:13px}}
.mbctl-datetime-field{container-type:inline-size}.mbctl-datetime{display:grid;grid-template-columns:minmax(0,1fr) minmax(104px,38%);gap:8px}@container (max-width:300px){.mbctl-datetime{grid-template-columns:minmax(0,1fr)}}`;

export function FormControlStyles(): ReactElement { return <style href="mindbill-form-controls" precedence="default">{css}</style>; }

const chevron = <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const calendarIcon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Closes on a press outside `root` and on Escape (without letting Escape close an enclosing dialog). */
function useDismiss(open: boolean, root: RefObject<HTMLElement | null>, close: (focusBack: boolean) => void): void {
  const latest = useRef(close); latest.current = close;
  useEffect(() => {
    if (!open) return;
    const press = (event: Event) => { if (!root.current?.contains(event.target as Node)) latest.current(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); latest.current(true); } };
    document.addEventListener("mousedown", press); document.addEventListener("touchstart", press); document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("mousedown", press); document.removeEventListener("touchstart", press); document.removeEventListener("keydown", key, true); };
  }, [open, root]);
}

let viewportUsers = 0; let viewportDetach: (() => void) | null = null;
/** Publishes the visible viewport (which shrinks when a phone keyboard opens) as --mb-vv-height and --mb-vv-top on <html>,
 * so dialogs and sheets can stay above the keyboard. Shared by every open dialog and sheet. */
export function useVisualViewportVars(active = true): void {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    viewportUsers += 1;
    if (viewportUsers === 1) {
      const root = document.documentElement; const vv = window.visualViewport;
      const update = () => { root.style.setProperty("--mb-vv-height", `${vv ? vv.height : window.innerHeight}px`); root.style.setProperty("--mb-vv-top", `${vv ? vv.offsetTop : 0}px`); };
      update(); vv?.addEventListener("resize", update); vv?.addEventListener("scroll", update); window.addEventListener("resize", update);
      viewportDetach = () => { vv?.removeEventListener("resize", update); vv?.removeEventListener("scroll", update); window.removeEventListener("resize", update); root.style.removeProperty("--mb-vv-height"); root.style.removeProperty("--mb-vv-top"); };
    }
    return () => { viewportUsers -= 1; if (!viewportUsers) { viewportDetach?.(); viewportDetach = null; } };
  }, [active]);
}

/** Phones get lists and calendars as a bottom sheet with large rows instead of a small floating popover. */
function useSheet(): boolean {
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    const query = typeof window === "undefined" ? undefined : window.matchMedia?.("(max-width: 640px)");
    if (!query) return;
    const update = () => setSheet(query.matches); update();
    query.addEventListener?.("change", update); return () => query.removeEventListener?.("change", update);
  }, []);
  return sheet;
}

/** Positions a popover with `position: fixed` next to its anchor so scrolling containers and dialogs never clip it.
 * As a sheet (`data-sheet`), it spans the width and sits at the bottom of the visible viewport, above a phone keyboard. */
function useAnchoredPopover(open: boolean, anchor: RefObject<HTMLElement | null>, pop: RefObject<HTMLElement | null>, align: "start" | "end" = "start", matchWidth = true): void {
  useIsoLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current; const p = pop.current; if (!a || !p) return;
      const vv = window.visualViewport;
      const vw = window.innerWidth || document.documentElement.clientWidth; const vh = vv ? vv.height : window.innerHeight || document.documentElement.clientHeight; const vtop = vv ? vv.offsetTop : 0;
      let top: number; let left: number;
      if (p.dataset.sheet) {
        p.style.maxHeight = `${Math.max(160, vh - 24)}px`;
        top = vtop + vh - p.offsetHeight; left = 0;
      } else {
        const rect = a.getBoundingClientRect();
        if (matchWidth) p.style.minWidth = `${Math.min(rect.width, vw - 16)}px`;
        const height = p.offsetHeight; const width = p.offsetWidth;
        const below = vtop + vh - rect.bottom - 8; const above = rect.top - vtop - 8;
        top = below >= height + 4 || below >= above ? rect.bottom + 4 : rect.top - 4 - height;
        top = Math.max(vtop + 8, Math.min(top, vtop + vh - height - 8));
        left = align === "end" ? rect.right - width : rect.left;
        left = Math.max(8, Math.min(left, vw - width - 8));
      }
      p.style.top = `${top}px`; p.style.left = `${left}px`;
      // A transformed ancestor makes `fixed` relative to itself; correct for any offset.
      const actual = p.getBoundingClientRect();
      if (Math.abs(actual.top - top) > 0.5 || Math.abs(actual.left - left) > 0.5) { p.style.top = `${2 * top - actual.top}px`; p.style.left = `${2 * left - actual.left}px`; }
    };
    place();
    const frame = () => place();
    window.addEventListener("scroll", frame, true); window.addEventListener("resize", frame);
    window.visualViewport?.addEventListener("resize", frame); window.visualViewport?.addEventListener("scroll", frame);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(frame);
    if (observer && pop.current) observer.observe(pop.current);
    return () => { window.removeEventListener("scroll", frame, true); window.removeEventListener("resize", frame); window.visualViewport?.removeEventListener("resize", frame); window.visualViewport?.removeEventListener("scroll", frame); observer?.disconnect(); };
  });
}

/** The title row of a sheet, with a close button. */
function SheetHead({ title, onClose }: { title: string; onClose: () => void }): ReactElement {
  return <div className="mbctl-sheet-head"><strong>{title}</strong><button type="button" className="mbctl-sheet-close" aria-label="Close" onClick={onClose}>×</button></div>;
}
/** Dims the page behind a sheet; tapping it closes the sheet (and never reaches an enclosing label). */
function Scrim({ onClose }: { onClose: () => void }): ReactElement {
  return <div className="mbctl-scrim" aria-hidden="true" onMouseDown={event => event.preventDefault()} onClick={event => { event.preventDefault(); event.stopPropagation(); onClose(); }} />;
}

let focusClaimed = false;
/** Focus the first control that reports itself invalid during one submit attempt. */
function claimFocus(element: HTMLElement | null | undefined): void {
  if (focusClaimed || !element) return; focusClaimed = true; element.focus(); setTimeout(() => { focusClaimed = false; }, 0);
}

/** State for a control that may be controlled (`value`) or uncontrolled (`defaultValue`). */
function useControllable(value: string | undefined, defaultValue: string, onChange?: (value: string) => void): [string, (next: string) => void] {
  const [own, setOwn] = useState(defaultValue); const current = value ?? own;
  const latest = useRef(current); latest.current = current;
  return [current, (next: string) => { if (value === undefined) setOwn(next); if (next !== latest.current) onChange?.(next); latest.current = next; }];
}

/** The visually hidden input that carries the value into forms and constraint validation. */
function Proxy({ proxyRef, name, form, value, required, disabled, onSet, onInvalid }: {
  proxyRef: RefObject<HTMLInputElement | null>; name: string | undefined; form: string | undefined; value: string; required: boolean | undefined; disabled: boolean | undefined;
  onSet: (value: string) => void; onInvalid: () => void;
}): ReactElement {
  return <input ref={proxyRef} className="mbctl-proxy" type="text" tabIndex={-1} aria-hidden="true" autoComplete="off" {...(name ? { name } : {})} {...(form ? { form } : {})}
    value={value} required={required} disabled={disabled} onChange={event => onSet(event.target.value)} onInvalid={event => { event.preventDefault(); onInvalid(); }} />;
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}
type OptionElementProps = { value?: string | number; children?: ReactNode; label?: string; disabled?: boolean; hidden?: boolean };
/** Reads `<option>`/`<optgroup>` children (also inside fragments and arrays) into options. */
export function optionsFromChildren(children: ReactNode, group?: string, out: SelectOption[] = []): SelectOption[] {
  Children.forEach(children, child => {
    if (!isValidElement(child)) return;
    const props = child.props as OptionElementProps & { label?: string };
    if (child.type === Fragment) optionsFromChildren(props.children, group, out);
    else if (child.type === "optgroup") optionsFromChildren(props.children, props.label ? String(props.label) : group, out);
    else if (child.type === "option") {
      const label = textOf(props.children) || String(props.label ?? "");
      out.push({ value: props.value === undefined ? label : String(props.value), label, ...(group ? { group } : {}), ...(props.disabled ? { disabled: true } : {}), ...(props.hidden ? { hidden: true } : {}) });
    }
  });
  return out;
}

const matches = (option: SelectOption, needle: string) => { if (!needle) return true; const haystack = `${option.label} ${option.description ?? ""} ${option.group ?? ""}`.toLowerCase(); return needle.split(/\s+/).every(word => haystack.includes(word)); };

/** A styled single-choice dropdown. Long lists get a search box. */
export function Select(props: SelectProps): ReactElement {
  const { id, name, form, value, defaultValue = "", onChange, options: optionList, children, placeholder = "Choose…", label, required, disabled, className, style, title,
    searchable: searchableProp, onSearch, filter = !onSearch, error, onOpen, loading, searchPlaceholder, allowCustom, allowEmpty, align, requiredMessage, autoFocus, detailInField } = props;
  const all = useMemo(() => optionList ?? optionsFromChildren(children), [optionList, children]);
  const [current, commit] = useControllable(value, defaultValue, onChange);
  const known = all.some(option => option.value === current);
  // Like a native select, an unknown value falls back to the first available option.
  const effective = known || allowCustom || allowEmpty || !all.length ? current : (all.find(option => !option.disabled && !option.hidden)?.value ?? current);
  const selected = all.find(option => option.value === effective);
  const searchable = searchableProp ?? (Boolean(onSearch) || all.length > 12);
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(""); const [active, setActive] = useState(0); const [invalid, setInvalid] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null); const triggerRef = useRef<HTMLButtonElement>(null); const popRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null); const proxyRef = useRef<HTMLInputElement>(null); const typed = useRef({ text: "", at: 0 });
  const baseId = useId(); const listId = `${baseId}-list`;
  const needle = query.trim().toLowerCase();
  const listed = useMemo(() => {
    const visible = all.filter(option => !option.hidden && (!filter || !needle || (option.value !== "" && matches(option, needle))));
    visible.sort((a, b) => Number(Boolean(a.action)) - Number(Boolean(b.action)));
    if (allowCustom && query.trim() && !all.some(option => option.label.toLowerCase() === needle || option.value.toLowerCase() === needle)) visible.push({ value: query.trim(), label: `Use “${query.trim()}”`, action: true });
    return visible;
  }, [all, needle, query, allowCustom, filter]);
  const regular = listed.filter(option => !option.action);
  const close = (focusBack: boolean) => { setOpen(false); if (query && onSearch) onSearch(""); setQuery(""); if (focusBack) triggerRef.current?.focus(); };
  useDismiss(open, rootRef, close);
  useAnchoredPopover(open, triggerRef, popRef, align);
  const sheet = useSheet(); useVisualViewportVars(open && sheet);
  useEffect(() => { if (open && searchable) searchRef.current?.focus(); }, [open, searchable]);
  useEffect(() => { if (!open) return; const node = popRef.current?.querySelector<HTMLElement>("[data-active]"); node?.scrollIntoView?.({ block: "nearest" }); }, [active, open]);
  useEffect(() => { if (effective || !required) setInvalid(false); }, [effective, required]);
  const pick = (next: string) => { commit(next); setInvalid(false); close(true); };
  const start = (seed = "") => {
    if (disabled) return; onOpen?.(); setQuery(seed); if (seed) onSearch?.(seed);
    const index = seed ? 0 : listed.findIndex(option => option.value === effective);
    setActive(Math.max(0, index)); setOpen(true);
  };
  const move = (delta: number | "first" | "last") => setActive(index => {
    if (!listed.length) return 0;
    let next = delta === "first" ? 0 : delta === "last" ? listed.length - 1 : index + delta;
    next = Math.max(0, Math.min(listed.length - 1, next));
    const step = delta === "last" || (typeof delta === "number" && delta < 0) ? -1 : 1;
    while (listed[next]?.disabled && next + step >= 0 && next + step < listed.length) next += step;
    return next;
  });
  const listKeys = (event: ReactKeyboardEvent) => {
    if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
    else if (event.key === "Home" && !searchable) { event.preventDefault(); move("first"); }
    else if (event.key === "End" && !searchable) { event.preventDefault(); move("last"); }
    else if (event.key === "PageDown") { event.preventDefault(); move(8); }
    else if (event.key === "PageUp") { event.preventDefault(); move(-8); }
    else if (event.key === "Enter") { event.preventDefault(); const option = listed[active]; if (option && !option.disabled) pick(option.value); }
    else if (event.key === "Tab") close(false);
    else return false;
    return true;
  };
  const typeahead = (key: string) => {
    const now = Date.now(); typed.current = { text: now - typed.current.at < 700 ? typed.current.text + key.toLowerCase() : key.toLowerCase(), at: now };
    const index = listed.findIndex(option => !option.disabled && option.label.toLowerCase().startsWith(typed.current.text));
    if (index >= 0) setActive(index);
  };
  const shown = selected?.label ?? (allowCustom && effective ? effective : "");
  const accessibleName = props["aria-label"] ?? (label ? `${label}: ${shown || placeholder}` : undefined);
  const activeId = open && listed[active] ? `${baseId}-opt-${active}` : undefined;
  return <div className={`mbctl mbctl-select${className ? ` ${className}` : ""}`} ref={rootRef} {...(style ? { style } : {})} data-value={effective} data-open={open || undefined}>
    <style href="mindbill-form-controls" precedence="default">{css}</style>
    <button ref={triggerRef} type="button" className="mbctl-trigger" {...(id ? { id } : {})} {...(title ? { title } : {})} disabled={disabled} autoFocus={autoFocus}
      role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={!searchable ? activeId : undefined}
      aria-required={required || undefined} aria-invalid={invalid || undefined}
      {...(accessibleName ? { "aria-label": accessibleName } : {})} {...(props["aria-labelledby"] ? { "aria-labelledby": props["aria-labelledby"] } : {})} {...(props["aria-describedby"] ? { "aria-describedby": props["aria-describedby"] } : {})}
      onClick={() => { if (open) close(false); else start(); }}
      onKeyDown={event => {
        if (!open) {
          if (["ArrowDown", "ArrowUp", "Enter", " ", "F4"].includes(event.key) || (event.altKey && event.key === "ArrowDown")) { event.preventDefault(); start(); }
          else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && searchable) { event.preventDefault(); start(event.key); }
          else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) { start(); typeahead(event.key); }
          return;
        }
        if (listKeys(event)) return;
        if (event.key === " ") { event.preventDefault(); const option = listed[active]; if (option && !option.disabled) pick(option.value); }
        else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) typeahead(event.key);
      }}>
      <span className={`mbctl-value${effective ? "" : " mbctl-placeholder"}`}>{shown || placeholder}{selected?.description && detailInField ? <small className="mbctl-detail"> · {selected.description}</small> : null}</span>{chevron}
    </button>
    {name || required ? <Proxy proxyRef={proxyRef} name={name} form={form} value={effective} required={required} disabled={disabled} onSet={next => commit(next)} onInvalid={() => { setInvalid(true); claimFocus(triggerRef.current); }} /> : null}
    {invalid && !effective ? <span className="mbctl-error" aria-live="polite">{requiredMessage ?? `Choose ${label ? label.toLowerCase() : "an option"}.`}</span> : null}
    {open && sheet ? <Scrim onClose={() => close(true)} /> : null}
    {open ? <div className="mbctl-pop" ref={popRef} data-sheet={sheet || undefined} onClick={event => event.preventDefault()} onMouseDown={event => { if (event.target !== searchRef.current) event.preventDefault(); }}>
      {sheet ? <SheetHead title={label ?? props["aria-label"]?.split(":")[0] ?? placeholder} onClose={() => close(true)} /> : null}
      {searchable ? <input ref={searchRef} type="text" className="mbctl-pop-search" role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" {...(activeId ? { "aria-activedescendant": activeId } : {})}
        placeholder={searchPlaceholder ?? (allowCustom ? "Search or type a new value" : "Type to search")} aria-label={`Search ${label ? label.toLowerCase() : "options"}`} value={query} autoComplete="off"
        onChange={event => { setQuery(event.target.value); setActive(0); onSearch?.(event.target.value); }} onKeyDown={event => { listKeys(event); }} /> : null}
      <ul role="listbox" id={listId} {...(accessibleName || label ? { "aria-label": label ?? accessibleName } : {})}>
        {error ? <li className="mbctl-note" role="alert">{error}</li> : loading && !regular.length ? <li className="mbctl-note" role="status">Searching…</li>
          : !regular.length ? <li className="mbctl-note">{needle ? `No matches for “${query.trim()}”` : listed.length ? "Nothing saved yet" : "No options"}</li> : null}
        {listed.map((option, index) => <Fragment key={`${option.value}\u0000${index}`}>
            {option.group && option.group !== listed[index - 1]?.group ? <li role="presentation" className="mbctl-group">{option.group}</li> : null}
            <li role="option" id={`${baseId}-opt-${index}`} aria-selected={option.value === effective && selected !== undefined} aria-disabled={option.disabled || undefined} data-indent={option.indent || undefined} data-action={option.action || undefined} data-value={option.value}
              data-active={index === active || undefined} onMouseEnter={() => setActive(index)} onClick={() => { if (!option.disabled) pick(option.value); }}>
              <span>{option.label}{option.description ? <small>{option.description}</small> : null}</span>{option.value === effective && option.value && selected ? <span aria-hidden="true">✓</span> : null}
            </li>
          </Fragment>)}
      </ul>
    </div> : null}
  </div>;
}

// ---------- dates and times ----------

const pad = (value: number) => String(value).padStart(2, "0");
export const isoDate = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const validDate = (year: number, month: number, day: number): Date | null => {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(year, month - 1, day); date.setFullYear(year);
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};
const fromIso = (value: string | undefined): Date | null => { const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? ""); return match ? validDate(Number(match[1]), Number(match[2]), Number(match[3])) : null; };
/** "YYYY-MM-DD" → "MM/DD/YYYY". */
export const formatDateText = (value: string): string => { const date = fromIso(value); return date ? `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}` : ""; };
/** Typed date → "YYYY-MM-DD", or null. Accepts MM/DD/YYYY, M/D/YYYY, MM-DD-YYYY, MMDDYYYY, YYYY-MM-DD and, unless `strict`, two-digit years. */
export function parseDateText(text: string, strict = false): string | null {
  const value = text.trim(); let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (match) { const date = validDate(Number(match[1]), Number(match[2]), Number(match[3])); return date ? isoDate(date) : null; }
  match = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4}|\d{2})$/.exec(value) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(value);
  if (!match) return null;
  let year = Number(match[3]);
  if (match[3]!.length === 2) { if (strict) return null; const century = Math.floor(new Date().getFullYear() / 100) * 100; year += century; if (year > new Date().getFullYear() + 10) year -= 100; }
  const date = validDate(year, Number(match[1]), Number(match[2])); return date ? isoDate(date) : null;
}
/** Typed time → "HH:mm", or null. Accepts "3:00 PM", "3pm", "3:00p", "15:30", "1530". */
export function parseTimeText(text: string): string | null {
  const match = /^\s*(\d{1,2})(?::?(\d{2}))?\s*(a|p|am|pm|a\.m\.|p\.m\.)?\s*$/i.exec(text);
  if (!match) return null;
  let hour = Number(match[1]); const minute = Number(match[2] ?? "0"); const meridiem = match[3]?.toLowerCase().replace(/\./g, "")[0];
  if (minute > 59 || hour > 23 || (meridiem && (hour < 1 || hour > 12))) return null;
  if (meridiem === "p" && hour < 12) hour += 12; if (meridiem === "a" && hour === 12) hour = 0;
  return `${pad(hour)}:${pad(minute)}`;
}
/** "15:30" → "3:30 PM". */
export const formatTimeText = (value: string): string => { const match = /^(\d{2}):(\d{2})/.exec(value); if (!match) return ""; const hour = Number(match[1]); return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`; };
const longDate = (value: string) => { const date = fromIso(value); return date ? date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""; };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Calendar({ value, min, max, onPick, onClear, onClose }: { value: string; min?: string; max?: string; onPick: (iso: string) => void; onClear?: () => void; onClose: () => void }): ReactElement {
  const selected = fromIso(value); const today = new Date(); const todayIso = isoDate(today);
  const minIso = min?.slice(0, 10) ?? ""; const maxIso = max?.slice(0, 10) ?? "";
  const allowed = (iso: string) => (!minIso || iso >= minIso) && (!maxIso || iso <= maxIso);
  const [focus, setFocus] = useState(() => { const base = selected ?? (maxIso && todayIso > maxIso ? fromIso(maxIso) : minIso && todayIso < minIso ? fromIso(minIso) : null) ?? today; return isoDate(base); });
  const [view, setView] = useState<"days" | "months">("days");
  const focusDate = fromIso(focus) ?? today; const month = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const gridRef = useRef<HTMLDivElement>(null); const moved = useRef(false);
  useEffect(() => { gridRef.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus(); }, [view]);
  useEffect(() => { if (moved.current) { moved.current = false; gridRef.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus(); } }, [focus]);
  const days = useMemo(() => { const start = new Date(month); start.setDate(1 - month.getDay()); return Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; }); }, [month.getTime()]);
  const shift = (days: number, months = 0) => { const next = new Date(focusDate); if (months) { next.setDate(1); next.setMonth(next.getMonth() + months); next.setDate(Math.min(focusDate.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())); } else next.setDate(next.getDate() + days); moved.current = true; setFocus(isoDate(next)); };
  const dayKeys = (event: ReactKeyboardEvent) => {
    const map: Record<string, () => void> = { ArrowLeft: () => shift(-1), ArrowRight: () => shift(1), ArrowUp: () => shift(-7), ArrowDown: () => shift(7), PageUp: () => shift(0, event.shiftKey ? -12 : -1), PageDown: () => shift(0, event.shiftKey ? 12 : 1), Home: () => shift(-focusDate.getDay()), End: () => shift(6 - focusDate.getDay()) };
    const action = map[event.key]; if (action) { event.preventDefault(); action(); }
  };
  const year = focusDate.getFullYear();
  return <div className="mbctl-cal">
    <div className="mbctl-cal-head">
      <button type="button" className="mbctl-cal-step" aria-label={view === "days" ? "Previous month" : "Previous year"} onClick={() => view === "days" ? shift(0, -1) : shift(0, -12)}>‹</button>
      <button type="button" aria-label={view === "days" ? `${month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}, choose month and year` : `${year}, back to days`} onClick={() => setView(state => state === "days" ? "months" : "days")}>{view === "days" ? month.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : year}</button>
      <button type="button" className="mbctl-cal-step" aria-label={view === "days" ? "Next month" : "Next year"} onClick={() => view === "days" ? shift(0, 1) : shift(0, 12)}>›</button>
    </div>
    {view === "days" ? <div className="mbctl-cal-grid" ref={gridRef} role="grid" aria-label={month.toLocaleDateString("en-US", { month: "long", year: "numeric" })} onKeyDown={dayKeys}>
      {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => <span key={day} aria-hidden="true">{day}</span>)}
      {days.map(day => { const iso = isoDate(day); return <button key={iso} type="button" tabIndex={iso === focus ? 0 : -1} aria-pressed={iso === value.slice(0, 10)} aria-label={longDate(iso)} data-iso={iso}
        data-other={day.getMonth() !== month.getMonth() || undefined} data-today={iso === todayIso || undefined} disabled={!allowed(iso)} onClick={() => onPick(iso)}>{day.getDate()}</button>; })}
    </div> : <div className="mbctl-cal-months" ref={gridRef}>
      {MONTHS.map((name, index) => { const first = isoDate(new Date(year, index, 1)); const last = isoDate(new Date(year, index + 1, 0)); const usable = (!minIso || last >= minIso) && (!maxIso || first <= maxIso);
        return <button key={name} type="button" tabIndex={index === focusDate.getMonth() ? 0 : -1} aria-pressed={index === focusDate.getMonth()} disabled={!usable} onClick={() => { const next = new Date(year, index, Math.min(focusDate.getDate(), new Date(year, index + 1, 0).getDate())); setFocus(isoDate(next)); setView("days"); }}>{name}</button>; })}
    </div>}
    <div className="mbctl-cal-foot">{onClear ? <button type="button" onClick={onClear}>Clear</button> : <button type="button" onClick={onClose}>Close</button>}<button type="button" disabled={!allowed(todayIso)} onClick={() => onPick(todayIso)}>Today</button></div>
  </div>;
}

/** Keeps typed text in step with a value that can also change from outside. */
function useTypedText(current: string, format: (value: string) => string): [string, (text: string) => void, RefObject<string>] {
  const [text, setText] = useState(() => format(current)); const committed = useRef(current);
  useEffect(() => { if (current !== committed.current) { committed.current = current; setText(format(current)); } }, [current]);
  return [text, setText, committed];
}

/** A typed date with a calendar. Value "YYYY-MM-DD". */
export function DateField(props: DateFieldProps): ReactElement {
  const { id, name, form, value, defaultValue = "", onChange, min, max, label, placeholder = "MM/DD/YYYY", required, disabled, className, style, title, requiredMessage, autoFocus } = props;
  const [current, commitRaw] = useControllable(value === undefined ? undefined : value.slice(0, 10), defaultValue.slice(0, 10), onChange);
  const [text, setText, committed] = useTypedText(current, formatDateText);
  const [open, setOpen] = useState(false); const [problem, setProblem] = useState(""); const [invalid, setInvalid] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null); const boxRef = useRef<HTMLDivElement>(null); const inputRef = useRef<HTMLInputElement>(null); const popRef = useRef<HTMLDivElement>(null); const proxyRef = useRef<HTMLInputElement>(null);
  const minIso = min?.slice(0, 10); const maxIso = max?.slice(0, 10);
  const range = (iso: string) => minIso && iso < minIso ? `Choose a date on or after ${formatDateText(minIso)}.` : maxIso && iso > maxIso ? `Choose a date on or before ${formatDateText(maxIso)}.` : "";
  const commit = (iso: string) => { committed.current = iso; commitRaw(iso); setProblem(iso ? range(iso) : ""); setInvalid(false); };
  const close = (focusBack: boolean) => { setOpen(false); if (focusBack) inputRef.current?.focus(); };
  useDismiss(open, rootRef, close);
  useAnchoredPopover(open, boxRef, popRef, "start", false);
  const sheet = useSheet(); useVisualViewportVars(open && sheet);
  useEffect(() => { proxyRef.current?.setCustomValidity?.(problem); }, [problem]);
  useEffect(() => { if (current) setProblem(previous => previous && !previous.startsWith("Enter") ? range(current) : previous); }, [minIso, maxIso]);
  const settle = (strict: boolean) => {
    const trimmed = text.trim();
    if (!trimmed) { if (current) commit(""); setProblem(""); return; }
    const iso = parseDateText(trimmed, strict);
    if (iso) { commit(iso); if (!strict) setText(formatDateText(iso)); }
    else if (!strict) { if (current) { committed.current = ""; commitRaw(""); } setProblem("Enter a date as MM/DD/YYYY."); }
  };
  const accessibleName = props["aria-label"] ?? label;
  const message = invalid && !current && !problem ? requiredMessage ?? `Enter ${label ? label.toLowerCase() : "a date"}.` : problem;
  return <div className={`mbctl mbctl-date${className ? ` ${className}` : ""}`} ref={rootRef} {...(style ? { style } : {})}>
    <style href="mindbill-form-controls" precedence="default">{css}</style>
    <div className="mbctl-box" ref={boxRef} data-open={open || undefined} data-disabled={disabled || undefined} data-invalid={message ? true : undefined}>
      <input ref={inputRef} className="mbctl-text" type="text" inputMode="numeric" autoComplete="off" {...(id ? { id } : {})} {...(title ? { title } : {})} placeholder={placeholder} value={text} disabled={disabled} autoFocus={autoFocus}
        {...(accessibleName ? { "aria-label": accessibleName } : {})} {...(props["aria-labelledby"] ? { "aria-labelledby": props["aria-labelledby"] } : {})} {...(props["aria-describedby"] ? { "aria-describedby": props["aria-describedby"] } : {})}
        aria-required={required || undefined} aria-invalid={message ? true : undefined}
        onChange={event => { setText(event.target.value); const iso = parseDateText(event.target.value, true); if (iso) commit(iso); else if (!event.target.value.trim()) commit(""); }}
        onBlur={() => settle(false)}
        onKeyDown={event => { if ((event.altKey && event.key === "ArrowDown") || event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } else if (event.key === "Enter") { settle(false); } }} />
      <button type="button" className="mbctl-icon" aria-label={`Choose ${accessibleName ? accessibleName.toLowerCase() : "date"} from a calendar`} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => { if (open) close(false); else { settle(false); setOpen(true); } }}>{calendarIcon}</button>
    </div>
    <Proxy proxyRef={proxyRef} name={name} form={form} value={current} required={required} disabled={disabled}
      onSet={next => { const iso = next ? parseDateText(next) : ""; if (iso !== null) { commit(iso); setText(formatDateText(iso)); } }}
      onInvalid={() => { setInvalid(true); claimFocus(inputRef.current); }} />
    {message ? <span className="mbctl-error" aria-live="polite">{message}</span> : null}
    {open && sheet ? <Scrim onClose={() => close(true)} /> : null}
    {open ? <div className="mbctl-pop" ref={popRef} data-sheet={sheet || undefined} role="dialog" aria-label={accessibleName ? `Choose ${accessibleName.toLowerCase()}` : "Choose a date"} onMouseDown={event => event.preventDefault()} onClick={event => event.preventDefault()}>
      {sheet ? <SheetHead title={accessibleName ?? "Choose a date"} onClose={() => close(true)} /> : null}
      <Calendar value={current} {...(minIso ? { min: minIso } : {})} {...(maxIso ? { max: maxIso } : {})} onClose={() => close(true)}
        onPick={iso => { commit(iso); setText(formatDateText(iso)); close(true); }} {...(!required ? { onClear: () => { commit(""); setText(""); close(true); } } : {})} />
    </div> : null}
  </div>;
}

/** A typed time such as "3:00 PM". Value "HH:mm" (24-hour). */
export function TimeField(props: TimeFieldProps): ReactElement {
  const { id, name, form, value, defaultValue = "", onChange, label, placeholder = "e.g. 3:00 PM", required, disabled, className, style, title, requiredMessage, autoFocus } = props;
  const [current, commitRaw] = useControllable(value === undefined ? undefined : value.slice(0, 5), defaultValue.slice(0, 5), onChange);
  const [text, setText, committed] = useTypedText(current, formatTimeText);
  const [problem, setProblem] = useState(""); const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null); const proxyRef = useRef<HTMLInputElement>(null);
  const commit = (time: string) => { committed.current = time; commitRaw(time); setProblem(""); setInvalid(false); };
  useEffect(() => { proxyRef.current?.setCustomValidity?.(problem); }, [problem]);
  const settle = () => {
    const trimmed = text.trim(); if (!trimmed) { commit(""); return; }
    const time = parseTimeText(trimmed);
    if (time) { commit(time); setText(formatTimeText(time)); } else { committed.current = ""; commitRaw(""); setProblem("Enter a time like 3:00 PM."); }
  };
  const accessibleName = props["aria-label"] ?? label;
  const message = invalid && !current && !problem ? requiredMessage ?? `Enter ${label ? label.toLowerCase() : "a time"}.` : problem;
  return <div className={`mbctl mbctl-time${className ? ` ${className}` : ""}`} {...(style ? { style } : {})}>
    <style href="mindbill-form-controls" precedence="default">{css}</style>
    <div className="mbctl-box" data-disabled={disabled || undefined} data-invalid={message ? true : undefined}>
      <input ref={inputRef} className="mbctl-text" type="text" inputMode="text" autoComplete="off" {...(id ? { id } : {})} {...(title ? { title } : {})} placeholder={placeholder} value={text} disabled={disabled} autoFocus={autoFocus}
        {...(accessibleName ? { "aria-label": accessibleName } : {})} {...(props["aria-labelledby"] ? { "aria-labelledby": props["aria-labelledby"] } : {})} {...(props["aria-describedby"] ? { "aria-describedby": props["aria-describedby"] } : {})}
        aria-required={required || undefined} aria-invalid={message ? true : undefined}
        onChange={event => { setText(event.target.value); setProblem(""); const time = /\d{1,2}:\d{2}\s*(am|pm|a|p)?$/i.test(event.target.value.trim()) || /^\s*\d{1,2}\s*(am|pm)\s*$/i.test(event.target.value) ? parseTimeText(event.target.value) : null; if (time) commit(time); }}
        onBlur={settle} onKeyDown={event => { if (event.key === "Enter") settle(); }} />
    </div>
    <Proxy proxyRef={proxyRef} name={name} form={form} value={current} required={required} disabled={disabled}
      onSet={next => { const time = next ? parseTimeText(next) : ""; if (time !== null) { commit(time); setText(formatTimeText(time)); } }}
      onInvalid={() => { setInvalid(true); claimFocus(inputRef.current); }} />
    {message ? <span className="mbctl-error" aria-live="polite">{message}</span> : null}
  </div>;
}

/** A date and a typed time. Value "YYYY-MM-DDTHH:mm" in the viewer's local time. */
export function DateTimeField(props: DateTimeFieldProps): ReactElement {
  const { id, name, form, value, defaultValue = "", onChange, min, max, label, required, disabled, className, style, requiredMessage, autoFocus } = props;
  const [current, commit] = useControllable(value, defaultValue, onChange);
  const split = (combined: string) => ({ date: /^\d{4}-\d{2}-\d{2}/.test(combined) ? combined.slice(0, 10) : "", time: /T\d{2}:\d{2}/.test(combined) ? combined.slice(11, 16) : "" });
  const [parts, setParts] = useState(() => split(current)); const last = useRef(current);
  useEffect(() => { if (current !== last.current) { last.current = current; setParts(split(current)); } }, [current]);
  const [invalid, setInvalid] = useState(false); const proxyRef = useRef<HTMLInputElement>(null); const rootRef = useRef<HTMLDivElement>(null);
  const update = (next: { date: string; time: string }) => { setParts(next); const combined = next.date && next.time ? `${next.date}T${next.time}` : ""; last.current = combined; commit(combined); if (combined) setInvalid(false); };
  const missingTime = Boolean(parts.date && !parts.time); const missingDate = Boolean(!parts.date && parts.time);
  const problem = missingTime ? "Enter a time like 3:00 PM." : missingDate ? "Enter a date." : "";
  useEffect(() => { proxyRef.current?.setCustomValidity?.(problem); }, [problem]);
  const combined = parts.date && parts.time ? `${parts.date}T${parts.time}` : "";
  const name_ = props["aria-label"] ?? label;
  return <div className={`mbctl mbctl-datetime-field${className ? ` ${className}` : ""}`} ref={rootRef} {...(style ? { style } : {})}>
    <div className="mbctl-datetime">
      <DateField {...(id ? { id } : {})} value={parts.date} onChange={date => update({ ...parts, date })} disabled={disabled} autoFocus={autoFocus}
        {...(name_ ? { "aria-label": /date/i.test(name_) ? name_ : `${name_} date` } : {})} {...(min ? { min: min.slice(0, 10) } : {})} {...(max ? { max: max.slice(0, 10) } : {})} {...(props["aria-describedby"] ? { "aria-describedby": props["aria-describedby"] } : {})} />
      <TimeField value={parts.time} onChange={time => update({ ...parts, time })} disabled={disabled} {...(name_ ? { "aria-label": `${name_} time` } : { "aria-label": "Time" })} />
    </div>
    <Proxy proxyRef={proxyRef} name={name} form={form} value={combined} required={required} disabled={disabled}
      onSet={next => { const value_ = split(next); if (next === "" || (value_.date && value_.time)) update(value_); }}
      onInvalid={() => { setInvalid(true); claimFocus(rootRef.current?.querySelector<HTMLInputElement>(parts.date ? ".mbctl-time input" : ".mbctl-date input")); }} />
    {invalid && !combined && !problem ? <span className="mbctl-error" aria-live="polite">{requiredMessage ?? `Enter ${label ? label.toLowerCase() : "a date and time"}.`}</span> : problem && invalid ? <span className="mbctl-error" aria-live="polite">{problem}</span> : null}
  </div>;
}

export type MultiSelectProps = Omit<SelectProps, "value" | "defaultValue" | "onChange" | "allowCustom"> & {
  value?: readonly string[] | undefined; defaultValue?: readonly string[] | undefined; onChange?: ((value: string[]) => void) | undefined;
};

/** A styled multiple-choice list. Each chosen value is submitted under `name`, like a native `<select multiple>`. */
export function MultiSelect(props: MultiSelectProps): ReactElement {
  const { id, name, form, value, defaultValue = [], onChange, options: optionList, children, placeholder = "Choose…", label, required, disabled, className, style, title, searchable: searchableProp, searchPlaceholder, align, requiredMessage } = props;
  const all = useMemo(() => (optionList ?? optionsFromChildren(children)).filter(option => option.value !== ""), [optionList, children]);
  const [own, setOwn] = useState<readonly string[]>(defaultValue); const current = value ?? own;
  const chosen = all.filter(option => current.includes(option.value));
  const searchable = searchableProp ?? all.length > 12;
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(""); const [active, setActive] = useState(0); const [invalid, setInvalid] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null); const triggerRef = useRef<HTMLButtonElement>(null); const popRef = useRef<HTMLDivElement>(null); const searchRef = useRef<HTMLInputElement>(null); const proxyRef = useRef<HTMLInputElement>(null);
  const baseId = useId(); const listId = `${baseId}-list`; const needle = query.trim().toLowerCase();
  const listed = all.filter(option => !option.hidden && matches(option, needle));
  const close = (focusBack: boolean) => { setOpen(false); setQuery(""); if (focusBack) triggerRef.current?.focus(); };
  useDismiss(open, rootRef, close); useAnchoredPopover(open, triggerRef, popRef, align);
  const sheet = useSheet(); useVisualViewportVars(open && sheet);
  useEffect(() => { if (open && searchable) searchRef.current?.focus(); }, [open, searchable]);
  const toggle = (next: string) => { const updated = current.includes(next) ? current.filter(item => item !== next) : [...current, next]; if (value === undefined) setOwn(updated); onChange?.(updated); if (updated.length) setInvalid(false); };
  const keys = (event: ReactKeyboardEvent) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => Math.min(listed.length - 1, index + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
    else if (event.key === "Enter" || (event.key === " " && !searchable)) { event.preventDefault(); const option = listed[active]; if (option && !option.disabled) toggle(option.value); }
    else if (event.key === "Tab") close(false);
  };
  const shown = chosen.length === 0 ? "" : chosen.length === 1 ? chosen[0]!.label : `${chosen.length} selected`;
  const accessibleName = props["aria-label"] ?? (label ? `${label}: ${shown || placeholder}` : undefined);
  const activeId = open && listed[active] ? `${baseId}-opt-${active}` : undefined;
  return <div className={`mbctl mbctl-select${className ? ` ${className}` : ""}`} ref={rootRef} {...(style ? { style } : {})}>
    <style href="mindbill-form-controls" precedence="default">{css}</style>
    <button ref={triggerRef} type="button" className="mbctl-trigger" {...(id ? { id } : {})} {...(title ? { title } : {})} disabled={disabled} role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-activedescendant={!searchable ? activeId : undefined} aria-required={required || undefined} aria-invalid={invalid || undefined} {...(accessibleName ? { "aria-label": accessibleName } : {})}
      onClick={() => { if (open) close(false); else { setActive(0); setOpen(true); } }}
      onKeyDown={event => { if (!open) { if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) { event.preventDefault(); setActive(0); setOpen(true); } return; } keys(event); }}>
      <span className={`mbctl-value${shown ? "" : " mbctl-placeholder"}`}>{shown || placeholder}</span>{chevron}
    </button>
    {current.length ? current.map(item => <input key={item} type="hidden" {...(name ? { name } : {})} {...(form ? { form } : {})} value={item} disabled={disabled} />)
      : required ? <Proxy proxyRef={proxyRef} name={undefined} form={form} value="" required disabled={disabled} onSet={() => undefined} onInvalid={() => { setInvalid(true); claimFocus(triggerRef.current); }} /> : null}
    {invalid && !current.length ? <span className="mbctl-error" aria-live="polite">{requiredMessage ?? `Choose at least one ${label ? label.toLowerCase() : "option"}.`}</span> : null}
    {open && sheet ? <Scrim onClose={() => close(true)} /> : null}
    {open ? <div className="mbctl-pop" ref={popRef} data-sheet={sheet || undefined} onClick={event => event.preventDefault()} onMouseDown={event => { if (event.target !== searchRef.current) event.preventDefault(); }}>
      {sheet ? <SheetHead title={label ?? placeholder} onClose={() => close(true)} /> : null}
      {searchable ? <input ref={searchRef} type="text" className="mbctl-pop-search" aria-label={`Search ${label ? label.toLowerCase() : "options"}`} placeholder={searchPlaceholder ?? "Type to search"} value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={keys} {...(activeId ? { "aria-activedescendant": activeId } : {})} /> : null}
      <ul role="listbox" id={listId} aria-multiselectable="true" {...(label ? { "aria-label": label } : {})}>
        {!listed.length ? <li className="mbctl-note">{needle ? `No matches for “${query.trim()}”` : "No options"}</li> : listed.map((option, index) => <li key={option.value} role="option" id={`${baseId}-opt-${index}`} aria-selected={current.includes(option.value)} aria-disabled={option.disabled || undefined} data-value={option.value}
          data-active={index === active || undefined} onMouseEnter={() => setActive(index)} onClick={() => { if (!option.disabled) toggle(option.value); }}><span>{option.label}</span>{current.includes(option.value) ? <span aria-hidden="true">✓</span> : null}</li>)}
      </ul>
    </div> : null}
  </div>;
}
