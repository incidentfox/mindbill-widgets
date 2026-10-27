"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createReportAutofillClient, type OrganizationClientOptions, type ReportAutofillResult } from "@mindbill/browser";
import { FileInput } from "./form-controls";
import { useMindBillAnalytics, type MindBillAnalyticsProps } from "./analytics";

const fieldLabels: Record<string, string> = {
  patientFirstName: "Patient first name", patientLastName: "Patient last name", dob: "Date of birth",
  claimNumber: "Claim number", doi: "Date of injury", adjNumber: "ADJ number", employer: "Employer",
  dos: "Date of service", bodyParts: "Injured body parts", dxCode: "Diagnosis codes",
  renderingProvider: "Rendering provider", claimsAdminName: "Claims administrator", evaluationLocation: "Service location",
  addressLine: "Patient street address", city: "Patient city", state: "Patient state", zip: "Patient ZIP code",
  billingProvider: "Billing provider", billingProviderNpi: "Billing provider NPI", renderingProviderNpi: "Rendering provider NPI",
  ctStartDate: "Cumulative trauma start date", ctEndDate: "Cumulative trauma end date", insuranceCarrier: "Insurance carrier",
};
const labels: Record<string, string> = { patient: "Patient", billingProvider: "Billing provider", renderingProvider: "Rendering provider", serviceLocation: "Service location" };

export type ReportAutofillProps = OrganizationClientOptions & MindBillAnalyticsProps & {
  /** Use an authenticated host endpoint instead of a MindBill browser session. */
  analyzeReport?(file: File): Promise<ReportAutofillResult>;
  /** Apply with applyReportAutofill(currentBill, result) to preserve entered values. */
  onApply(result: ReportAutofillResult): void;
  disabled?: boolean;
  /** Explain attachment handling when a host owns extraction and document storage. */
  attachmentHelpText?: string;
};
/** A closed error code for analytics: the API error code when present, never the message. */
export function analyticsErrorCode(cause: unknown): string {
  const code = cause && typeof cause === "object" ? (cause as { code?: unknown }).code : undefined;
  if (typeof code === "string" && /^[a-z0-9_]{1,64}$/.test(code)) return code;
  const status = cause && typeof cause === "object" ? (cause as { status?: unknown }).status : undefined;
  return typeof status === "number" && Number.isInteger(status) ? `http_${status}` : "unknown";
}

/** Optional, agreement-gated report extraction. Every result requires explicit human review. */
export function ReportAutofill({ onApply, analyzeReport, attachmentHelpText = "Add the report separately as a bill attachment if needed.", disabled = false, analytics, onAnalyticsEvent, ...connection }: ReportAutofillProps): ReactElement {
  const track = useMindBillAnalytics("ReportAutofill", { ...(analytics !== undefined ? { analytics } : {}), ...(onAnalyticsEvent ? { onAnalyticsEvent } : {}) });
  const client = useMemo(() => createReportAutofillClient(connection), [connection.getSession, connection.sessionEndpoint, connection.apiBaseUrl, connection.fetch]);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ReportAutofillResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const generation = useRef(0);
  useEffect(() => { generation.current += 1; setResult(null); setError(null); setBusy(false); setApplied(false); return () => { generation.current += 1; }; }, [client, analyzeReport]);
  const analyze = async () => {
    if (!file) return;
    const current = ++generation.current;
    setBusy(true); setError(null); setResult(null); setApplied(false);
    const started = Date.now();
    track("autofill_started");
    try {
      if (file.type !== "application/pdf") throw new Error("Choose a PDF report.");
      if (!file.size || file.size > 25 * 1024 * 1024) throw new Error("Choose a non-empty PDF report no larger than 25 MB.");
      const value = await (analyzeReport ? analyzeReport(file) : client.analyze(file));
      track("autofill_completed", { durationMs: Date.now() - started });
      if (current === generation.current) setResult(value); }
    catch (cause) {
      track("autofill_failed", { durationMs: Date.now() - started, errorCode: analyticsErrorCode(cause) });
      if (current === generation.current) setError(cause instanceof Error ? cause.message : "Report analysis failed. Try again."); }
    finally { if (current === generation.current) setBusy(false); }
  };
  return <section aria-label="Fill from report" style={{ color: "#253346", lineHeight: 1.5, padding: 16, border: "1px solid #dbe2ea", borderRadius: 12, marginBottom: 16 }}>
    <h3 style={{ marginTop: 0 }}>Fill from report</h3>
    <p>Upload a PDF to suggest bill details. Review every suggestion before applying it. Existing entries stay unchanged. {attachmentHelpText}</p>
    <label style={{ display: "block", marginBottom: 12 }}>Medical report (PDF, up to 25 MB) <FileInput style={{ display: "block", maxWidth: "100%", marginTop: 6 }} accept="application/pdf,.pdf" disabled={disabled || busy} onChange={event => { generation.current += 1; setFile(event.target.files?.[0] ?? null); setResult(null); setError(null); setApplied(false); }} /></label>
    <button className="mbsf-secondary" type="button" disabled={disabled || busy || !file} onClick={() => { void analyze(); }}>{busy ? "Reading report…" : "Review report suggestions"}</button>
    {error ? <p role="alert">{error}</p> : null}
    {result ? <div>
      <h4>Review extracted details</h4>
      {result.warnings.length ? <ul aria-label="Report warnings">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul> : null}
      {result.fields.length ? <dl>{result.fields.map((field, index) => <div key={`${field.key}-${index}`} style={{ marginBottom: 12, overflowWrap: "anywhere" }}><dt><strong>{fieldLabels[field.key] ?? field.key.replace(/([a-z])([A-Z])/g, "$1 $2")}</strong> · {field.confidence} confidence</dt><dd style={{ marginLeft: 0 }}>{field.value}<details><summary>Source in report</summary>{field.sourceText}</details></dd></div>)}</dl> : <p>No bill details were found. Enter the bill details manually.</p>}
      {Object.entries(result.matches).map(([kind, match]) => match.status !== "none" ? <p key={kind}>{labels[kind]}: {match.status === "ambiguous" ? "Multiple saved records match. Choose the correct record in the bill form." : "Matching saved record found."} {match.candidates.map(candidate => candidate.name).join(", ")}</p> : null)}
      <button className="mbsf-secondary" type="button" disabled={disabled || applied || result.fields.length === 0} onClick={() => { onApply(result); setApplied(true); }}>Apply to empty bill fields</button>
      {applied ? <p role="status">Suggestions applied to empty fields. Review the bill before submitting.</p> : null}
    </div> : null}
  </section>;
}
