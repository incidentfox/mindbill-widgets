# Widgets

MindBill widgets are origin-bound iframe applications exposed through SSR-safe custom elements. They provide a plug-and-play path without giving the browser a long-lived Partner API key.

## Available components

| Element | Component | Purpose | Notes |
| --- | --- | --- | --- |
| `<mindbill-bill-timeline>` | `bill-timeline` | Status, acknowledgements, EORs, denials, appeals, payments | Session requires `billId` |
| `<mindbill-collections>` | `collections` | AR and collections work queue | Subject to credential scopes |
| `<mindbill-onboarding>` | `onboarding` | Practice, provider, location, signature, and billing setup | Intended for an authenticated admin |
| `<mindbill-bill-from-report>` | `bill-from-report` | Create a draft bill from a report | Contract-only; not self-serve |

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
document.querySelector("mindbill-bill-timeline")
  .addEventListener("mindbill", ({ detail }) => {
    if (detail.event === "bill.updated") refreshLocalSummary();
  });
```

The SDK accepts messages only from the rendered iframe window and its exact origin, validates the envelope, and emits a small documented payload: `component`, `event`, and optional opaque `billId`/`status`. Never use event data as authorization; refetch sensitive state on your server.

## Content Security Policy

Allow the exact `embedUrl` origin in `frame-src`. Do not use a wildcard. A typical policy adds:

```text
frame-src https://app.mindbill.org;
```

The iframe uses `sandbox="allow-scripts allow-same-origin allow-downloads"` and `referrerpolicy="no-referrer"`. Changing those controls is unsupported.

## Accessibility and errors

Each iframe has a descriptive title. Give the host enough height for keyboard and zoom users. The element emits `mindbill-error` when required configuration is invalid; show a retry path and avoid exposing the raw error to analytics if it could reveal integration details.
