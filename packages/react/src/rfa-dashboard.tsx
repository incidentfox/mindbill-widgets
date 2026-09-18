"use client";
import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from "react";
import { getRfaLifecycleStatus, RFA_LIFECYCLE_LABELS, createRfaClient, createBillReferenceClient, createOrganizationClient, type OrganizationProfileData, type OrganizationClientOptions, type RfaClient, type RfaRecord, type RfaListResult, type RfaListQuery, type RfaSigningPreview, type BillClaimsAdministratorDirectory } from "@mindbill/browser";
import { RfaTaskBoard } from "./rfa-task-board";
import { RfaTrackingContent } from "./rfa-tracking-panel";
import { RfaDetailHeader, rfaDetailCss } from "./rfa-detail-header";
import { RfaRequestSummary } from "./rfa-request-summary";
import { ClaimsAdministratorDirectoryDialog } from "./claims-administrator-directory-dialog";
import { RfaPacketsPanel } from "./rfa-packets";
import { RfaDraftActions } from "./rfa-draft-actions";
import { RfaListView } from "./rfa-list-view";
import { RfaOverview, rfaDashboardCss } from "./rfa-overview";
import { RfaCreateForm } from "./rfa-create-form";
import { RfaDraftForm, type RfaDraftInput } from "./rfa-draft-form";
import { canEditRfaDraft, rfaRecordToDraft, rfaDraftReplacement } from "./rfa-draft-edit";
import { rfaDecisionDueText } from "./rfa-decision-due";
import { RfaLifecycleControls } from "./rfa-lifecycle-controls";
import { RfaDeliveryPanel, RfaPdfReview as PdfReview } from "./rfa-delivery-panel";
import { RfaProviderSignatureSetup } from "./rfa-provider-signature-setup";
import { TreatmentDraftShell, type TreatmentDraftAppearance } from "./treatment-draft-shared";

