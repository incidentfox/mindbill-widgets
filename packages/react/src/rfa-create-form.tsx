"use client";
import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from "react";
import type { RfaClient, RfaCreationContext } from "@mindbill/browser";
import { RfaIdentitySelect } from "./rfa-identity-select";
import { RfaClaimSetup } from "./rfa-claim-setup";
import { RfaDraftForm, type RfaDraftInput, type RfaDraftFormProps } from "./rfa-draft-form";
import { TreatmentDraftShell, type TreatmentDraftAppearance } from "./treatment-draft-shared";
import { RfaPicker, useRfaFormDetails, type RfaFormDetails } from "./rfa-official-fields";

export type RfaClaimSelectorProps = {
  selectedClaimId: string;
  onSelectClaim: (claimId: string) => void;
  disabled: boolean;
  /** Show the chosen patient's printed name and date of birth before a claim is selected (official form). */
  onPreviewEmployee: (employee: { formName?: string; dateOfBirth?: string } | null) => void;
};

export type RfaProviderSelectorProps = {
  options: Array<{ id: string; label: string; npi?: string }>;
  selectedProviderId: string;
  onSelectProvider: (providerId: string) => void;
  search: string;
  onSearchProvider: (query: string) => void;
  hasNext: boolean;
  hasPrevious: boolean;
  onNext: () => void;
  onFirst: () => void;
  loading: boolean;
  error: string;
  disabled: boolean;
};

