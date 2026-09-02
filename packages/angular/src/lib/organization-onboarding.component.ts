import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  createOrganizationClient,
  type BillLifecycleSessionProvider,
  type OrganizationBillingProviderInput,
  type OrganizationClient,
  type OrganizationLocationInput,
  type OrganizationProfileData,
} from "@mindbill/browser";
import type { MindBillAngularAppearance } from "./bill-lifecycle.component";

// Embeddable organization onboarding (INC-1470): practice identity, billing
// provider, locations, and the W-9 captured once and saved straight to
// MindBill through the partner browser session (organization:manage
// permission). variant="settings" stacks every section for edit-after-setup.

const THEME: Record<string, Record<string, string>> = {
  mindbill: { a: "#238dbd", ac: "#fff", bg: "#f3f8fa", s: "#fff", t: "#203743", m: "#657982", b: "#dbe6ea", r: "14px", cr: "8px", font: "Inter,system-ui,sans-serif" },
  "qme-companion": { a: "#53b5dc", ac: "#173542", bg: "#f2f8fb", s: "#fff", t: "#1d3440", m: "#617783", b: "#d7e5eb", r: "12px", cr: "8px", font: "Inter,system-ui,sans-serif" },
  "orange-bright": { a: "#f4510b", ac: "#fff", bg: "#fffaf6", s: "#fffefd", t: "#090f1f", m: "#626a73", b: "#e7e1da", r: "16px", cr: "10px", font: "Inter,system-ui,sans-serif" },
  "clinical-blue": { a: "#1677ff", ac: "#fff", bg: "#fff", s: "#fff", t: "#1f2d3d", m: "#66788a", b: "#d9e2ec", r: "8px", cr: "6px", font: "Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" },
};

type StepId = "practice" | "locations" | "w9" | "review";

async function fileToBase64(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of buffer) binary += String.fromCharCode(byte);
  return btoa(binary);
}

