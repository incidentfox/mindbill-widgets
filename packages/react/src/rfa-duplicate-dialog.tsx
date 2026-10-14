"use client";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createRfaPacketsClient, normalizeRfaFax, type BillClaimsAdministratorDirectory, type OrganizationClientOptions, type RfaAuthorizationDestinationOption, type RfaPacketHistory, type RfaRecord } from "@mindbill/browser";
import { RfaAuthorizationDestination } from "./rfa-authorization-destination";
import { formatRfaPhone } from "./rfa-official-fields";
import { rfaSendDialogCss } from "./rfa-send-dialog";

type Method = "fax" | "email";
const SENT = ["sent", "delivered", "received"];
/** The packet a duplicate re-sends: what was actually sent, else the latest packet saved from this request. */
export function rfaDuplicatePacket(history: RfaPacketHistory): RfaPacketHistory["packets"][number] | null {
  const newest = [...history.packets].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return newest.find(packet => history.transmissions.some(sent => sent.packetId === packet.id && sent.purpose === "submission" && SENT.includes(sent.status)))
    ?? newest.find(packet => packet.source === "download") ?? null;
}
/** A host contact offered as a Forward destination, e.g. the claim's adjuster. */
export type RfaForwardContact = { name: string; role?: string; fax?: string; email?: string };
/** Destination options for host contacts: one per fax and e-mail, labelled "Role · Name". */
export function rfaForwardContactOptions(contacts: readonly RfaForwardContact[]): RfaAuthorizationDestinationOption[] {
  return contacts.flatMap(contact => {
    const name = contact.name.trim(); const label = [contact.role?.trim(), name].filter(Boolean).join(" · ") || "Claim contact";
    const fax = contact.fax ? normalizeRfaFax(contact.fax) : null; const email = contact.email?.trim();
    return [
      ...(fax ? [{ method: "fax" as const, destination: fax, label, ...(name ? { recipientName: name } : {}) }] : []),
      ...(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? [{ method: "email" as const, destination: email, label, ...(name ? { recipientName: name } : {}) }] : []),
    ];
  });
}
const friendly = (reason: string): string => /already_dispatched|already recorded/i.test(reason) ? "This RFA was already forwarded to this destination. Check History & Activity before forwarding again."
  : /return_fax/i.test(reason) ? "Faxing needs your organization's return fax line, which is not set up yet. Send by e-mail, or ask MindBill to set up the fax line."
  : /live_disabled/i.test(reason) ? "Sending is switched off for this workspace." : reason || "The RFA could not be forwarded. Nothing was sent; try again.";

/** Forward the packet that was sent to the claims administrator, adjuster or anyone else (daisyBill "Forward").
 * The original sent and received dates, and the decision deadline, do not change. */
