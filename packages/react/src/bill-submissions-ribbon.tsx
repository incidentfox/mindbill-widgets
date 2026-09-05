"use client";

// Submissions ribbon: a horizontal scrollable row of chips —
// one per bill submission (Original Bill, Second Review, Duplicate Bill, …) —
// each with an optional deadline badge and up to three small label/value meta
// pairs (delivery route, sent date, acknowledgement). Purely presentational;
// billSubmissionsRibbonFromHistory maps MindBill's presented history rows
// (kind === "submission") into ribbon items.

import type { CSSProperties, ReactElement } from "react";
import type { BillAttemptSummary, BillHistoryEntry } from "@mindbill/browser";

import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";

type SurfaceProps = {
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
};

export type BillSubmissionRibbonItem = {
  id: string;
  /** Submission history row to reveal when this attempt is selected. */
  historyEntryId?: string;
  /** "Original Bill" | "Second Review" | "Duplicate Bill" | … */
  label: string;
  /** Small rounded badge, e.g. "Denial in 3 working days". */
  badge?: string;
  /** Semantic color for the status badge. */
  badgeTone?: "neutral" | "success" | "warning" | "danger";
  /** Up to three label/value pairs rendered under the label. */
  meta?: Array<{ label: string; value: string }>;
  active?: boolean;
  href?: string;
};

export type BillSubmissionsRibbonProps = SurfaceProps & {
  items: BillSubmissionRibbonItem[];
  onSelect?: (item: BillSubmissionRibbonItem) => void;
};

/** Maps a presented-history submission summary to its delivery route word. */
export function billSubmissionsRibbonDeliveryLabel(summary: string): string {
  if (/electronically sent/i.test(summary)) return "e-Bill (837)";
  if (/faxed/i.test(summary)) return "Fax";
  if (/emailed/i.test(summary)) return "Email";
  if (/mailed/i.test(summary)) return "Mail";
  return "Sent";
}

function ribbonDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }).format(parsed);
}

function attemptStatus(
  entries: readonly BillHistoryEntry[],
  attempt?: BillAttemptSummary,
): Pick<BillSubmissionRibbonItem, "badge" | "badgeTone" | "meta"> {
  const rejected = [...entries].reverse().find((entry) =>
    entry.kind === "ack" && (/reject|deni|error/i.test(entry.action) || entry.tone === "problem"),
  );
  if (rejected) return {
    badge: rejected.action,
    badgeTone: "danger",
    meta: [{ label: "Rejected", value: ribbonDate(rejected.date) }],
  };

  const complianceDueDate = entries
    .flatMap((entry) => entry.details?.complianceDueDates ?? [])
    .find((due) => /payment|working day/i.test(due.text));
  if (complianceDueDate) return {
    badge: complianceDueDate.text,
    badgeTone: "warning",
    meta: [{ label: "Effective date", value: ribbonDate(complianceDueDate.date) }],
  };

  const processed = [...entries].reverse().find((entry) => entry.kind === "eor" || entry.kind === "payment");
  if (processed) return {
    badge: "Processed",
    badgeTone: "success",
    meta: [{ label: "Processed", value: ribbonDate(processed.date) }],
  };

  const accepted = [...entries].reverse().find((entry) =>
    entry.kind === "ack" && (/accept/i.test(entry.action) || entry.tone === "success"),
  );
  if (accepted) return {
    badge: accepted.action,
    badgeTone: "success",
    meta: [{ label: "Accepted", value: ribbonDate(accepted.date) }],
  };

  const closed = [...entries].reverse().find((entry) => entry.kind === "close");
  if (closed) return {
    badge: "Closed",
    badgeTone: "neutral",
    meta: [{ label: "Closed", value: ribbonDate(closed.date) }],
  };

  if (attempt?.ackLabel) return {
    badge: attempt.ackLabel,
    badgeTone: /reject|deni|error/i.test(attempt.ackLabel) ? "danger" : /accept/i.test(attempt.ackLabel) ? "success" : "neutral",
    ...(attempt.ackAt ? { meta: [{ label: /reject|deni|error/i.test(attempt.ackLabel) ? "Rejected" : "Acknowledged", value: ribbonDate(attempt.ackAt) }] } : {}),
  };

  if (attempt?.status) return {
    badge: attempt.status.replaceAll("_", " "),
    badgeTone: "neutral",
  };

  return {};
}

/**
 * Builds one item per immutable submission attempt. Each card summarizes the
 * payer events following that attempt, while the full history remains unified.
 */