@Component({
  selector: "mindbill-organization-onboarding",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="mbob" [ngStyle]="themeStyle">
      <div class="card">
        <header><h2>{{ heading }}</h2><p>{{ description }}</p></header>
        @if (loadError) { <div class="error" role="alert">{{ loadError }}</div> }

        @if (variant === 'onboarding') {
          <div class="steps">
            @for (item of steps; track item.id) {
              <button type="button" [class.active]="step === item.id" [class.done]="saved[item.id]" (click)="step = item.id"><i>{{ saved[item.id] ? '✓' : '' }}</i>{{ item.label }}</button>
            }
          </div>
        }

        @if (variant === 'settings' || step === 'practice') {
          <div class="grid">
            <label>Practice name<input [(ngModel)]="identity.name" [disabled]="saving"></label>
            <label>Legal name<input [(ngModel)]="identity.legalName" [disabled]="saving"></label>
            <label>Tax ID (EIN)<input [(ngModel)]="identity.taxId" placeholder="94-1234567" [disabled]="saving"></label>
            <label>Group NPI<input [(ngModel)]="identity.npi" [disabled]="saving"></label>
            <label>Phone<input [(ngModel)]="identity.phone" [disabled]="saving"></label>
            <label>Email<input [(ngModel)]="identity.email" [disabled]="saving"></label>
          </div>
          <h3>Billing provider (pay-to)</h3>
          <div class="grid">
            <label>Billing provider name<input [(ngModel)]="provider.name" [disabled]="saving"></label>
            <label>Billing tax ID<input [(ngModel)]="provider.taxId" [disabled]="saving"></label>
            <label>Billing NPI<input [(ngModel)]="provider.npi" [disabled]="saving"></label>
            <label>Billing phone<input [(ngModel)]="provider.phone" [disabled]="saving"></label>
            <label class="span">Street<input [(ngModel)]="provider.billingStreet" [disabled]="saving"></label>
            <label>City<input [(ngModel)]="provider.billingCity" [disabled]="saving"></label>
            <label>State<input [(ngModel)]="provider.billingState" maxlength="2" [disabled]="saving"></label>
            <label>ZIP<input [(ngModel)]="provider.billingZip" [disabled]="saving"></label>
          </div>
          <div class="actions"><span>{{ saved['practice'] ? 'Saved to MindBill.' : 'Saved once, used on every bill.' }}</span><button type="button" class="save" [disabled]="saving" (click)="savePractice()">{{ saving ? 'Saving…' : 'Save practice' }}</button></div>
        }

        @if (variant === 'settings') { <h3>Locations</h3> }
        @if (variant === 'settings' || step === 'locations') {
          @for (location of locations; track $index; let index = $index) {
            <div class="loc">
              <label>Name<input [(ngModel)]="location.name" [disabled]="saving"></label>
              <label>Street<input [(ngModel)]="location.street" [disabled]="saving"></label>
              <label>City<input [(ngModel)]="location.city" [disabled]="saving"></label>
              <label>State<input [(ngModel)]="location.state" maxlength="2" [disabled]="saving"></label>
              <label>ZIP<input [(ngModel)]="location.zip" [disabled]="saving"></label>
              <label class="primary"><input type="radio" name="mbob-primary" [checked]="location.isPrimary === true" (change)="setPrimary(index)"> Primary</label>
              <button type="button" class="remove" aria-label="Remove location" (click)="locations.splice(index, 1)">×</button>
            </div>
          }
          <button type="button" class="add" (click)="addLocation()">+ Add location</button>
          <div class="actions"><span>{{ saved['locations'] ? 'Saved to MindBill.' : 'Where evaluations happen.' }}</span><button type="button" class="save" [disabled]="saving" (click)="saveLocations()">{{ saving ? 'Saving…' : 'Save locations' }}</button></div>
        }

        @if (variant === 'settings') { <h3>Practice W-9</h3> }
        @if (variant === 'settings' || step === 'w9') {
          @if (profile?.w9; as w9) {
            <div class="w9-current"><div><strong>{{ w9.filename }}</strong><span> · added {{ w9.addDate }}</span></div><span>Rides on every bill automatically</span></div>
          }
          <label class="drop">
            <input type="file" accept="application/pdf,.pdf" (change)="w9Selected($event)">
            <strong>{{ w9File ? w9File.name : (profile?.w9 ? 'Replace the W-9 PDF' : 'Drop the practice W-9 PDF here, or click to choose') }}</strong>
            <span>The W-9 is auto-attached to every submission.</span>
          </label>
          <div class="actions"><span>{{ saved['w9'] ? 'Saved to MindBill.' : '' }}</span><button type="button" class="save" [disabled]="saving || !w9File" (click)="saveW9()">{{ saving ? 'Uploading…' : 'Save W-9' }}</button></div>
        }

        @if (variant === 'settings') { <h3>Checklist</h3> }
        @if (variant === 'settings' || step === 'review') {
          <div class="check">
            @for (item of profile?.onboarding?.checklist ?? []; track item.id) {
              <div class="check-item" [class.complete]="item.complete"><i>{{ item.complete ? '✓' : '•' }}</i><span>{{ item.label }}</span></div>
            }
            @if (profile?.onboarding?.complete) { <p class="done-copy">Billing setup is complete — bills submitted from your product carry this profile automatically.</p> }
            @else { <p class="muted">Items above complete themselves as each section is saved.</p> }
          </div>
        }

        @if (errorMessage) { <div class="error" role="alert">{{ errorMessage }}</div> }
      </div>
    </section>
  `,
  styles: [`
    :host{display:block}
    .mbob{font-family:var(--font);color:var(--t);font-size:15px}.mbob *{box-sizing:border-box}
    .card{border:1px solid var(--b);border-radius:var(--r);background:var(--s);padding:24px}
    header{margin-bottom:18px}header h2{margin:0;font-size:22px}header p{margin:5px 0 0;color:var(--m)}
    .steps{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
    .steps button{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--b);border-radius:999px;background:var(--s);padding:7px 13px;color:var(--m);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
    .steps button.active{border-color:var(--a);color:var(--a);background:color-mix(in srgb,var(--a) 8%,var(--s))}
    .steps button.done i{color:#159447;font-style:normal}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px 22px}.span{grid-column:1/-1}
    label{display:grid;gap:7px;font-size:13px;font-weight:720}
    input:not([type=radio]):not([type=file]){width:100%;min-height:44px;border:1px solid var(--b);border-radius:var(--cr);background:var(--s);padding:10px 12px;color:var(--t);font:inherit;font-weight:450}
    input:focus{outline:3px solid color-mix(in srgb,var(--a) 22%,transparent);border-color:var(--a)}
    h3{margin:20px 0 12px;padding-top:16px;border-top:1px solid var(--b);font-size:15px}
    .loc{display:grid;grid-template-columns:1.2fr 1.4fr .9fr .4fr .6fr auto auto;gap:10px;align-items:end;border-top:1px solid color-mix(in srgb,var(--b) 60%,transparent);padding:12px 0}
    .loc:first-of-type{border-top:0}
    .primary{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--m);white-space:nowrap;padding-bottom:12px}
    .remove{border:0;background:transparent;color:var(--m);font-size:20px;cursor:pointer;padding-bottom:8px}
    .add{border:1px solid var(--b);border-radius:var(--cr);background:var(--s);padding:10px 14px;color:var(--t);font:inherit;font-weight:700;cursor:pointer}
    .drop{display:grid;place-content:center;gap:6px;min-height:150px;border:2px dashed color-mix(in srgb,var(--m) 55%,transparent);border-radius:var(--cr);text-align:center;cursor:pointer;position:relative}
    .drop input{position:absolute;inset:0;opacity:0;cursor:pointer}
    .drop span{color:var(--m);font-size:13px}
    .w9-current{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #9fd6b4;border-radius:var(--cr);background:#f3fcf6;padding:12px 14px;margin-bottom:14px}
    .w9-current span{color:var(--m);font-size:13px}
    .check{display:grid;gap:9px}
    .check-item{display:flex;align-items:center;gap:10px;border:1px solid var(--b);border-radius:var(--cr);padding:11px 14px}
    .check-item.complete{border-color:#9fd6b4;background:#f3fcf6}
    .check-item i{font-style:normal}
    .actions{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-top:20px}
    .actions>span{color:var(--m)}
    .save{min-width:170px;border:0;border-radius:var(--cr);background:var(--a);color:var(--ac);padding:12px 22px;font:inherit;font-weight:780;cursor:pointer}
    .save:disabled{opacity:.6;cursor:wait}
    .error{margin-top:14px;border-left:4px solid #c83c3c;border-radius:var(--cr);background:color-mix(in srgb,#c83c3c 8%,var(--s));padding:12px 14px;color:#c83c3c}
    .done-copy{color:#159447;font-weight:750}
    .muted{color:var(--m)}
    @media(max-width:820px){.grid{grid-template-columns:1fr}.span{grid-column:auto}.loc{grid-template-columns:1fr 1fr;align-items:center}}
  `],
})
export class MindBillOrganizationOnboardingComponent implements OnInit {
  @Input() appearance: MindBillAngularAppearance = { preset: "mindbill" };
  @Input() sessionEndpoint = "/api/mindbill/session";
  @Input() getSession?: BillLifecycleSessionProvider;
  @Input() apiBaseUrl?: string;
  @Input() heading = "Billing setup";
  @Input() description = "Practice identity, locations, and the W-9 — saved once, used on every bill.";
  @Input() variant: "onboarding" | "settings" = "onboarding";
  @Output() saved$ = new EventEmitter<OrganizationProfileData>();
  @Output() completed = new EventEmitter<OrganizationProfileData>();
  @Output() organizationError = new EventEmitter<Error>();

  readonly steps: Array<{ id: StepId; label: string }> = [
    { id: "practice", label: "Practice & billing" },
    { id: "locations", label: "Locations" },
    { id: "w9", label: "W-9" },
    { id: "review", label: "Review" },
  ];

  profile: OrganizationProfileData | null = null;
  loadError = "";
  errorMessage = "";
  step: StepId = "practice";
  saving = false;
  saved: Record<string, boolean> = {};
  identity = { name: "", legalName: "", taxId: "", npi: "", phone: "", email: "" };
  provider: OrganizationBillingProviderInput = { name: "", taxId: "", npi: "", billType: "Professional", phone: "", billingStreet: "", billingCity: "", billingState: "", billingZip: "" };
  locations: OrganizationLocationInput[] = [{ name: "", street: "", city: "", state: "", zip: "", isPrimary: false }];
  w9File: File | null = null;

  private readonly changeDetector = inject(ChangeDetectorRef);
  private completedFired = false;
  private client!: OrganizationClient;

  ngOnInit(): void {
    this.client = createOrganizationClient({
      sessionEndpoint: this.sessionEndpoint,
      ...(this.getSession ? { getSession: this.getSession } : {}),
      ...(this.apiBaseUrl ? { apiBaseUrl: this.apiBaseUrl } : {}),
    });
    this.client.getOrganization()
      .then((profile) => { this.loadError = ""; this.adoptProfile(profile); })
      .catch((error: unknown) => {
        const failure = error instanceof Error ? error : new Error("The organization could not be loaded.");
        this.loadError = failure.message;
        this.organizationError.emit(failure);
      })
      .finally(() => this.changeDetector.markForCheck());
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

  private adoptProfile(profile: OrganizationProfileData): void {
    this.profile = profile;
    this.identity = {
      name: profile.practiceIdentity.name ?? this.identity.name,
      legalName: profile.practiceIdentity.legalName ?? this.identity.legalName,
      taxId: profile.practiceIdentity.taxId ?? this.identity.taxId,
      npi: profile.practiceIdentity.npi ?? this.identity.npi,
      phone: profile.practiceIdentity.phone ?? this.identity.phone,
      email: profile.practiceIdentity.email ?? this.identity.email,
    };
    if (profile.billingProviders[0]) this.provider = { billType: "Professional", ...profile.billingProviders[0] };
    if (profile.locations.length) this.locations = profile.locations.map((item) => ({ ...item }));
    if (profile.onboarding.complete && !this.completedFired) {
      this.completedFired = true;
      this.completed.emit(profile);
    }
  }

  addLocation(): void {
    this.locations.push({ name: "", street: "", city: "", state: "", zip: "", isPrimary: false });
  }

  setPrimary(index: number): void {
    this.locations = this.locations.map((item, itemIndex) => ({ ...item, isPrimary: itemIndex === index }));
  }

  w9Selected(event: Event): void {
    this.w9File = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  private async run(work: () => Promise<OrganizationProfileData>, stepId: StepId): Promise<void> {
    this.saving = true;
    this.errorMessage = "";
    try {
      const profile = await work();
      this.adoptProfile(profile);
      this.saved[stepId] = true;
      this.saved$.emit(profile);
      if (this.variant === "onboarding") {
        const order: StepId[] = ["practice", "locations", "w9", "review"];
        const next = order[order.indexOf(stepId) + 1];
        if (next) this.step = next;
      }
    } catch (error) {
      const failure = error instanceof Error ? error : new Error("Saving failed.");
      this.errorMessage = failure.message;
      this.organizationError.emit(failure);
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
  }

  savePractice(): void {
    void this.run(() => this.client.saveBillingProfile({
      practiceIdentity: this.identity,
      ...(this.provider.name.trim() || this.provider.taxId.trim() || this.provider.npi.trim()
        ? { billingProviders: [this.provider] }
        : {}),
    }), "practice");
  }

  saveLocations(): void {
    void this.run(() => this.client.saveLocations(this.locations.filter((item) => item.name.trim() || item.street.trim())), "locations");
  }

  saveW9(): void {
    void this.run(async () => {
      if (!this.w9File) throw new Error("Choose the practice W-9 PDF first.");
      return this.client.saveW9({ filename: this.w9File.name, contentBase64: await fileToBase64(this.w9File) });
    }, "w9");
  }
}