type Props = TreatmentDraftAppearance & {
  client: RfaClient;
  initialDraft?: RfaDraftInput;
  canCreateClaim?: boolean;
  searchableSelectors?: boolean;
  renderClaimSelector?: (props: RfaClaimSelectorProps) => ReactNode;
  renderProviderSelector?: (props: RfaProviderSelectorProps) => ReactNode;
  draftFormProps?: Pick<RfaDraftFormProps, "searchDiagnosisCodes" | "organizationProfile" | "searchClaimsAdministrators" | "getClaimsAdministratorDirectory" | "officialForm" | "managePracticeHref" | "onEditPractice" | "onAddPractice" | "onEditLocation" | "treatmentTemplates" | "onSaveTreatmentTemplate" | "onManageTreatmentTemplates" | "manageLocationsHref" | "onRefreshProfile" | "profilePending" | "onReview" | "onPreview">;
  claimId?: string;
  renderingProviderId?: string;
  previewAvailable?: boolean;
  onSave: (draft: RfaDraftInput, files: File[], intent?: "save" | "review" | "preview") => Promise<void>;
};
/** Dashboard creation uses saved identities. Hosts may still supply a prepared draft. */
export function RfaCreateForm({ initialDraft, draftFormProps, onSave, previewAvailable, ...props }: Props): ReactElement {
  const [files, setFiles] = useState<File[]>([]);
  const save = async (draft: RfaDraftInput, intent: "save" | "review" | "preview" = "save") => {
    if (files.some(file => !file.name.toLowerCase().endsWith(".pdf") || !file.size || file.size > 25 * 1024 * 1024)) throw new Error("Choose nonempty PDF documents up to 25 MB each.");
    await onSave(draft, files, intent);
  };
  const supportingDocuments = { files, onChange: setFiles };
  const contactProps = { ...(props.client.searchClaimsAdministrators ? { searchClaimsAdministrators: props.client.searchClaimsAdministrators } : {}), ...(props.client.getClaimsAdministratorDirectory ? { getClaimsAdministratorDirectory: props.client.getClaimsAdministratorDirectory } : {}), ...draftFormProps, ...(draftFormProps?.officialForm ? { onReview: (draft: RfaDraftInput) => save(draft, "review"), ...(previewAvailable ? { onPreview: (draft: RfaDraftInput) => save(draft, "preview") } : {}) } : {}) };
  return initialDraft ? <RfaDraftForm {...props} {...contactProps} supportingDocuments={supportingDocuments} onSave={save} initialDraft={initialDraft} /> : <SavedIdentityForm {...props} onSave={save} supportingDocuments={supportingDocuments} draftFormProps={contactProps} />;
}
function SavedIdentityForm({ client, claimId, renderingProviderId, onSave, canCreateClaim = false, searchableSelectors = false, renderClaimSelector, renderProviderSelector, draftFormProps, supportingDocuments, disabled = false, ...appearance }: Omit<Props, "initialDraft" | "onSave"> & { onSave: RfaDraftFormProps["onSave"]; supportingDocuments: NonNullable<RfaDraftFormProps["supportingDocuments"]> }): ReactElement {
  const [addingClaim, setAddingClaim] = useState(false);
  const [createdClaimId, setCreatedClaimId] = useState<string>();
  const [searchInput, setSearchInput] = useState("");
  const [providerSearchInput, setProviderSearchInput] = useState("");
  const [query, setQuery] = useState({ search: "", providerSearch: "", cursor: "", providerCursor: "" });
  const [context, setContext] = useState<RfaCreationContext | null>(null);
  const [selectedClaim, setSelectedClaim] = useState("");
  const effectiveClaimId = claimId ?? (renderClaimSelector ? selectedClaim : createdClaimId);
  const [selectedProvider, setSelectedProvider] = useState("");
  const effectiveProviderId = renderingProviderId ?? (renderProviderSelector ? selectedProvider : undefined);
  const selectHostProvider = useCallback((value: string) => {
    if (disabled || renderingProviderId) return;
    setSelectedProvider(value);
    setProviderSearchInput("");
    setQuery(query => ({ ...query, providerSearch: "", providerCursor: "" }));
  }, [disabled, renderingProviderId]);
  const onSupportingDocumentsChange = supportingDocuments.onChange;
  const selectHostClaim = useCallback((value: string) => {
    if (disabled || claimId || value === selectedClaim) return;
    setSelectedClaim(value); setCreatedClaimId(undefined); onSupportingDocumentsChange([]);
  }, [disabled, claimId, selectedClaim, onSupportingDocumentsChange]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const load = async () => {
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (!active) return;
          const request = { ...query, limit: 50, ...(effectiveClaimId ? { claimId: effectiveClaimId } : {}) };
          const [value, selectedContext] = await Promise.all([
            client.getCreationContext({ ...request, ...(renderingProviderId ? { renderingProviderId } : {}) }),
            effectiveProviderId && !renderingProviderId ? client.getCreationContext({ ...request, providerSearch: "", providerCursor: "", renderingProviderId: effectiveProviderId }) : Promise.resolve(null),
          ]);
          if (!active) return;
          const selectedProvider = (selectedContext ?? value).renderingProviders.find(provider => provider.id === effectiveProviderId);
          if (effectiveProviderId && !selectedProvider) {
            if (attempt < 2) { await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); continue; }
            setError("The selected rendering provider is not available yet. Try again after saving the provider.");
            return;
          }
          setContext(selectedProvider && !value.renderingProviders.some(provider => provider.id === selectedProvider.id) ? { ...value, renderingProviders: [selectedProvider, ...value.renderingProviders] } : value); if (effectiveClaimId) setSelectedClaim(effectiveClaimId); if (renderingProviderId) setSelectedProvider(renderingProviderId);
          return;
        }
      } catch { if (active) setError("Saved claims and providers could not be loaded. Try again."); }
      finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [client, query, effectiveClaimId, effectiveProviderId, renderingProviderId, reload]);
  // Saved records are edited in another tab; show the saved values again when the user returns.
  const refreshOnReturn = !!draftFormProps?.officialForm;
  useEffect(() => {
    if (!refreshOnReturn) return;
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState === "hidden" || Date.now() - last < 2000) return;
      last = Date.now(); setReload(value => value + 1);
    };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [refreshOnReturn]);
  const claim = context?.claims.find(value => value.claimId === selectedClaim);
  const provider = context?.renderingProviders.find(value => value.id === selectedProvider);
  const locked = disabled || loading;
  useEffect(() => {
    const timer = setTimeout(() => setQuery(value => value.search === searchInput.trim() ? value : ({ ...value, search: searchInput.trim(), cursor: "" })), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(value => value.providerSearch === providerSearchInput.trim() ? value : ({ ...value, providerSearch: providerSearchInput.trim(), providerCursor: "" })), 300);
    return () => clearTimeout(timer);
  }, [providerSearchInput]);
  const identity = {
    claimId: claim?.claimId ?? "", patientId: claim?.patientId ?? "", renderingProviderId: provider?.id ?? "",
    employeeName: claim?.employeeName ?? "", providerName: provider?.name ?? "",
    claimNumber: claim?.claimNumber ?? "", dateOfInjury: claim?.dateOfInjury,
    claimsAdminId: claim?.claimsAdminId, providerNpi: provider?.npi,
  };
  const official = !!draftFormProps?.officialForm;
  const [employeePreview, setEmployeePreview] = useState<{ formName?: string; dateOfBirth?: string } | null>(null);
  const claimFields = <>
        {renderClaimSelector ? renderClaimSelector({ selectedClaimId: effectiveClaimId ?? "", disabled: disabled || !!claimId, onSelectClaim: selectHostClaim, onPreviewEmployee: setEmployeePreview }) : <>
        {searchableSelectors ? <RfaIdentitySelect label="Patient and claim" placeholder="Choose a patient claim" searchPlaceholder="Search patients or claim numbers" query={searchInput} searchable={!claimId} disabled={disabled} loading={loading || query.search !== searchInput.trim()} error={error} value={claim?.claimId ?? ""}
          options={(context?.claims ?? []).map(value => ({ id: value.claimId, label: value.employeeName, detail: `${value.claimNumber || "Claim number not recorded"}${value.dateOfInjury ? ` · Injury ${value.dateOfInjury}` : ""}` }))}
          onSearch={value => { setSearchInput(value); supportingDocuments.onChange([]); setSelectedClaim(""); setCreatedClaimId(undefined); }}
          onSelect={value => { setSelectedClaim(value); supportingDocuments.onChange([]); }} /> : <>
        {!claimId ? <label>Search patients or claim numbers<input type="search" maxLength={200} value={searchInput} onChange={event => { setSearchInput(event.target.value); supportingDocuments.onChange([]); setSelectedClaim(""); setCreatedClaimId(undefined); }} /></label> : null}
        <label>Saved patient claim<select disabled={locked || !!error} value={claim?.claimId ?? ""} onChange={event => { setSelectedClaim(event.target.value); supportingDocuments.onChange([]); }}>
          <option value="">Choose a patient claim</option>
          {context?.claims.map(value => <option key={value.claimId} value={value.claimId}>{value.employeeName} · {value.claimNumber || "Claim number not recorded"}{value.dateOfInjury ? ` · Injury ${value.dateOfInjury}` : ""}</option>)}
        </select></label>
        </>}
        {!loading && !error && context?.claims.length === 0 ? <p>{query.search ? "No claims match this search. Try another patient name or claim number." : "No saved claims are available. Add a patient claim to start an authorization request; no bill is required."}</p> : null}
        {!claimId && canCreateClaim && client.provisionClaim && client.searchClaimsAdministrators ? <button type="button" disabled={locked || addingClaim} onClick={() => setAddingClaim(true)}>New patient and injury</button> : null}
        <div className="mbtd-actions">{query.cursor ? <button type="button" disabled={locked} onClick={() => { setSelectedClaim(""); supportingDocuments.onChange([]); setQuery(value => ({ ...value, cursor: "" })); }}>First claims page</button> : null}{context?.nextCursor ? <button type="button" disabled={locked} onClick={() => { setSelectedClaim(""); supportingDocuments.onChange([]); setQuery(value => ({ ...value, cursor: context.nextCursor! })); }}>Next claims page</button> : null}</div>
        </>}
  </>;
  const providerFields = <>
        {renderProviderSelector ? renderProviderSelector({ options: (context?.renderingProviders ?? []).map(value => ({ id: value.id, label: value.name, ...(value.npi ? { npi: value.npi } : {}) })), selectedProviderId: effectiveProviderId ?? "", search: providerSearchInput, onSearchProvider: value => { if (!disabled && !renderingProviderId) setProviderSearchInput(value); }, hasNext: !!context?.renderingProvidersNextCursor, hasPrevious: !!query.providerCursor, onNext: () => { if (!disabled && !renderingProviderId && context?.renderingProvidersNextCursor) setQuery(value => ({ ...value, providerCursor: context.renderingProvidersNextCursor! })); }, onFirst: () => { if (!disabled && !renderingProviderId) setQuery(value => ({ ...value, providerCursor: "" })); }, loading, error, disabled: disabled || !!renderingProviderId, onSelectProvider: selectHostProvider }) : <>
        {searchableSelectors ? <RfaIdentitySelect label="Requesting physician" placeholder="Choose a rendering provider" searchPlaceholder="Search physicians by name or NPI" query={providerSearchInput} searchable={!renderingProviderId} disabled={disabled} loading={loading || query.providerSearch !== providerSearchInput.trim()} error={error} value={provider?.id ?? ""}
          options={(context?.renderingProviders ?? []).map(value => ({ id: value.id, label: value.name, detail: value.npi ? `NPI ${value.npi}` : "" }))}
          onSearch={value => { setProviderSearchInput(value); setSelectedProvider(""); }} onSelect={setSelectedProvider} /> : <>
        {!renderingProviderId ? <label>Search physicians by name or NPI<input type="search" maxLength={200} value={providerSearchInput} onChange={event => { setProviderSearchInput(event.target.value); setSelectedProvider(""); }} /></label> : null}
        <label>Saved rendering provider<select disabled={locked || !!error} value={provider?.id ?? ""} onChange={event => setSelectedProvider(event.target.value)}>
          <option value="">Choose a rendering provider</option>
          {context?.renderingProviders.map(value => <option key={value.id} value={value.id}>{value.name}{value.npi ? ` · NPI ${value.npi}` : ""}</option>)}
        </select></label>
        </>}
        {!loading && !error && context?.renderingProviders.length === 0 ? <p>{query.providerSearch ? "No physicians match this search. Try another name or NPI." : "No saved rendering providers are available. Add a rendering provider in Settings, then reopen this form."}</p> : null}
        <div className="mbtd-actions">{query.providerCursor ? <button type="button" disabled={locked} onClick={() => { setSelectedProvider(""); setQuery(value => ({ ...value, providerCursor: "" })); }}>First physicians page</button> : null}{context?.renderingProvidersNextCursor ? <button type="button" disabled={locked} onClick={() => { setSelectedProvider(""); setQuery(value => ({ ...value, providerCursor: context.renderingProvidersNextCursor! })); }}>Next physicians page</button> : null}</div>
        </>}
  </>;
  // A search page omits the selected claim's date of birth and employer; load them for the chosen claim.
  const selectedDetails = useRfaFormDetails(client, claim?.claimId ?? "", provider?.id ?? "", official && !!claim && !effectiveClaimId);
  const formDetails: RfaFormDetails = {
    ...(claim ? { employee: selectedDetails?.employee ?? { formName: claim.employeeFormName, dateOfBirth: claim.dateOfBirth, employer: claim.employer } } : employeePreview ? { employee: employeePreview } : {}),
    ...(provider ? { physician: { specialty: provider.specialty } } : {}),
    ...(context?.returnFax ? { returnFax: context.returnFax } : {}),
    ...(context?.returnEmail ? { returnEmail: context.returnEmail } : {}),
  };
  return <TreatmentDraftShell {...appearance} title="New authorization request" description={official ? "DWC Form RFA" : renderClaimSelector ? "Choose a patient, then select their injury / claim. Complete the treatment and attach supporting documents below." : "Choose an existing claim or add a new patient and injury here. Complete the treatment and attach supporting documents below."}>
    {addingClaim ? <RfaClaimSetup client={client} disabled={disabled} onCancel={() => setAddingClaim(false)} onCreated={result => { supportingDocuments.onChange([]); setSearchInput(""); setCreatedClaimId(result.claimId); setSelectedClaim(result.claimId); setAddingClaim(false); setQuery(value => ({ ...value, search: "", cursor: "" })); }} /> : null}
    {official ? null : <div className="mbtd-grid">
      <fieldset disabled={disabled}><legend>Patient and claim</legend>{claimFields}</fieldset>
      <fieldset disabled={disabled}><legend>Requesting physician</legend>{providerFields}</fieldset>
    </div>}
    {loading && !(official && context) ? <p role="status">Loading saved claims and providers…</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {claim && provider && !official ? <p className="mbtd-note">Create a request for <strong>{claim.employeeName}</strong>, claim <strong>{claim.claimNumber || "number not recorded"}</strong>, with <strong>{provider.name}</strong>.</p> : null}
    {error ? <button type="button" disabled={locked} onClick={() => setReload(value => value + 1)}>Try again</button> : null}
    {/* The official form starts with fields above its lookups, so it never locks while a claim or physician is unchosen; saving validates them instead. */}
    {/* The official form keeps its lookups mounted inside the form, so it resets per claim through `identity` instead of remounting. */}
    <RfaDraftForm embedded key={official ? "official" : renderClaimSelector ? `${selectedClaim}:${claim?.claimId ?? ""}` : selectedClaim} {...appearance} {...draftFormProps} disabled={official ? disabled || addingClaim : disabled || loading || addingClaim || !claim || !provider || !!error}
      initialDraft={{ claimId: "", patientId: "", renderingProviderId: "", employeeName: "", providerName: "", requestType: "new", reviewType: "prospective", items: [{ diagnosisCode: (draftFormProps?.officialForm ? claim?.diagnosisCodes?.slice(0, 12).join(", ") : claim?.diagnosisCodes?.[0]) ?? "", serviceDescription: "" }] }}
      {...(official ? { formDetails, selectors: { claim: <fieldset className="mbrfa-plain" disabled={disabled}>{renderClaimSelector ? claimFields : <RfaPicker label="Patient and claim">{claimFields}</RfaPicker>}</fieldset>, physician: <fieldset className="mbrfa-plain" disabled={disabled}>{providerFields}</fieldset> } } : {})}
      identity={identity} supportingDocuments={supportingDocuments} savedDiagnosisCodes={claim?.diagnosisCodes ?? []} onSave={onSave} />
  </TreatmentDraftShell>;
}
