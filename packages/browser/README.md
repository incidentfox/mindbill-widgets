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

const payers = await references.searchClaimsAdministrators("Zurich", "claim-123");
const diagnoses = await references.searchDiagnosisCodes("left knee");
const firstAlphabeticalPage = await references.searchDiagnosisCodes("", 100, 0);
const nextAlphabeticalPage = await references.searchDiagnosisCodes("", 100, 100);
const place = await references.lookupPostalCode("94403");
```

`searchDiagnosisCodes(query, limit, offset)` supports directory browsing as well as search. Pass an empty query for ICD-10 code order; `limit` is capped at 100 and `offset` advances through the directory.

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

Pass `billId` for the submitted bill. An optional `resource: { billId }`
restriction makes the session usable for only that bill.

See the [10-minute quickstart](https://docs.mindbill.org/quickstart).
