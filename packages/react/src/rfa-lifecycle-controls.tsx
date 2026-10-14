"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { createRfaClient, createRfaLifecycleClient, type OrganizationClientOptions, type RfaRecord, type RfaFollowUp, type RfaFollowUpUpdate, type RfaTreatmentDecisionInput, type RfaReceiptInput } from "@mindbill/browser";
import { rfaDecisionDueText } from "./rfa-decision-due";
import { RfaPdfReview } from "./rfa-delivery-panel";
import { isStaffRfaTask, rfaTaskLabel, rfaTaskState } from "./rfa-task-board";
import { RfaModal } from "./rfa-modal";
import { rfaShortDate } from "./rfa-detail-cards";
import { TreatmentDraftShell, type TreatmentDraftAppearance } from "./treatment-draft-shared";

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

export function RfaLifecycleControls({ sessionEndpoint, getSession, apiBaseUrl, fetch: fetchOverride, ...props }: RfaLifecycleControlsProps): ReactElement {
  const options = useMemo<OrganizationClientOptions>(() => ({ ...(sessionEndpoint ? { sessionEndpoint } : {}), ...(getSession ? { getSession } : {}), ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}) }), [sessionEndpoint, getSession, apiBaseUrl, fetchOverride]);
  const identity = useMemo(() => crypto.randomUUID(), [options]);
  return <LifecycleContent key={`${identity}:${props.rfa.id}`} {...props} options={options} />;
}
function LifecycleContent({ rfa: providedRfa, options, permissions = [], onUpdated, selectedResponseDocumentId, rows = false, readResponse, ...appearance }: Omit<RfaLifecycleControlsProps, keyof OrganizationClientOptions> & { options: OrganizationClientOptions }): ReactElement {
  const [rfa, setRfa] = useState(providedRfa);
  useEffect(() => { setRfa(providedRfa); }, [providedRfa]);
  const client = useMemo(() => createRfaLifecycleClient(options), [options]);
  const records = useMemo(() => createRfaClient(options), [options]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0); const [tasks, setTasks] = useState<RfaFollowUp[]>([]); const [taskError, setTaskError] = useState(""); const [loading, setLoading] = useState(true);
  const [responseDocument, setResponseDocument] = useState(selectedResponseDocumentId ?? "");
  // Card layout: the one form being filled in, shown in a dialog. Arriving from a response opens its decisions.
  const [panel, setPanel] = useState(rows && selectedResponseDocumentId ? "decisions" : "");
  const [responsePdf, setResponsePdf] = useState<Blob | null>(null);
  const [previewError, setPreviewError] = useState(""); const [previewReload, setPreviewReload] = useState(0);
  // Decisions read from the chosen response. They prefill the form; a person still checks and saves them.
  const [reading, setReading] = useState<{ documentId: string; value: RfaResponseReading } | null>(null);
  const [readingBusy, setReadingBusy] = useState(false); const [readingChecked, setReadingChecked] = useState(false);
  useEffect(() => {
    let active = true; setResponsePdf(null); setPreviewError("");
    if (responseDocument && rfa.documents.some(document => document.id === responseDocument && document.documentType === "ur_response")) {
      records.getDocument(rfa.id, responseDocument).then(blob => { if (active) setResponsePdf(blob); }).catch(() => { if (active) setPreviewError("The response preview could not be loaded. Retry to review the document."); });
    }
    return () => { active = false; };
  }, [records, rfa.id, responseDocument, rfa.documents, previewReload]);
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
  const docs = (types?: string[]) => rfa.documents.filter(document => !types || types.includes(document.documentType));
  const documentSelect = (name: string, title: string, types?: string[], required = true) => <label>{title}<select name={name} required={required} defaultValue=""><option value="">Choose a document</option>{docs(types).map(document => <option key={document.id} value={document.id}>{document.filename}</option>)}</select></label>;
  const pendingItems = rfa.items.filter(item => item.outcome === "pending" && !item.decisionClosure?.closed);
  const decisionAllowed = ["received", "under_review", "information_requested"].includes(rfa.status);
  // Stacked layout keeps expandable sections; the card layout opens each form in a dialog from a button.
  const block = (id: string, title: string, content: ReactNode, open = false, wide = false) => rows
    ? panel === id ? <RfaModal title={title} wide={wide} busy={Boolean(busy)} onClose={() => { setPanel(""); setError(""); }}>{error ? <p role="alert">{error}</p> : null}{content}</RfaModal> : null
    : <details open={open}><summary>{title}</summary>{content}</details>;
  const canUpload = edit;
  const canReceive = act && !rfa.receivedAt && !["draft", "ready", "canceled", "closed"].includes(rfa.status);
  const canDecide = act && decisionAllowed && pendingItems.length > 0;
  const outstandingRequests = rfa.informationRequests.filter(request => !request.respondedAt).length;
  const canInformation = rfa.informationRequests.length > 0 || (act && decisionAllowed);
  const openDocument = async (id: string) => { const tab = window.open("", "_blank"); try { const url = URL.createObjectURL(await records.getDocument(rfa.id, id)); if (tab) tab.location.href = url; else window.location.assign(url); setTimeout(() => URL.revokeObjectURL(url), 60_000); } catch (reason) { tab?.close(); setError(reason instanceof Error ? reason.message : "The document could not be opened."); } };
  const responses = docs(["ur_response"]);
  const cardRows = rows ? <>
    {error && !panel ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    <div className="mbrfa-ur-section"><h4>Responses</h4>{responses.length ? <ul className="mbrfa-ur-list">{responses.map(document => <li key={document.id}>
      <span><strong>{document.filename}</strong><small>Received {rfaShortDate(document.createdAt)}</small></span>
      <span className="mbtd-actions"><button type="button" disabled={disabled} onClick={() => void openDocument(document.id)}>View</button>{canDecide ? <button type="button" className="mbtd-primary" disabled={disabled} onClick={() => { setResponseDocument(document.id); setError(""); setPanel("decisions"); }}>Record decisions</button> : null}</span>
    </li>)}</ul> : <p className="mbrfa-empty">No utilization review response yet.</p>}</div>
    {tasks.length || taskError ? <div className="mbrfa-ur-section"><h4>Follow-ups</h4>{taskError ? <p role="alert">{taskError}</p> : null}<ul className="mbrfa-ur-list">{tasks.map(task => <li key={task.id}>
      <span><strong>{rfaTaskLabel(task.kind)}</strong><small>{rfaTaskState(task) === "Due" ? "Due" : `${rfaTaskState(task)} · due`} {rfaShortDate(task.snoozedUntil ?? task.dueAt)}{task.responseFilename ? ` · ${task.responseFilename}` : ""}</small></span>
      {act ? <span className="mbtd-actions"><button type="button" disabled={disabled} onClick={() => { setError(""); setPanel(`task:${task.id}`); }}>Update</button></span> : null}
    </li>)}</ul></div> : null}
    {!act ? <p>Your session can view this record. Recording receipt, decisions, or follow-ups requires authorization from your administrator.</p> : null}
    {(canDecide && !responses.length) || canReceive || canUpload || canInformation ? <div className="mbtd-actions mbrfa-ur-actions">
      {canDecide && !responses.length ? <button type="button" disabled={disabled} onClick={() => { setError(""); setPanel("decisions"); }}>Record decisions ({pendingItems.length} pending)</button> : null}
      {canReceive ? <button type="button" disabled={disabled} onClick={() => { setError(""); setPanel("receipt"); }}>Record receipt</button> : null}
      {canUpload ? <button type="button" disabled={disabled} onClick={() => { setError(""); setPanel("upload"); }}>Upload evidence</button> : null}
      {canInformation ? <button type="button" disabled={disabled} onClick={() => { setError(""); setPanel("information"); }}>Information requests{outstandingRequests ? ` (${outstandingRequests} outstanding)` : ""}</button> : null}
    </div> : null}
    {tasks.map(task => panel === `task:${task.id}` ? <RfaModal key={task.id} title={`${rfaTaskLabel(task.kind)} follow-up`} busy={Boolean(busy)} onClose={() => { setPanel(""); setError(""); }}>{error ? <p role="alert">{error}</p> : null}<FollowUpForm bare task={task} selected hasRecordedDecisions={rfa.items.some(item => item.currentResponseDocumentId === task.responseDocumentId && item.outcome !== "pending")} onReview={task.responseDocumentId && canDecide ? () => { setResponseDocument(task.responseDocumentId!); setPanel("decisions"); } : undefined} editable={act} disabled={Boolean(disabled)} onSave={input => run(`follow-up:${task.id}`, input, async key => { await client.updateFollowUp(task.id, input, key); return records.get(rfa.id); })} /></RfaModal> : null)}
  </> : null;
  const body = <>
      {rows ? null : <div className="mbtd-note">Confirmed receipt: {displayDate(rfa.receivedAt)}<br />Decision due: {rfaDecisionDueText(rfa)}{rfa.decisionDeadlineBasis ? <><br />Basis: {label(rfa.decisionDeadlineBasis)}</> : null}</div>}
      {rows ? cardRows : <>{error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}</>}
      {!rows && docs(["ur_response"]).length ? <section aria-label="Response document review"><label>Response to review<select value={responseDocument} onChange={event => setResponseDocument(event.target.value)}><option value="">Choose a response document</option>{docs(["ur_response"]).map(document => <option key={document.id} value={document.id}>{document.filename}</option>)}</select></label>{previewError ? <div><p role="alert">{previewError}</p><button type="button" onClick={() => setPreviewReload(value => value + 1)}>Retry response preview</button></div> : null}{responsePdf ? <RfaPdfReview blob={responsePdf} title="Utilization review response" /> : responseDocument && !previewError ? <p role="status">Loading response preview…</p> : null}<p>Record each treatment decision below, then complete its Post UR response review. Treatments not addressed remain pending.</p></section> : null}
      {!rows && !act ? <p>Your session can view this record. Recording receipt, decisions, or follow-ups requires authorization from your administrator.</p> : null}
      {canUpload ? block("upload", "Upload review evidence", <form onSubmit={event => {
        event.preventDefault(); if (disabled) return; const data = new FormData(event.currentTarget); const file = data.get("evidence");
        if (!(file instanceof File) || !file.size) { setError("Choose an evidence file."); return; }
        const documentType = text(data, "documentType") as "ur_response" | "imr_form" | "supporting_record" | "other";
        void run("upload", { name: file.name, size: file.size, modified: file.lastModified, documentType }, key => records.uploadDocument(rfa.id, { file, documentType, contentRevision: rfa.contentRevision }, key));
      }}><fieldset disabled={disabled}><legend>Review evidence</legend><div className="mbtd-grid"><label>Document type<select name="documentType"><option value="ur_response">Utilization review response</option><option value="imr_form">Independent medical review form</option><option value="supporting_record">Supporting clinical record</option><option value="other">Receipt proof or other evidence</option></select></label><label>Evidence file<input name="evidence" type="file" required /></label></div><button type="submit">Upload evidence</button></fieldset></form>) : null}
      {canReceive ? block("receipt", "Record confirmed receipt", <form onSubmit={event => submit(event, "receipt", data => ({ channel: text(data, "channel") as RfaReceiptInput["channel"], receivedAt: timestamp(data, "receivedAt"), ...(text(data, "proofDocumentId") ? { proofDocumentId: text(data, "proofDocumentId") } : {}), ...(text(data, "providerMessageId") ? { providerMessageId: text(data, "providerMessageId") } : {}) }), (input, key) => client.recordReceipt(rfa.id, input, key))}><fieldset disabled={disabled}><legend>Receipt evidence</legend><p>Confirm when the claims administrator received the original RFA before recording treatment decisions. A matched response does not set this time automatically.</p><p>A sent fax alone does not establish receipt. Enter the administrator's confirmed receipt time and a proof document or delivery reference.</p><div className="mbtd-grid"><label>Confirmed receipt time<input type="datetime-local" name="receivedAt" required /></label><label>Receipt channel<select name="channel">{["fax", "email", "edi", "portal", "mail", "manual"].map(value => <option key={value}>{value}</option>)}</select></label>{documentSelect("proofDocumentId", "Receipt proof", undefined, false)}<label>Delivery or provider reference<input name="providerMessageId" /></label></div><button type="submit">Save confirmed receipt</button></fieldset></form>, Boolean(selectedResponseDocumentId)) : null}
      {canDecide ? block("decisions", `Record treatment decisions (${pendingItems.length} pending)`, <>{rows ? previewError ? <div><p role="alert">{previewError}</p><button type="button" onClick={() => setPreviewReload(value => value + 1)}>Retry response preview</button></div> : responsePdf ? <RfaPdfReview blob={responsePdf} title="Utilization review response" /> : responseDocument ? <p role="status">Loading response preview…</p> : null : null}<form onSubmit={event => submit(event, "decisions", data => {
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
        return { decidedAt: timestamp(data, "decidedAt"), responseDocumentId: text(data, "responseDocumentId"), ...(text(data, "imrDocumentId") ? { imrDocumentId: text(data, "imrDocumentId") } : {}), decisions };
      }, (input, key) => client.recordDecisions(rfa.id, input, key))}><fieldset disabled={disabled}><legend>Treatment decisions</legend><p>Record only treatments addressed by this response. Unselected treatments remain pending.</p>
        {readingBusy ? <p role="status">Reading the response…</p> : read ? <p className="mbrfa-reading" role="status">These decisions were read from the response. Check each one against the document before saving{read.items.some(item => !item.confident || item.outcome === "not_addressed") ? "; the ones marked in orange need a closer look" : ""}.</p>
          : reading?.documentId === responseDocument ? <p className="mbrfa-reading" data-flag="true" role="status">This response could not be read automatically. Enter the decisions from the document.</p> : null}
        <div className="mbtd-grid"><label>Decision time<input key={`decidedAt:${read ? reading!.documentId : ""}`} type="datetime-local" name="decidedAt" required defaultValue={localDateTime(read?.decidedAt)} /></label><label>Utilization review response<select name="responseDocumentId" required value={responseDocument} onChange={event => setResponseDocument(event.target.value)}><option value="">Choose a document</option>{docs(["ur_response"]).map(document => <option key={document.id} value={document.id}>{document.filename}</option>)}</select></label>{documentSelect("imrDocumentId", "Independent medical review form", ["imr_form"], false)}</div>
        {pendingItems.map(item => { const found = readItem(item.id); const flag = read ? !found || found.outcome === "not_addressed" ? "No decision for this treatment was found in the response. It stays pending unless you choose one." : !found.confident ? "This one was hard to read. Check it carefully." : "" : ""; const k = `${item.id}:${read ? reading!.documentId : ""}`; return <fieldset key={k} {...(flag ? { "data-flag": "true" } : {})}><legend>{item.procedureCode || "Treatment"}: {item.serviceDescription}</legend>{flag ? <p className="mbrfa-reading" data-flag="true">{flag}</p> : null}<label>Decision for {item.procedureCode || item.serviceDescription}<select value={outcomes[item.id] ?? ""} onChange={event => setOutcomes(value => ({ ...value, [item.id]: event.target.value }))}><option value="">Leave pending</option><option value="approved">Approved</option><option value="modified">Modified</option><option value="denied">Denied</option></select></label>{outcomes[item.id] ? <div className="mbtd-grid">{outcomes[item.id] !== "denied" ? <><label>Authorization number<input name={`${item.id}:authorizationNumber`} defaultValue={found?.authorizationNumber ?? ""} required /></label><label>Authorized procedure code<input name={`${item.id}:authorizedProcedureCode`} defaultValue={found?.authorizedProcedureCode ?? ""} /></label><label>Authorized quantity<input name={`${item.id}:authorizedQuantity`} defaultValue={found?.authorizedQuantity ?? ""} type="number" min="0.001" max="100000" step="any" /></label><label>Authorized units<input name={`${item.id}:authorizedUnits`} defaultValue={found?.authorizedUnits ?? ""} type="number" min="1" max="100000" /></label><label>Effective from<input name={`${item.id}:effectiveFrom`} defaultValue={found?.effectiveFrom ?? ""} type="date" /></label><label>Effective through<input name={`${item.id}:effectiveTo`} defaultValue={found?.effectiveTo ?? ""} type="date" /></label></> : null}{outcomes[item.id] !== "approved" ? <><label>Decision reason<textarea name={`${item.id}:decisionReason`} required defaultValue={found?.decisionReason ?? ""} /></label><label>Reviewer name<input name={`${item.id}:reviewerName`} defaultValue={found?.reviewerName ?? ""} required /></label><label>Reviewer phone<input name={`${item.id}:reviewerPhone`} defaultValue={found?.reviewerPhone ?? ""} required /></label></> : null}</div> : null}</fieldset>; })}{read ? <label className="mbrfa-check"><input type="checkbox" checked={readingChecked} onChange={event => setReadingChecked(event.target.checked)} />I checked each decision above against the response document.</label> : null}<button type="submit">Save treatment decisions</button></fieldset></form></>, Boolean(selectedResponseDocumentId), true) : null}
      {canInformation || !rows ? block("information", `Information requests (${outstandingRequests} outstanding)`, <div style={{ display: "grid", gap: 12 }}>
        {rfa.informationRequests.map(request => <fieldset key={request.id}><legend>Requested {displayDate(request.requestedAt)}</legend><p>{request.requestText}</p>{request.dueAt ? <p>Due {displayDate(request.dueAt)}</p> : null}{request.respondedAt ? <p>Response recorded {displayDate(request.respondedAt)}</p> : act ? <form onSubmit={event => submit(event, `response:${request.id}`, data => ({ respondedAt: timestamp(data, "respondedAt"), responseDocumentIds: data.getAll("responseDocumentIds").map(String) }), (input, key) => client.recordInformationResponse(rfa.id, request.id, input, key))}><fieldset disabled={disabled}><legend>Record an already-delivered response</legend><p>This records evidence only. It does not send these documents to the administrator.</p><label>Response sent at<input type="datetime-local" name="respondedAt" required /></label><label>Response documents<select name="responseDocumentIds" multiple required>{docs().map(document => <option key={document.id} value={document.id}>{document.filename}</option>)}</select></label><label><input type="checkbox" required /> I confirm these documents were already delivered to the administrator.</label><button type="submit">Record delivered response</button></fieldset></form> : null}</fieldset>)}
        {act && decisionAllowed ? <form onSubmit={event => submit(event, "information-request", data => ({ requestedAt: timestamp(data, "requestedAt"), requestText: text(data, "requestText"), ...(text(data, "dueAt") ? { dueAt: timestamp(data, "dueAt") } : {}) }), (input, key) => client.recordInformationRequest(rfa.id, input, key))}><fieldset disabled={disabled}><legend>Record a request for information</legend><div className="mbtd-grid"><label>Requested at<input type="datetime-local" name="requestedAt" required /></label><label>Response due (optional)<input type="datetime-local" name="dueAt" /></label><label className="mbtd-wide">Requested information<textarea name="requestText" required /></label></div><button type="submit">Save information request</button></fieldset></form> : null}
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
  const content = <fieldset disabled={disabled}><legend>Follow-up details</legend><p>Due {displayDate(task.snoozedUntil ?? task.dueAt)}{task.responseFilename ? ` · ${task.responseFilename}` : ""}</p>{task.lastNote ? <p>{task.lastNote}</p> : null}{onReview ? <button type="button" onClick={onReview}>Review response document</button> : null}{editable && task.status !== "resolved" && !task.resolvedAt ? <form onSubmit={event => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const note = text(data, "note");
    if (disabled || !editable || !note || (review && !confirmed) || (review === "decisions_recorded" && !hasRecordedDecisions)) return;
    setFormError("");
    try { const input: RfaFollowUpUpdate = review ? { note, responseReview: review === "no_new_decision" ? { disposition: "no_new_decision", noNewDecisionConfirmed: true } : { disposition: "decisions_recorded", allDecisionsRecordedConfirmed: true } } : { note, outcome: text(data, "outcome") as NonNullable<RfaFollowUpUpdate["outcome"]>, snoozedUntil: timestamp(data, "snoozedUntil") };
    void onSave(input); } catch (reason) { setFormError(reason instanceof Error ? reason.message : "Review the follow-up values."); }
  }}>{formError ? <p role="alert">{formError}</p> : null}<div className="mbtd-grid">{task.responseDocumentId ? <label>Response review<select value={review} onChange={event => { setReview(event.target.value); setConfirmed(false); }}><option value="">Record follow-up contact</option><option value="no_new_decision">Confirm no new treatment decision</option><option value="decisions_recorded" disabled={!hasRecordedDecisions}>Confirm all decisions have been recorded</option></select></label> : null}{!review ? <><label>Contact outcome<select name="outcome">{["message_left", "decision_pending", "decision_issued", "not_on_file", "reviewed"].map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label><label>Next follow-up<input type="datetime-local" name="snoozedUntil" required defaultValue={localDateTime(new Date(Date.now() + 2 * 86_400_000).toISOString())} /><small>Two days from now unless you change it.</small></label></> : <label><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> {review === "no_new_decision" ? "I reviewed the response and confirm it contains no new treatment decision." : "I confirm every treatment decision in the response has been recorded."}</label>}<label className="mbtd-wide">Follow-up note<textarea name="note" maxLength={2000} required /></label></div><button type="submit">{review ? "Complete response review" : "Save follow-up"}</button></form> : null}</fieldset>;
  return bare ? content : <details open={selected}><summary>{rfaTaskLabel(task.kind)} · {rfaTaskState(task)}</summary>{content}</details>;
}
