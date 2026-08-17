# @mindbill/node

Dependency-free Node 20+ SDK and an agent-safe CLI for the MindBill Partner API.

> **Publication pending:** `@mindbill/node` is not yet available from npm. The import and `pnpm dlx` commands below document the post-publication interface and currently return 404. Clone the [source repository](https://github.com/incidentfox/mindbill-widgets) to evaluate it locally, or use the [hosted developer portal](https://app.mindbill.org/developers) for account activation.

```ts
import { MindBillClient } from "@mindbill/node";

const mindbill = new MindBillClient({
  apiKey: process.env.MINDBILL_API_KEY!,
  ...(process.env.MINDBILL_ORG_ID
    ? { organizationId: process.env.MINDBILL_ORG_ID }
    : {}),
});
```

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

`createBill` returns `{ patientId, injuryId, billId, billNumber }` directly. `getBill` returns
`{ bill, multiple?, ids? }`; `listBills` returns a required pagination envelope; and
`submitBill` returns a discriminated sandbox-or-live union. Responses are extensible, so avoid
rejecting additive fields. Use a key containing `bills:quote` for `quote`.

Webhook consumers can use `verifyMindBillWebhookSignature` with the exact raw body and
`compareMindBillEventSequence` for decimal sequence strings that may exceed JavaScript's safe
integer range. See the [webhook guide](https://github.com/incidentfox/mindbill-widgets/blob/main/docs/webhooks.md).

Create a synthetic sandbox without printing the returned key:

```bash
pnpm dlx @mindbill/node signup \
  --company "Example Integration Lab" \
  --contact "Integration Owner" \
  --email "developer@example.com" \
  --accept-terms
```

The key is written to `.env.mindbill` mode `0600`. Live-access and billing commands return Stripe-hosted URLs for an authorized human; the CLI never accepts card data. See the [agent onboarding guide](https://github.com/incidentfox/mindbill-widgets/blob/main/docs/agent-onboarding.md).
