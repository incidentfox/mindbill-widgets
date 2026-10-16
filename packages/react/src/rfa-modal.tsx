"use client";
import { useEffect, type ReactElement, type ReactNode } from "react";
import { rfaSendDialogCss } from "./rfa-send-dialog";
import { useVisualViewportVars } from "./form-controls";

export const rfaModalCss = `.mbrfa-send.mbrfa-modal-wide{width:min(880px,100%);max-height:min(92vh,960px)}.mbrfa-send.mbrfa-modal-full{width:min(1440px,100%);height:min(94vh,1200px);max-height:94vh;display:flex;flex-direction:column}.mbrfa-modal-full>.mbrfa-send-body{flex:1;min-height:0;overflow:hidden;padding:0}
.mbrfa-review{display:grid;grid-template-columns:minmax(0,1fr) 500px;height:100%;min-height:0}.mbrfa-review-doc{background:#525659;min-height:0;position:relative}
.mbrfa-review-empty{height:100%;display:grid;place-items:center;padding:24px;color:#fff;text-align:center}.mbrfa-review-empty p{margin:0}
.mbtd .mbrfa-review-drop{display:grid;gap:8px;justify-items:center;max-width:380px;padding:32px 28px;border:2px dashed rgba(255,255,255,.45);border-radius:12px;color:#fff;cursor:pointer;font-weight:400}.mbrfa-review-drop strong{font-size:16px}.mbrfa-review-drop span{font-size:13px;opacity:.85}.mbtd button.mbrfa-review-drop{background:transparent;font:inherit;line-height:1.4;min-height:0;width:100%;text-align:center}.mbtd button.mbrfa-review-drop:hover,.mbtd button.mbrfa-review-drop[data-over]{border-color:#fff;background:rgba(255,255,255,.08)}.mbtd .mbrfa-review-drop .mbrfa-review-drop-button{display:inline-flex;align-items:center;margin-top:6px;padding:8px 18px;border-radius:8px;background:#fff;color:#1f2a2e;font-size:14px;font-weight:600;opacity:1}.mbtd button.mbrfa-review-drop:disabled{opacity:.6;cursor:not-allowed}
.mbrfa-review-side,.mbtd form.mbrfa-review-side{display:flex;gap:0;flex-direction:column;min-height:0;border-left:1px solid var(--mb-border);background:var(--mb-surface);margin:0}
.mbtd .mbrfa-modal .mbrfa-review-scroll{flex:1 1 auto;min-height:0;overflow:auto;padding:18px 20px 16px}.mbtd .mbrfa-modal .mbrfa-send-body .mbrfa-review-fields{display:grid;gap:14px;align-content:start;border:0;margin:0;padding:0;min-width:0}
.mbtd .mbrfa-modal .mbrfa-send-body .mbrfa-review-scroll .mbtd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}.mbtd .mbrfa-modal .mbrfa-send-body .mbrfa-review-scroll .mbtd-grid .mbrfa-review-response{grid-column:1/-1;order:-1}.mbtd .mbrfa-modal .mbrfa-send-body .mbrfa-review-scroll .mbtd-grid label:has(textarea){grid-column:1/-1}
.mbtd .mbrfa-modal .mbrfa-review-fields fieldset{padding:14px 16px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);display:grid;gap:12px}
.mbtd .mbrfa-modal .mbrfa-review-fields fieldset legend{display:block;float:left;width:100%;padding:0;margin:0 0 2px;font-size:14px;font-weight:650;color:var(--mb-text)}.mbrfa-review-fields fieldset legend+*{clear:both}
.mbtd .mbrfa-modal .mbrfa-review-fields fieldset[data-flag]{border-color:#d97706;background:color-mix(in srgb,#d97706 5%,var(--mb-surface))}
.mbrfa-review-scroll .mbrfa-reading{margin:0;padding:10px 12px;border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-accent) 8%,var(--mb-surface));border:1px solid color-mix(in srgb,var(--mb-accent) 25%,var(--mb-surface));font-size:13px}.mbrfa-review-scroll .mbrfa-reading[data-flag]{background:color-mix(in srgb,#d97706 10%,var(--mb-surface));border-color:color-mix(in srgb,#d97706 35%,var(--mb-surface));color:#92400e}
.mbrfa-review-scroll>p{margin:0;font-size:13px;color:var(--mb-muted)}.mbrfa-review-scroll textarea{min-height:72px}
.mbrfa-review-foot{flex:none;display:grid;gap:10px;align-content:start;padding:14px 20px 16px;border-top:1px solid var(--mb-border);background:var(--mb-surface);box-shadow:0 -6px 14px -12px rgba(0,0,0,.35)}
.mbtd .mbrfa-review-foot .mbrfa-check{display:flex;gap:10px;align-items:flex-start;font-weight:400;font-size:13px;line-height:1.4}.mbtd .mbrfa-review-foot .mbrfa-check input{width:16px;height:16px;min-height:0;flex:0 0 auto;margin:1px 0 0;padding:0;accent-color:var(--mb-accent)}
.mbtd .mbrfa-modal .mbrfa-review-foot button[type=submit]{width:100%;height:44px;min-height:0;flex:none;font-size:14px;justify-self:stretch}
.mbrfa-required{color:#dc2626;font-weight:700}.mbrfa-optional{color:var(--mb-muted);font-weight:400;font-size:12px}.mbrfa-field{display:grid;gap:6px;min-width:0}.mbrfa-field-label{font-size:13px;font-weight:500;color:var(--mb-text)}.mbtd .mbrfa-modal .mbrfa-send-body .mbtd-grid .mbrfa-wide{grid-column:1/-1}.mbrfa-review-hint{margin:0;font-size:13px;color:var(--mb-muted)}
.mbtd .mbrfa-modal .mbrfa-review-fields textarea{min-height:132px;resize:vertical}.mbrfa-review-attach{display:block;margin-top:4px;font-size:12px;font-weight:400;color:var(--mb-muted)}.mbrfa-review-attach-link{position:relative;color:var(--mb-accent);text-decoration:underline;cursor:pointer;overflow:hidden;display:inline-block}.mbtd button.mbrfa-review-attach-link{background:none;border:0;padding:0;min-height:0;font:inherit;color:var(--mb-accent);text-decoration:underline;cursor:pointer}.mbtd .mbrfa-file-pick{display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px}.mbrfa-file-chosen{font-size:12px;font-weight:400;color:var(--mb-muted);overflow-wrap:anywhere}
.mbrfa-outcome{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);overflow:hidden}.mbtd .mbrfa-outcome button{border:0;border-right:1px solid var(--mb-border);border-radius:0;background:var(--mb-surface);min-height:36px;font-size:13px;font-weight:500;color:var(--mb-muted)}.mbtd .mbrfa-outcome button:last-child{border-right:0}.mbtd .mbrfa-outcome button:hover{background:var(--mb-soft);color:var(--mb-text)}
.mbtd .mbrfa-outcome button[aria-checked=true]{color:#fff;font-weight:650}.mbtd .mbrfa-outcome button[aria-checked=true][data-outcome=approved]{background:#15803d}.mbtd .mbrfa-outcome button[aria-checked=true][data-outcome=modified]{background:#b45309}.mbtd .mbrfa-outcome button[aria-checked=true][data-outcome=denied]{background:var(--mb-danger,#b91c1c)}.mbtd .mbrfa-outcome button[aria-checked=true][data-outcome=pending]{background:var(--mb-muted);}
.mbrfa-modal .mbrfa-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* The Save row of a dialog form stays in view while the fields scroll, including above a phone keyboard. */
.mbrfa-modal .mbrfa-send-body .mbrfa-taskform-foot,.mbrfa-modal .mbrfa-send-body form>.mbtd-actions:last-child,.mbrfa-modal .mbrfa-send-body form>fieldset>.mbtd-actions:last-child{position:sticky;bottom:-18px;z-index:2;margin-bottom:-18px;padding-top:12px;padding-bottom:18px;background:var(--mb-surface);box-shadow:0 -8px 12px -10px rgba(0,0,0,.25)}
.mbtd .mbrfa-outcome button{padding:0 4px;white-space:nowrap;min-width:0}
.mbrfa-send.mbrfa-modal-full{max-height:calc(var(--mb-vv-height,100dvh) - 32px)}
@media(max-width:640px){.mbrfa-modal .mbrfa-send-body .mbrfa-taskform-foot,.mbrfa-modal .mbrfa-send-body form>.mbtd-actions:last-child,.mbrfa-modal .mbrfa-send-body form>fieldset>.mbtd-actions:last-child{bottom:-14px;margin-bottom:-14px;padding-bottom:calc(14px + env(safe-area-inset-bottom))}.mbrfa-send.mbrfa-modal-full{height:calc(var(--mb-vv-height,100dvh) - 8px);max-height:none}}
@media(max-width:900px){.mbrfa-review{grid-template-columns:1fr;grid-template-rows:min(45vh,35%) minmax(0,1fr)}.mbrfa-review-side{border-left:0;border-top:1px solid var(--mb-border)}.mbtd .mbrfa-modal .mbrfa-send-body .mbrfa-review-scroll .mbtd-grid{grid-template-columns:minmax(0,1fr)}}
.mbrfa-modal .mbrfa-send-body fieldset{margin:0;padding:0;border:0;min-width:0;display:grid;gap:12px}.mbrfa-modal .mbrfa-send-body legend{display:none}
.mbrfa-modal .mbrfa-send-body fieldset fieldset{padding:12px 14px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius)}.mbrfa-modal .mbrfa-send-body fieldset fieldset legend{display:block;padding:0 4px;font-size:13px;font-weight:600}
.mbrfa-modal .mbrfa-send-body .mbtd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}.mbrfa-modal .mbrfa-send-body button[type=submit]{justify-self:start;border-color:var(--mb-accent);background:var(--mb-accent);color:var(--mb-accent-contrast,#fff);font-weight:600}`;

/** One task at a time: a form opens over the request instead of expanding inside the page. */
export function RfaModal({ title, wide = false, full = false, busy = false, onClose, children }: { title: string; wide?: boolean; /** Nearly the whole window, for reviewing a document beside a form. */ full?: boolean; busy?: boolean; onClose: () => void; children: ReactNode }): ReactElement {
  useVisualViewportVars();
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy && !event.defaultPrevented) onClose(); };
    window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close);
  }, [busy, onClose]);
  return <div className="mbrfa-send-backdrop mbrfa-modal" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <style>{rfaSendDialogCss}{rfaModalCss}</style>
    <section className={`mbrfa-send${full ? " mbrfa-modal-full" : wide ? " mbrfa-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <header><h3>{title}</h3><button type="button" aria-label="Close" disabled={busy} onClick={onClose}>×</button></header>
      <div className="mbrfa-send-body">{children}</div>
    </section>
  </div>;
}
