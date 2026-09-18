"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from "react";
import { createRfaClient, createRfaLifecycleClient, type OrganizationClientOptions, type RfaRecord, type RfaScheduling, type RfaSchedulingInput, type RfaHistoryEvent, type RfaDecisionCorrectionInput, type RfaTreatmentDecisionInput, type RfaTreatmentClosureInput } from "@mindbill/browser";
import { TreatmentDraftShell, type TreatmentDraftAppearance } from "./treatment-draft-shared";
import { rfaDetailCss } from "./rfa-detail-header";
import { RfaHistoryEntry } from "./rfa-history-entry";

export type RfaTrackingPanelProps = TreatmentDraftAppearance & {
  rfa: RfaRecord;
  options: OrganizationClientOptions;
  permissions?: readonly ("act" | "edit")[];
  onUpdated?: (rfa: RfaRecord) => void;
};
const words = (value: string) => value.replace(/^rfa\./, "").replaceAll("_", " ");
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : "Not recorded";
const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const required = (data: FormData, key: string, name: string) => { const value = text(data, key); if (!value) throw new Error(`Enter ${name}.`); return value; };
const timestamp = (data: FormData, key: string) => { const value = new Date(required(data, key, "a date and time")); if (!Number.isFinite(value.getTime())) throw new Error("Enter a valid date and time."); return value.toISOString(); };
const localTime = (value: string | null | undefined) => { if (!value) return ""; const parsed = new Date(value); return Number.isFinite(parsed.getTime()) ? new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""; };

