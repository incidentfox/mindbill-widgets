"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { createRfaClient, createRfaLifecycleClient, type OrganizationClientOptions, type RfaRecord, type RfaFollowUp, type RfaFollowUpUpdate, type RfaTreatmentDecisionInput, type RfaReceiptInput } from "@mindbill/browser";
import { rfaDecisionDueText, rfaPacificDateTime } from "./rfa-decision-due";
import { RfaPdfReview } from "./rfa-delivery-panel";
import { isStaffRfaTask, rfaTaskLabel, rfaTaskState } from "./rfa-task-board";
import { RfaModal } from "./rfa-modal";
import { RfaFilePick } from "./rfa-file-pick";
import { rfaDecisionPrerequisite, rfaLocalDateTime, RfaSentOutsideFields, rfaSentOutsideInput } from "./rfa-sent-outside";
import { rfaDocumentReceivedAt, rfaShortDate } from "./rfa-detail-cards";
import { TreatmentDraftShell, type TreatmentDraftAppearance } from "./treatment-draft-shared";
import { DateField, DateTimeField, MultiSelect, Select, Checkbox } from "./form-controls";

export type RfaLifecycleControlsProps = OrganizationClientOptions & TreatmentDraftAppearance & {
  rfa: RfaRecord;
  selectedResponseDocumentId?: string;
  /** Opt in only when your server grants rfas:act or rfas:edit, respectively. */
  permissions?: readonly ("act" | "edit")[];
  onUpdated?: (rfa: RfaRecord) => void;
  /** Render as rows inside a host card, without the panel heading or summary notes. */
  rows?: boolean;
  /** Host-provided reading of a response document (for example OCR plus a model). When given, choosing a response
   * prefills its treatment decisions for a person to check. Failures leave the form empty; nothing is saved automatically. */
  readResponse?: (rfaId: string, documentId: string) => Promise<RfaResponseReading>;
  /** Card layout: open the decision dialog for this treatment (for example from its treatment card). A new nonce reopens it. */
  decisionRequest?: { itemId: string; nonce: number };
  /** With rows: render only the dialogs it opens, not the response and follow-up lists. */
  dialogOnly?: boolean;
};
const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const timestamp = (form: FormData, name: string) => {
  const value = text(form, name); const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) throw new Error("Enter a valid date and time.");
  return date.toISOString();
};
const label = (value: string) => value.replaceAll("_", " ");
const displayDate = (value: string | null) => value ? new Date(value).toLocaleString() : "Not recorded";

