import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MindBillAngularAppearance, mindBillAngularAppearanceStyle } from "./appearance";
import { treatmentDraftStyle } from "./treatment-draft-style";
import { treatmentDraftKey } from "./submission-treatment";
import { DentalDraftContentInput, DentalDraftLineInput, dentalDraftChargeSummary, parseDentalCharge, validateDentalDraftContent } from "./treatment-drafts";

@Component({
  selector: "mindbill-dental-draft-editor", standalone: true, imports: [CommonModule, FormsModule], styles: [treatmentDraftStyle],
  template: `@if (draft) { <form class="mbtd" [ngStyle]="theme" (ngSubmit)="save()">
    <h2>Prepare a dental bill</h2><p>Save a draft for review. Unknown charges can stay blank.</p>
    <fieldset [disabled]="disabled || busy"><label>Diagnosis codes (comma separated)<input name="diagnoses" [(ngModel)]="diagnoses" /></label>
    <label>Notes<textarea name="notes" [ngModel]="draft.notes" (ngModelChange)="draft.notes = $event.trim() || null" maxlength="5000"></textarea></label>
    @for (line of draft.lines; track line; let i = $index) { <fieldset><legend>Service {{ i + 1 }}</legend><div class="mbtd-grid">
      <label>CDT code<input [name]="'code'+i" [ngModel]="line.code" (ngModelChange)="line.code = $event.trim().toUpperCase() || null" placeholder="D0120" maxlength="5" /></label>
      <label>Edition year<input type="number" [name]="'year'+i" [(ngModel)]="line.editionYear" min="1900" max="2200" step="1" /></label>
      <label>Service date<input type="date" [name]="'date'+i" [ngModel]="line.serviceDate" (ngModelChange)="line.serviceDate = $event || null" /></label>
      <label>Quantity<input type="number" [name]="'quantity'+i" [(ngModel)]="line.quantity" min="1" max="100000" step="1" /></label>
      <label>Extended charge ($)<input inputmode="decimal" [name]="'charge'+i" [(ngModel)]="charges[i]" placeholder="Unknown" /></label>
      <label>Charge reference<input [name]="'reference'+i" [ngModel]="line.chargeReference" (ngModelChange)="line.chargeReference = $event.trim() || null" maxlength="1000" /></label>
      <label>Teeth (comma separated)<input [name]="'teeth'+i" [(ngModel)]="teeth[i]" /></label>
      <label>Surfaces (comma separated)<input [name]="'surfaces'+i" [(ngModel)]="surfaces[i]" /></label>
      <label>Oral cavity<input [name]="'cavity'+i" [ngModel]="line.oralCavity" (ngModelChange)="line.oralCavity = $event.trim() || null" maxlength="100" /></label>
      <label>Description<textarea [name]="'description'+i" [ngModel]="line.description" (ngModelChange)="line.description = $event.trim() || null" maxlength="1000"></textarea></label>
      <label>Prosthesis notes<textarea [name]="'prosthesis'+i" [ngModel]="line.prosthesisNotes" (ngModelChange)="line.prosthesisNotes = $event.trim() || null" maxlength="2000"></textarea></label>
    </div><button type="button" (click)="removeLine(i)">Remove service</button></fieldset> }
    <p>{{ chargeSummary }}</p><div class="mbtd-actions"><button type="button" (click)="addLine()" [disabled]="draft.lines.length >= 100">Add service</button>
    <button class="mbtd-primary" type="submit">{{ busy ? 'Saving…' : 'Save draft' }}</button></div></fieldset>
    @if (error) { <p role="alert">{{ error }}</p> } @if (success) { <p role="status">Draft saved.</p> }
    <footer class="mbtd-attribution"><a href="https://mindbill.org" target="_blank" rel="noopener noreferrer">Powered by MindBill</a></footer>
  </form> }`,
})
export class DentalDraftEditorComponent implements OnChanges {
  @Input({ required: true }) initialContent!: DentalDraftContentInput;
  @Input({ required: true }) onSave!: (content: DentalDraftContentInput) => Promise<unknown>;
  @Input() disabled = false;
  @Input() appearance?: MindBillAngularAppearance;
  @Output() saved = new EventEmitter<DentalDraftContentInput>();
  @Output() saveError = new EventEmitter<Error>();
  draft?: DentalDraftContentInput;
  diagnoses = ""; charges: string[] = []; teeth: string[] = []; surfaces: string[] = [];
  busy = false; error = ""; success = false;
  private initialKey = "";
  private readonly detector = inject(ChangeDetectorRef);
  get theme() { return mindBillAngularAppearanceStyle(this.appearance); }
  ngOnChanges() { const key = treatmentDraftKey(this.initialContent); if (this.initialContent && key !== this.initialKey) { this.initialKey = key; this.draft = structuredClone(this.initialContent); this.diagnoses = this.draft.diagnosisCodes.join(", "); this.charges = this.draft.lines.map(line => line.chargeCents === null ? "" : (line.chargeCents / 100).toFixed(2)); this.teeth = this.draft.lines.map(line => line.teeth.join(", ")); this.surfaces = this.draft.lines.map(line => line.surfaces.join(", ")); this.error = ""; this.success = false; } }
  private list(value: string) { return value.split(",").map(item => item.trim()).filter(Boolean); }
  private content(): DentalDraftContentInput { return { ...structuredClone(this.draft!), diagnosisCodes: this.list(this.diagnoses), lines: this.draft!.lines.map((line, i) => ({ ...structuredClone(line), chargeCents: parseDentalCharge(this.charges[i] ?? ""), teeth: this.list(this.teeth[i] ?? ""), surfaces: this.list(this.surfaces[i] ?? "") })) }; }
  get chargeSummary() { if (!this.draft) return ""; try { const summary = dentalDraftChargeSummary(this.content().lines); const dollars = (summary.knownChargeCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" }); return summary.totalChargeCents === null ? `Known charges: ${dollars} · Total incomplete` : `Total charges: ${dollars}`; } catch { return "Check the extended charges."; } }
  addLine() { if (!this.draft || this.draft.lines.length >= 100) return; const line: DentalDraftLineInput = { code: null, description: null, editionYear: null, serviceDate: null, quantity: 1, chargeCents: null, chargeReference: null, teeth: [], surfaces: [], oralCavity: null, prosthesisNotes: null }; this.draft.lines.push(line); this.charges.push(""); this.teeth.push(""); this.surfaces.push(""); }
  removeLine(index: number) { this.draft?.lines.splice(index, 1); this.charges.splice(index, 1); this.teeth.splice(index, 1); this.surfaces.splice(index, 1); }
  async save() {
    if (!this.draft || this.disabled || this.busy) return;
    this.success = false; let content: DentalDraftContentInput;
    try { content = this.content(); this.error = validateDentalDraftContent(content) ?? ""; } catch (error) { this.error = error instanceof Error ? error.message : "Check the extended charges."; return; }
    if (this.error) return;
    this.busy = true;
    try { await this.onSave(content); this.saved.emit(content); this.success = true; }
    catch { this.error = "Could not save the draft. Please try again."; this.saveError.emit(new Error(this.error)); }
    finally { this.busy = false; this.detector.markForCheck(); }
  }
}