/** Treatment-level scheduling, evidence, and immutable history for an existing RFA. */
export function RfaTrackingPanel(props: RfaTrackingPanelProps): ReactElement {
  const identity = useMemo(() => crypto.randomUUID(), [props.options]);
  return <RfaTrackingContent key={`${identity}:${props.rfa.id}`} {...props} />;
}
export function RfaTrackingContent({ rfa: provided, options, permissions = [], onUpdated, view = "all", embedded = false, ...appearance }: RfaTrackingPanelProps & { view?: "all" | "treatments" | "history"; embedded?: boolean }): ReactElement {
  const [rfa, setRfa] = useState(provided);
  useEffect(() => setRfa(provided), [provided]);
  const client = useMemo(() => createRfaLifecycleClient(options), [options]);
  const records = useMemo(() => createRfaClient(options), [options]);
  const [scheduling, setScheduling] = useState<RfaScheduling[]>([]);
  const [history, setHistory] = useState<RfaHistoryEvent[]>([]);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const alive = useRef(true); const pending = useRef(false); const keys = useRef(new Map<string, string>());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    void Promise.allSettled([client.listScheduling(rfa.id), client.listHistory(rfa.id)]).then(([appointments, events]) => {
      if (!active) return;
      const errors: string[] = [];
      if (appointments.status === "fulfilled") setScheduling(appointments.value); else errors.push(`Appointments could not be loaded: ${appointments.reason instanceof Error ? appointments.reason.message : "Try refreshing."}`);
      if (events.status === "fulfilled") setHistory(events.value); else errors.push(`History could not be loaded: ${events.reason instanceof Error ? events.reason.message : "Try refreshing."}`);
      setLoadErrors(errors); setLoading(false);
    });
    return () => { active = false; };
  }, [client, rfa.id, rfa.updatedAt, reload]);
  useEffect(() => {
    const refresh = () => { if (!pending.current && document.visibilityState !== "hidden") setReload(value => value + 1); };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const disabled = Boolean(busy || appearance.disabled);
  const run = async (operation: string, input: unknown, action: (key: string) => Promise<void | RfaRecord>): Promise<boolean> => {
    if (pending.current || disabled) return false;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    const fingerprint = JSON.stringify([operation, input]); let key = keys.current.get(fingerprint);
    if (!key) { key = `rfa-tracking-${crypto.randomUUID()}`; keys.current.set(fingerprint, key); }
    try {
      const updated = await action(key);
      keys.current.delete(fingerprint);
      if (alive.current) { if (updated) { setRfa(updated); onUpdated?.(updated); } setReload(value => value + 1); setMessage("Record saved."); }
      return true;
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "The record could not be saved. Refresh before retrying."); return false; }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  const download = async (id: string, filename: string, kind: "document" | "packet" = "document") => {
    try {
      const blob = await (kind === "packet" ? records.getPacket(rfa.id, id) : records.getDocument(rfa.id, id)); if (!alive.current) return;
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "The evidence could not be opened."); }
  };
  const evidence = (id: string | null | undefined, title: string) => id ? <button type="button" disabled={disabled} onClick={() => void download(id, rfa.documents.find(document => document.id === id)?.filename ?? `${title}.pdf`)}>{title}</button> : null;
  const canCorrect = permissions.includes("act") && ["received", "under_review", "information_requested", "approved", "modified", "denied", "mixed"].includes(rfa.status);
  const canClose = permissions.includes("edit") && ["submitted", "received", "under_review", "information_requested", "incomplete", "deferred"].includes(rfa.status);
  const content = <>
    <div style={{ display: "grid", gap: 16 }}>
      {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
      {loadErrors.map(value => <p role="alert" key={value}>{value}</p>)}
      <div hidden={view === "history"} className="mbrfa-treatment-list">
      <h3>Requested treatments</h3>
      {rfa.items.map((item, index) => {
        const appointment = scheduling.find(value => value.itemId === item.id);
        return <fieldset key={item.id} id={`rfa-treatment-${item.id}`} tabIndex={-1}><legend>{index + 1}. {item.serviceDescription}</legend>
          <p>{item.procedureCode || "No procedure code"} · Diagnosis {item.diagnosisCode} · {item.decisionClosure?.closed ? "Decision no longer required" : words(item.outcome)}</p>
          {item.decisionClosure ? <p>{item.decisionClosure.closed ? "Closed" : "Reopened"} by {item.decisionClosure.updatedBy} · {date(item.decisionClosure.updatedAt)}<br />{item.decisionClosure.reason}</p> : null}
          {canClose && item.outcome === "pending" && !item.decidedAt ? <TreatmentClosureForm key={`${item.id}:${item.decisionClosure?.version ?? 0}`} item={item} disabled={disabled} onError={setError} onSave={input => run(`closure:${item.id}`, input, key => client.updateTreatmentClosure(rfa.id, item.id, input, key))} /> : null}
          {item.outcome !== "pending" ? <><p>Decision: {date(item.decidedAt)}{item.authorizationNumber ? ` · Authorization ${item.authorizationNumber}` : ""}</p>
            {item.authorizedProcedureCode || item.authorizedQuantity || item.authorizedUnits ? <p>Authorized: {item.authorizedProcedureCode || item.procedureCode || "Treatment"}{item.authorizedQuantity != null ? ` · Quantity ${item.authorizedQuantity}` : ""}{item.authorizedUnits != null ? ` · Units ${item.authorizedUnits}` : ""}</p> : null}
            {item.effectiveFrom || item.effectiveTo ? <p>Authorization dates: {item.effectiveFrom ?? "Not specified"} through {item.effectiveTo ?? "Not specified"}</p> : null}
            {item.decisionReason ? <p>{item.decisionReason}</p> : null}{item.reviewerName ? <p>Reviewer: {item.reviewerName}{item.reviewerPhone ? ` · ${item.reviewerPhone}` : ""}</p> : null}
            {evidence(item.currentResponseDocumentId, "View decision evidence")} {evidence(item.currentImrDocumentId, "View independent medical review form")}</> : null}
          {loading ? <p>Loading appointment…</p> : appointment ? <AppointmentForm key={`${item.id}:${appointment.version}:${appointment.authorizationToken}`} appointment={appointment} editable={permissions.includes("edit")} disabled={disabled || loadErrors.some(value => value.startsWith("Appointments"))} onError={setError} onSave={input => run(`appointment:${item.id}`, input, async key => { await client.updateScheduling(rfa.id, item.id, input, key); return records.get(rfa.id); })} /> : null}
          {canCorrect && item.currentDecisionEventId && item.outcome !== "pending" ? <details><summary>Correct this decision</summary><p>The original decision and its evidence remain in history. Corrections require a reason and response evidence. Requests already used for a bill or a scheduled appointment cannot be corrected.</p>
            <CorrectionForm key={`${item.id}:${item.currentDecisionEventId}`} item={item} documents={rfa.documents} disabled={disabled || loading || loadErrors.length > 0 || scheduling.some(value => value.disposition === "scheduled")} onError={setError} onSave={input => run(`correction:${item.id}`, input, key => client.correctDecision(rfa.id, input, key))} />
          </details> : null}
        </fieldset>;
      })}
      </div>
      <div hidden={view === "treatments"} className="mbrfa-history-content">
      <details className="mbrfa-delivery-evidence"><summary>Delivery evidence ({rfa.transmissions.length})</summary>
        {rfa.transmissions.length ? rfa.transmissions.map(transmission => <article key={transmission.id} style={{ paddingBlock: 8 }}><strong>{words(transmission.channel)} · {words(transmission.status)}</strong><p>{words(transmission.direction)}{transmission.purpose ? ` · ${words(transmission.purpose)}` : ""} · {date(transmission.occurredAt)}</p>{transmission.destination ? <p>Recipient: {transmission.destination}</p> : null}{transmission.providerMessageId ? <p>Delivery reference: {transmission.providerMessageId}</p> : null}{transmission.receivedAt ? <p>Confirmed receipt: {date(transmission.receivedAt)}</p> : null}{evidence(transmission.proofDocumentId, "Download transmission receipt")}</article>) : <p>No transmission evidence has been recorded.</p>}
      </details>
      <section className="mbrfa-history-card" aria-label="History and notes"><h3>History and notes</h3>
        {permissions.includes("edit") ? <details className="mbrfa-note-form"><summary>Add a note</summary><form onSubmit={event => {
          event.preventDefault(); const form = event.currentTarget;
          try { const note = required(new FormData(form), "note", "a note"); void run("note", note, async key => { await client.addNote(rfa.id, note, key); return records.get(rfa.id); }).then(saved => { if (saved && alive.current) form.reset(); }); }
          catch (reason) { setError(reason instanceof Error ? reason.message : "Enter a note."); }
        }}><fieldset disabled={disabled}><legend>Add a note</legend><label>Note<textarea name="note" required maxLength={10000} /></label><button type="submit">Save note</button></fieldset></form></details> : null}
        {loading ? <p>Loading history…</p> : history.length ? <div className="mbrfa-table-scroll"><table className="mbrfa-history-table"><thead><tr><th scope="col">Date</th><th scope="col">Action</th><th scope="col">User</th><th scope="col">Details</th></tr></thead><tbody>{history.map(event => <RfaHistoryEntry key={event.id} event={event} rfa={rfa} disabled={disabled} onDownload={(kind, id, filename) => void download(id, filename, kind)} />)}</tbody></table></div> : !loadErrors.some(value => value.startsWith("History")) ? <p>No history entries have been recorded.</p> : null}
      </section>
      </div>
    </div>
  </>;
  return embedded ? <div className="mbrfa-tracking">{content}</div> : <TreatmentDraftShell {...appearance} title="Treatments and history" description="Review each treatment's authorization, appointments, delivery evidence, and notes."><style>{rfaDetailCss}</style>{content}</TreatmentDraftShell>;
}
function AppointmentForm({ appointment, editable, disabled, onError, onSave }: { appointment: RfaScheduling; editable: boolean; disabled: boolean; onError: (message: string) => void; onSave: (input: RfaSchedulingInput) => Promise<boolean> }): ReactElement {
  const [disposition, setDisposition] = useState(appointment.disposition === "canceled" && appointment.version > 0 ? "canceled" : appointment.eligible && appointment.disposition === "no_appointment" ? "no_appointment" : appointment.eligible ? "scheduled" : "canceled");
  return <section><h4>Appointment</h4><p>{words(appointment.disposition)}{appointment.appointmentAt ? ` · ${date(appointment.appointmentAt)}` : ""}</p>{appointment.providerName ? <p>{appointment.providerName} · {appointment.location}</p> : null}{appointment.reason ? <p>{appointment.reason}</p> : null}
    {appointment.version > 0 && !appointment.current ? <p role="status">Authorization has changed. Review the current decision before updating this appointment.</p> : null}
    {editable && (appointment.eligible || appointment.version > 0) ? <details><summary>Update appointment</summary><form onSubmit={event => {
      event.preventDefault(); if (disabled) return;
      try {
        const data = new FormData(event.currentTarget); const base = { expectedVersion: appointment.version, authorizationToken: appointment.authorizationToken };
        const input: RfaSchedulingInput = disposition === "scheduled" ? { ...base, disposition: "scheduled", appointmentAt: timestamp(data, "appointmentAt"), providerName: required(data, "providerName", "the provider name"), location: required(data, "location", "the appointment location") } : { ...base, disposition: disposition as "no_appointment" | "canceled", reason: required(data, "reason", "a reason") };
        void onSave(input);
      } catch (reason) { onError(reason instanceof Error ? reason.message : "Review the appointment details."); }
    }}><fieldset disabled={disabled}><legend>Appointment details</legend><label>Disposition<select value={disposition} onChange={event => setDisposition(event.target.value)}>{appointment.eligible ? <><option value="scheduled">Scheduled</option><option value="no_appointment">No appointment needed</option></> : null}{appointment.version > 0 ? <option value="canceled">Canceled</option> : null}</select></label>
      {disposition === "scheduled" ? <div className="mbtd-grid"><label>Date and time (your local time)<input name="appointmentAt" type="datetime-local" required defaultValue={localTime(appointment.appointmentAt)} /></label><label>Provider name<input name="providerName" required maxLength={200} defaultValue={appointment.providerName ?? ""} /></label><label>Location<input name="location" required maxLength={500} defaultValue={appointment.location ?? ""} /></label></div> : <label>Reason<textarea name="reason" required maxLength={2000} defaultValue={appointment.reason ?? ""} /></label>}
      <button type="submit">Save appointment</button></fieldset></form></details> : !appointment.eligible && appointment.disposition === "pending" ? <p>Appointments become available after treatment is authorized.</p> : null}
  </section>;
}
function CorrectionForm({ item, documents, disabled, onError, onSave }: { item: RfaRecord["items"][number]; documents: RfaRecord["documents"]; disabled: boolean; onError: (message: string) => void; onSave: (input: RfaDecisionCorrectionInput) => Promise<boolean> }): ReactElement {
  const [outcome, setOutcome] = useState(item.outcome as RfaTreatmentDecisionInput["outcome"]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (disabled) return;
    try {
      const data = new FormData(event.currentTarget);
      const decision: RfaTreatmentDecisionInput = { itemId: item.id, outcome };
      if (outcome !== "denied") {
        decision.authorizationNumber = required(data, "authorizationNumber", "the authorization number");
        for (const key of ["authorizedProcedureCode", "effectiveFrom", "effectiveTo"] as const) if (text(data, key)) decision[key] = text(data, key);
        for (const key of ["authorizedQuantity", "authorizedUnits"] as const) if (text(data, key)) { const value = Number(text(data, key)); if (!Number.isFinite(value) || value <= 0 || (key === "authorizedUnits" && !Number.isInteger(value))) throw new Error("Enter valid positive authorization quantities."); decision[key] = value; }
      }
      if (outcome !== "approved") for (const key of ["decisionReason", "reviewerName", "reviewerPhone"] as const) decision[key] = required(data, key, words(key.replace(/[A-Z]/g, value => ` ${value.toLowerCase()}`)));
      const imrDocumentId = outcome !== "approved" ? required(data, "imrDocumentId", "an independent medical review form") : text(data, "imrDocumentId");
      if (!item.currentDecisionEventId) throw new Error("Refresh to load the current decision before correcting it.");
      void onSave({ itemId: item.id, expectedDecisionEventId: item.currentDecisionEventId, reason: required(data, "reason", "the correction reason"), replacement: { decidedAt: timestamp(data, "decidedAt"), responseDocumentId: required(data, "responseDocumentId", "the decision response evidence"), ...(imrDocumentId ? { imrDocumentId } : {}), decisions: [decision] } });
    } catch (reason) { onError(reason instanceof Error ? reason.message : "Review the correction details."); }
  };
  return <form onSubmit={submit}><fieldset disabled={disabled}><legend>Decision correction</legend><div className="mbtd-grid">
    <label>Correction reason<textarea name="reason" required maxLength={20000} /></label><label>Corrected decision<select value={outcome} onChange={event => setOutcome(event.target.value as typeof outcome)}><option value="approved">Approved</option><option value="modified">Modified</option><option value="denied">Denied</option></select></label>
    <label>Decision time<input name="decidedAt" type="datetime-local" required defaultValue={localTime(item.decidedAt)} /></label>
    <label>Decision response evidence<select name="responseDocumentId" required defaultValue={item.currentResponseDocumentId ?? ""}><option value="">Choose evidence</option>{documents.filter(document => document.documentType === "ur_response").map(document => <option key={document.id} value={document.id}>{document.filename}</option>)}</select></label>
    {outcome !== "approved" ? <><label>Independent medical review form<select name="imrDocumentId" required defaultValue={item.currentImrDocumentId ?? ""}><option value="">Choose a form</option>{documents.filter(document => document.documentType === "imr_form").map(document => <option key={document.id} value={document.id}>{document.filename}</option>)}</select></label><label>Decision reason<textarea name="decisionReason" required defaultValue={item.decisionReason ?? ""} /></label><label>Reviewer name<input name="reviewerName" required defaultValue={item.reviewerName ?? ""} /></label><label>Reviewer phone<input name="reviewerPhone" required defaultValue={item.reviewerPhone ?? ""} /></label></> : null}
    {outcome !== "denied" ? <><label>Authorization number<input name="authorizationNumber" required defaultValue={item.authorizationNumber ?? ""} /></label><label>Authorized procedure code<input name="authorizedProcedureCode" defaultValue={item.authorizedProcedureCode ?? ""} /></label><label>Authorized quantity<input name="authorizedQuantity" type="number" min="0.001" step="any" defaultValue={item.authorizedQuantity ?? ""} /></label><label>Authorized units<input name="authorizedUnits" type="number" min="1" defaultValue={item.authorizedUnits ?? ""} /></label><label>Effective from<input name="effectiveFrom" type="date" defaultValue={item.effectiveFrom?.slice(0, 10) ?? ""} /></label><label>Effective through<input name="effectiveTo" type="date" defaultValue={item.effectiveTo?.slice(0, 10) ?? ""} /></label></> : null}
    </div><button type="submit">Save decision correction</button></fieldset></form>;
}

function TreatmentClosureForm({ item, disabled, onError, onSave }: {
  item: RfaRecord["items"][number]; disabled: boolean;
  onError: (message: string) => void; onSave: (input: RfaTreatmentClosureInput) => Promise<boolean>;
}): ReactElement {
  const closed = Boolean(item.decisionClosure?.closed);
  const title = closed ? "Reopen treatment follow-up" : "Decision no longer required";
  return <details><summary>{title}</summary>
    <p>{closed ? "Resume waiting for a decision on this treatment. Its original review deadline still applies." : "Close follow-up for this treatment without recording an approval or denial. Other treatments remain active. This does not withdraw the request with the claims administrator."}</p>
    <form onSubmit={event => {
      event.preventDefault(); if (disabled) return;
      try {
        const reason = required(new FormData(event.currentTarget), "closureReason", "a reason");
        void onSave({ closed: !closed, reason, expectedVersion: item.decisionClosure?.version ?? 0 });
      } catch (reason) { onError(reason instanceof Error ? reason.message : "Enter a reason."); }
    }}><fieldset disabled={disabled}><legend>{closed ? "Reopen this treatment" : "Close this treatment"}</legend>
      <label>{closed ? "Reason for reopening" : "Reason a decision is no longer required"}<textarea name="closureReason" required maxLength={2000} /></label>
      <div className="mbtd-actions"><button type="submit">{closed ? "Reopen treatment" : "Close treatment"}</button></div>
    </fieldset></form>
  </details>;
}
