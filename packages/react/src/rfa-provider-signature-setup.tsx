"use client";
import { useRef, useState, type ReactElement } from "react";
import type { RfaClient } from "@mindbill/browser";
import { Checkbox, FileInput } from "./form-controls";

const MAX_SIGNATURE_BYTES = 512 * 1024;
const MAX_SIGNATURE_SIDE = 4096;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

function isPng(file: File) { return file.type === "image/png" || /\.png$/i.test(file.name); }
function isJpeg(file: File) { return file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name); }

function readBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("signature_read_failed"));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result.slice(reader.result.indexOf(",") + 1)) : reject(new Error("signature_read_failed"));
    reader.readAsDataURL(blob);
  });
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element); element.onerror = () => reject(new Error("signature_decode_failed"));
      element.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}

/**
 * MindBill stores RFA signatures as PNG (≤512 KB, ≤4096 px a side). A PNG within those limits is sent unchanged;
 * a JPEG, or a PNG that is too large, is redrawn in the browser as a PNG, scaling down until it fits.
 */
export async function signaturePngBase64(file: File): Promise<string> {
  if (isPng(file) && file.size <= MAX_SIGNATURE_BYTES) {
    // Width and height are in the PNG header; the server re-validates the image.
    const header = new DataView(await file.slice(0, 24).arrayBuffer());
    const sized = header.byteLength >= 24 && header.getUint32(12) === 0x49484452;
    if (!sized || (header.getUint32(16) <= MAX_SIGNATURE_SIDE && header.getUint32(20) <= MAX_SIGNATURE_SIDE)) return readBase64(file);
  }
  const image = await decode(file);
  try {
    let scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("signature_convert_failed");
      context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!png) throw new Error("signature_convert_failed");
      if (png.size <= MAX_SIGNATURE_BYTES) return readBase64(png);
      scale *= 0.7;
    }
    throw new Error("signature_too_large");
  } finally { image.close(); }
}

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
      const contentBase64 = await signaturePngBase64(file);
      const input = { contentBase64, physicianAuthorized: true as const, actorReference: actor.trim() };
      const body = JSON.stringify(input);
      if (attempt.current?.body !== body) attempt.current = { body, key: `rfa-signature-${crypto.randomUUID()}` };
      await client.saveProviderSignature(renderingProviderId, input, { idempotencyKey: attempt.current.key });
      onSaved();
    } catch { setError("The signature could not be saved. Confirm this is a PNG or JPEG image of the signature and try again."); }
    finally { setBusy(false); }
  }}>
    <fieldset disabled={disabled || busy}><legend>Set up physician signature{providerName ? ` for ${providerName}` : ""}</legend>
      <p>Upload the physician’s signature with their authorization. This signature will be available for future requests; saving it does not sign or send this request.</p>
      <label>Physician signature (PNG or JPEG image)<FileInput accept="image/png,image/jpeg,.png,.jpg,.jpeg" required onChange={event => {
        const selected = event.target.files?.[0] ?? null;
        setError(""); setAuthorized(false);
        if (selected && (selected.size === 0 || selected.size > MAX_SOURCE_BYTES || (!isPng(selected) && !isJpeg(selected)))) {
          setFile(null); event.target.value = ""; setError("Choose a PNG or JPEG image of the signature, up to 15 MB."); return;
        }
        setFile(selected);
      }} /></label>
      <label>Your name or staff reference<input required maxLength={200} value={actor} onChange={event => setActor(event.target.value)} /></label>
      <label><Checkbox checked={authorized} onChange={event => setAuthorized(event.target.checked)} />I have the physician’s authorization to save and use this signature for authorization requests.</label>
      {error ? <p role="alert">{error}</p> : null}
      <div className="mbtd-actions">{onCancel ? <button type="button" onClick={onCancel}>Cancel signature setup</button> : null}<button type="submit" disabled={!file || !authorized || !actor.trim() || !client.saveProviderSignature}>{busy ? "Saving signature…" : "Save physician signature"}</button></div>
    </fieldset>
  </form>;
}
