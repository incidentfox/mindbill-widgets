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

Text and date drafts are applied by **Search** or Enter. Status, A/R age, and
rendering-provider selections apply immediately. The server searches the full
authorized bill collection before pagination; it never searches only the
currently displayed page. Existing organization, environment, and customer
restrictions still apply.

```tsx
import { ConnectedBillSearch } from "@mindbill/react";

<ConnectedBillSearch
  sessionEndpoint="/api/mindbill/session"
  initialQuery={{
    q: "Northstar accepted",
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
