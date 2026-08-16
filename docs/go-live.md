# Go live

Sandbox signup is automatic and free. Live access is intentionally gated because live workers’ compensation billing can include protected health information and financial workflows.

## Requirements

1. Complete the organization’s legal name, billing/rendering providers, NPI/TIN, locations/place-of-service, billing address, authorized users, and signature configuration.
2. Have an authorized person accept the current BAA in the hosted developer portal.
3. Request live access for the onboarded organization.
4. Have an authorized human complete the returned Stripe-hosted Checkout/Link flow.
5. Wait for approval, then mint an organization-bound live key with least-privilege scopes.

## Hosted payment boundary

```bash
mindbill live-access --organization-id org_example
```

The response includes a short-lived Stripe URL. The CLI prints the URL but has no card-number, expiration, CVC, bank-account, or Link-authentication inputs. Agents must not automate the hosted payment page or ask a person to paste payment data into a terminal or chat.

After initial setup, `mindbill billing-portal` returns a Stripe Customer Portal URL for a human to manage payment methods.

Self-serve is $10 per bill. Volume pricing, reseller terms, co-selling, custom scopes, and report autofill require a negotiated agreement.

## Production checklist

- BAA and organization onboarding show complete.
- Live key is fixed to the intended organization and stored in a secret manager.
- IP allowlist and rate limits match the deployment.
- Webhooks are signature-verified, durable, idempotent, and monitored.
- API idempotency keys persist across retries.
- Widget CSP and exact-origin rules work in the production domain.
- Rejection, denial, appeal/IBR, payment, and AR paths have been tested—not only bill submission.
