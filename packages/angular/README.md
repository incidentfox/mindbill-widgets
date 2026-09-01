# @mindbill/angular

Native Angular billing UI with built-in session renewal, bill lifecycle API calls, dashboards, aging, bill lists, and reporting. The components are standalone and do not bundle React.

```bash
npm install @mindbill/angular @mindbill/node
```

Import the standalone component and pass the ID returned by your server's atomic create-and-submit request.

```ts
import { Component } from "@angular/core";
import {
  MindBillBillLifecycleComponent,
  MindBillBillingDashboardComponent,
  MindBillBillingReportComponent,
} from "@mindbill/angular";

@Component({
  selector: "app-case-billing",
  standalone: true,
  imports: [
    MindBillBillLifecycleComponent,
    MindBillBillingDashboardComponent,
    MindBillBillingReportComponent,
  ],
  template: `
    <mindbill-bill-lifecycle
      [billId]="billId"
      sessionEndpoint="/api/mindbill/session"
      [appearance]="{ preset: 'clinical-blue' }"
    />
  `,
})
export class CaseBillingComponent {
  billId = "bill_123";
}
```

The component loads and refreshes submitted-bill status, shows EORs, and exposes the correct payment, review, and close actions for the current state. It never creates or edits a bill.

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

## Operations components

The operations surfaces consume a normalized list of bills, so they can be used together or independently:

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
