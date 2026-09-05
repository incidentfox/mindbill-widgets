"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
import type {
  BillEorDocument,
  BillHistoryEntry,
  BillLifecycleAction,
  BillLifecycleData,
  BillLifecycleDelivery,
  BillPaymentRecord,
  BillRejection,
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
      <header className="mb-surface-heading"><div><strong>Bill history</strong><span>Submission, payer responses, follow-up, and payments.</span></div></header>
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

export type BillHistoryTableProps = SurfaceProps & {
  entries: readonly BillHistoryEntry[];
  /** History row selected from the submissions ribbon. */
  selectedEntryId?: string;
  emptyLabel?: string;
  /** Formats the Date column. Defaults to MM/DD/YYYY. */
  formatDate?: (iso: string) => string;
  /** Resolve a clickable href for a submitted document; return null for plain text. */
  documentHref?: (doc: { id: string; filename: string }) => string | null;
  /** Open an authenticated submitted document in a new tab when no direct href is available. */
  onOpenDocument?: (doc: { id: string; filename: string }) => void | Promise<void>;
};

function historyDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }).format(parsed);
}

/**
 * The Bill History table: Date / Action / User / Details rows where
 * submissions are pale-blue expandable rows (documents + compliance due dates), notes
 * are pale-yellow, and 277 responses expand into decoded status-code sentences. The
 * rows come pre-worded from the MindBill API (`BillLifecycleData.history`).
 */
