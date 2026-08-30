"use client";

import type { CSSProperties, ReactElement } from "react";
import type { BillLifecycleAction } from "@mindbill/browser";
import type { MindBillReactAppearance } from "./appearance";
import { mindBillAppearanceStyle } from "./appearance";

export type BillLifecycleActionsProps = {
  actions: readonly BillLifecycleAction[];
  onAction: (action: BillLifecycleAction) => void;
  /** Show disabled actions and the server-provided reason. Defaults to false. */
  showUnavailable?: boolean;
  disabled?: boolean;
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
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
    <div
      className={["mb-lifecycle-actions", className].filter(Boolean).join(" ")}
      style={mindBillAppearanceStyle(appearance, style)}
      aria-label="Bill actions"
    >
      <style>{lifecycleSurfaceStyles}</style>
      {visible.map((action) => (
        <div className="mb-lifecycle-action" key={action.id}>
          <button
            type="button"
            className={action.primary ? "mb-action-button is-primary" : "mb-action-button"}
            disabled={disabled || !action.enabled}
            onClick={() => onAction(action)}
          >
            {action.label}
          </button>
          {!action.enabled && action.reason ? (
            <span className="mb-action-reason">{action.reason}</span>
          ) : null}
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
  actor?: string;
};

export type BillActivityTimelineProps = {
  events: readonly BillActivityEvent[];
  emptyLabel?: string;
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
  formatDate?: (createdAt: string) => string;
};

const activityLabels: Record<string, string> = {
  "bill.created": "Bill created",
  "bill.draft": "Bill saved",
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
  return activityLabels[type] ?? type
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function defaultFormatDate(createdAt: string): string {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return createdAt;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function BillActivityTimeline({
  events,
  emptyLabel = "No bill activity yet.",
  appearance,
  className,
  style,
  formatDate = defaultFormatDate,
}: BillActivityTimelineProps): ReactElement {
  return (
    <section
      className={["mb-activity", className].filter(Boolean).join(" ")}
      style={mindBillAppearanceStyle(appearance, style)}
      aria-label="Bill activity"
    >
      <style>{lifecycleSurfaceStyles}</style>
      {!events.length ? <p className="mb-activity-empty">{emptyLabel}</p> : (
        <ol className="mb-activity-list">
          {events.map((event) => (
            <li className="mb-activity-item" key={event.id}>
              <span className="mb-activity-marker" aria-hidden="true" />
              <div className="mb-activity-content">
                <strong>{event.title ?? billActivityEventLabel(event.type)}</strong>
                {event.description ? <p>{event.description}</p> : null}
                <span>
                  {formatDate(event.createdAt)}
                  {event.actor ? ` · ${event.actor}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const lifecycleSurfaceStyles = `
.mb-lifecycle-actions,.mb-activity{box-sizing:border-box;color:var(--mb-text);font-family:var(--mb-font,ui-sans-serif,system-ui,sans-serif)}
.mb-lifecycle-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start}
.mb-lifecycle-action{display:grid;gap:5px;max-width:260px}
.mb-action-button{appearance:none;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius,8px);background:var(--mb-surface);color:var(--mb-text);font:inherit;font-weight:700;line-height:1.2;padding:11px 15px;cursor:pointer}
.mb-action-button:hover:not(:disabled){border-color:var(--mb-accent);color:var(--mb-accent)}
.mb-action-button:focus-visible{outline:3px solid color-mix(in srgb,var(--mb-accent) 28%,transparent);outline-offset:2px}
.mb-action-button.is-primary{background:var(--mb-accent);border-color:var(--mb-accent);color:var(--mb-accent-contrast)}
.mb-action-button:disabled{cursor:not-allowed;opacity:.55}
.mb-action-reason{color:var(--mb-muted);font-size:12px;line-height:1.35}
.mb-activity{background:var(--mb-surface);border:1px solid var(--mb-border);border-radius:var(--mb-radius,12px);box-shadow:var(--mb-shadow);padding:20px}
.mb-activity-list{list-style:none;margin:0;padding:0}
.mb-activity-item{display:grid;grid-template-columns:18px minmax(0,1fr);gap:12px;position:relative;padding:0 0 22px}
.mb-activity-item:last-child{padding-bottom:0}
.mb-activity-item:not(:last-child)::before{background:var(--mb-border);content:"";left:8px;position:absolute;top:10px;bottom:0;width:1px}
.mb-activity-marker{background:var(--mb-surface);border:3px solid var(--mb-accent);border-radius:999px;height:11px;margin-top:4px;position:relative;width:11px;z-index:1}
.mb-activity-content{display:grid;gap:4px;min-width:0}
.mb-activity-content strong{font-size:15px;line-height:1.35}
.mb-activity-content p{color:var(--mb-text);font-size:14px;line-height:1.5;margin:0}
.mb-activity-content span,.mb-activity-empty{color:var(--mb-muted);font-size:13px;line-height:1.45}
.mb-activity-empty{margin:0}
`;
