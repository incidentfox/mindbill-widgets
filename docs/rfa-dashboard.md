# Connected RFA dashboard

The dashboard supports patient and injury selection, request preparation and editing, embedded physician signature setup, reviewed signing, and confirmed fax or email delivery. Users can also download the assembled packet and record receipt and utilization review outcomes:

```tsx
import { RfaDashboard } from "@mindbill/react";

<RfaDashboard
  getSession={getAuthorizedRfaSession}
  actorReference={authenticatedUser.id}
  permissions={["create", "edit", "sign", "send", "act"]}
  canCreateClaim
  canManageProviderSignatures
  signatureSession={{ getSession: getAuthorizedSignatureSetupSession }}
  environment="sandbox"
/>
```

The dashboard shows **New authorization request** when `create` is permitted.
The user searches saved patients by name or claim number, selects a claim and saved
rendering provider, confirms the selection, then enters the requested treatment.
Physicians are searchable by name or NPI; both lists support pagination. No identifiers
need to be entered manually. **Back to patient and physician** retains treatment edits.

`initialDraft` remains optional and bypasses saved selection when your host already has
a prepared case. It uses the same input as `RfaDraftForm`. `claimId` and
`renderingProviderId` optionally restrict both the request list and saved creation choices. Server authorization must enforce the
actual permitted records; filters and `permissions` only control the interface.
`patientId` optionally limits the request list across that patient’s injuries; it does
not change the creation picker or grant access to additional records.
`onCreated(record)` observes draft creation; optional `onContinue(record)` adds a host
navigation action without replacing the native signing and packet workflow.

The trusted server must authenticate the user and mint a short-lived exact-origin session:

| Capability | Session scopes |
| --- | --- |
| List, detail, read retained packet | `rfas:read` |
| PDF previews and delivery proof | `documents:read` |
| Authorization recipient directory and diagnosis search | `payers:read` |
| List saved creation choices; create draft | `rfas:create` |
| Create patient and injury; prefill saved practice and location | `bills:create` (also `payers:read` for administrator search) |
| Save physician signature in the embedded setup | `rfas:sign` and `organization:manage` |
| Edit eligible draft; upload clinical, response, or IMR PDF | `rfas:edit` |
| Signing preview and attested signing | `rfas:sign` |
| Prepare retained delivery packet; send fax/email; refresh fax; record receipt, decisions, information responses; update follow-up tasks | `rfas:act` |

Use only the scopes authorized for the current user. Permanent API keys stay on your server.
The UI `permissions` default is an empty array. PDF views require `documents:read` even
when the user has `rfas:read`; reading a retained delivery packet uses `rfas:read`. Directory failure leaves manual recipient confirmation
available; it never substitutes a telephone number or silently picks a recipient.

## Optional tab in the billing dashboard

React 0.68.0 adds an opt-in **Requests for authorization** tab to
`ConnectedBillingWorkspace` and `BillingDashboard`. Set `showRfas` to enable it;
it defaults to `false` and loads RFA data only when opened.

```tsx
<ConnectedBillingWorkspace
  sessionEndpoint="/api/mindbill/session"
  showRfas
  initialView="rfas"
  rfaDashboard={{
    actorReference: authenticatedUser.id,
    permissions: ["create", "edit", "sign", "send", "act"],
    environment: "sandbox",
    canCreateClaim: true,
    canManageProviderSignatures: true,
    signatureSession: { getSession: getAuthorizedSignatureSetupSession },
    onCreated: (record) => rememberCreatedRequest(record.id),
  }}
/>
```

The tab includes status counts and filtering, request details, **New authorization
request**, draft editing, signing, packet review, submission, and delivery history.
The new-request button requires `create` permission. Saved claim and physician
selection is included; hosts can optionally provide `initialDraft` to skip selection.
Enable `canCreateClaim` to offer **New patient and injury** inside the creation flow.
Rendering providers are managed in the embedded Settings tab. Refresh the choices after setup.
Saving creates an unsigned draft. Sending is a separate, explicitly confirmed action.

