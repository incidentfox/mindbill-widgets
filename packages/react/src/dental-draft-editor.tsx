"use client";
import { useState, type ReactElement } from "react";
import { isDraftDate, TreatmentDraftShell, useDraftSave, type TreatmentDraftAppearance } from "./treatment-draft-shared";

/** Existing source records supplied by the host; saving does not sign or verify them. */
export type DentalAttestationsInput = {
  providerSignatureOnFile: boolean;
  providerAcceptAssignment: "A" | "B" | "C";
  benefitsAssignment: "Y" | "N" | "W";
  releaseOfInformation: "I" | "Y";
  evidenceReference: string;
};
export type DentalConsentInput = {
  mode: "signature_on_file";
  signerName: string;
  signedDate: string;
  evidenceReference: string;
};
export type DentalAdaFormInput = {
  patientConsent?: DentalConsentInput;
  directPaymentAuthorization?: DentalConsentInput;
  providerCertification?: { printedName: string; signedDate: string; evidenceReference: string };
  treatingLicenseNumber?: string;
  treatmentLocation?: { line1: string; city: string; state: string; postalCode: string };
  treatingPhone?: string;
};
export type DentalOrthodonticsInput = {
  appliancePlacementDate: string;
  totalMonths: number;
  remainingMonths: number;
};
export type DentalProsthesisInput =
  | { placement: "I" }
  | { placement: "R"; priorPlacementDate: string };

