# Procedure search and fee quotes

`createBillReferenceClient` and `createBillLifecycleClient` expose `searchProcedureCodes` and `quoteFee`. Both use short-lived, origin-bound browser sessions with `bills:read`; the organization must have treatment billing enabled. Keep session issuance on your trusted server.

## Existing React form

Enable treatment on the existing component, retaining its patient, claim, diagnosis,
service-line, attachment, and submission workflow:

```tsx
<BillSubmissionForm
  initialBill={bill}
  treatmentBilling
  getSession={getMindBillSession}
  onSubmitted={({ billId }) => saveBillLink(billId)}
/>
```

The service-line section has one shared ICD-10 multiselect by default. Clear
“Apply the same diagnosis codes to all service lines” to use one multiselect in each
row, for medical-legal and treatment bills alike. Each uses the existing diagnosis
catalog. Untouched mode round trips restore independent selections; edits made in
shared mode become the current selection when switching back.
The bill supports twelve unique diagnoses and four unique diagnosis pointers per line.
Treatment procedures use the existing procedure picker. The form quotes California
fees for the service date and location. Standard visit estimates display their
assumptions; the biller supplies the applicable provider type and therapy minutes
in the line's fee details. “Requires adjustment” clears the automatic amount and
requires review before submission. Quotes for unsupported services, dates, or jurisdictions
remain marked for review and cannot silently reuse an old charge. Current context
controls cover office visits and therapeutic exercise; other services may need review.
Medical-legal and treatment services require separate bills.

Hosts with custom reference integrations may supply `onSearchProcedureCodes` and
`onQuoteFee`; these callbacks use the exported browser input and result types. The
default implementation uses the same short-lived session as the rest of the form.

## Browser clients

```ts
import { createBillReferenceClient } from "@mindbill/browser";

const reference = createBillReferenceClient({
  sessionEndpoint: "/api/mindbill/session",
});
const catalog = await reference.searchProcedureCodes({
  query: "99",
  limit: 30,
  jurisdiction: "CA",
});
// catalog.results contains { code } entries.
```

Search uses `GET /partner/v2/procedure-codes`. The query is an optional procedure-code prefix of up to five alphanumeric characters. The limit defaults to 30 and is bounded to 1–100. Supported catalog jurisdictions are `CA` (default), `NY`, and `OWCP`. The result contains `results`, `total`, `limit`, `jurisdiction`, and `catalogAsOf`. `catalogAsOf` describes the catalog snapshot, not the effective date of a rate. A catalog entry does not guarantee a payable fee for a service date.

`quoteFee(input: BillFeeQuoteInput): Promise<BillFeeQuote>` posts to `POST /partner/v2/fee-quotes` and unwraps its `data` result. Supply the procedure `code` and `dateOfService` (`YYYY-MM-DD`), plus the applicable supplied calculation context. Optional inputs include `units`, `modifiers`, `chargeCents`, `serviceZip`, `hasFeeAgreement`, and report qualifications. Physician and therapy services have distinct context fields; the exported `BillFeeQuoteInput` type lists them. A priced estimate is not verification of clinical facts. Missing context or unavailable rates can require review.

```ts
const quote = await reference.quoteFee({
  code: "99213",
  dateOfService: "2026-08-24",
  units: 1,
  serviceZip: "95814",
  // Add physicianContext from applicable service facts.
});

if (quote.status === "priced") {
  const totalLineDollars = quote.amountCents / 100;
  // This is already the total for the line; do not multiply by units again.
  console.log(totalLineDollars);
} else {
  console.log(quote.reason);
}
```

A priced quote includes `amountCents`, `scheduleMaximumCents`, `basis`, `provenance`, and `notes`. Other outcomes are `requires_review` and `not_separately_payable`, each with `reason` and `provenance`; neither provides a billable amount. Provenance identifies source URLs and effective dates. Pricing failures reject the promise. Requote when procedure, date, units, modifiers, location, charge, or applicable service facts change, and discard responses for an older form state.

Service lines may carry an optional `rfaItemId` linking an existing RFA item. This identifier is separate from fee pricing: preserve it for the same authorized service, and clear it when changing the procedure so a different service is not linked to the previous authorization. When the last linked line is replaced or removed, the form also clears its bill authorization number. Explicit authorization on an initially unlinked bill remains unchanged. A fee quote does not establish authorization.


### Practice rates and verified submission context

Pass the selected organization's billing-provider ID as `billingProvider.id` (or the existing `savedProviderId` reference). `organizationProfileOptions(profile)` retains that ID automatically. Fee requests include `billingProviderId` and the canonical `claim.claimsAdministrator.id` as `payerId`. The API can then select the matching practice/payer rate and return `basis: "payer_contract"`. Changing either selection requests a new quote.

Each priced treatment line includes `feeContext` when submitted. This contains the calculation inputs used for its displayed estimate, including physician, therapy, report, catalog, and prolonged-service context. The server rechecks these inputs and computes the fee using the submitted service, date, units, modifiers, provider, payer, and location. Those authoritative fields are deliberately excluded from `feeContext`. A custom submit handler must forward the context together with each line. Manual charges without a context remain manual; a code catalog entry alone does not establish a payable fee.

For 99358/99359, the existing service-line form adds a compact section for documented prolonged minutes, the related evaluation date, and the documented time basis. Same-date prolonged lines share this section. Select the qualifying basis only when the displayed clinical conditions are documented and every same-date service is included in the bill. The quote request derives that procedure/unit list from the current lines, and the API validates eligibility and units together. Missing or changed details require a fresh quote. The existing shared/per-line diagnosis selector and treatment feature gate are unchanged.

The browser client validates priced responses for California reports, physician and therapy RBRVS, clinical laboratory, simple dispensed drugs, DMEPOS, physician-administered drugs, anesthesia, and practice contracts. `BillFeeQuoteBasis` and `BILL_FEE_QUOTE_BASES` share the same supported families. The form displays the returned line total without multiplying it by units again. Unknown fee families or malformed amounts remain unavailable.
