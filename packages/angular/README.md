# @mindbill/angular

Native Angular billing UI with built-in session renewal, bill lifecycle API calls, dashboards, aging, bill lists, and reporting. The components are standalone and do not bundle React.

```bash
npm install @mindbill/angular @mindbill/node
```

Import the standalone components. The submission component owns the review form, reference-directory lookups, validation, PDF upload, and atomic submission; the host app only provides initial case data and a short-lived browser session.

```ts
import { Component } from "@angular/core";
import {
  MindBillBillLifecycleComponent,
  MindBillBillSubmissionComponent,
  MindBillBillingDashboardComponent,
  MindBillBillingManagementButtonComponent,
  MindBillBillingReportComponent,
} from "@mindbill/angular";

@Component({
  selector: "app-case-billing",
  standalone: true,
  imports: [
    MindBillBillLifecycleComponent,
    MindBillBillSubmissionComponent,
    MindBillBillingDashboardComponent,
    MindBillBillingManagementButtonComponent,
    MindBillBillingReportComponent,
  ],
  template: `
    @if (!billId) {
      <mindbill-bill-submission
        [initialBill]="initialBill"
        [attachments]="attachments"
        sessionEndpoint="/api/mindbill/session"
        [appearance]="{ preset: 'clinical-blue' }"
        (submitted)="billId = $event.bill.id"
      />
    } @else {
    <mindbill-bill-lifecycle
      [billId]="billId"
      sessionEndpoint="/api/mindbill/session"
      [appearance]="{ preset: 'clinical-blue' }"
    />
    }
  `,
})
export class CaseBillingComponent {
  billId = "";
  initialBill = caseToMindBillInput(this.case);
  attachments = [{ file: this.finalReport, description: "Final report" }];
}
```

`MindBillBillSubmissionComponent` marks required fields, scrolls to invalid input, resolves ZIP codes to city and state with an inline status line, searches the MindBill claims-administrator and ICD-10 directories as you type, calculates service-line totals, and uploads attachments. Dates use a masked MM/DD/YYYY input that accepts ISO, US, or bare-digit entry, normalizes the display once a complete date is typed, and submits ISO values — identical to the React form. On success, render `MindBillBillLifecycleComponent` with the returned bill ID. The lifecycle component loads its own immutable bill snapshot, status, EORs, payments, history, and available actions.

When the lifecycle is rejected, it automatically renders the full ordered list of clearinghouse issues with actionable descriptions, acknowledgement codes, and sent/rejected timestamps. For custom layouts, use the same standalone surface directly:

```html
<mindbill-bill-rejection-notice
  [rejection]="rejection"
  [submittedAt]="submittedAt"
  [appearance]="{ preset: 'mindbill' }"
/>
```

```ts
import { MindBillBillRejectionNoticeComponent } from "@mindbill/angular";

rejection = {
  reason: "Correct the submitted dates.",
  source: "Jopari",
  receivedAt: "2026-09-01T16:11:00.000Z",
  issues: [
    { code: "A6:187", description: "From Date of Service cannot be in the future" },
    { code: "A6:88", description: "Thru Date of Service cannot be in the future" },
  ],
};
```

The component falls back to the legacy singular `reason` and `code` fields when `issues` is absent. Set `appearance.dangerColor` to customize its red treatment.

When MindBill authorizes **Correct and resubmit**, the lifecycle component
opens the same complete `MindBillBillSubmissionComponent` used for the first
submission. It carries forward the immutable snapshot and authenticated
document copies, highlights controls named by rejection `fieldPaths`, keeps
payer contact guidance visible, and submits the corrected bill and documents
as a new immutable attempt. The canonical `billId` stays the same and every
attempt remains in the bill history; the Angular host does not need a custom
correction form or resubmission API adapter.

Procedure codes, modifiers, and rendering taxonomy all use the same styled searchable dropdown (`mindbill-combo-box`) with code + description rows, hover states, and typed custom-code entry for complete CPT/HCPCS/medical-legal codes. Service lines accept multiple modifiers rendered as removable chips. PDFs can be dropped anywhere on the screen — a full-page overlay confirms the drop target — with the same 25 MB per-file, 100 MB total, and 20-document limits as the React form.

