# Partner-managed notification settings

`NotificationSettings` (also exported as `ConnectedNotificationSettings`) is a
ready-to-embed React settings section for **any partner**, not a Docura-specific
feature. It uses the same `appearance`, `className` and `style` customization as
the billing components. Mount it in your existing settings page; no new doctor
account in the MindBill console is necessary.

Notifications start **off** with no categories selected. The user chooses status
updates and/or 30/60/90-day reminders, explicitly consents and saves. Changed
enabled preferences, including quiet hours, require consent again. Unsubscribing
does not require consent. Sandbox is a preview and never sends these emails.

## Browser integration

The component talks to **your authenticated server**, not an administrative
MindBill endpoint. This example assumes your routes return the small projection
below and protect mutations with your application's CSRF mechanism.

```tsx
import { useMemo } from "react";
import {
  NotificationSettings,
  type NotificationSettingsAdapter,
  type NotificationSettingsSnapshot,
} from "@mindbill/react";

export function BillingNotificationSettings({ accountKey, csrfToken }: {
  accountKey: string; // change for user, practice OR environment changes
  csrfToken: string;  // provided by your authenticated application
}) {
  const adapter = useMemo<NotificationSettingsAdapter>(() => {
    let pending: { payload: string; id: string } | undefined;
    async function request(method: string, body?: unknown, requestId?: string) {
      const response = await fetch("/api/me/billing-notifications", {
        method,
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json", "X-CSRF-Token": csrfToken,
          ...(requestId ? { "Idempotency-Key": requestId } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      // Our host route uses 409 when a rejected/expired consent receipt needs
      // fresh consent. Do not clear receipts for ambiguous network/server failures.
      if (response.status === 409) pending = undefined;
      if (!response.ok) throw new Error("Notification settings request failed");
      return response;
    }
    async function load(): Promise<NotificationSettingsSnapshot> {
      return (await request("GET")).json();
    }
    return {
      load,
      async save(update) {
        const payload = JSON.stringify(update);
        if (pending?.payload !== payload) pending = { payload, id: crypto.randomUUID() };
        // Turning off uses revocation, not the enrollment PUT endpoint.
        await request(update.enabled ? "PUT" : "DELETE", update.enabled ? update : undefined, pending.id);
        const result = await load();
        pending = undefined; // keep the same receipt after ambiguous failures
        return result;
      },
      async unsubscribe() {
        await request("DELETE");
        return load();
      },
    };
  }, [accountKey, csrfToken]);

  return <NotificationSettings identityKey={accountKey} adapter={adapter}
    appearance={{ preset: "mindbill" }} />;
}
```

Memoize the adapter so parent rerenders do not reload the form. `identityKey`
discards UI state and ignores old in-flight results when the authenticated host
user, selected practice or environment changes. **It is not an authorization
credential** and is never sent in a preference mutation.

### Host response projection

```ts
type NotificationSettingsSnapshot = {
  preferences: null | {
    enabled: boolean;
    statusUpdates: boolean;
    agingDays: (30 | 60 | 90)[];
    quietHours: boolean;
  };
  email: string; // display only: verified, server-selected consent destination
  audience: "practice" | "assigned_bills"; // display only: server-authorized scope
  environment: "live" | "sandbox";
  canEnable: boolean; // server availability + verified email + authorized access
};
```

Return `preferences: null` for a recipient who has not enrolled. Missing preferences
render off. Do not set `canEnable` solely from the raw API's `recipient.eligible`:
a not-yet-enrolled user has no eligible row. Check the backend's `available` plus
your own verified email and access policy. Existing enrollment details must match
the displayed destination/scope; do not silently move consent to a changed email
or a broader audience. On such changes revoke old enrollment, resolve verification
and show the new scope before collecting new consent.

The component's save callback receives only:

```ts
{ enabled, statusUpdates, agingDays, quietHours, consent: boolean }
```

