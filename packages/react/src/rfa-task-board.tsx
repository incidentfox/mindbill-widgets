"use client";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createRfaClient, createRfaLifecycleClient, type OrganizationClientOptions, type RfaFollowUp, type RfaInboundFax, type RfaRecord } from "@mindbill/browser";
import { RfaPdfReview } from "./rfa-delivery-panel";
import { TreatmentDraftShell, type TreatmentDraftAppearance } from "./treatment-draft-shared";

export type RfaTaskBoardProps = OrganizationClientOptions & TreatmentDraftAppearance & {
  patientId?: string; claimId?: string; renderingProviderId?: string;
  permissions?: readonly ("act")[];
  /** Hide the heading when composed into a dashboard. */
  embedded?: boolean;
  onSelect: (rfaId: string, responseDocumentId?: string) => void;
};
export function rfaTaskState(task: Pick<RfaFollowUp, "status" | "resolvedAt" | "snoozedUntil" | "dueAt">, now = Date.now()): "Due" | "Scheduled" | "Completed" {
  if (task.status === "resolved" || task.resolvedAt) return "Completed";
  return Date.parse(task.snoozedUntil ?? task.dueAt) > now ? "Scheduled" : "Due";
}
// Delivery reconciliation stays server-managed, outside staff task queues.
export const isStaffRfaTask = (task: Pick<RfaFollowUp, "kind">): boolean => task.kind !== "transmission_unconfirmed";
const taskViewDescriptions: Record<string, string> = {
  Due: "Tasks that need attention now, including overdue follow-ups.",
  Scheduled: "Open tasks with a future follow-up date. This does not mean a treatment appointment is scheduled.",
  Completed: "Tasks that have been resolved. Completing a task does not necessarily close its RFA.",
};
const names: Record<string, string> = { send_rfa: "Send RFA", no_response: "Decision overdue", transmission_failed: "Submission failed", information_requested: "Respond to information request", clock_review: "Deadline needs review", schedule_treatment: "Schedule treatment", post_ur_decision: "Post UR", document_required: "Add supporting documents" };
const descriptions: Record<string, string> = {
  transmission_failed: "Delivery failed. Correct the issue before sending again.",
  no_response: "The decision deadline passed without a recorded decision.",
  clock_review: "The deadline cannot yet be calculated confidently. Review receipt and timing details.",
  post_ur_decision: "Record the treatment decisions in a received utilization review response.",
  information_requested: "Provide the additional information requested by the reviewer.",
  schedule_treatment: "Arrange treatment after approval.",
};
export const rfaTaskLabel = (kind: string): string => names[kind] ?? kind.replaceAll("_", " ");
const taskAgeColumns = [{ key: "0-5", label: "0–5 days" }, { key: "6-14", label: "6–14 days" }, { key: "15-30", label: "15–30 days" }, { key: "31+", label: "31+ days" }];
const taskGroups = [
  { title: "Incomplete RFAs", kinds: ["document_required", "send_rfa"] },
  { title: "Delivery issues", kinds: ["transmission_failed"] },
  { title: "Decision deadlines", kinds: ["no_response", "clock_review"] },
  { title: "Responses to process", kinds: ["post_ur_decision", "information_requested"] },
  { title: "Treatment scheduling", kinds: ["schedule_treatment"] },
];
/** Calendar dates in the viewer's timezone, rather than elapsed 24-hour periods. */
export function rfaTaskAgeBucket(createdAt: string, now = Date.now()): string {
  const opened = new Date(createdAt); const current = new Date(now);
  if (!Number.isFinite(opened.getTime())) return "unknown";
  const day = (value: Date) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const age = Math.max(0, Math.round((day(current) - day(opened)) / 86_400_000));
  return age <= 5 ? "0-5" : age <= 14 ? "6-14" : age <= 30 ? "15-30" : "31+";
}
const canMatchResponse = (record: RfaRecord): boolean => !["draft", "ready", "canceled"].includes(record.status) && (!["incomplete", "deferred"].includes(record.status) || Boolean(record.submittedAt));
const date = (value: string) => new Date(value).toLocaleString();
export function RfaTaskBoard({ sessionEndpoint, getSession, apiBaseUrl, fetch: fetchOverride, ...props }: RfaTaskBoardProps): ReactElement {
  const options = useMemo<OrganizationClientOptions>(() => ({ ...(sessionEndpoint ? { sessionEndpoint } : {}), ...(getSession ? { getSession } : {}), ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}) }), [sessionEndpoint, getSession, apiBaseUrl, fetchOverride]);
  const identity = useMemo(() => crypto.randomUUID(), [options]);
  return <TaskBoardContent key={`${identity}:${props.patientId ?? ""}:${props.claimId ?? ""}:${props.renderingProviderId ?? ""}`} {...props} options={options} />;
}
function TaskBoardContent({ options, patientId, claimId, renderingProviderId, permissions = [], onSelect, embedded = false, ...appearance }: Omit<RfaTaskBoardProps, keyof OrganizationClientOptions> & { options: OrganizationClientOptions }): ReactElement {
  const client = useMemo(() => createRfaLifecycleClient(options), [options]);
  const [tasks, setTasks] = useState<RfaFollowUp[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now);
  const [inboxCount, setInboxCount] = useState<string | null>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const [view, setView] = useState("Due");
  const [selection, setSelection] = useState<{ kind?: string; bucket?: string; kinds?: string[]; title?: string } | null>(null);
  const drilldown = useRef<HTMLElement>(null);
  useEffect(() => { if (selection) { drilldown.current?.scrollIntoView?.({ block: "nearest" }); drilldown.current?.focus({ preventScroll: true }); } }, [selection]);
  useEffect(() => {
    let active = true; let pending = false;
    const load = async (background = false) => {
      if (pending) return; pending = true;
      if (!background) { setLoading(true); setTasks([]); }
      try {
        const found: RfaFollowUp[] = []; const seen = new Set<string>(); let cursor: string | undefined;
        do {
          const result = await client.listFollowUps({ ...(patientId ? { patientId } : {}), ...(claimId ? { claimId } : {}), ...(renderingProviderId ? { renderingProviderId } : {}), includeResolved: true, limit: 200, ...(cursor ? { cursor } : {}) });
          found.push(...result.data); cursor = result.nextCursor ?? undefined;
          if (cursor && seen.has(cursor)) throw new Error("Task pagination could not be completed. Retrying automatically.");
          if (cursor) seen.add(cursor);
        } while (cursor && active);
        if (active) { setTasks(found.filter(isStaffRfaTask)); setError(""); setNow(Date.now()); }
      } catch { if (active) setError("Tasks could not be updated. Retrying automatically."); }
      finally { pending = false; if (active) setLoading(false); }
    };
    void load();
    const refresh = () => { if (document.visibilityState !== "hidden") void load(true); };
    const timer = setInterval(refresh, 30_000); window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [client, patientId, claimId, renderingProviderId]);
  const stateTasks = tasks.filter(task => rfaTaskState(task, now) === view);
  const filtered = stateTasks.filter(task => (!selection?.kind || task.kind === selection.kind) && (!selection?.kinds || selection.kinds.includes(task.kind)) && (!selection?.bucket || rfaTaskAgeBucket(task.createdAt, now) === selection.bucket));
  const columns = [...taskAgeColumns, ...(stateTasks.some(task => rfaTaskAgeBucket(task.createdAt, now) === "unknown") ? [{ key: "unknown", label: "Unknown age" }] : [])];
  const groups = [...taskGroups, { title: "Other follow-up", kinds: [...new Set(stateTasks.map(task => task.kind))].filter(kind => !taskGroups.some(group => group.kinds.includes(kind))) }].filter(group => group.kinds.some(kind => stateTasks.some(task => task.kind === kind)));
  const countCell = (items: RfaFollowUp[], kind?: string, bucket?: string) => items.length ? <button type="button" className="mbrfa-task-count" aria-label={`${rfaTaskLabel(kind ?? "all_tasks")}, ${bucket ? columns.find(column => column.key === bucket)?.label : "total"}: ${items.length} ${view.toLowerCase()} tasks`} onClick={() => setSelection({ ...(kind ? { kind } : {}), ...(bucket ? { bucket } : {}) })}>{items.length}</button> : <span className="mbrfa-task-zero">0</span>;
  return <TreatmentDraftShell {...appearance} hideHeading={embedded} title="RFA tasks" description="Open follow-up work, grouped by next action and age.">
    <style>{`.mbrfa-task-tabs{display:flex;gap:8px;margin:12px 0 18px;flex-wrap:wrap}.mbtd .mbrfa-task-tabs button[aria-pressed=true]{border-color:var(--mb-accent);background:var(--mb-soft);color:var(--mb-accent);font-weight:650}.mbrfa-task-group{border:1px solid var(--mb-border);border-radius:var(--mb-radius);overflow:auto;margin:14px 0;background:var(--mb-surface)}.mbrfa-task-group table{width:100%;border-collapse:collapse;min-width:620px;table-layout:fixed}.mbrfa-task-group th,.mbrfa-task-group td{padding:8px 14px;border-bottom:1px solid var(--mb-border);text-align:center}.mbrfa-task-group th:first-child,.mbrfa-task-group td:first-child{text-align:left;width:31%}.mbrfa-task-group thead th{font-size:12px;background:var(--mb-soft)}.mbrfa-task-group thead th:first-child{font-size:14px}.mbrfa-task-group th small{display:block;font-weight:400;color:var(--mb-muted)}.mbrfa-task-group tfoot{font-weight:650;background:var(--mb-soft)}.mbrfa-task-group tfoot td,.mbrfa-task-group tfoot th{border:0}.mbtd .mbrfa-task-count{border:0;background:transparent;color:var(--mb-accent);font-weight:650;min-height:28px;padding:2px 10px}.mbrfa-task-zero{color:var(--mb-muted)}.mbrfa-task-drilldown{margin:20px 0}.mbrfa-task-drilldown table{width:100%;border-collapse:collapse}.mbrfa-task-drilldown th,.mbrfa-task-drilldown td{text-align:left;border-bottom:1px solid var(--mb-border);padding:10px;vertical-align:top}.mbrfa-task-drilldown td small{display:block;color:var(--mb-muted);overflow-wrap:anywhere}.mbrfa-task-scroll{overflow:auto}.mbrfa-task-drilldown h3{margin:0}.mbrfa-inbox{border-top:1px solid var(--mb-border);padding-top:18px;margin-top:20px}.mbrfa-inbox h3{margin-top:0}.mbrfa-list{display:grid;gap:8px;margin:12px 0}.mbrfa-card{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px;border:1px solid var(--mb-border);border-radius:8px}.mbrfa-card span{display:block;margin-top:4px}.mbrfa-card p{margin:6px 0}.mbrfa-match-disclosure{margin-top:20px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);padding:14px;background:var(--mb-surface)}.mbrfa-match-disclosure>summary{cursor:pointer;font-weight:650;color:var(--mb-accent)}@media(max-width:600px){.mbrfa-card{align-items:stretch;flex-direction:column}}`}</style>
    <strong>Task status</strong>
    <div className="mbrfa-task-tabs" role="group" aria-label="Task status">{["Due", "Scheduled", "Completed"].map(state => <button key={state} type="button" aria-pressed={view === state} onClick={() => { setView(state); setSelection(null); }}>{state} ({tasks.filter(task => rfaTaskState(task, now) === state).length})</button>)}</div>
    <p className="mbtd-note">{taskViewDescriptions[view]}</p>
    {error ? <p role="alert">{error}</p> : null}{loading ? <p role="status">Loading tasks…</p> : !error && !stateTasks.length ? <p>No {view.toLowerCase()} tasks.</p> : null}
    {!loading && stateTasks.length ? <p>Calendar days since task opened. Select a count to see the tasks. Counts represent tasks, so one RFA may appear more than once.</p> : null}
    {groups.map(group => { const groupTasks = stateTasks.filter(task => group.kinds.includes(task.kind)); return <section className="mbrfa-task-group" key={group.title} aria-label={group.title}><table><thead><tr><th scope="col">{group.title}<small>By date task opened</small></th>{columns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}<th scope="col">Task total</th></tr></thead><tbody>{group.kinds.filter(kind => groupTasks.some(task => task.kind === kind)).map(kind => { const items = groupTasks.filter(task => task.kind === kind); return <tr key={kind}><th scope="row">{rfaTaskLabel(kind)}{descriptions[kind] && <small>{descriptions[kind]}</small>}</th>{columns.map(column => <td key={column.key}>{countCell(items.filter(task => rfaTaskAgeBucket(task.createdAt, now) === column.key), kind, column.key)}</td>)}<td>{countCell(items, kind)}</td></tr>; })}</tbody><tfoot><tr><th scope="row">Total</th>{[...columns, { key: "total", label: "Total" }].map(column => { const items = column.key === "total" ? groupTasks : groupTasks.filter(task => rfaTaskAgeBucket(task.createdAt, now) === column.key); return <td key={column.key}>{items.length ? <button className="mbrfa-task-count" type="button" aria-label={`${group.title}, ${column.label}: ${items.length} ${view.toLowerCase()} tasks`} onClick={() => setSelection({ kinds: group.kinds, title: group.title, ...(column.key !== "total" ? { bucket: column.key } : {}) })}>{items.length}</button> : <span className="mbrfa-task-zero">0</span>}</td>; })}</tr></tfoot></table></section>; })}
    {stateTasks.length ? <div className="mbtd-actions"><button type="button" onClick={() => setSelection({})}>View all {view.toLowerCase()} tasks ({stateTasks.length})</button></div> : null}
    {selection ? <section ref={drilldown} tabIndex={-1} className="mbrfa-task-drilldown" aria-label="Selected tasks"><div className="mbtd-actions"><h3>{selection.kind ? rfaTaskLabel(selection.kind) : selection.title ?? "All tasks"}{selection.bucket ? ` · ${columns.find(column => column.key === selection.bucket)?.label}` : ""} ({filtered.length})</h3><button type="button" onClick={() => setSelection(null)}>Close task list</button></div><div className="mbrfa-task-scroll"><table><thead><tr><th>Task / request</th><th>{view === "Completed" ? "Completed" : "Follow up"}</th><th>Assigned to</th><th>Action</th></tr></thead><tbody>{filtered.map(task => <tr key={task.id}><td><strong>{rfaTaskLabel(task.kind)}</strong><small>RFA {task.rfaId}</small>{task.responseFilename ? <small>{task.responseFilename}</small> : null}{task.lastOutcome ? <small>Last outcome: {task.lastOutcome.replaceAll("_", " ")}</small> : null}{task.lastNote ? <small>{task.lastNote}</small> : null}</td><td>{date(view === "Completed" ? task.resolvedAt ?? task.updatedAt : task.snoozedUntil ?? task.dueAt)}</td><td>{task.assigneeReference || "Unassigned"}</td><td><button type="button" onClick={() => onSelect(task.rfaId, task.responseDocumentId ?? undefined)}>{task.kind === "post_ur_decision" ? "Review response" : "Open request"}</button></td></tr>)}</tbody></table></div>{!filtered.length ? <p>No tasks match this selection.</p> : null}</section> : null}
    {!patientId && !claimId && !renderingProviderId ? <details className="mbrfa-match-disclosure"><summary>Match UR · Incoming responses{inboxCount !== null ? ` (${inboxCount})` : ""}</summary><InboundFaxInbox onCount={setInboxCount} options={options} editable={permissions.includes("act")} disabled={Boolean(appearance.disabled)} onSelect={onSelect} /></details> : <p className="mbtd-note">Open the organization-wide RFA dashboard to match incoming faxes that do not yet belong to a patient or claim.</p>}
  </TreatmentDraftShell>;
}

function InboundFaxInbox({ options, editable, disabled, onSelect, onCount }: { onCount: (count: string) => void; options: OrganizationClientOptions; editable: boolean; disabled: boolean; onSelect: RfaTaskBoardProps["onSelect"] }): ReactElement {
  const client = useMemo(() => createRfaLifecycleClient(options), [options]); const records = useMemo(() => createRfaClient(options), [options]);
  const [faxes, setFaxes] = useState<RfaInboundFax[]>([]); const [fax, setFax] = useState<RfaInboundFax | null>(null); const [pdf, setPdf] = useState<Blob | null>(null);
  const [choices, setChoices] = useState<RfaRecord[]>([]); const [selected, setSelected] = useState(""); const [search, setSearch] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [reload, setReload] = useState(0); const [nextCursor, setNextCursor] = useState<string | null>(null); const [pages, setPages] = useState<(string | undefined)[]>([undefined]); const [confirmed, setConfirmed] = useState(false);
  const keys = useRef(new Map<string, string>()); const alive = useRef(true); const pending = useRef(false); const generation = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const reviewingFax = useRef(false); reviewingFax.current = Boolean(fax);
  useEffect(() => {
    let active = true; let refreshing = false; setFax(null); setPdf(null);
    const load = async (background = false) => {
      if (refreshing || (background && (reviewingFax.current || pending.current))) return;
      refreshing = true;
      if (!background) { setLoading(true); setError(""); setFaxes([]); }
      try {
        const [result, firstPage] = await Promise.all([
          client.listInboundFaxes({ limit: 50, ...(pages.at(-1) ? { cursor: pages.at(-1)! } : {}) }),
          pages.length > 1 ? client.listInboundFaxes({ limit: 50 }) : Promise.resolve(null),
        ]);
        const countPage = firstPage ?? result;
        if (active) { setFaxes(result.data); setNextCursor(result.nextCursor); setError(""); onCount(`${countPage.data.length}${countPage.nextCursor ? "+" : ""}`); }
      } catch { if (active) setError("The response inbox could not be updated. Retrying automatically."); }
      finally { refreshing = false; if (active) setLoading(false); }
    };
    void load();
    const refresh = () => { if (document.visibilityState !== "hidden") void load(true); };
    const timer = setInterval(refresh, 30_000); window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [client, reload, pages, onCount]);
  const run = async (action: () => Promise<void>) => { if (pending.current || disabled) return; pending.current = true; setBusy(true); setError(""); try { await action(); } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "The fax action failed."); } finally { pending.current = false; if (alive.current) setBusy(false); } };
  return <section className="mbrfa-inbox" aria-label="Match UR"><h3>Response inbox · Match UR</h3><p>Review incoming response faxes, then choose the matching request. Matching adds the response document and creates a Post UR task; it does not record a treatment decision.</p>
    {error ? <p role="alert">{error}</p> : null}{loading ? <p role="status">Loading response faxes…</p> : !error && !faxes.length ? <p>No unmatched response faxes.</p> : null}
    {pages.length > 1 || nextCursor ? <div className="mbtd-actions"><button type="button" disabled={loading || busy || pages.length < 2} onClick={() => setPages(value => value.slice(0, -1))}>Previous fax page</button><span>Page {pages.length}</span><button type="button" disabled={loading || busy || !nextCursor} onClick={() => { if (nextCursor) setPages(value => [...value, nextCursor]); }}>Next fax page</button></div> : null}
    <div className="mbrfa-list">{faxes.map(item => <article className="mbrfa-card" key={item.id}><div><strong>Response fax · {date(item.receivedAt)}</strong><span>{item.fromName || item.fromFax || "Sender not identified"} · {item.pages ?? "Unknown"} pages</span></div><button type="button" disabled={busy || disabled} onClick={() => { const current = ++generation.current; setFax(item); setPdf(null); setSelected(""); setConfirmed(false); setChoices([]); setSearch(""); void run(async () => { const [blob, suggestions] = await Promise.all([client.getInboundFaxContent(item.id), Promise.all(item.suggestedRfaIds.map(id => records.get(id).catch(() => null)))]); if (alive.current && current === generation.current) { setPdf(blob); setChoices(suggestions.filter((value): value is RfaRecord => value !== null)); } }); }}>Review fax</button></article>)}</div>
    {fax ? <div style={{ display: "grid", gap: 16 }}><div className="mbtd-actions"><h4>Match response fax</h4><button type="button" disabled={busy} onClick={() => { generation.current += 1; setFax(null); setPdf(null); setReload(value => value + 1); }}>Close review</button></div>{pdf ? <RfaPdfReview blob={pdf} title="Incoming utilization review response" /> : null}
      <form onSubmit={event => { event.preventDefault(); void run(async () => { const result = await records.list({ search: search.trim(), limit: 50 }); if (alive.current) { setChoices(result.data); setSelected(""); } }); }}><label>Find patient, claim or RFA<input value={search} maxLength={200} required onChange={event => setSearch(event.target.value)} /></label><button type="submit" disabled={busy || disabled}>Find requests</button></form>
      <label>Matching request<select value={selected} disabled={busy || disabled} onChange={event => { setSelected(event.target.value); setConfirmed(false); }}><option value="">Choose after reviewing the response</option>{choices.map(record => <option key={record.id} value={record.id} disabled={!canMatchResponse(record)}>{record.employeeName} · {record.claimNumber || record.claimId} · {record.id} · {record.providerName}{!canMatchResponse(record) ? " · Not eligible for a response" : ""}</option>)}</select></label>
      {selected ? <button type="button" disabled={busy || disabled} onClick={() => onSelect(selected)}>Review selected request</button> : null}
      {editable ? <form onSubmit={event => { event.preventDefault(); if (!selected || !pdf || !confirmed || !editable || !choices.some(record => record.id === selected && canMatchResponse(record))) return; void run(async () => { const fingerprint = `${fax.id}:${selected}`; let key = keys.current.get(fingerprint); if (!key) { key = `rfa-match-${crypto.randomUUID()}`; keys.current.set(fingerprint, key); } const result = await client.matchInboundFax(fax.id, selected, key); if (alive.current) { setFax(null); setPdf(null); setReload(value => value + 1); onSelect(result.rfaId, result.documentId); } }); }}><label><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy || disabled} /> I reviewed the response and confirmed its patient, claim, and requested treatment match this request.</label><button type="submit" disabled={busy || disabled || !selected || !pdf || !confirmed}>Match response and open Post UR</button></form> : <p>Matching responses requires authorization from your administrator.</p>}
    </div> : null}
  </section>;
}
