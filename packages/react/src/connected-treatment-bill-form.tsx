"use client";
import { useMemo, useRef, useState, type ReactElement } from "react";
import { createBillReferenceClient, createEncounterQuoter, type EncounterQuoteIdentity, type EncounterQuoteResult } from "@mindbill/browser";
import { BillSubmissionForm, type BillSubmissionFormProps } from "./bill-submission-form";

export type ConnectedTreatmentBillFormProps = Omit<BillSubmissionFormProps, "onQuoteEncounter" | "treatmentBilling"> & {
  /**
   * The saved rendering provider and place of service (and optionally billing provider and claim) the visit is
   * priced with. Ids come from the RFA creation context or the organization profile.
   */
  encounter: EncounterQuoteIdentity;
  /** Show visit-wide notes (per-visit caps, LC 4604.5 visit counts) under the heading (inside the description). Defaults to true. */
  showVisitNotes?: boolean;
  /** Receives every encounter estimate, or null when pricing is unavailable. */
  onEncounterQuote?: (result: EncounterQuoteResult | null) => void;
};

/**
 * A treatment (CMS-1500 professional) bill form whose lines show Charge, Expected (OMFS) and Difference,
 * priced together as one visit through `POST /partner/v2/fee-quotes/encounter`: the same calculation MindBill
 * uses when it saves a treatment bill. Requires a `bills:read` browser session and treatment billing.
 */
export function ConnectedTreatmentBillForm({ encounter, showVisitNotes = true, onEncounterQuote, editableTreatmentCharges = true, description, ...props }: ConnectedTreatmentBillFormProps): ReactElement {
  const { getSession, sessionEndpoint, apiBaseUrl, fetch: fetchOverride } = props;
  const client = useMemo(() => createBillReferenceClient({
    ...(getSession ? { getSession } : {}), ...(sessionEndpoint ? { sessionEndpoint } : {}),
    ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}),
  }), [getSession, sessionEndpoint, apiBaseUrl, fetchOverride]);
  const [visitNotes, setVisitNotes] = useState<string[]>([]);
  // A host callback that changes every render must not restart pricing.
  const onQuote = useRef(onEncounterQuote); onQuote.current = onEncounterQuote;
  const identity = JSON.stringify([encounter.renderingProviderId, encounter.placeOfServiceId, encounter.billingProviderId ?? null, encounter.claimId ?? null]);
  const onQuoteEncounter = useMemo(() => {
    const [renderingProviderId, placeOfServiceId, billingProviderId, claimId] = JSON.parse(identity) as [string, string, string | null, string | null];
    return createEncounterQuoter(client, { renderingProviderId, placeOfServiceId, ...(billingProviderId ? { billingProviderId } : {}), ...(claimId ? { claimId } : {}) },
      result => { setVisitNotes(result?.visitNotes ?? []); onQuote.current?.(result); });
  }, [client, identity]);
  const notes = showVisitNotes && visitNotes.length
    ? <span role="note" aria-label="Visit notes" style={{ display: "block", marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 13, lineHeight: 1.45,
      background: "color-mix(in srgb,#d97706 10%,var(--mb-surface,#fff))", color: "#7a4a00" }}>{visitNotes.map(note => <span key={note} style={{ display: "block" }}>{note}</span>)}</span>
    : null;
  return <BillSubmissionForm {...props} treatmentBilling editableTreatmentCharges={editableTreatmentCharges} onQuoteEncounter={onQuoteEncounter}
    description={notes ? <>{description}{notes}</> : description} />;
}
