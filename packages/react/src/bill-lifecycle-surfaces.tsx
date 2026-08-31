"use client";

import type { CSSProperties, ReactElement } from "react";
import type {
  BillLifecycleAction,
  BillLifecycleData,
  BillLifecycleDelivery,
  BillPaymentRecord,
  BillRemittanceSummary,
} from "@mindbill/browser";
import type { MindBillReactAppearance } from "./appearance";
import { mindBillAppearanceStyle } from "./appearance";

type SurfaceProps = {
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
};

export type BillLifecycleActionsProps = SurfaceProps & {
  actions: readonly BillLifecycleAction[];
  onAction: (action: BillLifecycleAction) => void;
  /** Show disabled actions and the server-provided reason. Defaults to false. */
  showUnavailable?: boolean;
  disabled?: boolean;
};

/** Returns the server-authoritative actions that should be rendered. */
export function visibleBillLifecycleActions(
  actions: readonly BillLifecycleAction[],
  showUnavailable = false,
): BillLifecycleAction[] {
  return actions.filter((action) => action.enabled || showUnavailable);
}

export function BillLifecycleActions({
  actions,
  onAction,
  showUnavailable = false,
  disabled = false,
  appearance,
  className,
  style,
}: BillLifecycleActionsProps): ReactElement | null {
  const visible = visibleBillLifecycleActions(actions, showUnavailable);
  if (!visible.length) return null;

  return (
    <div className={classes("mb-lifecycle-actions", className)} style={mindBillAppearanceStyle(appearance, style)} aria-label="Bill actions">
      <style>{lifecycleSurfaceStyles}</style>
      {visible.map((action) => (
        <div className="mb-lifecycle-action" key={action.id}>
          <button type="button" className={action.primary ? "mb-action-button is-primary" : "mb-action-button"} disabled={disabled || !action.enabled} onClick={() => onAction(action)}>
            {action.label}
          </button>
          {!action.enabled && action.reason ? <span className="mb-action-reason">{action.reason}</span> : null}
        </div>
      ))}
    </div>
  );
}

export type BillActivityEvent = {
  id: string;
  type: string;
  createdAt: string;
  title?: string;
  description?: string;
  actor?: string | null;
};

export type BillActivityTimelineProps = SurfaceProps & {
  events: readonly BillActivityEvent[];
  emptyLabel?: string;
  formatDate?: (createdAt: string) => string;
};

const activityLabels: Record<string, string> = {
  "bill.scrub_failed": "Submission needs attention",
  "bill.submitted": "Bill submitted",
  "bill.accepted": "Bill accepted",
  "bill.rejected": "Bill rejected",
  "bill.denied": "Bill denied",
  "bill.partially_paid": "Partial payment received",
  "bill.paid": "Bill paid",
  "bill.second_review": "Second Bill Review submitted",
  "bill.lien": "Bill moved to lien",
  "bill.ibr": "Independent Bill Review submitted",
  "bill.closed": "Bill closed",
  "bill.written_off": "Balance written off",
  "payment.posted": "Payment posted",
  "eor.received": "EOR received",
  "bill.autofill_completed": "Bill data extracted",
};

