"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { BillReferenceClient, CaClaimFeeQuoteInput, CaClaimFeeQuoteResult, CaFeeCitation } from "@mindbill/browser";
import { isInitialPtEvaluationCode } from "./therapy-line-fields";
import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";

type Line = CaClaimFeeQuoteInput["lines"][number];
type Technical = NonNullable<Line["technicalComponentContext"]>;
type Draft = { line: Line; modifiers: string; charge: string; interpretationLocation: string; imagingSessionReference: string;
  technicalPerformance: "" | "true" | "false"; technicalHospitalStatus: "" | Technical["patientHospitalStatus"];
  technicalSupervision: "" | Technical["supervisionLevel"]; technicalSessionReference: string;
};
export type FeeScheduleCalculatorProps = {
  client: Pick<BillReferenceClient, "quoteClaimFees">;
  initialLines?: CaClaimFeeQuoteInput["lines"];
  onQuote?: (result: CaClaimFeeQuoteResult) => void;
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
};
const money = (cents: number | null) => cents === null ? "Needs review" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const label = (status: string) => ({ priced: "Calculated", requires_review: "Needs review", not_separately_payable: "Not separately payable", evaluated: "Evaluated", source_unavailable: "Source unavailable", not_applicable: "Not applicable" })[status] ?? status;
function safeUrl(url: string): string | undefined { try { const parsed = new URL(url); return parsed.protocol === "https:" ? parsed.href : undefined; } catch { return undefined; } }
function SourceLink({ url, children }: { url: string; children: React.ReactNode }) { const href = safeUrl(url); return href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>; }
function Sources({ sources }: { sources: CaFeeCitation[] }) { return <ul className="mbfc-sources">{sources.map((s, i) => <li key={`${s.id}-${i}`}><SourceLink url={s.url}>{s.id}</SourceLink>{(s.effectiveFrom || s.effectiveThrough) && <small>Effective {s.effectiveFrom ?? "—"} through {s.effectiveThrough ?? "open-ended"}</small>}</li>)}</ul>; }
const physician = (): NonNullable<Line["physicianContext"]> => ({ providerKind: "physician", placeOfService: "11", standaloneService: true, globalPeriodApplies: false, hpsaBonusEligible: false });
const newLine = (id: string): Line => ({ id, code: "", dateOfService: "", units: 1, physicianContext: physician() });
const draft = (line: Line): Draft => ({
  technicalPerformance: line.technicalComponentContext ? String(line.technicalComponentContext.performedByBillingProviderGroup) as "true" | "false" : "",
  technicalHospitalStatus: line.technicalComponentContext?.patientHospitalStatus ?? "",
  technicalSupervision: line.technicalComponentContext?.supervisionLevel ?? "",
  technicalSessionReference: line.technicalComponentContext?.imagingSessionReference ?? "", line: { ...line, ...(!line.physicianContext && !line.therapyContext && !line.anesthesiaContext && !line.padbContext ? { physicianContext: physician() } : {}) }, modifiers: line.modifiers?.join(", ") ?? "", interpretationLocation: line.professionalComponentContext?.interpretationLocation ?? "", imagingSessionReference: line.professionalComponentContext?.imagingSessionReference ?? "", charge: line.chargeCents === undefined ? "" : (line.chargeCents / 100).toFixed(2) });

