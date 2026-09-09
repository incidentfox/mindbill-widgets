import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Directive, EventEmitter, inject, Input, Output, type OnChanges, type OnInit, type OnDestroy, type SimpleChanges } from '@angular/core';
import { createBillingOperationsClient, DEFAULT_API_BASE_URL, DEFAULT_SESSION_ENDPOINT, type BillingOperationsClient, type BillLifecycleSessionProvider, type BillRegistryQuery, type BillRegistryResult, type BillTasksResult, type PaymentReviewQuery, type PaymentReviewResult, type ServiceLineItemsReport, type ProductivityReport } from '@mindbill/browser';
import { mindBillAngularAppearanceStyle, type MindBillAngularAppearance } from './appearance';
import { MindBillBillTasksDashboardComponent } from './bill-tasks-dashboard.component';
import { type MindBillBillTasksCell } from './bill-tasks-dashboard';
import { MindBillBillLifecycleComponent } from './bill-lifecycle.component';
import { mindBillTaskQuery, mindBillPaymentDateRange, mindBillPaymentCsv, type MindBillBillingView, type MindBillPaymentRange } from './billing-operations';

const styles = `:host{display:block;min-width:0}.ops{font:14px/1.5 var(--font);color:var(--t);min-width:0}.ops *{box-sizing:border-box}h2,h3,p{margin:0}h2{font-size:22px}h3{font-size:16px}small,.muted{color:var(--m)}small{display:block}.head,.toolbar,.pager,.tabs{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.head,.pager{justify-content:space-between}.head,.toolbar{margin-bottom:16px}.tabs{border-bottom:1px solid var(--b);margin:18px 0;gap:4px}.tabs button{border:0;border-radius:0;border-bottom:3px solid transparent}.tabs button.active{border-color:var(--a);color:var(--a);background:transparent}button,input,select{font:inherit;color:var(--t);background:var(--s);border:1px solid var(--b);border-radius:var(--cr);padding:8px 10px;min-height:38px;max-width:100%}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--a);outline-offset:2px}.primary,button.active{background:var(--a);color:var(--ac)}label{display:grid;gap:4px;font-size:12px}.search{flex:1;min-width:180px}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:16px 0}.metric,.card{border:1px solid var(--b);border-radius:var(--r);background:var(--s)}.metric{padding:16px}.metric strong{display:block;font-size:24px;font-variant-numeric:tabular-nums}.scroll{overflow:auto;max-width:100%}table{width:100%;min-width:700px;border-collapse:collapse;text-align:left}th,td{padding:12px;border-bottom:1px solid var(--b);vertical-align:top}th{color:var(--m);font-size:12px;background:var(--bg)}.money{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.link{border:0;background:none;color:var(--a);padding:0;min-height:30px}.state{padding:32px;text-align:center;color:var(--m)}.error{color:var(--danger)}.pager{padding:12px}.section-title{padding:14px}.stack{display:grid;gap:16px}.badge{border-radius:var(--cr);padding:3px 7px;background:var(--bg);white-space:nowrap}.bar{height:8px;background:var(--b);border-radius:4px;min-width:80px}.bar i{display:block;height:100%;background:var(--a);border-radius:4px}.footnote{margin-top:10px;font-size:12px;color:var(--m)}@media(max-width:600px){.tabs{flex-wrap:nowrap;overflow-x:auto}.tabs button{flex-shrink:0}.toolbar label{flex:1;min-width:130px}.search{min-width:100%}.metric{padding:10px}.metric strong{font-size:20px}}`;

