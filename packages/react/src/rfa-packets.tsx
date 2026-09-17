"use client";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createRfaPacketsClient, type OrganizationClientOptions, type RfaForwardResult, type RfaPacketHistory, type RfaRecord } from "@mindbill/browser";
import { RfaPdfReview } from "./rfa-delivery-panel";

export type RfaPacketsPanelProps = OrganizationClientOptions & {
  rfa: RfaRecord;
  permissions?: readonly ("act")[];
  environment?: "sandbox" | "live";
  disabled?: boolean;
  onForwarded?: (result: RfaForwardResult) => void;
};

/** Reviews and forwards the exact retained packet, never a regenerated form. */
export function RfaPacketsPanel({ sessionEndpoint, getSession, apiBaseUrl, fetch: fetchOverride, ...props }: RfaPacketsPanelProps): ReactElement {
  const options = useMemo<OrganizationClientOptions>(() => ({ ...(sessionEndpoint ? { sessionEndpoint } : {}), ...(getSession ? { getSession } : {}), ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}) }), [sessionEndpoint, getSession, apiBaseUrl, fetchOverride]);
  const identity = useMemo(() => crypto.randomUUID(), [options]);
  return <PacketsContent key={`${identity}:${props.rfa.id}:${props.rfa.contentRevision}:${props.rfa.status}:${props.environment}:${props.permissions?.join(",")}`} options={options} {...props} />;
}

function PacketsContent({ rfa, options, permissions = [], environment = "sandbox", disabled = false, onForwarded }: Omit<RfaPacketsPanelProps, keyof OrganizationClientOptions> & { options: OrganizationClientOptions }): ReactElement {
  const client = useMemo(() => createRfaPacketsClient(options), [options]);
  const [history, setHistory] = useState<RfaPacketHistory | null>(null);
  const [selected, setSelected] = useState("");
  const [prepared, setPrepared] = useState<{ id: string; blob: Blob } | null>(null);
  const [channel, setChannel] = useState<"fax" | "email">("fax");
  const [recipient, setRecipient] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const pending = useRef(false);
  const keys = useRef(new Map<string, string>());
  const completed = useRef(new Set<string>());
  const alive = useRef(true);
  const currentSelection = useRef(selected); currentSelection.current = selected;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    void client.list(rfa.id).then(value => { if (active) setHistory(value); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Saved packets could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, rfa.id, reload]);
  const packet = history?.packets.find(value => value.id === selected);
  const blob = prepared?.id === selected ? prepared.blob : null;
  const eligible = !!packet && !["draft", "incomplete", "canceled"].includes(rfa.status) && (packet.source === "download" || !!history?.transmissions.some(value => value.packetId === packet.id && value.purpose === "submission" && ["sent", "delivered", "received"].includes(value.status)));
  const canForward = permissions.includes("act") && environment === "live";
  const destination = channel === "email" ? recipient.trim().toLowerCase() : recipient.trim();
  const validRecipient = channel === "fax" ? /^\+[1-9]\d{7,14}$/.test(destination) : destination.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination);
  const signature = JSON.stringify([rfa.id, selected, channel, destination]);
  const alreadyForwarded = completed.current.has(signature) || !!history?.transmissions.some(value => value.packetId === selected && value.purpose === "forward" && value.channel === channel && value.destination === destination && value.status !== "failed");
  const locked = disabled || busy || loading;
  const resetReview = () => { setReviewed(false); setConfirmed(false); setNotice(""); setError(""); };
  const view = async () => {
    if (!packet || pending.current || locked) return;
    pending.current = true; setBusy(true); setError(""); const id = selected;
    try { const result = await client.get(rfa.id, id); if (alive.current && currentSelection.current === id) { setPrepared({ id, blob: result }); setReviewed(false); setConfirmed(false); } }
    catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "The saved PDF could not be loaded."); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  const forward = async () => {
    if (pending.current || locked || !canForward || !eligible || !blob || !reviewed || !confirmed || !validRecipient || alreadyForwarded) return;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    let key = keys.current.get(signature); if (!key) { key = `rfa-forward-${crypto.randomUUID()}`; keys.current.set(signature, key); }
    try {
      const result = await client.forward(rfa.id, { packetId: selected, channel, to: destination }, key);
      if (alive.current) { completed.current.add(signature); setNotice("Forwarding recorded. Check delivery history for receipt confirmation."); setConfirmed(false); onForwarded?.(result); }
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "Forwarding could not be confirmed. Check delivery history before retrying."); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  return <section aria-label="Saved RFA packets">
    <h3>Saved packets</h3><p>Open the exact PDF retained for a download or submission. Forwarding preserves the original request and review deadline.</p>
    {error ? <p role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}
    {loading ? <p role="status">Loading saved packets…</p> : null}
    {!loading && !history ? <button type="button" onClick={() => setReload(value => value + 1)}>Retry loading packets</button> : null}
    {history?.packets.length === 0 ? <p>No saved packets yet.</p> : history ? <>
      <label>Saved packet<select disabled={locked} value={selected} onChange={event => { setSelected(event.target.value); setPrepared(null); resetReview(); }}><option value="">Choose a saved packet</option>{history.packets.map(value => <option key={value.id} value={value.id}>{value.source === "submission" ? "Submission" : "Download"} · revision {value.contentRevision} · {value.createdAt}</option>)}</select></label>
      <button type="button" disabled={locked || !packet} onClick={() => void view()}>View saved PDF</button>
      {blob ? <RfaPdfReview blob={blob} title="Saved RFA packet" /> : null}
      {!canForward ? <p>{environment !== "live" ? "Sandbox: saved PDFs are available for review. External forwarding is disabled." : "Forwarding requires permission from your organization."}</p> : selected && !eligible ? <p>This packet is not eligible for forwarding. Submission packets require a successful original dispatch.</p> : <fieldset disabled={locked}>
        <legend>Forward saved packet</legend>
        <p>The saved packet may contain the original recipient’s cover sheet. Review all pages before forwarding.</p>
        <label>Forward by<select value={channel} onChange={event => { setChannel(event.target.value as "fax" | "email"); resetReview(); }}><option value="fax">Fax</option><option value="email">Email</option></select></label>
        {channel === "email" ? <p>Email forwarding requires email delivery to be enabled for your organization. The server will reject requests when it is unavailable.</p> : null}
        <label>{channel === "fax" ? "Recipient fax (with country code)" : "Recipient email"}<input type={channel === "fax" ? "tel" : "email"} value={recipient} onChange={event => { setRecipient(event.target.value); resetReview(); }} /></label>
        <label className="mbrfa-check"><input type="checkbox" disabled={!blob || !eligible} checked={reviewed} onChange={event => { setReviewed(event.target.checked); setConfirmed(false); }} />I reviewed this saved packet and its attachments.</label>
        <label className="mbrfa-check"><input type="checkbox" disabled={!reviewed || !validRecipient || !eligible} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I verified that {destination || "this recipient"} is authorized to receive this patient’s packet.</label>
        {alreadyForwarded ? <p>A forward to this recipient is already recorded or pending. Check delivery history.</p> : null}
        <button type="button" disabled={!canForward || !eligible || !blob || !reviewed || !confirmed || !validRecipient || alreadyForwarded} onClick={() => void forward()}>{busy ? "Working…" : `Forward packet by ${channel}`}</button>
      </fieldset>}
    </> : null}
  </section>;
}