`rfaDashboard` accepts the same props as standalone `RfaDashboard`. The connected
workspace inherits its main session, API URL, and fetch implementation. Supply
`rfaDashboard.getSession` or `rfaDashboard.sessionEndpoint` for separately authorized
RFA access; a dedicated endpoint overrides the workspace session callback. Mint the
scopes listed above on the trusted server. Permissions default to read-only and the
environment defaults to sandbox; showing the tab never grants backend access.

For the data-driven dashboard, pass `bills`, `showRfas`, and the same `rfaDashboard`
configuration. Its RFA connection defaults to `/api/mindbill/session`. Bill search
filters do not apply to RFAs; use `rfaDashboard.claimId` or `renderingProviderId`
for a restricted view. The RFA status selector filters requests within that view.

`initialView="rfas"` opens the tab immediately in `ConnectedBillingWorkspace`.
Disabling the selected tab returns to Bill tasks (or Bills in `BillingDashboard`).
This SDK option does not change the MindBill application interface.

## Find requests and individual treatments

Switch between **RFAs** and **Requested treatments** without losing the current search.
Search matches saved patient and physician names, claim number, RFA ID, status,
claims administrator, treatment descriptions, CPT/HCPCS, and diagnosis codes. The status
selector and optional patient, claim, and physician filters combine with that search.
Search and sorting run on the server across all matching requests. Sort by patient,
physician, submission date, creation date, or request status; click again to reverse it.

First, previous, and next navigate request pages. The treatment view shows every item
on those requests, so its row count can exceed the request page size. Its page controls
still page by request. Opening a treatment focuses its section in the request detail.
Dates and individual treatment outcomes are displayed but are not separate list filters.

## Draft actions

**Copy as new draft** requires `create`. The copy preserves editable clinical request
content, but requires a fresh review, supporting documents, and physician signature.
It does not copy delivery evidence, outcomes, or history. `onCreated` receives the copy.

**Cancel draft** requires `edit` and a separate confirmation. Only an unsigned,
unsubmitted draft with no queued submission is eligible. The server checks the current
revision under a lock. Cancellation retains the audit history; it does not delete the
request or cancel a fax in progress. Submitted requests remain immutable.

For a custom page use `RfaDraftActions` with the connection options, `rfa`,
`permissions={["create", "edit"]}`, `onCopied`, and `onCanceled`.
`createRfaDraftActionsClient` exposes `copy` and `cancelDraft`, each requiring the
expected revision and a stable idempotency key.

## Patient, injury, and request setup

An RFA belongs to a patient’s injury/claim and a saved rendering provider. It does not
require an existing bill. Saved-choice search selects the patient and injury together;
any saved injury diagnosis codes are available in the treatment form. A patient can have
multiple claims and each claim can have multiple RFAs.

`canCreateClaim` defaults to `false`. With that prop and the authorized session scopes,
**New patient and injury** collects patient demographics, address, claim number, employer,
date and state of injury, and a claims administrator. It creates both records together,
then selects the new injury. To attach another injury to an existing patient, provision
it through your trusted integration using the patient’s stable external ID. No bill is
created by this setup action. A `claimId`-restricted view does not offer new-patient setup.

The request form separates **New request** / **Resubmission with material change** from
the independent **Written confirmation of a prior oral request** checkbox and review
priority. Prospective, concurrent, and retrospective review types have explanatory labels.
Resubmissions require a material-change explanation. Clinical rationale and material
changes are included in the reviewed form or its continuation pages.

Each requested service has its own diagnosis code and description, service description,
optional procedure code, quantity, units, frequency, duration, and requested dates. Users
can search diagnoses, choose a saved injury diagnosis, or copy the first service’s
diagnosis to another line. Descriptions persist with the draft for signing review.

The form also edits `requestingPractice` and `authorizationContact` snapshots. Both use
`{ name, contactName, address, city, state, zip, phone, fax, email }`; `name` is the practice
or organization name and `contactName` is the individual contact. The requesting physician
remains the separately selected rendering provider. Saved billing-provider and location
choices prefill the practice when the session can read the billing profile; users can
also enter contacts directly. These snapshots belong to this RFA and appear in its
signing preview. Editing them does not update the shared directory. A saved authorization
fax/email becomes an explicit delivery option, never an automatically selected recipient.

## Edit an existing draft

