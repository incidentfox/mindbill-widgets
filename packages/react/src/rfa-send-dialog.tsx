"use client";
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import type { BillClaimsAdministratorDirectory, RfaAuthorizationDestinationOption, RfaClient, RfaRecord } from "@mindbill/browser";
import { RfaAuthorizationDestination } from "./rfa-authorization-destination";

export const rfaSendDialogCss = `.mbrfa-send-backdrop{position:fixed;z-index:1000;inset:0;display:grid;place-items:center;padding:16px;background:rgba(17,28,38,.44)}
.mbrfa-send{display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:min(560px,100%);max-height:min(88vh,760px);border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);color:var(--mb-text);box-shadow:0 18px 48px #0003}
.mbrfa-send>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid var(--mb-border)}.mbrfa-send>header h3{margin:0;font-size:16px}
.mbrfa-send>header button{width:36px;height:36px;min-height:36px;padding:0;border:0;background:none;font-size:22px;line-height:1;cursor:pointer;color:var(--mb-muted)}
.mbrfa-send-body{display:grid;gap:14px;padding:18px 20px;overflow:auto}.mbrfa-send-body p{margin:0}.mbrfa-send-body label{display:grid;gap:5px;font-size:13px}
.mbrfa-send-methods{display:flex;flex-wrap:wrap;gap:6px 18px}.mbrfa-send-methods label{display:flex;align-items:center;gap:8px;min-height:36px;cursor:pointer}.mbrfa-send-methods input{width:16px;height:16px;min-height:16px;margin:0;padding:0;accent-color:var(--mb-accent)}
.mbrfa-send-summary{display:grid;gap:4px;padding:12px 14px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-accent) 4%,var(--mb-surface));font-size:13px}.mbrfa-send-summary span{color:var(--mb-muted)}
.mbrfa-send-confirm{display:flex!important;align-items:flex-start;gap:10px;padding-top:4px;cursor:pointer}.mbrfa-send-confirm input{width:16px;height:16px;min-height:16px;margin:3px 0 0;padding:0;flex:none;accent-color:var(--mb-accent)}
.mbrfa-send>footer{display:flex;flex-direction:row-reverse;gap:10px;padding:14px 20px;border-top:1px solid var(--mb-border)}.mbrfa-send>footer>a{margin-right:auto;align-self:center;font-size:13px}
.mbrfa-send [role=alert]{color:var(--mb-danger,#b42318);font-size:13px}
@media(max-width:640px){.mbrfa-send-backdrop{place-items:end stretch;padding:0}.mbrfa-send{width:100%;max-height:92vh;border-radius:var(--mb-radius) var(--mb-radius) 0 0}.mbrfa-send>footer{flex-direction:column}.mbrfa-send>footer>a{margin:0;align-self:center}}`;

type Mode = "send" | "download";

/** One step to send a request: choose where it goes, confirm once, send. Applying the requesting
 * physician's saved signature and assembling the packet happen as part of sending. */
