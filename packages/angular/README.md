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

`MindBillBillSubmissionComponent` marks required fields, scrolls to invalid input, resolves ZIP codes, searches the MindBill claims-administrator and ICD-10 directories, calculates service-line totals, and uploads attachments. On success, render `MindBillBillLifecycleComponent` with the returned bill ID. The lifecycle component loads its own immutable bill snapshot, status, EORs, payments, history, and available actions.

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
```

`summarizeMindBillDashboard`, `buildMindBillReportRows`, and `buildMindBillReportCsv` are also exported for custom layouts and server-side reporting.
