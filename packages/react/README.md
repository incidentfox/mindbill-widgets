# @mindbill/react

Native React billing components and connected lifecycle hooks. Install with:

```bash
npm install @mindbill/react @mindbill/node
```

## Connected status

`ConnectedBillStatus` owns the status API call, loading and error states, session renewal, one-minute polling, and focus refresh.

```tsx
import { ConnectedBillStatus } from "@mindbill/react";

<ConnectedBillStatus
  billId={billId}
  appearance={{ accentColor: "#32a9d6", textColor: "#203743" }}
  actions={[
    { id: "eor", label: "View EOR", onClick: openEor },
    { id: "payment", label: "Post payment", onClick: postPayment, primary: true },
  ]}
/>
```

Add one authenticated route to your app. It verifies that the signed-in user may access the bill, then mints an exact-origin, bill-scoped token. The Partner API key stays on the server.

```ts
// app/api/mindbill/status-session/route.ts
import { mindbill } from "@/lib/mindbill";

export async function POST(request: Request) {
  const user = await requireUser(request); // your existing auth
  const { billId } = await request.json();
  await requireBillAccess(user, billId); // your existing authorization

  const session = await mindbill.createEmbedSession({
    component: "bill-timeline",
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

Use `useBillStatus({ billId })` when you want to render your own UI. It returns `data`, `error`, `isLoading`, `isRefreshing`, and `refresh`. Use `createBillStatusClient` outside React.

This is the minimum safe browser integration. A permanent Partner API key must never enter frontend code. A completely serverless partner integration requires MindBill-hosted sign-in/SSO so MindBill can authenticate the end user itself.

## Review and submit

`BillReviewForm` is the native, controlled review surface. Known bill values and payer documents remain explicit and editable before submission.

```tsx
import { BillReviewForm } from "@mindbill/react";

<BillReviewForm
  data={billReview}
  appearance={{ accentColor: "#32a9d6", textColor: "#203743" }}
  onSave={(input) => api.patch("/billing/review", input)}
  onSubmit={(input, route) => api.post("/billing/submit", { input, route })}
  onAddAttachment={(file, documentType, description) =>
    api.upload("/billing/attachments", { file, documentType, description })
  }
  onRemoveAttachment={(attachmentId) =>
    api.delete(`/billing/attachments/${attachmentId}`)
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

`HostedBillReview` and `HostedBillTimeline` remain available when a hosted flow is a better fit. Native and hosted UI paths use the same bill ID.

Never send a Partner API key or long-lived credential to React/browser code.
