# @mindbill/react

Native React billing components and connected lifecycle hooks. Install with:

```bash
npm install @mindbill/react @mindbill/node
```

## Connected lifecycle

`ConnectedBillLifecycle` starts after `BillSubmissionForm` atomically submits an immutable bill. Its only bill input is `billId`; `getSession` returns the short-lived token. The component fetches the submitted snapshot, progress, human-readable history, EOR/remittance amounts, payments, and available actions from MindBill. Do not pass lifecycle seed data or duplicate this state in the host app. The only persistent header action is **Download packet**; status-dependent actions remain visible in a sticky bottom action bar when MindBill makes them available. Actions that require input open a focused form dialog.

```tsx
import { ConnectedBillLifecycle } from "@mindbill/react";

<ConnectedBillLifecycle
  billId={billId}
  getSession={getMindBillSession}
  appearance={{ preset: "qme-companion" }}
/>
```

Sandbox and live responses use the same component contract. Simulation controls
are hidden by default, including when the connected organization is a sandbox.
Only a dedicated developer playground should opt in with
`sandboxControls={true}`; production applications should omit the prop.

## Appearance

Choose a complete preset, then override only the tokens your design system owns. The preset applies to review, payer search, attachments, submission, status, EOR, payment, denial, resubmission, and close states.

```tsx
<ConnectedBillLifecycle
  billId={billId}
  appearance={{ preset: "midnight-cyan" }}
/>
```

`midnight-cyan` gives every billing surface a spacious pale-blue canvas, crisp white panels, midnight actions and typography, cyan-compatible accents, and pill-shaped controls. No extra CSS is required.

Available presets are `mindbill`, `qme-companion`, `orange-bright`, `clinical-blue`, and `midnight-cyan`. Preset names describe visual styles rather than customer or partner brands. Supported overrides include accent, accent text, background, surface, input background, text, muted text, border, font, panel radius, control radius, shadow, danger, success, and warning colors.

Add one authenticated route to your app. It maps the signed-in user's role to billing permissions, then mints an exact-origin token for that user in your MindBill organization. The Partner API key stays on the server.

```ts
// Any server framework: POST /api/mindbill/session
import { mindbill } from "@/lib/mindbill";

export async function POST(request: Request) {
  const user = await requireUser(request); // your existing auth

  const session = await mindbill.createBrowserSession({
    subject: user.id,
    allowedOrigin: new URL(request.url).origin,
    permissions: billingPermissionsFor(user.role),
    expiresIn: 900,
  });

  return Response.json({
    token: session.token,
    expiresAt: session.expiresAt,
  });
}
```

The API key binds every session to one organization. `subject` identifies the user and `permissions` express the role. MindBill enforces the organization boundary on every bill request. A permanent Partner API key must never enter frontend code.

## Compact status

Use `ConnectedBillStatus` when the partner page only needs a small status and aging surface. It reuses the same session route.

```tsx
import { ConnectedBillStatus } from "@mindbill/react";

<ConnectedBillStatus
  billId={billId}
  sessionEndpoint="/api/mindbill/session"
  appearance={{ preset: "qme-companion" }}
/>
```

Use `useBillStatus({ billId })` when you want to render custom status UI. It returns `data`, `error`, `isLoading`, `isRefreshing`, and `refresh`. Use `createBillStatusClient` outside React.

The public lifecycle is `Submitted → Accepted → Processed → Closed`. Rejections and denials remain detailed states inside the Processed stage so the progress rail stays stable while the sticky action bar explains what the user can do next. Partner APIs and components do not expose draft or queued states. Once the payer responds, the Details tab leads with one consolidated Explanation of Review reconciliation surface: billed, allowed, payer-reported payment, posted payment, penalty and interest, balance, denial reason, payment records, and the EOR document.

## Read-only bill details

Use `BillReadOnlyForm` when you already loaded `BillLifecycleData` and only need the immutable detail surface. It uses the same section order and responsive layout as `BillSubmissionForm`, but renders values, calculated fees, routing details, and attachments without form controls. Its claims-administrator name is the canonical directory selection from the submitted delivery snapshot; selecting it opens a responsive directory dialog with Main, Bill Review, Authorization, Mailing Address, and Claim Number Pattern tabs when those fields are available from the API.

```tsx
import { BillReadOnlyForm } from "@mindbill/react";

<BillReadOnlyForm data={billLifecycleData} onOpenAttachment={openAttachment} />
```

`ConnectedBillLifecycle` composes this component with the Details / Bill history switch, so most partners should not assemble these pieces themselves.

## Lifecycle actions

