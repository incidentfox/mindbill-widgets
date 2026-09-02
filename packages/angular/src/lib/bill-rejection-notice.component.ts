import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import type { BillRejection } from "@mindbill/browser";
import type { MindBillAngularAppearance } from "./appearance";
import { mindBillAngularAppearanceStyle } from "./appearance";
import { billRejectionIssues, billRejectionIssueSummary } from "./bill-rejection";

@Component({
  selector: "mindbill-bill-rejection-notice",
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="notice" [ngStyle]="themeStyle" role="alert" aria-label="Bill rejection reasons">
      <div class="overview">
        <header>
          <span class="icon" aria-hidden="true">!</span>
          <div><strong>{{ title }}</strong><span>Fix the {{ issues.length === 1 ? 'issue' : 'issues' }} below, then resubmit.</span></div>
        </header>
        <ol class="progress" aria-label="Submission status">
          <li><span aria-hidden="true">✓</span><b>Sent</b>@if (submittedAt) { <small>{{ formatDate(submittedAt) }}</small> }</li>
          <li class="rejected" aria-current="step"><span aria-hidden="true">!</span><b>Rejected</b>@if (rejection.receivedAt) { <small>{{ formatDate(rejection.receivedAt) }}</small> }</li>
        </ol>
      </div>
      <div class="issues" aria-label="Rejection reasons">
        <div class="issues-heading"><strong><span aria-hidden="true">△</span> Rejection reasons</strong><span>{{ issueSummary }}</span></div>
        <ol [attr.aria-label]="issues.length + ' rejection ' + (issues.length === 1 ? 'reason' : 'reasons')">
          @for (issue of issues; track $index) {
            <li><span class="bullet" aria-hidden="true"></span><p>{{ issue.description }}</p>@if (issue.code) { <span class="code">{{ issue.code }}</span> }</li>
          }
        </ol>
        @if (hasCodes) { <p class="code-note"><span aria-hidden="true">i</span> Technical error codes are included for support and auditability.</p> }
      </div>
    </section>
  `,
  styles: [`
    :host{display:block}.notice,.notice *{box-sizing:border-box}.notice{font-family:var(--font,Inter,system-ui,sans-serif);color:var(--t,#203743);border:1px solid color-mix(in srgb,var(--danger) 30%,var(--b));border-left:4px solid var(--danger);border-radius:var(--r,14px);background:color-mix(in srgb,var(--danger) 5%,var(--s));box-shadow:0 14px 38px color-mix(in srgb,var(--danger) 9%,transparent);padding:26px 28px 18px}.overview{display:grid;grid-template-columns:minmax(230px,.72fr) minmax(360px,1.28fr);align-items:start;gap:38px}header{display:flex;align-items:flex-start;gap:14px}header>div{display:grid;gap:5px}header strong{color:var(--danger);font-size:19px;line-height:1.25}header div>span{color:color-mix(in srgb,var(--danger) 48%,var(--t));font-size:14px;line-height:1.45}.icon{display:grid;place-items:center;flex:0 0 auto;width:42px;height:42px;border-radius:50%;background:var(--danger);box-shadow:0 5px 14px color-mix(in srgb,var(--danger) 25%,transparent);color:#fff;font-size:21px;font-weight:900}.progress{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));list-style:none;margin:5px 0 24px;padding:0}.progress li{display:grid;grid-template-rows:34px auto auto;gap:4px;position:relative;text-align:center;font-size:12px}.progress li:first-child:after{content:"";position:absolute;left:calc(50% + 17px);right:calc(-50% + 17px);top:16px;height:2px;background:color-mix(in srgb,var(--danger) 48%,var(--b))}.progress li>span{display:grid;place-items:center;justify-self:center;position:relative;z-index:1;width:34px;height:34px;border:2px solid color-mix(in srgb,var(--danger) 32%,var(--b));border-radius:50%;background:var(--s);color:var(--danger);font-size:16px;font-weight:900}.progress li.rejected>span{border-color:var(--danger);background:var(--danger);color:#fff}.progress b{font-size:13px}.progress small{color:var(--m);font-size:11px;line-height:1.3}.issues{border:1px solid color-mix(in srgb,var(--danger) 19%,var(--b));border-radius:12px;background:color-mix(in srgb,var(--danger) 2%,var(--s));overflow:hidden}.issues-heading{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 16px;border-bottom:1px solid color-mix(in srgb,var(--danger) 14%,var(--b))}.issues-heading strong{display:flex;align-items:center;gap:8px;font-size:13px}.issues-heading strong>span{color:var(--danger);font-size:17px}.issues-heading>span{color:var(--m);font-size:12px;text-align:right}.issues ol{display:grid;gap:7px;list-style:none;margin:0;padding:10px 12px}.issues li{display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:11px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--danger) 11%,var(--b));border-radius:8px;background:color-mix(in srgb,var(--danger) 1%,var(--s));box-shadow:0 1px 3px rgba(23,39,48,.04)}.bullet{width:7px;height:7px;border-radius:50%;background:var(--danger)}.issues p{margin:0;font-size:14px;line-height:1.45}.code{justify-self:end;border:1px solid color-mix(in srgb,var(--danger) 20%,var(--b));border-radius:999px;background:color-mix(in srgb,var(--danger) 6%,var(--s));color:var(--danger);font-size:11px;font-weight:850;line-height:1.2;padding:4px 8px}.code-note{display:flex;align-items:center;gap:7px;margin:0;padding:1px 16px 13px;color:var(--m);font-size:11px}.code-note>span{display:grid;place-items:center;width:16px;height:16px;border:1px solid currentColor;border-radius:50%;font-size:10px;font-weight:850}@media(max-width:700px){.notice{padding:18px 14px 14px}.overview{grid-template-columns:1fr;gap:18px}header strong{font-size:17px}.icon{width:36px;height:36px}.progress{margin:0 0 4px}.issues-heading{align-items:flex-start;flex-direction:column;gap:4px}.issues-heading>span{text-align:left}.issues li{grid-template-columns:8px minmax(0,1fr);gap:8px 10px}.code{grid-column:2;justify-self:start}}
  `],
})
export class MindBillBillRejectionNoticeComponent {
  @Input({ required: true }) rejection!: BillRejection;
  @Input() submittedAt: string | null = null;
  @Input() title = "Rejected — action required";
  @Input() appearance: MindBillAngularAppearance = { preset: "mindbill" };

  get issues() { return billRejectionIssues(this.rejection); }
  get hasCodes(): boolean { return this.issues.some((issue) => Boolean(issue.code)); }
  get issueSummary(): string { return billRejectionIssueSummary(this.rejection, this.issues.length); }
  get themeStyle(): Record<string, string> { return mindBillAngularAppearanceStyle(this.appearance); }
  formatDate(value: string): string { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed); }
}
