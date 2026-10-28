"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import type { OrganizationClient, OrganizationProfileData, OrganizationRenderingProviderInput } from "@mindbill/browser";
import { Checkbox, FileInput } from "./form-controls";
import { signaturePngBase64 } from "./rfa-provider-signature-setup";

// "+ Add new doctor" from inside the bill form. With an organization:manage settings
// connection the doctor (and optional signature) is saved for future bills and selected on
// this bill; without one, the details fill this bill only.

export type BillDoctorQuickAddProps = {
  /** organization:manage client (the form's `billingSettings`); null = this bill only. */
  settingsClient: OrganizationClient | null;
  /** The bill form's own (bills:create) client, used when there is no settings client. */
  billClient?: OrganizationClient | null;
  /** The server or session cannot save doctors from a bill (older server): fill this bill only. */
  onUnsupported?: () => void;
  disabled?: boolean;
  /** Saved: the refreshed profile and the new provider's id. */
  onSaved: (profile: OrganizationProfileData, providerId: string) => void;
  /** No settings connection: use these details on this bill only. */
  onUseForBill: (provider: OrganizationRenderingProviderInput) => void;
  onClose: () => void;
};

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export function BillDoctorQuickAdd({ settingsClient, billClient, onUnsupported, disabled, onSaved, onUseForBill, onClose }: BillDoctorQuickAddProps): ReactElement {
  const client = settingsClient ?? billClient ?? null;
  const [doctor, setDoctor] = useState<OrganizationRenderingProviderInput>({ name: "", npi: "", taxonomy: "", specialty: "", licenseNumber: "", licenseState: "", active: true });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [actor, setActor] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const locked = Boolean(disabled) || busy;
  const signatureReady = !file || (authorized && actor.trim().length > 0);
  const valid = doctor.name.trim().length > 0 && /^\d{10}$/.test(doctor.npi.trim());

  const save = async () => {
    if (!valid || locked || !signatureReady) return;
    const input: OrganizationRenderingProviderInput = { ...doctor, name: doctor.name.trim(), npi: doctor.npi.trim() };
    if (!client) { onUseForBill(input); return; }
    setBusy(true); setError("");
    if (!settingsClient && billClient) {
      try {
        let providerId: string; let next: OrganizationProfileData;
        try {
          const added = await billClient.addRenderingProvider({ name: input.name, npi: input.npi,
            ...(input.taxonomy ? { taxonomy: input.taxonomy } : {}), ...(input.specialty ? { specialty: input.specialty } : {}),
            ...(input.licenseNumber ? { licenseNumber: input.licenseNumber } : {}), ...(input.licenseState ? { licenseState: input.licenseState } : {}) });
          providerId = added.providerId; next = added.profile;
        } catch (caught) {
          const failure = caught as Error & { status?: number; code?: string; existingProviderId?: string };
          if (failure.code === "rendering_provider_exists" && failure.existingProviderId) {
            providerId = failure.existingProviderId; next = await billClient.getBillingProfile();
          } else if (failure.status === 403 || failure.status === 404 || failure.status === 405) {
            onUnsupported?.(); onUseForBill(input); return;
          } else throw caught;
        }
        if (file) next = await billClient.saveRenderingProviderSignature(providerId, { contentBase64: await signaturePngBase64(file), physicianAuthorized: true, actorReference: actor.trim() });
        onSaved(next, providerId);
      } catch (caught) {
        setError(caught instanceof Error && caught.message ? caught.message : "The doctor could not be saved.");
      } finally { setBusy(false); }
      return;
    }
    if (!settingsClient) return;
    try {
      const before = await settingsClient.getOrganization().then((profile) => new Set((profile.renderingProviders ?? []).map((item) => item.id))).catch(() => new Set<string>());
      let next = await settingsClient.saveBillingProfile({ renderingProviders: [input] });
      const saved = next.renderingProviders?.find((item) => !before.has(item.id) && item.npi === input.npi)
        ?? next.renderingProviders?.find((item) => item.npi === input.npi);
      if (!saved) throw new Error("The doctor was saved but could not be found. Reload and choose them from the list.");
      if (file) next = await settingsClient.saveRenderingProviderSignature(saved.id, { contentBase64: await signaturePngBase64(file), physicianAuthorized: true, actorReference: actor.trim() });
      onSaved(next, saved.id);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "The doctor could not be saved.");
    } finally { setBusy(false); }
  };

  const field = (label: string, key: "name" | "npi" | "taxonomy" | "specialty" | "licenseNumber" | "licenseState", options: { inputMode?: "numeric"; maxLength?: number; upper?: boolean } = {}) => (
    <label className="mbob-field">{label}
      <input value={(doctor[key] as string | undefined) ?? ""} disabled={locked} inputMode={options.inputMode} maxLength={options.maxLength}
        onChange={(event) => { const value = options.upper ? event.target.value.toUpperCase() : event.target.value; setDoctor((current) => ({ ...current, [key]: value })); }} />
    </label>
  );

  return <div className="mbrp-editor" role="group" aria-label="Add new doctor">
    <h4>Add new doctor</h4>
    {!client ? <p className="mbrp-hint" style={{ marginBottom: 12 }}>These details fill this bill only. To save a doctor and their signature for future bills, an administrator can add them in Billing settings.</p> : null}
    <div className="mbob-grid">
      {field("Doctor name", "name")}
      {field("Rendering NPI", "npi", { inputMode: "numeric", maxLength: 10 })}
      {field("Taxonomy", "taxonomy", { maxLength: 10, upper: true })}
      {field("Specialty", "specialty")}
      {field("License number", "licenseNumber")}
      {field("License state", "licenseState", { maxLength: 2, upper: true })}
    </div>
    {client ? <div className="mbrp-signature">
      <h5>Signature (optional)</h5>
      <p className="mbob-status">Prints in CMS-1500 Box 31 on this doctor’s bills. Without one, Box 31 reads “Signature on File”.</p>
      <label className="mbob-field">Signature image (PNG or JPEG)
        <FileInput accept="image/png,image/jpeg,.png,.jpg,.jpeg" disabled={locked} buttonLabel="Choose signature image" onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          setError(""); setAuthorized(false);
          if (selected && (selected.size === 0 || selected.size > MAX_SOURCE_BYTES || (!/^image\/(png|jpeg)$/.test(selected.type) && !/\.(png|jpe?g)$/i.test(selected.name)))) {
            setFile(null); setPreview(null); event.target.value = ""; setError("Choose a PNG or JPEG image of the signature, up to 15 MB."); return;
          }
          setFile(selected);
          setPreview(selected && typeof URL.createObjectURL === "function" ? URL.createObjectURL(selected) : null);
        }} />
      </label>
      {preview ? <div className="mbrp-signature-preview"><img src={preview} alt="Chosen signature preview" /></div> : null}
      {file ? <div className="mbob-grid">
        <label className="mbob-field">Your name or staff reference<input value={actor} maxLength={200} disabled={locked} onChange={(event) => setActor(event.target.value)} /></label>
        <label className="mbob-span"><Checkbox disabled={locked} checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} /> I have this doctor’s authorization to save this signature and print it on their bills.</label>
      </div> : null}
    </div> : null}
    {error ? <div className="mbob-error" role="alert">{error}</div> : null}
    <div className="mbob-actions">
      <button className="mbob-secondary" type="button" disabled={busy} onClick={onClose}>Cancel</button>
      <button className="mbob-save" type="button" disabled={locked || !valid || !signatureReady} onClick={() => { void save(); }}>{busy ? "Saving…" : client ? "Save doctor and use on this bill" : "Use on this bill"}</button>
    </div>
  </div>;
}
