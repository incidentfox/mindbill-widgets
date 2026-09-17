import type { BillFeeContext, CaMonitoredAnesthesiaCare } from "@mindbill/browser";
import { AnesthesiaDirectionFields, directionFromDraft, type DirectionDraft } from "./anesthesia-direction-fields";

export type AnesthesiaDetails = {
  anesthesiaDirection?: DirectionDraft | undefined;
  anesthesiaCare?: "general" | "monitored" | "" | undefined;
  anesthesiaMonitoredFacts?: Partial<Record<keyof CaMonitoredAnesthesiaCare, string>> | undefined;
  anesthesiaMinutes?: string | undefined;
  anesthesiaDocumentation?: "verified" | "directed" | "review" | "" | undefined;
};

/** Candidates disclose inputs; the server validates membership in the adopted code set. */
export const isAnesthesiaCandidate = (code: string): boolean => /^0[01]\d{3}$/.test(code.trim().toUpperCase());

export function anesthesiaDetailsFromSaved(context?: BillFeeContext): AnesthesiaDetails {
  const saved = context?.anesthesiaContext;
  if (!saved) return {};
  return { anesthesiaMinutes: String(saved.actualMinutes), anesthesiaDocumentation:
    saved.providerKind === "physician" && saved.completeSameDayServices === true && saved.otherSameDayServices === false && saved.codingRequirementsSatisfied === true
      ? saved.medicalDirection ? "directed" : saved.personallyPerformedAlone ? "verified" : "review" : "review",
    ...(saved.medicalDirection ? { anesthesiaDirection: saved.medicalDirection as unknown as DirectionDraft } : {}),
    ...(saved.monitoredCare ? { anesthesiaCare: "monitored" as const, anesthesiaMonitoredFacts: Object.fromEntries(Object.entries(saved.monitoredCare).map(([key, value]) => [key, String(value)])) } : {}),
  };
}

/** Clearing documentation or minutes removes a previously verified calculation context. */
export function anesthesiaCalculationContext(placeOfService: string, details: AnesthesiaDetails): BillFeeContext {
  const directed = details.anesthesiaDocumentation === "directed";
  const medicalDirection = directed ? directionFromDraft(details.anesthesiaDirection) : undefined;
  const billedCase = medicalDirection?.cases.find(item => item.caseRef === medicalDirection.billedCaseRef);
  const minutes = directed ? billedCase ? billedCase.interval.endMinute - billedCase.interval.startMinute : 0 : /^\d{1,4}$/.test(details.anesthesiaMinutes ?? "") ? Number(details.anesthesiaMinutes) : 0;
  if ((!directed && details.anesthesiaDocumentation !== "verified") || directed && !medicalDirection || minutes < 1 || minutes > 1440 ||
    !["11", "19", "21", "22", "23", "24"].includes(placeOfService)) return {};
  let monitoredCare: CaMonitoredAnesthesiaCare | undefined;
  if (details.anesthesiaCare === "monitored") {
    const facts = details.anesthesiaMonitoredFacts;
    if (!facts || ["medicallyNecessary", "intraoperativePhysiologicalMonitoring", "preparedForGeneralAnesthesiaOrAdverseReaction", "perioperativeAnesthesiaCare"].some(key => facts[key as keyof CaMonitoredAnesthesiaCare] !== "true") ||
      !["different_provider", "same_provider"].includes(facts.underlyingProcedureProvider ?? "") || !["nerve_block_or_injection", "other"].includes(facts.underlyingProcedure ?? "")) return {};
    monitoredCare = { medicallyNecessary: true, intraoperativePhysiologicalMonitoring: true, preparedForGeneralAnesthesiaOrAdverseReaction: true, perioperativeAnesthesiaCare: true,
      underlyingProcedureProvider: facts.underlyingProcedureProvider as CaMonitoredAnesthesiaCare["underlyingProcedureProvider"], underlyingProcedure: facts.underlyingProcedure as CaMonitoredAnesthesiaCare["underlyingProcedure"] };
  }
  return { anesthesiaContext: { providerKind: "physician", ...(medicalDirection ? { personallyPerformedAlone: false as const, medicalDirection } : { personallyPerformedAlone: true as const }),
    actualMinutes: minutes, placeOfService, completeSameDayServices: true,
    otherSameDayServices: false, codingRequirementsSatisfied: true, ...(monitoredCare ? { monitoredCare } : {}) } };
}

