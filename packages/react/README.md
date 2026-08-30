# @mindbill/react

Native React billing components and connected lifecycle hooks. Install with:

```bash
npm install @mindbill/react @mindbill/node
```

## Connected lifecycle

`ConnectedBillLifecycle` is the default integration. It owns bill loading, payer lookup, editable review, attachments, submission, status refresh, EORs, payment posting, Second Bill Review, correction/resubmission, and close.

Procedure entry is keyboard-first: the form always keeps one empty row after the entered lines, grows as soon as that row is partially filled, and omits the empty row from save and submit payloads.

```tsx
import { ConnectedBillLifecycle } from "@mindbill/react";

<ConnectedBillLifecycle
  create={knownBillValues}
  sessionEndpoint="/api/mindbill/session"
  appearance={{ preset: "qme-companion" }}
  onBillCreated={(billId) => navigate(`/bills/${billId}`)}
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

The component searches MindBill's claims-administrator directory with both payer text and the current claim number. It explains name and claim-pattern evidence, shows delivery availability, and only preselects a high-confidence exact name or alias match.

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
      case "correct_and_resubmit": return bill.startCorrection();
      case "close": return bill.closeBill({ reason: "Resolved" });
    }
  }}
/>
```

Disabled actions are hidden by default. Set `showUnavailable` to show them with the reason returned by the API.

## Activity timeline

`BillActivityTimeline` renders ordered lifecycle events. Feed it events stored from MindBill's signed webhooks so a reload does not depend on browser callback history.

```tsx
import { BillActivityTimeline } from "@mindbill/react";

<BillActivityTimeline events={billEvents} />
```

Browser callbacks such as `onBillCreated`, `onBillIdChange`, and `onChanged` are for immediate UI, navigation, optimistic state, and analytics. Signed webhooks are the authoritative integration for durable server state.

## Controlled escape hatch

Use `BillReviewForm` only when your application intentionally owns the API calls and local review state. Known bill values and payer documents remain explicit and editable.

```tsx
import { BillReviewForm } from "@mindbill/react";

<BillReviewForm
  data={billReview}
  appearance={{ preset: "qme-companion" }}
  onSave={(input) => api.patch("/billing/review", input)}
  onSubmit={(input, route) => api.post("/billing/submit", { input, route })}
  onAddAttachment={(file, documentType, description) =>
    api.upload("/billing/attachments", { file, documentType, description })
  }
  onRemoveAttachment={(attachmentId) =>
    api.delete(`/billing/attachments/${attachmentId}`)
  }
  onSearchClaimsAdministrators={(query, claimNumber) =>
    api.searchPayers({ query, claimNumber })
  }
/>
```

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
