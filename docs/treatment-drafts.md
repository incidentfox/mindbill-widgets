# Dental drafts and requests for authorization

`@mindbill/react` exports `DentalDraftEditor` and `RfaDraftForm` for host-managed
preparation workflows. Both use the shared `appearance` tokens, work with server
rendering, and keep changes local until the user chooses Save. Changing the React
`key` resets the editor when switching records.

These components perform no network requests. Their `onSave` callbacks must save
an unsigned draft through your authenticated server. Keep permanent MindBill API
keys on that server; enforce organization access there. Do not use these callbacks
to transmit claims, sign requests, send faxes, or record authorization decisions.
The components disable editing while a save is pending and show a generic failure
without exposing backend responses. Resolve an ambiguous save on your server
before retrying; automatic retries are not performed.

## Dental preparation

```tsx
import { DentalDraftEditor, type DentalDraftContentInput } from "@mindbill/react";

function DentalPreparation({ draftId, content }: {
  draftId: string;
  content: DentalDraftContentInput;
}) {
  return <DentalDraftEditor
    key={draftId}
    initialContent={content}
    appearance={{ preset: "calm-clinical" }}
    onSave={async (updatedContent) => {
      await saveDentalContentOnYourServer(draftId, updatedContent);
    }}
  />;
}
```

The example's `saveDentalContentOnYourServer` is your application adapter, not an
SDK export. Match it to the public `/partner/v2/dental-drafts` create or update
contract. Your server supplies claim/patient identity, retains the expected
revision for updates, and handles conflicts without overwriting newer work.

The editor captures D-prefixed dental codes, code edition, service dates,
quantities, teeth, surfaces, oral cavity, prosthesis notes, diagnosis codes,
practice charges, and charge references. Provider identifiers come from the host
and are preserved. Empty codes and prices can remain incomplete for review.

`chargeCents` is an **extended line charge**: four units with `chargeCents: 20000`
means $200 total for that line. It is never multiplied by quantity again. A blank
amount is `null` (unknown); zero, negative amounts, exponential notation, and
fractions smaller than a cent are rejected. `dentalDraftChargeSummary` returns
both known charges and a nullable total so an incomplete total cannot look final.
Practice charges do not represent a statutory allowance or a payer commitment.

Code syntax validation does not validate clinical coding, licensed code
ownership, payer acceptance, or fee entitlement. Saving a dental draft does not
generate or transmit an 837D. A host must separately establish the supported
clearinghouse, payer, enrollment, format, and transmission workflow.

## RFA preparation

```tsx
import { RfaDraftForm, type RfaDraftInput } from "@mindbill/react";

function AuthorizationPreparation({ requestKey, draft }: {
  requestKey: string;
  draft: RfaDraftInput;
}) {
  return <RfaDraftForm
    key={requestKey}
    initialDraft={draft}
    onSave={async (unsignedDraft) => {
      await saveUnsignedRfaOnYourServer(unsignedDraft);
    }}
  />;
}
```

`saveUnsignedRfaOnYourServer` is your adapter to the public `/partner/v2/rfas`
contract; choose create or update appropriately and prevent duplicate creation.
The host supplies verified claim/patient/provider identifiers and names. The form
captures new requests, resubmissions with material changes, or confirmation of
oral authorization; prospective, concurrent, or retrospective review; expedited
review requests; return fax; rationale; and requested services with diagnoses,
procedures, quantity, units, frequency, duration, and date ranges. Host-provided
metadata and contact snapshots are retained. Empty optional service fields are
omitted. A return fax explicitly cleared to `""` stays cleared.

Resubmissions require a material-change explanation. End dates require a valid
start date and cannot precede it. The form neither supplies a signature timestamp
nor accepts one in its TypeScript input; runtime `signedAt` properties are removed
before saving. Do not pass an already signed request to this preparation form.
Signing, attachment review, delivery, receipt tracking, and utilization-review
decisions are separate host workflows. Choosing “Confirm oral authorization”
records the requested document type; it is not evidence that authorization exists.
