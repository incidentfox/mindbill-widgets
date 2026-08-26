# @mindbill/react

Native React billing components plus wrappers for MindBill's secure hosted workflows. See the repository's [10-minute quickstart](https://github.com/incidentfox/mindbill-widgets#add-mindbill-billing-in-10-minutes).

Published on npm as [`@mindbill/react`](https://www.npmjs.com/package/@mindbill/react). Install it with `npm install @mindbill/react @mindbill/embed` or your preferred package manager.

Use `BillReviewForm` when billing should feel like part of your product. Your server loads and mutates the review model with a short-lived MindBill session; the component remains controlled and never receives a Partner API key.

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

Use `BillStatusSummary` for a compact lifecycle surface with age, last update, balance,
and state-aware actions:

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

`HostedBillReview` and `HostedBillTimeline` remain available when an origin-bound hosted
flow is a better fit. Native and hosted UI paths use the same server API and bill ID.

Never send a Partner API key or long-lived credential to React/browser code.
