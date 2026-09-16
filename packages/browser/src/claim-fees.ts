import type { BillFeeQuoteInput, BillFeeQuoteBasis } from "./index";

/** One patient's complete services for one provider/group. Dates are service dates, not publication dates. */
export type CaClaimFeeQuoteInput = {
  lines: Array<Omit<BillFeeQuoteInput, "billingProviderId" | "payerId" | "physicianContext"> & {
    id: string;
    serviceCounty?: string;
    physicianContext?: Omit<NonNullable<BillFeeQuoteInput["physicianContext"]>, "providerKind"> & {
      providerKind: NonNullable<BillFeeQuoteInput["physicianContext"]>["providerKind"] | "clinical_social_worker";
      telehealthModality?: "audio_video" | "audio_only";
      cmsSpecialtyCode?: string;
    };
  }>;
  completeDateOfServiceContext: boolean;
  ordinaryMultipleSurgeryContext?: boolean;
};
export type CaFeeCitation = { id: string; url: string; sha256?: string; effectiveFrom?: string; effectiveThrough?: string };
export type CaFeeCalculation = {
  method: "rbrvs" | "therapy_mppr"; locality: string; serviceZip?: string; serviceCounty?: string;
  setting: "facility" | "nonfacility"; units: number; conversionFactor: string; providerPercent: number;
  baseMaximumCents?: number; cmsIndicators?: Record<string, string>;
  sourceFiles?: Array<{ kind: string; filename: string }>;
  components: Array<{ name: string; rvu: string; gpci: string; payableUnits: number }>;
  rounding: string;
};
export type CaClaimEditFinding = {
  type: string; lineIds: string[]; message: string; citationUrl: string;
  column1?: string; column2?: string; modifierIndicator?: number; code?: string; limit?: number;
  submittedUnits?: number; adjudicationIndicator?: number; scope?: "line" | "patient_provider_date";
};
export type CaClaimFeeFinding = { code: string; lineIds: string[]; message: string; citationUrl?: string; edit?: CaClaimEditFinding };
export type CaClaimLineQuote = ({ status: "priced"; amountCents: number; scheduleMaximumCents: number;
  basis: BillFeeQuoteBasis | "ca_ambulance"; notes: string[];
  feeBreakdown?: { method: string; inputs: Array<{ label: string; value: string }>; steps: Array<{ label: string; value: string }> };
} | { status: "requires_review" | "not_separately_payable"; reason: string }) & {
  provenance: CaFeeCitation[]; calculation?: CaFeeCalculation;
};
export type CaClaimFeeQuoteResult = {
  status: "priced" | "requires_review" | "not_separately_payable";
  lines: Array<{ id: string; input: CaClaimFeeQuoteInput["lines"][number]; quote: CaClaimLineQuote;
    assessment: CaClaimFeeQuoteResult["status"]; findings: CaClaimFeeFinding[];
    paymentAdjustment?: { rule: "ca_multiple_surgery"; rank: number; percent: 100 | 50;
      unadjustedScheduleMaximumCents: number; scheduleMaximumCents: number; amountCents: number; citationUrl: string };
  }>;
  totals: { submittedChargeCents: number | null; pricedSubtotalCents: number;
    estimatedPayableCents: number | null; scheduleMaximumCents: number | null; reviewLineCount: number };
  claimEdits: Array<{ dateOfService: string; lineIds: string[]; status: "evaluated" | "requires_review" | "source_unavailable" | "not_applicable";
    reason?: string; findings: CaClaimEditFinding[]; provenance?: unknown;
    supportedDateRange?: { from: string; through: string }; supportedDateIntervals?: Array<{ from: string; through: string }>;
  }>;
  limitations: string[];
};

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const money = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;
const status = (v: unknown) => ["priced", "requires_review", "not_separately_payable"].includes(v as string);
const finding = (v: unknown) => record(v) && typeof v.message === "string" && strings(v.lineIds) && (v.citationUrl === undefined || typeof v.citationUrl === "string");
/** Validate the transport before a browser displays an allowance. Unknown/partial results fail closed. */
export function parseCaClaimFeeQuote(value: unknown, input: CaClaimFeeQuoteInput): CaClaimFeeQuoteResult {
  const invalid = () => { throw new Error("Claim fee quote returned an invalid response."); };
  if (!record(value) || !status(value.status) || !Array.isArray(value.lines) || value.lines.length !== input.lines.length || !strings(value.limitations) || !record(value.totals) || !Array.isArray(value.claimEdits)) return invalid();
  const totals = value.totals;
  if (!money(totals.pricedSubtotalCents) || !money(totals.reviewLineCount) || [totals.submittedChargeCents, totals.estimatedPayableCents, totals.scheduleMaximumCents].some((v) => v !== null && !money(v))) return invalid();
  if (value.status === "requires_review" && totals.estimatedPayableCents !== null) return invalid();
  const expected = new Set(input.lines.map((line) => line.id));
  for (const line of value.lines) {
    if (!record(line) || typeof line.id !== "string" || !expected.delete(line.id) || !record(line.input) || typeof line.input.code !== "string" || line.input.id !== line.id || line.input.code !== input.lines.find((r) => r.id === line.id)?.code || line.input.dateOfService !== input.lines.find((r) => r.id === line.id)?.dateOfService || !status(line.assessment) || !record(line.quote) || !Array.isArray(line.findings) || !line.findings.every(finding)) return invalid();
    const quote = line.quote;
    if (!status(quote.status) || !Array.isArray(quote.provenance) || !quote.provenance.every((s) => record(s) && typeof s.id === "string" && typeof s.url === "string" && (s.effectiveFrom === undefined || typeof s.effectiveFrom === "string") && (s.effectiveThrough === undefined || typeof s.effectiveThrough === "string"))) return invalid();
    if (quote.status === "priced") {
      if (!money(quote.amountCents) || !money(quote.scheduleMaximumCents) || typeof quote.basis !== "string" || !strings(quote.notes)) return invalid();
    } else if (typeof quote.reason !== "string") return invalid();
    if (quote.calculation !== undefined) {
      const c = quote.calculation;
      if (!record(c) || typeof c.locality !== "string" || typeof c.conversionFactor !== "string" || !Number.isFinite(c.providerPercent) || !["facility", "nonfacility"].includes(c.setting as string) || (c.sourceFiles !== undefined && (!Array.isArray(c.sourceFiles) || !c.sourceFiles.every((f) => record(f) && typeof f.kind === "string" && typeof f.filename === "string"))) || (c.cmsIndicators !== undefined && (!record(c.cmsIndicators) || !Object.values(c.cmsIndicators).every((v) => typeof v === "string"))) || !Array.isArray(c.components) || !c.components.every((r) => record(r) && typeof r.name === "string" && typeof r.rvu === "string" && typeof r.gpci === "string" && typeof r.payableUnits === "number")) return invalid();
    }
    if (quote.feeBreakdown !== undefined) {
      const b = quote.feeBreakdown;
      if (!record(b) || ![b.inputs, b.steps].every((rows) => Array.isArray(rows) && rows.every((r) => record(r) && typeof r.label === "string" && typeof r.value === "string"))) return invalid();
    }
    if (line.paymentAdjustment !== undefined) {
      const a = line.paymentAdjustment;
      if (!record(a) || !money(a.amountCents) || !money(a.scheduleMaximumCents) || !money(a.unadjustedScheduleMaximumCents) || typeof a.citationUrl !== "string" || ![100,50].includes(a.percent as number) || !money(a.rank)) return invalid();
    }
  }
  if (!value.claimEdits.every((edit) => record(edit) && typeof edit.dateOfService === "string" && strings(edit.lineIds) && ["evaluated", "requires_review", "source_unavailable", "not_applicable"].includes(edit.status as string) && Array.isArray(edit.findings) && edit.findings.every(finding) && (edit.reason === undefined || typeof edit.reason === "string"))) return invalid();
  return value as unknown as CaClaimFeeQuoteResult;
}
