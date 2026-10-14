"use client";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { RfaIdentitySelect } from "./rfa-identity-select";
import { formatRfaPhone } from "./rfa-official-fields";
import { normalizeRfaFax, rfaAuthorizationDestinations, rfaAuthorizationGuidance, type BillClaimsAdministratorDirectory, type RfaAuthorizationDestinationOption } from "@mindbill/browser";

export type RfaAuthorizationDestinationProps = {
  /** Change this when switching the RFA, claims administrator, or injury state. */
  contextKey: string;
  directory: BillClaimsAdministratorDirectory | null;
  savedContact?: { contactName?: string; name?: string; fax?: string; email?: string; phone?: string } | null | undefined;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  /** Selection only: the host owns signing, destination confirmation, and delivery. */
  onSelectionStart?: () => void;
  onChange: (destination: RfaAuthorizationDestinationOption | null) => void;
  /** Render as a plain field group inside a host form section, without its own frame or legend. */
  compact?: boolean;
  /** Choose the directory's destination for the user when it publishes exactly one. */
  autoSelectSingle?: boolean;
  /** Compact mode: offer one "enter manually" choice that hands entry to the host's own fields. */
  onManualEntry?: () => void;
  /** Offer only destinations of this kind (and only that kind of manual entry). */
  method?: "fax" | "email";
  /** Start on the destination already saved on the request, so the user reviews it instead of choosing again. */
  preselectSaved?: boolean;
  /** Host destinations listed after the saved contact, such as the claim's adjuster (Forward). */
  extraOptions?: readonly RfaAuthorizationDestinationOption[];
};

