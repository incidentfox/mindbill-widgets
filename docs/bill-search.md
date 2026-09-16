# Bill search

`BillingDashboard`, `ConnectedBillSearch`, and the Bills tab of
`ConnectedBillingWorkspace` search patient names, claims-administrator names,
bill numbers and IDs, external IDs, claim numbers, statuses, procedure codes,
and dates. Search is case-insensitive. Every space-separated word must match
somewhere in the bill: `Alex Northstar` can match a patient named Alex and a
claims administrator named Northstar. Punctuation is literal, not a regular
expression. Dates accept `MM/DD/YYYY`, `M/D/YYYY`, or `YYYY-MM-DD`.

Use **Date type**, **From date**, and **Through date** for an inclusive service
or submission date range. A missing bound leaves that side open; bills without
the selected date are excluded when a bound is present. An inverted range shows
an error and cannot be submitted. **Clear filters** resets text, dates, status,
and other active bill filters, and returns to the first page.

## Connected search

Text and date drafts are applied by **Search** or Enter. Status, A/R age, patient,
claims-administrator, and rendering-provider selections apply immediately. The server searches the full
authorized bill collection before pagination; it never searches only the
currently displayed page. Existing organization, environment, and customer
restrictions still apply.

```tsx
import { ConnectedBillSearch } from "@mindbill/react";

<ConnectedBillSearch
  sessionEndpoint="/api/mindbill/session"
  initialQuery={{
    q: "Northstar accepted",
    patientId: "synthetic-patient-id",
    claimsAdministrator: "synthetic-administrator-id",
    renderingProviderId: "synthetic-provider-id",
    dateField: "service",
    from: "2026-08-01",
    to: "2026-08-31",
  }}
/>;
```

`BillRegistryQuery` forwards `q`, `dateField: "service" | "submitted"`,
`from`, and `to` to `GET /partner/v2/bill-dashboard`. Bounds use ISO calendar
dates (`YYYY-MM-DD`); omitted `dateField` means submission date. The API rejects
invalid dates and inverted ranges. New searches reset pagination and preserve
other selected filters.

Entity selectors use the complete scoped `filters.patients`,
`filters.claimsAdministrators`, and `filters.renderingProviders` inventories returned
by the API, each containing `{ id, name }` records. They do not infer options from
the current page. `patientId` and `renderingProviderId` use those stable IDs; the
`claimsAdministrator` query property is sent as `claimsAdminId`. Matching names do
not merge distinct IDs. Entity selections combine with text, date, status, and age
filters. A selected ID remains visible if it no longer appears in the inventory.

## Host-supplied bills

`BillingDashboard` filters the `bills` array supplied by the host immediately as
controls change. It does not fetch additional bills. Supply `dateOfService` to
enable service-date searching and filtering, `submittedAt` for submission-date
filtering, and `procedureCodes` to search codes. The optional `updatedAt` field is
also searchable. Dates use their recorded calendar day, without conversion to
the viewer's time zone. `payerName` is the claims-administrator search field.

Status search includes raw states (such as `accepted_no_response`) and display
labels. `response overdue` also finds that accepted-without-response state.
`initialSearch` prepopulates the search field. `hideFilters` hides search and
filter controls for host-managed views.

The patient, rendering-provider, and claims-administrator selectors use all supplied
bills as their option inventory. Supply optional `patientId`, `renderingProviderId`,
and `claimsAdministratorId` to distinguish records with identical names, and
`renderingProviderName` for the doctor label and text search. Without an ID, the
static dashboard groups that entity by its display name. Selectors without any
entity information are omitted. All three selectors combine with the other filters.

## Navigate from bill details

`ConnectedBillingWorkspace` links patient, rendering provider and claims administrator names to all bills filtered by their canonical entity ID. Each navigation resets pagination and prior filters. Historical snapshots without a canonical ID show plain text instead of an inactive navigation button. Claims administrator contact details remain available.

Hosts can override `onPatientClick`, `onRenderingProviderClick` and `onClaimsAdministratorClick` for their own record pages. These callbacks receive the complete public entity object, including its optional ID. Hosts decide how to handle older snapshots without an ID. The lower-level `BillReadOnlyForm` and `ConnectedBillLifecycle` also accept these callbacks; their optional `requireLinkedEntityIds` flags suppress navigation for missing IDs when desired.
