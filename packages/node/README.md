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
const bill = await mindbill.createAndSubmitBill({
  bill: {
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
  },
  submission: { route: "ebill" },
  documents: [{
    filename: "final-report.pdf",
    documentType: "final_report",
    contentBase64: finalReportBytes.toString("base64"),
  }],
}, crypto.randomUUID());
```

The request atomically creates and submits the bill. Its first public state is `submitted`; the public client intentionally exposes no bill draft, update, document mutation, or separate submission API.

Read the immutable bill, human-readable lifecycle/history, EORs, or complete
submission packet, then perform an explicit lifecycle action:

```ts
const status = await mindbill.getBillStatus(bill.id);
const lifecycle = await mindbill.getBillLifecycle(bill.id);
const eor = await mindbill.getBillEor(bill.id);
const packet = await mindbill.downloadBillPacket(bill.id);

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

Every mutation requires an idempotency key. Keep the API key on your server. To let native React components read and act on a submitted bill without a billing proxy, authorize the signed-in user and call `createBrowserSession` from one server route.

Webhook consumers can use `verifyMindBillWebhookSignature` with the exact raw body and `compareMindBillEventSequence` for arbitrary-length sequence values.

The public client intentionally has no organization, provider, or location synchronization API. Send the values that belong on each bill and retain the returned bill ID. Stable `externalId` values let you query the same bill, patient, or claim without duplicating your database model.
