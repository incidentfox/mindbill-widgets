import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MindBillAngularAppearance, mindBillAngularAppearanceStyle } from "./appearance";
import { treatmentDraftStyle } from "./treatment-draft-style";
import { treatmentDraftKey } from "./submission-treatment";
import { MindBillComboBoxComponent, type MindBillComboOption } from "./submission-controls";
import { RfaCodeLookup, customRfaDiagnosis, customRfaProcedure, type MindBillRfaCodeSearch } from "./rfa-code-lookup";
import { normalizeRfaDraft, RfaDraftInput, validateRfaDraft } from "./treatment-drafts";

/** Unsigned RFA preparation. The host callback owns persistence, signing, and delivery. */
@Component({
  selector: "mindbill-rfa-draft-form", standalone: true, imports: [CommonModule, FormsModule, MindBillComboBoxComponent], styles: [treatmentDraftStyle],
  template: `@if (draft) { <form class="mbtd" [ngStyle]="theme" (ngSubmit)="save()">
    <h2>Prepare a request for authorization</h2><p>Save an unsigned draft for review.</p>
    <fieldset [disabled]="disabled || busy"><div class="mbtd-grid">
      <label>Employee<input [value]="draft.employeeName" readonly /></label>
      <label>Rendering provider<input [value]="draft.providerName" readonly /></label>
      <label>Request type<select name="requestType" [(ngModel)]="draft.requestType" (ngModelChange)="changed()"><option value="new">New request</option><option value="resubmission_material_change">Resubmission with material change</option><option value="oral_authorization_confirmation">Confirm oral authorization</option></select></label>
      <label>Review type<select name="reviewType" [(ngModel)]="draft.reviewType" (ngModelChange)="changed()"><option value="prospective">Prospective</option><option value="concurrent">Concurrent</option><option value="retrospective">Retrospective</option></select></label>
      <label>Return fax<input name="fax" [(ngModel)]="draft.providerFax" (ngModelChange)="changed()" maxlength="30" /></label>
      <label class="mbtd-checkbox"><input type="checkbox" name="expedited" [(ngModel)]="draft.expedited" (ngModelChange)="changed()" /> Expedited review requested</label>
    </div><label>Clinical rationale<textarea name="rationale" [(ngModel)]="draft.rationale" (ngModelChange)="changed()" maxlength="20000"></textarea></label>
    @if (draft.requestType === 'resubmission_material_change') { <label>Material change<textarea name="materialChange" [(ngModel)]="draft.materialChange" (ngModelChange)="changed()" maxlength="20000"></textarea></label> }
    @for (item of draft.items; track item; let i = $index) { <section><h3>Requested service {{ i + 1 }}</h3><div class="mbtd-grid">
      <div><label>Diagnosis (ICD-10)</label><mindbill-combo-box [ariaLabel]="'Diagnosis ' + (i + 1)" [value]="item.diagnosisCode" placeholder="Search code or diagnosis description…" [options]="lookup(item, 'diagnosis').options" [loading]="lookup(item, 'diagnosis').loading" [disabled]="disabled || busy" [filterOptions]="false" [createOption]="customDiagnosis" (opened)="searchCode(item, 'diagnosis', '')" (queryChange)="searchCode(item, 'diagnosis', $event)" (selected)="selectCode(item, 'diagnosis', $event)" />
        @if (lookup(item, 'diagnosis').error) { <small role="status">{{ lookup(item, 'diagnosis').error }}</small> }</div>
      <div><label>Procedure (CPT / HCPCS)</label><mindbill-combo-box [ariaLabel]="'Procedure ' + (i + 1)" [value]="item.procedureCode ?? ''" placeholder="Search code or procedure description…" [options]="lookup(item, 'procedure').options" [loading]="lookup(item, 'procedure').loading" [disabled]="disabled || busy" [filterOptions]="false" [createOption]="customProcedure" (opened)="searchCode(item, 'procedure', '')" (queryChange)="searchCode(item, 'procedure', $event)" (selected)="selectCode(item, 'procedure', $event)" />
        @if (item.procedureCode) { <button type="button" (click)="clearProcedure(item)">Clear procedure</button> }
        @if (lookup(item, 'procedure').error) { <small role="status">{{ lookup(item, 'procedure').error }}</small> }</div>
      <label>Quantity<input type="number" [name]="'quantity'+i" [ngModel]="item.quantity" (ngModelChange)="setNumber(i, 'quantity', $event)" min="0.001" max="100000" step="any" /></label>
      <label>Units<input type="number" [name]="'units'+i" [ngModel]="item.units" (ngModelChange)="setNumber(i, 'units', $event)" min="1" max="100000" step="1" /></label>
      <label>Frequency<input [name]="'frequency'+i" [(ngModel)]="item.frequency" (ngModelChange)="changed()" maxlength="200" /></label>
      <label>Duration<input [name]="'duration'+i" [(ngModel)]="item.duration" (ngModelChange)="changed()" maxlength="200" /></label>
      <label>Requested from<input type="date" [name]="'from'+i" [(ngModel)]="item.requestedFrom" (ngModelChange)="changed()" /></label>
      <label>Requested through<input type="date" [name]="'to'+i" [(ngModel)]="item.requestedTo" (ngModelChange)="changed()" /></label>
    </div><label>Service description<textarea [name]="'description'+i" [(ngModel)]="item.serviceDescription" (ngModelChange)="changed()" maxlength="1000" required></textarea></label>
    <button type="button" (click)="removeItem(i)" [disabled]="draft.items.length === 1">Remove service</button></section> }
    <button type="button" (click)="addItem()" [disabled]="draft.items.length >= 100">Add service</button>
    <button type="submit">{{ busy ? 'Saving…' : 'Save draft' }}</button></fieldset>
    @if (error) { <p role="alert">{{ error }}</p> } @if (success) { <p role="status">Draft saved.</p> }
    @if (showExternalLinks) { <footer><a href="https://mindbill.org" target="_blank" rel="noopener noreferrer">Powered by MindBill</a></footer> }
  </form> }`,
})
export class RfaDraftFormComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) initialDraft!: RfaDraftInput;
  @Input({ required: true }) onSave!: (draft: RfaDraftInput) => Promise<unknown>;
  @Input() disabled = false;
  @Input() showExternalLinks = true;
  @Input() searchDiagnoses?: MindBillRfaCodeSearch;
  @Input() searchProcedures?: MindBillRfaCodeSearch;
  @Input() appearance?: MindBillAngularAppearance;
  @Output() dirtyChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<RfaDraftInput>();
  @Output() saveError = new EventEmitter<Error>();
  draft?: RfaDraftInput;
  busy = false; error = ""; success = false;
  private initialKey = "";
  private generation = 0;
  readonly customDiagnosis = customRfaDiagnosis;
  readonly customProcedure = customRfaProcedure;
  private lookups = new Map<RfaDraftInput['items'][number], { diagnosis: RfaCodeLookup; procedure: RfaCodeLookup }>();
  private previousDiagnosisSearch: MindBillRfaCodeSearch | undefined;
  private previousProcedureSearch: MindBillRfaCodeSearch | undefined;
  private readonly detector = inject(ChangeDetectorRef);
  get theme() { return mindBillAngularAppearanceStyle(this.appearance); }
  ngOnChanges() {
    const key = treatmentDraftKey(this.initialDraft);
    if (this.searchDiagnoses !== this.previousDiagnosisSearch || this.searchProcedures !== this.previousProcedureSearch) {
      this.clearLookups(); this.previousDiagnosisSearch = this.searchDiagnoses; this.previousProcedureSearch = this.searchProcedures;
    }
    if (this.initialDraft && key !== this.initialKey) {
      this.clearLookups(); this.generation++; this.busy = false; this.initialKey = key; this.draft = normalizeRfaDraft(this.initialDraft);
      this.draft.requestType ??= "new"; this.draft.reviewType ??= "prospective"; this.error = ""; this.success = false;
    }
  }
  ngOnDestroy() { this.generation++; this.clearLookups(); }
  private clearLookups() { for (const state of this.lookups.values()) { state.diagnosis.dispose(); state.procedure.dispose(); } this.lookups.clear(); }
  changed() { this.success = false; this.dirtyChange.emit(true); }
  lookup(item: RfaDraftInput['items'][number], kind: 'diagnosis' | 'procedure'): RfaCodeLookup {
    let state = this.lookups.get(item);
    if (!state) { const notify = () => this.detector.markForCheck(); state = { diagnosis: new RfaCodeLookup(notify), procedure: new RfaCodeLookup(notify) }; this.lookups.set(item, state); }
    return state[kind];
  }
  searchCode(item: RfaDraftInput['items'][number], kind: 'diagnosis' | 'procedure', query: string) {
    if (this.disabled || this.busy || !this.draft?.items.includes(item)) return;
    this.lookup(item, kind).search(query, kind === 'diagnosis' ? this.searchDiagnoses : this.searchProcedures);
  }
  selectCode(item: RfaDraftInput['items'][number], kind: 'diagnosis' | 'procedure', option: MindBillComboOption) {
    if (this.disabled || this.busy || !this.draft?.items.includes(item)) return;
    const state = this.lookup(item, kind), known = state.options.find(candidate => candidate.id === option.id);
    if (!known && !(kind === 'diagnosis' ? customRfaDiagnosis(option.id) : customRfaProcedure(option.id))) return;
    state.cancel(); const code = option.id.trim().toUpperCase();
    if (kind === 'diagnosis') { if (item.diagnosisCode === code) return; item.diagnosisCode = code; }
    else {
      const description = !item.serviceDescription.trim() ? known?.detail : undefined;
      if (item.procedureCode === code && !description) return;
      item.procedureCode = code; if (description) item.serviceDescription = description;
    }
    this.changed();
  }
  clearProcedure(item: RfaDraftInput['items'][number]) { if (!this.disabled && !this.busy && this.draft?.items.includes(item) && item.procedureCode) { delete item.procedureCode; this.lookup(item, 'procedure').cancel(); this.changed(); } }
  removeItem(index: number) {
    const item = this.draft?.items[index];
    if (!this.disabled && !this.busy && this.draft && item && this.draft.items.length > 1) {
      const state = this.lookups.get(item); state?.diagnosis.dispose(); state?.procedure.dispose(); this.lookups.delete(item);
      this.draft.items.splice(index, 1); this.changed();
    }
  }
  addItem() { if (!this.disabled && !this.busy && this.draft && this.draft.items.length < 100) { this.draft.items.push({ diagnosisCode: "", serviceDescription: "" }); this.changed(); } }
  setNumber(index: number, key: "quantity" | "units", value: number | null) { const item = this.draft?.items[index]; if (item && item[key] !== (value ?? undefined)) { if (value === null) delete item[key]; else item[key] = value; this.changed(); } }
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
