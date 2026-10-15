"use client";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createRfaPacketsClient, normalizeRfaFax, type BillClaimsAdministratorDirectory, type OrganizationClientOptions, type RfaAuthorizationDestinationOption, type RfaClient, type RfaPacketHistory, type RfaRecord } from "@mindbill/browser";
import { RfaAuthorizationDestination } from "./rfa-authorization-destination";
import { formatRfaPhone } from "./rfa-official-fields";
import { rfaSendDialogCss } from "./rfa-send-dialog";
import { Select, useVisualViewportVars } from "./form-controls";

type Method = "fax" | "email";
type Document = RfaRecord["documents"][number] & { sizeBytes?: number };
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

const FORWARDABLE = ["rfa_form", "clinical_report", "supporting_record", "ur_response", "imr_form", "other"];
const TYPE_LABEL: Record<string, string> = { rfa_form: "Signed DWC Form RFA", clinical_report: "Clinical report", supporting_record: "Supporting record", ur_response: "UR response", imr_form: "IMR application", other: "Other document" };
const rank = (type: string) => type === "rfa_form" ? 0 : type === "clinical_report" ? 1 : 2;
/** The documents a Forward may include, in the order they are sent: the signed form, reports, then others.
 * Working files (signing previews), saved fax covers and forms of an earlier revision are left out. */
export function rfaForwardDocuments(rfa: Pick<RfaRecord, "documents" | "contentRevision">): Document[] {
  return (rfa.documents as Document[])
    .filter(document => !document.internal && document.filename !== "DWC-RFA-signing-preview.pdf" && FORWARDABLE.includes(document.documentType)
      && (document.documentType !== "rfa_form" || document.contentRevision == null || document.contentRevision === rfa.contentRevision))
    .map((document, index) => ({ document, index }))
    .sort((a, b) => rank(a.document.documentType) - rank(b.document.documentType) || a.index - b.index).map(entry => entry.document);
}
/** Starts with the signed DWC Form RFA chosen: the newest form of the current revision. */
export function rfaForwardDefaultSelection(documents: readonly Document[]): string[] {
  const forms = documents.filter(document => document.documentType === "rfa_form").sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return forms[0] ? [forms[0].id] : [];
}
const size = (bytes?: number) => !bytes ? "" : bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const isPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);
const PACKET = "packet";

const friendly = (reason: string): string => /already_dispatched|already recorded/i.test(reason) ? "This RFA was already forwarded to this destination and that send is not confirmed yet. Check History & Activity before forwarding again."
  : /return_fax/i.test(reason) ? "Faxing needs your organization's return fax line, which is not set up yet. Send by e-mail, or ask MindBill to set up the fax line."
  : /live_disabled/i.test(reason) ? "Sending is switched off for this workspace."
  : /too large/i.test(reason) ? "The selected documents are too large to send together (20 MB at most). Leave some out and forward them separately."
  : /too many pages/i.test(reason) ? "The selected documents are too long to send together (500 pages at most). Leave some out and forward them separately."
  : /invalid pdf|integrity/i.test(reason) ? "One of the selected documents could not be read as a PDF. Leave it out, or upload it again."
  : /transition/i.test(reason) ? "This request cannot be forwarded now: only a sent request that is not Incomplete can be forwarded."
  : reason || "The RFA could not be forwarded. Nothing was sent; try again.";

/** Forward a sent RFA to the claims administrator, an adjuster or anyone else (daisyBill "Forward"): choose the
 * documents to include, add attachments, and send by fax or e-mail with a forward cover sheet. The original sent
 * and received dates, and the decision deadline, do not change. */
