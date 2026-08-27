# MindBill partner SDK

Add medical billing with one server route, one React surface, and one stored `billId`.

Your server holds the Partner API key. Your browser uses your own authenticated endpoints or a short-lived, origin-bound hosted session. MindBill owns submission, payer status, EORs, denials, payments, and reviews.

## 10-minute setup

### 1. Install

```bash
npm install @mindbill/node @mindbill/react
```

Use synthetic data in sandbox. Never put a Partner API key in browser code.

```ts
import { MindBillClient } from "@mindbill/node";

export const mindbill = new MindBillClient({
  apiKey: process.env.MINDBILL_API_KEY!,
  organizationId: process.env.MINDBILL_ORG_ID,
});
```

### 2. Create a draft from data you already have

No provider, location, or patient synchronization is required. Send inline values and a stable external ID; MindBill freezes the values onto that bill.

```ts
const draft = await mindbill.createBill({
  externalId: "evaluation_123",
  patient: { kind: "new" },
  fields: {
    patientFirstName: "Taylor",
    patientLastName: "Example",
    dateOfService: "2026-08-25",
  },
  billingProvider: {
    name: "Example Evaluations Medical Group, Inc.",
    taxId: "12-3456789",
    npi: "1234567893",
    billType: "Professional",
  },
  renderingProvider: {
    name: "Avery Example, MD",
    npi: "1234567893",
    taxonomy: "208D00000X",
    licenseNumber: "A12345",
    licenseState: "CA",
  },
  placeOfService: {
    name: "Main office",
    street: "100 Example Avenue",
    city: "Los Angeles",
    state: "CA",
    zip: "90012",
    posCode: "11",
  },
  lineItems: [{ code: "ML201", modifiers: ["95"], units: 1 }],
}, crypto.randomUUID());

// Persist draft.billId next to your evaluation/case ID.
```

Saved MindBill provider and location records are optional conveniences for reuse, search, and reporting. Partners may keep all source data themselves, use MindBill records, or mix both models without changing the bill contract.

### 3. Add the payer packet

```ts
await mindbill.uploadBillAttachment(draft.billId, {
  file: finalReportBlob,
  filename: "final-report.pdf",
  documentType: "final_report",
  externalId: "document_456",
}, crypto.randomUUID());
```

Sensible defaults are the final report, proof of service, and required billing forms. Medical records are never silently attached. Users may review, remove, or intentionally add any supporting PDF. Keep the payer billing packet separate from attorney report service.

### 4. Add the UI

Use the native review form for bill edits and submission:

The connected form also includes claims-administrator lookup and payer intelligence. It combines payer-name aliases with the bill's claim-number pattern, explains each suggestion, shows whether electronic delivery is available, and never silently chooses a claim-pattern-only match.

```tsx
import { BillReviewForm } from "@mindbill/react";

<BillReviewForm
  data={review}
  appearance={{ accentColor: "#32a9d6", textColor: "#203743" }}
  onSave={(values) => api.saveReview(billId, values)}
  onSubmit={(values, route) => api.submitBill(billId, values, route)}
  onAddAttachment={(file, type, description) =>
    api.addAttachment(billId, file, type, description)
  }
  onRemoveAttachment={(attachmentId) =>
    api.removeAttachment(billId, attachmentId)
  }
/>

```

For status, add one tiny route that mints a short-lived browser session:

```ts
// app/api/mindbill/status-session/route.ts
export async function POST(request: Request) {
  const user = await requireUser(request);
  const { billId } = await request.json();
  await requireBillAccess(user, billId);

  const session = await mindbill.createEmbedSession({
    component: "bill-timeline",
    billId,
    allowedOrigin: new URL(request.url).origin,
    expiresIn: 900,
  });

  return Response.json({ token: session.token, expiresAt: session.expiresAt });
}
```

Then the component handles status fetching, token caching and renewal, polling, focus refresh, loading, and retry:

```tsx
import { ConnectedBillStatus } from "@mindbill/react";

<ConnectedBillStatus
  billId={billId}
  actions={[
    { id: "eor", label: "View EOR", onClick: openEor },
    { id: "payment", label: "Post payment", onClick: postPayment, primary: true },
  ]}
/>
```

Use `useBillStatus({ billId })` for custom UI, or `createBillStatusClient` outside React. No billing proxy or status backend is required. Your route only applies your existing user authentication and bill authorization; the browser then reads status directly from MindBill.

Never expose a permanent Partner API key in frontend code. A zero-server integration is possible only when MindBill-hosted authentication/SSO authenticates the end user.

For a hosted review, mint a `bill-review` session and render `HostedBillReview`:

```ts
const session = await mindbill.createEmbedSession({
  component: "bill-review",
  billId,
  allowedOrigin: "https://your-product.example",
  expiresIn: 900,
});
```

```tsx
import { HostedBillReview } from "@mindbill/react";

<HostedBillReview
  sessionToken={session.token}
  embedUrl={session.embedUrl}
  appearance={{ theme: "system", accentColor: "#32a9d6" }}
  onMindBill={() => refreshStatus()}
/>
```

The hosted token is short-lived and valid only on the exact HTTPS origin. Both UI paths use the same bill and attachment APIs.

### 5. Read status and act

```ts
const status = await mindbill.getBillStatus(billId);

if (status.data.state === "denied") {
  const review = await mindbill.createBillReview(billId, {
    type: "second_review",
    reason: "The report satisfies the documented criteria.",
    attachmentIds: supportingAttachmentIds,
  }, crypto.randomUUID());

  await mindbill.submitBillReview(
    billId,
    review.data.id,
    crypto.randomUUID(),
  );
}

const eor = await mindbill.getBillEor(billId);
```

Your application normally stores only its own external ID plus `billId`. Use signed webhooks for live updates and `listEvents(cursor)` to recover gaps. Treat MindBill as authoritative for the billing lifecycle.

## QME and IME workflows

The integration shape is shared: professional claim data, service lines, payer documents, status, and lifecycle actions. Pricing policy is separate:

- California QME/med-legal billing uses configured med-legal codes, modifiers, and fee-schedule rules.
- Generic IME, malpractice, hourly, activity-based, and fixed-fee work should send contract-backed service lines and amounts. A self-serve contract-pricing engine is not yet part of the public API.

This separation keeps the API stable without applying California QME rules to unrelated evaluations.

## What is available today

- Draft creation, payer packet attachments, submission, status, EOR reads, and Second Bill Review.
- Native React review/status components and hosted review/timeline components.
- Optional organization/provider/location records and organization-scoped MindBill access.

Payment posting, close, generic rejection resubmission, and Independent Bill Review are still handled in hosted/full MindBill rather than public SDK methods.

## Sandbox and reference

```bash
npx mindbill signup \
  --company "Example Integration Lab" \
  --contact "Avery Example" \
  --email "developer@example.com" \
  --accept-terms
```

The one-time key is saved to `.env.mindbill` with owner-only permissions. Add it to `.gitignore`.

- [`@mindbill/node`](./packages/node): server SDK and webhook verification
- [`@mindbill/react`](./packages/react): native and hosted React components
- [`@mindbill/embed`](./packages/embed): framework-neutral hosted elements
- [Runnable example](./examples/quickstart)
- [API reference](https://app.mindbill.org/developers/reference)
- [OpenAPI](https://app.mindbill.org/partner-openapi.yaml)

Live access requires organization onboarding, BAA acceptance, and hosted payment setup. Public issues must contain no PHI, credentials, or embed tokens.

MIT. “MindBill” and related marks are trademarks of IncidentFox, Inc.