The default reference directories and field rules live in the component library. Hosts can provide custom procedure, modifier, and taxonomy options without reimplementing the form. For a fixture or Storybook, pass an async `submitter`; omit it in production so the component talks directly to the Partner API.

Add one authenticated server endpoint. It maps the signed-in user's role to permissions and mints a short-lived token bound to your organization, that user, and the browser origin.

```ts
import { MindBillClient } from "@mindbill/node";

const mindbill = new MindBillClient({ apiKey: process.env["MINDBILL_API_KEY"]! });

app.post("/api/mindbill/session", requireUser, async (req, res) => {
  const session = await mindbill.createBrowserSession({
    subject: req.user.id,
    allowedOrigin: `${req.protocol}://${req.get("host")}`,
    permissions: billingPermissionsFor(req.user.role),
    expiresIn: 900,
  });
  res.json(session);
});
```

Your permanent API key never reaches Angular. Available presets are `mindbill`, `qme-companion`, `orange-bright`, and `clinical-blue`; every visual token can also be overridden.

## Billing management SSO

Use the ready-made button wherever organization-level users should open the full MindBill workspace:

```html
<mindbill-billing-management-button
  sessionEndpoint="/api/mindbill/management-session"
  [appearance]="{ preset: 'clinical-blue' }"
/>
```

The endpoint returns `{ "url": "https://app.mindbill.org/..." }` after authenticating the user and creating a short-lived management session. The component opens a blank tab synchronously, then navigates it after the request completes so Safari and other popup blockers do not discard the SSO window.

## Operations components

The operations surfaces consume a normalized list of bills, so they can be used together or independently. The dashboard includes monthly submitted/closed metrics, clickable aging buckets, search, status filtering, and bill drill-down:

```html
<mindbill-billing-dashboard
  [bills]="bills"
  [appearance]="appearance"
  (billSelected)="openBill($event)"
/>

<mindbill-bill-aging-summary
  [buckets]="summary.aging"
  [appearance]="appearance"
/>

<mindbill-bill-list
  [bills]="bills"
  [appearance]="appearance"
  (billSelected)="openBill($event)"
/>

<mindbill-billing-report [bills]="bills" [appearance]="appearance" />

<mindbill-status-aging-matrix
  [bills]="bills"
  [appearance]="appearance"
  (cellSelected)="openDrillDown($event)"
/>
```

`mindbill-status-aging-matrix` is the management view billers coming from legacy tools expect: one row per lifecycle status, one column per 0–30 / 31–60 / 61–90 / 91+ aging bucket, clickable counts with outstanding balances, and row/column totals. Every emitted cell carries `{ state, bucket, count, balance, bills }`, so a drill-down never needs a second query. Pin a custom lifecycle ordering with `[stateOrder]`; unknown states append alphabetically.

`summarizeMindBillDashboard`, `buildMindBillReportRows`, `buildMindBillReportCsv`, `buildMindBillStatusAgingMatrix`, and `buildMindBillStatusAgingCsv` are also exported for custom layouts and server-side reporting.

`mindbill-bill-tasks-dashboard` is the daisyBill-style Bill Tasks worklist: one tone-colored card per task section, rows bucketed by age in days with clickable counts, and a grand-total card. Aggregate your own work items with `buildBillTasksDashboard` from `@mindbill/browser` (types re-exported here) and pass the result as `[data]`:

```html
<mindbill-bill-tasks-dashboard
  [data]="billTasks"
  heading="Bill Tasks"
  [appearance]="appearance"
  (cellSelected)="openWorklist($event)"
/>
```

Each emitted cell carries `{ sectionId, rowId, bucketId, refs, count }`, where `bucketId` is `null` for a row's Task Total column and `refs` are the bill references collected by the builder.

## Organization onboarding and billing settings

`mindbill-organization-onboarding` captures the practice identity, billing provider, locations, and W-9 once — saved straight to your MindBill organization through the browser session. Set `variant="settings"` for the compact edit-after-setup layout.

```html
<mindbill-organization-onboarding
  sessionEndpoint="/api/mindbill/session"
  [appearance]="appearance"
  (completed)="enableBillingFeatures()"
/>
```

The session must be minted with the optional `organization:manage` permission. Each step saves independently through idempotent upserts that never delete records created elsewhere; the review step mirrors MindBill's onboarding checklist.
