# @mindbill/angular

Native Angular billing UI with built-in session renewal and lifecycle API calls.

```bash
npm install @mindbill/angular @mindbill/node
```

Import the standalone component and give it the one value your application keeps: the bill ID.

```ts
import { Component } from "@angular/core";
import { MindBillBillLifecycleComponent } from "@mindbill/angular";

@Component({
  selector: "app-case-billing",
  standalone: true,
  imports: [MindBillBillLifecycleComponent],
  template: `
    <mindbill-bill-lifecycle
      [billId]="billId"
      sessionEndpoint="/api/mindbill/bill-session"
      [appearance]="{ preset: 'clinical-blue' }"
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

Add one authenticated server endpoint. It verifies that the signed-in user may access the bill, then mints a short-lived token bound to that bill and browser origin.

```ts
import { MindBillClient } from "@mindbill/node";

const mindbill = new MindBillClient({ apiKey: process.env["MINDBILL_API_KEY"]! });

app.post("/api/mindbill/bill-session", requireUser, async (req, res) => {
  await requireBillAccess(req.user, req.body.billId);
  const session = await mindbill.createBrowserSession({
    component: "bill-review",
    billId: req.body.billId,
    allowedOrigin: `${req.protocol}://${req.get("host")}`,
    expiresIn: 900,
  });
  res.json(session);
});
```

Your permanent API key never reaches Angular. Available presets are `mindbill`, `qme-companion`, `orange-bright`, and `clinical-blue`; every visual token can also be overridden.
