import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MindBillAngularAppearance, mindBillAngularAppearanceStyle } from "./appearance";
import { treatmentDraftStyle } from "./treatment-draft-style";
import { treatmentDraftKey } from "./submission-treatment";
import { normalizeRfaDraft, RfaDraftInput, validateRfaDraft } from "./treatment-drafts";

/** Unsigned RFA preparation. The host callback owns persistence, signing, and delivery. */
@Component({
  selector: "mindbill-rfa-draft-form", standalone: true, imports: [CommonModule, FormsModule], styles: [treatmentDraftStyle],
  template: `@if (draft) { <form class="mbtd" [ngStyle]="theme" (ngSubmit)="save()" (input)="changed()" (change)="changed()">
    <h2>Prepare a request for authorization</h2><p>Save an unsigned draft for review.</p>
    <fieldset [disabled]="disabled || busy"><div class="mbtd-grid">
      <label>Employee<input [value]="draft.employeeName" readonly /></label>
      <label>Rendering provider<input [value]="draft.providerName" readonly /></label>
      <label>Request type<select name="requestType" [(ngModel)]="draft.requestType"><option value="new">New request</option><option value="resubmission_material_change">Resubmission with material change</option><option value="oral_authorization_confirmation">Confirm oral authorization</option></select></label>
      <label>Review type<select name="reviewType" [(ngModel)]="draft.reviewType"><option value="prospective">Prospective</option><option value="concurrent">Concurrent</option><option value="retrospective">Retrospective</option></select></label>
      <label>Return fax<input name="fax" [(ngModel)]="draft.providerFax" maxlength="30" /></label>
      <label class="mbtd-checkbox"><input type="checkbox" name="expedited" [(ngModel)]="draft.expedited" /> Expedited review requested</label>
    </div><label>Clinical rationale<textarea name="rationale" [(ngModel)]="draft.rationale" maxlength="20000"></textarea></label>
    @if (draft.requestType === 'resubmission_material_change') { <label>Material change<textarea name="materialChange" [(ngModel)]="draft.materialChange" maxlength="20000"></textarea></label> }
    @for (item of draft.items; track item; let i = $index) { <section><h3>Requested service {{ i + 1 }}</h3><div class="mbtd-grid">
      <label>Diagnosis code<input [name]="'diagnosis'+i" [(ngModel)]="item.diagnosisCode" maxlength="16" required /></label>
      <label>Procedure code<input [name]="'procedure'+i" [(ngModel)]="item.procedureCode" maxlength="16" /></label>
      <label>Quantity<input type="number" [name]="'quantity'+i" [ngModel]="item.quantity" (ngModelChange)="setNumber(i, 'quantity', $event)" min="0.001" max="100000" step="any" /></label>
      <label>Units<input type="number" [name]="'units'+i" [ngModel]="item.units" (ngModelChange)="setNumber(i, 'units', $event)" min="1" max="100000" step="1" /></label>
      <label>Frequency<input [name]="'frequency'+i" [(ngModel)]="item.frequency" maxlength="200" /></label>
      <label>Duration<input [name]="'duration'+i" [(ngModel)]="item.duration" maxlength="200" /></label>
      <label>Requested from<input type="date" [name]="'from'+i" [(ngModel)]="item.requestedFrom" /></label>
      <label>Requested through<input type="date" [name]="'to'+i" [(ngModel)]="item.requestedTo" /></label>
    </div><label>Service description<textarea [name]="'description'+i" [(ngModel)]="item.serviceDescription" maxlength="1000" required></textarea></label>
    <button type="button" (click)="removeItem(i)" [disabled]="draft.items.length === 1">Remove service</button></section> }
    <button type="button" (click)="addItem()" [disabled]="draft.items.length >= 100">Add service</button>
    <button type="submit">{{ busy ? 'Saving…' : 'Save draft' }}</button></fieldset>
    @if (error) { <p role="alert">{{ error }}</p> } @if (success) { <p role="status">Draft saved.</p> }
    <footer><a href="https://mindbill.org" target="_blank" rel="noopener noreferrer">Powered by MindBill</a></footer>
  </form> }`,
})
export class RfaDraftFormComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) initialDraft!: RfaDraftInput;
  @Input({ required: true }) onSave!: (draft: RfaDraftInput) => Promise<unknown>;
  @Input() disabled = false;
  @Input() appearance?: MindBillAngularAppearance;
  @Output() dirtyChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<RfaDraftInput>();
  @Output() saveError = new EventEmitter<Error>();
  draft?: RfaDraftInput;
  busy = false; error = ""; success = false;
  private initialKey = "";
  private generation = 0;
  private readonly detector = inject(ChangeDetectorRef);
  get theme() { return mindBillAngularAppearanceStyle(this.appearance); }
  ngOnChanges() { const key = treatmentDraftKey(this.initialDraft); if (this.initialDraft && key !== this.initialKey) { this.generation++; this.busy = false; this.initialKey = key; this.draft = normalizeRfaDraft(this.initialDraft); this.draft.requestType ??= "new"; this.draft.reviewType ??= "prospective"; this.error = ""; this.success = false; } }
  ngOnDestroy() { this.generation++; }
  changed() { this.success = false; this.dirtyChange.emit(true); }
  removeItem(index: number) { if (this.draft && this.draft.items.length > 1) { this.draft.items.splice(index, 1); this.changed(); } }
  addItem() { this.changed(); if (this.draft && this.draft.items.length < 100) this.draft.items.push({ diagnosisCode: "", serviceDescription: "" }); }
  setNumber(index: number, key: "quantity" | "units", value: number | null) { const item = this.draft?.items[index]; if (item) { if (value === null) delete item[key]; else item[key] = value; } }
  async save() {
    if (!this.draft || this.disabled || this.busy) return;
    const draft = normalizeRfaDraft(this.draft); this.error = validateRfaDraft(draft) ?? ""; this.success = false;
    if (this.error) return;
    const generation = this.generation; this.busy = true;
    try { await this.onSave(draft); if (generation !== this.generation) return; this.saved.emit(draft); this.dirtyChange.emit(false); this.success = true; }
    catch { if (generation !== this.generation) return; this.error = "Could not confirm the save. Reload the request before trying again."; this.saveError.emit(new Error(this.error)); }
    finally { if (generation === this.generation) { this.busy = false; this.detector.markForCheck(); } }
  }
}
