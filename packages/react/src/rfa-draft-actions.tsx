"use client";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createRfaDraftActionsClient, type OrganizationClientOptions, type RfaRecord } from "@mindbill/browser";

export type RfaDraftActionsProps = OrganizationClientOptions & {
  rfa: RfaRecord;
  permissions?: readonly ("create" | "edit")[];
  disabled?: boolean;
  onCopied?: (draft: RfaRecord) => void;
  onCanceled?: (rfa: RfaRecord) => void;
};

/** Reuses request content without reusing the physician's signature or sending a request. */
export function RfaDraftActions({ sessionEndpoint, getSession, apiBaseUrl, fetch: fetchOverride, ...props }: RfaDraftActionsProps): ReactElement | null {
  const options = useMemo<OrganizationClientOptions>(() => ({ ...(sessionEndpoint ? { sessionEndpoint } : {}), ...(getSession ? { getSession } : {}), ...(apiBaseUrl ? { apiBaseUrl } : {}), ...(fetchOverride ? { fetch: fetchOverride } : {}) }), [sessionEndpoint, getSession, apiBaseUrl, fetchOverride]);
  const identity = useMemo(() => crypto.randomUUID(), [options]);
  return <DraftActionsContent key={`${identity}:${props.rfa.id}:${props.rfa.contentRevision}:${props.rfa.status}:${props.rfa.signedAt}:${props.rfa.submittedAt}`} options={options} {...props} />;
}
function DraftActionsContent({ rfa, options, permissions = [], disabled = false, onCopied, onCanceled }: Omit<RfaDraftActionsProps, keyof OrganizationClientOptions> & { options: OrganizationClientOptions }): ReactElement | null {
  const client = useMemo(() => createRfaDraftActionsClient(options), [options]);
  const [confirming, setConfirming] = useState<"copy" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState<"copy" | "cancel" | null>(null);
  const pending = useRef(false);
  const keys = useRef<Partial<Record<"copy" | "cancel", string>>>({});
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const canCopy = permissions.includes("create");
  const canCancel = permissions.includes("edit") && rfa.status === "draft" && !rfa.signedAt && !rfa.submittedAt && !rfa.receivedAt && !rfa.transmissions.some(transmission => transmission.direction === "outbound" && transmission.purpose !== "forward" && ["queued", "sent", "received"].includes(transmission.status));
  if (!canCopy && !canCancel) return null;
  const mutate = async (action: "copy" | "cancel") => {
    if (pending.current || disabled || completed || (action === "copy" ? !canCopy : !canCancel)) return;
    pending.current = true; setBusy(true); setError("");
    const key = keys.current[action] ??= `rfa-${action}-${crypto.randomUUID()}`;
    try {
      const updated = await (action === "copy" ? client.copy : client.cancelDraft)(rfa.id, rfa.contentRevision, key);
      if (alive.current) { setCompleted(action); setConfirming(null); (action === "copy" ? onCopied : onCanceled)?.(updated); }
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "The request could not be updated. Try again."); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  };
  return <section aria-label="RFA draft actions">
    {error ? <p role="alert">{error}</p> : null}
    {completed ? <p role="status">{completed === "copy" ? "A new unsigned draft was created." : "The draft was canceled. Its audit history is retained."}</p> : confirming && (confirming === "copy" ? canCopy : canCancel) ? <div className="mbtd-note">
      {confirming === "copy" ? <>
        <p>Create a new draft with this patient, injury, physician, and requested treatments? Review the new draft and attach supporting documents before signing it.</p>
        <p>Signatures, supporting documents, decisions, and delivery history remain on the original request.</p>
      </> : <p>Cancel this unsigned draft? It will no longer be available for submission. The request and its audit history will be retained.</p>}
      <div className="mbtd-actions"><button type="button" disabled={disabled || busy} onClick={() => { void mutate(confirming); }}>{busy ? "Saving…" : confirming === "copy" ? "Create draft copy" : "Confirm cancellation"}</button><button type="button" disabled={busy} onClick={() => { setConfirming(null); setError(""); }}>Keep current request</button></div>
    </div> : <div className="mbtd-actions">
      {canCopy ? <button type="button" disabled={disabled || busy} onClick={() => setConfirming("copy")}>Copy to new draft</button> : null}
      {canCancel ? <button type="button" disabled={disabled || busy} onClick={() => setConfirming("cancel")}>Cancel draft</button> : null}
    </div>}
  </section>;
}
