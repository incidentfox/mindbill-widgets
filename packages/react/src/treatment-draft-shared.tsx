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
.mbtd .mbrfa-section-actions{display:flex;gap:12px;align-items:center;margin-top:14px;font-size:12px;color:var(--mb-muted)}
.mbtd .mbrfa-field-hint{font-size:12px;color:var(--mb-muted);font-weight:400}
.mbtd .mbrfa-template-save{display:grid;grid-template-columns:minmax(0,420px);gap:10px 16px;margin-top:10px}.mbtd .mbrfa-template-save>label{display:grid;gap:4px;font-size:12px;color:var(--mb-muted)}.mbtd .mbrfa-template-save>.mbrfa-check{display:flex;flex-direction:row;align-items:center;gap:8px;cursor:pointer}.mbtd .mbrfa-template-save>.mbrfa-check>input{width:16px;height:16px;min-height:16px;margin:0;padding:0;flex:0 0 16px;accent-color:var(--mb-accent)}.mbtd .mbrfa-template-save>:is(.mbrfa-check,.mbrfa-section-actions){grid-column:1/-1;margin-top:0;padding-top:0;border-top:0}
.mbtd .mbrfa-reading{margin:0 0 10px;padding:8px 12px;border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-accent) 7%,var(--mb-surface));color:var(--mb-text);font-size:13px}.mbtd .mbrfa-reading[data-flag=true]{background:#fff4e5;color:#7a4a00}.mbtd fieldset[data-flag=true]{border-color:#f0a23b;box-shadow:inset 3px 0 0 #f0a23b}
.mbtd .mbrfa-template-save>.mbrfa-section-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.mbtd .mbrfa-template-save>.mbrfa-section-actions>button{flex:0 0 auto;white-space:nowrap}.mbtd .mbrfa-template-save>.mbrfa-section-actions>span{flex:1 0 100%;font-size:12px;color:var(--mb-muted)}
@media(max-width:760px){.mbtd .mbrfa-template-save{grid-template-columns:minmax(0,1fr)}}
.mbtd .mbrfa-form-grid>.mbrfa-row-start{grid-column:1/span 3}.mbtd .mbrfa-form-grid textarea[rows="2"]{min-height:44px}
.mbtd .mbrfa-dx-list{list-style:none;margin:0 0 8px;padding:0;display:grid;gap:6px}.mbtd .mbrfa-dx-list>li{display:flex;align-items:center;gap:10px;min-height:36px;padding:4px 6px 4px 12px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-accent) 5%,var(--mb-surface));font-size:13px}.mbtd .mbrfa-dx-list>li>strong{font-weight:600;white-space:nowrap}.mbtd .mbrfa-dx-list>li>span{flex:1;min-width:0;color:var(--mb-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mbtd .mbrfa-dx-list>li>input{flex:1;min-width:0;min-height:30px;padding:4px 8px}.mbtd .mbrfa-dx-list>li>button{flex:none;width:28px;height:28px;min-height:28px;padding:0;border:0;background:none;color:var(--mb-muted);font-size:18px;line-height:1;cursor:pointer}.mbtd .mbrfa-dx-list>li>button:hover{color:var(--mb-danger,#b42318)}
.mbtd .mbrfa-doc-hint{margin:0 0 12px;font-size:12px;color:var(--mb-muted)}
.mbtd .mbrfa-treatments{display:grid;gap:14px}.mbtd .mbrfa-treatment+.mbrfa-treatment{padding-top:16px;border-top:1px solid var(--mb-border)}
.mbtd .mbrfa-treatment-head{display:flex;align-items:center;gap:14px;margin-bottom:10px;font-size:13px}.mbtd .mbrfa-treatment-head>strong{font-weight:600;margin-right:auto}.mbtd button.mbrfa-link.mbrfa-link.mbrfa-treatment-remove{color:var(--mb-danger,#b42318)}
.mbtd .mbrfa-add-treatment{display:block;width:100%;min-height:44px;border:1px dashed color-mix(in srgb,var(--mb-accent) 55%,var(--mb-border));background:color-mix(in srgb,var(--mb-accent) 5%,var(--mb-surface));color:var(--mb-accent);font-weight:600;text-align:center;cursor:pointer}.mbtd .mbrfa-add-treatment:hover:not(:disabled){background:color-mix(in srgb,var(--mb-accent) 10%,var(--mb-surface))}
.mbtd .mbrfa-option-group{display:grid;gap:4px;grid-column:1/-1}.mbtd .mbrfa-option-group+.mbrfa-option-group{margin-top:6px;padding-top:14px;border-top:1px solid var(--mb-border)}.mbtd .mbrfa-option-group>span{font-size:12px;font-weight:600;color:var(--mb-muted)}.mbtd .mbrfa-option-group>span>small{margin-left:10px;font-weight:400}
.mbtd .mbrfa-docs{display:grid;gap:10px}
.mbtd .mbrfa-doc{display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface)}.mbtd .mbrfa-doc>span{display:grid;min-width:0;flex:1}.mbtd .mbrfa-doc strong{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mbtd .mbrfa-doc small{font-size:12px;color:var(--mb-muted)}.mbtd .mbrfa-doc>button{border:0;background:none;min-height:32px;width:32px;padding:0;font-size:20px;line-height:1;color:var(--mb-muted)}.mbtd .mbrfa-doc>button:hover{color:var(--mb-text)}
.mbtd button.mbrfa-dropzone{display:grid;justify-items:center;gap:6px;width:100%;padding:28px 16px;border:1.5px dashed color-mix(in srgb,var(--mb-accent) 45%,var(--mb-border));border-radius:var(--mb-control-radius);background:var(--mb-soft);color:var(--mb-accent);cursor:pointer;text-align:center}.mbtd button.mbrfa-dropzone strong{font-size:15px;font-weight:600;color:var(--mb-text)}.mbtd button.mbrfa-dropzone small{font-size:13px;color:var(--mb-muted)}.mbtd button.mbrfa-dropzone:hover,.mbtd button.mbrfa-dropzone[data-over=true]{border-color:var(--mb-accent);background:color-mix(in srgb,var(--mb-accent) 8%,var(--mb-surface))}
.mbtd .mbrfa-req{color:var(--mb-danger,#c0392b);font-weight:700}
.mbtd .mbrfa-contact-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.mbtd .mbrfa-contact-grid>.mbrfa-s3{grid-column:span 2}.mbtd .mbrfa-contact-grid>:is(.mbrfa-s1,.mbrfa-s2){grid-column:span 1}
.mbtd .mbrfa-link-out{color:var(--mb-muted)!important;text-decoration:none}.mbtd .mbrfa-link-out:hover{text-decoration:underline}.mbtd .mbrfa-picker-links a{text-decoration:none}
.mbtd button.mbrfa-link.mbrfa-link{border:0;background:none;padding:0;min-height:0;color:var(--mb-accent);font-size:12px;text-decoration:none}.mbtd button.mbrfa-link.mbrfa-link:hover,.mbtd .mbrfa-picker-links a:hover{text-decoration:underline}
.mbtd fieldset.mbrfa-plain.mbrfa-plain{border:0;padding:0;margin:0;background:none;border-radius:0;min-width:0}
.mbtd .mbrfa-visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.mbtd form.mbrfa-official{gap:18px;counter-reset:mbrfa-section}
.mbtd form.mbrfa-official>fieldset{padding:0 20px 20px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);box-shadow:0 1px 2px #0000000a}
.mbtd form.mbrfa-official>fieldset>legend{float:left;display:flex;align-items:center;gap:10px;width:calc(100% + 40px);margin:0 -20px;padding:13px 20px;border-bottom:1px solid var(--mb-border);font-size:14px;font-weight:600;letter-spacing:-.005em}
.mbtd form.mbrfa-official>fieldset>legend+*{clear:both}.mbtd form.mbrfa-official>fieldset>legend+:not(.mbrfa-pickers){padding-top:18px}
.mbtd form.mbrfa-official>fieldset>legend::before{counter-increment:mbrfa-section;content:counter(mbrfa-section);display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:color-mix(in srgb,var(--mb-accent) 12%,var(--mb-surface));color:var(--mb-accent);font-size:12px;font-weight:600}
.mbtd form.mbrfa-official .mbrfa-pickers{margin:0 -20px 18px;padding:16px 20px;border-bottom:1px solid var(--mb-border);background:var(--mb-soft)}
.mbtd form.mbrfa-official .mbrfa-picker>span:first-child{font-size:12px;font-weight:600;letter-spacing:.01em}
.mbtd form.mbrfa-official .mbrfa-form-grid{gap:14px 20px}
.mbtd form.mbrfa-official .mbrfa-saved>span,.mbtd form.mbrfa-official .mbrfa-form-grid>label{font-size:12px;color:var(--mb-muted);font-weight:500}
.mbtd form.mbrfa-official .mbrfa-form-grid>label>:is(input,textarea){color:var(--mb-text)}
.mbtd form.mbrfa-official .mbrfa-saved>strong{font-size:14px;font-weight:500;color:var(--mb-text)}
.mbtd form.mbrfa-official .mbrfa-request-details>.mbtd-grid{gap:4px}
.mbtd form.mbrfa-official .mbrfa-request-types{display:flex;flex-wrap:wrap;gap:8px 28px;padding-bottom:0;margin-bottom:6px;border-bottom:0}
.mbtd form.mbrfa-official .mbrfa-request-types input[type=radio]:not(:checked){border-color:var(--mb-muted)}
.mbtd form.mbrfa-official .mbrfa-request-details .mbrfa-check{min-height:32px;font-size:13px}
.mbtd form.mbrfa-official .mbrfa-section-actions{margin-top:16px;padding-top:12px;border-top:1px dashed var(--mb-border)}
.mbtd .mbrfa-section-actions>button{min-height:36px;padding:7px 14px;font-size:13px;font-weight:600}
.mbtd form.mbrfa-official>div:has(>button:only-child)>button{border-style:dashed;color:var(--mb-accent);font-weight:500}
.mbtd form.mbrfa-official>.mbtd-actions:last-child{position:sticky;bottom:12px;z-index:5;justify-content:flex-end;flex-direction:row-reverse;margin-top:0;padding:10px 14px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:color-mix(in srgb,var(--mb-surface) 92%,transparent);backdrop-filter:blur(6px);box-shadow:0 6px 20px #00000014}
.mbtd form.mbrfa-official>.mbtd-actions:last-child>[role=status]{margin-right:auto;order:9}
@media(max-width:760px){.mbtd form.mbrfa-official>.mbtd-actions:last-child{position:static;flex-direction:row}}
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
