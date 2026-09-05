# Team notes and courtesy copies

`ConnectedBillLifecycle` includes workspace team notes and **Forward copy**. Neither changes bill status. Native MindBill keeps its richer case-contact picker while sharing packet construction and canonical notes.

## React integration

For a custom shell:

```tsx
import { createBillLifecycleClient } from "@mindbill/browser";
import { BillCourtesyCopyForm } from "@mindbill/react";

const client = createBillLifecycleClient({ billId, sessionEndpoint: "/api/mindbill/session" });

<BillCourtesyCopyForm
  environment={lifecycle.environment}
  documents={documents.map(({ id, filename }) => ({ id, filename }))}
  appearance={{ preset: "midnight-cyan", controlRadius: "8px" }}
  onPreview={client.previewCourtesyCopy}
  onSend={client.sendCourtesyCopy}
  onSent={() => refreshBill()}
/>
```

Permanent API keys belong only on your server. The form requires PDF review and recipient confirmation before explicit send. Colors, surfaces, borders, and radii follow shared `appearance` tokens.

### Bring your own recipient choices

Pass existing case contacts without building another contact-management screen:

```tsx
import type { CourtesyCopyRecipientOption } from "@mindbill/react";

const caseContacts: CourtesyCopyRecipientOption[] = [
  { name: "Example counsel", email: "counsel@example.com" },
  { name: "Practice office", email: "office@example.com" },
];

<ConnectedBillLifecycle
  billId={billId}
  sessionEndpoint="/api/mindbill/session"
  courtesyCopyRecipientOptions={caseContacts}
/>

<ConnectedBillingWorkspace
  sessionEndpoint="/api/mindbill/session"
  getCourtesyCopyRecipientOptions={(selectedBillId) => contactsByBill[selectedBillId] ?? []}
/>
```

For the standalone form, use `recipientOptions={caseContacts}`. Supply only contacts the signed-in user may see for that bill; the workspace callback is deliberately bill-scoped. Load contacts in the host app, then pass the resulting array (or return it synchronously from the callback).

These are suggestions, not defaults: users choose To/CC contacts or enter addresses manually. Display names are escaped labels; only email addresses enter the preview/send request. Invalid suggestions are omitted, duplicate addresses are collapsed case-insensitively, and already-selected contacts are disabled in both pickers. The server still validates recipients and limits. Changing a recipient discards the previous preview and confirmation. Suggestions are not persisted as contacts and do not grant permission to disclose records.

**Courtesy-copy choices do not enroll anyone in bill-notification emails.** Notification subscriptions require the recipient's separate consent and workspace authorization; passing a contact here never creates a subscription or triggers email.

## API contract

POST `/partner/v2/bills/{id}/courtesy-forward` using server `bills:write`, or `/partner/v2/browser/bills/{id}/courtesy-forward` using an origin-bound browser session and `bills:act`. Existing partner/workspace and bill restrictions apply.

1. Preview with `{ "mode": "preview", "to": ["recipient@example.com"], "cc": [], "subject": "Courtesy copy", "bodyText": "For your records", "includeCms1500": true, "documentIds": [] }`.
2. Review `pdfBase64` and verify recipients may receive the records. Raw JSON also contains `filename`, `documentCount`, `packetHash`, and `environment`; there is no `data` wrapper.
3. Send the same input with `mode: "send"`, the returned `packetHash`, and an `Idempotency-Key` header (1–255 characters). Reuse that key and payload on retries. `sendCourtesyCopy` requires a caller-provided key; the React form retains it for retries while mounted.

The hash binds source documents, recipients, and message. Changes require a new preview. If delivery is uncertain, do not reopen the form or generate a new key: delivery may already have occurred. Interrupted requests retain a processing marker; retries return `409 request_in_progress` until an operator reconciles delivery.

Limits: 20 To and 20 CC addresses, 200-character subject, 10,000-character message, 30 selected documents, and a 25 MB packet. Cover sheet comes first, then optional CMS-1500 and selected documents in the bill's document order. Invalid PDFs and documents outside the bill fail before delivery. From and Reply-To use the workspace inbox and cannot be overridden.

Sandbox returns `{ "ok": true, "sent": false, "simulated": true }` and never invokes email transport. Inspect `sent`, `simulated`, and `dryRun`, not `ok` alone. Live success records history and emits `bill.courtesy_copy_sent` with opaque audit linkage.

## Canonical team notes

Existing `add_note` writes a workspace team note visible in native MindBill and partner components. Scope: server `bills:write`, browser `bills:act`. Ownership is stamped to the authenticated partner, never a caller-supplied native user ID.

Lifecycle `notes` entries contain `id`, `body`, `author`, `createdAt`, and `pinned`. Notes remain inside the workspace and are excluded from courtesy PDFs and payer submissions. Audit history uses the same ID without duplicating the body, so native edits/deletes cannot leave stale note text in partner activity. React also supports older history-only notes and deduplicates canonical notes against legacy mirrors.
