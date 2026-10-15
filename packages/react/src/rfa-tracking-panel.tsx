"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { createOrganizationClient, createRfaClient, createRfaLifecycleClient, type OrganizationClientOptions, type OrganizationLocationInput, type RfaRecord, type RfaScheduling, type RfaSchedulingInput, type RfaHistoryEvent, type RfaDecisionCorrectionInput, type RfaTreatmentDecisionInput, type RfaTreatmentClosureInput } from "@mindbill/browser";
import { TreatmentDraftShell, type TreatmentDraftAppearance } from "./treatment-draft-shared";
import { rfaDetailCss } from "./rfa-detail-header";
import { RfaHistoryEntry } from "./rfa-history-entry";
import { rfaDecisionDueText } from "./rfa-decision-due";
import { rfaDecisionPrerequisite, rfaSentOutside, rfaSentOutsideUndoable } from "./rfa-sent-outside";
import { RfaModal, rfaModalCss } from "./rfa-modal";
import { RfaPhysicianSelect } from "./rfa-physician-select";
import { RfaCard, RfaPill, rfaCalendarDate, rfaFailureReason, rfaShortDate, rfaTreatmentOutcome } from "./rfa-detail-cards";
import { DateField, DateTimeField, Select } from "./form-controls";

export type RfaTrackingPanelProps = TreatmentDraftAppearance & {
  rfa: RfaRecord;
  options: OrganizationClientOptions;
  permissions?: readonly ("act" | "edit")[];
  onUpdated?: (rfa: RfaRecord) => void;
};
const words = (value: string) => value.replace(/^rfa\./, "").replaceAll("_", " ");
const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : "Not recorded";
const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const required = (data: FormData, key: string, name: string) => { const value = text(data, key); if (!value) throw new Error(`Enter ${name}.`); return value; };
const timestamp = (data: FormData, key: string) => { const value = new Date(required(data, key, "a date and time")); if (!Number.isFinite(value.getTime())) throw new Error("Enter a valid date and time."); return value.toISOString(); };
const localTime = (value: string | null | undefined) => { if (!value) return ""; const parsed = new Date(value); return Number.isFinite(parsed.getTime()) ? new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""; };

const rfaTimelineCss = `.mbrfa-timeline{list-style:none;margin:0;padding:0}.mbrfa-timeline>li{position:relative;padding:0 0 20px 28px}.mbrfa-timeline>li:last-child{padding-bottom:2px}
.mbrfa-timeline>li::before{content:"";position:absolute;left:4px;top:4px;width:12px;height:12px;border-radius:50%;border:2px solid var(--mb-border);background:var(--mb-surface)}
.mbrfa-timeline>li::after{content:"";position:absolute;left:10px;top:20px;bottom:0;width:1px;background:var(--mb-border)}.mbrfa-timeline>li:last-child::after{display:none}
.mbrfa-timeline>li[data-kind=sent]::before{border-color:var(--mb-accent);background:var(--mb-accent)}.mbrfa-timeline>li[data-kind=decision]::before{border-color:#1a7f4b;background:#1a7f4b}.mbrfa-timeline>li[data-kind=late]::before{border-color:var(--mb-danger,#b42318);background:var(--mb-danger,#b42318)}.mbrfa-timeline>li[data-kind=due]::before,.mbrfa-timeline>li[data-kind=pending]::before{border-style:dashed}
.mbrfa-timeline>li[data-kind=sent]{margin:0 -8px 12px;padding:10px 8px 12px 36px;border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-accent) 7%,var(--mb-surface))}.mbrfa-timeline>li[data-kind=sent]::before{left:12px;top:14px}.mbrfa-timeline>li[data-kind=sent]::after{display:none}
.mbrfa-tl-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 12px}.mbrfa-tl-head>strong{font-size:14px;font-weight:600}.mbrfa-tl-head>span{font-size:12px;color:var(--mb-muted)}
.mbrfa-timeline>li[data-kind=pending] .mbrfa-tl-head>strong,.mbrfa-timeline>li[data-kind=due] .mbrfa-tl-head>strong{font-weight:500}.mbrfa-timeline>li[data-kind=late] .mbrfa-tl-head>strong{color:var(--mb-danger,#b42318)}
.mbrfa-timeline p{margin:4px 0 0;font-size:13px}.mbrfa-timeline .mbrfa-tl-meta{color:var(--mb-muted);font-size:12px}.mbrfa-timeline ul{margin:6px 0 0;padding:0;list-style:none;font-size:13px}
.mbrfa-tl-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.mbrfa-detail .mbrfa-tl-actions>button{min-height:32px;padding:4px 12px;font-size:13px}
.mbrfa-tl-decisions{display:flex;flex-wrap:wrap;gap:6px}.mbrfa-tl-decisions>li{display:inline-flex;align-items:center;gap:6px;padding:2px 10px 2px 3px;border:1px solid var(--mb-border);border-radius:999px;font-size:12px;text-transform:capitalize}.mbrfa-tl-decisions>li>b{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:color-mix(in srgb,var(--mb-accent) 14%,var(--mb-surface));font-size:11px}
.mbrfa-tl-decisions>li[data-outcome=denied]{border-color:var(--mb-danger,#b42318);color:var(--mb-danger,#b42318)}.mbrfa-tl-decisions>li[data-outcome=approved],.mbrfa-tl-decisions>li[data-outcome=authorized]{border-color:#1a7f4b;color:#1a7f4b}
.mbrfa-timeline details{margin-top:6px;font-size:13px}.mbrfa-timeline details>summary{cursor:pointer;color:var(--mb-accent);font-size:12px}.mbrfa-timeline dl{display:grid;grid-template-columns:minmax(110px,max-content) minmax(0,1fr);gap:2px 14px;margin:6px 0 0}.mbrfa-timeline dl>div{display:contents}.mbrfa-timeline dt{color:var(--mb-muted)}.mbrfa-timeline dd{margin:0}.mbrfa-timeline h4{margin:8px 0 2px;font-size:12px}`;

