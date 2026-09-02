import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, effect } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { BillLifecycleData, BillLifecycleSessionProvider } from "@mindbill/browser";
import type { MindBillAngularAppearance } from "./appearance";
import { mindBillAngularAppearanceStyle } from "./appearance";
import { MindBillBillRejectionNoticeComponent } from "./bill-rejection-notice.component";
import { MindBillLifecycleStore } from "./lifecycle-store";

export type { MindBillAngularAppearance, MindBillAngularThemePreset } from "./appearance";

@Component({
  selector: "mindbill-bill-lifecycle",
  standalone: true,
  imports: [CommonModule, FormsModule, MindBillBillRejectionNoticeComponent],
  template: `
    <section class="mb" [ngStyle]="themeStyle">
      @if (!billId) {
        <div class="state error"><strong>A submitted bill ID is required.</strong></div>
      } @else if (store.loading() && !store.data()) {
        <div class="state">Loading billing…</div>
      } @else if (store.error() && !store.data()) {
        <div class="state error"><strong>Billing is temporarily unavailable</strong><span>{{ store.error()?.message }}</span><button type="button" (click)="store.refresh()">Try again</button></div>
      } @else if (store.data(); as data) {
        <header class="summary">
          <div><span class="eyebrow">Bill {{ data.bill.billNumber }}</span><h2>{{ stateLabel(data) }}</h2><p>{{ lifecycleDetail(data) }}</p></div>
          <div class="money"><span>{{ data.bill.balanceDue | currency }}</span><small>balance</small></div>
        </header>

        @if (data.lifecycle.state.toLowerCase() === 'rejected' && data.rejection) {
          <mindbill-bill-rejection-notice
            class="rejection"
            [rejection]="data.rejection"
            [submittedAt]="data.lifecycle.submittedAt ?? null"
            [appearance]="appearance"
          />
        } @else {
          <section class="card progress" aria-label="Bill lifecycle">
            <ol>@for (stage of lifecycleStages; track stage.id; let i=$index) { <li [class.complete]="i < currentStageIndex(data)" [class.current]="i === currentStageIndex(data)"><b>{{ i < currentStageIndex(data) ? '✓' : i + 1 }}</b><span>{{ stage.label }}</span></li> }</ol>
          </section>
        }

        <section class="card snapshot" aria-label="Bill snapshot">
          <div class="card-title"><div><h3>Bill snapshot</h3><p>The immutable values submitted to the payer.</p></div></div>
          <dl><div><dt>Patient</dt><dd>{{ data.patient.name }}</dd></div><div><dt>Claim</dt><dd>{{ data.injury.claimNumber || '—' }}</dd></div><div><dt>Payer</dt><dd>{{ data.delivery.payerName || data.injury.claimsAdminName || '—' }}</dd></div><div><dt>Date of service</dt><dd>{{ data.bill.dos || '—' }}</dd></div><div><dt>Charged</dt><dd>{{ data.bill.totalCharge | currency }}</dd></div><div><dt>Balance</dt><dd>{{ data.bill.balanceDue | currency }}</dd></div></dl>
        </section>

        <div class="columns">
          <section class="card"><div class="card-title"><div><h3>Remittance</h3><p>Amounts reported by the payer and posted to this bill.</p></div></div><dl><div><dt>Billed</dt><dd>{{ data.remittance.billedAmount | currency }}</dd></div><div><dt>Payer reported</dt><dd>{{ data.remittance.payerReportedPaid == null ? '—' : (data.remittance.payerReportedPaid | currency) }}</dd></div><div><dt>Principal posted</dt><dd>{{ data.remittance.postedPrincipal | currency }}</dd></div><div><dt>Penalty &amp; interest</dt><dd>{{ data.remittance.postedAdditional | currency }}</dd></div><div><dt>Total received</dt><dd>{{ data.remittance.totalPostedCash | currency }}</dd></div><div><dt>Balance</dt><dd>{{ data.remittance.balanceDue | currency }}</dd></div></dl></section>
          <section class="card"><div class="card-title"><div><h3>{{ data.delivery.payerName || 'Payer' }}</h3><p>Billing and follow-up contacts.</p></div></div><p class="muted">{{ payerContact(data) }}</p></section>
        </div>

        <section class="card"><div class="card-title"><div><h3>Documents</h3><p>Documents preserved with the submitted bill.</p></div><span>{{ data.bill.attachments.length }}</span></div>@if (data.bill.attachments.length) { <ul class="rows">@for (doc of data.bill.attachments; track doc.id) { <li><div><strong>{{ doc.filename }}</strong><small>{{ doc.description || doc.documentType }}</small></div><button type="button" (click)="openAttachment(doc.id, doc.filename)">View</button></li> }</ul> } @else { <p class="muted">No documents available.</p> }</section>

        <section class="card"><div class="card-title"><div><h3>Payments</h3><p>Payments posted to this bill.</p></div><span>{{ data.payments.length }}</span></div>@if (data.payments.length) { <ul class="rows">@for (payment of data.payments; track payment.id) { <li><div><strong>{{ payment.amount | currency }}</strong><small>{{ payment.method | uppercase }} · {{ payment.depositDate || payment.postedAt }}</small></div></li> }</ul> } @else { <p class="muted">No payments posted.</p> }</section>

        <section class="card"><div class="card-title"><div><h3>Bill history</h3><p>Submissions, payer responses, follow-up, and payments.</p></div><span>{{ data.history?.length ?? data.activity.length }}</span></div>
          @if (data.history?.length) {
            <!-- daisyBill-style Date/Action/User/Details table: submissions are pale-blue
                 expandable rows (documents + compliance due dates), notes pale-yellow,
                 277 responses expand into decoded status-code sentences. Rows arrive
                 pre-worded from the MindBill API (BillLifecycleData.history). -->
            <div class="history">
              <div class="history-head" aria-hidden="true"><span>Date</span><span>Action</span><span>User</span><span>Details</span></div>
              <ul class="history-rows">
                @for (entry of data.history; track entry.id) {
                  <li [class.is-submission]="entry.tone === 'submission'" [class.is-note]="entry.tone === 'note'" [class.is-problem]="entry.tone === 'problem'">
                    <button type="button" class="history-line" [disabled]="!entry.details" [attr.aria-expanded]="entry.details ? isHistoryOpen(entry.id) : null" (click)="toggleHistory(entry.id)">
                      <span class="h-date">{{ historyDate(entry.date) }}</span>
                      <span class="h-action">{{ entry.action }}</span>
                      <span class="h-actor">{{ entry.actor || '—' }}</span>
                      <span class="h-summary">@if (entry.details) { <i [class.open]="isHistoryOpen(entry.id)" aria-hidden="true"></i> }{{ entry.summary }}</span>
                    </button>
                    @if (entry.details; as details) {
                      @if (isHistoryOpen(entry.id)) {
                        <div class="history-details">
                          @if (details.rows?.length) { <dl class="h-kv">@for (row of details.rows ?? []; track row.label) { <div><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div> }</dl> }
                          @if (details.documents?.length) { <dl class="h-kv"><div><dt>Documents</dt><dd>@for (doc of details.documents ?? []; track doc.id) { <span class="h-doc">{{ doc.filename }}</span> }</dd></div></dl> }
                          @if (details.codes?.length) { <dl class="h-codes">@for (code of details.codes ?? []; track code.code) { <div><dt>{{ code.code }}</dt><dd>{{ code.text }}</dd></div> }</dl> }
                          @if (details.complianceDueDates?.length) { <div class="h-due"><em>Compliance Due Dates</em><dl>@for (due of details.complianceDueDates ?? []; track due.text) { <div><dt>{{ historyDate(due.date) }}</dt><dd>{{ due.text }}</dd></div> }</dl></div> }
                          @if (details.text) { <p class="h-text">{{ details.text }}</p> }
                        </div>
                      }
                    }
                  </li>
                }
              </ul>
            </div>
          } @else {
            <ul class="timeline">@for (event of data.activity; track event.id) { <li><i></i><div><strong>{{ activityLabel(event.type) }}</strong><p>{{ event.description }}</p><small>{{ event.createdAt | date:'medium' }}</small></div></li> }</ul>
          }
        </section>

        @if (notice) { <p class="notice">{{ notice }}</p> }
        <div class="actions">@for (action of data.lifecycle.actions; track action.id) { @if (action.id !== 'view_eor' || data.eors.length) { <button type="button" [class.primary]="action.primary" [disabled]="!action.enabled || store.mutating()" (click)="beginAction(action.id, data)">{{ action.label }}</button> } }</div>

        @if (panel === 'payment') { <form class="card action-form" (submit)="$event.preventDefault(); postPayment()"><h3>Post payment</h3><label>Amount<input required type="number" min="0.01" step="0.01" [(ngModel)]="payment.amount" name="amount"></label><label>Method<select [(ngModel)]="payment.method" name="method"><option value="check">Check</option><option value="eft">EFT</option></select></label><label>Deposit date<input required type="date" [(ngModel)]="payment.depositDate" name="depositDate"></label><div><button type="button" (click)="panel=''">Cancel</button><button class="primary" type="submit">Post payment</button></div></form> }
        @if (panel === 'review') { <form class="card action-form" (submit)="$event.preventDefault(); submitReview()"><h3>Submit Second Bill Review</h3><label>Reason<textarea required [(ngModel)]="review.reason" name="reason"></textarea></label><label>Payer claim control number<input required [(ngModel)]="review.payerClaimControlNumber" name="control"></label><label>Disputed amount<input type="number" min="0" step="0.01" [(ngModel)]="review.disputedAmount" name="disputed"></label><div><button type="button" (click)="panel=''">Cancel</button><button class="primary" type="submit">Submit review</button></div></form> }
        @if (panel === 'close') { <form class="card action-form" (submit)="$event.preventDefault(); closeBill()"><h3>Close bill</h3><label>Reason<textarea required [(ngModel)]="closeReason" name="closeReason"></textarea></label><div><button type="button" (click)="panel=''">Cancel</button><button class="primary" type="submit">Close bill</button></div></form> }
      }
    </section>
  `,
  styles: [`
    :host{display:block}.mb{font-family:var(--font);color:var(--t);background:var(--bg);padding:20px}.summary,.card,.columns,.rejection{display:block;max-width:1120px;margin:0 auto 16px}.summary{display:flex;justify-content:space-between;align-items:end}.summary h2{margin:4px 0}.summary p,.muted{color:var(--m)}.eyebrow,dt{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--m)}.money{text-align:right}.money span{display:block;font-size:28px;font-weight:800}.money small{color:var(--m)}.card{background:var(--s);border:1px solid var(--b);border-radius:var(--r);padding:20px}.card-title{display:flex;justify-content:space-between;gap:20px}.card-title h3{margin:0}.card-title p{margin:5px 0;color:var(--m)}.progress ol{display:flex;list-style:none;padding:0;margin:0}.progress li{flex:1;text-align:center;position:relative;color:var(--m)}.progress li:before{content:"";position:absolute;top:16px;left:0;right:0;border-top:2px solid var(--b)}.progress li:first-child:before{left:50%}.progress li:last-child:before{right:50%}.progress b{position:relative;z-index:1;display:grid;place-items:center;width:32px;height:32px;margin:auto;border:2px solid var(--b);border-radius:50%;background:var(--s)}.progress .complete b,.progress .current b{border-color:var(--a);background:var(--a);color:var(--ac)}.progress span{display:block;margin-top:8px;font-size:12px;font-weight:700}.snapshot dl,.columns dl{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.snapshot dd,.columns dd{font-weight:700;margin:6px 0}.columns{display:grid;grid-template-columns:1fr 1fr;gap:16px}.columns .card{margin:0}.rows,.timeline{list-style:none;margin:12px 0 0;padding:0}.rows li{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:1px solid var(--b)}.rows small{display:block;color:var(--m);margin-top:3px}.timeline li{display:flex;gap:14px;padding:10px 0}.timeline i{width:10px;height:10px;margin-top:5px;border:3px solid var(--a);border-radius:50%}.timeline p{margin:4px 0}.timeline small{color:var(--m)}button,input,select,textarea{font:inherit;border:1px solid var(--b);border-radius:var(--cr);padding:9px 12px;background:var(--s);color:var(--t)}button{cursor:pointer;font-weight:700}.primary{background:var(--a);border-color:var(--a);color:var(--ac)}.actions{max-width:1120px;margin:0 auto;display:flex;justify-content:flex-end;gap:10px}.action-form{display:grid;gap:12px}.action-form label{display:grid;gap:5px;font-weight:700}.action-form div{display:flex;justify-content:flex-end;gap:10px}.state{max-width:720px;margin:auto;padding:32px;text-align:center}.state span{display:block;margin:8px}.error{color:#9b1c1c}.notice{max-width:1120px;margin:0 auto 12px;color:var(--m)}@media(max-width:760px){.mb{padding:12px}.summary,.columns{display:block}.money{text-align:left;margin-top:12px}.columns .card{margin-bottom:12px}.snapshot dl,.columns dl{grid-template-columns:1fr 1fr}.progress span{font-size:10px}.card{padding:15px}}
    .history{border:1px solid var(--b);border-radius:10px;overflow:hidden;margin-top:12px}.history-head{display:grid;grid-template-columns:96px 150px 130px minmax(0,1fr);gap:12px;padding:8px 14px;background:color-mix(in srgb,var(--b) 26%,var(--s));color:var(--m);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.history-rows{list-style:none;margin:0;padding:0}.history-rows>li{border-top:1px solid var(--b)}.history-rows>li.is-submission{background:color-mix(in srgb,var(--a) 9%,var(--s))}.history-rows>li.is-note{background:color-mix(in srgb,#f2c344 13%,var(--s))}
    .history-line{display:grid;grid-template-columns:96px 150px 130px minmax(0,1fr);gap:12px;width:100%;padding:10px 14px;border:0;border-radius:0;background:transparent;text-align:left;font-weight:400;cursor:default}.history-line:not(:disabled){cursor:pointer}.history-line:not(:disabled):hover .h-summary{text-decoration:underline}
    .h-date,.h-actor{color:var(--m);font-size:13px;overflow-wrap:anywhere}.h-action{font-weight:700;font-size:13.5px}.is-problem .h-action{color:#9b1c1c}.h-summary{display:flex;gap:7px;min-width:0;font-size:13.5px;line-height:1.45;overflow-wrap:anywhere}
    .h-summary i{flex:0 0 auto;margin-top:5px;width:0;height:0;border-top:4px solid transparent;border-bottom:4px solid transparent;border-left:6px solid var(--m);border-radius:0;transition:transform .12s ease}.h-summary i.open{transform:rotate(90deg)}
    .history-details{padding:4px 14px 14px 122px;font-size:13.5px;line-height:1.5}.h-kv,.h-codes,.h-due dl{display:grid;gap:4px;margin:0}.h-kv>div{display:grid;grid-template-columns:180px minmax(0,1fr);gap:12px;border-top:1px solid color-mix(in srgb,var(--b) 60%,transparent);padding-top:4px}
    .h-kv dt,.h-codes dt,.h-due dt{font-size:13px;font-weight:700;letter-spacing:0;text-transform:none;color:var(--t)}.h-kv dd,.h-codes dd,.h-due dd{margin:0;overflow-wrap:anywhere}.h-doc{display:block}
    .h-codes>div{display:grid;grid-template-columns:56px minmax(0,1fr);gap:12px}.h-codes dt{font-weight:800}
    .h-due{margin-top:8px}.h-due em{display:block;color:var(--m);font-size:12.5px;margin-bottom:4px}.h-due dl>div{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;border-top:1px solid color-mix(in srgb,var(--b) 60%,transparent);padding-top:4px}
    .h-text{margin:8px 0 0;white-space:pre-wrap}
    @media(max-width:760px){.history-head{display:none}.history-line{grid-template-columns:1fr;gap:2px;padding:10px 12px}.history-details{padding:4px 12px 12px}.h-kv>div,.h-due dl>div{grid-template-columns:1fr}}
  `],
})
export class MindBillBillLifecycleComponent implements OnChanges, OnDestroy {
  @Input() billId = "";
  @Input() sessionEndpoint = "/api/mindbill/session";
  @Input() apiBaseUrl = "https://app.mindbill.org";
  @Input() getSession?: BillLifecycleSessionProvider;
  @Input() refreshInterval = 60_000;
  @Input() appearance: MindBillAngularAppearance = { preset: "mindbill" };
  @Output() billingError = new EventEmitter<Error>();

