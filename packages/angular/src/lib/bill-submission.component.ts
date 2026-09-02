import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, EventEmitter, HostListener, inject, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  createBillReferenceClient,
  createBillSubmissionClient,
  type BillDiagnosisCode,
  type BillLifecycleSessionProvider,
  type BillReviewPayer,
  type BrowserBillCreateInput,
  type BrowserBillSubmissionDocument,
  type BrowserBillSubmissionInput,
  type BrowserBillSubmissionResult,
} from "@mindbill/browser";
import type { MindBillAngularAppearance } from "./bill-lifecycle.component";
import { MindBillComboBoxComponent, MindBillDateInputComponent, type MindBillComboOption } from "./submission-controls";
import { mindBillCustomProcedureOption, parseMindBillSubmissionDate } from "./submission-format";

export type MindBillSubmissionAttachment = Omit<BrowserBillSubmissionDocument, "contentBase64"> & {
  contentBase64?: string;
  contentUrl?: string;
  locked?: boolean;
  badge?: string;
};

export type MindBillSubmissionProcedureOption = {
  code: string;
  description: string;
  allowedAmount?: number;
};

export type MindBillSubmissionModifierOption = { code: string; description: string };
export type MindBillSubmissionTaxonomyOption = { code: string; description: string };

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_DOCUMENTS = 20;

const PROCEDURES: MindBillSubmissionProcedureOption[] = [
  { code: "ML200", description: "Missed appointment for a medical-legal evaluation", allowedAmount: 503.75 },
  { code: "ML201", description: "Comprehensive medical-legal evaluation", allowedAmount: 2015 },
  { code: "ML202", description: "Follow-up medical-legal evaluation", allowedAmount: 1316.25 },
  { code: "ML203", description: "Supplemental medical-legal evaluation", allowedAmount: 650 },
  { code: "ML204", description: "Medical-legal testimony", allowedAmount: 113.75 },
  { code: "ML205", description: "Review of sub rosa recordings", allowedAmount: 81.25 },
  { code: "MLPRR", description: "Medical-legal record review", allowedAmount: 3 },
  { code: "90791", description: "Psychiatric diagnostic evaluation" },
  { code: "90792", description: "Psychiatric diagnostic evaluation with medical services" },
  { code: "90832", description: "Psychotherapy, 30 minutes" },
  { code: "90834", description: "Psychotherapy, 45 minutes" },
  { code: "90837", description: "Psychotherapy, 60 minutes" },
  { code: "99203", description: "New patient office visit, level 3" },
  { code: "99204", description: "New patient office visit, level 4" },
  { code: "99205", description: "New patient office visit, level 5", allowedAmount: 349.48 },
  { code: "99213", description: "Established patient office visit, level 3" },
  { code: "99214", description: "Established patient office visit, level 4" },
  { code: "99215", description: "Established patient office visit, level 5" },
  { code: "96130", description: "Psychological testing evaluation, first hour" },
  { code: "96131", description: "Psychological testing evaluation, each additional hour", allowedAmount: 131.96 },
  { code: "97161", description: "Physical therapy evaluation, low complexity" },
  { code: "97162", description: "Physical therapy evaluation, moderate complexity" },
  { code: "97163", description: "Physical therapy evaluation, high complexity" },
  { code: "97110", description: "Therapeutic exercises" },
  { code: "97140", description: "Manual therapy techniques" },
  { code: "98940", description: "Chiropractic manipulative treatment, 1–2 regions" },
  { code: "98941", description: "Chiropractic manipulative treatment, 3–4 regions" },
  { code: "72141", description: "MRI cervical spine without contrast" },
  { code: "72148", description: "MRI lumbar spine without contrast" },
  { code: "73721", description: "MRI lower-extremity joint without contrast" },
  { code: "20610", description: "Major joint injection or aspiration" },
  { code: "99070", description: "Supplies and materials" },
];

const MODIFIERS: MindBillSubmissionModifierOption[] = [
  { code: "92", description: "Primary Treating Physician evaluation" },
  { code: "93", description: "Interpreter required" },
  { code: "94", description: "Agreed Medical Evaluator" },
  { code: "95", description: "Qualified Medical Evaluator" },
  { code: "96", description: "Psychiatric/psychological evaluation" },
  { code: "97", description: "Toxicology evaluation" },
  { code: "98", description: "Oncology evaluation" },
  { code: "59", description: "Distinct procedural service" },
  { code: "XE", description: "Separate encounter" },
  { code: "XS", description: "Separate structure" },
  { code: "XP", description: "Separate practitioner" },
  { code: "XU", description: "Unusual non-overlapping service" },
];

const TAXONOMIES: MindBillSubmissionTaxonomyOption[] = [
  { code: "103G00000X", description: "Clinical Neuropsychologist" },
  { code: "103T00000X", description: "Psychologist" },
  { code: "111N00000X", description: "Chiropractor" },
  { code: "207Q00000X", description: "Family Medicine" },
  { code: "207R00000X", description: "Internal Medicine" },
  { code: "207X00000X", description: "Orthopaedic Surgery" },
  { code: "207XS0117X", description: "Orthopaedic Surgery of the Spine" },
  { code: "208100000X", description: "Physical Medicine & Rehabilitation" },
  { code: "2083X0100X", description: "Occupational Medicine" },
  { code: "2084N0400X", description: "Neurology" },
  { code: "2084P0800X", description: "Psychiatry" },
  { code: "208VP0000X", description: "Pain Medicine" },
  { code: "213E00000X", description: "Podiatrist" },
  { code: "225100000X", description: "Physical Therapist" },
  { code: "225X00000X", description: "Occupational Therapist" },
  { code: "363A00000X", description: "Physician Assistant" },
  { code: "363L00000X", description: "Nurse Practitioner" },
];