type TimelineEntry = { event: RfaHistoryEvent } | { event?: undefined; key: string; state: "due" | "late" | "pending"; title: string; when: string; detail?: string };
/** Recorded events oldest first, with the decision due date placed where it falls and what is still awaited at the end. */
function timelineEntries(history: RfaHistoryEvent[], rfa: RfaRecord): TimelineEntry[] {
  const events: TimelineEntry[] = [...history].sort((a, b) => (a.occurredAt ?? "").localeCompare(b.occurredAt ?? "")).map(event => ({ event }));
  if (!rfa.submittedAt) return [...events, { key: "unsent", state: "pending", title: "Not sent yet", when: "", detail: "Sending applies the physician's saved signature and starts the decision clock on receipt." }];
  const decided = rfa.items.filter(item => item.outcome !== "pending").length, open = decided < rfa.items.length;
  if (rfa.decisionDueAt) {
    const late = open && Date.parse(rfa.decisionDueAt) < Date.now();
    const due: TimelineEntry = { key: "due", state: late ? "late" : "due", title: late ? "UR decision overdue" : "UR decision due", when: rfaDecisionDueText(rfa), ...(rfa.decisionDeadlineBasis ? { detail: capital(words(rfa.decisionDeadlineBasis)) } : {}) };
    const at = events.findIndex(entry => entry.event && (entry.event.occurredAt ?? "") > rfa.decisionDueAt!);
    events.splice(at < 0 ? events.length : at, 0, due);
  } else events.push({ key: "receipt", state: "pending", title: "Waiting for confirmed receipt", when: "", detail: "The decision due date is set when receipt is confirmed." });
  if (open) events.push({ key: "awaiting", state: "pending", title: decided ? `No response on ${rfa.items.length - decided} of ${rfa.items.length} treatments` : "Awaiting UR decision", when: "" });
  return events;
}

