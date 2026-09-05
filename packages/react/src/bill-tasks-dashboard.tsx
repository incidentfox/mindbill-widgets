"use client";

// "Bill Tasks" dashboard: one theme-aware card with a semantic marker per
// task section (Payment Due, No Response, Denied, …), rows bucketed by age in
// days with accent-tinted bucket headers, per-cell click-through counts, and a
// closing grand-total card. Purely props-driven: hosts aggregate their own
// work items with buildBillTasksDashboard (re-exported from @mindbill/browser)
// so MindBill itself can dogfood the surface without the partner API.

import type { CSSProperties, ReactElement, ReactNode } from "react";
import {
  BILL_TASKS_AGING_BUCKETS,
  type BillTasksAgingBucket,
  type BillTasksDashboardData,
  type BillTasksDashboardRow,
  type BillTasksDashboardSection,
} from "@mindbill/browser";

import { mindBillAppearanceStyle, type MindBillReactAppearance } from "./appearance";

export {
  BILL_TASKS_AGING_BUCKETS,
  billTasksAgingBucketIndex,
  buildBillTasksDashboard,
} from "@mindbill/browser";
export type {
  BillTasksAgingBucket,
  BillTasksDashboardData,
  BillTasksDashboardItem,
  BillTasksDashboardRow,
  BillTasksDashboardSection,
  BillTasksDashboardSectionInput,
  BillTasksDashboardTone,
} from "@mindbill/browser";

type SurfaceProps = {
  appearance?: MindBillReactAppearance;
  className?: string;
  style?: CSSProperties;
};

export type BillTasksDashboardCell = {
  sectionId: string;
  rowId: string;
  /** Null for a row's "Task Total" cell (all buckets). */
  bucketId: string | null;
  refs: string[];
  count: number;
};

export type BillTasksDashboardProps = SurfaceProps & {
  data: BillTasksDashboardData;
  /** Must match the buckets passed to buildBillTasksDashboard. */
  buckets?: BillTasksAgingBucket[];
  heading?: ReactNode;
  grandTotalLabel?: string;
  /** Column heading; use "Bill Total" when displaying bills without tasks. */
  totalLabel?: string;
  /** Plural noun for accessible count labels, for example "bills". */
  itemLabel?: string;
  emptyLabel?: string;
  onSelectCell?: (cell: BillTasksDashboardCell) => void;
  /** Rendered above the sections — hosts pass their own filters. */
  toolbar?: ReactNode;
  footnote?: ReactNode;
};

