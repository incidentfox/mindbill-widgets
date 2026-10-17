"use client";
import type { RfaTreatmentTemplate, RfaTreatmentTemplateInput } from "./rfa-template-bar";
import { useEffect, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { getRfaLifecycleStatus, RFA_LIFECYCLE_LABELS, createRfaClient, createRfaLifecycleClient, type RfaSentOutsideInput, createBillReferenceClient, createOrganizationClient, type OrganizationProfileData, type OrganizationClientOptions, type RfaClient, type RfaRecord, type RfaDraftPreviewInput, type RfaTemplateRecord, type RfaLifecycleStatus, type RfaListResult, type RfaListQuery, type RfaSigningPreview, type BillClaimsAdministratorDirectory } from "@mindbill/browser";
import { RfaLink, rfaTitle, type RfaSelectionContext, type RfaRelatedLinks } from "./rfa-display";
import { RfaTaskBoard, type RfaTaskQuery } from "./rfa-task-board";
import { RfaTrackingContent } from "./rfa-tracking-panel";
import { RfaDetailHeader, rfaDetailCss, rfaPolishCss, rfaSimpleCss } from "./rfa-detail-header";
import { RfaRequestSummary } from "./rfa-request-summary";
import { ClaimsAdministratorDirectoryDialog } from "./claims-administrator-directory-dialog";
import { RfaPacketsPanel } from "./rfa-packets";
import { RfaDraftActions } from "./rfa-draft-actions";
import { RfaMarkSentDialog } from "./rfa-sent-outside";
import { RfaFilterBar } from "./rfa-filter-bar";
import { RfaDocumentViewer } from "./rfa-document-viewer";
import { RfaListView } from "./rfa-list-view";
import { RfaOverview, rfaDashboardCss } from "./rfa-overview";
import { RfaCreateForm, type RfaClaimSelectorProps, type RfaProviderSelectorProps } from "./rfa-create-form";
import { RfaDraftForm, type RfaDraftInput } from "./rfa-draft-form";
import { formatRfaPhone, useRfaFormDetails } from "./rfa-official-fields";
import { rfaSendFix } from "./rfa-send-fix";
import { RfaSendDialog } from "./rfa-send-dialog";
import { RfaDuplicateDialog, type RfaForwardContact } from "./rfa-duplicate-dialog";
import { RfaCard, RfaFacts, RfaPill, RfaStatusCard, rfaAddress, rfaCalendarDate, rfaCardsCss, rfaLifecycleTone, rfaStatusLabel, rfaRequestTypeLabel, rfaShortDate } from "./rfa-detail-cards";
import { canEditRfaDraft, rfaCanResend, rfaRecordToDraft, rfaDraftReplacement } from "./rfa-draft-edit";
import { RFA_CLAIMS_ADMINISTRATOR_SECTION } from "./rfa-contact-picker";
import { rfaDecisionDueText } from "./rfa-decision-due";
import { RfaLifecycleControls } from "./rfa-lifecycle-controls";
import { RfaDeliveryPanel, RfaPdfReview as PdfReview } from "./rfa-delivery-panel";
import { RfaProviderSignatureSetup } from "./rfa-provider-signature-setup";
import { TreatmentDraftShell, type TreatmentDraftAppearance } from "./treatment-draft-shared";
import { Select, Checkbox, FileInput } from "./form-controls";

export type RfaDashboardNavigation = {
  getTaskHref?: (query: RfaTaskQuery) => string;
  createHref?: string;
  allRfasHref?: string;
  tasksHref?: string;
  backHref?: string;
  backLabel?: string;
  /** Optional client-side routing callback. Links retain their href for new tabs and copying. */
  onNavigate?: (href: string) => void;
};
export type RfaDashboardProps = OrganizationClientOptions & TreatmentDraftAppearance & RfaRelatedLinks & {
  selectedRfaId?: string | null;
  selectedTreatmentId?: string;
  selectedResponseDocumentId?: string;
  onSelectRfa?: (id: string, context?: RfaSelectionContext) => void;
  getRfaHref?: (id: string, context?: RfaSelectionContext) => string;
  formPreviewUrl?: string;
  /** Official DWC-RFA creation layout; defaults to false for existing integrations. */
  officialForm?: boolean;
  /** Host in-place editors for the selected practice or location (official form). */
  onEditPractice?: (practiceId: string) => void;
  /** Opens the host's editor for a new practice; adds an "Add new practice" choice to the practice list. */
  onAddPractice?: () => void;
  onEditLocation?: (locationId: string | null, practiceId: string) => void;
  /** Saved sets of requested treatments for the official form, with host-owned saving and management. */
  treatmentTemplates?: RfaTreatmentTemplate[];
  onSaveTreatmentTemplate?: (template: RfaTreatmentTemplateInput) => void | Promise<void>;
  onManageTreatmentTemplates?: () => void;
  /** Practices or locations the host just saved; shown at once, ahead of the next profile reload. Pass a new object per save. */
  savedProfileChanges?: { billingProviders?: OrganizationProfileData["billingProviders"]; locations?: OrganizationProfileData["locations"] };
  managePracticeHref?: string;
  manageLocationsHref?: string;
  /** Opens the actual saved packet. Creation first saves and attaches files, then selects its detail view. */
  onPreviewRequest?: (id: string) => Promise<void>;
  /** Shows an unsaved request form as filled in so far; the Preview button then needs no saved draft. */
  onPreviewDraft?: (draft: RfaDraftInput) => Promise<void>;
  hideBackButton?: boolean;
  hideHeading?: boolean;
  /** Opt in to a list-first workspace with focused Request, Responses, Documents and History tabs. */
  layout?: "classic" | "simple";
  /** Open directly in the creation form when create permission is granted. */
  initialView?: "overview" | "create";
  /** Open the selected request with its Send dialog showing (official form). */
  initialDetailAction?: "send";
  /** Select the initial overview independently from the detail layout. */
  initialOverviewView?: "tasks" | "list";
  taskPresentation?: "dashboard" | "list";
  taskQuery?: RfaTaskQuery;
  renderTaskIdentity?: import("./rfa-task-board").RfaTaskBoardProps["renderTaskIdentity"];
  /** Identifies the signed-in organization. When set, the dashboard shows its last loaded counts at once on return while they refresh. */
  cacheKey?: string;
  initialStatus?: string;
  initialAgingBucket?: RfaListQuery["agingBucket"] | "";
  /** All RFAs filters to start from, e.g. from a dashboard link or the page URL. */
  initialPhysicianId?: string; initialDecisionDue?: RfaListQuery["decisionDue"] | ""; initialSearch?: string;
  /** The All RFAs list's first page as the host already loaded it for the initial filters. It is refreshed after mount. */
  initialList?: RfaListResult;
  /** The selected request as the host already loaded it (e.g. with the page), so it renders without waiting. It is refreshed after mount. */
  initialRecord?: RfaRecord;
  /** Called whenever the All RFAs filters change, so the host can keep them in its URL. */
  onFiltersChange?: (filters: { status: string; agingBucket: string; physicianId: string; decisionDue: string; search: string }) => void;
  /** Host routes for task, list, creation and return navigation; omitted routes keep embedded behavior. */
  navigation?: RfaDashboardNavigation;
  canCreateClaim?: boolean;
  /** Replace the creation form's patient/claim picker with host-owned patient and claim selection. */
  renderClaimSelector?: (props: RfaClaimSelectorProps) => ReactNode;
  /** Extra Forward destinations from the host, such as the claim's adjuster or other contacts. Entries without a fax or e-mail are ignored. */
  forwardContacts?: readonly RfaForwardContact[];
  /** Host-owned saved provider selection and provider creation. Newly selected providers are resolved through creation context. */
  renderProviderSelector?: (props: RfaProviderSelectorProps) => ReactNode;
  /** Reads a utilization review response so its treatment decisions open prefilled for a person to check. See RfaLifecycleControls. */
  readRfaResponse?: import("./rfa-lifecycle-controls").RfaLifecycleControlsProps["readResponse"];
  canManageProviderSignatures?: boolean;
  /** Host-owned physician signature setup inside the send dialog (for example draw or upload buttons). `missing` holds the send until
   * the host reports a saved signature; leave it undefined when the host cannot tell. Replaces the built-in PNG upload there. */
  renderSendSignatureSetup?: (props: { renderingProviderId: string; providerName: string }) => { missing?: boolean; setup: ReactNode };
  /** Optional separate admin session for saving physician signatures. */
  signatureSession?: OrganizationClientOptions;
  patientId?: string;
  claimId?: string;
  renderingProviderId?: string;
  initialDraft?: RfaDraftInput;
  /** PDFs to list as supporting documents when the creation form opens, e.g. the clinical report a host already has.
   * They upload as clinical reports only after the user saves the draft, exactly like files the user chooses. */
  initialSupportingDocuments?: readonly File[];
  /** Match these controls to the scopes your trusted server grants. Server authorization remains authoritative. */
  permissions?: readonly ("create" | "edit" | "sign" | "send" | "act")[];
  /** Sandbox never enables external fax or email delivery. */
  environment?: "sandbox" | "live";
  /** Stable identity of the authorized human signing on behalf of the physician. */
  actorReference?: string;
  onCreated?: (rfa: RfaRecord) => void;
  onContinue?: (rfa: RfaRecord) => void;
};
/** Last loaded dashboard counts per organization scope. */
const overviewCache = new Map<string, RfaListResult>();
const CLINICAL_STATUSES = ["draft", "ready", "submitted", "received", "incomplete", "under_review", "information_requested", "deferred", "approved", "modified", "denied", "mixed", "canceled", "closed"];
const label = (value: string) => value.replaceAll("_", " ");
const sentence = (value: string) => { const text = label(value); return text.charAt(0).toUpperCase() + text.slice(1); };
const documentSourceLabel = (source: string | undefined) => source ? ({ upload: "Upload", mindbill: "MindBill", fax: "Fax", bill: "Bill", injury: "Injury", library: "Library" } as Record<string, string>)[source] ?? sentence(source) : "—";
const documentTypeLabel = (type: string) => ({ rfa_form: "DWC Form RFA", clinical_report: "Clinical report", supporting_record: "Supporting record", ur_response: "Utilization review response", imr_form: "Independent medical review form", fax_cover: "Fax cover sheet" } as Record<string, string>)[type] ?? sentence(type);
const date = (value: string | null) => value ? new Date(value).toLocaleString() : "Not recorded";
const key = () => `rfa-widget-${globalThis.crypto.randomUUID()}`;
export { rfaCanResend } from "./rfa-draft-edit";
export function RfaDashboard({ sessionEndpoint, getSession, apiBaseUrl, fetch: fetchOverride, patientId, claimId, renderingProviderId, signatureSession, ...props }: RfaDashboardProps): ReactElement {
  const options = useMemo<OrganizationClientOptions>(() => ({ ...(sessionEndpoint ? { sessionEndpoint } : {}), ...(getSession ? { getSession } : {}), ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}) }), [sessionEndpoint, getSession, apiBaseUrl, fetchOverride]);
  const client = useMemo(() => createRfaClient(options), [options]);
  const signatureClient = useMemo(() => signatureSession ? createRfaClient(signatureSession) : client, [signatureSession, client]);
  // Remount state on credential identity changes so another organization never sees a prior selection.
  const identity = useMemo(() => ({ client, signatureClient, key: key() }), [client, signatureClient]);
  return <RfaDashboardContent key={`${identity.key}:${patientId ?? ""}:${claimId ?? ""}:${renderingProviderId ?? ""}`} {...props} {...(patientId ? { patientId } : {})} {...(claimId ? { claimId } : {})} {...(renderingProviderId ? { renderingProviderId } : {})} client={client} signatureClient={signatureClient} options={options} />;
}
function RfaDashboardContent({ client, signatureClient, options, patientId, claimId, renderingProviderId, initialDraft, initialSupportingDocuments, initialView = "overview", initialDetailAction, initialOverviewView, initialStatus = "", initialAgingBucket = "", initialPhysicianId = "", initialDecisionDue = "", initialSearch = "", onFiltersChange, initialRecord, initialList, taskPresentation, taskQuery, renderTaskIdentity, cacheKey, navigation, permissions = [], canCreateClaim = false, renderClaimSelector, renderProviderSelector, forwardContacts, officialForm = false, managePracticeHref, onEditPractice, onAddPractice, onEditLocation, treatmentTemplates, onSaveTreatmentTemplate, onManageTreatmentTemplates, savedProfileChanges, manageLocationsHref, onPreviewRequest, onPreviewDraft, canManageProviderSignatures = false, renderSendSignatureSetup, readRfaResponse, environment = "sandbox", actorReference, onCreated, onContinue, selectedRfaId, selectedTreatmentId, selectedResponseDocumentId: controlledResponseDocumentId, onSelectRfa, getRfaHref, getPatientHref, getClaimHref, getProviderHref, formPreviewUrl, hideBackButton = false, hideHeading = false, layout = "classic", ...appearance }: Omit<RfaDashboardProps, keyof OrganizationClientOptions> & { client: RfaClient; signatureClient: RfaClient; options: OrganizationClientOptions }): ReactElement {
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const references = useMemo(() => createBillReferenceClient(options), [options]);
  // Without host handlers, previews and response reading use the partner API directly and open in the built-in viewer.
  const [preview, setPreview] = useState<{ title: string; blob: Blob | null } | null>(null);
  const showPreview = async (title: string, load: () => Promise<Blob>) => {
    setPreview({ title, blob: null });
    try { const blob = await load(); if (active.current) setPreview(current => current?.title === title ? { title, blob } : current); }
    catch (error) { if (active.current) setPreview(null); throw error; }
  };
  const previewRequest = onPreviewRequest ?? (officialForm && client.previewForm ? (id: string) => showPreview("RFA packet preview", () => client.previewForm!(id, { packet: true })) : undefined);
  const previewDraft = onPreviewDraft ?? (officialForm && client.previewDraft ? (draft: RfaDraftInput) => showPreview("Unsigned DWC Form RFA preview", () => client.previewDraft!(draft as unknown as RfaDraftPreviewInput)) : undefined);
  const viewForm = !formPreviewUrl && client.previewForm ? (id: string) => { void showPreview(officialForm ? "RFA packet preview" : "DWC Form RFA", () => client.previewForm!(id, officialForm ? { packet: true } : {})).catch(() => undefined); } : undefined;
  const responseReader = readRfaResponse ?? (officialForm && client.readResponse ? client.readResponse : undefined);
  // Saved treatment templates come from the host when it supplies them, otherwise from the organization's templates.
  const hostTemplates = treatmentTemplates !== undefined || onSaveTreatmentTemplate !== undefined;
  const [savedTemplates, setSavedTemplates] = useState<RfaTreatmentTemplate[] | undefined>();
  const canCreate = permissions.includes("create");
  useEffect(() => {
    if (hostTemplates || !officialForm || !client.listTemplates || !canCreate) return;
    let current = true;
    client.listTemplates().then(records => { if (current) setSavedTemplates(records.filter(record => record.active).map(rfaTemplateFromRecord)); }).catch(() => { if (current) setSavedTemplates([]); });
    return () => { current = false; };
  }, [client, hostTemplates, officialForm, canCreate]);
  const saveTemplate = !hostTemplates && officialForm && client.saveTemplate && savedTemplates ? async (template: RfaTreatmentTemplateInput) => {
    const billingProviderId = profile?.billingProviders[0]?.id;
    if (!billingProviderId) throw new Error("Add a practice before saving templates.");
    const saved = await client.saveTemplate!({ name: template.name.trim(), billingProviderId, renderingProviderId: template.renderingProviderId ?? null, active: true, items: rfaTemplateRecordItems(template.items) });
    if (active.current) setSavedTemplates(current => [...(current ?? []).filter(item => item.id !== saved.id), rfaTemplateFromRecord(saved)]);
  } : undefined;
  const templates = hostTemplates ? treatmentTemplates : savedTemplates;
  const saveTreatmentTemplate = hostTemplates ? onSaveTreatmentTemplate : saveTemplate;
  const [profile, setProfile] = useState<OrganizationProfileData | undefined>();
  // Until the saved practices have loaded (or failed to), the form must not offer manual entry for them.
  const [profileSettled, setProfileSettled] = useState(false);
  useEffect(() => {
    if (!savedProfileChanges) return;
    const merge = <T extends { id: string }>(current: T[], saved: T[] | undefined) => saved?.length ? [...current.map(item => saved.find(next => next.id === item.id) ?? item), ...saved.filter(next => !current.some(item => item.id === next.id))] : current;
    setProfile(current => current ? { ...current, billingProviders: merge(current.billingProviders, savedProfileChanges.billingProviders), locations: merge(current.locations, savedProfileChanges.locations) } : current);
  }, [savedProfileChanges]);
  const draftFormProps = { officialForm, profilePending: !profile && !profileSettled, ...(previewDraft ? { onPreviewDraft: previewDraft } : {}), ...(officialForm && (templates || saveTreatmentTemplate) ? { treatmentTemplates: templates ?? [], onSaveTreatmentTemplate: saveTreatmentTemplate, onManageTreatmentTemplates } : {}), ...(onEditPractice ? { onEditPractice } : {}), ...(onAddPractice ? { onAddPractice } : {}), ...(onEditLocation ? { onEditLocation } : {}), ...(managePracticeHref ? { managePracticeHref } : {}), ...(manageLocationsHref ? { manageLocationsHref } : {}), onRefreshProfile: async () => { const next = await createOrganizationClient(options).getBillingProfile(); if (active.current) setProfile(next); }, ...(client.searchClaimsAdministrators ? { searchClaimsAdministrators: client.searchClaimsAdministrators } : {}), ...(client.getClaimsAdministratorDirectory ? { getClaimsAdministratorDirectory: client.getClaimsAdministratorDirectory } : {}), searchDiagnosisCodes: references.searchDiagnosisCodes, ...(profile ? { organizationProfile: profile } : {}) };
  const overviewCacheId = cacheKey ? JSON.stringify([cacheKey, patientId ?? null, claimId ?? null, renderingProviderId ?? null]) : "";
  const cachedOverview = overviewCacheId && (initialOverviewView ?? (layout === "simple" ? "list" : "tasks")) === "tasks" && !selectedRfaId && initialView !== "create" ? overviewCache.get(overviewCacheId) : undefined;
  // The All RFAs page can arrive with its first page already loaded by the host, so it renders complete at once.
  const seededList = !cachedOverview && initialList && initialOverviewView === "list" && !selectedRfaId && initialView !== "create" ? initialList : undefined;
  const [result, setResult] = useState<RfaListResult | null>(cachedOverview ?? seededList ?? null);
  const seededListLoad = useRef(Boolean(seededList));
  const [status, setStatus] = useState(initialStatus);
  // Servers without lifecycle counts are the exception; assume the current filters until a result says otherwise,
  // so the page never shows the legacy filters first and then swaps them.
  const lifecycleAvailable = result ? result.summary.byLifecycleStatus !== undefined : true;
  const [cursor, setCursor] = useState<string | undefined>();
  const [searchInput, setSearchInput] = useState(initialSearch); const [search, setSearch] = useState(initialSearch.trim());
  const [sortBy, setSortBy] = useState<NonNullable<RfaListQuery["sortBy"]>>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [creationWarning, setCreationWarning] = useState("");
  const [view, setView] = useState<"overview" | "rfas" | "treatments">(initialOverviewView ? initialOverviewView === "tasks" ? "overview" : "rfas" : layout === "simple" ? "rfas" : "overview");
  const [agingBucket, setAgingBucket] = useState<NonNullable<RfaListQuery["agingBucket"]> | "">(initialAgingBucket);
  const [physician, setPhysician] = useState(initialPhysicianId);
  const [decisionDue, setDecisionDue] = useState<NonNullable<RfaListQuery["decisionDue"]> | "">(initialDecisionDue);
  const [physicians, setPhysicians] = useState<{ id: string; name: string }[]>([]); const [physiciansLoading, setPhysiciansLoading] = useState(false);
  // Typing in the physician filter also asks the server, so physicians beyond the first page can be found.
  const searchPhysicians = (query: string) => {
    if (!query) return;
    client.getCreationContext({ providerSearch: query, limit: 50 }).then(context => { if (!active.current) return; setPhysicians(current => [...current, ...context.renderingProviders.filter(provider => !current.some(item => item.id === provider.id)).map(provider => ({ id: provider.id, name: provider.name }))].sort((a, b) => a.name.localeCompare(b.name))); }).catch(() => undefined);
  };
  const loadPhysicians = () => {
    if (physicians.length || physiciansLoading) return;
    setPhysiciansLoading(true);
    client.getCreationContext({ limit: 100 }).then(context => { if (active.current) setPhysicians(context.renderingProviders.map(provider => ({ id: provider.id, name: provider.name })).sort((a, b) => a.name.localeCompare(b.name))); }).catch(() => undefined).finally(() => { if (active.current) setPhysiciansLoading(false); });
  };
  const [resultVisible, setResultVisible] = useState(Boolean(cachedOverview ?? seededList));
  const resultView = useRef<"overview" | "list" | "">(cachedOverview ? "overview" : seededList ? "list" : "");
  const [localResponseDocumentId, setSelectedResponseDocumentId] = useState<string | undefined>();
  const [pageHistory, setPageHistory] = useState<Array<string | undefined>>([]);
  const resetPage = () => { setCursor(undefined); setPageHistory([]); };
  const [reload, setReload] = useState(0); const [error, setError] = useState("");
  const [localSelectedItem, setSelectedItem] = useState<string | null>(null);
  const [localSelected, setSelected] = useState<string | null>(null); const [creating, setCreating] = useState(initialView === "create" && permissions.includes("create"));
  const selected = selectedRfaId !== undefined ? selectedRfaId : localSelected;
  const selectedItem = selectedTreatmentId ?? localSelectedItem;
  const selectedResponseDocumentId = controlledResponseDocumentId ?? localResponseDocumentId;
  const relatedLinks = { ...(getPatientHref ? { getPatientHref } : {}), ...(getClaimHref ? { getClaimHref } : {}), ...(getProviderHref ? { getProviderHref } : {}) };
  const selectRfa = (id: string, context?: RfaSelectionContext) => {
    if (onSelectRfa) { onSelectRfa(id, context); return; }
    setSelectedItem(context?.treatmentId ?? null); setSelectedResponseDocumentId(context?.responseDocumentId); setSelected(id);
  };
  useEffect(() => {
    if (!creating && !selected) return;
    let active = true;
    createOrganizationClient(options).getBillingProfile().then(value => {
      if (active && Array.isArray(value?.billingProviders) && Array.isArray(value?.locations)) setProfile(value);
    }).catch(() => {}).finally(() => { if (active) setProfileSettled(true); });
    return () => { active = false; };
  }, [options, creating, selected]);
  const [loading, setLoading] = useState(!cachedOverview && !seededList); const createKeys = useRef(new Map<string, string>());
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput.trim()); setCursor(undefined); setPageHistory([]); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    if (selected || creating) return;
    let alive = true; let pending = false;
    const overview = view === "overview";
    const load = async (background = false) => {
      if (pending) return;
      pending = true;
      // Re-sorting or filtering a list keeps the rows on screen until the new ones arrive.
      if (!background) { setLoading(true); if (overview || resultView.current === "overview") setResultVisible(false); }
      try {
        // The overview shows only the counts, so it asks for a single row rather than a page of full requests.
        const value = await client.list({ ...(patientId ? { patientId } : {}), ...(search && view !== "overview" ? { search } : {}), sortBy, sortDirection, ...(claimId ? { claimId } : {}), ...(renderingProviderId ? { renderingProviderId } : {}), ...(view !== "overview" && status ? lifecycleAvailable ? { lifecycleStatus: status as import("@mindbill/browser").RfaLifecycleStatus } : { status } : {}), ...(view !== "overview" && agingBucket ? { agingBucket } : {}), ...(view !== "overview" && physician && !renderingProviderId ? { renderingProviderId: physician } : {}), ...(view !== "overview" && decisionDue ? { decisionDue } : {}), ...(cursor && view !== "overview" ? { cursor } : {}), limit: overview ? 1 : 50 });
        if (alive) { setResult(value); resultView.current = overview ? "overview" : "list"; setResultVisible(true); setError(""); if (overview && overviewCacheId) overviewCache.set(overviewCacheId, value); }
      } catch { if (alive) { setError(background ? "Updates are temporarily unavailable. Showing the last loaded requests; retrying automatically." : "Requests could not be loaded. Retrying automatically."); if (!background) setResultVisible(false); } }
      finally { pending = false; if (alive) setLoading(false); }
    };
    const seededFirst = seededListLoad.current; seededListLoad.current = false;
    void load((overview && overviewCache.get(overviewCacheId) === result && Boolean(result)) || seededFirst);
    const refresh = () => { if (document.visibilityState !== "hidden") void load(true); };
    const timer = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  // Whether lifecycle filtering exists only matters once a status is filtered; otherwise learning it must not reload.
  }, [client, patientId, claimId, renderingProviderId, search, sortBy, sortDirection, status, cursor, reload, view !== "overview" && status ? lifecycleAvailable : null, view, agingBucket, physician, decisionDue, selected, creating, overviewCacheId]);
  // The host keeps the list's filters in its URL, so back, refresh and shared links restore them.
  const filtersReported = useRef(false);
  useEffect(() => {
    if (view === "overview" || selected || creating) return;
    if (!filtersReported.current) { filtersReported.current = true; return; }
    onFiltersChange?.({ status, agingBucket, physicianId: physician, decisionDue, search });
  }, [status, agingBucket, physician, decisionDue, search, view, selected, creating]);
  const back = () => { setCreationWarning(""); setSelected(null); setSelectedItem(null); setSelectedResponseDocumentId(undefined); setCreating(false); setReload(value => value + 1); };
  const routeLink = (href: string, text: string, primary = false) => <a href={href} className={`mbrfa-route-link${primary ? " mbtd-primary" : ""}`} onClick={event => {
    if (!navigation?.onNavigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigation.onNavigate(href);
  }}>{text}</a>;
  return <TreatmentDraftShell {...appearance} hideHeading={hideHeading} title={selected || creating ? "Requests for authorization" : view === "overview" ? taskPresentation === "list" ? "RFA task list" : "RFA Tasks" : "All RFAs"} description={selected || creating ? "Review the request, supporting documents, and treatment decisions." : view === "overview" ? taskPresentation === "list" ? "Requests with follow-up tasks matching your selection." : "Open follow-up work, grouped by next action and age, plus requests awaiting treatment decisions below." : "Find a request or review the individual treatments it contains."}>
    <style>{`.mbrfa-list{display:grid;gap:10px;margin:16px 0}.mbrfa-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:16px;border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface)}.mbrfa-card strong{display:block}.mbrfa-card small{color:var(--mb-muted)}.mbrfa-status{text-transform:capitalize}.mbrfa-stack{display:grid;gap:16px}.mbrfa-check{display:flex!important;align-items:flex-start;gap:8px!important}.mbrfa-check input{min-height:20px;flex-shrink:0}.mbrfa-summary{display:flex;flex-wrap:wrap;gap:12px;padding:12px;background:var(--mb-soft);border-radius:var(--mb-control-radius)}@media(max-width:520px){.mbrfa-card{grid-template-columns:1fr}}`}</style>
    <style>{rfaDashboardCss}</style>
    {selected || creating ? !hideBackButton ? navigation?.backHref ? routeLink(navigation.backHref, navigation.backLabel ?? "← All requests") : <button type="button" onClick={back}>← All requests</button> : null : <>
      <div className="mbrfa-dashboard-heading"><span /><div className="mbtd-actions">{view === "overview" && taskPresentation === "list" && navigation?.tasksHref ? routeLink(navigation.tasksHref, "← RFA Tasks") : view === "overview" && navigation?.allRfasHref ? routeLink(navigation.allRfasHref, "All RFAs") : view !== "overview" && navigation?.tasksHref ? routeLink(navigation.tasksHref, "← RFA Tasks") : null}{permissions.includes("create") ? navigation?.createHref && !appearance.disabled ? routeLink(navigation.createHref, "+ Add RFA", true) : <button type="button" className="mbtd-primary" disabled={appearance.disabled} onClick={() => setCreating(true)}>+ Add RFA</button> : null}</div></div>
      {!navigation?.allRfasHref || !navigation?.tasksHref ? <nav className="mbrfa-nav" aria-label="Authorization views">{([ ["overview", "RFA tasks"], ["rfas", "All RFAs"] ] as const).map(([value, title]) => <button key={value} type="button" aria-current={(value === "overview" ? view === "overview" : view !== "overview") ? "page" : undefined} onClick={() => { setView(value); resetPage(); }}>{title}</button>)}</nav> : null}
    </>}
    {creationWarning ? <p role="alert">{creationWarning}</p> : null}
    {creating && permissions.includes("create") ? <RfaCreateForm {...appearance} previewAvailable={!!previewRequest} searchableSelectors={layout === "simple"} {...(renderClaimSelector ? { renderClaimSelector } : {})} {...(renderProviderSelector ? { renderProviderSelector } : {})} client={client} canCreateClaim={canCreateClaim} draftFormProps={draftFormProps} {...(initialDraft ? { initialDraft } : {})} {...(initialSupportingDocuments?.length ? { initialSupportingDocuments } : {})} {...(claimId ? { claimId } : {})} {...(renderingProviderId ? { renderingProviderId } : {})} onSave={async (draft, files, intent) => {
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
      if (!active.current) return;
      // "Send" on the form saves the draft and continues straight to its Send dialog, even when the host navigates to another page for it.
      if (intent === "review" && attached === files.length) { try { sessionStorage.setItem(`mbrfa-send:${saved.id}`, "1"); } catch { /* storage unavailable: the Send button is still on the request */ } }
      setCreating(false); selectRfa(saved.id); onCreated?.(saved);
      if (intent === "preview" && attached === files.length && previewRequest) { try { await previewRequest(saved.id); } catch { if (active.current) setCreationWarning("Draft saved. Preview could not be opened; open the request to try again."); } }
    }} /> : selected ? <RfaDetail {...(initialRecord ? { initial: initialRecord } : {})} layout={layout} key={selected} {...(forwardContacts ? { forwardContacts } : {})} {...(initialDetailAction ? { initialAction: initialDetailAction } : {})} {...relatedLinks} {...(formPreviewUrl ? { formPreviewUrl } : {})} id={selected} selectedItem={selectedItem} {...(selectedResponseDocumentId ? { selectedResponseDocumentId } : {})} client={client} signatureClient={signatureClient} options={options} onCopied={draft => { selectRfa(draft.id); onCreated?.(draft); }} draftFormProps={draftFormProps} canManageProviderSignatures={canManageProviderSignatures} {...(renderSendSignatureSetup ? { renderSendSignatureSetup } : {})} {...(responseReader ? { readRfaResponse: responseReader } : {})} {...(viewForm ? { onViewForm: viewForm } : {})} permissions={permissions} environment={environment} {...(actorReference ? { actorReference } : {})} {...(onContinue ? { onContinue } : {})} {...(appearance.disabled !== undefined ? { disabled: appearance.disabled } : {})} /> : <>
      {view === "overview" ? <RfaTaskBoard {...relatedLinks} {...(getRfaHref ? { getRfaHref } : {})} {...(cacheKey ? { cacheKey } : {})} {...(taskPresentation ? { presentation: taskPresentation } : {})} {...(taskQuery ? { query: taskQuery } : {})} {...(renderTaskIdentity ? { renderTaskIdentity } : {})} {...(navigation?.getTaskHref ? { getTaskHref: navigation.getTaskHref } : {})} {...(navigation?.onNavigate ? { onNavigate: navigation.onNavigate } : {})} embedded {...appearance} {...options} {...(patientId ? { patientId } : {})} {...(claimId ? { claimId } : {})} {...(renderingProviderId ? { renderingProviderId } : {})} permissions={permissions.filter((value): value is "act" => value === "act")} onSelect={(id, documentId) => selectRfa(id, documentId ? { responseDocumentId: documentId } : undefined)} /> : lifecycleAvailable ? <RfaFilterBar search={searchInput} onSearch={setSearchInput} searchPlaceholder="Search patient, physician, claim…"
        onClearAll={() => { setSearchInput(""); setSearch(""); setStatus(""); setAgingBucket(""); setPhysician(""); setDecisionDue(""); resetPage(); }}
        filters={[
          { key: "status", label: "Status", value: status, options: [{ value: "", label: "Any status" }, ...Object.keys(RFA_LIFECYCLE_LABELS).map(value => ({ value, label: rfaStatusLabel(value as keyof typeof RFA_LIFECYCLE_LABELS) }))], onChange: value => { setStatus(value); resetPage(); } },
          ...(renderingProviderId ? [] : [{ key: "physician", label: "Physician", value: physician, loading: physiciansLoading, onOpen: loadPhysicians, searchable: true, onSearch: searchPhysicians, options: [{ value: "", label: "Any physician" }, ...(physician && !physicians.some(item => item.id === physician) ? [{ value: physician, label: result?.data.find(rfa => rfa.renderingProviderId === physician)?.providerName ?? "Selected physician" }] : []), ...[...physicians, ...(result?.data ?? []).filter(rfa => rfa.renderingProviderId && rfa.renderingProviderId !== physician && !physicians.some(item => item.id === rfa.renderingProviderId)).map(rfa => ({ id: rfa.renderingProviderId, name: rfa.providerName }))].filter((item, index, all) => all.findIndex(other => other.id === item.id) === index).map(item => ({ value: item.id, label: item.name }))], onChange: (value: string) => { setPhysician(value); resetPage(); } }]),
          { key: "sent", label: "Sent", value: agingBucket, options: [{ value: "", label: "Any time" }, { value: "0_5", label: "0–5 days ago" }, { value: "6_14", label: "6–14 days ago" }, { value: "15_30", label: "15–30 days ago" }, { value: "31_plus", label: "31+ days ago" }], onChange: value => { setAgingBucket(value as typeof agingBucket); resetPage(); } },
          { key: "due", label: "Decision due", value: decisionDue, options: [{ value: "", label: "Any" }, { value: "overdue", label: "Overdue" }, { value: "next_7_days", label: "Within 7 days" }], onChange: value => { setDecisionDue(value as typeof decisionDue); resetPage(); } },
        ]} />
      : <div className="mbrfa-filters">
        <label className="mbrfa-search">Search requests<input type="search" maxLength={200} value={searchInput} placeholder="Patient, physician, claim, RFA, service or code" onChange={event => setSearchInput(event.target.value)} /></label>
        <label>Clinical status<Select value={status} onChange={(choice) => { setStatus(choice); resetPage(); }}><option value="">All statuses</option>{CLINICAL_STATUSES.map(value => <option key={value} value={value}>{label(value)}</option>)}</Select></label>
        {searchInput || status ? <button type="button" className="mbrfa-clear" onClick={() => { setSearchInput(""); setSearch(""); setStatus(""); resetPage(); }}>Clear filters</button> : null}
      </div>}
      {error ? <p role="alert">{error}</p> : null}{loading && !(resultVisible && result) ? <p className="mbrfa-loading" role="status">Loading authorization requests…</p> : null}
      {resultVisible && result ? view === "overview" ? taskPresentation === "list" ? null : <RfaOverview combined summary={result.summary} onSelect={async (nextStatus, bucket) => {
          const lifecycleStatus = nextStatus as RfaLifecycleStatus;
          const count = bucket ? result.summary.aging?.byLifecycleStatus[lifecycleStatus]?.[bucket] : nextStatus ? result.summary.byLifecycleStatus ? result.summary.byLifecycleStatus[lifecycleStatus] : result.summary.byStatus[nextStatus] : result.summary.total;
          if (count === 1) {
            try {
              const matches = await client.list({ ...(patientId ? { patientId } : {}), ...(claimId ? { claimId } : {}), ...(renderingProviderId ? { renderingProviderId } : {}), ...(nextStatus ? lifecycleAvailable ? { lifecycleStatus: lifecycleStatus } : { status: nextStatus } : {}), ...(bucket ? { agingBucket: bucket } : {}), limit: 2 });
              if (!active.current) return;
              if (matches.data.length === 1 && !matches.nextCursor) { selectRfa(matches.data[0]!.id); return; }
            } catch { /* Keep the filtered list available if the direct lookup fails. */ }
            if (!active.current) return;
          }
          if (navigation?.allRfasHref) {
            const url = new URL(navigation.allRfasHref, window.location.href);
            if (nextStatus) url.searchParams.set("status", nextStatus); else url.searchParams.delete("status");
            if (bucket) url.searchParams.set("agingBucket", bucket); else url.searchParams.delete("agingBucket");
            const href = url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.href;
            if (navigation.onNavigate) navigation.onNavigate(href); else window.location.assign(href);
            return;
          }
          setSearchInput(""); setSearch(""); setStatus(nextStatus); setAgingBucket(bucket ?? ""); resetPage(); setView("rfas"); }} /> : <>
        <div className="mbrfa-results-heading"><strong>{result.summary.total} {result.summary.total === 1 ? "request" : "requests"}{search ? " matching your search" : ""}</strong></div>
        <RfaListView {...relatedLinks} {...(getRfaHref ? { getRfaHref } : {})} complete={!result.nextCursor && !pageHistory.length} updating={loading} lifecycleAvailable={lifecycleAvailable} view={view === "treatments" ? "treatments" : "rfas"} onViewChange={setView} records={result.data} sortBy={sortBy} sortDirection={sortDirection} onSort={field => { setSortBy(field); setSortDirection(field === sortBy && sortDirection === "asc" ? "desc" : "asc"); resetPage(); }} onSelect={(id, itemId) => selectRfa(id, itemId ? { treatmentId: itemId } : undefined)} />
        {pageHistory.length || result.nextCursor ? <div className="mbrfa-pagination"><span>Request page {pageHistory.length + 1}</span><div>{pageHistory.length ? <button type="button" onClick={() => { setCursor(pageHistory.at(-1)); setPageHistory(value => value.slice(0, -1)); }}>Previous page</button> : null}{result.nextCursor ? <button type="button" onClick={() => { setPageHistory(value => [...value, cursor]); setCursor(result.nextCursor!); }}>Next page</button> : null}</div></div> : null}
      </> : null}
    </>}
    {preview ? <RfaDocumentViewer documents={[{ id: "preview", filename: preview.title, type: "Preview — not sent" }]} current={{ id: "preview", blob: preview.blob }} loading={!preview.blob} onSelect={() => undefined} onClose={() => setPreview(null)} /> : null}
  </TreatmentDraftShell>;
}
/** A saved organization template as the request form offers it. */
function rfaTemplateFromRecord(record: RfaTemplateRecord): RfaTreatmentTemplate {
  return { id: record.id, name: record.name, ...(record.renderingProviderId ? { renderingProviderId: record.renderingProviderId } : {}),
    items: record.items.map(item => {
      const { otherInformation, serviceDescription, procedureCode, quantity, units, frequency, duration } = item;
      return { diagnosisCode: "", serviceDescription, ...(procedureCode ? { procedureCode } : {}), ...(quantity ? { quantity } : {}), ...(units ? { units } : {}),
        ...(frequency ? { frequency } : {}), ...(duration ? { duration } : {}), ...(otherInformation ? { metadata: { otherInformation } } : {}) };
    }) };
}
/** The reusable fields of requested treatments, as the template API stores them. */
function rfaTemplateRecordItems(items: RfaTreatmentTemplateInput["items"]): RfaTemplateRecord["items"] {
  return items.filter(item => item.serviceDescription.trim()).map((item, index) => {
    const other = typeof item.metadata?.otherInformation === "string" ? item.metadata.otherInformation.trim() : "";
    return { externalId: `item-${index + 1}`, serviceDescription: item.serviceDescription.trim(),
      ...(item.procedureCode?.trim() ? { procedureCode: item.procedureCode.trim() } : {}),
      ...(item.quantity && item.quantity > 0 ? { quantity: item.quantity } : {}), ...(item.units && Number.isInteger(item.units) && item.units > 0 ? { units: item.units } : {}),
      ...(item.frequency?.trim() ? { frequency: item.frequency.trim() } : {}), ...(item.duration?.trim() ? { duration: item.duration.trim() } : {}),
      ...(other ? { otherInformation: other } : {}) };
  });
}
/** The current signed form and every clinical attachment, which a send includes by default. */
function defaultDocumentIds(value: RfaRecord): string[] {
  const forms = value.documents.filter(document => document.documentType === "rfa_form" && document.contentRevision === value.contentRevision);
  const currentForm = forms.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
  return value.documents.filter(document => document.id === currentForm?.id || ["clinical_report", "supporting_record"].includes(document.documentType)).map(document => document.id);
}
function RfaDetail({ initial, layout, forwardContacts, id, selectedItem, selectedResponseDocumentId, client, signatureClient, options, permissions, environment, actorReference, onContinue, disabled, draftFormProps, canManageProviderSignatures, renderSendSignatureSetup, readRfaResponse, onCopied, getPatientHref, getClaimHref, getProviderHref, formPreviewUrl, onViewForm, initialAction }: RfaRelatedLinks & { initial?: RfaRecord | undefined; layout: "classic" | "simple"; forwardContacts?: readonly RfaForwardContact[]; formPreviewUrl?: string; onViewForm?: (id: string) => void; initialAction?: "send" | undefined; draftFormProps: Pick<import("./rfa-draft-form").RfaDraftFormProps, "searchDiagnosisCodes" | "organizationProfile" | "searchClaimsAdministrators" | "getClaimsAdministratorDirectory" | "officialForm" | "managePracticeHref" | "onEditPractice" | "onAddPractice" | "onEditLocation" | "manageLocationsHref" | "onRefreshProfile" | "onReview" | "onPreview">; canManageProviderSignatures: boolean; renderSendSignatureSetup?: RfaDashboardProps["renderSendSignatureSetup"]; readRfaResponse?: RfaDashboardProps["readRfaResponse"]; onCopied: (rfa: RfaRecord) => void; id: string; selectedItem: string | null; selectedResponseDocumentId?: string; client: RfaClient; signatureClient: RfaClient; options: OrganizationClientOptions; permissions: readonly string[]; environment: string; actorReference?: string; onContinue?: (rfa: RfaRecord) => void; disabled?: boolean }): ReactElement {
  // A record the host loaded with the page renders at once; the request below then refreshes it quietly.
  const seeded = initial?.id === id ? initial : null;
  const [rfa, setRfa] = useState<RfaRecord | null>(seeded); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);
  const [duplicating, setDuplicating] = useState(false); const [markingSent, setMarkingSent] = useState(false);
  // A treatment card asked to record its decision; the Utilization Review section opens the dialog.
  const [decisionRequest, setDecisionRequest] = useState<{ itemId: string; nonce: number } | null>(null);
  const [sending, setSending] = useState(() => {
    if (initialAction === "send") return true;
    try { const key = `mbrfa-send:${id}`; if (sessionStorage.getItem(key)) { sessionStorage.removeItem(key); return true; } } catch { /* storage unavailable */ }
    return false;
  });
  const formDetails = useRfaFormDetails(client, rfa?.claimId ?? "", rfa?.renderingProviderId ?? "", editing && !!draftFormProps.officialForm);
  const tabId = useId();
  const simple = layout === "simple";
  const practiceContact = rfa?.requestingPractice ?? rfa?.formContactDefaults?.requestingPractice;
  const authorizationContact = rfa?.authorizationContact ?? rfa?.formContactDefaults?.authorizationContact;
  const [detailTab, setDetailTab] = useState<"details" | "history">("details");
  const tabs = simple ? [["details", "RFA Details"], ["history", "History & Activity"]] as const : [["details", "RFA details"], ["history", "History & activity"]] as const;
  const reveal = (suffix: string) => { setDetailTab("details"); setTimeout(() => document.getElementById(`${tabId}-${suffix}`)?.scrollIntoView?.({ block: "start", behavior: "smooth" }), 0); };
  useEffect(() => { if (selectedItem || selectedResponseDocumentId) setDetailTab("details"); }, [selectedResponseDocumentId, selectedItem]);
  const responseFocused = useRef(false);
  useEffect(() => { if (simple && rfa && selectedResponseDocumentId && !responseFocused.current) { responseFocused.current = true; document.getElementById(`${tabId}-review`)?.scrollIntoView?.({ block: "start" }); } }, [simple, rfa, selectedResponseDocumentId, tabId]);
  const alive = useRef(true); const pending = useRef(false); const loadGeneration = useRef(0); const seededRefresh = useRef(Boolean(seeded)); const keys = useRef(new Map<string, string>());
  const [descriptions, setDescriptions] = useState<Record<string, string>>(() => seeded ? Object.fromEntries(seeded.items.map(item => [item.id, item.diagnosisDescription ?? ""])) : {}); const [preview, setPreview] = useState<RfaSigningPreview | null>(null); const [previewPdf, setPreviewPdf] = useState<Blob | null>(null); const [attested, setAttested] = useState(false);
  const [documentIds, setDocumentIds] = useState<string[]>(() => seeded ? defaultDocumentIds(seeded) : []);
  const [editFiles, setEditFiles] = useState<File[]>([]);
  const [settingSignature, setSettingSignature] = useState(false);
  // Once a signature is saved here, an earlier "no saved signature" refusal no longer applies: Send works without a reload.
  const [signatureSaved, setSignatureSaved] = useState(false);
  const [directory, setDirectory] = useState<BillClaimsAdministratorDirectory | null>(null); const [directoryLoading, setDirectoryLoading] = useState(false); const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [openedDocument, setOpenedDocument] = useState<{ id: string; blob: Blob | null; title: string } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const adopt = (value: RfaRecord) => { if (!alive.current) return; setRfa(value); setOpenedDocument(null); setDescriptions(Object.fromEntries(value.items.map(item => [item.id, item.diagnosisDescription ?? ""]))); setPreview(null); setPreviewPdf(null); setAttested(false);  setDocumentIds(defaultDocumentIds(value)); };
  useEffect(() => { let active = true; const generation = ++loadGeneration.current; setError(""); client.get(id).then(value => { if (active && generation === loadGeneration.current) { if (seededRefresh.current) { seededRefresh.current = false; if (alive.current) setRfa(value); } else adopt(value); } }).catch(() => { if (active && generation === loadGeneration.current) setError("The request could not be loaded. Retrying automatically."); }); return () => { active = false; }; }, [client, id, reload]);
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
  }, [rfa, selectedItem, detailTab]);
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
  // The carrier accepted the request and then failed to deliver it: it reads as sent, but nothing arrived.
  const resendable = !!rfa && rfaCanResend(rfa);
  // Uploaded supporting documents can be taken off a request until it is sent; the server re-checks.
  const canRemoveDocument = (document: RfaRecord["documents"][number]) => !!unsent && !!client.removeDocument && permissions.includes("edit")
    && ["clinical_report", "supporting_record", "other"].includes(document.documentType) && document.filename !== "DWC-RFA-signing-preview.pdf";
  // Working files (the signing preview) are not part of the request; the signed DWC Form RFA stays listed.
  const listedDocuments = rfa ? rfa.documents.filter(document => !document.internal && document.filename !== "DWC-RFA-signing-preview.pdf") : [];
  const showSource = listedDocuments.some(document => !!document.source);
  const anyRemovable = listedDocuments.some(canRemoveDocument);
  const removeDocument = (document: RfaRecord["documents"][number]) => {
    if (!window.confirm(`Remove ${document.filename} from this request? It will not be sent.`)) return;
    void run(async () => {
      try { adopt(await client.removeDocument!(id, document.id, key())); }
      catch (reason) { throw new Error(reason instanceof Error && /transition is not allowed/i.test(reason.message) ? "This document can no longer be removed: the request was sent, or the document is part of the request record." : reason instanceof Error ? reason.message : "The document could not be removed."); }
      setDocumentIds(value => value.filter(item => item !== document.id));
    });
  };
  // Forward re-sends the packet that went out; it needs a sent, non-canceled request.
  const canForward = !!rfa && !unsent && !resendable && !!rfa.submittedAt && !["canceled", "incomplete"].includes(rfa.status) && permissions.includes("act");
  // The request shows one of a few statuses; what was decided is shown on each treatment.
  const statusPill = rfa ? <RfaPill tone={rfaLifecycleTone(rfa)}>{rfaStatusLabel(getRfaLifecycleStatus(rfa))}</RfaPill> : null;
  const reviewable = !!rfa && (!!rfa.submittedAt || ["submitted", "received", "under_review", "information_requested", "approved", "modified", "denied", "mixed", "incomplete", "deferred"].includes(rfa.status));
  const sendFix = rfa ? rfaSendFix(rfa, documentIds, descriptions) : null;
  const editRequest = () => { setSending(false); setDetailTab("details"); setEditFiles([]); setEditing(true); };
  // From a failed send: open the request at its claims administrator, the usual thing to correct.
  const editClaimsAdministrator = () => {
    editRequest();
    let tries = 0;
    const jump = () => {
      const section = document.getElementById(RFA_CLAIMS_ADMINISTRATOR_SECTION);
      if (!section) { if (++tries < 20) setTimeout(jump, 100); return; }
      // scroll-margin-top keeps the heading clear of a host's sticky top bar; then focus the claims administrator picker itself.
      section.scrollIntoView?.({ block: "start", behavior: "smooth" });
      const picker = section.querySelector<HTMLElement>(".mbctl-trigger:not(:disabled), input:not([type=hidden]):not(.mbctl-proxy):not(:disabled)");
      (picker ?? section).focus({ preventScroll: true });
    };
    setTimeout(jump, 0);
  };
  // The card layout reads documents in a full-screen viewer; the classic layout keeps them inline.
  const openDocument = (documentId: string, title: string) => { if (simple) setOpenedDocument({ id: documentId, blob: null, title }); void run(async () => { const blob = await client.getDocument(id, documentId); if (alive.current) setOpenedDocument(current => current && current.id !== documentId && simple ? current : { id: documentId, blob, title }); }); };
  return <div className={`mbrfa-detail mbrfa-stack${simple ? " mbrfa-simple" : ""}`} style={{ marginTop: 16 }}>
    <style>{rfaDetailCss + rfaPolishCss + rfaSimpleCss + (simple ? rfaCardsCss : "")}</style>
    {error ? <p role="alert">{error}</p> : null}{busy ? <p role="status">Working…</p> : null}
    {!rfa ? (!error ? <p role="status">Loading request…</p> : null) : <>
      {simple ? <RfaStatusCard rfa={rfa} /> : <RfaDetailHeader rfa={rfa} {...(getPatientHref ? { getPatientHref } : {})} {...(getClaimHref ? { getClaimHref } : {})} {...(getProviderHref ? { getProviderHref } : {})} />}
      <div className="mbrfa-detail-toolbar"><div>{simple ? <><h2>{rfa.displayReference || "Request for Authorization"}</h2>{statusPill}<RfaPill>{rfa.expedited ? "Expedited" : sentence(rfa.reviewType)}</RfaPill>{rfa.claimNumber ? <RfaPill tone="mono">Claim {rfa.claimNumber}</RfaPill> : null}</> : <><h2>{rfaTitle(rfa)}</h2>{rfa.displayReference ? <span className="mbrfa-reference">{rfa.displayReference}</span> : null}<span className="mbrfa-badge">{rfaStatusLabel(getRfaLifecycleStatus(rfa))}</span><span className="mbrfa-badge">{rfa.expedited ? "Expedited" : label(rfa.reviewType)}</span></>}</div><div className="mbtd-actions">
        {simple && permissions.includes("edit") && canEditRfaDraft(rfa) && !editing ? <button type="button" className="mbrfa-header-action" disabled={locked} onClick={() => { setDetailTab("details"); setEditing(true); }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>Edit request</button> : null}
        {simple && canForward ? <button type="button" disabled={locked} onClick={() => setDuplicating(true)}>Forward</button> : null}
        {formPreviewUrl ? <a className="mbrfa-form-link mbrfa-header-action" href={formPreviewUrl} target="_blank" rel="noopener noreferrer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></svg>View DWC Form RFA</a> : onViewForm ? <button type="button" className="mbrfa-form-link mbrfa-header-action" disabled={locked} onClick={() => onViewForm(rfa.id)}>View DWC Form RFA</button> : rfa.documents.some(document => document.documentType === "rfa_form" && document.contentRevision === rfa.contentRevision) ? <button type="button" disabled={locked} onClick={() => { const document = [...rfa.documents].reverse().find(document => document.documentType === "rfa_form" && document.contentRevision === rfa.contentRevision); if (document) void openDocument(document.id, "DWC Form RFA"); }}>View DWC Form RFA</button> : null}

      </div></div>
      {!editing ? <div className="mbrfa-detail-tabs" role="tablist" aria-label="RFA information" onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault(); const index = tabs.findIndex(([value]) => value === detailTab);
        const next = tabs[event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowLeft" ? -1 : 1) + tabs.length) % tabs.length]![0];
        setDetailTab(next); document.getElementById(`${tabId}-${next}-tab`)?.focus();
      }}>{tabs.map(([value, title]) => <button key={value} id={`${tabId}-${value}-tab`} type="button" role="tab" tabIndex={detailTab === value ? 0 : -1} aria-selected={detailTab === value} aria-controls={`${tabId}-${value}-panel`} onClick={() => setDetailTab(value)}>{title}</button>)}</div> : null}
      {editing ? <>
        <RfaDraftForm key={`${rfa.id}:${rfa.contentRevision}`} mode="edit" {...draftFormProps} formDetails={formDetails} onCancel={() => { setEditFiles([]); setEditing(false); setReload(value => value + 1); }} supportingDocuments={{ files: editFiles, onChange: setEditFiles, existingDocuments: <>{rfa.documents.filter(document => ["clinical_report", "supporting_record"].includes(document.documentType)).map(document => <div className="mbtd-actions" key={document.id}><span>{document.filename}</span><button type="button" disabled={locked} onClick={() => void openDocument(document.id, document.filename)}>View PDF</button></div>)}{openedDocument?.blob && !simple ? <PdfReview blob={openedDocument.blob} title={openedDocument.title} /> : null}</> }} initialDraft={rfaRecordToDraft(rfa)} disabled={!!locked} onSave={async draft => {
          if (pending.current || disabled) throw new Error("Wait for the current action to finish.");
          if (editFiles.some(file => !file.name.toLowerCase().endsWith(".pdf") || !file.size || file.size > 25 * 1024 * 1024)) throw new Error("Choose nonempty PDF documents up to 25 MB each.");
          pending.current = true; loadGeneration.current += 1; setBusy(true);
          try {
            const body = rfaDraftReplacement(draft, rfa.contentRevision);
            let saved = await client.updateDraft(id, body, operationKey("edit-draft", body));
            let attached = 0;
            try {
              for (const file of editFiles) {
                if (!alive.current) return;
                saved = await client.uploadDocument(id, { file, documentType: "clinical_report", contentRevision: saved.contentRevision }, operationKey("edit-upload", [saved.contentRevision, attached, file.name]));
                attached += 1;
              }
            } catch {
              if (alive.current) { adopt(saved); setEditFiles(editFiles.slice(attached)); setError(`Draft changes saved. ${attached} of ${editFiles.length} supporting documents attached. The remaining files are still selected; save again to retry.`); }
              return;
            }
            if (alive.current) { adopt(saved); setEditFiles([]); setEditing(false); }
          } finally { pending.current = false; if (alive.current) setBusy(false); }
        }} />
      </> : <>
      {simple ? <>
      <div id={`${tabId}-details-panel`} role="tabpanel" aria-labelledby={`${tabId}-details-tab`} hidden={detailTab !== "details"} className="mbrfa-stack">
      <div className="mbrfa-cards-2">
        <RfaCard title="Request Information"><RfaFacts entries={[
          ["Request type", rfaRequestTypeLabel(rfa)],
          ["Review", rfa.expedited ? "Expedited" : sentence(rfa.reviewType)],
          ["Written confirmation", rfa.writtenConfirmation || rfa.requestType === "oral_authorization_confirmation" ? "Yes – confirms a prior oral request" : "No"],
          ["Material change", rfa.materialChange],
          ["Received", rfa.submittedAt ? (rfa.receivedAt ? rfaShortDate(rfa.receivedAt) : "Not confirmed") : null],
          ["Decision due", rfa.submittedAt ? <>{rfaDecisionDueText(rfa)}{rfa.decisionDeadlineBasis ? <small> · {label(rfa.decisionDeadlineBasis)}</small> : null}</> : null],
          ["Status note", [rfa.incompleteReason, rfa.deferredReason, rfa.closedReason].filter(Boolean).join("\n")],
        ]} /></RfaCard>
        <RfaCard title="Employee Information"><RfaFacts showEmpty entries={[
          ["Name", <RfaLink href={getPatientHref?.(rfa)}>{rfa.employeeName}</RfaLink>],
          ["Claim Number", <RfaLink href={getClaimHref?.(rfa)}>{rfa.claimNumber || "Not recorded"}</RfaLink>],
          ["Date of Injury", rfaCalendarDate(rfa.dateOfInjury) || "Not recorded"],
          ["Date of Birth", rfaCalendarDate(rfa.employeeDateOfBirth)],
          ["Employer", rfa.employer],
        ]} /></RfaCard>
        <RfaCard title="Requesting Physician Information"><RfaFacts showEmpty entries={[
          ["Name", <RfaLink href={getProviderHref?.(rfa)}>{rfa.providerName}</RfaLink>],
          ["NPI Number", rfa.providerNpi],
          ["Specialty", rfa.providerSpecialty],
          ["Practice Name", practiceContact?.name],
          ["Contact Name", practiceContact?.contactName],
          ["Address", rfaAddress(practiceContact)],
          ["Phone", formatRfaPhone((practiceContact ? practiceContact.phone : rfa.providerPhone) ?? "")],
          ["Fax Number", formatRfaPhone(practiceContact?.fax?.trim() || rfa.providerFax || "")],
          ["E-mail Address", practiceContact?.email],
        ]} /></RfaCard>
        <RfaCard title="Claims Administrator Information"><RfaFacts showEmpty entries={[
          ["Company Name", <RfaLink onSelect={rfa.claimsAdminId ? () => setDirectoryOpen(true) : undefined}>{(authorizationContact ? authorizationContact.name : rfa.claimsAdminName) || "—"}</RfaLink>],
          ["Contact Name", authorizationContact?.contactName],
          ["Address", rfaAddress(authorizationContact)],
          ["Phone", formatRfaPhone(authorizationContact?.phone ?? "")],
          ["Fax Number", formatRfaPhone(authorizationContact?.fax ?? "")],
          ["E-mail Address", authorizationContact?.email],
        ]} /></RfaCard>
      </div>
      <ClaimsAdministratorDirectoryDialog open={directoryOpen} directory={directory} loading={directoryLoading} error={directoryError} onClose={() => setDirectoryOpen(false)} />
      <RfaTrackingContent embedded cards view="treatments" onRecordDecision={itemId => setDecisionRequest({ itemId, nonce: Date.now() })} rfa={rfa} options={options} disabled={!!locked} permissions={permissions.filter((permission): permission is "act" | "edit" => permission === "act" || permission === "edit")} onUpdated={adopt} />
      <RfaCard id={`${tabId}-documents`} title="Documents" count={listedDocuments.length} flush action={permissions.includes("edit") && unsent ? <label className="mbrfa-file-button">+ Add documents<FileInput appearance="overlay" multiple accept="application/pdf,.pdf" aria-label="Add supporting documents (PDF, up to 25 MB each)" disabled={locked} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void uploadFiles(files); }} /></label> : null}>
        {listedDocuments.length ? <div className="mbrfa-table-scroll" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void uploadFiles(Array.from(event.dataTransfer.files)); }}><table className="mbrfa-grid-table mbrfa-documents-table"><thead><tr>{unsent ? <th scope="col">Send</th> : null}<th scope="col">Type</th>{showSource ? <th scope="col">Source</th> : null}<th scope="col">File name</th><th scope="col" className="mbrfa-icon-col">View</th>{anyRemovable ? <th scope="col" className="mbrfa-icon-col">Delete</th> : null}</tr></thead><tbody>{listedDocuments.map(document => <tr key={document.id}>
          {unsent ? <td><Checkbox aria-label={`Include ${document.filename} in the packet`} disabled={locked || (document.documentType === "rfa_form" && document.contentRevision !== rfa.contentRevision)} checked={documentIds.includes(document.id)} onChange={event => { setDocumentIds(value => event.target.checked ? [...value.filter(item => document.documentType !== "rfa_form" || !rfa.documents.some(candidate => candidate.id === item && candidate.documentType === "rfa_form")), document.id] : value.filter(item => item !== document.id)); }} /></td> : null}
          <td>{documentTypeLabel(document.documentType)}</td>{showSource ? <td>{documentSourceLabel(document.source)}</td> : null}
          <td><button type="button" className="mbrfa-text-link" disabled={locked} onClick={() => void openDocument(document.id, document.filename)}>{document.filename}</button></td>
          <td className="mbrfa-icon-col"><button type="button" className="mbrfa-icon-button" aria-label={`View ${document.filename}`} title="View" disabled={locked} onClick={() => void openDocument(document.id, document.filename)}><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg></button></td>
          {anyRemovable ? <td className="mbrfa-icon-col">{canRemoveDocument(document) ? <button type="button" className="mbrfa-icon-button mbrfa-icon-danger" aria-label={`Delete ${document.filename}`} title="Delete" disabled={locked} onClick={() => removeDocument(document)}><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg></button> : null}</td> : null}
        </tr>)}</tbody></table></div> : <p className="mbrfa-sheet-body mbrfa-empty">{unsent ? "Add the clinical reports that support this request (PDF, up to 25 MB each)." : "No documents are attached to this request."}</p>}
      </RfaCard>
      {/* An unsent request has no review section, but a decision that came back anyway can still be recorded. */}
      {unsent ? decisionRequest ? <RfaLifecycleControls rows dialogOnly decisionRequest={decisionRequest} {...options} {...(readRfaResponse ? { readResponse: readRfaResponse } : {})} rfa={rfa} disabled={!!locked} permissions={permissions.filter((permission): permission is "act" | "edit" => permission === "act" || permission === "edit")} onUpdated={adopt} /> : null : reviewable ? <RfaCard id={`${tabId}-review`} title="Utilization Review" flush>
        {rfa.informationRequests.some(item => !item.respondedAt) ? <div className="mbrfa-rows">{rfa.informationRequests.filter(item => !item.respondedAt).map(item => <p key={item.id}><RfaPill tone="warn">Information requested</RfaPill> {item.requestText} · Due {date(item.dueAt)}</p>)}</div> : null}
        <RfaLifecycleControls rows {...(decisionRequest ? { decisionRequest } : {})} {...(selectedResponseDocumentId ? { selectedResponseDocumentId } : {})} {...options} {...(readRfaResponse ? { readResponse: readRfaResponse } : {})} rfa={rfa} disabled={!!locked} permissions={permissions.filter((permission): permission is "act" | "edit" => permission === "act" || permission === "edit")} onUpdated={adopt} />
      </RfaCard> : null}
      </div>
      </> : <>
      <div id={`${tabId}-details-panel`} role="tabpanel" aria-labelledby={`${tabId}-details-tab`} hidden={detailTab !== "details"} className="mbrfa-stack">
      <RfaRequestSummary rfa={rfa} hideTreatments {...(getPatientHref ? { getPatientHref } : {})} {...(getClaimHref ? { getClaimHref } : {})} {...(getProviderHref ? { getProviderHref } : {})} {...(rfa.claimsAdminId ? { onViewClaimsAdministrator: () => setDirectoryOpen(true) } : {})} />
      <ClaimsAdministratorDirectoryDialog open={directoryOpen} directory={directory} loading={directoryLoading} error={directoryError} onClose={() => setDirectoryOpen(false)} />
      <fieldset><legend>Review timeline</legend><div className="mbtd-grid"><span>Signed: {date(rfa.signedAt)}</span><span>Submitted: {date(rfa.submittedAt)}</span><span>Confirmed receipt: {date(rfa.receivedAt)}</span><span>Decision due: {rfaDecisionDueText(rfa)}</span></div>{rfa.decisionDeadlineBasis ? <p>{label(rfa.decisionDeadlineBasis)}</p> : !rfa.decisionDueAt ? <p>The review deadline appears after the required receipt evidence is recorded.</p> : null}{[rfa.incompleteReason, rfa.deferredReason, rfa.closedReason].filter(Boolean).map((reason,index) => <p key={index}>{reason}</p>)}</fieldset>
      {unsent && !rfa.signedAt && canSign ? <fieldset><legend>Diagnosis descriptions for signing</legend>{rfa.items.map(item => <label key={item.id}>Diagnosis description for {item.diagnosisCode}<input value={descriptions[item.id] ?? ""} disabled={locked} onChange={event => { setDescriptions(value => ({ ...value, [item.id]: event.target.value })); setPreview(null); setPreviewPdf(null); setAttested(false); }} /></label>)}</fieldset> : null}
      <fieldset><legend>Supporting documents</legend><p>{unsent ? "Include clinical substantiation. The signed DWC-RFA and cover sheet are assembled for you. Add one or more supporting PDFs." : "View the documents attached to this request. Saved packets preserve the exact files included with each submission."}</p>{rfa.documents.map(document => <div className="mbtd-actions" key={document.id}><label className="mbrfa-check">{unsent ? <Checkbox disabled={locked || (document.documentType === "rfa_form" && document.contentRevision !== rfa.contentRevision)} checked={documentIds.includes(document.id)} onChange={event => { setDocumentIds(value => event.target.checked ? [...value.filter(item => document.documentType !== "rfa_form" || !rfa.documents.some(candidate => candidate.id === item && candidate.documentType === "rfa_form")), document.id] : value.filter(item => item !== document.id));  }} /> : null}{document.filename} ({label(document.documentType)})</label><button type="button" disabled={locked} onClick={() => void openDocument(document.id, document.filename)}>View PDF</button></div>)}{permissions.includes("edit") && unsent ? <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void uploadFiles(Array.from(event.dataTransfer.files)); }} style={{ marginTop: 12, padding: 16, border: "1px dashed var(--mb-border)", borderRadius: 8 }}><label>Add supporting documents (PDF, up to 25 MB each)<FileInput multiple accept="application/pdf,.pdf" disabled={locked} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void uploadFiles(files); }} /></label><p>Choose files or drop them here.</p></div> : null}</fieldset>
      {openedDocument?.blob && !simple ? <PdfReview blob={openedDocument.blob} title={openedDocument.title} /> : null}
      {unsent && !rfa.signedAt ? <fieldset><legend>Review and sign</legend><p>An authorized human must review and approve the exact form before applying the requesting physician’s saved signature.</p>{canManageProviderSignatures && canSign ? <>{settingSignature ? <RfaProviderSignatureSetup client={signatureClient} renderingProviderId={rfa.renderingProviderId} providerName={rfa.providerName} disabled={!!locked} onSaved={() => { setSettingSignature(false); setSignatureSaved(true); setPreview(null); setPreviewPdf(null); setAttested(false); setReload(value => value + 1); }} onCancel={() => setSettingSignature(false)} /> : <button type="button" disabled={locked} onClick={() => setSettingSignature(true)}>Set up physician signature</button>}</> : null}{!canSign ? <p>Your integration needs signing permission and a signer identity to sign here.</p> : settingSignature ? null : <><button type="button" disabled={locked || rfa.items.some(item => !descriptions[item.id]?.trim())} onClick={() => void run(async () => { const body = { diagnosisDescriptions: descriptions }; const value = await client.prepareSigning(id, body, operationKey("preview", [body, rfa.contentRevision, reload])); const blob = await client.getDocument(id, value.previewDocumentId); if (alive.current) { setPreview(value); setPreviewPdf(blob); setAttested(false); } })}>Prepare signing preview</button>{preview && previewPdf ? <><PdfReview blob={previewPdf} title="DWC-RFA signing preview" /><label className="mbrfa-check"><Checkbox checked={attested} disabled={locked} onChange={event => setAttested(event.target.checked)} />I reviewed this exact form and am authorized by the requesting physician to apply their saved signature.</label><button className="mbtd-primary" type="button" disabled={locked || !attested || Date.parse(preview.expiresAt) <= Date.now()} onClick={() => void run(async () => { const body = { snapshotId: preview.id, contentHash: preview.contentHash, renderingProviderId: preview.renderingProviderId, physicianAuthorized: true as const, actorReference: actorReference! }; adopt(await client.sign(id, body, operationKey("sign", body))); })}>Sign reviewed request</button><p>Preview expires {date(preview.expiresAt)}. Prepare a new preview after refreshing if it expires.</p></> : null}</>}</fieldset> : null}
      {unsent ? <RfaDeliveryPanel key={`${rfa.id}:${rfa.contentRevision}:${rfa.signedAt ?? ""}:${rfa.submittedAt ?? ""}`} rfa={rfa} client={client} documentIds={documentIds} directory={directory} directoryLoading={directoryLoading} directoryError={directoryError} locked={!!locked} environment={environment} canSend={permissions.includes("send")} run={run} onUpdated={adopt} /> : null}

      {rfa.informationRequests.length ? <fieldset><legend>Information requested</legend>{rfa.informationRequests.map(item => <p key={item.id}>{item.requestText} · Due {date(item.dueAt)} · {item.respondedAt ? `Responded ${date(item.respondedAt)}` : "Awaiting response"}</p>)}</fieldset> : null}
      <div className="mbrfa-detail-card"><RfaPacketsPanel {...options} rfa={rfa} environment={environment === "live" ? "live" : "sandbox"} disabled={!!locked} permissions={permissions.includes("act") ? ["act"] : []} onForwarded={() => { void run(async () => adopt(await client.get(id))); }} /></div>
      <details className="mbrfa-detail-card" open={Boolean(selectedResponseDocumentId)}><summary>Receipt, responses and follow-up</summary><RfaLifecycleControls {...(selectedResponseDocumentId ? { selectedResponseDocumentId } : {})} {...options} {...(readRfaResponse ? { readResponse: readRfaResponse } : {})} rfa={rfa} disabled={!!locked} permissions={permissions.filter((permission): permission is "act" | "edit" => permission === "act" || permission === "edit")} onUpdated={adopt} /></details>
      </div>
      </>}
      <div hidden={simple && detailTab !== "history"} id={`${tabId}-history-panel`} role={detailTab === "history" ? "tabpanel" : undefined} aria-labelledby={detailTab === "history" ? `${tabId}-history-tab` : undefined} onClick={event => { const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#rfa-treatment-"]'); if (link) { event.preventDefault(); setDetailTab("details"); const target = link.hash.slice(1); setTimeout(() => { const element = document.getElementById(target); element?.scrollIntoView?.({ block: "start" }); element?.focus(); }, 0); } }}>
      {!simple || detailTab === "history" ? <RfaTrackingContent embedded cards={simple} {...(simple && permissions.includes("send") && rfa.transmissions.some(transmission => transmission.channel === "fax") ? { onRefreshDelivery: () => void run(async () => { adopt(await client.refreshFaxes(id, key())); }) } : {})} view={detailTab === "history" ? "history" : "treatments"} rfa={rfa} options={options} disabled={!!locked} permissions={permissions.filter((permission): permission is "act" | "edit" => permission === "act" || permission === "edit")} onUpdated={adopt} /> : null}
      {detailTab === "history" && permissions.includes("send") && !simple && (!simple || rfa.transmissions.some(transmission => transmission.channel === "fax")) ? simple ? <div className="mbtd-actions" style={{ marginTop: 16 }}><button type="button" disabled={locked} onClick={() => void run(async () => { adopt(await client.refreshFaxes(id, key())); })}>Check fax delivery status</button></div> : <details className="mbrfa-delivery-tools"><summary>Delivery tools</summary><button type="button" disabled={locked} onClick={() => void run(async () => { adopt(await client.refreshFaxes(id, key())); })}>Check fax delivery with provider</button></details> : null}
      </div>
      </>}
      {!editing || !simple ? <div className="mbrfa-bottom-actions">{simple ? statusPill : <span className="mbrfa-badge">{rfaStatusLabel(getRfaLifecycleStatus(rfa))}</span>}<div className="mbtd-actions">
        {!simple && permissions.includes("edit") && canEditRfaDraft(rfa) && !editing ? <button type="button" className="mbtd-primary" disabled={locked} onClick={() => { setDetailTab("details"); setEditing(true); }}>Edit request draft</button> : null}
        {onContinue ? <button type="button" disabled={locked} onClick={() => onContinue(rfa)}>Open in your application</button> : null}
        {simple ? <details className="mbrfa-more"><summary>More</summary><div><RfaDraftActions deleteWording {...options} rfa={rfa} disabled={!!locked} permissions={permissions.filter((permission): permission is "create" | "edit" => permission === "create" || permission === "edit")} onCopied={onCopied} onCanceled={adopt} /></div></details>
          : <RfaDraftActions {...options} rfa={rfa} disabled={!!locked} permissions={permissions.filter((permission): permission is "create" | "edit" => permission === "create" || permission === "edit")} onCopied={onCopied} onCanceled={adopt} />}
        {simple && canForward ? <button type="button" disabled={locked} onClick={() => setDuplicating(true)}>Forward</button> : null}
        {simple && (unsent || resendable) && permissions.includes("act") ? <button type="button" disabled={locked} title="You sent it yourself, outside MindBill" onClick={() => setMarkingSent(true)}>Mark as sent</button> : null}
        {simple && (unsent || resendable) ? <button type="button" className="mbtd-primary" disabled={locked} onClick={() => { if (!resendable && sendFix && permissions.includes("edit") && canEditRfaDraft(rfa)) editRequest(); else setSending(true); }}>{!resendable && sendFix && permissions.includes("edit") && canEditRfaDraft(rfa) ? sendFix.label : resendable ? "Send again" : "Send"}</button> : simple && reviewable && detailTab === "details" ? <button type="button" disabled={locked} onClick={() => reveal("review")}>Record response</button> : null}
      </div></div> : null}
      {openedDocument && simple ? <RfaDocumentViewer documents={listedDocuments.map(document => ({ id: document.id, filename: document.filename, type: documentTypeLabel(document.documentType) }))} current={openedDocument} loading={!openedDocument.blob} onSelect={documentId => { const document = listedDocuments.find(item => item.id === documentId); if (document) openDocument(document.id, document.filename); }} onClose={() => setOpenedDocument(null)} /> : null}
      {simple && markingSent && (unsent || resendable) ? <RfaMarkSentDialog rfa={rfa} options={options} records={client} allowProof={!!unsent} onSaved={value => { adopt(value); setMarkingSent(false); }} onClose={() => setMarkingSent(false)} /> : null}
      {simple && duplicating && !unsent ? <RfaDuplicateDialog rfa={rfa} {...(forwardContacts ? { forwardContacts } : {})} options={options} records={client} canUpload={permissions.includes("edit")} onUpdated={adopt} directory={directory} directoryLoading={directoryLoading} directoryError={directoryError} environment={environment} canAct={permissions.includes("act")}
        onSent={() => { void run(async () => adopt(await client.get(id))); }} onClose={() => setDuplicating(false)} /> : null}
      {simple && sending && (unsent || resendable) ? (() => { const hostSignature = renderSendSignatureSetup?.({ renderingProviderId: rfa.renderingProviderId, providerName: rfa.providerName }); return <RfaSendDialog {...(permissions.includes("edit") && canEditRfaDraft(rfa) ? { onFix: resendable ? editClaimsAdministrator : editRequest } : {})} resend={resendable} {...(environment !== "live" && permissions.includes("act") ? { recordSimulatedSend: (rfaId: string, input: RfaSentOutsideInput, key: string) => createRfaLifecycleClient(options).recordSentOutside(rfaId, input, key) } : {})} rfa={rfa} client={client} documentIds={documentIds} diagnosisDescriptions={descriptions} directory={directory} directoryLoading={directoryLoading} directoryError={directoryError} environment={environment} canSend={permissions.includes("send")} canSign={canSign} actorReference={actorReference} previewUrl={formPreviewUrl}
        signatureMissing={hostSignature ? hostSignature.missing : signatureSaved ? false : undefined}
        signatureSetup={hostSignature ? hostSignature.setup : canManageProviderSignatures && canSign ? settingSignature ? <RfaProviderSignatureSetup client={signatureClient} renderingProviderId={rfa.renderingProviderId} providerName={rfa.providerName} disabled={!!locked} onSaved={() => { setSettingSignature(false); setSignatureSaved(true); }} onCancel={() => setSettingSignature(false)} /> : <p><button type="button" className="mbrfa-text-link" onClick={() => setSettingSignature(true)}>Set up or replace the physician's saved signature</button></p> : null}
        onUpdated={adopt} onSent={value => { adopt(value); setSending(false); }} onClose={() => setSending(false)} />; })() : null}
    </>}
  </div>;
}
