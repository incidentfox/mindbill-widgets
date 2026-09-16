# Reusable billing profiles

React 0.62 automatically loads saved billing providers, rendering providers, and service
locations when a connected `BillSubmissionForm` has no explicit `profileOptions`. The
read uses an organization-wide `bills:create` session. Values already entered are preserved;
loading options never selects or replaces a provider.

Workspace administrators can use `BillingSettings` to manage shared billing providers,
rendering providers, service locations/POS, and the practice W-9 in MindBill. Use
`OrganizationOnboarding` for the step-by-step initial setup instead.

```tsx
import { BillingSettings } from "@mindbill/react";

<BillingSettings
  sessionEndpoint="/api/mindbill/settings-session"
  onSaved={(profile) => refreshAuthorizedProfileChoices(profile)}
/>
```

The settings endpoint must authenticate the user, check their workspace-admin role,
and mint a separate unscoped
exact-origin session with `organization:manage`. Do not give that permission to every
bill-entry user. A hidden settings tab is not authorization. Permanent API keys stay
on the server. See the [integration quickstart](https://docs.mindbill.org/learn/quickstart).

## Choose saved values when authoring a bill

For manual loading, fetch a masked organization profile with `createOrganizationClient(...).getBillingProfile()`
using an organization-wide `bills:create` session, or provide your own host-owned choices.
This read-only route does not need `organization:manage` and rejects customer-scoped
and single-bill sessions. Customer integrations use their own authorized inline values
or host-owned choices instead of fetching shared profiles. Pass `profileOptions={}` to
explicitly disable automatic reads for scoped sessions. Connected bill corrections use the
authorized options in the bill review response, including single-bill sessions.
The adapter does not fetch profiles or broaden permissions.

```tsx
import { BillSubmissionForm, organizationProfileOptions } from "@mindbill/react";

<BillSubmissionForm
  sessionEndpoint="/api/mindbill/session"
  initialBill={billPrefilledFromYourCase}
  profileOptions={organizationProfileOptions(authorizedOrganizationProfile)}
  profileDisplay="compact"
/>
```

`profileDisplay="expanded"` is the default and keeps provider/location fields visible.
`compact` puts the searchable choices first and lets the user expand the editable details.
No profile is silently selected. Selecting a choice copies its values into this bill's
editable snapshot, except saved SSN providers: those use a server-resolved `savedProviderId`
and lock the referenced fields until the user chooses different details. The backend
freezes the provider snapshot when creating the bill. Changing saved settings never
rewrites a submitted bill.

For host-owned data, the same component accepts `profileOptions` directly:

```tsx
const profileOptions = {
  renderingProviders: [{
    id: "doctor-example",
    label: "Example Doctor",
    value: { name: "Example Doctor", npi: "1234567893", isQme: true },
  }],
  serviceLocations: [{
    id: "office-example",
    label: "Main office",
    value: {
      name: "Main office",
      placeOfServiceCode: "11",
      address: { line1: "100 Example Avenue", city: "Los Angeles", state: "CA", postalCode: "90012" },
    },
  }],
};
```

Available collections are `billingProviders`, `renderingProviders`, and `serviceLocations`.
Each choice is `{ id, label, value }`; `value` uses the matching bill-input field type.
Choice IDs remain UI references; SSN provider values carry an explicit `savedProviderId`.
You can mix MindBill-owned and
host-owned collections without adding a database table. Retain the canonical bill ID in
existing case metadata where practical; use an idempotency key for submission retries.

## Optional administrator settings in the form

```tsx
<BillSubmissionForm
  getSession={getBillingSession}
  initialBill={billPrefilledFromYourCase}
  billingSettings={isAdministrator ? { getSession: getSettingsSession } : undefined}
/>
```

`billingSettings` adds **Add or manage saved providers** and an embedded settings page.
The separate settings session needs `organization:manage`; enforce the administrator role
on your server before minting it. Saving refreshes the available choices without replacing
typed bill values. The same prop is available on `ConnectedBillLifecycle` and
`ConnectedBillingWorkspace` for corrections and resubmission. Do not grant management
permission to ordinary bill-entry sessions. A saved practice W-9 is attached by the backend
when applicable; review the final submission documents.

## Sensitive data and documents

Settings support EINs and SSNs (React 0.47.0, browser 0.28.0, Angular 0.18.0). Select
`taxIdType: "SSN"` explicitly. SSNs are encrypted server-side and responses return an empty
`taxId`, `taxIdLast4`, and `taxIdConfigured`, never the saved plaintext or ciphertext.
Password fields stay empty after loading. Leaving a configured field untouched preserves
it; entering a new value replaces it; the explicit clear action removes it. Changing tax
ID type requires a new value. Do not submit the last four digits as a tax ID.

New bills can send `billingProvider: { savedProviderId }`; corrections and duplicates can
send `billingProvider: { sourceBillId }` to preserve the original bill's frozen provider
snapshot. Both references are tenant-checked and mutually exclusive with inline provider
fields. The server resolves and decrypts only where needed for bill creation and delivery.

Keep W-9/tax information out of logs, analytics, source control, and agent prompts. Access
to saved profiles must follow the same tenant authorization as the associated practice.
Only select the documents intended for delivery; do not attach every document from a case.
The profile-choice adapter supplies provider/location values, not attachment bytes.

For colors, layout geometry, and dashboard aging styles, see
[theme customization](./theme-customization.md).


### Built-in Settings tab

React 0.64.0 adds a **Settings** tab, enabled by default, to
`ConnectedBillingWorkspace` and `BillingDashboard`. It includes practice identity,
billing providers, rendering providers, service locations, W-9 upload, and setup
readiness. Settings load only when the tab opens.

```tsx
<ConnectedBillingWorkspace
  sessionEndpoint="/api/mindbill/session"
  showSettings={isAdministrator}
  billingSettings={{ sessionEndpoint: "/api/mindbill/settings-session" }}
  onSettingsSaved={(profile) => refreshHostBillingProfile(profile)}
/>
```

Use `showSettings={false}` to hide the tab. Your server must authorize the signed-in
user before minting a settings session with `organization:manage`; tab visibility does not
grant access. With no `billingSettings`, the connected workspace reuses its main
connection. The data-driven `BillingDashboard` uses `/api/mindbill/session` unless
you pass `billingSettings`. No settings request is made while the tab is hidden.
Use `initialView="settings"` on the workspace to open setup immediately; if settings
are hidden, it opens Bill tasks instead.

Saved profiles become available when bill creation/correction forms next load.
`onSettingsSaved` lets hosts refresh separately mounted forms or their own caches.
Continue passing the same `billingSettings` to a standalone `BillSubmissionForm`
for its inline “Add or manage” action. You can still mount `BillingSettings`
separately when your product has its own settings navigation.


### Organization administration (React 0.65)

Settings now has **Billing profiles**, **Claims administrators**, and **Team** sections.
Billing provider fields come first; the separate organization identity is under
**Organization details**. Organization identity supports onboarding and does not
replace the bill's selected billing provider, rendering provider, or service location
on CMS-1500 forms. Saved profiles and submitted bill snapshots remain separate.

Claims administrators supports adding, editing, and removing organization-owned entries
with a name and at least one delivery method. These entries join the shared directory
when creating claims. Removal hides future selections; existing bills keep their snapshots.
It uses `organization:manage`, like billing profiles. Directory access remains tenant-scoped.

Team manages roles and active status for existing **MindBill accounts**. It does not
create accounts, invite users, or change roles in your own application. Your server must
explicitly delegate `team:manage` in a separate organization-wide browser session,
authorized for the actual administrator. The API key needs `orgs:team:write` to mint
that permission. `organization:manage` alone never grants team access. Customer- or
bill-scoped sessions cannot receive either management permission. Protected accounts
and the last administrator cannot be demoted or disabled.

```ts
const organization = createOrganizationClient({ sessionEndpoint: "/api/mindbill/settings-session" });
await organization.getClaimsAdministrators();
await organization.createClaimsAdministrator({ name: "Example Administrator", fax: "2025550100" });
await organization.updateClaimsAdministrator("saved-id", { name: "Updated Administrator", fax: "2025550100" });
await organization.deleteClaimsAdministrator("saved-id");
const team = await organization.getTeam();
await organization.updateTeamMember("member-id", { role: "viewer" });
```

The matching server routes are `/partner/v2/organization/claims-administrators`
(GET/POST), `/partner/v2/organization/claims-administrators/{id}` (PATCH/DELETE),
`/partner/v2/organization/team` (GET), and `/partner/v2/organization/team/{id}` (PATCH).
API-key reads/writes use `orgs:read`/`orgs:write` for custom administrators and
`orgs:team:read`/`orgs:team:write` for team membership. Billing profile callbacks do
not fire for team or directory changes.

Notification preferences and recipient invitations remain available through the
separate notification components. Signature setup remains in MindBill.
