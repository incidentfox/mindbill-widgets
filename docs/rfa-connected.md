# Connected RFA workflow

`@mindbill/browser` exports `createRfaWorkflowClient`. It calls the current public
Partner API using short-lived browser sessions, with no permanent key in frontend
code. Native Angular components use this client; React hosts can use it with
`RfaDraftForm` and `RfaAuthorizationDestination`.

```ts
import { createRfaWorkflowClient } from '@mindbill/browser';
const rfas = createRfaWorkflowClient({ sessionEndpoint: '/api/mindbill/rfa-session' });
const page = await rfas.list({ claimId: authorizedClaimId });
const rfa = await rfas.get(selectedRfaId);
```

The authenticated host endpoint mints an **organization-wide** session for the
exact frontend origin. Omit bill/customer resource restrictions; those sessions
cannot access RFAs. Grant only permissions appropriate to the authenticated user:
`rfas:read`, `rfas:create`, `rfas:edit`, `rfas:sign`, `rfas:act`, `payers:read`,
and `documents:read`. Signing requires its distinct permission. The organization
must have `treatmentBilling` enabled. Claim, patient, and rendering provider IDs
come from verified host records. Backend authorization remains authoritative.

## Separate explicit steps

1. Create an unsigned draft with `create`. Keep a stable creation idempotency key.
2. `updateDraft` replaces editable content with `expectedRevision`; retained item
   IDs preserve those items. A successful edit changes the content revision and
   invalidates old signing evidence.
3. `uploadDocument` attaches a PDF to the current revision. Clinical support is
   required for a sendable packet.
4. Confirm the authorization office using the directory or verified case records.
   `signingPreview` takes `diagnosisDescriptions` keyed by **RFA item ID**, an
   optional saved `billingProviderId`, and optional `authorizationContact` containing
   known contact name, structured address, phone, fax, and email. Use the selected
   authorization destination; never substitute a bill-review fax or unrelated
   mailing address. Unknown fields remain blank. This contact is bound to the
   exact signing snapshot. Download and review its `previewDocumentId`
   with `downloadDocument`. A preview is not a signed form.
5. A separately authorized physician/delegate confirms the preview and calls
   `sign` using the returned snapshot ID, hash, rendering-provider ID, explicit
   physician authorization, and actor reference. Never fabricate authorization.
6. Select the current signed `rfa_form` and clinical support IDs, then call
   `downloadPacket`. At least two distinct documents are required.
7. Confirm delivery uses the authorization office reviewed in the signed packet.
   Directory selection
   does not send anything. An email address is not a fax destination.
8. `recordTransmission` records actual external delivery/receipt evidence. It
   requires a provider message ID or proof document for sent/delivered/received
   records; it does not dispatch a fax or email. An outbound `sent` record can be
   followed by an inbound `received` record. Delivery is not treatment approval.
9. Upload the actual `ur_response`, then `recordDecision` for selected items.
   Approval/modification requires an authorization number. Modified/denied
   decisions additionally require reason, reviewer contact, and official IMR form.
10. Link the returned approved item's ID to a professional bill service line's
    `rfaItemId`, and preserve the authorization number. Review authorized codes,
    quantities, dates, and actual performed treatment before submitting the bill.

Sandbox fax dispatch remains disabled. Test applications may record explicitly
labeled synthetic evidence in an isolated sandbox; never describe that as real
receipt or payer approval.

## Recovery and sessions

`RfaWorkflowError` exposes `status`, a sanitized `code`, and `outcomeUncertain`.
The client refreshes one rejected browser session using the same mutation key.
It does not retry ambiguous network/server failures. Reload/reconcile the saved
record before retrying, and reuse the same idempotency key and body when the
outcome is uncertain. Do not create another request to hide an uncertain result.

Call `clearSession()` on identity/tenant changes. Connected components discard
stale asynchronous results. Never retain one client's session across host users.

The client returns PDF `Blob`s from authenticated routes. It does not follow
arbitrary document URLs or place bearer tokens in links. Hosts should revoke
object URLs after downloads/previews. Public source: [Partner API contract](https://app.mindbill.org/partner-openapi.yaml).
