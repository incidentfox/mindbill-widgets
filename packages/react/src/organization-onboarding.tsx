"use client";

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  createOrganizationClient,
  type BillLifecycleSessionProvider,
  type OrganizationBillingProviderInput,
  type OrganizationClient,
  type OrganizationLocationInput,
  type OrganizationProfileData,
  type OrganizationRenderingProviderInput,
} from "@mindbill/browser";
import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";
import { OrganizationAdministration } from "./organization-administration";
import { TaxIdInput, taxIdWrite } from "./tax-id-input";
import { W9Upload } from "./w9-upload";

// Embeddable organization onboarding (INC-1470): capture the practice name,
// tax ID, group NPI, billing provider, locations, and W-9 ONCE, saved straight
// to MindBill through the partner browser session — the partner's users never
// visit the MindBill dashboard. `BillingSettings` is the compact
// edit-after-setup variant of the same surface.

export type OrganizationOnboardingProps = {
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
  sessionEndpoint?: string;
  getSession?: BillLifecycleSessionProvider;
  apiBaseUrl?: string;
  fetch?: typeof globalThis.fetch;
  heading?: ReactNode;
  description?: ReactNode;
  /** "onboarding" renders a stepper; "settings" stacks every section for editing. */
  variant?: "onboarding" | "settings";
  onSaved?: (profile: OrganizationProfileData) => void;
  onCompleted?: (profile: OrganizationProfileData) => void;
  onError?: (error: Error) => void;
};

type StepId = "practice" | "rendering" | "locations" | "w9" | "review";
const STEPS: Array<{ id: StepId; label: string }> = [
  { id: "practice", label: "Billing provider" },
  { id: "rendering", label: "Rendering providers" },
  { id: "locations", label: "Locations" },
  { id: "w9", label: "W-9" },
  { id: "review", label: "Review" },
];

