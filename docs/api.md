# Partner API quick reference

Base URL: `https://app.mindbill.org/partner/v1`

Use `Authorization: Bearer $MINDBILL_API_KEY` on every request except developer signup. If a key can access multiple organizations, also send `X-MindBill-Org-Id`. Send an `Idempotency-Key` on creates and submissions so retries cannot duplicate work.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/developer/signup` | Create a sandbox developer account and one-time key |
| `GET` | `/developer/account` | Read account, terms, BAA, billing, and live-access state |
| `PATCH` | `/developer/account` | Configure IP allowlist and rate limit |
| `POST` | `/developer/account/baa` | Accept the current BAA |
| `POST` | `/developer/account/live-access` | Request live access and receive a Stripe-hosted Checkout URL |
| `POST` | `/developer/account/billing-portal` | Receive a Stripe-hosted billing portal URL |
| `POST` | `/developer/account/keys` | Mint a scoped sandbox or live key |
| `POST` | `/quote` | Calculate a quote without creating a bill |
| `POST` | `/bills` | Create a bill |
| `GET` | `/bills` | List bills using cursor pagination |
| `GET` | `/bills/:id` | Retrieve a bill and lifecycle state |
| `POST` | `/bills/:id/submit` | Submit a ready bill |
| `GET` | `/events` | Poll ordered lifecycle events |
| `GET` | `/webhook-deliveries` | Inspect webhook delivery attempts |
| `POST` | `/embed/sessions` | Mint a short-lived, origin-bound widget session |

Widget-session credentials require the `embed:write` scope. Available key scopes are
`account:read`, `account:write`, `keys:write`, `orgs:read`, `orgs:write`, `bills:read`,
`bills:write`, `bills:quote`, `bills:submit`, `events:read`, `settings:read`,
`settings:write`, and `embed:write`. Mint the smallest set needed by each server process.

## Billing request and response shapes

- `POST /quote` accepts `{ lineItems: ServiceLine[] }` and returns an extensible quote with
  `currency`, calculated `lineItems`, and `totalAllowed` when available. Use the dedicated
  `bills:quote` scope.
- `POST /bills` requires a `patient` reference and returns the identifiers directly as
  `{ patientId, injuryId, billId, billNumber }`; it does not wrap them in a `bill` property.
- `GET /bills/:id` returns `{ bill, multiple?, ids? }`. A `Bill` always has `id` and `status`,
  and can include `externalId`, a `total` money object, and additive fields. `Money.amount` is
  an integer number of cents and its currency is `USD`.
- `GET /bills` returns `{ bills, limit, offset, hasMore, nextCursor, truncated? }`. The first
  five properties are always present; `nextCursor` is `null` when no subsequent page exists.
- `POST /bills/:id/submit` accepts `{ route?: "ebill" | "fax" | "mail" | "email" }`. Sandbox
  submission returns HTTP `202` with `sandbox: true`, accepted `999`/`277CA` acknowledgments,
  a synthetic EOR/payment, and zero balance. Live submission returns HTTP `200` with the
  updated `bill` and delivery/transmission metadata. Treat either successful response as an
  accepted workflow step, not as payer proof, and tolerate additive response properties.

The Node SDK exports `QuoteRequest`, `Quote`, `CreateBillRequest`, `CreateBillResponse`,
`BillResponse`, `BillPage`, `SubmitBillRequest`, and the discriminated `SubmitBillResponse`
union for these shapes.

The complete, versioned OpenAPI document and interactive request examples are published in the [MindBill developer portal](https://app.mindbill.org/developers/reference). Treat the OpenAPI document as authoritative if this overview and a schema ever differ.

## Errors

Errors use `application/problem+json`. Log `status`, `type`, `title`, and the response's `X-Request-Id`; do not log report contents, attachments, patient data, API keys, or embed tokens.

## Payment boundary

The API and CLI never accept card numbers, CVCs, bank details, or Link credentials. Live-access and billing-portal endpoints return short-lived Stripe-hosted URLs. An authorized human completes those pages directly on Stripe.
