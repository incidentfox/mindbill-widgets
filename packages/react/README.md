# @mindbill/react

Native React billing components and connected lifecycle hooks. Install with:

```bash
npm install @mindbill/react @mindbill/node
```

## Connected lifecycle

`ConnectedBillLifecycle` starts after your server atomically creates and submits an immutable bill. It owns the submitted-to-closed progress rail, a read-only rendering of the exact submitted snapshot, server-owned human-readable history, packet download, EORs, payment posting, Second Bill Review, close, and reopen. The only persistent header action is **Download packet**; status-dependent actions appear in the details view when MindBill makes them available.

```tsx
import { ConnectedBillLifecycle } from "@mindbill/react";

<ConnectedBillLifecycle
  billId={billId}
  sessionEndpoint="/api/mindbill/session"
  appearance={{ preset: "qme-companion" }}
/>
```

## Appearance

Choose a complete preset, then override only the tokens your design system owns. The preset applies to review, payer search, attachments, submission, status, EOR, payment, denial, resubmission, and close states.

```tsx
<ConnectedBillLifecycle
  billId={billId}
  appearance={{
    preset: "orange-bright",
    accentColor: "#ff4f0a",
    fontFamily: "Inter, sans-serif",
    borderRadius: "8px",
  }}
/>
```

Available presets are `mindbill`, `qme-companion`, `orange-bright`, and `clinical-blue`. Preset names describe visual styles rather than customer or partner brands. Supported overrides include accent, accent text, background, surface, input background, text, muted text, border, font, panel radius, control radius, shadow, danger, success, and warning colors.

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

The public lifecycle is `Submitted → Accepted → Processed → Closed`. Rejections and denials remain detailed states inside the Processed stage so the progress rail stays stable while the action sheet explains what the user can do next. Partner APIs and components do not expose draft or queued states.

## Read-only bill details

Use `BillReadOnlyForm` when you already loaded `BillLifecycleData` and only need the immutable detail surface. It uses the same section order and responsive layout as `BillSubmissionForm`, but renders values, calculated fees, and attachments without form controls.

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

The partner application only loads initial values and sends the component's immutable snapshot to its authenticated server route. Uploaded files stay in the browser until the user submits.

```tsx
import { BillSubmissionForm } from "@mindbill/react";

<BillSubmissionForm
  initialBill={bootstrap.bill}
  attachments={bootstrap.attachments}
  getSession={() => fetch("/api/mindbill/session", { method: "POST" }).then(r => r.json())}
  appearance={{ preset: "qme-companion" }}
  onSubmit={({ bill, sourceAttachmentIds, uploads }) =>
    submitBill({ bill, sourceAttachmentIds, uploads })
  }
/>
```

The component includes the interaction model, not just the markup:

- a responsive two-column review form (one column on narrow screens);
- paste-friendly `MM/DD/YYYY` date fields and required-field asterisks;
- ZIP-to-city/state completion through MindBill's authenticated postal directory;
- complete, server-backed ICD-10 search, common-injury quick picks, and removable chips;
- canonical claims-administrator search through the authenticated MindBill payer directory;
- QME, AME, and Psych QME evaluation modes with medical-legal modifier defaults;
- searchable workers-comp procedure/modifier controls, medical-legal fee-schedule amounts, totals, valid manual CPT/HCPCS entry, and an automatically maintained empty line;
- removable source documents, a locked auto-attached practice W-9, and click, panel-drop, or whole-page PDF upload.

Partners supply tenant-specific bootstrap data, one short-lived browser session callback, and the final server submission callback. Required fields, validation, ZIP lookup, ICD-10 and payer directories, service-line behavior, attachments, and submission UX stay inside `@mindbill/react`, so every integration receives the same billing workflow. Optional `diagnosisOptions`, `procedureOptions`, `modifierOptions`, and lookup callbacks extend or replace defaults when a partner has licensed or organization-specific data.

`BILL_SUBMISSION_REQUIRED_FIELDS` and `validateBillSubmission` expose the same contract for tests and non-visual integrations. The component never creates a draft; its callback fires only when the user submits a locally valid snapshot.

`BillReviewForm` remains available for legacy integrations that already own a custom review model. New integrations should use `BillSubmissionForm`.

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
