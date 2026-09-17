# @mindbill/browser

Framework-neutral client used by the React and Angular packages. It exchanges
your authenticated same-origin session for a short-lived, origin-bound token;
the Partner API key never reaches the browser.

```ts
import { createBillLifecycleClient } from "@mindbill/browser";

const billing = createBillLifecycleClient({
  billId: "bill_123",
  sessionEndpoint: "/api/mindbill/session",
});

const data = await billing.getLifecycle();
const packet = await billing.getPacket();

await billing.addNote({
  note: "Called bill review; EOR is still pending.",
  actorName: "Casey Biller",
});
```

The browser client loads immutable snapshots, server-owned activity history,
current lifecycle actions, EORs, and complete submission packets. It can execute
only actions authorized by MindBill, including Second Bill Review, payment
posting, close, and reopen. It also owns atomic browser submission, so the
partner server never receives bill payloads or attachment bytes.
The public lifecycle begins at `submitted`, then advances through `accepted`,
`processed`, and `closed`; it never exposes draft or queued states. The same
lifecycle client is safe to use from React, Angular, or plain JavaScript.

Pre-submission components can query canonical routing reference data without
inventing a draft bill:

```ts
import { createBillReferenceClient } from "@mindbill/browser";

const references = createBillReferenceClient({
  sessionEndpoint: "/api/mindbill/session",
});

const firstPayerPage = await references.listClaimsAdministrators({ limit: 50 });
const nextPayerPage = await references.listClaimsAdministrators({
  limit: 50,
  offset: firstPayerPage.nextOffset,
});
const payers = await references.searchClaimsAdministrators("Zurich", "claim-123");
const diagnoses = await references.searchDiagnosisCodes("left knee");
const firstAlphabeticalPage = await references.searchDiagnosisCodes("", 100, 0);
const nextAlphabeticalPage = await references.searchDiagnosisCodes("", 100, 100);
const place = await references.lookupPostalCode("94403");
```

`searchDiagnosisCodes(query, limit, offset)` supports directory browsing as well as search. Pass an empty query for ICD-10 code order; `limit` is capped at 100 and `offset` advances through the directory.

`listClaimsAdministrators({ query, claimNumber, limit, offset })` supports both
alphabetical browsing and search, returns `total` and `nextOffset`, and does not
impose a minimum query length. The legacy `searchClaimsAdministrators` method
remains as a results-only convenience wrapper.

Some claims administrators route bills through more than one payer. Results mark
them with `payerSelectionRequired: true` and list rich routing choices in `payers`:
aliases, affiliated entities, claim-number hints, route and delivery type,
clearinghouse, payer IDs, and the directory default marker are preserved.
Send the chosen entry as `bill.claim.claimsAdministrator.payerId` on the atomic
submission (the same optional `payerId` exists on `BillReviewSaveInput`);
administrators without subpayors are unchanged and need no `payerId`.
Interactive forms should require the user to choose a required routing payer;
`defaultBillReviewPayerOption(payer)` only reads the source catalog's default marker.

Submit a locally reviewed bill and its PDF attachments directly from the browser:

```ts
import { createBillSubmissionClient } from "@mindbill/browser";

const submission = createBillSubmissionClient({
  sessionEndpoint: "/api/mindbill/session",
});

const result = await submission.submitBill({
  bill,
  submission: { route: "ebill" },
  documents: [{
    filename: "final-report.pdf",
    documentType: "final_report",
    contentBase64: encodedPdf,
  }],
});

await linkBillId(result.billId);
```

The session endpoint is the only required partner-server integration with
MindBill. Keep the returned canonical `billId` locally for navigation and
webhook correlation; keep `bill.externalId` as the idempotency and partner
correlation key. The first persisted bill is still the submitted immutable
snapshot—there is no draft mutation API.

If a submission is rejected, keep that same canonical `billId`. A correction
creates another immutable submission attempt under the logical bill; it does
not create a new partner-visible bill. Send the complete corrected snapshot
and the documents that should accompany the new attempt:

```ts
await billing.resubmitBill({
  reason: "Corrected the rejected service date.",
  bill: correctedBill,
  documents: correctedDocuments,
  submission: { route: "fax", destination: "+14155550123" },
});
```

Pass `submission` after previewing the corrected claims administrator's routes
to make the resubmission channel explicit. Omitting it preserves the legacy
server-selected e-bill behavior. `getDeliveryPreview` accepts both
`claimsAdministratorId` and the selected subpayor `payerId`, so a correction
can be verified against a newly selected administrator or payer before it is
sent.

A **closed** bill authorizes exactly two actions: `reopen` and
`submit_new_bill`. "Submit New Bill" keeps the closed bill closed — its record
and close reason are preserved and it is never superseded — and creates a
fresh original bill linked to it, so the submissions timeline chains both
records. It accepts the same snapshot payload shape as a resubmission:

