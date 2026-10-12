"use client";
import { useRef, useState, type ReactElement } from "react";

const size = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const isPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);

/** Drop or choose the PDFs that go out with the request; they attach when the request is saved. */
export function RfaDocumentDrop({ files, onChange, disabled }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }): ReactElement {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false); const [skipped, setSkipped] = useState(0);
  const add = (chosen: File[]) => { const pdfs = chosen.filter(isPdf); setSkipped(chosen.length - pdfs.length); if (pdfs.length) onChange([...files, ...pdfs]); };
  return <div className="mbrfa-docs">
    {files.map((file, index) => <div className="mbrfa-doc" key={`${index}:${file.name}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
      <span><strong>{file.name}</strong><small>{size(file.size)} · attaches when the request is saved</small></span>
      <button type="button" aria-label={`Remove ${file.name}`} title="Remove" onClick={() => onChange(files.filter((_, position) => position !== index))}>×</button>
    </div>)}
    <button type="button" className="mbrfa-dropzone" data-over={over ? "true" : undefined} disabled={disabled} onClick={() => input.current?.click()}
      onDragOver={event => { event.preventDefault(); if (!disabled) setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={event => { event.preventDefault(); setOver(false); if (!disabled) add(Array.from(event.dataTransfer.files)); }}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4.25 4.25 0 0 1-.5 8.5" /><path d="M12 12v8M8.5 15.5 12 12l3.5 3.5" /></svg>
      <strong>{files.length ? "Drop more PDFs here, or click to choose" : "Drop PDFs here, or click to choose"}</strong>
      <small>Medical reports and records that support the request.</small>
    </button>
    {skipped ? <small role="alert" className="mbrfa-field-hint">{skipped === 1 ? "1 file was skipped" : `${skipped} files were skipped`}: only PDFs can be attached.</small> : null}
    <input ref={input} hidden type="file" aria-label="Supporting documents (PDF)" accept="application/pdf,.pdf" multiple onChange={event => { add(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
  </div>;
}
