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
export function TreatmentDraftShell({ title, description, children, appearance, className = "", style }: TreatmentDraftAppearance & { title: string; description: string; children: ReactNode }) {
  return <section className={`mbtd ${className}`.trim()} aria-label={title} style={{ ...mindBillAppearanceStyle(appearance), ...style }}>
    <style>{`.mbtd{font:14px/1.5 ui-sans-serif,system-ui,sans-serif;color:var(--mb-text);min-width:0}.mbtd *{box-sizing:border-box}.mbtd h2{font-size:22px;margin:0 0 6px}.mbtd p{margin:6px 0 16px;color:var(--mb-muted)}.mbtd form{display:grid;gap:16px}.mbtd fieldset{margin:0;padding:16px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);min-width:0}.mbtd legend{font-weight:600;padding:0 6px}.mbtd .mbtd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mbtd label{display:grid;gap:5px;font-size:13px;min-width:0}.mbtd input,.mbtd select,.mbtd textarea,.mbtd button{font:inherit;max-width:100%;min-width:0;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);padding:9px 11px;color:var(--mb-text);background:var(--mb-input);min-height:40px}.mbtd textarea{resize:vertical;min-height:76px}.mbtd button{cursor:pointer;background:var(--mb-surface)}.mbtd button:disabled{opacity:.55;cursor:default}.mbtd .mbtd-primary{background:var(--mb-accent);color:var(--mb-accent-contrast);border-color:var(--mb-accent)}.mbtd .mbtd-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}.mbtd .mbtd-wide{grid-column:1/-1}.mbtd [role=alert]{color:var(--mb-danger)}.mbtd [role=status]{margin:0}.mbtd :is(input,select,textarea,button):focus-visible{outline:2px solid var(--mb-accent);outline-offset:2px}.mbtd .mbtd-note{padding:12px;background:var(--mb-soft);border-radius:var(--mb-control-radius)}.mbtd .mbtd-attribution{font-size:12px;text-align:right}.mbtd a{color:var(--mb-accent)}@media(max-width:520px){.mbtd .mbtd-grid{grid-template-columns:minmax(0,1fr)}.mbtd fieldset{padding:12px}}`}</style>
    <h2>{title}</h2><p>{description}</p>{children}
    <p className="mbtd-attribution"><a href="https://mindbill.org" target="_blank" rel="noopener noreferrer">Powered by MindBill</a></p>
  </section>;
}
export function isDraftDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
