"use client";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createRfaClient, createRfaLifecycleClient, type OrganizationClientOptions, type RfaFollowUp, type RfaInboundFax, type RfaRecord } from "@mindbill/browser";
import { RfaPdfReview } from "./rfa-delivery-panel";
import { TreatmentDraftShell, type TreatmentDraftAppearance } from "./treatment-draft-shared";

export type RfaTaskBoardProps = OrganizationClientOptions & TreatmentDraftAppearance & {
  patientId?: string; claimId?: string; renderingProviderId?: string;
  permissions?: readonly ("act")[];
  onSelect: (rfaId: string, responseDocumentId?: string) => void;
};
export function rfaTaskState(task: Pick<RfaFollowUp, "status" | "resolvedAt" | "snoozedUntil" | "dueAt">, now = Date.now()): "Due" | "Scheduled" | "Completed" {
  if (task.status === "resolved" || task.resolvedAt) return "Completed";
  return Date.parse(task.snoozedUntil ?? task.dueAt) > now ? "Scheduled" : "Due";
}
const names: Record<string, string> = { send_rfa: "Send RFA", no_response: "No response", transmission_failed: "Submission failed", transmission_unconfirmed: "Confirm delivery", information_requested: "Respond to information request", clock_review: "Review response deadline", schedule_treatment: "Schedule treatment", post_ur_decision: "Post UR", document_required: "Add supporting documents" };
export const rfaTaskLabel = (kind: string): string => names[kind] ?? kind.replaceAll("_", " ");
const canMatchResponse = (record: RfaRecord): boolean => !["draft", "ready", "canceled"].includes(record.status) && (!["incomplete", "deferred"].includes(record.status) || Boolean(record.submittedAt));
const date = (value: string) => new Date(value).toLocaleString();
export function RfaTaskBoard({ sessionEndpoint, getSession, apiBaseUrl, fetch: fetchOverride, ...props }: RfaTaskBoardProps): ReactElement {
  const options = useMemo<OrganizationClientOptions>(() => ({ ...(sessionEndpoint ? { sessionEndpoint } : {}), ...(getSession ? { getSession } : {}), ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}) }), [sessionEndpoint, getSession, apiBaseUrl, fetchOverride]);
  const identity = useMemo(() => crypto.randomUUID(), [options]);
  return <TaskBoardContent key={`${identity}:${props.patientId ?? ""}:${props.claimId ?? ""}:${props.renderingProviderId ?? ""}`} {...props} options={options} />;
}
function TaskBoardContent({ options, patientId, claimId, renderingProviderId, permissions = [], onSelect, ...appearance }: Omit<RfaTaskBoardProps, keyof OrganizationClientOptions> & { options: OrganizationClientOptions }): ReactElement {
  const client = useMemo(() => createRfaLifecycleClient(options), [options]);
  const [tasks, setTasks] = useState<RfaFollowUp[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const [view, setView] = useState("Due"); const [kind, setKind] = useState("");
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
        if (active) { setTasks(found); setError(""); setNow(Date.now()); }
      } catch { if (active) setError("Tasks could not be updated. Retrying automatically."); }
      finally { pending = false; if (active) setLoading(false); }
    };
    void load();
    const refresh = () => { if (document.visibilityState !== "hidden") void load(true); };
    const timer = setInterval(refresh, 30_000); window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [client, patientId, claimId, renderingProviderId]);
  const filtered = tasks.filter(task => rfaTaskState(task, now) === view && (!kind || task.kind === kind));
  return <TreatmentDraftShell {...appearance} title="RFA tasks" description="Follow up on unanswered requests, review responses, and finish outstanding work.">
    <style>{`.mbrfa-task-tabs{display:flex;gap:12px;margin:18px 0}.mbtd .mbrfa-task-tabs button{flex:1;text-align:left;padding:14px 16px;background:var(--mb-surface)}.mbtd .mbrfa-task-tabs button[aria-pressed=true]{border-color:var(--mb-accent);background:var(--mb-soft);color:var(--mb-accent);font-weight:650}.mbrfa-task-type{max-width:320px;margin:18px 0}.mbrfa-inbox{border-top:1px solid var(--mb-border);padding-top:24px;margin-top:30px}.mbrfa-inbox h3{margin-top:0}.mbrfa-list{display:grid;gap:12px;margin:16px 0}.mbrfa-card{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px;border:1px solid var(--mb-border,#d9dfe5);border-radius:8px}.mbrfa-card span{display:block;margin-top:4px}.mbrfa-card p{margin:6px 0}@media(max-width:600px){.mbrfa-card{align-items:stretch;flex-direction:column}}`}</style>
    <div className="mbrfa-task-tabs" role="group" aria-label="Task status">{["Due", "Scheduled", "Completed"].map(state => <button key={state} type="button" aria-pressed={view === state} onClick={() => setView(state)}>{state} ({tasks.filter(task => rfaTaskState(task, now) === state).length})</button>)}</div>
    <label className="mbrfa-task-type">Task type<select value={kind} onChange={event => setKind(event.target.value)}><option value="">All task types</option>{Object.keys(names).map(value => <option key={value} value={value}>{rfaTaskLabel(value)}</option>)}</select></label>
    {error ? <p role="alert">{error}</p> : null}{loading ? <p role="status">Loading tasks…</p> : !error && !filtered.length ? <p>No {view.toLowerCase()} tasks.</p> : null}
    <div className="mbrfa-list">{filtered.map(task => <article className="mbrfa-card" key={task.id}><div><strong>{rfaTaskLabel(task.kind)}</strong><span>RFA {task.rfaId}</span><p>{view === "Completed" ? `Completed ${date(task.resolvedAt ?? task.updatedAt)}` : `Follow up ${date(task.snoozedUntil ?? task.dueAt)}`}</p>{task.responseFilename ? <p>{task.responseFilename}</p> : null}{task.lastOutcome ? <p>Last outcome: {task.lastOutcome.replaceAll("_", " ")}</p> : null}{task.lastNote ? <p>{task.lastNote}</p> : null}{task.assigneeReference ? <small>Assigned to {task.assigneeReference}</small> : null}</div><button type="button" onClick={() => onSelect(task.rfaId, task.responseDocumentId ?? undefined)}>{task.kind === "post_ur_decision" ? "Review response" : "Open request"}</button></article>)}</div>
    {!patientId && !claimId && !renderingProviderId ? <InboundFaxInbox options={options} editable={permissions.includes("act")} disabled={Boolean(appearance.disabled)} onSelect={onSelect} /> : <p className="mbtd-note">Open the organization-wide RFA dashboard to match incoming faxes that do not yet belong to a patient or claim.</p>}
  </TreatmentDraftShell>;
}
function InboundFaxInbox({ options, editable, disabled, onSelect }: { options: OrganizationClientOptions; editable: boolean; disabled: boolean; onSelect: RfaTaskBoardProps["onSelect"] }): ReactElement {
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
        const result = await client.listInboundFaxes({ limit: 50, ...(pages.at(-1) ? { cursor: pages.at(-1)! } : {}) });
        if (active) { setFaxes(result.data); setNextCursor(result.nextCursor); setError(""); }
      } catch { if (active) setError("The response inbox could not be updated. Retrying automatically."); }
      finally { refreshing = false; if (active) setLoading(false); }
    };
    void load();
    const refresh = () => { if (document.visibilityState !== "hidden") void load(true); };
    const timer = setInterval(refresh, 30_000); window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [client, reload, pages]);
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
