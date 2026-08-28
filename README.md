# MindBill partner SDK

The integration has one durable object: a bill. Your application keeps its own case, report, or patient model and stores the returned `bill.id`.

MindBill stores the frozen bill snapshot, payer documents, submissions, EORs, payments, denials, reviews, and lifecycle history.

## Install

```bash
npm install @mindbill/node @mindbill/react
```

The permanent API key stays on your server:

```ts
import { MindBillClient } from "@mindbill/node";

export const mindbill = new MindBillClient({
  apiKey: process.env.MINDBILL_API_KEY!,
  organizationId: process.env.MINDBILL_ORG_ID,
});
```

## 1. Create one bill

Send the values that should be printed on the claim. `externalId` is your report, evaluation, or work-item ID. Every mutation takes an idempotency key.

```ts
const bill = await mindbill.createBill({
  externalId: "evaluation_123",
  patient: {
    externalId: "patient_42",
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
    externalId: "claim_99",
    claimNumber: "DEMO-12345",
    employer: "Example Manufacturing",
    dateOfInjury: "2026-06-20",
    injuryState: "CA",
    claimsAdministrator: { name: "Example Claims Administrator" },
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
    licenseNumber: "A12345",
    licenseState: "CA",
    isQme: true,
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
}, crypto.randomUUID());

await saveBillId({ externalId: "evaluation_123", billId: bill.id });
```

The bill freezes these values. Editing a saved provider later never rewrites a past claim. To correct a draft, call `updateBill(bill.id, patch, idempotencyKey)`.

## 2. Add the payer packet

Documents are explicit. Default final reports, proof of service, W-9s, and required forms when appropriate. Never silently attach medical records, and keep the payer billing packet separate from attorney report service.

```ts
await mindbill.uploadBillDocument(bill.id, {
  file: finalReportBlob,
  filename: "final-report.pdf",
  documentType: "final_report",
  externalId: "document_456",
}, crypto.randomUUID());
```

Users can review, remove, and intentionally add supporting PDFs before submission.

## 3. Render the complete lifecycle

`ConnectedBillLifecycle` loads the bill, searches the payer directory, saves edits, manages documents, submits, polls status, displays EORs, and exposes only the actions valid for the current state.

```tsx
import { ConnectedBillLifecycle } from "@mindbill/react";

export function Billing({ billId }: { billId: string }) {
  return (
    <ConnectedBillLifecycle
      billId={billId}
      sessionEndpoint="/api/mindbill/session"
      appearance={{ accentColor: "#32a9d6", textColor: "#203743" }}
    />
  );
}
```

The browser never receives the permanent API key. Add one authenticated route that checks access and mints a short-lived, exact-origin session:

```ts
// app/api/mindbill/session/route.ts
import { mindbill } from "@/lib/mindbill";

export async function POST(request: Request) {
  const user = await requireUser(request);
  const { billId } = await request.json();
  await requireBillAccess(user, billId);

  const session = await mindbill.createBrowserSession({
    component: "bill-review",
    billId,
    allowedOrigin: new URL(request.url).origin,
    expiresIn: 900,
  });

  return Response.json({ token: session.token, expiresAt: session.expiresAt });
}
```

This route contains authorization, not billing business logic. The component renews the session and calls MindBill directly.

For a compact read-only surface, use `ConnectedBillStatus` with a `bill-timeline` session. For a custom interface, use `useBillLifecycle` or `useBillStatus`. `MindBillBillReview` is available when a hosted surface is preferable to native React.

## Server-side lifecycle calls

The same bill ID is used for every operation:

```ts
const status = await mindbill.getBillStatus(bill.id);
const eor = await mindbill.getBillEor(bill.id);

if (status.data.state === "denied") {
  const review = await mindbill.createBillReview(bill.id, {
    type: "second_review",
    reason: "The report satisfies the documented criteria.",
    attachmentIds: supportingDocumentIds,
  }, crypto.randomUUID());

  await mindbill.submitBillReview(
    bill.id,
    review.data.id,
    crypto.randomUUID(),
  );
}
```

Available operations include submit, close, correction/resubmission, Second Bill Review, EOR reads, and payment posting. Signed webhooks provide live updates; `listEvents(cursor)` recovers missed deliveries.

## Data ownership

- Keep everything in your database: send complete bill snapshots and stable `externalId` values.
- Keep billing in MindBill: query bills, documents, status, and events by organization.
- Mix both: send your stable patient and claim IDs while MindBill remains the billing system of record. Every bill still freezes the exact values that were submitted.

The current public implementation supports California med-legal billing. The contract reserves `billingMode: "professional"` for hourly and activity-based IME workflows, but the server currently returns `422 billing_mode_not_available`; no generic pricing behavior is implied yet.

## Reference

- [`@mindbill/node`](./packages/node)
- [`@mindbill/react`](./packages/react)
- [`@mindbill/embed`](./packages/embed)
- [Runnable server example](./examples/quickstart)
- [API reference](https://app.mindbill.org/developers/reference)
- [OpenAPI](https://app.mindbill.org/partner-openapi.yaml)

Use synthetic data in sandbox. Never put API keys, session tokens, or PHI in source control or public issues.

MIT. “MindBill” and related marks are trademarks of IncidentFox, Inc.