/** Uses the server's effective-date calculation and claim edits; never calculates fees in the browser. */
export function FeeScheduleCalculator({ client, initialLines, onQuote, appearance, className, style }: FeeScheduleCalculatorProps) {
  const [rows, setRows] = useState<Draft[]>(() => (initialLines?.length ? initialLines : [newLine("line-1")]).map(draft));
  const [result, setResult] = useState<CaClaimFeeQuoteResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const counter = useRef(1);
  useEffect(() => () => { generation.current++; }, []);
  const change = (next: Draft[]) => {
    generation.current++; setRows(next); setResult(null); setError(""); setBusy(false);
  };
  const update = (index: number, patch: Partial<Line>, extra: Partial<Draft> = {}) => change(rows.map((row, i) => i === index ? { ...row, ...extra, line: { ...row.line, ...patch } } : row));
  const updatePhysician = (index: number, patch: Partial<NonNullable<Line["physicianContext"]>>) => update(index, { physicianContext: { ...physician(), ...rows[index]!.line.physicianContext, ...patch } });
  const updateTherapy = (index: number, patch: { [K in keyof NonNullable<Line["therapyContext"]>]?: NonNullable<Line["therapyContext"]>[K] | undefined }) => {
    const context = { ...rows[index]!.line.therapyContext, ...patch };
    update(index, { therapyContext: Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined)) });
  };
  function selectServiceType(index: number, therapy: boolean) {
    const physicianContext = rows[index]!.line.physicianContext;
    const base = { ...rows[index]!.line }; delete base.physicianContext; delete base.therapyContext;
    const line: Line = therapy ? { ...base, therapyContext: { placeOfService: physicianContext?.placeOfService ?? "11" } } : { ...base, physicianContext: physician() };
    change(rows.map((row, i) => i === index ? { ...row, line } : row));
  }
  async function calculate() {
    const requestGeneration = ++generation.current; setBusy(true); setError(""); setResult(null);
    try {
      const lines = rows.map(({ line, modifiers, charge, interpretationLocation, imagingSessionReference, technicalPerformance, technicalHospitalStatus, technicalSupervision, technicalSessionReference }) => {
        const values = modifiers.trim() ? modifiers.trim().toUpperCase().split(/[\s,]+/) : [];
        if (values.length > 4 || new Set(values).size !== values.length || values.some((v) => !/^[A-Z0-9]{2}$/.test(v))) throw new Error("Enter up to four distinct two-character modifiers per line.");
        if (charge && !/^\d+(\.\d{1,2})?$/.test(charge)) throw new Error("Enter charges in dollars with no more than two decimal places.");
        if (imagingSessionReference && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(imagingSessionReference)) throw new Error("Use a session reference of 1–64 letters, numbers, periods, underscores, colons or hyphens, beginning with a letter or number.");
        if (imagingSessionReference && !interpretationLocation) throw new Error("Select the interpretation location for each imaging session.");
        const hasTechnicalDraft = Boolean(technicalPerformance || technicalHospitalStatus || technicalSupervision || technicalSessionReference);
        if (hasTechnicalDraft && (!technicalPerformance || !technicalHospitalStatus || !technicalSupervision || !technicalSessionReference)) throw new Error("Complete the technical imaging details: who furnished the service, hospital patient status, supervision and actual session reference.");
        if (technicalSessionReference && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(technicalSessionReference)) throw new Error("Use a technical imaging session reference of 1–64 letters, numbers, periods, underscores, colons or hyphens, beginning with a letter or number.");
        const technical: Technical | undefined = technicalPerformance && technicalHospitalStatus && technicalSupervision && technicalSessionReference ? {
          performedByBillingProviderGroup: technicalPerformance === "true",
          patientHospitalStatus: technicalHospitalStatus,
          supervisionLevel: technicalSupervision,
          imagingSessionReference: technicalSessionReference,
          completeSameDayImagingServices: line.technicalComponentContext?.completeSameDayImagingServices !== false,
        } : undefined;
        const therapy = { ...line.therapyContext };
        if (isInitialPtEvaluationCode(line.code)) { delete therapy.directOneOnOneMinutes; delete therapy.totalVisitMinutes; }
        const base = { ...line }; delete base.technicalComponentContext; delete base.professionalComponentContext; delete base.chargeCents; delete base.serviceZip; delete base.serviceCounty;
        const professional = { ...line.professionalComponentContext }; delete professional.imagingSessionReference;
        const amount = charge ? Math.round(Number(charge) * 100) : undefined;
        if (amount !== undefined && !Number.isSafeInteger(amount)) throw new Error("Charge is outside the supported range.");
        return { ...base, ...(line.serviceZip?.trim() ? { serviceZip: line.serviceZip.trim() } : {}), ...(line.serviceCounty?.trim() ? { serviceCounty: line.serviceCounty.trim() } : {}), code: line.code.toUpperCase().trim(), modifiers: values,
          ...(amount === undefined ? {} : { chargeCents: amount }),
          catalogContext: { ...line.catalogContext, codingRequirementsSatisfied: line.catalogContext?.codingRequirementsSatisfied !== false },
          ...(technical ? { technicalComponentContext: technical } : {}),
          ...(interpretationLocation ? { professionalComponentContext: {
            ...professional,
            // This calculator collects the full encounter; preserve an explicit host restriction.
            completeSameDayImagingServices: professional.completeSameDayImagingServices !== false,
            interpretationLocation: interpretationLocation as "same_as_patient_service" | "different_from_patient_service",
            ...(imagingSessionReference ? { imagingSessionReference } : {}),
          } } : {}),
          ...(line.therapyContext ? { therapyContext: { ...therapy, completeSameDayServices: therapy.completeSameDayServices !== false, otherSameDayServices: therapy.otherSameDayServices === true || rows.some((r) => r.line.id !== line.id && r.line.dateOfService === line.dateOfService) } } : {}),
          ...(line.physicianContext ? { physicianContext: { ...line.physicianContext, standaloneService: rows.filter((r) => r.line.dateOfService === line.dateOfService).length === 1 } } : {}),
        };
      });
      const quote = await client.quoteClaimFees({ lines, completeDateOfServiceContext: true });
      if (generation.current !== requestGeneration) return;
      setResult(quote); onQuote?.(quote);
    } catch (e) { if (generation.current === requestGeneration) setError(e instanceof Error ? e.message : "Fee calculation is unavailable. Please retry."); }
    finally { if (generation.current === requestGeneration) setBusy(false); }
  }
  return <section className={`mbfc ${className ?? ""}`} style={{ ...mindBillAppearanceStyle(appearance), ...style }} aria-label="California fee schedule calculator">
    <style>{styles}</style>
    <header><p className="mbfc-eyebrow">CALIFORNIA · FEE SCHEDULES</p><h2>Calculate treatment fees</h2><p>Enter all services for one patient and provider or group. Each service date selects the applicable schedule and amendments.</p></header>
    <form onSubmit={(event) => { event.preventDefault(); void calculate(); }}>
      {rows.map(({ line, modifiers, charge, interpretationLocation, imagingSessionReference, technicalPerformance, technicalHospitalStatus, technicalSupervision, technicalSessionReference }, index) => <fieldset key={line.id}><legend>Service {index + 1}</legend>
        <div className="mbfc-grid">
          <label>Procedure code<input required pattern="[A-Za-z0-9]{5}" maxLength={5} value={line.code} onChange={(e) => update(index, { code: e.target.value.toUpperCase() })} /></label>
          <label>Date of service<input required type="date" value={line.dateOfService} onChange={(e) => update(index, { dateOfService: e.target.value })} /></label>
          <label>Modifiers<input placeholder="e.g. 95, 25" value={modifiers} onChange={(e) => update(index, {}, { modifiers: e.target.value })} /></label>
          <label>Units<input required type="number" min="1" step="1" value={line.units ?? 1} onChange={(e) => update(index, { units: Number(e.target.value) })} /></label>
          <label>Charge ($)<input inputMode="decimal" placeholder="Optional" value={charge} onChange={(e) => update(index, {}, { charge: e.target.value })} /></label>
          <label>Service ZIP<input inputMode="numeric" pattern="[0-9]{5}([0-9]{4})?" value={line.serviceZip ?? ""} onChange={(e) => update(index, { serviceZip: e.target.value })} /></label>
          <label>Service county<input placeholder="When needed to resolve locality" value={line.serviceCounty ?? ""} onChange={(e) => update(index, { serviceCounty: e.target.value })} /></label>
        </div>
        <details className="mbfc-context" open><summary>Provider and service context</summary>
          {!line.anesthesiaContext && !line.padbContext && <label>Service type<select value={line.therapyContext ? "therapy" : "professional"} onChange={(e) => selectServiceType(index, e.target.value === "therapy")}><option value="professional">Professional service</option><option value="therapy">Physical therapy</option></select></label>}
          {line.therapyContext && <div className="mbfc-grid">
            <label>Therapy pricing basis<select value={line.hasFeeAgreement === undefined ? "" : String(line.hasFeeAgreement)} onChange={(event) => {
              const next = { ...line }; delete next.hasFeeAgreement;
              if (event.target.value) next.hasFeeAgreement = event.target.value === "true";
              change(rows.map((row, i) => i === index ? { ...row, line: next } : row));
            }}><option value="">Not specified</option><option value="false">OMFS — no negotiated fee agreement</option><option value="true">Negotiated fee agreement</option></select></label>
            {isInitialPtEvaluationCode(line.code) && <p>Initial evaluations are untimed. Include evaluation history from earlier dates in this care episode. One unit as the only service that day is supported; other circumstances need review.</p>}
            <label>Therapy provider<select value={line.therapyContext.providerKind ?? ""} onChange={(e) => updateTherapy(index, { providerKind: e.target.value ? e.target.value as "physical_therapist" | "other" : undefined })}><option value="">Not specified</option><option value="physical_therapist">Physical therapist</option><option value="other">Other</option></select></label>
            <label>Place of service<input required pattern="[0-9]{2}" maxLength={2} value={line.therapyContext.placeOfService ?? ""} onChange={(e) => updateTherapy(index, { placeOfService: e.target.value })} /></label>
            {([['directOneOnOneMinutes', 'Direct one-on-one minutes'], ['totalVisitMinutes', 'Total visit minutes'], ['visitsOnDate', 'Visits on this date']] as const).filter(([key]) => !isInitialPtEvaluationCode(line.code) || key === 'visitsOnDate').map(([key, title]) => <label key={key}>{title}<input required type="number" min={key === "visitsOnDate" ? 1 : 0} step="1" value={line.therapyContext![key] ?? ""} onChange={(e) => updateTherapy(index, { [key]: e.target.value ? Number(e.target.value) : undefined })} /></label>)}
            {([...(isInitialPtEvaluationCode(line.code) ? [['priorInitialEvaluationInEpisode', 'Prior initial evaluation in this care episode'] as const] : []), ['personallyPerformed', 'Personally performed by therapist'], ['hospitalPatient', 'Hospital patient'], ['incidentToPhysicianService', 'Incident to physician service'], ['assistantInvolved', 'Therapy assistant involved'], ['globalPeriodApplies', 'Global surgical period applies'], ['hpsaBonusEligible', 'HPSA bonus eligible']] as const).map(([key, title]) => <label key={key}>{title}<select value={line.therapyContext![key] === undefined ? "" : String(line.therapyContext![key])} onChange={(e) => updateTherapy(index, { [key]: e.target.value ? e.target.value === "true" : undefined })}><option value="">Not specified</option><option value="false">No</option><option value="true">Yes</option></select></label>)}
          </div>}
          {line.anesthesiaContext || line.padbContext ? <p>Specialty service context supplied by your application. The complete context is included in this quote.</p> : !line.therapyContext && <div className="mbfc-grid">
            <label>Provider type<select value={line.physicianContext?.providerKind ?? "physician"} onChange={(e) => updatePhysician(index, { providerKind: e.target.value as NonNullable<Line["physicianContext"]>["providerKind"] })}><option value="physician">Physician</option><option value="physician_assistant">Physician assistant</option><option value="nurse_practitioner">Nurse practitioner</option><option value="clinical_nurse_specialist">Clinical nurse specialist</option><option value="clinical_social_worker">Clinical social worker</option><option value="other">Other</option></select></label>
            <label>Place of service<input required pattern="[0-9]{2}" maxLength={2} value={line.physicianContext?.placeOfService ?? "11"} onChange={(e) => updatePhysician(index, { placeOfService: e.target.value })} /><small>11 office · 19/22 outpatient · 21 inpatient · 02/10 telehealth</small></label>
            <label>Visit modality<select value={line.physicianContext?.telehealthModality ?? "in_person"} onChange={(e) => { const context = { ...physician(), ...line.physicianContext }; delete context.telehealthModality; update(index, { physicianContext: e.target.value === "in_person" ? context : { ...context, telehealthModality: e.target.value as "audio_video" | "audio_only" } }); }}><option value="in_person">In person</option><option value="audio_video">Telehealth: audio and video</option><option value="audio_only">Telehealth: audio only</option></select></label>
            <label>Global surgical period<select value={String(line.physicianContext?.globalPeriodApplies ?? false)} onChange={(e) => updatePhysician(index, { globalPeriodApplies: e.target.value === "true" })}><option value="false">Does not apply</option><option value="true">Applies</option></select></label>
            <label>HPSA bonus eligibility<select value={String(line.physicianContext?.hpsaBonusEligible ?? false)} onChange={(e) => updatePhysician(index, { hpsaBonusEligible: e.target.value === "true" })}><option value="false">Not eligible</option><option value="true">Eligible</option></select></label>
            {line.physicianContext && line.physicianContext.providerKind !== "physician" && <label>Incident to physician service<select value={line.physicianContext.incidentToPhysicianService === undefined ? "" : String(line.physicianContext.incidentToPhysicianService)} onChange={(e) => updatePhysician(index, { incidentToPhysicianService: e.target.value === "true" })}><option value="">Not specified</option><option value="false">No</option><option value="true">Yes</option></select></label>}
          </div>}
          {(modifiers.split(/[\s,]+/).includes("26") || line.professionalComponentContext || interpretationLocation || imagingSessionReference) && <div className="mbfc-imaging">
            <h3>Professional interpretation</h3>
            <div className="mbfc-grid">
              <label>Interpretation location<select value={interpretationLocation} onChange={e => update(index, {}, { interpretationLocation: e.target.value })}><option value="">Not specified</option><option value="same_as_patient_service">Same physical location as patient service</option><option value="different_from_patient_service">Different physical location</option></select></label>
              <label>Imaging session reference<input maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9._:\-]{0,63}" placeholder="Optional, e.g. session-1" value={imagingSessionReference} onChange={e => update(index, {}, { imagingSessionReference: e.target.value })} /><small>Use the same reference only for services in the same actual imaging session. Do not include patient identifiers.</small></label>
            </div>
            <p>{line.professionalComponentContext?.completeSameDayImagingServices === false ? "Your application marked this imaging encounter as incomplete. Its estimate needs review." : "Include all imaging for this patient, provider or group, and service date, including services billed elsewhere. Enter the actual session reference for each imaging service."}</p>
          </div>}
          {(modifiers.toUpperCase().split(/[\s,]+/).includes("TC") || line.technicalComponentContext || technicalPerformance || technicalHospitalStatus || technicalSupervision || technicalSessionReference) && <div className="mbfc-imaging">
            <h3>Technical imaging service</h3>
            <div className="mbfc-grid">
              <label>Furnished by billing provider or group<select value={technicalPerformance} onChange={e => update(index, {}, { technicalPerformance: e.target.value as Draft["technicalPerformance"] })}><option value="">Not specified</option><option value="true">Yes — furnished by this provider or group</option><option value="false">No — purchased or outsourced</option></select></label>
              <label>Hospital patient status<select value={technicalHospitalStatus} onChange={e => update(index, {}, { technicalHospitalStatus: e.target.value as Draft["technicalHospitalStatus"] })}><option value="">Not specified</option><option value="not_hospital_patient">Not a hospital patient</option><option value="hospital_inpatient_or_outpatient">Hospital inpatient or outpatient</option></select></label>
              <label>Technical service supervision<select value={technicalSupervision} onChange={e => update(index, {}, { technicalSupervision: e.target.value as Draft["technicalSupervision"] })}><option value="">Not specified</option><option value="general">General</option><option value="direct">Direct</option><option value="personal">Personal</option></select></label>
              <label>Technical imaging session reference<input maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9._:\-]{0,63}" placeholder="e.g. session-1" value={technicalSessionReference} onChange={e => update(index, {}, { technicalSessionReference: e.target.value })} /><small>Use the same reference only for services in the same actual session. Do not include patient identifiers.</small></label>
            </div>
            <p>{line.technicalComponentContext?.completeSameDayImagingServices === false ? "Your application marked this imaging encounter as incomplete. Its estimate needs review." : "Include all imaging for this patient, provider or group, and service date, including services billed elsewhere."}</p>
            <p>The current supported technical calculation covers 70551, 72141 and 72148, each with modifier TC and one unit, for physician office services under the reviewed July 2026 schedule. Other circumstances need review.</p>
          </div>}
          {line.dmeposContext && <p>Equipment residence ZIP: {line.dmeposContext.residenceZip}. Rental and prior-payment context supplied by your application.</p>}
        </details>
        {rows.length > 1 && <button type="button" className="mbfc-remove" onClick={() => change(rows.filter((_, i) => i !== index))}>Remove service {index + 1}</button>}
      </fieldset>)}
      <div className="mbfc-actions"><button type="button" disabled={rows.length >= 100} onClick={() => { let id: string; do { id = `line-${++counter.current}`; } while (rows.some((r) => r.line.id === id)); change([...rows, draft(newLine(id))]); }}>Add service</button><button className="mbfc-primary" type="submit" disabled={busy}>{busy ? "Calculating…" : "Calculate fees"}</button></div>
      {error && <p className="mbfc-error" role="alert">{error}</p>}
    </form>
    {result && <section className="mbfc-results" aria-label="Calculation results" aria-live="polite">
      <div className="mbfc-total"><div><small>{label(result.status)}</small><h3>Estimated payable</h3></div><strong>{money(result.totals.estimatedPayableCents)}</strong></div>
      <p>Schedule maximum: {money(result.totals.scheduleMaximumCents)} · Priced subtotal: {money(result.totals.pricedSubtotalCents)}{result.totals.reviewLineCount > 0 && ` · ${result.totals.reviewLineCount} service(s) need review`}</p>
      {result.lines.map((line, index) => <article key={line.id}><h3>Service {index + 1} · {line.input.code} <span>{label(line.assessment)}</span></h3>
        {line.quote.status === "priced" ? <p>Line estimate: <strong>{money(line.paymentAdjustment?.amountCents ?? line.quote.amountCents)}</strong> · Schedule maximum: {money(line.paymentAdjustment?.scheduleMaximumCents ?? line.quote.scheduleMaximumCents)}{line.assessment !== "priced" && " · Reference amount only; resolve the findings below."}</p> : <p>{line.quote.reason}</p>}
        {line.paymentAdjustment && <p><SourceLink url={line.paymentAdjustment.citationUrl}>Multiple surgery adjustment</SourceLink>: rank {line.paymentAdjustment.rank}, {line.paymentAdjustment.percent}% of {money(line.paymentAdjustment.unadjustedScheduleMaximumCents)}.</p>}
        {line.findings.map((f, i) => <p className="mbfc-finding" key={i}>{f.citationUrl ? <SourceLink url={f.citationUrl}>{f.message}</SourceLink> : f.message}</p>)}
        {line.quote.calculation && <details open><summary>How the fee is calculated</summary><p>Locality {line.quote.calculation.locality} · {line.quote.calculation.setting} · Provider adjustment {line.quote.calculation.providerPercent}%</p><div className="mbfc-table"><table><thead><tr><th>Component</th><th>RVU</th><th>Geographic factor</th><th>Payable units</th></tr></thead><tbody>{line.quote.calculation.components.map((c) => <tr key={c.name}><td>{c.name}</td><td>{c.rvu}</td><td>{c.gpci}</td><td>{c.payableUnits}</td></tr>)}</tbody></table></div><p>Sum of geographically adjusted relative values × conversion factor {line.quote.calculation.conversionFactor}. Applicable unit, provider and payment adjustments follow; the server rounds the final amount.</p>{line.quote.calculation.sourceFiles?.map((f, i) => <p key={i}>{f.kind}: {f.filename}</p>)}{line.quote.calculation.cmsIndicators && <details><summary>CMS payment indicators</summary><dl>{Object.entries(line.quote.calculation.cmsIndicators).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></details>}</details>}
        {line.quote.status === "priced" && <>{line.quote.feeBreakdown && <details open><summary>Calculation details</summary><dl>{[...line.quote.feeBreakdown.inputs, ...line.quote.feeBreakdown.steps].map((r, i) => <div key={i}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl></details>}{line.quote.notes.map((note, i) => <p key={i}>{note}</p>)}</>}
        <details open><summary>Regulations and source files</summary><Sources sources={line.quote.provenance} /></details>
      </article>)}
      <h3>Claim edits</h3>{result.claimEdits.map((edit, i) => <article key={i}><h4>{edit.dateOfService} · {label(edit.status)}</h4>{edit.reason && <p>{edit.reason}</p>}{edit.findings.map((f, n) => <p key={n}><SourceLink url={f.citationUrl}>{f.message}</SourceLink></p>)}{edit.status === "evaluated" && edit.findings.length === 0 && <p>No findings in the evaluated edits.</p>}</article>)}
      {result.limitations.length > 0 && <aside><h3>Coverage and limitations</h3><ul>{result.limitations.map((v, i) => <li key={i}>{v}</li>)}</ul></aside>}
    </section>}
  </section>;
}
const styles = `.mbfc{font:14px/1.5 var(--mb-font-family,system-ui,sans-serif);color:var(--mb-text,#203743);background:var(--mb-surface,#fff);border:1px solid var(--mb-border,#dbe6ea);border-radius:var(--mb-radius,14px);padding:24px;max-width:1100px;box-sizing:border-box}.mbfc *{box-sizing:border-box}.mbfc h2{font-size:26px;margin:4px 0 8px}.mbfc h3{margin:8px 0;font-size:18px}.mbfc p{margin:8px 0 14px}.mbfc header>p,.mbfc small{color:var(--mb-muted,#657982)}.mbfc-eyebrow{font-size:11px;letter-spacing:.12em;font-weight:700}.mbfc fieldset{margin:22px 0;border:1px solid var(--mb-border,#dbe6ea);border-radius:10px;padding:18px;min-width:0}.mbfc legend{padding:0 7px;font-weight:700}.mbfc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:16px}.mbfc label{display:flex;flex-direction:column;gap:6px;font-weight:600;font-size:13px}.mbfc input,.mbfc select,.mbfc button{font:inherit;color:inherit;border:1px solid var(--mb-border,#dbe6ea);border-radius:var(--mb-control-radius,8px);background:var(--mb-input-background,#fff);padding:10px 12px;min-height:44px;width:100%}.mbfc small{font-weight:400;font-size:12px}.mbfc button{width:auto;cursor:pointer;font-weight:600}.mbfc button:disabled{opacity:.6;cursor:wait}.mbfc :is(input,select,button,summary,a):focus-visible{outline:2px solid var(--mb-accent,#238dbd);outline-offset:3px}.mbfc .mbfc-primary{background:var(--mb-accent,#238dbd);color:var(--mb-accent-text,#fff);border-color:transparent}.mbfc-actions{display:flex;justify-content:space-between;gap:12px}.mbfc summary{cursor:pointer;font-weight:600;padding:12px 0}.mbfc-context{margin-top:14px}.mbfc .mbfc-remove{margin-top:16px;color:var(--mb-danger,#b63d35)}.mbfc-error,.mbfc-finding{color:var(--mb-danger,#b63d35)}.mbfc-results{margin-top:28px;border-top:1px solid var(--mb-border,#dbe6ea);padding-top:24px}.mbfc-total{display:flex;align-items:center;justify-content:space-between;gap:18px}.mbfc-total strong{font-size:28px}.mbfc article{padding:20px 0;border-bottom:1px solid var(--mb-border,#dbe6ea)}.mbfc article h3 span{display:inline-block;font-size:12px;font-weight:500;margin-left:10px}.mbfc a{color:var(--mb-accent,#238dbd);overflow-wrap:anywhere}.mbfc-table{overflow-x:auto}.mbfc table{border-collapse:collapse;width:100%;text-align:left;font-variant-numeric:tabular-nums}.mbfc th,.mbfc td{padding:10px;border-bottom:1px solid var(--mb-border,#dbe6ea)}.mbfc dl>div{display:flex;justify-content:space-between;gap:20px;padding:5px 0}.mbfc dd{margin:0}.mbfc-sources{padding-left:20px}.mbfc-sources li{margin:8px 0}.mbfc-sources small{display:block}@media(max-width:640px){.mbfc{padding:16px}.mbfc fieldset{padding:12px}.mbfc-total{align-items:flex-start;flex-direction:column}.mbfc h2{font-size:23px}}`;