export function AnesthesiaLineFields({ index, details, update }: {
  index: number; details: AnesthesiaDetails; update: (patch: Partial<AnesthesiaDetails>) => void;
}) {
  return <details open><summary>Anesthesia details</summary><div className="mbsf-grid">
    {details.anesthesiaDocumentation !== "directed" && <label className="mbsf-field"><span>Actual anesthesia minutes</span><input className="mbsf-input" aria-label={`Actual anesthesia minutes for line ${index + 1}`} type="number" inputMode="numeric" min={1} max={1440} step={1} value={details.anesthesiaMinutes ?? ""} onChange={(event) => update({ anesthesiaMinutes: event.target.value })} /></label>}
    <label className="mbsf-field"><span>Documented anesthesia circumstances</span><select className="mbsf-input" aria-label={`Documented anesthesia circumstances for line ${index + 1}`} value={details.anesthesiaDocumentation ?? ""} onChange={(event) => update({ anesthesiaDocumentation: event.target.value as AnesthesiaDetails["anesthesiaDocumentation"] })}><option value="">Select from the service documentation…</option><option value="verified">Physician alone for the entire service (AA)</option><option value="directed">Physician medical direction (QK)</option><option value="review">Other circumstances — review needed</option></select></label>
    <label className="mbsf-field"><span>Anesthesia technique</span><select className="mbsf-input" aria-label={`Anesthesia technique for line ${index + 1}`} value={details.anesthesiaCare ?? "general"} onChange={event => update({ anesthesiaCare: event.target.value as AnesthesiaDetails["anesthesiaCare"] })}><option value="general">Anesthesia without monitored care</option><option value="monitored">Monitored anesthesia care (QS)</option></select></label>
    {details.anesthesiaCare === "monitored" && <fieldset className="mbsf-span"><legend>Monitored anesthesia care record</legend><div className="mbsf-grid">{([
      ["medicallyNecessary", "MAC medically necessary"], ["intraoperativePhysiologicalMonitoring", "Intraoperative physiological monitoring performed"],
      ["preparedForGeneralAnesthesiaOrAdverseReaction", "Prepared to convert to general anesthesia or respond to adverse reactions"], ["perioperativeAnesthesiaCare", "Pre-anesthetic evaluation, prescribed care and indicated perioperative care performed"],
    ] as const).map(([key, label]) => <label key={key} className="mbsf-field"><span>{label}</span><select className="mbsf-input" aria-label={`${label} for line ${index + 1}`} value={details.anesthesiaMonitoredFacts?.[key] ?? ""} onChange={event => update({ anesthesiaMonitoredFacts: { ...details.anesthesiaMonitoredFacts, [key]: event.target.value } })}><option value="">Select from the record…</option><option value="true">Yes</option><option value="false">No / not documented</option></select></label>)}
    <label className="mbsf-field"><span>Underlying procedure provider</span><select className="mbsf-input" aria-label={`Underlying procedure provider for line ${index + 1}`} value={details.anesthesiaMonitoredFacts?.underlyingProcedureProvider ?? ""} onChange={event => update({ anesthesiaMonitoredFacts: { ...details.anesthesiaMonitoredFacts, underlyingProcedureProvider: event.target.value } })}><option value="">Select provider relationship…</option><option value="different_provider">Different provider</option><option value="same_provider">Same provider — review needed</option></select></label>
    <label className="mbsf-field"><span>Underlying procedure</span><select className="mbsf-input" aria-label={`Underlying procedure for line ${index + 1}`} value={details.anesthesiaMonitoredFacts?.underlyingProcedure ?? ""} onChange={event => update({ anesthesiaMonitoredFacts: { ...details.anesthesiaMonitoredFacts, underlyingProcedure: event.target.value } })}><option value="">Select procedure category…</option><option value="nerve_block_or_injection">Nerve block or injection</option><option value="other">Other procedure</option></select></label></div></fieldset>}
    {details.anesthesiaDocumentation === "directed" && <AnesthesiaDirectionFields lineNumber={index + 1} value={details.anesthesiaDirection} onChange={anesthesiaDirection => update({ anesthesiaDirection })} />}
    <p className="mbsf-help mbsf-span">Use 1 service with AA for personal performance or QK for medical direction; add QS for monitored care. Direction minutes come from the billed case interval. Claims report elapsed minutes; the fee check converts minutes to time units and evaluates documented circumstances. All same-day patient services must be included.</p>
  </div></details>;
}
