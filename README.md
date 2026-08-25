# Add MindBill billing in 10 minutes

The default integration is one hosted workflow, one compact status surface, and one organization-scoped link to MindBill. Your product supplies known structured data and documents. MindBill owns validation, submission, acknowledgements, payment, denial, and resubmission.

Use synthetic data in sandbox. Never put a Partner API key in browser code.

## 1. Install and create a sandbox

```bash
npm install @mindbill/node @mindbill/react @mindbill/embed
npx mindbill signup \
  --company "Example Integration Lab" \
  --contact "Avery Example" \
  --email "developer@example.com" \
  --accept-terms
```

The CLI saves the one-time sandbox key to `.env.mindbill` with owner-only permissions. Add that file to `.gitignore`.

```ts
import { MindBillClient } from "@mindbill/node";

const mindbill = new MindBillClient({
  apiKey: process.env.MINDBILL_API_KEY!,
  organizationId: process.env.MINDBILL_ORG_ID,
});
```

## 2. Set up the organization once

Provision one managed organization per customer. Managed organizations need no separate MindBill invitation.

```ts
const organization = await mindbill.provisionOrganization(
  { name: "Example Evaluations" },
  crypto.randomUUID(),
);

await mindbill.synchronizeOrganizationProfile(
  organization.organizationId,
  {
    source: "your-product",
    practiceIdentity: {
      name: "Example Evaluations",
      legalName: "Example Evaluations Medical Group, Inc.",
      taxId: "12-3456789",
      npi: "1234567893",
    },
    renderingProviders: [{
      externalId: "clinician_42",
      name: "Avery Example, MD",
      npi: "1234567893",
      taxonomy: "208D00000X",
      licenseNumber: "A12345",
      licenseState: "CA",
    }],
    locations: [{
      externalId: "location_main",
      name: "Main office",
      street: "100 Example Avenue",
      city: "Los Angeles",
      state: "CA",
      zip: "90012",
      isPrimary: true,
    }],
  },
  crypto.randomUUID(),
);
```

Open an `onboarding` hosted session for the customer to review genuinely missing fields and upload the organization W-9 and clinician signatures. Practice identity, tax ID, group NPI, locations, W-9, and clinician NPI/taxonomy/license/signature are reusable; do not ask for them again on every bill.

## 3. Send a clean payer packet

Create a draft from your server with stable external IDs, known case fields, and service lines. Service lines are not QME-specific: use the agreed code and `units` for a QME case, IME, malpractice review, hourly work, or another activity-based service.

Default only billing documents that are sensible for the payer packet:

- final report;
- proof of service;
- required billing forms;
- intentionally selected supporting documents.

Never silently auto-attach medical records. Keep any attorney report-service packet separate from the payer billing packet. The hosted review lets the user inspect defaults, remove a document, and intentionally add arbitrary supporting PDFs before submission.

## 4. Mint an origin-bound session on your server

After authenticating your own user and confirming access to the bill:

```ts
const session = await mindbill.createEmbedSession({
  component: "bill-review",
  billId: "synthetic_bill_123",
  allowedOrigin: "https://your-product.example",
  expiresIn: 900,
});

// Send only these transient values to your browser.
return Response.json({
  token: session.token,
  embedUrl: session.embedUrl,
  mindBillUrl: session.mindBillUrl,
});
```

`allowedOrigin` must be the exact HTTPS origin. The token expires and is valid only from that origin.

## 5. Open the hosted billing flow

React:

```tsx
import { HostedBillReview } from "@mindbill/react";

<HostedBillReview
  sessionToken={session.token}
  embedUrl={session.embedUrl}
  appearance={{ theme: "system", accentColor: "#176b65" }}
  onMindBill={(event) => refreshBillStatus(event.detail.event)}
/>
```

Framework-neutral HTML:

```html
<script type="module" src="https://unpkg.com/@mindbill/embed@0.4.0/dist/index.js"></script>
<mindbill-bill-review
  session-token="SHORT_LIVED_SESSION_TOKEN"
  embed-url="https://app.mindbill.org/embed/bill-review"
  theme="system"
></mindbill-bill-review>
```

The user reviews prefilled values and documents, fixes only missing or incorrect fields, selects the route, and submits. Your product should not recreate MindBill’s submission UI.

## 6. Show status and open the full lifecycle

Use `HostedBillTimeline` as the lightweight embedded status/aging surface. It shows the current state, balance, age, and recent lifecycle activity without pulling collections operations into your product.

```tsx
import { HostedBillTimeline } from "@mindbill/react";

<HostedBillTimeline sessionToken={timeline.token} embedUrl={timeline.embedUrl} />
<a href={timeline.mindBillUrl}>Open in MindBill</a>
```

The bill-scoped `mindBillUrl` is authorized to the session organization. If a managed customer needs direct MindBill access, grant it once and explicitly:

```ts
await mindbill.grantOrganizationUserAccess(
  organizationId,
  { adminName: "Practice Owner", adminEmail: "owner@example.com" },
  crypto.randomUUID(),
);
```

## 7. Receive and reconcile status

Verify signed webhooks against the exact raw request body, deduplicate event IDs, and persist the decimal `sequence` as text. Poll from the last cursor after downtime or a sequence gap.

```ts
import {
  compareMindBillEventSequence,
  verifyMindBillWebhookSignature,
} from "@mindbill/node";

const rawBody = new Uint8Array(await request.arrayBuffer());
if (!verifyMindBillWebhookSignature(
  rawBody,
  request.headers.get("mindbill-signature"),
  process.env.MINDBILL_WEBHOOK_SECRET!,
)) return new Response("invalid signature", { status: 400 });

const event = JSON.parse(new TextDecoder().decode(rawBody));
if (compareMindBillEventSequence(event.sequence, durableCursor) > 0) {
  await recordEventAndAdvanceCursor(event); // one durable transaction
}

const missed = await mindbill.listEvents(durableCursor);
```

Treat MindBill as authoritative for bill IDs, submission, clearinghouse and payer status, EORs, payments, denials, and resubmissions. Log request IDs and closed statuses—not patient details, document contents, API keys, or embed tokens.

## Run the minimal example

[`examples/quickstart/server.mjs`](./examples/quickstart/server.mjs) is a complete tiny server and browser host. It expects a synthetic sandbox bill and an exact HTTPS development origin (for example, a tunnel to local port 4173).

```bash
cd examples/quickstart
npm install
MINDBILL_API_KEY=... \
MINDBILL_ORG_ID=... \
MINDBILL_SYNTHETIC_BILL_ID=... \
APP_ORIGIN=https://your-dev-origin.example \
npm start
```

## Packages and reference

- `@mindbill/node`: server SDK, CLI, webhook verification.
- `@mindbill/embed`: framework-neutral hosted elements.
- `@mindbill/react`: React wrappers.
- [Hosted API reference](https://app.mindbill.org/developers/reference)
- [OpenAPI](https://app.mindbill.org/partner-openapi.yaml)

Live access requires organization onboarding, BAA acceptance, and hosted payment setup. Report autofill is negotiated, not self-serve. Public SDK issues must contain no PHI or credentials.

MIT. “MindBill” and related marks are trademarks of IncidentFox, Inc.
