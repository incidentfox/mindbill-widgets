# @mindbill/browser

Framework-neutral client used by the React and Angular packages. It exchanges
your authenticated same-origin session for a short-lived, origin-bound token;
the Partner API key never reaches the browser.

```ts
import { createBillLifecycleClient } from "@mindbill/browser";

const billing = createBillLifecycleClient({
  billId: "bill_123",
  sessionEndpoint: "/api/mindbill/session",
});

const data = await billing.getLifecycle();
const packet = await billing.getPacket();
```

The browser client loads immutable snapshots, server-owned activity history,
current lifecycle actions, EORs, and complete submission packets. It can execute
only actions authorized by MindBill, including Second Bill Review, payment
posting, close, and reopen. It also owns atomic browser submission, so the
partner server never receives bill payloads or attachment bytes.
The public lifecycle begins at `submitted`, then advances through `accepted`,
`processed`, and `closed`; it never exposes draft or queued states. The same
lifecycle client is safe to use from React, Angular, or plain JavaScript.

Pre-submission components can query canonical routing reference data without
inventing a draft bill:

```ts
import { createBillReferenceClient } from "@mindbill/browser";

const references = createBillReferenceClient({
  sessionEndpoint: "/api/mindbill/session",
});

const firstPayerPage = await references.listClaimsAdministrators({ limit: 50 });
const nextPayerPage = await references.listClaimsAdministrators({
  limit: 50,
  offset: firstPayerPage.nextOffset,
});
const payers = await references.searchClaimsAdministrators("Zurich", "claim-123");
const diagnoses = await references.searchDiagnosisCodes("left knee");
const firstAlphabeticalPage = await references.searchDiagnosisCodes("", 100, 0);
const nextAlphabeticalPage = await references.searchDiagnosisCodes("", 100, 100);
const place = await references.lookupPostalCode("94403");
```

`searchDiagnosisCodes(query, limit, offset)` supports directory browsing as well as search. Pass an empty query for ICD-10 code order; `limit` is capped at 100 and `offset` advances through the directory.

`listClaimsAdministrators({ query, claimNumber, limit, offset })` supports both
alphabetical browsing and search, returns `total` and `nextOffset`, and does not
impose a minimum query length. The legacy `searchClaimsAdministrators` method
remains as a results-only convenience wrapper.

Some claims administrators route bills through more than one payer. Results mark
them with `payerSelectionRequired: true` and list rich routing choices in `payers`:
aliases, affiliated entities, claim-number hints, route and delivery type,
clearinghouse, payer IDs, and the directory default marker are preserved.
Send the chosen entry as `bill.claim.claimsAdministrator.payerId` on the atomic
submission (the same optional `payerId` exists on `BillReviewSaveInput`);
administrators without subpayors are unchanged and need no `payerId`.
Interactive forms should require the user to choose a required routing payer;
`defaultBillReviewPayerOption(payer)` only reads the source catalog's default marker.

Submit a locally reviewed bill and its PDF attachments directly from the browser:

```ts
import { createBillSubmissionClient } from "@mindbill/browser";

const submission = createBillSubmissionClient({
  sessionEndpoint: "/api/mindbill/session",
});

const result = await submission.submitBill({
  bill,
  submission: { route: "ebill" },
  documents: [{
    filename: "final-report.pdf",
    documentType: "final_report",
    contentBase64: encodedPdf,
  }],
});

await linkBillId(result.billId);
```

The session endpoint is the only required partner-server integration with
MindBill. Keep the returned canonical `billId` locally for navigation and
webhook correlation; keep `bill.externalId` as the idempotency and partner
correlation key. The first persisted bill is still the submitted immutable
snapshot—there is no draft mutation API.

If a submission is rejected, keep that same canonical `billId`. A correction
creates another immutable submission attempt under the logical bill; it does
not create a new partner-visible bill. Send the complete corrected snapshot
and the documents that should accompany the new attempt:

```ts
await billing.resubmitBill({
  reason: "Corrected the rejected service date.",
  bill: correctedBill,
  documents: correctedDocuments,
});
```

A **closed** bill authorizes exactly two actions: `reopen` and
`submit_new_bill`. "Submit New Bill" keeps the closed bill closed — its record
and close reason are preserved and it is never superseded — and creates a
fresh original bill linked to it, so the submissions timeline chains both
records. It accepts the same snapshot payload shape as a resubmission:

```ts
await billing.submitNewBill({
  reason: "Re-billing the service after the earlier bill was closed.",
  bill: newBillSnapshot,
  documents: newBillDocuments,
});
```

MindBill preserves the original attempt, rejection, corrected attempt, later
acknowledgements, EORs, and payments in one lifecycle. Each outbound attempt
gets the next patient-control-number suffix (`-1`, `-2`, `-3`, ...), while the
public `billId` remains stable. Rejection issues can include `fieldPaths`; use
them to call attention to implicated controls without treating the
clearinghouse response as a replacement for normal validation.

Pass `billId` for the submitted bill. An optional `resource: { billId }`
restriction makes the session usable for only that bill.

The package also ships a pure, presentation-free aggregation shared by the
React and Angular Bill Tasks dashboards:

```ts
import { buildBillTasksDashboard } from "@mindbill/browser";

const data = buildBillTasksDashboard(workItems, [
  { id: "payment_due", label: "Payment Due", agingBasisLabel: "Bill Sent Date", tone: "violet" },
  { id: "denials", label: "Denials", agingBasisLabel: "EOR Date", tone: "red" },
]);
```

`buildBillTasksDashboard` buckets flat work items by age in days
(1-30 / 31-60 / 61-90 / 91-180 / 181+, or custom buckets) into ordered
sections and first-seen-ordered rows with per-cell counts, click-through bill
refs, and section/grand totals. Sections render even when empty.

See the [10-minute quickstart](https://docs.mindbill.org/quickstart).
