# @mindbill/angular

Native Angular billing UI with built-in session renewal and lifecycle API calls.

```bash
npm install @mindbill/angular @mindbill/node
```

Import the standalone component. Pass either an existing bill ID or the known values for a new bill.

```ts
import { Component } from "@angular/core";
import { MindBillBillLifecycleComponent } from "@mindbill/angular";

@Component({
  selector: "app-case-billing",
  standalone: true,
  imports: [MindBillBillLifecycleComponent],
  template: `
    <mindbill-bill-lifecycle
      [create]="knownBillValues"
      sessionEndpoint="/api/mindbill/session"
      [appearance]="{ preset: 'clinical-blue' }"
      (billCreated)="rememberBill($event)"
      (billIdChange)="billId = $event"
    />
  `,
})
export class CaseBillingComponent {
  billId = "bill_123";
}
```

The component loads and refreshes status, searches the payer directory, saves bill edits, manages the explicit payer packet, submits the bill, shows EORs, and exposes the correct payment, review, correction, resubmission, and close actions for the current state.

Procedure entry always keeps one empty row after the entered lines. Starting a code, modifier, or non-default unit count opens the next row automatically; the empty row is never included in save or submit payloads.

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