@Directive()
export class MindBillOperationsBase implements OnChanges, OnInit, OnDestroy {
  @Input() sessionEndpoint = DEFAULT_SESSION_ENDPOINT;
  @Input() apiBaseUrl = DEFAULT_API_BASE_URL;
  @Input() getSession?: BillLifecycleSessionProvider;
  @Input() fetch?: typeof globalThis.fetch;
  @Input() appearance: MindBillAngularAppearance = { preset: 'mindbill' };
  @Input() initialQuery: BillRegistryQuery & PaymentReviewQuery = {};
  @Input() initialFrom = '';
  @Input() initialTo = '';
  @Input() view: MindBillBillingView = 'bills';
  @Input() showPostPayment = false;
  @Output() billSelected = new EventEmitter<string>();
  @Output() drillDown = new EventEmitter<BillRegistryQuery>();
  @Output() postPayment = new EventEmitter<void>();
  @Output() billingError = new EventEmitter<Error>();
  private readonly cdr = inject(ChangeDetectorRef);
  private client?: BillingOperationsClient;
  private controller?: AbortController;
  private initialized = false;
  loading = false; error = ''; search = ''; claimsAdminId = ''; renderingProviderId = '';
  query: BillRegistryQuery = { status:'all',age:'all',page:1,pageSize:25,sort:'submitted_desc' };
  paymentQuery: PaymentReviewQuery = { ...mindBillPaymentDateRange('month'),page:1,pageSize:25 };
  range: MindBillPaymentRange | null = 'month';
  from = ''; to = '';
  bills: BillRegistryResult | null = null;
  tasks: BillTasksResult | null = null;
  procedures: ServiceLineItemsReport | null = null;
  productivity: ProductivityReport | null = null;
  payments: PaymentReviewResult | null = null;
  statuses = [['all','All statuses'],['incomplete','Incomplete'],['sent','Sent'],['accepted','Accepted'],['accepted_no_response','Accepted · no response'],['rejected','Rejected'],['processed','Processed'],['paid','Paid'],['closed','Closed']];
  ages = ['all','0-30','31-60','61-90','91+','91-180','181+'];
  ranges: Array<{id:MindBillPaymentRange;label:string}> = [{id:'today',label:'Today'},{id:'week',label:'This week'},{id:'month',label:'This month'},{id:'year',label:'This year'},{id:'all',label:'All dates'}];
  get themeStyle(): Record<string,string> { return mindBillAngularAppearanceStyle(this.appearance); }
  value(event: Event): string { return (event.target as HTMLInputElement).value; }
  money(value: number): string { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value); }
  paymentKey(billId: string, id: string): string { return JSON.stringify([billId,id]); }
  date(value: string | null): string { return value?.slice(0,10) || '—'; }
  percent(clean: number, total: number): string { return total ? `${Math.round(clean/total*100)}%` : '—'; }
  get maxSent(): number { return Math.max(1,...Object.values(this.productivity?.sentTotal ?? {})); }
  get pageResult(): {page:number;pageSize:number;total:number} | null { return this.view === 'payments' ? this.payments : this.bills; }
  get pageCount(): number { return Math.max(1,Math.ceil((this.pageResult?.total ?? 0)/(this.pageResult?.pageSize || 25))); }
  get invalidRange(): boolean { return this.view === 'payments' ? Boolean(this.paymentQuery.receivedFrom && this.paymentQuery.receivedTo && this.paymentQuery.receivedFrom > this.paymentQuery.receivedTo) : Boolean(this.from && this.to && this.from > this.to); }
  ngOnInit(): void { if (!this.initialized) this.ngOnChanges({}); }
  ngOnChanges(changes: SimpleChanges): void {
    const firstLoad = !this.initialized;
    if (!this.initialized || changes['initialQuery']) {
      this.query = {status:'all',age:'all',page:1,pageSize:25,sort:'submitted_desc',...this.initialQuery};
      this.paymentQuery = {...mindBillPaymentDateRange('month'),page:1,pageSize:25,...this.initialQuery};
      this.range = this.initialQuery.receivedFrom || this.initialQuery.receivedTo ? null : 'month';
      this.search = this.initialQuery.q ?? '';
    }
    if (!this.initialized || changes['initialFrom'] || changes['initialTo'] || changes['view']) {
      const now = new Date(); const start = new Date(now); start.setDate(start.getDate()-(this.view === 'productivity' ? 13 : 29));
      this.from = this.initialFrom || start.toISOString().slice(0,10); this.to = this.initialTo || now.toISOString().slice(0,10);
    }
    if (!this.client || changes['sessionEndpoint'] || changes['apiBaseUrl'] || changes['getSession'] || changes['fetch']) this.client = createBillingOperationsClient({sessionEndpoint:this.sessionEndpoint,apiBaseUrl:this.apiBaseUrl,...(this.getSession ? {getSession:this.getSession}:{}),...(this.fetch ? {fetch:this.fetch}:{})});
    this.initialized = true;
    if (changes['view']) this.search = (this.view === 'payments' ? this.paymentQuery.q : this.query.q) ?? '';
    if (firstLoad || Object.keys(changes).some(key => key !== 'appearance' && key !== 'showPostPayment')) void this.load();
  }
  ngOnDestroy(): void { this.controller?.abort(); }
  async load(): Promise<void> {
    this.controller?.abort(); const controller = new AbortController(); this.controller = controller;
    this.error = ''; this.bills = null; this.tasks = null; this.procedures = null; this.productivity = null; this.payments = null;
    if (this.invalidRange && this.view !== 'bills' && this.view !== 'tasks') { this.loading = false; this.cdr.markForCheck(); return; }
    this.loading = true;
    try {
      const client = this.client ??= createBillingOperationsClient({sessionEndpoint:this.sessionEndpoint,apiBaseUrl:this.apiBaseUrl,...(this.getSession ? {getSession:this.getSession}:{}),...(this.fetch ? {fetch:this.fetch}:{})});
      const signal = controller.signal;
      const view = this.view;
      if (view === 'bills') { const result = await client.getBills(this.query,signal); if (!signal.aborted) this.bills = result; }
      if (view === 'tasks') { const result = await client.getBillTasks(this.claimsAdminId || undefined,signal,this.renderingProviderId || undefined); if (!signal.aborted) this.tasks = result; }
      if (view === 'procedures') { const result = await client.getServiceLineItems({from:this.from,to:this.to},signal); if (!signal.aborted) this.procedures = result; }
      if (view === 'productivity') { const result = await client.getProductivity({from:this.from,to:this.to},signal); if (!signal.aborted) this.productivity = result; }
      if (view === 'payments') { const result = await client.getPaymentReview(this.paymentQuery,signal); if (!signal.aborted) this.payments = result; }
    } catch (cause) { if (!controller.signal.aborted) { const error = cause instanceof Error ? cause : new Error('Billing data could not be loaded.'); this.error = error.message; this.billingError.emit(error); } }
    finally { if (!controller.signal.aborted) { this.loading = false; this.cdr.markForCheck(); } }
  }
  update(field: string, value: string): void {
    if (this.view === 'payments') { this.paymentQuery = {...this.paymentQuery,[field]:value,page:1}; if (field.startsWith('received')) this.range = null; }
    else this.query = {...this.query,[field]:value,page:1};
    void this.load();
  }
  submitSearch(event: Event): void { event.preventDefault(); this.update('q',this.search); }
  changePage(offset: number): void { const page = Math.max(1,(this.pageResult?.page ?? 1)+offset); if (this.view === 'payments') this.paymentQuery = {...this.paymentQuery,page}; else this.query = {...this.query,page}; void this.load(); }
  setRange(range: MindBillPaymentRange): void { this.range = range; const next = {...this.paymentQuery}; delete next.receivedFrom; delete next.receivedTo; this.paymentQuery = {...next,...mindBillPaymentDateRange(range),page:1}; void this.load(); }
  taskSelected(cell: MindBillBillTasksCell): void { if (this.loading || this.error) return; this.drillDown.emit({...mindBillTaskQuery(cell),...(this.claimsAdminId ? {claimsAdministrator:this.claimsAdminId}:{}),...(this.renderingProviderId ? {renderingProviderId:this.renderingProviderId}:{})}); }
  exportPage(): void { if (!this.payments?.items.length || this.loading) return; const url = URL.createObjectURL(new Blob([mindBillPaymentCsv(this.payments.items)],{type:'text/csv;charset=utf-8'})); const a = document.createElement('a'); a.href=url; a.download='payment-review-page.csv'; a.click(); URL.revokeObjectURL(url); }
}