export function RfaDuplicateDialog({ rfa, forwardContacts, options, directory, directoryLoading, directoryError, environment, canAct, onSent, onClose }: {
  rfa: RfaRecord; forwardContacts?: readonly RfaForwardContact[]; options: OrganizationClientOptions; directory: BillClaimsAdministratorDirectory | null; directoryLoading: boolean; directoryError: string | null;
  environment: string; canAct: boolean; onSent: () => void; onClose: () => void;
}): ReactElement {
  const client = useMemo(() => createRfaPacketsClient(options), [options]);
  const [history, setHistory] = useState<RfaPacketHistory | null>(null);
  const [method, setMethod] = useState<Method>(() => !rfa.authorizationContact?.fax?.trim() && rfa.authorizationContact?.email?.trim() ? "email" : "fax");
  const [destination, setDestination] = useState<RfaAuthorizationDestinationOption | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  const [preview, setPreview] = useState("");
  const keys = useRef(new Map<string, string>()); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy && !event.defaultPrevented) onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [busy, onClose]);
  useEffect(() => { let active = true; void client.list(rfa.id).then(value => { if (active) setHistory(value); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "The sent packet could not be loaded."); }); return () => { active = false; }; }, [client, rfa.id]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const packet = history ? rfaDuplicatePacket(history) : null;
  const contactOptions = useMemo(() => rfaForwardContactOptions(forwardContacts ?? []), [forwardContacts]);
  const blocked = !history ? "" : !packet ? "The packet sent for this request was not saved here, so it cannot be forwarded from MindBill. Download the request and its documents and send them yourself."
    : environment !== "live" ? "This is a sandbox: nothing is faxed or e-mailed." : !canAct ? "Sending requires permission from your organization." : "";
  const where = destination ? destination.method === "fax" ? `fax ${formatRfaPhone(destination.destination)}` : destination.destination : "";
  const openPreview = async () => {
    if (!packet || busy) return;
    const tab = window.open("", "_blank");
    try { const url = URL.createObjectURL(await client.get(rfa.id, packet.id)); if (alive.current) setPreview(url); if (tab) tab.location.href = url; else window.location.assign(url); }
    catch (reason) { tab?.close(); if (alive.current) setError(reason instanceof Error ? reason.message : "The packet could not be opened."); }
  };
  const go = async () => {
    if (busy || blocked || !packet || !destination || !confirmed) return;
    setBusy(true); setError("");
    const print = JSON.stringify([rfa.id, packet.id, destination.method, destination.destination]);
    let key = keys.current.get(print); if (!key) { key = `rfa-forward-${crypto.randomUUID()}`; keys.current.set(print, key); }
    try { await client.forward(rfa.id, { packetId: packet.id, channel: destination.method, to: destination.destination }, key); if (alive.current) { setDone(true); onSent(); } }
    catch (reason) { if (alive.current) setError(friendly(reason instanceof Error ? reason.message : "")); }
    finally { if (alive.current) setBusy(false); }
  };
  return <div className="mbrfa-send-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <style>{rfaSendDialogCss}</style>
    <section className="mbrfa-send" role="dialog" aria-modal="true" aria-label="Forward RFA">
      <header><h3>Forward RFA</h3><button type="button" aria-label="Close" disabled={busy} onClick={onClose}>×</button></header>
      <div className="mbrfa-send-body">
        <div className="mbrfa-send-summary"><strong>{rfa.employeeName}{rfa.claimNumber ? ` · Claim ${rfa.claimNumber}` : ""}</strong><span>{rfa.providerName}</span></div>
        <p>Forwards the packet that was sent, by fax or e-mail. The original sent and received dates, and the decision deadline, stay as they are.</p>
        {done ? <p role="status">Forwarded to {where}. It appears under History &amp; Activity.</p> : <>
          <div className="mbrfa-send-methods" role="radiogroup" aria-label="Forward by"><span>Forward by</span>
            <label><input type="radio" name="rfa-duplicate-method" checked={method === "fax"} disabled={busy} onChange={() => { setMethod("fax"); setConfirmed(false); }} />Fax</label>
            <label><input type="radio" name="rfa-duplicate-method" checked={method === "email"} disabled={busy} onChange={() => { setMethod("email"); setConfirmed(false); }} />E-mail</label>
          </div>
          <div className="mbrfa-send-to" data-method={method}><span>Forward to</span><RfaAuthorizationDestination compact {...(contactOptions.length ? { extraOptions: contactOptions } : {})} preselectSaved autoSelectSingle method={method} contextKey={`dup:${rfa.id}:${rfa.claimsAdminId ?? "manual"}:${method}`} directory={directory} savedContact={rfa.authorizationContact} loading={directoryLoading} error={directoryError} disabled={busy} onChange={value => { setDestination(value); setConfirmed(false); }} /></div>
          {!history && !error ? <p role="status">Loading the sent packet…</p> : null}
          {blocked ? <p role="alert">{blocked}</p> : history ? <label className="mbrfa-send-confirm"><input type="checkbox" checked={confirmed} disabled={busy || !destination} onChange={event => setConfirmed(event.target.checked)} /><span>I reviewed the packet{where ? <> and verified that <strong>{where}</strong> may receive this patient’s request</> : null}.</span></label> : null}
        </>}
        {error ? <p role="alert">{error}</p> : null}
      </div>
      <footer>
        {done ? <button type="button" className="mbtd-primary" onClick={onClose}>Done</button> : <button type="button" className="mbtd-primary" disabled={busy || !!blocked || !packet || !destination || !confirmed} onClick={() => void go()}>{busy ? "Forwarding…" : "Forward"}</button>}
        {done ? null : <button type="button" disabled={busy} onClick={onClose}>Cancel</button>}
        {packet && !done ? <a href={preview || "#"} target="_blank" rel="noopener noreferrer" onClick={event => { if (!preview) { event.preventDefault(); void openPreview(); } }}>Preview packet</a> : null}
      </footer>
    </section>
  </div>;
}