export function BillHistoryTable({ entries, selectedEntryId, emptyLabel = "No bill history yet.", appearance, className, style, formatDate = historyDate, documentHref, onOpenDocument }: BillHistoryTableProps): ReactElement {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const selectedRowRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (!selectedEntryId) return;
    const selected = entries.find((entry) => entry.id === selectedEntryId);
    if (selected?.details) setExpanded((current) => current[selectedEntryId] ? current : { ...current, [selectedEntryId]: true });
    selectedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [entries, selectedEntryId]);
  return (
    <section className={classes("mb-surface mb-history", className)} style={mindBillAppearanceStyle(appearance, style)} aria-label="Bill history">
      <style>{lifecycleSurfaceStyles}</style>
      <header className="mb-surface-heading"><div><strong>Bill history</strong><span>Submissions, payer responses, follow-up, and payments.</span></div></header>
      {!entries.length ? <p className="mb-activity-empty">{emptyLabel}</p> : (
        <div className="mb-history-table">
          <div className="mb-history-head" aria-hidden="true"><span>Date</span><span>Action</span><span>User</span><span>Details</span></div>
          <ul className="mb-history-rows">
            {entries.map((entry) => {
              const isSelected = entry.id === selectedEntryId;
              const expandable = Boolean(entry.details);
              const isOpen = expandable && Boolean(expanded[entry.id]);
              const details = entry.details;
              const lineContents = <>
                <span className="mb-history-date">{formatDate(entry.date)}</span>
                <span className="mb-history-action">{entry.action}</span>
                <span className="mb-history-actor">{entry.actor ?? "—"}</span>
                <span className="mb-history-summary">
                  {expandable ? <i className={`mb-history-caret${isOpen ? " is-open" : ""}`} aria-hidden="true" /> : null}
                  {entry.summary}
                </span>
              </>;
              return (
                <li
                  key={entry.id}
                  ref={isSelected ? selectedRowRef : undefined}
                  className={`mb-history-row is-${entry.tone}${isSelected ? " is-selected" : ""}`}
                  aria-current={isSelected ? "true" : undefined}
                >
                  {expandable ? <button
                    type="button"
                    className="mb-history-line is-expandable"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded((current) => ({ ...current, [entry.id]: !current[entry.id] }))}
                  >{lineContents}</button> : <div className="mb-history-line">{lineContents}</div>}
                  {isOpen && details ? (
                    <div className="mb-history-details">
                      {details.rows?.length ? (
                        <dl className="mb-history-kv">
                          {details.rows.map((row) => (
                            <div key={`${row.label}-${row.value}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>
                          ))}
                        </dl>
                      ) : null}
                      {details.documents?.length ? (
                        <div className="mb-history-kv"><div><dt>Documents</dt><dd>
                          {details.documents.map((doc) => {
                            const href = documentHref?.(doc) ?? null;
                            return href
                              ? <a key={doc.id} className="mb-history-doc" href={href} target="_blank" rel="noreferrer">{doc.filename}</a>
                              : onOpenDocument
                                ? <button key={doc.id} type="button" className="mb-history-doc" onClick={() => void onOpenDocument(doc)}>{doc.filename}</button>
                              : <span key={doc.id} className="mb-history-doc">{doc.filename}</span>;
                          })}
                        </dd></div></div>
                      ) : null}
                      {details.codes?.length ? (
                        <dl className="mb-history-codes">
                          {details.codes.map((code) => (
                            <div key={code.code}><dt>{code.code}</dt><dd>{code.text}</dd></div>
                          ))}
                        </dl>
                      ) : null}
                      {details.complianceDueDates?.length ? (
                        <div className="mb-history-due">
                          <em>Compliance Due Dates</em>
                          <dl>
                            {details.complianceDueDates.map((due) => (
                              <div key={`${due.date}-${due.text}`}><dt>{formatDate(due.date)}</dt><dd>{due.text}</dd></div>
                            ))}
                          </dl>
                        </div>
                      ) : null}
                      {details.text ? <p className="mb-history-text">{details.text}</p> : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

export type BillLifecycleStage = "submitted" | "accepted" | "processed" | "closed";

const lifecycleStages: Array<{ id: BillLifecycleStage; label: string }> = [
  { id: "submitted", label: "Sent" },
  { id: "accepted", label: "Accepted" },
  { id: "processed", label: "Processed" },
  { id: "closed", label: "Closed" },
];

export type BillLifecycleProgressStep = {
  id: string;
  label: string;
  status: "complete" | "current" | "upcoming";
};

/** Maps MindBill's detailed lifecycle state into a compact progress stage. */
export function billLifecycleStage(state: string): BillLifecycleStage {
  const value = state.toLowerCase();
  if (value.includes("closed") || value.includes("written_off")) return "closed";
  if (value.includes("second_review") || value.includes("appeal") || value.includes("reject")) return "submitted";
  if (value.includes("processed") || value.includes("paid") || value.includes("denied") || value.includes("partial") || value.includes("response") || value.includes("ibr") || value.includes("lien")) return "processed";
  if (value.includes("accepted")) return "accepted";
  return "submitted";
}

export type BillLifecycleProgressStepsOptions = {
  /**
   * Render pre-submission bills ("draft") as a dedicated leading Draft stage
   * ahead of the Sent→Closed rail. Off by default: hosts whose bills are always
   * already submitted (the typical partner embed) never see a Draft stage, and
   * without the flag a draft state keeps the legacy rendering (Sent as the
   * current stage). Post-submission states render identically either way.
   */
  draftStage?: boolean;
};

/** True when the lifecycle state is a pre-submission draft. */
export function isBillLifecycleDraft(state: string): boolean {
  return state.toLowerCase() === "draft";
}

/** Builds the progress rail for a lifecycle state, including terminal exception paths. */
export function billLifecycleProgressSteps(state: string, options?: BillLifecycleProgressStepsOptions): BillLifecycleProgressStep[] {
  if (state.toLowerCase() === "rejected") {
    return [
      { id: "submitted", label: "Sent", status: "complete" },
      { id: "rejected", label: "Rejected", status: "current" },
    ];
  }

  if (options?.draftStage && isBillLifecycleDraft(state)) {
    return [
      { id: "draft", label: "Draft", status: "current" },
      ...lifecycleStages.map((stage) => ({ ...stage, status: "upcoming" as const })),
    ];
  }

  const current = billLifecycleStage(state);
  const currentIndex = lifecycleStages.findIndex((stage) => stage.id === current);
  return lifecycleStages.map((stage, index) => ({
    ...stage,
    status:
      index < currentIndex
        ? "complete"
        : index === currentIndex
          ? "current"
          : "upcoming",
  }));
}

/** Returns the end-user label for a canonical lifecycle state. */
export function billLifecycleDisplayLabel(state: string, nativeStatus?: string): string {
  const value = state.toLowerCase();
  if (value === "submitted") return "Sent";
  if (value === "second_review") return "Second Review sent";
  if (value === "rejected") return "Rejected";
  if (value === "denied") return "Denied";
  if (value === "partially_paid") return "Partially paid";
  if (value === "written_off") return "Written off";
  return humanize(state || nativeStatus || "submitted");
}

export type BillLifecycleProgressProps = SurfaceProps & {
  state: string;
  nativeStatus?: string;
  submittedAt?: string | null;
  agingDays?: number | null;
  /** Opt-in leading Draft stage for pre-submission bills. See {@link BillLifecycleProgressStepsOptions}. */
  draftStage?: boolean;
};

export function BillLifecycleProgress({ state, nativeStatus, submittedAt, agingDays, draftStage, appearance, className, style }: BillLifecycleProgressProps): ReactElement {
  const rejected = state.toLowerCase() === "rejected";
  const draft = Boolean(draftStage) && isBillLifecycleDraft(state);
  const steps = billLifecycleProgressSteps(state, { draftStage: Boolean(draftStage) });
  return (
    <section className={classes(`mb-surface mb-progress${rejected ? " is-rejected" : ""}`, className)} style={mindBillAppearanceStyle(appearance, style)} aria-label="Bill lifecycle">
      <style>{lifecycleSurfaceStyles}</style>
      <header className="mb-surface-heading"><div><strong>{billLifecycleDisplayLabel(state, nativeStatus)}</strong><span>{rejected ? "The payer rejected this submission." : draft ? "Not yet sent" : `${submittedAt ? `Submitted ${defaultFormatDate(submittedAt)}` : "Submitted"}${typeof agingDays === "number" ? ` · ${agingDays} days old` : ""}`}</span></div></header>
      <ol className="mb-progress-list" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => (
          <li key={step.id} className={`is-${step.status}`} aria-current={step.status === "current" ? "step" : undefined}>
            <span aria-hidden="true">{step.status === "complete" ? "✓" : rejected && step.status === "current" ? "!" : index + 1}</span>
            <b>{step.label}</b>
          </li>
        ))}
      </ol>
    </section>
  );
}

export type BillRejectionNoticeProps = SurfaceProps & {
  rejection: BillRejection;
  title?: string;
  submittedAt?: string | null;
  formatDate?: (createdAt: string) => string;
};

/** Builds concise source-aware copy without inventing a clearinghouse name. */
export function billRejectionIssueSummary(rejection: BillRejection, count: number): string {
  const noun = count === 1 ? "validation error" : "validation errors";
  const source = rejection.source?.trim().replace(/\.$/, "");
  if (!source) return `${count} ${noun}.`;
  if (/acknowledg/i.test(source)) return `${count} clearinghouse ${noun}.`;
  return `${count} ${noun} returned by ${source}.`;
}

/** A prominent, end-user-readable explanation of a rejected submission. */
export function BillRejectionNotice({ rejection, title = "Rejected — action required", submittedAt, appearance, className, style, formatDate = defaultFormatDate }: BillRejectionNoticeProps): ReactElement {
  const issues = rejection.issues?.length
    ? rejection.issues
    : [{ code: rejection.code, description: rejection.reason }];
  const hasCodes = issues.some((issue) => Boolean(issue.code));

  return (
    <section className={classes("mb-surface mb-rejection-notice", className)} style={mindBillAppearanceStyle(appearance, style)} role="alert" aria-label="Bill rejection reasons">
      <style>{lifecycleSurfaceStyles}</style>
      <div className="mb-rejection-overview">
        <header className="mb-rejection-heading">
          <span className="mb-rejection-icon" aria-hidden="true">!</span>
          <div><strong>{title}</strong><span>Fix the {issues.length === 1 ? "issue" : "issues"} below, then resubmit.</span></div>
        </header>
        <ol className="mb-rejection-progress" aria-label="Submission status">
          <li className="is-complete"><span aria-hidden="true">✓</span><b>Sent</b>{submittedAt ? <small>{formatDate(submittedAt)}</small> : null}</li>
          <li className="is-rejected" aria-current="step"><span aria-hidden="true">!</span><b>Rejected</b>{rejection.receivedAt ? <small>{formatDate(rejection.receivedAt)}</small> : null}</li>
        </ol>
      </div>
      <div className="mb-rejection-issues" aria-label="Rejection reasons">
        <div className="mb-rejection-issues-heading">
          <strong><span aria-hidden="true">△</span> Rejection reasons</strong>
          <span>{billRejectionIssueSummary(rejection, issues.length)}</span>
        </div>
        <ol aria-label={`${issues.length} rejection ${issues.length === 1 ? "reason" : "reasons"}`}>
          {issues.map((issue, index) => (
            <li key={`${issue.code ?? "issue"}-${index}`}>
              <span className="mb-rejection-bullet" aria-hidden="true" />
              <p>{issue.description}</p>
              {issue.code ? <span className="mb-rejection-code">{issue.code}</span> : null}
            </li>
          ))}
        </ol>
        {hasCodes ? <p className="mb-rejection-code-note"><span aria-hidden="true">i</span> Technical error codes are included for support and auditability.</p> : null}
      </div>
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

export type BillExplanationOfReviewProps = SurfaceProps & {
  remittance: BillRemittanceSummary;
  eors: readonly BillEorDocument[];
  payments: readonly BillPaymentRecord[];
  submittedAt?: string | null;
  onOpenEor?: (document: BillEorDocument) => void | Promise<void>;
};

/**
 * A consolidated payer-response surface: financial summary, denial context,
 * EOR documents, and posted payments in one familiar reconciliation view.
 */
export function BillExplanationOfReview({
  remittance,
  eors,
  payments,
  submittedAt,
  onOpenEor,
  appearance,
  className,
  style,
}: BillExplanationOfReviewProps): ReactElement {
  const rows = payments.length ? payments : [null];
  return (
    <section className={classes("mb-surface mb-eor-review", className)} style={mindBillAppearanceStyle(appearance, style)} aria-label="Explanation of Review and payments">
      <style>{lifecycleSurfaceStyles}</style>
      <header className="mb-surface-heading"><div><strong>Explanation of Review</strong><span>Payer response and payment reconciliation.</span></div></header>
      <dl className="mb-eor-metrics">
        <div><dt>Amount billed</dt><dd>{currency(remittance.billedAmount)}</dd></div>
        <div><dt>Payer allowed</dt><dd>{remittance.payerAllowedAmount === null ? "—" : currency(remittance.payerAllowedAmount)}</dd></div>
        <div><dt>Payer reported paid</dt><dd>{remittance.payerReportedPaid === null ? "—" : currency(remittance.payerReportedPaid)}</dd></div>
        <div className="is-balance"><dt>Balance due</dt><dd>{currency(remittance.balanceDue)}</dd></div>
        <div><dt>Payment posted</dt><dd>{currency(remittance.postedPrincipal)}</dd></div>
        <div><dt>Penalty &amp; interest</dt><dd>{currency(remittance.postedAdditional)}</dd></div>
        <div><dt>Total received</dt><dd>{currency(remittance.totalPostedCash)}</dd></div>
        <div><dt>Expected</dt><dd>{currency(remittance.expectedAmount)}</dd></div>
      </dl>
      {remittance.denialReason ? <div className="mb-denial"><strong>Denial reason</strong><p>{remittance.denialReason}</p></div> : null}
      <div className="mb-eor-table-wrap">
        <table className="mb-eor-table">
          <thead>
            <tr className="mb-eor-groups"><th colSpan={2}>Submission</th><th colSpan={5}>EOR payment information</th><th colSpan={2}>EOR post</th><th>EOR</th></tr>
            <tr><th>Submission</th><th>Submission payment</th><th>Payment method</th><th>Reference</th><th>Effective date</th><th>Payment total</th><th>Deposit date</th><th>Post date</th><th>Source</th><th>Document</th></tr>
          </thead>
          <tbody>{rows.map((payment, index) => {
            const eor = eors[index] ?? eors[0];
            return <tr key={payment?.id ?? `empty-${index}`}>
              <td data-label="Submission"><strong>Original bill</strong>{submittedAt ? <span>Sent {defaultFormatDate(submittedAt)}</span> : null}</td>
              <td data-label="Submission payment">{remittance.payerReportedPaid === null ? "—" : currency(remittance.payerReportedPaid)}</td>
              <td data-label="Payment method">{payment ? humanize(payment.method) : "—"}</td>
              <td data-label="Reference">{payment?.checkNumber || "—"}</td>
              <td data-label="Effective date">{payment ? payment.receivedDate || payment.depositDate || defaultFormatDate(payment.postedAt) : "—"}</td>
              <td data-label="Payment total">{payment ? currency(payment.amount) : currency(0)}</td>
              <td data-label="Deposit date">{payment?.depositDate || "Not recorded"}</td>
              <td data-label="Post date">{payment ? defaultFormatDate(payment.postedAt) : eor ? defaultFormatDate(eor.addedAt) : "—"}</td>
              <td data-label="Source">{payment ? payment.source.toUpperCase() : eor ? "EOR" : "—"}</td>
              <td data-label="EOR">{eor && onOpenEor ? <button type="button" className="mb-eor-link" onClick={() => void onOpenEor(eor)}>{eor.filename}</button> : eor?.filename || "—"}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {eors.length > rows.length ? <div className="mb-eor-documents">{eors.slice(rows.length).map((eor) => <button type="button" key={eor.id} onClick={() => void onOpenEor?.(eor)}>{eor.filename}</button>)}</div> : null}
    </section>
  );
}

export function BillRemittanceCard({ remittance, appearance, className, style }: BillRemittanceCardProps): ReactElement {
  return (
    <section className={classes("mb-surface mb-remittance", className)} style={mindBillAppearanceStyle(appearance, style)} aria-label="Remittance summary">
      <style>{lifecycleSurfaceStyles}</style>
      <header className="mb-surface-heading"><div><strong>Remittance</strong><span>Amounts reported by the payer and posted to the bill.</span></div></header>
      <dl>
        <div><dt>Amount billed</dt><dd>{currency(remittance.billedAmount)}</dd></div>
        <div><dt>Expected</dt><dd>{currency(remittance.expectedAmount)}</dd></div>
        <div><dt>Payer allowed</dt><dd>{remittance.payerAllowedAmount === null ? "—" : currency(remittance.payerAllowedAmount)}</dd></div>
        <div><dt>Payer reported paid</dt><dd>{remittance.payerReportedPaid === null ? "—" : currency(remittance.payerReportedPaid)}</dd></div>
        <div><dt>Payment posted</dt><dd>{currency(remittance.postedPrincipal)}</dd></div>
        <div><dt>Penalty &amp; interest</dt><dd>{currency(remittance.postedAdditional)}</dd></div>
        <div><dt>Total received</dt><dd>{currency(remittance.totalPostedCash)}</dd></div>
        <div><dt>Balance due</dt><dd>{currency(remittance.balanceDue)}</dd></div>
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
      <header className="mb-surface-heading"><div><strong>Payments</strong><span>Funds recorded against this bill.</span></div></header>
      {!payments.length ? <p className="mb-empty">No payments posted.</p> : <div className="mb-payment-list">{payments.map((payment) => {
        const additional = payment.feeAmount ?? 0;
        return <article key={payment.id}>
          <div className="mb-payment-amount"><strong>{currency(payment.amount)}</strong><span>Total received</span></div>
          <dl>
            <div><dt>Applied to bill</dt><dd>{currency(payment.principalAmount)}</dd></div>
            {additional > 0 ? <div><dt>Penalty &amp; interest</dt><dd>{currency(additional)}</dd></div> : null}
            <div><dt>Method</dt><dd>{payment.method.toUpperCase()}</dd></div>
            <div><dt>Reference</dt><dd>{payment.checkNumber || "—"}</dd></div>
            <div><dt>Effective date</dt><dd>{payment.receivedDate || payment.depositDate || defaultFormatDate(payment.postedAt)}</dd></div>
            <div><dt>Deposit date</dt><dd>{payment.depositDate || "Not recorded"}</dd></div>
            <div><dt>Posted</dt><dd>{defaultFormatDate(payment.postedAt)} · {payment.source.toUpperCase()}</dd></div>
            <div><dt>Status</dt><dd>{humanize(payment.status || "posted")}</dd></div>
          </dl>
          {payment.feeReason ? <p>{payment.feeReason}</p> : null}
          {payment.note ? <p>{payment.note}</p> : null}
        </article>;
      })}</div>}
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
.mb-progress.is-rejected{border-color:color-mix(in srgb,var(--mb-danger) 34%,var(--mb-border));background:color-mix(in srgb,var(--mb-danger) 3%,var(--mb-surface));box-shadow:0 8px 24px color-mix(in srgb,var(--mb-danger) 8%,transparent)}.mb-progress.is-rejected .mb-surface-heading strong,.mb-progress.is-rejected .mb-progress-list li.is-current{color:var(--mb-danger)}.mb-progress.is-rejected .mb-progress-list li.is-current>span{border-color:var(--mb-danger);background:var(--mb-danger);color:#fff}
.mb-rejection-notice{border:1px solid color-mix(in srgb,var(--mb-danger) 30%,var(--mb-border));border-left:4px solid var(--mb-danger);background:color-mix(in srgb,var(--mb-danger) 5%,var(--mb-surface));box-shadow:0 14px 38px color-mix(in srgb,var(--mb-danger) 9%,transparent);padding:26px 28px 18px}.mb-rejection-overview{display:grid;grid-template-columns:minmax(230px,.72fr) minmax(360px,1.28fr);align-items:start;gap:38px}.mb-rejection-heading{display:flex;align-items:flex-start;gap:14px}.mb-rejection-heading>div{display:grid;gap:5px}.mb-rejection-heading strong{color:var(--mb-danger);font-size:19px;line-height:1.25}.mb-rejection-heading span{color:color-mix(in srgb,var(--mb-danger) 48%,var(--mb-text));font-size:14px;line-height:1.45}.mb-rejection-icon{display:grid;place-items:center;flex:0 0 auto;width:42px;height:42px;border-radius:50%;background:var(--mb-danger);box-shadow:0 5px 14px color-mix(in srgb,var(--mb-danger) 25%,transparent);color:#fff;font-size:21px;font-weight:900}.mb-rejection-progress{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));list-style:none;margin:5px 0 24px;padding:0}.mb-rejection-progress li{display:grid;grid-template-rows:34px auto auto;gap:4px;position:relative;text-align:center;color:var(--mb-text);font-size:12px}.mb-rejection-progress li:first-child::after{content:"";position:absolute;left:calc(50% + 17px);right:calc(-50% + 17px);top:16px;height:2px;background:color-mix(in srgb,var(--mb-danger) 48%,var(--mb-border))}.mb-rejection-progress li>span{display:grid;place-items:center;justify-self:center;position:relative;z-index:1;width:34px;height:34px;border:2px solid color-mix(in srgb,var(--mb-danger) 32%,var(--mb-border));border-radius:50%;background:var(--mb-surface);color:var(--mb-danger);font-size:16px;font-weight:900}.mb-rejection-progress li.is-rejected>span{border-color:var(--mb-danger);background:var(--mb-danger);color:#fff}.mb-rejection-progress b{font-size:13px}.mb-rejection-progress small{color:var(--mb-muted);font-size:11px;line-height:1.3}.mb-rejection-issues{border:1px solid color-mix(in srgb,var(--mb-danger) 19%,var(--mb-border));border-radius:12px;background:color-mix(in srgb,var(--mb-danger) 2%,var(--mb-surface));overflow:hidden}.mb-rejection-issues-heading{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 16px;border-bottom:1px solid color-mix(in srgb,var(--mb-danger) 14%,var(--mb-border))}.mb-rejection-issues-heading strong{display:flex;align-items:center;gap:8px;font-size:13px}.mb-rejection-issues-heading strong>span{color:var(--mb-danger);font-size:17px}.mb-rejection-issues-heading>span{color:var(--mb-muted);font-size:12px;text-align:right}.mb-rejection-issues ol{display:grid;gap:7px;list-style:none;margin:0;padding:10px 12px}.mb-rejection-issues li{display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:11px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--mb-danger) 11%,var(--mb-border));border-radius:8px;background:color-mix(in srgb,var(--mb-danger) 1%,var(--mb-surface));box-shadow:0 1px 3px rgba(23,39,48,.04)}.mb-rejection-bullet{width:7px;height:7px;border-radius:50%;background:var(--mb-danger)}.mb-rejection-issues p{margin:0;font-size:14px;line-height:1.45}.mb-rejection-code{justify-self:end;border:1px solid color-mix(in srgb,var(--mb-danger) 20%,var(--mb-border));border-radius:999px;background:color-mix(in srgb,var(--mb-danger) 6%,var(--mb-surface));color:var(--mb-danger);font-size:11px;font-weight:850;line-height:1.2;padding:4px 8px}.mb-rejection-code-note{display:flex;align-items:center;gap:7px;margin:0;padding:1px 16px 13px;color:var(--mb-muted);font-size:11px}.mb-rejection-code-note>span{display:grid;place-items:center;width:16px;height:16px;border:1px solid currentColor;border-radius:50%;font-size:10px;font-weight:850}
.mb-snapshot dl,.mb-remittance dl,.mb-contacts dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;margin:0}.mb-remittance dl{grid-template-columns:repeat(4,minmax(0,1fr));row-gap:1px;background:var(--mb-border)}.mb-snapshot dl>div,.mb-remittance dl>div,.mb-contacts dl>div{display:grid;gap:3px;padding:10px 14px;border-left:1px solid var(--mb-border)}.mb-remittance dl>div{border:0;background:var(--mb-surface)}.mb-snapshot dl>div:nth-child(3n+1),.mb-contacts dl>div:first-child{border-left:0}.mb-snapshot dt,.mb-remittance dt,.mb-contacts dt,.mb-payment-list dt{color:var(--mb-muted);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.mb-snapshot dd,.mb-remittance dd,.mb-contacts dd,.mb-payment-list dd{font-size:14px;font-weight:750;margin:0;overflow-wrap:anywhere}.mb-contacts a{color:var(--mb-accent)}.mb-denial{margin-top:16px;border-left:4px solid var(--mb-danger);border-radius:var(--mb-control-radius);background:color-mix(in srgb,var(--mb-danger) 8%,var(--mb-surface));padding:12px 14px}.mb-denial p{margin:4px 0 0}
.mb-payment-list{display:grid}.mb-payment-list article{display:grid;grid-template-columns:minmax(120px,.35fr) 1fr;gap:14px 24px;padding:16px 0;border-top:1px solid var(--mb-border)}.mb-payment-list article:first-child{border-top:0}.mb-payment-amount{display:grid;align-content:start;gap:2px}.mb-payment-amount strong{font-size:1.2rem}.mb-payment-list article>dl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0}.mb-payment-list article>dl>div{display:grid;align-content:start;gap:3px}.mb-payment-list article span{color:var(--mb-muted);font-size:12px}.mb-payment-list article p{grid-column:1/-1;margin:0;color:var(--mb-muted);font-size:13px}
.mb-eor-review{border-top:4px solid var(--mb-accent);padding-top:17px}.mb-eor-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:0 0 18px;border:1px solid var(--mb-border);border-radius:10px;overflow:hidden}.mb-eor-metrics>div{display:grid;gap:4px;padding:13px 15px;border-left:1px solid var(--mb-border);border-top:1px solid var(--mb-border)}.mb-eor-metrics>div:nth-child(-n+4){border-top:0}.mb-eor-metrics>div:nth-child(4n+1){border-left:0}.mb-eor-metrics dt{color:var(--mb-muted);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.mb-eor-metrics dd{margin:0;font-size:15px;font-weight:800}.mb-eor-metrics .is-balance{background:color-mix(in srgb,var(--mb-accent) 7%,var(--mb-surface))}.mb-eor-table-wrap{overflow-x:auto;border:1px solid var(--mb-border);border-radius:10px}.mb-eor-table{width:100%;min-width:1080px;border-collapse:collapse;font-size:12px}.mb-eor-table th,.mb-eor-table td{padding:10px 12px;border-left:1px solid var(--mb-border);border-top:1px solid var(--mb-border);text-align:left;vertical-align:top}.mb-eor-table th:first-child,.mb-eor-table td:first-child{border-left:0}.mb-eor-table thead th{background:var(--mb-soft);color:var(--mb-muted);font-weight:800}.mb-eor-table .mb-eor-groups th{border-top:0;background:color-mix(in srgb,var(--mb-accent) 13%,var(--mb-surface));color:var(--mb-text);text-align:center}.mb-eor-table td>strong,.mb-eor-table td>span{display:block}.mb-eor-table td>span{margin-top:3px;color:var(--mb-muted)}.mb-eor-link,.mb-eor-documents button{border:0;background:transparent;color:var(--mb-accent);font:inherit;font-weight:750;padding:0;text-align:left;text-decoration:underline;cursor:pointer;overflow-wrap:anywhere}.mb-eor-documents{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px}
.mb-history-table{border:1px solid var(--mb-border);border-radius:10px;overflow:hidden}
.mb-history-head{display:grid;grid-template-columns:96px 160px 140px minmax(0,1fr);gap:12px;padding:8px 14px;background:var(--mb-soft);color:var(--mb-muted);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.mb-history-rows{list-style:none;margin:0;padding:0}.mb-history-row{border-top:1px solid var(--mb-border)}
.mb-history-row.is-submission{background:color-mix(in srgb,var(--mb-accent) 9%,var(--mb-surface))}
.mb-history-row.is-note{background:color-mix(in srgb,#f2c344 13%,var(--mb-surface))}
.mb-history-row.is-selected{position:relative;background:color-mix(in srgb,var(--mb-accent) 15%,var(--mb-surface));box-shadow:inset 4px 0 0 var(--mb-accent),inset 0 0 0 1px color-mix(in srgb,var(--mb-accent) 44%,transparent)}
.mb-history-line{display:grid;grid-template-columns:96px 160px 140px minmax(0,1fr);gap:12px;width:100%;padding:10px 14px;border:0;background:transparent;color:inherit;font:inherit;text-align:left}
.mb-history-line.is-expandable{cursor:pointer}.mb-history-line.is-expandable:hover .mb-history-summary{text-decoration:underline}
.mb-history-date{color:var(--mb-muted);font-size:13px}.mb-history-action{font-size:13.5px;font-weight:750}
.mb-history-row.is-problem .mb-history-action{color:var(--mb-danger)}
.mb-history-actor{color:var(--mb-muted);font-size:13px;overflow-wrap:anywhere}
.mb-history-summary{display:flex;align-items:flex-start;gap:7px;min-width:0;font-size:13.5px;line-height:1.45;overflow-wrap:anywhere}
.mb-history-caret{flex:0 0 auto;margin-top:5px;width:0;height:0;border-top:4px solid transparent;border-bottom:4px solid transparent;border-left:6px solid var(--mb-muted);transition:transform .12s ease}
.mb-history-caret.is-open{transform:rotate(90deg)}
.mb-history-details{padding:4px 14px 14px 122px;font-size:13.5px;line-height:1.5}
.mb-history-kv,.mb-history-codes,.mb-history-due dl{display:grid;gap:4px;margin:0}
.mb-history-kv>div{display:grid;grid-template-columns:180px minmax(0,1fr);gap:12px;border-top:1px solid color-mix(in srgb,var(--mb-border) 60%,transparent);padding-top:4px}
.mb-history-kv dt{font-weight:750}.mb-history-kv dd{margin:0;overflow-wrap:anywhere}.mb-history-kv dd a{color:var(--mb-accent)}.mb-history-doc{display:block}.mb-history-kv button.mb-history-doc{border:0;background:transparent;color:var(--mb-accent);font:inherit;padding:0;text-align:left;text-decoration:underline;cursor:pointer}
.mb-history-codes>div{display:grid;grid-template-columns:56px minmax(0,1fr);gap:12px}.mb-history-codes dt{font-weight:800}.mb-history-codes dd{margin:0}
.mb-history-due{margin-top:8px}.mb-history-due em{display:block;color:var(--mb-muted);font-size:12.5px;margin-bottom:4px}
.mb-history-due dl>div{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;border-top:1px solid color-mix(in srgb,var(--mb-border) 60%,transparent);padding-top:4px}
.mb-history-due dt{font-weight:750}.mb-history-due dd{margin:0}
.mb-history-text{margin:8px 0 0;color:var(--mb-text);white-space:pre-wrap}
@media(max-width:500px){.mb-eor-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.mb-eor-metrics>div:nth-child(n){border-top:1px solid var(--mb-border);border-left:1px solid var(--mb-border)}.mb-eor-metrics>div:nth-child(-n+2){border-top:0}.mb-eor-metrics>div:nth-child(odd){border-left:0}.mb-eor-metrics dd{overflow-wrap:anywhere}}
@media(max-width:700px){.mb-history-head{display:none}.mb-history-line{grid-template-columns:1fr;gap:2px;padding:10px 12px}.mb-history-details{padding:4px 12px 12px}.mb-history-kv>div,.mb-history-due dl>div{grid-template-columns:1fr}}
@media(max-width:700px){.mb-surface.mb-progress{padding:16px 10px}.mb-progress-list{grid-template-columns:repeat(4,minmax(0,1fr))}.mb-progress-list li{display:grid;grid-template-columns:1fr;align-items:start;gap:6px;text-align:center;font-size:10px;min-width:0}.mb-progress-list li b{font-size:10px;white-space:nowrap}.mb-progress-list li:not(:last-child)::after{left:calc(50% + 12px);right:calc(-50% + 12px);top:11px;bottom:auto;width:auto;height:2px}.mb-progress-list li>span{grid-row:auto;width:24px;height:24px;font-size:11px}.mb-rejection-notice{padding:18px 14px 14px}.mb-rejection-overview{grid-template-columns:1fr;gap:18px}.mb-rejection-heading strong{font-size:17px}.mb-rejection-icon{width:36px;height:36px}.mb-rejection-progress{margin:0 0 4px}.mb-rejection-issues-heading{align-items:flex-start;flex-direction:column;gap:4px}.mb-rejection-issues-heading>span{text-align:left}.mb-rejection-issues li{grid-template-columns:8px minmax(0,1fr);gap:8px 10px}.mb-rejection-code{grid-column:2;justify-self:start}.mb-snapshot dl,.mb-remittance dl,.mb-contacts dl{grid-template-columns:1fr 1fr}.mb-snapshot dl>div,.mb-remittance dl>div,.mb-contacts dl>div{border:0;border-top:1px solid var(--mb-border);padding:10px 0}.mb-snapshot dl>div:nth-child(-n+2),.mb-remittance dl>div:nth-child(-n+2),.mb-contacts dl>div:nth-child(-n+2){border-top:0}.mb-payment-list article{grid-template-columns:1fr}.mb-payment-list article>dl{grid-template-columns:1fr 1fr}}
`;