@Component({selector:'mindbill-connected-billing-panel',standalone:true,imports:[CommonModule,MindBillBillTasksDashboardComponent],templateUrl:'./connected-billing-panel.html',styles:[styles]})
export class MindBillConnectedBillingPanelComponent extends MindBillOperationsBase {}
@Component({selector:'mindbill-connected-bill-search',standalone:true,imports:[CommonModule,MindBillBillTasksDashboardComponent],templateUrl:'./connected-billing-panel.html',styles:[styles]})
export class MindBillConnectedBillSearchComponent extends MindBillOperationsBase { override view: MindBillBillingView = 'bills'; }
@Component({selector:'mindbill-connected-bill-tasks-dashboard',standalone:true,imports:[CommonModule,MindBillBillTasksDashboardComponent],templateUrl:'./connected-billing-panel.html',styles:[styles]})
export class MindBillConnectedBillTasksDashboardComponent extends MindBillOperationsBase { override view: MindBillBillingView = 'tasks'; }
@Component({selector:'mindbill-connected-service-line-items-report',standalone:true,imports:[CommonModule,MindBillBillTasksDashboardComponent],templateUrl:'./connected-billing-panel.html',styles:[styles]})
export class MindBillConnectedServiceLineItemsReportComponent extends MindBillOperationsBase { override view: MindBillBillingView = 'procedures'; }
@Component({selector:'mindbill-connected-productivity-report',standalone:true,imports:[CommonModule,MindBillBillTasksDashboardComponent],templateUrl:'./connected-billing-panel.html',styles:[styles]})
export class MindBillConnectedProductivityReportComponent extends MindBillOperationsBase { override view: MindBillBillingView = 'productivity'; }
@Component({selector:'mindbill-connected-payment-review',standalone:true,imports:[CommonModule,MindBillBillTasksDashboardComponent],templateUrl:'./connected-billing-panel.html',styles:[styles]})
export class MindBillConnectedPaymentReviewComponent extends MindBillOperationsBase { override view: MindBillBillingView = 'payments'; }

