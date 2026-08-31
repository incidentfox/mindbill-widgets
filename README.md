# MindBill partner SDK

The integration has one durable object: a bill. Your application keeps its own case, report, or patient model and stores the returned `bill.id`.

MindBill stores the frozen bill snapshot, payer documents, submissions, EORs, payments, denials, reviews, and lifecycle history.

## Install

```bash
npm install @mindbill/node @mindbill/react
# Angular: npm install @mindbill/node @mindbill/angular
```

The permanent API key stays on your server:

```ts
import { MindBillClient } from "@mindbill/node";

export const mindbill = new MindBillClient({
  apiKey: process.env.MINDBILL_API_KEY!,
  organizationId: process.env.MINDBILL_ORG_ID,
});
```

## 1. Create and submit one immutable bill

Collect and review every value and payer PDF in your application, then send the complete snapshot once. `externalId` is your report, evaluation, or work-item ID. The request requires an idempotency key.

```ts
const bill = await mindbill.createAndSubmitBill({
  bill: {
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
  },
  submission: { route: "ebill" },
  documents: [{
    filename: "final-report.pdf",
    documentType: "final_report",
    contentBase64: finalReportBytes.toString("base64"),
    externalId: "document_456",
  }],
}, crypto.randomUUID());

await saveBillId({ externalId: "evaluation_123", billId: bill.id });
```

The first public bill state is `submitted`. There is no draft, update, upload, delete, or separate submit operation: a successful response means MindBill accepted one immutable snapshot for delivery. Editing a provider in your application never rewrites a past claim.

For React applications, `BillSubmissionForm` supplies the entire authoring UI and contract: a responsive two-column form, paste-friendly dates, ZIP completion, ICD-10 chips, canonical payer search, evaluation-mode modifier defaults, fee-aware service lines, rich attachment uploads, validation, and Submit. Your application only supplies tenant bootstrap data and forwards the submitted snapshot through its server.

```tsx
import { BillSubmissionForm } from "@mindbill/react";

<BillSubmissionForm
  initialBill={bootstrap.bill}
  attachments={bootstrap.attachments}
  getSession={getMindBillSession}
  onSubmit={submitBill}
/>
```

The single browser session powers MindBill's canonical claims-administrator directory,
complete ICD-10 search, and ZIP-to-city/state lookup. The component bundles MindBill's
curated workers-comp procedure and modifier catalog, medical-legal fee rules, diagnosis
quick picks, and locked practice W-9 behavior. Pass optional catalog props only to add
organization-specific choices.

## 2. Render the submitted lifecycle

`ConnectedBillLifecycle` starts after submission. It loads the immutable bill, polls status, displays EORs, and exposes only the post-submission actions valid for the current state.

```tsx
import { ConnectedBillLifecycle } from "@mindbill/react";

export function Billing({ billId }: { billId: string }) {
  return (
    <ConnectedBillLifecycle
      billId={billId}
      sessionEndpoint="/api/mindbill/session"
      appearance={{ preset: "qme-companion" }}
    />
  );
}
```

Use `preset: "orange-bright"` for a compact orange theme, or override individual appearance tokens on any preset. The same theme covers status, EORs, payments, reviews, and close actions.

Angular uses the same bill ID, browser session, API calls, and lifecycle rules:

```ts
import { MindBillBillLifecycleComponent } from "@mindbill/angular";

@Component({
  standalone: true,
  imports: [MindBillBillLifecycleComponent],
  template: `
    <mindbill-bill-lifecycle
      [billId]="billId"
      [appearance]="{ preset: 'clinical-blue' }"
    />
  `,
})
export class CaseBillingComponent {
  billId = "bill_123";
}
```

The browser never receives the permanent API key. Add one authenticated route that maps your signed-in user to permissions and mints a short-lived, exact-origin session for your MindBill organization:

```ts
// app/api/mindbill/session/route.ts
import { mindbill } from "@/lib/mindbill";

export async function POST(request: Request) {
  const user = await requireUser(request);
  const permissions = billingPermissionsFor(user.role);

  const session = await mindbill.createBrowserSession({
    subject: user.id,
    allowedOrigin: new URL(request.url).origin,
    permissions,
    expiresIn: 900,
  });

  return Response.json({ token: session.token, expiresAt: session.expiresAt });
}
```

This route contains authorization, not billing business logic. The API key fixes the organization boundary; `subject` and `permissions` fix the user boundary. The component renews the session and calls MindBill directly to read and act on submitted bills.

Create and submit the bill from your server before rendering this component, then pass the returned `bill.id`. For a compact read-only surface, use `ConnectedBillStatus` with the same session endpoint. For a custom interface, use `useBillLifecycle` or `useBillStatus`. Signed webhooks remain the durable source of truth.

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

Available operations include close, Second Bill Review, EOR reads, and payment posting. A submitted bill is never edited or corrected in place. Signed webhooks provide live updates; `listEvents(cursor)` recovers missed deliveries.

## Data ownership

- Keep everything in your database: send complete bill snapshots and stable `externalId` values.
- Keep billing in MindBill: query bills, documents, status, and events by organization.
- Mix both: send your stable patient and claim IDs while MindBill remains the billing system of record. Every bill still freezes the exact values that were submitted.

The same bill contract supports California med-legal billing and `billingMode: "professional"` for IME, treatment, malpractice, hourly, and activity-based workflows. Professional service lines carry the explicit charge supplied by the partner; med-legal lines use MindBill fee-schedule logic.

## Reference

- [`@mindbill/node`](./packages/node)
- [`@mindbill/browser`](./packages/browser)
- [`@mindbill/react`](./packages/react)
- [`@mindbill/angular`](./packages/angular)
- [`@mindbill/embed`](./packages/embed)
- [Runnable server example](./examples/quickstart)
- [API reference](https://docs.mindbill.org/reference)
- [OpenAPI](https://app.mindbill.org/partner-openapi.yaml)

Use synthetic data in sandbox. Never put API keys, session tokens, or PHI in source control or public issues.

MIT. “MindBill” and related marks are trademarks of IncidentFox, Inc.
