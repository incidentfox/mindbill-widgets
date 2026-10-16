"use client";
import { useEffect, useRef, useState, type ReactElement } from "react";
import type { BillClaimsAdministratorDirectory, RfaAuthorizationDestinationOption, RfaClient, RfaDeliveryPreview, RfaRecord } from "@mindbill/browser";
import { RfaAuthorizationDestination } from "./rfa-authorization-destination";
import { Select } from "./form-controls";

const PDF_VIEW = "toolbar=0&view=FitH&navpanes=0";

export function RfaPdfReview({ blob, title, fill = false, newTabLink = true }: { blob: Blob; title: string; /** Fill the container's height, fitted to page width without the thumbnail sidebar. */ fill?: boolean; /** In fill mode, overlay an "Open in new tab" link (off when the host already offers one). */ newTabLink?: boolean }): ReactElement {
  const [url, setUrl] = useState("");
  useEffect(() => { const next = URL.createObjectURL(blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [blob]);
  // The browser's built-in viewer titles its toolbar from the PDF's own metadata or the blob
  // URL (a random id, or "about:blank" for many fax PDFs), which the page cannot set. The
  // toolbar is hidden here; the surrounding dialog names the document, and "Open in new tab"
  // gives the full viewer (zoom, rotate, print) when it is needed.
  if (fill) return url ? <div style={{ position: "relative", width: "100%", height: "100%" }}><iframe title={title} src={`${url}#${PDF_VIEW}`} style={{ width: "100%", height: "100%", border: 0, display: "block" }} />{newTabLink ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ position: "absolute", top: 10, right: 18, padding: "5px 10px", borderRadius: 6, background: "rgba(32,33,36,.82)", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>Open in new tab</a> : null}</div> : <></>;
  return <div>{url ? <><div className="mbtd-actions"><a href={url} target="_blank" rel="noopener noreferrer">Open {title} PDF</a><a href={url} download="authorization-packet.pdf">Download PDF</a></div><iframe title={title} src={`${url}#${PDF_VIEW}`} style={{ width: "100%", height: 420, border: "1px solid var(--mb-border)", marginTop: 10 }} /></> : null}</div>;
}

export function RfaDeliveryPanel({ rfa, client, documentIds, directory, directoryLoading, directoryError, locked, environment, canSend, run, onUpdated }: {
  rfa: RfaRecord; client: RfaClient; documentIds: string[]; directory: BillClaimsAdministratorDirectory | null;
  directoryLoading: boolean; directoryError: string | null; locked: boolean; environment: string; canSend: boolean;
  run: (work: () => Promise<void>) => Promise<void>; onUpdated: (rfa: RfaRecord) => void;
}): ReactElement {
  const [mode, setMode] = useState<"send" | "download">("send");
  const [destination, setDestination] = useState<RfaAuthorizationDestinationOption | null>(null);
  const [message, setMessage] = useState("");
  const [prepared, setPrepared] = useState<{ preview: RfaDeliveryPreview; blob: Blob; fingerprint: string } | null>(null);
  const [reviewed, setReviewed] = useState(false); const [confirmed, setConfirmed] = useState(false);
  const keys = useRef(new Map<string, string>());
  const fingerprint = JSON.stringify([rfa.id, rfa.contentRevision, documentIds, mode, destination?.method, destination?.destination, destination?.recipientName, message.trim()]);
  const current = useRef(fingerprint); current.current = fingerprint;
  useEffect(() => { setPrepared(null); setReviewed(false); setConfirmed(false); }, [fingerprint]);
  const packet = prepared?.fingerprint === fingerprint ? prepared : null;
  return <fieldset><legend>Review packet and send</legend>
    {!rfa.readiness.ready ? <p>Still needed: {rfa.readiness.missing.map(value => value === "signedAt" ? "physician signature" : value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").toLowerCase()).join(", ") || "Complete the request details"}.</p> : null}
    <label>Delivery method<Select disabled={locked} value={mode} onChange={(choice) => setMode(choice as "send" | "download")}><option value="send">Send to claims administrator</option><option value="download">Download for manual submission</option></Select></label>
    {mode === "send" ? <RfaAuthorizationDestination contextKey={`${rfa.id}:${rfa.claimsAdminId ?? "manual"}`} directory={directory} savedContact={rfa.authorizationContact} loading={directoryLoading} error={directoryError} disabled={locked} onChange={setDestination} /> : <p>Downloading does not mark this request as sent. Keep proof of any submission made outside this dashboard.</p>}
    <label>{destination?.method === "email" && mode === "send" ? "Email message (optional)" : "Fax cover sheet message (optional)"}<textarea disabled={locked} maxLength={1000} rows={3} value={message} onChange={event => setMessage(event.target.value)} /></label>
    <button type="button" disabled={locked || !rfa.signedAt || documentIds.length < 2 || (mode === "send" && !destination)} onClick={() => void run(async () => {
      const requestFingerprint = fingerprint;
      const preview = await client.prepareDelivery(rfa.id, { documentIds, channel: mode === "download" ? "download" : destination!.method, ...(mode === "send" ? { to: destination!.destination, ...(destination!.recipientName ? { recipientName: destination!.recipientName } : {}) } : {}), ...(message.trim() ? { message: message.trim() } : {}) });
      const blob = await client.getPacket(rfa.id, preview.packetId);
      if (current.current === requestFingerprint) { setPrepared({ preview, blob, fingerprint: requestFingerprint }); setReviewed(false); setConfirmed(false); }
    })}>Prepare packet with cover sheet</button>
    {packet ? <><RfaPdfReview blob={packet.blob} title="RFA submission packet" /><label className="mbrfa-check"><input type="checkbox" disabled={locked} checked={reviewed} onChange={event => { setReviewed(event.target.checked); setConfirmed(false); }} />I reviewed the assembled packet, including the cover sheet and clinical documents.</label></> : null}
    {mode === "send" ? environment !== "live" ? <p className="mbtd-note">Sandbox: review and prepare the packet here. External fax delivery is disabled. Email sending is also disabled.</p> : !canSend ? <p>Sending requires permission from your organization.</p> : <>
      <label className="mbrfa-check"><input type="checkbox" disabled={locked || !packet || !reviewed || !destination} checked={confirmed && !!packet} onChange={event => setConfirmed(event.target.checked)} />Send this reviewed packet to {destination?.recipientName ? `${destination.recipientName} at ` : ""}{destination?.destination || "the selected authorization recipient"}. I verified the recipient for this claim.</label>
      <button type="button" className="mbtd-primary" disabled={locked || !confirmed || !reviewed || !packet || !destination || !rfa.readiness.ready || !!rfa.submittedAt} onClick={() => void run(async () => {
        if (!packet || !destination || !confirmed || !reviewed) return;
        const body = { packetId: packet.preview.packetId, sha256: packet.preview.sha256, channel: destination.method, to: destination.destination, ...(destination.recipientName ? { recipientName: destination.recipientName } : {}), ...(message.trim() ? { message: message.trim() } : {}) };
        const signature = JSON.stringify(body); let operationKey = keys.current.get(signature); if (!operationKey) { operationKey = `rfa-submit-${crypto.randomUUID()}`; keys.current.set(signature, operationKey); }
        onUpdated(await client.submit(rfa.id, body, operationKey));
      })}>{destination?.method === "email" ? "Send authorization email" : "Send authorization fax"}</button>
    </> : null}
  </fieldset>;
}
