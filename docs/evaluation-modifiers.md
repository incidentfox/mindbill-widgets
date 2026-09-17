# Evaluation modifier defaults

`BillSubmissionForm` supports `qme`, `ame`, `psych_qme`, and `psych_ame` evaluation types. The selector combines evaluator role with psychiatric or psychological evaluation status:

| Evaluation type | ML201, ML202, ML203 | ML200 and MLPRR |
| --- | --- | --- |
| QME | 95 | 95 |
| AME | 94 | None |
| Psych QME | 95, 96 | 95 |
| Psych AME | 94, 96 | None |

Switching evaluation type replaces modifiers 94, 95, and 96 while preserving other selected modifiers. Psychiatric multipliers do not apply to missed appointments or record-review lines. The initial selection considers both the rendering provider's specialty and `isAme` flag. Both psychiatric modes seed `Z04.6` only when no diagnosis was supplied.

These defaults follow [California 8 CCR section 9795](https://www.dir.ca.gov/t8/9795.html). Modifier 96 applies when psychiatric or psychological evaluation is the primary focus. The user should select the mode appropriate to the actual evaluation.

## Treatment modifiers

In treatment mode, a bill containing only treatment lines shows **Service lines**
without the evaluator selector. Adding a medical-legal line restores that selector;
its defaults still apply only to medical-legal codes. Medical-legal and treatment
services must be submitted on separate bills.

Modifier descriptions follow the line's code and service date. Medical-legal `93`
and `95` retain their interpreter and QME meanings. For California treatment from
February 1, 2025, `93` identifies real-time audio-only telehealth and `95` identifies
real-time audio/video telehealth. Earlier treatment dates describe `95` as
telehealth subject to service eligibility; it must not be interpreted as proof of
video use. The [2026 California physician regulations, section 9789.19](https://www.dir.ca.gov/dwc/FeeSchedules/Physician/PhysicianFeeSchedule/2026/Text-of-Regulations/Text-of-regulations-clean.docx)
retain both the historical and current adoption rules. Selecting a modifier does
not establish that a procedure or service date is eligible for telehealth pricing.

The catalog also includes:

- `25`: a significant, separately identifiable evaluation and management service
  on the same day as another service or procedure ([CMS NCCI FAQ](https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-faq-library)).
- `GP`, `GO`, `GN`: physical therapy, occupational therapy and speech-language
  pathology plans of care, respectively ([CMS Claims Processing Manual, chapter 5](https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/clm104c05.pdf)).
- `CQ`, `CO`: physical therapist assistant and occupational therapy assistant
  services, used with `GP` and `GO`, respectively ([CMS assistant modifier guidance](https://www.cms.gov/medicare/coding-billing/therapy-services/billing-examples-using-cq-co-modifiers-services-furnished-whole-or-part-ptas-otas)).

These are documentation choices, not pricing guarantees. Unsupported service
contexts, assistant services, incomplete details and fee agreements can still
require review. The form translates common fee-review reasons into plain language
and wraps long help text on narrow screens; it does not change the returned quote
status, fee amount or submission checks. Unknown machine reason codes display a
neutral review message. The host's `modifierOptions` still overrides default
labels by code.
