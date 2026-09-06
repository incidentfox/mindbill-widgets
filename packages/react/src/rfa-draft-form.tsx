"use client";
import { useState, type ReactElement } from "react";
import { isDraftDate, TreatmentDraftShell, useDraftSave, type TreatmentDraftAppearance } from "./treatment-draft-shared";

export type RfaDraftItemInput = {
  externalId?: string; diagnosisCode: string; serviceDescription: string; procedureCode?: string;
  quantity?: number; units?: number; frequency?: string; duration?: string;
  requestedFrom?: string; requestedTo?: string; metadata?: Record<string, unknown>;
};
/** An unsigned preparation draft. The host owns identity selection, signing, and delivery. */
export type RfaDraftInput = {
  claimId: string; patientId: string; renderingProviderId: string; employeeName: string; providerName: string;
  externalId?: string; claimsAdminId?: string;
  requestType?: "new" | "resubmission_material_change" | "oral_authorization_confirmation";
  reviewType?: "prospective" | "concurrent" | "retrospective"; expedited?: boolean;
  placeOfServiceCode?: string; providerNpi?: string; providerPhone?: string; providerFax?: string;
  claimNumber?: string; dateOfInjury?: string; rationale?: string; materialChange?: string;
  items: RfaDraftItemInput[]; metadata?: Record<string, unknown>;
};
export type RfaDraftFormProps = TreatmentDraftAppearance & {
  /** Remount with a different React key when switching requests. Never pass a signed request. */
  initialDraft: RfaDraftInput;
  /** Persist an unsigned draft only; this callback must not sign or transmit the request. */
  onSave: (draft: RfaDraftInput) => Promise<void>;
};
/** Remove blank optional item fields, retaining an explicitly cleared return fax. */
export function normalizeRfaDraft(draft: RfaDraftInput): RfaDraftInput {
  const copy = structuredClone(draft);
  for (const item of copy.items) {
    for (const key of ["externalId", "procedureCode", "frequency", "duration", "requestedFrom", "requestedTo"] as const) {
      if (item[key] !== undefined && !item[key]?.trim()) delete item[key];
    }
  }
  // Runtime callers may pass extra properties despite the unsigned TypeScript contract.
  delete (copy as RfaDraftInput & { signedAt?: unknown }).signedAt;
  return copy;
}
export function validateRfaDraft(draft: RfaDraftInput): string | null {
  for (const value of [draft.claimId, draft.patientId, draft.renderingProviderId]) if (!value.trim() || value.length > 255) return "Select a claim, patient, and rendering provider in the host application.";
  for (const value of [draft.externalId, draft.claimsAdminId]) if (value !== undefined && (!value.trim() || value.length > 255)) return "Check the request and claims administrator identifiers.";
  for (const value of [draft.employeeName, draft.providerName]) if (!value.trim() || value.length > 200) return "Employee and provider names are required (up to 200 characters).";
  if (draft.requestType !== undefined && !["new", "resubmission_material_change", "oral_authorization_confirmation"].includes(draft.requestType)) return "Choose a valid request type.";
  if (draft.reviewType !== undefined && !["prospective", "concurrent", "retrospective"].includes(draft.reviewType)) return "Choose a valid review type.";
  if (draft.requestType === "resubmission_material_change" && !draft.materialChange?.trim()) return "Describe the material change for this resubmission.";
  if ((draft.rationale?.length ?? 0) > 20000 || (draft.materialChange?.length ?? 0) > 20000) return "Rationale and material change must each be at most 20,000 characters.";
  if (draft.placeOfServiceCode !== undefined && !/^\d{2}$/.test(draft.placeOfServiceCode)) return "Place of service must contain two digits.";
  if ((draft.providerNpi?.length ?? 0) > 20 || (draft.providerPhone?.length ?? 0) > 30 || (draft.claimNumber?.length ?? 0) > 100) return "Check provider contact and claim number lengths.";
  if (draft.providerFax && (draft.providerFax.length > 30 || !/^[+\d().\s-]+$/.test(draft.providerFax) || !/^\d{10,15}$/.test(draft.providerFax.replace(/\D/g, "")))) return "Enter a return fax with 10 to 15 digits, or leave it blank.";
  if (draft.dateOfInjury !== undefined && !isDraftDate(draft.dateOfInjury)) return "Check the injury date in the host application.";
  if (draft.items.length < 1 || draft.items.length > 100) return "Include between 1 and 100 requested services.";
  for (const [index, item] of draft.items.entries()) {
    const prefix = `Service ${index + 1}: `;
    if (!item.diagnosisCode.trim() || item.diagnosisCode.length > 16 || !item.serviceDescription.trim() || item.serviceDescription.length > 1000) return prefix + "a diagnosis code and service description are required.";
    for (const [value, max] of [[item.externalId, 255], [item.procedureCode, 16], [item.frequency, 200], [item.duration, 200]] as const) if (value !== undefined && (!value.trim() || value.length > max)) return prefix + `optional text must contain 1 to ${max} characters.`;
    if (item.units !== undefined && (!Number.isInteger(item.units) || item.units < 1 || item.units > 100000)) return prefix + "units must be a whole number between 1 and 100,000.";
    if (item.quantity !== undefined && (!Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 100000)) return prefix + "quantity must be positive and at most 100,000.";
    if ((item.requestedFrom !== undefined && !isDraftDate(item.requestedFrom)) || (item.requestedTo !== undefined && (!isDraftDate(item.requestedTo) || !item.requestedFrom || item.requestedTo < item.requestedFrom))) return prefix + "enter valid dates with the end on or after the start.";
  }
  return null;
}
export function RfaDraftForm({ initialDraft, onSave, disabled = false, ...appearance }: RfaDraftFormProps): ReactElement {
  const [draft, setDraft] = useState(() => normalizeRfaDraft(initialDraft));
  const action = useDraftSave(onSave), locked = disabled || action.busy;
  const update = (patch: Partial<RfaDraftInput>) => { action.clear(); setDraft((current) => ({ ...current, ...patch })); };
  const updateItem = (index: number, patch: Partial<RfaDraftItemInput>) => { action.clear(); setDraft((current) => ({ ...current, items: current.items.map((item, position) => position === index ? { ...item, ...patch } : item) })); };
  const updateNumber = (index: number, key: "quantity" | "units", value: string) => {
    action.clear(); setDraft((current) => ({ ...current, items: current.items.map((item, position) => {
      if (position !== index) return item;
      const next = { ...item }; if (value === "") delete next[key]; else next[key] = Number(value); return next;
    }) }));
  };
  return <TreatmentDraftShell {...appearance} title="Request for authorization" description="Prepare services and supporting rationale for utilization review.">
    <p className="mbtd-note">Saving creates an unsigned draft. It does not send the request or authorize treatment.</p>
    <form onSubmit={(event) => { event.preventDefault(); if (locked) return; const next = normalizeRfaDraft(draft); void action.save(next, validateRfaDraft(next)); }}>
      <fieldset disabled={locked}><legend>Request details</legend><div className="mbtd-grid">
        <label>Employee<input readOnly value={draft.employeeName} /></label><label>Requesting provider<input readOnly value={draft.providerName} /></label>
        <label>Request type<select value={draft.requestType ?? "new"} onChange={(event) => update({ requestType: event.target.value as NonNullable<RfaDraftInput["requestType"]> })}><option value="new">New request</option><option value="resubmission_material_change">Resubmission with material change</option><option value="oral_authorization_confirmation">Confirm oral authorization</option></select></label>
        <label>Review type<select value={draft.reviewType ?? "prospective"} onChange={(event) => update({ reviewType: event.target.value as NonNullable<RfaDraftInput["reviewType"]> })}><option value="prospective">Prospective — before treatment</option><option value="concurrent">Concurrent — during treatment</option><option value="retrospective">Retrospective — after treatment</option></select></label>
        <label>Review priority<select value={draft.expedited ? "expedited" : "standard"} onChange={(event) => update({ expedited: event.target.value === "expedited" })}><option value="standard">Standard</option><option value="expedited">Expedited review requested</option></select></label>
        <label>Return fax<input maxLength={30} value={draft.providerFax ?? ""} onChange={(event) => update({ providerFax: event.target.value })} /><small>Review the return contact. Organization defaults are not applied automatically.</small></label>
        <label className="mbtd-wide">Clinical rationale<textarea maxLength={20000} value={draft.rationale ?? ""} onChange={(event) => update({ rationale: event.target.value })} /></label>
        {draft.requestType === "resubmission_material_change" ? <label className="mbtd-wide">Material change (required)<textarea required maxLength={20000} value={draft.materialChange ?? ""} onChange={(event) => update({ materialChange: event.target.value })} /></label> : null}
      </div></fieldset>
      {draft.items.map((item, index) => <fieldset key={index} disabled={locked}><legend>Requested service {index + 1}</legend><div className="mbtd-grid">
        <label>Diagnosis code<input required maxLength={16} value={item.diagnosisCode} onChange={(event) => updateItem(index, { diagnosisCode: event.target.value })} /></label>
        <label>Procedure code<input maxLength={16} value={item.procedureCode ?? ""} onChange={(event) => updateItem(index, { procedureCode: event.target.value })} /></label>
        <label className="mbtd-wide">Service description<textarea required maxLength={1000} value={item.serviceDescription} onChange={(event) => updateItem(index, { serviceDescription: event.target.value })} /></label>
        <label>Quantity<input type="number" min={0.001} max={100000} step="any" value={item.quantity ?? ""} onChange={(event) => updateNumber(index, "quantity", event.target.value)} /></label>
        <label>Units<input type="number" min={1} max={100000} step={1} value={item.units ?? ""} onChange={(event) => updateNumber(index, "units", event.target.value)} /></label>
        <label>Frequency<input maxLength={200} value={item.frequency ?? ""} onChange={(event) => updateItem(index, { frequency: event.target.value })} /></label>
        <label>Duration<input maxLength={200} value={item.duration ?? ""} onChange={(event) => updateItem(index, { duration: event.target.value })} /></label>
        <label>Requested from<input type="date" value={item.requestedFrom ?? ""} onChange={(event) => updateItem(index, { requestedFrom: event.target.value })} /></label>
        <label>Requested through<input type="date" value={item.requestedTo ?? ""} onChange={(event) => updateItem(index, { requestedTo: event.target.value })} /></label>
      </div><button type="button" disabled={draft.items.length === 1} onClick={() => update({ items: draft.items.filter((_, position) => position !== index) })}>Remove requested service {index + 1}</button></fieldset>)}
      <div><button type="button" disabled={locked || draft.items.length >= 100} onClick={() => update({ items: [...draft.items, { diagnosisCode: "", serviceDescription: "" }] })}>Add requested service</button></div>
      {action.error ? <p role="alert">{action.error}</p> : null}<div className="mbtd-actions"><button type="submit" className="mbtd-primary" disabled={locked}>{action.busy ? "Saving…" : "Save RFA draft"}</button><p role="status">{action.message}</p></div>
    </form>
  </TreatmentDraftShell>;
}