```ts
await billing.submitNewBill({
  reason: "Re-billing the service after the earlier bill was closed.",
  bill: newBillSnapshot,
  documents: newBillDocuments,
  submission: { route: "ebill" },
});
```

MindBill preserves the original attempt, rejection, corrected attempt, later
acknowledgements, EORs, and payments in one lifecycle. Each outbound attempt
gets the next patient-control-number suffix (`-1`, `-2`, `-3`, ...), while the
public `billId` remains stable. Rejection issues can include `fieldPaths`; use
them to call attention to implicated controls without treating the
clearinghouse response as a replacement for normal validation.

`data.attempts` identifies each immutable transmission with its own `id` and
also exposes the canonical `billId`. A bill can have more than one transmission
(for example the original and its Second Review), so use the attempt `id` for
selection and use `billId` only when addressing the bill resource. Notes added
with `addNote` are server-owned lifecycle activity and are returned to every
authorized partner session for that bill.

Pass `billId` for the submitted bill. An optional `resource: { billId }`
restriction makes the session usable for only that bill.

The package also ships a pure, presentation-free aggregation shared by the
React and Angular Bill Tasks dashboards:

```ts
import { buildBillTasksDashboard } from "@mindbill/browser";

const data = buildBillTasksDashboard(workItems, [
  { id: "payment_due", label: "Payment Due", agingBasisLabel: "Bill Sent Date", tone: "violet" },
  { id: "denials", label: "Denials", agingBasisLabel: "EOR Date", tone: "red" },
]);
```

`buildBillTasksDashboard` buckets flat work items by age in days
(1-30 / 31-60 / 61-90 / 91-180 / 181+, or custom buckets) into ordered
sections and first-seen-ordered rows with per-cell counts, click-through bill
refs, and section/grand totals. Sections render even when empty.

See the [10-minute quickstart](https://docs.mindbill.org/quickstart).

## RFA directory routing

Claims-administrator directory responses include optional authorization status, source observation, and separate fax/email/telephone fields. `rfaAuthorizationDestinations(directory)` returns eligible choices without automatically selecting a destination; `normalizeRfaFax(value)` validates manual fax input.

See the [RFA directory guide](https://github.com/incidentfox/mindbill-widgets/blob/main/docs/rfa-directory.md) for classification and unavailable-route handling.

## RFA creation choices

Use `createRfaClient(options).getCreationContext(query?)` for
building a draft from saved claims and rendering providers. It requires a trusted
server session with `rfas:create` and returns `{claims, renderingProviders,
nextCursor, renderingProvidersNextCursor}`. Search claims with `search` and physicians
with `providerSearch`; pass `cursor` and `providerCursor` for their independent next
pages. Reset each cursor when its search changes. Optional `claimId` and
`renderingProviderId` restrict choices; `limit` defaults to 50 and is capped at 100.
Claims include saved injury diagnosis codes when available. The lookup is read-only.
Creating, signing, and sending remain separate actions. An RFA belongs to a patient
and injury/claim; it does not require an existing bill.

`createRfaClient` also exposes `provisionClaim(input, {idempotencyKey})` to create or reuse
patients and injuries by stable external IDs without creating a bill, and
`searchClaimsAdministrators(query, claimNumber?)` for directory choices. Provisioning
requires `bills:create`; directory search requires `payers:read`.

`saveProviderSignature(providerId, {contentBase64, physicianAuthorized: true,
actorReference}, {idempotencyKey})` saves an authorized PNG for an active organization
physician. It requires both `rfas:sign` and `organization:manage` in an organization-wide
session. It does not sign or send an RFA. Draft creation and updates support independent
`writtenConfirmation`, per-item `diagnosisDescription`, and `requestingPractice` /
`authorizationContact` snapshots. Explicit `null` clears a snapshot.

## Reviewed RFA delivery

After signing and uploading supporting PDFs, call `prepareDelivery(id, {documentIds,
channel, to, message})`, where `channel` is `fax`, `email`, or `download` and `to` is
omitted for download. The response contains `packetId`, `sha256`, and `contentRevision`.
Read the retained PDF with `getPacket(id, packetId)` and obtain explicit packet-review
and recipient confirmations before calling `submit(id, {packetId, sha256, channel,
to, message}, idempotencyKey)`. Submission uses the retained packet bytes; changing
recipient, message, documents, channel, or request revision requires a fresh preview.
Download packets are not submitted by this flow.

Packet preparation and submission require `rfas:act`; reading retained packets requires
`rfas:read`. Signing previews and document reads additionally require `documents:read`.
Sandbox sessions cannot send external fax or email. Existing `previewPacket`, `sendFax`,
and `refreshFaxes` remain available; use the retained-packet methods for the same review
guarantee as the dashboard.

See the [RFA dashboard guide](../../docs/rfa-dashboard.md#custom-browser-ui) for the
response fields and React's built-in saved-choice flow.
