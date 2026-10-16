"use client";
import { useMemo, useState, type ReactElement } from "react";
import { createRfaLifecycleClient, type OrganizationClientOptions, type RfaClient, type RfaRecord, type RfaSentOutsideInput } from "@mindbill/browser";
import { RfaModal } from "./rfa-modal";
import { DateTimeField, Select, Checkbox, FileInput } from "./form-controls";

type Transmission = RfaRecord["transmissions"][number];
const key = () => `rfa-sent-outside-${globalThis.crypto.randomUUID()}`;
/** datetime-local value for an instant, in the viewer's timezone. */
export const rfaLocalDateTime = (value: Date = new Date()): string => {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};
const instant = (value: string) => new Date(value).toISOString();

/** A send the office recorded itself. */
export const rfaSentOutside = (transmission: Pick<Transmission, "metadata">): boolean => transmission.metadata?.sentOutsideMindBill === true;
/** The office's own send can be undone while it is the latest transmission and nothing was decided or requested since. */
export function rfaSentOutsideUndoable(rfa: Pick<RfaRecord, "status" | "items" | "informationRequests" | "transmissions">, transmission: Transmission): boolean {
  if (!rfaSentOutside(transmission) || !["submitted", "received"].includes(rfa.status) || rfa.informationRequests.length) return false;
  if (rfa.items.some(item => item.outcome !== "pending" || item.decisionClosure?.closed)) return false;
  const at = (value: Transmission) => Date.parse(value.occurredAt ?? "") || 0;
  return rfa.transmissions.every(other => other.id === transmission.id || at(other) <= at(transmission));
}

export const RFA_SENT_OUTSIDE_CHANNELS: { value: RfaSentOutsideInput["channel"]; label: string }[] = [
  { value: "fax", label: "Fax" }, { value: "mail", label: "Mail" }, { value: "email", label: "E-mail" }, { value: "manual", label: "Hand delivery" },
];

/** The sent and received dates for an RFA sent outside MindBill. Shared by Mark as sent and by recording a decision on an unsent RFA. */
export function RfaSentOutsideFields({ defaultDestination, receivedRequired = false, receivedLabel }: { defaultDestination?: string; receivedRequired?: boolean; receivedLabel?: string }): ReactElement {
  const [received, setReceived] = useState(receivedRequired);
  const now = rfaLocalDateTime();
  return <div className="mbrfa-sent-outside-fields">
    <div className="mbrfa-field"><span className="mbrfa-field-label">Sent on<span className="mbrfa-required" aria-hidden="true"> *</span></span><DateTimeField required name="sentAt" label="Sent on" max={now} defaultValue={now} /></div>
    <div className="mbrfa-field"><span className="mbrfa-field-label">How it was sent<span className="mbrfa-required" aria-hidden="true"> *</span></span><Select name="channel" label="How it was sent" defaultValue="fax" options={RFA_SENT_OUTSIDE_CHANNELS} /></div>
    <label><span className="mbrfa-field-label">Sent to<span className="mbrfa-optional"> (optional)</span></span><input name="destination" maxLength={500} defaultValue={defaultDestination ?? ""} placeholder="Fax number, address or e-mail" /></label>
    {receivedRequired ? null : <label className="mbrfa-check"><Checkbox checked={received} onChange={event => setReceived(event.target.checked)} />The claims administrator received it (for example, the fax confirmation shows it went through)</label>}
    {received ? <div className="mbrfa-field"><span className="mbrfa-field-label">{receivedLabel ?? "Received on"}<span className="mbrfa-required" aria-hidden="true"> *</span></span><DateTimeField required name="receivedAt" label={receivedLabel ?? "Received on"} max={now} defaultValue={now} /></div> : null}
  </div>;
}

