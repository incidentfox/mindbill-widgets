"use client";
import { useEffect, useRef, useState, type ReactElement } from "react";
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
  onChange: (destination: RfaAuthorizationDestinationOption | null) => void;
};

/** Choose a destination without sending an RFA or treating email as fax. */
export function RfaAuthorizationDestination({ contextKey, directory, savedContact, loading = false, error, disabled = false, onChange }: RfaAuthorizationDestinationProps): ReactElement {
  const options = loading || error ? [] : rfaAuthorizationDestinations(directory);
  const fax = savedContact?.fax ? normalizeRfaFax(savedContact.fax) : null;
  const savedLabel = savedContact?.contactName || savedContact?.name || "Saved request contact";
  if (fax && !options.some(option => option.method === "fax" && option.destination === fax)) options.unshift({ method: "fax", destination: fax, label: savedLabel, ...(savedContact?.contactName ? { recipientName: savedContact.contactName } : {}) });
  if (savedContact?.email?.trim() && !options.some(option => option.method === "email" && option.destination === savedContact.email?.trim())) options.unshift({ method: "email", destination: savedContact.email.trim(), label: savedLabel, ...(savedContact?.contactName ? { recipientName: savedContact.contactName } : {}) });
  const signature = JSON.stringify([contextKey, directory?.authorizationStatus, options, loading, error]);
  const [selection, setSelection] = useState("");
  const [manual, setManual] = useState("");
  const [contactName, setContactName] = useState("");
  const needsAdjuster = directory?.authorizationStatus === "adjuster_specific_required";
  const callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => { setSelection(""); setManual(""); setContactName(""); callback.current(null); }, [signature]);
  const chosen = selection !== "" ? options[Number(selection)] : undefined;
  const emit = (nextSelection: string, value: string, name: string) => {
    const recipientName = name.trim();
    if (needsAdjuster && !recipientName) { onChange(null); return; }
    const selected = nextSelection === "manual"
      ? (() => { const fax = normalizeRfaFax(value); return fax ? { method: "fax" as const, destination: fax, label: "Confirmed authorization fax" } : null; })()
      : nextSelection === "manual-email"
        ? (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? { method: "email" as const, destination: value.trim(), label: "Confirmed authorization email" } : null)
        : nextSelection === "" ? null : options[Number(nextSelection)] ?? null;
    onChange(selected ? { ...selected, ...(recipientName ? { recipientName } : {}) } : null);
  };
  return <fieldset className="mb-rfa-destination" disabled={disabled || loading} style={{ border: "1px solid var(--mb-border, #d7e0df)", borderRadius: 10, padding: 16, display: "grid", gap: 12, minWidth: 0, overflowWrap: "anywhere" }}>
    <legend>Authorization destination</legend>
    <p style={{ margin: 0 }}>{loading ? "Loading authorization contacts…" : error ? "Directory details are unavailable. Confirm a destination with the handling adjuster." : rfaAuthorizationGuidance(directory)}</p>
    {directory?.authorizationNotice ? <p style={{ margin: 0 }}>{directory.authorizationNotice}</p> : null}
    <label style={{ display: "grid", gap: 6, minWidth: 0 }}>{directory?.authorizationStatus === "claim_handling_location_routes" ? "Claim-handling office" : "Authorization contact"}
      <select value={selection} onChange={(event) => { const value = event.target.value; setSelection(value); setManual(""); const name = options[Number(value)]?.recipientName ?? ""; setContactName(name); emit(value, "", name); }} style={{ padding: 10, width: "100%", minWidth: 0, maxWidth: "100%", font: "inherit" }}>
        <option value="">Choose a destination…</option>
        {options.map((option, index) => <option key={`${option.method}:${option.destination}:${index}`} value={String(index)}>{option.label} · {option.method === "fax" ? "Fax" : "Email"}: {option.destination}</option>)}
        <option value="manual">{needsAdjuster ? "Enter the handling adjuster’s fax" : "Enter another confirmed authorization fax"}</option><option value="manual-email">Enter a confirmed authorization email</option>
      </select>
    </label>
    {selection !== "" && (needsAdjuster || selection === "manual" || selection === "manual-email") ? <label style={{ display: "grid", gap: 6 }}>{needsAdjuster ? "Handling adjuster name (required)" : "Recipient / attention (optional)"}<input value={contactName} maxLength={200} required={needsAdjuster} onChange={event => { setContactName(event.target.value); emit(selection, manual, event.target.value); }} /></label> : null}
    {selection === "manual-email" ? <label>Authorization email address<input type="email" value={manual} onChange={event => { const value = event.target.value; setManual(value); emit(selection, value, contactName); }} /></label> : selection === "manual" ? <label style={{ display: "grid", gap: 6, minWidth: 0 }}>Authorization fax number<input type="tel" value={manual} onChange={(event) => { const value = event.target.value; setManual(value); emit(selection, value, contactName); }} style={{ padding: 10, width: "100%", minWidth: 0, boxSizing: "border-box", font: "inherit" }} /></label> : selection !== "" && chosen ? <>
      {chosen.method === "email" ? <p style={{ margin: 0, overflowWrap: "anywhere" }}>Email: {chosen.destination}. Review this recipient before preparing and sending the packet.</p> : null}
      {chosen.phone ? <small>Telephone for questions: {chosen.phone}</small> : null}
    </> : null}
  </fieldset>;
}
