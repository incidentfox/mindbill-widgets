# Shared API URLs

The React components use the same `/partner/v2` business APIs as server integrations. The browser SDK still accepts only short-lived browser sessions; this change does not add an API-key option to browser clients. A session must match the exact requesting origin and carry the permission needed for each operation. Workspace, customer, and bill restrictions apply.

| SDK operation | Canonical endpoint |
| --- | --- |
| Submit a complete bill | `POST /partner/v2/bills` |
| List dashboard bills and totals | `GET /partner/v2/bill-dashboard` |
| Search claims administrators | `GET /partner/v2/claims-administrators` |
| Read a bill lifecycle | `GET /partner/v2/bills/{billId}/lifecycle` |
| Read saved bill-entry choices | `GET /partner/v2/organization/billing-profile` |

Other business URLs drop the `/browser` segment. The old URLs remain compatible for installed SDK versions. The dashboard retains its page/pageSize response; the cursor-based `GET /partner/v2/bills` retains its own contract, available with either authentication method.

Mint sessions with `POST /partner/v2/browser-sessions` from your trusted server. Session issuance and key management do not accept browser tokens. Preserve host authentication, customer/case authorization, role checks, and origin validation in your session endpoint. Use one server workspace key; default requests need no organization ID. Set `resource.customerExternalId` from trusted host customer records for customer collections and creation. Add `resource.billId` for an existing case bill; both restrictions apply when both are present. A customer token cannot read shared organization profiles or edit shared settings.

Deploy the unified API before publishing or consuming this SDK version. Existing explicit practice routing and bill-only tokens remain supported. Customer-scoped browser integrations should supply provider/location snapshots and W-9 attachments from authorized host data.

## Accepted bills with an overdue response

Status and lifecycle responses may return `state: "accepted"` together with `nativeStatus: "accepted_no_response"`. The native status means the server classified the applicable payer response deadline as passed without a recorded response. React displays **Accepted – No Response** and keeps the progress rail at **Accepted**; **Processed** remains upcoming. A subsequent processed or closed state takes precedence over stale native status detail.

`ConnectedBillStatus` forwards both fields automatically. Hosts rendering `BillStatusSummary` directly should pass `status={response.state}` and `nativeStatus={response.nativeStatus}`. `BillLifecycleProgress` likewise accepts both fields. Dashboard and status-aging matrix bill inputs use `state: "accepted_no_response"` for the separate row beside accepted bills. Preserve that server classification when adapting dashboard data; do not derive it from `agingDays` alone.
