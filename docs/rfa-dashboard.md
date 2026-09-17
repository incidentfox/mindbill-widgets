# Connected RFA dashboard

The dashboard supports draft preparation and editing, reviewed signing, packet preparation, deliberate fax delivery, and recording receipt and utilization review outcomes:

```tsx
import { RfaDashboard } from "@mindbill/react";

<RfaDashboard
  getSession={getAuthorizedRfaSession}
  claimId={authorizedClaimId}
  actorReference={authenticatedUser.id}
  permissions={["create", "edit", "sign", "send", "act"]}
  environment="sandbox"
  initialDraft={prefilledDraftFromAuthorizedCase}
/>
```

`initialDraft` is optional. It enables the New authorization request button when `create`
is permitted, and uses the same input as `RfaDraftForm`. `claimId` and
`renderingProviderId` optionally filter the list. Server authorization must enforce the
actual permitted records; filters and `permissions` only control the interface.
`onCreated(record)` observes draft creation; optional `onContinue(record)` adds a host
navigation action without replacing the native signing and packet workflow.

The trusted server must authenticate the user and mint a short-lived exact-origin session:

| Capability | Session scopes |
| --- | --- |
| List, detail, assembled packet | `rfas:read` |
| PDF previews and delivery proof | `documents:read` |
| Authorization recipient directory | `payers:read` |
| Create draft | `rfas:create` |
| Edit eligible draft; upload clinical, response, or IMR PDF | `rfas:edit` |
| Signing preview and attested signing | `rfas:sign` |
| Fax send and refresh; record receipt, decisions, information responses; update follow-up tasks | `rfas:act` |

Use only the scopes authorized for the current user. Permanent API keys stay on your server.
The UI `permissions` default is an empty array. PDF views require `documents:read` even
when the user has `rfas:read`. Directory failure leaves manual recipient confirmation
available; it never substitutes a telephone number or silently picks a recipient.

## Optional tab in the billing dashboard

React 0.68.0 adds an opt-in **Requests for authorization** tab to
`ConnectedBillingWorkspace` and `BillingDashboard`. Set `showRfas` to enable it;
it defaults to `false` and loads RFA data only when opened.

```tsx
<ConnectedBillingWorkspace
  sessionEndpoint="/api/mindbill/session"
  showRfas
  initialView="rfas"
  rfaDashboard={{
    initialDraft: prefilledDraftFromAuthorizedCase,
    actorReference: authenticatedUser.id,
    permissions: ["create", "edit", "sign", "send", "act"],
    environment: "sandbox",
    onCreated: (record) => rememberCreatedRequest(record.id),
  }}
/>
```

The tab includes status counts and filtering, request details, **New authorization
request**, draft editing, signing, packet review, submission, and delivery history.
The new-request button requires both `initialDraft` and `create` permission. Supply
that draft from the patient, claim, and rendering provider selected in your host
application; those identities remain fixed in the form. Saving creates an unsigned
draft. Sending is a separate, explicitly confirmed action.

`rfaDashboard` accepts the same props as standalone `RfaDashboard`. The connected
workspace inherits its main session, API URL, and fetch implementation. Supply
`rfaDashboard.getSession` or `rfaDashboard.sessionEndpoint` for separately authorized
RFA access; a dedicated endpoint overrides the workspace session callback. Mint the
scopes listed above on the trusted server. Permissions default to read-only and the
environment defaults to sandbox; showing the tab never grants backend access.

For the data-driven dashboard, pass `bills`, `showRfas`, and the same `rfaDashboard`
configuration. Its RFA connection defaults to `/api/mindbill/session`. Bill search
filters do not apply to RFAs; use `rfaDashboard.claimId` or `renderingProviderId`
for a restricted view. The RFA status selector filters requests within that view.

`initialView="rfas"` opens the tab immediately in `ConnectedBillingWorkspace`.
Disabling the selected tab returns to Bill tasks (or Bills in `BillingDashboard`).
This SDK option does not change the MindBill application interface.

