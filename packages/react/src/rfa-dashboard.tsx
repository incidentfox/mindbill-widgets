"use client";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createRfaClient, createBillReferenceClient, type OrganizationClientOptions, type RfaClient, type RfaRecord, type RfaListResult, type RfaSigningPreview, type RfaAuthorizationDestinationOption, type BillClaimsAdministratorDirectory } from "@mindbill/browser";
import { RfaCreateForm } from "./rfa-create-form";
import { RfaDraftForm, type RfaDraftInput } from "./rfa-draft-form";
import { canEditRfaDraft, rfaRecordToDraft, rfaDraftReplacement } from "./rfa-draft-edit";
import { RfaLifecycleControls } from "./rfa-lifecycle-controls";
import { RfaAuthorizationDestination } from "./rfa-authorization-destination";
import { TreatmentDraftShell, type TreatmentDraftAppearance } from "./treatment-draft-shared";

export type RfaDashboardProps = OrganizationClientOptions & TreatmentDraftAppearance & {
  claimId?: string;
  renderingProviderId?: string;
  initialDraft?: RfaDraftInput;
  /** Match these controls to the scopes your trusted server grants. Server authorization remains authoritative. */
  permissions?: readonly ("create" | "edit" | "sign" | "send" | "act")[];
  /** Sandbox never enables fax delivery. */
  environment?: "sandbox" | "live";
  /** Stable identity of the authorized human signing on behalf of the physician. */
  actorReference?: string;
  onCreated?: (rfa: RfaRecord) => void;
  onContinue?: (rfa: RfaRecord) => void;
};
const STATUSES = ["draft", "ready", "submitted", "received", "incomplete", "under_review", "information_requested", "deferred", "approved", "modified", "denied", "mixed", "canceled", "closed"];
const label = (value: string) => value.replaceAll("_", " ");
const date = (value: string | null) => value ? new Date(value).toLocaleString() : "Not recorded";
const key = () => `rfa-widget-${globalThis.crypto.randomUUID()}`;
function PdfReview({ blob, title }: { blob: Blob; title: string }): ReactElement {
  const [url, setUrl] = useState("");
  useEffect(() => { const value = URL.createObjectURL(blob); setUrl(value); return () => URL.revokeObjectURL(value); }, [blob]);
  return <div>{url ? <><a href={url} target="_blank" rel="noopener noreferrer">Open {title} PDF</a><iframe title={title} src={url} style={{ width: "100%", height: 420, border: "1px solid var(--mb-border)", marginTop: 10 }} /></> : null}</div>;
}

