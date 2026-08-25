# Partner API quick reference

Base URL: `https://app.mindbill.org/partner/v1`

Use `Authorization: Bearer $MINDBILL_API_KEY` on every request except developer signup. If a key can access multiple organizations, also send `X-MindBill-Org-Id`. Send an `Idempotency-Key` on creates and submissions so retries cannot duplicate work.

| Method  | Route                               | Purpose                                                                    |
| ------- | ----------------------------------- | -------------------------------------------------------------------------- |
| `POST`  | `/developer/signup`                 | Create a sandbox developer account and one-time key                        |
| `GET`   | `/developer/account`                | Read account, terms, BAA, billing, and live-access state                   |
| `PATCH` | `/developer/account`                | Configure IP allowlist and rate limit                                      |
| `POST`  | `/developer/account/baa`            | Accept the current BAA                                                     |
| `POST`  | `/developer/account/live-access`    | Request live access and receive a Stripe-hosted Checkout URL               |
| `POST`  | `/developer/account/billing-portal` | Receive a Stripe-hosted billing portal URL                                 |
| `POST`  | `/developer/account/keys`           | Mint a scoped sandbox or live key                                          |
| `POST`  | `/orgs`                             | Provision a managed customer organization without an invitation by default |
| `POST`  | `/orgs/:id/user-access`             | Optionally grant the customer direct MindBill access                       |
| `PUT`   | `/orgs/:id/source-profile`          | Synchronize partner-owned practice, provider, and location data            |
| `POST`  | `/quote`                            | Calculate a quote without creating a bill                                  |
| `POST`  | `/bills`                            | Create a bill                                                              |
| `GET`   | `/bills`                            | List bills using cursor pagination                                         |
| `GET`   | `/bills/:id`                        | Retrieve a bill and lifecycle state                                        |
| `POST`  | `/bills/:id/submit`                 | Submit a ready bill                                                        |
| `GET`   | `/events`                           | Poll ordered lifecycle events                                              |
| `GET`   | `/webhook-deliveries`               | Inspect webhook delivery attempts                                          |
| `POST`  | `/embed/sessions`                   | Mint a short-lived, origin-bound widget session                            |

## Partner-managed organizations

`POST /orgs` defaults to `{ "accessMode": "managed" }`. It creates a linked organization with no user, email invitation, activation token, or separate MindBill onboarding action. The partner can then configure the organization and run billing through server-side API calls and embedded components.

If a customer later wants to use the MindBill web application directly, `POST /orgs/:id/user-access` creates the first administrator and one-time activation flow. Do not call it during routine embedded onboarding.

The Partner API is deny-by-default: use only documented resources and fields. Keep case workflow data in the partner product, and treat MindBill as authoritative for billing lifecycle data. Consume signed webhooks in sequence and use `/events` reconciliation to recover missed deliveries.

## Distribution and data ownership

The default integration keeps the customer inside the partner product. Provision the
MindBill organization as part of the partner's onboarding, send a complete snapshot of
partner-owned practice data through `PUT /orgs/:id/source-profile`, and store MindBill
organization and bill IDs beside stable partner IDs. Do not match records by display name
or email domain.

MindBill does not become the source of truth for the partner's workflow. Conversely, a
partner should not copy or infer MindBill's internal billing operations. Signed webhooks
notify the partner of documented lifecycle changes; bill and event reads repair state after
downtime or ambiguity. Direct MindBill access is an optional customer capability, not a
requirement for embedded billing.

A record-summary integration normally creates the bill after a summary is finalized and
its page count is locked. The partner provides the report packet plus minimum claim,
provider, payer, and service context, then renders the `bill-review` widget for the created
bill. MindBill owns corrections made during review, submission, and downstream status.

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
