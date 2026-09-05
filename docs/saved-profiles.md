# Reusable billing profiles

Use `BillingSettings` in your application's settings area to manage billing providers,
rendering providers, service locations/POS, and the practice W-9 in MindBill. Use
`OrganizationOnboarding` for the step-by-step initial setup instead.

```tsx
import { BillingSettings } from "@mindbill/react";

<BillingSettings
  sessionEndpoint="/api/mindbill/settings-session"
  onSaved={(profile) => refreshAuthorizedProfileChoices(profile)}
/>
```

The settings endpoint must authenticate the user, check their organization-admin role,
resolve the MindBill organization from trusted server-side tenancy, and mint an
exact-origin session with `organization:manage`. Do not give that permission to every
bill-entry user. A hidden settings tab is not authorization. Permanent API keys stay
on the server. See the [integration quickstart](https://docs.mindbill.org/learn/quickstart).

## Choose saved values when authoring a bill

Pass an organization profile obtained through an authorized workflow, or provide your
own host-owned choices. The adapter does not fetch profiles or broaden permissions.

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
editable snapshot. Changing saved settings never rewrites a submitted bill.

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
Choice IDs remain UI references, not new bill API fields. You can mix MindBill-owned and
host-owned collections without adding a database table. Retain the canonical bill ID in
existing case metadata where practical; use an idempotency key for submission retries.

## Sensitive data and documents

Settings currently support EINs, not personal SSNs. Recognizable SSN formatting is rejected,
but nine unformatted digits cannot establish whether a value is an EIN. Do not use this
feature for SSN storage or describe it as application-level encrypted SSN support.

Keep W-9/tax information out of logs, analytics, source control, and agent prompts. Access
to saved profiles must follow the same tenant authorization as the associated practice.
Only select the documents intended for delivery; do not attach every document from a case.
The profile-choice adapter supplies provider/location values, not attachment bytes.

For colors, layout geometry, and dashboard aging styles, see
[theme customization](./theme-customization.md).