export function billSubmissionsRibbonFromHistory(
  history: BillHistoryEntry[],
  attempts: BillAttemptSummary[] = [],
): BillSubmissionRibbonItem[] {
  if (attempts.length) {
    return attempts.map((attempt) => {
      const attemptEntries = history.filter((entry) => entry.attemptId === attempt.id);
      const submission = attemptEntries.find((entry) => entry.kind === "submission");
      const status = attemptStatus(attemptEntries, attempt);
      return {
        id: attempt.id,
        ...(submission ? { historyEntryId: submission.id } : {}),
        label: attempt.label,
        ...(status.badge ? { badge: status.badge } : {}),
        ...(status.badgeTone ? { badgeTone: status.badgeTone } : {}),
        meta: [
          { label: "Delivery", value: attempt.deliveryLabel ?? (submission ? billSubmissionsRibbonDeliveryLabel(submission.summary) : "—") },
          { label: "Sent", value: attempt.sentAt ? ribbonDate(attempt.sentAt) : submission ? ribbonDate(submission.date) : "—" },
          ...(status.meta ?? []),
        ],
        active: attempt.isCurrent,
      };
    });
  }

  const submissions = history
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.kind === "submission");

  return submissions.map(({ entry, index }, submissionIndex) => {
    const nextSubmissionIndex = submissions[submissionIndex + 1]?.index ?? history.length;
    const status = attemptStatus(history.slice(index, nextSubmissionIndex));
    return {
      id: entry.id,
      historyEntryId: entry.id,
      label: entry.action,
      ...(status.badge ? { badge: status.badge } : {}),
      ...(status.badgeTone ? { badgeTone: status.badgeTone } : {}),
      meta: [
        { label: "Delivery", value: billSubmissionsRibbonDeliveryLabel(entry.summary) },
        { label: "Sent", value: ribbonDate(entry.date) },
        ...(status.meta ?? []),
      ],
    };
  });
}

const css = `
.mbsr{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;color:var(--mb-text);font-family:var(--mb-font);font-size:13px}
.mbsr *{box-sizing:border-box}
.mbsr-chip{flex:0 0 240px;display:grid;gap:7px;width:240px;min-width:min(240px,85vw);max-width:280px;padding:11px 13px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);color:inherit;font:inherit;text-align:left;text-decoration:none;cursor:pointer}
.mbsr-chip:hover{border-color:var(--mb-accent)}
.mbsr-chip[data-active=true]{border-color:var(--mb-accent);background:color-mix(in srgb,var(--mb-accent) 7%,var(--mb-surface));box-shadow:0 0 0 1px var(--mb-accent) inset}
.mbsr-top{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;min-width:0}
.mbsr-label{min-width:0;font-size:13.5px;font-weight:760;line-height:1.3;overflow-wrap:normal;word-break:normal}
.mbsr-badge{justify-self:start;max-width:100%;padding:2px 8px;border:1px solid color-mix(in srgb,var(--mb-muted) 45%,var(--mb-border));border-radius:999px;background:var(--mb-soft);font-size:11px;font-weight:700;white-space:normal}
.mbsr-badge[data-tone=success]{border-color:color-mix(in srgb,#23876f 52%,var(--mb-border));background:color-mix(in srgb,#23876f 11%,var(--mb-surface));color:#176452}
.mbsr-badge[data-tone=warning]{border-color:color-mix(in srgb,var(--mb-warning) 55%,var(--mb-border));background:color-mix(in srgb,var(--mb-warning) 12%,var(--mb-surface))}
.mbsr-badge[data-tone=danger]{border-color:color-mix(in srgb,var(--mb-danger) 45%,var(--mb-border));background:color-mix(in srgb,var(--mb-danger) 9%,var(--mb-surface));color:var(--mb-danger)}
.mbsr-meta{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,auto);gap:2px 14px;justify-content:start}
.mbsr-meta>span{display:grid;gap:1px;min-width:0}
.mbsr-meta i{color:var(--mb-muted);font-size:10.5px;font-style:normal;font-weight:800;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}
.mbsr-meta b{font-size:12.5px;font-weight:700;white-space:nowrap}
`;

export function BillSubmissionsRibbon({
  items,
  onSelect,
  appearance,
  className = "",
  style,
}: BillSubmissionsRibbonProps): ReactElement {
  return (
    <div
      className={`mbsr ${className}`.trim()}
      style={mindBillAppearanceStyle(appearance, style)}
      role="list"
      aria-label="Bill submissions"
    >
      <style>{css}</style>
      {items.map((item) => {
        const content = (
          <>
            <span className="mbsr-top">
              <span className="mbsr-label">{item.label}</span>
              {item.badge ? <span className="mbsr-badge" data-tone={item.badgeTone ?? "neutral"}>{item.badge}</span> : null}
            </span>
            {item.meta?.length ? (
              <span className="mbsr-meta">
                {item.meta.slice(0, 3).map((pair) => (
                  <span key={pair.label}><i>{pair.label}</i><b>{pair.value}</b></span>
                ))}
              </span>
            ) : null}
          </>
        );
        return item.href ? (
          <a
            key={item.id}
            className="mbsr-chip"
            data-active={Boolean(item.active)}
            aria-current={item.active ? "true" : undefined}
            href={item.href}
            role="listitem"
            onClick={() => onSelect?.(item)}
          >
            {content}
          </a>
        ) : (
          <button
            key={item.id}
            type="button"
            className="mbsr-chip"
            data-active={Boolean(item.active)}
            aria-pressed={Boolean(item.active)}
            role="listitem"
            onClick={() => onSelect?.(item)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