/** What was read from a utilization review response, for a person to check. Nothing here is saved until they confirm. */
export type RfaResponseReading = {
  status: "read" | "unreadable";
  decidedAt?: string;
  items: Array<{ itemId: string; outcome: "approved" | "modified" | "denied" | "not_addressed"; confident: boolean;
    authorizationNumber?: string; authorizedProcedureCode?: string; authorizedQuantity?: number; authorizedUnits?: number;
    effectiveFrom?: string; effectiveTo?: string; decisionReason?: string; reviewerName?: string; reviewerPhone?: string }>;
};
const localDateTime = (value?: string): string => { const date = value ? new Date(value) : null; if (!date || !Number.isFinite(date.getTime())) return ""; return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
/**
 * Default decision time for a read UR letter. Letters carry a date, not a time, so the decision defaults to the
 * start of that day in the user's (practice's) time zone; it never defaults to a time later than now.
 */
export function rfaReadDecisionDefault(read: { decidedAt?: string; decidedOn?: string } | null | undefined, now = new Date(), notBefore?: string | null): string {
  const day = read?.decidedOn && /^\d{4}-\d{2}-\d{2}$/.test(read.decidedOn) ? read.decidedOn
    // Older servers send a date-only letter as 19:00Z (noon Pacific) on that date.
    : read?.decidedAt && /T19:00:00(?:\.000)?Z$/.test(read.decidedAt) ? read.decidedAt.slice(0, 10) : null;
  let value: Date | null = null;
  if (day) { const [y, m, d] = day.split("-").map(Number) as [number, number, number]; value = new Date(y, m - 1, d, 0, 0, 0, 0); }
  else if (read?.decidedAt && Number.isFinite(Date.parse(read.decidedAt))) value = new Date(read.decidedAt);
  if (!value) return "";
  // A decision cannot precede the request reaching the claims administrator (same-day letters).
  const floor = notBefore ? Date.parse(notBefore) : NaN;
  if (Number.isFinite(floor) && value.getTime() < floor) value = new Date(Math.ceil(floor / 60_000) * 60_000);
  if (value.getTime() > now.getTime()) value = now;
  return localDateTime(value.toISOString());
}

export function RfaLifecycleControls({ sessionEndpoint, getSession, apiBaseUrl, fetch: fetchOverride, ...props }: RfaLifecycleControlsProps): ReactElement {
  const options = useMemo<OrganizationClientOptions>(() => ({ ...(sessionEndpoint ? { sessionEndpoint } : {}), ...(getSession ? { getSession } : {}), ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}) }), [sessionEndpoint, getSession, apiBaseUrl, fetchOverride]);
  const identity = useMemo(() => crypto.randomUUID(), [options]);
  return <LifecycleContent key={`${identity}:${props.rfa.id}`} {...props} options={options} />;
}
function LifecycleContent({ rfa: providedRfa, options, permissions = [], onUpdated, selectedResponseDocumentId, rows = false, readResponse, decisionRequest, dialogOnly = false, ...appearance }: Omit<RfaLifecycleControlsProps, keyof OrganizationClientOptions> & { options: OrganizationClientOptions }): ReactElement {
  const [rfa, setRfa] = useState(providedRfa);
  useEffect(() => { setRfa(providedRfa); }, [providedRfa]);
  const client = useMemo(() => createRfaLifecycleClient(options), [options]);
  const records = useMemo(() => createRfaClient(options), [options]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0); const [tasks, setTasks] = useState<RfaFollowUp[]>([]); const [taskError, setTaskError] = useState(""); const [loading, setLoading] = useState(true);
  const [responseDocument, setResponseDocument] = useState(selectedResponseDocumentId ?? "");
  // Card layout: the one form being filled in, shown in a dialog. Arriving from a response opens its decisions.
  const [panel, setPanel] = useState(rows && selectedResponseDocumentId ? "decisions" : "");
  const [focusItem, setFocusItem] = useState("");
  const [responsePdf, setResponsePdf] = useState<Blob | null>(null);
  const [previewError, setPreviewError] = useState(""); const [previewReload, setPreviewReload] = useState(0);
  // Decisions read from the chosen response. They prefill the form; a person still checks and saves them.
  const [reading, setReading] = useState<{ documentId: string; value: RfaResponseReading } | null>(null);
  const [readingBusy, setReadingBusy] = useState(false); const [readingChecked, setReadingChecked] = useState(false);
  // Load the letter once per chosen document. Refreshing the request returns a new documents list; that must
  // not reload the viewer, which made the letter flash while someone was reading it.
  const responseAvailable = Boolean(responseDocument) && rfa.documents.some(document => document.id === responseDocument && document.documentType === "ur_response");
  useEffect(() => {
    let active = true; setResponsePdf(null); setPreviewError("");
    if (responseAvailable) {
      records.getDocument(rfa.id, responseDocument).then(blob => { if (active) setResponsePdf(blob); }).catch(() => { if (active) setPreviewError("The response preview could not be loaded. Retry to review the document."); });
    }
    return () => { active = false; };
  }, [records, rfa.id, responseDocument, responseAvailable, previewReload]);
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true; setReading(null); setReadingChecked(false);
    if (!readResponse || !responseDocument || !rfa.documents.some(document => document.id === responseDocument && document.documentType === "ur_response")) return;
    setReadingBusy(true);
    readResponse(rfa.id, responseDocument).then(value => {
      if (!active) return;
      setReading({ documentId: responseDocument, value });
      if (value.status === "read") setOutcomes(Object.fromEntries(value.items.filter(item => item.outcome !== "not_addressed").map(item => [item.itemId, item.outcome])));
    }).catch(() => { if (active) setReading({ documentId: responseDocument, value: { status: "unreadable", items: [] } }); }).finally(() => { if (active) setReadingBusy(false); });
    return () => { active = false; };
    // Read once per chosen document; the request's other fields changing must not overwrite what the person typed.
  }, [readResponse, rfa.id, responseDocument]);
  const read = reading?.documentId === responseDocument && reading.value.status === "read" ? reading.value : null;
  const readItem = (itemId: string) => read?.items.find(item => item.itemId === itemId);
  const alive = useRef(true); const pending = useRef(false); const keys = useRef(new Map<string, string>());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    // Follow-ups are paginated by claim. Read every page so another request's tasks cannot hide this one's.
    (async () => {
      const found: RfaFollowUp[] = []; const seen = new Set<string>(); let cursor: string | undefined;
      do {
        const page = await client.listFollowUps({ claimId: rfa.claimId, includeResolved: true, limit: 200, ...(cursor ? { cursor } : {}) });
        found.push(...page.data.filter(task => task.rfaId === rfa.id && isStaffRfaTask(task)));
        cursor = page.nextCursor ?? undefined;
        if (cursor && seen.has(cursor)) throw new Error("Follow-up pagination could not be completed. Refresh to try again.");
        if (cursor) seen.add(cursor);
      } while (cursor && active);
      if (active) { setTasks(found); setTaskError(""); }
    })().catch(reason => { if (active) setTaskError(reason instanceof Error ? reason.message : "Follow-ups could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, rfa.claimId, rfa.id, rfa.updatedAt, reload]);
  useEffect(() => {
    const refresh = () => { if (!pending.current && document.visibilityState !== "hidden" && !document.activeElement?.closest("form")) setReload(value => value + 1); };
    const timer = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const act = permissions.includes("act"); const edit = permissions.includes("edit"); const disabled = busy || appearance.disabled;
  const run = async (operation: string, input: unknown, action: (key: string) => Promise<RfaRecord | void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    const fingerprint = JSON.stringify([operation, input]); let key = keys.current.get(fingerprint);
    if (!key) { key = `rfa-lifecycle-${crypto.randomUUID()}`; keys.current.set(fingerprint, key); }
    try {
      const updated = await action(key);
      if (alive.current) { if (updated) { setRfa(updated); onUpdated?.(updated); } setReload(value => value + 1); setMessage("Record saved."); setPanel(""); }
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "The record could not be saved. Review its status before retrying."); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  const submit = <T,>(event: FormEvent<HTMLFormElement>, operation: string, input: (form: FormData) => T, action: (value: T, key: string) => Promise<RfaRecord | void>) => {
    event.preventDefault();
    if (disabled) return;
    try { const value = input(new FormData(event.currentTarget)); void run(operation, value, key => action(value, key)); }
    catch (reason) { setMessage(""); setError(reason instanceof Error ? reason.message : "Review the form values."); }
  };
  const requiredMark = <span className="mbrfa-required" aria-hidden="true"> *</span>;
  const optionalMark = <span className="mbrfa-optional"> (optional)</span>;
  const docs = (types?: string[]) => rfa.documents.filter(document => !types || types.includes(document.documentType));
  const documentSelect = (name: string, title: string, types?: string[], required = true) => <label>{title}<Select name={name} required={required} defaultValue=""><option value="">Choose a document</option>{docs(types).map(document => <option key={document.id} value={document.id}>{document.filename}</option>)}</Select></label>;
  const pendingItems = rfa.items.filter(item => item.outcome === "pending" && !item.decisionClosure?.closed);
  // A decision can be recorded on any open request; one never marked sent or received first gets those dates.
  const prerequisite = rfaDecisionPrerequisite(rfa);
  const decisionAllowed = prerequisite === "none";
  // Stacked layout keeps expandable sections; the card layout opens each form in a dialog from a button.
  const block = (id: string, title: string, content: ReactNode, open = false, wide = false) => rows
    ? panel === id ? <RfaModal title={title} wide={wide} busy={Boolean(busy)} onClose={() => { setPanel(""); setError(""); }}>{error ? <p role="alert">{error}</p> : null}{content}</RfaModal> : null
    : <details open={open}><summary>{title}</summary>{content}</details>;
  const canUpload = edit;
  const canReceive = act && !rfa.receivedAt && !["draft", "ready", "canceled", "closed"].includes(rfa.status);
  const canDecide = act && prerequisite !== "blocked" && pendingItems.length > 0;
  const outstandingRequests = rfa.informationRequests.filter(request => !request.respondedAt).length;
  const canInformation = rfa.informationRequests.length > 0 || (act && decisionAllowed);
  const openDocument = async (id: string) => { const tab = window.open("", "_blank"); try { const url = URL.createObjectURL(await records.getDocument(rfa.id, id)); if (tab) tab.location.href = url; else window.location.assign(url); setTimeout(() => URL.revokeObjectURL(url), 60_000); } catch (reason) { tab?.close(); setError(reason instanceof Error ? reason.message : "The document could not be opened."); } };
  const responses = docs(["ur_response"]);
  // Opening decisions without a chosen response starts from the newest one; the treatment asked for is listed first.
  const openDecisions = (itemId = "") => {
    setError(""); setFocusItem(itemId);
    if (!responseDocument && responses.length) setResponseDocument([...responses].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0]!.id);
    setPanel("decisions");
  };
  useEffect(() => { if (rows && decisionRequest) openDecisions(decisionRequest.itemId); }, [decisionRequest?.nonce]); // Only a new request reopens the dialog.
  // The decision document can be attached right in the decision form; it is selected and read like any other response.
  const uploadResponse = async (file: File | undefined) => {
    if (!file || pending.current || disabled) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const before = new Set(rfa.documents.map(document => document.id));
      const updated = await records.uploadDocument(rfa.id, { file, documentType: "ur_response", contentRevision: rfa.contentRevision }, `rfa-decision-upload-${crypto.randomUUID()}`);
      if (!alive.current) return;
      setRfa(updated); onUpdated?.(updated);
      const added = updated.documents.find(document => !before.has(document.id) && document.documentType === "ur_response");
      if (added) setResponseDocument(added.id);
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "The decision document could not be uploaded."); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  const orderedPending = focusItem ? [...pendingItems].sort((a, b) => Number(b.id === focusItem) - Number(a.id === focusItem)) : pendingItems;
  const cardRows = rows && !dialogOnly ? <>
    {error && !panel ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    <div className="mbrfa-ur-section"><h4>Responses</h4>{responses.length ? <ul className="mbrfa-ur-list">{responses.map(document => <li key={document.id}>
      <span><strong>{document.filename}</strong><small>Received {rfaShortDate(rfaDocumentReceivedAt(document))}</small></span>
      <span className="mbtd-actions"><button type="button" disabled={disabled} onClick={() => void openDocument(document.id)}>View</button>{canDecide ? <button type="button" className="mbtd-primary" disabled={disabled} onClick={() => { setResponseDocument(document.id); setError(""); setFocusItem(""); setPanel("decisions"); }}>Record decisions</button> : null}</span>
    </li>)}</ul> : <p className="mbrfa-empty">No utilization review response yet.</p>}</div>
    {tasks.length || taskError ? <div className="mbrfa-ur-section"><h4>Follow-ups</h4>{taskError ? <p role="alert">{taskError}</p> : null}<ul className="mbrfa-ur-list">{tasks.map(task => <li key={task.id}>
      <span><strong>{rfaTaskLabel(task.kind)}</strong><small>{rfaTaskState(task) === "Due" ? "Due" : `${rfaTaskState(task)} · due`} {rfaPacificDateTime(task.snoozedUntil ?? task.dueAt)}{task.responseFilename ? ` · ${task.responseFilename}` : ""}</small></span>
      {act ? <span className="mbtd-actions"><button type="button" disabled={disabled} onClick={() => { setError(""); setPanel(`task:${task.id}`); }}>Update</button></span> : null}
    </li>)}</ul></div> : null}
    {!act ? <p>Your session can view this record. Recording receipt, decisions, or follow-ups requires authorization from your administrator.</p> : null}
    {(canDecide && !responses.length) || canReceive || canUpload || canInformation ? <div className="mbtd-actions mbrfa-ur-actions">
      {canDecide && !responses.length ? <button type="button" disabled={disabled} onClick={() => openDecisions()}>Record decisions ({pendingItems.length} pending)</button> : null}
      {canReceive ? <button type="button" disabled={disabled} onClick={() => { setError(""); setPanel("receipt"); }}>Record receipt</button> : null}
      {canUpload ? <button type="button" disabled={disabled} onClick={() => { setError(""); setPanel("upload"); }}>Upload evidence</button> : null}
      {canInformation ? <button type="button" disabled={disabled} onClick={() => { setError(""); setPanel("information"); }}>Information requests{outstandingRequests ? ` (${outstandingRequests} outstanding)` : ""}</button> : null}
    </div> : null}
    {tasks.map(task => panel === `task:${task.id}` ? <RfaModal key={task.id} title={`${rfaTaskLabel(task.kind)} follow-up`} busy={Boolean(busy)} onClose={() => { setPanel(""); setError(""); }}>{error ? <p role="alert">{error}</p> : null}<FollowUpForm bare task={task} selected hasRecordedDecisions={rfa.items.some(item => item.currentResponseDocumentId === task.responseDocumentId && item.outcome !== "pending")} onReview={task.responseDocumentId && canDecide ? () => { setResponseDocument(task.responseDocumentId!); setFocusItem(""); setPanel("decisions"); } : undefined} editable={act} disabled={Boolean(disabled)} onSave={input => run(`follow-up:${task.id}`, input, async key => { await client.updateFollowUp(task.id, input, key); return records.get(rfa.id); })} /></RfaModal> : null)}
  </> : null;
  const body = <>
      {rows ? null : <div className="mbtd-note">Confirmed receipt: {displayDate(rfa.receivedAt)}<br />Decision due: {rfaDecisionDueText(rfa)}{rfa.decisionDeadlineBasis ? <><br />Basis: {label(rfa.decisionDeadlineBasis)}</> : null}</div>}
      {rows ? cardRows : <>{error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}</>}
      {!rows && docs(["ur_response"]).length ? <section aria-label="Response document review"><label>Response to review<Select value={responseDocument} onChange={(choice) => setResponseDocument(choice)}><option value="">Choose a response document</option>{docs(["ur_response"]).map(document => <option key={document.id} value={document.id}>{document.filename}</option>)}</Select></label>{previewError ? <div><p role="alert">{previewError}</p><button type="button" onClick={() => setPreviewReload(value => value + 1)}>Retry response preview</button></div> : null}{responsePdf ? <RfaPdfReview blob={responsePdf} title="Utilization review response" /> : responseDocument && !previewError ? <p role="status">Loading response preview…</p> : null}<p>Record each treatment decision below, then complete its Post UR response review. Treatments not addressed remain pending.</p></section> : null}
      {!rows && !act ? <p>Your session can view this record. Recording receipt, decisions, or follow-ups requires authorization from your administrator.</p> : null}
      {canUpload ? block("upload", "Upload review evidence", <form onSubmit={event => {
        event.preventDefault(); if (disabled) return; const data = new FormData(event.currentTarget); const file = data.get("evidence");
        if (!(file instanceof File) || !file.size) { setError("Choose an evidence file."); return; }
        const documentType = text(data, "documentType") as "ur_response" | "imr_form" | "supporting_record" | "other";
        void run("upload", { name: file.name, size: file.size, modified: file.lastModified, documentType }, key => records.uploadDocument(rfa.id, { file, documentType, contentRevision: rfa.contentRevision }, key));
      }}><fieldset disabled={disabled}><legend>Review evidence</legend><div className="mbtd-grid"><label>Document type<Select name="documentType"><option value="ur_response">Utilization review response</option><option value="imr_form">Independent medical review form</option><option value="supporting_record">Supporting clinical record</option><option value="other">Receipt proof or other evidence</option></Select></label><div className="mbrfa-field"><span className="mbrfa-field-label">Evidence file (PDF)</span><RfaFilePick name="evidence" className="mbrfa-file-pick">Choose PDF</RfaFilePick></div></div><button type="submit">Upload evidence</button></fieldset></form>) : null}
      {canReceive ? block("receipt", "Record confirmed receipt", <form onSubmit={event => submit(event, "receipt", data => ({ channel: text(data, "channel") as RfaReceiptInput["channel"], receivedAt: timestamp(data, "receivedAt"), ...(text(data, "proofDocumentId") ? { proofDocumentId: text(data, "proofDocumentId") } : {}), ...(text(data, "providerMessageId") ? { providerMessageId: text(data, "providerMessageId") } : {}) }), (input, key) => client.recordReceipt(rfa.id, input, key))}><fieldset disabled={disabled}><legend>Receipt evidence</legend><p>Confirm when the claims administrator received the original RFA before recording treatment decisions. A matched response does not set this time automatically.</p><p>A sent fax alone does not establish receipt. Enter the administrator's confirmed receipt time and a proof document or delivery reference.</p><div className="mbtd-grid"><label>Confirmed receipt time<DateTimeField name="receivedAt" required /></label><label>Receipt channel<Select name="channel">{["fax", "email", "edi", "portal", "mail", "manual"].map(value => <option key={value}>{value}</option>)}</Select></label>{documentSelect("proofDocumentId", "Receipt proof", undefined, false)}<label>Delivery or provider reference<input name="providerMessageId" /></label></div><button type="submit">Save confirmed receipt</button></fieldset></form>, Boolean(selectedResponseDocumentId)) : null}
      {canDecide && rows ? panel === "decisions" ? <RfaModal full title={`Record UR decision${pendingItems.length === 1 ? "" : `s (${pendingItems.length} pending)`}`} busy={Boolean(busy)} onClose={() => { setPanel(""); setError(""); }}>
        <div className="mbrfa-review">
          <div className="mbrfa-review-doc">{previewError ? <div className="mbrfa-review-empty"><p role="alert">{previewError}</p><button type="button" onClick={() => setPreviewReload(value => value + 1)}>Retry</button></div>
            : responsePdf ? <RfaPdfReview fill blob={responsePdf} title="Utilization review response" />
            : responseDocument ? <div className="mbrfa-review-empty"><p role="status">Loading the response…</p></div>
            : <div className="mbrfa-review-empty">{edit ? <RfaFilePick className="mbrfa-review-drop" dropzone disabled={Boolean(disabled)} onFile={file => void uploadResponse(file)}><strong>Attach the UR decision</strong><span>Drop the PDF the claims administrator sent, or choose it. It opens here so you can check each decision against it.</span><span className="mbrfa-review-drop-button">Choose PDF</span></RfaFilePick> : <p>No UR response is attached yet.</p>}</div>}</div>
          <form className="mbrfa-review-side" onSubmit={event => submit(event, "decisions", data => {
        const decisions: RfaTreatmentDecisionInput[] = pendingItems.filter(item => outcomes[item.id]).map(item => {
          const prefix = `${item.id}:`; const outcome = outcomes[item.id] as RfaTreatmentDecisionInput["outcome"];
          const decision: RfaTreatmentDecisionInput = { itemId: item.id, outcome };
          for (const field of ["authorizationNumber", "authorizedProcedureCode", "effectiveFrom", "effectiveTo", "decisionReason", "reviewerName", "reviewerPhone"] as const) if (text(data, prefix + field)) decision[field] = text(data, prefix + field);
          for (const field of ["authorizedQuantity", "authorizedUnits"] as const) if (text(data, prefix + field)) decision[field] = Number(text(data, prefix + field));
          return decision;
        });
        if (!text(data, "responseDocumentId")) throw new Error("Choose the utilization review response.");
        if (!text(data, "decidedAt")) throw new Error("Enter the decision date.");
        if (!decisions.length) throw new Error("Choose at least one treatment decision. Other treatments remain pending.");
        if (read && !readingChecked) throw new Error("Confirm that you checked these decisions against the response.");
        if (decisions.some(item => item.outcome !== "approved") && !text(data, "imrDocumentId")) throw new Error("An independent medical review form is required for modified or denied treatment.");
        const sent = prerequisite === "sent" ? rfaSentOutsideInput(data) : null;
        if (typeof sent === "string") throw new Error(sent);
        const receivedAt = prerequisite === "receipt" ? timestamp(data, "receivedAt") : null;
        if (receivedAt && rfa.submittedAt && Date.parse(receivedAt) < Date.parse(rfa.submittedAt)) throw new Error("It cannot have been received before it was sent.");
        return { decisions: { decidedAt: timestamp(data, "decidedAt"), responseDocumentId: text(data, "responseDocumentId"), ...(text(data, "imrDocumentId") ? { imrDocumentId: text(data, "imrDocumentId") } : {}), decisions }, sent, receivedAt };
      }, async ({ decisions, sent, receivedAt }, key) => {
        // Each step keeps its own key, so retrying after a later step failed does not record an earlier one twice.
        if (sent) await client.recordSentOutside(rfa.id, sent, `${key}:sent`);
        if (receivedAt) {
          const channel = rfa.transmissions.filter(item => item.direction === "outbound").at(-1)?.channel ?? "fax";
          // The decision letter itself proves the request arrived.
          await client.recordReceipt(rfa.id, { channel: channel as RfaReceiptInput["channel"], receivedAt, proofDocumentId: decisions.responseDocumentId }, `${key}:receipt`);
        }
        return client.recordDecisions(rfa.id, decisions, key);
      })}><div className="mbrfa-review-scroll"><fieldset className="mbrfa-review-fields" disabled={disabled}><legend className="mbrfa-sr-only">Treatment decisions</legend>
            {error ? <p role="alert">{error}</p> : null}
            {prerequisite === "sent" ? <div className="mbrfa-decision-prereq"><p><strong>This RFA is not marked as sent.</strong> A decision means it was sent and received, so enter those dates too.</p><RfaSentOutsideFields receivedRequired receivedLabel="Received by the claims administrator on" /></div>
              : prerequisite === "receipt" ? <div className="mbrfa-decision-prereq"><p><strong>Receipt is not recorded yet.</strong> A decision means the claims administrator received the RFA, so enter when.</p><div className="mbrfa-field"><span className="mbrfa-field-label">Received by the claims administrator on{requiredMark}</span><DateTimeField required name="receivedAt" label="Received on" max={rfaLocalDateTime()} defaultValue={rfaLocalDateTime(rfa.submittedAt ? new Date(rfa.submittedAt) : undefined)} /></div></div> : null}
            {readingBusy ? <p role="status" className="mbrfa-reading">Reading the response…</p> : read ? <p className="mbrfa-reading" role="status">These decisions were read from the response. Check each one against the letter before saving{read.items.some(item => !item.confident || item.outcome === "not_addressed") ? "; the ones marked in orange need a closer look" : ""}.</p>
              : reading?.documentId === responseDocument ? <p className="mbrfa-reading" data-flag="true" role="status">This response could not be read automatically. Enter the decisions from the letter.</p> : null}
            <div className="mbtd-grid">
              <div className="mbrfa-field mbrfa-review-response"><span className="mbrfa-field-label">Utilization review response{requiredMark}</span><Select name="responseDocumentId" label="Utilization review response" required value={responseDocument} onChange={setResponseDocument} placeholder="Choose the letter" options={docs(["ur_response"]).map(document => ({ value: document.id, label: document.filename }))} />{edit && responses.length ? <span className="mbrfa-review-attach">Wrong letter? <RfaFilePick className="mbrfa-review-attach-link" disabled={Boolean(disabled)} onFile={file => void uploadResponse(file)}>Attach a different PDF</RfaFilePick></span> : null}</div>
              <div className="mbrfa-field mbrfa-wide"><span className="mbrfa-field-label">Decision date{requiredMark}</span><DateTimeField key={`decidedAt:${read ? reading!.documentId : ""}`} required name="decidedAt" label="Decision date" defaultValue={rfaReadDecisionDefault(read as { decidedAt?: string; decidedOn?: string } | null, new Date(), rfa.receivedAt ?? rfa.submittedAt)} /></div>
              <div className="mbrfa-field mbrfa-wide"><span className="mbrfa-field-label">IMR application{Object.values(outcomes).some(value => value === "modified" || value === "denied") ? requiredMark : optionalMark}</span><Select name="imrDocumentId" label="IMR application" placeholder="Choose a document" options={[{ value: "", label: "None" }, ...docs(["imr_form"]).map(document => ({ value: document.id, label: document.filename }))]} /></div>
            </div>
            <p className="mbrfa-review-hint">Record only the treatments this letter decides. The rest stay pending.</p>
            {orderedPending.map(item => { const found = readItem(item.id); const flag = read ? !found || found.outcome === "not_addressed" ? "No decision for this treatment was found in the letter. It stays pending unless you choose one." : !found.confident ? "This one was hard to read. Check it carefully." : "" : ""; const k = `${item.id}:${read ? reading!.documentId : ""}`; const outcome = outcomes[item.id] ?? "";
              // What was authorized usually matches what was requested, so those fields start from the request.
              return <fieldset key={k} {...(flag ? { "data-flag": "true" } : {})}><legend>{item.procedureCode || "Treatment"}: {item.serviceDescription}</legend>{flag ? <p className="mbrfa-reading" data-flag="true">{flag}</p> : null}
                <div className="mbrfa-outcome" role="radiogroup" aria-label={`Decision for ${item.procedureCode || item.serviceDescription}`}>{([["approved", "Approved"], ["modified", "Modified"], ["denied", "Denied"], ["", "Pending"]] as const).map(([value, text]) => <button key={value || "pending"} type="button" role="radio" aria-checked={outcome === value} data-outcome={value || "pending"} onClick={() => setOutcomes(current => ({ ...current, [item.id]: value }))}>{text}</button>)}</div>
                {outcome ? <div className="mbtd-grid">{outcome !== "denied" ? <>
                  <label><span className="mbrfa-field-label">Authorization number{requiredMark}</span><input name={`${item.id}:authorizationNumber`} defaultValue={found?.authorizationNumber ?? ""} required /></label>
                  <label><span className="mbrfa-field-label">Authorized procedure code{optionalMark}</span><input name={`${item.id}:authorizedProcedureCode`} defaultValue={found?.authorizedProcedureCode ?? item.procedureCode ?? ""} /></label>
                  <label><span className="mbrfa-field-label">Authorized quantity{optionalMark}</span><input name={`${item.id}:authorizedQuantity`} defaultValue={found?.authorizedQuantity ?? (outcome === "approved" ? item.quantity ?? "" : "")} inputMode="decimal" /></label>
                  <label><span className="mbrfa-field-label">Authorized units{optionalMark}</span><input name={`${item.id}:authorizedUnits`} defaultValue={found?.authorizedUnits ?? (outcome === "approved" ? item.units ?? "" : "")} inputMode="numeric" /></label>
                  <div className="mbrfa-field"><span className="mbrfa-field-label">Effective from{optionalMark}</span><DateField name={`${item.id}:effectiveFrom`} label="Effective from" defaultValue={found?.effectiveFrom ?? item.requestedFrom ?? ""} /></div>
                  <div className="mbrfa-field"><span className="mbrfa-field-label">Effective through{optionalMark}</span><DateField name={`${item.id}:effectiveTo`} label="Effective through" defaultValue={found?.effectiveTo ?? item.requestedTo ?? ""} /></div>
                </> : null}{outcome !== "approved" ? <>
                  <label className="mbrfa-wide"><span className="mbrfa-field-label">Decision reason{requiredMark}</span><textarea rows={6} name={`${item.id}:decisionReason`} required defaultValue={found?.decisionReason ?? ""} /></label>
                  <label><span className="mbrfa-field-label">Reviewer name{requiredMark}</span><input name={`${item.id}:reviewerName`} defaultValue={found?.reviewerName ?? ""} required /></label>
                  <label><span className="mbrfa-field-label">Reviewer phone{requiredMark}</span><input name={`${item.id}:reviewerPhone`} defaultValue={found?.reviewerPhone ?? ""} required /></label>
                </> : null}</div> : null}</fieldset>; })}
          </fieldset></div>
          <div className="mbrfa-review-foot">{read ? <label className="mbrfa-check"><Checkbox checked={readingChecked} onChange={event => setReadingChecked(event.target.checked)} /><span>I checked each decision against the letter.</span></label> : null}<button type="submit" className="mbtd-primary" disabled={Boolean(disabled)}>{busy ? "Saving…" : "Save decisions"}</button></div></form>
        </div>
      </RfaModal> : null : canDecide ? block("decisions", `Record treatment decisions (${pendingItems.length} pending)`, <><form onSubmit={event => submit(event, "decisions", data => {
        const decisions: RfaTreatmentDecisionInput[] = pendingItems.filter(item => outcomes[item.id]).map(item => {
          const prefix = `${item.id}:`; const outcome = outcomes[item.id] as RfaTreatmentDecisionInput["outcome"];
          const decision: RfaTreatmentDecisionInput = { itemId: item.id, outcome };
          for (const field of ["authorizationNumber", "authorizedProcedureCode", "effectiveFrom", "effectiveTo", "decisionReason", "reviewerName", "reviewerPhone"] as const) if (text(data, prefix + field)) decision[field] = text(data, prefix + field);
          for (const field of ["authorizedQuantity", "authorizedUnits"] as const) if (text(data, prefix + field)) decision[field] = Number(text(data, prefix + field));
          return decision;
        });
        if (!decisions.length) throw new Error("Choose at least one treatment decision. Other treatments remain pending.");
        if (read && !readingChecked) throw new Error("Confirm that you checked these decisions against the response.");
        if (decisions.some(item => item.outcome !== "approved") && !text(data, "imrDocumentId")) throw new Error("An independent medical review form is required for modified or denied treatment.");
        const sent = prerequisite === "sent" ? rfaSentOutsideInput(data) : null;
        if (typeof sent === "string") throw new Error(sent);
        const receivedAt = prerequisite === "receipt" ? timestamp(data, "receivedAt") : null;
        if (receivedAt && rfa.submittedAt && Date.parse(receivedAt) < Date.parse(rfa.submittedAt)) throw new Error("It cannot have been received before it was sent.");
        return { decisions: { decidedAt: timestamp(data, "decidedAt"), responseDocumentId: text(data, "responseDocumentId"), ...(text(data, "imrDocumentId") ? { imrDocumentId: text(data, "imrDocumentId") } : {}), decisions }, sent, receivedAt };
      }, async ({ decisions, sent, receivedAt }, key) => {
        // Each step keeps its own key, so retrying after a later step failed does not record an earlier one twice.
        if (sent) await client.recordSentOutside(rfa.id, sent, `${key}:sent`);
        if (receivedAt) {
          const channel = rfa.transmissions.filter(item => item.direction === "outbound").at(-1)?.channel ?? "fax";
          // The decision letter itself proves the request arrived.
          await client.recordReceipt(rfa.id, { channel: channel as RfaReceiptInput["channel"], receivedAt, proofDocumentId: decisions.responseDocumentId }, `${key}:receipt`);
        }
        return client.recordDecisions(rfa.id, decisions, key);
      })}><fieldset disabled={disabled}><legend>Treatment decisions</legend>
        {prerequisite === "sent" ? <div className="mbrfa-decision-prereq"><p><strong>This RFA is not marked as sent.</strong> A decision means it was sent and received, so enter those dates too.</p><RfaSentOutsideFields receivedRequired receivedLabel="Received by the claims administrator on" /></div>
          : prerequisite === "receipt" ? <div className="mbrfa-decision-prereq"><p><strong>Receipt is not recorded yet.</strong> A decision means the claims administrator received the RFA, so enter when.</p><label>Received by the claims administrator on<DateTimeField name="receivedAt" required max={rfaLocalDateTime()} defaultValue={rfaLocalDateTime(rfa.submittedAt ? new Date(rfa.submittedAt) : undefined)} /></label></div> : null}
        <p>Record only treatments addressed by this response. Unselected treatments remain pending.</p>
        {readingBusy ? <p role="status">Reading the response…</p> : read ? <p className="mbrfa-reading" role="status">These decisions were read from the response. Check each one against the document before saving{read.items.some(item => !item.confident || item.outcome === "not_addressed") ? "; the ones marked in orange need a closer look" : ""}.</p>
          : reading?.documentId === responseDocument ? <p className="mbrfa-reading" data-flag="true" role="status">This response could not be read automatically. Enter the decisions from the document.</p> : null}
        <div className="mbtd-grid"><label>Decision time<DateTimeField key={`decidedAt:${read ? reading!.documentId : ""}`} name="decidedAt" required defaultValue={rfaReadDecisionDefault(read as { decidedAt?: string; decidedOn?: string } | null, new Date(), rfa.receivedAt ?? rfa.submittedAt)} /></label><label>Utilization review response<Select name="responseDocumentId" required value={responseDocument} onChange={(choice) => setResponseDocument(choice)}><option value="">Choose a document</option>{docs(["ur_response"]).map(document => <option key={document.id} value={document.id}>{document.filename}</option>)}</Select></label>{documentSelect("imrDocumentId", "Independent medical review form", ["imr_form"], false)}</div>
        {orderedPending.map(item => { const found = readItem(item.id); const flag = read ? !found || found.outcome === "not_addressed" ? "No decision for this treatment was found in the response. It stays pending unless you choose one." : !found.confident ? "This one was hard to read. Check it carefully." : "" : ""; const k = `${item.id}:${read ? reading!.documentId : ""}`; return <fieldset key={k} {...(flag ? { "data-flag": "true" } : {})}><legend>{item.procedureCode || "Treatment"}: {item.serviceDescription}</legend>{flag ? <p className="mbrfa-reading" data-flag="true">{flag}</p> : null}<label>Decision for {item.procedureCode || item.serviceDescription}<Select value={outcomes[item.id] ?? ""} onChange={(choice) => setOutcomes(value => ({ ...value, [item.id]: choice }))}><option value="">Leave pending</option><option value="approved">Approved</option><option value="modified">Modified</option><option value="denied">Denied</option></Select></label>{outcomes[item.id] ? <div className="mbtd-grid">{outcomes[item.id] !== "denied" ? <><label>Authorization number<input name={`${item.id}:authorizationNumber`} defaultValue={found?.authorizationNumber ?? ""} required /></label><label>Authorized procedure code<input name={`${item.id}:authorizedProcedureCode`} defaultValue={found?.authorizedProcedureCode ?? ""} /></label><label>Authorized quantity<input name={`${item.id}:authorizedQuantity`} defaultValue={found?.authorizedQuantity ?? ""} type="number" min="0.001" max="100000" step="any" /></label><label>Authorized units<input name={`${item.id}:authorizedUnits`} defaultValue={found?.authorizedUnits ?? ""} type="number" min="1" max="100000" /></label><label>Effective from<DateField name={`${item.id}:effectiveFrom`} defaultValue={found?.effectiveFrom ?? ""} /></label><label>Effective through<DateField name={`${item.id}:effectiveTo`} defaultValue={found?.effectiveTo ?? ""} /></label></> : null}{outcomes[item.id] !== "approved" ? <><label>Decision reason<textarea name={`${item.id}:decisionReason`} required defaultValue={found?.decisionReason ?? ""} /></label><label>Reviewer name<input name={`${item.id}:reviewerName`} defaultValue={found?.reviewerName ?? ""} required /></label><label>Reviewer phone<input name={`${item.id}:reviewerPhone`} defaultValue={found?.reviewerPhone ?? ""} required /></label></> : null}</div> : null}</fieldset>; })}{read ? <label className="mbrfa-check"><Checkbox checked={readingChecked} onChange={event => setReadingChecked(event.target.checked)} />I checked each decision above against the response document.</label> : null}<button type="submit">Save treatment decisions</button></fieldset></form></>, Boolean(selectedResponseDocumentId), true) : null}
      {canInformation || !rows ? block("information", `Information requests (${outstandingRequests} outstanding)`, <div style={{ display: "grid", gap: 12 }}>
        {rfa.informationRequests.map(request => <fieldset key={request.id}><legend>Requested {displayDate(request.requestedAt)}</legend><p>{request.requestText}</p>{request.dueAt ? <p>Due {displayDate(request.dueAt)}</p> : null}{request.respondedAt ? <p>Response recorded {displayDate(request.respondedAt)}</p> : act ? <form onSubmit={event => submit(event, `response:${request.id}`, data => ({ respondedAt: timestamp(data, "respondedAt"), responseDocumentIds: data.getAll("responseDocumentIds").map(String) }), (input, key) => client.recordInformationResponse(rfa.id, request.id, input, key))}><fieldset disabled={disabled}><legend>Record an already-delivered response</legend><p>This records evidence only. It does not send these documents to the administrator.</p><label>Response sent at<DateTimeField name="respondedAt" required /></label><label>Response documents<MultiSelect name="responseDocumentIds" required>{docs().map(document => <option key={document.id} value={document.id}>{document.filename}</option>)}</MultiSelect></label><label><Checkbox required /> I confirm these documents were already delivered to the administrator.</label><button type="submit">Record delivered response</button></fieldset></form> : null}</fieldset>)}
        {act && decisionAllowed ? <form onSubmit={event => submit(event, "information-request", data => ({ requestedAt: timestamp(data, "requestedAt"), requestText: text(data, "requestText"), ...(text(data, "dueAt") ? { dueAt: timestamp(data, "dueAt") } : {}) }), (input, key) => client.recordInformationRequest(rfa.id, input, key))}><fieldset disabled={disabled}><legend>Record a request for information</legend><div className="mbtd-grid"><label>Requested at<DateTimeField name="requestedAt" required /></label><label>Response due (optional)<DateTimeField name="dueAt" /></label><label className="mbtd-wide">Requested information<textarea name="requestText" required /></label></div><button type="submit">Save information request</button></fieldset></form> : null}
      </div>) : null}
      {rows ? null : <details open={Boolean(selectedResponseDocumentId)}><summary>Follow-up tasks</summary>{taskError ? <p role="alert">{taskError}</p> : null}{loading ? <p role="status">Loading follow-ups…</p> : tasks.length ? tasks.map(task => <FollowUpForm key={`${task.id}:${task.updatedAt}`} task={task} selected={Boolean(selectedResponseDocumentId && task.responseDocumentId === selectedResponseDocumentId)} hasRecordedDecisions={rfa.items.some(item => item.currentResponseDocumentId === task.responseDocumentId && item.outcome !== "pending")} onReview={task.responseDocumentId ? () => setResponseDocument(task.responseDocumentId!) : undefined} editable={act} disabled={Boolean(disabled)} onSave={input => run(`follow-up:${task.id}`, input, async key => { await client.updateFollowUp(task.id, input, key); return records.get(rfa.id); })} />) : !taskError ? <p>No follow-up tasks are recorded for this request.</p> : null}{taskError ? <button type="button" disabled={loading || disabled} onClick={() => setReload(value => value + 1)}>Retry follow-ups</button> : null}</details>}
      {rows ? null : <p className="mbtd-note">Exceptional decision clocks require the explicit <a href="https://docs.mindbill.org/guides/rfas" target="_blank" rel="noopener noreferrer">RFA API review workflows</a>. Existing evidence remains in the request history.</p>}
  </>;
  if (rows) return <div className="mbrfa-rows">{body}</div>;
  return <TreatmentDraftShell {...appearance} title="Receipt and utilization review" description="Record evidence received from the claims administrator and track each requested treatment. Dates and deadlines come from MindBill.">
    <div style={{ display: "grid", gap: 16 }}>{body}</div>
  </TreatmentDraftShell>;
}
function FollowUpForm({ task, selected, editable, disabled, onSave, onReview, hasRecordedDecisions, bare = false }: { bare?: boolean; selected: boolean; onReview: (() => void) | undefined; hasRecordedDecisions: boolean; task: RfaFollowUp; editable: boolean; disabled: boolean; onSave: (input: RfaFollowUpUpdate) => Promise<void> }): ReactElement {
  const [review, setReview] = useState(""); const [confirmed, setConfirmed] = useState(false); const [formError, setFormError] = useState("");
  const content = <fieldset disabled={disabled}><legend>Follow-up details</legend><p>Due {rfaPacificDateTime(task.snoozedUntil ?? task.dueAt)}{task.responseFilename ? ` · ${task.responseFilename}` : ""}</p>{task.lastNote ? <p>{task.lastNote}</p> : null}{onReview ? <button type="button" onClick={onReview}>Review response document</button> : null}{editable && task.status !== "resolved" && !task.resolvedAt ? <form onSubmit={event => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const note = text(data, "note");
    if (disabled || !editable || !note || (review && !confirmed) || (review === "decisions_recorded" && !hasRecordedDecisions)) return;
    setFormError("");
    try { const input: RfaFollowUpUpdate = review ? { note, responseReview: review === "no_new_decision" ? { disposition: "no_new_decision", noNewDecisionConfirmed: true } : { disposition: "decisions_recorded", allDecisionsRecordedConfirmed: true } } : { note, outcome: text(data, "outcome") as NonNullable<RfaFollowUpUpdate["outcome"]>, snoozedUntil: timestamp(data, "snoozedUntil") };
    void onSave(input); } catch (reason) { setFormError(reason instanceof Error ? reason.message : "Review the follow-up values."); }
  }}>{formError ? <p role="alert">{formError}</p> : null}<div className="mbtd-grid">{task.responseDocumentId ? <label>Response review<Select value={review} onChange={(choice) => { setReview(choice); setConfirmed(false); }}><option value="">Record follow-up contact</option><option value="no_new_decision">Confirm no new treatment decision</option><option value="decisions_recorded" disabled={!hasRecordedDecisions}>Confirm all decisions have been recorded</option></Select></label> : null}{!review ? <><label>Contact outcome<Select name="outcome">{["message_left", "decision_pending", "decision_issued", "not_on_file", "reviewed"].map(value => <option key={value} value={value}>{label(value)}</option>)}</Select></label><label>Next follow-up<DateTimeField name="snoozedUntil" required defaultValue={localDateTime(new Date(Date.now() + 2 * 86_400_000).toISOString())} /><small>Two days from now unless you change it.</small></label></> : <label><Checkbox required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> {review === "no_new_decision" ? "I reviewed the response and confirm it contains no new treatment decision." : "I confirm every treatment decision in the response has been recorded."}</label>}<label className="mbtd-wide">Follow-up note<textarea name="note" maxLength={2000} required /></label></div><button type="submit">{review ? "Complete response review" : "Save follow-up"}</button></form> : null}</fieldset>;
  return bare ? content : <details open={selected}><summary>{rfaTaskLabel(task.kind)} · {rfaTaskState(task)}</summary>{content}</details>;
}
