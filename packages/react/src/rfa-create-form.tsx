"use client";
import { useEffect, useState, type ReactElement } from "react";
import type { RfaClient, RfaCreationContext } from "@mindbill/browser";
import { RfaClaimSetup } from "./rfa-claim-setup";
import { RfaDraftForm, type RfaDraftInput, type RfaDraftFormProps } from "./rfa-draft-form";
import { TreatmentDraftShell, type TreatmentDraftAppearance } from "./treatment-draft-shared";

type Props = TreatmentDraftAppearance & {
  client: RfaClient;
  initialDraft?: RfaDraftInput;
  canCreateClaim?: boolean;
  draftFormProps?: Pick<RfaDraftFormProps, "searchDiagnosisCodes" | "organizationProfile">;
  claimId?: string;
  renderingProviderId?: string;
  onSave: (draft: RfaDraftInput, files: File[]) => Promise<void>;
};
/** Dashboard creation uses saved identities. Hosts may still supply a prepared draft. */
export function RfaCreateForm({ initialDraft, draftFormProps, onSave, ...props }: Props): ReactElement {
  const [files, setFiles] = useState<File[]>([]);
  const save = async (draft: RfaDraftInput) => {
    if (files.some(file => !file.name.toLowerCase().endsWith(".pdf") || !file.size || file.size > 25 * 1024 * 1024)) throw new Error("Choose nonempty PDF documents up to 25 MB each.");
    await onSave(draft, files);
  };
  const supportingDocuments = { files, onChange: setFiles };
  return initialDraft ? <RfaDraftForm {...props} {...draftFormProps} supportingDocuments={supportingDocuments} onSave={save} initialDraft={initialDraft} /> : <SavedIdentityForm {...props} onSave={save} supportingDocuments={supportingDocuments} {...(draftFormProps ? { draftFormProps } : {})} />;
}
function SavedIdentityForm({ client, claimId, renderingProviderId, onSave, canCreateClaim = false, draftFormProps, supportingDocuments, disabled = false, ...appearance }: Omit<Props, "initialDraft" | "onSave"> & { onSave: RfaDraftFormProps["onSave"]; supportingDocuments: NonNullable<RfaDraftFormProps["supportingDocuments"]> }): ReactElement {
  const [addingClaim, setAddingClaim] = useState(false);
  const [createdClaimId, setCreatedClaimId] = useState<string>();
  const effectiveClaimId = claimId ?? createdClaimId;
  const [searchInput, setSearchInput] = useState("");
  const [providerSearchInput, setProviderSearchInput] = useState("");
  const [query, setQuery] = useState({ search: "", providerSearch: "", cursor: "", providerCursor: "" });
  const [context, setContext] = useState<RfaCreationContext | null>(null);
  const [selectedClaim, setSelectedClaim] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    client.getCreationContext({ ...query, limit: 50, ...(effectiveClaimId ? { claimId: effectiveClaimId } : {}), ...(renderingProviderId ? { renderingProviderId } : {}) })
      .then(value => { if (active) { setContext(value); if (effectiveClaimId) setSelectedClaim(effectiveClaimId); if (renderingProviderId) setSelectedProvider(renderingProviderId); } })
      .catch(() => { if (active) setError("Saved claims and providers could not be loaded. Try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, query, effectiveClaimId, renderingProviderId, reload]);
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
  return <TreatmentDraftShell {...appearance} title="New authorization request" description="Choose an existing claim or add a new patient and injury here. Complete the treatment and attach supporting documents below.">
    {addingClaim ? <RfaClaimSetup client={client} disabled={disabled} onCancel={() => setAddingClaim(false)} onCreated={result => { supportingDocuments.onChange([]); setSearchInput(""); setCreatedClaimId(result.claimId); setSelectedClaim(result.claimId); setAddingClaim(false); setQuery(value => ({ ...value, search: "", cursor: "" })); }} /> : null}
    <div className="mbtd-grid">
      <fieldset disabled={disabled}><legend>Patient and claim</legend>
        {!claimId ? <label>Search patients or claim numbers<input type="search" maxLength={200} value={searchInput} onChange={event => { setSearchInput(event.target.value); supportingDocuments.onChange([]); setSelectedClaim(""); setCreatedClaimId(undefined); }} /></label> : null}
        <label>Saved patient claim<select disabled={locked || !!error} value={claim?.claimId ?? ""} onChange={event => { setSelectedClaim(event.target.value); supportingDocuments.onChange([]); }}>
          <option value="">Choose a patient claim</option>
          {context?.claims.map(value => <option key={value.claimId} value={value.claimId}>{value.employeeName} · {value.claimNumber || "Claim number not recorded"}{value.dateOfInjury ? ` · Injury ${value.dateOfInjury}` : ""}</option>)}
        </select></label>
        {!loading && !error && context?.claims.length === 0 ? <p>{query.search ? "No claims match this search. Try another patient name or claim number." : "No saved claims are available. Add a patient claim to start an authorization request; no bill is required."}</p> : null}
        {!claimId && canCreateClaim && client.provisionClaim && client.searchClaimsAdministrators ? <button type="button" disabled={locked || addingClaim} onClick={() => setAddingClaim(true)}>New patient and injury</button> : null}
        <div className="mbtd-actions">{query.cursor ? <button type="button" disabled={locked} onClick={() => { setSelectedClaim(""); supportingDocuments.onChange([]); setQuery(value => ({ ...value, cursor: "" })); }}>First claims page</button> : null}{context?.nextCursor ? <button type="button" disabled={locked} onClick={() => { setSelectedClaim(""); supportingDocuments.onChange([]); setQuery(value => ({ ...value, cursor: context.nextCursor! })); }}>Next claims page</button> : null}</div>
      </fieldset>
      <fieldset disabled={disabled}><legend>Requesting physician</legend>
        {!renderingProviderId ? <label>Search physicians by name or NPI<input type="search" maxLength={200} value={providerSearchInput} onChange={event => { setProviderSearchInput(event.target.value); setSelectedProvider(""); }} /></label> : null}
        <label>Saved rendering provider<select disabled={locked || !!error} value={provider?.id ?? ""} onChange={event => setSelectedProvider(event.target.value)}>
          <option value="">Choose a rendering provider</option>
          {context?.renderingProviders.map(value => <option key={value.id} value={value.id}>{value.name}{value.npi ? ` · NPI ${value.npi}` : ""}</option>)}
        </select></label>
        {!loading && !error && context?.renderingProviders.length === 0 ? <p>{query.providerSearch ? "No physicians match this search. Try another name or NPI." : "No saved rendering providers are available. Add a rendering provider in Settings, then reopen this form."}</p> : null}
        <div className="mbtd-actions">{query.providerCursor ? <button type="button" disabled={locked} onClick={() => { setSelectedProvider(""); setQuery(value => ({ ...value, providerCursor: "" })); }}>First physicians page</button> : null}{context?.renderingProvidersNextCursor ? <button type="button" disabled={locked} onClick={() => { setSelectedProvider(""); setQuery(value => ({ ...value, providerCursor: context.renderingProvidersNextCursor! })); }}>Next physicians page</button> : null}</div>
      </fieldset>
    </div>
    {loading ? <p role="status">Loading saved claims and providers…</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {claim && provider ? <p className="mbtd-note">Create a request for <strong>{claim.employeeName}</strong>, claim <strong>{claim.claimNumber || "number not recorded"}</strong>, with <strong>{provider.name}</strong>.</p> : null}
    {error ? <button type="button" disabled={locked} onClick={() => setReload(value => value + 1)}>Try again</button> : null}
    <RfaDraftForm embedded key={selectedClaim} {...appearance} {...draftFormProps} disabled={disabled || loading || addingClaim || !claim || !provider || !!error}
      initialDraft={{ claimId: "", patientId: "", renderingProviderId: "", employeeName: "", providerName: "", requestType: "new", reviewType: "prospective", items: [{ diagnosisCode: claim?.diagnosisCodes?.[0] ?? "", serviceDescription: "" }] }}
      identity={identity} supportingDocuments={supportingDocuments} savedDiagnosisCodes={claim?.diagnosisCodes ?? []} onSave={onSave} />
  </TreatmentDraftShell>;
}
