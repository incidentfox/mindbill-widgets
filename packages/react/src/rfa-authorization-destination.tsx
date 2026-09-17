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
  if (fax && !options.some(option => option.method === "fax" && option.destination === fax)) options.unshift({ method: "fax", destination: fax, label: savedLabel });
  if (savedContact?.email?.trim() && !options.some(option => option.method === "email" && option.destination === savedContact.email?.trim())) options.unshift({ method: "email", destination: savedContact.email.trim(), label: savedLabel });
  const signature = JSON.stringify([contextKey, directory?.authorizationStatus, options, loading, error]);
  const [selection, setSelection] = useState("");
  const [manual, setManual] = useState("");
  const callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => { setSelection(""); setManual(""); callback.current(null); }, [signature]);
  const chosen = options[Number(selection)];
  return <fieldset className="mb-rfa-destination" disabled={disabled || loading} style={{ border: "1px solid var(--mb-border, #d7e0df)", borderRadius: 10, padding: 16, display: "grid", gap: 12, minWidth: 0, overflowWrap: "anywhere" }}>
    <legend>Authorization destination</legend>
    <p style={{ margin: 0 }}>{loading ? "Loading authorization contacts…" : error ? "Directory details are unavailable. Confirm a destination with the handling adjuster." : rfaAuthorizationGuidance(directory)}</p>
    {directory?.authorizationNotice ? <p style={{ margin: 0 }}>{directory.authorizationNotice}</p> : null}
    <label style={{ display: "grid", gap: 6, minWidth: 0 }}>{directory?.authorizationStatus === "claim_handling_location_routes" ? "Claim-handling office" : "Authorization contact"}
      <select value={selection} onChange={(event) => { const value = event.target.value; setSelection(value); setManual(""); onChange(value === "" || (value === "manual" || value === "manual-email") ? null : options[Number(value)] ?? null); }} style={{ padding: 10, width: "100%", minWidth: 0, maxWidth: "100%", font: "inherit" }}>
        <option value="">Choose a destination…</option>
        {options.map((option, index) => <option key={`${option.method}:${option.destination}:${index}`} value={String(index)}>{option.label} · {option.method === "fax" ? "Fax" : "Email"}: {option.destination}</option>)}
        <option value="manual">Enter a confirmed adjuster fax</option><option value="manual-email">Enter a confirmed authorization email</option>
      </select>
    </label>
    {selection === "manual-email" ? <label>Authorization email address<input type="email" value={manual} onChange={event => { const value = event.target.value; setManual(value); onChange(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? { method: "email", destination: value.trim(), label: "Confirmed authorization email" } : null); }} /></label> : selection === "manual" ? <label style={{ display: "grid", gap: 6, minWidth: 0 }}>Authorization fax number<input type="tel" value={manual} onChange={(event) => { const value = event.target.value; setManual(value); const fax = normalizeRfaFax(value); onChange(fax ? { method: "fax", destination: fax, label: "Confirmed adjuster fax" } : null); }} style={{ padding: 10, width: "100%", minWidth: 0, boxSizing: "border-box", font: "inherit" }} /></label> : selection !== "" && chosen ? <>
      {chosen.method === "email" ? <p style={{ margin: 0, overflowWrap: "anywhere" }}>Email: {chosen.destination}. Review this recipient before preparing and sending the packet.</p> : null}
      {chosen.phone ? <small>Telephone for questions: {chosen.phone}</small> : null}
    </> : null}
  </fieldset>;
}