const QUICK_DIAGNOSES: Array<BillDiagnosisCode & { label: string }> = [
  { label: "Psych", code: "Z04.6", description: "General psychiatric examination requested by authority" },
  { label: "Back", code: "M54.50", description: "Low back pain, unspecified" },
  { label: "Neck", code: "M54.2", description: "Cervicalgia" },
  { label: "Left hand", code: "M79.642", description: "Pain in left hand" },
  { label: "Right hand", code: "M79.641", description: "Pain in right hand" },
  { label: "Left knee", code: "M25.562", description: "Pain in left knee" },
  { label: "Right knee", code: "M25.561", description: "Pain in right knee" },
];

const THEME: Record<string, Record<string, string>> = {
  mindbill: { a: "#238dbd", ac: "#fff", bg: "#f3f8fa", s: "#fff", t: "#203743", m: "#657982", b: "#dbe6ea", r: "14px", cr: "8px", font: "Inter,system-ui,sans-serif" },
  "qme-companion": { a: "#53b5dc", ac: "#173542", bg: "#f2f8fb", s: "#fff", t: "#1d3440", m: "#617783", b: "#d7e5eb", r: "12px", cr: "8px", font: "Inter,system-ui,sans-serif" },
  "orange-bright": { a: "#f4510b", ac: "#fff", bg: "#fffaf6", s: "#fffefd", t: "#090f1f", m: "#626a73", b: "#e7e1da", r: "16px", cr: "10px", font: "Inter,system-ui,sans-serif" },
  "clinical-blue": { a: "#1677ff", ac: "#fff", bg: "#fff", s: "#fff", t: "#1f2d3d", m: "#66788a", b: "#d9e2ec", r: "8px", cr: "6px", font: "Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" },
};

function deepCopyBill(value: BrowserBillCreateInput): BrowserBillCreateInput {
  return JSON.parse(JSON.stringify(value)) as BrowserBillCreateInput;
}

function required(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of buffer) binary += String.fromCharCode(byte);
  return btoa(binary);
}

