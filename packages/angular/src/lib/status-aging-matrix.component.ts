import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import type { MindBillAngularAppearance } from "./bill-lifecycle.component";
import type { MindBillDashboardBill } from "./billing-dashboard.component";
import {
  buildMindBillStatusAgingMatrix,
  MINDBILL_STATUS_AGING_BUCKETS,
  type MindBillStatusAgingCell,
  type MindBillStatusAgingMatrix,
} from "./status-aging-matrix";

const THEME: Record<string, Record<string, string>> = {
  mindbill: { a: "#238dbd", ac: "#fff", bg: "#f3f8fa", s: "#fff", t: "#203743", m: "#657982", b: "#dbe6ea", r: "14px", cr: "8px", font: "Inter,system-ui,sans-serif" },
  "qme-companion": { a: "#53b5dc", ac: "#173542", bg: "#f2f8fb", s: "#fff", t: "#1d3440", m: "#617783", b: "#d7e5eb", r: "12px", cr: "8px", font: "Inter,system-ui,sans-serif" },
  "orange-bright": { a: "#f4510b", ac: "#fff", bg: "#fffaf6", s: "#fffefd", t: "#090f1f", m: "#626a73", b: "#e7e1da", r: "16px", cr: "10px", font: "Inter,system-ui,sans-serif" },
  "clinical-blue": { a: "#1677ff", ac: "#fff", bg: "#f5f7fa", s: "#fff", t: "#1f2d3d", m: "#66788a", b: "#d9e2ec", r: "8px", cr: "6px", font: "Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" },
};

@Component({
  selector: "mindbill-status-aging-matrix",
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="mbmx" [ngStyle]="themeStyle" aria-label="Bills by status and age">
      <header><h2>{{ heading }}</h2><p>{{ description }}</p></header>
      <div class="card">
        <table>
          <thead>
            <tr><th class="status">Status</th>@for (bucket of buckets; track bucket.id) { <th>{{ bucket.label }}</th> }<th>Total</th></tr>
          </thead>
          <tbody>
            @for (row of matrix.rows; track row.state) {
              <tr>
                <td class="status"><i class="pill">{{ row.label }}</i></td>
                @for (cell of row.cells; track cell.bucket) {
                  <td><button type="button" [disabled]="cell.count === 0" (click)="cellSelected.emit(cell)"><b [class.zero]="cell.count === 0">{{ cell.count === 0 ? '—' : cell.count }}</b>@if (showBalances && cell.count > 0) { <small>{{ cell.balance | currency }}</small> }</button></td>
                }
                <td class="rowtotal"><button type="button" [disabled]="row.total.count === 0" (click)="cellSelected.emit(row.total)"><b>{{ row.total.count }}</b>@if (showBalances) { <small>{{ row.total.balance | currency }}</small> }</button></td>
              </tr>
            }
            <tr class="totals">
              <td class="status">Total</td>
              @for (cell of matrix.columnTotals; track cell.bucket) {
                <td><button type="button" [disabled]="cell.count === 0" (click)="cellSelected.emit(cell)"><b [class.zero]="cell.count === 0">{{ cell.count === 0 ? '—' : cell.count }}</b>@if (showBalances && cell.count > 0) { <small>{{ cell.balance | currency }}</small> }</button></td>
              }
              <td class="rowtotal"><button type="button" [disabled]="matrix.grandTotal.count === 0" (click)="cellSelected.emit(matrix.grandTotal)"><b>{{ matrix.grandTotal.count }}</b>@if (showBalances) { <small>{{ matrix.grandTotal.balance | currency }}</small> }</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [`
    :host{display:block}
    .mbmx{font-family:var(--font);color:var(--t)}
    .mbmx header{margin-bottom:16px}.mbmx h2{margin:0;font-size:24px}.mbmx header p{margin:5px 0 0;color:var(--m)}
    .card{background:var(--s);border:1px solid var(--b);border-radius:var(--r);overflow:auto}
    table{width:100%;border-collapse:collapse;min-width:640px}
    th{padding:13px 16px;border-bottom:1px solid var(--b);color:var(--m);font-size:11px;letter-spacing:.06em;text-transform:uppercase;text-align:right;white-space:nowrap}
    th.status{text-align:left}
    td{padding:0;border-bottom:1px solid var(--b);border-left:1px solid color-mix(in srgb,var(--b) 55%,transparent);text-align:right}
    td.status{border-left:0;padding:14px 16px;text-align:left;white-space:nowrap}
    tr:last-child td{border-bottom:0}
    .pill{display:inline-flex;border-radius:999px;background:color-mix(in srgb,var(--a) 12%,var(--s));color:var(--a);font-size:12px;font-style:normal;font-weight:750;padding:5px 9px}
    td button{display:block;width:100%;min-height:56px;padding:9px 16px;border:0;background:none;color:var(--t);font:inherit;text-align:right;cursor:pointer}
    td button:disabled{cursor:default}
    td button:not(:disabled):hover{background:color-mix(in srgb,var(--a) 8%,var(--s))}
    td button b{display:block;font-size:17px;font-weight:760;font-variant-numeric:tabular-nums}
    td button b.zero{color:var(--m);font-weight:500}
    td button small{display:block;margin-top:2px;color:var(--m);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
    td.rowtotal,tr.totals td{background:color-mix(in srgb,var(--bg) 78%,var(--s));font-weight:750}
    tr.totals td.status{color:var(--t);font-weight:750}
  `],
})
export class MindBillStatusAgingMatrixComponent {
  @Input() bills: MindBillDashboardBill[] = [];
  @Input() heading = "Bills by status and age";
  @Input() description = "Every bill grouped by lifecycle status, then by days outstanding.";
  @Input() stateOrder?: string[];
  @Input() showBalances = true;
  @Input() appearance: MindBillAngularAppearance = { preset: "mindbill" };
  @Output() cellSelected = new EventEmitter<MindBillStatusAgingCell>();

  readonly buckets = MINDBILL_STATUS_AGING_BUCKETS;

  get matrix(): MindBillStatusAgingMatrix {
    return buildMindBillStatusAgingMatrix(this.bills, this.stateOrder);
  }

  get themeStyle(): Record<string, string> {
    const base = THEME[this.appearance.preset ?? "mindbill"] ?? THEME["mindbill"]!;
    return {
      "--a": this.appearance.accentColor ?? base["a"]!, "--ac": this.appearance.accentTextColor ?? base["ac"]!,
      "--bg": this.appearance.backgroundColor ?? base["bg"]!, "--s": this.appearance.surfaceColor ?? base["s"]!,
      "--t": this.appearance.textColor ?? base["t"]!, "--m": this.appearance.mutedColor ?? base["m"]!,
      "--b": this.appearance.borderColor ?? base["b"]!, "--r": this.appearance.borderRadius ?? base["r"]!,
      "--cr": this.appearance.controlRadius ?? base["cr"]!, "--font": this.appearance.fontFamily ?? base["font"]!,
    };
  }
}
