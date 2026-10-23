"use client";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createBillDraftsClient, createBillReferenceClient, createEncounterQuoter, type BillDraft, type EncounterQuoteIdentity, type EncounterQuoteResult } from "@mindbill/browser";
import { BillSubmissionForm, type BillSubmissionFormProps, type BillSubmissionInput } from "./bill-submission-form";

export type ConnectedTreatmentBillFormProps = Omit<BillSubmissionFormProps, "onQuoteEncounter" | "treatmentBilling" | "draft" | "onSaveDraft"> & {
  /**
   * The saved rendering provider and place of service (and optionally billing provider and claim) the visit is
   * priced with. Ids come from the RFA creation context or the organization profile. When resuming a draft,
   * ids missing here are taken from the draft.
   */
  encounter: Partial<EncounterQuoteIdentity>;
  /** Show visit-wide notes (per-visit caps, LC 4604.5 visit counts) under the heading (inside the description). Defaults to true. */
  showVisitNotes?: boolean;
  /** Receives every encounter estimate, or null when pricing is unavailable. */
  onEncounterQuote?: (result: EncounterQuoteResult | null) => void;
  /** Adds "Save draft": saves the bill as entered to `/partner/v2/bill-drafts` without sending it. Needs `bills:create`. */
  drafts?: boolean;
  /** Resume this saved draft: its bill replaces `initialBill`, and submitting it marks the draft submitted. */
  draftId?: string;
  /** Your idempotent reference for a new draft (unique per organization). */
  draftExternalId?: string;
  /** Called after each draft save with the saved draft (use `id` to resume it later). */
  onDraftSaved?: (draft: BillDraft) => void;
  /** Called when `draftId` cannot be loaded. */
  onDraftError?: (error: Error) => void;
};

/**
 * A treatment (CMS-1500 professional) bill form whose lines show Charge, Expected (OMFS) and Difference,
 * priced together as one visit through `POST /partner/v2/fee-quotes/encounter`: the same calculation MindBill
 * uses when it saves a treatment bill. Requires a `bills:read` browser session and treatment billing.
 * With `showFeeEstimates={false}` the lines show only the entered charges; the estimate is informational and the
 * entered charge is always what is billed.
 * With `drafts`, the bill can be saved unsent and resumed later with `draftId`.
 */
export function ConnectedTreatmentBillForm({ encounter, showVisitNotes = true, onEncounterQuote, editableTreatmentCharges = true, description,
  drafts = false, draftId, draftExternalId, onDraftSaved, onDraftError, initialBill, ...props }: ConnectedTreatmentBillFormProps): ReactElement {
  const { getSession, sessionEndpoint, apiBaseUrl, fetch: fetchOverride } = props;
  const options = useMemo(() => ({
    ...(getSession ? { getSession } : {}), ...(sessionEndpoint ? { sessionEndpoint } : {}),
    ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}),
  }), [getSession, sessionEndpoint, apiBaseUrl, fetchOverride]);
  const client = useMemo(() => createBillReferenceClient(options), [options]);
  const draftsClient = useMemo(() => createBillDraftsClient(options), [options]);
  // A host callback that changes every render must not restart pricing or reload the draft.
  const onQuote = useRef(onEncounterQuote); onQuote.current = onEncounterQuote;
  const onLoadError = useRef(onDraftError); onLoadError.current = onDraftError;

  const [loaded, setLoaded] = useState<BillDraft | null>(null);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    if (!draftId) { setLoaded(null); return; }
    let active = true;
    setLoaded(null); setLoadError("");
    draftsClient.get(draftId).then(value => { if (active) setLoaded(value); }).catch((error: unknown) => {
      if (!active) return;
      setLoadError("The saved draft could not be opened.");
      onLoadError.current?.(error instanceof Error ? error : new Error("draft_unavailable"));
    });
    return () => { active = false; };
  }, [draftId, draftsClient]);
  const [saved, setSaved] = useState<{ id: string; revision: number } | null>(null);
  useEffect(() => { setSaved(loaded && loaded.status === "draft" ? { id: loaded.id, revision: loaded.revision } : null); }, [loaded]);

  const identityValue = { ...(loaded?.encounter ?? {}), ...Object.fromEntries(Object.entries(encounter).filter(([, value]) => value)) } as Partial<EncounterQuoteIdentity>;
  const [visitNotes, setVisitNotes] = useState<string[]>([]);
  const identity = JSON.stringify([identityValue.renderingProviderId ?? "", identityValue.placeOfServiceId ?? "", identityValue.billingProviderId ?? null, identityValue.claimId ?? null]);
  const onQuoteEncounter = useMemo(() => {
    const [renderingProviderId, placeOfServiceId, billingProviderId, claimId] = JSON.parse(identity) as [string, string, string | null, string | null];
    return createEncounterQuoter(client, { renderingProviderId, placeOfServiceId, ...(billingProviderId ? { billingProviderId } : {}), ...(claimId ? { claimId } : {}) },
      result => { setVisitNotes(result?.visitNotes ?? []); onQuote.current?.(result); });
  }, [client, identity]);

  if (draftId && loadError) return <p role="alert">{loadError}</p>;
  if (draftId && !loaded) return <p role="status">Loading the saved draft…</p>;
  if (loaded && loaded.status !== "draft") {
    return <p role="status">{loaded.status === "submitted" ? `This draft was already submitted${loaded.submittedBillId ? ` as bill ${loaded.submittedBillId}` : ""}.` : "This draft is being submitted."}</p>;
  }

  const saveDraft = async (bill: BillSubmissionInput) => {
    const input = { bill: bill as unknown as Record<string, unknown>, encounter: identityValue };
    const draft = saved
      ? await draftsClient.update(saved.id, saved.revision, input)
      : await draftsClient.create({ ...input, ...(draftExternalId ? { externalId: draftExternalId } : {}) });
    setSaved({ id: draft.id, revision: draft.revision });
    onDraftSaved?.(draft);
  };
  const notes = showVisitNotes && visitNotes.length
    ? <span role="note" aria-label="Visit notes" style={{ display: "block", marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 13, lineHeight: 1.45,
      background: "color-mix(in srgb,#d97706 10%,var(--mb-surface,#fff))", color: "#7a4a00" }}>{visitNotes.map(note => <span key={note} style={{ display: "block" }}>{note}</span>)}</span>
    : null;
  return <BillSubmissionForm key={loaded?.id ?? "new"} {...props}
    initialBill={loaded ? { ...initialBill, ...(loaded.bill as Partial<BillSubmissionInput>) } as BillSubmissionInput : initialBill}
    treatmentBilling editableTreatmentCharges={editableTreatmentCharges} onQuoteEncounter={onQuoteEncounter}
    {...(saved ? { draft: saved } : {})}
    {...(drafts ? { onSaveDraft: saveDraft } : {})}
    description={notes ? <>{description}{notes}</> : description} />;
}