There are no browser mutation fields for another user's identity, email address,
practice, environment, verification time, consent time or bill assignments. The
UI never marks an email verified and never grants bill access.

## Trusted server responsibilities

Use the generic administrative API on **your server** with a permanent key having
`orgs:write` and `X-MindBill-Org-Id`. Browser billing session tokens cannot enroll
recipients. Do not put a permanent key in React props, public environment variables
or browser requests.

| Host operation | MindBill server API | Then |
| --- | --- | --- |
| Load | `GET /partner/v2/notifications/recipients/{externalUserId}` | Project `data.available` and `data.recipient` to the shape above |
| Opt in/change | `PUT /partner/v2/notifications/recipients/{externalUserId}` | Reload GET; PUT returns only enabled/audience, not full preferences |
| Unsubscribe | `DELETE /partner/v2/notifications/recipients/{externalUserId}` | Reload GET; DELETE is revocation and returns enabled=false |
| Assign a bill | `PUT /partner/v2/notifications/recipients/{externalUserId}/bills/{billId}` | Server-authorized access sync only; no request body |
| Remove assignment | `DELETE /partner/v2/notifications/recipients/{externalUserId}/bills/{billId}` | Stop that bill's alerts |

For every host request:

1. Authenticate the current user and derive their opaque `externalUserId`, practice,
   environment and authorized audience from trusted application state. Never accept
   these from preference form fields. Protect GET responses with `Cache-Control:
   no-store`; enforce same-origin/CSRF protection for PUT and DELETE.
2. Strictly validate the allowlisted preferences and `consent: true` for enabled
   changes. Resolve the verified email from your identity provider/server records.
   The checkbox is evidence of intent, **not proof of identity or verification**.
3. Record consent server-side with the exact selected categories, displayed email,
   audience, version and timestamp. Bind the displayed settings context to the
   authenticated session (or a short-lived server-issued challenge). Reject and
   reload if email, access or environment changed between display and submission.
   Never invent a verification timestamp or trust a browser-provided one.
4. Translate an enabled request into the MindBill PUT below. Retain the same consent
   record for a retry of the same operation. Bind the host `Idempotency-Key` to the
   authenticated identity, scope and exact payload in your consent audit store;
   reject reuse with different input. This is a host receipt key, not an identity
   credential or a MindBill request field. Never regenerate consent timestamps on
   an unchanged retry. Fresh consent must be newer than prior
   consent/unsubscribe, no more than 24 hours old, not future-dated and after actual
   verification. Changing the email needs verification newer than prior consent.
5. Use DELETE for opt-out and user removal. For `assigned_bills`, explicitly sync
   assignments from your authorization model. No assignments means no emails.
   Never infer assignment from email suggestions, provider NPI or a dropdown.

```ts
// Server-built body only. Values named `trusted*` are YOUR authenticated records.
{
  enabled: true,
  email: trustedVerifiedEmail,
  audience: trustedAuthorizedAudience,
  statusUpdates: validatedPreferences.statusUpdates,
  agingDays: validatedPreferences.agingDays,
  quietHours: validatedPreferences.quietHours,
  consent: {
    grantedAt: recordedConsent.timestamp,
    emailVerifiedAt: trustedEmailVerification.timestamp,
    version: recordedConsent.version,
  },
}
```

Backend policy is also default off until notification delivery is enabled by the
platform operator. Generic external alerts contain no patient details, amounts,
attachments or bill identifiers. Emails include unsubscribe; the delivery worker
rechecks consent and access before sending. Do not use courtesy-copy recipient
options as an enrollment list. Quiet hours hold alerts from 7 pm to 7 am Pacific.

Failed saves remain visible without claiming success. Retry the unchanged operation
or use **Reload settings** after an ambiguous network failure. After unsubscription,
new consent is required to re-enable. No real mail should be sent while testing:
use a synthetic host adapter or the sandbox environment.
