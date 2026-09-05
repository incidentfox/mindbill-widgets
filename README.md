# MindBill partner SDK

The integration has one durable object: a bill. Your application keeps its own case, report, or patient model and stores the returned `bill.id`.

MindBill stores the frozen bill snapshot, payer documents, submissions, EORs, payments, denials, reviews, and lifecycle history.

`ConnectedBillLifecycle` also includes shared workspace team notes and a preview-first courtesy-copy email form. Hosts can supply case-scoped recipient choices without enrolling contacts in notifications. See [bill communications](docs/bill-communications.md) for recipient-option props, scopes, sandbox simulation, retry safety, and custom React integration.

`NotificationSettings` / `ConnectedNotificationSettings` adds a default-off notification settings section for any partner's users, with explicit consent, assigned-bill or practice-wide scope, quiet hours and unsubscribe. Its host-server adapter keeps verified identity and access out of browser mutations. See [notification settings](docs/notification-settings.md).

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

For React applications, `BillSubmissionForm` supplies the entire authoring UI and contract: a responsive two-column form, paste-friendly dates, ZIP completion, ICD-10 chips, canonical payer search, evaluation-mode modifier defaults, fee-aware service lines, rich attachment uploads, validation, browser-side PDF encoding, and atomic Submit. Your application only supplies tenant bootstrap data and mints a short-lived browser session; bill payloads and attachment bytes never pass through your server.

```tsx
import { BillSubmissionForm } from "@mindbill/react";

<BillSubmissionForm
  initialBill={bootstrap.bill}
  attachments={bootstrap.attachments}
  getSession={getMindBillSession}
  onSubmitted={({ billId }) => saveLocalBillLink(billId)}
/>
```

The single browser session powers MindBill's canonical claims-administrator directory,
complete ICD-10 search, and ZIP-to-city/state lookup. Opening the administrator picker
shows an alphabetized first page immediately and loads later pages on scroll; searching
works from the first character. Pass `claimsAdministratorSources` to preserve the names
already visible in the host system (for example `{ source: "report", label: "Report",
name: "Zurich" }`). The form keeps the required canonical field empty and highlighted
until the biller confirms it, shows the source wording, and offers up to five clickable
directory suggestions. Exact proven mappings collapse to one suggestion; when historical
employer evidence also resolves a unique subpayor, that click fills both selections.
Future sources such as EAMS can include a `url` and take precedence over report wording.

Administrator options show aliases and every claim-number pattern/example on file. After
selection, the claim-number field reports a known match or warning and repeats the actual
directory rule; rules that cannot be evaluated safely remain informational. When the
selected claims administrator requires payer selection, both forms show a second "Payer"
combo box listing every subpayor,
its aliases, affiliated entities, claim-number hint, delivery route, clearinghouse, and
payer identifiers. The biller must make an explicit choice before submission, sent as
`claim.claimsAdministrator.payerId`; administrators without subpayors are
unchanged. The component bundles MindBill's
curated workers-comp procedure and modifier catalog, medical-legal fee rules, diagnosis
quick picks, and locked practice W-9 behavior. Pass optional catalog props only to add
organization-specific choices.

When the biller submits, the form shows a delivery-method dialog by default: the
verified e-bill route with its payer ID (shown only when the payer has an e-route),
then fax and email with the payer contacts on file, then physical mail — channels
with nothing on file drop to the end. Every manual channel takes per-send overrides:
alternative email/fax recipients, email subject, Cc list, and message, the fax
ATTENTION line (numbers format as you type), and the mailing address. The options
come from `getDeliveryPreview` on the browser reference client, which resolves
MindBill's routing waterfall for the selected claims administrator before the bill
exists; the chosen route rides on the atomic submission as
`submission.route`/`destination` (plus `subject`/`note`/`cc` for email).
Pass `deliveryRoutePicker="off"` to skip the dialog and submit on MindBill's
recommended route, or render the exported `SendRouteDialog` yourself for a custom
flow. When the preview is unavailable, the form submits directly — behavior on
older deployments is unchanged.

Correction and Submit New Bill forms always require this confirmation. Their
preview uses the administrator and subpayor selected in the edited form, so a
biller who corrects a rejected wrong-payor submission can inspect the new route
and deliberately switch to fax, email, mail, or e-bill before anything is sent.

## 2. Render the submitted lifecycle

`ConnectedBillLifecycle` starts after submission. Its only bill input is the MindBill bill ID; after the session provider returns a short-lived browser token, the component fetches the immutable snapshot, lifecycle, history, rejection details, EORs, remittance, and payments directly from MindBill. React and Angular both show rejected bills as an action-required surface with the full ordered issue list and acknowledgement codes; both also export that rejection notice for custom layouts. Do not pass or maintain lifecycle seed data in your application. Authenticated packet previews open the PDF directly in a new tab.

A rejection does not end the logical bill or require the partner to create a
replacement bill. React and Angular reopen their complete submission form with
the submitted snapshot and documents, call attention to fields implicated by
the acknowledgement, and send the corrected data as the next immutable
submission attempt. The public bill ID stays stable; MindBill assigns attempt
suffixes such as `-1`, `-2`, and `-3` to the patient control number and keeps
all rejections, acknowledgements, EORs, and payments in one history.

