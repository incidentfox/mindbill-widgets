"use client";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";
export type TreatmentDraftAppearance = { appearance?: MindBillReactAppearance; className?: string; style?: CSSProperties; disabled?: boolean };
export function useDraftSave<T>(onSave: (value: T) => Promise<void>) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const clear = () => { setMessage(""); setError(null); };
  const save = async (value: T, failure: string | null) => {
    if (pending.current) return;
    clear();
    if (failure) { setError(failure); return; }
    pending.current = true; setBusy(true);
    try { await onSave(value); setMessage("Draft saved."); }
    catch { setError("The draft could not be saved. Review its status before retrying."); }
    finally { pending.current = false; setBusy(false); }
  };
  return { busy, message, error, clear, save };
}
export function TreatmentDraftShell({ title, description, children, hideHeading = false, appearance, className = "", style }: TreatmentDraftAppearance & { title: string; description: string; children: ReactNode; hideHeading?: boolean }) {
  return <section className={`mbtd ${className}`.trim()} aria-label={title} style={{ ...mindBillAppearanceStyle(appearance), ...style }}>
    <style>{`.mbtd{font:14px/1.5 ui-sans-serif,system-ui,sans-serif;color:var(--mb-text);min-width:0}.mbtd *{box-sizing:border-box}.mbtd h2{font-size:22px;margin:0 0 6px}.mbtd p{margin:6px 0 16px;color:var(--mb-muted)}.mbtd form{display:grid;gap:16px}.mbtd fieldset{margin:0;padding:16px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);min-width:0}.mbtd legend{font-weight:600;padding:0 6px}.mbtd .mbtd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mbtd label{display:grid;gap:5px;font-size:13px;min-width:0}.mbtd input,.mbtd select,.mbtd textarea,.mbtd button{font:inherit;max-width:100%;min-width:0;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);padding:9px 11px;color:var(--mb-text);background:var(--mb-input);min-height:40px}.mbtd .mbrfa-check{display:flex;align-items:flex-start;gap:8px}.mbtd .mbrfa-check input[type=checkbox]{width:16px;height:16px;min-height:16px;margin:2px 0 0;padding:0;flex-shrink:0}
.mbtd .mbrfa-request-details>.mbtd-grid{display:flex;flex-direction:column;gap:12px}
.mbtd .mbrfa-request-types{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding-bottom:12px;border-bottom:1px solid var(--mb-border)}
.mbtd .mbrfa-request-details .mbrfa-check{min-height:44px;align-items:flex-start;gap:10px;line-height:20px;cursor:pointer}
.mbtd .mbrfa-request-types .mbrfa-check{align-items:center}
.mbtd .mbrfa-request-details input[type=radio],.mbtd .mbrfa-request-details input[type=checkbox]{width:16px;height:16px;min-height:16px;margin:2px 0 0;padding:0;flex:0 0 16px;accent-color:var(--mb-accent);cursor:pointer}
.mbtd .mbrfa-request-types input[type=radio]{appearance:none;border-radius:50%;border:1px solid var(--mb-border);background:var(--mb-surface);margin:0;display:grid;place-content:center}
.mbtd .mbrfa-request-types input[type=radio]:checked{border-color:var(--mb-accent);background:var(--mb-accent)}
.mbtd .mbrfa-request-types input[type=radio]:checked::after{content:"";width:6px;height:6px;border-radius:50%;background:var(--mb-accent-contrast)}
.mbtd .mbrfa-request-details input:focus-visible{outline:2px solid var(--mb-accent);outline-offset:3px}
.mbtd .mbrfa-request-details:disabled .mbrfa-check{cursor:default;opacity:.6}
.mbtd .mbrfa-form-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;align-items:start}
.mbtd .mbrfa-s1{grid-column:span 1}.mbtd .mbrfa-s2{grid-column:span 2}.mbtd .mbrfa-s3{grid-column:span 3}.mbtd .mbrfa-s4{grid-column:span 4}.mbtd .mbrfa-s6{grid-column:1/-1}
.mbtd .mbrfa-saved{display:grid;gap:3px;min-width:0;align-content:start}.mbtd .mbrfa-saved>span{font-size:12px;color:var(--mb-muted)}.mbtd .mbrfa-saved>strong{font-size:14px;font-weight:500;line-height:20px;overflow-wrap:anywhere}
.mbtd .mbrfa-pickers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:start;padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid var(--mb-border)}
.mbtd .mbrfa-pickers[data-columns="1"]{grid-template-columns:minmax(0,1fr)}.mbtd .mbrfa-pickers[data-columns="2"]{grid-template-columns:repeat(2,minmax(0,1fr))}
.mbtd .mbrfa-picker{display:grid;gap:5px;min-width:0;font-size:13px;align-content:start}.mbtd .mbrfa-picker>span:first-child{font-weight:600}
.mbtd .mbrfa-form-grid .mbrfa-picker{padding-bottom:2px}
.mbtd .mbrfa-picker a,.mbtd .mbrfa-picker-links{font-size:12px}.mbtd .mbrfa-picker-links{display:flex;gap:12px;flex-wrap:wrap;align-items:center;min-height:18px}
.mbtd .mbrfa-picker p,.mbtd .mbrfa-guidance p{margin:0;font-size:12px}.mbtd .mbrfa-guidance{display:grid;gap:4px}
.mbtd button.mbrfa-link.mbrfa-link{border:0;background:none;padding:0;min-height:0;color:var(--mb-accent);font-size:12px;text-decoration:underline}
.mbtd fieldset.mbrfa-plain.mbrfa-plain{border:0;padding:0;margin:0;background:none;border-radius:0;min-width:0}
.mbtd .mbrfa-visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
@media(max-width:760px){.mbtd .mbrfa-pickers,.mbtd .mbrfa-pickers[data-columns="2"]{grid-template-columns:minmax(0,1fr)}.mbtd .mbrfa-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mbtd .mbrfa-form-grid>*{grid-column:1/-1}.mbtd .mbrfa-form-grid>.mbrfa-s1,.mbtd .mbrfa-form-grid>.mbrfa-s2{grid-column:span 1}}
@media(max-width:640px){.mbtd .mbrfa-request-types{grid-template-columns:1fr;gap:4px}}
@media(forced-colors:active){.mbtd .mbrfa-request-types input[type=radio]{appearance:auto}.mbtd .mbrfa-request-types input[type=radio]::after{display:none}}
.mbtd textarea{resize:vertical;min-height:76px}.mbtd button{cursor:pointer;background:var(--mb-surface)}.mbtd button:disabled{opacity:.55;cursor:default}.mbtd .mbtd-primary{background:var(--mb-accent);color:var(--mb-accent-contrast);border-color:var(--mb-accent)}.mbtd .mbtd-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}.mbtd .mbtd-wide{grid-column:1/-1}.mbtd [role=alert]{color:var(--mb-danger)}.mbtd [role=status]{margin:0}.mbtd :is(input,select,textarea,button):focus-visible{outline:2px solid var(--mb-accent);outline-offset:2px}.mbtd .mbtd-note{padding:12px;background:var(--mb-soft);border-radius:var(--mb-control-radius)}.mbtd a{color:var(--mb-accent)}@media(max-width:520px){.mbtd .mbtd-grid{grid-template-columns:minmax(0,1fr)}.mbtd fieldset{padding:12px}}`}</style>
    {!hideHeading ? <><h2>{title}</h2><p>{description}</p></> : null}{children}
  </section>;
}
export function isDraftDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
