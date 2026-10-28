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

## Doctors (rendering providers) and their signatures

A practice can have any number of doctors. In `BillingSettings` (and the **Rendering providers** step of
`OrganizationOnboarding`), the **Doctors (rendering providers)** section lists every saved doctor with NPI,
specialty, an **Inactive** marker and whether a signature is saved. Click **Edit** on a doctor to change their
details, mark them inactive (hidden from new bills) or manage their signature; click **+ Add provider** to add
another doctor. The same list is available on its own as `RenderingProvidersSettings`.

To add a doctor's signature, open the doctor with **Edit**, choose a PNG or JPEG image of the signature, enter your
name or staff reference, confirm you have the doctor's authorization, and click **Save signature**. The saved
signature is previewed with a **Replace signature** button. MindBill stores it as a PNG (≤512 KB, ≤4096 px a side;
JPEGs and large PNGs are converted in the browser by `signaturePngBase64`).

Bills created after the signature is saved for that doctor — matched by the bill's rendering-provider NPI — print
the signature image in CMS-1500 Box 31, in the packet preview and in the packet MindBill sends. Without a
signature, Box 31 prints "Signature on File", the standard attestation. Bills created earlier keep the provider
snapshot they were created with. Saving a signature uses the same administrator settings session
(`organization:manage`); no other permission is needed. Saved rendering providers in the profile carry the
response-only `signatureConfigured` and `signatureOnClaimForm` flags; the image itself is only returned by
`createOrganizationClient(...).getRenderingProviderSignature(providerId)` to settings sessions.

In `BillSubmissionForm`, choose the doctor under **Which doctor rendered this service?** (the collapsed summary has
**Change doctor**). A note below says whether that doctor's signature prints in Box 31 and links to adding one.
Under the picker, **+ Add new doctor** opens an inline panel (name, NPI, taxonomy, specialty, license, optional
signature). With `billingSettings` (an `organization:manage` session, administrators only) the doctor and signature
are saved for future bills and selected on this bill, and **Add signature** / **Replace signature** manages the
selected doctor's signature in place. Without `billingSettings`, a new doctor fills this bill only (the user is told
so) and signature actions are hidden; ordinary bill sessions never gain settings access. Pass `onManageSettings` to
send the user to your own settings page instead.

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

`profileDisplay="auto"` (the default since React 0.80.0) shows each billing provider, rendering provider and
service location that matches a saved choice as a one-line summary, for example
"Synthetic Spine Clinic · EIN ••6789 · NPI 1234567893 · Sacramento, CA", with an **Edit** button that opens that
section's fields only. A value matches a choice by its saved id (`savedProviderId`, then `id`) or, without one, by
equal values (empty fields ignored), so an `initialBill` that copies the option values collapses automatically. A
section shows its fields when nothing matches, when a required value is missing or invalid (including errors on
submit, which also focus the field), when it is named in `attentionFields`, or after the user edits it.
`profileDisplay="expanded"` always shows every field. `compact` also puts all details behind one disclosure.
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
