"use client";

import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import type { OrganizationClient, OrganizationProfileData, OrganizationRenderingProviderInput } from "@mindbill/browser";
import { Checkbox, FileInput } from "./form-controls";
import { signaturePngBase64 } from "./rfa-provider-signature-setup";

// Practice settings: every doctor (rendering provider) under one practice, each with an
// Edit button, an obvious "+ Add provider", inactive ones marked, and a per-doctor
// signature that prints in CMS-1500 Box 31 on that doctor's bills.

type SavedRenderingProvider = NonNullable<OrganizationProfileData["renderingProviders"]>[number];

export const renderingProvidersCss = `
.mbrp-list{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:8px}
.mbrp-item{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);padding:12px 14px;background:var(--mb-surface)}
.mbrp-item[data-inactive=true]{opacity:.72;background:color-mix(in srgb,var(--mb-muted) 6%,var(--mb-surface))}
.mbrp-item[data-editing=true]{border-color:var(--mb-accent)}
.mbrp-who{display:grid;gap:3px;min-width:0}.mbrp-who strong{font-size:15px}.mbrp-meta{color:var(--mb-muted);font-size:13px}
.mbrp-badge{display:inline-block;margin-left:8px;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:750;vertical-align:middle;background:color-mix(in srgb,var(--mb-muted) 16%,var(--mb-surface));color:var(--mb-muted)}
.mbrp-sig{font-size:12px;font-weight:650}.mbrp-sig[data-on=true]{color:var(--mb-success)}.mbrp-sig[data-on=false]{color:var(--mb-muted)}
.mbrp-editor{border:1px solid var(--mb-accent);border-radius:var(--mb-radius);padding:18px;margin:4px 0 14px;background:color-mix(in srgb,var(--mb-accent) 3%,var(--mb-surface))}
.mbrp-editor h4{margin:0 0 14px;font-size:16px}
.mbrp-signature{margin-top:18px;border-top:1px solid var(--mb-border);padding-top:16px;display:grid;gap:12px}
.mbrp-signature h5{margin:0;font-size:15px}
.mbrp-signature-preview{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.mbrp-signature-preview img{max-width:260px;max-height:80px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:#fff;padding:6px}
.mbrp-hint{border-left:3px solid var(--mb-accent);background:color-mix(in srgb,var(--mb-accent) 7%,var(--mb-surface));padding:9px 12px;border-radius:var(--mb-control-radius);font-size:13px;color:var(--mb-text)}
.mbrp-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.mbrp-ok{color:var(--mb-success);font-weight:700}
`;

const blankRendering = (): OrganizationRenderingProviderInput => ({ name: "", npi: "", specialty: "", taxonomy: "", active: true });

function editable(provider: SavedRenderingProvider): OrganizationRenderingProviderInput {
  const input: OrganizationRenderingProviderInput & Partial<Pick<SavedRenderingProvider, "signatureConfigured" | "signatureOnClaimForm">> = { ...provider };
  delete input.signatureConfigured;
  delete input.signatureOnClaimForm;
  return input;
}

export type RenderingProvidersSettingsProps = {
  client: OrganizationClient;
  providers: readonly SavedRenderingProvider[];
  disabled?: boolean;
  onSaved: (profile: OrganizationProfileData) => void;
  onError?: (error: Error) => void;
};

