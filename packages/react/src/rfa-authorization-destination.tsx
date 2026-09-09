"use client";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { normalizeRfaFax, rfaAuthorizationDestinations, rfaAuthorizationGuidance, type BillClaimsAdministratorDirectory, type RfaAuthorizationDestinationOption } from "@mindbill/browser";

export type RfaAuthorizationDestinationProps = {
  /** Change this when switching the RFA, claims administrator, or injury state. */
  contextKey: string;
  directory: BillClaimsAdministratorDirectory | null;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  /** Selection only: the host owns signing, destination confirmation, and delivery. */
  onChange: (destination: RfaAuthorizationDestinationOption | null) => void;
};

/** Choose a destination without sending an RFA or treating email as fax. */
export function RfaAuthorizationDestination({ contextKey, directory, loading = false, error, disabled = false, onChange }: RfaAuthorizationDestinationProps): ReactElement {
  const options = loading || error ? [] : rfaAuthorizationDestinations(directory);
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
    {directory?.authorizationSource ? <small>Directory observed: {directory.authorizationSource.observedAt.slice(0, 10)}{ /^https?:\/\//i.test(directory.authorizationSource.url) ? <> · <a href={directory.authorizationSource.url} target="_blank" rel="noreferrer">Source</a></> : null}</small> : null}
    <label style={{ display: "grid", gap: 6, minWidth: 0 }}>{directory?.authorizationStatus === "claim_handling_location_routes" ? "Claim-handling office" : "Authorization contact"}
      <select value={selection} onChange={(event) => { const value = event.target.value; setSelection(value); setManual(""); onChange(value === "" || value === "manual" ? null : options[Number(value)] ?? null); }} style={{ padding: 10, width: "100%", minWidth: 0, maxWidth: "100%", font: "inherit" }}>
        <option value="">Choose a destination…</option>
        {options.map((option, index) => <option key={`${option.method}:${option.destination}:${index}`} value={String(index)}>{option.label} · {option.method === "fax" ? "Fax" : "Email"}: {option.destination}</option>)}
        <option value="manual">Enter a confirmed adjuster fax</option>
      </select>
    </label>
    {selection === "manual" ? <label style={{ display: "grid", gap: 6, minWidth: 0 }}>Authorization fax number<input type="tel" value={manual} onChange={(event) => { const value = event.target.value; setManual(value); const fax = normalizeRfaFax(value); onChange(fax ? { method: "fax", destination: fax, label: "Confirmed adjuster fax" } : null); }} style={{ padding: 10, width: "100%", minWidth: 0, boxSizing: "border-box", font: "inherit" }} /></label> : selection !== "" && chosen ? <>
      {chosen.method === "email" ? <p style={{ margin: 0, overflowWrap: "anywhere" }}>Email: {chosen.destination}. This selection does not send an email. Send the signed packet through your email service and record delivery.</p> : null}
      {chosen.phone ? <small>Telephone for questions: {chosen.phone}</small> : null}
    </> : null}
    <small><a href="https://mindbill.org" target="_blank" rel="noopener noreferrer">Powered by MindBill</a></small>
  </fieldset>;
}
