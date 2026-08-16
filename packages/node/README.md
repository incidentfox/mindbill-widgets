# @mindbill/node

Dependency-free Node 20+ SDK and an agent-safe CLI for the MindBill Partner API.

> **Publication pending:** `@mindbill/node` is not yet available from npm. The import and `pnpm dlx` commands below document the post-publication interface and currently return 404. Clone the [source repository](https://github.com/incidentfox/mindbill-widgets) to evaluate it locally, or use the [hosted developer portal](https://app.mindbill.org/developers) for account activation.

```ts
import { MindBillClient } from "@mindbill/node";

const mindbill = new MindBillClient({
  apiKey: process.env.MINDBILL_API_KEY!,
  ...(process.env.MINDBILL_ORG_ID
    ? { organizationId: process.env.MINDBILL_ORG_ID }
    : {}),
});
```

Create a synthetic sandbox without printing the returned key:

```bash
pnpm dlx @mindbill/node signup \
  --company "Example Integration Lab" \
  --contact "Integration Owner" \
  --email "developer@example.com" \
  --accept-terms
```

The key is written to `.env.mindbill` mode `0600`. Live-access and billing commands return Stripe-hosted URLs for an authorized human; the CLI never accepts card data. See the [agent onboarding guide](https://github.com/incidentfox/mindbill-widgets/blob/main/docs/agent-onboarding.md).
