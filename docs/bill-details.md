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

`ConnectedBillLifecycle` automatically highlights missing fields and mapped rejection
issues on the current editable draft, incomplete, or rejected bill. It uses the same
validation rules as the correction form; paid bills and historical submissions do not
receive new required-field errors. An explicit `validationIssues` prop overrides these
defaults, including an empty object to suppress them.

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

## Compact bill view and documents

The default `mindbill` preset uses a warm neutral background and teal actions. Other
presets and explicit appearance overrides remain available. Bill information appears
first; patient and injury sections share a row on wide screens and stack on mobile.
Provider identifiers and addresses expand on demand without hiding validation messages.

`ConnectedBillLifecycle` keeps lifecycle actions in a sticky bottom bar after the
details or history content. On mobile, `--mb-host-bottom-offset` reserves space
for host navigation (72px by default), plus the safe-area inset. Document shortcuts
remain beside the header above the detail tabs.
`ConnectedBillingWorkspace` and `ConnectedBillLifecycle` accept the optional
`onOpenCms1500: (billId: string) => void` callback. When supplied, **View CMS-1500**
appears at the top for the current bill. The host must open its authorized preview;
this callback does not introduce a document endpoint or change submission status.
Historical attempts continue to use retained submission files, never the current form.

Click a service-line charge to inspect its calculation. `BillReviewLineItem.pricing.breakdown`
accepts an optional `BillLineFeeBreakdown` from the server:

```ts
{
  method: "Saved synthetic calculation",
  inputs: [{ label: "Base rate", value: "$10.00" }],
  steps: [{ label: "Allowed", value: "$10.00 × 2 = $20.00" }],
  notes: ["Synthetic example only"]
}
```

`method`, input/step labels and values, and notes are display-only text. Inputs and
steps retain their supplied order; the component does not parse the strings or
recompute rates, modifiers, allowances, or deadlines. Only supply a breakdown verified
against the saved line. Omit it for manual charges or stale/unverified calculations.
Total charge and fee-schedule amount still come from the saved numeric line fields.

Without a verified breakdown, the disclosure shows saved units, average charge per
unit, total, and recorded fee-schedule amount when provided. The average is arithmetic
from the saved charge; it is not represented as a base fee or modifier calculation.
Missing fee-schedule data stays unavailable. No present-day rate lookup alters
historical bills.

Submission ribbons also accept optional `outcomeLabel`, `outcomeAt`, `outcomeDateLabel`,
and `outcomeWorkingDays` fields on `BillAttemptSummary`. Supply authoritative values;
do not infer payment receipt from an EOR or calculate regulatory deadlines in the host.