@Component({
  selector: "mindbill-bill-submission",
  standalone: true,
  imports: [CommonModule, FormsModule, MindBillComboBoxComponent, MindBillDateInputComponent],
  template: `
    <form class="mbs" [ngStyle]="themeStyle" (submit)="submit($event)" novalidate>
      <div class="intro"><div><h2>{{ heading }}</h2><p>{{ description }}</p></div><span><b>*</b> Required</span></div>

      <fieldset id="mbs-patient"><legend>Patient</legend><div class="grid">
        <label [class.invalid]="bad('patient.firstName')">First name <b>*</b><input name="firstName" [(ngModel)]="bill.patient.firstName"></label>
        <label [class.invalid]="bad('patient.lastName')">Last name <b>*</b><input name="lastName" [(ngModel)]="bill.patient.lastName"></label>
        <label [class.invalid]="bad('patient.dateOfBirth')">Date of birth <b>*</b><mindbill-date-input ariaLabel="Date of birth" [value]="bill.patient.dateOfBirth" (valueChange)="setDate('patient.dateOfBirth', $event)"/></label>
        <label>Phone (optional)<input name="phone" type="tel" [(ngModel)]="bill.patient.phone"></label>
        <label class="wide" [class.invalid]="bad('patient.address.line1')">Address <b>*</b><input name="address" [(ngModel)]="bill.patient.address.line1"></label>
        <label [class.invalid]="bad('patient.address.postalCode')">ZIP <b>*</b><input name="zip" [(ngModel)]="bill.patient.address.postalCode" (ngModelChange)="postalChanged($event)" inputmode="numeric">@if (postalStatus) { <small>{{ postalStatus }}</small> }</label>
        <label [class.invalid]="bad('patient.address.city')">City <b>*</b><input name="city" [(ngModel)]="bill.patient.address.city"></label>
        <label [class.invalid]="bad('patient.address.state')">State <b>*</b><input name="state" [(ngModel)]="bill.patient.address.state" maxlength="2"></label>
      </div></fieldset>

      <fieldset id="mbs-claim"><legend>Injury &amp; claim</legend><div class="grid">
        <label [class.invalid]="bad('service.date')">Date of service <b>*</b><mindbill-date-input ariaLabel="Date of service" [value]="bill.service.date" (valueChange)="setDate('service.date', $event)"/></label>
        <label [class.invalid]="bad('claim.dateOfInjury')">Date of injury <b>*</b><mindbill-date-input ariaLabel="Date of injury" [value]="bill.claim.dateOfInjury" (valueChange)="setDate('claim.dateOfInjury', $event)"/></label>
        <label class="wide">Treatment authorization # (optional)<input name="authNumber" [ngModel]="bill.service.authorizationNumber || ''" (ngModelChange)="setAuthorizationNumber($event)" placeholder="Utilization-review authorization number"><small>Rides on the bill as CMS-1500 Box 23 / 837 REF*G1.</small></label>
        <label [class.invalid]="bad('claim.claimNumber')">Claim number <b>*</b><input name="claimNumber" [(ngModel)]="bill.claim.claimNumber"></label>
        <label [class.invalid]="bad('claim.employer')">Employer <b>*</b><input name="employer" [(ngModel)]="bill.claim.employer"></label>
        <div class="wide lookup" [class.invalid]="bad('claim.claimsAdministrator')"><label>Claims administrator <b>*</b></label>
          <input name="payerQuery" [(ngModel)]="payerQuery" (focus)="searchPayers()" (input)="searchPayers()" placeholder="Search the MindBill payer directory…" autocomplete="off">
          @if (payerBusy) { <small>Searching directory…</small> }
          @if (payerResults.length) { <div class="options">@for (payer of payerResults; track payer.id) { <button type="button" (click)="selectPayer(payer)"><strong>{{ payer.name }}</strong><span>{{ payer.hasElectronic ? 'Electronic routing' : 'Paper / fax' }}@if (payer.confidence) { · {{ payer.confidence }} match }</span></button> }</div> }
          @if (bill.claim.claimsAdministrator.id) { <small class="selected">✓ Routed to {{ bill.claim.claimsAdministrator.name }}</small> }
        </div>
        <label class="wide">Injury description (optional)<input name="description" [(ngModel)]="bill.claim.description"></label>
        <div class="wide diagnosis" [class.invalid]="bad('diagnoses')"><label>Diagnosis codes (ICD-10) <b>*</b></label>
          <div class="quick">@for (item of quickDiagnoses; track item.code) { <button type="button" [class.on]="hasDiagnosis(item.code)" (click)="toggleDiagnosis(item)">{{ hasDiagnosis(item.code) ? '✓' : '+' }} {{ item.label }}</button> }</div>
          @if (bill.diagnoses.length) { <div class="chips">@for (code of bill.diagnoses; track code) { <button type="button" (click)="removeDiagnosis(code)"><strong>{{ code }}</strong> ×</button> }</div> }
          <input name="diagnosisQuery" [(ngModel)]="diagnosisQuery" (focus)="searchDiagnoses(true)" (input)="searchDiagnoses(true)" placeholder="Search ICD-10 codes…" autocomplete="off">
          @if (diagnosisBusy && !diagnosisResults.length) { <small>Searching ICD-10 directory…</small> }
          @if (diagnosisResults.length) { <div class="options diagnoses" (scroll)="diagnosisScrolled($event)">@for (item of diagnosisResults; track item.code) { <button type="button" (click)="addDiagnosis(item)"><strong>{{ item.code }}</strong><span>{{ item.description }}</span></button> }</div> }
        </div>
      </div></fieldset>

      <fieldset id="mbs-provider"><legend>Providers &amp; place of service</legend><div class="grid">
        <h3 class="wide">Billing provider</h3>
        <label [class.invalid]="bad('billingProvider.name')">Billing provider name <b>*</b><input name="billingProvider" [(ngModel)]="bill.billingProvider.name"></label>
        <label [class.invalid]="bad('billingProvider.taxId')">Tax ID <b>*</b><input name="taxId" [(ngModel)]="bill.billingProvider.taxId"></label>
        <label [class.invalid]="bad('billingProvider.npi')">Billing NPI <b>*</b><input name="billingNpi" [(ngModel)]="bill.billingProvider.npi" inputmode="numeric" maxlength="10"></label>
        <label [class.invalid]="bad('billingProvider.phone')">Billing phone <b>*</b><input name="billingPhone" type="tel" [(ngModel)]="bill.billingProvider.phone"></label>
        <label class="wide" [class.invalid]="bad('billingProvider.address.line1')">Billing address <b>*</b><input name="billingAddress" [(ngModel)]="bill.billingProvider.address.line1"></label>
        <label [class.invalid]="bad('billingProvider.address.postalCode')">Billing ZIP <b>*</b><input name="billingZip" [(ngModel)]="bill.billingProvider.address.postalCode" inputmode="numeric"></label>
        <label [class.invalid]="bad('billingProvider.address.city')">Billing city <b>*</b><input name="billingCity" [(ngModel)]="bill.billingProvider.address.city"></label>
        <label [class.invalid]="bad('billingProvider.address.state')">Billing state <b>*</b><input name="billingState" [(ngModel)]="bill.billingProvider.address.state" maxlength="2"></label>
        <h3 class="wide">Rendering provider</h3>
        <label [class.invalid]="bad('renderingProvider.name')">Rendering provider name <b>*</b><input name="renderingProvider" [(ngModel)]="bill.renderingProvider.name"></label>
        <label [class.invalid]="bad('renderingProvider.npi')">Rendering provider NPI <b>*</b><input name="renderingNpi" [(ngModel)]="bill.renderingProvider.npi" inputmode="numeric" maxlength="10"></label>
        <div class="wide" [class.invalid]="bad('renderingProvider.taxonomy')"><label>Rendering taxonomy <b>*</b></label>
          <mindbill-combo-box ariaLabel="Rendering taxonomy" [value]="bill.renderingProvider.taxonomy || ''" [invalid]="bad('renderingProvider.taxonomy')" [preserveValueOnOpen]="true" placeholder="Search specialty name or taxonomy code…" [options]="taxonomyComboOptions" [createOption]="customTaxonomyOption" (selected)="selectTaxonomy($event)"/>
          <small>Search by specialty name or 10-character taxonomy code.</small>
        </div>
        <h3 class="wide">Place of service</h3>
        <label [class.invalid]="bad('serviceLocation.placeOfServiceCode')">Place of service code <b>*</b><input name="pos" [(ngModel)]="bill.serviceLocation.placeOfServiceCode" placeholder="11" inputmode="numeric" maxlength="2"></label>
        <label class="wide" [class.invalid]="bad('serviceLocation.address.line1')">Service address <b>*</b><input name="serviceAddress" [(ngModel)]="bill.serviceLocation.address.line1"></label>
        <label [class.invalid]="bad('serviceLocation.address.postalCode')">Service ZIP <b>*</b><input name="serviceZip" [(ngModel)]="bill.serviceLocation.address.postalCode" inputmode="numeric"></label>
        <label [class.invalid]="bad('serviceLocation.address.city')">Service city <b>*</b><input name="serviceCity" [(ngModel)]="bill.serviceLocation.address.city"></label>
        <label [class.invalid]="bad('serviceLocation.address.state')">Service state <b>*</b><input name="serviceState" [(ngModel)]="bill.serviceLocation.address.state" maxlength="2"></label>
      </div></fieldset>

      <fieldset id="mbs-lines" [class.invalid-set]="bad('serviceLines')"><legend>Service lines</legend>
        <div class="line-head"><span>Procedure code *</span><span>Modifiers</span><span>Dx</span><span>Units *</span><span>Allowed</span><span></span></div>
        @for (line of bill.serviceLines; track $index; let index = $index) { <div class="service-line">
          <div class="cell"><span class="mobile-label">Procedure</span>
            <mindbill-combo-box [ariaLabel]="'Procedure code ' + (index + 1)" [value]="line.code" placeholder="Search or enter code…" [options]="procedureComboOptions" [createOption]="customProcedureOption" (selected)="selectProcedure(index, $event)"/>
            @if (line.code) { <small>{{ procedureDescription(line.code) || 'Custom CPT, HCPCS, or medical-legal code' }}</small> }
          </div>
          <div class="cell"><span class="mobile-label">Modifiers</span>
            @if (line.modifiers?.length) { <div class="chips">@for (modifier of line.modifiers; track modifier) { <button type="button" (click)="removeModifier(index, modifier)" [attr.aria-label]="'Remove modifier ' + modifier">−{{ modifier }} ×</button> }</div> }
            <mindbill-combo-box [ariaLabel]="'Modifiers ' + (index + 1)" value="" [placeholder]="line.modifiers?.length ? line.modifiers!.length + ' modifier' + (line.modifiers!.length === 1 ? '' : 's') : 'Add modifiers…'" [options]="modifierComboOptions(line)" (selected)="addModifier(index, $event)"/>
          </div>
          <div class="cell"><span class="mobile-label">Dx pointers</span>
            <div class="dx">
              @if (bill.diagnoses.length) {
                @for (code of bill.diagnoses; track code; let dxIndex = $index) {
                  <button type="button" [class.on]="hasDiagnosisPointer(line, dxIndex + 1)" [title]="dxLetter(dxIndex + 1) + ' — ' + code" [attr.aria-pressed]="hasDiagnosisPointer(line, dxIndex + 1)" [attr.aria-label]="'Point line ' + (index + 1) + ' at diagnosis ' + code" (click)="toggleDiagnosisPointer(index, dxIndex + 1)">{{ dxLetter(dxIndex + 1) }}</button>
                }
              } @else { <small>Add diagnoses above</small> }
            </div>
          </div>
          <label><span class="mobile-label">Units</span><input [name]="'units'+index" type="number" min="1" [(ngModel)]="line.units"></label>
          <strong>{{ allowed(line) == null ? '—' : (allowed(line) | currency) }}</strong>
          <button class="remove" type="button" (click)="removeLine(index)" aria-label="Remove service line">×</button>
        </div> }
        <div class="total"><span>Total</span><strong>{{ totalAllowed | currency }}</strong></div>
      </fieldset>

      <fieldset><legend>Attachments</legend>
        @for (attachment of workingAttachments; track attachment.filename; let index = $index) { <div class="attachment" [class.locked]="attachment.locked"><div><strong>{{ attachment.filename }}</strong><span>{{ attachment.description || attachment.badge || 'Supporting document' }}</span></div><div class="attachment-actions"><button type="button" (click)="previewAttachment(attachment)">Preview</button>@if (!attachment.locked) { <button type="button" (click)="removeAttachment(index)" aria-label="Remove attachment">×</button> }</div></div> }
        <label class="dropzone" [class.drag-active]="dragActive"><input type="file" accept="application/pdf,.pdf" multiple (change)="filesSelected($event)"><strong>Drop additional PDF files here, or click to choose</strong><span>Add supporting documents by dropping them anywhere on this screen.</span></label>
      </fieldset>

      @if (errorMessage) { <div class="error" role="alert">{{ errorMessage }}</div> }
      <div class="submit-row"><span>{{ invalidFields.size ? 'Complete the highlighted required fields.' : 'All required billing data is ready.' }}</span><button type="submit" [disabled]="submitting">{{ submitting ? 'Submitting…' : submitLabel }}</button></div>
      @if (dragActive) { <div class="drop-overlay" aria-hidden="true"><div><strong>Drop PDFs to attach</strong><span>Supporting documents are added to this submission.</span></div></div> }
    </form>
  `,
  styles: [`
    :host{display:block}.mbs{--danger:#c83c3c;font-family:var(--font);color:var(--t)}*{box-sizing:border-box}.intro{display:flex;justify-content:space-between;align-items:start;margin:0 0 24px}.intro h2{margin:0;font-size:24px;font-weight:600}.intro p{margin:6px 0 0;color:var(--m)}.intro>span{color:var(--m);font-size:13px}.mbs b{color:inherit}.intro b,label>b,.lookup>label>b,.diagnosis>label>b,.cell>label>b{color:var(--danger)}fieldset{border:1px solid var(--b);border-radius:var(--r);margin:0 0 22px;padding:24px 26px 26px;background:var(--s)}legend{padding:0 10px;font-size:18px;font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px 28px}.wide{grid-column:1/-1}h3{margin:4px 0 -4px;padding-top:12px;border-top:1px solid var(--b);font-size:16px}h3:first-child{border:0;padding-top:0}label,.lookup,.diagnosis{display:grid;gap:8px;font-size:14px;font-weight:700}.grid>label{display:flex;flex-wrap:wrap;align-content:start;align-items:center;column-gap:4px;row-gap:8px}.grid>label>input,.grid>label>select,.grid>label>small,.grid>label>mindbill-date-input{flex:0 0 100%}.grid>div.wide{display:grid;gap:8px;font-size:14px;font-weight:700}input,select{width:100%;min-height:46px;border:1px solid var(--b);border-radius:var(--cr);background:var(--s);padding:10px 12px;color:var(--t);font:inherit;font-weight:450}input:focus,select:focus{outline:3px solid color-mix(in srgb,var(--a) 22%,transparent);border-color:var(--a)}.invalid input,.invalid select,.invalid-set{border-color:var(--danger)!important;background:color-mix(in srgb,var(--danger) 4%,var(--s))}.invalid>label{color:var(--danger)}small{color:var(--m);font-weight:450}.selected{color:#238655}.options{position:relative;z-index:4;max-height:300px;overflow:auto;border:1px solid var(--b);border-radius:var(--cr);background:var(--s);box-shadow:0 14px 35px #172b3730}.options button{display:grid;width:100%;gap:3px;border:0;border-bottom:1px solid var(--b);background:var(--s);padding:12px 14px;text-align:left;color:var(--t);cursor:pointer}.options button:hover{background:color-mix(in srgb,var(--a) 7%,var(--s))}.options span{color:var(--m);font-size:12px}.quick,.chips{display:flex;flex-wrap:wrap;gap:8px}.quick button,.chips button{border:1px solid var(--b);border-radius:999px;background:var(--s);padding:7px 11px;color:var(--t);font:inherit;font-size:13px;cursor:pointer}.quick .on{border-color:var(--a);color:var(--a);background:color-mix(in srgb,var(--a) 8%,var(--s))}.chips button{border-color:color-mix(in srgb,var(--a) 40%,var(--b));background:color-mix(in srgb,var(--a) 7%,var(--s));font-weight:700}.dx{display:flex;flex-wrap:wrap;gap:5px;padding-top:6px}.dx button{width:30px;height:30px;border:1px solid var(--b);border-radius:8px;background:var(--s);color:var(--m);font:inherit;font-size:13px;font-weight:750;cursor:pointer;padding:0}.dx button.on{border-color:var(--a);background:color-mix(in srgb,var(--a) 10%,var(--s));color:var(--a)}.line-head,.service-line{display:grid;grid-template-columns:1.5fr 1.35fr .8fr .5fr .7fr 36px;gap:14px;align-items:start}.line-head{padding:0 0 9px;color:var(--m);font-size:12px;font-weight:700}.service-line{border-top:1px solid var(--b);padding:12px 0}.service-line label,.service-line .cell{display:grid;gap:6px;font-size:14px;font-weight:700}.service-line strong{text-align:right;padding-top:12px}.remove{border:0;background:transparent;color:var(--m);font-size:25px;cursor:pointer}.mobile-label{display:none}.total{display:flex;justify-content:flex-end;gap:36px;border-top:1px solid var(--b);padding-top:14px;font-size:17px}.attachment{display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid var(--b);border-radius:var(--cr);margin-bottom:10px;padding:14px 16px}.attachment.locked{border-color:#9fd6b4;background:#f3fcf6}.attachment>div:first-child{display:grid;gap:4px}.attachment span{color:var(--m);font-size:13px}.attachment-actions{display:flex;gap:8px}.attachment button{border:1px solid var(--b);border-radius:var(--cr);background:var(--s);padding:8px 12px;color:var(--t);font-weight:700;cursor:pointer}.dropzone{position:relative;display:grid;min-height:170px;place-content:center;gap:8px;border:2px dashed color-mix(in srgb,var(--m) 60%,transparent);border-radius:var(--cr);text-align:center;cursor:pointer;transition:border-color .15s,background .15s}.dropzone.drag-active{border-color:var(--a);background:color-mix(in srgb,var(--a) 8%,var(--s))}.dropzone input{position:absolute;inset:0;opacity:0;cursor:pointer}.dropzone span{color:var(--m);font-weight:450}.drop-overlay{position:fixed;inset:0;z-index:60;display:grid;place-content:center;background:color-mix(in srgb,var(--a) 14%,#ffffffd9);pointer-events:none}.drop-overlay div{display:grid;gap:6px;border:2px dashed var(--a);border-radius:var(--r);background:var(--s);padding:34px 44px;text-align:center;box-shadow:0 24px 60px #172b3740}.drop-overlay strong{font-size:19px}.drop-overlay span{color:var(--m)}.error{margin:0 0 14px;border-left:4px solid var(--danger);border-radius:var(--cr);background:color-mix(in srgb,var(--danger) 10%,var(--s));padding:14px;color:var(--danger)}.submit-row{position:sticky;bottom:0;z-index:3;display:flex;align-items:center;justify-content:space-between;border:1px solid var(--b);border-radius:var(--r);background:color-mix(in srgb,var(--s) 96%,transparent);box-shadow:0 -8px 24px #172b3718;padding:14px 18px}.submit-row>span{color:#43835f}.submit-row button{min-width:190px;border:0;border-radius:var(--cr);background:var(--a);color:var(--ac);padding:12px 24px;font:inherit;font-weight:800;cursor:pointer}.submit-row button:disabled{opacity:.6;cursor:wait}
    @media(max-width:760px){fieldset{padding:18px 16px}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.intro{display:grid;gap:10px}.line-head{display:none}.service-line{grid-template-columns:1fr 1fr}.service-line>*{grid-column:1/-1}.service-line label:nth-child(3){grid-column:1}.service-line>strong{grid-column:2;grid-row:3;text-align:left}.service-line>.remove{grid-column:1/-1}.mobile-label{display:block;color:var(--m);font-size:12px}.attachment{align-items:flex-start}.attachment-actions{align-items:center}.submit-row>span{display:none}.submit-row button{width:100%}}
  `],
})
export class MindBillBillSubmissionComponent implements OnChanges {
  @Input() initialBill!: BrowserBillCreateInput;
  @Input() attachments: MindBillSubmissionAttachment[] = [];
  @Input() appearance: MindBillAngularAppearance = { preset: "mindbill" };
  @Input() sessionEndpoint = "/api/mindbill/session";
  @Input() getSession?: BillLifecycleSessionProvider;
  @Input() apiBaseUrl?: string;
  @Input() heading = "Bill information";
  @Input() description = "Review the bill details, add attachments, and submit.";
  @Input() submitLabel = "Submit bill";
  @Input() procedureOptions: MindBillSubmissionProcedureOption[] = PROCEDURES;
  @Input() modifierOptions: MindBillSubmissionModifierOption[] = MODIFIERS;
  @Input() taxonomyOptions: MindBillSubmissionTaxonomyOption[] = TAXONOMIES;
  @Input() submitter?: (input: BrowserBillSubmissionInput) => Promise<BrowserBillSubmissionResult>;
  @Output() submitted = new EventEmitter<BrowserBillSubmissionResult>();
  @Output() submissionError = new EventEmitter<Error>();
  @Output() billChange = new EventEmitter<BrowserBillCreateInput>();

