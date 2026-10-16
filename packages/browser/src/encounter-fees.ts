import type { BillFeeQuote, BillFeeQuoteBasis, BillFeeQuoteInput, BillFeeSource, BilledDrug } from "./index";
import type { CaClaimFeeFinding, CaClaimLineQuote, CaFeeCalculation } from "./claim-fees";

/**
 * One treatment visit priced the way MindBill prices a saved treatment bill: every line together, with
 * the organization's saved rendering provider, place of service, practice charges and the claim's payer.
 * `POST /partner/v2/fee-quotes/encounter`; requires a `bills:read` session and treatment billing.
 */
export type EncounterQuoteLineInput = {
  /** Unique within the request; results come back under the same id. */
  id: string;
  code: string;
  units: number;
  modifiers?: string[];
  /** Line date when it differs from the visit date. */
  dateOfService?: string;
  dateOfServiceEnd?: string;
  /** Billed charge in cents. */
  chargeCents?: number;
  /** Optional specialty context (anesthesia, therapy, imaging, equipment), as on bill service lines. */
  feeContext?: Record<string, unknown>;
  drug?: BilledDrug;
};

export type EncounterQuoteIdentity = {
  /** Saved rendering provider id (creation context or organization profile). */
  renderingProviderId: string;
  /** Saved service location id. */
  placeOfServiceId: string;
  /** Saved billing provider; the organization default is used when omitted. */
  billingProviderId?: string;
  /** The claim, so its payer and prior LC 4604.5 therapy visits are used. */
  claimId?: string;
};

export type EncounterQuoteInput = EncounterQuoteIdentity & { dateOfService: string; lines: EncounterQuoteLineInput[] };

export type EncounterQuoteLine = {
  id: string;
  assessment: "priced" | "requires_review" | "not_separately_payable" | "by_report";
  quote: CaClaimLineQuote & { chargeAmountCents?: number };
  findings: CaClaimFeeFinding[];
  paymentAdjustment?: { rule: string; bundled?: boolean; rank: number; percent: number; unadjustedScheduleMaximumCents: number; scheduleMaximumCents: number; amountCents: number; citationUrl: string };
  /** Short biller-facing notes for this line, one per caveat. */
  displayNotes: string[];
};

export type EncounterQuoteResult = {
  status: "priced" | "requires_review" | "not_separately_payable" | "by_report";
  lines: EncounterQuoteLine[];
  totals: { submittedChargeCents: number | null; pricedSubtotalCents: number; estimatedPayableCents: number | null; scheduleMaximumCents: number | null; reviewLineCount: number };
  claimEdits: unknown[];
  limitations: unknown[];
  /** Medical-legal ML lines: not priced by the treatment schedule. */
  medicalLegalLineIds: string[];
  /** Visit-wide notes (per-visit caps, LC 4604.5 counts), shown once. */
  visitNotes: string[];
};

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const cents = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");

/** Validates the transport before an amount is shown. A partial or unknown result fails closed. */
export function parseEncounterQuote(value: unknown, input: EncounterQuoteInput): EncounterQuoteResult {
  const invalid = (): never => { throw new Error("The encounter fee quote returned an invalid response."); };
  if (!record(value) || !Array.isArray(value.lines) || !record(value.totals) || !strings(value.visitNotes) || !strings(value.medicalLegalLineIds)) return invalid();
  const ids = new Set(input.lines.map(line => line.id));
  for (const line of value.lines) {
    if (!record(line) || typeof line.id !== "string" || !ids.has(line.id) || !record(line.quote) || !Array.isArray(line.findings) || !strings(line.displayNotes)) return invalid();
    const quote = line.quote;
    if (quote.status === "priced" && (!cents(quote.amountCents) || !cents(quote.scheduleMaximumCents))) return invalid();
    if (quote.status !== "priced" && typeof quote.reason !== "string") return invalid();
    if (line.paymentAdjustment !== undefined && (!record(line.paymentAdjustment) || !cents(line.paymentAdjustment.amountCents))) return invalid();
  }
  const totals = value.totals;
  if (!cents(totals.pricedSubtotalCents) || [totals.estimatedPayableCents, totals.scheduleMaximumCents, totals.submittedChargeCents].some(item => item !== null && !cents(item))) return invalid();
  return value as unknown as EncounterQuoteResult;
}

