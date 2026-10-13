"use client";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createRfaPacketsClient, type BillClaimsAdministratorDirectory, type OrganizationClientOptions, type RfaAuthorizationDestinationOption, type RfaPacketHistory, type RfaRecord } from "@mindbill/browser";
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
const friendly = (reason: string): string => /already_dispatched|already recorded/i.test(reason) ? "A duplicate to this destination was already sent. Check History & Activity before sending another."
  : /return_fax/i.test(reason) ? "Faxing needs your organization's return fax line, which is not set up yet. Send by e-mail, or ask MindBill to set up the fax line."
  : /live_disabled/i.test(reason) ? "Sending is switched off for this workspace." : reason || "The duplicate could not be sent. Nothing was sent; try again.";

/** Send the same packet again to the claims administrator (or to someone else) after the request was sent.
 * The original sent and received dates, and the decision deadline, do not change. */
export function RfaDuplicateDialog({ rfa, options, directory, directoryLoading, directoryError, environment, canAct, onSent, onClose }: {
  rfa: RfaRecord; options: OrganizationClientOptions; directory: BillClaimsAdministratorDirectory | null; directoryLoading: boolean; directoryError: string | null;
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
  const blocked = !history ? "" : !packet ? "The packet sent for this request was not saved here, so a duplicate cannot be sent from MindBill. Download the request and its documents and send them yourself."
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
    let key = keys.current.get(print); if (!key) { key = `rfa-duplicate-${crypto.randomUUID()}`; keys.current.set(print, key); }
    try { await client.forward(rfa.id, { packetId: packet.id, channel: destination.method, to: destination.destination }, key); if (alive.current) { setDone(true); onSent(); } }
    catch (reason) { if (alive.current) setError(friendly(reason instanceof Error ? reason.message : "")); }
    finally { if (alive.current) setBusy(false); }
  };
  return <div className="mbrfa-send-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <style>{rfaSendDialogCss}</style>
    <section className="mbrfa-send" role="dialog" aria-modal="true" aria-label="Send duplicate request">
      <header><h3>Send duplicate</h3><button type="button" aria-label="Close" disabled={busy} onClick={onClose}>×</button></header>
      <div className="mbrfa-send-body">
        <div className="mbrfa-send-summary"><strong>{rfa.employeeName}{rfa.claimNumber ? ` · Claim ${rfa.claimNumber}` : ""}</strong><span>{rfa.providerName}</span></div>
        <p>Sends the same packet that was sent before. The original sent and received dates, and the decision deadline, stay as they are.</p>
        {done ? <p role="status">Duplicate sent to {where}. It appears under History &amp; Activity.</p> : <>
          <div className="mbrfa-send-methods" role="radiogroup" aria-label="Send by"><span>Send by</span>
            <label><input type="radio" name="rfa-duplicate-method" checked={method === "fax"} disabled={busy} onChange={() => { setMethod("fax"); setConfirmed(false); }} />Fax</label>
            <label><input type="radio" name="rfa-duplicate-method" checked={method === "email"} disabled={busy} onChange={() => { setMethod("email"); setConfirmed(false); }} />E-mail</label>
          </div>
          <div className="mbrfa-send-to" data-method={method}><span>Send to</span><RfaAuthorizationDestination compact preselectSaved autoSelectSingle method={method} contextKey={`dup:${rfa.id}:${rfa.claimsAdminId ?? "manual"}:${method}`} directory={directory} savedContact={rfa.authorizationContact} loading={directoryLoading} error={directoryError} disabled={busy} onChange={value => { setDestination(value); setConfirmed(false); }} /></div>
          {!history && !error ? <p role="status">Loading the sent packet…</p> : null}
          {blocked ? <p role="alert">{blocked}</p> : history ? <label className="mbrfa-send-confirm"><input type="checkbox" checked={confirmed} disabled={busy || !destination} onChange={event => setConfirmed(event.target.checked)} /><span>I reviewed the packet{where ? <> and verified that <strong>{where}</strong> may receive this patient’s request</> : null}.</span></label> : null}
        </>}
        {error ? <p role="alert">{error}</p> : null}
      </div>
      <footer>
        {done ? <button type="button" className="mbtd-primary" onClick={onClose}>Done</button> : <button type="button" className="mbtd-primary" disabled={busy || !!blocked || !packet || !destination || !confirmed} onClick={() => void go()}>{busy ? "Sending…" : "Send duplicate"}</button>}
        {done ? null : <button type="button" disabled={busy} onClick={onClose}>Cancel</button>}
        {packet && !done ? <a href={preview || "#"} target="_blank" rel="noopener noreferrer" onClick={event => { if (!preview) { event.preventDefault(); void openPreview(); } }}>Preview packet</a> : null}
      </footer>
    </section>
  </div>;
}
