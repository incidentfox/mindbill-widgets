"use client";
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createRfaClient, createRfaLifecycleClient, getRfaLifecycleStatus, type OrganizationClientOptions, type RfaFollowUp, type RfaInboundFax, type RfaRecord } from "@mindbill/browser";
import { RfaPdfReview } from "./rfa-delivery-panel";
import { RfaPill, rfaStatusLabel } from "./rfa-detail-cards";
import { rfaDecisionDueText } from "./rfa-decision-due";
import { RfaLink, rfaTitle, type RfaRelatedLinks, type RfaSelectionContext } from "./rfa-display";
import { TreatmentDraftShell, type TreatmentDraftAppearance } from "./treatment-draft-shared";

export type RfaTaskState = "Due" | "Scheduled" | "Completed";
export type RfaTaskAge = "0-5" | "6-14" | "15-30" | "31+" | "unknown";
/** Staff task filters, independent from RFA lifecycle/clinical status. */
export type RfaTaskQuery = {
  state?: RfaTaskState;
  kind?: string;
  kinds?: readonly string[];
  bucket?: RfaTaskAge;
  title?: string;
};
export type RfaTaskBoardProps = OrganizationClientOptions & TreatmentDraftAppearance & RfaRelatedLinks & {
  /** Real routes for request rows in the task list; without them rows open through onSelect. */
  getRfaHref?: (id: string, context?: RfaSelectionContext) => string;
  patientId?: string; claimId?: string; renderingProviderId?: string;
  permissions?: readonly ("act")[];
  /** Hide the heading when composed into a dashboard. */
  embedded?: boolean;
  /** Separate list view uses query filters and omits dashboard matrices and unmatched inbox. */
  presentation?: "dashboard" | "list";
  query?: RfaTaskQuery;
  /** Return a real host route for a task selection. Omitted routes keep inline drilldown. */
  getTaskHref?: (query: RfaTaskQuery) => string;
  /** Optional client router. Modified link clicks retain normal browser behavior. */
  onNavigate?: (href: string) => void;
  /** Optional host rendering for the request/patient/claim identity on each task. */
  renderTaskIdentity?: (task: RfaFollowUp) => ReactNode;
  onSelect: (rfaId: string, responseDocumentId?: string) => void;
  /** Identifies the signed-in organization. When set, the last loaded tasks show instantly on return while they refresh. */
  cacheKey?: string;
};
export function rfaTaskState(task: Pick<RfaFollowUp, "status" | "resolvedAt" | "snoozedUntil" | "dueAt">, now = Date.now()): "Due" | "Scheduled" | "Completed" {
  if (task.status === "resolved" || task.resolvedAt) return "Completed";
  return Date.parse(task.snoozedUntil ?? task.dueAt) > now ? "Scheduled" : "Due";
}
// Delivery reconciliation stays server-managed, outside staff task queues.
export const isStaffRfaTask = (task: Pick<RfaFollowUp, "kind">): boolean => task.kind !== "transmission_unconfirmed";
// Tabs read as what to do with a task; the query values stay Due/Scheduled/Completed for existing links.
const taskViewLabels: Record<RfaTaskState, string> = { Due: "To do", Scheduled: "Follow up later", Completed: "Done" };
const taskViewDescriptions: Record<string, string> = {
  Due: "Columns count days since each task opened. Select a number to see those tasks.",
  Scheduled: "Tasks set aside until a later follow-up date.",
  Completed: "Finished tasks. Finishing a task does not close its RFA.",
};
const names: Record<string, string> = { send_rfa: "Send RFA", no_response: "Decision overdue", transmission_failed: "Submission failed", information_requested: "Respond to information request", clock_review: "Deadline needs review", schedule_treatment: "Schedule treatment", post_ur_decision: "Post UR", post_ur_approved: "Approved — confirm and bill", post_ur_denied: "Denied or modified — review", document_required: "Add supporting documents" };
const descriptions: Record<string, string> = {
  transmission_failed: "Delivery failed. Correct the issue before sending again.",
  no_response: "The decision deadline passed without a recorded decision.",
  clock_review: "The deadline cannot yet be calculated confidently. Review receipt and timing details.",
  post_ur_decision: "A response arrived and its decisions are not recorded yet. Check what was read from it and save.",
  post_ur_approved: "Every treatment in this response was approved. Confirm the review, then bill the authorized care.",
  post_ur_denied: "This response denied or modified treatment. Confirm the review and decide on an appeal or independent medical review.",
  information_requested: "Provide the additional information requested by the reviewer.",
  schedule_treatment: "Arrange treatment after approval.",
};
/** A response-review task is listed by what its response decided, once those decisions are recorded. */
export function rfaTaskByResponseOutcome(task: RfaFollowUp): RfaFollowUp {
  const outcome = (task as RfaFollowUp & { responseOutcome?: string | null }).responseOutcome;
  if (task.kind !== "post_ur_decision" || !outcome) return task;
  return { ...task, kind: outcome === "approved" ? "post_ur_approved" : "post_ur_denied" };
}
export const rfaTaskLabel = (kind: string): string => names[kind] ?? kind.replaceAll("_", " ");
const taskAgeColumns: { key: RfaTaskAge; label: string }[] = [{ key: "0-5", label: "0–5 days" }, { key: "6-14", label: "6–14 days" }, { key: "15-30", label: "15–30 days" }, { key: "31+", label: "31+ days" }];
// Grouped by where the RFA stands, in daisyBill's status words, rather than by kind of work.
const taskGroups = [
  { title: "Incomplete", kinds: ["document_required", "send_rfa"] },
  { title: "Failed", kinds: ["transmission_failed"] },
  { title: "Sent · Decision overdue", kinds: ["no_response", "clock_review"] },
  { title: "Response received", kinds: ["post_ur_decision", "post_ur_approved", "post_ur_denied", "information_requested"] },
  { title: "Approved", kinds: ["schedule_treatment"] },
];
/** Last loaded tasks per board, so returning to the dashboard shows them at once while they refresh. */
const taskCache = new Map<string, RfaFollowUp[]>();
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
function TaskBoardContent({ options, patientId, claimId, renderingProviderId, permissions = [], onSelect, embedded = false, presentation = "dashboard", query, getTaskHref, onNavigate, renderTaskIdentity, cacheKey, getRfaHref, getPatientHref, getClaimHref, getProviderHref, ...appearance }: Omit<RfaTaskBoardProps, keyof OrganizationClientOptions> & { options: OrganizationClientOptions }): ReactElement {
  const client = useMemo(() => createRfaLifecycleClient(options), [options]);
  const requests = useMemo(() => createRfaClient(options), [options]);
  const [requestIdentities, setRequestIdentities] = useState<Record<string, RfaRecord>>({});
  const cacheId = cacheKey ? JSON.stringify([cacheKey, patientId ?? null, claimId ?? null, renderingProviderId ?? null]) : "";
  const cached = cacheId ? taskCache.get(cacheId) : undefined;
  const [tasks, setTasks] = useState<RfaFollowUp[]>(cached ?? []); const [error, setError] = useState(""); const [loading, setLoading] = useState(!cached);
  const [completedLoaded, setCompletedLoaded] = useState(Boolean(cached));
  const [now, setNow] = useState(Date.now);
  const [inboxCount, setInboxCount] = useState<string | null>(null); const [inboxOpen, setInboxOpen] = useState(false);
  const orgWide = !patientId && !claimId && !renderingProviderId;
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const [view, setView] = useState<RfaTaskState>(query?.state ?? "Due");
  const [selection, setSelection] = useState<RfaTaskQuery | null>(null);
  const list = presentation === "list";
  useEffect(() => { setView(query?.state ?? "Due"); setSelection(null); }, [query]);
  const activeSelection = list ? query ?? {} : selection;
  const drilldown = useRef<HTMLElement>(null);
  useEffect(() => { if (selection) { drilldown.current?.scrollIntoView?.({ block: "nearest" }); drilldown.current?.focus({ preventScroll: true }); } }, [selection]);
  useEffect(() => {
    let active = true; let pending = false;
    const all = async (includeResolved: boolean) => {
      const found: RfaFollowUp[] = []; const seen = new Set<string>(); let cursor: string | undefined;
      do {
        const result = await client.listFollowUps({ ...(patientId ? { patientId } : {}), ...(claimId ? { claimId } : {}), ...(renderingProviderId ? { renderingProviderId } : {}), includeResolved, limit: 200, ...(cursor ? { cursor } : {}) });
        found.push(...result.data.map(rfaTaskByResponseOutcome)); cursor = result.nextCursor ?? undefined;
        if (cursor && seen.has(cursor)) throw new Error("Task pagination could not be completed. Retrying automatically.");
        if (cursor) seen.add(cursor);
      } while (cursor && active);
      return found.filter(isStaffRfaTask);
    };
    const load = async (background = false) => {
      if (pending) return; pending = true;
      if (!background) setLoading(true);
      try {
        // Open tasks lead; resolved tasks remain available through existing history links.
        const resolved = all(true);
        // Its failure is reported when it is awaited below, even if the open tasks fail first.
        resolved.catch(() => undefined);
        if (!background) {
          const open = await all(false);
          if (active) { setTasks(current => [...open, ...current.filter(task => rfaTaskState(task) === "Completed")]); setLoading(false); setError(""); setNow(Date.now()); }
        }
        const found = await resolved;
        if (active) { setTasks(found); setCompletedLoaded(true); setError(""); setNow(Date.now()); if (cacheId) taskCache.set(cacheId, found); }
      } catch { if (active) setError("Tasks could not be updated. Retrying automatically."); }
      finally { pending = false; if (active) setLoading(false); }
    };
    void load(Boolean(cached));
    const refresh = () => { if (document.visibilityState !== "hidden") void load(true); };
    const timer = setInterval(refresh, 30_000); window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
    // The cache is only read when the board mounts.
  }, [client, patientId, claimId, renderingProviderId, cacheId]);
  const stateTasks = tasks.filter(task => rfaTaskState(task, now) === view);
  const filtered = stateTasks.filter(task => (!activeSelection?.kind || task.kind === activeSelection.kind) && (!activeSelection?.kinds || activeSelection.kinds.includes(task.kind)) && (!activeSelection?.bucket || rfaTaskAgeBucket(task.createdAt, now) === activeSelection.bucket));
  // Only read requests visible in this opt-in list, using the existing scoped session.
  const visibleRequests = JSON.stringify(list && !renderTaskIdentity ? [...new Map(filtered.map(task => [task.rfaId, task.claimId])).entries()].sort(([a], [b]) => a.localeCompare(b)) : []);
  useEffect(() => {
    let active = true;
    setRequestIdentities({});
    const load = async () => {
      const entries = JSON.parse(visibleRequests) as [string, string][];
      const found: Record<string, RfaRecord> = {};
      for (let offset = 0; offset < entries.length && active; offset += 10) {
        await Promise.all(entries.slice(offset, offset + 10).map(async ([id, taskClaimId]) => {
          try {
            const record = await requests.get(id);
            if (record.id === id && record.claimId === taskClaimId && (!patientId || record.patientId === patientId) && (!claimId || record.claimId === claimId) && (!renderingProviderId || record.renderingProviderId === renderingProviderId)) found[id] = record;
          } catch { /* Task actions remain available if a request identity cannot be loaded. */ }
        }));
      }
      if (active) setRequestIdentities(found);
    };
    void load();
    return () => { active = false; };
  }, [visibleRequests, requests, patientId, claimId, renderingProviderId]);
  const taskIdentity = (task: RfaFollowUp) => {
    if (renderTaskIdentity) return renderTaskIdentity(task);
    if (!list) return null;
    const record = requestIdentities[task.rfaId];
    return record ? <div className="mbrfa-task-identity"><span>{record.employeeName}</span><small>Claim {record.claimNumber || record.claimId}{record.displayReference ? ` · ${record.displayReference}` : ""}</small><small>{record.items?.map(item => item.serviceDescription).filter(Boolean).join("; ") || "Request for authorization"}</small></div> : <small>Request {task.rfaId} · Claim {task.claimId}</small>;
  };
  const columns = [...taskAgeColumns, ...(stateTasks.some(task => rfaTaskAgeBucket(task.createdAt, now) === "unknown") ? [{ key: "unknown" as const, label: "Unknown age" }] : [])];
  const groups = [...taskGroups, { title: "Other follow-up", kinds: [...new Set(stateTasks.map(task => task.kind))].filter(kind => !taskGroups.some(group => group.kinds.includes(kind))) }].filter(group => group.kinds.some(kind => stateTasks.some(task => task.kind === kind)));
  const selectedTitle = activeSelection?.kind ? rfaTaskLabel(activeSelection.kind) : activeSelection?.title ?? (activeSelection?.kinds ? taskGroups.find(group => group.kinds.length === activeSelection.kinds!.length && group.kinds.every(kind => activeSelection.kinds!.includes(kind)))?.title ?? activeSelection.kinds.map(rfaTaskLabel).join(", ") : "All tasks");
  const selectionControl = (next: RfaTaskQuery, text: ReactNode, ariaLabel?: string) => {
    const target = { ...next, state: view };
    const matches = stateTasks.filter(task => (!next.kind || task.kind === next.kind) && (!next.kinds || next.kinds.includes(task.kind)) && (!next.bucket || rfaTaskAgeBucket(task.createdAt, now) === next.bucket));
    const single = matches.length === 1 ? matches[0] : undefined;
    const directHref = single && getRfaHref?.(single.rfaId, single.responseDocumentId ? { responseDocumentId: single.responseDocumentId } : undefined);
    if (single && !directHref) return <button type="button" className={ariaLabel ? "mbrfa-task-count" : undefined} {...(ariaLabel ? { "aria-label": ariaLabel } : {})} onClick={() => onSelect(single.rfaId, single.responseDocumentId ?? undefined)}>{text}</button>;
    if (!directHref && !getTaskHref) return <button type="button" className={ariaLabel ? "mbrfa-task-count" : undefined} {...(ariaLabel ? { "aria-label": ariaLabel } : {})} onClick={() => setSelection(next)}>{text}</button>;
    const href = directHref || getTaskHref!(target);
    return <a href={href} className={ariaLabel ? "mbrfa-task-count" : "mbrfa-route-link"} {...(ariaLabel ? { "aria-label": ariaLabel } : {})} onClick={event => {
      if (!onNavigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); onNavigate(href);
    }}>{text}</a>;
  };
  const countCell = (items: RfaFollowUp[], kind?: string, bucket?: RfaTaskAge) => items.length ? selectionControl({ ...(kind ? { kind } : {}), ...(bucket ? { bucket } : {}) }, items.length, `${rfaTaskLabel(kind ?? "all_tasks")}, ${bucket ? columns.find(column => column.key === bucket)?.label : "total"}: ${items.length} ${view.toLowerCase()} tasks`) : <span className="mbrfa-task-zero">0</span>;
  return <TreatmentDraftShell {...appearance} hideHeading={embedded} title={list ? "RFA task list" : "RFA tasks"} description={list ? "Follow-up tasks matching the selected status, action and age." : "Open follow-up work, grouped by next action and age."}>
    <style>{`.mbrfa-task-tabs{display:flex;gap:8px;margin:4px 0 8px;flex-wrap:wrap}.mbtd .mbrfa-task-note{color:var(--mb-muted);font-size:13px;margin:0 0 6px}.mbrfa-task-list h3{font-size:16px;margin:14px 0 10px}.mbrfa-task-list table{width:100%;border-collapse:collapse;background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-radius)}.mbrfa-task-list th{text-align:left;font-size:12px;font-weight:600;color:var(--mb-muted);padding:10px 12px;border-bottom:1px solid var(--mb-border);white-space:nowrap}.mbrfa-task-list td{padding:12px;border-bottom:1px solid var(--mb-border);vertical-align:top;font-size:14px}.mbrfa-task-list tr:last-child td{border-bottom:0}.mbrfa-task-list td small{display:block;color:var(--mb-muted);font-size:12px;margin-top:2px}.mbrfa-task-row{cursor:pointer}.mbrfa-task-row:hover td{background:var(--mb-soft)}.mbrfa-task-treatment{max-width:280px}.mbrfa-ur-inbox{border:1px solid var(--mb-accent);border-left-width:4px;border-radius:var(--mb-radius);background:var(--mb-soft);padding:14px 16px;margin:0 0 18px}.mbrfa-ur-inbox[hidden]{display:none}.mbrfa-ur-inbox-head{display:flex;justify-content:space-between;align-items:center;gap:16px}.mbrfa-ur-inbox-head strong{display:block;color:var(--mb-text);font-size:15px}.mbrfa-ur-inbox-head span{display:block;color:var(--mb-muted);font-size:13px;margin-top:2px}.mbtd .mbrfa-ur-inbox-head button{flex-shrink:0;background:var(--mb-accent);color:var(--mb-accent-contrast);border-color:var(--mb-accent)}.mbrfa-ur-inbox .mbrfa-inbox{margin-top:12px}@media(max-width:640px){.mbrfa-ur-inbox-head{align-items:flex-start;flex-direction:column}}.mbtd .mbrfa-task-tabs button[aria-pressed=true]{border-color:var(--mb-accent);background:var(--mb-soft);color:var(--mb-accent);font-weight:650}.mbrfa-task-group{border:1px solid var(--mb-border);border-radius:var(--mb-radius);overflow:auto;margin:14px 0;background:var(--mb-surface)}.mbrfa-task-group table{width:100%;border-collapse:collapse;min-width:620px;table-layout:fixed}.mbrfa-task-group th,.mbrfa-task-group td{padding:8px 14px;border-bottom:1px solid var(--mb-border);text-align:center}.mbrfa-task-group th:first-child,.mbrfa-task-group td:first-child{text-align:left;width:31%}.mbrfa-task-group thead th{font-size:12px;background:var(--mb-soft)}.mbrfa-task-group thead th:first-child{font-size:14px}.mbrfa-task-group th small{display:block;font-weight:400;color:var(--mb-muted)}.mbrfa-task-group tfoot{font-weight:650;background:var(--mb-soft)}.mbrfa-task-group tfoot td,.mbrfa-task-group tfoot th{border:0}.mbtd .mbrfa-task-count{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border:0;background:transparent;color:var(--mb-accent);font-weight:650;min-height:28px;padding:2px 10px}.mbrfa-task-zero{color:var(--mb-muted)}.mbrfa-task-drilldown{margin:20px 0}.mbrfa-task-drilldown table{width:100%;border-collapse:collapse}.mbrfa-task-drilldown th,.mbrfa-task-drilldown td{text-align:left;border-bottom:1px solid var(--mb-border);padding:10px;vertical-align:top}.mbrfa-task-drilldown td small{display:block;color:var(--mb-muted);overflow-wrap:anywhere}.mbrfa-task-scroll{overflow:auto}.mbrfa-task-drilldown h3{margin:0}.mbrfa-inbox{border-top:1px solid var(--mb-border);padding-top:18px;margin-top:20px}.mbrfa-inbox h3{margin-top:0}.mbrfa-list{display:grid;gap:8px;margin:12px 0}.mbrfa-card{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px;border:1px solid var(--mb-border);border-radius:8px}.mbrfa-card span{display:block;margin-top:4px}.mbrfa-card p{margin:6px 0}.mbrfa-match-disclosure{margin-top:20px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);padding:14px;background:var(--mb-surface)}.mbrfa-match-disclosure>summary{cursor:pointer;font-weight:650;color:var(--mb-accent)}@media(max-width:600px){.mbrfa-card{align-items:stretch;flex-direction:column}}`}</style>
    {!list && orgWide ? <section className="mbrfa-ur-inbox" aria-label="Incoming UR responses" hidden={!inboxOpen && (inboxCount === null || inboxCount === "0")}>
      <div className="mbrfa-ur-inbox-head"><div><strong>{inboxCount === null || inboxCount === "0" ? "Incoming UR responses" : `${inboxCount} incoming UR response${inboxCount === "1" ? "" : "s"} to match`}</strong><span>Faxes we received that are not attached to an RFA yet. Match each one so its decision can be recorded.</span></div><button type="button" aria-expanded={inboxOpen} onClick={() => setInboxOpen(value => !value)}>{inboxOpen ? "Hide" : "Review"}</button></div>
      <div hidden={!inboxOpen}><InboundFaxInbox bare onCount={setInboxCount} options={options} editable={permissions.includes("act")} disabled={Boolean(appearance.disabled)} onSelect={onSelect} /></div>
    </section> : null}
    <div className="mbrfa-task-tabs" role="group" aria-label="Tasks">{(["Due", "Scheduled"] as const).map(state => <button key={state} type="button" aria-pressed={view === state} onClick={() => { if (list && getTaskHref) { const href = getTaskHref({ ...query, state }); if (onNavigate) onNavigate(href); else window.location.assign(href); } else { setView(state); setSelection(null); } }}>{taskViewLabels[state]}{` (${tasks.filter(task => rfaTaskState(task, now) === state).length})`}</button>)}</div>
    {list ? null : <p className="mbrfa-task-note">{taskViewDescriptions[view]}</p>}
    {error ? <p role="alert">{error}</p> : null}{loading ? <p role="status">Loading tasks…</p> : !error && !stateTasks.length && (view !== "Completed" || completedLoaded) ? <p>{({ Due: "Nothing to do right now.", Scheduled: "No tasks set for later.", Completed: "No finished tasks yet." } as const)[view]}</p> : null}
    {!list ? groups.map(group => { const groupTasks = stateTasks.filter(task => group.kinds.includes(task.kind)); return <section className="mbrfa-task-group" key={group.title} aria-label={group.title}><table><thead><tr><th scope="col">{group.title}<small>By date task opened</small></th>{columns.map(column => <th scope="col" key={column.key}><span className="mbrfa-task-age">{column.label}</span></th>)}<th scope="col">Task total</th></tr></thead><tbody>{group.kinds.filter(kind => groupTasks.some(task => task.kind === kind)).map(kind => { const items = groupTasks.filter(task => task.kind === kind); return <tr key={kind}><th scope="row">{rfaTaskLabel(kind)}{descriptions[kind] && <small>{descriptions[kind]}</small>}</th>{columns.map(column => <td key={column.key}>{countCell(items.filter(task => rfaTaskAgeBucket(task.createdAt, now) === column.key), kind, column.key)}</td>)}<td>{countCell(items, kind)}</td></tr>; })}</tbody><tfoot><tr><th scope="row">Total</th>{[...columns, { key: "total", label: "Total" }].map(column => { const items = column.key === "total" ? groupTasks : groupTasks.filter(task => rfaTaskAgeBucket(task.createdAt, now) === column.key); return <td key={column.key}>{items.length ? selectionControl({ kinds: group.kinds, title: group.title, ...(column.key !== "total" ? { bucket: column.key as RfaTaskAge } : {}) }, items.length, `${group.title}, ${column.label}: ${items.length} ${view.toLowerCase()} tasks`) : <span className="mbrfa-task-zero">0</span>}</td>; })}</tr></tfoot></table></section>; }) : null}
    {list && !renderTaskIdentity ? <section className="mbrfa-task-list" aria-label="Selected tasks"><h3>{selectedTitle}{activeSelection?.bucket ? ` · ${[...taskAgeColumns, { key: "unknown", label: "Unknown age" }].find(column => column.key === activeSelection.bucket)?.label}` : ""} ({filtered.length})</h3>
      {filtered.length ? <div className="mbrfa-task-scroll"><table><thead><tr><th>RFA ID</th><th>Patient</th><th>Requesting physician</th><th>Requested treatment</th><th>RFA sent</th><th>Decision due</th><th>Status</th><th>{view === "Completed" ? "Done" : "Follow up"}</th></tr></thead><tbody>{filtered.map(task => {
        const record = requestIdentities[task.rfaId];
        const context = task.responseDocumentId ? { responseDocumentId: task.responseDocumentId } : undefined;
        const open = () => onSelect(task.rfaId, task.responseDocumentId ?? undefined);
        const status = record ? getRfaLifecycleStatus(record) : null;
        const reference = record?.displayReference || task.rfaId.replace(/^rfa_/, "").slice(0, 8).toUpperCase();
        // The whole row opens the request; links inside it keep their own targets.
        return <tr key={task.id} className="mbrfa-task-row" onClick={event => { if ((event.target as HTMLElement).closest("a,button") || window.getSelection()?.toString()) return; if (getRfaHref && (event.metaKey || event.ctrlKey)) { window.open(getRfaHref(task.rfaId, context), "_blank", "noopener"); return; } open(); }}>
          <td><RfaLink href={getRfaHref?.(task.rfaId, context)} onSelect={open}>{reference}</RfaLink></td>
          <td>{record ? <><RfaLink href={getPatientHref?.(record)}>{record.employeeName}</RfaLink><small><RfaLink href={getClaimHref?.(record)}>Claim {record.claimNumber || "not recorded"}</RfaLink></small></> : "—"}</td>
          <td>{record ? <RfaLink href={getProviderHref?.(record)}>{record.providerName}</RfaLink> : "—"}</td>
          <td className="mbrfa-task-treatment">{record ? rfaTitle(record) : "—"}</td>
          <td>{record?.submittedAt ? new Date(record.submittedAt).toLocaleDateString() : "—"}</td>
          <td>{record?.submittedAt ? rfaDecisionDueText(record) : "—"}</td>
          <td>{status ? <RfaPill tone={status === "failed" ? "bad" : status === "closed" ? "ok" : status === "incomplete" ? "warn" : "muted"}>{rfaStatusLabel(status)}</RfaPill> : "—"}</td>
          <td><strong>{rfaTaskLabel(task.kind)}</strong><small>{new Date(view === "Completed" ? task.resolvedAt ?? task.updatedAt : task.snoozedUntil ?? task.dueAt).toLocaleDateString()}</small></td>
        </tr>;
      })}</tbody></table></div> : <p>No tasks match this selection.</p>}
    </section> : null}
    {(list && renderTaskIdentity) || (!list && selection) ? <section ref={drilldown} tabIndex={-1} className="mbrfa-task-drilldown" aria-label="Selected tasks"><div className="mbtd-actions"><h3>{selectedTitle}{activeSelection?.bucket ? ` · ${[...taskAgeColumns, { key: "unknown", label: "Unknown age" }].find(column => column.key === activeSelection.bucket)?.label}` : ""} ({filtered.length})</h3>{!list ? <button type="button" onClick={() => setSelection(null)}>Close task list</button> : null}</div><div className="mbrfa-task-scroll"><table><thead><tr><th>Task / request</th><th>{view === "Completed" ? "Completed" : "Follow up"}</th><th>Assigned to</th><th>Action</th></tr></thead><tbody>{filtered.map(task => <tr key={task.id}><td><strong>{rfaTaskLabel(task.kind)}</strong>{taskIdentity(task)}{task.responseFilename ? <small>{task.responseFilename}</small> : null}{task.lastOutcome ? <small>Last outcome: {task.lastOutcome.replaceAll("_", " ")}</small> : null}{task.lastNote ? <small>{task.lastNote}</small> : null}</td><td>{date(view === "Completed" ? task.resolvedAt ?? task.updatedAt : task.snoozedUntil ?? task.dueAt)}</td><td>{task.assigneeReference || "Unassigned"}</td><td><button type="button" onClick={() => onSelect(task.rfaId, task.responseDocumentId ?? undefined)}>{task.kind === "post_ur_decision" ? "Review response" : "Open request"}</button></td></tr>)}</tbody></table></div>{!filtered.length ? <p>No tasks match this selection.</p> : null}</section> : null}
    {!list && !orgWide ? <p className="mbtd-note">Open the organization-wide RFA dashboard to match incoming faxes that do not yet belong to a patient or claim.</p> : null}
  </TreatmentDraftShell>;
}

