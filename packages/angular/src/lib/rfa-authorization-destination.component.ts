import { Component, EventEmitter, Input, OnChanges, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { normalizeRfaFax, rfaAuthorizationDestinations, rfaAuthorizationGuidance, type BillClaimsAdministratorDirectory, type RfaAuthorizationDestinationOption } from "@mindbill/browser";
import { mindBillAngularAppearanceStyle, type MindBillAngularAppearance } from "./appearance";
import { treatmentDraftKey } from "./submission-treatment";

/** A destination choice never signs, transmits, or substitutes a telephone number for fax. */
@Component({
  selector: "mindbill-rfa-authorization-destination", standalone: true, imports: [CommonModule],
  template: `<section class="rfa-destination" [ngStyle]="theme" aria-label="RFA authorization destination">
    <h3>Authorization destination</h3>
    <p role="status">{{ guidance }}</p>
    @if (showExternalLinks && sourceUrl) { <p class="source"><a [href]="sourceUrl" target="_blank" rel="noopener noreferrer">Directory source</a> @if (directory?.authorizationSource?.observedAt) { · Observed {{ directory?.authorizationSource?.observedAt }} }</p> }
    <fieldset [disabled]="disabled || loading"><legend>Confirm where this request should go</legend>
      @for (option of options; track $index; let index = $index) {
        <label class="choice"><input type="radio" [name]="radioName" [checked]="choice === '' + index" (change)="choose('' + index)" />
          <span><strong>{{ option.label }}</strong><span>{{ option.method === 'email' ? 'Email' : 'Fax' }}: {{ option.destination }}</span>@if (option.phone) { <small>Telephone: {{ option.phone }}</small> }</span>
        </label>
      }
      <label class="choice"><input type="radio" [name]="radioName" [checked]="choice === 'manual'" (change)="choose('manual')" /><span>Enter a fax confirmed with the handling adjuster</span></label>
      @if (choice === 'manual') {
        <label class="manual">Authorization fax<input type="tel" [value]="manualFax" (input)="setManualFax($any($event.target).value)" placeholder="+1 415 555 0100" /></label>
        <label class="choice"><input type="checkbox" [checked]="manualConfirmed" (change)="confirmManual($any($event.target).checked)" /><span>I confirmed this fax is the authorization destination for this claim.</span></label>
        @if (manualFax && !validManualFax) { <p role="alert">Enter a complete fax number without extensions or telephone notes.</p> }
      }
    </fieldset>
    @if (selected?.method === 'email') { <p class="notice">Download the signed packet, send it through your authorized email service, then record delivery. Selecting this address does not send email.</p> }
    @if (selected?.method === 'fax') { <p class="notice">Review the signed packet and confirm transmission in your delivery workflow. Selecting this fax does not send it.</p> }
  </section>`,
  styles: [`.rfa-destination{font-family:var(--font,Arial,sans-serif);color:var(--t,#263645);min-width:0}h3{font-size:17px;margin:0 0 10px}p{font-size:14px;line-height:1.55}fieldset{border:1px solid var(--b,#d9e2e9);border-radius:8px;padding:15px}legend{font-weight:600;font-size:14px}.choice{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.5;padding:10px 0;cursor:pointer}.choice input{flex:none;margin-top:4px}.choice>span{display:grid;gap:3px;overflow-wrap:anywhere;min-width:0}small,.source{color:var(--m,#607181);font-size:12px}.manual{display:grid;gap:7px;font-size:14px;margin:8px 0}.manual input{font:inherit;border:1px solid #c8d3dc;border-radius:6px;padding:10px;width:100%;box-sizing:border-box}.notice{padding:12px;background:#f4f8fb;border-radius:6px}a{color:var(--a,#1677cf)}`],
})
export class MindBillRfaAuthorizationDestinationComponent implements OnChanges {
  @Input({ required: true }) contextKey = "";
  @Input() directory: BillClaimsAdministratorDirectory | null = null;
  @Input() loading = false;
  @Input() showExternalLinks = true;
  @Input() error: string | null = null;
  @Input() disabled = false;
  @Input() appearance?: MindBillAngularAppearance;
  @Output() destinationChange = new EventEmitter<RfaAuthorizationDestinationOption | null>();
  options: RfaAuthorizationDestinationOption[] = [];
  selected: RfaAuthorizationDestinationOption | null = null;
  choice = "";
  manualFax = "";
  manualConfirmed = false;
  private previousKey = "";
  get radioName() { return `rfa-destination-${this.contextKey}`; }
  get theme() { return mindBillAngularAppearanceStyle(this.appearance); }
  get validManualFax() { return normalizeRfaFax(this.manualFax); }
  get guidance() { return this.loading ? "Loading authorization contacts…" : this.error ? "Directory details are unavailable. Confirm a destination with the handling adjuster." : rfaAuthorizationGuidance(this.directory); }
  get sourceUrl(): string | null {
    try { const url = new URL(this.directory?.authorizationSource?.url ?? ""); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
  }
  ngOnChanges() {
    const key = treatmentDraftKey({ context: this.contextKey, directory: this.directory, loading: this.loading, error: this.error });
    if (key === this.previousKey) return;
    this.previousKey = key;
    this.options = this.loading || this.error ? [] : rfaAuthorizationDestinations(this.directory);
    this.choice = ""; this.manualFax = ""; this.manualConfirmed = false;
    this.emit(null);
  }
  choose(choice: string) {
    if (this.disabled || this.loading) return;
    this.choice = choice; this.manualConfirmed = false;
    this.emit(choice === "manual" ? null : this.options[Number(choice)] ?? null);
  }
  setManualFax(value: string) { this.manualFax = value; this.manualConfirmed = false; this.emit(null); }
  confirmManual(confirmed: boolean) {
    this.manualConfirmed = confirmed;
    const destination = this.validManualFax;
    this.emit(confirmed && destination ? { method: "fax", destination, label: "Confirmed handling adjuster fax" } : null);
  }
  private emit(value: RfaAuthorizationDestinationOption | null) { this.selected = value; this.destinationChange.emit(value); }
}
