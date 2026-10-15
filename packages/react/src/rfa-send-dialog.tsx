"use client";
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import type { BillClaimsAdministratorDirectory, RfaAuthorizationDestinationOption, RfaClient, RfaRecord } from "@mindbill/browser";
import { RfaAuthorizationDestination } from "./rfa-authorization-destination";
import { formatRfaPhone } from "./rfa-official-fields";
import { rfaSendFix } from "./rfa-send-fix";
import { rfaFailureReason } from "./rfa-detail-cards";
import { useVisualViewportVars } from "./form-controls";

export const rfaSendDialogCss = `.mbrfa-send-backdrop{position:fixed;z-index:1000;inset:0;display:grid;place-items:center;padding:16px;background:rgba(17,28,38,.44)}
.mbrfa-send{display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:min(560px,100%);max-height:min(88vh,760px);border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);color:var(--mb-text);box-shadow:0 18px 48px #0003}
.mbrfa-send>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid var(--mb-border)}.mbrfa-send>header h3{margin:0;font-size:16px}
.mbrfa-send>header button{width:36px;height:36px;min-height:36px;padding:0;border:0;background:none;font-size:22px;line-height:1;cursor:pointer;color:var(--mb-muted)}
.mbrfa-send-body{display:grid;gap:14px;padding:18px 20px;overflow:auto}.mbrfa-send-body p{margin:0}.mbrfa-send-body label{display:grid;gap:5px;font-size:13px}
.mbrfa-send-methods{display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px}.mbrfa-send-methods>span{font-size:13px;font-weight:600}.mbrfa-send .mb-rfa-destination{margin:0;padding:0;border:0}.mbrfa-send-to{display:grid;gap:5px;min-width:0}.mbrfa-send-to>span{font-size:13px;font-weight:600}.mbrfa-send-to>span{display:flex;align-items:center;gap:6px}.mbtd .mbrfa-send-to .mbrfa-send-edit{display:inline-grid;place-items:center;width:26px;height:26px;min-height:0;padding:0;border:1px solid var(--mb-border);border-radius:6px;background:var(--mb-surface);color:var(--mb-accent);cursor:pointer}.mbtd .mbrfa-send-to .mbrfa-send-edit:hover{border-color:var(--mb-accent)}.mbrfa-send-failed p{margin:0}.mbrfa-send-failed small{color:var(--mb-muted);font-size:12px}.mbtd .mbrfa-send-failed .mbrfa-text-link{justify-self:start;border:0;background:none;padding:0;min-height:0;font:inherit;font-weight:600;color:var(--mb-accent);text-decoration:underline;cursor:pointer}.mbrfa-send-to[data-method=email] .mbrfa-guidance{display:none}.mbrfa-send .mb-rfa-destination label{display:grid;gap:5px}.mbrfa-send-methods label{display:flex;align-items:center;gap:8px;min-height:36px;cursor:pointer}.mbrfa-send-methods input{width:16px;height:16px;min-height:16px;margin:0;padding:0;accent-color:var(--mb-accent)}
.mbrfa-send-summary{display:grid;gap:4px;padding:12px 14px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-accent) 4%,var(--mb-surface));font-size:13px}.mbrfa-send-summary span{color:var(--mb-muted)}
.mbrfa-send-contents{display:grid;gap:10px}.mbrfa-send-contents h4{margin:0 0 4px;font-size:13px;font-weight:600}.mbrfa-send-contents ul{display:grid;gap:4px;margin:0;padding:0;list-style:none;font-size:13px}.mbrfa-send-contents li{min-width:0;overflow-wrap:anywhere}.mbrfa-send-contents li span,.mbrfa-send-contents p{color:var(--mb-muted);font-size:13px}
.mbrfa-send-signature{display:grid;gap:8px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--mb-danger,#b42318) 35%,var(--mb-border));border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-danger,#b42318) 5%,var(--mb-surface));font-size:13px}
.mbrfa-send-confirm{display:flex!important;align-items:flex-start;gap:10px;padding-top:4px;cursor:pointer}.mbrfa-send-confirm input{width:16px;height:16px;min-height:16px;margin:3px 0 0;padding:0;flex:none;accent-color:var(--mb-accent)}
.mbrfa-send>footer{display:flex;flex-direction:row-reverse;gap:10px;padding:14px 20px;border-top:1px solid var(--mb-border)}.mbrfa-send>footer>a{margin-right:auto;align-self:center;font-size:13px}
.mbrfa-send [role=alert]{color:var(--mb-danger,#b42318);font-size:13px}
/* Never wider than the screen; the body scrolls inside the dialog; long numbers and file names wrap. */
.mbrfa-send-backdrop{inset:auto 0;top:var(--mb-vv-top,0px);height:var(--mb-vv-height,100dvh);box-sizing:border-box;overflow:hidden;overscroll-behavior:contain}
.mbrfa-send{box-sizing:border-box;max-width:100%;min-width:0;max-height:min(88dvh,760px,calc(var(--mb-vv-height,100dvh) - 32px));overflow:hidden}
.mbrfa-send>header,.mbrfa-send>footer{min-width:0}.mbrfa-send>header h3{min-width:0;overflow-wrap:anywhere}
.mbrfa-send-body{min-width:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;overflow-wrap:anywhere}
.mbrfa-send-body :where(div,label,fieldset,section,ul,li,p,span,form){min-width:0;max-width:100%}.mbrfa-send-body :where(input,select,textarea){max-width:100%;box-sizing:border-box}
@media(max-width:640px){.mbrfa-send-backdrop{place-items:end stretch;padding:0}.mbrfa-send{width:100%;max-height:calc(var(--mb-vv-height,100dvh) - 8px);border-radius:var(--mb-radius) var(--mb-radius) 0 0}.mbrfa-send>header{padding:12px 16px}.mbrfa-send-body{padding:14px 16px}.mbrfa-send>footer{flex-direction:column;padding:12px 16px calc(12px + env(safe-area-inset-bottom))}.mbrfa-send>footer>a{margin:0;align-self:center}
.mbrfa-send-backdrop .mbrfa-send input:not([type=checkbox]):not([type=radio]):not([type=file]),.mbrfa-send-backdrop .mbrfa-send textarea{font-size:16px}.mbrfa-send>footer button{min-height:44px}}`;

