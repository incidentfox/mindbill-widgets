# @mindbill/node

Dependency-free Node 20+ SDK and an agent-safe CLI for the MindBill Partner API.

`@mindbill/node` is published publicly on npm with provenance from this repository.

```ts
import { MindBillClient } from "@mindbill/node";

const mindbill = new MindBillClient({
  apiKey: process.env.MINDBILL_API_KEY!,
  ...(process.env.MINDBILL_ORG_ID
    ? { organizationId: process.env.MINDBILL_ORG_ID }
    : {}),
});
```

Provision a customer organization without creating a MindBill user or sending an invitation:

```ts
const customer = await mindbill.provisionOrganization(
  { name: "Synthetic QME Practice" },
  crypto.randomUUID(),
);
```

The managed organization is controlled through your server-side Partner API integration. Direct MindBill access is optional and explicit:

```ts
await mindbill.grantOrganizationUserAccess(
  customer.organizationId,
  { adminName: "Synthetic Owner", adminEmail: "owner@example.test" },
  crypto.randomUUID(),
);
```

Synchronize only the partner-owned profile data required for billing so the customer does
not enter it twice:

```ts
await mindbill.synchronizeOrganizationProfile(
  customer.organizationId,
  {
    source: "acme-records",
    practiceIdentity: { name: "Synthetic QME Practice" },
    renderingProviders: [
      { externalId: "provider_42", name: "Avery Example, MD", npi: "1234567893" },
    ],
  },
  crypto.randomUUID(),
);
```

Keep source workflow data in the partner product and billing lifecycle data in MindBill.
Use stable external IDs, idempotency keys, signed webhooks, and event reconciliation to keep
the documented overlap synchronized. Internal MindBill routing, payer intelligence, queues,
notes, credentials, and cross-customer data are never part of the Partner API contract.

The billing methods use the current Partner API wire shapes by default:

```ts
const quote = await mindbill.quote({
  lineItems: [{ code: "ML200", units: 1 }],
}, crypto.randomUUID());

const created = await mindbill.createBill({
  patient: { kind: "new" },
  fields: { externalId: "synthetic-example-1" },
  lineItems: [{ code: "ML200", units: 1 }],
}, crypto.randomUUID());

const submission = await mindbill.submitBill(
  created.billId,
  { route: "ebill" },
  crypto.randomUUID(),
);

if ("sandbox" in submission) {
  console.log(submission.state); // "paid" in the synthetic sandbox simulation
} else {
  console.log(submission.bill.status); // live workflow state, not payer proof
}
```

The same client covers the day-to-day lifecycle without exposing the Partner API key to
the browser:

```ts
const status = await mindbill.getBillStatus(created.billId);
const attachments = await mindbill.listBillAttachments(created.billId);
const eor = await mindbill.getBillEor(created.billId);

const review = await mindbill.createBillReview(
  created.billId,
  {
    type: "second_review",
    reason: "The report satisfies the documented criteria.",
    attachmentIds: attachments.data.map((item) => item.id),
  },
  crypto.randomUUID(),
);

await mindbill.submitBillReview(
  created.billId,
  review.data.id,
  crypto.randomUUID(),
);
```

`uploadBillAttachment` accepts a `Blob`, filename, document type, and optional stable
external ID. Default only payer-facing documents such as final reports, proof of service,
and required forms; never silently attach medical records.

`createBill` returns `{ patientId, injuryId, billId, billNumber }` directly. `getBill` returns
`{ bill, multiple?, ids? }`; `listBills` returns a required pagination envelope; and
`submitBill` returns a discriminated sandbox-or-live union. Responses are extensible, so avoid
rejecting additive fields. Use a key containing `bills:quote` for `quote`.

Webhook consumers can use `verifyMindBillWebhookSignature` with the exact raw body and
`compareMindBillEventSequence` for decimal sequence strings that may exceed JavaScript's safe
integer range. See the repository's [10-minute quickstart](https://github.com/incidentfox/mindbill-widgets#add-mindbill-billing-in-10-minutes).

Create a synthetic sandbox without printing the returned key:

```bash
pnpm dlx @mindbill/node signup \
  --company "Example Integration Lab" \
  --contact "Integration Owner" \
  --email "developer@example.com" \
  --accept-terms
```

The key is written to `.env.mindbill` mode `0600`. Live-access and billing commands return Stripe-hosted URLs for an authorized human; the CLI never accepts card data.
