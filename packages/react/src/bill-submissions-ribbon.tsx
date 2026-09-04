"use client";

// Submissions ribbon: a horizontal scrollable row of chips —
// one per bill submission (Original Bill, Second Review, Duplicate Bill, …) —
// each with an optional deadline badge and up to three small label/value meta
// pairs (delivery route, sent date, acknowledgement). Purely presentational;
// billSubmissionsRibbonFromHistory maps MindBill's presented history rows
// (kind === "submission") into ribbon items.

import type { CSSProperties, ReactElement } from "react";
import type { BillHistoryEntry } from "@mindbill/browser";

import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";

type SurfaceProps = {
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
};

export type BillSubmissionRibbonItem = {
  id: string;
  /** "Original Bill" | "Second Review" | "Duplicate Bill" | … */
  label: string;
  /** Small rounded badge, e.g. "Denial in 3 working days". */
  badge?: string;
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

/** Builds ribbon items from MindBill's presented history (submission rows only). */
export function billSubmissionsRibbonFromHistory(history: BillHistoryEntry[]): BillSubmissionRibbonItem[] {
  return history
    .filter((entry) => entry.kind === "submission")
    .map((entry) => ({
      id: entry.id,
      label: entry.action,
      meta: [
        { label: "Delivery", value: billSubmissionsRibbonDeliveryLabel(entry.summary) },
        { label: "Sent", value: ribbonDate(entry.date) },
      ],
    }));
}

const css = `
.mbsr{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;color:var(--mb-text);font-family:var(--mb-font);font-size:13px}
.mbsr *{box-sizing:border-box}
.mbsr-chip{flex:0 0 auto;display:grid;gap:7px;min-width:180px;max-width:280px;padding:11px 13px;border:1px solid var(--mb-border);border-radius:var(--mb-control-radius);background:var(--mb-surface);color:inherit;font:inherit;text-align:left;text-decoration:none;cursor:pointer}
.mbsr-chip:hover{border-color:var(--mb-accent)}
.mbsr-chip[data-active=true]{border-color:var(--mb-accent);background:color-mix(in srgb,var(--mb-accent) 7%,var(--mb-surface));box-shadow:0 0 0 1px var(--mb-accent) inset}
.mbsr-top{display:flex;align-items:center;gap:8px;min-width:0}
.mbsr-label{font-size:13.5px;font-weight:760;line-height:1.3;overflow-wrap:anywhere}
.mbsr-badge{flex:0 0 auto;padding:2px 8px;border:1px solid color-mix(in srgb,var(--mb-warning) 55%,var(--mb-border));border-radius:999px;background:color-mix(in srgb,var(--mb-warning) 12%,var(--mb-surface));font-size:11px;font-weight:700;white-space:nowrap}
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
              {item.badge ? <span className="mbsr-badge">{item.badge}</span> : null}
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
