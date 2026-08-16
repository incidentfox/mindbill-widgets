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

Typical lifecycle families include bill creation and submission, clearinghouse acceptance or rejection, payer denial and appeal activity, IBR activity, payment posting, and account/configuration changes. The developer portal's OpenAPI and event catalog define the current exact names and payload schemas.

Never include API keys, patient information, report contents, or full event bodies in shared application logs. Keep sandbox fixtures synthetic.
