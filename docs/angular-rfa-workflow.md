# Angular treatment and connected RFA workflow

`MindBillBillSubmissionComponent` supports native professional treatment billing with
`treatmentBilling`, procedure lookup, line diagnosis mappings, authoritative fee quotes,
and documented physician, therapy, and prolonged-service context. Advanced anesthesia
and physician-administered-drug context supplied by the host is retained. Those advanced
facts do not currently have native form controls. Supply an explicit `idempotencyKey`
for each logical bill submission and preserve `reportTypeCode` on PDF attachments.
Use a distinct bill external ID for each treatment visit.

`MindBillConnectedRfaComponent` provides the native Angular RFA workflow. It uses the
same short-lived browser session pattern as the billing components. A host can instead
supply a typed `RfaWorkflowClient` through `[client]`. Do not expose permanent API keys.

```ts
import { Component } from '@angular/core';
import {
  MindBillConnectedRfaComponent,
  type RfaDraftInput,
  type RfaRecord,
} from '@mindbill/angular';

@Component({
  selector: 'app-case-rfa', standalone: true,
  imports: [MindBillConnectedRfaComponent],
  template: `<mindbill-connected-rfa
    [initialDraft]="draft"
    [contextKey]="caseId"
    [rfaId]="savedRfaId"
    [createIdempotencyKey]="'rfa-create-' + caseId"
    [claimsAdministratorId]="directoryPayerId"
    [billingProviderId]="billingProviderId"
    [actorReference]="authorizedActorReference"
    [sessionEndpoint]="sessionEndpoint"
    [showList]="false"
    (changed)="currentRfa = $event"
    (saved)="persistAssociation($event)" />`,
})
export class CaseRfaComponent {
  // Populate these from your authenticated case and saved organization profiles.
  caseId = 'case_synthetic';
  savedRfaId: string | null = null;
  currentRfa: RfaRecord | null = null;
  sessionEndpoint = '/api/mindbill/rfa-session?caseId=case_synthetic';
  directoryPayerId = 'directory_payer_synthetic';
  billingProviderId = 'billing_provider_synthetic';
  authorizedActorReference = 'authorized_actor_synthetic';
  draft: RfaDraftInput = {
    externalId: 'rfa_case_synthetic', claimId: 'claim_synthetic',
    patientId: 'patient_synthetic', renderingProviderId: 'provider_synthetic',
    employeeName: 'Demo Patient', providerName: 'Demo Physician',
    items: [{ diagnosisCode: 'M25.531', procedureCode: '99213',
      serviceDescription: 'Office visit', quantity: 1, units: 1 }],
  };
  async persistAssociation(rfa: RfaRecord) {
    // Send rfa.id to your authenticated server and handle persistence failures.
    this.savedRfaId = rfa.id;
  }
}
```

The example identifiers are placeholders. Provision or resolve the saved patient,
partner-linked claim, rendering provider, and billing provider before rendering.
The professional bill and RFA must use the same underlying patient and claim.
`claimsAdministratorId` is the public **directory** payer identifier, separate from
any organization claims-administrator identity in `initialDraft.claimsAdminId`.
`providerFax` is the provider's return fax, never the outgoing authorization destination.

The server session route must authenticate the caller and case, allow the exact browser
origin, and grant only the required organization-wide scopes: `rfas:read`, `rfas:create`,
`rfas:edit`, `rfas:sign`, `rfas:act`, `payers:read` for directory/diagnosis lookup, `bills:read` for procedure lookup, and
`documents:read` for PDF downloads. The organization must have `treatmentBilling` enabled. Bill-scoped
and customer-external-ID-scoped sessions cannot use this RFA workflow. Do not expose
organization-wide sessions to callers who should not have organization-wide RFA access.
Treat `actorReference` as an authenticated, physician-authorized actor supplied by the host.

## Explicit lifecycle actions

1. Save the unsigned draft. Existing drafts use `contentRevision` for optimistic
   concurrency; item IDs are preserved. A stable create idempotency key prevents a
   second request after a lost response. Reload reconciles by claim and external ID.
2. Upload actual PDFs. Uploading does not sign or send the RFA.
3. Enter diagnosis descriptions, prepare the exact preview, open it, and explicitly
   confirm physician authorization before signing. Unsaved edits invalidate the preview.
   Saving, signing, and delivery are separate actions.
4. Select an authorization destination from the directory or enter a fax explicitly
   confirmed with the handling adjuster. Telephone numbers never substitute for fax.
   Source links and observation dates accompany directory information when available.
5. Download the signed packet. The component does not fax or email it. Use your
   authorized delivery service and record its actual transmission or receipt evidence.
6. Upload the UR response and record each item's documented decision. Modified and
   denied decisions also require IMR evidence and reviewer details. This operation
   records the reviewer's outcome; it does not grant a new approval.