Follow-up actions are server-driven: when the lifecycle response enables
`send_duplicate` or `report_bill_status`, both components surface them. Send
duplicate reopens the delivery-method picker (routes and contacts from the
bill's delivery options) and resends the unchanged packet; Report Bill Status
walks the biller through the payer call — who to dial (payer contacts plus
directory hours and Bill Review vendor), the submission receipt (submission
and acknowledgement history rows), and the five reported-status outcomes with
call details — and records the result on the bill history. The Second Review
panel prefills an editable LC §4622 appeal reason and, when the lifecycle
includes the denial EOR, shows the 90-day filing deadline. Bills with two or
more submissions also render a selectable submissions ribbon (Original Bill,
Second Review, Duplicate Bill, …) at the top of the React lifecycle view. Each
attempt includes its delivery method, sent date, and latest operational status
and date (including 277 Reject and payment-deadline states). Selecting one opens
and highlights its row inside the single complete history shared by the chain.

```tsx
import { ConnectedBillLifecycle } from "@mindbill/react";

export function Billing({ billId }: { billId: string }) {
  return (
    <ConnectedBillLifecycle
      billId={billId}
      getSession={getMindBillSession}
      appearance={{ preset: "qme-companion" }}
    />
  );
}
```

The host contract is identical in sandbox and live environments. Sandbox
simulation controls are never inferred from the response environment; they are
available only to dedicated developer tooling that explicitly passes
`sandboxControls={true}` on `ConnectedBillLifecycle` or `ConnectedBillingWorkspace`.

Use `preset: "midnight-cyan"` for a pale-blue and midnight theme with restrained rounded controls, `preset: "orange-bright"` for a compact orange theme, or override individual appearance tokens on any preset. The same theme covers submission, status, EORs, payments, reviews, and close actions. The task dashboard inherits that palette: neutral card borders, semantic status markers, and accent-tinted aging headers. See [theme customization](docs/theme-customization.md) for typed dashboard colors, geometry, spacing, and CSS overrides.

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

After `BillSubmissionForm` returns `billId`, render this component with that ID. For a compact read-only surface, use `ConnectedBillStatus` with the same session endpoint. For a custom interface, use `useBillLifecycle` or `useBillStatus`. Store the canonical `billId` for navigation and webhook correlation while retaining your `externalId` as the idempotency key. Signed webhooks remain the durable source of truth.

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

`BillingSettings` provides reusable billing/rendering provider, service-location, and W-9
setup. `BillSubmissionForm` accepts host-owned or MindBill-backed `profileOptions` and
`profileDisplay="expanded" | "compact"`; selections become editable bill snapshots, not
mutable references. See [saved profiles and authorization](./docs/saved-profiles.md).
Billing tax IDs support EIN or SSN (`taxIdType`, default `EIN`). Saved SSNs are
encrypted by MindBill and read back as an empty `taxId` with `taxIdLast4` and
`taxIdConfigured`; the full value is not returned to the browser. Settings leave
an unchanged SSN blank to preserve it, or let the user explicitly replace/clear it.
Direct API callers must omit `taxId` to preserve it and send `taxId: ""` to clear it.
`organizationTaxIdWrite` converts masked profile state to that write contract.

For bill creation, `organizationProfileOptions(profile)` converts an SSN provider
to a server-resolved `billingProvider: { savedProviderId }` reference. MindBill
checks organization ownership and freezes the provider into the bill; later
profile edits do not rewrite submitted bills. Host-owned inline providers may
instead pass `taxIdType: "SSN"` and `taxId` over the authenticated API. Never put
SSNs in logs, URLs, analytics, local storage, or your own persisted form drafts.
SSN writes fail closed if server encryption has not been configured.

`ConnectedBillingWorkspace` separates follow-up tasks from Sent/Accepted bills waiting
for payer responses. Waiting inventory has its own totals and may overlap overdue tasks;
do not add those totals together. Drill-down preserves status, age, payer, and rendering-provider filters.
The doctor picker uses workspace-scoped `filters.renderingProviders` from the browser API,
not doctors inferred from the current page. Rendering providers are distinct from billing
practices. `ConnectedBillSearch` also accepts `initialQuery={{ renderingProviderId: "provider-id" }}`.
Dashboard colors, borders, radii, spacing, and aging palettes are configurable through
[appearance tokens](./docs/theme-customization.md).

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

## Shared business API

The browser SDK and server integrations use the same business endpoints under `/partner/v2`, with the same request and response contracts. Server integrations authenticate with an API key; browser SDKs accept only short-lived, origin-bound sessions minted on your server. Keep API keys out of browser code.

`GET /partner/v2/bill-dashboard` provides the page-based list and totals used by the React dashboard. `GET /partner/v2/bills` remains the cursor-based list. Both support either credential; authentication does not select a different response shape. The SDK submits bills through `POST /partner/v2/bills`.

Older `/partner/v2/browser/...` URLs remain compatibility aliases. Browser-session creation and credential management remain server-only. See [the API migration guide](docs/shared-api.md).
