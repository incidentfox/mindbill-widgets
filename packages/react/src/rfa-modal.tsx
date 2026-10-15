"use client";
import { useEffect, type ReactElement, type ReactNode } from "react";
import { rfaSendDialogCss } from "./rfa-send-dialog";

const rfaModalCss = `.mbrfa-send.mbrfa-modal-wide{width:min(880px,100%);max-height:min(92vh,960px)}.mbrfa-send.mbrfa-modal-full{width:min(1440px,100%);height:min(94vh,1200px);max-height:94vh;display:flex;flex-direction:column}.mbrfa-modal-full>.mbrfa-send-body{flex:1;min-height:0;overflow:hidden;padding:0}
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
