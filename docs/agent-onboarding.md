# Agent-first onboarding

This flow is designed so a coding agent can build a complete synthetic-data integration while humans retain control over legal acceptance and payment.

## 1. Create a sandbox

```bash
pnpm dlx @mindbill/node signup \
  --company "Example Integration Lab" \
  --contact "Integration Owner" \
  --email "developer@example.com" \
  --accept-terms \
  --output-env .env.mindbill
```

Before passing `--accept-terms`, the account owner should review the current terms linked by the developer portal. The CLI sends the published terms version and never fabricates consent. It saves the one-time key with mode `0600`, refuses to overwrite a file, and prints no secret.

## 2. Keep the key server-side

Add `.env.mindbill` to `.gitignore`. Load `MINDBILL_API_KEY` only in a server process or secret manager. Never put it in a browser bundle, mobile application, prompt, issue, CI log, analytics event, URL, or screenshot.

## 3. Build with synthetic data

Use invented names, claim numbers, bill IDs, and attachments in sandbox. Do not copy a production payload and “anonymize” it; create a fixture from scratch.

```bash
pnpm dlx @mindbill/node account
pnpm dlx @mindbill/node embed-session \
  --component onboarding \
  --allowed-origin https://localhost.example
```

The second command writes the short-lived session response to stdout. Treat the returned token as transient and do not persist it.
The API key used by that command must include `embed:write`.

## 4. Integrate a widget

Create embed sessions inside your authenticated backend, scoped to the current user and exact HTTPS origin. Forward the returned session token to the browser over your existing authenticated channel. Render `@mindbill/embed` or `@mindbill/react` and handle only documented events.

## 5. Request live access

An authorized human completes organization onboarding and the BAA. An agent can then request a Stripe-hosted URL:

```bash
pnpm dlx @mindbill/node live-access --organization-id org_example
```

The command does not accept card flags or stdin payment details. Send the URL to the authorized human, who completes Stripe Checkout/Link in a browser. After approval, mint an organization-bound live key and store it in a real secret manager.

## Agent completion checklist

- `pnpm check` succeeds.
- No production data or API key appears in source, git history, test output, screenshots, or issues.
- Browser code contains only a short-lived embed token.
- `allowedOrigin` is an exact HTTPS origin with no path.
- “Powered by MindBill” remains visible.
- Payment is handed to a human on Stripe-hosted pages.
- Live credentials are organization-bound and least-privileged.
