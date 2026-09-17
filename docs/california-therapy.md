# California therapy service details

`BillSubmissionForm` with `treatmentBilling` collects service facts for timed CPT 97110 and untimed initial PT evaluations 97161, 97162 and 97163. Enter the provider type, actual direct one-on-one minutes, total visit minutes, pricing basis, care delivery, billing arrangement, hospital status, payment adjustments and number of visits that day. Empty selections remain unknown; entering minutes alone does not imply no assistant, no fee agreement or other clinical facts.

The form requests a quote only after these details are complete. It preserves supplied `serviceLines[].feeContext.therapyContext` and `hasFeeAgreement` values when loading a bill. Editing or clearing a detail invalidates the previous estimate. Browser and Node SDKs expose the same `CaTherapyContext` shape.

Include every service for the patient and date by the provider or group in the bill. This is part of the form's encounter contract. Explicit supplied `completeSameDayServices: false` or `otherSameDayServices: true` remains authoritative. Additional overlapping or unknown-date service rows and date ranges require review rather than receiving separate standalone therapy estimates.

## Supported calculation boundary

The existing verified path is one office (place of service 11) 97110 line, personally performed by a physical therapist, with no assistant, incident-to billing, hospital patient status, global-period adjustment, HPSA bonus or negotiated fee agreement. It supports no modifier or GP, one visit, and one through four units with matching documented 15-minute intervals and total visit minutes. Actual minutes must not be rounded to force this path.

Other documented circumstances can be entered truthfully and sent for fee review. This editor does not introduce assistant reductions, partial timed-unit allocation or a joint multi-line therapy calculation. A negotiated agreement remains explicit in the request; the server decides whether a supported practice contract applies. The bill does not substitute an entered charge for a verified allowance.

## Initial PT evaluations

For 97161, 97162 and 97163, select whether an initial evaluation already occurred in this care episode, including earlier dates. An empty choice remains unknown. No minute input is required or sent for these untimed codes; choose the code from documented evaluation complexity, not duration. The calculator also collects the actual pricing basis, provider, delivery and patient-setting facts without assuming clinical negatives.

The verified server boundary is July 1 through September 30, 2026: one unit as the only service that day, office POS 11, personally performed by a physical therapist, no modifier or GP, and no prior initial evaluation in the episode. The same exclusions listed above apply. Earlier/later dates, unknown or prior episode evaluations, additional services, other units and unsupported circumstances require review. This date interval describes verified source coverage, not an expiration of the regulation.

Both the calculator and bill form preserve host-supplied incomplete or additional-service facts. Any changed detail invalidates the prior quote; adding another same-day service requires the server to reassess the complete encounter.

## Authority

California's [therapy MPPR and visit rules, section 9789.15.4](https://www.dir.ca.gov/t8/9789_15_4.html), group same-day services by provider/group across disciplines, reduce the practice-expense component of later units and describe the written-agreement exception to visit limits. These rules are why independently pricing multiple rows is insufficient.

[Section 9789.12.9](https://www.dir.ca.gov/t8/9789_12_9.html) describes the independently practicing physical-therapist indicator and hospital patient restrictions. The editor records the actual patient setting rather than inferring it from a selected provider type. The backend's dated source bundles and rule review determine whether any particular service date is supported.

The initial-evaluation boundary follows the [adopted 2026 physician regulations](https://www.dir.ca.gov/dwc/FeeSchedules/Physician/PhysicianFeeSchedule/2026/Text-of-Regulations/Text-of-regulations-clean.docx), including sections 9789.12.2, 9789.12.9, 9789.12.10, 9789.12.13, 9789.15.1 and 9789.15.4, and [CMS NCCI 2026 Chapter XI](https://www.cms.gov/files/document/2026-ncci-medicare-policy-manual-all-chapters.pdf), sections P and V. The [Medicare Claims Processing Manual, Chapter 5](https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/downloads/clm104c05.pdf), sections 20.1–20.2, distinguishes untimed services from timed units. The backend determines each quote from its effective-date source records.
