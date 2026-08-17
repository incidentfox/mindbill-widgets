# Webhooks and lifecycle events

MindBill billing is asynchronous. A successful create or submission response is the beginning of the workflow, not final payment evidence. Integrations should consume lifecycle events and keep their own durable cursor.

## Consumer rules

1. Verify the delivery signature against the raw request body using the signing secret shown in the hosted MindBill developer settings.
2. Reject stale timestamps and signatures that do not match in constant time.
3. Deduplicate by event `id`.
4. Process events in `sequence` order per organization.
5. Return `2xx` only after durably recording the event, then do business processing asynchronously.
6. Tolerate new fields and unknown event types.
7. Use `GET /events?cursor=...` to reconcile a gap; use the delivery log to diagnose retries.

## Signature verification

MindBill sends the `MindBill-Signature` header in this form:

```text
t=<unix-seconds>,v1=<hex-hmac-sha256>
```

The signed payload is the ASCII timestamp, a period, and the exact request body bytes:
`<timestamp>.<raw-body>`. Do not parse JSON, normalize whitespace, change encoding, or
re-serialize the body before verification. Reject malformed timestamps, timestamps outside
your replay window, and signatures that do not compare in constant time. More than one `v1`
value may appear during secret rotation; accept the delivery if any valid `v1` matches.

`@mindbill/node` verifies the format, HMAC, constant-time comparison, and a five-minute replay
window by default:

```ts
import { verifyMindBillWebhookSignature } from "@mindbill/node";

const rawBody = new Uint8Array(await request.arrayBuffer());
const signature = request.headers.get("mindbill-signature");

if (!verifyMindBillWebhookSignature(
  rawBody,
  signature,
  process.env.MINDBILL_WEBHOOK_SECRET!,
)) {
  return new Response("invalid signature", { status: 400 });
}

const event = JSON.parse(new TextDecoder().decode(rawBody));
```

Keep the webhook signing secret server-side and separate from API keys. Configure your web
framework to expose the unconsumed raw request body; a parsed request object is not sufficient.

## Sequence and reconciliation

`sequence` is an arbitrary-length decimal string. Never convert it to a JavaScript `number`,
because values can exceed `Number.MAX_SAFE_INTEGER`. Store it as text and compare it with
`compareMindBillEventSequence`:

```ts
import { compareMindBillEventSequence } from "@mindbill/node";

if (compareMindBillEventSequence(event.sequence, durableCursor) > 0) {
  // Durably record the event, then advance the cursor in the same transaction.
}
```

`GET /events?cursor=<last-processed-sequence>` returns later events in ascending sequence order.
Use it at startup, after delivery failures, and whenever webhook ordering is uncertain. Persist
the returned event `sequence` as the cursor only after the event is durably recorded. Continue
deduplicating by event `id`: webhook retries and polling can deliver the same event through both
paths. Do not derive the next cursor with arithmetic or assume sequences fit a database integer.

Typical lifecycle families include bill creation and submission, clearinghouse acceptance or rejection, payer denial and appeal activity, IBR activity, payment posting, and account/configuration changes. The developer portal's OpenAPI and event catalog define the current exact names and payload schemas.

Never include API keys, patient information, report contents, or full event bodies in shared application logs. Keep sandbox fixtures synthetic.