/** Read the shared fields; null with a message when the dates do not make sense. */
export function rfaSentOutsideInput(data: FormData): RfaSentOutsideInput | string {
  const sentAt = String(data.get("sentAt") ?? ""); const receivedAt = String(data.get("receivedAt") ?? "");
  if (!sentAt || !Number.isFinite(Date.parse(sentAt))) return "Enter when it was sent.";
  if (Date.parse(sentAt) > Date.now() + 60_000) return "The sent date cannot be in the future.";
  if (receivedAt && Date.parse(receivedAt) < Date.parse(sentAt)) return "It cannot have been received before it was sent.";
  if (receivedAt && Date.parse(receivedAt) > Date.now() + 60_000) return "The received date cannot be in the future.";
  const destination = String(data.get("destination") ?? "").trim();
  return { sentAt: instant(sentAt), channel: String(data.get("channel") ?? "fax") as RfaSentOutsideInput["channel"], ...(destination ? { destination } : {}), ...(receivedAt ? { receivedAt: instant(receivedAt) } : {}) };
}

/** Record that the office sent this RFA itself: printed and faxed, mailed, e-mailed or hand-delivered. */
export function RfaMarkSentDialog({ rfa, options, records, defaultDestination, allowProof = true, onSaved, onClose }: {
  rfa: RfaRecord; options: OrganizationClientOptions; records: RfaClient; defaultDestination?: string;
  /** Proof is attached as a document, which only an unsent request accepts. */ allowProof?: boolean;
  onSaved: (rfa: RfaRecord) => void; onClose: () => void;
}): ReactElement {
  const lifecycle = useMemo(() => createRfaLifecycleClient(options), [options]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [requestKey] = useState(key);
  return <RfaModal title="Mark as sent" busy={busy} onClose={onClose}>
    <p className="mbtd-note">For an RFA you sent yourself, outside MindBill. It will show as Sent from that date. If you know the claims administrator received it, the decision deadline starts from then.</p>
    {error ? <p role="alert">{error}</p> : null}
    <form onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const input = rfaSentOutsideInput(data);
      if (typeof input === "string") { setError(input); return; }
      const proof = data.get("proof");
      setBusy(true); setError("");
      void (async () => {
        try {
          let proofDocumentId: string | undefined;
          if (proof instanceof File && proof.size) {
            const before = new Set(rfa.documents.map(document => document.id));
            const uploaded = await records.uploadDocument(rfa.id, { file: proof, documentType: "other", contentRevision: rfa.contentRevision }, key());
            proofDocumentId = uploaded.documents.find(document => !before.has(document.id))?.id;
          }
          onSaved(await lifecycle.recordSentOutside(rfa.id, { ...input, ...(proofDocumentId ? { proofDocumentId } : {}) }, requestKey));
        } catch (reason) {
          setError(reason instanceof Error && /transition is not allowed/i.test(reason.message) ? "This RFA was already sent, so it cannot be marked as sent again." : reason instanceof Error ? reason.message : "The send could not be recorded.");
        } finally { setBusy(false); }
      })();
    }}>
      <RfaSentOutsideFields {...(defaultDestination ? { defaultDestination } : {})} />
      {allowProof ? <label>Fax confirmation or copy sent (PDF, optional)<FileInput name="proof" accept="application/pdf,.pdf" /></label> : null}
      <div className="mbtd-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="mbtd-primary" disabled={busy}>{busy ? "Saving…" : "Mark as sent"}</button></div>
    </form>
  </RfaModal>;
}


/**
 * What must be recorded before a treatment decision can be: nothing; that the RFA was sent (it was never marked sent,
 * or every MindBill attempt failed); or that it was received. A decision proves both, so the decision form asks for
 * those dates instead of refusing.
 */
export function rfaDecisionPrerequisite(rfa: Pick<RfaRecord, "status" | "receivedAt" | "transmissions">): "none" | "sent" | "receipt" | "blocked" {
  if (["received", "under_review", "information_requested"].includes(rfa.status)) return "none";
  if (["draft", "ready", "incomplete", "deferred"].includes(rfa.status)) return "sent";
  if (rfa.status !== "submitted" || rfa.receivedAt) return "blocked";
  const attempts = rfa.transmissions.filter(sent => sent.direction === "outbound" && (sent.purpose ?? "submission") === "submission");
  return attempts.length && attempts.every(sent => sent.status === "failed") ? "sent" : "receipt";
}
