"use client";
import { useEffect, useRef, useState } from "react";
import type { OrganizationProfileData, RfaContact } from "@mindbill/browser";
import { RfaIdentitySelect } from "./rfa-identity-select";
import { RfaPicker } from "./rfa-official-fields";

/** Saved lookups fill the editable official physician contact fields. Renders two picker columns. */
export function RfaPracticePicker({ profile, value, onChange, managePracticeHref, manageLocationsHref, onEditPractice, onEditLocation, onChosen }: {
  profile: OrganizationProfileData | undefined; value: RfaContact | null | undefined; onChange: (value: RfaContact) => void;
  managePracticeHref?: string; manageLocationsHref?: string;
  onEditPractice?: ((practiceId: string) => void) | undefined; onEditLocation?: ((locationId: string | null, practiceId: string) => void) | undefined;
  /** A saved practice or location was chosen, so its saved values are what should show. */ onChosen?: (() => void) | undefined;
}) {
  const practices = profile?.billingProviders ?? [];
  // A reopened draft stores the printed values, not the lookup ids; show the matching saved choices.
  const [practice, setPractice] = useState(() => practices.find(item => item.name === value?.name)?.id ?? "");
  const [location, setLocation] = useState(() => practice ? (profile?.locations ?? []).find(item => item.active !== false && item.street === value?.address && (!item.billingProviderId || item.billingProviderId === practice))?.id ?? "" : "");
  // A location's saved practice contact fills the printed contact fields; the practice supplies the phone otherwise.
  const located = (chosen: { street: string; city: string; state: string; zip: string; contact?: { name?: string; phone?: string; fax?: string; email?: string } }, phone?: string): RfaContact => ({ address: chosen.street, city: chosen.city, state: chosen.state, zip: chosen.zip, ...(chosen.contact?.name ? { contactName: chosen.contact.name } : {}), ...(chosen.contact?.phone || phone ? { phone: chosen.contact?.phone || phone! } : {}), ...(chosen.contact?.fax ? { fax: chosen.contact.fax } : {}), ...(chosen.contact?.email ? { email: chosen.contact.email } : {}) });
  // When the selected saved record is edited (in the host's editor), print its new values.
  const savedPractice = practices.find(item => item.id === practice), savedLocation = (profile?.locations ?? []).find(item => item.id === location);
  const savedKey = JSON.stringify([savedPractice?.name, savedPractice?.phone, savedPractice?.billingStreet, savedPractice?.billingCity, savedPractice?.billingState, savedPractice?.billingZip, savedLocation?.street, savedLocation?.city, savedLocation?.state, savedLocation?.zip, savedLocation?.contact]);
  const appliedKey = useRef(savedKey);
  useEffect(() => {
    if (appliedKey.current === savedKey) return;
    appliedKey.current = savedKey;
    if (!savedPractice) return;
    onChange({ ...value, name: savedPractice.name, phone: savedPractice.phone ?? "", address: savedPractice.billingStreet ?? "", city: savedPractice.billingCity ?? "", state: savedPractice.billingState ?? "", zip: savedPractice.billingZip ?? "", ...(savedLocation ? located(savedLocation, savedPractice.phone) : {}) });
  }, [savedKey]);
  const [practiceQuery, setPracticeQuery] = useState(""); const [locationQuery, setLocationQuery] = useState("");
  const choosePractice = (id: string) => {
    const provider = practices.find(item => item.id === id); if (!provider) return;
    setPractice(id); setPracticeQuery(""); onChosen?.();
    const matching = (profile?.locations ?? []).filter(item => item.active !== false && (item.billingProviderId === id || (!item.billingProviderId && practices.length === 1)));
    const primary = matching.filter(item => item.isPrimary); const chosen = matching.length === 1 ? matching[0] : primary.length === 1 ? primary[0] : undefined;
    setLocation(chosen?.id ?? "");
    onChange({ ...value, name: provider.name, phone: provider.phone ?? "", address: provider.billingStreet ?? "", city: provider.billingCity ?? "", state: provider.billingState ?? "", zip: provider.billingZip ?? "", ...(chosen ? located(chosen, provider.phone) : {}) });
  };
  // An organization with one practice has nothing to choose: fill it in on a new request.
  const onlyPractice = practices.length === 1 && !practice && !value?.name?.trim() && !value?.address?.trim() ? practices[0]!.id : "";
  useEffect(() => { if (onlyPractice) choosePractice(onlyPractice); }, [onlyPractice]);
  const locations = (profile?.locations ?? []).filter(item => item.active !== false && (item.billingProviderId ? item.billingProviderId === practice : practices.length <= 1));
  return <>
  <RfaPicker label="Practice"><RfaIdentitySelect label="Saved practice" placeholder="Choose a practice" searchPlaceholder="Search practices" query={practiceQuery} onSearch={setPracticeQuery} searchable value={practice} options={practices.filter(item => item.id === practice || item.name.toLowerCase().includes(practiceQuery.toLowerCase())).map(item => ({ id: item.id, label: item.name }))} onSelect={choosePractice} /><span className="mbrfa-picker-links">{onEditPractice && practice ? <button type="button" className="mbrfa-link" onClick={() => onEditPractice(practice)}>Edit practice</button> : null}{managePracticeHref ? <a className="mbrfa-link-out" href={managePracticeHref} target="_blank" rel="noopener noreferrer">{onEditPractice ? "Manage practices ↗" : "Add / manage practices"}</a> : null}</span></RfaPicker>
  <RfaPicker label="Practice location"><RfaIdentitySelect label="Practice location" placeholder={practice ? "Choose a location" : "Choose a practice first"} searchPlaceholder="Search locations" query={locationQuery} onSearch={setLocationQuery} searchable disabled={!practice} value={location} options={locations.filter(item => item.id === location || item.name.toLowerCase().includes(locationQuery.toLowerCase())).map(item => ({ id: item.id, label: item.name, detail: `${item.street}, ${item.city}` }))} onSelect={id => { const chosen = locations.find(item => item.id === id); if (!chosen) return; setLocation(id); setLocationQuery(""); onChosen?.(); onChange({ ...value, ...located(chosen, practices.find(item => item.id === practice)?.phone) }); }} />
    <span className="mbrfa-picker-links">{onEditLocation && practice && location ? <button type="button" className="mbrfa-link" onClick={() => onEditLocation(location, practice)}>Edit location</button> : null}{onEditLocation && practice ? <button type="button" className="mbrfa-link" onClick={() => onEditLocation(null, practice)}>Add location</button> : null}{manageLocationsHref ? <a className="mbrfa-link-out" href={manageLocationsHref} target="_blank" rel="noopener noreferrer">{onEditLocation ? "Manage locations ↗" : "Add / manage locations"}</a> : null}</span></RfaPicker>
  </>;
}