type Method = "fax" | "email";
const treatmentDetail = (item: RfaRecord["items"][number]): string => [item.procedureCode ? `CPT/HCPCS ${item.procedureCode}` : "", item.quantity ? `Qty ${item.quantity}` : "", item.frequency ?? "", item.duration ?? "", `Dx ${item.diagnosisCode}`].filter(Boolean).join(" · ");

/** One step to send a request: choose where it goes, confirm once, send. Applying the requesting
 * physician's saved signature and assembling the packet happen as part of sending. */
const pencil = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
export function RfaSendDialog({ rfa, client, documentIds, diagnosisDescriptions, directory, directoryLoading, directoryError, environment, canSend, canSign, actorReference, previewUrl, signatureSetup, signatureMissing, resend, onUpdated, onSent, onClose, onFix }: {
  rfa: RfaRecord; client: RfaClient; documentIds: string[]; diagnosisDescriptions: Record<string, string>;
  directory: BillClaimsAdministratorDirectory | null; directoryLoading: boolean; directoryError: string | null;
  environment: string; canSend: boolean; canSign: boolean; actorReference?: string | undefined; previewUrl?: string | undefined;
  /** Shown when the physician has no saved signature yet. */ signatureSetup?: ReactNode;
  /** An earlier attempt failed after the carrier accepted it; this sends the request again. */ resend?: boolean | undefined;
  /** The host knows the requesting physician has no saved signature: say so up front and hold the send until one is added. */ signatureMissing?: boolean | undefined;
  /** Return to the draft editor to fix missing content or attach reports. */
  onFix?: (() => void) | undefined;
  onUpdated: (rfa: RfaRecord) => void; onSent: (rfa: RfaRecord) => void; onClose: () => void;
}): ReactElement {
  useVisualViewportVars();
  // Start on how the request is already addressed: its saved fax, else its saved e-mail.
  const [method, setMethod] = useState<Method>(() => !rfa.authorizationContact?.fax?.trim() && rfa.authorizationContact?.email?.trim() ? "email" : "fax");
  const [destination, setDestination] = useState<RfaAuthorizationDestinationOption | null>(null);
  const [message, setMessage] = useState(""); const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [signatureRefused, setSignatureRefused] = useState(false);
  const keys = useRef(new Map<string, string>()); const alive = useRef(true); const latest = useRef(rfa); latest.current = rfa;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { // A host dialog opened from here (signature setup) handles its own Escape first.
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy && !event.defaultPrevented) onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [busy, onClose]);
  const stable = (name: string, body: unknown) => { const print = JSON.stringify([rfa.id, name, body]); let value = keys.current.get(print); if (!value) { value = `rfa-${name}-${crypto.randomUUID()}`; keys.current.set(print, value); } return value; };
  const supporting = rfa.documents.filter(document => ["clinical_report", "supporting_record"].includes(document.documentType) && documentIds.includes(document.id));
  const fix = rfaSendFix(rfa, documentIds, diagnosisDescriptions);
  const live = environment === "live";
  const lastFailure = rfa.transmissions.map(rfaFailureReason).filter(Boolean).at(-1) ?? "";
  // Known from the host, or learned when the server refused to sign. A host that reports the signature as saved clears it.
  const needsSignature = !rfa.signedAt && (signatureMissing ?? signatureRefused);
  useEffect(() => { if (signatureMissing === false) setSignatureRefused(false); }, [signatureMissing]);
  const blocked = !live ? "This is a sandbox: nothing is faxed or e-mailed."
    : fix ? fix.message
    : !rfa.signedAt && !canSign ? "Sending applies the physician's saved signature, and your account is not set up to do that."
    : !canSend ? "Sending requires permission from your organization." : "";
  const go = async () => {
    if (busy || blocked || needsSignature || !confirmed || !destination) return;
    setError("");
    try {
      // 1. The physician's saved signature goes on the exact form being sent.
      let current = latest.current, ids = documentIds;
      if (!current.signedAt) {
        setBusy("Signing…");
        const body = { diagnosisDescriptions: Object.fromEntries(current.items.map(item => [item.id, (diagnosisDescriptions[item.id] ?? item.diagnosisDescription ?? "").trim()])) };
        const preview = await client.prepareSigning(current.id, body, stable("preview", [body, current.contentRevision]));
        const signing = { snapshotId: preview.id, contentHash: preview.contentHash, renderingProviderId: preview.renderingProviderId, physicianAuthorized: true as const, actorReference: actorReference! };
        current = await client.sign(current.id, signing, stable("sign", signing));
        onUpdated(current);
        const form = current.documents.filter(document => document.documentType === "rfa_form" && document.contentRevision === current.contentRevision).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
        ids = current.documents.filter(document => document.id === form?.id || supporting.some(kept => kept.id === document.id)).map(document => document.id);
      }
      // 2. Cover sheet + signed form + supporting documents, then out the door.
      setBusy("Sending…");
      const text = message.trim();
      const packet = await client.prepareDelivery(current.id, { documentIds: ids, channel: destination.method, to: destination.destination, ...(destination.recipientName ? { recipientName: destination.recipientName } : {}), ...(text ? { message: text } : {}) });
      const body = { packetId: packet.packetId, sha256: packet.sha256, channel: destination!.method, to: destination!.destination, ...(destination!.recipientName ? { recipientName: destination!.recipientName } : {}), ...(text ? { message: text } : {}) };
      onSent(await client.submit(current.id, body, stable("submit", body)));
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : "";
      if (!alive.current) return;
      if (/saved.signature/i.test(reason)) setSignatureRefused(true);
      else setError(/email_rejected/i.test(reason) ? "The mail service refused that e-mail address. Check it, or send another way. Nothing was sent."
        : /return_fax/i.test(reason) ? "Faxing needs your organization’s return fax line, which is not set up yet. Send by e-mail, or ask MindBill to set up the fax line."
        : reason || "The request could not be sent. Nothing was sent; try again.");
    } finally { if (alive.current) setBusy(""); }
  };
  // Say where it goes once, the way a person reads it. A "name" that is only the number again is left out.
  const attention = destination?.recipientName && /[a-z]/i.test(destination.recipientName) ? destination.recipientName : "";
  const where = destination ? `${destination.method === "fax" ? `fax ${formatRfaPhone(destination.destination)}` : destination.destination}${attention ? ` (attention ${attention})` : ""}` : "";
  return <div className="mbrfa-send-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <style>{rfaSendDialogCss}</style>
    <section className="mbrfa-send" role="dialog" aria-modal="true" aria-label="Send request for authorization">
      <header><h3>Send request for authorization</h3><button type="button" aria-label="Close" disabled={!!busy} onClick={onClose}>×</button></header>
      <div className="mbrfa-send-body">
        <div className="mbrfa-send-summary"><strong>{rfa.employeeName}{rfa.claimNumber ? ` · Claim ${rfa.claimNumber}` : ""}</strong><span>{rfa.providerName}</span></div>
        <div className="mbrfa-send-contents">
          <div><h4>Requested treatment{rfa.items.length === 1 ? "" : "s"}</h4><ul>{rfa.items.map(item => { const detail = treatmentDetail(item); return <li key={item.id}>{item.serviceDescription}{detail ? <span> · {detail}</span> : null}</li>; })}</ul></div>
          <div><h4>Supporting documents</h4>{supporting.length ? <ul>{supporting.map(document => <li key={document.id}>{document.filename}</li>)}</ul> : <p>None attached yet.</p>}</div>
        </div>
        {resend ? <div className="mbrfa-send-signature mbrfa-send-failed" role="status"><p>The last attempt did not go through{lastFailure ? `: ${lastFailure.charAt(0).toLowerCase()}${lastFailure.slice(1)}` : ""}. Check the destination with the claims administrator, or choose another way to send, then send again.</p>
          {onFix ? <><button type="button" className="mbrfa-text-link" disabled={!!busy} onClick={onFix}>Edit claims administrator or request</button><small>Changing the claims administrator or request reopens it for a new signature; earlier attempts stay in History.</small></> : null}</div> : null}
        <div className="mbrfa-send-methods" role="radiogroup" aria-label="Send by">
          <span>Send by</span>
          <label><input type="radio" name="rfa-send-method" checked={method === "fax"} disabled={!!busy} onChange={() => { setMethod("fax"); setConfirmed(false); }} />Fax</label>
          <label><input type="radio" name="rfa-send-method" checked={method === "email"} disabled={!!busy} onChange={() => { setMethod("email"); setConfirmed(false); }} />E-mail</label>
        </div>
