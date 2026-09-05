"use client";

import { useState, type CSSProperties, type ReactElement } from "react";
import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";

export type W9ExtractionStatus = "idle" | "queued" | "processing" | "complete" | "not_found" | "failed";
export type W9UploadProps = {
  document?: { filename: string; addedAt?: string };
  /** Extraction and storage remain owned by your authorized server adapter. */
  extractionStatus?: W9ExtractionStatus;
  onUpload: (file: File) => Promise<void>;
  onView?: () => void;
  onRetryExtraction?: () => void | Promise<void>;
  maxSizeBytes?: number;
  disabled?: boolean;
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
};

export function validateW9File(file: Pick<File, "name" | "size" | "type">, maxSizeBytes = 20 * 1024 * 1024): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) return "Choose a PDF file for the W-9.";
  if (file.size === 0) return "The selected PDF is empty.";
  if (file.size > maxSizeBytes) return `Choose a PDF smaller than ${Math.round(maxSizeBytes / 1024 / 1024)} MB.`;
  return null;
}

const extractionLabels: Record<W9ExtractionStatus, string> = {
  idle: "",
  queued: "W-9 saved. Tax ID and address extraction is queued.",
  processing: "Reading the tax ID and remittance address…",
  complete: "Extraction complete. Review the tax ID and remittance address before saving your billing settings.",
  not_found: "The tax ID or address could not be read. Enter the missing billing details manually.",
  failed: "Extraction failed. Your W-9 is still saved; enter the billing details manually or retry.",
};

/** Reusable upload UI without a second source of truth for practice documents or tax IDs. */
export function W9Upload({ document, extractionStatus = "idle", onUpload, onView, onRetryExtraction, maxSizeBytes = 20 * 1024 * 1024, disabled = false, appearance, className = "", style }: W9UploadProps): ReactElement {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const choose = (next: File | null) => {
    if (busy || disabled) return;
    const failure = next ? validateW9File(next, maxSizeBytes) : null;
    setError(failure); setSaved(false); setFile(failure ? null : next);
  };
  const upload = async () => {
    if (!file || busy || disabled) return;
    setBusy(true); setError(null); setSaved(false);
    try { await onUpload(file); setFile(null); setSaved(true); }
    catch { setError("The W-9 could not be uploaded. Please try again."); }
    finally { setBusy(false); }
  };
  const retry = async () => {
    setBusy(true); setError(null);
    try { await onRetryExtraction?.(); }
    catch { setError("Extraction could not be restarted. Please try again."); }
    finally { setBusy(false); }
  };
  return <section className={`mbw9 ${className}`.trim()} style={{ ...mindBillAppearanceStyle(appearance), ...style }} aria-label="Practice W-9">
    <style>{`.mbw9{font:inherit;color:var(--mb-text)}.mbw9 *{box-sizing:border-box}.mbw9 p{margin:0;color:var(--mb-muted);font-size:13px;line-height:1.6}.mbw9-current,.mbw9-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.mbw9-current{padding:12px 14px;background:var(--mb-soft);border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);margin-bottom:12px}.mbw9-current strong{overflow-wrap:anywhere}.mbw9 button{font:inherit;color:var(--mb-text);background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);padding:9px 14px;cursor:pointer}.mbw9 button:disabled{opacity:.55;cursor:default}.mbw9-drop{display:grid;gap:8px;padding:20px;border:1px dashed var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface)}.mbw9-drop input{font:inherit;max-width:100%;color:var(--mb-muted)}.mbw9-actions{margin-top:12px}.mbw9 button.mbw9-primary{background:var(--mb-accent);color:var(--mb-accent-contrast);border-color:var(--mb-accent)}.mbw9 [role=alert]{color:var(--mb-danger);margin-top:12px}.mbw9 button:focus-visible,.mbw9 input:focus-visible{outline:2px solid var(--mb-accent);outline-offset:3px}.mbw9{min-width:0}.mbw9-drop{grid-template-columns:minmax(0,1fr);min-width:0;white-space:normal}.mbw9-drop>*{min-width:0;overflow-wrap:anywhere}.mbw9-drop input{width:100%}.mbw9-current>div{min-width:0;max-width:100%}`}</style>
    {document ? <div className="mbw9-current"><div><strong>{document.filename}</strong>{document.addedAt ? <p>Added {document.addedAt}</p> : null}</div>{onView ? <button type="button" disabled={busy || disabled} onClick={onView}>View W-9</button> : null}</div> : null}
    <label className="mbw9-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); choose(event.dataTransfer.files[0] ?? null); }}>
      <strong>{document ? "Replace practice W-9" : "Upload practice W-9"}</strong>
      <p>Choose or drop a PDF, up to {Math.round(maxSizeBytes / 1024 / 1024)} MB. Your server securely stores the document for billing.</p>
      <input aria-label="W-9 PDF" type="file" accept="application/pdf,.pdf" disabled={busy || disabled} onChange={(event) => { choose(event.target.files?.[0] ?? null); event.target.value = ""; }} />
      {file ? <p>{file.name}</p> : null}
    </label>
    <div className="mbw9-actions"><p role="status">{busy ? "Working…" : extractionLabels[extractionStatus] || (saved ? "W-9 saved." : "")}</p><div>{onRetryExtraction && (extractionStatus === "failed" || extractionStatus === "not_found") ? <button type="button" disabled={busy || disabled} onClick={() => void retry()}>Retry extraction</button> : null} <button className="mbw9-primary" type="button" disabled={!file || busy || disabled} onClick={() => void upload()}>{busy ? "Please wait…" : "Upload W-9"}</button></div></div>
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
