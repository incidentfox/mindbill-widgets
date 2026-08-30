import { CommonModule } from "@angular/common";
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  effect,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import type {
  BillLifecycleData,
  BillLifecycleSessionProvider,
  BrowserBillCreateInput,
  BillReviewDocumentType,
  BillReviewBillingProvider,
  BillReviewClinician,
  BillReviewLocation,
  BillReviewPayer,
  BillReviewSaveInput,
  BillDeliveryOption,
  BillDeliveryOptions,
  SubmitBillInput,
} from "@mindbill/browser";
import { MindBillLifecycleStore } from "./lifecycle-store";
import { ensureTrailingProcedureLine } from "./procedure-lines";

export type MindBillAngularThemePreset = "mindbill" | "qme-companion" | "orange-bright" | "clinical-blue";
export type MindBillAngularAppearance = {
  preset?: MindBillAngularThemePreset;
  accentColor?: string;
  accentTextColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  textColor?: string;
  mutedColor?: string;
  borderColor?: string;
  borderRadius?: string;
  controlRadius?: string;
  fontFamily?: string;
};

const THEMES: Record<MindBillAngularThemePreset, Required<MindBillAngularAppearance>> = {
  mindbill: { preset: "mindbill", accentColor: "#238dbd", accentTextColor: "#fff", backgroundColor: "#f3f8fa", surfaceColor: "#fff", textColor: "#203743", mutedColor: "#657982", borderColor: "#dbe6ea", borderRadius: "14px", controlRadius: "8px", fontFamily: "Inter,system-ui,sans-serif" },
  "qme-companion": { preset: "qme-companion", accentColor: "#53b5dc", accentTextColor: "#173542", backgroundColor: "#f2f8fb", surfaceColor: "#fff", textColor: "#1d3440", mutedColor: "#617783", borderColor: "#d7e5eb", borderRadius: "12px", controlRadius: "8px", fontFamily: "Inter,system-ui,sans-serif" },
  "orange-bright": { preset: "orange-bright", accentColor: "#ff4f0a", accentTextColor: "#fff", backgroundColor: "#fffaf6", surfaceColor: "#fff", textColor: "#111827", mutedColor: "#626a73", borderColor: "#e5e1dc", borderRadius: "8px", controlRadius: "6px", fontFamily: "Inter,system-ui,sans-serif" },
  "clinical-blue": { preset: "clinical-blue", accentColor: "#1677ff", accentTextColor: "#fff", backgroundColor: "#f5f7fa", surfaceColor: "#fff", textColor: "#1f2d3d", mutedColor: "#66788a", borderColor: "#d9e2ec", borderRadius: "8px", controlRadius: "6px", fontFamily: "Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" },
};

const DOCUMENT_TYPES: Array<{ value: BillReviewDocumentType; label: string }> = [
  { value: "final_report", label: "Final report" },
  { value: "proof_of_service", label: "Proof of service" },
  { value: "letter_of_attestation", label: "Letter of attestation" },
  { value: "form_122", label: "Required form" },
  { value: "return_to_work_voucher", label: "Return-to-work voucher" },
  { value: "w9", label: "W-9" },
  { value: "appeal", label: "Appeal support" },
  { value: "medical_records", label: "Medical records (intentional)" },
  { value: "other", label: "Other supporting document" },
];

type BillDraft = {
  patient: BillLifecycleData["patient"] & { firstName: string; lastName: string };
  injury: BillLifecycleData["injury"];
  bill: BillLifecycleData["bill"];
  billingProvider: BillReviewBillingProvider;
  clinician: BillReviewClinician;
  location: BillReviewLocation;
};