const css = `
.mbob{color:var(--mb-text);font-family:var(--mb-font);font-size:15px}.mbob *{box-sizing:border-box}.mbob h2,.mbob h3,.mbob p{margin:0}
.mbob-card{border:1px solid var(--mb-border);border-radius:var(--mb-radius);background:var(--mb-surface);box-shadow:var(--mb-shadow);padding:24px}
.mbob-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.mbob-head h2{font-size:22px}.mbob-copy{color:var(--mb-muted);margin-top:5px!important}
.mbob-steps{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
.mbob-step{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--mb-border);border-radius:999px;background:var(--mb-surface);padding:7px 13px;color:var(--mb-muted);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.mbob-step[data-active=true]{border-color:var(--mb-accent);color:var(--mb-accent);background:color-mix(in srgb,var(--mb-accent) 8%,var(--mb-surface))}
.mbob-step[data-done=true] i{color:var(--mb-success);font-style:normal}
.mbob-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px 22px;align-items:start}.mbob-span{grid-column:1/-1}
.mbob-tax-id label{display:grid;gap:7px}.mbob-tax-id small{color:var(--mb-muted);font-weight:450;line-height:1.5}.mbob-tax-id button{justify-self:start;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);color:var(--mb-text);padding:8px 10px;font:inherit;cursor:pointer}
.mbob-field{display:grid;gap:7px;font-size:13px;font-weight:720}
.mbob-field input,.mbob-field select{width:100%;min-height:44px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-input);padding:10px 12px;color:var(--mb-text);font:inherit;font-weight:450}
.mbob-field input:focus{outline:3px solid color-mix(in srgb,var(--mb-accent) 22%,transparent);border-color:var(--mb-accent)}
.mbob-organization{margin-top:20px;border-top:1px solid var(--mb-border);padding-top:16px}.mbob-organization summary{cursor:pointer;font-weight:700;min-height:36px}.mbob-organization p{margin-bottom:12px}.mbob-subhead{margin:20px 0 12px!important;padding-top:16px;border-top:1px solid var(--mb-border);font-size:15px}
.mbob-loc{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:end;border-top:1px solid color-mix(in srgb,var(--mb-border) 60%,transparent);padding:16px 0}
.mbob-loc:first-of-type{border-top:0}
.mbob-primary{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--mb-muted);white-space:nowrap;padding-bottom:12px}
.mbob-remove{border:0;background:transparent;color:var(--mb-muted);font-size:20px;cursor:pointer;padding-bottom:8px}
.mbob-add,.mbob-secondary{border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);padding:10px 14px;color:var(--mb-text);font:inherit;font-weight:700;cursor:pointer}
.mbob-drop{display:grid;place-content:center;gap:6px;min-height:150px;border:2px dashed color-mix(in srgb,var(--mb-muted) 55%,transparent);border-radius:var(--mb-control-radius);text-align:center;cursor:pointer;position:relative}
.mbob-drop input{position:absolute;inset:0;opacity:0;cursor:pointer}
.mbob-drop span{color:var(--mb-muted);font-size:13px}
.mbob-w9-current{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid color-mix(in srgb,var(--mb-success) 35%,var(--mb-border));border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-success) 8%,var(--mb-surface));padding:12px 14px;margin-bottom:14px}
.mbob-w9-current span{color:var(--mb-muted);font-size:13px}
.mbob-check{display:grid;gap:9px}
.mbob-check-item{display:flex;align-items:center;gap:10px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);padding:11px 14px}
.mbob-check-item[data-complete=true]{border-color:color-mix(in srgb,var(--mb-success) 35%,var(--mb-border));background:color-mix(in srgb,var(--mb-success) 8%,var(--mb-surface))}
.mbob-check-item i{font-style:normal}
.mbob-actions{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-top:20px}
.mbob-save{min-width:170px;border:0;border-radius:var(--mb-control-radius);background:var(--mb-accent);color:var(--mb-accent-contrast);padding:12px 22px;font:inherit;font-weight:780;cursor:pointer}
.mbob-save:disabled{opacity:.6;cursor:wait}
.mbob-error{margin-top:14px;border-left:4px solid var(--mb-danger);border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-danger) 8%,var(--mb-surface));padding:12px 14px;color:var(--mb-danger)}
.mbob-status{color:var(--mb-muted)}
.mbob-done{color:var(--mb-success);font-weight:750}
@media(max-width:820px){.mbob-grid{grid-template-columns:1fr}.mbob-span{grid-column:auto}.mbob-loc{grid-template-columns:1fr 1fr;align-items:center}.mbob-loc>*{grid-column:auto}}
`;

const blankLocation = (): OrganizationLocationInput => ({ name: "", street: "", city: "", state: "", zip: "", isPrimary: false });
const blankRendering = (): OrganizationRenderingProviderInput => ({ name: "", npi: "", specialty: "", taxonomy: "", active: true });

