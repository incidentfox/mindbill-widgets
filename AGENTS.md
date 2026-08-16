# MindBill public SDK agent guide

This repository is intentionally public. Treat every commit, test fixture, issue, and CI log as public forever.

## Hard boundaries

- Never add PHI, real claims, patient names, payer portal data, credentials, API keys, payment details, internal hostnames, private schemas, or code copied from the private MindBill application.
- Use synthetic fixtures only. Values such as organization and bill IDs must be obviously fake.
- Browser code must never receive a long-lived MindBill API key. Mint short-lived, origin-bound embed sessions on a trusted server.
- Never collect card numbers. Live access and billing changes must redirect a human to the Stripe-hosted URL returned by MindBill.
- Do not weaken exact-origin checks, iframe sandboxing, token redaction, or mandatory “Powered by MindBill” attribution.
- Autofill is not a self-serve product. `bill-from-report` is available only by written agreement.

## Development

Use Node 20+ and pnpm. Run `pnpm check` before opening a pull request. Keep packages dependency-light and browser APIs SSR-safe. Public API changes require tests and corresponding updates in `README.md` and `docs/`.

Agents may create a synthetic sandbox using `pnpm dlx @mindbill/node signup`, but must save the one-time key to a gitignored file. An agent may request a Stripe Checkout URL; only a human may open it and provide payment information.
