# @mindbill/browser

Framework-neutral client used by the React and Angular packages. It exchanges
your authenticated same-origin session for a short-lived, origin-bound token;
the Partner API key never reaches the browser.

```ts
import { createBillLifecycleClient } from "@mindbill/browser";

const billing = createBillLifecycleClient({
  billId,
  sessionEndpoint: "/api/mindbill/bill-session",
});

const bill = await billing.getLifecycle();
```

Review mutations are normalized against the v2 write contract automatically.
Read-only snapshot metadata returned for rendering is never sent back on save,
so the same client is safe to use from React, Angular, or plain JavaScript.

The session endpoint is the only required partner-server integration. See the
[10-minute quickstart](https://docs.mindbill.org/quickstart).