/** Choose a destination without sending an RFA or treating email as fax. */
export function RfaAuthorizationDestination({ contextKey, directory, savedContact, loading = false, error, disabled = false, onChange, onSelectionStart, compact = false, onManualEntry, autoSelectSingle = false, method, preselectSaved = false, extraOptions }: RfaAuthorizationDestinationProps): ReactElement {
  let options = loading || error ? [] : rfaAuthorizationDestinations(directory);
  const fax = savedContact?.fax ? normalizeRfaFax(savedContact.fax) : null;
  const savedLabel = savedContact?.contactName || savedContact?.name || "Saved request contact";
  if (fax && !options.some(option => option.method === "fax" && option.destination === fax)) options.unshift({ method: "fax", destination: fax, label: savedLabel, ...(savedContact?.contactName ? { recipientName: savedContact.contactName } : {}) });
  if (savedContact?.email?.trim() && !options.some(option => option.method === "email" && option.destination === savedContact.email?.trim())) options.unshift({ method: "email", destination: savedContact.email.trim(), label: savedLabel, ...(savedContact?.contactName ? { recipientName: savedContact.contactName } : {}) });
  if (extraOptions?.length) {
    const extra = extraOptions.filter(option => !options.some(existing => existing.method === option.method && existing.destination === option.destination));
    const saved = options.filter(option => option.label === savedLabel);
    options = [...saved, ...extra, ...options.filter(option => option.label !== savedLabel)];
  }
  if (method) options = options.filter(option => option.method === method);
  const savedIndex = preselectSaved ? options.findIndex(option => option.method === "fax" ? option.destination === fax : option.destination === savedContact?.email?.trim()) : -1;
  const signature = JSON.stringify([contextKey, directory?.authorizationStatus, options, loading, error]);
  const [selection, setSelection] = useState("");
  const [manual, setManual] = useState("");
  const [query, setQuery] = useState("");
  const [contactName, setContactName] = useState("");
  const needsAdjuster = directory?.authorizationStatus === "adjuster_specific_required";
  const callback = useRef(onChange);
  callback.current = onChange;
  const auto = useRef(autoSelectSingle); auto.current = autoSelectSingle;
  const startAt = useRef(savedIndex); startAt.current = savedIndex;
  useEffect(() => {
    setManual("");
    if (loading) { setSelection(""); setContactName(""); callback.current(null); return; }
    // The request's saved destination, or the only published one: nothing for the user to choose between.
    const index = startAt.current >= 0 ? startAt.current : auto.current && !needsAdjuster && options.length === 1 ? 0 : -1;
    const only = index >= 0 ? options[index] : undefined;
    const name = only?.recipientName ?? (needsAdjuster ? savedContact?.contactName ?? "" : "");
    // With nothing to pick from, go straight to typing the destination.
    const next = only ? String(index) : method && !options.length && !onManualEntry ? (method === "email" ? "manual-email" : "manual") : "";
    setSelection(next); setContactName(name);
    callback.current(only && !(needsAdjuster && !name.trim()) ? { ...only, ...(name.trim() ? { recipientName: name.trim() } : {}) } : null);
  }, [signature]);
  const chosen = selection !== "" ? options[Number(selection)] : undefined;
  const emit = (nextSelection: string, value: string, name: string) => {
    onSelectionStart?.();
    const recipientName = name.trim();
    if (needsAdjuster && !recipientName) { onChange(null); return; }
    const selected = nextSelection === "manual"
      ? (() => { const fax = normalizeRfaFax(value); return fax ? { method: "fax" as const, destination: fax, label: "Confirmed authorization fax" } : null; })()
      : nextSelection === "manual-email"
        ? (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? { method: "email" as const, destination: value.trim(), label: "Confirmed authorization email" } : null)
        : nextSelection === "" ? null : options[Number(nextSelection)] ?? null;
    onChange(selected ? { ...selected, ...(recipientName ? { recipientName } : {}) } : null);
  };
  const pick = (value: string) => { setSelection(value); setManual(""); const name = options[Number(value)]?.recipientName ?? ""; setContactName(name); emit(value, "", name); };
  const guidance = <>
    <p style={{ margin: 0 }}>{loading ? "Loading authorization contacts…" : error ? "Directory details are unavailable. Confirm a destination with the handling adjuster." : rfaAuthorizationGuidance(directory)}</p>
    {directory?.authorizationNotice ? <p style={{ margin: 0 }}>{directory.authorizationNotice}</p> : null}
  </>;
  return <fieldset className={compact ? "mb-rfa-destination mbrfa-plain" : "mb-rfa-destination"} disabled={disabled || loading} style={compact ? { display: "grid", gap: 8, minWidth: 0, overflowWrap: "anywhere" } : { border: "1px solid var(--mb-border, #d7e0df)", borderRadius: 10, padding: 16, display: "grid", gap: 12, minWidth: 0, overflowWrap: "anywhere" }}>
    {compact ? null : <><legend>Authorization destination</legend>{guidance}</>}
    {compact ? <RfaIdentitySelect label={directory?.authorizationStatus === "claim_handling_location_routes" ? "Claim-handling office" : "Authorization contact"} placeholder="Choose a destination" searchPlaceholder="Search offices, fax numbers or e-mail" query={query} onSearch={setQuery} searchable disabled={disabled || loading} value={selection}
      options={[...options.map((option, index) => ({ id: String(index), ...(/[a-z]/i.test(option.label) ? { label: option.label, detail: option.method === "fax" ? `Fax ${formatRfaPhone(option.destination)}` : option.destination } : { label: option.method === "fax" ? "Authorization fax" : "Authorization e-mail", detail: option.method === "fax" ? formatRfaPhone(option.destination) : option.destination }) })), ...(onManualEntry ? [{ id: "manual-entry", action: true, label: needsAdjuster ? "Enter the handling adjuster’s contact manually" : "Enter a different contact manually" }] : [...(method === "email" ? [] : [{ id: "manual", action: true, label: needsAdjuster ? "Enter the handling adjuster’s fax" : options.length ? "Enter a different fax number" : "Enter a fax number" }]), ...(method === "fax" ? [] : [{ id: "manual-email", action: true, label: options.length ? "Enter a different e-mail address" : "Enter an e-mail address" }])])].filter(option => option.id === selection || `${option.label} ${"detail" in option ? option.detail : ""}`.toLowerCase().includes(query.trim().toLowerCase()))}
      onSelect={value => { setQuery(""); if (value === "manual-entry") { onManualEntry?.(); return; } pick(value); }} /> :
    <label style={{ display: "grid", gap: 6, minWidth: 0 }}>{directory?.authorizationStatus === "claim_handling_location_routes" ? "Claim-handling office" : "Authorization contact"}
      <select value={selection} onChange={(event) => pick(event.target.value)} style={{ padding: 10, width: "100%", minWidth: 0, maxWidth: "100%", font: "inherit" }}>
        <option value="">Choose a destination…</option>
        {options.map((option, index) => <option key={`${option.method}:${option.destination}:${index}`} value={String(index)}>{option.label} · {option.method === "fax" ? "Fax" : "Email"}: {option.destination}</option>)}
        <option value="manual">{needsAdjuster ? "Enter the handling adjuster’s fax" : "Enter another confirmed authorization fax"}</option><option value="manual-email">Enter a confirmed authorization email</option>
      </select>
    </label>}
    {selection !== "" && (needsAdjuster || selection === "manual" || selection === "manual-email") ? <label style={{ display: "grid", gap: 6 }}>{needsAdjuster ? "Handling adjuster name (required)" : "Recipient / attention (optional)"}<input value={contactName} maxLength={200} required={needsAdjuster} onChange={event => { setContactName(event.target.value); emit(selection, manual, event.target.value); }} /></label> : null}
    {selection === "manual-email" ? <label style={{ display: "grid", gap: 6, minWidth: 0 }}>Authorization e-mail address<input type="email" placeholder="name@example.com" value={manual} onChange={event => { const value = event.target.value; setManual(value); emit(selection, value, contactName); }} /></label> : selection === "manual" ? <label style={{ display: "grid", gap: 6, minWidth: 0 }}>Authorization fax number<input type="tel" placeholder="(555) 555-0100" value={manual} onChange={(event) => { const digits = event.target.value.replace(/\D/g, "").replace(/^1(?=\d{10})/, "").slice(0, 10); const value = digits.length > 6 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : digits.length > 3 ? `(${digits.slice(0, 3)}) ${digits.slice(3)}` : digits; setManual(value); emit(selection, value, contactName); }} style={{ padding: 10, width: "100%", minWidth: 0, boxSizing: "border-box", font: "inherit" }} /></label> : selection !== "" && chosen ? <>
      {chosen.method === "email" && !compact ? <p style={{ margin: 0, overflowWrap: "anywhere" }}>Email: {chosen.destination}. Review this recipient before preparing and sending the packet.</p> : null}
      {chosen.phone ? <small>Telephone for questions: {formatRfaPhone(chosen.phone)}</small> : null}
    </> : null}
    {compact ? <small className="mbrfa-guidance">{guidance}</small> : null}
  </fieldset>;
}