async function fileToBase64(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of buffer) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function OrganizationOnboarding({
  appearance,
  className = "",
  style,
  sessionEndpoint = "/api/mindbill/session",
  getSession,
  apiBaseUrl,
  fetch: fetchOverride,
  heading = "Billing setup",
  description = "Billing providers, rendering providers, places of service, and your W-9 — saved once for bill entry.",
  variant = "onboarding",
  onSaved,
  onCompleted,
  onError,
}: OrganizationOnboardingProps): ReactElement {
  const client: OrganizationClient = useMemo(
    () =>
      createOrganizationClient({
        sessionEndpoint,
        ...(fetchOverride ? { fetch: fetchOverride } : {}),
        ...(getSession ? { getSession } : {}),
        ...(apiBaseUrl ? { apiBaseUrl } : {}),
      }),
    [sessionEndpoint, getSession, apiBaseUrl, fetchOverride],
  );

  const [profile, setProfile] = useState<OrganizationProfileData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<StepId>("practice");
  const [identity, setIdentity] = useState<{ name: string; legalName: string; taxId: string; npi: string; phone: string; email: string; taxIdType?: "EIN" | "SSN"; taxIdLast4?: string; taxIdConfigured?: boolean }>({ name: "", legalName: "", taxId: "", npi: "", phone: "", email: "" });
  const [provider, setProvider] = useState<OrganizationBillingProviderInput>({ name: "", taxId: "", npi: "", billType: "Professional", phone: "", billingStreet: "", billingCity: "", billingState: "", billingZip: "" });
  const [locations, setLocations] = useState<OrganizationLocationInput[]>([blankLocation()]);
  const [rendering, setRendering] = useState<OrganizationRenderingProviderInput>(blankRendering);
  const primaryGroup = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedStep, setSavedStep] = useState<Record<string, boolean>>({});
  const completedFired = useRef(false);
  const callbacks = useRef({ onCompleted, onError });
  callbacks.current = { onCompleted, onError };
  const activeClient = useRef(client);
  activeClient.current = client;
  const [loadedClient, setLoadedClient] = useState<OrganizationClient | null>(null);
  const [retry, setRetry] = useState(0);

  const adoptProfile = useCallback((next: OrganizationProfileData) => {
    setProfile(next);
    setIdentity({
      name: next.practiceIdentity.name ?? "",
      legalName: next.practiceIdentity.legalName ?? "",
      taxId: next.practiceIdentity.taxId ?? "",
      taxIdType: next.practiceIdentity.taxIdType ?? "EIN",
      taxIdLast4: next.practiceIdentity.taxIdLast4 ?? "",
      taxIdConfigured: next.practiceIdentity.taxIdConfigured ?? false,
      npi: next.practiceIdentity.npi ?? "",
      phone: next.practiceIdentity.phone ?? "",
      email: next.practiceIdentity.email ?? "",
    });
    setProvider({ name: "", taxId: "", npi: "", billType: "Professional", ...next.billingProviders[0] });
    setRendering(next.renderingProviders?.[0] ? { ...next.renderingProviders[0] } : blankRendering());
    setLocations(next.locations.length ? next.locations.map((item) => ({ ...item })) : [blankLocation()]);
    if (next.onboarding.complete && !completedFired.current) {
      completedFired.current = true;
      callbacks.current.onCompleted?.(next);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    completedFired.current = false;
    setLoadedClient(null);
    setLoadError(null);
    setSavedStep({});
    setSaving(false);
    setError(null);
    client.getOrganization()
      .then((next) => { if (alive) { setLoadError(null); adoptProfile(next); setLoadedClient(client); } })
      .catch((caught) => {
        if (!alive) return;
        const failure = caught instanceof Error ? caught : new Error("The organization could not be loaded.");
        setLoadError(failure.message);
        callbacks.current.onError?.(failure);
      });
    return () => { alive = false; };
  }, [client, adoptProfile, retry]);

  const run = async (work: () => Promise<OrganizationProfileData>, stepId: StepId) => {
    setSaving(true);
    setError(null);
    try {
      const next = await work();
      if (activeClient.current !== client) return;
      adoptProfile(next);
      setSavedStep((current) => ({ ...current, [stepId]: true }));
      onSaved?.(next);
      if (variant === "onboarding") {
        const order: StepId[] = STEPS.map((item) => item.id);
        const nextStep = order[order.indexOf(stepId) + 1];
        if (nextStep) setStep(nextStep);
      }
    } catch (caught) {
      if (activeClient.current !== client) return;
      const failure = caught instanceof Error ? caught : new Error("Saving failed.");
      setError(failure.message);
      onError?.(failure);
    } finally {
      if (activeClient.current === client) setSaving(false);
    }
  };

  const savePractice = () =>
    run(() => {
      return client.saveBillingProfile({
        practiceIdentity: taxIdWrite(identity),
        ...(provider.name.trim() || provider.taxId?.trim() || provider.npi.trim() ? { billingProviders: [taxIdWrite(provider)] } : {}),
      });
    }, "practice");
  const saveLocations = () =>
    run(() => client.saveLocations(locations.filter((item) => item.name.trim() || item.street.trim())), "locations");
  const saveW9 = async (file: File) => {
    setSaving(true);
    try {
      const next = await client.saveW9({ filename: file.name, contentBase64: await fileToBase64(file) });
      if (activeClient.current !== client) return;
      adoptProfile(next);
      setSavedStep((current) => ({ ...current, w9: true }));
      onSaved?.(next);
      if (variant === "onboarding") setStep("review");
    } catch (error) {
      if (activeClient.current !== client) return;
      onError?.(error instanceof Error ? error : new Error("The W-9 could not be saved."));
      throw error;
    } finally { if (activeClient.current === client) setSaving(false); }
  };

  const field = (label: string, value: string, onChange: (value: string) => void, span = false, placeholder = "") => (
    <label className={`mbob-field${span ? " mbob-span" : ""}`}>{label}
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} disabled={saving} />
    </label>
  );

  const setLocation = (index: number, patch: Partial<OrganizationLocationInput>) =>
    setLocations((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return patch.isPrimary ? { ...item, isPrimary: false } : item;
      return { ...item, ...patch };
    }));

  const practiceSection = (
    <div>
      <p className="mbob-status">The selected billing provider supplies the billing name, tax ID, NPI, and address on the claim.</p>
      <h3 className="mbob-subhead">Billing provider (pay-to)</h3>
      <label className="mbob-field">Saved billing provider
        <select disabled={saving} value={provider.id ?? ""} onChange={(event) => setProvider({ ...(profile?.billingProviders.find((item) => item.id === event.target.value) ?? { name: "", taxId: "", npi: "" }) })}>
          <option value="">Add a billing provider</option>
          {profile?.billingProviders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <div className="mbob-grid">
        {field("Billing provider name", provider.name, (name) => setProvider((c) => ({ ...c, name })))}
        <TaxIdInput label="Billing tax ID" value={provider} disabled={saving} onChange={(patch) => setProvider((c) => ({ ...c, ...patch }))} />
        {field("Billing NPI", provider.npi, (npi) => setProvider((c) => ({ ...c, npi })))}
        {field("Billing phone", provider.phone ?? "", (phone) => setProvider((c) => ({ ...c, phone })))}
        {field("Street", provider.billingStreet ?? "", (billingStreet) => setProvider((c) => ({ ...c, billingStreet })), true)}
        {field("City", provider.billingCity ?? "", (billingCity) => setProvider((c) => ({ ...c, billingCity })))}
        {field("State", provider.billingState ?? "", (billingState) => setProvider((c) => ({ ...c, billingState: billingState.toUpperCase().slice(0, 2) })))}
        {field("ZIP", provider.billingZip ?? "", (billingZip) => setProvider((c) => ({ ...c, billingZip })))}
      </div>
      <details className="mbob-organization">
        <summary>Organization details</summary>
        <p className="mbob-status">Your organization profile identifies this account and supplies onboarding defaults. It is separate from the billing provider selected on each bill.</p>
      <p className="mbob-status">Choose EIN for a business or SSN for an individual. Saved SSNs are encrypted and shown only by their last four digits.</p>
      <div className="mbob-grid">
        {field("Organization display name", identity.name, (name) => setIdentity((c) => ({ ...c, name })))}
        {field("Legal name", identity.legalName, (legalName) => setIdentity((c) => ({ ...c, legalName })))}
        <TaxIdInput label="Organization tax ID" value={identity} disabled={saving} onChange={(patch) => setIdentity((c) => ({ ...c, ...patch }))} />
        {field("Group NPI", identity.npi, (npi) => setIdentity((c) => ({ ...c, npi })))}
        {field("Phone", identity.phone, (phone) => setIdentity((c) => ({ ...c, phone })))}
        {field("Email", identity.email, (email) => setIdentity((c) => ({ ...c, email })))}
      </div>
      </details>
      <div className="mbob-actions"><span className="mbob-status">{savedStep["practice"] ? "Saved to MindBill." : "Saved once, used on every bill."}</span><button className="mbob-save" type="button" disabled={saving} onClick={savePractice}>{saving ? "Saving…" : "Save billing profile"}</button></div>
    </div>
  );

  const renderingSection = <div>
    <label className="mbob-field">Saved rendering provider
      <select disabled={saving} value={rendering.id ?? ""} onChange={(event) => setRendering({ ...(profile?.renderingProviders?.find((item) => item.id === event.target.value) ?? blankRendering()) })}>
        <option value="">Add a rendering provider</option>
        {profile?.renderingProviders?.map((item) => <option key={item.id} value={item.id}>{item.name}{item.active === false ? " (inactive)" : ""}</option>)}
      </select>
    </label>
    <div className="mbob-grid" style={{ marginTop: 16 }}>
      {field("Rendering provider name", rendering.name, (name) => setRendering((c) => ({ ...c, name })))}
      {field("Rendering NPI", rendering.npi, (npi) => setRendering((c) => ({ ...c, npi })))}
      {field("Taxonomy", rendering.taxonomy ?? "", (taxonomy) => setRendering((c) => ({ ...c, taxonomy })))}
      {field("Specialty", rendering.specialty ?? "", (specialty) => setRendering((c) => ({ ...c, specialty })))}
      {field("License number", rendering.licenseNumber ?? "", (licenseNumber) => setRendering((c) => ({ ...c, licenseNumber })))}
      {field("License state", rendering.licenseState ?? "", (licenseState) => setRendering((c) => ({ ...c, licenseState: licenseState.toUpperCase().slice(0, 2) })))}
      <label><input disabled={saving} type="checkbox" checked={rendering.active !== false} onChange={(event) => setRendering((c) => ({ ...c, active: event.target.checked }))} /> Available for new bills</label>
    </div>
    <div className="mbob-actions"><span className="mbob-status">{savedStep["rendering"] ? "Saved to MindBill." : "Saved profiles do not change previously submitted bills."}</span><button className="mbob-save" type="button" disabled={saving || !rendering.name.trim()} onClick={() => run(() => client.saveBillingProfile({ renderingProviders: [rendering] }), "rendering")}>{saving ? "Saving…" : "Save rendering provider"}</button></div>
  </div>;

  const locationsSection = (
    <div>
      {locations.map((location, index) => (
        <div className="mbob-loc" key={location.id ?? index}>
          {field("Name", location.name ?? "", (name) => setLocation(index, { name }))}
          {field("Street", location.street, (street) => setLocation(index, { street }))}
          {field("City", location.city, (city) => setLocation(index, { city }))}
          {field("State", location.state, (state) => setLocation(index, { state: state.toUpperCase().slice(0, 2) }))}
          {field("ZIP", location.zip, (zip) => setLocation(index, { zip }))}
          {field("Place of service code", location.posCode ?? "", (posCode) => setLocation(index, { posCode }), false, "11")}
          <label className="mbob-primary"><input disabled={saving || location.active === false} type="radio" name={primaryGroup} checked={location.isPrimary === true} onChange={() => setLocation(index, { isPrimary: true })} /> Primary</label>
          {location.id ? <button className="mbob-secondary" disabled={saving} type="button" onClick={() => setLocation(index, { active: location.active === false, ...(location.active !== false ? { isPrimary: false } : {}) })}>{location.active === false ? "Restore" : "Archive"}</button> : <button className="mbob-remove" disabled={saving} type="button" aria-label="Remove location" onClick={() => setLocations((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>}
        </div>
      ))}
      <button className="mbob-add" type="button" onClick={() => setLocations((current) => [...current, blankLocation()])}>+ Add location</button>
      <div className="mbob-actions"><span className="mbob-status">{savedStep["locations"] ? "Saved to MindBill." : "Where services are performed; used for the service facility and place of service on bills."}</span><button className="mbob-save" type="button" disabled={saving} onClick={saveLocations}>{saving ? "Saving…" : "Save locations"}</button></div>
    </div>
  );

  const w9Section = <div><p className="mbob-status">The saved W-9 is auto-attached to every submission.</p><W9Upload {...(appearance ? { appearance } : {})} {...(profile?.w9 ? { document: { filename: profile.w9.filename, addedAt: profile.w9.addDate } } : {})} onUpload={saveW9} disabled={saving} /></div>;

  const reviewSection = (
    <div className="mbob-check">
      {(profile?.onboarding.checklist ?? []).map((item) => (
        <div className="mbob-check-item" key={item.id} data-complete={item.complete}>
          <i>{item.complete ? "✓" : "•"}</i><span>{item.label}</span>
        </div>
      ))}
      {profile?.onboarding.complete ? <p className="mbob-done">Billing setup is complete — bills submitted from your product carry this profile automatically.</p> : <p className="mbob-status">Items above complete themselves as each section is saved.</p>}
    </div>
  );

  const sections: Record<StepId, ReactElement> = { practice: practiceSection, rendering: renderingSection, locations: locationsSection, w9: w9Section, review: reviewSection };

  return (
    <div className={`mbob ${className}`.trim()} style={{ ...mindBillAppearanceStyle(appearance), ...style }}>
      <style>{css}</style>
      <div className="mbob-card">
        <div className="mbob-head"><div><h2>{heading}</h2><p className="mbob-copy">{description}</p></div></div>
        {loadError ? <div className="mbob-error" role="alert">{loadError} <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div> : null}
        {loadedClient !== client ? (!loadError ? <p role="status">Loading billing settings…</p> : null) : variant === "onboarding" ? (
          <>
            <div className="mbob-steps">
              {STEPS.map((item) => (
                <button className="mbob-step" type="button" key={item.id} data-active={step === item.id} data-done={Boolean(savedStep[item.id])} onClick={() => setStep(item.id)}>
                  <i>{savedStep[item.id] ? "✓" : ""}</i>{item.label}
                </button>
              ))}
            </div>
            {sections[step]}
          </>
        ) : (
          <>
            {practiceSection}
            <h3 className="mbob-subhead">Rendering providers</h3>
            {renderingSection}
            <h3 className="mbob-subhead">Places of service</h3>
            {locationsSection}
            <h3 className="mbob-subhead">W-9</h3>
            {w9Section}
            <h3 className="mbob-subhead">Checklist</h3>
            {reviewSection}
          </>
        )}
        {error ? <div className="mbob-error" role="alert">{error}</div> : null}
      </div>
    </div>
  );
}

/** Organization settings, including billing profiles, custom administrators, and team roles. */
export function BillingSettings(props: Omit<OrganizationOnboardingProps, "variant">): ReactElement {
  const [section, setSection] = useState<"profiles" | "claims" | "team">("profiles");
  return <div>
    <style>{`.mbsettings-nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}.mbsettings-nav button{font:inherit;padding:9px 14px;border:1px solid var(--mb-border,#dce2ea);border-radius:8px;background:var(--mb-surface,#fff);color:var(--mb-text,#172033);cursor:pointer}.mbsettings-nav button[aria-pressed=true]{background:var(--mb-primary,#3155d9);border-color:transparent;color:#fff}.mbsettings-nav button:focus-visible{outline:2px solid var(--mb-primary,#3155d9);outline-offset:2px}`}</style>
    <nav className="mbsettings-nav" aria-label="Billing settings sections" style={mindBillAppearanceStyle(props.appearance)}>
      {([ ["profiles", "Billing profiles"], ["claims", "Claims administrators"], ["team", "Team"] ] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={section === id} onClick={() => setSection(id)}>{label}</button>)}
    </nav>
    {section === "profiles" ? <OrganizationOnboarding heading="Billing settings" description="Manage providers, places of service, W-9, and organization settings." {...props} variant="settings" /> : <OrganizationAdministration {...props} section={section} />}
  </div>;
}