export type RfaDashboardProps = OrganizationClientOptions & TreatmentDraftAppearance & {
  /** Open directly in the creation form when create permission is granted. */
  initialView?: "overview" | "create";
  canCreateClaim?: boolean;
  canManageProviderSignatures?: boolean;
  /** Optional separate admin session for saving physician signatures. */
  signatureSession?: OrganizationClientOptions;
  patientId?: string;
  claimId?: string;
  renderingProviderId?: string;
  initialDraft?: RfaDraftInput;
  /** Match these controls to the scopes your trusted server grants. Server authorization remains authoritative. */
  permissions?: readonly ("create" | "edit" | "sign" | "send" | "act")[];
  /** Sandbox never enables external fax or email delivery. */
  environment?: "sandbox" | "live";
  /** Stable identity of the authorized human signing on behalf of the physician. */
  actorReference?: string;
  onCreated?: (rfa: RfaRecord) => void;
  onContinue?: (rfa: RfaRecord) => void;
};
const CLINICAL_STATUSES = ["draft", "ready", "submitted", "received", "incomplete", "under_review", "information_requested", "deferred", "approved", "modified", "denied", "mixed", "canceled", "closed"];
const label = (value: string) => value.replaceAll("_", " ");
const date = (value: string | null) => value ? new Date(value).toLocaleString() : "Not recorded";
const key = () => `rfa-widget-${globalThis.crypto.randomUUID()}`;
export function RfaDashboard({ sessionEndpoint, getSession, apiBaseUrl, fetch: fetchOverride, patientId, claimId, renderingProviderId, signatureSession, ...props }: RfaDashboardProps): ReactElement {
  const options = useMemo<OrganizationClientOptions>(() => ({ ...(sessionEndpoint ? { sessionEndpoint } : {}), ...(getSession ? { getSession } : {}), ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}) }), [sessionEndpoint, getSession, apiBaseUrl, fetchOverride]);
  const client = useMemo(() => createRfaClient(options), [options]);
  const signatureClient = useMemo(() => signatureSession ? createRfaClient(signatureSession) : client, [signatureSession, client]);
  // Remount state on credential identity changes so another organization never sees a prior selection.
  const identity = useMemo(() => ({ client, signatureClient, key: key() }), [client, signatureClient]);
  return <RfaDashboardContent key={`${identity.key}:${patientId ?? ""}:${claimId ?? ""}:${renderingProviderId ?? ""}`} {...props} {...(patientId ? { patientId } : {})} {...(claimId ? { claimId } : {})} {...(renderingProviderId ? { renderingProviderId } : {})} client={client} signatureClient={signatureClient} options={options} />;
}
function RfaDashboardContent({ client, signatureClient, options, patientId, claimId, renderingProviderId, initialDraft, initialView = "overview", permissions = [], canCreateClaim = false, canManageProviderSignatures = false, environment = "sandbox", actorReference, onCreated, onContinue, ...appearance }: Omit<RfaDashboardProps, keyof OrganizationClientOptions> & { client: RfaClient; signatureClient: RfaClient; options: OrganizationClientOptions }): ReactElement {
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const references = useMemo(() => createBillReferenceClient(options), [options]);
  const [profile, setProfile] = useState<OrganizationProfileData | undefined>();
  const draftFormProps = { searchDiagnosisCodes: references.searchDiagnosisCodes, ...(profile ? { organizationProfile: profile } : {}) };
  const [result, setResult] = useState<RfaListResult | null>(null);
  const [status, setStatus] = useState("");
  const lifecycleAvailable = result?.summary.byLifecycleStatus !== undefined;
  const [cursor, setCursor] = useState<string | undefined>();
  const [searchInput, setSearchInput] = useState(""); const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<NonNullable<RfaListQuery["sortBy"]>>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [creationWarning, setCreationWarning] = useState("");
  const [view, setView] = useState<"overview" | "rfas" | "treatments" | "tasks">("overview");
  const [agingBucket, setAgingBucket] = useState<NonNullable<RfaListQuery["agingBucket"]> | "">("");
  const [resultVisible, setResultVisible] = useState(false);
  const [selectedResponseDocumentId, setSelectedResponseDocumentId] = useState<string | undefined>();
  const [pageHistory, setPageHistory] = useState<Array<string | undefined>>([]);
  const resetPage = () => { setCursor(undefined); setPageHistory([]); };
  const [reload, setReload] = useState(0); const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null); const [creating, setCreating] = useState(initialView === "create" && permissions.includes("create"));
  useEffect(() => {
    if (!creating && !selected) return;
    let active = true;
    createOrganizationClient(options).getBillingProfile().then(value => {
      if (active && Array.isArray(value?.billingProviders) && Array.isArray(value?.locations)) setProfile(value);
    }).catch(() => {});
    return () => { active = false; };
  }, [options, creating, selected]);
  const [loading, setLoading] = useState(true); const createKeys = useRef(new Map<string, string>());
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput.trim()); setCursor(undefined); setPageHistory([]); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    if (selected || creating || view === "tasks") return;
    let alive = true; let pending = false;
    const load = async (background = false) => {
      if (pending) return;
      pending = true;
      if (!background) { setLoading(true); setResultVisible(false); }
      try {
        const value = await client.list({ ...(patientId ? { patientId } : {}), ...(search ? { search } : {}), sortBy, sortDirection, ...(claimId ? { claimId } : {}), ...(renderingProviderId ? { renderingProviderId } : {}), ...(view !== "overview" && status ? lifecycleAvailable ? { lifecycleStatus: status as import("@mindbill/browser").RfaLifecycleStatus } : { status } : {}), ...(view !== "overview" && agingBucket ? { agingBucket } : {}), ...(cursor && view !== "overview" ? { cursor } : {}), limit: 50 });
        if (alive) { setResult(value); setResultVisible(true); setError(""); }
      } catch { if (alive) setError(background ? "Updates are temporarily unavailable. Showing the last loaded requests; retrying automatically." : "Requests could not be loaded. Retrying automatically."); }
      finally { pending = false; if (alive) setLoading(false); }
    };
    void load();
    const refresh = () => { if (document.visibilityState !== "hidden") void load(true); };
    const timer = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [client, patientId, claimId, renderingProviderId, search, sortBy, sortDirection, status, cursor, reload, lifecycleAvailable, view, agingBucket, selected, creating]);
  const back = () => { setCreationWarning(""); setSelected(null); setSelectedItem(null); setSelectedResponseDocumentId(undefined); setCreating(false); setReload(value => value + 1); };
  return <TreatmentDraftShell {...appearance} title="Requests for authorization" description="Manage requests, follow up on responses, and review treatment decisions.">
    <style>{`.mbrfa-list{display:grid;gap:10px;margin:16px 0}.mbrfa-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:16px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface)}.mbrfa-card strong{display:block}.mbrfa-card small{color:var(--mb-muted)}.mbrfa-status{text-transform:capitalize}.mbrfa-stack{display:grid;gap:16px}.mbrfa-check{display:flex!important;align-items:flex-start;gap:8px!important}.mbrfa-check input{min-height:20px;flex-shrink:0}.mbrfa-summary{display:flex;flex-wrap:wrap;gap:12px;padding:12px;background:var(--mb-soft);border-radius:var(--mb-control-radius)}@media(max-width:520px){.mbrfa-card{grid-template-columns:1fr}}`}</style>
    <style>{rfaDashboardCss}</style>
    {selected || creating ? <button type="button" onClick={back}>← All requests</button> : <>
      <div className="mbrfa-dashboard-heading"><span className="mbrfa-update-note">Updates automatically</span>{permissions.includes("create") ? <button type="button" className="mbtd-primary" disabled={appearance.disabled} onClick={() => setCreating(true)}>New authorization request</button> : null}</div>
      <nav className="mbrfa-nav" aria-label="Authorization views">{([ ["overview", "Overview"], ["rfas", "RFAs"], ["treatments", "Requested treatments"], ["tasks", "Tasks & response inbox"] ] as const).map(([value, title]) => <button key={value} type="button" aria-current={view === value ? "page" : undefined} onClick={() => { setView(value); resetPage(); }}>{title}</button>)}</nav>
    </>}
    {creationWarning ? <p role="alert">{creationWarning}</p> : null}
    {creating && permissions.includes("create") ? <RfaCreateForm {...appearance} client={client} canCreateClaim={canCreateClaim} draftFormProps={draftFormProps} {...(initialDraft ? { initialDraft } : {})} {...(claimId ? { claimId } : {})} {...(renderingProviderId ? { renderingProviderId } : {})} onSave={async (draft, files) => {
      const fingerprint = JSON.stringify(draft); let idempotency = createKeys.current.get(fingerprint); if (!idempotency) { idempotency = key(); createKeys.current.set(fingerprint, idempotency); }
      let saved = await client.createDraft(draft, idempotency);
      let attached = 0;
      try {
        for (const file of files) {
          if (!active.current) return;
          saved = await client.uploadDocument(saved.id, { file, documentType: "clinical_report", contentRevision: saved.contentRevision }, `${idempotency}-document-${attached}`);
          attached += 1;
        }
      } catch {
        if (active.current) setCreationWarning(`Draft saved. ${attached} of ${files.length} supporting documents attached. Add the remaining documents below before signing or sending.`);
      }
      if (!active.current) return; setCreating(false); setSelected(saved.id); onCreated?.(saved);
    }} /> : selected ? <RfaDetail key={selected} id={selected} selectedItem={selectedItem} {...(selectedResponseDocumentId ? { selectedResponseDocumentId } : {})} client={client} signatureClient={signatureClient} options={options} onCopied={draft => { setSelectedResponseDocumentId(undefined); setSelectedItem(null); setSelected(draft.id); onCreated?.(draft); }} draftFormProps={draftFormProps} canManageProviderSignatures={canManageProviderSignatures} permissions={permissions} environment={environment} {...(actorReference ? { actorReference } : {})} {...(onContinue ? { onContinue } : {})} {...(appearance.disabled !== undefined ? { disabled: appearance.disabled } : {})} /> : view === "tasks" ? <RfaTaskBoard {...appearance} {...options} {...(patientId ? { patientId } : {})} {...(claimId ? { claimId } : {})} {...(renderingProviderId ? { renderingProviderId } : {})} permissions={permissions.filter((value): value is "act" => value === "act")} onSelect={(id, documentId) => { setSelectedItem(null); setSelectedResponseDocumentId(documentId); setSelected(id); }} /> : <>
      <div className="mbrfa-filters">
        <label className="mbrfa-search">Search requests<input type="search" maxLength={200} value={searchInput} placeholder="Patient, physician, claim, RFA, service or code" onChange={event => setSearchInput(event.target.value)} /></label>
        {view !== "overview" ? <label>{lifecycleAvailable ? "Status" : "Clinical status"}<select value={status} onChange={event => { setStatus(event.target.value); resetPage(); }}><option value="">All statuses</option>{(lifecycleAvailable ? Object.keys(RFA_LIFECYCLE_LABELS) : CLINICAL_STATUSES).map(value => <option key={value} value={value}>{lifecycleAvailable ? RFA_LIFECYCLE_LABELS[value as keyof typeof RFA_LIFECYCLE_LABELS] : label(value)}</option>)}</select></label> : null}
        {searchInput || status || agingBucket ? <button type="button" className="mbrfa-clear" onClick={() => { setSearchInput(""); setSearch(""); setStatus(""); setAgingBucket(""); resetPage(); }}>Clear filters</button> : null}
      </div>
      {error ? <p role="alert">{error}</p> : null}{loading ? <p className="mbrfa-loading" role="status">Loading authorization requests…</p> : null}
      {!loading && resultVisible && result ? view === "overview" ? <RfaOverview summary={result.summary} onSelect={(nextStatus, bucket) => { setStatus(nextStatus); setAgingBucket(bucket ?? ""); resetPage(); setView("rfas"); }} /> : <>
        <div className="mbrfa-results-heading"><strong>{result.summary.total} {result.summary.total === 1 ? "request" : "requests"}{search ? " matching your search" : ""}</strong>{agingBucket ? <span>{{"0_5":"0–5", "6_14":"6–14", "15_30":"15–30", "31_plus":"31+"}[agingBucket]} days since submission</span> : null}</div>
        <RfaListView hideViewSwitch lifecycleAvailable={lifecycleAvailable} view={view === "treatments" ? "treatments" : "rfas"} onViewChange={setView} records={result.data} sortBy={sortBy} sortDirection={sortDirection} onSort={field => { setSortBy(field); setSortDirection(field === sortBy && sortDirection === "asc" ? "desc" : "asc"); resetPage(); }} onSelect={(id, itemId) => { setSelectedItem(itemId ?? null); setSelected(id); }} />
        <div className="mbrfa-pagination"><span>Request page {pageHistory.length + 1}</span><div>{pageHistory.length ? <button type="button" onClick={() => { setCursor(pageHistory.at(-1)); setPageHistory(value => value.slice(0, -1)); }}>Previous page</button> : null}{result.nextCursor ? <button type="button" onClick={() => { setPageHistory(value => [...value, cursor]); setCursor(result.nextCursor!); }}>Next page</button> : null}</div></div>
      </> : null}
    </>}
  </TreatmentDraftShell>;
}
function RfaDetail({ id, selectedItem, selectedResponseDocumentId, client, signatureClient, options, permissions, environment, actorReference, onContinue, disabled, draftFormProps, canManageProviderSignatures, onCopied }: { draftFormProps: Pick<import("./rfa-draft-form").RfaDraftFormProps, "searchDiagnosisCodes" | "organizationProfile">; canManageProviderSignatures: boolean; onCopied: (rfa: RfaRecord) => void; id: string; selectedItem: string | null; selectedResponseDocumentId?: string; client: RfaClient; signatureClient: RfaClient; options: OrganizationClientOptions; permissions: readonly string[]; environment: string; actorReference?: string; onContinue?: (rfa: RfaRecord) => void; disabled?: boolean }): ReactElement {
  const [rfa, setRfa] = useState<RfaRecord | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);
  const tabId = useId();
  const [detailTab, setDetailTab] = useState<"details" | "history">("details");
  const alive = useRef(true); const pending = useRef(false); const loadGeneration = useRef(0); const keys = useRef(new Map<string, string>());
  const [descriptions, setDescriptions] = useState<Record<string, string>>({}); const [preview, setPreview] = useState<RfaSigningPreview | null>(null); const [previewPdf, setPreviewPdf] = useState<Blob | null>(null); const [attested, setAttested] = useState(false);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [settingSignature, setSettingSignature] = useState(false);
  const [directory, setDirectory] = useState<BillClaimsAdministratorDirectory | null>(null); const [directoryLoading, setDirectoryLoading] = useState(false); const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [openedDocument, setOpenedDocument] = useState<{ blob: Blob; title: string } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const adopt = (value: RfaRecord) => { if (!alive.current) return; setRfa(value); setOpenedDocument(null); setDescriptions(Object.fromEntries(value.items.map(item => [item.id, item.diagnosisDescription ?? ""]))); setPreview(null); setPreviewPdf(null); setAttested(false);  const forms = value.documents.filter(document => document.documentType === "rfa_form" && document.contentRevision === value.contentRevision);
    const currentForm = forms.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
    setDocumentIds(value.documents.filter(document => document.id === currentForm?.id || ["clinical_report", "supporting_record"].includes(document.documentType)).map(document => document.id)); };
  useEffect(() => { let active = true; const generation = ++loadGeneration.current; setError(""); client.get(id).then(value => { if (active && generation === loadGeneration.current) adopt(value); }).catch(() => { if (active && generation === loadGeneration.current) setError("The request could not be loaded. Retrying automatically."); }); return () => { active = false; }; }, [client, id, reload]);
  const currentRfa = useRef(rfa); currentRfa.current = rfa;
  useEffect(() => {
    let active = true; let reading = false;
    const refresh = async () => {
      if (reading || pending.current || editing || document.visibilityState === "hidden") return;
      const generation = loadGeneration.current; reading = true;
      try {
        const value = await client.get(id);
        if (!active || pending.current || generation !== loadGeneration.current) return;
        if (!currentRfa.current || currentRfa.current.contentRevision !== value.contentRevision) adopt(value);
        else setRfa(value);
        setError("");
      } catch { if (active) setError("Updates are temporarily unavailable. Retrying automatically."); }
      finally { reading = false; }
    };
    const timer = setInterval(() => void refresh(), 30_000);
    const resume = () => void refresh();
    window.addEventListener("focus", resume); document.addEventListener("visibilitychange", resume);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
  }, [client, id, editing]);
  const focusedTreatment = useRef<string | null>(null);
  useEffect(() => {
    if (!rfa || !selectedItem || focusedTreatment.current === selectedItem) return;
    const element = document.getElementById(`rfa-treatment-${selectedItem}`);
    if (element) { element.scrollIntoView?.({ block: "start" }); element.focus(); focusedTreatment.current = selectedItem; }
  }, [rfa, selectedItem]);
  const claimsAdminId = rfa?.claimsAdminId;
  useEffect(() => {
    let active = true; setDirectory(null);  setDirectoryError(null); setDirectoryLoading(false);
    if (!claimsAdminId) return;
    setDirectoryLoading(true); createBillReferenceClient(options).getClaimsAdministratorDirectory(claimsAdminId).then(value => { if (active) setDirectory(value); }).catch(() => { if (active) setDirectoryError("Directory unavailable"); }).finally(() => { if (active) setDirectoryLoading(false); });
    return () => { active = false; };
  }, [claimsAdminId, options]);
  const operationKey = (name: string, body: unknown) => { const fingerprint = JSON.stringify([id, name, body]); let value = keys.current.get(fingerprint); if (!value) { value = key(); keys.current.set(fingerprint, value); } return value; };
  const run = async (work: () => Promise<void>) => { if (pending.current || disabled) return; pending.current = true; loadGeneration.current += 1; setBusy(true); setError(""); try { await work(); } catch (caught) { if (alive.current) setError(caught instanceof Error ? caught.message : "The action failed. Refresh the request before trying again."); } finally { pending.current = false; if (alive.current) setBusy(false); } };
  const uploadFiles = (files: File[]) => run(async () => {
    if (!rfa || !permissions.includes("edit") || rfa.submittedAt) return;
    if (files.some(file => !file.name.toLowerCase().endsWith(".pdf") || !file.size || file.size > 25 * 1024 * 1024)) throw new Error("Choose PDF documents up to 25 MB each.");
    let revision = rfa.contentRevision;
    for (const file of files) {
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).join(",");
      const value = await client.uploadDocument(id, { file, documentType: "clinical_report", contentRevision: revision }, operationKey("upload", [file.name, digest, revision]));
      revision = value.contentRevision;
      adopt(value);
    }
  });
  const locked = busy || disabled;
  const canSign = permissions.includes("sign") && !!actorReference?.trim();
  const unsent = rfa && !rfa.submittedAt && ["draft", "ready", "incomplete", "deferred"].includes(rfa.status);
  const openDocument = (documentId: string, title: string) => run(async () => { const blob = await client.getDocument(id, documentId); if (alive.current) setOpenedDocument({ blob, title }); });
  return <div className="mbrfa-detail mbrfa-stack" style={{ marginTop: 16 }}>
    <style>{rfaDetailCss}</style>
    {error ? <p role="alert">{error}</p> : null}{busy ? <p role="status">Working…</p> : null}
    {!rfa ? (!error ? <p role="status">Loading request…</p> : null) : <>
      <RfaDetailHeader rfa={rfa} />
      <div className="mbrfa-detail-toolbar"><div><h2>RFA <span>{rfa.id}</span></h2><span className="mbrfa-badge">{RFA_LIFECYCLE_LABELS[getRfaLifecycleStatus(rfa)]}</span><span className="mbrfa-badge">{rfa.expedited ? "Expedited" : label(rfa.reviewType)}</span></div><div className="mbtd-actions">
        {permissions.includes("edit") && canEditRfaDraft(rfa) && !editing ? <button type="button" className="mbtd-primary" disabled={locked} onClick={() => { setDetailTab("details"); setEditing(true); }}>Edit request draft</button> : null}
        {onContinue ? <button type="button" disabled={locked} onClick={() => onContinue(rfa)}>Open in your application</button> : null}
        <RfaDraftActions {...options} rfa={rfa} disabled={!!locked} permissions={permissions.filter((permission): permission is "create" | "edit" => permission === "create" || permission === "edit")} onCopied={onCopied} onCanceled={adopt} />
      </div></div>
      {!editing ? <div className="mbrfa-detail-tabs" role="tablist" aria-label="RFA information" onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? "details" : event.key === "End" ? "history" : detailTab === "details" ? "history" : "details"; setDetailTab(next); document.getElementById(`${tabId}-${next}-tab`)?.focus(); }}><button id={`${tabId}-details-tab`} role="tab" tabIndex={detailTab === "details" ? 0 : -1} aria-selected={detailTab === "details"} aria-controls={`${tabId}-details-panel`} onClick={() => setDetailTab("details")}>RFA details</button><button id={`${tabId}-history-tab`} role="tab" tabIndex={detailTab === "history" ? 0 : -1} aria-selected={detailTab === "history"} aria-controls={`${tabId}-history-panel`} onClick={() => setDetailTab("history")}>History & activity</button></div> : null}
      {editing ? <>
        <button type="button" disabled={locked} onClick={() => { setEditing(false); setReload(value => value + 1); }}>Discard edits and refresh</button>
        <RfaDraftForm key={`${rfa.id}:${rfa.contentRevision}`} mode="edit" {...draftFormProps} initialDraft={rfaRecordToDraft(rfa)} disabled={!!locked} onSave={async draft => {
          if (pending.current || disabled) throw new Error("Wait for the current action to finish.");
          pending.current = true; loadGeneration.current += 1; setBusy(true);
          try {
            const body = rfaDraftReplacement(draft, rfa.contentRevision);
            const saved = await client.updateDraft(id, body, operationKey("edit-draft", body));
            if (alive.current) { adopt(saved); setEditing(false); }
          } finally { pending.current = false; if (alive.current) setBusy(false); }
        }} />
      </> : <>
      <div id={`${tabId}-details-panel`} role="tabpanel" aria-labelledby={`${tabId}-details-tab`} hidden={detailTab !== "details"} className="mbrfa-stack">
      <RfaRequestSummary rfa={rfa} {...(rfa.claimsAdminId ? { onViewClaimsAdministrator: () => setDirectoryOpen(true) } : {})} />
      <ClaimsAdministratorDirectoryDialog open={directoryOpen} directory={directory} loading={directoryLoading} error={directoryError} onClose={() => setDirectoryOpen(false)} />
      <fieldset><legend>Review timeline</legend><div className="mbtd-grid"><span>Signed: {date(rfa.signedAt)}</span><span>Submitted: {date(rfa.submittedAt)}</span><span>Confirmed receipt: {date(rfa.receivedAt)}</span><span>Decision due: {rfaDecisionDueText(rfa)}</span></div>{rfa.decisionDeadlineBasis ? <p>{label(rfa.decisionDeadlineBasis)}</p> : !rfa.decisionDueAt ? <p>The review deadline appears after the required receipt evidence is recorded.</p> : null}{[rfa.incompleteReason, rfa.deferredReason, rfa.closedReason].filter(Boolean).map((reason,index) => <p key={index}>{reason}</p>)}</fieldset>
      {unsent ? <fieldset><legend>Requested treatment</legend>{rfa.items.map(item => <article key={item.id} style={{ marginBottom: 14 }}><strong>{item.serviceDescription}</strong><p>{item.procedureCode || "Procedure not specified"} · Diagnosis {item.diagnosisCode} · {label(item.outcome)}{item.authorizationNumber ? ` · Authorization ${item.authorizationNumber}` : ""}</p>{item.decisionReason ? <p>{item.decisionReason}</p> : null}{unsent && !rfa.signedAt && canSign ? <label>Diagnosis description for {item.diagnosisCode}<input value={descriptions[item.id] ?? ""} disabled={locked} onChange={event => { setDescriptions(value => ({ ...value, [item.id]: event.target.value })); setPreview(null); setPreviewPdf(null); setAttested(false); }} /></label> : null}</article>)}</fieldset> : null}
      <fieldset><legend>Supporting documents</legend><p>{unsent ? "Include clinical substantiation. The signed DWC-RFA and cover sheet are assembled for you. Add one or more supporting PDFs." : "View the documents attached to this request. Saved packets preserve the exact files included with each submission."}</p>{rfa.documents.map(document => <div className="mbtd-actions" key={document.id}><label className="mbrfa-check">{unsent ? <input type="checkbox" disabled={locked || (document.documentType === "rfa_form" && document.contentRevision !== rfa.contentRevision)} checked={documentIds.includes(document.id)} onChange={event => { setDocumentIds(value => event.target.checked ? [...value.filter(item => document.documentType !== "rfa_form" || !rfa.documents.some(candidate => candidate.id === item && candidate.documentType === "rfa_form")), document.id] : value.filter(item => item !== document.id));  }} /> : null}{document.filename} ({label(document.documentType)})</label><button type="button" disabled={locked} onClick={() => void openDocument(document.id, document.filename)}>View PDF</button></div>)}{permissions.includes("edit") && unsent ? <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void uploadFiles(Array.from(event.dataTransfer.files)); }} style={{ marginTop: 12, padding: 16, border: "1px dashed var(--mb-border)", borderRadius: 8 }}><label>Add supporting documents (PDF, up to 25 MB each)<input type="file" multiple accept="application/pdf,.pdf" disabled={locked} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void uploadFiles(files); }} /></label><p>Choose files or drop them here.</p></div> : null}</fieldset>
      {openedDocument ? <PdfReview blob={openedDocument.blob} title={openedDocument.title} /> : null}
      {unsent && !rfa.signedAt ? <fieldset><legend>Review and sign</legend><p>An authorized human must review and approve the exact form before applying the requesting physician’s saved signature.</p>{canManageProviderSignatures && canSign ? <>{settingSignature ? <RfaProviderSignatureSetup client={signatureClient} renderingProviderId={rfa.renderingProviderId} providerName={rfa.providerName} disabled={!!locked} onSaved={() => { setSettingSignature(false); setPreview(null); setPreviewPdf(null); setAttested(false); setReload(value => value + 1); }} onCancel={() => setSettingSignature(false)} /> : <button type="button" disabled={locked} onClick={() => setSettingSignature(true)}>Set up physician signature</button>}</> : null}{!canSign ? <p>Your integration needs signing permission and a signer identity to sign here.</p> : settingSignature ? null : <><button type="button" disabled={locked || rfa.items.some(item => !descriptions[item.id]?.trim())} onClick={() => void run(async () => { const body = { diagnosisDescriptions: descriptions }; const value = await client.prepareSigning(id, body, operationKey("preview", [body, rfa.contentRevision, reload])); const blob = await client.getDocument(id, value.previewDocumentId); if (alive.current) { setPreview(value); setPreviewPdf(blob); setAttested(false); } })}>Prepare signing preview</button>{preview && previewPdf ? <><PdfReview blob={previewPdf} title="DWC-RFA signing preview" /><label className="mbrfa-check"><input type="checkbox" checked={attested} disabled={locked} onChange={event => setAttested(event.target.checked)} />I reviewed this exact form and am authorized by the requesting physician to apply their saved signature.</label><button className="mbtd-primary" type="button" disabled={locked || !attested || Date.parse(preview.expiresAt) <= Date.now()} onClick={() => void run(async () => { const body = { snapshotId: preview.id, contentHash: preview.contentHash, renderingProviderId: preview.renderingProviderId, physicianAuthorized: true as const, actorReference: actorReference! }; adopt(await client.sign(id, body, operationKey("sign", body))); })}>Sign reviewed request</button><p>Preview expires {date(preview.expiresAt)}. Prepare a new preview after refreshing if it expires.</p></> : null}</>}</fieldset> : null}
      {unsent ? <RfaDeliveryPanel key={`${rfa.id}:${rfa.contentRevision}:${rfa.signedAt ?? ""}:${rfa.submittedAt ?? ""}`} rfa={rfa} client={client} documentIds={documentIds} directory={directory} directoryLoading={directoryLoading} directoryError={directoryError} locked={!!locked} environment={environment} canSend={permissions.includes("send")} run={run} onUpdated={adopt} /> : null}

      {rfa.informationRequests.length ? <fieldset><legend>Information requested</legend>{rfa.informationRequests.map(item => <p key={item.id}>{item.requestText} · Due {date(item.dueAt)} · {item.respondedAt ? `Responded ${date(item.respondedAt)}` : "Awaiting response"}</p>)}</fieldset> : null}
      <div className="mbrfa-detail-card"><RfaPacketsPanel {...options} rfa={rfa} environment={environment === "live" ? "live" : "sandbox"} disabled={!!locked} permissions={permissions.includes("act") ? ["act"] : []} onForwarded={() => { void run(async () => adopt(await client.get(id))); }} /></div>
      <div className="mbrfa-detail-card"><RfaLifecycleControls {...(selectedResponseDocumentId ? { selectedResponseDocumentId } : {})} {...options} rfa={rfa} disabled={!!locked} permissions={permissions.filter((permission): permission is "act" | "edit" => permission === "act" || permission === "edit")} onUpdated={adopt} /></div>
      </div>
      <div id={`${tabId}-history-panel`} role={detailTab === "history" ? "tabpanel" : undefined} aria-labelledby={detailTab === "history" ? `${tabId}-history-tab` : undefined} onClick={event => { const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#rfa-treatment-"]'); if (link) { event.preventDefault(); setDetailTab("details"); const target = link.hash.slice(1); setTimeout(() => { const element = document.getElementById(target); element?.scrollIntoView?.({ block: "start" }); element?.focus(); }, 0); } }}>
      <RfaTrackingContent embedded view={detailTab === "history" ? "history" : "treatments"} rfa={rfa} options={options} disabled={!!locked} permissions={permissions.filter((permission): permission is "act" | "edit" => permission === "act" || permission === "edit")} onUpdated={adopt} />
      {detailTab === "history" && permissions.includes("send") ? <details className="mbrfa-delivery-tools"><summary>Delivery tools</summary><button type="button" disabled={locked} onClick={() => void run(async () => { adopt(await client.refreshFaxes(id, key())); })}>Check fax delivery with provider</button></details> : null}
      </div>
      </>}
    </>}
  </div>;
}
