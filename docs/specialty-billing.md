# Institutional, dental, and pharmacy bills

Browser 0.45, Node 0.17, and React 0.71 add optional claim-family metadata. Existing professional integrations can leave these fields absent and continue using CMS-1500 behavior.

## API contracts

`CreateBillRequest`, `BrowserBillCreateInput`, and returned bill/review data accept `claimForm`: `cms1500`, `ub04`, `ada`, or `ncpdp`. This describes the paper form family. MindBill selects the clearinghouse transport on the server; an ADA bill does not imply an 837D transmission.

`formData` at bill and service-line level carries JSON under the `institutional`, `dental`, or `pharmacy` namespace. `BillFormData` and `BillLineFormData` are forward-compatible JSON types, not a replacement for the server's form-specific validation. Consult your enabled API contract for required fields and supported routes.

Service-line `drug` uses the existing `BilledDrug` contract: `ndcNumber`, `metricQuantity`, and `unitOfMeasure` (`UN`, `ML`, or `GR`). Keep quantity as a decimal string. Supply prescription details in line `formData.pharmacy`. Compound prescriptions use separate ingredient lines; preserve each ingredient's NDC and quantity and their shared prescription number.

These synthetic fragments illustrate how identifiers are carried; they are not complete submission-ready bills:

```ts
const institutionalLine = {
  code: "", units: 1, charge: 150,
  formData: { institutional: { revenueCode: "0450" } },
};
const pharmacyLine = {
  code: "", units: 2.5, charge: 25,
  drug: { ndcNumber: "00000000001", metricQuantity: "2.5", unitOfMeasure: "GR" as const },
  formData: { pharmacy: { prescriptionNumber: "123456" } },
};
```

## Review and document previews

`BillReadOnlyForm` displays the form family and available revenue, tooth/surface, NDC/quantity, and prescription identifiers. `BillReviewForm` retains bill and line metadata on saves, including revenue-only and NDC-only service lines. It does not merge compound ingredient lines. Readonly billing snapshots remain excluded from editable save requests.

Hosts can open the matching paper form from `ConnectedBillLifecycle` or `ConnectedBillingWorkspace`:

```tsx
<ConnectedBillLifecycle
  {...lifecycleProps}
  onOpenClaimForm={(billId, claimForm) => openHostDocument(billId, claimForm)}
/>
```

`onOpenClaimForm` takes precedence over `onOpenCms1500`. The existing CMS-1500 callback still works for professional bills and is not invoked for other form families.

## Entry and validation boundaries

The general `BillSubmissionForm` remains a professional-first entry and correction form. Its draft contract preserves specialty metadata, but it does not add institutional or pharmacy field-entry wizards. Use host-managed entry and the server API for those workflows. The existing `DentalDraftEditor` remains a host-managed preparation component; see [treatment drafts](treatment-drafts.md).

Server validation, payer capability, clearinghouse enrollment, attachment matching, and acknowledgment results still determine whether a submission is accepted. Installing this SDK does not certify a clearinghouse route or guarantee payment.
