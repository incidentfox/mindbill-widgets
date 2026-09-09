# California anesthesia

The existing treatment `BillSubmissionForm` opens anesthesia details for candidate anesthesia procedure codes. Enter the actual elapsed anesthesia minutes and select the documented circumstances. Keep the service quantity at **1** and select modifier **AA** from the default modifier dropdown for a physician who personally performed the entire case alone. The existing shared or per-line diagnosis selector continues to apply.

The current automatic calculation supports one qualifying case, documented coding and timing requirements, and a complete bill containing every same-day service. Supported places of service are 11, 19, 21, 22, 23 and 24. The form derives the place of service and checks for additional or overlapping service lines. Missing details, other providers or circumstances, additional same-day services, date ranges, and special obstetric or burn services require review. A code appearing in the dropdown does not establish a payable fee.

The browser and Node SDKs expose `CaAnesthesiaContext`. A fee request supplies `anesthesiaContext`:

```ts
const anesthesiaContext = {
  providerKind: "physician" as const,
  personallyPerformedAlone: true as const,
  actualMinutes: 61,
  placeOfService: "11",
  completeSameDayServices: true as const,
  otherSameDayServices: false,
  codingRequirementsSatisfied: true as const,
};
```

These facts must come from documentation; do not default the confirmations to true merely to obtain a price. Actual minutes must be a whole number from 1 through 1,440. Editing or clearing the minutes, procedure, modifiers, service quantity, date, location or circumstances invalidates the previous estimate. Return the server's review outcome when the new request cannot be priced.

A successful quote has `basis: "ca_anesthesia"`. Its `amountCents` is the total line amount; do not multiply it by elapsed minutes or service quantity. The backend uses the reviewed California conversion factor for the service date and locality, anesthesia base units, and elapsed time converted into time units. Source provenance accompanies the result. A practice rate needs an explicit anesthesia calculation basis and currently requires review.

Forward the exact context in `serviceLines[].feeContext.anesthesiaContext` and keep `serviceLines[].units` at 1. The API recomputes the fee against the submitted bill. Claim generation uses the verified actual minutes in CMS-1500 field 24G and electronic claim minute units (`MJ`); it does not report the converted fee-calculation time units. This disclosure uses the existing treatment feature gate and does not enable treatment billing for additional organizations.
