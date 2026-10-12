"use client";
import { useState } from "react";
import type { OrganizationProfileData, RfaContact } from "@mindbill/browser";
import { RfaIdentitySelect } from "./rfa-identity-select";
import { RfaPicker } from "./rfa-official-fields";

/** Saved lookups fill the editable official physician contact fields. Renders two picker columns. */
export function RfaPracticePicker({ profile, value, onChange, managePracticeHref, manageLocationsHref, onRefreshProfile }: {
  profile: OrganizationProfileData | undefined; value: RfaContact | null | undefined; onChange: (value: RfaContact) => void;
  managePracticeHref?: string; manageLocationsHref?: string; onRefreshProfile?: () => Promise<void>;
}) {
  const practices = profile?.billingProviders ?? [];
  // A reopened draft stores the printed values, not the lookup ids; show the matching saved choices.
  const [practice, setPractice] = useState(() => practices.find(item => item.name === value?.name)?.id ?? "");
  const [location, setLocation] = useState(() => practice ? (profile?.locations ?? []).find(item => item.active !== false && item.street === value?.address && (!item.billingProviderId || item.billingProviderId === practice))?.id ?? "" : "");
  // A location's saved practice contact fills the printed contact fields; the practice supplies the phone otherwise.
  const located = (chosen: { street: string; city: string; state: string; zip: string; contact?: { name?: string; phone?: string; fax?: string; email?: string } }, phone?: string): RfaContact => ({ address: chosen.street, city: chosen.city, state: chosen.state, zip: chosen.zip, ...(chosen.contact?.name ? { contactName: chosen.contact.name } : {}), ...(chosen.contact?.phone || phone ? { phone: chosen.contact?.phone || phone! } : {}), ...(chosen.contact?.fax ? { fax: chosen.contact.fax } : {}), ...(chosen.contact?.email ? { email: chosen.contact.email } : {}) });
  const [practiceQuery, setPracticeQuery] = useState(""); const [locationQuery, setLocationQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState("");
  const locations = (profile?.locations ?? []).filter(item => item.active !== false && (item.billingProviderId ? item.billingProviderId === practice : practices.length <= 1));
  return <>
  <RfaPicker label="Practice"><RfaIdentitySelect label="Saved practice" placeholder="Choose a practice" searchPlaceholder="Search practices" query={practiceQuery} onSearch={setPracticeQuery} searchable value={practice} options={practices.filter(item => item.id === practice || item.name.toLowerCase().includes(practiceQuery.toLowerCase())).map(item => ({ id: item.id, label: item.name }))} onSelect={id => {
    const provider = practices.find(item => item.id === id); if (!provider) return;
    setPractice(id); setPracticeQuery("");
    const matching = (profile?.locations ?? []).filter(item => item.active !== false && (item.billingProviderId === id || (!item.billingProviderId && practices.length === 1)));
    const primary = matching.filter(item => item.isPrimary); const chosen = matching.length === 1 ? matching[0] : primary.length === 1 ? primary[0] : undefined;
    setLocation(chosen?.id ?? "");
    onChange({ ...value, name: provider.name, phone: provider.phone ?? "", address: provider.billingStreet ?? "", city: provider.billingCity ?? "", state: provider.billingState ?? "", zip: provider.billingZip ?? "", ...(chosen ? located(chosen, provider.phone) : {}) });
  }} />{managePracticeHref ? <a href={managePracticeHref} target="_blank" rel="noopener noreferrer">Add / manage practices</a> : null}</RfaPicker>
  <RfaPicker label="Practice location"><RfaIdentitySelect label="Practice location" placeholder={practice ? "Choose a location" : "Choose a practice first"} searchPlaceholder="Search locations" query={locationQuery} onSearch={setLocationQuery} searchable disabled={!practice} value={location} options={locations.filter(item => item.id === location || item.name.toLowerCase().includes(locationQuery.toLowerCase())).map(item => ({ id: item.id, label: item.name, detail: `${item.street}, ${item.city}` }))} onSelect={id => { const chosen = locations.find(item => item.id === id); if (!chosen) return; setLocation(id); setLocationQuery(""); onChange({ ...value, ...located(chosen, practices.find(item => item.id === practice)?.phone) }); }} />
    <span className="mbrfa-picker-links">{manageLocationsHref ? <a href={manageLocationsHref} target="_blank" rel="noopener noreferrer">Add / manage locations</a> : null}{onRefreshProfile ? <button type="button" className="mbrfa-link" disabled={refreshing} onClick={() => { setRefreshing(true); setError(""); void onRefreshProfile().catch(() => setError("Could not refresh saved practices. Try again.")).finally(() => setRefreshing(false)); }}>{refreshing ? "Refreshing…" : "Refresh saved choices"}</button> : null}</span>
    {error ? <p role="alert">{error}</p> : null}</RfaPicker>
  </>;
}
