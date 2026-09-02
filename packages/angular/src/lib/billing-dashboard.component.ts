import { CommonModule } from "@angular/common";
import { Component, Directive, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { MindBillAngularAppearance } from "./bill-lifecycle.component";

export type MindBillDashboardBill = {
  id: string;
  billNumber?: string | number;
  externalId?: string;
  patientName: string;
  claimNumber?: string;
  payerName?: string;
  state: string;
  submittedAt?: string;
  updatedAt?: string;
  agingDays?: number;
  totalCharge: number;
  totalPaid: number;
  balanceDue: number;
  href?: string;
  workItemLabel?: string;
};

export type MindBillAgingBucketId = "current" | "31-60" | "61-90" | "91+";
export type MindBillAgingBucket = { id: MindBillAgingBucketId; label: string; count: number; balance: number };
export type MindBillDashboardSummary = {
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  openCount: number;
  submittedThisMonth: number;
  closedThisMonth: number;
  bills: MindBillDashboardBill[];
  aging: MindBillAgingBucket[];
};
export type MindBillReportDimension = "status" | "payer" | "aging";
export type MindBillReportRow = { key: string; label: string; billCount: number; totalBilled: number; totalPaid: number; balanceDue: number };

const THEME: Record<string, Record<string, string>> = {
  mindbill: { a: "#238dbd", ac: "#fff", bg: "#f3f8fa", s: "#fff", t: "#203743", m: "#657982", b: "#dbe6ea", r: "14px", cr: "8px", font: "Inter,system-ui,sans-serif" },
  "qme-companion": { a: "#53b5dc", ac: "#173542", bg: "#f2f8fb", s: "#fff", t: "#1d3440", m: "#617783", b: "#d7e5eb", r: "12px", cr: "8px", font: "Inter,system-ui,sans-serif" },
  "orange-bright": { a: "#f4510b", ac: "#fff", bg: "#fffaf6", s: "#fffefd", t: "#090f1f", m: "#626a73", b: "#e7e1da", r: "16px", cr: "10px", font: "Inter,system-ui,sans-serif" },
  "clinical-blue": { a: "#1677ff", ac: "#fff", bg: "#f5f7fa", s: "#fff", t: "#1f2d3d", m: "#66788a", b: "#d9e2ec", r: "8px", cr: "6px", font: "Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" },
};

export function mindBillAgingDays(bill: MindBillDashboardBill, now = new Date()): number {
  if (bill.agingDays != null) return Math.max(0, Math.floor(bill.agingDays));
  const source = bill.submittedAt ?? bill.updatedAt;
  if (!source) return 0;
  const time = new Date(source).getTime();
  return Number.isFinite(time) ? Math.max(0, Math.floor((now.getTime() - time) / 86_400_000)) : 0;
}

export function mindBillAgingBucket(days: number): MindBillAgingBucketId {
  if (days <= 30) return "current";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "91+";
}

export function summarizeMindBillDashboard(bills: MindBillDashboardBill[], now = new Date()): MindBillDashboardSummary {
  const aging: MindBillAgingBucket[] = [
    { id: "current", label: "0–30 days", count: 0, balance: 0 },
    { id: "31-60", label: "31–60 days", count: 0, balance: 0 },
    { id: "61-90", label: "61–90 days", count: 0, balance: 0 },
    { id: "91+", label: "91+ days", count: 0, balance: 0 },
  ];
  for (const bill of bills) {
    const bucket = aging.find((item) => item.id === mindBillAgingBucket(mindBillAgingDays(bill, now)))!;
    bucket.count += 1;
    bucket.balance += bill.balanceDue;
  }
  return {
    totalBilled: bills.reduce((sum, item) => sum + item.totalCharge, 0),
    totalPaid: bills.reduce((sum, item) => sum + item.totalPaid, 0),
    outstanding: bills.reduce((sum, item) => sum + item.balanceDue, 0),
    openCount: bills.filter((item) => !/closed|paid|written.off/i.test(item.state)).length,
    submittedThisMonth: bills.filter((item) => sameMonth(item.submittedAt, now)).length,
    closedThisMonth: bills.filter((item) => /closed|paid|written.off/i.test(item.state) && sameMonth(item.updatedAt ?? item.submittedAt, now)).length,
    bills,
    aging,
  };
}

function sameMonth(value: string | undefined, now: Date): boolean {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
}

export function buildMindBillReportRows(bills: MindBillDashboardBill[], dimension: MindBillReportDimension): MindBillReportRow[] {
  const rows = new Map<string, MindBillReportRow>();
  for (const bill of bills) {
    const key = dimension === "payer" ? bill.payerName || "Unassigned payer" : dimension === "aging" ? mindBillAgingBucket(mindBillAgingDays(bill)) : bill.state;
    const label = key.replace(/_/g, " ").replace(/\b\w/g, (value) => value.toUpperCase());
    const row = rows.get(key) ?? { key, label, billCount: 0, totalBilled: 0, totalPaid: 0, balanceDue: 0 };
    row.billCount += 1; row.totalBilled += bill.totalCharge; row.totalPaid += bill.totalPaid; row.balanceDue += bill.balanceDue;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.balanceDue - a.balanceDue || a.label.localeCompare(b.label));
}

export function buildMindBillReportCsv(rows: MindBillReportRow[]): string {
  const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  return ["Group,Bills,Total billed,Total paid,Balance due", ...rows.map((row) => [row.label, row.billCount, row.totalBilled, row.totalPaid, row.balanceDue].map(quote).join(","))].join("\n");
}

@Directive()
abstract class DashboardBase {
  @Input() appearance: MindBillAngularAppearance = { preset: "mindbill" };
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

const sharedStyles = `
  :host{display:block}.mbd{font-family:var(--font);color:var(--t)}button,input,select{font:inherit}.card{background:var(--s);border:1px solid var(--b);border-radius:var(--r)}
  .money{font-variant-numeric:tabular-nums}.muted{color:var(--m)}.pill{display:inline-flex;border-radius:999px;background:color-mix(in srgb,var(--a) 12%,var(--s));color:var(--a);font-size:12px;font-weight:750;padding:5px 9px}
`;

@Component({
  selector: "mindbill-bill-aging-summary", standalone: true, imports: [CommonModule],
  template: `<section class="mbd aging" [ngStyle]="themeStyle" aria-label="Accounts receivable aging">@for (bucket of buckets; track bucket.id) { <button type="button" class="card" [class.selected]="selectedBucket === bucket.id" (click)="bucketSelected.emit(bucket.id)"><div><strong>{{ bucket.label }}</strong><span>{{ bucket.count }} bill{{ bucket.count === 1 ? '' : 's' }}</span></div><b class="money">{{ bucket.balance | currency }}</b><i><em [style.width.%]="width(bucket.balance)"></em></i></button> }</section>`,
  styles: [sharedStyles, `.aging{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.aging>button{border:1px solid var(--b);padding:16px;text-align:left;color:var(--t);cursor:pointer}.aging>button:hover,.aging>button.selected{border-color:var(--a);background:color-mix(in srgb,var(--a) 6%,var(--s))}.aging button>div{display:flex;justify-content:space-between;gap:8px}.aging span{color:var(--m);font-size:12px}.aging b{display:block;font-size:20px;margin:14px 0 12px}.aging i{display:block;height:5px;border-radius:99px;background:color-mix(in srgb,var(--b) 70%,transparent);overflow:hidden}.aging em{display:block;height:100%;background:var(--a)}@media(max-width:760px){.aging{grid-template-columns:1fr 1fr}}`],
})
export class MindBillBillAgingSummaryComponent extends DashboardBase {
  @Input() buckets: MindBillAgingBucket[] = [];
  @Input() selectedBucket: MindBillAgingBucketId | "" = "";
  @Output() bucketSelected = new EventEmitter<MindBillAgingBucketId>();
  width(balance: number): number { const max = Math.max(1, ...this.buckets.map((item) => item.balance)); return Math.max(balance ? 8 : 0, balance / max * 100); }
}

@Component({
  selector: "mindbill-bill-list", standalone: true, imports: [CommonModule],
  template: `<section class="mbd list card" [ngStyle]="themeStyle"><div class="head"><strong>Bill</strong><strong>Payer</strong><strong>Status</strong><strong>Age</strong><strong>Balance</strong></div>@for (bill of bills; track bill.id) { <button type="button" (click)="billSelected.emit(bill)"><span><b>{{ bill.patientName }}</b><small>{{ bill.claimNumber || bill.workItemLabel || bill.externalId || bill.id }}</small></span><span>{{ bill.payerName || '—' }}</span><span><i class="pill">{{ label(bill.state) }}</i></span><span>{{ age(bill) }} days</span><span class="money"><b>{{ bill.balanceDue | currency }}</b><small>{{ bill.totalPaid | currency }} paid</small></span></button> } @empty { <p class="empty">No bills match these filters.</p> }</section>`,
  styles: [sharedStyles, `.list{overflow:hidden}.head,.list button{display:grid;grid-template-columns:1.6fr 1.2fr .85fr .55fr .8fr;gap:18px;align-items:center;text-align:left}.head{padding:11px 16px;background:color-mix(in srgb,var(--bg) 78%,var(--s));color:var(--m);font-size:11px;letter-spacing:.08em;text-transform:uppercase}.list button{width:100%;border:0;border-top:1px solid var(--b);background:var(--s);color:var(--t);padding:15px 16px;cursor:pointer}.list button:hover{background:color-mix(in srgb,var(--a) 5%,var(--s))}.list span,.list small{min-width:0}.list small{display:block;color:var(--m);margin-top:4px}.money{text-align:right}.empty{padding:24px;text-align:center;color:var(--m)}@media(max-width:760px){.head{display:none}.list button{grid-template-columns:1fr auto;gap:10px}.list button>span:nth-child(2){grid-column:1}.list button>span:nth-child(3){grid-row:1;grid-column:2}.list button>span:nth-child(4){grid-column:1}.money{grid-column:2;grid-row:2/4}}`],
})
export class MindBillBillListComponent extends DashboardBase {
  @Input() bills: MindBillDashboardBill[] = [];
  @Output() billSelected = new EventEmitter<MindBillDashboardBill>();
  age(bill: MindBillDashboardBill): number { return mindBillAgingDays(bill); }
  label(value: string): string { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
}

@Component({
  selector: "mindbill-billing-dashboard", standalone: true, imports: [CommonModule, FormsModule, MindBillBillAgingSummaryComponent, MindBillBillListComponent],
  template: `<section class="mbd dashboard" [ngStyle]="themeStyle"><header><div><p>Billing operations</p><h2>{{ heading }}</h2><span class="muted">{{ description }}</span></div><button type="button" (click)="createBill.emit()">+ New bill</button></header><div class="metrics"><article class="card"><span>Total billed</span><b>{{ summary.totalBilled | currency }}</b></article><article class="card"><span>Outstanding</span><b>{{ summary.outstanding | currency }}</b></article><article class="card"><span>Submitted this month</span><b>{{ summary.submittedThisMonth }}</b></article><article class="card"><span>Closed this month</span><b>{{ summary.closedThisMonth }}</b></article></div><mindbill-bill-aging-summary [buckets]="summary.aging" [selectedBucket]="agingBucket" [appearance]="appearance" (bucketSelected)="toggleAging($event)"/><div class="filters"><input [(ngModel)]="query" placeholder="Search patient, claim, or payer" aria-label="Search bills"><select [(ngModel)]="state"><option value="">All statuses</option>@for (option of states; track option) { <option [value]="option">{{ label(option) }}</option> }</select>@if (agingBucket) { <button type="button" class="clear" (click)="agingBucket=''">{{ agingLabel }} ×</button> }</div><mindbill-bill-list [bills]="filteredBills" [appearance]="appearance" (billSelected)="billSelected.emit($event)"/></section>`,
  styles: [sharedStyles, `.dashboard{display:grid;gap:18px}.dashboard header{display:flex;justify-content:space-between;align-items:end;gap:20px}.dashboard h2{font-size:28px;margin:2px 0 5px}.dashboard header p{margin:0;color:var(--a);font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.dashboard header button{border:0;border-radius:var(--cr);background:var(--a);color:var(--ac);padding:11px 16px;font-weight:750;cursor:pointer}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metrics article{padding:18px}.metrics span{display:block;color:var(--m);font-size:12px}.metrics b{display:block;margin-top:8px;font-size:24px}.filters{display:grid;grid-template-columns:1fr 190px auto;gap:10px}.filters input,.filters select,.filters .clear{border:1px solid var(--b);border-radius:var(--cr);background:var(--s);color:var(--t);padding:11px 13px}.filters .clear{color:var(--a);font-weight:700;cursor:pointer}@media(max-width:760px){.dashboard header{align-items:start}.metrics{grid-template-columns:1fr 1fr}.filters{grid-template-columns:1fr}}`],
})
export class MindBillBillingDashboardComponent extends DashboardBase {
  @Input() bills: MindBillDashboardBill[] = [];
  @Input() heading = "Billing dashboard";
  @Input() description = "Track every submitted bill from payer acceptance through payment.";
  @Output() billSelected = new EventEmitter<MindBillDashboardBill>();
  @Output() createBill = new EventEmitter<void>();
  query = ""; state = ""; agingBucket: MindBillAgingBucketId | "" = "";
  get summary(): MindBillDashboardSummary { return summarizeMindBillDashboard(this.bills); }
  get states(): string[] { return [...new Set(this.bills.map((bill) => bill.state))].sort(); }
  get filteredBills(): MindBillDashboardBill[] { const query = this.query.trim().toLowerCase(); return this.bills.filter((bill) => (!this.state || bill.state === this.state) && (!this.agingBucket || mindBillAgingBucket(mindBillAgingDays(bill)) === this.agingBucket) && (!query || [bill.patientName, bill.claimNumber, bill.payerName, bill.externalId, bill.billNumber].some((value) => String(value ?? "").toLowerCase().includes(query)))); }
  get agingLabel(): string { return this.summary.aging.find((item) => item.id === this.agingBucket)?.label ?? ""; }
  toggleAging(bucket: MindBillAgingBucketId): void { this.agingBucket = this.agingBucket === bucket ? "" : bucket; }
  label(value: string): string { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
}

@Component({
  selector: "mindbill-billing-report", standalone: true, imports: [CommonModule, FormsModule],
  template: `<section class="mbd report card" [ngStyle]="themeStyle"><header><div><h2>{{ heading }}</h2><p>Operational totals grouped for reconciliation and follow-up.</p></div><div><select [(ngModel)]="dimension"><option value="status">Status</option><option value="payer">Payer</option><option value="aging">Aging</option></select><button type="button" (click)="downloadCsv()">Export CSV</button></div></header><div class="thead"><b>Group</b><b>Bills</b><b>Total billed</b><b>Total paid</b><b>Balance due</b></div>@for (row of rows; track row.key) { <div class="row"><strong>{{ row.label }}</strong><span>{{ row.billCount }}</span><span>{{ row.totalBilled | currency }}</span><span>{{ row.totalPaid | currency }}</span><b>{{ row.balanceDue | currency }}</b></div> }</section>`,
  styles: [sharedStyles, `.report{overflow:hidden}.report header{display:flex;justify-content:space-between;align-items:center;padding:18px}.report h2{margin:0;font-size:22px}.report p{margin:4px 0 0;color:var(--m)}.report header div:last-child{display:flex;gap:8px}.report select,.report button{border:1px solid var(--b);border-radius:var(--cr);background:var(--s);color:var(--t);padding:9px 12px}.report button{background:var(--a);border-color:var(--a);color:var(--ac);font-weight:750;cursor:pointer}.thead,.row{display:grid;grid-template-columns:1.5fr .5fr 1fr 1fr 1fr;gap:14px;padding:12px 18px;border-top:1px solid var(--b);align-items:center}.thead{background:color-mix(in srgb,var(--bg) 78%,var(--s));color:var(--m);font-size:11px;text-transform:uppercase}.row span,.row b:not(:first-child){text-align:right;font-variant-numeric:tabular-nums}@media(max-width:700px){.report header{align-items:flex-start}.thead{display:none}.row{grid-template-columns:1fr 1fr}.row>*:nth-child(n+2){text-align:right}.row strong{grid-column:1}.row span:nth-child(2){grid-column:2}.row span:nth-child(3)::before{content:'Billed ';color:var(--m)}.row span:nth-child(4)::before{content:'Paid ';color:var(--m)}.row b::before{content:'Due ';color:var(--m)}}`],
})
export class MindBillBillingReportComponent extends DashboardBase {
  @Input() bills: MindBillDashboardBill[] = [];
  @Input() heading = "Billing report";
  dimension: MindBillReportDimension = "status";
  get rows(): MindBillReportRow[] { return buildMindBillReportRows(this.bills, this.dimension); }
  downloadCsv(): void { const blob = new Blob([buildMindBillReportCsv(this.rows)], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `mindbill-${this.dimension}-report.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
