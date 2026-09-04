import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import {
  BILL_TASKS_AGING_BUCKETS,
  type BillTasksAgingBucket,
  type BillTasksDashboardData,
  type BillTasksDashboardRow,
  type BillTasksDashboardSection,
} from "@mindbill/browser";
import { mindBillAngularAppearanceStyle, type MindBillAngularAppearance } from "./appearance";
import {
  mindBillBillTasksCell,
  mindBillBillTasksPillBase,
  mindBillBillTasksTone,
  type MindBillBillTasksCell,
} from "./bill-tasks-dashboard";

// "Bill Tasks" dashboard: one rounded, tone-colored card per
// task section, rows bucketed by age in days with colored bucket header pills,
// per-cell click-through counts, and a closing grand-total card. The pure
// aggregation lives in @mindbill/browser (buildBillTasksDashboard) so React
// and Angular render the exact same data shape.

@Component({
  selector: "mindbill-bill-tasks-dashboard",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mbtk" [ngStyle]="themeStyle">
      @if (heading) { <header class="heading"><h2>{{ heading }}</h2></header> }
      @for (section of data?.sections ?? []; track section.id) {
        <section class="card" [style.borderColor]="tone(section)" [attr.aria-label]="section.label">
          <div class="grid head" [style.borderBottomColor]="tone(section)">
            <span class="title">
              <i class="dot" [style.background]="tone(section)"></i>
              <span class="title-text"><strong>{{ section.label }}</strong><span class="basis">by {{ section.agingBasisLabel }}</span></span>
            </span>
            @for (bucket of buckets; track bucket.id; let bucketIndex = $index) {
              <span class="pill" [style.background]="pillBackground(bucketIndex)" [style.color]="pillColor(bucketIndex)">{{ bucket.label }}</span>
            }
            <span class="colhead">Task Total</span>
          </div>
          @if (section.empty) {
            <p class="empty">{{ emptyLabel }}</p>
          } @else {
            @for (row of section.rows; track row.id) {
              <div class="grid row">
                <span class="rowlabel">{{ row.label }}</span>
                @for (bucket of buckets; track bucket.id; let bucketIndex = $index) {
                  <span class="count">
                    @if ((row.counts[bucketIndex] ?? 0) > 0) {
                      <button type="button" class="link" (click)="select(section, row, bucketIndex)">{{ row.counts[bucketIndex] }}</button>
                    } @else { <span class="zero">0</span> }
                  </span>
                }
                <span class="total">
                  @if (row.total > 0) {
                    <button type="button" class="link" (click)="select(section, row, null)">{{ row.total }}</button>
                  } @else { <span class="zero">0</span> }
                </span>
              </div>
            }
            <div class="grid row totals">
              <span class="rowlabel">Total</span>
              @for (bucket of buckets; track bucket.id; let bucketIndex = $index) {
                <span class="count">{{ section.totals[bucketIndex] ?? 0 }}</span>
              }
              <span class="total">{{ section.total }}</span>
            </div>
          }
        </section>
      }
      <section class="card grand" [attr.aria-label]="grandTotalLabel">
        <div class="grid row totals">
          <span class="rowlabel grand-label">{{ grandTotalLabel }}</span>
          @for (bucket of buckets; track bucket.id; let bucketIndex = $index) {
            <span class="count">{{ data?.grandTotals?.[bucketIndex] ?? 0 }}</span>
          }
          <span class="total">{{ data?.grandTotal ?? 0 }}</span>
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host{display:block}
    .mbtk{color:var(--t);font-family:var(--font);font-size:14px}
    .heading{margin-bottom:14px}.heading h2{margin:0;font-size:24px}
    .card{margin-bottom:16px;border:1.5px solid var(--b);border-radius:var(--r);background:var(--s);overflow:hidden}
    .grid{display:grid;grid-template-columns:var(--cols);gap:0 10px;align-items:center;padding:0 16px}
    .head{padding:12px 16px;border-bottom:1px solid var(--b)}
    .title{display:flex;align-items:center;gap:9px;min-width:0}
    .dot{flex:0 0 auto;width:11px;height:11px;border-radius:50%}
    .title-text{min-width:0}
    .title-text strong{display:block;font-size:15.5px;line-height:1.3}
    .basis{display:block;color:var(--m);font-size:12px;line-height:1.35}
    .pill{justify-self:stretch;padding:5px 6px;border-radius:999px;font-size:11px;font-weight:750;line-height:1.25;text-align:center;white-space:nowrap}
    .colhead{justify-self:stretch;color:var(--m);font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;text-align:center;white-space:nowrap}
    .row{border-top:1px solid color-mix(in srgb,var(--b) 60%,transparent);min-height:44px}
    .row:first-of-type{border-top:0}
    .rowlabel{color:var(--m);font-size:13px;line-height:1.35;padding:9px 0;overflow-wrap:anywhere}
    .count,.total{text-align:center;font-variant-numeric:tabular-nums}
    .zero{color:var(--m)}
    .link{border:0;background:none;padding:6px 8px;color:var(--a);font:inherit;font-weight:750;font-variant-numeric:tabular-nums;cursor:pointer;border-radius:6px}
    .link:hover{text-decoration:underline;background:color-mix(in srgb,var(--a) 8%,transparent)}
    .totals{background:color-mix(in srgb,var(--bg) 78%,var(--s));border-top:1px solid var(--b);font-weight:760}
    .totals .rowlabel{color:var(--t);font-weight:760}
    .empty{margin:0;padding:22px 16px;color:var(--m);text-align:center}
    .grand{border-color:var(--b)}
    .grand .row{min-height:52px}
    .grand-label{font-size:14px;font-weight:800}
    @media(max-width:760px){.pill,.colhead,.count{display:none}.grid{grid-template-columns:minmax(0,1fr) auto}}
  `],
})
export class MindBillBillTasksDashboardComponent {
  @Input() data: BillTasksDashboardData | null = null;
  @Input() buckets: BillTasksAgingBucket[] = BILL_TASKS_AGING_BUCKETS;
  @Input() heading = "";
  @Input() grandTotalLabel = "Bill Tasks Total";
  @Input() emptyLabel = "No Tasks";
  @Input() appearance: MindBillAngularAppearance = { preset: "mindbill" };
  @Output() cellSelected = new EventEmitter<MindBillBillTasksCell>();

  get themeStyle(): Record<string, string> {
    return {
      ...mindBillAngularAppearanceStyle(this.appearance),
      "--cols": `minmax(150px,1.6fr) repeat(${this.buckets.length},minmax(84px,1fr)) minmax(84px,1fr)`,
    };
  }

  tone(section: BillTasksDashboardSection): string {
    return mindBillBillTasksTone(section.tone);
  }

  pillBackground(index: number): string {
    return `color-mix(in srgb,${mindBillBillTasksPillBase(index)} 20%,var(--s))`;
  }

  pillColor(index: number): string {
    return `color-mix(in srgb,${mindBillBillTasksPillBase(index)} 62%,var(--t))`;
  }

  select(section: BillTasksDashboardSection, row: BillTasksDashboardRow, bucketIndex: number | null): void {
    this.cellSelected.emit(mindBillBillTasksCell(section, row, bucketIndex, this.buckets));
  }
}