## Edit an existing draft

With `edit` permission, **Edit request draft** opens the existing service rows. Saving
replaces the full content at `expectedRevision`, preserves retained service IDs and host
metadata, removes deleted rows, and creates IDs for new rows. Claim, patient, and rendering
provider IDs remain fixed. A successful save increments the content revision, clears the
signature, and requires a new signing preview and attestation. Historical signed PDFs remain
viewable but cannot be selected as the current signed form.

Only unsent `draft` or `ready` requests can be edited. The server also rejects edits once
submission is queued, sent, delivered, or receipt is recorded. A stale revision returns 409;
the form retains edits and offers **Discard edits and refresh** to load the latest request.
It never silently overwrites newer content or automatically sends the changed request.

## Prepare, sign, review, send

An authorized administrator must first save the physician's signature in
[MindBill rendering provider settings](https://app.mindbill.org/settings/rendering-providers).
`BillingSettings` does not expose signature material. In the dashboard, enter each diagnosis
description, prepare and inspect the exact DWC-RFA, then explicitly attest physician
authorization before signing. `actorReference` identifies that authorized human in your
system (1–200 characters); use a stable user ID, not an API key or credential.

Upload clinical substantiation as a PDF up to 25 MB. Select the intended documents and
prepare the assembled packet. The backend generates a cover sheet if none is selected.
The current-revision signed form is selected automatically; historical forms remain viewable.
Review the packet and explicitly confirm the authorization fax recipient before sending.
Email destinations require your approved secure email workflow; the widget does not send email.

`environment` defaults to `sandbox`, which disables external fax sending. `live` shows the
fax action only for users with `send`, and still requires packet and recipient confirmations.
Backend session environment and permissions remain authoritative. Never enable live delivery
for a demo. Synthetic browser verification must mock every transmission.

The dashboard renders server statuses, recorded receipt and decision deadlines, treatment
outcomes, information requests, event history, and fax delivery proof. It does not infer a
receipt or start a deadline from an attempted send. Existing transmitted requests are not
sent again through the initial-send action.

## Record outcomes and follow-up

`act` enables evidence-backed receipt recording, item-level utilization review decisions,
recording an information request or a response that has already been delivered, and updating existing
follow-up tasks. `edit` enables document uploads. Recording a receipt requires a proof
PDF or transmission reference. Decision entry associates the response PDF and, for modified
or denied treatment, an IMR form. These actions record supplied evidence; they do not infer
receipt from attempted fax delivery, send information responses, create follow-up tasks, or
queue notifications.

`RfaLifecycleControls` is also exported for a custom detail page. Pass `rfa`, the same
connection options, `permissions={["act", "edit"]}`, and `onUpdated` to adopt the refreshed
record. Its default is read-only. Clock corrections and other advanced workflows remain
available through the documented [RFA API](https://docs.mindbill.org/guides/rfas).

## Custom browser UI

`createRfaClient` from `@mindbill/browser` accepts `OrganizationClientOptions` (`getSession`
or `sessionEndpoint`, optional `apiBaseUrl` and `fetch`). Its methods are `list`, `get`,
`createDraft`, `updateDraft`, `getDocument`, `uploadDocument`, `prepareSigning`, `sign`, `previewPacket`,
`sendFax`, and `refreshFaxes`. JSON detail/mutation responses unwrap to `RfaRecord`; list
returns `{data, nextCursor, summary}`. Documents and packets return authenticated `Blob`s.
Mutations take an explicit idempotency key; reuse it for retries of the same operation.
A single authentication retry preserves that key. `getDocument` requires `documents:read`.

`updateDraft(id, replacement, key)` uses `PATCH /rfas/{id}/draft`. Pass a positive
`expectedRevision` and the complete editable content; retained items carry `id`, new items
omit it. `createRfaLifecycleClient` exposes `recordReceipt`, `recordDecisions`,
`recordInformationRequest`, `recordInformationResponse`, `listFollowUps`, and `updateFollowUp` for custom lifecycle UIs.
