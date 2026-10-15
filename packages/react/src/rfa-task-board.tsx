"use client";
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createRfaClient, createRfaLifecycleClient, getRfaLifecycleStatus, type OrganizationClientOptions, type RfaFollowUp, type RfaInboundFax, type RfaRecord } from "@mindbill/browser";
import { RfaPdfReview } from "./rfa-delivery-panel";
import { RfaModal } from "./rfa-modal";
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
  // The list's filters start from the link that opened it and stay changeable here.
  const activeSelection = list ? selection ?? query ?? {} : selection;
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
  const changeList = (next: RfaTaskQuery) => {
    const { state: _state, ...filters } = next; void _state;
    if (getTaskHref) { const href = getTaskHref({ ...filters, state: view }); if (onNavigate) onNavigate(href); else window.location.assign(href); }
    else setSelection(filters);
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
    <style>{`.mbrfa-task-tabs{display:flex;gap:8px;margin:4px 0 8px;flex-wrap:wrap}.mbtd .mbrfa-task-note{color:var(--mb-muted);font-size:13px;margin:0 0 6px}.mbrfa-task-list h3{font-size:16px;margin:14px 0 10px}.mbtd .mbrfa-task-filters{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:12px 0 14px}.mbtd .mbrfa-task-filters label{display:grid;gap:4px;font-size:12px;font-weight:600;color:var(--mb-muted);min-width:200px}.mbtd .mbrfa-task-filters select{min-height:36px;font-size:13px;color:var(--mb-text);font-weight:400}.mbrfa-task-count-note{margin-left:auto;font-size:13px;color:var(--mb-muted);padding-bottom:8px}.mbrfa-task-list table{width:100%;border-collapse:collapse;background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-radius)}.mbrfa-task-list th{text-align:left;font-size:12px;font-weight:600;color:var(--mb-muted);padding:10px 12px;border-bottom:1px solid var(--mb-border);white-space:nowrap}.mbrfa-task-list td{padding:12px;border-bottom:1px solid var(--mb-border);vertical-align:top;font-size:14px}.mbrfa-task-list tr:last-child td{border-bottom:0}.mbrfa-task-list td small{display:block;color:var(--mb-muted);font-size:12px;margin-top:2px}.mbrfa-task-row{cursor:pointer}.mbrfa-task-row:hover td{background:var(--mb-soft)}.mbrfa-task-treatment{max-width:280px}.mbrfa-fax-review{display:grid;grid-template-columns:minmax(0,1fr) 400px;height:100%;min-height:0}.mbrfa-fax-doc{background:#525659;min-height:0}.mbrfa-fax-doc>p{color:#fff;padding:16px;margin:0}
.mbrfa-fax-match{display:flex;flex-direction:column;min-height:0;border-left:1px solid var(--mb-border);background:var(--mb-surface)}.mbrfa-fax-scroll{flex:1;min-height:0;overflow:auto;padding:18px 20px 12px;display:grid;gap:12px;align-content:start}
.mbtd .mbrfa-fax-summary{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0;padding:12px 14px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-soft)}.mbrfa-fax-summary div{min-width:0}.mbrfa-fax-summary dt{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--mb-muted)}.mbrfa-fax-summary dd{margin:2px 0 0;font-weight:600;font-size:14px;overflow-wrap:anywhere}.mbrfa-fax-summary dd small{display:block;font-weight:400;font-size:12px;color:var(--mb-muted)}
.mbrfa-fax-match h4{margin:6px 0 0;font-size:15px;font-weight:650}.mbtd .mbrfa-fax-filter input{width:100%;padding-left:34px;background:var(--mb-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' viewBox='0 0 24 24'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E") no-repeat 11px center}
.mbrfa-fax-hint{margin:0;font-size:13px;color:var(--mb-muted)}.mbrfa-fax-choices{display:grid;gap:8px}
.mbtd .mbrfa-fax-choice{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);cursor:pointer;font-weight:400;transition:border-color .12s,box-shadow .12s,background .12s}.mbtd .mbrfa-fax-choice:hover{border-color:var(--mb-accent)}.mbtd .mbrfa-fax-choice input{width:16px;height:16px;min-height:0;flex:0 0 auto;margin:2px 0 0;padding:0;accent-color:var(--mb-accent)}
.mbtd .mbrfa-fax-choice[data-selected]{border-color:var(--mb-accent);box-shadow:0 0 0 1px var(--mb-accent);background:color-mix(in srgb,var(--mb-accent) 6%,var(--mb-surface))}.mbtd .mbrfa-fax-choice[data-disabled]{cursor:not-allowed;background:var(--mb-soft)}.mbtd .mbrfa-fax-choice[data-disabled]:hover{border-color:var(--mb-border)}.mbrfa-fax-choice[data-disabled] .mbrfa-fax-choice-body{opacity:.6}
.mbrfa-fax-choice-body{display:grid;gap:3px;min-width:0;flex:1}.mbrfa-fax-choice-top{display:flex;justify-content:space-between;align-items:center;gap:8px}.mbrfa-fax-choice-top strong{font-size:14px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mbrfa-fax-choice-top>span{display:flex;gap:6px;align-items:center;flex-shrink:0}.mbrfa-fax-choice-tx{font-size:13px;color:var(--mb-text);line-height:1.35}.mbrfa-fax-choice-meta{font-size:12px;color:var(--mb-muted);line-height:1.35}
.mbrfa-fax-suggested{font-style:normal;font-size:11px;font-weight:600;color:var(--mb-accent-contrast,#fff);background:var(--mb-accent);border-radius:999px;padding:1px 8px;line-height:16px}
.mbtd .mbrfa-fax-more{justify-self:center;background:transparent;border-color:var(--mb-border);font-size:13px}.mbrfa-fax-skeleton{display:grid;gap:8px}.mbrfa-fax-skeleton span{height:74px;border-radius:var(--mb-radius);background:linear-gradient(90deg,var(--mb-soft),color-mix(in srgb,var(--mb-border) 50%,var(--mb-soft)),var(--mb-soft));background-size:200% 100%;animation:mbrfa-shimmer 1.2s linear infinite}@keyframes mbrfa-shimmer{to{background-position:-200% 0}}
.mbrfa-fax-confirm{flex-shrink:0;display:grid;gap:10px;padding:14px 20px 16px;border-top:1px solid var(--mb-border);background:var(--mb-surface);box-shadow:0 -6px 14px -12px rgba(0,0,0,.35);margin:0}.mbtd .mbrfa-fax-confirm .mbrfa-check{display:flex;gap:10px;align-items:flex-start;font-weight:400;font-size:13px;line-height:1.4}.mbtd .mbrfa-fax-confirm .mbrfa-check input{width:16px;height:16px;min-height:0;flex:0 0 auto;margin:1px 0 0;padding:0;accent-color:var(--mb-accent)}
.mbtd .mbrfa-fax-confirm button[type=submit]{width:100%;min-height:42px;font-size:14px}.mbrfa-fax-foot{margin:0;font-size:12px;color:var(--mb-muted)}.mbtd .mbrfa-fax-foot .mbrfa-text-link{border:0;background:none;padding:0;min-height:0;font-size:12px;color:var(--mb-accent);text-decoration:underline;cursor:pointer}
.mbtd .mbtd-primary{background:var(--mb-accent);border-color:var(--mb-accent);color:var(--mb-accent-contrast,#fff);font-weight:600}.mbtd .mbtd-primary:disabled{opacity:.45;cursor:not-allowed}
.mbrfa-pill{display:inline-flex;align-items:center;font-size:11px;font-weight:500;line-height:18px;padding:0 8px;border-radius:999px;border:1px solid var(--mb-border);background:var(--mb-soft);color:var(--mb-text);white-space:nowrap}.mbrfa-pill[data-tone=ok]{background:color-mix(in srgb,#16a34a 12%,var(--mb-surface));border-color:color-mix(in srgb,#16a34a 35%,var(--mb-surface));color:#166534}.mbrfa-pill[data-tone=warn]{background:color-mix(in srgb,#d97706 14%,var(--mb-surface));border-color:color-mix(in srgb,#d97706 35%,var(--mb-surface));color:#92400e}.mbrfa-pill[data-tone=bad]{background:color-mix(in srgb,var(--mb-danger) 10%,var(--mb-surface));border-color:color-mix(in srgb,var(--mb-danger) 35%,var(--mb-surface));color:var(--mb-danger)}
.mbrfa-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:900px){.mbrfa-fax-review{grid-template-columns:1fr;grid-template-rows:50vh minmax(0,1fr)}.mbrfa-fax-match{border-left:0;border-top:1px solid var(--mb-border)}}.mbrfa-ur-inbox{border:1px solid var(--mb-accent);border-left-width:4px;border-radius:var(--mb-radius);background:var(--mb-soft);padding:14px 16px;margin:0 0 18px}.mbrfa-ur-inbox[hidden]{display:none}.mbrfa-ur-inbox-head{display:flex;justify-content:space-between;align-items:center;gap:16px}.mbrfa-ur-inbox-head strong{display:block;color:var(--mb-text);font-size:15px}.mbrfa-ur-inbox-head span{display:block;color:var(--mb-muted);font-size:13px;margin-top:2px}.mbtd .mbrfa-ur-inbox-head button{flex-shrink:0;background:var(--mb-accent);color:var(--mb-accent-contrast);border-color:var(--mb-accent)}.mbrfa-ur-inbox .mbrfa-inbox{margin-top:12px}@media(max-width:640px){.mbrfa-ur-inbox-head{align-items:flex-start;flex-direction:column}}.mbtd .mbrfa-task-tabs button[aria-pressed=true]{border-color:var(--mb-accent);background:var(--mb-soft);color:var(--mb-accent);font-weight:650}.mbrfa-task-group{border:1px solid var(--mb-border);border-radius:var(--mb-radius);overflow:auto;margin:14px 0;background:var(--mb-surface)}.mbrfa-task-group table{width:100%;border-collapse:collapse;min-width:620px;table-layout:fixed}.mbrfa-task-group th,.mbrfa-task-group td{padding:8px 14px;border-bottom:1px solid var(--mb-border);text-align:center}.mbrfa-task-group th:first-child,.mbrfa-task-group td:first-child{text-align:left;width:31%}.mbrfa-task-group thead th{font-size:12px;background:var(--mb-soft)}.mbrfa-task-group thead th:first-child{font-size:14px}.mbrfa-task-group th small{display:block;font-weight:400;color:var(--mb-muted)}.mbrfa-task-group tfoot{font-weight:650;background:var(--mb-soft)}.mbrfa-task-group tfoot td,.mbrfa-task-group tfoot th{border:0}.mbtd .mbrfa-task-count{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border:0;background:transparent;color:var(--mb-accent);font-weight:650;min-height:28px;padding:2px 10px}.mbrfa-task-zero{color:var(--mb-muted)}.mbrfa-task-drilldown{margin:20px 0}.mbrfa-task-drilldown table{width:100%;border-collapse:collapse}.mbrfa-task-drilldown th,.mbrfa-task-drilldown td{text-align:left;border-bottom:1px solid var(--mb-border);padding:10px;vertical-align:top}.mbrfa-task-drilldown td small{display:block;color:var(--mb-muted);overflow-wrap:anywhere}.mbrfa-task-scroll{overflow:auto}.mbrfa-task-drilldown h3{margin:0}.mbrfa-inbox{border-top:1px solid var(--mb-border);padding-top:18px;margin-top:20px}.mbrfa-inbox h3{margin-top:0}.mbrfa-list{display:grid;gap:8px;margin:12px 0}.mbrfa-card{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px;border:1px solid var(--mb-border);border-radius:8px}.mbrfa-card span{display:block;margin-top:4px}.mbrfa-card p{margin:6px 0}.mbrfa-match-disclosure{margin-top:20px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);padding:14px;background:var(--mb-surface)}.mbrfa-match-disclosure>summary{cursor:pointer;font-weight:650;color:var(--mb-accent)}@media(max-width:600px){.mbrfa-card{align-items:stretch;flex-direction:column}}`}</style>
    {!list && orgWide ? <section className="mbrfa-ur-inbox" aria-label="Incoming UR responses" hidden={!inboxOpen && (inboxCount === null || inboxCount === "0")}>
      <div className="mbrfa-ur-inbox-head"><div><strong>{inboxCount === null || inboxCount === "0" ? "Incoming UR responses" : `${inboxCount} incoming UR response${inboxCount === "1" ? "" : "s"} to match`}</strong><span>Faxes we received that are not attached to an RFA yet. Match each one so its decision can be recorded.</span></div><button type="button" aria-expanded={inboxOpen} onClick={() => setInboxOpen(value => !value)}>{inboxOpen ? "Hide" : "Review"}</button></div>
      <div hidden={!inboxOpen}><InboundFaxInbox bare onCount={setInboxCount} options={options} editable={permissions.includes("act")} disabled={Boolean(appearance.disabled)} onSelect={onSelect} /></div>
    </section> : null}
    <div className="mbrfa-task-tabs" role="group" aria-label="Tasks">{(["Due", "Scheduled"] as const).map(state => <button key={state} type="button" aria-pressed={view === state} onClick={() => { if (list && getTaskHref) { const href = getTaskHref({ ...query, state }); if (onNavigate) onNavigate(href); else window.location.assign(href); } else { setView(state); setSelection(null); } }}>{taskViewLabels[state]}{` (${tasks.filter(task => rfaTaskState(task, now) === state).length})`}</button>)}</div>
    {list ? null : <p className="mbrfa-task-note">{taskViewDescriptions[view]}</p>}
    {error ? <p role="alert">{error}</p> : null}{loading ? <p role="status">Loading tasks…</p> : !error && !stateTasks.length && (view !== "Completed" || completedLoaded) ? <p>{({ Due: "Nothing to do right now.", Scheduled: "No tasks set for later.", Completed: "No finished tasks yet." } as const)[view]}</p> : null}
    {!list ? groups.map(group => { const groupTasks = stateTasks.filter(task => group.kinds.includes(task.kind)); return <section className="mbrfa-task-group" key={group.title} aria-label={group.title}><table><thead><tr><th scope="col">{group.title}<small>By date task opened</small></th>{columns.map(column => <th scope="col" key={column.key}><span className="mbrfa-task-age">{column.label}</span></th>)}<th scope="col">Task total</th></tr></thead><tbody>{group.kinds.filter(kind => groupTasks.some(task => task.kind === kind)).map(kind => { const items = groupTasks.filter(task => task.kind === kind); return <tr key={kind}><th scope="row">{rfaTaskLabel(kind)}{descriptions[kind] && <small>{descriptions[kind]}</small>}</th>{columns.map(column => <td key={column.key}>{countCell(items.filter(task => rfaTaskAgeBucket(task.createdAt, now) === column.key), kind, column.key)}</td>)}<td>{countCell(items, kind)}</td></tr>; })}</tbody><tfoot><tr><th scope="row">Total</th>{[...columns, { key: "total", label: "Total" }].map(column => { const items = column.key === "total" ? groupTasks : groupTasks.filter(task => rfaTaskAgeBucket(task.createdAt, now) === column.key); return <td key={column.key}>{items.length ? selectionControl({ kinds: group.kinds, title: group.title, ...(column.key !== "total" ? { bucket: column.key as RfaTaskAge } : {}) }, items.length, `${group.title}, ${column.label}: ${items.length} ${view.toLowerCase()} tasks`) : <span className="mbrfa-task-zero">0</span>}</td>; })}</tr></tfoot></table></section>; }) : null}
    {list && !renderTaskIdentity ? <section className="mbrfa-task-list" aria-label="Selected tasks">
      <div className="mbrfa-task-filters">
        <label>Task<select value={activeSelection?.kind ? `kind:${activeSelection.kind}` : activeSelection?.kinds ? `group:${taskGroups.find(group => group.kinds.length === activeSelection.kinds!.length && group.kinds.every(kind => activeSelection.kinds!.includes(kind)))?.title ?? ""}` : ""} onChange={event => {
          const value = event.target.value; const group = taskGroups.find(item => `group:${item.title}` === value);
          changeList({ ...(value.startsWith("kind:") ? { kind: value.slice(5) } : group ? { kinds: group.kinds, title: group.title } : {}), ...(activeSelection?.bucket ? { bucket: activeSelection.bucket } : {}) });
        }}><option value="">All tasks</option>{taskGroups.map(group => <optgroup key={group.title} label={group.title}><option value={`group:${group.title}`}>All {group.title.toLowerCase()}</option>{group.kinds.map(kind => <option key={kind} value={`kind:${kind}`}>{rfaTaskLabel(kind)}</option>)}</optgroup>)}</select></label>
        <label>Opened<select value={activeSelection?.bucket ?? ""} onChange={event => {
          const { bucket: _bucket, ...rest } = activeSelection ?? {}; void _bucket;
          changeList({ ...rest, ...(event.target.value ? { bucket: event.target.value as RfaTaskAge } : {}) });
        }}><option value="">Any time</option>{[...taskAgeColumns, { key: "unknown" as const, label: "Unknown age" }].map(column => <option key={column.key} value={column.key}>{column.key === "unknown" ? column.label : `${column.label} ago`}</option>)}</select></label>
        <span className="mbrfa-task-count-note">{filtered.length} {filtered.length === 1 ? "task" : "tasks"}</span>
      </div>
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
  // Every request is listed, newest first, under the suggestions; typing filters the list.
  const [results, setResults] = useState<RfaRecord[]>([]); const [resultsCursor, setResultsCursor] = useState<string | null>(null); const [resultsLoading, setResultsLoading] = useState(false);
  const faxId = fax?.id ?? "";
  useEffect(() => {
    if (!faxId) return;
    let active = true;
    const timer = setTimeout(() => {
      setResultsLoading(true);
      records.list({ ...(search.trim() ? { search: search.trim() } : {}), limit: 20 })
        .then(result => { if (active) { setResults(result.data); setResultsCursor(result.nextCursor); } })
        .catch(() => { if (active) setError("Requests could not be loaded."); })
        .finally(() => { if (active) setResultsLoading(false); });
    }, search ? 300 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [faxId, search, records]);
  const moreResults = () => void run(async () => {
    if (!resultsCursor) return;
    const result = await records.list({ ...(search.trim() ? { search: search.trim() } : {}), limit: 20, cursor: resultsCursor });
    if (alive.current) { setResults(value => [...value, ...result.data.filter(record => !value.some(other => other.id === record.id))]); setResultsCursor(result.nextCursor); }
  });
  const listed = [...(search.trim() ? [] : choices), ...results.filter(record => search.trim() || !choices.some(other => other.id === record.id))];
  const closeReview = () => { generation.current += 1; setFax(null); setPdf(null); setReload(value => value + 1); };
  const run = async (action: () => Promise<void>) => { if (pending.current || disabled) return; pending.current = true; setBusy(true); setError(""); try { await action(); } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "The fax action failed."); } finally { pending.current = false; if (alive.current) setBusy(false); } };
  return <section className="mbrfa-inbox" aria-label="Match UR">{bare ? null : <><h3>Response inbox · Match UR</h3><p>Review incoming response faxes, then choose the matching request. Matching adds the response document and creates a Post UR task; it does not record a treatment decision.</p></>}
    {error ? <p role="alert">{error}</p> : null}{loading ? <p role="status">Loading response faxes…</p> : !error && !faxes.length ? <p>No unmatched response faxes.</p> : null}
    {pages.length > 1 || nextCursor ? <div className="mbtd-actions"><button type="button" disabled={loading || busy || pages.length < 2} onClick={() => setPages(value => value.slice(0, -1))}>Previous fax page</button><span>Page {pages.length}</span><button type="button" disabled={loading || busy || !nextCursor} onClick={() => { if (nextCursor) setPages(value => [...value, nextCursor]); }}>Next fax page</button></div> : null}
    <div className="mbrfa-list">{faxes.map(item => <article className="mbrfa-card" key={item.id}><div><strong>Response fax · {date(item.receivedAt)}</strong><span>{item.fromName || item.fromFax || "Sender not identified"} · {item.pages ?? "Unknown"} pages</span></div><button type="button" className="mbtd-primary" disabled={busy || disabled} onClick={() => { const current = ++generation.current; setFax(item); setPdf(null); setSelected(""); setConfirmed(false); setChoices([]); setSearch(""); void run(async () => { const [blob, suggestions] = await Promise.all([client.getInboundFaxContent(item.id), Promise.all(item.suggestedRfaIds.map(id => records.get(id).catch(() => null)))]); if (alive.current && current === generation.current) { setPdf(blob); setChoices(suggestions.filter((value): value is RfaRecord => value !== null)); } }); }}>Review fax</button></article>)}</div>
    {fax ? <RfaModal full title="Match UR response" busy={busy} onClose={closeReview}>
      <div className="mbrfa-fax-review">
        <div className="mbrfa-fax-doc">{pdf ? <RfaPdfReview fill blob={pdf} title="Incoming utilization review response" /> : <p role="status">Loading the fax…</p>}</div>
        <aside className="mbrfa-fax-match" aria-label="Match to an RFA">
          <div className="mbrfa-fax-scroll">
            <dl className="mbrfa-fax-summary">
              <div><dt>From</dt><dd>{fax.fromName || "Sender not identified"}{fax.fromFax ? <small>{fax.fromFax}</small> : null}</dd></div>
              <div><dt>Received</dt><dd>{new Date(fax.receivedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}<small>{new Date(fax.receivedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {fax.pages ?? "?"} {fax.pages === 1 ? "page" : "pages"}</small></dd></div>
            </dl>
            {error ? <p role="alert">{error}</p> : null}
            <h4>Which RFA is this for?</h4>
            <label className="mbrfa-fax-filter"><span className="mbrfa-sr-only">Filter requests</span><input type="search" value={search} maxLength={200} placeholder="Filter by patient, claim, RFA or treatment" onChange={event => setSearch(event.target.value)} /></label>
            {!search.trim() && !choices.length && !resultsLoading && listed.length ? <p className="mbrfa-fax-hint">No RFA was recognized automatically — pick it from the list.</p> : null}
            <div className="mbrfa-fax-choices" role="radiogroup" aria-label="Matching request">{listed.map((record, index) => {
              const eligible = canMatchResponse(record);
              const suggestion = !search.trim() && index < choices.length;
              const status = getRfaLifecycleStatus(record);
              return <label key={record.id} className="mbrfa-fax-choice" data-selected={selected === record.id || undefined} data-disabled={!eligible || undefined} title={eligible ? undefined : "This RFA was never sent, so it cannot have a response."}>
                <input type="radio" name="matching-request" value={record.id} checked={selected === record.id} disabled={!eligible || busy || disabled} onChange={() => { setSelected(record.id); setConfirmed(false); }} />
                <span className="mbrfa-fax-choice-body">
                  <span className="mbrfa-fax-choice-top"><strong>{record.employeeName}</strong><span>{suggestion ? <em className="mbrfa-fax-suggested">Suggested</em> : null}<RfaPill tone={status === "failed" ? "bad" : status === "closed" ? "ok" : status === "incomplete" ? "warn" : "muted"}>{rfaStatusLabel(status)}</RfaPill></span></span>
                  <span className="mbrfa-fax-choice-tx">{record.items?.map(item => item.serviceDescription).filter(Boolean).join("; ") || "Request for authorization"}</span>
                  <span className="mbrfa-fax-choice-meta">Claim {record.claimNumber || "—"}{record.displayReference ? ` · RFA ${record.displayReference}` : ""} · {record.providerName}{record.submittedAt ? ` · Sent ${new Date(record.submittedAt).toLocaleDateString()}` : ""}</span>
                </span>
              </label>;
            })}</div>
            {resultsLoading ? <div className="mbrfa-fax-skeleton" role="status" aria-label="Loading requests"><span /><span /><span /></div> : !listed.length ? <p className="mbrfa-fax-hint">No requests match “{search.trim()}”.</p> : null}
            {resultsCursor && !resultsLoading ? <button type="button" className="mbrfa-fax-more" disabled={busy || disabled} onClick={moreResults}>Show more requests</button> : null}
          </div>
          {editable ? <form className="mbrfa-fax-confirm" onSubmit={event => { event.preventDefault(); if (!selected || !pdf || !confirmed || !editable || !listed.some(record => record.id === selected && canMatchResponse(record))) return; void run(async () => { const fingerprint = `${fax.id}:${selected}`; let key = keys.current.get(fingerprint); if (!key) { key = `rfa-match-${crypto.randomUUID()}`; keys.current.set(fingerprint, key); } const result = await client.matchInboundFax(fax.id, selected, key); if (alive.current) { setFax(null); setPdf(null); setReload(value => value + 1); onSelect(result.rfaId, result.documentId); } }); }}>
            <label className="mbrfa-check"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy || disabled || !selected} /><span>{selected ? "The patient, claim and treatment in this fax match the selected RFA." : "Select the RFA this fax answers."}</span></label>
            <button type="submit" className="mbtd-primary" disabled={busy || disabled || !selected || !pdf || !confirmed}>{busy ? "Matching…" : "Match response and open Post UR"}</button>
            <p className="mbrfa-fax-foot">Attaches the fax to the RFA; you record each treatment's decision next.{selected ? <> <button type="button" className="mbrfa-text-link" disabled={busy || disabled} onClick={() => onSelect(selected)}>Open RFA</button></> : null}</p>
          </form> : <p className="mbrfa-fax-confirm">Matching responses requires authorization from your administrator.</p>}
        </aside>
      </div>
    </RfaModal> : null}
  </section>;
}
