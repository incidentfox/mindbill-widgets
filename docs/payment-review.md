# Payment review

`ConnectedBillingWorkspace` includes a **Payment review** tab. Set
`initialView="payments"` to open it directly, or embed `ConnectedPaymentReview`
on its own. Both reuse your short-lived organization-scoped billing session.

The report is a confirmed-payment ledger, not an expected-payment report. Pending
Explanation of Review (EOR) and 835 amounts are excluded until funds are confirmed;
historical legacy payments are excluded too. A row represents one ledger entry,
so a bill can legitimately have multiple payment rows.

```tsx
import { ConnectedPaymentReview } from "@mindbill/react";

<ConnectedPaymentReview
  sessionEndpoint="/api/mindbill/session"
  appearance={{ preset: "qme-companion" }}
  onSelectBill={(billId) => openBill(billId)}
  onPostPayment={() => openExistingPaymentForm()}
/>
```

`onPostPayment` is optional and is only a host callback. Reviewing or exporting
never creates or changes payments. Workspace bill links open shared bill details;
standalone callers supply `onSelectBill` for their own navigation.

The default filter is this month through today, using the viewer's local calendar
dates. Quick ranges, received-date inputs, search, and pagination are available.
The three totals cover **all matching rows**, while **Export page** downloads only
the current page. Exports contain sensitive billing data; apply normal access and
download policies. CSV cells are quoted and spreadsheet formulas neutralized.

## Report client

`createBillingOperationsClient(options).getPaymentReview(query, signal)` calls
`GET /partner/v2/reports/payments`. Organization-wide `bills:read` is required,
as with other financial reports; bill-scoped sessions cannot load this page.

Optional query fields: `q`, `receivedFrom`, `receivedTo`, `page`, `pageSize`, and
`renderingProviderId`. Dates use `YYYY-MM-DD`. Amounts are dollars.

```ts
type PaymentReviewResult = {
  items: PaymentReviewItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: { postedTotal: number; entryCount: number; uniquePatients: number };
};
```

Each item includes its ledger `id`, `billId`, nullable numeric `billNumber`,
`patientName`, `claimNumber`, nullable `dateOfService`, `receivedDate`, and
`postedDate`, `status: "received"`, `method`, `source`, nullable `checkNumber`, and
`amount`. The HTTP envelope is `{ data: PaymentReviewResult }`; the client
unwraps it. No raw remittance payloads are exposed.

## Practice W-9 upload

The separate `W9Upload` component supports a host-owned document workflow without
duplicating your practice records. Provide `onUpload(file): Promise<void>`, optional
`document: {filename, addedAt?}`, `onView`, and `maxSizeBytes` (default 20 MiB).
The host validates and authorizes upload server-side; browser validation is only
a usability guard. Reject the upload promise when storage fails.

Hosts with extraction support also supply `extractionStatus` (`idle`, `queued`,
`processing`, `complete`, `not_found`, or `failed`) and optional
`onRetryExtraction`. The widget reports progress; your server owns extraction,
encryption, and storage, and your settings form displays fields for review. It
does not send tax IDs to a new service or silently create another saved profile.
The existing `OrganizationOnboarding` W-9 step reuses this upload UI with its
existing storage API; extraction is not implied for storage-only adapters.

If your app handles whole-page file drops, ignore drops originating inside `.mbw9`
to avoid starting a second upload before the user clicks **Upload W-9**.