  readonly store = new MindBillLifecycleStore();
  readonly lifecycleStages = [
    { id: "submitted", label: "Submitted" }, { id: "accepted", label: "Accepted" },
    { id: "response", label: "Payer response" }, { id: "follow_up", label: "Follow-up" },
    { id: "closed", label: "Closed" },
  ];
  panel = "";
  notice = "";
  closeReason = "";
  payment = { amount: 0, method: "check" as "check" | "eft", depositDate: new Date().toISOString().slice(0, 10) };
  review = { reason: "", payerClaimControlNumber: "", disputedAmount: 0 };

  constructor() { effect(() => { const error = this.store.error(); if (error) this.billingError.emit(error); }); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["billId"] || changes["sessionEndpoint"] || changes["apiBaseUrl"] || changes["getSession"]) {
      if (!this.billId.trim()) { this.store.disconnect(); return; }
      this.store.connect({ billId: this.billId, sessionEndpoint: this.sessionEndpoint, apiBaseUrl: this.apiBaseUrl, ...(this.getSession ? { getSession: this.getSession } : {}) }, this.refreshInterval);
    }
  }
  ngOnDestroy(): void { this.store.disconnect(); }

  get themeStyle(): Record<string, string> {
    return mindBillAngularAppearanceStyle(this.appearance);
  }
  stateLabel(data: BillLifecycleData): string { return data.lifecycle.state.replace(/_/g, " ").replace(/\b\w/g, (value) => value.toUpperCase()); }
  lifecycleDetail(data: BillLifecycleData): string { return data.lifecycle.submittedAt ? `Submitted ${new Date(data.lifecycle.submittedAt).toLocaleDateString()}${data.lifecycle.agingDays != null ? ` · ${data.lifecycle.agingDays} days old` : ""}` : "Submitted bill"; }
  currentStageIndex(data: BillLifecycleData): number { const value = data.lifecycle.state.toLowerCase(); if (value.includes("closed") || value.includes("written_off")) return 4; if (value.includes("second_review") || value.includes("ibr") || value.includes("lien") || value.includes("appeal")) return 3; if (value.includes("processed") || value.includes("paid") || value.includes("denied") || value.includes("rejected") || value.includes("response")) return 2; if (value.includes("accepted")) return 1; return 0; }
  activityLabel(type: string): string { return type.replace(/[._-]+/g, " ").replace(/\b\w/g, (value) => value.toUpperCase()); }
  private readonly historyExpanded = new Set<string>();
  toggleHistory(id: string): void { if (this.historyExpanded.has(id)) this.historyExpanded.delete(id); else this.historyExpanded.add(id); }
  isHistoryOpen(id: string): boolean { return this.historyExpanded.has(id); }
  historyDate(iso: string): string { const parsed = new Date(iso); return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }); }
  payerContact(data: BillLifecycleData): string { const contacts = data.delivery.contacts; return contacts.adjusterName || contacts.adjusterPhone || contacts.adjusterEmail || contacts.claimsEmail || contacts.faxNumber || contacts.mailingAddress || "No payer contact details are available."; }
  beginAction(action: string, data: BillLifecycleData): void { if (action === "post_payment") this.panel = "payment"; else if (action === "second_review" || action === "independent_bill_review") this.panel = "review"; else if (action === "close") this.panel = "close"; else if (action === "view_eor" && data.eors[0]) void this.openEor(data.eors[0].id, data.eors[0].filename); }
  async openAttachment(id: string, filename: string): Promise<void> { this.openBlob(await this.store.getAttachment(id), filename); }
  async openEor(id: string, filename: string): Promise<void> { this.openBlob(await this.store.getEor(id), filename); }
  async postPayment(): Promise<void> { await this.store.postPayment(this.payment); this.panel = ""; this.notice = "Payment posted."; }
  async submitReview(): Promise<void> { await this.store.submitSecondReview({ ...this.review, disputedAmount: this.review.disputedAmount > 0 ? this.review.disputedAmount : undefined, attachmentIds: this.store.data()?.bill.attachments.map((document) => document.id) ?? [], route: "ebill" }); this.panel = ""; this.notice = "Second Review submitted."; }
  async closeBill(): Promise<void> { if (!this.closeReason.trim()) return; await this.store.closeBill({ reason: this.closeReason }); this.panel = ""; this.notice = "Bill closed."; }
  private openBlob(blob: Blob, filename: string): void { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.target = "_blank"; link.rel = "noopener"; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
}
