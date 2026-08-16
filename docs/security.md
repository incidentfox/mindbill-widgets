# API keys and security

## Credential model

- Sandbox keys begin with `mbp_sandbox_` and are for synthetic data only.
- Live keys begin with `mbp_live_`, are approved, and should be bound to one organization.
- Embed session tokens begin with `mbes_`, expire quickly, and are bound to one origin and component.

Use the minimum scopes, separate credentials per deployed service, apply an IP allowlist where practical, and rotate credentials after staff or infrastructure changes. The API returns a key once; MindBill stores only a verifier.

## Storage

Use AWS Secrets Manager, a comparable secret manager, or encrypted deployment secrets. Local `.env.mindbill` is for sandbox development only and is created mode `0600`. Do not store secrets in `NEXT_PUBLIC_*`, `VITE_*`, mobile bundles, localStorage, logs, traces, prompts, or source control.

## Web security

Mint embed sessions only after your own user authentication and authorization. Use an exact HTTPS `allowedOrigin`, issue one session per page load, and transfer tokens in the message body rather than a URL. The SDK verifies both `event.source` and `event.origin`.

Webhook signatures must be verified against the raw request body before JSON parsing. Deduplicate events by ID and process ordered lifecycle changes idempotently. See the hosted API reference for the current signature format.

## Incident response

Revoke a suspected credential in the developer portal, remove it from runtime configuration, rotate dependent secrets, and review redacted audit metadata. Never send the exposed secret itself to support.
