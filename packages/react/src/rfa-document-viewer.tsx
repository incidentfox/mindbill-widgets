"use client";
import { useEffect, useState, type ReactElement } from "react";
import { RfaPdfReview } from "./rfa-delivery-panel";
import { RfaModal } from "./rfa-modal";

export type RfaViewerDocument = { id: string; filename: string; type: string };

const css = `.mbrfa-viewer{display:grid;grid-template-columns:minmax(0,1fr) 300px;height:100%;min-height:0}.mbrfa-viewer-doc{background:#525659;min-height:0}.mbrfa-viewer-doc>p{color:#fff;padding:16px;margin:0}
.mbrfa-viewer-side{display:flex;flex-direction:column;min-height:0;border-left:1px solid var(--mb-border);background:var(--mb-surface)}.mbrfa-viewer-head{padding:16px 18px;border-bottom:1px solid var(--mb-border);display:grid;gap:10px}
.mbrfa-viewer-head strong{font-size:14px;overflow-wrap:anywhere}.mbrfa-viewer-head small{display:block;color:var(--mb-muted);font-size:12px;margin-top:2px}.mbrfa-viewer-actions{display:flex;gap:8px}
.mbtd .mbrfa-viewer-actions a{display:inline-flex;align-items:center;min-height:32px;padding:4px 12px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);font-size:13px;color:var(--mb-text);text-decoration:none;background:var(--mb-surface)}.mbtd .mbrfa-viewer-actions a:hover{border-color:var(--mb-accent)}
.mbrfa-viewer-list{flex:1;min-height:0;overflow:auto;padding:10px;display:grid;gap:6px;align-content:start}.mbrfa-viewer-list h4{margin:6px 8px 2px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--mb-muted)}
.mbtd .mbrfa-viewer-list button{display:grid;gap:2px;text-align:left;padding:9px 12px;border:1px solid transparent;border-radius:var(--mb-control-radius);background:transparent;min-height:0;font-size:13px;font-weight:500;color:var(--mb-text)}.mbtd .mbrfa-viewer-list button small{font-size:12px;font-weight:400;color:var(--mb-muted)}
.mbtd .mbrfa-viewer-list button:hover{background:var(--mb-soft)}.mbtd .mbrfa-viewer-list button[aria-current=true]{border-color:var(--mb-accent);background:color-mix(in srgb,var(--mb-accent) 8%,var(--mb-surface));color:var(--mb-accent)}
@media(max-width:900px){.mbrfa-viewer{grid-template-columns:1fr;grid-template-rows:60vh minmax(0,1fr)}.mbrfa-viewer-side{border-left:0;border-top:1px solid var(--mb-border)}}`;

/** Reads a request's documents full-screen, one at a time, with the others a click away. */
export function RfaDocumentViewer({ documents, current, loading, onSelect, onClose }: {
  documents: readonly RfaViewerDocument[]; current: { id: string; blob: Blob | null }; loading?: boolean;
  onSelect: (id: string) => void; onClose: () => void;
}): ReactElement {
  const [url, setUrl] = useState("");
  useEffect(() => { if (!current.blob) { setUrl(""); return; } const next = URL.createObjectURL(current.blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [current.blob]);
  const active = documents.find(document => document.id === current.id);
  return <RfaModal full title={active?.filename ?? "Document"} onClose={onClose}>
    <style>{css}</style>
    <div className="mbrfa-viewer">
      <div className="mbrfa-viewer-doc">{current.blob && !loading ? <RfaPdfReview fill newTabLink={false} blob={current.blob} title={active?.filename ?? "Document"} /> : <p role="status">Loading the document…</p>}</div>
      <aside className="mbrfa-viewer-side" aria-label="Documents">
        <div className="mbrfa-viewer-head"><div><strong>{active?.filename}</strong><small>{active?.type}</small></div>
          {url ? <div className="mbrfa-viewer-actions"><a href={url} target="_blank" rel="noopener noreferrer">Open in new tab</a><a href={url} download={active?.filename ?? "document.pdf"}>Download</a></div> : null}</div>
        {documents.length > 1 ? <div className="mbrfa-viewer-list"><h4>Documents on this RFA</h4>{documents.map(document => <button key={document.id} type="button" aria-current={document.id === current.id} onClick={() => { if (document.id !== current.id) onSelect(document.id); }}>{document.filename}<small>{document.type}</small></button>)}</div> : null}
      </aside>
    </div>
  </RfaModal>;
}