/**
 * Builds one encounter request from BillSubmissionForm's per-line fee inputs, in order (line ids
 * `line-0`, `line-1`, …). The first line's date is the visit date.
 */
export function encounterQuoteRequest(inputs: readonly BillFeeQuoteInput[], identity: EncounterQuoteIdentity): EncounterQuoteInput {
  const dateOfService = inputs[0]?.dateOfService ?? "";
  return {
    ...identity,
    dateOfService,
    lines: inputs.map((input, index) => ({
      id: `line-${index}`, code: input.code.trim().toUpperCase(), units: input.units ?? 1,
      modifiers: [...new Set((input.modifiers ?? []).map(modifier => modifier.replace(/^-/, "").trim().toUpperCase()).filter(Boolean))],
      ...(input.dateOfService && input.dateOfService !== dateOfService ? { dateOfService: input.dateOfService } : {}),
      ...(input.chargeCents && input.chargeCents > 0 ? { chargeCents: Math.round(input.chargeCents) } : {}),
    })),
  };
}

/**
 * One BillSubmissionForm quote per requested line: the expected payment (after any multiple-procedure
 * adjustment) when priced, otherwise a review or not-payable state. Notes are attached as findings.
 */
export function encounterBillFeeQuotes(result: EncounterQuoteResult, count: number): BillFeeQuote[] {
  return Array.from({ length: count }, (_, index): BillFeeQuote => {
    const line = result.lines.find(item => item.id === `line-${index}`);
    if (!line) return { status: "requires_review", reason: "fee_calculation_unavailable", provenance: [] };
    const findings = line.displayNotes.map(message => ({ code: "note", message }));
    const provenance = line.quote.provenance as unknown as BillFeeSource[];
    if (line.assessment === "priced" && line.quote.status === "priced") {
      return {
        status: "priced",
        amountCents: line.paymentAdjustment?.amountCents ?? line.quote.amountCents,
        scheduleMaximumCents: line.paymentAdjustment?.scheduleMaximumCents ?? line.quote.scheduleMaximumCents,
        // MindBill reports the practice's saved charge × units here; an entered charge only caps the expected amount.
        ...(line.quote.chargeAmountCents !== undefined ? { chargeAmountCents: line.quote.chargeAmountCents, practiceChargeCents: line.quote.chargeAmountCents } : {}),
        basis: line.quote.basis as BillFeeQuoteBasis,
        ...(line.quote.calculation ? { calculation: line.quote.calculation as CaFeeCalculation } : {}),
        ...(line.quote.feeBreakdown ? { feeBreakdown: line.quote.feeBreakdown } : {}),
        provenance, notes: [], ...(findings.length ? { findings } : {}),
      } as BillFeeQuote;
    }
    const status = line.assessment === "not_separately_payable" ? "not_separately_payable" : "requires_review";
    const reason = line.findings[0]?.code ?? (line.quote.status !== "priced" ? line.quote.reason : "fee_calculation_requires_review");
    return { status, reason, provenance, ...(findings[0] ? { message: findings[0].message } : {}),
      ...(findings.length > 1 ? { findings: findings.slice(1) } : {}) };
  });
}

/**
 * A ready `onQuoteEncounter` for BillSubmissionForm. `onResult` receives the whole encounter (for
 * `visitNotes` and totals). When pricing is unavailable every line shows a review state instead of an amount.
 */
export function createEncounterQuoter(
  client: { quoteEncounter: (input: EncounterQuoteInput) => Promise<EncounterQuoteResult> },
  identity: EncounterQuoteIdentity,
  onResult?: (result: EncounterQuoteResult | null) => void,
): (inputs: BillFeeQuoteInput[]) => Promise<BillFeeQuote[]> {
  return async (inputs) => {
    try {
      const result = await client.quoteEncounter(encounterQuoteRequest(inputs, identity));
      onResult?.(result);
      return encounterBillFeeQuotes(result, inputs.length);
    } catch {
      onResult?.(null);
      return inputs.map(() => ({ status: "requires_review" as const, reason: "fee_calculation_unavailable", provenance: [],
        message: "The fee schedule could not calculate this visit. Check the provider, place of service and date of service." }));
    }
  };
}