@Component({
  selector: "mindbill-bill-lifecycle",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="mb" [ngStyle]="themeStyle">
      @if (store.loading() && !store.data()) {
        <div class="state">Loading billing…</div>
      } @else if (store.error() && !store.data()) {
        <div class="state error"><strong>Billing is temporarily unavailable</strong><span>{{ store.error()?.message }}</span><button (click)="store.refresh()">Try again</button></div>
      } @else if (store.data(); as data) {
        <header class="summary">
          <div><span class="eyebrow">Bill {{ data.bill.billNumber }}</span><h2>{{ stateLabel(data) }}</h2><p>{{ lifecycleDetail(data) }}</p></div>
          <div class="money"><span>{{ data.bill.balanceDue | currency }}</span><small>balance</small></div>
        </header>

        @if (isEditable(data) && draft) {
          <form class="review" (submit)="$event.preventDefault(); submit()">
            <section class="card">
              <div class="card-title"><div><h3>Patient and claim</h3><p>Prefilled from the case. Correct anything that should print differently on this bill.</p></div><span>Required</span></div>
              <div class="grid four">
                <label><span>First name</span><input required [(ngModel)]="draft.patient.firstName" name="firstName" (ngModelChange)="dirty=true"></label>
                <label><span>Last name</span><input required [(ngModel)]="draft.patient.lastName" name="lastName" (ngModelChange)="dirty=true"></label>
                <label><span>Date of birth</span><input type="date" [(ngModel)]="draft.patient.dob" name="dob" (ngModelChange)="dirty=true"></label>
                <label><span>Date of injury</span><input type="date" [(ngModel)]="draft.injury.doi" name="doi" (ngModelChange)="dirty=true"></label>
                <label><span>Claim number</span><input [(ngModel)]="draft.injury.claimNumber" name="claimNumber" (ngModelChange)="dirty=true"></label>
                <label><span>Employer</span><input [(ngModel)]="draft.injury.employer" name="employer" (ngModelChange)="dirty=true"></label>
                <label><span>WCAB / case number</span><input [(ngModel)]="draft.injury.adjNumber" name="adjNumber" (ngModelChange)="dirty=true"></label>
                <label><span>Date of service</span><input required type="date" [(ngModel)]="draft.bill.dos" name="dos" (ngModelChange)="dirty=true"></label>
              </div>
            </section>

            <section class="card payer">
              <div class="card-title"><div><h3>Claims administrator</h3><p>Select who should receive this bill. Search uses payer names and claim-number patterns.</p></div><span>Required</span></div>
              @if (draft.injury.claimsAdminId) { <div class="selected"><div><strong>{{ draft.injury.claimsAdminName }}</strong><small>Selected recipient</small></div><button type="button" (click)="clearPayer()">Change</button></div> }
              @else {
                <label><span>Insurance company or claims administrator</span><input name="payerSearch" [(ngModel)]="payerQuery" (ngModelChange)="queuePayerSearch()" placeholder="Search by payer or administrator name" autocomplete="off"></label>
                @if (payerResults.length) { <div class="results">@for (payer of payerResults; track payer.id) { <button type="button" (click)="selectPayer(payer)"><strong>{{ payer.name }}</strong><span>{{ payerExplanation(payer) }}</span></button> }</div> }
              }
            </section>

            <section class="card">
              <div class="card-title"><div><h3>Billing identity</h3><p>The payee, rendering clinician, and place of service are bill snapshots—not synchronization records.</p></div><span>Prefilled</span></div>
              <div class="subhead">Billing provider</div>
              <div class="grid three">
                <label><span>Practice name</span><input required [(ngModel)]="draft.billingProvider.name" name="practiceName" (ngModelChange)="dirty=true"></label>
                <label><span>Tax ID</span><input required [(ngModel)]="draft.billingProvider.taxId" name="taxId" (ngModelChange)="dirty=true"></label>
                <label><span>Billing NPI</span><input required [(ngModel)]="draft.billingProvider.npi" name="billingNpi" (ngModelChange)="dirty=true"></label>
              </div>
              <div class="subhead">Rendering clinician</div>
              <div class="grid three">
                <label><span>Name</span><input required [(ngModel)]="draft.clinician.name" name="clinicianName" (ngModelChange)="dirty=true"></label>
                <label><span>NPI</span><input required [(ngModel)]="draft.clinician.npi" name="clinicianNpi" (ngModelChange)="dirty=true"></label>
                <label><span>Taxonomy</span><input [(ngModel)]="draft.clinician.taxonomy" name="taxonomy" (ngModelChange)="dirty=true"></label>
              </div>
              <div class="subhead">Service location</div>
              <div class="grid three">
                <label><span>Location</span><input required [(ngModel)]="draft.location.name" name="locationName" (ngModelChange)="dirty=true"></label>
                <label><span>Street</span><input required [(ngModel)]="draft.location.street" name="street" (ngModelChange)="dirty=true"></label>
                <label><span>City</span><input required [(ngModel)]="draft.location.city" name="city" (ngModelChange)="dirty=true"></label>
                <label><span>State</span><input required list="mb-states" maxlength="2" [(ngModel)]="draft.location.state" name="state" (ngModelChange)="dirty=true"></label>
                <label><span>ZIP</span><input required [(ngModel)]="draft.location.zip" name="zip" (ngModelChange)="dirty=true"></label>
                <label><span>Place of service</span><input required [(ngModel)]="draft.location.posCode" name="pos" (ngModelChange)="dirty=true"></label>
              </div>
            </section>

            <section class="card">
              <div class="card-title"><div><h3>Charges</h3><p>{{ draft.bill.billingMode === 'professional' ? 'Enter each treatment or professional service.' : 'Choose medical-legal codes, modifiers, units, and allowed amounts.' }} A keyboard-ready row appears automatically.</p></div></div>
              @if (draft.bill.billingMode === 'med_legal') {
                <div class="presets"><button type="button" (click)="applyPreset('qme')">QME</button><button type="button" (click)="applyPreset('ame')">AME</button><button type="button" (click)="applyPreset('psych')">Psych QME</button></div>
              }
              <div class="lines">@for (line of draft.bill.lineItems; track $index; let i=$index) {
                <div class="line" [class.professional]="draft.bill.billingMode === 'professional'">
                  <label><span>Procedure</span>
                    @if (draft.bill.billingMode === 'med_legal') {
                      <select [(ngModel)]="line.code" [name]="'code'+i" (ngModelChange)="lineChanged()"><option value="">Choose code…</option>@for (code of medLegalCodes; track code) { <option [value]="code">{{ code }}</option> }</select>
                    } @else { <input [(ngModel)]="line.code" [name]="'code'+i" (ngModelChange)="lineChanged()" placeholder="e.g. 99204"> }
                  </label>
                  <label><span>Modifiers</span><input [ngModel]="line.modifiers.join(', ')" (ngModelChange)="setModifiers(line,$any($event))" [name]="'modifiers'+i" placeholder="e.g. 25, 95"></label>
                  @if (draft.bill.billingMode === 'professional') {
                    <label><span>Service date</span><input type="date" [(ngModel)]="line.serviceDate" [name]="'serviceDate'+i" (ngModelChange)="lineChanged()"></label>
                    <label><span>End date</span><input type="date" [(ngModel)]="line.serviceDateEnd" [name]="'serviceDateEnd'+i" (ngModelChange)="lineChanged()"></label>
                    <label><span>Charge</span><input type="number" min="0" step="0.01" [(ngModel)]="line.charge" [name]="'charge'+i" (ngModelChange)="lineChanged()"></label>
                    <label><span>Diagnosis pointers</span><input [ngModel]="(line.diagnosisPointers || []).join(', ')" (ngModelChange)="setDiagnosisPointers(line,$any($event))" [name]="'pointers'+i" placeholder="1, 2"></label>
                  }
                  <label><span>Units</span><input type="number" min="1" [(ngModel)]="line.units" [name]="'units'+i" (ngModelChange)="lineChanged()"></label>
                  <div class="allowed"><span>{{ draft.bill.billingMode === 'professional' ? 'Charge' : 'Allowed' }}</span><strong>{{ line.charge | currency }}</strong></div>
                  <button type="button" class="remove" (click)="removeLine(i)" aria-label="Remove line">×</button>
                </div>
              }</div>
            </section>

            <section class="card">
              <div class="card-title"><div><h3>Payer packet</h3><p>Only these documents will be sent. Medical records are never attached unless selected intentionally.</p></div><span>{{ data.bill.attachments.length }} files</span></div>
              <ul class="docs">@for (doc of data.bill.attachments; track doc.id) { <li><div><strong>{{ doc.filename }}</strong><small>{{ doc.description || doc.documentType }}</small></div><button type="button" (click)="openAttachment(doc.id,doc.filename)">View</button><button type="button" (click)="removeAttachment(doc.id)">Remove</button></li> }</ul>
              <div class="upload"><select [(ngModel)]="documentType" name="documentType">@for (type of documentTypes; track type.value) { <option [value]="type.value">{{ type.label }}</option> }</select><input #fileInput type="file" accept="application/pdf" (change)="fileSelected($event)"><button type="button" [disabled]="!pendingFile || store.mutating()" (click)="attach()">Attach document</button></div>
            </section>

            <section class="delivery"><div><span class="eyebrow">Delivery</span><h3>Submit this bill</h3><p>Review the exact electronic, fax, email, or mail destination before anything is sent.</p></div><div class="actions"><button type="button" (click)="save()" [disabled]="store.mutating()">Save changes</button><button class="primary" type="button" (click)="openSubmit()" [disabled]="store.mutating() || deliveryBusy || !canSubmit()">{{ deliveryBusy ? 'Loading routes…' : 'Review delivery' }}</button></div></section>

            @if (showSubmit && deliveryOptions) {
              <div class="modal-backdrop" (click)="closeSubmit()">
                <section class="submit-modal" role="dialog" aria-modal="true" aria-labelledby="mb-submit-title" (click)="$event.stopPropagation()">
                  <header><div><span class="eyebrow">Send bill</span><h3 id="mb-submit-title">Choose a delivery route</h3><p>{{ deliveryOptions.payerName }}</p></div><button type="button" class="close" (click)="closeSubmit()" aria-label="Close">×</button></header>
                  <div class="route-list">@for (option of deliveryOptions.options; track option.route) {
                    <button type="button" class="route-option" [class.selected]="submission.route === option.route" (click)="chooseDelivery(option)"><span class="radio"></span><span><strong>{{ option.label }}</strong><small>{{ option.detail }}</small></span>@if (option.route === deliveryOptions.recommended.route) { <b>Recommended</b> }</button>
                  }</div>
                  @if (selectedDelivery(); as option) {
                    @if (option.route === 'fax') { <label><span>Fax number</span><input [ngModel]="submission.destination?.faxNumber || ''" (ngModelChange)="setDestination('faxNumber',$any($event))" name="submitFax"></label> }
                    @if (option.route === 'email') { <label><span>Email address</span><input type="email" [ngModel]="submission.destination?.email || ''" (ngModelChange)="setDestination('email',$any($event))" name="submitEmail"></label><label><span>Subject</span><input [(ngModel)]="submission.subject" name="submitSubject"></label> }
                    @if (option.route === 'mail') { <label><span>Mailing address</span><textarea [ngModel]="submission.destination?.mailingAddress || ''" (ngModelChange)="setDestination('mailingAddress',$any($event))" name="submitMail"></textarea></label> }
                    @if (option.route !== 'ebill') { <label><span>Attention (optional)</span><input [(ngModel)]="submission.attention" name="submitAttention"></label> }
                  }
                  <footer><button type="button" (click)="closeSubmit()">Cancel</button><button type="button" class="primary" (click)="submit()" [disabled]="store.mutating() || !deliveryReady()">{{ store.mutating() ? 'Submitting…' : 'Submit bill' }}</button></footer>
                </section>
              </div>
            }
          </form>
        } @else {
          <section class="card lifecycle">
            <div class="card-title"><div><h3>Billing activity</h3><p>Available actions change automatically with bill status.</p></div><button (click)="store.refresh()">Refresh</button></div>
            @if (data.eors.length) { <div class="eors"><h4>Explanation of Review</h4>@for (eor of data.eors; track eor.id) { <button (click)="openEor(eor.id,eor.filename)"><span><strong>{{ eor.filename }}</strong><small>{{ eor.description || 'Payer response' }}</small></span><b>View PDF</b></button> }</div> }
            <div class="actionbar">@for (action of data.lifecycle.actions; track action.id) { @if (action.enabled) { <button [class.primary]="action.primary" (click)="beginAction(action.id)">{{ action.label }}</button> } }</div>
            @if (panel === 'payment') { <div class="panel"><h4>Post payment</h4><div class="grid three"><label><span>Amount</span><input type="number" min="0.01" [(ngModel)]="payment.amount"></label><label><span>Method</span><select [(ngModel)]="payment.method"><option value="check">Check</option><option value="eft">EFT</option></select></label><label><span>Deposit date</span><input type="date" [(ngModel)]="payment.depositDate"></label></div><div class="actions"><button (click)="panel=''">Cancel</button><button class="primary" (click)="postPayment()">Post payment</button></div></div> }
            @if (panel === 'review') { <div class="panel"><h4>Submit Second Review</h4><label><span>Reason</span><textarea [(ngModel)]="review.reason"></textarea></label><div class="grid two"><label><span>Payer control number</span><input [(ngModel)]="review.payerClaimControlNumber"></label><label><span>Disputed amount</span><input type="number" [(ngModel)]="review.disputedAmount"></label></div><div class="actions"><button (click)="panel=''">Cancel</button><button class="primary" (click)="submitReview()">Submit review</button></div></div> }
            @if (panel === 'close') { <div class="panel"><h4>Close bill</h4><label><span>Reason</span><textarea [(ngModel)]="closeReason"></textarea></label><div class="actions"><button (click)="panel=''">Cancel</button><button class="danger" (click)="closeBill()">Close bill</button></div></div> }
          </section>
        }
        @if (notice) { <div class="notice">{{ notice }}</div> }
        @if (store.error()) { <div class="notice error">{{ store.error()?.message }}</div> }
        <footer class="powered">Powered by MindBill</footer>
      }
      <datalist id="mb-states"><option value="CA"></option><option value="AZ"></option><option value="NV"></option><option value="OR"></option><option value="WA"></option><option value="TX"></option><option value="NY"></option></datalist>
    </section>
  `,
  styles: [`
    :host{display:block}.mb{--a:#238dbd;--ac:#fff;--bg:#f3f8fa;--s:#fff;--t:#203743;--m:#657982;--b:#dbe6ea;--r:12px;--cr:8px;display:grid;gap:16px;color:var(--t);font:14px/1.45 var(--font,Inter,system-ui,sans-serif)}*{box-sizing:border-box}h2,h3,h4,p{margin:0}.summary,.card,.delivery,.state{border:1px solid var(--b);border-radius:var(--r);background:var(--s)}.summary{display:flex;justify-content:space-between;gap:20px;padding:20px}.summary h2{font-size:24px}.summary p,.card p,.delivery p,small{color:var(--m)}.eyebrow{color:var(--m);font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.money{text-align:right}.money span{display:block;font-size:28px;font-weight:800}.money small{font-size:12px}.review{display:grid;gap:16px}.card{padding:20px}.card-title{display:flex;align-items:start;justify-content:space-between;gap:16px;margin-bottom:18px}.card-title h3,.delivery h3{font-size:18px}.card-title>span{border-radius:999px;background:var(--bg);padding:5px 9px;color:var(--m);font-size:11px;font-weight:800;text-transform:uppercase}.grid{display:grid;gap:14px}.grid.four{grid-template-columns:repeat(4,minmax(0,1fr))}.grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}label{display:grid;gap:6px;color:var(--t);font-size:12px;font-weight:700}input,select,textarea,button{font:inherit}input,select,textarea{width:100%;min-height:42px;border:1px solid var(--b);border-radius:var(--cr);background:#fff;color:var(--t);padding:9px 11px}textarea{min-height:90px;resize:vertical}button{min-height:38px;border:1px solid var(--b);border-radius:var(--cr);background:#fff;color:var(--t);padding:8px 13px;cursor:pointer;font-weight:700}button.primary{border-color:var(--a);background:var(--a);color:var(--ac)}button.danger{border-color:#d4380d;background:#d4380d;color:#fff}button:disabled{cursor:not-allowed;opacity:.5}.subhead{margin:18px 0 9px;border-top:1px solid var(--b);padding-top:15px;font-size:12px;font-weight:800}.selected{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--b);border-radius:var(--cr);padding:12px}.selected div{display:grid}.results{position:relative;z-index:3;display:grid;margin-top:5px;border:1px solid var(--b);border-radius:var(--cr);background:#fff;box-shadow:0 12px 30px rgba(31,45,61,.12);overflow:hidden}.results button{display:grid;gap:2px;text-align:left;border:0;border-bottom:1px solid var(--b);border-radius:0;padding:12px}.results span{color:var(--m);font-weight:400}.presets{display:flex;gap:8px;margin:-4px 0 12px}.lines{display:grid;gap:10px}.line{display:grid;grid-template-columns:1.2fr 1.2fr 110px 120px 40px;align-items:end;gap:10px;border-radius:var(--cr);background:var(--bg);padding:12px}.line.professional{grid-template-columns:1.1fr 1fr 1fr 1fr 110px 1fr 90px 110px 40px}.allowed{display:grid;gap:7px;text-align:right}.allowed span{color:var(--m);font-size:11px;font-weight:800;text-transform:uppercase}.allowed strong{font-size:17px}.remove{border:0;background:transparent;font-size:20px}.docs{list-style:none;margin:0;padding:0}.docs li{display:flex;align-items:center;gap:8px;border-top:1px solid var(--b);padding:11px 0}.docs li>div{display:grid;flex:1}.upload{display:grid;grid-template-columns:240px 1fr auto;gap:10px;margin-top:12px;border-radius:var(--cr);background:var(--bg);padding:12px}.delivery{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:20px;background:color-mix(in srgb,var(--a) 5%,white)}.actions,.actionbar{display:flex;justify-content:flex-end;gap:8px}.lifecycle{display:grid;gap:16px}.actionbar{flex-wrap:wrap}.eors{display:grid;gap:8px}.eors>button{display:flex;align-items:center;justify-content:space-between;text-align:left}.eors span{display:grid}.panel{display:grid;gap:14px;border-top:1px solid var(--b);padding-top:16px}.notice,.state{padding:13px 15px}.notice{border-radius:var(--cr);background:#edf8f2;color:#23734c}.notice.error,.state.error{background:#fff2f0;color:#b42318}.state{display:grid;gap:10px}.state button{justify-self:start}.powered{text-align:right;color:var(--m);font-size:11px}.modal-backdrop{position:fixed;z-index:1000;inset:0;display:grid;place-items:center;background:rgba(15,32,40,.56);padding:20px}.submit-modal{display:grid;gap:18px;width:min(680px,100%);max-height:calc(100vh - 40px);overflow:auto;border:1px solid var(--b);border-radius:var(--r);background:var(--s);padding:22px;box-shadow:0 24px 80px rgba(15,32,40,.28)}.submit-modal>header,.submit-modal>footer{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.submit-modal>footer{justify-content:flex-end}.submit-modal .close{border:0;background:transparent;font-size:26px}.route-list{display:grid;gap:8px}.route-option{display:grid;grid-template-columns:20px 1fr auto;align-items:center;gap:12px;text-align:left;padding:13px}.route-option>span:nth-child(2){display:grid}.route-option.selected{border-color:var(--a);box-shadow:0 0 0 2px color-mix(in srgb,var(--a) 18%,transparent)}.route-option .radio{width:16px;height:16px;border:2px solid var(--b);border-radius:50%}.route-option.selected .radio{border:5px solid var(--a)}.route-option b{color:var(--a);font-size:11px;text-transform:uppercase}@media(max-width:1100px){.line.professional{grid-template-columns:repeat(3,minmax(0,1fr))}.line.professional .allowed{grid-column:auto}}@media(max-width:900px){.grid.four,.grid.three{grid-template-columns:repeat(2,minmax(0,1fr))}.line{grid-template-columns:1fr 1fr 90px}.allowed{grid-column:1/-2;text-align:left}.upload{grid-template-columns:1fr}.delivery{align-items:stretch;flex-direction:column}.actions{justify-content:flex-start}}@media(max-width:600px){.summary,.card-title{align-items:stretch;flex-direction:column}.money{text-align:left}.grid.four,.grid.three,.grid.two,.line,.line.professional{grid-template-columns:1fr}.allowed{grid-column:auto}.docs li{align-items:flex-start;flex-wrap:wrap}.modal-backdrop{padding:8px}.submit-modal{max-height:calc(100vh - 16px);padding:16px}.route-option{grid-template-columns:20px 1fr}.route-option b{grid-column:2}}
  `],
})
export class MindBillBillLifecycleComponent implements OnChanges, OnDestroy {
  @Input() billId = "";
  @Input() create?: BrowserBillCreateInput;
  @Input() sessionEndpoint = "/api/mindbill/session";
  @Input() apiBaseUrl = "https://app.mindbill.org";
  @Input() getSession?: BillLifecycleSessionProvider;
  @Input() refreshInterval = 60_000;
  @Input() appearance: MindBillAngularAppearance = { preset: "mindbill" };
  @Output() billIdChange = new EventEmitter<string>();
  @Output() billCreated = new EventEmitter<{ billId: string; data: BillLifecycleData }>();
  @Output() submitted = new EventEmitter<BillLifecycleData>();
  @Output() billingError = new EventEmitter<Error>();

  readonly store = new MindBillLifecycleStore();
  readonly documentTypes = DOCUMENT_TYPES;
  readonly medLegalCodes = ["ML200", "ML201", "ML202", "ML203", "ML204", "ML205", "ML206", "MLPRR"];
  draft: BillDraft | null = null;
  dirty = false;
  payerQuery = "";
  payerResults: BillReviewPayer[] = [];
  documentType: BillReviewDocumentType = "other";
  pendingFile: File | null = null;
  deliveryOptions: BillDeliveryOptions | null = null;
  submission: SubmitBillInput = { route: "ebill" };
  showSubmit = false;
  deliveryBusy = false;
  panel = "";
  notice = "";
  closeReason = "";
  payment = { amount: 0, method: "check" as "check" | "eft", depositDate: new Date().toISOString().slice(0, 10) };
  review = { reason: "", payerClaimControlNumber: "", disputedAmount: 0 };
  private payerTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const data = this.store.data();
      if (data && !this.dirty) this.draft = this.makeDraft(data);
      const error = this.store.error();
      if (error) this.billingError.emit(error);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["billId"] || changes["create"] || changes["sessionEndpoint"] || changes["apiBaseUrl"] || changes["getSession"]) {
      if (!this.billId && !this.create) {
        this.store.disconnect();
        return;
      }
      this.store.connect(
        {
          ...(this.billId ? { billId: this.billId } : {}),
          sessionEndpoint: this.sessionEndpoint,
          apiBaseUrl: this.apiBaseUrl,
          ...(this.getSession ? { getSession: this.getSession } : {}),
        },
        this.refreshInterval,
        this.create,
        (billId, data) => {
          this.billIdChange.emit(billId);
          this.billCreated.emit({ billId, data });
        },
      );
    }
  }
  ngOnDestroy(): void { this.store.disconnect(); if (this.payerTimer) clearTimeout(this.payerTimer); }

  get themeStyle(): Record<string, string> {
    const base = THEMES[this.appearance.preset ?? "mindbill"];
    return {
      "--a": this.appearance.accentColor ?? base.accentColor,
      "--ac": this.appearance.accentTextColor ?? base.accentTextColor,
      "--bg": this.appearance.backgroundColor ?? base.backgroundColor,
      "--s": this.appearance.surfaceColor ?? base.surfaceColor,
      "--t": this.appearance.textColor ?? base.textColor,
      "--m": this.appearance.mutedColor ?? base.mutedColor,
      "--b": this.appearance.borderColor ?? base.borderColor,
      "--r": this.appearance.borderRadius ?? base.borderRadius,
      "--cr": this.appearance.controlRadius ?? base.controlRadius,
      "--font": this.appearance.fontFamily ?? base.fontFamily,
    };
  }
  stateLabel(data: BillLifecycleData) { return data.lifecycle.state.replace(/_/g, " ").replace(/\b\w/g, (value) => value.toUpperCase()); }
  lifecycleDetail(data: BillLifecycleData) { return data.lifecycle.submittedAt ? `Submitted ${new Date(data.lifecycle.submittedAt).toLocaleDateString()}${data.lifecycle.agingDays != null ? ` · ${data.lifecycle.agingDays} days old` : ""}` : "Review the prefilled bill and payer packet before submission."; }
  isEditable(data: BillLifecycleData) { return data.lifecycle.actions.some((action) => action.id === "edit_and_submit" && action.enabled) || ["incomplete", "draft", "not_submitted"].includes(data.lifecycle.state.toLowerCase()); }
  payerExplanation(payer: BillReviewPayer) { return payer.signals?.map((signal) => signal.label).join(" · ") || (payer.hasElectronic ? "Electronic billing available" : "Available in payer directory"); }
  queuePayerSearch(): void { if (this.payerTimer) clearTimeout(this.payerTimer); this.payerTimer = setTimeout(() => void this.searchPayers(), 250); }
  async searchPayers(): Promise<void> { if (!this.payerQuery.trim()) { this.payerResults = []; return; } this.payerResults = await this.store.searchClaimsAdministrators(this.payerQuery, this.draft?.injury.claimNumber); }
  selectPayer(payer: BillReviewPayer): void { if (!this.draft) return; this.draft.injury.claimsAdminId = payer.id; this.draft.injury.claimsAdminName = payer.name; this.payerQuery = ""; this.payerResults = []; this.dirty = true; }
  clearPayer(): void { if (!this.draft) return; this.draft.injury.claimsAdminId = ""; this.draft.injury.claimsAdminName = ""; this.dirty = true; }
  lineChanged(): void { this.normalizeLineItems(); this.dirty = true; }
  removeLine(index: number): void { this.draft?.bill.lineItems.splice(index, 1); this.normalizeLineItems(); this.dirty = true; }
  setModifiers(line: { modifiers: string[] }, value: string): void { line.modifiers = value.split(",").map((item) => item.trim().replace(/^-/, "")).filter(Boolean); this.normalizeLineItems(); this.dirty = true; }
  setDiagnosisPointers(line: { diagnosisPointers?: number[] }, value: string): void { line.diagnosisPointers = value.split(",").map((item) => Number(item.trim())).filter((item) => Number.isInteger(item) && item >= 1 && item <= 12); this.normalizeLineItems(); this.dirty = true; }
  applyPreset(kind: "qme" | "ame" | "psych"): void {
    if (!this.draft) return;
    const modifier = kind === "ame" ? "94" : kind === "psych" ? "96" : "95";
    const entered = this.draft.bill.lineItems.filter((line) => line.code.trim());
    if (entered.length === 0) entered.push({ code: "ML201", modifiers: [modifier], units: 1, charge: 0 });
    else entered.forEach((line) => { if (!line.modifiers.length) line.modifiers = [modifier]; });
    this.draft.bill.lineItems = ensureTrailingProcedureLine(entered);
    this.dirty = true;
  }
  fileSelected(event: Event): void { this.pendingFile = (event.target as HTMLInputElement).files?.[0] ?? null; }
  async attach(): Promise<void> { if (!this.pendingFile) return; await this.store.addAttachment(this.pendingFile, this.documentType); this.pendingFile = null; this.notice = "Document attached."; }
  async removeAttachment(id: string): Promise<void> { await this.store.removeAttachment(id); this.notice = "Document removed."; }
  async openAttachment(id: string, filename: string): Promise<void> { this.openBlob(await this.store.getAttachment(id), filename); }
  async openEor(id: string, filename: string): Promise<void> { this.openBlob(await this.store.getEor(id), filename); }
  canSubmit(): boolean {
    const input = this.buildInput();
    if (!input || !input.claimsAdminId || !input.billingProvider?.name || !input.billingProvider.taxId || !input.billingProvider.npi || !input.renderingProvider?.name || !input.renderingProvider.npi || !input.lineItems.length) return false;
    return input.lineItems.every((line) => line.code && line.units > 0 && (this.draft?.bill.billingMode !== "professional" || Boolean(line.serviceDate && line.charge && line.charge > 0)));
  }
  async save(): Promise<void> { const input = this.buildInput(); if (!input) return; const data = await this.store.saveReview(input); this.dirty = false; this.draft = this.makeDraft(data); this.notice = "Bill saved."; }
  async openSubmit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.deliveryBusy = true;
    try {
      this.deliveryOptions = await this.store.getDeliveryOptions();
      this.chooseDelivery(this.deliveryOptions.recommended);
      this.showSubmit = true;
    } finally { this.deliveryBusy = false; }
  }
  closeSubmit(): void { this.showSubmit = false; }
  selectedDelivery(): BillDeliveryOption | undefined { return this.deliveryOptions?.options.find((option) => option.route === this.submission.route); }
  chooseDelivery(option: BillDeliveryOption): void {
    const destination = option.route === "fax" ? { faxNumber: option.target ?? this.deliveryOptions?.contacts.faxNumber ?? "" }
      : option.route === "email" ? { email: option.target ?? this.deliveryOptions?.contacts.claimsEmail ?? "" }
      : option.route === "mail" ? { mailingAddress: option.target ?? this.deliveryOptions?.contacts.mailingAddress ?? "" }
      : undefined;
    this.submission = { route: option.route, ...(destination ? { destination } : {}) };
  }
  setDestination(key: "faxNumber" | "email" | "mailingAddress", value: string): void { this.submission = { ...this.submission, destination: { ...this.submission.destination, [key]: value } }; }
  deliveryReady(): boolean {
    if (this.submission.route === "fax") return Boolean(this.submission.destination?.faxNumber?.trim());
    if (this.submission.route === "email") return Boolean(this.submission.destination?.email?.trim());
    if (this.submission.route === "mail") return Boolean(this.submission.destination?.mailingAddress?.trim());
    return true;
  }
  async submit(): Promise<void> { const input = this.buildInput(); if (!input || !this.canSubmit() || !this.deliveryReady()) return; const data = await this.store.submitBill(input, this.submission); this.showSubmit = false; this.dirty = false; this.draft = this.makeDraft(data); this.notice = "Bill submitted."; this.submitted.emit(data); }
  beginAction(action: string): void { if (action === "post_payment") this.panel = "payment"; else if (action === "second_review" || action === "independent_bill_review") this.panel = "review"; else if (action === "close") this.panel = "close"; else if (action === "view_eor" && this.store.data()?.eors[0]) { const eor = this.store.data()!.eors[0]!; void this.openEor(eor.id, eor.filename); } else if (action === "correct_and_resubmit") void this.correct(); }
  async correct(): Promise<void> { const data = await this.store.startCorrection(); this.billIdChange.emit(this.store.billId()); this.dirty = false; this.draft = this.makeDraft(data); this.notice = "Correction draft created."; }
  async postPayment(): Promise<void> { await this.store.postPayment({ ...this.payment }); this.panel = ""; this.notice = "Payment posted."; }
  async submitReview(): Promise<void> { const data = this.store.data(); if (!data) return; await this.store.submitSecondReview({ ...this.review, disputedAmount: this.review.disputedAmount || undefined, route: "ebill", attachmentIds: data.bill.attachments.map((doc) => doc.id) }); this.panel = ""; this.notice = "Second Review submitted."; }
  async closeBill(): Promise<void> { if (!this.closeReason.trim()) return; await this.store.closeBill({ reason: this.closeReason }); this.panel = ""; this.notice = "Bill closed."; }

  private buildInput(): BillReviewSaveInput | null {
    if (!this.draft) return null;
    return {
      claimsAdminId: this.draft.injury.claimsAdminId ?? "",
      patientOverrides: {
        firstName: this.draft.patient.firstName,
        lastName: this.draft.patient.lastName,
        ...(this.draft.patient.middleName ? { middleName: this.draft.patient.middleName } : {}),
        ...(this.draft.patient.dob ? { dob: this.draft.patient.dob } : {}),
      },
      injuryOverrides: {
        ...(this.draft.injury.claimNumber ? { claimNumber: this.draft.injury.claimNumber } : {}),
        ...(this.draft.injury.employer ? { employer: this.draft.injury.employer } : {}),
        ...(this.draft.injury.doi ? { doi: this.draft.injury.doi } : {}),
        ...(this.draft.injury.injuryEndDate ? { injuryEndDate: this.draft.injury.injuryEndDate } : {}),
        ...(typeof this.draft.injury.cumulativeTrauma === "boolean" ? { cumulativeTrauma: this.draft.injury.cumulativeTrauma } : {}),
        ...(this.draft.injury.adjNumber ? { adjNumber: this.draft.injury.adjNumber } : {}),
      },
      dos: this.draft.bill.dos,
      billingProvider: this.draft.billingProvider,
      renderingProvider: this.draft.clinician,
      placeOfService: this.draft.location,
      lineItems: this.draft.bill.lineItems.filter((line) => line.code.trim()).map((line) => ({
        ...(line.id ? { id: line.id } : {}),
        code: line.code,
        modifiers: line.modifiers,
        units: line.units,
        ...(line.charge > 0 ? { charge: line.charge } : {}),
        ...(line.serviceDate ? { serviceDate: line.serviceDate } : {}),
        ...(line.serviceDateEnd ? { serviceDateEnd: line.serviceDateEnd } : {}),
        ...(line.diagnosisPointers?.length ? { diagnosisPointers: line.diagnosisPointers } : {}),
      })),
    };
  }
  private makeDraft(data: BillLifecycleData): BillDraft {
    const snapshot = data.bill.billingSnapshot ?? {};
    const names = data.patient.name.trim().split(/\s+/);
    return { patient: { ...data.patient, firstName: data.patient.firstName ?? names[0] ?? "", lastName: data.patient.lastName ?? names.slice(1).join(" ") }, injury: { ...data.injury }, bill: { ...data.bill, lineItems: ensureTrailingProcedureLine(data.bill.lineItems) }, billingProvider: snapshot.billingProvider ?? { name: "", taxId: "", npi: "", billType: "Professional" as const }, clinician: snapshot.renderingProvider ?? { name: "", specialty: "", npi: "" }, location: snapshot.placeOfService ?? { name: "", street: "", city: "", state: "", zip: "", posCode: "11" } };
  }
  private normalizeLineItems(): void { if (this.draft) this.draft.bill.lineItems = ensureTrailingProcedureLine(this.draft.bill.lineItems); }
  private openBlob(blob: Blob, filename: string): void { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.target = "_blank"; link.rel = "noopener"; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
}