/** Saved rendering providers (doctors) with Edit, "+ Add provider", inactive markers, and per-doctor signatures. */
export function RenderingProvidersSettings({ client, providers, disabled, onSaved, onError }: RenderingProvidersSettingsProps): ReactElement {
  const [editing, setEditing] = useState<OrganizationRenderingProviderInput | null>(() => (providers.length ? null : blankRendering()));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const locked = Boolean(disabled) || busy;
  const current = editing?.id ? providers.find((item) => item.id === editing.id) : undefined;

  const save = async () => {
    if (!editing || !editing.name.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const before = new Set(providers.map((item) => item.id));
      const next = await client.saveBillingProfile({ renderingProviders: [editing] });
      onSaved(next);
      const saved = editing.id
        ? next.renderingProviders?.find((item) => item.id === editing.id)
        : next.renderingProviders?.find((item) => !before.has(item.id) && item.npi === editing.npi)
          ?? next.renderingProviders?.find((item) => !before.has(item.id));
      // Keep the saved doctor open so their signature can be added right away.
      if (saved) setEditing(editable(saved));
      setNotice(saved && !saved.signatureOnClaimForm ? `Saved ${saved.name}. Add their signature below so it prints on their bills.` : "Saved to MindBill.");
    } catch (caught) {
      const failure = caught instanceof Error ? caught : new Error("The provider could not be saved.");
      setError(failure.message); onError?.(failure);
    } finally { setBusy(false); }
  };

  const field = (label: string, key: "name" | "npi" | "taxonomy" | "specialty" | "licenseNumber" | "licenseState", transform: (value: string) => string = (value) => value) => (
    <label className="mbob-field">{label}
      <input value={(editing?.[key] as string | undefined) ?? ""} disabled={locked} onChange={(event) => { const value = transform(event.target.value); setEditing((c) => (c ? { ...c, [key]: value } : c)); }} />
    </label>
  );

  return <div className="mbrp">
    <p className="mbob-status" style={{ marginBottom: 12 }}>Every doctor who renders services for this practice. Choose the doctor on each bill; their NPI and signature print on the claim form.</p>
    {providers.length ? <ul className="mbrp-list" aria-label="Saved rendering providers">
      {providers.map((item) => <li className="mbrp-item" key={item.id} data-inactive={item.active === false} data-editing={editing?.id === item.id}>
        <div className="mbrp-who">
          <span><strong>{item.name || "Unnamed provider"}</strong>{item.active === false ? <span className="mbrp-badge">Inactive</span> : null}</span>
          <span className="mbrp-meta">{[item.npi ? `NPI ${item.npi}` : "No NPI", item.specialty, item.taxonomy].filter(Boolean).join(" · ")}</span>
          <span className="mbrp-sig" data-on={item.signatureOnClaimForm === true}>{item.signatureOnClaimForm ? "✓ Signature prints on bills" : "No signature — bills print “Signature on File”"}</span>
        </div>
        <button className="mbob-secondary" type="button" disabled={locked} aria-label={`Edit ${item.name}`} onClick={() => { setNotice(""); setError(""); setEditing(editable(item)); }}>Edit</button>
      </li>)}
    </ul> : null}
    {editing ? <div className="mbrp-editor" role="group" aria-label={editing.id ? `Edit ${current?.name ?? editing.name}` : "Add provider"}>
      <h4>{editing.id ? `Edit ${current?.name ?? editing.name}` : "Add provider"}</h4>
      <div className="mbob-grid">
        {field("Doctor / rendering provider name", "name")}
        {field("Rendering NPI", "npi")}
        {field("Taxonomy", "taxonomy")}
        {field("Specialty", "specialty")}
        {field("License number", "licenseNumber")}
        {field("License state", "licenseState", (value) => value.toUpperCase().slice(0, 2))}
        <label><Checkbox disabled={locked} checked={editing.active !== false} onChange={(event) => { const active = event.target.checked; setEditing((c) => (c ? { ...c, active } : c)); }} /> Active — available for new bills</label>
      </div>
      <div className="mbob-actions">
        <button className="mbob-secondary" type="button" disabled={locked} onClick={() => { setEditing(null); setNotice(""); setError(""); }}>{providers.length ? "Close" : "Cancel"}</button>
        <button className="mbob-save" type="button" disabled={locked || !editing.name.trim()} onClick={() => { void save(); }}>{busy ? "Saving…" : editing.id ? "Save provider" : "Add provider"}</button>
      </div>
      {notice ? <p className="mbob-done" role="status" style={{ marginTop: 10 }}>{notice}</p> : null}
      {error ? <div className="mbob-error" role="alert">{error}</div> : null}
      {editing.id ? <ProviderSignature key={editing.id} client={client} providerId={editing.id} providerName={current?.name ?? editing.name} configured={current?.signatureConfigured === true} onClaimForm={current?.signatureOnClaimForm === true} disabled={locked} onSaved={onSaved} {...(onError ? { onError } : {})} />
        : <p className="mbrp-hint" style={{ marginTop: 14 }}>After you add the provider, you can upload their signature.</p>}
    </div> : null}
    <button className="mbob-add" type="button" disabled={locked} onClick={() => { setNotice(""); setError(""); setEditing(blankRendering()); }}>+ Add provider</button>
  </div>;
}

