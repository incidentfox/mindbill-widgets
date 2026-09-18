"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from "react";
import { createRfaClient, createRfaLifecycleClient, type OrganizationClientOptions, type RfaRecord, type RfaFollowUp, type RfaFollowUpUpdate, type RfaTreatmentDecisionInput, type RfaReceiptInput } from "@mindbill/browser";
import { rfaDecisionDueText } from "./rfa-decision-due";
import { RfaPdfReview } from "./rfa-delivery-panel";
import { rfaTaskLabel, rfaTaskState } from "./rfa-task-board";
import { TreatmentDraftShell, type TreatmentDraftAppearance } from "./treatment-draft-shared";

export type RfaLifecycleControlsProps = OrganizationClientOptions & TreatmentDraftAppearance & {
  rfa: RfaRecord;
  selectedResponseDocumentId?: string;
  /** Opt in only when your server grants rfas:act or rfas:edit, respectively. */
  permissions?: readonly ("act" | "edit")[];
  onUpdated?: (rfa: RfaRecord) => void;
};
const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const timestamp = (form: FormData, name: string) => {
  const value = text(form, name); const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) throw new Error("Enter a valid date and time.");
  return date.toISOString();
};
const label = (value: string) => value.replaceAll("_", " ");
const displayDate = (value: string | null) => value ? new Date(value).toLocaleString() : "Not recorded";