`(changed)` emits the current record after load, selection, or mutation, and null for an
empty case. `(saved)` emits after successful mutations; `(rfaSelected)` after selection.
`(rfaError)` reports failures; the component also renders an inline error. After an
ambiguous mutation failure it requires an explicit Reload before another write. Case
changes invalidate in-flight results, signing previews, and destination confirmations.
`showList=false` hides the selector; it does not change authorization or server filtering.

For an authorized treatment bill, use the approved or modified `RfaItem.id` as
`serviceLines[n].rfaItemId` and its `authorizationNumber` as
`service.authorizationNumber`. Preserve the authorized procedure, quantities, and dates;
use a separate bill ID per visit. The API validates the actual linkage and remaining
allowance. Showing a draft or recording a transmission does not establish authorization.

Standalone preparation and directory components are also exported:
`MindBillRfaDraftFormComponent` (`mindbill-rfa-draft-form`) and
`MindBillRfaAuthorizationDestinationComponent` (`mindbill-rfa-authorization-destination`).
The draft form accepts `initialDraft`, async `onSave`, `disabled`, and `appearance`, and
emits `saved`, `saveError`, and `dirtyChange`. It never signs or delivers a request.

Native treatment and workspace foundations reuse the existing Angular parity work
(commits `76918a6` and `c7847a5`, Software Factory) and the connected workspace integration
branch. React is not a runtime dependency of these Angular components.

## Attach documents already held by the host

Pass `sourceDocuments: MindBillRfaSourceDocument[]` to offer existing case PDFs:

```ts
const sourceDocuments = [{
  id: 'clinical_report_synthetic', label: 'Clinical report',
  filename: 'clinical-report.pdf', documentType: 'clinical_report' as const,
  loadBlob: async () => {
    const response = await fetch('/api/cases/case_synthetic/clinical-report');
    if (!response.ok) throw new Error('The case document could not be loaded.');
    return response.blob();
  },
}];
```

The host must authenticate and authorize that document endpoint for the current case.
Each entry has an explicit **Attach** button. The SDK does not fetch or upload these
files automatically. It checks that the case is unchanged after loading the bytes,
then uploads against the saved request's current revision. The regular PDF file
picker remains available. No document fixtures or synthetic defaults ship in the SDK.

## Claims administrator contact on the signing form

The explicit authorization destination is included in the signing-preview payload:
its fax or email, office label when no contact name is provided, and directory phone
when available. The selected route overrides the corresponding manually entered
fax/email field. A telephone number never becomes a fax number.

Use `[authorizationContact]` to provide verified case-specific contact information:

```ts
import type { RfaAuthorizationContact } from '@mindbill/angular';

const authorizationContact: RfaAuthorizationContact = {
  contactName: 'Synthetic authorization office',
  address: { line1: '100 Example Street', city: 'Example City', state: 'CA', postalCode: '90001' },
  phone: '+14155550100',
};
```

These values must come from verified host records for the current case and office.
The SDK does not copy a billing-review address or invent an address from a selected
fax. Under **Review and sign**, users can enter optional contact, postal address,
phone, fax, and email fields. Unknown fields can remain blank. A verified postal
contact does not require a fax.

When `claimsAdministratorId` is supplied, preparing the preview requires a selected
authorization route or a verified contact. Host-provided contact data is initially treated as
verified. Editing contact details or choosing a different authorization office requires
explicitly confirming those details again, even when a fax or email route is selected. Any contact or destination change clears the existing preview
and signing consent. In-flight preview responses and PDF downloads are discarded
if that contact changes, so the user reviews and signs the exact current contact.


## Searchable codes and external links

RFA diagnosis and procedure controls are searchable comboboxes. The connected component
uses authenticated reference lookups by default. Both the connected and standalone draft
components accept `searchDiagnoses` and `searchProcedures` callbacks with the signature
`(query: string) => Promise<{ code: string; description?: string }[]>` for host catalogs.
The standalone form requires these callbacks for remote search. Searches are debounced;
stale responses are discarded. Typing a search does not change the saved code or mark
the draft dirty. Selecting a result edits the code and preserves the clinician's existing
service description. A syntactically valid custom code remains available when absent
from the catalog; server validation still applies.

Set `[showExternalLinks]="false"` on the connected component to hide its branding and
directory-source links throughout the nested workflow. The standalone draft and
authorization-destination components accept the same option. The default is `true`.

Bill submission uses the same diagnosis selection pattern as React: a shared searchable selection or independent code/description chips per service line. Switching shared mode preserves independent assignments until the shared selection is changed. The SDK retains numeric pointers in the API payload while presenting actual diagnosis codes to users. Procedure menus show and search reference descriptions when available; imported fee amounts remain separate from authoritative fee quotes.
