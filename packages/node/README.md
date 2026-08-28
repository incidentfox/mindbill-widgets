# @mindbill/node

Dependency-free Node 20+ client for the MindBill Partner API.

```bash
npm install @mindbill/node
```

```ts
import { MindBillClient } from "@mindbill/node";

const mindbill = new MindBillClient({
  apiKey: process.env.MINDBILL_API_KEY!,
  organizationId: process.env.MINDBILL_ORG_ID,
});
```

The bill is the primary resource:

```ts
const bill = await mindbill.createBill({
  externalId: "report_123",
  patient: {
    firstName: "Taylor",
    lastName: "Example",
    dateOfBirth: "1984-04-12",
    address: {
      line1: "100 Example Avenue",
      city: "Los Angeles",
      state: "CA",
      postalCode: "90012",
    },
  },
  claim: {
    claimNumber: "DEMO-12345",
    employer: "Example Manufacturing",
    dateOfInjury: "2026-06-20",
    injuryState: "CA",
  },
  service: { date: "2026-08-25" },
  diagnoses: ["M25.512"],
  serviceLines: [{ code: "ML201", modifiers: ["95"], units: 1 }],
}, crypto.randomUUID());

await mindbill.updateBill(
  bill.id,
  { claim: { employer: "Corrected Employer" } },
  crypto.randomUUID(),
);
```

Documents and submission use the same bill ID:

```ts
await mindbill.uploadBillDocument(bill.id, {
  file: finalReport,
  filename: "final-report.pdf",
  documentType: "final_report",
}, crypto.randomUUID());

await mindbill.submitBill(
  bill.id,
  { route: "ebill" },
  crypto.randomUUID(),
);
```

Read status and EORs, then perform an explicit lifecycle action:

```ts
const status = await mindbill.getBillStatus(bill.id);
const eor = await mindbill.getBillEor(bill.id);

await mindbill.performBillAction(
  bill.id,
  {
    action: "post_payment",
    amount: 503.75,
    method: "check",
    checkNumber: "4811505",
    depositDate: "2026-08-25",
  },
  crypto.randomUUID(),
);
```

Every mutation requires an idempotency key. Keep the API key on your server. To let native React components call MindBill without a billing proxy, authorize the signed-in user and call `createBrowserSession` from one server route.

Webhook consumers can use `verifyMindBillWebhookSignature` with the exact raw body and `compareMindBillEventSequence` for arbitrary-length sequence values.

The public client intentionally has no organization, provider, or location synchronization API. Send the values that belong on each bill and retain the returned bill ID. Stable `externalId` values let you query the same bill, patient, or claim without duplicating your database model.