function InboundFaxInbox({ options, editable, disabled, onSelect, onCount, bare = false }: { bare?: boolean; onCount: (count: string) => void; options: OrganizationClientOptions; editable: boolean; disabled: boolean; onSelect: RfaTaskBoardProps["onSelect"] }): ReactElement {
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
  return <section className="mbrfa-inbox" aria-label="Match UR">{bare ? null : <><h3>Response inbox · Match UR</h3><p>Review incoming response faxes, then choose the matching request. Matching adds the response document and creates a Post UR task; it does not record a treatment decision.</p></>}
    {error ? <p role="alert">{error}</p> : null}{loading ? <p role="status">Loading response faxes…</p> : !error && !faxes.length ? <p>No unmatched response faxes.</p> : null}
    {pages.length > 1 || nextCursor ? <div className="mbtd-actions"><button type="button" disabled={loading || busy || pages.length < 2} onClick={() => setPages(value => value.slice(0, -1))}>Previous fax page</button><span>Page {pages.length}</span><button type="button" disabled={loading || busy || !nextCursor} onClick={() => { if (nextCursor) setPages(value => [...value, nextCursor]); }}>Next fax page</button></div> : null}
    <div className="mbrfa-list">{faxes.map(item => <article className="mbrfa-card" key={item.id}><div><strong>Response fax · {date(item.receivedAt)}</strong><span>{item.fromName || item.fromFax || "Sender not identified"} · {item.pages ?? "Unknown"} pages</span></div><button type="button" disabled={busy || disabled} onClick={() => { const current = ++generation.current; setFax(item); setPdf(null); setSelected(""); setConfirmed(false); setChoices([]); setSearch(""); void run(async () => { const [blob, suggestions] = await Promise.all([client.getInboundFaxContent(item.id), Promise.all(item.suggestedRfaIds.map(id => records.get(id).catch(() => null)))]); if (alive.current && current === generation.current) { setPdf(blob); setChoices(suggestions.filter((value): value is RfaRecord => value !== null)); } }); }}>Review fax</button></article>)}</div>
    {fax ? <div style={{ display: "grid", gap: 16 }}><div className="mbtd-actions"><h4>Match response fax</h4><button type="button" disabled={busy} onClick={() => { generation.current += 1; setFax(null); setPdf(null); setReload(value => value + 1); }}>Close review</button></div>{pdf ? <RfaPdfReview blob={pdf} title="Incoming utilization review response" /> : null}
      <form onSubmit={event => { event.preventDefault(); void run(async () => { const result = await records.list({ search: search.trim(), limit: 50 }); if (alive.current) { setChoices(result.data); setSelected(""); } }); }}><label>Find patient, claim or RFA<input value={search} maxLength={200} required onChange={event => setSearch(event.target.value)} /></label><button type="submit" disabled={busy || disabled}>Find requests</button></form>
      <label>Matching request<select value={selected} disabled={busy || disabled} onChange={event => { setSelected(event.target.value); setConfirmed(false); }}><option value="">Choose after reviewing the response</option>{choices.map(record => <option key={record.id} value={record.id} disabled={!canMatchResponse(record)}>{record.employeeName} · {record.claimNumber || "Claim not recorded"} · {record.items?.map(item => item.serviceDescription).join("; ") || "Request for authorization"} · {record.providerName}{!canMatchResponse(record) ? " · Not eligible for a response" : ""}</option>)}</select></label>
      {selected ? <button type="button" disabled={busy || disabled} onClick={() => onSelect(selected)}>Review selected request</button> : null}
      {editable ? <form onSubmit={event => { event.preventDefault(); if (!selected || !pdf || !confirmed || !editable || !choices.some(record => record.id === selected && canMatchResponse(record))) return; void run(async () => { const fingerprint = `${fax.id}:${selected}`; let key = keys.current.get(fingerprint); if (!key) { key = `rfa-match-${crypto.randomUUID()}`; keys.current.set(fingerprint, key); } const result = await client.matchInboundFax(fax.id, selected, key); if (alive.current) { setFax(null); setPdf(null); setReload(value => value + 1); onSelect(result.rfaId, result.documentId); } }); }}><label><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy || disabled} /> I reviewed the response and confirmed its patient, claim, and requested treatment match this request.</label><button type="submit" disabled={busy || disabled || !selected || !pdf || !confirmed}>Match response and open Post UR</button></form> : <p>Matching responses requires authorization from your administrator.</p>}
    </div> : null}
  </section>;
}
