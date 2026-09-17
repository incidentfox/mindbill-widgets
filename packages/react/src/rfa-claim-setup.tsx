"use client";
import { useRef, useState, type ReactElement } from "react";
import type { BillReviewPayer, RfaClient, RfaProvisionClaimInput, RfaProvisionClaimResult } from "@mindbill/browser";

export type RfaClaimSetupProps = {
  client: RfaClient;
  disabled?: boolean;
  onCreated: (result: RfaProvisionClaimResult) => void;
  onCancel: () => void;
};
/** Creates the patient and injury together; an existing bill is never required. */
export function RfaClaimSetup({ client, disabled, onCreated, onCancel }: RfaClaimSetupProps): ReactElement {
  const [fields, setFields] = useState({ firstName: "", lastName: "", dateOfBirth: "", phone: "", line1: "", line2: "", city: "", state: "CA", postalCode: "", claimNumber: "", employer: "", dateOfInjury: "", injuryState: "CA", description: "" });
  const [search, setSearch] = useState("");
  const [administrators, setAdministrators] = useState<BillReviewPayer[]>([]);
  const [administratorId, setAdministratorId] = useState("");
  const [payerId, setPayerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const identities = useRef<{ patient: string; claim: string } | null>(null);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const searchSequence = useRef(0);
  const administrator = administrators.find(value => value.id === administratorId);
  const availablePayers = administrator?.payers?.filter(value => value.active !== false) ?? [];
  const locked = disabled || busy;
  const input = (name: keyof typeof fields, label: string, maxLength: number, required = true, type = "text") => <label>{label}<input required={required} type={type} maxLength={maxLength} value={fields[name]} onChange={event => setFields(value => ({ ...value, [name]: event.target.value }))} /></label>;
  return <form onSubmit={async event => {
    event.preventDefault();
    if (locked || !administrator || !client.provisionClaim || (administrator.payerSelectionRequired && !payerId)) return;
    setBusy(true); setError("");
    try {
      identities.current ??= { patient: `rfa-patient-${crypto.randomUUID()}`, claim: `rfa-claim-${crypto.randomUUID()}` };
      const data: RfaProvisionClaimInput = {
        patient: { externalId: identities.current.patient, firstName: fields.firstName.trim(), lastName: fields.lastName.trim(), dateOfBirth: fields.dateOfBirth, ...(fields.phone.trim() ? { phone: fields.phone.trim() } : {}), address: { line1: fields.line1.trim(), ...(fields.line2.trim() ? { line2: fields.line2.trim() } : {}), city: fields.city.trim(), state: fields.state.trim().toUpperCase(), postalCode: fields.postalCode.trim() } },
        claim: { externalId: identities.current.claim, claimNumber: fields.claimNumber.trim(), employer: fields.employer.trim(), dateOfInjury: fields.dateOfInjury, injuryState: fields.injuryState.trim().toUpperCase(), ...(fields.description.trim() ? { description: fields.description.trim() } : {}), claimsAdministrator: { id: administrator.id, name: administrator.name, ...(payerId ? { payerId } : {}) } },
      };
      const body = JSON.stringify(data);
      if (attempt.current?.body !== body) attempt.current = { body, key: `rfa-claim-${crypto.randomUUID()}` };
      const result = await client.provisionClaim(data, { idempotencyKey: attempt.current.key });
      onCreated(result);
    } catch { setError("The patient and injury could not be saved. Check the details and try again. Retrying unchanged details will not create a duplicate."); }
    finally { setBusy(false); }
  }}>
    <fieldset disabled={locked}><legend>New patient and injury</legend>
      <p>Save the patient and injury to use for this authorization request. No bill is required.</p>
      <div className="mbtd-grid">
        {input("firstName", "Patient first name", 100)}{input("lastName", "Patient last name", 100)}
        {input("dateOfBirth", "Date of birth", 10, true, "date")}{input("phone", "Patient phone (optional)", 30, false, "tel")}
        {input("line1", "Patient street address", 200)}{input("line2", "Address line 2 (optional)", 200, false)}
        {input("city", "Patient city", 100)}{input("state", "Patient state", 2)}{input("postalCode", "Patient ZIP code", 12)}
        {input("claimNumber", "Claim number", 200)}{input("employer", "Employer", 200)}
        {input("dateOfInjury", "Date of injury", 10, true, "date")}{input("injuryState", "Injury state", 2)}
        {input("description", "Injury description (optional)", 1000, false)}
      </div>
      <label>Search claims administrators<input type="search" maxLength={200} value={search} onChange={event => { setSearch(event.target.value); searchSequence.current += 1; setSearching(false); }} /></label>
      <button type="button" disabled={searching || !search.trim() || !client.searchClaimsAdministrators} onClick={async () => {
        if (!client.searchClaimsAdministrators) return;
        const sequence = ++searchSequence.current;
        setSearching(true); setError("");
        try { const values = await client.searchClaimsAdministrators(search.trim(), fields.claimNumber.trim() || undefined); if (sequence === searchSequence.current) { setAdministrators(values); setAdministratorId(""); setPayerId(""); setSearched(true); } }
        catch { if (sequence === searchSequence.current) setError("Claims administrators could not be loaded. Try again."); }
        finally { if (sequence === searchSequence.current) setSearching(false); }
      }}>{searching ? "Searching…" : "Find claims administrators"}</button>
      <label>Claims administrator<select required value={administratorId} onChange={event => { setAdministratorId(event.target.value); setPayerId(""); }}><option value="">Choose a claims administrator</option>{administrators.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
      {searched && !administrators.length ? <p>No administrators match this search. Try another name, or add a custom claims administrator in Settings.</p> : null}
      {availablePayers.length ? <label>Payer{administrator?.payerSelectionRequired ? "" : " (optional)"}<select required={administrator?.payerSelectionRequired} value={payerId} onChange={event => setPayerId(event.target.value)}><option value="">Choose a payer</option>{availablePayers.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label> : null}
      {administrator?.payerSelectionRequired && !availablePayers.length ? <p role="alert">This administrator needs a payer selection, but no active payers are available. Choose another administrator or contact your administrator.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="mbtd-actions"><button type="button" onClick={onCancel}>Cancel new patient</button><button className="mbtd-primary" type="submit" disabled={!administrator || !client.provisionClaim || !!(administrator.payerSelectionRequired && !payerId)}>{busy ? "Saving patient and injury…" : "Save patient and injury"}</button></div>
    </fieldset>
  </form>;
}