const css = `
.mbtk{color:var(--mb-text);font-family:var(--mb-font);font-size:14px}.mbtk *{box-sizing:border-box}.mbtk h2,.mbtk p{margin:0}
.mbtk-heading{margin-bottom:14px}.mbtk-heading h2{font-size:24px}
.mbtk-toolbar{margin-bottom:14px}
.mbtk-section{margin-bottom:var(--mbtk-section-gap);border:var(--mbtk-border-width) solid var(--mbtk-border);border-radius:var(--mbtk-radius);background:var(--mb-surface);box-shadow:var(--mb-shadow);overflow:hidden}
.mbtk-grid{display:grid;grid-template-columns:var(--mbtk-cols);gap:0 10px;align-items:center;padding:0 16px}
.mbtk-head{padding:12px 16px;border-bottom:1px solid var(--mb-border)}
.mbtk-title{display:flex;align-items:center;gap:9px;min-width:0}
.mbtk-dot{flex:0 0 auto;width:11px;height:11px;border-radius:50%;background:var(--mbtk-tone,var(--mb-muted))}
.mbtk-title-text{min-width:0}
.mbtk-title-text strong{display:block;font-size:15.5px;line-height:1.3}
.mbtk-basis{display:block;color:var(--mb-muted);font-size:12px;line-height:1.35}
.mbtk-pill{justify-self:stretch;padding:5px 6px;border-radius:var(--mbtk-aging-radius);background:var(--mb-soft);background:var(--mbtk-pill);color:var(--mbtk-aging-text);font-size:11px;font-weight:750;line-height:1.25;text-align:center;white-space:nowrap}
.mbtk-colhead{justify-self:stretch;color:var(--mb-muted);font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;text-align:center;white-space:nowrap}
.mbtk-row{border-top:1px solid color-mix(in srgb,var(--mb-border) 60%,transparent);min-height:var(--mbtk-row-height)}
.mbtk-row:first-of-type{border-top:0}
.mbtk-rowlabel{color:var(--mb-muted);font-size:13px;line-height:1.35;padding:9px 0;overflow-wrap:anywhere}
.mbtk-count{text-align:center;font-variant-numeric:tabular-nums}
.mbtk-zero{color:var(--mb-muted)}
.mbtk-bal{display:block;color:var(--mb-muted);font-size:11px;font-weight:550;line-height:1.35;white-space:nowrap;font-variant-numeric:tabular-nums}
.mbtk-link{border:0;background:none;padding:6px 8px;min-height:44px;min-width:44px;color:var(--mbtk-link);font:inherit;font-weight:750;font-variant-numeric:tabular-nums;cursor:pointer;border-radius:var(--mb-control-radius)}
.mbtk-link:hover{text-decoration:underline;background:color-mix(in srgb,var(--mb-accent) 8%,transparent)}
.mbtk-link:focus-visible{outline:2px solid var(--mbtk-link);outline-offset:2px;text-decoration:underline}
.mbtk-total{text-align:center}
.mbtk-totals{background:var(--mb-soft);border-top:1px solid var(--mb-border);font-weight:760}
.mbtk-totals .mbtk-rowlabel{color:var(--mb-text);font-weight:760}
.mbtk-empty{padding:22px 16px;color:var(--mb-muted);text-align:center}
.mbtk-grand .mbtk-rowlabel{color:var(--mb-text);font-size:14px;font-weight:800}
.mbtk-grand{min-height:52px}
.mbtk-footnote{margin-top:12px;color:var(--mb-muted);font-size:12.5px}
@media(max-width:760px){.mbtk-pill,.mbtk-colhead,.mbtk-count{display:none}.mbtk-grid{grid-template-columns:minmax(0,1fr) auto}}
`;

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function cellBody(count: number, balance: number | undefined): ReactNode {
  return <><span>{count}</span>{count > 0 && balance !== undefined && Number.isFinite(balance)
    ? <span className="mbtk-bal">{USD.format(balance)}</span> : null}</>;
}

function cellButton(
  key: string,
  count: number,
  className: string,
  label: string,
  onSelect: (() => void) | null,
  balance: number | undefined,
): ReactElement {
  const ariaLabel = count > 0 && balance !== undefined && Number.isFinite(balance)
    ? `${label} · ${USD.format(balance)} due` : label;
  if (count > 0 && onSelect) {
    return (
      <span key={key} className={className}>
        <button type="button" className="mbtk-link" aria-label={ariaLabel} onClick={onSelect}>{cellBody(count, balance)}</button>
      </span>
    );
  }
  return <span key={key} className={`${className}${count === 0 ? " mbtk-zero" : ""}`}>{cellBody(count, balance)}</span>;
}

function TaskRow({
  sectionId,
  row,
  buckets,
  onSelectCell,
  itemLabel,
}: {
  sectionId: string;
  row: BillTasksDashboardRow;
  buckets: BillTasksAgingBucket[];
  onSelectCell?: ((cell: BillTasksDashboardCell) => void) | undefined;
  itemLabel: string;
}): ReactElement {
  const allRefs = row.refs.flat();
  return (
    <div className="mbtk-grid mbtk-row">
      <span className="mbtk-rowlabel">{row.label}</span>
      {buckets.map((bucket, index) => {
        const count = row.counts[index] ?? 0;
        return cellButton(
          bucket.id,
          count,
          "mbtk-count",
          `${row.label} · ${bucket.label}: ${count} ${itemLabel}`,
          onSelectCell
            ? () => onSelectCell({ sectionId, rowId: row.id, bucketId: bucket.id, refs: row.refs[index] ?? [], count })
            : null,
          row.balances?.[index],
        );
      })}
      {cellButton(
        "task-total",
        row.total,
        "mbtk-total",
        `${row.label} · all ages: ${row.total} ${itemLabel}`,
        onSelectCell
          ? () => onSelectCell({ sectionId, rowId: row.id, bucketId: null, refs: allRefs, count: row.total })
          : null,
        row.balanceTotal,
      )}
    </div>
  );
}