MindBill returns the actions that are valid for the bill's current state. Render that server-authoritative list instead of duplicating rejection, EOR, denial, review, payment, and closure rules in your application.

```tsx
import { BillLifecycleActions } from "@mindbill/react";

<BillLifecycleActions
  actions={bill.data.lifecycle.actions}
  onAction={(action) => {
    switch (action.id) {
      case "view_eor": return bill.openEor();
      case "post_payment": return setPaymentOpen(true);
      case "second_review": return setSecondReviewOpen(true);
      case "close": return bill.closeBill({ reason: "Resolved" });
      case "reopen": return bill.reopenBill({ reason: "Follow-up is continuing" });
    }
  }}
/>
```

Disabled actions are hidden by default. Set `showUnavailable` to show them with the reason returned by the API.

## Activity timeline

`BillActivityTimeline` renders the ordered, human-readable lifecycle events returned by MindBill. Partners do not need to store or reconstruct bill history.

```tsx
import { BillActivityTimeline } from "@mindbill/react";

<BillActivityTimeline events={bill.data.activity} />
```

Browser callbacks such as `onChanged` are for immediate UI, navigation, optimistic state, and analytics. MindBill remains authoritative for durable history; signed webhooks are available when your backend also needs event-driven synchronization.

## Bill submission form

`BillSubmissionForm` owns the complete pre-submission experience: the bill field schema, required-field rules and red asterisks, validation, service-line editing, source-document selection, PDF uploads, and the single Submit action. Its `bill` value is structurally identical to the server SDK's `CreateBillRequest`.

The partner application only loads initial values and mints a short-lived browser session. Uploaded files stay in the browser until the user submits; the component validates and sends the immutable snapshot and PDF bytes directly to MindBill.

```tsx
import { BillSubmissionForm } from "@mindbill/react";

<BillSubmissionForm
  initialBill={bootstrap.bill}
  attachments={bootstrap.attachments}
  getSession={() => fetch("/api/mindbill/session", { method: "POST" }).then(r => r.json())}
  appearance={{ preset: "qme-companion" }}
  onSubmitted={({ billId }) => saveLocalBillLink(billId)}
/>
```

The component includes the interaction model, not just the markup:

- a responsive two-column review form (one column on narrow screens);
- paste-friendly `MM/DD/YYYY` date fields and required-field asterisks;
- ZIP-to-city/state completion through MindBill's authenticated postal directory;
- complete, server-backed ICD-10 search with an alphabetized 100-code first page, automatic 100-code scroll paging, common-injury quick picks, and removable chips;
- canonical claims-administrator matching through the authenticated MindBill payer directory: exact aliases select automatically, while fuzzy matches show up to five explicit suggestions with claim-number pattern evidence;
- QME, AME, and Psych QME evaluation modes with medical-legal modifier defaults; Psych QME also seeds `Z04.6` when no more specific diagnosis was supplied, and exposes it as a Psych quick pick;
- a searchable rendering-provider taxonomy combobox that accepts either a human-readable specialty search or an exact 10-character taxonomy code;
- searchable workers-comp procedure/modifier controls, medical-legal fee-schedule amounts, totals, valid manual CPT/HCPCS entry, and an automatically maintained empty line;
- removable source documents with new-tab previews, a locked auto-attached practice W-9, and a full-width click, panel-drop, or whole-page PDF upload area. Med-legal mode assigns every document to `J4 - Med-Legal Report` without showing another control; professional mode shows the complete searchable PWK01 report-type directory. Override that presentation with `attachmentReportTypeMode`, `attachmentReportTypes`, and `defaultAttachmentReportType`.

Partners supply tenant-specific bootstrap data, one short-lived browser session callback, and optionally an `onSubmitted` callback to persist the returned `billId`. Required fields, validation, ZIP lookup, ICD-10 and payer directories, service-line behavior, PDF encoding, wire-format serialization, atomic submission, attachments, and submission UX stay inside `@mindbill/react`, so every integration receives the same billing workflow. Optional `diagnosisOptions`, `procedureOptions`, `modifierOptions`, and lookup callbacks extend or replace defaults when a partner has licensed or organization-specific data.

Validation is component-owned as well. A missing routing payer is highlighted immediately; Submit highlights every invalid control with a specific message, focuses and scrolls to the first problem, and continues validating as the user corrects the form.