With `edit` permission, **Edit request draft** opens the existing service rows. Saving
replaces the full content at `expectedRevision`, preserves retained service IDs and host
metadata, removes deleted rows, and creates IDs for new rows. Claim, patient, and rendering
provider IDs remain fixed. A successful save increments the content revision, clears the
signature, and requires a new signing preview and attestation. Historical signed PDFs remain
viewable but cannot be selected as the current signed form.

Only unsent `draft` or `ready` requests can be edited. The server also rejects edits once
submission is queued, sent, delivered, or receipt is recorded. A stale revision returns 409;
the form retains edits and offers **Discard edits and refresh** to load the latest request.
It never silently overwrites newer content or automatically sends the changed request.

## Prepare, sign, review, send

Enable `canManageProviderSignatures` (default `false`) for authorized users to save a
physician signature directly in **Review and sign**. The session needs both `rfas:sign`
and `organization:manage`, and must not be restricted to a customer or bill. The physician
must already be an active rendering provider in the organization. Setup accepts a PNG up
to 512 KiB, a staff reference, and an explicit physician-authorization attestation. Saving
it does not sign or send any request; signature image data is never returned by saved-choice lookup.

Pass `signatureSession` (`OrganizationClientOptions`, for example
`{ getSession: getAuthorizedSignatureSetupSession }`) to use a separate trusted session
for saving signatures. The ordinary RFA session can retain its narrower workflow scopes.
Without this option, signature setup uses the regular RFA client and that session must
have both required scopes. `signatureSession` applies only to saving the provider's
signature; preparing previews, signing requests, and delivery use the main RFA session.

The developer console permits a separate signature setup session only for owner/admin
users, with exactly `organization:manage` and `rfas:sign` and no bill or customer binding.
Additional permissions are rejected on that console session. UI visibility never grants
these privileges; your session endpoint must authorize the user independently.

With `sign` permission and `actorReference`, review the saved diagnosis descriptions,
prepare and inspect the exact DWC-RFA, then explicitly attest physician authorization
before signing. `actorReference` identifies that authorized human in your system
(1–200 characters); use a stable user ID, not an API key or credential. Signing is bound
to the reviewed content revision, physician, and content hash. Changed content requires
another preview and attestation.

Upload one or more clinical PDFs, up to 25 MB each, by selecting or dropping files. The
packet requires the current-revision signed form and clinical substantiation. The current
signed form is selected automatically; historical signed forms remain viewable.

Choose fax or email and the exact authorization recipient, or choose **Download packet**.
Directory choices and saved authorization contacts are explicit options; manual contact
entry is available when routing needs confirmation. Add an optional message for the fax
cover or email, then prepare the assembled packet. Review its generated cover sheet,
signed form, and selected supporting documents. Confirm both the packet review and the
recipient before submitting. Changing the channel, destination, message, documents, or
request revision requires a new packet preview and confirmations. The send operation
uses the retained packet ID and hash to deliver the bytes that were reviewed.

`environment` defaults to `sandbox`, which disables external fax and email sending.
`live` enables submission only for users with `send`, subject to packet readiness and
explicit confirmations. Backend session environment and permissions remain authoritative.
Downloading the packet does not send it or mark it submitted. If it is delivered outside
this workflow, preserve the actual delivery evidence before recording receipt.

The dashboard renders server statuses, recorded receipt and decision deadlines, treatment
outcomes, information requests, event history, and fax delivery proof. It does not infer a
receipt or start a deadline from an attempted send. Existing transmitted requests are not
sent again through the initial-send action.

## Record outcomes and follow-up

`act` enables evidence-backed receipt recording, item-level utilization review decisions,
recording an information request or a response that has already been delivered, and updating existing
follow-up tasks. `edit` enables document uploads. Recording a receipt requires a proof
PDF or transmission reference. Decision entry associates the response PDF and, for modified
or denied treatment, an IMR form. These actions record supplied evidence; they do not infer
receipt from attempted fax delivery, send information responses, create follow-up tasks, or
queue notifications.

