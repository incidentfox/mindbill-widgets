import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { formatMindBillSubmissionDate, parseMindBillSubmissionDate } from "./submission-format";

export type MindBillComboOption = { id: string; label: string; detail?: string };

/** Styled searchable dropdown shared by the submission form's procedure,
 * modifier, taxonomy, payer, and diagnosis pickers. Mirrors the React
 * package's ComboBox: query filtering, optional custom-code creation,
 * loading states, and infinite scroll via (endReached). */
@Component({
  selector: "mindbill-combo-box",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="combo">
      <input
        type="text"
        role="combobox"
        autocomplete="off"
        [attr.aria-label]="ariaLabel"
        [attr.aria-invalid]="invalid || null"
        [attr.aria-expanded]="showMenu"
        [disabled]="disabled"
        [placeholder]="placeholder"
        [value]="open ? query : value"
        (focus)="onFocus()"
        (click)="onFocus()"
        (input)="onInput($event)"
        (blur)="onBlur()"
      />
      @if (showMenu) {
        <div class="menu" role="listbox" (scroll)="onScroll($event)">
          @if (loading && !visible.length) { <div class="status">Loading…</div> }
          @else if (visible.length) {
            @for (option of visible; track option.id) {
              <button type="button" role="option" (mousedown)="$event.preventDefault()" (click)="choose(option)">
                <strong>{{ option.label }}</strong>
                @if (option.detail) { <small>{{ option.detail }}</small> }
              </button>
            }
          } @else { <div class="status">No matches</div> }
          @if (loadingMore) { <div class="status">Loading more…</div> }
        </div>
      }
    </div>
  `,
  styles: [`
    :host{display:block}
    .combo{position:relative}
    input{width:100%;min-height:46px;border:1px solid var(--b);border-radius:var(--cr);background:var(--s);padding:10px 12px;color:var(--t);font:inherit;font-weight:450}
    input:focus{outline:3px solid color-mix(in srgb,var(--a) 22%,transparent);border-color:var(--a)}
    input[aria-invalid="true"]{border-color:#c83c3c}
    .menu{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:30;max-height:320px;overflow:auto;border:1px solid var(--b);border-radius:var(--cr);background:var(--s);box-shadow:0 14px 35px #172b3730}
    .menu button{display:grid;width:100%;gap:3px;border:0;border-bottom:1px solid color-mix(in srgb,var(--b) 60%,transparent);background:var(--s);padding:11px 14px;text-align:left;color:var(--t);font:inherit;cursor:pointer}
    .menu button:last-child{border-bottom:0}
    .menu button:hover{background:color-mix(in srgb,var(--a) 7%,var(--s))}
    .menu strong{font-weight:720}
    .menu small{color:var(--m);font-size:12px}
    .status{padding:11px 14px;color:var(--m);font-size:13px}
  `],
})
export class MindBillComboBoxComponent {
  @Input() value = "";
  @Input() placeholder = "";
  @Input() options: MindBillComboOption[] = [];
  @Input() disabled = false;
  @Input() loading = false;
  @Input() loadingMore = false;
  @Input() invalid = false;
  @Input() preserveValueOnOpen = false;
  @Input() ariaLabel = "";
  @Input() createOption?: (query: string) => MindBillComboOption | null;
  @Output() opened = new EventEmitter<void>();
  @Output() queryChange = new EventEmitter<string>();
  @Output() endReached = new EventEmitter<void>();
  @Output() selected = new EventEmitter<MindBillComboOption>();

  open = false;
  query = "";
  private closeTimer?: ReturnType<typeof setTimeout>;

  get visible(): MindBillComboOption[] {
    const q = this.query.trim().toLowerCase();
    const matches = q
      ? this.options.filter((option) => `${option.id} ${option.label} ${option.detail ?? ""}`.toLowerCase().includes(q))
      : this.options;
    const custom = this.createOption?.(this.query) ?? null;
    return custom && !matches.some((option) => option.id.toUpperCase() === custom.id.toUpperCase())
      ? [...matches, custom]
      : matches;
  }

  get showMenu(): boolean {
    return this.open && (this.loading || this.visible.length > 0 || this.query.trim().length >= 2);
  }

  onFocus(): void {
    clearTimeout(this.closeTimer);
    const next = this.preserveValueOnOpen ? this.value : "";
    this.open = true;
    this.query = next;
    this.opened.emit();
    if (next) this.queryChange.emit(next);
  }

  onInput(event: Event): void {
    this.open = true;
    this.query = (event.target as HTMLInputElement).value;
    this.queryChange.emit(this.query);
  }

  onBlur(): void {
    this.closeTimer = setTimeout(() => { this.open = false; }, 120);
  }

  onScroll(event: Event): void {
    const menu = event.currentTarget as HTMLElement;
    if (menu.scrollHeight - menu.scrollTop - menu.clientHeight < 120) this.endReached.emit();
  }

  choose(option: MindBillComboOption): void {
    this.selected.emit(option);
    this.open = false;
    this.query = "";
  }
}

/** MM/DD/YYYY masked date input. Emits only parseable ISO dates (or "" when
 * cleared) and reformats the display once a complete date round-trips, exactly
 * like the React package's TextDateInput. */
@Component({
  selector: "mindbill-date-input",
  standalone: true,
  imports: [CommonModule],
  template: `
    <input
      type="text"
      inputmode="numeric"
      autocomplete="off"
      placeholder="MM/DD/YYYY"
      [attr.aria-label]="ariaLabel"
      [attr.aria-invalid]="invalid || null"
      [disabled]="disabled"
      [value]="display"
      (input)="onInput($event)"
      (blur)="onBlur()"
    />
    @if (invalid) { <small>Use MM/DD/YYYY</small> }
  `,
  styles: [`
    :host{display:block}
    input{width:100%;min-height:46px;border:1px solid var(--b);border-radius:var(--cr);background:var(--s);padding:10px 12px;color:var(--t);font:inherit;font-weight:450}
    input:focus{outline:3px solid color-mix(in srgb,var(--a) 22%,transparent);border-color:var(--a)}
    input[aria-invalid="true"]{border-color:#c83c3c}
    small{display:block;margin-top:6px;color:#c83c3c;font-weight:450}
  `],
})
export class MindBillDateInputComponent implements OnChanges {
  @Input() value: string | null | undefined;
  @Input() disabled = false;
  @Input() ariaLabel = "";
  @Output() valueChange = new EventEmitter<string>();

  display = "";
  invalid = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["value"]) {
      this.display = formatMindBillSubmissionDate(this.value);
      this.invalid = false;
    }
  }

  onInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    const parsed = parseMindBillSubmissionDate(next);
    this.display = next;
    this.invalid = Boolean(next && !parsed);
    if (!next.trim()) this.valueChange.emit("");
    else if (parsed) this.valueChange.emit(parsed);
  }

  onBlur(): void {
    this.invalid = Boolean(this.display && !parseMindBillSubmissionDate(this.display));
  }
}
