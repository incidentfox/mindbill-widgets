# Claim RFA index, related records and bill UR decisions

`@mindbill/react` exports three components that surround the RFA workflow, and `@mindbill/browser`
exports `createRfaRecordsClient` for the same endpoints. All three use short-lived, origin-bound browser
sessions (`sessionEndpoint` or `getSession`); keep permanent API keys on your server. The workspace must
have treatment billing enabled. Each component also accepts a host loader instead of a session, so a host
can serve the same data from its own backend.

## `RfaClaimIndex`

Every request for authorization on one claim: treatment counts (Incomplete, No response, Approved,
Modified, Denied), an RFAs tab and a Requested treatments tab, sortable columns, and an Add RFA action.

```tsx
<RfaClaimIndex
  claimId={claimId}
  canCreate
  sessionEndpoint="/api/mindbill/session"
  getRfaHref={(rfaId, context) => `/rfas/${rfaId}${context?.treatmentId ? `?treatmentId=${context.treatmentId}` : ""}`}
  createHref={`/rfas/new?claimId=${claimId}`}
  getPhysicianHref={providerId => `/providers/${providerId}`}
/>
```

| Prop | Purpose |
|---|---|
| `claimId` | The claim whose requests are listed. |
| `canCreate` | Shows Add RFA (with `createHref` and/or `onCreateRfa`). |
| `loadRfas(claimId)` | Host loader returning `ClaimRfaSummary[]`. Default: `GET /partner/v2/rfas?claimId=` (all pages). |
| `initialRfas` | Rows the host already loaded; refreshed after mount. |
| `getRfaHref(id, { treatmentId })`, `onSelectRfa` | Row and reference navigation. A plain click calls `onSelectRfa` when given. |
| `getPhysicianHref(providerId)` | Optional link for the requesting physician. |
| `id` | Section element id for deep links (default `rfas`). |

Unsent requests count once as Incomplete and show "Not sent" per treatment; canceled requests are not
counted. A treatment closed as no longer requiring a decision shows "Not required".

## `RelatedAuthorizationRecords`

Bills on the same claim as an RFA (`rfaId`), or RFAs on the same claim as a bill (`billId`). Records
where a bill line uses one of the request's approved treatments ("Linked authorization") are listed first;
other records for the injury are folded below. On an RFA page an empty list renders nothing.

Props: `rfaId` or `billId`, `load` (host loader), `initial`, `getBillHref`, `getRfaHref`, `onSelectBill`,
`onSelectRfa`, `getClaimHref`, and `renderClaimActions(claimId)` for claim-level actions such as a case file
export. Default endpoint: `GET /partner/v2/rfas/related?rfaId=|billId=`.

## `BillUrDecisions`

Authorizations for a bill: the signed RFA and UR decision for each authorization linked to a service line
(with the reason when one could not be attached), and every other utilization review decision on the
bill's patient and claim. While the bill is unsent and `canEdit` is set, a biller can select decisions and
attach them, or retry the linked attachments ("Attach now"). Attaching copies documents onto the bill;
nothing is sent.

Props: `billId`, `canEdit`, `load`/`attach` (host transport), `openDocument` (letter viewer; by default the
letter is fetched through the browser session when no host loader is given), `getRfaHref`, `onSelectRfa`,
and `onAttached(result, kind)` to refresh your bill's document list. Default endpoints:
`GET|POST /partner/v2/bills/{billId}/ur-decisions` and `GET /partner/v2/rfas/{rfaId}/documents/{documentId}`.
The component renders nothing when there are no decisions or linked authorizations.

## Browser client

```ts
import { createRfaRecordsClient } from "@mindbill/browser";
const records = createRfaRecordsClient({ sessionEndpoint: "/api/mindbill/session" });
await records.listClaimRfas(claimId);
await records.listRelated({ billId });
await records.listBillUrDecisions(billId);
await records.attachBillUrDecisions(billId, { documentIds: [documentId] });
```

`claimRfaSummary(rfa)` projects a full `RfaRecord` onto the `ClaimRfaSummary` the index renders.

Visual check: `node scripts/verify-rfa-records.mjs` (synthetic data, 1440 and 390 widths).