let workspaceCount = 0;

/** Session-authenticated operations workspace; create and payment entry remain host-owned actions. */
@Component({
  selector:'mindbill-connected-billing-workspace',standalone:true,
  imports:[CommonModule,MindBillConnectedBillingPanelComponent,MindBillBillLifecycleComponent],styles:[styles],
  template:`<section class="ops" [ngStyle]="themeStyle" aria-label="Billing workspace">
    @if (selectedBillId) {
      <div class="toolbar"><button type="button" (click)="selectedBillId=null">← Back to {{view === 'tasks' ? 'bill tasks' : view === 'bills' ? 'bills' : view === 'procedures' ? 'procedures' : view === 'payments' ? 'payment review' : 'productivity'}}</button></div>
      <mindbill-bill-lifecycle [billId]="selectedBillId" [sessionEndpoint]="sessionEndpoint" [apiBaseUrl]="apiBaseUrl" [getSession]="getSession" [appearance]="appearance" (billingError)="billingError.emit($event)" />
    } @else {
      <div class="head"><div><h2>Billing</h2><p class="muted">Follow up on open work or find any bill and its current status.</p></div>@if (showCreateBill) {<button type="button" class="primary" (click)="createBill.emit()">+ Add bill</button>}</div>
      <div class="tabs" role="tablist" aria-label="Billing views">@for (tab of tabs; track tab.id) {<button type="button" role="tab" [id]="workspaceId+'-tab-'+tab.id" [attr.aria-controls]="workspaceId+'-panel-'+tab.id" [attr.aria-selected]="view===tab.id" [attr.tabindex]="view===tab.id ? 0 : -1" [class.active]="view===tab.id" (click)="view=tab.id" (keydown)="tabKey($event,tab.id)">{{tab.label}}</button>}</div>
      <div role="tabpanel" [id]="workspaceId+'-panel-'+view" [attr.aria-labelledby]="workspaceId+'-tab-'+view">
        <mindbill-connected-billing-panel [view]="view" [sessionEndpoint]="sessionEndpoint" [apiBaseUrl]="apiBaseUrl" [getSession]="getSession" [fetch]="fetch" [appearance]="appearance" [initialQuery]="billQuery" [showPostPayment]="showPostPayment" (billSelected)="selectBill($event)" (drillDown)="openTasks($event)" (postPayment)="postPayment.emit()" (billingError)="billingError.emit($event)" />
      </div>
    }
  </section>`,
})
export class MindBillConnectedBillingWorkspaceComponent implements OnChanges {
  readonly workspaceId = `mindbill-workspace-${++workspaceCount}`;
  @Input() sessionEndpoint = DEFAULT_SESSION_ENDPOINT;
  @Input() apiBaseUrl = DEFAULT_API_BASE_URL;
  @Input() getSession?: BillLifecycleSessionProvider;
  @Input() fetch?: typeof globalThis.fetch;
  @Input() appearance: MindBillAngularAppearance = {preset:'mindbill'};
  @Input() initialView: MindBillBillingView = 'tasks';
  @Input() showCreateBill = false;
  @Input() showPostPayment = false;
  @Output() createBill = new EventEmitter<void>();
  @Output() postPayment = new EventEmitter<void>();
  @Output() billSelected = new EventEmitter<string>();
  @Output() billingError = new EventEmitter<Error>();
  view: MindBillBillingView = 'tasks';
  selectedBillId: string | null = null;
  billQuery: BillRegistryQuery = {status:'all'};
  tabs: Array<{id:MindBillBillingView;label:string}> = [{id:'tasks',label:'Bill tasks'},{id:'bills',label:'All bills'},{id:'procedures',label:'Procedures'},{id:'productivity',label:'Productivity'},{id:'payments',label:'Payment review'}];
  get themeStyle(): Record<string,string> { return mindBillAngularAppearanceStyle(this.appearance); }
  ngOnChanges(changes: SimpleChanges): void { if (changes['initialView']) this.view = this.initialView; }
  selectBill(id:string): void { this.selectedBillId=id; this.billSelected.emit(id); }
  openTasks(query:BillRegistryQuery): void { this.billQuery=query;this.view='bills'; }
  tabKey(event:KeyboardEvent,current:MindBillBillingView): void {
    const index=this.tabs.findIndex(tab=>tab.id===current); let next=index;
    if (event.key==='ArrowRight') next=(index+1)%this.tabs.length;
    else if (event.key==='ArrowLeft') next=(index+this.tabs.length-1)%this.tabs.length;
    else if (event.key==='Home') next=0;
    else if (event.key==='End') next=this.tabs.length-1;
    else return;
    event.preventDefault();this.view=this.tabs[next]!.id;
    const buttons=(event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');buttons?.[next]?.focus();
  }
}