export function RfaDuplicateDialog({ rfa, forwardContacts, options, records, canUpload = false, directory, directoryLoading, directoryError, environment, canAct, onUpdated, onSent, onClose }: {
  rfa: RfaRecord; forwardContacts?: readonly RfaForwardContact[]; options: OrganizationClientOptions;
  /** Uploads attachments and opens documents. Without it the dialog lists the request's documents only. */ records?: RfaClient;
  /** The viewer may add documents to the request (attachments are saved to it before forwarding). */ canUpload?: boolean;
  directory: BillClaimsAdministratorDirectory | null; directoryLoading: boolean; directoryError: string | null;
  environment: string; canAct: boolean; onUpdated?: (rfa: RfaRecord) => void; onSent: () => void; onClose: () => void;
}): ReactElement {
  useVisualViewportVars();
  const client = useMemo(() => createRfaPacketsClient(options), [options]);
  const [record, setRecord] = useState(rfa);
  const [history, setHistory] = useState<RfaPacketHistory | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [method, setMethod] = useState<Method>(() => !rfa.authorizationContact?.fax?.trim() && rfa.authorizationContact?.email?.trim() ? "email" : "fax");
  const [destination, setDestination] = useState<RfaAuthorizationDestinationOption | null>(null);
  const documents = useMemo(() => rfaForwardDocuments(record), [record]);
  const [selected, setSelected] = useState<string[]>(() => rfaForwardDefaultSelection(rfaForwardDocuments(rfa)));
  const [message, setMessage] = useState("");
  const [attachAs, setAttachAs] = useState<"other" | "supporting_record">("other");
  const [uploading, setUploading] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  const keys = useRef(new Map<string, string>()); const alive = useRef(true); const picker = useRef<HTMLInputElement>(null); const urls = useRef<string[]>([]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; urls.current.forEach(url => URL.revokeObjectURL(url)); }; }, []);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy && !event.defaultPrevented) onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [busy, onClose]);
  // A missing packet history only hides "Packet as sent"; the request's documents can still be forwarded.
  useEffect(() => { let active = true; void client.list(rfa.id).then(value => { if (active) setHistory(value); }).catch(() => { if (active) setHistoryFailed(true); }); return () => { active = false; }; }, [client, rfa.id]);
  const packet = history ? rfaDuplicatePacket(history) : null;
  const contactOptions = useMemo(() => rfaForwardContactOptions(forwardContacts ?? []), [forwardContacts]);
  const working = busy || uploading.length > 0;
  const blocked = record.status === "incomplete" ? "This request is Incomplete. Fix it and send it again before forwarding it."
    : environment !== "live" ? "This is a sandbox: nothing is faxed or e-mailed." : !canAct ? "Forwarding requires permission from your organization." : "";
  const where = destination ? destination.method === "fax" ? `fax ${formatRfaPhone(destination.destination)}` : destination.destination : "";
  const documentIds = documents.filter(document => selected.includes(document.id)).map(document => document.id);
  const withPacket = !!packet && selected.includes(PACKET);
  const chosen = documentIds.length + (withPacket ? 1 : 0);
  const ready = !working && !blocked && chosen > 0 && !!destination && confirmed;
  const toggle = (id: string) => { setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); setDone(false); };

  const view = async (load: () => Promise<Blob>) => {
    const tab = window.open("", "_blank");
    try { const url = URL.createObjectURL(await load()); urls.current.push(url); if (tab) tab.location.href = url; else window.location.assign(url); }
    catch (reason) { tab?.close(); if (alive.current) setError(reason instanceof Error ? reason.message : "The document could not be opened."); }
  };
  const upload = async (files: File[]) => {
    if (!records || !canUpload || working) return;
    const pdfs = files.filter(isPdf);
    const problem = pdfs.length < files.length ? "Only PDF files can be attached." : pdfs.some(file => file.size < 1 || file.size > 25 * 1024 * 1024) ? "Each attachment must be a PDF up to 25 MB." : "";
    setError(problem);
    const accepted = pdfs.filter(file => file.size >= 1 && file.size <= 25 * 1024 * 1024);
    if (!accepted.length) return;
    setUploading(accepted.map(file => file.name));
    let current = record;
    try {
      for (const file of accepted) {
        const before = new Set(current.documents.map(document => document.id));
        current = await records.uploadDocument(current.id, { file, documentType: attachAs, contentRevision: current.contentRevision }, `rfa-forward-attachment-${crypto.randomUUID()}`);
        const added = current.documents.filter(document => !before.has(document.id)).map(document => document.id);
        if (!alive.current) return;
        setRecord(current); setSelected(value => [...value, ...added]); setUploading(value => value.slice(1));
        onUpdated?.(current);
      }
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? `The attachment could not be added: ${reason.message}` : "The attachment could not be added."); }
    finally { if (alive.current) setUploading([]); }
  };
  const go = async () => {
    if (!ready || !destination) return;
    setBusy(true); setError("");
    const input = { ...(withPacket && packet ? { packetId: packet.id } : {}), documentIds, channel: destination.method, to: destination.destination,
      ...(message.trim() ? { message: message.trim() } : {}), ...(destination.recipientName ? { recipientName: destination.recipientName } : {}) };
    // The same choice keeps its key, so a retry after a lost response can never send twice.
    const print = JSON.stringify([record.id, input]);
    let key = keys.current.get(print); if (!key) { key = `rfa-forward-${crypto.randomUUID()}`; keys.current.set(print, key); }
    try { await client.forward(record.id, input, key); if (alive.current) { setDone(true); onSent(); } }
    catch (reason) { if (alive.current) setError(friendly(reason instanceof Error ? reason.message : "")); }
    finally { if (alive.current) setBusy(false); }
  };

  const row = (id: string, name: string, kind: string, detail: string, open: (() => Promise<Blob>) | null) => <li key={id} className="mbrfa-fwd-doc">
    <label><input type="checkbox" checked={selected.includes(id)} disabled={working} onChange={() => toggle(id)} /><span><strong>{name}</strong><small>{[kind, detail].filter(Boolean).join(" · ")}</small></span></label>
    {open ? <button type="button" className="mbrfa-fwd-view" onClick={() => void view(open)}>View</button> : null}
  </li>;
  return <div className="mbrfa-send-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !working) onClose(); }}>
    <style>{rfaSendDialogCss}{forwardCss}</style>
    <section className="mbrfa-send mbrfa-fwd" role="dialog" aria-modal="true" aria-label="Forward RFA">
      <header><h3>Forward RFA</h3><button type="button" aria-label="Close" disabled={working} onClick={onClose}>×</button></header>
      <div className="mbrfa-send-body">
        <div className="mbrfa-send-summary"><strong>{record.employeeName}{record.claimNumber ? ` · Claim ${record.claimNumber}` : ""}</strong><span>{record.providerName}</span></div>
        <p className="mbrfa-fwd-note">A forward cover sheet goes first. The original sent and received dates, and the decision due date, stay as they are.</p>
        {done ? <p role="status" className="mbrfa-fwd-done">Forwarded to {where}. It appears under History &amp; Activity.</p> : <>
          <fieldset className="mbrfa-fwd-group" disabled={working}>
            <legend>Documents to include<span className="mbrfa-required" aria-hidden="true"> *</span></legend>
            {chosen === 0 && (documents.length || packet) ? <p className="mbrfa-fwd-hint" role="alert">Choose at least one document.</p> : null}
            <ul className="mbrfa-fwd-docs">
              {packet ? row(PACKET, "Packet as sent", "Exactly what was sent, including its cover sheet", size(packet.sizeBytes), () => client.get(record.id, packet.id)) : null}
              {documents.map(document => row(document.id, document.filename, TYPE_LABEL[document.documentType] ?? "Document", size(document.sizeBytes), records ? () => records.getDocument(record.id, document.id) : null))}
              {uploading.map((name, index) => <li key={`uploading:${index}:${name}`} className="mbrfa-fwd-doc" data-uploading="true"><label><input type="checkbox" disabled checked readOnly /><span><strong>{name}</strong><small role="status">Uploading…</small></span></label></li>)}
            </ul>
            {!documents.length && !packet && !uploading.length ? <p className="mbrfa-fwd-hint">{history || historyFailed ? "This request has no documents saved here yet. Add the documents to forward below." : "Loading documents…"}</p> : null}
          </fieldset>
          {records && canUpload ? <fieldset className="mbrfa-fwd-group" disabled={working}>
            <legend>Add attachments<span className="mbrfa-optional"> (optional)</span></legend>
            <div className={`mbrfa-fwd-drop${over ? " mbrfa-fwd-over" : ""}`} data-over={over ? "true" : undefined}
              onDragOver={event => { event.preventDefault(); if (!working) setOver(true); }} onDragLeave={() => setOver(false)}
              onDrop={event => { event.preventDefault(); setOver(false); void upload(Array.from(event.dataTransfer.files)); }}>
              <span>{uploading.length ? `Uploading ${uploading[0]}…` : "Drop PDFs here"}</span>
              <button type="button" disabled={working} onClick={() => picker.current?.click()}>Choose PDF…</button>
            </div>
            <div className="mbrfa-fwd-attach-as"><span>Save as</span><Select aria-label="Save attachments as" value={attachAs} disabled={working} onChange={value => setAttachAs(value === "supporting_record" ? "supporting_record" : "other")} options={[{ value: "other", label: "Other document" }, { value: "supporting_record", label: "Supporting record" }]} /></div>
            <small className="mbrfa-fwd-hint">Attachments are saved to this request and included in the forward. The signed request does not change.</small>
            <input ref={picker} hidden type="file" aria-label="Attachments (PDF)" accept="application/pdf,.pdf" multiple onChange={event => { void upload(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
          </fieldset> : null}
          <div className="mbrfa-send-methods" role="radiogroup" aria-label="Forward by"><span>Forward by<span className="mbrfa-required" aria-hidden="true"> *</span></span>
            <label><input type="radio" name="rfa-duplicate-method" checked={method === "fax"} disabled={working} onChange={() => { setMethod("fax"); setConfirmed(false); }} />Fax</label>
            <label><input type="radio" name="rfa-duplicate-method" checked={method === "email"} disabled={working} onChange={() => { setMethod("email"); setConfirmed(false); }} />E-mail</label>
          </div>
          <div className="mbrfa-send-to" data-method={method}><span>Forward to<span className="mbrfa-required" aria-hidden="true"> *</span></span><RfaAuthorizationDestination compact {...(contactOptions.length ? { extraOptions: contactOptions } : {})} preselectSaved autoSelectSingle method={method} contextKey={`dup:${record.id}:${record.claimsAdminId ?? "manual"}:${method}`} directory={directory} savedContact={record.authorizationContact} loading={directoryLoading} error={directoryError} disabled={working} onChange={value => { setDestination(value); setConfirmed(false); }} /></div>
          <label><span className="mbrfa-fwd-label">{method === "email" ? "Message" : "Cover sheet message"}<span className="mbrfa-optional"> (optional)</span></span><textarea disabled={working} maxLength={1000} rows={2} value={message} onChange={event => setMessage(event.target.value)} /></label>
          {blocked ? <p role="alert">{blocked}</p> : <label className="mbrfa-send-confirm"><input type="checkbox" checked={confirmed} disabled={working || !destination} onChange={event => setConfirmed(event.target.checked)} /><span>I reviewed the documents{where ? <> and verified that <strong>{where}</strong> may receive this patient’s request</> : null}.</span></label>}
        </>}
        {error ? <p role="alert">{error}</p> : null}
      </div>
      <footer>
        {done ? <button type="button" className="mbtd-primary mbrfa-fwd-submit" onClick={onClose}>Done</button> : <button type="button" className="mbtd-primary mbrfa-fwd-submit" disabled={!ready} onClick={() => void go()}>{busy ? "Forwarding…" : "Forward"}</button>}
        {done ? null : <button type="button" className="mbrfa-fwd-cancel" disabled={busy} onClick={onClose}>Cancel</button>}
        {!done && chosen > 0 ? <span className="mbrfa-fwd-count">{chosen === 1 ? "1 document" : `${chosen} documents`} + cover sheet</span> : null}
      </footer>
    </section>
  </div>;
}

const forwardCss = `.mbrfa-fwd .mbrfa-required{color:#dc2626;font-weight:700}.mbrfa-fwd .mbrfa-optional{color:var(--mb-muted);font-weight:400;font-size:12px}
.mbrfa-fwd .mbrfa-fwd-note{color:var(--mb-muted);font-size:13px}
.mbrfa-fwd .mbrfa-fwd-group{display:grid;gap:8px;margin:0;padding:0;border:0;min-width:0}.mbrfa-fwd .mbrfa-fwd-group legend{padding:0;margin:0 0 6px;font-size:13px;font-weight:600}
.mbrfa-fwd .mbrfa-fwd-docs{display:grid;margin:0;padding:0;list-style:none;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);overflow:hidden}
.mbrfa-fwd .mbrfa-fwd-doc{display:flex;align-items:center;gap:8px;min-width:0;padding:8px 12px;border-top:1px solid var(--mb-border)}.mbrfa-fwd .mbrfa-fwd-doc:first-child{border-top:0}.mbrfa-fwd .mbrfa-fwd-doc[data-uploading]{opacity:.7}
.mbrfa-fwd .mbrfa-fwd-doc>label{display:flex!important;align-items:flex-start;gap:10px;flex:1;min-width:0;cursor:pointer}.mbrfa-fwd .mbrfa-fwd-doc input{width:16px;height:16px;min-height:16px;margin:3px 0 0;padding:0;flex:none;accent-color:var(--mb-accent)}
.mbrfa-fwd .mbrfa-fwd-doc>label>span{display:grid;min-width:0}.mbrfa-fwd .mbrfa-fwd-doc strong{font-weight:500;font-size:13px;overflow-wrap:anywhere}.mbrfa-fwd .mbrfa-fwd-doc small{color:var(--mb-muted);font-size:12px}
.mbrfa-send .mbrfa-fwd-doc .mbrfa-fwd-view{flex:none;min-height:32px;height:32px;padding:0 10px;border:0;background:none;color:var(--mb-accent);font-size:13px;cursor:pointer}.mbrfa-send .mbrfa-fwd-doc .mbrfa-fwd-view:hover{text-decoration:underline}
.mbrfa-fwd .mbrfa-fwd-drop{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px 14px;padding:16px;border:1.5px dashed color-mix(in srgb,var(--mb-accent) 45%,var(--mb-border));border-radius:var(--mb-control-radius);background:var(--mb-soft,transparent);font-size:13px;color:var(--mb-muted);text-align:center}
.mbrfa-fwd .mbrfa-fwd-drop[data-over=true]{border-color:var(--mb-accent);background:color-mix(in srgb,var(--mb-accent) 8%,var(--mb-surface))}.mbrfa-send .mbrfa-fwd-drop button{min-height:36px;height:36px;padding:0 14px;white-space:nowrap}
.mbrfa-fwd .mbrfa-fwd-attach-as{display:flex;align-items:center;gap:10px;font-size:13px;min-width:0}.mbrfa-fwd .mbrfa-fwd-attach-as>span{flex:none}.mbrfa-fwd .mbrfa-fwd-attach-as>*:last-child{flex:0 1 220px;min-width:0}
.mbrfa-fwd .mbrfa-fwd-hint{color:var(--mb-muted);font-size:12px;margin:0}.mbrfa-fwd .mbrfa-fwd-hint[role=alert]{color:var(--mb-danger,#b42318)}.mbrfa-fwd .mbrfa-fwd-label{font-size:13px}
.mbrfa-send>footer .mbrfa-fwd-submit,.mbrfa-send>footer .mbrfa-fwd-cancel{width:120px;height:40px;min-height:40px;padding:0 12px;flex:none;white-space:nowrap}
.mbrfa-fwd>footer{align-items:center}.mbrfa-fwd>footer .mbrfa-fwd-count{margin-right:auto;font-size:13px;color:var(--mb-muted)}
@media(max-width:640px){.mbrfa-send.mbrfa-fwd>footer{flex-direction:row-reverse;padding:10px 16px calc(10px + env(safe-area-inset-bottom))}.mbrfa-send>footer .mbrfa-fwd-submit,.mbrfa-send>footer .mbrfa-fwd-cancel{width:auto;flex:1 1 0;height:44px}.mbrfa-fwd>footer .mbrfa-fwd-count{display:none}.mbrfa-fwd .mbrfa-send-body{padding:14px 16px}}
@media(max-height:560px){.mbrfa-send.mbrfa-fwd{max-height:100vh}.mbrfa-send.mbrfa-fwd>header{padding:8px 16px}.mbrfa-fwd .mbrfa-send-summary{padding:8px 12px}}`;