export function RfaDashboard({ sessionEndpoint, getSession, apiBaseUrl, fetch: fetchOverride, claimId, renderingProviderId, ...props }: RfaDashboardProps): ReactElement {
  const options = useMemo<OrganizationClientOptions>(() => ({ ...(sessionEndpoint ? { sessionEndpoint } : {}), ...(getSession ? { getSession } : {}), ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}) }), [sessionEndpoint, getSession, apiBaseUrl, fetchOverride]);
  const client = useMemo(() => createRfaClient(options), [options]);
  // Remount state on credential identity changes so another organization never sees a prior selection.
  const identity = useMemo(() => ({ client, key: key() }), [client]);
  return <RfaDashboardContent key={`${identity.key}:${claimId ?? ""}:${renderingProviderId ?? ""}`} {...props} {...(claimId ? { claimId } : {})} {...(renderingProviderId ? { renderingProviderId } : {})} client={client} options={options} />;
}
function RfaDashboardContent({ client, options, claimId, renderingProviderId, initialDraft, permissions = [], environment = "sandbox", actorReference, onCreated, onContinue, ...appearance }: Omit<RfaDashboardProps, keyof OrganizationClientOptions> & { client: RfaClient; options: OrganizationClientOptions }): ReactElement {
  const [result, setResult] = useState<RfaListResult | null>(null);
  const [status, setStatus] = useState(""); const [cursor, setCursor] = useState<string | undefined>();
  const [reload, setReload] = useState(0); const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null); const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true); const createKeys = useRef(new Map<string, string>());
  useEffect(() => {
    let alive = true; setLoading(true); setError("");
    client.list({ ...(claimId ? { claimId } : {}), ...(renderingProviderId ? { renderingProviderId } : {}), ...(status ? { status } : {}), ...(cursor ? { cursor } : {}), limit: 50 }).then(value => { if (alive) setResult(value); }).catch(() => { if (alive) setError("Requests could not be loaded. Try refreshing."); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [client, claimId, renderingProviderId, status, cursor, reload]);
  const back = () => { setSelected(null); setCreating(false); setReload(value => value + 1); };
  return <TreatmentDraftShell {...appearance} title="Requests for authorization" description="Prepare treatment requests, review signed packets, and track delivery and utilization review decisions.">
    <style>{`.mbrfa-list{display:grid;gap:10px;margin:16px 0}.mbrfa-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:16px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface)}.mbrfa-card strong{display:block}.mbrfa-card small{color:var(--mb-muted)}.mbrfa-status{text-transform:capitalize}.mbrfa-stack{display:grid;gap:16px}.mbrfa-check{display:flex!important;align-items:flex-start;gap:8px!important}.mbrfa-check input{min-height:20px;flex-shrink:0}.mbrfa-summary{display:flex;flex-wrap:wrap;gap:12px;padding:12px;background:var(--mb-soft);border-radius:var(--mb-control-radius)}@media(max-width:520px){.mbrfa-card{grid-template-columns:1fr}}`}</style>
    {selected || creating ? <button type="button" onClick={back}>← All requests</button> : <div className="mbtd-actions"><label>Status<select value={status} onChange={event => { setStatus(event.target.value); setCursor(undefined); }}><option value="">All statuses</option>{STATUSES.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label><button type="button" disabled={loading} onClick={() => setReload(value => value + 1)}>Refresh requests</button>{permissions.includes("create") ? <button type="button" className="mbtd-primary" disabled={appearance.disabled} onClick={() => setCreating(true)}>New authorization request</button> : null}</div>}
    {creating && permissions.includes("create") ? <RfaCreateForm {...appearance} client={client} {...(initialDraft ? { initialDraft } : {})} {...(claimId ? { claimId } : {})} {...(renderingProviderId ? { renderingProviderId } : {})} onSave={async draft => {
      const fingerprint = JSON.stringify(draft); let idempotency = createKeys.current.get(fingerprint); if (!idempotency) { idempotency = key(); createKeys.current.set(fingerprint, idempotency); }
      const saved = await client.createDraft(draft, idempotency); setCreating(false); setSelected(saved.id); onCreated?.(saved);
    }} /> : selected ? <RfaDetail key={selected} id={selected} client={client} options={options} permissions={permissions} environment={environment} {...(actorReference ? { actorReference } : {})} {...(onContinue ? { onContinue } : {})} {...(appearance.disabled !== undefined ? { disabled: appearance.disabled } : {})} /> : <>
      {error ? <p role="alert">{error}</p> : null}{loading ? <p role="status">Loading authorization requests…</p> : null}
      {!loading && !error && result ? <><div className="mbrfa-summary"><strong>{result.summary.total} requests</strong>{Object.entries(result.summary.byStatus).filter(([,count]) => count > 0).map(([name,count]) => <span key={name} className="mbrfa-status">{label(name)}: {count}</span>)}</div><div className="mbrfa-list">{result.data.length ? result.data.map(rfa => <article className="mbrfa-card" key={rfa.id}><div><strong>{rfa.employeeName}</strong><span>{rfa.providerName} · {rfa.claimNumber || "Claim number not recorded"}</span><small style={{ display: "block" }}>Updated {date(rfa.updatedAt)}</small></div><div><span className="mbrfa-status">{label(rfa.status)}</span><br /><button type="button" onClick={() => setSelected(rfa.id)}>Review request</button></div></article>) : <p>No requests match this view.</p>}</div><div className="mbtd-actions">{cursor ? <button type="button" onClick={() => setCursor(undefined)}>First page</button> : null}{result.nextCursor ? <button type="button" onClick={() => setCursor(result.nextCursor!)}>Next page</button> : null}</div></> : null}
    </>}
  </TreatmentDraftShell>;
}
function RfaDetail({ id, client, options, permissions, environment, actorReference, onContinue, disabled }: { id: string; client: RfaClient; options: OrganizationClientOptions; permissions: readonly string[]; environment: string; actorReference?: string; onContinue?: (rfa: RfaRecord) => void; disabled?: boolean }): ReactElement {
  const [rfa, setRfa] = useState<RfaRecord | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);
  const alive = useRef(true); const pending = useRef(false); const keys = useRef(new Map<string, string>());
  const [descriptions, setDescriptions] = useState<Record<string, string>>({}); const [preview, setPreview] = useState<RfaSigningPreview | null>(null); const [previewPdf, setPreviewPdf] = useState<Blob | null>(null); const [attested, setAttested] = useState(false);
  const [documentIds, setDocumentIds] = useState<string[]>([]); const [packet, setPacket] = useState<Blob | null>(null); const [packetReviewed, setPacketReviewed] = useState(false);
  const [destination, setDestination] = useState<RfaAuthorizationDestinationOption | null>(null); const [confirmed, setConfirmed] = useState(false);
  const [directory, setDirectory] = useState<BillClaimsAdministratorDirectory | null>(null); const [directoryLoading, setDirectoryLoading] = useState(false); const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [openedDocument, setOpenedDocument] = useState<{ blob: Blob; title: string } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const adopt = (value: RfaRecord) => { if (!alive.current) return; setRfa(value); setOpenedDocument(null); setDescriptions({}); setPreview(null); setPreviewPdf(null); setAttested(false); setPacket(null); setPacketReviewed(false); setConfirmed(false); const forms = value.documents.filter(document => document.documentType === "rfa_form" && document.contentRevision === value.contentRevision);
    const currentForm = forms.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
    setDocumentIds(value.documents.filter(document => document.id === currentForm?.id || ["clinical_report", "supporting_record"].includes(document.documentType)).map(document => document.id)); };
  useEffect(() => { let active = true; setError(""); client.get(id).then(value => { if (active) adopt(value); }).catch(() => { if (active) setError("The request could not be loaded. Refresh to try again."); }); return () => { active = false; }; }, [client, id, reload]);
  const claimsAdminId = rfa?.claimsAdminId;
  useEffect(() => {
    let active = true; setDirectory(null); setDestination(null); setConfirmed(false); setDirectoryError(null); setDirectoryLoading(false);
    if (!claimsAdminId) return;
    setDirectoryLoading(true); createBillReferenceClient(options).getClaimsAdministratorDirectory(claimsAdminId).then(value => { if (active) setDirectory(value); }).catch(() => { if (active) setDirectoryError("Directory unavailable"); }).finally(() => { if (active) setDirectoryLoading(false); });
    return () => { active = false; };
  }, [claimsAdminId, options]);
  const operationKey = (name: string, body: unknown) => { const fingerprint = JSON.stringify([id, name, body]); let value = keys.current.get(fingerprint); if (!value) { value = key(); keys.current.set(fingerprint, value); } return value; };
  const run = async (work: () => Promise<void>) => { if (pending.current || disabled) return; pending.current = true; setBusy(true); setError(""); try { await work(); } catch (caught) { if (alive.current) setError(caught instanceof Error ? caught.message : "The action failed. Refresh the request before trying again."); } finally { pending.current = false; if (alive.current) setBusy(false); } };
  const locked = busy || disabled;
  const canSign = permissions.includes("sign") && !!actorReference?.trim();
  const unsent = rfa && !rfa.submittedAt && ["draft", "ready", "incomplete", "deferred"].includes(rfa.status);
  const openDocument = (documentId: string, title: string) => run(async () => { const blob = await client.getDocument(id, documentId); if (alive.current) setOpenedDocument({ blob, title }); });
  return <div className="mbrfa-stack" style={{ marginTop: 16 }}>
    <div className="mbtd-actions"><button type="button" disabled={locked || editing} onClick={() => setReload(value => value + 1)}>Refresh request</button>{rfa && onContinue ? <button type="button" disabled={locked} onClick={() => onContinue(rfa)}>Open in your application</button> : null}</div>
    {error ? <p role="alert">{error}</p> : null}{busy ? <p role="status">Working…</p> : null}
    {!rfa ? (!error ? <p role="status">Loading request…</p> : null) : <>
      <div className="mbrfa-summary"><strong>{rfa.employeeName}</strong><span className="mbrfa-status">{label(rfa.status)}</span><span>{rfa.providerName}</span><span>{rfa.expedited ? "Expedited" : "Standard"} · {label(rfa.reviewType)}</span></div>
      {editing ? <>
        <button type="button" disabled={locked} onClick={() => { setEditing(false); setReload(value => value + 1); }}>Discard edits and refresh</button>
        <RfaDraftForm key={`${rfa.id}:${rfa.contentRevision}`} mode="edit" initialDraft={rfaRecordToDraft(rfa)} disabled={!!locked} onSave={async draft => {
          if (pending.current || disabled) throw new Error("Wait for the current action to finish.");
          pending.current = true; setBusy(true);
          try {
            const body = rfaDraftReplacement(draft, rfa.contentRevision);
            const saved = await client.updateDraft(id, body, operationKey("edit-draft", body));
            if (alive.current) { adopt(saved); setEditing(false); }
          } finally { pending.current = false; if (alive.current) setBusy(false); }
        }} />
      </> : <>
      {permissions.includes("edit") && canEditRfaDraft(rfa) ? <button type="button" disabled={locked} onClick={() => setEditing(true)}>Edit request draft</button> : null}
      <fieldset><legend>Review timeline</legend><div className="mbtd-grid"><span>Signed: {date(rfa.signedAt)}</span><span>Submitted: {date(rfa.submittedAt)}</span><span>Confirmed receipt: {date(rfa.receivedAt)}</span><span>Decision due: {date(rfa.decisionDueAt)}</span></div>{rfa.decisionDeadlineBasis ? <p>{label(rfa.decisionDeadlineBasis)}</p> : <p>The review deadline appears after the required receipt evidence is recorded.</p>}{[rfa.incompleteReason, rfa.deferredReason, rfa.closedReason].filter(Boolean).map((reason,index) => <p key={index}>{reason}</p>)}</fieldset>
      <fieldset><legend>Requested treatment</legend>{rfa.items.map(item => <article key={item.id} style={{ marginBottom: 14 }}><strong>{item.serviceDescription}</strong><p>{item.procedureCode || "Procedure not specified"} · Diagnosis {item.diagnosisCode} · {label(item.outcome)}{item.authorizationNumber ? ` · Authorization ${item.authorizationNumber}` : ""}</p>{item.decisionReason ? <p>{item.decisionReason}</p> : null}{unsent && !rfa.signedAt && canSign ? <label>Diagnosis description for {item.diagnosisCode}<input value={descriptions[item.id] ?? ""} disabled={locked} onChange={event => { setDescriptions(value => ({ ...value, [item.id]: event.target.value })); setPreview(null); setPreviewPdf(null); setAttested(false); }} /></label> : null}</article>)}</fieldset>
      <fieldset><legend>Supporting documents</legend><p>Include clinical substantiation. The signed DWC-RFA and a fax cover sheet are assembled for you.</p>{rfa.documents.map(document => <div className="mbtd-actions" key={document.id}><label className="mbrfa-check"><input type="checkbox" disabled={locked || (document.documentType === "rfa_form" && document.contentRevision !== rfa.contentRevision)} checked={documentIds.includes(document.id)} onChange={event => { setDocumentIds(value => event.target.checked ? [...value.filter(item => document.documentType !== "rfa_form" || !rfa.documents.some(candidate => candidate.id === item && candidate.documentType === "rfa_form")), document.id] : value.filter(item => item !== document.id)); setPacket(null); setPacketReviewed(false); setConfirmed(false); }} />{document.filename} ({label(document.documentType)})</label><button type="button" disabled={locked} onClick={() => void openDocument(document.id, document.filename)}>View PDF</button></div>)}{permissions.includes("edit") && unsent ? <label style={{ marginTop: 12 }}>Add clinical report (PDF, up to 25 MB)<input type="file" accept="application/pdf,.pdf" disabled={locked} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; void run(async () => { const body = { file, documentType: "clinical_report" as const, contentRevision: rfa.contentRevision }; const value = await client.uploadDocument(id, body, operationKey("upload", [file.name, Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).join(","), rfa.contentRevision])); adopt(value); }); }} /></label> : null}</fieldset>
      {openedDocument ? <PdfReview blob={openedDocument.blob} title={openedDocument.title} /> : null}
      {unsent && !rfa.signedAt ? <fieldset><legend>Review and sign</legend><p>An authorized administrator must first save this physician’s signature in <a href="https://app.mindbill.org/settings/rendering-providers" target="_blank" rel="noopener noreferrer">MindBill rendering provider settings</a>. An authorized human must review and approve the exact form before signing.</p>{!canSign ? <p>Your integration needs signing permission and a signer identity to sign here.</p> : <><button type="button" disabled={locked || rfa.items.some(item => !descriptions[item.id]?.trim())} onClick={() => void run(async () => { const body = { diagnosisDescriptions: descriptions }; const value = await client.prepareSigning(id, body, operationKey("preview", [body, rfa.contentRevision, reload])); const blob = await client.getDocument(id, value.previewDocumentId); if (alive.current) { setPreview(value); setPreviewPdf(blob); setAttested(false); } })}>Prepare signing preview</button>{preview && previewPdf ? <><PdfReview blob={previewPdf} title="DWC-RFA signing preview" /><label className="mbrfa-check"><input type="checkbox" checked={attested} disabled={locked} onChange={event => setAttested(event.target.checked)} />I reviewed this exact form and am authorized by the requesting physician to apply their saved signature.</label><button className="mbtd-primary" type="button" disabled={locked || !attested || Date.parse(preview.expiresAt) <= Date.now()} onClick={() => void run(async () => { const body = { snapshotId: preview.id, contentHash: preview.contentHash, renderingProviderId: preview.renderingProviderId, physicianAuthorized: true as const, actorReference: actorReference! }; adopt(await client.sign(id, body, operationKey("sign", body))); })}>Sign reviewed request</button><p>Preview expires {date(preview.expiresAt)}. Prepare a new preview after refreshing if it expires.</p></> : null}</>}</fieldset> : null}
      <fieldset><legend>Review packet and send</legend>{!rfa.readiness.ready ? <p>Still needed: {rfa.readiness.missing.map(label).join(", ") || "Complete the request details"}.</p> : null}<button type="button" disabled={locked || !rfa.signedAt || documentIds.length < 2} onClick={() => void run(async () => { const blob = await client.previewPacket(id, documentIds); if (alive.current) { setPacket(blob); setPacketReviewed(false); setConfirmed(false); } })}>Prepare packet with cover sheet</button>{packet ? <><PdfReview blob={packet} title="RFA fax packet" /><label className="mbrfa-check"><input type="checkbox" disabled={locked} checked={packetReviewed} onChange={event => { setPacketReviewed(event.target.checked); setConfirmed(false); }} />I reviewed the assembled packet, including the cover sheet and clinical documents.</label></> : null}
        <RfaAuthorizationDestination contextKey={`${id}:${claimsAdminId ?? "manual"}`} directory={directory} loading={directoryLoading} error={directoryError} disabled={!!locked} onChange={value => { setDestination(value); setConfirmed(false); }} />
        {environment !== "live" ? <p className="mbtd-note">Sandbox: review and prepare the packet here. External fax delivery is disabled.</p> : !permissions.includes("send") ? <p>Fax sending requires permission from your organization.</p> : destination?.method === "email" ? <p>This destination accepts email. Download the reviewed packet and use your approved secure email workflow.</p> : <><label className="mbrfa-check"><input type="checkbox" disabled={locked || !packetReviewed || destination?.method !== "fax"} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Send this reviewed packet to {destination?.destination || "the selected authorization fax"}. I verified the recipient for this claim.</label><button type="button" className="mbtd-primary" disabled={locked || !confirmed || !packetReviewed || !rfa.readiness.ready || destination?.method !== "fax" || !!rfa.submittedAt} onClick={() => void run(async () => { if (destination?.method !== "fax") return; const body = { to: destination.destination, documentIds }; adopt(await client.sendFax(id, body, operationKey("fax", body))); })}>Send authorization fax</button></>}
      </fieldset>
      <fieldset><legend>Delivery and receipt history</legend>{permissions.includes("send") ? <button type="button" disabled={locked} onClick={() => void run(async () => { adopt(await client.refreshFaxes(id, key())); })}>Refresh fax status</button> : null}{rfa.transmissions.length ? rfa.transmissions.map(item => <article key={item.id}><p><strong>{label(item.status)}</strong> · {item.direction} {item.channel} · {item.destination || "Destination not recorded"}</p><p>{date(item.occurredAt)} · Receipt: {date(item.receivedAt)}</p>{item.proofDocumentId ? <button type="button" disabled={locked} onClick={() => void openDocument(item.proofDocumentId!, "Delivery proof")}>View delivery proof</button> : null}</article>) : <p>No transmissions recorded.</p>}</fieldset>
      {rfa.informationRequests.length ? <fieldset><legend>Information requested</legend>{rfa.informationRequests.map(item => <p key={item.id}>{item.requestText} · Due {date(item.dueAt)} · {item.respondedAt ? `Responded ${date(item.respondedAt)}` : "Awaiting response"}</p>)}</fieldset> : null}
      <RfaLifecycleControls {...options} rfa={rfa} disabled={!!locked} permissions={permissions.filter((permission): permission is "act" | "edit" => permission === "act" || permission === "edit")} onUpdated={adopt} />
      {rfa.events.length ? <details><summary>Request activity</summary>{rfa.events.map(event => <p key={event.id}>{label(event.type)} · {date(event.occurredAt)}</p>)}</details> : null}
      </>}
    </>}
  </div>;
}
