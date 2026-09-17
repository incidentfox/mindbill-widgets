# California anesthesia

The existing treatment `BillSubmissionForm` opens anesthesia details for candidate anesthesia procedure codes. Enter the actual elapsed anesthesia minutes and select the documented circumstances. Keep the service quantity at **1** and select modifier **AA** from the default modifier dropdown for a physician who personally performed the entire case alone. The existing shared or per-line diagnosis selector continues to apply.

Personal performance requires one qualifying case, documented coding and timing requirements, and a complete bill containing every same-day patient service. Physician medical direction is a separate path described below. Supported places of service are 11, 19, 21, 22, 23 and 24. The form derives the place of service and checks for additional or overlapping service lines. Missing details, unsupported provider arrangements, additional same-day patient services, date ranges, and special obstetric or burn services require review. A code appearing in the dropdown does not establish a payable fee.

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

## Monitored anesthesia care (MAC)

Choose monitored care and add **QS** alongside **AA** or **QK**. The form collects the documented medical necessity, physiological monitoring, preparedness to convert or respond to an adverse reaction, perioperative care, underlying procedure category and provider relationship. It does not assume these clinical facts. Missing or negative facts prevent a price request with a stale context. Same-provider services and unsupported procedure combinations remain server review outcomes.

## Physician medical direction

Choose medical direction and add **QK**. The structured editor collects a complete overlapping case roster across all payers, the billed case reference, anesthetist roles and qualification records, directing/group physicians, every direction activity, monitoring observations, physician availability intervals and other patient services. Use opaque references, not patient names, in evidence fields. Times are local to the service location; the API represents them as minutes from midnight on the service date. Minutes for the billed service are derived from its interval; quantity stays **1**.

The browser and Node packages expose `CaMedicalDirection`, `CaMedicalDirectionCase`, and `CaMonitoredAnesthesiaCare`. `CaAnesthesiaContext` is a union: `personallyPerformedAlone: true` excludes direction records; `personallyPerformedAlone: false` requires `medicalDirection`. Pass the same context for fee quotes and submitted service lines. Draft recovery preserves all entered records. Incomplete edits remove the previous verified context.

The server evaluates actual timing, physician participation, case concurrency and eligibility. The currently supported direction lane is two through four concurrent cases with an eligible billed anesthetist. Teaching, one-case direction, more than four cases, cataract/iridectomy, overnight billed cases and overlapping other-patient-service exceptions may require review. A complete form does not override the server's review result or establish clinical eligibility.

The estimate displays server-returned base/time units, elapsed minutes, locality, conversion factor, direction concurrency, base reduction, physician payment share, notes and effective-dated authority links. The browser never recomputes the allowance. The calculator's generic line editor still accepts specialty contexts supplied by the host; the structured editors described here belong to `BillSubmissionForm`.