function SectionCard({
  section,
  buckets,
  emptyLabel,
  onSelectCell,
  totalLabel,
  itemLabel,
}: {
  section: BillTasksDashboardSection;
  buckets: BillTasksAgingBucket[];
  emptyLabel: ReactNode;
  onSelectCell?: ((cell: BillTasksDashboardCell) => void) | undefined;
  totalLabel: string;
  itemLabel: string;
}): ReactElement {
  return (
    <section
      className="mbtk-section"
      style={{ "--mbtk-tone": `var(--mbtk-${section.tone})` } as CSSProperties}
      aria-label={section.label}
    >
      <div className="mbtk-grid mbtk-head">
        <span className="mbtk-title">
          <i className="mbtk-dot" aria-hidden="true" />
          <span className="mbtk-title-text">
            <strong>{section.label}</strong>
            <span className="mbtk-basis">by {section.agingBasisLabel}</span>
          </span>
        </span>
        {buckets.map((bucket, index) => (
          <span
            key={bucket.id}
            className="mbtk-pill"
            style={{ "--mbtk-pill": `var(--mbtk-aging-${Math.min(index + 1, 5)})` } as CSSProperties}
          >
            {bucket.label}
          </span>
        ))}
        <span className="mbtk-colhead">{totalLabel}</span>
      </div>
      {section.empty ? (
        <p className="mbtk-empty">{emptyLabel}</p>
      ) : (
        <>
          {section.rows.map((row) => (
            <TaskRow key={row.id} sectionId={section.id} row={row} buckets={buckets} onSelectCell={onSelectCell} itemLabel={itemLabel} />
          ))}
          <div className="mbtk-grid mbtk-row mbtk-totals">
            <span className="mbtk-rowlabel">Total</span>
            {buckets.map((bucket, index) => (
              <span key={bucket.id} className="mbtk-count">{cellBody(section.totals[index] ?? 0, section.balanceTotals?.[index])}</span>
            ))}
            <span className="mbtk-total">{cellBody(section.total, section.balanceTotal)}</span>
          </div>
        </>
      )}
    </section>
  );
}

export function BillTasksDashboard({
  data,
  buckets = BILL_TASKS_AGING_BUCKETS,
  heading,
  grandTotalLabel = "Bill Tasks Total",
  totalLabel = "Task Total",
  itemLabel = "tasks",
  emptyLabel = "No Tasks",
  onSelectCell,
  toolbar,
  footnote,
  appearance,
  className = "",
  style,
}: BillTasksDashboardProps): ReactElement {
  const columns = `minmax(150px,1.6fr) repeat(${buckets.length},minmax(84px,1fr)) minmax(84px,1fr)`;
  return (
    <div
      className={`mbtk ${className}`.trim()}
      style={{ ...mindBillAppearanceStyle(appearance), "--mbtk-cols": columns, ...style } as CSSProperties}
    >
      <style>{css}</style>
      {heading ? <div className="mbtk-heading">{typeof heading === "string" ? <h2>{heading}</h2> : heading}</div> : null}
      {toolbar ? <div className="mbtk-toolbar">{toolbar}</div> : null}
      {data.sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          buckets={buckets}
          emptyLabel={emptyLabel}
          onSelectCell={onSelectCell}
          totalLabel={totalLabel}
          itemLabel={itemLabel}
        />
      ))}
      <section className="mbtk-section is-grand" aria-label={grandTotalLabel}>
        <div className="mbtk-grid mbtk-row mbtk-grand mbtk-totals">
          <span className="mbtk-rowlabel">{grandTotalLabel}</span>
          {buckets.map((bucket, index) => (
            <span key={bucket.id} className="mbtk-count">{cellBody(data.grandTotals[index] ?? 0, data.grandBalanceTotals?.[index])}</span>
          ))}
          <span className="mbtk-total">{cellBody(data.grandTotal, data.grandBalanceTotal)}</span>
        </div>
      </section>
      {footnote ? <p className="mbtk-footnote">{footnote}</p> : null}
    </div>
  );
}