/** Human-readable fallback for a signed partner event type. */
export function billActivityEventLabel(type: string): string {
  return activityLabels[type] ?? type.replace(/[._-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function defaultFormatDate(createdAt: string): string {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return createdAt;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

export function BillActivityTimeline({ events, emptyLabel = "No bill activity yet.", appearance, className, style, formatDate = defaultFormatDate }: BillActivityTimelineProps): ReactElement {
  return (
    <section className={classes("mb-surface mb-activity", className)} style={mindBillAppearanceStyle(appearance, style)} aria-label="Bill activity">
      <style>{lifecycleSurfaceStyles}</style>
      <header className="mb-surface-heading"><div><strong>Bill history</strong><span>Submission, payer responses, follow-up, and payments.</span></div><span>{events.length}</span></header>
      {!events.length ? <p className="mb-activity-empty">{emptyLabel}</p> : (
        <ol className="mb-activity-list">
          {events.map((event) => (
            <li className="mb-activity-item" key={event.id}>
              <span className="mb-activity-marker" aria-hidden="true" />
              <div className="mb-activity-content">
                <strong>{event.title ?? billActivityEventLabel(event.type)}</strong>
                {event.description ? <p>{event.description}</p> : null}
                <span>{formatDate(event.createdAt)}{event.actor ? ` · ${event.actor}` : ""}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export type BillLifecycleStage = "submitted" | "accepted" | "processed" | "closed";

const lifecycleStages: Array<{ id: BillLifecycleStage; label: string }> = [
  { id: "submitted", label: "Submitted" },
  { id: "accepted", label: "Accepted" },
  { id: "processed", label: "Processed" },
  { id: "closed", label: "Closed" },
];

/** Maps MindBill's detailed lifecycle state into a compact progress stage. */
export function billLifecycleStage(state: string): BillLifecycleStage {
  const value = state.toLowerCase();
  if (value.includes("closed") || value.includes("written_off")) return "closed";
  if (value.includes("processed") || value.includes("paid") || value.includes("denied") || value.includes("reject") || value.includes("partial") || value.includes("response") || value.includes("second_review") || value.includes("ibr") || value.includes("lien") || value.includes("appeal")) return "processed";
  if (value.includes("accepted")) return "accepted";
  return "submitted";
}

export type BillLifecycleProgressProps = SurfaceProps & {
  state: string;
  nativeStatus?: string;
  submittedAt?: string | null;
  agingDays?: number | null;
};

export function BillLifecycleProgress({ state, nativeStatus, submittedAt, agingDays, appearance, className, style }: BillLifecycleProgressProps): ReactElement {
  const current = billLifecycleStage(state);
  const currentIndex = lifecycleStages.findIndex((stage) => stage.id === current);
  return (
    <section className={classes("mb-surface mb-progress", className)} style={mindBillAppearanceStyle(appearance, style)} aria-label="Bill lifecycle">
      <style>{lifecycleSurfaceStyles}</style>
      <header className="mb-surface-heading"><div><strong>{humanize(nativeStatus || state)}</strong><span>{submittedAt ? `Submitted ${defaultFormatDate(submittedAt)}` : "Submitted"}{typeof agingDays === "number" ? ` · ${agingDays} days old` : ""}</span></div></header>
      <ol className="mb-progress-list">
        {lifecycleStages.map((stage, index) => {
          const status = index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
          return <li key={stage.id} className={`is-${status}`} aria-current={status === "current" ? "step" : undefined}><span aria-hidden="true">{status === "complete" ? "✓" : index + 1}</span><b>{stage.label}</b></li>;
        })}
      </ol>
    </section>
  );
}

export type BillSnapshotSummaryProps = SurfaceProps & Pick<BillLifecycleData, "bill" | "patient" | "injury" | "delivery">;

export function BillSnapshotSummary({ bill, patient, injury, delivery, appearance, className, style }: BillSnapshotSummaryProps): ReactElement {
  const values = [
    ["Patient", patient.name || [patient.firstName, patient.lastName].filter(Boolean).join(" ")],
    ["Claim", injury.claimNumber || "—"],
    ["Payer", delivery.payerName || injury.claimsAdminName || "—"],
    ["Date of service", bill.dos || "—"],
    ["Charged", currency(bill.totalCharge)],
    ["Balance", currency(bill.balanceDue)],
  ];
  return (
    <section className={classes("mb-surface mb-snapshot", className)} style={mindBillAppearanceStyle(appearance, style)} aria-label="Bill snapshot">
      <style>{lifecycleSurfaceStyles}</style>
      <header className="mb-surface-heading"><div><strong>Bill snapshot</strong><span>Bill #{bill.billNumber}</span></div></header>
      <dl>{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
  );
}

export type BillRemittanceCardProps = SurfaceProps & { remittance: BillRemittanceSummary };

export function BillRemittanceCard({ remittance, appearance, className, style }: BillRemittanceCardProps): ReactElement {
  return (
    <section className={classes("mb-surface mb-remittance", className)} style={mindBillAppearanceStyle(appearance, style)} aria-label="Remittance summary">
      <style>{lifecycleSurfaceStyles}</style>
      <header className="mb-surface-heading"><div><strong>Remittance</strong><span>Amounts reported by the payer and posted to the bill.</span></div></header>
      <dl>
        <div><dt>Payer reported</dt><dd>{remittance.payerReportedPaid === null ? "—" : currency(remittance.payerReportedPaid)}</dd></div>
        <div><dt>Posted</dt><dd>{currency(remittance.totalPaid)}</dd></div>
        <div><dt>Balance</dt><dd>{currency(remittance.balanceDue)}</dd></div>
      </dl>
      {remittance.denialReason ? <div className="mb-denial"><strong>Denial reason</strong><p>{remittance.denialReason}</p></div> : null}
    </section>
  );
}

export type BillPayerContactCardProps = SurfaceProps & { delivery: BillLifecycleDelivery };

export function BillPayerContactCard({ delivery, appearance, className, style }: BillPayerContactCardProps): ReactElement | null {
  const contacts = [
    delivery.contacts.adjusterName ? ["Adjuster", delivery.contacts.adjusterName, null] : null,
    delivery.contacts.adjusterPhone ? ["Adjuster phone", delivery.contacts.adjusterPhone, `tel:${delivery.contacts.adjusterPhone}`] : null,
    delivery.contacts.adjusterEmail ? ["Adjuster email", delivery.contacts.adjusterEmail, `mailto:${delivery.contacts.adjusterEmail}`] : null,
    delivery.contacts.faxNumber ? ["Fax", delivery.contacts.faxNumber, `tel:${delivery.contacts.faxNumber}`] : null,
    delivery.contacts.claimsEmail ? ["Email", delivery.contacts.claimsEmail, `mailto:${delivery.contacts.claimsEmail}`] : null,
    delivery.contacts.mailingAddress ? ["Mail", delivery.contacts.mailingAddress, null] : null,
    delivery.contacts.portalUrl ? ["Portal", "Open payer portal", delivery.contacts.portalUrl] : null,
  ].filter(Boolean) as Array<[string, string, string | null]>;
  if (!delivery.payerName && !contacts.length) return null;
  return (
    <section className={classes("mb-surface mb-contacts", className)} style={mindBillAppearanceStyle(appearance, style)} aria-label="Payer contact information">
      <style>{lifecycleSurfaceStyles}</style>
      <header className="mb-surface-heading"><div><strong>{delivery.payerName || "Claims administrator"}</strong><span>Billing and follow-up contacts.</span></div></header>
      {!contacts.length ? <p className="mb-empty">No payer contact details are available.</p> : <dl>{contacts.map(([label, value, href]) => <div key={label}><dt>{label}</dt><dd>{href ? <a href={href} target={label === "Portal" ? "_blank" : undefined} rel={label === "Portal" ? "noreferrer noopener" : undefined}>{value}</a> : value}</dd></div>)}</dl>}
    </section>
  );
}

export type BillPaymentLedgerProps = SurfaceProps & { payments: readonly BillPaymentRecord[] };

export function BillPaymentLedger({ payments, appearance, className, style }: BillPaymentLedgerProps): ReactElement {
  return (
    <section className={classes("mb-surface mb-payments", className)} style={mindBillAppearanceStyle(appearance, style)} aria-label="Payment ledger">
      <style>{lifecycleSurfaceStyles}</style>
      <header className="mb-surface-heading"><div><strong>Payments</strong><span>Payments posted to this bill.</span></div><span>{payments.length}</span></header>
      {!payments.length ? <p className="mb-empty">No payments posted.</p> : <div className="mb-payment-list">{payments.map((payment) => <article key={payment.id}><div><strong>{currency(payment.amount)}</strong><span>{humanize(payment.status || "posted")} · {payment.method.toUpperCase()}</span></div><div><span>{payment.checkNumber ? `#${payment.checkNumber}` : payment.source.toUpperCase()}</span><span>{payment.depositDate || defaultFormatDate(payment.postedAt)}</span></div>{payment.note ? <p>{payment.note}</p> : null}</article>)}</div>}
    </section>
  );
}

function classes(base: string, className?: string): string {
  return [base, className].filter(Boolean).join(" ");
}

function humanize(value: string): string {
  return value.replace(/[._-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function currency(value: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

const lifecycleSurfaceStyles = `
.mb-lifecycle-actions,.mb-surface{box-sizing:border-box;color:var(--mb-text);font-family:var(--mb-font,ui-sans-serif,system-ui,sans-serif)}
.mb-surface *{box-sizing:border-box}.mb-surface{background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-radius,12px);box-shadow:var(--mb-shadow);padding:20px}
.mb-surface-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.mb-surface-heading>div{display:grid;gap:2px}.mb-surface-heading strong{font-size:16px}.mb-surface-heading span,.mb-empty{color:var(--mb-muted);font-size:13px}.mb-surface-heading>span{border-radius:999px;background:var(--mb-soft);font-weight:750;padding:4px 8px}
.mb-lifecycle-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start}.mb-lifecycle-action{display:grid;gap:5px;max-width:260px}.mb-action-button{appearance:none;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius,8px);background:var(--mb-surface);color:var(--mb-text);font:inherit;font-weight:700;line-height:1.2;padding:11px 15px;cursor:pointer}.mb-action-button:hover:not(:disabled){border-color:var(--mb-accent);color:var(--mb-accent)}.mb-action-button:focus-visible{outline:3px solid color-mix(in srgb,var(--mb-accent) 28%,transparent);outline-offset:2px}.mb-action-button.is-primary{background:var(--mb-accent);border-color:var(--mb-accent);color:var(--mb-accent-contrast)}.mb-action-button:disabled{cursor:not-allowed;opacity:.55}.mb-action-reason{color:var(--mb-muted);font-size:12px;line-height:1.35}
.mb-activity-list{list-style:none;margin:0;padding:0}.mb-activity-item{display:grid;grid-template-columns:18px minmax(0,1fr);gap:12px;position:relative;padding:0 0 22px}.mb-activity-item:last-child{padding-bottom:0}.mb-activity-item:not(:last-child)::before{background:var(--mb-border);content:"";left:8px;position:absolute;top:10px;bottom:0;width:1px}.mb-activity-marker{background:var(--mb-surface);border:3px solid var(--mb-accent);border-radius:999px;height:11px;margin-top:4px;position:relative;width:11px;z-index:1}.mb-activity-content{display:grid;gap:4px;min-width:0}.mb-activity-content strong{font-size:15px;line-height:1.35}.mb-activity-content p{color:var(--mb-text);font-size:14px;line-height:1.5;margin:0}.mb-activity-content span,.mb-activity-empty{color:var(--mb-muted);font-size:13px;line-height:1.45}.mb-activity-empty,.mb-empty{margin:0}
.mb-progress-list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));list-style:none;margin:0;padding:0}.mb-progress-list li{display:grid;gap:7px;position:relative;text-align:center;color:var(--mb-muted);font-size:12px}.mb-progress-list li:not(:last-child)::after{content:"";position:absolute;left:calc(50% + 14px);right:calc(-50% + 14px);top:13px;height:2px;background:var(--mb-border)}.mb-progress-list li.is-complete:not(:last-child)::after{background:var(--mb-accent)}.mb-progress-list li>span{display:grid;place-items:center;justify-self:center;position:relative;z-index:1;width:28px;height:28px;border:2px solid var(--mb-border);border-radius:50%;background:var(--mb-surface);font-weight:800}.mb-progress-list li.is-complete>span,.mb-progress-list li.is-current>span{border-color:var(--mb-accent);background:var(--mb-accent);color:var(--mb-accent-contrast)}.mb-progress-list li.is-current{color:var(--mb-text)}
.mb-snapshot dl,.mb-remittance dl,.mb-contacts dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;margin:0}.mb-snapshot dl>div,.mb-remittance dl>div,.mb-contacts dl>div{display:grid;gap:3px;padding:10px 14px;border-left:1px solid var(--mb-border)}.mb-snapshot dl>div:nth-child(3n+1),.mb-remittance dl>div:first-child,.mb-contacts dl>div:first-child{border-left:0}.mb-snapshot dt,.mb-remittance dt,.mb-contacts dt{color:var(--mb-muted);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.mb-snapshot dd,.mb-remittance dd,.mb-contacts dd{font-size:14px;font-weight:750;margin:0;overflow-wrap:anywhere}.mb-contacts a{color:var(--mb-accent)}.mb-denial{margin-top:16px;border-left:4px solid var(--mb-danger);border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-danger) 8%,var(--mb-surface));padding:12px 14px}.mb-denial p{margin:4px 0 0}
.mb-payment-list{display:grid}.mb-payment-list article{display:grid;grid-template-columns:1fr auto;gap:5px 18px;padding:12px 0;border-top:1px solid var(--mb-border)}.mb-payment-list article:first-child{border-top:0}.mb-payment-list article>div{display:grid;gap:2px}.mb-payment-list article>div:nth-child(2){text-align:right}.mb-payment-list article span{color:var(--mb-muted);font-size:12px}.mb-payment-list article p{grid-column:1/-1;margin:0;color:var(--mb-muted);font-size:13px}
@media(max-width:700px){.mb-progress-list{grid-template-columns:1fr;text-align:left}.mb-progress-list li{grid-template-columns:28px 1fr;align-items:center;text-align:left}.mb-progress-list li:not(:last-child)::after{left:13px;right:auto;top:28px;bottom:-7px;width:2px;height:auto}.mb-progress-list li>span{grid-row:1}.mb-snapshot dl,.mb-remittance dl,.mb-contacts dl{grid-template-columns:1fr 1fr}.mb-snapshot dl>div,.mb-remittance dl>div,.mb-contacts dl>div{border:0;border-top:1px solid var(--mb-border);padding:10px 0}.mb-snapshot dl>div:nth-child(-n+2),.mb-remittance dl>div:nth-child(-n+2),.mb-contacts dl>div:nth-child(-n+2){border-top:0}.mb-payment-list article{grid-template-columns:1fr}.mb-payment-list article>div:nth-child(2){text-align:left}}
`;