  bill = {} as BrowserBillCreateInput;
  workingAttachments: MindBillSubmissionAttachment[] = [];
  payerQuery = "";
  payerResults: BillReviewPayer[] = [];
  payerBusy = false;
  diagnosisQuery = "";
  diagnosisResults: BillDiagnosisCode[] = [];
  diagnosisOffset = 0;
  diagnosisBusy = false;
  submitting = false;
  errorMessage = "";
  postalStatus = "";
  dragActive = false;
  invalidFields = new Set<string>();
  readonly quickDiagnoses = QUICK_DIAGNOSES;
  // Zoneless-safe rendering: async work (debounced lookups, fetches, file reads)
  // must schedule change detection explicitly for zone-less Angular hosts.
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly customProcedureOption = mindBillCustomProcedureOption;
  readonly customTaxonomyOption = (query: string): MindBillComboOption | null => {
    const code = query.trim().toUpperCase();
    return /^[A-Z0-9]{10}$/.test(code) ? { id: code, label: code, detail: "Use this taxonomy code" } : null;
  };
  private searchTimer?: ReturnType<typeof setTimeout>;
  private postalTimer?: ReturnType<typeof setTimeout>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["initialBill"] && this.initialBill) {
      this.bill = deepCopyBill(this.initialBill);
      if (!this.bill.serviceLines.length) this.bill.serviceLines = [{ code: "", units: 1 }];
      this.ensureTrailingLine();
      this.payerQuery = this.bill.claim.claimsAdministrator.name ?? "";
    }
    if (changes["attachments"]) this.workingAttachments = this.attachments.map((item) => ({ ...item }));
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

  get procedureComboOptions(): MindBillComboOption[] {
    return this.procedureOptions.map((item) => ({ id: item.code, label: item.code, detail: item.description }));
  }

  get taxonomyComboOptions(): MindBillComboOption[] {
    return this.taxonomyOptions.map((item) => ({ id: item.code, label: item.description, detail: item.code }));
  }

  modifierComboOptions(line: BrowserBillCreateInput["serviceLines"][number]): MindBillComboOption[] {
    return this.modifierOptions
      .filter((item) => !(line.modifiers ?? []).includes(item.code))
      .map((item) => ({ id: item.code, label: `−${item.code}`, detail: item.description }));
  }

  private referenceClient() {
    return createBillReferenceClient({ sessionEndpoint: this.sessionEndpoint, ...(this.getSession ? { getSession: this.getSession } : {}), ...(this.apiBaseUrl ? { apiBaseUrl: this.apiBaseUrl } : {}) });
  }

  setDate(path: "patient.dateOfBirth" | "service.date" | "claim.dateOfInjury", value: string): void {
    if (path === "patient.dateOfBirth") this.bill.patient.dateOfBirth = value;
    else if (path === "service.date") this.bill.service.date = value;
    else this.bill.claim.dateOfInjury = value;
    if (value) this.invalidFields.delete(path);
    this.billChange.emit(this.bill);
  }

  postalChanged(value: string): void {
    clearTimeout(this.postalTimer);
    this.postalStatus = "";
    if (!/^\d{5}$/.test(value.trim())) return;
    this.postalStatus = "Looking up ZIP…";
    this.postalTimer = setTimeout(async () => {
      try {
        const place = await this.referenceClient().lookupPostalCode(value);
        if (place) {
          this.bill.patient.address.city = place.city;
          this.bill.patient.address.state = place.state.toUpperCase();
          this.postalStatus = `${place.city}, ${place.state.toUpperCase()} filled from ZIP`;
          this.invalidFields.delete("patient.address.city");
          this.invalidFields.delete("patient.address.state");
          this.billChange.emit(this.bill);
        } else {
          this.postalStatus = "ZIP not found";
        }
      } catch {
        this.postalStatus = "ZIP lookup unavailable";
      }
      this.changeDetector.markForCheck();
    }, 180);
  }

  searchPayers(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(async () => {
      this.payerBusy = true;
      try { this.payerResults = await this.referenceClient().searchClaimsAdministrators(this.payerQuery, this.bill.claim.claimNumber); }
      catch { this.payerResults = []; }
      finally { this.payerBusy = false; this.changeDetector.markForCheck(); }
    }, 180);
  }

  selectPayer(payer: BillReviewPayer): void {
    this.bill.claim.claimsAdministrator = { id: payer.id, name: payer.name };
    this.payerQuery = payer.name;
    this.payerResults = [];
    this.invalidFields.delete("claim.claimsAdministrator");
    this.billChange.emit(this.bill);
  }

  searchDiagnoses(reset: boolean): void {
    if (this.diagnosisBusy) return;
    if (reset) { this.diagnosisOffset = 0; this.diagnosisResults = []; }
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(async () => {
      this.diagnosisBusy = true;
      try {
        const results = await this.referenceClient().searchDiagnosisCodes(this.diagnosisQuery, 60, this.diagnosisOffset);
        this.diagnosisResults = reset ? results : [...this.diagnosisResults, ...results];
        this.diagnosisOffset = this.diagnosisResults.length;
      } catch { if (reset) this.diagnosisResults = []; }
      finally { this.diagnosisBusy = false; this.changeDetector.markForCheck(); }
    }, reset ? 160 : 0);
  }

  diagnosisScrolled(event: Event): void {
    const element = event.currentTarget as HTMLElement;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 80) this.searchDiagnoses(false);
  }

  hasDiagnosis(code: string): boolean { return this.bill.diagnoses.includes(code); }
  toggleDiagnosis(item: BillDiagnosisCode): void {
    if (this.hasDiagnosis(item.code)) this.removeDiagnosis(item.code);
    else this.addDiagnosis(item);
  }
  addDiagnosis(item: BillDiagnosisCode): void { if (!this.hasDiagnosis(item.code)) this.bill.diagnoses.push(item.code); this.diagnosisQuery = ""; this.diagnosisResults = []; this.invalidFields.delete("diagnoses"); this.billChange.emit(this.bill); }
  removeDiagnosis(code: string): void { this.bill.diagnoses = this.bill.diagnoses.filter((item) => item !== code); this.billChange.emit(this.bill); }

  ensureTrailingLine(): void {
    const last = this.bill.serviceLines.at(-1);
    if (!last || last.code.trim()) this.bill.serviceLines.push({ code: "", units: 1 });
    this.billChange.emit(this.bill);
  }
  removeLine(index: number): void { this.bill.serviceLines.splice(index, 1); if (!this.bill.serviceLines.length) this.bill.serviceLines.push({ code: "", units: 1 }); this.ensureTrailingLine(); }
  selectProcedure(index: number, option: MindBillComboOption): void {
    this.bill.serviceLines[index]!.code = option.id;
    this.invalidFields.delete("serviceLines");
    this.ensureTrailingLine();
  }
  addModifier(index: number, option: MindBillComboOption): void {
    const line = this.bill.serviceLines[index]!;
    line.modifiers = [...new Set([...(line.modifiers ?? []), option.id])];
    this.billChange.emit(this.bill);
  }
  removeModifier(index: number, modifier: string): void {
    const line = this.bill.serviceLines[index]!;
    line.modifiers = (line.modifiers ?? []).filter((item) => item !== modifier);
    this.billChange.emit(this.bill);
  }
  dxLetter(pointer: number): string { return String.fromCharCode(64 + pointer); }
  hasDiagnosisPointer(line: BrowserBillCreateInput["serviceLines"][number], pointer: number): boolean {
    return (line.diagnosisPointers ?? []).includes(pointer);
  }
  toggleDiagnosisPointer(index: number, pointer: number): void {
    const line = this.bill.serviceLines[index]!;
    line.diagnosisPointers = this.hasDiagnosisPointer(line, pointer)
      ? (line.diagnosisPointers ?? []).filter((item) => item !== pointer)
      : [...(line.diagnosisPointers ?? []), pointer].sort((left, right) => left - right);
    this.billChange.emit(this.bill);
  }
  setAuthorizationNumber(value: string): void {
    this.bill.service.authorizationNumber = value.trim() ? value : null;
    this.billChange.emit(this.bill);
  }
  selectTaxonomy(option: MindBillComboOption): void {
    this.bill.renderingProvider.taxonomy = option.id;
    this.invalidFields.delete("renderingProvider.taxonomy");
    this.billChange.emit(this.bill);
  }
  procedureDescription(code: string): string { return this.procedureOptions.find((item) => item.code.toLowerCase() === code.trim().toLowerCase())?.description ?? ""; }
  allowed(line: BrowserBillCreateInput["serviceLines"][number]): number | null { const base = this.procedureOptions.find((item) => item.code.toLowerCase() === line.code.trim().toLowerCase())?.allowedAmount; return base == null ? (line.charge ?? null) : Math.round(base * Math.max(1, line.units ?? 1) * 100) / 100; }
  get totalAllowed(): number { return this.bill.serviceLines.reduce((sum, line) => sum + (this.allowed(line) ?? 0), 0); }

  @HostListener("window:dragover", ["$event"])
  onWindowDragOver(event: DragEvent): void {
    if (event.dataTransfer?.types.includes("Files")) { event.preventDefault(); this.dragActive = true; this.changeDetector.markForCheck(); }
  }
  @HostListener("window:dragleave", ["$event"])
  onWindowDragLeave(event: DragEvent): void {
    if (!event.relatedTarget) { this.dragActive = false; this.changeDetector.markForCheck(); }
  }
  @HostListener("window:drop", ["$event"])
  onWindowDrop(event: DragEvent): void {
    if (event.dataTransfer?.files.length) { event.preventDefault(); this.dragActive = false; void this.addFiles(event.dataTransfer.files); this.changeDetector.markForCheck(); }
  }

  private async addFiles(fileList: FileList | File[]): Promise<void> {
    const files = Array.from(fileList);
    if (!files.length) return;
    this.errorMessage = "";
    const invalid = files.find((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"));
    if (invalid) { this.errorMessage = `${invalid.name} is not a PDF.`; return; }
    const oversized = files.find((file) => file.size > MAX_PDF_BYTES);
    if (oversized) { this.errorMessage = `${oversized.name} is larger than 25 MB.`; return; }
    if (this.workingAttachments.length + files.length > MAX_DOCUMENTS) { this.errorMessage = `A bill can include at most ${MAX_DOCUMENTS} attachments.`; return; }
    const existingBytes = this.workingAttachments.reduce((sum, item) => sum + (item.contentBase64 ? item.contentBase64.length * 0.75 : 0), 0);
    if (existingBytes + files.reduce((sum, file) => sum + file.size, 0) > MAX_UPLOAD_BYTES) { this.errorMessage = "Attachments exceed the 100 MB upload limit."; return; }
    for (const file of files) this.workingAttachments.push({ filename: file.name, description: "Supporting document", documentType: "other", contentBase64: await blobToBase64(file), contentUrl: URL.createObjectURL(file) });
    this.changeDetector.markForCheck();
  }

  async filesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    await this.addFiles(input.files ?? []);
    input.value = "";
  }
  removeAttachment(index: number): void { const item = this.workingAttachments[index]; if (item?.contentUrl?.startsWith("blob:")) URL.revokeObjectURL(item.contentUrl); this.workingAttachments.splice(index, 1); }
  previewAttachment(attachment: MindBillSubmissionAttachment): void { if (attachment.contentUrl) window.open(attachment.contentUrl, "_blank", "noopener,noreferrer"); else if (attachment.contentBase64) window.open(`data:application/pdf;base64,${attachment.contentBase64}`, "_blank", "noopener,noreferrer"); }

  bad(path: string): boolean { return this.invalidFields.has(path); }
  private validate(): boolean {
    const candidates: Array<[string, unknown]> = [
      ["patient.firstName", this.bill.patient.firstName], ["patient.lastName", this.bill.patient.lastName], ["patient.dateOfBirth", parseMindBillSubmissionDate(this.bill.patient.dateOfBirth ?? "")],
      ["patient.address.line1", this.bill.patient.address.line1], ["patient.address.city", this.bill.patient.address.city], ["patient.address.state", this.bill.patient.address.state], ["patient.address.postalCode", this.bill.patient.address.postalCode],
      ["service.date", parseMindBillSubmissionDate(this.bill.service.date ?? "")], ["claim.dateOfInjury", parseMindBillSubmissionDate(this.bill.claim.dateOfInjury ?? "")], ["claim.claimNumber", this.bill.claim.claimNumber], ["claim.employer", this.bill.claim.employer],
      ["claim.claimsAdministrator", this.bill.claim.claimsAdministrator.id], ["diagnoses", this.bill.diagnoses.length],
      ["billingProvider.name", this.bill.billingProvider.name], ["billingProvider.taxId", this.bill.billingProvider.taxId], ["billingProvider.npi", this.bill.billingProvider.npi], ["billingProvider.phone", this.bill.billingProvider.phone],
      ["billingProvider.address.line1", this.bill.billingProvider.address.line1], ["billingProvider.address.city", this.bill.billingProvider.address.city], ["billingProvider.address.state", this.bill.billingProvider.address.state], ["billingProvider.address.postalCode", this.bill.billingProvider.address.postalCode],
      ["renderingProvider.name", this.bill.renderingProvider.name], ["renderingProvider.npi", this.bill.renderingProvider.npi], ["renderingProvider.taxonomy", this.bill.renderingProvider.taxonomy],
      ["serviceLocation.placeOfServiceCode", this.bill.serviceLocation.placeOfServiceCode], ["serviceLocation.address.line1", this.bill.serviceLocation.address.line1], ["serviceLocation.address.city", this.bill.serviceLocation.address.city], ["serviceLocation.address.state", this.bill.serviceLocation.address.state], ["serviceLocation.address.postalCode", this.bill.serviceLocation.address.postalCode],
      ["serviceLines", this.bill.serviceLines.some((line) => required(line.code) && (line.units ?? 1) > 0)],
    ];
    this.invalidFields = new Set(candidates.filter(([, value]) => !value || !required(value)).map(([path]) => path));
    if (this.invalidFields.size) {
      this.errorMessage = `Complete ${this.invalidFields.size} highlighted required field${this.invalidFields.size === 1 ? "" : "s"} before submitting.`;
      setTimeout(() => document.querySelector(".mbs .invalid,.mbs .invalid-set")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return false;
    }
    return true;
  }

  private async submissionDocuments(): Promise<BrowserBillSubmissionDocument[]> {
    const documents: BrowserBillSubmissionDocument[] = [];
    for (const attachment of this.workingAttachments) {
      let contentBase64 = attachment.contentBase64;
      if (!contentBase64 && attachment.contentUrl) {
        const response = await fetch(attachment.contentUrl);
        if (!response.ok) throw new Error(`Could not load ${attachment.filename}.`);
        contentBase64 = await blobToBase64(await response.blob());
      }
      if (!contentBase64) continue;
      documents.push({
        filename: attachment.filename,
        documentType: attachment.documentType,
        contentBase64,
        ...(attachment.externalId ? { externalId: attachment.externalId } : {}),
        ...(attachment.description ? { description: attachment.description } : {}),
        ...(attachment.reportTypeCode ? { reportTypeCode: attachment.reportTypeCode } : {}),
      });
    }
    return documents;
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage = "";
    if (!this.validate()) return;
    this.submitting = true;
    try {
      const bill = deepCopyBill(this.bill);
      bill.patient.dateOfBirth = parseMindBillSubmissionDate(bill.patient.dateOfBirth ?? "") ?? bill.patient.dateOfBirth;
      bill.service.date = parseMindBillSubmissionDate(bill.service.date ?? "") ?? bill.service.date;
      bill.claim.dateOfInjury = parseMindBillSubmissionDate(bill.claim.dateOfInjury ?? "") ?? bill.claim.dateOfInjury;
      bill.serviceLines = bill.serviceLines
        .filter((line) => line.code.trim())
        .map((line) => {
          const charge = line.charge ?? this.allowed(line);
          return charge == null ? line : { ...line, charge };
        });
      const input: BrowserBillSubmissionInput = { bill, documents: await this.submissionDocuments() };
      const result = this.submitter
        ? await this.submitter(input)
        : await createBillSubmissionClient({ sessionEndpoint: this.sessionEndpoint, ...(this.getSession ? { getSession: this.getSession } : {}), ...(this.apiBaseUrl ? { apiBaseUrl: this.apiBaseUrl } : {}) }).submitBill(input);
      this.submitted.emit(result);
    } catch (value) {
      const error = value instanceof Error ? value : new Error("The bill could not be submitted.");
      this.errorMessage = error.message;
      this.submissionError.emit(error);
    } finally { this.submitting = false; this.changeDetector.markForCheck(); }
  }
}
