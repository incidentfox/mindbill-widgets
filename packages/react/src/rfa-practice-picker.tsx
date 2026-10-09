"use client";
import { useState } from "react";
import type { OrganizationProfileData, RfaContact } from "@mindbill/browser";
import { RfaIdentitySelect } from "./rfa-identity-select";

/** Saved lookups fill the editable official physician contact fields. */
export function RfaPracticePicker({ profile, value, onChange, managePracticeHref, manageLocationsHref, onRefreshProfile }: {
  profile: OrganizationProfileData | undefined; value: RfaContact | null | undefined; onChange: (value: RfaContact) => void;
  managePracticeHref?: string; manageLocationsHref?: string; onRefreshProfile?: () => Promise<void>;
}) {
  const [practice, setPractice] = useState(""); const [location, setLocation] = useState("");
  const [practiceQuery, setPracticeQuery] = useState(""); const [locationQuery, setLocationQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState("");
  const practices = profile?.billingProviders ?? [];
  const locations = (profile?.locations ?? []).filter(item => item.active !== false && (item.billingProviderId ? item.billingProviderId === practice : practices.length <= 1));
  return <div className="mbtd-grid"><div><RfaIdentitySelect label="Saved practice" placeholder="Choose a practice" searchPlaceholder="Search practices" query={practiceQuery} onSearch={setPracticeQuery} searchable value={practice} options={practices.filter(item => item.id === practice || item.name.toLowerCase().includes(practiceQuery.toLowerCase())).map(item => ({ id: item.id, label: item.name }))} onSelect={id => {
    const provider = practices.find(item => item.id === id); if (!provider) return;
    setPractice(id); setPracticeQuery("");
    const matching = (profile?.locations ?? []).filter(item => item.active !== false && (item.billingProviderId === id || (!item.billingProviderId && practices.length === 1)));
    const primary = matching.filter(item => item.isPrimary); const chosen = matching.length === 1 ? matching[0] : primary.length === 1 ? primary[0] : undefined;
    setLocation(chosen?.id ?? "");
    onChange({ ...value, name: provider.name, phone: provider.phone ?? "", address: chosen?.street ?? provider.billingStreet ?? "", city: chosen?.city ?? provider.billingCity ?? "", state: chosen?.state ?? provider.billingState ?? "", zip: chosen?.zip ?? provider.billingZip ?? "" });
  }} />{managePracticeHref ? <a href={managePracticeHref} target="_blank" rel="noopener noreferrer">Add / manage practices</a> : null}</div>
  <div><RfaIdentitySelect label="Practice location" placeholder={practice ? "Choose a location" : "Choose a practice first"} searchPlaceholder="Search locations" query={locationQuery} onSearch={setLocationQuery} searchable disabled={!practice} value={location} options={locations.filter(item => item.id === location || item.name.toLowerCase().includes(locationQuery.toLowerCase())).map(item => ({ id: item.id, label: item.name, detail: `${item.street}, ${item.city}` }))} onSelect={id => { const chosen = locations.find(item => item.id === id); if (!chosen) return; setLocation(id); setLocationQuery(""); onChange({ ...value, address: chosen.street, city: chosen.city, state: chosen.state, zip: chosen.zip }); }} />{manageLocationsHref ? <a href={manageLocationsHref} target="_blank" rel="noopener noreferrer">Add / manage locations</a> : null}</div>
  <p className="mbtd-wide">Selecting a practice fills its contact details. A selected location supplies the address; otherwise the practice billing address is used. You can edit these fields below. Refreshing saved choices preserves your edits.</p>
  {onRefreshProfile ? <button type="button" disabled={refreshing} onClick={() => { setRefreshing(true); setError(""); void onRefreshProfile().catch(() => setError("Could not refresh saved practices. Try again.")).finally(() => setRefreshing(false)); }}>{refreshing ? "Refreshing…" : "Refresh saved practices and locations"}</button> : null}{error ? <p role="alert">{error}</p> : null}</div>;
}
