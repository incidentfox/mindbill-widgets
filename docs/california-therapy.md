# California therapy service details

`BillSubmissionForm` with `treatmentBilling` collects service facts for CPT 97110. Enter the provider type, actual direct one-on-one minutes, total visit minutes, pricing basis, care delivery, billing arrangement, hospital status, payment adjustments and number of visits that day. Empty selections remain unknown; entering minutes alone does not imply no assistant, no fee agreement or other clinical facts.

The form requests a quote only after these details are complete. It preserves supplied `serviceLines[].feeContext.therapyContext` and `hasFeeAgreement` values when loading a bill. Editing or clearing a detail invalidates the previous estimate. Browser and Node SDKs expose the same `CaTherapyContext` shape.

Include every service for the patient and date by the provider or group in the bill. This is part of the form's encounter contract; there is no additional acknowledgement checkbox. Explicit supplied `completeSameDayServices: false` or `otherSameDayServices: true` remains authoritative. Additional overlapping or unknown-date service rows and date ranges require review rather than receiving separate standalone therapy estimates.

## Supported calculation boundary

The existing verified path is one office (place of service 11) 97110 line, personally performed by a physical therapist, with no assistant, incident-to billing, hospital patient status, global-period adjustment, HPSA bonus or negotiated fee agreement. It supports no modifier or GP, one visit, and one through four units with matching documented 15-minute intervals and total visit minutes. Actual minutes must not be rounded to force this path.

Other documented circumstances can be entered truthfully and sent for fee review. This editor does not introduce additional therapy-code pricing, assistant reductions, partial timed-unit allocation or a joint multi-line therapy calculation. A negotiated agreement remains explicit in the request; the server decides whether a supported practice contract applies. The bill does not substitute an entered charge for a verified allowance.

## Authority

California's [therapy MPPR and visit rules, section 9789.15.4](https://www.dir.ca.gov/t8/9789_15_4.html), group same-day services by provider/group across disciplines, reduce the practice-expense component of later units and describe the written-agreement exception to visit limits. These rules are why independently pricing multiple rows is insufficient.

[Section 9789.12.9](https://www.dir.ca.gov/t8/9789_12_9.html) describes the independently practicing physical-therapist indicator and hospital patient restrictions. The editor records the actual patient setting rather than inferring it from a selected provider type. The backend's dated source bundles and rule review determine whether any particular service date is supported.
