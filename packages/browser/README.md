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

const { data } = await billing.load();
```

The browser client operates only on an already-submitted bill. Bill creation,
document selection, review, and the atomic submission stay on the partner server.
The same lifecycle client is safe to use from React, Angular, or plain JavaScript.

Pre-submission components can query canonical routing reference data without
inventing a draft bill:

```ts
import { createBillReferenceClient } from "@mindbill/browser";

const references = createBillReferenceClient({
  sessionEndpoint: "/api/mindbill/session",
});

const payers = await references.searchClaimsAdministrators("Zurich", "claim-123");
```

This client exposes reference-data operations only. It never creates or mutates
a bill; the first persisted bill remains the submitted immutable snapshot.

Pass `billId` for the submitted bill. An optional `resource: { billId }`
restriction makes the session usable for only that bill.

The session endpoint is the only required partner-server integration. See the
[10-minute quickstart](https://docs.mindbill.org/quickstart).
