"use client";
import { useEffect, useRef, useState } from "react";
import type { OrganizationProfileData, RfaContact } from "@mindbill/browser";
import { RfaIdentitySelect } from "./rfa-identity-select";
import { RfaPicker } from "./rfa-official-fields";

/** Saved lookups fill the editable official physician contact fields. Renders two picker columns. */
export function RfaPracticePicker({ profile, value, onChange, managePracticeHref, manageLocationsHref, onEditPractice, onAddPractice, onEditLocation, onChosen }: {
  profile: OrganizationProfileData | undefined; value: RfaContact | null | undefined; onChange: (value: RfaContact) => void;
  managePracticeHref?: string; manageLocationsHref?: string;
  onEditPractice?: ((practiceId: string) => void) | undefined; /** Opens the host's editor for a new practice; adds an "Add new practice" choice to the list. */ onAddPractice?: (() => void) | undefined; onEditLocation?: ((locationId: string | null, practiceId: string) => void) | undefined;
  /** A saved practice or location was chosen, so its saved values are what should show. */ onChosen?: (() => void) | undefined;
}) {
  const practices = profile?.billingProviders ?? [];
  // A reopened draft stores the printed values, not the lookup ids; show the matching saved choices.
  const [practice, setPractice] = useState(() => practices.find(item => item.name === value?.name)?.id ?? "");
  const [location, setLocation] = useState(() => practice ? (profile?.locations ?? []).find(item => item.active !== false && item.street === value?.address && (!item.billingProviderId || item.billingProviderId === practice))?.id ?? "" : "");
  // The practice's saved contact fills the printed contact fields; a location's own contact replaces it field by field.
  type Saved = { name?: string; phone?: string; fax?: string; email?: string };
  const contactOf = (saved: unknown): Saved => (saved as { contact?: Saved } | undefined)?.contact ?? {};
  const contactFields = (provider: { phone?: string } | undefined, chosen?: { contact?: Saved }) => {
    const own = chosen?.contact ?? {}, shared = contactOf(provider);
    const name = own.name || shared.name, fax = own.fax || shared.fax, email = own.email || shared.email;
    // A blank saved value leaves the field as it is, so the organization's default return fax is kept.
    return { phone: own.phone || shared.phone || provider?.phone || "", ...(name ? { contactName: name } : {}), ...(fax ? { fax } : {}), ...(email ? { email } : {}) };
  };
  const located = (chosen: { street: string; city: string; state: string; zip: string; contact?: Saved }, provider: { phone?: string } | undefined): RfaContact => ({ address: chosen.street, city: chosen.city, state: chosen.state, zip: chosen.zip, ...contactFields(provider, chosen) });
  // When the selected saved record is edited (in the host's editor), print its new values.
  const savedPractice = practices.find(item => item.id === practice), savedLocation = (profile?.locations ?? []).find(item => item.id === location);
  const savedKey = JSON.stringify([savedPractice?.name, savedPractice?.phone, savedPractice?.billingStreet, savedPractice?.billingCity, savedPractice?.billingState, savedPractice?.billingZip, contactOf(savedPractice), savedLocation?.street, savedLocation?.city, savedLocation?.state, savedLocation?.zip, savedLocation?.contact]);
  const appliedKey = useRef(savedKey);
  useEffect(() => {
    if (appliedKey.current === savedKey) return;
    appliedKey.current = savedKey;
    if (!savedPractice) return;
    onChange({ ...value, name: savedPractice.name, address: savedPractice.billingStreet ?? "", city: savedPractice.billingCity ?? "", state: savedPractice.billingState ?? "", zip: savedPractice.billingZip ?? "", ...contactFields(savedPractice), ...(savedLocation ? located(savedLocation, savedPractice) : {}) });
  }, [savedKey]);
  const [practiceQuery, setPracticeQuery] = useState(""); const [locationQuery, setLocationQuery] = useState("");
  const choosePractice = (id: string) => {
    const provider = practices.find(item => item.id === id); if (!provider) return;
    setPractice(id); setPracticeQuery(""); onChosen?.();
    const matching = (profile?.locations ?? []).filter(item => item.active !== false && (item.billingProviderId === id || (!item.billingProviderId && practices.length === 1)));
    const primary = matching.filter(item => item.isPrimary); const chosen = matching.length === 1 ? matching[0] : primary.length === 1 ? primary[0] : undefined;
    setLocation(chosen?.id ?? "");
    onChange({ ...value, name: provider.name, address: provider.billingStreet ?? "", city: provider.billingCity ?? "", state: provider.billingState ?? "", zip: provider.billingZip ?? "", ...contactFields(provider), ...(chosen ? located(chosen, provider) : {}) });
  };
  // An organization with one practice has nothing to choose: fill it in on a new request.
  const onlyPractice = practices.length === 1 && !practice && !value?.name?.trim() && !value?.address?.trim() ? practices[0]!.id : "";
  useEffect(() => { if (onlyPractice) choosePractice(onlyPractice); }, [onlyPractice]);
  const locations = (profile?.locations ?? []).filter(item => item.active !== false && (item.billingProviderId ? item.billingProviderId === practice : practices.length <= 1));
  // A record added from the list (in the host's editor) becomes the selection as soon as it is saved.
  const adding = useRef<{ kind: "practice" | "location"; known: string[] } | null>(null);
  const practiceIds = practices.map(item => item.id).join("|"), locationIds = locations.map(item => item.id).join("|");
  useEffect(() => {
    const pending = adding.current; if (!pending) return;
    const added = (pending.kind === "practice" ? practices : locations).find(item => !pending.known.includes(item.id)); if (!added) return;
    adding.current = null;
    if (pending.kind === "practice") choosePractice(added.id); else chooseLocation(added.id);
  }, [practiceIds, locationIds]);
  const chooseLocation = (id: string) => { const chosen = locations.find(item => item.id === id); if (!chosen) return; setLocation(id); setLocationQuery(""); onChosen?.(); onChange({ ...value, ...located(chosen, practices.find(item => item.id === practice)) }); };
  const ADD = "__add__";
  return <>
  <RfaPicker label="Practice"><RfaIdentitySelect label="Saved practice" placeholder="Choose a practice" searchPlaceholder="Search practices" query={practiceQuery} onSearch={setPracticeQuery} searchable value={practice} options={[...practices.filter(item => item.id === practice || item.name.toLowerCase().includes(practiceQuery.toLowerCase())).map(item => ({ id: item.id, label: item.name })), ...(onAddPractice ? [{ id: ADD, label: "Add new practice", action: true }] : [])]} onSelect={id => { if (id !== ADD) return choosePractice(id); adding.current = { kind: "practice", known: practices.map(item => item.id) }; onAddPractice?.(); }} /><span className="mbrfa-picker-links">{onEditPractice && practice ? <button type="button" className="mbrfa-link" onClick={() => onEditPractice(practice)}>Edit practice</button> : null}{managePracticeHref ? <a className="mbrfa-link-out" href={managePracticeHref} target="_blank" rel="noopener noreferrer">{onEditPractice ? "Manage practices ↗" : "Add / manage practices"}</a> : null}</span></RfaPicker>
  <RfaPicker label="Practice location"><RfaIdentitySelect label="Practice location" placeholder={practice ? "Choose a location" : "Choose a practice first"} searchPlaceholder="Search locations" query={locationQuery} onSearch={setLocationQuery} searchable disabled={!practice} value={location} options={[...locations.filter(item => item.id === location || item.name.toLowerCase().includes(locationQuery.toLowerCase())).map(item => ({ id: item.id, label: item.name, detail: `${item.street}, ${item.city}` })), ...(onEditLocation && practice ? [{ id: ADD, label: "Add new location", action: true }] : [])]} onSelect={id => { if (id !== ADD) return chooseLocation(id); adding.current = { kind: "location", known: locations.map(item => item.id) }; onEditLocation?.(null, practice); }} />
    <span className="mbrfa-picker-links">{onEditLocation && practice && location ? <button type="button" className="mbrfa-link" onClick={() => onEditLocation(location, practice)}>Edit location</button> : null}{manageLocationsHref ? <a className="mbrfa-link-out" href={manageLocationsHref} target="_blank" rel="noopener noreferrer">{onEditLocation ? "Manage locations ↗" : "Add / manage locations"}</a> : null}</span></RfaPicker>
  </>;
}
