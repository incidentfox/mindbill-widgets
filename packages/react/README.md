# @mindbill/react

Native React billing components and connected lifecycle hooks. Install with:

```bash
npm install @mindbill/react @mindbill/node
```

## Connected lifecycle

`ConnectedBillLifecycle` is the default integration. It owns bill loading, payer lookup, editable review, attachments, submission, status refresh, EORs, payment posting, Second Bill Review, correction/resubmission, and close.

```tsx
import { ConnectedBillLifecycle } from "@mindbill/react";

<ConnectedBillLifecycle
  billId={billId}
  sessionEndpoint="/api/mindbill/billing-session"
  appearance={{ preset: "qme-companion" }}
  onChanged={(lifecycle) => syncBillStatus(lifecycle.bill)}
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

Available presets are `mindbill`, `qme-companion`, and `orange-bright`. Preset names describe visual styles rather than customer or partner brands. Supported overrides include accent, accent text, background, surface, input background, text, muted text, border, font, panel radius, control radius, shadow, danger, success, and warning colors.

Add one authenticated route to your app. It verifies that the signed-in user may access the bill, then mints an exact-origin, bill-scoped token. The Partner API key stays on the server.

```ts
// app/api/mindbill/billing-session/route.ts
import { mindbill } from "@/lib/mindbill";

export async function POST(request: Request) {
  const user = await requireUser(request); // your existing auth
  const { billId } = await request.json();
  await requireBillAccess(user, billId); // your existing authorization

  const session = await mindbill.createBrowserSession({
    component: "bill-review",
    billId,
    allowedOrigin: new URL(request.url).origin,
    expiresIn: 900,
  });

  return Response.json({
    token: session.token,
    expiresAt: session.expiresAt,
  });
}
```

The component searches MindBill's claims-administrator directory with both payer text and the current claim number. It explains name and claim-pattern evidence, shows delivery availability, and only preselects a high-confidence exact name or alias match.

This is the minimum safe browser integration. A permanent Partner API key must never enter frontend code. A completely serverless partner integration requires MindBill-hosted sign-in/SSO so MindBill can authenticate the end user itself.

## Compact status

Use `ConnectedBillStatus` when the partner page only needs a small status and aging surface. Add a second session route using the same server pattern and mint `component: "bill-timeline"`.

```tsx
import { ConnectedBillStatus } from "@mindbill/react";

<ConnectedBillStatus
  billId={billId}
  sessionEndpoint="/api/mindbill/status-session"
  appearance={{ preset: "qme-companion" }}
/>
```

Use `useBillStatus({ billId })` when you want to render custom status UI. It returns `data`, `error`, `isLoading`, `isRefreshing`, and `refresh`. Use `createBillStatusClient` outside React.

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
