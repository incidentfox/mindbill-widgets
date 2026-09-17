import type { BillFeeQuote } from "@mindbill/browser";

type PricedQuote = Extract<BillFeeQuote, { status: "priced" }>;
/** Display the server calculation; never recalculate the allowance in the browser. */
export function AnesthesiaCalculationDetails({ quote }: { quote: PricedQuote }) {
  const calculation = quote.anesthesia;
  if (!calculation) return null;
  const direction = calculation.medicalDirection;
  const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  return <details open className="mbsf-span"><summary>How this anesthesia fee was calculated</summary>
    <p>{direction ? "Physician medical direction" : "Personally performed physician anesthesia"} · {calculation.locality}</p>
    <dl><dt>Base units</dt><dd>{calculation.baseUnits}</dd><dt>Elapsed anesthesia minutes</dt><dd>{calculation.actualMinutes}</dd><dt>Time units, rounded to tenths</dt><dd>{(calculation.timeUnitsTenths / 10).toFixed(1)}</dd><dt>Conversion factor</dt><dd>{money(calculation.conversionFactorCents)}</dd>
    {direction && <><dt>Concurrent cases</dt><dd>{direction.concurrentCases}</dd><dt>Base unit reduction</dt><dd>{direction.baseReductionPercent}%</dd><dt>Physician payment share</dt><dd>{direction.physicianPaymentPercent}%</dd></>}</dl>
    <p>{direction ? `(Base units × ${100 - direction.baseReductionPercent}% + time units) × conversion factor × ${direction.physicianPaymentPercent}%` : "(Base units + time units) × conversion factor"}</p>
    {quote.notes.map((note, index) => <p key={index} className="mbsf-help">{note}</p>)}
    <ul>{quote.provenance.map((source, index) => <li key={index}><a href={source.url} target="_blank" rel="noreferrer">{source.id} ({source.effectiveFrom}–{source.effectiveThrough ?? "current"})</a></li>)}</ul>
  </details>;
}
