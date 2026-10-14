"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { createRfaClient, createRfaLifecycleClient, type OrganizationClientOptions, type RfaRecord, type RfaScheduling, type RfaSchedulingInput, type RfaHistoryEvent, type RfaDecisionCorrectionInput, type RfaTreatmentDecisionInput, type RfaTreatmentClosureInput } from "@mindbill/browser";
import { TreatmentDraftShell, type TreatmentDraftAppearance } from "./treatment-draft-shared";
import { rfaDetailCss } from "./rfa-detail-header";
import { RfaHistoryEntry } from "./rfa-history-entry";
import { rfaDecisionDueText } from "./rfa-decision-due";
import { RfaModal } from "./rfa-modal";
import { RfaCard, RfaPill, rfaCalendarDate, rfaFailureReason, rfaOutcome, rfaShortDate } from "./rfa-detail-cards";

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
export function RfaTrackingContent({ rfa: provided, options, permissions = [], onUpdated, view = "all", embedded = false, cards = false, onRefreshDelivery, ...appearance }: RfaTrackingPanelProps & { view?: "all" | "treatments" | "history"; embedded?: boolean; /** Bill-style cards and tables instead of stacked fieldsets. */ cards?: boolean;
  /** Card layout: ask the fax provider again about a fax still shown as sending. */ onRefreshDelivery?: () => void }): ReactElement {
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
  const download = async (id: string, filename: string, kind: "document" | "packet" = "document") => {
    try {
      const blob = await (kind === "packet" ? records.getPacket(rfa.id, id) : records.getDocument(rfa.id, id)); if (!alive.current) return;
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "The evidence could not be opened."); }
  };
  // The complete packet a transmission sent, opened in a new tab like any other PDF.
  const packetOf = (transmission: RfaRecord["transmissions"][number]) => (transmission as { packetId?: string | null }).packetId ?? null;
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
        const outcome = awaiting ? { label: "No response", tone: "warn" as const } : rfaOutcome(item);
        const showAppointment = !!appointment && (appointment.eligible || appointment.version > 0);
        const closable = canClose && item.outcome === "pending" && !item.decidedAt;
        const correctable = canCorrect && !!item.currentDecisionEventId && item.outcome !== "pending";
        const decided = item.outcome !== "pending";
        const authorized = decided && (item.authorizedProcedureCode || item.authorizedQuantity != null || item.authorizedUnits != null)
          ? [item.authorizedProcedureCode || item.procedureCode, item.authorizedQuantity != null ? `Qty ${item.authorizedQuantity}` : "", item.authorizedUnits != null ? `Units ${item.authorizedUnits}` : ""].filter(Boolean).join(" · ") : "";
        const field = (title: string, value: ReactNode) => value === null || value === undefined || value === "" ? null : <div><dt>{title}</dt><dd>{value}</dd></div>;
        const dialog = (id: string, title: string, content: ReactNode) => panel === `${id}:${item.id}` ? <RfaModal title={title} busy={busy} onClose={() => { setPanel(""); setError(""); }}>{error ? <p role="alert">{error}</p> : null}{content}</RfaModal> : null;
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
              {item.currentResponseDocumentId || item.currentImrDocumentId || correctable || closable ? <div className="mbtd-actions mbrfa-tx-actions">
                {evidence(item.currentResponseDocumentId, "View decision")}{evidence(item.currentImrDocumentId, "View IMR form")}
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
          {showAppointment ? dialog("appointment", `Appointment · ${item.serviceDescription}`, <AppointmentForm bare key={`${item.id}:${appointment.version}:${appointment.authorizationToken}`} appointment={appointment} editable={permissions.includes("edit")} disabled={disabled} onError={setError} onSave={input => run(`appointment:${item.id}`, input, async key => { await client.updateScheduling(rfa.id, item.id, input, key); return records.get(rfa.id); })} />) : null}
          {closable ? dialog("close", item.decisionClosure?.closed ? "Reopen treatment follow-up" : "Decision no longer required", <TreatmentClosureForm bare key={`${item.id}:${item.decisionClosure?.version ?? 0}`} item={item} disabled={disabled} onError={setError} onSave={input => run(`closure:${item.id}`, input, key => client.updateTreatmentClosure(rfa.id, item.id, input, key))} />) : null}
          {correctable ? dialog("correct", `Correct decision · ${item.serviceDescription}`, <><p>The original decision and its evidence remain in history. Corrections require a reason and response evidence. Requests already used for a bill or a scheduled appointment cannot be corrected.</p>
            <CorrectionForm key={`${item.id}:${item.currentDecisionEventId}`} item={item} documents={rfa.documents} disabled={disabled || loading || loadErrors.length > 0 || scheduling.some(value => value.disposition === "scheduled")} onError={setError} onSave={input => run(`correction:${item.id}`, input, key => client.correctDecision(rfa.id, input, key))} /></>) : null}
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
      {rfa.transmissions.length ? <RfaCard title="Delivery" count={rfa.transmissions.length} flush><div className="mbrfa-table-scroll"><table className="mbrfa-grid-table"><thead><tr><th scope="col">Date</th><th scope="col">Sent by</th><th scope="col">To</th><th scope="col">Status</th><th scope="col">Receipt confirmed</th><th scope="col"><span className="mbrfa-sr-only">Packet</span></th></tr></thead><tbody>{rfa.transmissions.map(transmission => {
        const sending = !["delivered", "received", "sent", "failed", "canceled"].includes(transmission.status);
        const packetId = packetOf(transmission);
        return <tr key={transmission.id}>
          <td>{rfaShortDate(transmission.occurredAt)}</td>
          <td>{capital(words(transmission.channel))}<small>{transmission.direction === "inbound" ? "Received" : transmission.purpose === "forward" ? "Forwarded" : "Submission"}</small></td>
          <td>{transmission.destination || "—"}{transmission.providerMessageId ? <small>Ref {transmission.providerMessageId}</small> : null}{rfaFailureReason(transmission) ? <small>{rfaFailureReason(transmission)}</small> : null}</td>
          <td><RfaPill tone={["delivered", "received", "sent"].includes(transmission.status) ? "ok" : transmission.status === "failed" ? "bad" : "muted"}>{capital(words(transmission.status))}</RfaPill>{sending && onRefreshDelivery && transmission.channel === "fax" ? <button type="button" className="mbrfa-text-link" style={{ display: "block", marginTop: 4 }} disabled={disabled} title="Ask the fax provider for the latest status. MindBill also checks automatically." onClick={onRefreshDelivery}>Refresh status</button> : null}</td>
          <td>{rfaShortDate(transmission.receivedAt)}{transmission.proofDocumentId ? <small>{evidence(transmission.proofDocumentId, "Receipt")}</small> : null}</td>
          <td className="mbrfa-row-actions">{packetId ? <button type="button" disabled={disabled} title="The complete packet that was sent" onClick={() => void viewPacket(packetId)}>View PDF</button> : null}</td>
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
  if (cards) return <div className="mbrfa-tracking">{cardContent}</div>;
  return embedded ? <div className="mbrfa-tracking">{content}</div> : <TreatmentDraftShell {...appearance} title="Treatments and history" description="Review each treatment's authorization, appointments, delivery evidence, and notes."><style>{rfaDetailCss}</style>{content}</TreatmentDraftShell>;
}
function AppointmentForm({ appointment, editable, disabled, onError, onSave, bare = false }: { bare?: boolean; appointment: RfaScheduling; editable: boolean; disabled: boolean; onError: (message: string) => void; onSave: (input: RfaSchedulingInput) => Promise<boolean> }): ReactElement {
  const [disposition, setDisposition] = useState(appointment.disposition === "canceled" && appointment.version > 0 ? "canceled" : appointment.eligible && appointment.disposition === "no_appointment" ? "no_appointment" : appointment.eligible ? "scheduled" : "canceled");
  const form = <form onSubmit={event => {
      event.preventDefault(); if (disabled) return;
      try {
        const data = new FormData(event.currentTarget); const base = { expectedVersion: appointment.version, authorizationToken: appointment.authorizationToken };
        const input: RfaSchedulingInput = disposition === "scheduled" ? { ...base, disposition: "scheduled", appointmentAt: timestamp(data, "appointmentAt"), providerName: required(data, "providerName", "the provider name"), location: required(data, "location", "the appointment location") } : { ...base, disposition: disposition as "no_appointment" | "canceled", reason: required(data, "reason", "a reason") };
        void onSave(input);
      } catch (reason) { onError(reason instanceof Error ? reason.message : "Review the appointment details."); }
    }}><fieldset disabled={disabled}><legend>Appointment details</legend><label>Disposition<select value={disposition} onChange={event => setDisposition(event.target.value)}>{appointment.eligible ? <><option value="scheduled">Scheduled</option><option value="no_appointment">No appointment needed</option></> : null}{appointment.version > 0 ? <option value="canceled">Canceled</option> : null}</select></label>
      {disposition === "scheduled" ? <div className="mbtd-grid"><label>Date and time (your local time)<input name="appointmentAt" type="datetime-local" required defaultValue={localTime(appointment.appointmentAt)} /></label><label>Provider name<input name="providerName" required maxLength={200} defaultValue={appointment.providerName ?? ""} /></label><label>Location<input name="location" required maxLength={500} defaultValue={appointment.location ?? ""} /></label></div> : <label>Reason<textarea name="reason" required maxLength={2000} defaultValue={appointment.reason ?? ""} /></label>}
      <button type="submit">Save appointment</button></fieldset></form>;
  if (bare) return form;
  return <section><h4>Appointment</h4><p>{words(appointment.disposition)}{appointment.appointmentAt ? ` · ${date(appointment.appointmentAt)}` : ""}</p>{appointment.providerName ? <p>{appointment.providerName} · {appointment.location}</p> : null}{appointment.reason ? <p>{appointment.reason}</p> : null}
    {appointment.version > 0 && !appointment.current ? <p role="status">Authorization has changed. Review the current decision before updating this appointment.</p> : null}
    {editable && (appointment.eligible || appointment.version > 0) ? <details><summary>Update appointment</summary>{form}</details> : !appointment.eligible && appointment.disposition === "pending" ? <p>Appointments become available after treatment is authorized.</p> : null}
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
