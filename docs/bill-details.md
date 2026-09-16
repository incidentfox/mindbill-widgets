# Shared bill detail sections and navigation

`BillReadOnlyForm` uses `BillDetailLayout` and `BillDetailSection` for its patient, claim,
provider, service, and attachment sections. Applications with their own editing controls
can compose the same primitives without replacing those controls:

```tsx
import { BillDetailLayout, BillDetailSection } from "@mindbill/react";

<BillDetailLayout header={<h2>Bill details</h2>} sidebar={<p>Submission history</p>}>
  <BillDetailSection
    title="Patient"
    actions={<button type="button">Edit patient</button>}
    validationIssues={[
      { severity: "error", message: "Date of birth is required." },
      { severity: "warning", message: "Confirm the mailing address." },
    ]}
  >
    <p>Patient fields and existing editing controls go here.</p>
  </BillDetailSection>
</BillDetailLayout>
```

Errors use a red section border and labeled messages; warnings use amber. Both remain
visible when a section has both severities. The host supplies validation results; these
components do not run billing validation or determine whether submission is allowed.

`BillDetailLayout` accepts optional `header`, `actions`, `sidebar`, `className`, and
`style`, plus `children`. The sidebar moves below the detail sections on narrow screens.
`BillDetailSection` accepts `title`, optional `description`, `actions`, `validationIssues`,
`id`, `className`, `headerClassName`, `bodyClassName`, and `style`, plus `children`.
Supplying a header or body class replaces that area's default padding class so native
applications can preserve their compact spacing. Styles are injected automatically.

## Ready-made details

`BillReadOnlyForm.validationIssues` maps section keys (`patient`, `claim`, `providers`,
`services`, `attachments`) to arrays of `{ severity: "error" | "warning", message: string }`.
Messages appear beside the affected section without changing the supplied bill data.

Both `BillReadOnlyForm` and `ConnectedBillLifecycle` accept these optional callbacks:

| Prop | Callback value |
| --- | --- |
| `onPatientClick` | The displayed patient, with optional canonical `id` |
| `onRenderingProviderClick` | The displayed rendering provider, with optional canonical `id` |
| `onClaimsAdministratorClick` | `{ id?: string, name: string }` |

Names become buttons when the corresponding callback is supplied. Your application can
navigate to a profile or select a dashboard filter using an available canonical ID.
Legacy or historical data may omit IDs; do not infer an identity from a display name.
The administrator's separate **Contact details** button still opens the directory details.
Without navigation callbacks, existing detail behavior remains available.
