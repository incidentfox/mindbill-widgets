# Widgets

MindBill widgets are origin-bound iframe applications exposed through SSR-safe custom elements. They provide a plug-and-play path without giving the browser a long-lived Partner API key.

They are intended to make billing feel native to the host product. Keep the partner's
navigation, identity, permissions, and source workflow in place; render only the MindBill
billing surface at the point of action. A customer can complete onboarding, review a bill,
and follow payment or denial status without moving to a second application.

## Available components

| Element                       | Component          | Purpose                                                                                    | Notes                               |
| ----------------------------- | ------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------- |
| `<mindbill-bill-timeline>`    | `bill-timeline`    | Status, acknowledgements, EORs, denials, appeals, payments                                 | Session requires `billId`           |
| `<mindbill-bill-review>`      | `bill-review`      | Review and correct a draft bill, manage its billing packet, then choose a submission route | Session requires `billId`           |
| `<mindbill-collections>`      | `collections`      | AR and collections work queue                                                              | Subject to credential scopes        |
| `<mindbill-onboarding>`       | `onboarding`       | Practice, provider, location, signature, and billing setup                                 | Intended for an authenticated admin |
| `<mindbill-bill-from-report>` | `bill-from-report` | Create a draft bill from a report                                                          | Contract-only; not self-serve       |

For record-summary and report-generation products, the recommended sequence is:

1. Finalize the source document and lock its page count.
2. Create the draft through the Partner API, including stable external IDs and source
   documents already available in the partner workflow.
3. Create an origin-bound `bill-review` session for the resulting `billId`.
4. Let the user confirm suggested codes, units, provider, payer, and attachments in place;
   the hosted widget saves and submits through MindBill's billing engine.
5. Render `bill-timeline` on the source record and reconcile signed events server-side.

The host should pass only the data required for billing. Widget lifecycle events contain
documented opaque identifiers and statuses; they do not expose MindBill's proprietary
routing rules, payer intelligence, internal notes, or operational queues.

## Rendered examples

The screenshots below come from the hosted production widget routes using
synthetic data. They show the interface that appears inside the iframe; the host
application keeps its own navigation, page chrome, and authorization model.

| Bill timeline                                                                                                       | Bill from report                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Bill timeline widget with charges, paid amount, balance, and processing state](./images/widget-bill-timeline.png) | ![Bill-from-report widget with extracted fields, service-line suggestions, and billing configuration](./images/widget-bill-from-report.png) |
| **Collections**                                                                                                     | **Onboarding**                                                                                                                              |
| ![Collections widget with aging, balances, status, and EOR state](./images/widget-collections.png)                  | ![Onboarding widget with practice, provider, and location configuration](./images/widget-onboarding.png)                                    |

Widget content reflows within the space supplied by the host. These two narrow
captures show the same production surfaces without a separate mobile SDK:

<p align="center">
  <img src="./images/widget-bill-timeline-mobile.png" alt="Bill timeline widget in a narrow mobile host" width="330" />
  &nbsp;&nbsp;
  <img src="./images/widget-bill-from-report-mobile.png" alt="Bill-from-report widget in a narrow mobile host" width="330" />
</p>

## Secure server flow

1. Your authenticated browser asks your backend for a widget session.
2. Your backend authorizes the user and calls `POST /partner/v1/embed/sessions` with its API key.
3. MindBill returns a short-lived token and canonical `embedUrl`.
4. Your backend returns only those transient values to the browser.
5. The custom element transfers the token with `postMessage` after iframe load. Tokens never enter query strings.

`allowedOrigin` must exactly match the embedding page’s HTTPS origin. Generate a new session for each widget load; do not cache or reuse it.

## Appearance

All elements accept:

- `theme="light|dark|system"`
- `accent-color="#2563eb"` (any valid CSS color)
- `locale="en-US"`
- normal `class` and `style` attributes for the host element’s size

The React wrappers accept the equivalent `appearance` object. Appearance values are data passed to the hosted surface, not arbitrary CSS injected into the iframe. Product identity and required attribution cannot be removed or obscured.

```css
mindbill-collections {
  display: block;
  width: 100%;
  min-height: 720px;
  border-radius: 12px;
  overflow: clip;
}
```

## Events

Listen for the `mindbill` custom event:

```js
document
  .querySelector("mindbill-bill-timeline")
  .addEventListener("mindbill", ({ detail }) => {
    if (detail.event === "bill.updated") refreshLocalSummary();
  });
```

The SDK accepts messages only from the rendered iframe window and its exact origin, validates the envelope, and emits a small documented payload: `component`, `event`, and optional opaque `billId`/`status`. Never use event data as authorization; refetch sensitive state on your server.

The bill-review widget emits `bill.updated`, `attachment.added`, `attachment.removed`, and
`bill.submitted`. Use these only as refresh hints; refetch authoritative state server-side.

## Content Security Policy

Allow the exact `embedUrl` origin in `frame-src`. Do not use a wildcard. A typical policy adds:

```text
frame-src https://app.mindbill.org;
```

The iframe uses `sandbox="allow-scripts allow-same-origin allow-downloads"` and `referrerpolicy="no-referrer"`. Changing those controls is unsupported.

## Accessibility and errors

Each iframe has a descriptive title. Give the host enough height for keyboard and zoom users. The element emits `mindbill-error` when required configuration is invalid; show a retry path and avoid exposing the raw error to analytics if it could reveal integration details.