/** Treatment-level scheduling, evidence, and immutable history for an existing RFA. */
export function RfaTrackingPanel(props: RfaTrackingPanelProps): ReactElement {
  const identity = useMemo(() => crypto.randomUUID(), [props.options]);
  return <RfaTrackingContent key={`${identity}:${props.rfa.id}`} {...props} />;
}
export function RfaTrackingContent({ rfa: provided, options, permissions = [], onUpdated, view = "all", embedded = false, cards = false, onRefreshDelivery, onRecordDecision, ...appearance }: RfaTrackingPanelProps & { view?: "all" | "treatments" | "history"; embedded?: boolean; /** Bill-style cards and tables instead of stacked fieldsets. */ cards?: boolean;
  /** Card layout: ask the fax provider again about a fax still shown as sending. */ onRefreshDelivery?: () => void;
  /** Card layout: record the decision for one treatment (opens the host's decision dialog). */ onRecordDecision?: (itemId: string) => void }): ReactElement {
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
  const [noteOpen, setNoteOpen] = useState(false);
  // Card layout: the treatment form being filled in, shown in a dialog ("appointment:<itemId>" and so on).
  const [panel, setPanel] = useState("");
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
      if (alive.current) { if (updated) { setRfa(updated); onUpdated?.(updated); } setReload(value => value + 1); setMessage("Record saved."); setPanel(""); }
      return true;
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "The record could not be saved. Refresh before retrying."); return false; }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  // A decision letter or IMR form attached while correcting a decision; returns the new document's id to select it.
  const uploadEvidence = async (file: File, documentType: "ur_response" | "imr_form"): Promise<string | null> => {
    if (pending.current || disabled) return null;
    pending.current = true; setBusy(true); setError("");
    try {
      const before = new Set(rfa.documents.map(document => document.id));
      const updated = await records.uploadDocument(rfa.id, { file, documentType, contentRevision: rfa.contentRevision }, `rfa-correction-upload-${crypto.randomUUID()}`);
      if (!alive.current) return null;
      setRfa(updated); onUpdated?.(updated);
      return updated.documents.find(document => !before.has(document.id) && document.documentType === documentType)?.id ?? null;
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "The document could not be uploaded."); return null; }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  // Evidence opens in a new tab to read, rather than downloading. The tab is opened during the click so it is not blocked.
  const download = async (id: string, _filename: string, kind: "document" | "packet" = "document") => {
    const tab = window.open("", "_blank");
    try {
      const blob = await (kind === "packet" ? records.getPacket(rfa.id, id) : records.getDocument(rfa.id, id));
      const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: "application/pdf" }));
      if (tab) tab.location.href = url; else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (reason) { tab?.close(); if (alive.current) setError(reason instanceof Error ? reason.message : "The evidence could not be opened."); }
  };
  // The complete packet a transmission sent, opened in a new tab like any other PDF.
  const packetOf = (transmission: RfaRecord["transmissions"][number]) => (transmission as { packetId?: string | null }).packetId ?? null;
  const [undoError, setUndoError] = useState("");
  const undoSentOutside = async (transmissionId: string) => {
    setUndoError("");
    if (!window.confirm("Undo this send? The RFA goes back to how it was before it was marked as sent. History keeps a record of both.")) return;
    try { const updated = await client.undoSentOutside(rfa.id, transmissionId, `rfa-undo-sent-${transmissionId}`); setRfa(updated); onUpdated?.(updated); setReload(value => value + 1); }
    catch (reason) { setUndoError(reason instanceof Error && /transition is not allowed/i.test(reason.message) ? "This send can no longer be undone: something was recorded after it." : reason instanceof Error ? reason.message : "The send could not be undone."); }
  };
  const viewPacket = async (packetId: string) => {
    const tab = window.open("", "_blank");
    try { const url = URL.createObjectURL(await records.getPacket(rfa.id, packetId)); if (tab) tab.location.href = url; else window.location.assign(url); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    catch (reason) { tab?.close(); if (alive.current) setError(reason instanceof Error ? reason.message : "The sent packet could not be opened."); }
  };
  const evidence = (id: string | null | undefined, title: string) => id ? <button type="button" disabled={disabled} onClick={() => void download(id, rfa.documents.find(document => document.id === id)?.filename ?? `${title}.pdf`)}>{title}</button> : null;
  const canCorrect = permissions.includes("act") && ["received", "under_review", "information_requested", "approved", "modified", "denied", "mixed"].includes(rfa.status);
  const canClose = permissions.includes("edit") && ["submitted", "received", "under_review", "information_requested", "incomplete", "deferred"].includes(rfa.status);
  const otherInformation = (item: RfaRecord["items"][number]) => typeof item.metadata?.otherInformation === "string" && item.metadata.otherInformation.trim() ? item.metadata.otherInformation : [item.quantity != null ? `Quantity: ${item.quantity}` : "", item.units != null ? `Units: ${item.units}` : "", item.frequency, item.duration, item.requestedFrom ? `From: ${rfaCalendarDate(item.requestedFrom)}` : "", item.requestedTo ? `Through: ${rfaCalendarDate(item.requestedTo)}` : ""].filter(Boolean).join("; ");
  const noteForm = <form className="mbrfa-row" onSubmit={event => {
    event.preventDefault(); const form = event.currentTarget;
    try { const note = required(new FormData(form), "note", "a note"); void run("note", note, async key => { await client.addNote(rfa.id, note, key); return records.get(rfa.id); }).then(saved => { if (saved && alive.current) { form.reset(); setNoteOpen(false); } }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Enter a note."); }
  }}><label>Note<textarea name="note" required maxLength={10000} autoFocus disabled={disabled} /></label><div className="mbtd-actions"><button type="submit" className="mbtd-primary" disabled={disabled}>Save note</button><button type="button" onClick={() => setNoteOpen(false)}>Cancel</button></div></form>;
  const cardContent = <div className="mbrfa-stack">
    {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    {loadErrors.map(value => <p role="alert" key={value}>{value}</p>)}
    {view !== "history" ? <RfaCard title="Requested Treatment" count={rfa.items.length} flush>
      {rfa.items.length ? <div className="mbrfa-tx-list">{rfa.items.map((item, index) => {
        const appointment = scheduling.find(value => value.itemId === item.id);
        // A treatment the response did not decide is still being waited on: mark it so it is not overlooked.
        const awaiting = item.outcome === "pending" && !item.decisionClosure?.closed && rfa.items.some(other => other.outcome !== "pending");
        const recorded = rfaTreatmentOutcome(rfa, item);
        const outcome = awaiting && recorded.label === "No response" ? { label: "No response", tone: "warn" as const } : recorded;
        const showAppointment = !!appointment && (appointment.eligible || appointment.version > 0);
        const closable = canClose && item.outcome === "pending" && !item.decidedAt;
        const correctable = canCorrect && !!item.currentDecisionEventId && item.outcome !== "pending";
        const decided = item.outcome !== "pending";
        const recordable = !!onRecordDecision && permissions.includes("act") && !decided && !item.decisionClosure?.closed && rfaDecisionPrerequisite(rfa) !== "blocked";
        const authorized = decided && (item.authorizedProcedureCode || item.authorizedQuantity != null || item.authorizedUnits != null)
          ? [item.authorizedProcedureCode || item.procedureCode, item.authorizedQuantity != null ? `Qty ${item.authorizedQuantity}` : "", item.authorizedUnits != null ? `Units ${item.authorizedUnits}` : ""].filter(Boolean).join(" · ") : "";
        const field = (title: string, value: ReactNode) => value === null || value === undefined || value === "" ? null : <div><dt>{title}</dt><dd>{value}</dd></div>;
        const dialog = (id: string, title: string, content: ReactNode, wide = false) => panel === `${id}:${item.id}` ? <RfaModal title={title} wide={wide} busy={busy} onClose={() => { setPanel(""); setError(""); }}>{error ? <p role="alert">{error}</p> : null}{content}</RfaModal> : null;
        const open = (id: string) => { setError(""); setMessage(""); setPanel(`${id}:${item.id}`); };
        return <section key={item.id} className="mbrfa-tx" id={`rfa-treatment-${item.id}`} tabIndex={-1} aria-label={`Treatment ${index + 1}: ${item.serviceDescription}`}>
          <header className="mbrfa-tx-head">
            <span className="mbrfa-tx-num" aria-hidden="true">{index + 1}</span>
            <dl>
              <div><dt>Service/Good Requested</dt><dd><strong>{item.serviceDescription}</strong></dd></div>
              <div><dt>CPT/HCPCS</dt><dd><span className="mbrfa-code">{item.procedureCode || "—"}</span></dd></div>
              <div><dt>Diagnosis (ICD-10)</dt><dd><span className="mbrfa-code">{item.diagnosisCode}</span>{item.diagnosisDescription ? <small>{item.diagnosisDescription}</small> : null}</dd></div>
              <div><dt>Other Information</dt><dd>{otherInformation(item) || "—"}</dd></div>
            </dl>
          </header>
          <div className="mbrfa-tx-panels">
            <div className="mbrfa-tx-panel">
              <div className="mbrfa-tx-panel-head"><h4>Utilization Review Decision</h4><RfaPill tone={outcome.tone}>{outcome.label}</RfaPill></div>
              <dl className="mbrfa-tx-fields">
                {field("RFA Sent", rfaCalendarDate(rfa.submittedAt) || "Not sent")}
                {field("UR Decision Due", decided ? null : rfaCalendarDate(rfa.decisionDueAt) || "—")}
                {field("UR Decision Date", decided ? rfaCalendarDate(item.decidedAt) : null)}
                {field("Authorization #", decided ? item.authorizationNumber : null)}
                {field("Authorized", authorized)}
                {field("Valid", decided && (item.effectiveFrom || item.effectiveTo) ? `${rfaCalendarDate(item.effectiveFrom) || "—"} – ${rfaCalendarDate(item.effectiveTo) || "—"}` : null)}
                {field("Reviewer", item.reviewerName ? `${item.reviewerName}${item.reviewerPhone ? ` · ${item.reviewerPhone}` : ""}` : null)}
                {field("Reason", item.decisionReason)}
                {field(item.decisionClosure?.closed ? "Closed" : item.decisionClosure ? "Reopened" : "", item.decisionClosure ? `${rfaShortDate(item.decisionClosure.updatedAt)} — ${item.decisionClosure.reason}` : null)}
              </dl>
              {item.currentResponseDocumentId || item.currentImrDocumentId || correctable || closable || recordable ? <div className="mbtd-actions mbrfa-tx-actions">
                {recordable ? <button type="button" className="mbtd-primary" disabled={disabled} onClick={() => onRecordDecision!(item.id)}>Record decision</button> : null}
                {evidence(item.currentResponseDocumentId, "View UR decision letter")}{evidence(item.currentImrDocumentId, "View IMR application")}
                {correctable ? <button type="button" disabled={disabled} onClick={() => open("correct")}>Correct decision</button> : null}
                {closable ? <button type="button" disabled={disabled} onClick={() => open("close")}>{item.decisionClosure?.closed ? "Reopen" : "No longer needed"}</button> : null}
              </div> : null}
            </div>
            <div className="mbrfa-tx-panel">
              <div className="mbrfa-tx-panel-head"><h4>Appointment</h4>{appointment && appointment.disposition !== "pending" ? <RfaPill tone={appointment.disposition === "scheduled" ? "ok" : "muted"}>{capital(words(appointment.disposition))}</RfaPill> : null}</div>
              {loading ? <p className="mbrfa-tx-note">Loading…</p> : appointment && appointment.disposition === "scheduled" ? <dl className="mbrfa-tx-fields">
                {field("Date", date(appointment.appointmentAt))}{field("Provider", appointment.providerName)}{field("Location", appointment.location)}
              </dl> : appointment?.reason ? <p className="mbrfa-tx-note">{appointment.reason}</p> : <p className="mbrfa-tx-note">{showAppointment ? "Not scheduled yet." : "Available after treatment is authorized."}</p>}
              {appointment && appointment.version > 0 && !appointment.current ? <p className="mbrfa-tx-note" role="status">Authorization has changed. Review the current decision before updating this appointment.</p> : null}
              {showAppointment && permissions.includes("edit") ? <div className="mbtd-actions mbrfa-tx-actions"><button type="button" disabled={disabled || loadErrors.some(value => value.startsWith("Appointments"))} onClick={() => open("appointment")}>{appointment.disposition === "scheduled" ? "Update appointment" : "Schedule"}</button></div> : null}
            </div>
          </div>
          {showAppointment ? dialog("appointment", `Appointment · ${item.serviceDescription}`, <AppointmentForm bare options={options} key={`${item.id}:${appointment.version}:${appointment.authorizationToken}`} appointment={appointment} editable={permissions.includes("edit")} disabled={disabled} onError={setError} onSave={input => run(`appointment:${item.id}`, input, async key => { await client.updateScheduling(rfa.id, item.id, input, key); return records.get(rfa.id); })} />) : null}
          {closable ? dialog("close", item.decisionClosure?.closed ? "Reopen treatment follow-up" : "Decision no longer required", <TreatmentClosureForm bare key={`${item.id}:${item.decisionClosure?.version ?? 0}`} item={item} disabled={disabled} onError={setError} onSave={input => run(`closure:${item.id}`, input, key => client.updateTreatmentClosure(rfa.id, item.id, input, key))} />) : null}
          {correctable ? dialog("correct", `Correct decision · ${item.serviceDescription}`, <><CorrectionForm key={`${item.id}:${item.currentDecisionEventId}`} item={item} documents={rfa.documents} disabled={disabled || loading || loadErrors.length > 0 || scheduling.some(value => value.disposition === "scheduled")} onError={setError} onUpload={uploadEvidence} onSave={input => run(`correction:${item.id}`, input, key => client.correctDecision(rfa.id, input, key))} /></>, true) : null}
        </section>;
      })}</div> : <p className="mbrfa-sheet-body mbrfa-empty">No treatments recorded.</p>}
    </RfaCard> : null}
    {view !== "treatments" ? <>
      <RfaCard title="History" action={permissions.includes("edit") && !noteOpen ? <button type="button" disabled={disabled} onClick={() => setNoteOpen(true)}>Add note</button> : null} flush>
        <div className="mbrfa-rows">{noteOpen ? noteForm : null}</div>
        {loading ? <p className="mbrfa-sheet-body">Loading history…</p> : history.length ? <div className="mbrfa-sheet-body"><style>{rfaTimelineCss}</style><ol className="mbrfa-timeline" aria-label="Request history">{timelineEntries(history, rfa).map(entry => entry.event
          ? <RfaHistoryEntry timeline key={entry.event.id} event={entry.event} rfa={rfa} disabled={disabled} onDownload={(kind, id, filename) => void download(id, filename, kind)} />
          : <li key={entry.key} data-kind={entry.state}><div className="mbrfa-tl-head"><strong>{entry.title}</strong><span>{entry.when}</span></div>{entry.detail ? <p className="mbrfa-tl-meta">{entry.detail}</p> : null}</li>)}</ol></div> : !loadErrors.some(value => value.startsWith("History")) ? <p className="mbrfa-sheet-body mbrfa-empty">No history entries have been recorded.</p> : null}
      </RfaCard>
      {undoError ? <p role="alert">{undoError}</p> : null}
      {rfa.transmissions.length ? <RfaCard title="Delivery" count={rfa.transmissions.length} flush><div className="mbrfa-table-scroll"><table className="mbrfa-grid-table"><thead><tr><th scope="col">Date</th><th scope="col">Sent by</th><th scope="col">To</th><th scope="col">Status</th><th scope="col">Receipt confirmed</th><th scope="col"><span className="mbrfa-sr-only">Packet</span></th></tr></thead><tbody>{rfa.transmissions.map(transmission => {
        const sending = !["delivered", "received", "sent", "failed", "canceled"].includes(transmission.status);
        const packetId = packetOf(transmission);
        return <tr key={transmission.id}>
          <td>{rfaShortDate(transmission.occurredAt)}</td>
          <td>{transmission.channel === "manual" ? "Hand delivery" : capital(words(transmission.channel))}<small>{transmission.direction === "inbound" ? "Received" : transmission.purpose === "forward" ? "Forwarded" : rfaSentOutside(transmission) ? "Sent outside MindBill" : "Submission"}</small></td>
          <td>{transmission.destination || "—"}{transmission.providerMessageId ? <small>Ref {transmission.providerMessageId}</small> : null}{rfaFailureReason(transmission) ? <small>{rfaFailureReason(transmission)}</small> : null}</td>
          <td><RfaPill tone={["delivered", "received", "sent"].includes(transmission.status) ? "ok" : transmission.status === "failed" ? "bad" : "muted"}>{capital(words(transmission.status))}</RfaPill>{sending && onRefreshDelivery && transmission.channel === "fax" ? <button type="button" className="mbrfa-text-link" style={{ display: "block", marginTop: 4 }} disabled={disabled} title="Ask the fax provider for the latest status. MindBill also checks automatically." onClick={onRefreshDelivery}>Refresh status</button> : null}</td>
          <td>{rfaShortDate(transmission.receivedAt)}{transmission.proofDocumentId ? <small>{evidence(transmission.proofDocumentId, "Receipt")}</small> : null}</td>
          <td className="mbrfa-row-actions">{packetId ? <button type="button" disabled={disabled} title="The complete packet that was sent" onClick={() => void viewPacket(packetId)}>View PDF</button> : null}{permissions.includes("act") && rfaSentOutsideUndoable(rfa, transmission) ? <button type="button" disabled={disabled} title="Remove this send and return the RFA to how it was before" onClick={() => void undoSentOutside(transmission.id)}>Undo</button> : null}</td>
        </tr>;
      })}</tbody></table></div></RfaCard> : null}
    </> : null}
  </div>;
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
          <dl className="mbrfa-request-details">{([["Diagnosis description", item.diagnosisDescription], ["Quantity", item.quantity], ["Units", item.units], ["Frequency", item.frequency], ["Duration", item.duration], ["Requested from", item.requestedFrom], ["Requested through", item.requestedTo]] as const).filter(([, value]) => value !== null && value !== undefined && value !== "").map(([title, value]) => <div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}</dl>
          {item.decisionClosure ? <p>{item.decisionClosure.closed ? "Closed" : "Reopened"} by {item.decisionClosure.updatedBy} · {date(item.decisionClosure.updatedAt)}<br />{item.decisionClosure.reason}</p> : null}
          {canClose && item.outcome === "pending" && !item.decidedAt ? <TreatmentClosureForm key={`${item.id}:${item.decisionClosure?.version ?? 0}`} item={item} disabled={disabled} onError={setError} onSave={input => run(`closure:${item.id}`, input, key => client.updateTreatmentClosure(rfa.id, item.id, input, key))} /> : null}
          {item.outcome !== "pending" ? <><p>Decision: {date(item.decidedAt)}{item.authorizationNumber ? ` · Authorization ${item.authorizationNumber}` : ""}</p>
            {item.authorizedProcedureCode || item.authorizedQuantity || item.authorizedUnits ? <p>Authorized: {item.authorizedProcedureCode || item.procedureCode || "Treatment"}{item.authorizedQuantity != null ? ` · Quantity ${item.authorizedQuantity}` : ""}{item.authorizedUnits != null ? ` · Units ${item.authorizedUnits}` : ""}</p> : null}
            {item.effectiveFrom || item.effectiveTo ? <p>Authorization dates: {item.effectiveFrom ?? "Not specified"} through {item.effectiveTo ?? "Not specified"}</p> : null}
            {item.decisionReason ? <p>{item.decisionReason}</p> : null}{item.reviewerName ? <p>Reviewer: {item.reviewerName}{item.reviewerPhone ? ` · ${item.reviewerPhone}` : ""}</p> : null}
            {evidence(item.currentResponseDocumentId, "View UR decision letter")} {evidence(item.currentImrDocumentId, "View IMR application")}</> : null}
          {loading ? <p>Loading appointment…</p> : appointment ? <AppointmentForm options={options} key={`${item.id}:${appointment.version}:${appointment.authorizationToken}`} appointment={appointment} editable={permissions.includes("edit")} disabled={disabled || loadErrors.some(value => value.startsWith("Appointments"))} onError={setError} onSave={input => run(`appointment:${item.id}`, input, async key => { await client.updateScheduling(rfa.id, item.id, input, key); return records.get(rfa.id); })} /> : null}
          {canCorrect && item.currentDecisionEventId && item.outcome !== "pending" ? <details><summary>Correct this decision</summary>
            <CorrectionForm key={`${item.id}:${item.currentDecisionEventId}`} item={item} documents={rfa.documents} disabled={disabled || loading || loadErrors.length > 0 || scheduling.some(value => value.disposition === "scheduled")} onError={setError} onUpload={uploadEvidence} onSave={input => run(`correction:${item.id}`, input, key => client.correctDecision(rfa.id, input, key))} />
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
  if (cards) return <div className="mbrfa-tracking">{cardContent}</div>;
  return embedded ? <div className="mbrfa-tracking">{content}</div> : <TreatmentDraftShell {...appearance} title="Treatments and history" description="Review each treatment's authorization, appointments, delivery evidence, and notes."><style>{rfaDetailCss}</style>{content}</TreatmentDraftShell>;
}
const OTHER_LOCATION = "__other_location__";
const UPLOAD = "__upload__";
type SavedLocation = OrganizationLocationInput & { id: string };
/** One line for a saved practice location: name, street, city, state ZIP. */
export const rfaLocationText = (location: Pick<OrganizationLocationInput, "name" | "street" | "city" | "state" | "zip">): string =>
  [location.name, location.street, [location.city, [location.state, location.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ");
const requiredMark = <span className="mbrfa-required" aria-hidden="true"> *</span>;
const optionalMark = <span className="mbrfa-optional"> (optional)</span>;
/** Dialog forms: one clear column of fields (two on wide screens), every row aligned, a fixed-size Save button in a footer. */
const rfaTaskFormCss = `.mbrfa-taskform{display:grid;gap:16px;margin:0}.mbrfa-taskform>fieldset{display:grid;gap:16px;margin:0;padding:0;border:0;min-width:0}.mbrfa-taskform legend{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.mbrfa-taskform-intro{margin:0;font-size:13px;color:var(--mb-muted)}
.mbrfa-taskform-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px;align-items:start}.mbrfa-taskform-grid>.mbrfa-wide{grid-column:1/-1}
.mbtd .mbrfa-taskform-grid>label,.mbtd .mbrfa-taskform-grid>.mbrfa-field{display:grid;gap:6px;align-content:start;min-width:0;margin:0;font-size:13px;font-weight:500;color:var(--mb-text)}
.mbtd .mbrfa-taskform-grid input:not([type=checkbox]):not([type=file]):not(.mbctl-text):not(.mbctl-proxy):not(.mbctl-pop-search){width:100%;box-sizing:border-box;min-height:40px}.mbtd .mbrfa-taskform-grid textarea{width:100%;box-sizing:border-box;min-height:84px;resize:vertical}.mbtd .mbrfa-taskform-grid textarea.mbrfa-taskform-long{min-height:132px}
.mbrfa-taskform-hint{display:block;font-size:12px;font-weight:400;color:var(--mb-muted)}
.mbrfa-taskform .mbrfa-outcome{grid-template-columns:repeat(3,1fr)}
.mbrfa-taskform-foot{display:flex;justify-content:flex-end;align-items:center;gap:12px;padding-top:14px;border-top:1px solid var(--mb-border)}.mbtd .mbrfa-taskform-foot button[type=submit]{flex:none;width:200px;max-width:100%;height:44px;min-height:0;justify-self:auto}
@media(max-width:640px){.mbrfa-taskform-grid{grid-template-columns:minmax(0,1fr)}.mbtd .mbrfa-taskform-foot button[type=submit]{width:100%}}`;

function AppointmentForm({ appointment, options, editable, disabled, onError, onSave, bare = false }: { bare?: boolean; appointment: RfaScheduling; options: OrganizationClientOptions; editable: boolean; disabled: boolean; onError: (message: string) => void; onSave: (input: RfaSchedulingInput) => Promise<boolean> }): ReactElement {
  const [disposition, setDisposition] = useState(appointment.disposition === "canceled" && appointment.version > 0 ? "canceled" : appointment.eligible && appointment.disposition === "no_appointment" ? "no_appointment" : appointment.eligible ? "scheduled" : "canceled");
  const physicians = useMemo(() => createRfaClient(options), [options]);
  // The provider is a saved treating physician (its id) or a name typed for someone outside the list.
  const [provider, setProvider] = useState({ value: appointment.providerName ?? "", name: appointment.providerName ?? "" });
  const [locations, setLocations] = useState<SavedLocation[] | null>(null);
  const [location, setLocation] = useState({ choice: "", other: appointment.location ?? "" });
  useEffect(() => {
    let active = true;
    createOrganizationClient(options).getBillingProfile().then(profile => { if (active) setLocations((Array.isArray(profile?.locations) ? profile.locations : []).filter(item => item.active !== false)); }, () => { if (active) setLocations([]); });
    return () => { active = false; };
  }, [options]);
  // A reopened appointment stores the location as text; show the saved location it came from, or the text as "Other".
  useEffect(() => {
    if (!locations || location.choice || !appointment.location) return;
    const match = locations.find(item => rfaLocationText(item) === appointment.location || item.name === appointment.location);
    setLocation(current => ({ ...current, choice: match ? match.id : OTHER_LOCATION }));
  }, [locations]);
  const chosenLocation = location.choice === OTHER_LOCATION ? location.other.trim() : locations?.find(item => item.id === location.choice) ? rfaLocationText(locations.find(item => item.id === location.choice)!) : "";
  const form = <form className="mbrfa-taskform" noValidate onSubmit={event => {
      event.preventDefault(); if (disabled) return;
      try {
        const data = new FormData(event.currentTarget); const base = { expectedVersion: appointment.version, authorizationToken: appointment.authorizationToken };
        let input: RfaSchedulingInput;
        if (disposition === "scheduled") {
          const appointmentAt = timestamp(data, "appointmentAt");
          if (!provider.name.trim()) throw new Error("Choose or type the provider name.");
          if (!chosenLocation) throw new Error(location.choice === OTHER_LOCATION ? "Type the appointment location." : "Choose the appointment location.");
          input = { ...base, disposition: "scheduled", appointmentAt, providerName: provider.name.trim().slice(0, 200), location: chosenLocation.slice(0, 500) };
        } else input = { ...base, disposition: disposition as "no_appointment" | "canceled", reason: required(data, "reason", "a reason") };
        void onSave(input);
      } catch (reason) { onError(reason instanceof Error ? reason.message : "Review the appointment details."); }
    }}><style>{rfaModalCss}{rfaTaskFormCss}</style><fieldset disabled={disabled}><legend>Appointment details</legend>
      <div className="mbrfa-taskform-grid">
        <label className="mbrfa-wide"><span className="mbrfa-field-label">Disposition{requiredMark}</span><Select value={disposition} onChange={choice => setDisposition(choice)}>{appointment.eligible ? <><option value="scheduled">Scheduled</option><option value="no_appointment">No appointment needed</option></> : null}{appointment.version > 0 ? <option value="canceled">Canceled</option> : null}</Select></label>
        {disposition === "scheduled" ? <>
          <label className="mbrfa-wide"><span className="mbrfa-field-label">Date and time{requiredMark} <span className="mbrfa-optional">(your local time)</span></span><DateTimeField name="appointmentAt" label="Appointment" required defaultValue={localTime(appointment.appointmentAt)} /></label>
          <label className="mbrfa-wide"><span className="mbrfa-field-label">Provider{requiredMark}</span><RfaPhysicianSelect label="Provider" client={physicians} allowCustom required value={provider.value} placeholder="Choose a treating physician" onChange={(value, chosen) => setProvider({ value, name: chosen?.name ?? value })} /></label>
          <label className="mbrfa-wide"><span className="mbrfa-field-label">Location{requiredMark}</span><Select label="Location" searchable allowEmpty required loading={!locations} value={location.choice} placeholder="Choose a practice location" searchPlaceholder="Search saved locations"
            options={[...(locations ?? []).map(item => ({ value: item.id, label: item.name || item.street, description: rfaLocationText({ ...item, name: "" }) })), { value: OTHER_LOCATION, label: "Other location…", action: true }]}
            onChange={choice => setLocation(current => ({ ...current, choice }))} /></label>
          {location.choice === OTHER_LOCATION ? <label className="mbrfa-wide"><span className="mbrfa-field-label">Other location{requiredMark}</span><input name="location" maxLength={500} autoComplete="off" placeholder="Clinic name and address" value={location.other} onChange={event => { const other = event.target.value; setLocation(current => ({ ...current, other })); }} /></label> : null}
        </> : <label className="mbrfa-wide"><span className="mbrfa-field-label">Reason{requiredMark}</span><textarea name="reason" maxLength={2000} defaultValue={appointment.reason ?? ""} /></label>}
      </div>
      <div className="mbrfa-taskform-foot"><button type="submit" className="mbtd-primary">Save appointment</button></div></fieldset></form>;
  if (bare) return form;
  return <section><h4>Appointment</h4><p>{words(appointment.disposition)}{appointment.appointmentAt ? ` · ${date(appointment.appointmentAt)}` : ""}</p>{appointment.providerName ? <p>{appointment.providerName} · {appointment.location}</p> : null}{appointment.reason ? <p>{appointment.reason}</p> : null}
    {appointment.version > 0 && !appointment.current ? <p role="status">Authorization has changed. Review the current decision before updating this appointment.</p> : null}
    {editable && (appointment.eligible || appointment.version > 0) ? <details><summary>Update appointment</summary>{form}</details> : !appointment.eligible && appointment.disposition === "pending" ? <p>Appointments become available after treatment is authorized.</p> : null}
  </section>;
}

type Outcome = RfaTreatmentDecisionInput["outcome"];
function CorrectionForm({ item, documents, disabled, onError, onSave, onUpload }: { item: RfaRecord["items"][number]; documents: RfaRecord["documents"]; disabled: boolean; onError: (message: string) => void; onSave: (input: RfaDecisionCorrectionInput) => Promise<boolean>; onUpload: (file: File, documentType: "ur_response" | "imr_form") => Promise<string | null> }): ReactElement {
  const [outcome, setOutcome] = useState<Outcome>(item.outcome === "modified" || item.outcome === "denied" ? item.outcome : "approved");
  const [letter, setLetter] = useState(item.currentResponseDocumentId ?? "");
  const [imr, setImr] = useState(item.currentImrDocumentId ?? "");
  const letterFile = useRef<HTMLInputElement>(null); const imrFile = useRef<HTMLInputElement>(null);
  const letters = documents.filter(document => document.documentType === "ur_response");
  const forms = documents.filter(document => document.documentType === "imr_form");
  const upload = async (file: File | undefined, documentType: "ur_response" | "imr_form") => { if (!file) return; const id = await onUpload(file, documentType); if (id) (documentType === "ur_response" ? setLetter : setImr)(id); };
  // What was authorized usually matches what was requested, so those fields start from the current decision or the request.
  const prefill = { code: item.authorizedProcedureCode ?? item.procedureCode ?? "", quantity: item.authorizedQuantity ?? (outcome === "approved" ? item.quantity ?? "" : ""), units: item.authorizedUnits ?? (outcome === "approved" ? item.units ?? "" : ""),
    from: (item.effectiveFrom ?? item.requestedFrom ?? "").slice(0, 10), to: (item.effectiveTo ?? item.requestedTo ?? "").slice(0, 10) };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (disabled) return;
    try {
      const data = new FormData(event.currentTarget);
      const reason = required(data, "reason", "the correction reason");
      const decision: RfaTreatmentDecisionInput = { itemId: item.id, outcome };
      if (outcome !== "denied") {
        decision.authorizationNumber = required(data, "authorizationNumber", "the authorization number");
        for (const key of ["authorizedProcedureCode", "effectiveFrom", "effectiveTo"] as const) if (text(data, key)) decision[key] = text(data, key);
        for (const key of ["authorizedQuantity", "authorizedUnits"] as const) if (text(data, key)) { const value = Number(text(data, key)); if (!Number.isFinite(value) || value <= 0 || (key === "authorizedUnits" && !Number.isInteger(value))) throw new Error("Enter valid positive authorization quantities."); decision[key] = value; }
      }
      if (outcome !== "approved") for (const key of ["decisionReason", "reviewerName", "reviewerPhone"] as const) decision[key] = required(data, key, words(key.replace(/[A-Z]/g, value => ` ${value.toLowerCase()}`)));
      if (outcome !== "approved" && !imr) throw new Error("Choose the IMR application form for a modified or denied decision.");
      if (!item.currentDecisionEventId) throw new Error("Refresh to load the current decision before correcting it.");
      // The letter is optional here: left empty, the current letter stays the evidence.
      const responseDocumentId = letter || item.currentResponseDocumentId;
      if (!responseDocumentId) throw new Error("Choose the UR decision letter, or upload it.");
      const decidedAt = text(data, "decidedAt") ? timestamp(data, "decidedAt") : item.decidedAt;
      if (!decidedAt) throw new Error("Enter the decision date.");
      void onSave({ itemId: item.id, expectedDecisionEventId: item.currentDecisionEventId, reason, replacement: { decidedAt, responseDocumentId, ...(outcome !== "approved" && imr ? { imrDocumentId: imr } : {}), decisions: [decision] } });
    } catch (reason) { onError(reason instanceof Error ? reason.message : "Review the correction details."); }
  };
  const documentOptions = (list: RfaRecord["documents"], action: string) => [...list.map(document => ({ value: document.id, label: document.filename, ...(document.createdAt ? { description: `Added ${rfaShortDate(document.createdAt)}` } : {}) })), { value: UPLOAD, label: action, action: true }];
  return <form className="mbrfa-taskform" noValidate onSubmit={submit}><style>{rfaModalCss}{rfaTaskFormCss}</style><fieldset disabled={disabled}><legend>Decision correction</legend>
    <p className="mbrfa-taskform-intro">The original decision stays in the history.</p>
    <div className="mbrfa-taskform-grid">
      <div className="mbrfa-field mbrfa-wide"><span className="mbrfa-field-label" id={`correct-outcome-${item.id}`}>Corrected decision{requiredMark}</span>
        <div className="mbrfa-outcome" role="radiogroup" aria-labelledby={`correct-outcome-${item.id}`}>{([["approved", "Approved"], ["modified", "Modified"], ["denied", "Denied"]] as const).map(([value, title]) => <button key={value} type="button" role="radio" aria-checked={outcome === value} data-outcome={value} onClick={() => setOutcome(value)}>{title}</button>)}</div></div>
      <label className="mbrfa-wide"><span className="mbrfa-field-label">Why are you correcting it?{requiredMark}</span><textarea name="reason" maxLength={20000} placeholder="For example: the letter was entered against the wrong treatment" /></label>
      {outcome !== "denied" ? <>
        <label><span className="mbrfa-field-label">Authorization number{requiredMark}</span><input key={`auth:${outcome}`} name="authorizationNumber" maxLength={100} defaultValue={item.authorizationNumber ?? ""} /></label>
        <label><span className="mbrfa-field-label">Authorized procedure code{optionalMark}</span><input key={`code:${outcome}`} name="authorizedProcedureCode" maxLength={20} defaultValue={prefill.code} /></label>
        <label><span className="mbrfa-field-label">Authorized quantity{optionalMark}</span><input key={`qty:${outcome}`} name="authorizedQuantity" inputMode="decimal" defaultValue={prefill.quantity} /></label>
        <label><span className="mbrfa-field-label">Authorized units{optionalMark}</span><input key={`units:${outcome}`} name="authorizedUnits" inputMode="numeric" defaultValue={prefill.units} /></label>
        <label><span className="mbrfa-field-label">Effective from{optionalMark}</span><DateField name="effectiveFrom" label="Effective from" defaultValue={prefill.from} /></label>
        <label><span className="mbrfa-field-label">Effective through{optionalMark}</span><DateField name="effectiveTo" label="Effective through" defaultValue={prefill.to} /></label>
      </> : null}
      {outcome !== "approved" ? <>
        <label className="mbrfa-wide"><span className="mbrfa-field-label">Decision reason{requiredMark}</span><textarea className="mbrfa-taskform-long" name="decisionReason" maxLength={20000} defaultValue={item.decisionReason ?? ""} /></label>
        <label><span className="mbrfa-field-label">Reviewer name{requiredMark}</span><input name="reviewerName" maxLength={200} defaultValue={item.reviewerName ?? ""} /></label>
        <label><span className="mbrfa-field-label">Reviewer phone{requiredMark}</span><input name="reviewerPhone" maxLength={40} inputMode="tel" defaultValue={item.reviewerPhone ?? ""} /></label>
        <label className="mbrfa-wide"><span className="mbrfa-field-label">IMR application{requiredMark}</span><Select label="IMR application" allowEmpty value={imr} placeholder="Choose the IMR application form" options={documentOptions(forms, "Upload an IMR form…")} onChange={choice => { if (choice === UPLOAD) imrFile.current?.click(); else setImr(choice); }} /></label>
      </> : null}
      <label><span className="mbrfa-field-label">UR decision letter{optionalMark}</span><Select label="UR decision letter" allowEmpty value={letter} placeholder="Keep the current letter" options={documentOptions(letters, "Upload a new letter…")} onChange={choice => { if (choice === UPLOAD) letterFile.current?.click(); else setLetter(choice); }} /></label>
      <label><span className="mbrfa-field-label">Decision date{optionalMark}</span><DateTimeField name="decidedAt" label="Decision date" max={localTime(new Date().toISOString())} defaultValue={localTime(item.decidedAt)} /></label>
    </div>
    <input ref={letterFile} type="file" accept="application/pdf,.pdf" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file, "ur_response"); }} />
    <input ref={imrFile} type="file" accept="application/pdf,.pdf" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file, "imr_form"); }} />
    <div className="mbrfa-taskform-foot"><button type="submit" className="mbtd-primary">Save decision correction</button></div></fieldset></form>;
}

function TreatmentClosureForm({ item, disabled, onError, onSave, bare = false }: {
  bare?: boolean;
  item: RfaRecord["items"][number]; disabled: boolean;
  onError: (message: string) => void; onSave: (input: RfaTreatmentClosureInput) => Promise<boolean>;
}): ReactElement {
  const closed = Boolean(item.decisionClosure?.closed);
  const title = closed ? "Reopen treatment follow-up" : "Decision no longer required";
  const content = <>
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
  </>;
  return bare ? content : <details><summary>{title}</summary>{content}</details>;
}