export function RfaSendDialog({ rfa, client, documentIds, diagnosisDescriptions, directory, directoryLoading, directoryError, environment, canSend, canSign, actorReference, previewUrl, signatureSetup, onUpdated, onSent, onClose }: {
  rfa: RfaRecord; client: RfaClient; documentIds: string[]; diagnosisDescriptions: Record<string, string>;
  directory: BillClaimsAdministratorDirectory | null; directoryLoading: boolean; directoryError: string | null;
  environment: string; canSend: boolean; canSign: boolean; actorReference?: string | undefined; previewUrl?: string | undefined;
  /** Shown when the physician has no saved signature yet. */ signatureSetup?: ReactNode;
  onUpdated: (rfa: RfaRecord) => void; onSent: (rfa: RfaRecord) => void; onClose: () => void;
}): ReactElement {
  const [mode, setMode] = useState<Mode>("send");
  const [destination, setDestination] = useState<RfaAuthorizationDestinationOption | null>(null);
  const [message, setMessage] = useState(""); const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  const keys = useRef(new Map<string, string>()); const alive = useRef(true); const latest = useRef(rfa); latest.current = rfa;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [busy, onClose]);
  const stable = (name: string, body: unknown) => { const print = JSON.stringify([rfa.id, name, body]); let value = keys.current.get(print); if (!value) { value = `rfa-${name}-${crypto.randomUUID()}`; keys.current.set(print, value); } return value; };
  const supporting = rfa.documents.filter(document => ["clinical_report", "supporting_record"].includes(document.documentType) && documentIds.includes(document.id));
  const missingDiagnosis = rfa.items.find(item => !(diagnosisDescriptions[item.id] ?? item.diagnosisDescription ?? "").trim());
  const live = environment === "live";
  const blocked = !supporting.length ? "Add the report that supports this request (PR-2, Doctor's First Report or narrative) before sending."
    : missingDiagnosis ? `Add the diagnosis for ${missingDiagnosis.diagnosisCode} (Edit request) before sending.`
    : !rfa.signedAt && !canSign ? "Sending applies the physician's saved signature, and your account is not set up to do that."
    : mode === "send" && !live ? "This is a sandbox: nothing is faxed or e-mailed. You can still download the packet."
    : mode === "send" && !canSend ? "Sending requires permission from your organization." : "";
  const go = async () => {
    if (busy || blocked || !confirmed || (mode === "send" && !destination)) return;
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
      // 2. Cover sheet + signed form + supporting documents, then out the door (or to a download).
      setBusy(mode === "download" ? "Preparing packet…" : "Sending…");
      const text = message.trim();
      const packet = await client.prepareDelivery(current.id, { documentIds: ids, channel: mode === "download" ? "download" : destination!.method, ...(mode === "send" ? { to: destination!.destination, ...(destination!.recipientName ? { recipientName: destination!.recipientName } : {}) } : {}), ...(text ? { message: text } : {}) });
      if (mode === "download") {
        const url = URL.createObjectURL(await client.getPacket(current.id, packet.packetId));
        window.open(url, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(url), 60_000);
        if (alive.current) onClose();
        return;
      }
      const body = { packetId: packet.packetId, sha256: packet.sha256, channel: destination!.method, to: destination!.destination, ...(destination!.recipientName ? { recipientName: destination!.recipientName } : {}), ...(text ? { message: text } : {}) };
      onSent(await client.submit(current.id, body, stable("submit", body)));
    } catch (caught) {
      if (alive.current) setError(caught instanceof Error ? caught.message : "The request could not be sent. Nothing was sent; try again.");
    } finally { if (alive.current) setBusy(""); }
  };
  const where = mode === "download" ? "" : destination ? `${destination.recipientName ? `${destination.recipientName} · ` : ""}${destination.destination}` : "";
  return <div className="mbrfa-send-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <style>{rfaSendDialogCss}</style>
    <section className="mbrfa-send" role="dialog" aria-modal="true" aria-label="Send request for authorization">
      <header><h3>Send request for authorization</h3><button type="button" aria-label="Close" disabled={!!busy} onClick={onClose}>×</button></header>
      <div className="mbrfa-send-body">
        <div className="mbrfa-send-summary"><strong>{rfa.employeeName}{rfa.claimNumber ? ` · Claim ${rfa.claimNumber}` : ""}</strong><span>{rfa.providerName} · {rfa.items.length} requested treatment{rfa.items.length === 1 ? "" : "s"} · {supporting.length} supporting document{supporting.length === 1 ? "" : "s"}</span></div>
        <div className="mbrfa-send-methods" role="radiogroup" aria-label="How to send">
          <label><input type="radio" name="rfa-send-mode" checked={mode === "send"} disabled={!!busy} onChange={() => { setMode("send"); setConfirmed(false); }} />Send to the claims administrator</label>
          <label><input type="radio" name="rfa-send-mode" checked={mode === "download"} disabled={!!busy} onChange={() => { setMode("download"); setConfirmed(false); }} />Download to send myself</label>
        </div>
        {mode === "send" ? <RfaAuthorizationDestination autoSelectSingle contextKey={`${rfa.id}:${rfa.claimsAdminId ?? "manual"}`} directory={directory} savedContact={rfa.authorizationContact} loading={directoryLoading} error={directoryError} disabled={!!busy} onChange={value => { setDestination(value); setConfirmed(false); }} />
          : <p>Downloading does not mark the request as sent. Keep proof of how you submit it.</p>}
        <label>{mode === "send" && destination?.method === "email" ? "E-mail message" : "Cover sheet message"} (optional)<textarea disabled={!!busy} maxLength={1000} rows={2} value={message} onChange={event => setMessage(event.target.value)} /></label>
        {signatureSetup}
        {blocked ? <p role="alert">{blocked}</p> : <label className="mbrfa-send-confirm"><input type="checkbox" checked={confirmed} disabled={!!busy || (mode === "send" && !destination)} onChange={event => setConfirmed(event.target.checked)} /><span>
          {rfa.signedAt ? "I reviewed this request" : <>I reviewed this request and am authorized by <strong>{rfa.providerName}</strong> to send it with their saved signature</>}{where ? <>, and verified it goes to <strong>{where}</strong></> : null}.</span></label>}
        {error ? <p role="alert">{error}</p> : null}
      </div>
      <footer>
        <button type="button" className="mbtd-primary" disabled={!!busy || !!blocked || !confirmed || (mode === "send" && !destination)} onClick={() => void go()}>{busy || (mode === "download" ? "Download packet" : destination?.method === "email" ? "Send e-mail" : "Send fax")}</button>
        <button type="button" disabled={!!busy} onClick={onClose}>Cancel</button>
        {previewUrl ? <a href={previewUrl} target="_blank" rel="noopener noreferrer">Preview packet</a> : null}
      </footer>
    </section>
  </div>;
}
