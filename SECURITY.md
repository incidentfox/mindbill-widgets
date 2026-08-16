# Security

Please do not open a public issue for a vulnerability or include patient data, credentials, or production payloads in any report. Email `security@mindbill.org` with a minimal, redacted reproduction.

Long-lived API keys belong only on trusted servers. Widget sessions are single-purpose, short-lived, and bound to an exact HTTPS origin. Card data is entered only into Stripe-hosted Checkout or Customer Portal pages.
