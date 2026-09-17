"use client";
import { useRef, useState, type ReactElement } from "react";
import type { RfaClient } from "@mindbill/browser";

export type RfaProviderSignatureSetupProps = {
  client: RfaClient;
  renderingProviderId: string;
  providerName?: string;
  disabled?: boolean;
  onSaved: () => void;
  onCancel?: () => void;
};
/** The server requires both RFA signing and organization-management permissions. */
export function RfaProviderSignatureSetup(props: RfaProviderSignatureSetupProps): ReactElement {
  // A provider change must discard any previous physician's upload and authorization.
  return <SignatureForm key={props.renderingProviderId} {...props} />;
}
function SignatureForm({ client, renderingProviderId, providerName, disabled, onSaved, onCancel }: RfaProviderSignatureSetupProps): ReactElement {
  const [file, setFile] = useState<File | null>(null);
  const [actor, setActor] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef<{ body: string; key: string } | null>(null);
  return <form onSubmit={async event => {
    event.preventDefault();
    if (busy || disabled || !file || !authorized || !actor.trim() || !client.saveProviderSignature) return;
    setBusy(true); setError("");
    try {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("signature_read_failed"));
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result.slice(reader.result.indexOf(",") + 1)) : reject(new Error("signature_read_failed"));
        reader.readAsDataURL(file);
      });
      const input = { contentBase64, physicianAuthorized: true as const, actorReference: actor.trim() };
      const body = JSON.stringify(input);
      if (attempt.current?.body !== body) attempt.current = { body, key: `rfa-signature-${crypto.randomUUID()}` };
      await client.saveProviderSignature(renderingProviderId, input, { idempotencyKey: attempt.current.key });
      onSaved();
    } catch { setError("The signature could not be saved. Confirm this is a valid PNG image and try again."); }
    finally { setBusy(false); }
  }}>
    <fieldset disabled={disabled || busy}><legend>Set up physician signature{providerName ? ` for ${providerName}` : ""}</legend>
      <p>Upload the physician’s signature with their authorization. This signature will be available for future requests; saving it does not sign or send this request.</p>
      <label>Physician signature (PNG, up to 512 KB)<input type="file" accept="image/png,.png" required onChange={event => {
        const selected = event.target.files?.[0] ?? null;
        setError(""); setAuthorized(false);
        if (selected && (selected.size === 0 || selected.size > 512 * 1024 || (selected.type !== "image/png" && !/\.png$/i.test(selected.name)))) {
          setFile(null); event.target.value = ""; setError("Choose a PNG signature image up to 512 KB."); return;
        }
        setFile(selected);
      }} /></label>
      <label>Your name or staff reference<input required maxLength={200} value={actor} onChange={event => setActor(event.target.value)} /></label>
      <label><input type="checkbox" checked={authorized} onChange={event => setAuthorized(event.target.checked)} />I have the physician’s authorization to save and use this signature for authorization requests.</label>
      {error ? <p role="alert">{error}</p> : null}
      <div className="mbtd-actions">{onCancel ? <button type="button" onClick={onCancel}>Cancel signature setup</button> : null}<button type="submit" disabled={!file || !authorized || !actor.trim() || !client.saveProviderSignature}>{busy ? "Saving signature…" : "Save physician signature"}</button></div>
    </fieldset>
  </form>;
}
