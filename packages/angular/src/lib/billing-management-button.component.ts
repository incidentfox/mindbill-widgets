import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, EventEmitter, inject, Input, Output } from "@angular/core";
import type { MindBillAngularAppearance } from "./bill-lifecycle.component";

export type MindBillManagementSession = { url: string };
export type MindBillManagementSessionProvider = () => Promise<MindBillManagementSession | string>;

const THEME: Record<string, Record<string, string>> = {
  mindbill: { a: "#238dbd", ac: "#fff", b: "#dbe6ea", r: "8px", font: "Inter,system-ui,sans-serif" },
  "qme-companion": { a: "#53b5dc", ac: "#173542", b: "#d7e5eb", r: "8px", font: "Inter,system-ui,sans-serif" },
  "orange-bright": { a: "#f4510b", ac: "#fff", b: "#e7e1da", r: "10px", font: "Inter,system-ui,sans-serif" },
  "clinical-blue": { a: "#1677ff", ac: "#fff", b: "#d9e2ec", r: "6px", font: "Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" },
};

@Component({
  selector: "mindbill-billing-management-button",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="management" [ngStyle]="themeStyle">
      <button type="button" [disabled]="loading" (click)="openBillingManagement()">
        <span>{{ loading ? loadingLabel : label }}</span><span aria-hidden="true">↗</span>
      </button>
      @if (errorMessage) { <p role="alert">{{ errorMessage }}</p> }
    </div>
  `,
  styles: [`
    :host{display:inline-block}.management{font-family:var(--font)}button{display:inline-flex;align-items:center;justify-content:center;gap:10px;border:1px solid var(--a);border-radius:var(--r);background:var(--a);color:var(--ac);padding:11px 16px;font:inherit;font-weight:750;cursor:pointer}button:disabled{opacity:.65;cursor:wait}p{max-width:360px;margin:7px 0 0;color:#b42318;font-size:13px}
  `],
})
export class MindBillBillingManagementButtonComponent {
  @Input() sessionEndpoint = "/api/mindbill/management-session";
  @Input() sessionProvider?: MindBillManagementSessionProvider;
  @Input() label = "Billing management";
  @Input() loadingLabel = "Opening billing…";
  @Input() appearance: MindBillAngularAppearance = { preset: "mindbill" };
  @Output() opened = new EventEmitter<string>();
  @Output() failed = new EventEmitter<unknown>();

  loading = false;
  errorMessage = "";
  private readonly changeDetector = inject(ChangeDetectorRef);

  get themeStyle(): Record<string, string> {
    const base = THEME[this.appearance.preset ?? "mindbill"] ?? THEME["mindbill"]!;
    return {
      "--a": this.appearance.accentColor ?? base["a"]!,
      "--ac": this.appearance.accentTextColor ?? base["ac"]!,
      "--b": this.appearance.borderColor ?? base["b"]!,
      "--r": this.appearance.controlRadius ?? base["r"]!,
      "--font": this.appearance.fontFamily ?? base["font"]!,
    };
  }

  async openBillingManagement(): Promise<void> {
    if (this.loading || typeof window === "undefined") return;
    this.loading = true;
    this.errorMessage = "";
    const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
    try {
      const result = this.sessionProvider
        ? await this.sessionProvider()
        : await this.fetchSession();
      const url = typeof result === "string" ? result : result.url;
      if (!url) throw new Error("The billing management session did not include a URL.");
      if (popup) popup.location.replace(url);
      else window.location.assign(url);
      this.opened.emit(url);
    } catch (error) {
      popup?.close();
      this.errorMessage = error instanceof Error ? error.message : "Billing management could not be opened.";
      this.changeDetector.markForCheck();
      this.failed.emit(error);
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  }

  private async fetchSession(): Promise<MindBillManagementSession> {
    const response = await fetch(this.sessionEndpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    const body = await response.json().catch(() => ({})) as { url?: string; data?: { url?: string }; message?: string };
    if (!response.ok) throw new Error(body.message || "Billing management could not be opened.");
    const url = body.url ?? body.data?.url;
    if (!url) throw new Error("The billing management session did not include a URL.");
    return { url };
  }
}
