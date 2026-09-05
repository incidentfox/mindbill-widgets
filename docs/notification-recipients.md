# Invite any email address to billing alerts

Use `NotificationRecipientsSettings` (alias `ConnectedNotificationRecipientsSettings`)
for a practice administrator's **recipient list**, alongside the existing
`NotificationSettings` for a signed-in person's own preferences. Any email address
can be invited; the recipient does not need a MindBill console account.

Everything is default off. Administrators request categories and scope; they cannot
consent on somebody else's behalf. MindBill sends a patient-information-free
invitation. The email owner follows a 48-hour link, reviews the destination,
practice-wide or assigned-bill scope, categories and quiet hours, then explicitly
confirms. Opening a link alone never enables email. Alerts have an unsubscribe link.

This supports bill status/payment alerts and 30/60/90-day follow-up reminders, **not
scheduled financial report digests, patient reports or attachments**. Recipient
email choices in a courtesy-copy form do not enroll anyone in alerts.

## Embed the administrative settings section

The adapter below calls your own authenticated administrative route. It never puts
a permanent MindBill API key in the browser. Your server returns the `data` field
from the MindBill API, not its enclosing `{ data: ... }` envelope.

```tsx
import { useMemo } from "react";
import { NotificationRecipientsSettings, type NotificationRecipientsAdapter } from "@mindbill/react";

export function BillingRecipients({ identityKey, csrfToken }: {
  identityKey: string; // changes for admin, selected practice OR environment
  csrfToken: string;
}) {
  const adapter = useMemo<NotificationRecipientsAdapter>(() => {
    async function request(method: string, suffix = "", body?: unknown) {
      const response = await fetch(`/api/billing/notification-recipients${suffix}`, {
        method, credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) throw new Error("Notification request failed");
      return response.json();
    }
    return {
      load: offset => request("GET", `?offset=${offset}`),
      invite: input => request("POST", "", input),
      disable: async externalUserId => { await request("DELETE", `/${encodeURIComponent(externalUserId)}`); },
    };
  }, [identityKey, csrfToken]);
  return <NotificationRecipientsSettings identityKey={identityKey} adapter={adapter}
    appearance={{ preset: "mindbill" }} />;
}
```

The widget defaults to assigned bills, no categories, and quiet hours from 7 pm to
7 am Pacific. It labels pending invitations as off and displays existing recipient
states. It preserves the same `requestId` on unchanged retries, including uncertain
network failures. **Do not replace that receipt in your adapter.** Reloading a list
does not send mail. All appearance tokens, `className` and `style` are supported.

## Trusted host-server adapter

Authenticate the administrator, authorize the selected practice and each recipient
operation, and enforce same-origin/CSRF protection. Derive the MindBill organization,
environment and permanent key from trusted server state. An email field, `identityKey`
or external recipient ID is not authorization.

| Host route | Upstream request at `https://app.mindbill.org` |
| --- | --- |
| GET list | `GET /partner/v2/notifications/recipients?offset=0` |
| POST invitation | `POST /partner/v2/notifications/recipients/{externalUserId}/invitations` |
| DELETE recipient | `DELETE /partner/v2/notifications/recipients/{externalUserId}` |
| Sync bill assignment | `PUT /partner/v2/notifications/recipients/{externalUserId}/bills/{billId}` |
| Remove bill assignment | `DELETE /partner/v2/notifications/recipients/{externalUserId}/bills/{billId}` |

Use the API's normal server-key authentication and `X-MindBill-Org-Id`, with
`orgs:write`. Browser session tokens cannot call these administrative endpoints.
Only the partner's managed connected organization is accessible. Return
`Cache-Control: no-store` from every host response.

The MindBill developer console uses corresponding owner/admin-only routes under
`/partner/v2/console/notifications/recipients` (including the same recipient and
invitation suffixes), with its console session and trusted organization/environment
headers. A console session is not an API key; ordinary partner applications should
use the server-key routes above. Both paths preserve the credential that created
the subscription, so revoking that credential also prevents delivery.

For invitation POST, strictly validate the following allowlist, authorize the
requested audience, and forward it unchanged:

```ts
{
  requestId: "a-client-generated-UUID", // retain on retries; never regenerate
  email: "doctor@example.com",
  audience: "assigned_bills", // or "practice" after host authorization
  statusUpdates: true,
  agingDays: [30, 60, 90],
  quietHours: true,
}
```

Resolve a **stable opaque** `externalUserId` in your server, scoped to this practice
and environment. Reuse an existing doctor's ID when appropriate, or use an existing
recipient directory with a stable ID for an arbitrary mailbox. Do not generate a
new ID for every retry, use the email itself as the ID, or infer patient/bill access
from an address, name or provider NPI. If you do not have a recipient directory, a
private server-side HMAC of `(practice, environment, normalized email)` is a stable
opaque identity for mailbox-only recipients without a database migration; rotating
that HMAC key requires preserving old ID mappings. Changing a mailbox-based email
means explicitly revoking the old recipient and inviting a new one.

The widget does **not** emit `enabled`, consent/verification timestamps, tenant IDs
or bill assignments. Do not add them. The recipient's confirmation records consent
and email possession. Practice-wide scope includes future bills; assigned-bill
scope requires explicit server-side assignment sync. Without assignments, no alerts
are sent. Assignment does not grant access to the application.

List returns `{ available, environment, recipients, hasMore }`, up to 100 records
per page. Pass this projection directly to `load`. Disable returns enabled=false;
reload to get authoritative state. Invitations return `deliveryStatus` (`sent`,
`sending`, `unknown`, `suppressed`, or `sandbox_preview`), not enrollment. Only
`sent` means the transport acknowledged the invitation, not that it was read.
An unknown attempt is never automatically retried. Reusing one receipt with changed
input returns 409. Quotas limit invitation abuse; respect 429 without blind retries.

New invitations for an existing recipient disable the previous subscription until
fresh confirmation. Email/scope changes clear bill assignments; sync newly authorized
assignments explicitly. Revocation/unsubscribe invalidates old invitations, including
already-consumed links. Expired links require a deliberately new invitation/receipt.

## Activation and safe testing

The platform operator must configure delivery/signing and enable invitation and
external-notification gates. `available: false` means invitations cannot be created;
existing recipients can still be disabled. This feature does not silently activate
external email delivery or opt in existing contacts.

Sandbox creates a `previewUrl` and never sends invitation or alert emails. Keep the
preview link private; it is a capability. Live responses do not disclose the link.
Use a synthetic adapter for UI tests and sandbox API requests for end-to-end tests.
Never use customer email addresses in tests, logs, issues or screenshots.
