# SDK usage analytics

The MindBill SDK components report a small set of usage events so MindBill can see how the embedded billing
workflow is used (which steps partners reach, where validation fails, which delivery routes are chosen) and
which SDK versions are in production.

## Privacy guarantees

- Events never contain field values, names, dates, claim or bill numbers, free text, or file contents.
- Every field is a closed enum, a number, an anonymous random id, or a form **field path** such as
  `claim.dateOfInjury` (the path only, never its value). The client and the server both reject anything else.
- The per-tab id is random, kept in `sessionStorage`, and is not linked to a person.
- Partner, organization, environment and browser session are derived by MindBill from the short-lived browser
  session token; the browser does not send them.
- Sending never blocks the UI. Failures are dropped silently. Events wait (in memory, at most 200) until a
  component has used a browser session; analytics never mints a session of its own.

## Events

`component_mounted`, `form_viewed`, `autofill_started`, `autofill_completed`, `autofill_failed`,
`validation_failed`, `packet_preview_opened`, `packet_preview_failed`, `cms1500_preview_opened`,
`delivery_route_dialog_opened`, `route_selected`, `submit_clicked`, `submit_succeeded`, `submit_failed`,
`correction_opened`, `resubmit_succeeded`, `resubmit_failed`.

| Field | Meaning |
| --- | --- |
| `name` | One of the events above |
| `occurredAt` | ISO-8601 browser time |
| `component` | Component name, e.g. `BillSubmissionForm` |
| `sdkPackage`, `sdkVersion` | e.g. `@mindbill/react`, `0.87.0` |
| `tabSessionId` | Anonymous per-tab id |
| `durationMs` | Optional duration (for example autofill) |
| `route` | Optional `ebill`, `fax`, `email` or `mail` |
| `errorCode` | Optional machine code, lowercase `a-z0-9_` |
| `fieldPaths` | Optional field paths that failed validation (at most 40) |
| `billingMode` | Optional `med_legal` or `professional` |

Events are batched and sent with `fetch(..., { keepalive: true })` to
`POST /partner/v2/browser/analytics` using the browser session's bearer token.

## Opting out and receiving events

React components accept `analytics` and `onAnalyticsEvent`:

```tsx
<BillSubmissionForm analytics={false} onAnalyticsEvent={(event) => myAnalytics.track(event.name, event)} … />
```

`analytics={false}` stops sending to MindBill; `onAnalyticsEvent` still receives each event. Angular's
`<mindbill-bill-submission>` has the same `[analytics]` input and `(analyticsEvent)` output. Custom layouts can
use `useMindBillAnalytics(componentName, { analytics, onAnalyticsEvent })` from `@mindbill/react` or
`trackMindBillAnalyticsEvent` from `@mindbill/browser`.

## SDK version header

Requests from the browser clients to MindBill (a `mindbill.org` host or your own origin, authenticated with a
browser session) carry `X-MindBill-SDK`, for example `@mindbill/browser/0.56.0 @mindbill/react/0.87.0`. Requests
to your session endpoint and to other origins are unchanged. The header is first sent on a read (GET) request;
if a MindBill server does not accept it (an older deployment), that read is retried without it and the header is
not sent to that origin again, so an older server never blocks a request. API error responses surface as `MindBillApiError`
with `status` and, when the API returned one, a machine `code`.
