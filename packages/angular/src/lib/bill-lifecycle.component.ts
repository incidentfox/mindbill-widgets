import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, effect } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  REPORT_BILL_STATUS_OPTIONS,
  reportBillStatusContacts,
  type BillDeliveryOption,
  type BillDeliveryOptions,
  type BillLifecycleData,
  type BillLifecycleSessionProvider,
  type BrowserBillCreateInput,
  type BrowserBillSubmissionDocument,
  type BrowserBillSubmissionInput,
  type BrowserBillSubmissionResult,
  type ReportBillStatusId,
  type BillSubmissionRoute,
} from "@mindbill/browser";
import type { MindBillAngularAppearance } from "./appearance";
import { mindBillAngularAppearanceStyle } from "./appearance";
import { MindBillBillRejectionNoticeComponent } from "./bill-rejection-notice.component";
import { MindBillBillSubmissionComponent, type MindBillSubmissionAttachment } from "./bill-submission.component";
import { MindBillLifecycleStore } from "./lifecycle-store";

export type { MindBillAngularAppearance, MindBillAngularThemePreset } from "./appearance";

@Component({
  selector: "mindbill-bill-lifecycle",
  standalone: true,
  imports: [CommonModule, FormsModule, MindBillBillRejectionNoticeComponent, MindBillBillSubmissionComponent],
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
            <!-- Date/Action/User/Details table: submissions are pale-blue
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
        @if (panel === 'report_status') {
          <form class="card action-form" (submit)="$event.preventDefault(); reportStatus()">
            <h3>Report Bill Status</h3>
            <p class="muted">{{ reportContactSummary }}</p>
            <div class="report-options" role="radiogroup" aria-label="Reported bill payment status">
              @for (option of reportStatusOptions; track option.id) {
                <label class="report-option"><input type="radio" [value]="option.id" [(ngModel)]="report.status" name="reportStatus"><span><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span></label>
              }
            </div>
            <label>Company<input [(ngModel)]="report.company" name="reportCompany"></label>
            <label>Name<input [(ngModel)]="report.representativeName" name="reportRepresentativeName"></label>
            <label>Role<input [(ngModel)]="report.representativeRole" name="reportRepresentativeRole"></label>
            <label>Phone Number<input [(ngModel)]="report.phone" name="reportPhone"></label>
            <label>Call Reference Number<input [(ngModel)]="report.callReference" name="reportCallReference"></label>
            <label>Message Note<textarea [(ngModel)]="report.note" name="reportNote"></textarea></label>
            <div><button type="button" (click)="panel=''">Cancel</button><button class="primary" type="submit" [disabled]="!report.status || store.mutating()">Save</button></div>
          </form>
        }
        @if (panel === 'resubmit' && correctionInitialBill) {
          <div class="correction-backdrop" (mousedown)="closeCorrectionBackdrop($event)">
            <section class="correction-dialog" role="dialog" aria-modal="true" aria-label="Correct and resubmit">
              <button type="button" class="dialog-close" aria-label="Close" (click)="panel=''">×</button>
              <header><h2>Correct and resubmit</h2><p>The original submission remains immutable. Review the rejected values and create the next submission attempt on this bill.</p></header>
              @if (data.rejection; as rejection) {
                <div class="correction-reason"><strong>{{ rejection.reason || 'Why it was rejected' }}</strong>@for (issue of rejection.issues || []; track issue.code) { <span><b>{{ issue.code }}</b> {{ issue.description }}</span> }</div>
              }
              @if (payerContact(data) !== 'No payer contact details are available.') { <p class="contact-hint"><strong>Questions?</strong> {{ payerContact(data) }}</p> }
              <label class="correction-note">Correction note (optional)<textarea [(ngModel)]="correctionReason" name="correctionReason" placeholder="What changed before resubmission?"></textarea></label>
              <mindbill-bill-submission
                [initialBill]="correctionInitialBill"
                [attachments]="correctionAttachments"
                [attentionFields]="correctionAttentionFields"
                [appearance]="appearance"
                [sessionEndpoint]="sessionEndpoint"
                [getSession]="getSession"
                [apiBaseUrl]="apiBaseUrl"
                [submitter]="resubmitFromForm"
                heading="Corrected bill information"
                description="Correct the highlighted values, confirm every required field, then resubmit."
                submitLabel="Resubmit bill"
                (submitted)="finishCorrection()"
              />
            </section>
          </div>
        }
        @if (panel === 'duplicate' && correctionInitialBill) {
          <div class="correction-backdrop" (mousedown)="closeCorrectionBackdrop($event)">
            <section class="correction-dialog" role="dialog" aria-modal="true" aria-label="Send duplicate bill">
              <button type="button" class="dialog-close" aria-label="Close" (click)="panel=''">×</button>
              <header><h2>Send duplicate bill</h2><p>The original submission remains immutable. Review or edit this fresh bill before choosing its delivery route and confirming transmission.</p></header>
              <mindbill-bill-submission
                [initialBill]="correctionInitialBill"
                [attachments]="correctionAttachments"
                [appearance]="appearance"
                [sessionEndpoint]="sessionEndpoint"
                [getSession]="getSession"
                [apiBaseUrl]="apiBaseUrl"
                [submitter]="duplicateFromForm"
                heading="Duplicate bill information"
                description="Review every field. The final step confirms the payer delivery route before the duplicate is sent."
                submitLabel="Continue to delivery"
                (submitted)="finishDuplicate()"
              />
            </section>
          </div>
        }
        @if (panel === 'duplicate_route') {
          <form class="card action-form" (submit)="$event.preventDefault(); sendDuplicate()">
            <h3>Confirm duplicate bill delivery</h3>
            @if (!duplicateDelivery) {
              <p class="muted">{{ duplicateDeliveryError || 'Loading delivery options…' }}</p>
              <div><button type="button" (click)="panel='duplicate'">Back</button>@if (duplicateDeliveryError) { <button class="primary" type="button" (click)="loadDuplicateDelivery()">Try again</button> }</div>
            } @else {
              <p class="muted">Confirm how this edited duplicate will be delivered to {{ duplicateDelivery.payerName }}.</p>
              <label>Delivery method<select [(ngModel)]="duplicate.route" name="duplicateRoute">@for (option of duplicateRoutes(); track option.route) { <option [ngValue]="option.route">{{ option.label }}</option> }</select></label>
              @if (duplicate.route === 'fax') { <label>Fax number<input required [(ngModel)]="duplicate.faxNumber" name="duplicateFax" placeholder="(000) 000-0000"></label> }
              @if (duplicate.route === 'email') { <label>Email<input required type="email" [(ngModel)]="duplicate.email" name="duplicateEmail" placeholder="claims@payer.example"></label> }
              @if (duplicate.route === 'mail') { <label>Mailing address<textarea required [(ngModel)]="duplicate.mailingAddress" name="duplicateMail"></textarea></label> }
              <div><button type="button" (click)="panel='duplicate'">Back</button><button class="primary" type="submit" [disabled]="store.mutating() || !duplicateReady()">Send duplicate</button></div>
            }
          </form>
        }
        @if (panel === 'submit_new_bill' && correctionInitialBill) {
          <div class="correction-backdrop" (mousedown)="closeCorrectionBackdrop($event)">
            <section class="correction-dialog" role="dialog" aria-modal="true" aria-label="Submit New Bill">
              <button type="button" class="dialog-close" aria-label="Close" (click)="panel=''">×</button>
              <header><h2>Submit New Bill</h2><p>This closed bill stays closed and keeps its record. Review the carried-over snapshot and submit a fresh bill — both bills stay linked in the submissions timeline.</p><button type="button" class="header-cancel" (click)="panel=''">Cancel</button></header>
              <label class="correction-note">Submission note (optional)<textarea [(ngModel)]="correctionReason" name="newBillReason" placeholder="Why is a new bill being submitted?"></textarea></label>
              <mindbill-bill-submission
                [initialBill]="correctionInitialBill"
                [attachments]="correctionAttachments"
                [appearance]="appearance"
                [sessionEndpoint]="sessionEndpoint"
                [getSession]="getSession"
                [apiBaseUrl]="apiBaseUrl"
                [submitter]="submitNewBillFromForm"
                heading="New bill information"
                description="The closed bill stays unchanged. This form submits a fresh bill linked to it."
                submitLabel="Submit New Bill"
                (submitted)="finishNewBill()"
              />
            </section>
          </div>
        }
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
    .report-options{display:grid;gap:8px}.action-form label.report-option{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--b);border-radius:var(--cr);padding:10px 12px;font-weight:400;cursor:pointer}.report-option input{width:16px;min-height:16px;margin-top:3px;padding:0;border:0}.report-option strong{display:block;font-size:13.5px}.report-option small{display:block;color:var(--m);margin-top:2px;font-size:12.5px}
    .correction-backdrop{position:fixed;inset:0;z-index:100;overflow:auto;background:#172b37b8;padding:28px}.correction-dialog{position:relative;max-width:1180px;margin:0 auto;background:var(--bg);border-radius:var(--r);box-shadow:0 24px 80px #0006;padding:26px}.correction-dialog>header{padding-right:48px;margin-bottom:18px}.correction-dialog h2{margin:0 0 6px}.correction-dialog p{margin:0;color:var(--m)}.dialog-close{position:absolute;right:20px;top:20px;width:40px;height:40px;padding:0;font-size:24px}.correction-reason{display:grid;gap:8px;margin-bottom:14px;border-left:4px solid #c43d3d;border-radius:8px;background:#fff5f5;padding:14px;color:#8f2525}.correction-reason span{display:block}.correction-reason b{margin-right:6px}.contact-hint{margin:0 0 14px!important;border:1px solid var(--b);border-radius:8px;background:var(--s);padding:12px!important;color:var(--t)!important}.correction-note{display:grid;gap:6px;margin-bottom:18px;font-weight:700}.correction-note textarea{min-height:76px}.correction-dialog mindbill-bill-submission{display:block}.correction-dialog .mb{padding:0}.correction-dialog .header-cancel{margin-top:10px}@media(max-width:760px){.correction-backdrop{padding:0}.correction-dialog{min-height:100%;border-radius:0;padding:18px 12px}.dialog-close{right:12px;top:12px}}
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
  readonly reportStatusOptions = REPORT_BILL_STATUS_OPTIONS;
  report: { status: ReportBillStatusId | null; company: string; representativeName: string; representativeRole: string; phone: string; callReference: string; note: string } =
    { status: null, company: "", representativeName: "", representativeRole: "", phone: "", callReference: "", note: "" };
  reportContactSummary = "";
  duplicateDelivery: BillDeliveryOptions | null = null;
  duplicateDeliveryError = "";
  duplicateDraftInput: BrowserBillSubmissionInput | null = null;
  duplicate = { route: "ebill" as BillSubmissionRoute, faxNumber: "", email: "", mailingAddress: "" };
  correctionInitialBill: BrowserBillCreateInput | null = null;
  correctionAttachments: MindBillSubmissionAttachment[] = [];
  correctionAttentionFields: string[] = [];
  correctionReason = "";

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
  beginAction(action: string, data: BillLifecycleData): void {
    if (action === "resubmit") this.prepareCorrection(data);
    else if (action === "submit_new_bill") this.prepareNewBill(data);
    else if (action === "post_payment") this.panel = "payment";
    else if (action === "second_review" || action === "independent_bill_review") this.panel = "review";
    else if (action === "close") this.panel = "close";
    else if (action === "send_duplicate") this.prepareDuplicate(data);
    else if (action === "report_bill_status") this.beginReportStatus(data);
    else if (action === "view_eor" && data.eors[0]) void this.openEor(data.eors[0].id, data.eors[0].filename);
  }
  beginReportStatus(data: BillLifecycleData): void {
    const contacts = reportBillStatusContacts(data.delivery);
    const parts: string[] = [];
    if (contacts.claimsAdmin) {
      const phones = contacts.claimsAdmin.phones.map((phone) => `${phone.label} ${phone.value}`).join(", ");
      parts.push(`${contacts.claimsAdmin.name}${phones ? ` (${phones})` : ""}${contacts.claimsAdmin.hoursOfOperation ? ` · Hours: ${contacts.claimsAdmin.hoursOfOperation}` : ""}`);
    }
    if (contacts.billReview) parts.push(`Bill Review: ${contacts.billReview.name}${contacts.billReview.phone ? ` ${contacts.billReview.phone}` : ""}`);
    this.reportContactSummary = parts.length
      ? `Call ${parts.join(" · ")} to request the payment status of this bill, then record the status reported and who provided it.`
      : "Call the Claims Administrator or Bill Review vendor for this bill, then record the status reported and who provided it.";
    this.report = { status: null, company: "", representativeName: "", representativeRole: "", phone: "", callReference: "", note: "" };
    this.panel = "report_status";
  }
  async reportStatus(): Promise<void> {
    const status = this.report.status;
    if (!status) return;
    await this.store.reportBillStatus({
      status,
      ...(this.report.company.trim() ? { company: this.report.company.trim() } : {}),
      ...(this.report.representativeName.trim() ? { representativeName: this.report.representativeName.trim() } : {}),
      ...(this.report.representativeRole.trim() ? { representativeRole: this.report.representativeRole.trim() } : {}),
      ...(this.report.phone.trim() ? { phone: this.report.phone.trim() } : {}),
      ...(this.report.callReference.trim() ? { callReference: this.report.callReference.trim() } : {}),
      ...(this.report.note.trim() ? { note: this.report.note.trim() } : {}),
    });
    this.panel = ""; this.notice = "Bill status reported.";
  }
  async openAttachment(id: string, filename: string): Promise<void> { this.openBlob(await this.store.getAttachment(id), filename); }
  async openEor(id: string, filename: string): Promise<void> { this.openBlob(await this.store.getEor(id), filename); }
  async postPayment(): Promise<void> { await this.store.postPayment(this.payment); this.panel = ""; this.notice = "Payment posted."; }
  async submitReview(): Promise<void> { await this.store.submitSecondReview({ ...this.review, ...(this.review.disputedAmount > 0 ? { disputedAmount: this.review.disputedAmount } : {}), attachmentIds: this.store.data()?.bill.attachments.map((document) => document.id) ?? [], route: "ebill" }); this.panel = ""; this.notice = "Second Review submitted."; }
  async closeBill(): Promise<void> { if (!this.closeReason.trim()) return; await this.store.closeBill({ reason: this.closeReason }); this.panel = ""; this.notice = "Bill closed."; }
  readonly resubmitFromForm = async (input: BrowserBillSubmissionInput): Promise<BrowserBillSubmissionResult> => {
    const data = await this.store.resubmitBill({
      bill: input.bill,
      ...(input.documents?.length ? { documents: input.documents } : {}),
      ...(this.correctionReason.trim() ? { reason: this.correctionReason.trim() } : {}),
    });
    return { billId: data.bill.id, bill: { id: data.bill.id, state: data.lifecycle.state } };
  };
  finishCorrection(): void { this.panel = ""; this.correctionReason = ""; this.notice = "Corrected submission sent."; }
  readonly duplicateFromForm = async (input: BrowserBillSubmissionInput): Promise<BrowserBillSubmissionResult> => {
    this.duplicateDraftInput = input;
    this.panel = "duplicate_route";
    await this.loadDuplicateDelivery();
    const billId = this.store.data()?.bill.id || this.billId;
    return { billId, bill: { id: billId, state: "draft" } };
  };
  finishDuplicate(): void { /* The route-confirmation panel owns the final transmission. */ }
  async loadDuplicateDelivery(): Promise<void> {
    this.duplicateDeliveryError = "";
    if (this.duplicateDelivery) return;
    try {
      const delivery = await this.store.getDeliveryOptions();
      this.duplicateDelivery = delivery;
      this.duplicate.route = delivery.recommended.route;
      this.duplicate.faxNumber = delivery.contacts.faxNumber || "";
      this.duplicate.email = delivery.contacts.claimsEmail || "";
      this.duplicate.mailingAddress = delivery.contacts.mailingAddress || "";
    } catch (cause) {
      this.duplicateDeliveryError = cause instanceof Error ? cause.message : "Delivery options could not be loaded.";
    }
  }
  duplicateRoutes(): BillDeliveryOption[] {
    const seen = new Set<BillSubmissionRoute>();
    return (this.duplicateDelivery?.options ?? []).filter((option) => {
      if (seen.has(option.route)) return false;
      seen.add(option.route);
      return true;
    });
  }
  duplicateReady(): boolean {
    if (!this.duplicateDraftInput) return false;
    if (this.duplicate.route === "fax") return this.duplicate.faxNumber.replace(/\D/g, "").length >= 10;
    if (this.duplicate.route === "email") return this.duplicate.email.includes("@");
    if (this.duplicate.route === "mail") return this.duplicate.mailingAddress.trim().length > 2;
    return true;
  }
  async sendDuplicate(): Promise<void> {
    if (!this.duplicateDelivery || !this.duplicateDraftInput || !this.duplicateReady()) return;
    const route = this.duplicate.route;
    const destination = route === "fax" ? { faxNumber: this.duplicate.faxNumber.trim() }
      : route === "email" ? { email: this.duplicate.email.trim() }
      : route === "mail" ? { mailingAddress: this.duplicate.mailingAddress.trim() }
      : null;
    await this.store.sendDuplicateBill({
      bill: this.duplicateDraftInput.bill,
      ...(this.duplicateDraftInput.documents?.length ? { documents: this.duplicateDraftInput.documents } : {}),
      submission: { route, ...(destination ? { destination } : {}) },
    });
    this.panel = "";
    this.notice = "Duplicate bill sent.";
  }
  // "Submit New Bill" from a CLOSED bill: same prefilled submission form as the
  // correction flow, but the server keeps the closed bill closed and creates a
  // fresh original linked to it (both records chain in the submissions timeline).
  readonly submitNewBillFromForm = async (input: BrowserBillSubmissionInput): Promise<BrowserBillSubmissionResult> => {
    const data = await this.store.submitNewBill({
      bill: input.bill,
      ...(input.documents?.length ? { documents: input.documents } : {}),
      ...(this.correctionReason.trim() ? { reason: this.correctionReason.trim() } : {}),
    });
    return { billId: data.bill.id, bill: { id: data.bill.id, state: data.lifecycle.state } };
  };
  finishNewBill(): void { this.panel = ""; this.correctionReason = ""; this.notice = "New bill submitted."; }
  closeCorrectionBackdrop(event: MouseEvent): void { if (event.currentTarget === event.target) this.panel = ""; }
  private prepareCorrection(data: BillLifecycleData): void {
    this.correctionInitialBill = correctionBill(data);
    this.correctionAttachments = data.bill.attachments.map((attachment) => ({
      filename: attachment.filename,
      documentType: correctionDocumentType(attachment.documentType),
      ...(attachment.description ? { description: attachment.description } : {}),
      ...(attachment.reportType ? { reportTypeCode: attachment.reportType } : {}),
      loadBlob: () => this.store.getAttachment(attachment.id),
      ...(attachment.documentType === "w9" ? { locked: true, badge: "Auto-attached" } : {}),
    }));
    this.correctionAttentionFields = [...new Set(data.rejection?.issues?.flatMap((issue) => issue.fieldPaths || []) ?? [])];
    this.correctionReason = "";
    this.panel = "resubmit";
  }
  private prepareDuplicate(data: BillLifecycleData): void {
    this.correctionInitialBill = correctionBill(data);
    this.correctionAttachments = data.bill.attachments.map((attachment) => ({
      filename: attachment.filename,
      documentType: correctionDocumentType(attachment.documentType),
      ...(attachment.description ? { description: attachment.description } : {}),
      ...(attachment.reportType ? { reportTypeCode: attachment.reportType } : {}),
      loadBlob: () => this.store.getAttachment(attachment.id),
      ...(attachment.documentType === "w9" ? { locked: true, badge: "Auto-attached" } : {}),
    }));
    this.correctionAttentionFields = [];
    this.duplicateDraftInput = null;
    this.duplicateDelivery = null;
    this.duplicateDeliveryError = "";
    this.panel = "duplicate";
  }
  private prepareNewBill(data: BillLifecycleData): void {
    this.correctionInitialBill = correctionBill(data);
    this.correctionAttachments = data.bill.attachments.map((attachment) => ({
      filename: attachment.filename,
      documentType: correctionDocumentType(attachment.documentType),
      ...(attachment.description ? { description: attachment.description } : {}),
      ...(attachment.reportType ? { reportTypeCode: attachment.reportType } : {}),
      loadBlob: () => this.store.getAttachment(attachment.id),
      ...(attachment.documentType === "w9" ? { locked: true, badge: "Auto-attached" } : {}),
    }));
    // No rejection context on a closed bill — nothing to highlight.
    this.correctionAttentionFields = [];
    this.correctionReason = "";
    this.panel = "submit_new_bill";
  }
  private openBlob(blob: Blob, filename: string): void { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.target = "_blank"; link.rel = "noopener"; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
}

const CORRECTION_DOCUMENT_TYPES = new Set(["final_report", "letter_of_attestation", "proof_of_service", "form_122", "return_to_work_voucher", "w9", "medical_records", "appeal", "other"]);
function correctionDocumentType(value: string): BrowserBillSubmissionDocument["documentType"] { return (CORRECTION_DOCUMENT_TYPES.has(value) ? value : "other") as BrowserBillSubmissionDocument["documentType"]; }
function correctionBill(data: BillLifecycleData): BrowserBillCreateInput {
  const billing = data.bill.billingSnapshot?.billingProvider;
  const rendering = data.bill.billingSnapshot?.renderingProvider;
  const location = data.bill.billingSnapshot?.placeOfService;
  const nameParts = data.patient.name.trim().split(/\s+/);
  return {
    billingMode: data.bill.billingMode,
    patient: {
      firstName: data.patient.firstName || nameParts[0] || "",
      ...(data.patient.middleName ? { middleName: data.patient.middleName } : {}),
      lastName: data.patient.lastName || nameParts.slice(1).join(" ") || "",
      dateOfBirth: data.patient.dob || "",
      ...(data.patient.phone ? { phone: data.patient.phone } : {}),
      address: { line1: data.patient.address?.line1 || "", city: data.patient.address?.city || "", state: data.patient.address?.state || "", postalCode: data.patient.address?.postalCode || "" },
    },
    claim: {
      claimNumber: data.injury.claimNumber || "",
      ...(data.injury.adjNumber ? { adjNumber: data.injury.adjNumber } : {}),
      employer: data.injury.employer || "",
      dateOfInjury: data.injury.doi || "",
      ...(data.injury.injuryDescription ? { description: data.injury.injuryDescription } : {}),
      claimsAdministrator: { id: data.injury.claimsAdminId || "", name: data.injury.claimsAdminName || "" },
    },
    service: { date: data.bill.dos, ...(data.bill.dosEnd !== undefined ? { endDate: data.bill.dosEnd } : {}), ...(data.bill.authorizationNumber !== undefined ? { authorizationNumber: data.bill.authorizationNumber } : {}) },
    billingProvider: billing?.taxIdType === 'SSN' && billing.taxIdConfigured ? { sourceBillId: data.bill.id } : {
      name: billing?.name || "", taxId: billing?.taxId || "", npi: billing?.npi || "", phone: billing?.phone || "",
      ...(billing?.taxIdType ? { taxIdType: billing.taxIdType } : {}),
      address: { line1: billing?.billingStreet || "", city: billing?.billingCity || "", state: billing?.billingState || "", postalCode: billing?.billingZip || "" },
    },
    renderingProvider: {
      name: rendering?.name || "", npi: rendering?.npi || "", taxonomy: rendering?.taxonomy || "",
      ...(rendering?.specialty ? { specialty: rendering.specialty } : {}), ...(rendering?.licenseNumber ? { licenseNumber: rendering.licenseNumber } : {}), ...(rendering?.licenseState ? { licenseState: rendering.licenseState } : {}),
      ...(rendering?.isQME !== undefined ? { isQme: rendering.isQME } : {}), ...(rendering?.isAME !== undefined ? { isAme: rendering.isAME } : {}),
    },
    serviceLocation: {
      ...(location?.name ? { name: location.name } : {}),
      address: { line1: location?.street || "", city: location?.city || "", state: location?.state || "", postalCode: location?.zip || "" },
      placeOfServiceCode: location?.posCode || "",
    },
    diagnoses: [...(data.injury.diagnosisCodes || [])],
    serviceLines: data.bill.lineItems.map((line) => ({ code: line.code, modifiers: [...line.modifiers], units: line.units, charge: line.charge, ...(line.serviceDate ? { serviceDate: line.serviceDate } : {}), ...(line.serviceDateEnd !== undefined ? { serviceDateEnd: line.serviceDateEnd } : {}), ...(line.diagnosisPointers ? { diagnosisPointers: [...line.diagnosisPointers] } : {}) })),
  };
}
