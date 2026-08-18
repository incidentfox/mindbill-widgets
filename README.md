# MindBill SDKs and widgets

Public, dependency-light building blocks for adding California workers’ compensation medical-legal billing to another product. Use the Node SDK for server-to-server API calls and short-lived embed sessions; use the web component or React package for user-facing workflows.

> Sandbox data must be synthetic. Never send PHI until your organization is approved for live access and the required agreements are complete.

All three packages are published publicly on npm with provenance from this repository.

## Packages

| Package | Use |
| --- | --- |
| `@mindbill/node` | Typed Node client plus the `mindbill` agent-friendly CLI |
| `@mindbill/embed` | Framework-neutral custom elements |
| `@mindbill/react` | React wrappers around the custom elements |

## Fastest safe start

An agent can create a free sandbox without handling billing details:

```bash
pnpm dlx @mindbill/node signup \
  --company "Acme Integration Lab" \
  --contact "Avery Agent" \
  --email "developers@example.com" \
  --accept-terms
```

The one-time sandbox key is written to `.env.mindbill` with owner-only permissions and is not printed. Add that file to your project’s `.gitignore`. The command returns only identifiers, the key prefix, and the saved path.

Use the SDK on your server:

```ts
import { MindBillClient } from "@mindbill/node";

const mindbill = new MindBillClient({
  apiKey: process.env.MINDBILL_API_KEY!,
  ...(process.env.MINDBILL_ORG_ID
    ? { organizationId: process.env.MINDBILL_ORG_ID }
    : {}),
});

// Default: provision a customer tenant without a MindBill user, invitation,
// or separate customer onboarding flow.
const customer = await mindbill.provisionOrganization(
  { name: "Synthetic QME Practice" },
  crypto.randomUUID(),
);

const session = await mindbill.createEmbedSession({
  component: "bill-timeline",
  billId: "synthetic_bill_123",
  allowedOrigin: "https://your-product.example",
  expiresIn: 900,
});
```

Return only `token` and `embedUrl` from your own authenticated backend. Render:

```html
<script type="module" src="https://unpkg.com/@mindbill/embed@0.2.0/dist/index.js"></script>
<mindbill-bill-timeline
  session-token="SHORT_LIVED_SESSION_TOKEN"
  embed-url="https://app.mindbill.org/embed/bill-timeline"
  theme="system"
  accent-color="#2563eb"
></mindbill-bill-timeline>
```

For React:

```tsx
import { MindBillBillTimeline } from "@mindbill/react";

<MindBillBillTimeline
  sessionToken={session.token}
  embedUrl={session.embedUrl}
  appearance={{ theme: "system", accentColor: "#2563eb" }}
  onMindBill={(event) => console.log(event.detail.event)}
/>;
```

The widget sends only documented, PHI-free lifecycle events to its host. Keep the API key and embed-session creation on your server.

## Partner-managed customer accounts

`provisionOrganization` defaults to `accessMode: "managed"`. Your product can configure the tenant, create and submit bills, and render MindBill widgets without asking the customer to accept a MindBill invitation or sign into a second application. If a customer later wants direct access to MindBill, call `grantOrganizationUserAccess` as an explicit, auditable action.

Keep workflow and customer-facing data in your product. Treat MindBill as authoritative for bill IDs, submissions, acknowledgements, payments, denials, and ordered event sequences. Sync those documented fields with signed webhooks plus cursor reconciliation; undocumented MindBill data is not exposed by the Partner API.

## From sandbox to live

Live access requires organization onboarding, BAA acceptance, and payment setup. The CLI can request a short-lived Stripe-hosted Checkout URL:

```bash
pnpm dlx @mindbill/node live-access --organization-id org_example
```

Give that URL to an authorized human. Neither this CLI nor your coding agent accepts card numbers, Link credentials, or payment-method data. See [go-live](./docs/go-live.md).

## Documentation

- [Agent-first onboarding](./docs/agent-onboarding.md)
- [Widget integration and customization](./docs/widgets.md)
- [API keys and security](./docs/security.md)
- [Go-live and hosted payments](./docs/go-live.md)
- [Billing lifecycle/domain guide](./docs/domain-guide.md)
- [Examples](./examples)
- [Hosted API reference](https://app.mindbill.org/developers/reference)
- [OpenAPI document](https://app.mindbill.org/partner-openapi.yaml)

Self-serve pricing is $10 per bill. Volume and partner programs are contact-sales. Report autofill is rails-exclusive and available only through a negotiated agreement.

## Support

Open a GitHub issue for public SDK bugs without PHI or credentials. For security reports, production onboarding, autofill, or volume terms, contact MindBill through the developer portal.

## License

MIT. “MindBill” and related marks are trademarks of IncidentFox, Inc.; the license does not grant trademark rights.