`RfaLifecycleControls` is also exported for a custom detail page. Pass `rfa`, the same
connection options, `permissions={["act", "edit"]}`, and `onUpdated` to adopt the refreshed
record. Its default is read-only. Clock corrections and other advanced workflows remain
available through the documented [RFA API](https://docs.mindbill.org/guides/rfas).

## Saved request details

The detail page displays the saved claim and injury date, requesting physician and NPI,
practice and authorization recipient contacts, request flags, clinical rationale, and
material changes. Each requested treatment includes its diagnosis, quantity, units,
frequency, duration, and requested dates when supplied. These details come from the
request record, so they remain available after submission without opening the draft editor.
Missing optional values are omitted. Review the signed PDF for the complete submitted form.

## Treatment tracking and notes

The detail page includes an individual treatment section with its current decision,
authorization, response evidence, and appointment. Users with `act` can correct a decision
with a reason and supporting response document. Corrections preserve history and check
the expected decision version. An existing scheduled appointment prevents correction;
resolve that appointment first. Modified or denied decisions require an IMR document.

Appointment updates use the current authorization and appointment version. Record the
scheduled provider, location and time, or explain why no appointment will be made or why
one was canceled. This records scheduling information; it does not book an appointment
with a third party. No One Call integration is implied.

History shows actor-attributed notes and recorded events. `edit` enables adding notes;
`act` alone does not. Notes are append-only and never copied into webhook payloads.
Delivery history keeps submission and forwarding evidence distinct and offers available
proof PDFs. Attempted sending is not treated as receipt.

`RfaTrackingPanel` is exported for custom pages. Pass `rfa`, `options` containing the
connection options, optional `permissions={["act", "edit"]}`, and `onUpdated`.
The standalone panel defaults to read-only. Supporting PDFs can be excluded from a new
packet with the document checkboxes; retained documents and historical packet bytes
are preserved rather than deleted.

## Custom browser UI

`createRfaClient` from `@mindbill/browser` accepts `OrganizationClientOptions` (`getSession`
or `sessionEndpoint`, optional `apiBaseUrl` and `fetch`). Its request methods include
`getCreationContext`, `list`, `get`, `createDraft`, `updateDraft`, `getDocument`,
`uploadDocument`, `prepareSigning`, and `sign`. JSON request mutations unwrap to
`RfaRecord`; list returns `{data, nextCursor, summary}`. Document and packet reads return
authenticated `Blob`s. Mutation methods that accept an idempotency key require a stable
key for retries of the same operation; authentication retries preserve it.

Use these methods for recipient-bound delivery:

```ts
const preview = await client.prepareDelivery(rfaId, {
  documentIds: selectedDocumentIds,
  channel: "fax", // "email" or "download" also supported
  to: confirmedAuthorizationFax, // omit for download
  message: optionalCoverMessage,
});
const pdf = await client.getPacket(rfaId, preview.packetId);
// Display pdf, then obtain explicit packet-review and recipient confirmations.
await client.submit(rfaId, {
  packetId: preview.packetId,
  sha256: preview.sha256,
  channel: "fax",
  to: confirmedAuthorizationFax,
  message: optionalCoverMessage,
}, submissionIdempotencyKey);
```

`prepareDelivery` returns `{packetId, sha256, contentRevision}`. Preserve the exact
channel, destination, message, and packet identity through review and submission. Download
previews have no submit operation. `previewPacket`, `sendFax`, and `refreshFaxes` remain
available for existing integrations; use the retained-packet flow above for a custom UI
that needs the same review guarantee as the dashboard.

`provisionClaim(input, {idempotencyKey})` creates or reuses a patient and claim using their
stable external IDs, without a bill. Its input is `{patient, claim}` and the result is
`{patientId, claimId, patientExternalId, claimExternalId, created: {patient, claim}}`.
`searchClaimsAdministrators(query, claimNumber?)` supplies administrator choices.
`saveProviderSignature(providerId, {contentBase64, physicianAuthorized: true,
actorReference}, {idempotencyKey})` saves an authorized PNG and returns
`{providerId, signatureConfigured: true}`. These setup methods are optional on the
`RfaClient` interface for compatibility with host-supplied clients; `createRfaClient`
implements all three.

`updateDraft(id, replacement, key)` uses `PATCH /rfas/{id}/draft`. Pass a positive
`expectedRevision` and the complete editable content; retained items carry `id`, new items
omit it. New fields include independent `writtenConfirmation`, each item’s
`diagnosisDescription`, and the two contact snapshots. Explicit `null` clears a contact
snapshot; omitted new fields are preserved for older clients. The legacy
`requestType: "oral_authorization_confirmation"` remains accepted, but new integrations
should use `writtenConfirmation` with a new or material-change request type.
`createRfaLifecycleClient` exposes `recordReceipt`, `recordDecisions`,
`recordInformationRequest`, `recordInformationResponse`, `listFollowUps`, and
`updateFollowUp` for custom lifecycle UIs.

`getCreationContext(query?)` uses `GET /partner/v2/browser/rfas/creation-context`
and requires `rfas:create`. It returns `{claims, renderingProviders, nextCursor,
renderingProvidersNextCursor}`. Claims include `claimId`, `patientId`, `employeeName`,
and optional `claimNumber`, `dateOfInjury`, `claimsAdminId`, and `diagnosisCodes`. Active rendering
providers include `id`, `name`, and optional `npi`; signature material is never returned.
Use `search` (patient name or claim number) with `cursor` for claims, and
`providerSearch` (name or NPI) with `providerCursor` for physicians. `limit` defaults
to 50 and is capped at 100. Reset the corresponding cursor when changing a search.
Optional exact `claimId` and `renderingProviderId` restrict choices. Cursors and records
remain scoped to the authorized organization and environment.

### Retained packets and forwarding

The detail view lists retained packet PDFs and their transmission history. Opening a packet loads the immutable PDF that was prepared for that submission; it does not regenerate a new document from current data.

`RfaPacketsPanel` is also exported for standalone use. Forwarding requires `environment="live"`, the `act` permission, an eligible retained packet, review of its exact PDF, and explicit confirmation of the recipient. A forward creates a separate transmission and does not replace the original submission or reset the review timeline. Sandbox forwarding is disabled. Available delivery channels are enforced by the backend; an unavailable email channel returns an error rather than claiming delivery succeeded.

## Response tasks and supporting documents

The dashboard includes a **Tasks** view with **Due**, **Scheduled**, and **Completed** work, filtered by task type. Patient, claim, and physician filters also scope task results. Opening a task leads to the corresponding request; follow-up assignments, notes, and next-contact dates stay in its history. An unanswered treatment remains pending after another treatment receives a decision.

The organization-wide Tasks view includes **Match UR**. Review the authenticated incoming fax PDF, choose a request, and explicitly confirm the patient, claim, and treatment match. OCR suggestions help find candidates but never select a tenant or post decisions. Matching opens **Post UR** with the retained response PDF. Record verified receipt when required, then decisions for each treatment addressed by the response. Complete the review only after confirming all decisions in that document were recorded, or explicitly mark a duplicate/no-new-decision response with a note. Partial responses leave the remaining treatments and No Response follow-up open.

`RfaTaskBoard` is available separately with the usual session and appearance props, optional `patientId`, `claimId`, and `renderingProviderId`, `permissions={["act"]}` for matching, and `onSelect(rfaId, responseDocumentId?)` for navigation. Read-only users can inspect tasks and PDFs. The unmatched inbox appears only in the organization-wide view because unmatched faxes have no verified patient/claim association yet.

`createRfaLifecycleClient` exposes `listInboundFaxes({limit, cursor, includeMatched})`, `getInboundFaxContent(faxId)`, and `matchInboundFax(faxId, rfaId, idempotencyKey)`. Inbox reads use `rfas:read`; matching uses `rfas:act`. RFA-attached document previews still require `documents:read`. Follow `nextCursor` until null and reset pagination when changing filters. These endpoints require an organization-wide session; customer-scoped or bill-scoped sessions cannot access the response inbox.

New-request preparation includes supporting PDF selection in the same form. Creating the request uploads the selected files in sequence, preserving the latest revision. If an upload fails, the saved draft remains available and identifies the incomplete upload for retry. Signing remains blocked until required supporting documents are present. Creating and uploading needs both `rfas:create` and `rfas:edit`.

Return fax numbers are managed by the backend. Live sending requires a verified, unambiguous receiving-number configuration for the organization and partner. Sandbox uses a fictional number and sends nothing. Response deadlines come from the API; hosts should not calculate separate client-side clocks.
