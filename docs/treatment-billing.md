# Treatment billing with expected OMFS payment

`ConnectedTreatmentBillForm` (`@mindbill/react` 0.78.0+) renders `BillSubmissionForm` for California treatment
(CMS-1500 professional) bills and prices every line of the visit together through
`POST /partner/v2/fee-quotes/encounter` (`@mindbill/browser` 0.51.0 `quoteEncounter`).

## What it shows

Each service line has an editable **Charge**, the **Expected (OMFS)** payment and the **Difference**. A line can
instead show *Bundled*, *Not payable* or *Needs review*, with a short note explaining why (for example a missing
modifier 25 or an NCCI pair). Totals sit under the table; a total is never shown as final while a line needs
review. Visit-wide notes, such as a per-visit cap or the LC 4604.5 visit count, appear once under the heading.

## Requirements

- The organization has treatment billing enabled (partner organization capability `treatmentBilling`).
- The trusted host server mints a browser session with `bills:read` (and `bills:create` to submit the bill).
- `encounter.renderingProviderId` and `encounter.placeOfServiceId` are the organization's saved rendering
  provider and service location ids, from `GET /partner/v2/rfas/creation-context` or the organization profile.
  `encounter.claimId` is optional; with it, the claim's claims administrator and earlier therapy visits are used.

```tsx
import { ConnectedTreatmentBillForm } from "@mindbill/react";

export function NewTreatmentBill({ bill, ids }) {
  return <ConnectedTreatmentBillForm
    sessionEndpoint="/api/mindbill/session"
    initialBill={bill}
    encounter={{ renderingProviderId: ids.renderingProviderId, placeOfServiceId: ids.locationId, claimId: ids.claimId }}
    onEncounterQuote={(estimate) => console.log(estimate?.totals.estimatedPayableCents)}
  />;
}
```

## Using the pricing without the component

```ts
import { createBillReferenceClient, createEncounterQuoter, encounterQuoteRequest } from "@mindbill/browser";

const client = createBillReferenceClient({ sessionEndpoint: "/api/mindbill/session" });
// Inside your own BillSubmissionForm:
const onQuoteEncounter = createEncounterQuoter(client, { renderingProviderId, placeOfServiceId, claimId });
// Or directly:
const estimate = await client.quoteEncounter(encounterQuoteRequest(lines, { renderingProviderId, placeOfServiceId }));
```

Amounts are cents. A line whose `assessment` is not `priced` has no expected amount; never substitute the
charge. A quote saves and sends nothing.

## Saving and resuming unsent drafts

With `drafts`, the form shows **Save draft**. It saves the bill exactly as entered (it may be incomplete)
and the pricing ids to `POST /partner/v2/bill-drafts` (later saves `PATCH` the same draft at its current
revision). Nothing is validated for submission or sent. Pass `draftId` to resume it: the saved bill replaces
`initialBill` and missing `encounter` ids come from the draft. Submitting a resumed or saved draft sends it
through `POST /partner/v2/bills` with `draft: { id, revision }`; the server reserves the draft, creates the
bill and marks the draft `submitted` (or releases it when no bill is created). A submitted draft cannot be
edited again. The session needs `bills:create`.

```tsx
<ConnectedTreatmentBillForm
  sessionEndpoint="/api/mindbill/session"
  initialBill={bill}
  encounter={{ renderingProviderId, placeOfServiceId, claimId }}
  drafts
  draftId={savedDraftId}                 // omit for a new bill
  onDraftSaved={(draft) => rememberDraft(visitId, draft.id)}
  onSubmitted={(result) => openBill(result.billId)}
/>
```

`createBillDraftsClient(options)` lists (`list({ claimId })`), reads, saves and deletes drafts directly
(`remove(id, revision)` deletes only unsent drafts).

## Submission pricing matches the encounter quote

Lines priced by the encounter quote are submitted without the form's standard estimate assumptions (no fee
agreement, ordinary physician service), so MindBill prices the saved bill with the same professional context the
quote used. Specialty facts you enter (therapy minutes, anesthesia, drugs, equipment, catalog confirmations) are
always sent. Before 0.79.1 such lines could be refused at submission with
`code_specific_coding_requirements_not_confirmed` even though the quote showed an expected payment.