export type ProviderSignatureProps = {
  client: OrganizationClient;
  providerId: string;
  providerName: string;
  configured: boolean;
  onClaimForm: boolean;
  disabled?: boolean;
  onSaved: (profile: OrganizationProfileData) => void;
  onError?: (error: Error) => void;
};

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export function ProviderSignature({ client, providerId, providerName, configured, onClaimForm, disabled, onSaved, onError }: ProviderSignatureProps): ReactElement {
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(configured);
  const [replacing, setReplacing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [chosenUrl, setChosenUrl] = useState<string | null>(null);
  const [actor, setActor] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    if (!configured) { setLoading(false); return; }
    setLoading(true);
    client.getRenderingProviderSignature(providerId)
      .then((signature) => { if (alive) setSaved(signature.contentBase64 && signature.contentType ? `data:${signature.contentType};base64,${signature.contentBase64}` : null); })
      .catch(() => { if (alive) setSaved(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [client, providerId, configured]);
  useEffect(() => () => { if (chosenUrl) URL.revokeObjectURL(chosenUrl); }, [chosenUrl]);

  const showUploader = !configured || replacing || !onClaimForm;
  const submit = async () => {
    if (!file || !authorized || !actor.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const contentBase64 = await signaturePngBase64(file);
      const next = await client.saveRenderingProviderSignature(providerId, { contentBase64, physicianAuthorized: true, actorReference: actor.trim() });
      setSaved(`data:image/png;base64,${contentBase64}`);
      setReplacing(false); setFile(null); setChosenUrl(null); setAuthorized(false); setDone(true);
      if (input.current) input.current.value = "";
      onSaved(next);
    } catch (caught) {
      setError("The signature could not be saved. Choose a PNG or JPEG image of the signature and try again.");
      onError?.(caught instanceof Error ? caught : new Error("The signature could not be saved."));
    } finally { setBusy(false); }
  };

  return <section className="mbrp-signature" aria-label={`Signature for ${providerName}`}>
    <h5>Signature on bills</h5>
    {loading ? <p className="mbob-status" role="status">Loading saved signature…</p> : saved && onClaimForm ? <div className="mbrp-signature-preview">
      <img src={saved} alt={`Saved signature for ${providerName}`} />
      <div className="mbrp-row"><span className="mbrp-ok">{done ? "✓ Signature saved." : "✓ Saved."}</span><span className="mbob-status">Prints in CMS-1500 Box 31 on {providerName}’s new bills.</span>
        {!replacing ? <button className="mbob-secondary" type="button" disabled={disabled || busy} onClick={() => { setReplacing(true); setDone(false); }}>Replace signature</button> : null}</div>
    </div> : <p className="mbrp-hint">No signature saved for {providerName} yet. Until you add one, Box 31 on their bills prints “Signature on File”.</p>}
    {showUploader && !loading ? <div className="mbob-grid">
      <label className="mbob-field mbob-span">Signature image (PNG or JPEG)
        <FileInput ref={input} accept="image/png,image/jpeg,.png,.jpg,.jpeg" disabled={disabled || busy} buttonLabel="Choose signature image" onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          setError(""); setAuthorized(false); setDone(false);
          if (selected && (selected.size === 0 || selected.size > MAX_SOURCE_BYTES || !/^image\/(png|jpeg)$/.test(selected.type) && !/\.(png|jpe?g)$/i.test(selected.name))) {
            setFile(null); setChosenUrl(null); event.target.value = ""; setError("Choose a PNG or JPEG image of the signature, up to 15 MB."); return;
          }
          setFile(selected);
          setChosenUrl(selected && typeof URL.createObjectURL === "function" ? URL.createObjectURL(selected) : null);
        }} />
      </label>
      {chosenUrl ? <div className="mbrp-signature-preview mbob-span"><img src={chosenUrl} alt="Chosen signature preview" /></div> : null}
      <label className="mbob-field">Your name or staff reference
        <input value={actor} maxLength={200} disabled={disabled || busy} onChange={(event) => setActor(event.target.value)} />
      </label>
      <label className="mbob-span"><Checkbox disabled={disabled || busy} checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} /> I have {providerName}’s authorization to save this signature and print it on their bills.</label>
      <div className="mbob-actions mbob-span">
        {replacing ? <button className="mbob-secondary" type="button" disabled={busy} onClick={() => { setReplacing(false); setFile(null); setChosenUrl(null); setError(""); }}>Keep current signature</button> : <span />}
        <button className="mbob-save" type="button" disabled={disabled || busy || !file || !authorized || !actor.trim()} onClick={() => { void submit(); }}>{busy ? "Saving signature…" : "Save signature"}</button>
      </div>
    </div> : null}
    {error ? <div className="mbob-error" role="alert">{error}</div> : null}
  </section>;
}
