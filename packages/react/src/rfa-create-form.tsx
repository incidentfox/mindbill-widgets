"use client";
import { useEffect, useState, type ReactElement } from "react";
import type { RfaClient, RfaCreationContext } from "@mindbill/browser";
import { RfaDraftForm, type RfaDraftInput } from "./rfa-draft-form";
import { TreatmentDraftShell, type TreatmentDraftAppearance } from "./treatment-draft-shared";

type Props = TreatmentDraftAppearance & {
  client: RfaClient;
  initialDraft?: RfaDraftInput;
  claimId?: string;
  renderingProviderId?: string;
  onSave: (draft: RfaDraftInput) => Promise<void>;
};
/** Dashboard creation uses saved identities. Hosts may still supply a prepared draft. */
export function RfaCreateForm({ initialDraft, ...props }: Props): ReactElement {
  return initialDraft ? <RfaDraftForm {...props} initialDraft={initialDraft} /> : <SavedIdentityForm {...props} />;
}
function SavedIdentityForm({ client, claimId, renderingProviderId, onSave, disabled = false, ...appearance }: Omit<Props, "initialDraft">): ReactElement {
  const [searchInput, setSearchInput] = useState("");
  const [providerSearchInput, setProviderSearchInput] = useState("");
  const [query, setQuery] = useState({ search: "", providerSearch: "", cursor: "", providerCursor: "" });
  const [context, setContext] = useState<RfaCreationContext | null>(null);
  const [selectedClaim, setSelectedClaim] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [draft, setDraft] = useState<RfaDraftInput | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setContext(null);
    client.getCreationContext({ ...query, limit: 50, ...(claimId ? { claimId } : {}), ...(renderingProviderId ? { renderingProviderId } : {}) })
      .then(value => { if (active) setContext(value); })
      .catch(() => { if (active) setError("Saved claims and providers could not be loaded. Try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, query, claimId, renderingProviderId, reload]);
  const claim = context?.claims.find(value => value.claimId === selectedClaim);
  const provider = context?.renderingProviders.find(value => value.id === selectedProvider);
  const locked = disabled || loading;
  if (editing && draft) return <RfaDraftForm {...appearance} disabled={disabled} initialDraft={draft} onSave={onSave} onBack={value => { setDraft(value); setEditing(false); }} />;
  return <TreatmentDraftShell {...appearance} title="New authorization request" description="Choose the patient's claim and requesting physician, then add the requested treatment.">
    <div className="mbtd-grid">
      <fieldset disabled={disabled}><legend>Patient and claim</legend>
        {!claimId ? <form onSubmit={event => { event.preventDefault(); setSelectedClaim(""); setQuery(value => ({ ...value, search: searchInput.trim(), cursor: "" })); }}>
          <label>Search patients or claim numbers<input type="search" maxLength={200} value={searchInput} onChange={event => setSearchInput(event.target.value)} /></label>
          <button type="submit">Search claims</button>
        </form> : null}
        <label>Saved patient claim<select disabled={locked || !!error} value={claim?.claimId ?? ""} onChange={event => setSelectedClaim(event.target.value)}>
          <option value="">Choose a patient claim</option>
          {context?.claims.map(value => <option key={value.claimId} value={value.claimId}>{value.employeeName} · {value.claimNumber || "Claim number not recorded"}{value.dateOfInjury ? ` · Injury ${value.dateOfInjury}` : ""}</option>)}
        </select></label>
        {!loading && !error && context?.claims.length === 0 ? <p>{query.search ? "No claims match this search. Try another patient name or claim number." : "No saved claims are available. Add a patient claim or create a bill in your application, then refresh this list."}</p> : null}
        <div className="mbtd-actions">{query.cursor ? <button type="button" disabled={locked} onClick={() => { setSelectedClaim(""); setQuery(value => ({ ...value, cursor: "" })); }}>First claims page</button> : null}{context?.nextCursor ? <button type="button" disabled={locked} onClick={() => { setSelectedClaim(""); setQuery(value => ({ ...value, cursor: context.nextCursor! })); }}>Next claims page</button> : null}</div>
      </fieldset>
      <fieldset disabled={disabled}><legend>Requesting physician</legend>
        {!renderingProviderId ? <form onSubmit={event => { event.preventDefault(); setSelectedProvider(""); setQuery(value => ({ ...value, providerSearch: providerSearchInput.trim(), providerCursor: "" })); }}>
          <label>Search physicians by name or NPI<input type="search" maxLength={200} value={providerSearchInput} onChange={event => setProviderSearchInput(event.target.value)} /></label>
          <button type="submit">Search physicians</button>
        </form> : null}
        <label>Saved rendering provider<select disabled={locked || !!error} value={provider?.id ?? ""} onChange={event => setSelectedProvider(event.target.value)}>
          <option value="">Choose a rendering provider</option>
          {context?.renderingProviders.map(value => <option key={value.id} value={value.id}>{value.name}{value.npi ? ` · NPI ${value.npi}` : ""}</option>)}
        </select></label>
        {!loading && !error && context?.renderingProviders.length === 0 ? <p>{query.providerSearch ? "No physicians match this search. Try another name or NPI." : "No saved rendering providers are available. Add a rendering provider in Settings, then refresh this list."}</p> : null}
        <div className="mbtd-actions">{query.providerCursor ? <button type="button" disabled={locked} onClick={() => { setSelectedProvider(""); setQuery(value => ({ ...value, providerCursor: "" })); }}>First physicians page</button> : null}{context?.renderingProvidersNextCursor ? <button type="button" disabled={locked} onClick={() => { setSelectedProvider(""); setQuery(value => ({ ...value, providerCursor: context.renderingProvidersNextCursor! })); }}>Next physicians page</button> : null}</div>
      </fieldset>
    </div>
    {loading ? <p role="status">Loading saved claims and providers…</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {claim && provider ? <p className="mbtd-note">Create a request for <strong>{claim.employeeName}</strong>, claim <strong>{claim.claimNumber || "number not recorded"}</strong>, with <strong>{provider.name}</strong>.</p> : null}
    <div className="mbtd-actions"><button type="button" disabled={locked} onClick={() => setReload(value => value + 1)}>{error ? "Try again" : "Refresh saved choices"}</button><button type="button" className="mbtd-primary" disabled={locked || !!error || !claim || !provider} onClick={() => {
      if (locked || error || !claim || !provider) return;
      const retained = { ...draft };
      for (const key of ["claimNumber", "dateOfInjury", "claimsAdminId", "providerNpi"] as const) delete retained[key];
      if (draft?.renderingProviderId !== provider.id) { delete retained.providerFax; delete retained.providerPhone; }
      setDraft({ ...retained, claimId: claim.claimId, patientId: claim.patientId, renderingProviderId: provider.id, employeeName: claim.employeeName, providerName: provider.name,
        ...(claim.claimNumber ? { claimNumber: claim.claimNumber } : {}), ...(claim.dateOfInjury ? { dateOfInjury: claim.dateOfInjury } : {}), ...(claim.claimsAdminId ? { claimsAdminId: claim.claimsAdminId } : {}), ...(provider.npi ? { providerNpi: provider.npi } : {}),
        requestType: draft?.requestType ?? "new", reviewType: draft?.reviewType ?? "prospective", items: draft?.items ?? [{ diagnosisCode: "", serviceDescription: "" }] });
      setEditing(true);
    }}>Continue to treatment</button></div>
  </TreatmentDraftShell>;
}
