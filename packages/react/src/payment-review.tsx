"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";
import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";
import { createBillingOperationsClient, type BillingOperationsClientOptions, type PaymentReviewItem, type PaymentReviewQuery, type PaymentReviewResult } from "./billing-operations-client";

export type PaymentReviewRange = "today" | "week" | "month" | "year" | "all";
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function paymentReviewDateRange(range: PaymentReviewRange, now = new Date()): Pick<PaymentReviewQuery, "receivedFrom" | "receivedTo"> {
  if (range === "all") return {};
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "week") start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  if (range === "month") start.setDate(1);
  if (range === "year") { start.setMonth(0); start.setDate(1); }
  return { receivedFrom: localDate(start), receivedTo: localDate(now) };
}
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const dateLabel = (value: string | null) => value ? value.slice(0, 10) : "—";
/** Every cell is quoted and spreadsheet formulas are neutralized, including tab-prefixed input. */
export function paymentReviewCsv(items: readonly PaymentReviewItem[]): string {
  const escape = (value: string | number | null) => {
    let text = value == null ? "" : String(value);
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [["Patient", "Bill", "Claim", "Date of service", "Received", "Posted", "Status", "Method", "Source", "Check / trace", "Amount"], ...items.map((item) => [item.patientName, item.billNumber, item.claimNumber, item.dateOfService, item.receivedDate, item.postedDate, "Received", item.method, item.source, item.checkNumber, item.amount])].map((row) => row.map(escape).join(",")).join("\r\n");
}

export type ConnectedPaymentReviewProps = BillingOperationsClientOptions & {
  initialQuery?: PaymentReviewQuery;
  onSelectBill?: (billId: string) => void;
  /** Optional host action; reviewing payments never posts or changes a payment. */
  onPostPayment?: () => void;
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
};

const css = `.mbpr{font:14px/1.5 var(--mb-font);color:var(--mb-text);min-width:0}.mbpr *{box-sizing:border-box}.mbpr h2,.mbpr p{margin:0}.mbpr h2{font-size:21px}.mbpr-head,.mbpr-actions,.mbpr-toolbar,.mbpr-pager{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.mbpr-head,.mbpr-pager{justify-content:space-between}.mbpr small,.mbpr-sub{color:var(--mb-muted)}.mbpr small{display:block;font-size:12px}.mbpr-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0}.mbpr-metric,.mbpr-card{background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-radius)}.mbpr-metric{padding:16px}.mbpr-metric strong{display:block;font-size:24px;line-height:1.4;font-variant-numeric:tabular-nums}.mbpr-card{overflow:hidden}.mbpr-controls{padding:14px;display:grid;gap:12px}.mbpr label{display:grid;gap:4px;font-size:12px}.mbpr input,.mbpr button{font:inherit;color:var(--mb-text);background:var(--mb-input);border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);padding:8px 10px;min-height:38px}.mbpr button{cursor:pointer;white-space:nowrap}.mbpr button:disabled{opacity:.55;cursor:default}.mbpr button.active,.mbpr button.primary{background:var(--mb-accent);border-color:var(--mb-accent);color:var(--mb-accent-contrast)}.mbpr button:focus-visible,.mbpr input:focus-visible{outline:2px solid var(--mb-accent);outline-offset:2px}.mbpr-search{flex:1;min-width:210px}.mbpr-scroll{overflow:auto}.mbpr table{width:100%;min-width:900px;border-collapse:collapse}.mbpr th,.mbpr td{padding:11px 13px;text-align:left;border-top:1px solid var(--mb-border)}.mbpr th{background:var(--mb-soft);color:var(--mb-muted);font-size:12px;font-weight:600}.mbpr .mbpr-money{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.mbpr .mbpr-link{color:var(--mb-accent);border:0;background:none;padding:0;min-height:30px}.mbpr-status{display:inline-block;background:color-mix(in srgb,var(--mb-success) 10%,var(--mb-surface));color:var(--mb-success);border-radius:var(--mb-control-radius);padding:2px 7px;font-size:12px}.mbpr-state{padding:30px;text-align:center;color:var(--mb-muted)}.mbpr-error{color:var(--mb-danger)}.mbpr-pager{padding:12px;border-top:1px solid var(--mb-border);color:var(--mb-muted);font-size:12px}@media(max-width:640px){.mbpr-metrics{gap:8px}.mbpr-metric{padding:10px}.mbpr-metric strong{font-size:20px}.mbpr-head{align-items:flex-start}.mbpr-toolbar label{flex:1}.mbpr-search{min-width:100%}.mbpr input{width:100%;min-width:0}}`;

export function ConnectedPaymentReview({ initialQuery, onSelectBill, onPostPayment, appearance, className = "", style, ...options }: ConnectedPaymentReviewProps): ReactElement {
  const client = useMemo(() => createBillingOperationsClient(options), [options.apiBaseUrl, options.fetch, options.getSession, options.sessionEndpoint]);
  const [query, setQuery] = useState<PaymentReviewQuery>(() => ({ ...paymentReviewDateRange("month"), page: 1, pageSize: 25, ...initialQuery }));
  const [range, setRange] = useState<PaymentReviewRange | null>(initialQuery?.receivedFrom || initialQuery?.receivedTo ? null : "month");
  const [search, setSearch] = useState(initialQuery?.q ?? "");
  const [result, setResult] = useState<PaymentReviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const invalidRange = Boolean(query.receivedFrom && query.receivedTo && query.receivedFrom > query.receivedTo);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError(false);
    if (invalidRange) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    client.getPaymentReview(query, controller.signal).then((next) => { if (!controller.signal.aborted) setResult(next); }).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [client, query, retry, invalidRange]);
  const update = (patch: Partial<PaymentReviewQuery>) => setQuery((current) => ({ ...current, ...patch, page: 1 }));
  const exportPage = () => {
    if (!result?.items.length || loading) return;
    const url = URL.createObjectURL(new Blob([paymentReviewCsv(result.items)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "payment-review-page.csv"; anchor.click(); URL.revokeObjectURL(url);
  };
  return <section className={`mbpr ${className}`.trim()} style={{ ...mindBillAppearanceStyle(appearance), ...style }} aria-label="Payment review">
    <style>{css + `.mbpr{font-family:var(--mb-font,ui-sans-serif,system-ui,sans-serif)}@media(max-width:640px){.mbpr-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.mbpr-metric:first-child{grid-column:1/-1}.mbpr-metric strong{overflow-wrap:anywhere}}`}</style>
    <div className="mbpr-head"><div><h2>Payment review</h2><p className="mbpr-sub">Review confirmed payments, check details, and cash totals.</p></div><div className="mbpr-actions"><button type="button" disabled={!result?.items.length || loading} onClick={exportPage}>Export page</button>{onPostPayment ? <button className="primary" type="button" onClick={onPostPayment}>+ Post payment</button> : null}</div></div>
    <small>Pending EOR and 835 amounts are excluded until funds are confirmed. Historical legacy payments are also excluded.</small>
    <div className="mbpr-metrics">{[["Posted total", result ? money(result.summary.postedTotal) : "—"], ["Payment entries", result?.summary.entryCount ?? "—"], ["Unique patients", result?.summary.uniquePatients ?? "—"]].map(([label, value]) => <div className="mbpr-metric" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
<div className="mbpr-card"><div className="mbpr-controls"><div className="mbpr-toolbar" aria-label="Quick range">{([["today", "Today"], ["week", "This week"], ["month", "This month"], ["year", "This year"], ["all", "All dates"]] as const).map(([id, label]) => <button type="button" key={id} className={range === id ? "active" : ""} aria-pressed={range === id} onClick={() => { setRange(id); setQuery((current) => { const next = { ...current }; delete next.receivedFrom; delete next.receivedTo; return { ...next, ...paymentReviewDateRange(id), page: 1 }; }); }}>{label}</button>)}</div>
      <form className="mbpr-toolbar" onSubmit={(event) => { event.preventDefault(); update({ q: search }); }}><label className="mbpr-search">Search<input type="search" placeholder="Patient, bill, claim, payer, or check…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button type="submit">Search</button><label>Received from<input type="date" value={query.receivedFrom ?? ""} onChange={(event) => { setRange(null); update({ receivedFrom: event.target.value }); }} /></label><label>Received through<input type="date" value={query.receivedTo ?? ""} onChange={(event) => { setRange(null); update({ receivedTo: event.target.value }); }} /></label></form>
    </div>{invalidRange ? <p className="mbpr-state mbpr-error" role="alert">The received-through date must be on or after the received-from date.</p> : loading ? <p className="mbpr-state" role="status">Loading payments…</p> : error ? <div className="mbpr-state mbpr-error" role="alert">Payments could not be loaded. <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div> : !result?.items.length ? <p className="mbpr-state">No confirmed payments match these filters.</p> : <div className="mbpr-scroll" tabIndex={0} role="region" aria-label="Payment entries"><table><thead><tr>{["Patient", "Bill / DOS", "Received", "Posted", "Status", "Method / source", "Check / trace", "Amount"].map((label) => <th key={label} scope="col" className={label === "Amount" ? "mbpr-money" : ""}>{label}</th>)}</tr></thead><tbody>{result.items.map((item) => <tr key={item.id}><td>{item.patientName}<small>{item.claimNumber}</small></td><td>{onSelectBill ? <button type="button" className="mbpr-link" onClick={() => onSelectBill(item.billId)}>{item.billNumber == null ? "View bill" : `Bill #${item.billNumber}`}</button> : item.billNumber == null ? "—" : `Bill #${item.billNumber}`}<small>DOS {dateLabel(item.dateOfService)}</small></td><td>{dateLabel(item.receivedDate)}</td><td>{dateLabel(item.postedDate)}</td><td><span className="mbpr-status">Received</span></td><td>{item.method || "—"}<small>{item.source}</small></td><td>{item.checkNumber || "—"}</td><td className="mbpr-money">{money(item.amount)}</td></tr>)}</tbody></table></div>}
    {result ? <div className="mbpr-pager"><span>{result.total} entries · Page {result.page} of {Math.max(1, Math.ceil(result.total / result.pageSize))}</span><div className="mbpr-actions"><button type="button" disabled={result.page <= 1} onClick={() => setQuery((current) => ({ ...current, page: Math.max(1, result.page - 1) }))}>Previous</button><button type="button" disabled={result.page * result.pageSize >= result.total} onClick={() => setQuery((current) => ({ ...current, page: result.page + 1 }))}>Next</button></div></div> : null}</div>
  </section>;
}
