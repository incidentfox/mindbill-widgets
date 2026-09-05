# Shared API URLs

The React components use the same `/partner/v2` business APIs as server integrations. The browser SDK still accepts only short-lived browser sessions; this change does not add an API-key option to browser clients. A session must match the exact requesting origin and carry the permission needed for each operation. Organization and bill restrictions still apply.

| SDK operation | Canonical endpoint |
| --- | --- |
| Submit a complete bill | `POST /partner/v2/bills` |
| List dashboard bills and totals | `GET /partner/v2/bill-dashboard` |
| Search claims administrators | `GET /partner/v2/claims-administrators` |
| Read a bill lifecycle | `GET /partner/v2/bills/{billId}/lifecycle` |
| Read saved bill-entry choices | `GET /partner/v2/organization/billing-profile` |

Other business URLs drop the `/browser` segment. The old URLs remain compatible for installed SDK versions. The dashboard retains its page/pageSize response; the cursor-based `GET /partner/v2/bills` retains its own contract, available with either authentication method.

Mint sessions with `POST /partner/v2/browser-sessions` from your trusted server. Session issuance and key management do not accept browser tokens. Preserve host authentication, tenant mapping, role checks, and origin validation in your session endpoint.

Deploy the unified API before publishing or consuming this SDK version. No application code changes are required when upgrading the browser clients.