<div className="mbrfa-send-to" data-method={method}><span>Send to{resend && onFix ? <button type="button" className="mbrfa-send-edit" aria-label="Edit claims administrator details" title="Edit claims administrator details" disabled={!!busy} onClick={onFix}>{pencil}</button> : null}</span><RfaAuthorizationDestination compact preselectSaved autoSelectSingle method={method} contextKey={`${rfa.id}:${rfa.claimsAdminId ?? "manual"}:${method}`} directory={directory} savedContact={rfa.authorizationContact} loading={directoryLoading} error={directoryError} disabled={!!busy} onChange={value => { setDestination(value); setConfirmed(false); }} /></div>
        <label>{method === "email" ? "E-mail message" : "Cover sheet message"} (optional)<textarea disabled={!!busy} maxLength={1000} rows={2} value={message} onChange={event => setMessage(event.target.value)} /></label>
        {needsSignature ? <div className="mbrfa-send-signature"><p role="alert">{rfa.providerName} has no saved signature yet. Sending puts the physician’s signature on the form, so add it first.{signatureSetup ? "" : " Add it on the physician’s page, then send again."}{signatureRefused ? " Nothing was sent." : ""}</p>{signatureSetup}</div> : signatureSetup}
        {blocked ? <div><p role="alert">{blocked}</p>{fix && onFix ? <button type="button" disabled={!!busy} onClick={onFix}>{fix.label}</button> : null}</div> : <label className="mbrfa-send-confirm"><input type="checkbox" checked={confirmed} disabled={!!busy || !destination} onChange={event => setConfirmed(event.target.checked)} /><span>
          {rfa.signedAt ? "I reviewed this request" : <>I reviewed this request and am authorized by <strong>{rfa.providerName}</strong> to send it with their saved signature</>}{where ? <>, and verified it goes to <strong>{where}</strong></> : null}.</span></label>}
        {error ? <p role="alert">{error}</p> : null}
      </div>
      <footer>
        <button type="button" className="mbtd-primary" disabled={!!busy || !!blocked || needsSignature || !confirmed || !destination} onClick={() => void go()}>{busy || (method === "email" ? "Send e-mail" : "Send fax")}</button>
        <button type="button" disabled={!!busy} onClick={onClose}>Cancel</button>
        {previewUrl ? <a href={previewUrl} target="_blank" rel="noopener noreferrer">Preview packet</a> : null}
      </footer>
    </section>
  </div>;
}
