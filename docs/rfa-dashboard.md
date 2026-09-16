# Connected RFA dashboard

React 0.62 and browser 0.38 add a complete embedded authorization workflow:

```tsx
import { RfaDashboard } from "@mindbill/react";

<RfaDashboard
  getSession={getAuthorizedRfaSession}
  claimId={authorizedClaimId}
  actorReference={authenticatedUser.id}
  permissions={["create", "edit", "sign", "send"]}
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
| Upload clinical PDF | `rfas:edit` |
| Signing preview and attested signing | `rfas:sign` |
| Fax send and refresh transmission status | `rfas:act` |

Use only the scopes authorized for the current user. Permanent API keys stay on your server.
The UI `permissions` default is an empty array. PDF views require `documents:read` even
when the user has `rfas:read`. Directory failure leaves manual recipient confirmation
available; it never substitutes a telephone number or silently picks a recipient.

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

## Custom browser UI

`createRfaClient` from `@mindbill/browser` accepts `OrganizationClientOptions` (`getSession`
or `sessionEndpoint`, optional `apiBaseUrl` and `fetch`). Its methods are `list`, `get`,
`createDraft`, `getDocument`, `uploadDocument`, `prepareSigning`, `sign`, `previewPacket`,
`sendFax`, and `refreshFaxes`. JSON detail/mutation responses unwrap to `RfaRecord`; list
returns `{data, nextCursor, summary}`. Documents and packets return authenticated `Blob`s.
Mutations take an explicit idempotency key; reuse it for retries of the same operation.
A single authentication retry preserves that key. `getDocument` requires `documents:read`.
