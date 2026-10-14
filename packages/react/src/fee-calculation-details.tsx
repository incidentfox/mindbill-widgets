import type { BillFeeQuote } from "@mindbill/browser";

type PricedQuote = Extract<BillFeeQuote, { status: "priced" }>;
// Products of published RVUs and GPCIs have at most five decimal places.
const rvu = (value: number) => String(Number(value.toFixed(5)));
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

/** Display the server's relative-value calculation; the allowance itself always comes from the server. */
export function FeeCalculationDetails({ quote, providerLabel }: { quote: PricedQuote; providerLabel?: string | undefined }) {
  const calculation = quote.calculation;
  const breakdown = quote.feeBreakdown;
  const components = Array.isArray(calculation?.components) ? calculation.components.filter((row) => typeof row?.rvu === "string" && typeof row.gpci === "string") : [];
  if (!calculation || !components.length) {
    if (!breakdown || !Array.isArray(breakdown.steps)) return null;
    return <details className="mbsf-calc"><summary>How this fee is calculated</summary>
      <dl className="mbsf-calc-facts">{[...(breakdown.inputs ?? []), ...breakdown.steps].map((row, index) => <div key={index}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
    </details>;
  }
  const adjusted = components.map((row) => Number(row.rvu) * Number(row.gpci));
  const total = adjusted.reduce((sum, value) => sum + value, 0);
  const units = calculation.units ?? 1;
  // Only show "=" when the displayed factors reproduce the server amount; otherwise adjustments applied.
  const direct = Math.abs(Math.round(total * Number(calculation.conversionFactor) * units * calculation.providerPercent) - quote.scheduleMaximumCents) <= 1;
  return <details className="mbsf-calc"><summary>How this fee is calculated</summary>
    <dl className="mbsf-calc-facts">
      <div><dt>Locality</dt><dd>{calculation.locality}{calculation.serviceZip ? ` · ZIP ${calculation.serviceZip}` : ""}</dd></div>
      <div><dt>Setting</dt><dd>{calculation.setting === "facility" ? "Facility" : "Non-facility (office)"}</dd></div>
      {providerLabel ? <div><dt>Provider type</dt><dd>{providerLabel}</dd></div> : null}
    </dl>
    <div className="mbsf-calc-table"><table><thead><tr><th>Component</th><th>RVU</th><th>GPCI</th><th>Adjusted RVU</th></tr></thead><tbody>
      {components.map((row, index) => <tr key={row.name}><td>{row.name}</td><td>{row.rvu}</td><td>{row.gpci}</td><td>{rvu(adjusted[index]!)}</td></tr>)}
      <tr><td colSpan={3}>Total adjusted RVU</td><td>{rvu(total)}</td></tr>
    </tbody></table></div>
    <p>{rvu(total)} × conversion factor ${calculation.conversionFactor}{units !== 1 ? ` × ${units} units` : ""}{calculation.providerPercent !== 100 ? ` × ${calculation.providerPercent}% provider adjustment` : ""}{direct ? " = " : " → after the adjustments noted below: "}<strong>{money(quote.scheduleMaximumCents)}</strong></p>
    {!direct ? quote.notes.map((note, index) => <p key={index} className="mbsf-help">{note}</p>) : null}
    {quote.provenance.length ? <p className="mbsf-help">Sources: {quote.provenance.filter((source) => source.url).map((source, index) => <span key={source.id}>{index ? ", " : ""}<a href={source.url} target="_blank" rel="noreferrer">{source.id}</a></span>)}</p> : null}
  </details>;
}
