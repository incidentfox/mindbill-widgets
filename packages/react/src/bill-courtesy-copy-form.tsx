"use client";

import { useEffect, useRef, useState } from "react";
import type { BillCourtesyCopyInput, BillCourtesyCopyPreview, BillCourtesyCopyResult } from "@mindbill/browser";
import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";

export type BillCourtesyCopyFormProps = {
  documents: { id: string; filename: string }[];
  subject?: string;
  environment: "sandbox" | "live";
  appearance?: MindBillReactAppearance;
  onPreview: (input: BillCourtesyCopyInput) => Promise<BillCourtesyCopyPreview>;
  onSend: (input: BillCourtesyCopyInput & { packetHash: string }, idempotencyKey: string) => Promise<BillCourtesyCopyResult>;
  onSent?: (result: BillCourtesyCopyResult) => void;
};

/** A courtesy copy is never a payer submission. Preview and recipient confirmation are explicit. */
export function BillCourtesyCopyForm({ documents, subject: initialSubject = "Courtesy copy — bill packet", environment, appearance, onPreview, onSend, onSent }: BillCourtesyCopyFormProps) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [bodyText, setBodyText] = useState("This is a courtesy copy of the bill and report for your records. No payment is being requested from your office.");
  const [documentIds, setDocumentIds] = useState(documents.map((document) => document.id));
  const [includeCms1500, setIncludeCms1500] = useState(true);
  const [preview, setPreview] = useState<BillCourtesyCopyPreview | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BillCourtesyCopyResult | null>(null);
  const retryKey = useRef("");
  const addresses = (value: string) => value.split(/[,;\n]/).map((email) => email.trim()).filter(Boolean);
  const input: BillCourtesyCopyInput = { to: addresses(to), cc: addresses(cc), subject, bodyText, documentIds, includeCms1500 };
  const fingerprint = JSON.stringify(input);
  useEffect(() => { setPreview(null); setConfirmed(false); retryKey.current = ""; setResult(null); }, [fingerprint]);
  useEffect(() => {
    if (!preview) { setPdfUrl(""); return; }
    const bytes = Uint8Array.from(atob(preview.pdfBase64), (character) => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);
  const submit = async () => {
    setBusy(true); setError("");
    try {
      if (!preview) { setPreview(await onPreview(input)); setConfirmed(false); }
      else {
        retryKey.current ||= crypto.randomUUID();
        const sent = await onSend({ ...input, packetHash: preview.packetHash }, retryKey.current);
        setResult(sent); onSent?.(sent);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The courtesy copy could not be completed."); }
    finally { setBusy(false); }
  };
  return <section className="mb-courtesy" style={mindBillAppearanceStyle(appearance)}>
    <style>{COURTESY_STYLES}</style>
    <p>Email one combined PDF for the recipient’s records. This does not submit the bill or change its status.</p>
    {environment === "sandbox" ? <p role="status" className="mb-courtesy-notice">Sandbox preview — no email will be delivered.</p> : null}
    <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <fieldset disabled={busy || Boolean(result) || Boolean(error && retryKey.current)}>
        <div className="mb-courtesy-grid"><div>
          <label>To<input required value={to} onChange={(event) => setTo(event.target.value)} placeholder="recipient@example.com" autoComplete="off" /></label>
          <label>CC <span>(optional)</span><input value={cc} onChange={(event) => setCc(event.target.value)} autoComplete="off" /></label>
          <small>Separate multiple email addresses with commas. Replies return to the workspace inbox.</small>
        </div><div className="mb-courtesy-documents"><h3>Combined PDF packet</h3>
          <label><input type="checkbox" checked disabled />Proof of submission cover sheet — first page</label>
          <label><input type="checkbox" checked={includeCms1500} onChange={(event) => setIncludeCms1500(event.target.checked)} />CMS-1500 bill</label>
          {documents.map((document) => <label key={document.id}><input type="checkbox" checked={documentIds.includes(document.id)} onChange={(event) => setDocumentIds((ids) => event.target.checked ? [...ids, document.id] : ids.filter((id) => id !== document.id))} />{document.filename}</label>)}
        </div></div>
        <label>Subject<input required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
        <label>Message<textarea required maxLength={10000} rows={4} value={bodyText} onChange={(event) => setBodyText(event.target.value)} /></label>
      </fieldset>
      {preview && pdfUrl ? <div className="mb-courtesy-preview"><a href={pdfUrl} target="_blank" rel="noreferrer">Review combined PDF ({preview.documentCount} documents)</a><iframe title="Courtesy copy PDF preview" src={pdfUrl} /><label><input type="checkbox" checked={confirmed} disabled={busy || Boolean(result)} onChange={(event) => setConfirmed(event.target.checked)} />I reviewed the packet and verified all recipients may receive these records.</label></div> : null}
      {error ? <p role="alert">{error} {retryKey.current ? "Delivery may have completed. Retry here uses the same request; do not start a new copy or reopen this form until the delivery is confirmed." : "No email was requested. Check the details and try the preview again."}</p> : null}
      {result ? <p role="status">{result.sent ? "Courtesy copy sent." : result.simulated ? "Sandbox simulation complete. No email was sent." : "Email delivery is disabled. No email was sent."}</p> : <button type="submit" disabled={busy || Boolean(preview && !confirmed)}>{busy ? "Preparing…" : !preview ? "Preview packet" : environment === "sandbox" ? "Simulate courtesy copy" : "Send courtesy copy"}</button>}
    </form>
  </section>;
}

const COURTESY_STYLES = `
.mb-courtesy{color:var(--mb-text,#243f47);font:inherit;max-width:100%;min-width:0}.mb-courtesy *{box-sizing:border-box}.mb-courtesy p{line-height:1.5;color:var(--mb-muted,#61747b)}.mb-courtesy fieldset{border:0;padding:0;margin:0;min-width:0}.mb-courtesy label{display:grid;gap:8px;margin:16px 0;font-weight:600}.mb-courtesy input:not([type=checkbox]),.mb-courtesy textarea{font:inherit;color:inherit;width:100%;min-width:0;background:var(--mb-surface,#fff);border:1px solid var(--mb-border,#d7dfdd);border-radius:var(--mb-control-radius,8px);padding:10px 12px}.mb-courtesy input[type=checkbox]{accent-color:var(--mb-accent,#215b5c);width:16px;height:16px;flex:0 0 auto}.mb-courtesy input:focus-visible,.mb-courtesy textarea:focus-visible,.mb-courtesy button:focus-visible{outline:2px solid var(--mb-accent,#215b5c);outline-offset:3px}.mb-courtesy-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.mb-courtesy h3{font-size:16px}.mb-courtesy-documents label,.mb-courtesy-preview label{display:flex;align-items:flex-start;gap:10px;overflow-wrap:anywhere;font-weight:400}.mb-courtesy small,.mb-courtesy label span{font-weight:400;color:var(--mb-muted,#61747b)}.mb-courtesy-notice{background:var(--mb-soft,#f4f6f4);padding:12px;border-radius:8px}.mb-courtesy-preview{padding:16px 0}.mb-courtesy-preview a{color:var(--mb-accent,#215b5c)}.mb-courtesy-preview iframe{display:block;width:100%;height:300px;border:1px solid var(--mb-border,#d7dfdd);margin-top:12px}.mb-courtesy button{font:inherit;background:var(--mb-accent,#215b5c);color:var(--mb-accent-contrast,#fff);border:0;border-radius:var(--mb-control-radius,8px);padding:11px 18px;cursor:pointer}.mb-courtesy button:disabled{opacity:.55;cursor:default}@media(max-width:640px){.mb-courtesy-grid{grid-template-columns:1fr;gap:8px}}
`;