The complete immutable snapshot requires patient identity and address; employer, injury date, service date, and a canonical claims-administrator directory selection; at least one ICD-10 diagnosis and procedure line; billing provider name, Tax ID, NPI, phone, and address; rendering provider name, NPI, and taxonomy; and service address plus place-of-service code. Address line 2 remains optional. License number, license state, specialty, and service-facility display name are not requested by the standard component. For California workers-comp CMS-1500 output, `renderingProvider.taxonomy` is the 10-character provider taxonomy placed in shaded Box 24J with qualifier `ZZ`; it is not replaced by the physician license number.

`BILL_SUBMISSION_REQUIRED_FIELDS` and `validateBillSubmission` expose the same contract for tests and non-visual integrations. The component never creates a draft; `onSubmitted` fires only after MindBill accepts a locally valid immutable snapshot. The legacy `onSubmit` escape hatch remains optional for unusual deployments, but connected integrations should omit it so the library owns the complete contract.

`BillReviewForm` remains available for legacy integrations that already own a custom review model. New integrations should use `BillSubmissionForm`.

### Compose individual submission sections

`BillSubmissionForm` is also the form-state provider. Put its named children in your own page shell when you want the same MindBill behavior in a partner-specific layout. The sections do not duplicate required-field, directory, fee, attachment, or submission logic.

```tsx
import {
  BillSubmissionActions,
  BillSubmissionAttachmentsSection,
  BillSubmissionClaimSection,
  BillSubmissionForm,
  BillSubmissionHeader,
  BillSubmissionPatientSection,
  BillSubmissionProvidersSection,
  BillSubmissionServiceLinesSection,
} from "@mindbill/react";

<BillSubmissionForm {...submissionProps}>
  <BillSubmissionHeader />
  <BillSubmissionPatientSection />
  <BillSubmissionClaimSection />
  <BillSubmissionProvidersSection />
  <BillSubmissionServiceLinesSection />
  <BillSubmissionAttachmentsSection />
  <BillSubmissionActions />
</BillSubmissionForm>
```

Omit a section when another step in your product already supplies that information, or reorder sections to match your workflow. `BillSubmissionActions` remains the only submit control and always validates the complete immutable snapshot.

## Billing dashboard, aging, bill list, and reports

The dashboard components accept plain bill summaries, so they work with `@mindbill/node`'s `listBills()` response, a server-rendered loader, or a partner-owned cache. They never require an API key in the browser.

```tsx
import {
  BillingDashboard,
  BillingReport,
  buildBillingReportCsv,
  type BillingDashboardBill,
} from "@mindbill/react";

const bills: BillingDashboardBill[] = apiBills.map((bill) => ({
  id: bill.id,
  billNumber: bill.billNumber,
  patientName: `${bill.patient.firstName} ${bill.patient.lastName}`,
  claimNumber: bill.claim.claimNumber,
  payerName: bill.claim.claimsAdministrator?.name,
  state: bill.state,
  // Supply agingDays from your status/lifecycle response, or submittedAt when
  // your server-side bill summary includes it.
  agingDays: agingByBillId[bill.id] ?? 0,
  totalCharge: bill.amounts.charged,
  totalPaid: bill.amounts.paid,
  balanceDue: bill.amounts.balance,
  href: `/billing/${bill.id}`,
}));

<BillingDashboard
  bills={bills}
  appearance={{ preset: "orange-bright" }}
  onSelectBill={(bill) => router.push(`/billing/${bill.id}`)}
/>

<BillingReport bills={bills} groupBy="payer" />
```

Use the smaller pieces independently when a page already has its own shell:

- `BillAgingSummary` — outstanding balance, open count, collected, total billed, and 0–30 / 31–60 / 61–90 / 91+ buckets;
- `BillList` — responsive desktop table and mobile cards;
- `BillingReport` — grouped totals by `status`, `payer`, or `aging`;
- `summarizeBillingDashboard` and `buildBillingReportRows` — presentation-free aggregates;
- `buildBillingReportCsv` — the same report rows as downloadable CSV text.

Pass only synthetic data to public examples and tests. In production, load organization-scoped bills on the server and authorize each bill-detail route independently.

Use `BillStatusSummary` only when your application already owns status loading and wants a presentation-only component:

```tsx
<BillStatusSummary
  status={status.state}
  totalCharge={status.totalCharge}
  totalPaid={status.totalPaid}
  balanceDue={status.balanceDue}
  agingDays={42}
  updatedAt={status.updatedAt}
  actions={[
    { id: "eor", label: "View EOR", onClick: openEor },
    { id: "review", label: "Start second review", onClick: startReview, primary: true },
  ]}
/>
```

`MindBillBillReview` and `MindBillBillTimeline` are available when a hosted flow is a better fit. Native and hosted UI paths use the same bill ID.

Never send a Partner API key or long-lived credential to React/browser code.