export function RfaLifecycleControls({ sessionEndpoint, getSession, apiBaseUrl, fetch: fetchOverride, ...props }: RfaLifecycleControlsProps): ReactElement {
  const options = useMemo<OrganizationClientOptions>(() => ({ ...(sessionEndpoint ? { sessionEndpoint } : {}), ...(getSession ? { getSession } : {}), ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}) }), [sessionEndpoint, getSession, apiBaseUrl, fetchOverride]);
  const identity = useMemo(() => crypto.randomUUID(), [options]);
  return <LifecycleContent key={`${identity}:${props.rfa.id}`} {...props} options={options} />;
}
function LifecycleContent({ rfa: providedRfa, options, permissions = [], onUpdated, selectedResponseDocumentId, ...appearance }: Omit<RfaLifecycleControlsProps, keyof OrganizationClientOptions> & { options: OrganizationClientOptions }): ReactElement {
  const [rfa, setRfa] = useState(providedRfa);
  useEffect(() => { setRfa(providedRfa); }, [providedRfa]);
  const client = useMemo(() => createRfaLifecycleClient(options), [options]);
  const records = useMemo(() => createRfaClient(options), [options]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0); const [tasks, setTasks] = useState<RfaFollowUp[]>([]); const [taskError, setTaskError] = useState(""); const [loading, setLoading] = useState(true);
  const [responseDocument, setResponseDocument] = useState(selectedResponseDocumentId ?? "");
  const [responsePdf, setResponsePdf] = useState<Blob | null>(null);
  const [previewError, setPreviewError] = useState(""); const [previewReload, setPreviewReload] = useState(0);
  useEffect(() => {
    let active = true; setResponsePdf(null); setPreviewError("");
    if (responseDocument && rfa.documents.some(document => document.id === responseDocument && document.documentType === "ur_response")) {
      records.getDocument(rfa.id, responseDocument).then(blob => { if (active) setResponsePdf(blob); }).catch(() => { if (active) setPreviewError("The response preview could not be loaded. Retry to review the document."); });
    }
    return () => { active = false; };
  }, [records, rfa.id, responseDocument, rfa.documents, previewReload]);
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const alive = useRef(true); const pending = useRef(false); const keys = useRef(new Map<string, string>());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let active = true; setLoading(true); setTaskError(""); setTasks([]);
    // Follow-ups are paginated by claim. Read every page so another request's tasks cannot hide this one's.
    (async () => {
      const found: RfaFollowUp[] = []; const seen = new Set<string>(); let cursor: string | undefined;
      do {
        const page = await client.listFollowUps({ claimId: rfa.claimId, includeResolved: true, limit: 200, ...(cursor ? { cursor } : {}) });
        found.push(...page.data.filter(task => task.rfaId === rfa.id));
        cursor = page.nextCursor ?? undefined;
        if (cursor && seen.has(cursor)) throw new Error("Follow-up pagination could not be completed. Refresh to try again.");
        if (cursor) seen.add(cursor);
      } while (cursor && active);
      if (active) setTasks(found);
    })().catch(reason => { if (active) setTaskError(reason instanceof Error ? reason.message : "Follow-ups could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, rfa.claimId, rfa.id, rfa.updatedAt, reload]);
  const act = permissions.includes("act"); const edit = permissions.includes("edit"); const disabled = busy || appearance.disabled;
  const run = async (operation: string, input: unknown, action: (key: string) => Promise<RfaRecord | void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    const fingerprint = JSON.stringify([operation, input]); let key = keys.current.get(fingerprint);
    if (!key) { key = `rfa-lifecycle-${crypto.randomUUID()}`; keys.current.set(fingerprint, key); }
    try {
      const updated = await action(key);
      if (alive.current) { if (updated) { setRfa(updated); onUpdated?.(updated); } setReload(value => value + 1); setMessage("Record saved."); }
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
  return <TreatmentDraftShell {...appearance} title="Receipt and utilization review" description="Record evidence received from the claims administrator and track each requested treatment. Dates and deadlines come from MindBill.">
    <div style={{ display: "grid", gap: 16 }}>
      <div className="mbtd-note">Confirmed receipt: {displayDate(rfa.receivedAt)}<br />Decision due: {rfaDecisionDueText(rfa)}{rfa.decisionDeadlineBasis ? <><br />Basis: {label(rfa.decisionDeadlineBasis)}</> : null}</div>
      {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
      {docs(["ur_response"]).length ? <section aria-label="Response document review"><label>Response to review<select value={responseDocument} onChange={event => setResponseDocument(event.target.value)}><option value="">Choose a response document</option>{docs(["ur_response"]).map(document => <option key={document.id} value={document.id}>{document.filename}</option>)}</select></label>{previewError ? <div><p role="alert">{previewError}</p><button type="button" onClick={() => setPreviewReload(value => value + 1)}>Retry response preview</button></div> : null}{responsePdf ? <RfaPdfReview blob={responsePdf} title="Utilization review response" /> : responseDocument && !previewError ? <p role="status">Loading response preview…</p> : null}<p>Record each treatment decision below, then complete its Post UR response review. Treatments not addressed remain pending.</p></section> : null}
      {!act ? <p>Your session can view this record. Recording receipt, decisions, or follow-ups requires authorization from your administrator.</p> : null}
      {edit ? <details><summary>Upload review evidence</summary><form onSubmit={event => {
        event.preventDefault(); if (disabled) return; const data = new FormData(event.currentTarget); const file = data.get("evidence");
        if (!(file instanceof File) || !file.size) { setError("Choose an evidence file."); return; }
        const documentType = text(data, "documentType") as "ur_response" | "imr_form" | "supporting_record" | "other";
        void run("upload", { name: file.name, size: file.size, modified: file.lastModified, documentType }, key => records.uploadDocument(rfa.id, { file, documentType, contentRevision: rfa.contentRevision }, key));
      }}><fieldset disabled={disabled}><legend>Review evidence</legend><div className="mbtd-grid"><label>Document type<select name="documentType"><option value="ur_response">Utilization review response</option><option value="imr_form">Independent medical review form</option><option value="supporting_record">Supporting clinical record</option><option value="other">Receipt proof or other evidence</option></select></label><label>Evidence file<input name="evidence" type="file" required /></label></div><button type="submit">Upload evidence</button></fieldset></form></details> : null}
      {act && !rfa.receivedAt && !["draft", "ready", "canceled", "closed"].includes(rfa.status) ? <details open={Boolean(selectedResponseDocumentId)}><summary>Record confirmed receipt</summary><form onSubmit={event => submit(event, "receipt", data => ({ channel: text(data, "channel") as RfaReceiptInput["channel"], receivedAt: timestamp(data, "receivedAt"), ...(text(data, "proofDocumentId") ? { proofDocumentId: text(data, "proofDocumentId") } : {}), ...(text(data, "providerMessageId") ? { providerMessageId: text(data, "providerMessageId") } : {}) }), (input, key) => client.recordReceipt(rfa.id, input, key))}><fieldset disabled={disabled}><legend>Receipt evidence</legend><p>Confirm when the claims administrator received the original RFA before recording treatment decisions. A matched response does not set this time automatically.</p><p>A sent fax alone does not establish receipt. Enter the administrator's confirmed receipt time and a proof document or delivery reference.</p><div className="mbtd-grid"><label>Confirmed receipt time<input type="datetime-local" name="receivedAt" required /></label><label>Receipt channel<select name="channel">{["fax", "email", "edi", "portal", "mail", "manual"].map(value => <option key={value}>{value}</option>)}</select></label>{documentSelect("proofDocumentId", "Receipt proof", undefined, false)}<label>Delivery or provider reference<input name="providerMessageId" /></label></div><button type="submit">Save confirmed receipt</button></fieldset></form></details> : null}
      {act && decisionAllowed && pendingItems.length ? <details open={Boolean(selectedResponseDocumentId)}><summary>Record treatment decisions ({pendingItems.length} pending)</summary><form onSubmit={event => submit(event, "decisions", data => {
        const decisions: RfaTreatmentDecisionInput[] = pendingItems.filter(item => outcomes[item.id]).map(item => {
          const prefix = `${item.id}:`; const outcome = outcomes[item.id] as RfaTreatmentDecisionInput["outcome"];
          const decision: RfaTreatmentDecisionInput = { itemId: item.id, outcome };
          for (const field of ["authorizationNumber", "authorizedProcedureCode", "effectiveFrom", "effectiveTo", "decisionReason", "reviewerName", "reviewerPhone"] as const) if (text(data, prefix + field)) decision[field] = text(data, prefix + field);
          for (const field of ["authorizedQuantity", "authorizedUnits"] as const) if (text(data, prefix + field)) decision[field] = Number(text(data, prefix + field));
          return decision;
        });
        if (!decisions.length) throw new Error("Choose at least one treatment decision. Other treatments remain pending.");
        if (decisions.some(item => item.outcome !== "approved") && !text(data, "imrDocumentId")) throw new Error("An independent medical review form is required for modified or denied treatment.");
        return { decidedAt: timestamp(data, "decidedAt"), responseDocumentId: text(data, "responseDocumentId"), ...(text(data, "imrDocumentId") ? { imrDocumentId: text(data, "imrDocumentId") } : {}), decisions };
      }, (input, key) => client.recordDecisions(rfa.id, input, key))}><fieldset disabled={disabled}><legend>Treatment decisions</legend><p>Record only treatments addressed by this response. Unselected treatments remain pending.</p><div className="mbtd-grid"><label>Decision time<input type="datetime-local" name="decidedAt" required /></label><label>Utilization review response<select name="responseDocumentId" required value={responseDocument} onChange={event => setResponseDocument(event.target.value)}><option value="">Choose a document</option>{docs(["ur_response"]).map(document => <option key={document.id} value={document.id}>{document.filename}</option>)}</select></label>{documentSelect("imrDocumentId", "Independent medical review form", ["imr_form"], false)}</div>
        {pendingItems.map(item => <fieldset key={item.id}><legend>{item.procedureCode || "Treatment"}: {item.serviceDescription}</legend><label>Decision for {item.procedureCode || item.serviceDescription}<select value={outcomes[item.id] ?? ""} onChange={event => setOutcomes(value => ({ ...value, [item.id]: event.target.value }))}><option value="">Leave pending</option><option value="approved">Approved</option><option value="modified">Modified</option><option value="denied">Denied</option></select></label>{outcomes[item.id] ? <div className="mbtd-grid">{outcomes[item.id] !== "denied" ? <><label>Authorization number<input name={`${item.id}:authorizationNumber`} required /></label><label>Authorized procedure code<input name={`${item.id}:authorizedProcedureCode`} /></label><label>Authorized quantity<input name={`${item.id}:authorizedQuantity`} type="number" min="0.001" max="100000" step="any" /></label><label>Authorized units<input name={`${item.id}:authorizedUnits`} type="number" min="1" max="100000" /></label><label>Effective from<input name={`${item.id}:effectiveFrom`} type="date" /></label><label>Effective through<input name={`${item.id}:effectiveTo`} type="date" /></label></> : null}{outcomes[item.id] !== "approved" ? <><label>Decision reason<textarea name={`${item.id}:decisionReason`} required /></label><label>Reviewer name<input name={`${item.id}:reviewerName`} required /></label><label>Reviewer phone<input name={`${item.id}:reviewerPhone`} required /></label></> : null}</div> : null}</fieldset>)}<button type="submit">Save treatment decisions</button></fieldset></form></details> : null}
      <details><summary>Information requests ({rfa.informationRequests.filter(request => !request.respondedAt).length} outstanding)</summary><div style={{ display: "grid", gap: 12 }}>
        {rfa.informationRequests.map(request => <fieldset key={request.id}><legend>Requested {displayDate(request.requestedAt)}</legend><p>{request.requestText}</p>{request.dueAt ? <p>Due {displayDate(request.dueAt)}</p> : null}{request.respondedAt ? <p>Response recorded {displayDate(request.respondedAt)}</p> : act ? <form onSubmit={event => submit(event, `response:${request.id}`, data => ({ respondedAt: timestamp(data, "respondedAt"), responseDocumentIds: data.getAll("responseDocumentIds").map(String) }), (input, key) => client.recordInformationResponse(rfa.id, request.id, input, key))}><fieldset disabled={disabled}><legend>Record an already-delivered response</legend><p>This records evidence only. It does not send these documents to the administrator.</p><label>Response sent at<input type="datetime-local" name="respondedAt" required /></label><label>Response documents<select name="responseDocumentIds" multiple required>{docs().map(document => <option key={document.id} value={document.id}>{document.filename}</option>)}</select></label><label><input type="checkbox" required /> I confirm these documents were already delivered to the administrator.</label><button type="submit">Record delivered response</button></fieldset></form> : null}</fieldset>)}
        {act && decisionAllowed ? <form onSubmit={event => submit(event, "information-request", data => ({ requestedAt: timestamp(data, "requestedAt"), requestText: text(data, "requestText"), ...(text(data, "dueAt") ? { dueAt: timestamp(data, "dueAt") } : {}) }), (input, key) => client.recordInformationRequest(rfa.id, input, key))}><fieldset disabled={disabled}><legend>Record a request for information</legend><div className="mbtd-grid"><label>Requested at<input type="datetime-local" name="requestedAt" required /></label><label>Response due (optional)<input type="datetime-local" name="dueAt" /></label><label className="mbtd-wide">Requested information<textarea name="requestText" required /></label></div><button type="submit">Save information request</button></fieldset></form> : null}
      </div></details>
      <details open><summary>Follow-up tasks</summary>{taskError ? <p role="alert">{taskError}</p> : null}{loading ? <p role="status">Loading follow-ups…</p> : tasks.length ? tasks.map(task => <FollowUpForm key={`${task.id}:${task.updatedAt}`} task={task} hasRecordedDecisions={rfa.items.some(item => item.currentResponseDocumentId === task.responseDocumentId && item.outcome !== "pending")} onReview={task.responseDocumentId ? () => setResponseDocument(task.responseDocumentId!) : undefined} editable={act} disabled={Boolean(disabled)} onSave={input => run(`follow-up:${task.id}`, input, async key => { await client.updateFollowUp(task.id, input, key); return records.get(rfa.id); })} />) : !taskError ? <p>No follow-up tasks are recorded for this request.</p> : null}<button type="button" disabled={loading || disabled} onClick={() => setReload(value => value + 1)}>Refresh follow-ups</button></details>
      <p className="mbtd-note">Exceptional decision clocks require the explicit <a href="https://docs.mindbill.org/guides/rfas" target="_blank" rel="noopener noreferrer">RFA API review workflows</a>. Existing evidence remains in the request history.</p>
    </div>
  </TreatmentDraftShell>;
}
function FollowUpForm({ task, editable, disabled, onSave, onReview, hasRecordedDecisions }: { onReview: (() => void) | undefined; hasRecordedDecisions: boolean; task: RfaFollowUp; editable: boolean; disabled: boolean; onSave: (input: RfaFollowUpUpdate) => Promise<void> }): ReactElement {
  const [review, setReview] = useState(""); const [confirmed, setConfirmed] = useState(false); const [formError, setFormError] = useState("");
  return <fieldset disabled={disabled}><legend>{rfaTaskLabel(task.kind)} · {rfaTaskState(task)}</legend><p>Due {displayDate(task.snoozedUntil ?? task.dueAt)}{task.responseFilename ? ` · ${task.responseFilename}` : ""}</p>{task.lastNote ? <p>{task.lastNote}</p> : null}{onReview ? <button type="button" onClick={onReview}>Review response document</button> : null}{editable && task.status !== "resolved" && !task.resolvedAt ? <form onSubmit={event => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const note = text(data, "note");
    if (disabled || !editable || !note || (review && !confirmed) || (review === "decisions_recorded" && !hasRecordedDecisions)) return;
    setFormError("");
    try { const input: RfaFollowUpUpdate = review ? { note, responseReview: review === "no_new_decision" ? { disposition: "no_new_decision", noNewDecisionConfirmed: true } : { disposition: "decisions_recorded", allDecisionsRecordedConfirmed: true } } : { note, outcome: text(data, "outcome") as NonNullable<RfaFollowUpUpdate["outcome"]>, snoozedUntil: timestamp(data, "snoozedUntil") };
    void onSave(input); } catch (reason) { setFormError(reason instanceof Error ? reason.message : "Review the follow-up values."); }
  }}>{formError ? <p role="alert">{formError}</p> : null}<div className="mbtd-grid">{task.responseDocumentId ? <label>Response review<select value={review} onChange={event => { setReview(event.target.value); setConfirmed(false); }}><option value="">Record follow-up contact</option><option value="no_new_decision">Confirm no new treatment decision</option><option value="decisions_recorded" disabled={!hasRecordedDecisions}>Confirm all decisions have been recorded</option></select></label> : null}{!review ? <><label>Contact outcome<select name="outcome">{["message_left", "decision_pending", "decision_issued", "not_on_file", "reviewed"].map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label><label>Next follow-up<input type="datetime-local" name="snoozedUntil" required /></label></> : <label><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> {review === "no_new_decision" ? "I reviewed the response and confirm it contains no new treatment decision." : "I confirm every treatment decision in the response has been recorded."}</label>}<label className="mbtd-wide">Follow-up note<textarea name="note" maxLength={2000} required /></label></div><button type="submit">{review ? "Complete response review" : "Save follow-up"}</button></form> : null}</fieldset>;
}
