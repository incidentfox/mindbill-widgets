"use client";
import { useEffect, type ReactElement, type ReactNode } from "react";
import { rfaSendDialogCss } from "./rfa-send-dialog";

const rfaModalCss = `.mbrfa-send.mbrfa-modal-wide{width:min(880px,100%);max-height:min(92vh,960px)}.mbrfa-send.mbrfa-modal-full{width:min(1440px,100%);height:min(94vh,1200px);max-height:94vh;display:flex;flex-direction:column}.mbrfa-modal-full>.mbrfa-send-body{flex:1;min-height:0;overflow:hidden;padding:0}
.mbrfa-review{display:grid;grid-template-columns:minmax(0,1fr) 460px;height:100%;min-height:0}.mbrfa-review-doc{background:#525659;min-height:0;position:relative}
.mbrfa-review-empty{height:100%;display:grid;place-items:center;padding:24px;color:#fff;text-align:center}.mbrfa-review-empty p{margin:0}
.mbtd .mbrfa-review-drop{display:grid;gap:8px;justify-items:center;max-width:380px;padding:32px 28px;border:2px dashed rgba(255,255,255,.45);border-radius:12px;color:#fff;cursor:pointer;font-weight:400}.mbrfa-review-drop strong{font-size:16px}.mbrfa-review-drop span{font-size:13px;opacity:.85}.mbtd .mbrfa-review-drop input{color:#fff;font-size:13px;max-width:100%}
.mbrfa-review-side{display:flex;flex-direction:column;min-height:0;border-left:1px solid var(--mb-border);background:var(--mb-surface);margin:0}
.mbtd .mbrfa-modal .mbrfa-review-scroll{flex:1;min-height:0;overflow:auto;padding:18px 20px 16px;display:grid;gap:14px;align-content:start;border:0;margin:0}
.mbrfa-review-scroll .mbtd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.mbtd .mbrfa-modal .mbrfa-review-scroll fieldset{padding:14px 16px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);display:grid;gap:12px}
.mbtd .mbrfa-modal .mbrfa-review-scroll fieldset legend{display:block;float:left;width:100%;padding:0;margin:0 0 2px;font-size:14px;font-weight:650;color:var(--mb-text)}.mbrfa-review-scroll fieldset legend+*{clear:both}
.mbtd .mbrfa-modal .mbrfa-review-scroll fieldset[data-flag]{border-color:#d97706;background:color-mix(in srgb,#d97706 5%,var(--mb-surface))}
.mbrfa-review-scroll .mbrfa-reading{margin:0;padding:10px 12px;border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-accent) 8%,var(--mb-surface));border:1px solid color-mix(in srgb,var(--mb-accent) 25%,var(--mb-surface));font-size:13px}.mbrfa-review-scroll .mbrfa-reading[data-flag]{background:color-mix(in srgb,#d97706 10%,var(--mb-surface));border-color:color-mix(in srgb,#d97706 35%,var(--mb-surface));color:#92400e}
.mbrfa-review-scroll>p{margin:0;font-size:13px;color:var(--mb-muted)}.mbrfa-review-scroll textarea{min-height:72px}
.mbrfa-review-foot{flex-shrink:0;display:grid;gap:10px;padding:14px 20px 16px;border-top:1px solid var(--mb-border);background:var(--mb-surface);box-shadow:0 -6px 14px -12px rgba(0,0,0,.35)}
.mbtd .mbrfa-review-foot .mbrfa-check{display:flex;gap:10px;align-items:flex-start;font-weight:400;font-size:13px;line-height:1.4}.mbtd .mbrfa-review-foot .mbrfa-check input{width:16px;height:16px;min-height:0;flex:0 0 auto;margin:1px 0 0;padding:0;accent-color:var(--mb-accent)}
.mbtd .mbrfa-modal .mbrfa-review-foot button[type=submit]{width:100%;min-height:42px;font-size:14px;justify-self:stretch}.mbtd .mbrfa-review-attach{font-size:12px;font-weight:400;color:var(--mb-muted);display:grid;gap:4px}.mbtd .mbrfa-review-attach input{font-size:12px}
.mbrfa-modal .mbrfa-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:900px){.mbrfa-review{grid-template-columns:1fr;grid-template-rows:45vh minmax(0,1fr)}.mbrfa-review-side{border-left:0;border-top:1px solid var(--mb-border)}.mbrfa-review-scroll .mbtd-grid{grid-template-columns:1fr}}
.mbrfa-modal .mbrfa-send-body fieldset{margin:0;padding:0;border:0;min-width:0;display:grid;gap:12px}.mbrfa-modal .mbrfa-send-body legend{display:none}
.mbrfa-modal .mbrfa-send-body fieldset fieldset{padding:12px 14px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius)}.mbrfa-modal .mbrfa-send-body fieldset fieldset legend{display:block;padding:0 4px;font-size:13px;font-weight:600}
.mbrfa-modal .mbrfa-send-body .mbtd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}.mbrfa-modal .mbrfa-send-body button[type=submit]{justify-self:start;border-color:var(--mb-accent);background:var(--mb-accent);color:var(--mb-accent-contrast,#fff);font-weight:600}`;

/** One task at a time: a form opens over the request instead of expanding inside the page. */
export function RfaModal({ title, wide = false, full = false, busy = false, onClose, children }: { title: string; wide?: boolean; /** Nearly the whole window, for reviewing a document beside a form. */ full?: boolean; busy?: boolean; onClose: () => void; children: ReactNode }): ReactElement {
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