export type DentalDraftLineInput = {
  code: string | null; description: string | null; editionYear: number | null; serviceDate: string | null;
  quantity: number; /** Extended charge, already includes quantity. Null means unknown. */
  chargeCents: number | null; chargeReference: string | null; teeth: string[]; surfaces: string[];
  oralCavity: string | null; prosthesisNotes: string | null;
  prosthesis?: DentalProsthesisInput;
  /** One-based references to claim diagnosis codes; validated by the host API. */
  diagnosisPointers?: number[];
};
export type DentalDraftContentInput = {
  renderingProviderId: string; billingProviderId?: string | null; diagnosisCodes: string[];
  notes: string | null; lines: DentalDraftLineInput[];
  /** Host-managed clinical details are preserved when saving the full content. */
  attestations?: DentalAttestationsInput;
  adaForm?: DentalAdaFormInput;
  authorizationNumber?: string;
  orthodontics?: DentalOrthodonticsInput;
  missingTeeth?: string[];
};
export type DentalDraftEditorProps = TreatmentDraftAppearance & {
  /** Use a different React key when switching drafts; edits remain local until Save. */
  initialContent: DentalDraftContentInput;
  /** Host persists content using the public dental-drafts API and handles revision conflicts. Never transmits a claim. */
  onSave: (content: DentalDraftContentInput) => Promise<void>;
};
export function dentalDraftChargeSummary(lines: readonly Pick<DentalDraftLineInput, "chargeCents">[]) {
  const knownChargeCents = lines.reduce((sum, line) => sum + (line.chargeCents ?? 0), 0);
  return { knownChargeCents, totalChargeCents: lines.some((line) => line.chargeCents === null) ? null : knownChargeCents };
}
/** Convert decimal dollars exactly; reject excess precision, zero, and exponential notation. */
export function parseDentalCharge(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("Enter a positive charge with at most two decimal places, or leave it blank.");
  const [whole = "0", fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 1_000_000_000) throw new Error("Enter a charge between $0.01 and $10,000,000, or leave it blank.");
  return cents;
}
export function validateDentalDraftContent(content: DentalDraftContentInput): string | null {
  if (!content.renderingProviderId.trim() || content.renderingProviderId.length > 255) return "Choose a rendering provider in the host application.";
  if (content.billingProviderId != null && (!content.billingProviderId.trim() || content.billingProviderId.length > 255)) return "Choose a valid billing provider in the host application.";
  if (content.lines.length > 100) return "A draft can contain up to 100 service lines.";
  if (content.diagnosisCodes.length > 12 || content.diagnosisCodes.some((code) => !code.trim() || code.length > 20)) return "Enter up to 12 diagnosis codes of at most 20 characters each.";
  if (content.notes !== null && (!content.notes.trim() || content.notes.length > 5000)) return "Notes must contain between 1 and 5,000 characters.";
  for (const [index, line] of content.lines.entries()) {
    const prefix = `Line ${index + 1}: `;
    if (line.code !== null && !/^D[0-9]{4}$/.test(line.code)) return prefix + "enter D followed by four digits, or leave the code blank.";
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 100000) return prefix + "enter a whole quantity between 1 and 100,000.";
    if (line.chargeCents !== null && (!Number.isSafeInteger(line.chargeCents) || line.chargeCents < 1 || line.chargeCents > 1_000_000_000)) return prefix + "enter a positive extended charge, or leave it unknown.";
    if (line.serviceDate !== null && !isDraftDate(line.serviceDate)) return prefix + "enter a valid service date.";
    if (line.editionYear !== null && (!Number.isInteger(line.editionYear) || line.editionYear < 1900 || line.editionYear > 2200)) return prefix + "enter an edition year between 1900 and 2200.";
    for (const [value, limit] of [[line.description, 1000], [line.chargeReference, 1000], [line.oralCavity, 100], [line.prosthesisNotes, 2000]] as const) {
      if (value !== null && (!value.trim() || value.length > limit)) return prefix + `text must contain between 1 and ${limit} characters.`;
    }
    if (line.teeth.length > 32 || line.surfaces.length > 10 || [...line.teeth, ...line.surfaces].some((value) => !value.trim() || value.length > 20)) return prefix + "check tooth and surface entries (up to 32 teeth and 10 surfaces, 20 characters each).";
  }
  return null;
}
const blankLine = (): DentalDraftLineInput => ({ code: null, description: null, editionYear: null, serviceDate: null, quantity: 1, chargeCents: null, chargeReference: null, teeth: [], surfaces: [], oralCavity: null, prosthesisNotes: null });
const nullable = (value: string) => value === "" ? null : value;
const split = (value: string) => value.split(",").map((part) => part.trim()).filter(Boolean);
const currency = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export function DentalDraftEditor({ initialContent, onSave, disabled = false, ...appearance }: DentalDraftEditorProps): ReactElement {
  const [content, setContent] = useState<DentalDraftContentInput>(() => structuredClone(initialContent));
  const [charges, setCharges] = useState(() => initialContent.lines.map((line) => line.chargeCents === null ? "" : (line.chargeCents / 100).toFixed(2)));
  const [diagnoses, setDiagnoses] = useState(() => initialContent.diagnosisCodes.join(", "));
  const [teeth, setTeeth] = useState(() => initialContent.lines.map((line) => line.teeth.join(", ")));
  const [surfaces, setSurfaces] = useState(() => initialContent.lines.map((line) => line.surfaces.join(", ")));
  const action = useDraftSave(onSave);
  const locked = disabled || action.busy;
  const updateLine = (index: number, patch: Partial<DentalDraftLineInput>) => { action.clear(); setContent((current) => ({ ...current, lines: current.lines.map((line, position) => position === index ? { ...line, ...patch } : line) })); };
  const parsed = () => ({ ...content, diagnosisCodes: split(diagnoses), lines: content.lines.map((line, index) => ({ ...line, teeth: split(teeth[index] ?? ""), surfaces: split(surfaces[index] ?? ""), chargeCents: parseDentalCharge(charges[index] ?? "") })) });
  let summary: ReturnType<typeof dentalDraftChargeSummary> | null = null;
  try { summary = dentalDraftChargeSummary(parsed().lines); } catch { /* Keep invalid text editable without showing a misleading total. */ }
  return <TreatmentDraftShell {...appearance} title="Dental draft" description="Record dental services, tooth details, and practice charges for review.">
    <p className="mbtd-note">Codes and prices need review. Saving does not send a dental claim. A blank charge remains unknown.</p>
    <form onSubmit={(event) => { event.preventDefault(); if (locked) return; let next: DentalDraftContentInput; try { next = parsed(); } catch { void action.save(content, "Enter positive charges with at most two decimal places, or leave them blank."); return; } void action.save(next, validateDentalDraftContent(next)); }}>
      <fieldset disabled={locked}><legend>Claim details</legend><div className="mbtd-grid"><label>Diagnosis codes, comma separated<input value={diagnoses} onChange={(event) => { action.clear(); setDiagnoses(event.target.value); }} /></label><label>Notes<textarea maxLength={5000} value={content.notes ?? ""} onChange={(event) => { action.clear(); setContent({ ...content, notes: nullable(event.target.value) }); }} /></label></div></fieldset>
      {content.lines.map((line, index) => <fieldset key={index} disabled={locked}><legend>Service {index + 1}</legend><div className="mbtd-grid">
        <label>Dental code<input placeholder="D0120" maxLength={5} value={line.code ?? ""} onChange={(event) => updateLine(index, { code: nullable(event.target.value.toUpperCase()) })} /></label>
        <label>Code edition year<input type="number" min={1900} max={2200} value={line.editionYear ?? ""} onChange={(event) => updateLine(index, { editionYear: event.target.value === "" ? null : Number(event.target.value) })} /></label>
        <label>Date of service<input type="date" value={line.serviceDate ?? ""} onChange={(event) => updateLine(index, { serviceDate: nullable(event.target.value) })} /></label>
        <label>Quantity<input type="number" min={1} max={100000} step={1} value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} /></label>
        <label>Extended line charge ($)<input inputMode="decimal" placeholder="Unknown" value={charges[index] ?? ""} onChange={(event) => { action.clear(); setCharges(charges.map((value, position) => position === index ? event.target.value : value)); }} /><small>Includes all units. This is the practice charge, not a fee allowance.</small></label>
        <label>Charge source / reference<input maxLength={1000} value={line.chargeReference ?? ""} onChange={(event) => updateLine(index, { chargeReference: nullable(event.target.value) })} /></label>
        <label>Teeth, comma separated<input value={teeth[index] ?? ""} onChange={(event) => { action.clear(); setTeeth(teeth.map((value, position) => position === index ? event.target.value : value)); }} /></label>
        <label>Surfaces, comma separated<input value={surfaces[index] ?? ""} onChange={(event) => { action.clear(); setSurfaces(surfaces.map((value, position) => position === index ? event.target.value.toUpperCase() : value)); }} /></label>
        <label>Oral cavity<input maxLength={100} value={line.oralCavity ?? ""} onChange={(event) => updateLine(index, { oralCavity: nullable(event.target.value) })} /></label>
        <label>Service description<input maxLength={1000} value={line.description ?? ""} onChange={(event) => updateLine(index, { description: nullable(event.target.value) })} /></label>
        <label className="mbtd-wide">Prosthesis notes<textarea maxLength={2000} value={line.prosthesisNotes ?? ""} onChange={(event) => updateLine(index, { prosthesisNotes: nullable(event.target.value) })} /></label>
      </div><div className="mbtd-actions"><button type="button" onClick={() => { action.clear(); setContent({ ...content, lines: content.lines.filter((_, position) => position !== index) }); setCharges(charges.filter((_, position) => position !== index)); setTeeth(teeth.filter((_, position) => position !== index)); setSurfaces(surfaces.filter((_, position) => position !== index)); }}>Remove service {index + 1}</button></div></fieldset>)}
      <div><button type="button" disabled={locked || content.lines.length >= 100} onClick={() => { action.clear(); setContent({ ...content, lines: [...content.lines, blankLine()] }); setCharges([...charges, ""]); setTeeth([...teeth, ""]); setSurfaces([...surfaces, ""]); }}>Add dental service</button></div>
      <p role="status">{summary ? summary.totalChargeCents === null ? `Known charges: ${currency(summary.knownChargeCents)} · Total incomplete` : `Total practice charge: ${currency(summary.totalChargeCents)}` : "Review charge amounts before saving."}</p>
      {action.error ? <p role="alert">{action.error}</p> : null}<div className="mbtd-actions"><button type="submit" className="mbtd-primary" disabled={locked}>{action.busy ? "Saving…" : "Save dental draft"}</button><p role="status">{action.message}</p></div>
    </form>
  </TreatmentDraftShell>;
}
