# @mindbill/node

Dependency-free Node 20+ client for the MindBill Partner API.

```bash
npm install @mindbill/node
```

```ts
import { MindBillClient } from "@mindbill/node";

const mindbill = new MindBillClient({
  apiKey: process.env.MINDBILL_API_KEY!,
});
```

The key uses its developer workspace automatically; no organization ID is required. Optional explicit organization routing remains available for existing practice connections.

The bill is the primary resource. Resolve the customer from an authorized host case and persist one creation key for the logical bill before submitting:

```ts
const bill = await mindbill.createAndSubmitBill({
  customerExternalId: authorizedCase.customerExternalId,
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
    claimsAdministrator: {
      id: "payer_demo_123",
      name: "Example Claims Administrator",
    },
    },
    service: { date: "2026-08-25" },
    billingProvider: {
      name: "Example Evaluations Medical Group, Inc.",
      taxId: "12-3456789",
      npi: "1234567893",
      phone: "213-555-0100",
      address: {
        line1: "100 Example Avenue",
        city: "Los Angeles",
        state: "CA",
        postalCode: "90012",
      },
    },
    renderingProvider: {
      name: "Avery Example, MD",
      npi: "1234567893",
      taxonomy: "208D00000X",
    },
    serviceLocation: {
      name: "Main office",
      address: {
        line1: "100 Example Avenue",
        city: "Los Angeles",
        state: "CA",
        postalCode: "90012",
      },
      placeOfServiceCode: "11",
    },
    diagnoses: ["M25.512"],
    serviceLines: [{ code: "ML201", modifiers: ["95"], units: 1 }],
  },
  submission: { route: "ebill" },
  documents: [{
    filename: "final-report.pdf",
    documentType: "final_report",
    contentBase64: finalReportBytes.toString("base64"),
  }, {
    filename: "provider-w9.pdf",
    documentType: "w9",
    contentBase64: providerW9Bytes.toString("base64"),
  }],
}, persistedCaseCreationKey);
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

Browser sessions accept a server-derived `resource: { customerExternalId }` for customer collections and creation, `{ billId }` for one existing bill, or both fields for their intersection. A bill-restricted token cannot create. Shared settings require a separate unscoped workspace-administrator session with `organization:manage`. Customer tokens cannot read or manage shared billing profiles. The browser user ID in `subject` is an audit identity, not a customer access rule.
