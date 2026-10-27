# Evaluation modifier defaults

A medical-legal line's modifiers are the single source of truth for the evaluation: −92 primary treating physician, −94 AME, −95 QME, −96 psychiatric or psychological, −93 interpreter. `BillSubmissionForm` has no separate evaluator-type selector (the `evaluationTypes` prop is accepted but ignored since @mindbill/react 0.87.0), and the fee shown for a line follows its modifiers.

When the biller chooses a medical-legal evaluation code for a line that has no evaluator modifier (−92, −94 or −95), the line starts with the default for the rendering provider:

| Rendering provider | ML201, ML202, ML203 | ML200 and MLPRR |
| --- | --- | --- |
| Default (QME) | 95 | 95 |
| `isAme` | 94 | None |
| Psychiatric specialty | 95, 96 | 95 |
| Psychiatric specialty and `isAme` | 94, 96 | None |

An evaluator modifier already on the line — supplied by the host, a report or the biller — is never replaced. A line supplied without any evaluator modifier is sent as supplied. Psychiatric multipliers do not apply to missed appointments or record-review lines. A psychiatric rendering provider seeds `Z04.6` only when no diagnosis was supplied.

These defaults follow [California 8 CCR section 9795](https://www.dir.ca.gov/t8/9795.html). Modifier 96 applies when psychiatric or psychological evaluation is the primary focus. The biller should keep the modifiers that match the actual evaluation.

Interpreter modifier 93 applies only to ML201 and ML202. The form does not offer it for other codes, removes it when a line changes to another code, prices ML203 without it (a psychiatric supplemental report with 95 and 96 is $1,300), and asks the biller to remove it from an imported ML203 line before submission.

## Treatment modifiers

In treatment mode, a bill containing only treatment lines shows **Service lines**.
Adding a medical-legal line titles the section **Evaluation & service lines**; the
evaluator modifier defaults still apply only to medical-legal codes. A bill with a medical-legal
line is a medical-legal bill; diagnostic tests performed for that evaluation go on
the same bill and are priced from the treatment fee schedule.

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
