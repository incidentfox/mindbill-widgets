# Changelog

## 0.80.0 — @mindbill/react 0.80.0 / @mindbill/browser 0.53.0

### Changed
- `BillSubmissionForm` / `ConnectedTreatmentBillForm`: a billing provider, rendering provider or service location
  that matches a saved choice in `profileOptions` shows as a one-line summary with **Edit** instead of every field
  (new default `profileDisplay="auto"`). Missing or invalid values, submit errors and `attentionFields` open the
  section and focus the field. `profileDisplay="expanded"` restores the previous layout.
- Encounter treatment editor: an empty line charge (for example from an approved RFA) is prefilled from the
  practice's saved charge for the code, else the expected OMFS amount. Typed charges are never replaced; charges
  display with cents.
- Every checkbox, radio and file picker in the widgets is a styled control (`Checkbox`, `Radio`, `FileInput`);
  no native checkbox, radio, select or visible file input remains. Behavior, names and form values are unchanged.

### Added
- `@mindbill/browser`: `BillFeeQuote.practiceChargeCents`, set by `encounterBillFeeQuotes`.

## 0.79.4 — @mindbill/react 0.79.4

### Fixed
- RFA deadlines: every surface (detail header, treatment panel, lists, task board, follow-ups) formats the
  decision due date on its Pacific calendar day through one helper, so a header can no longer say Oct 14 while a
  panel says 10/15. New exports in `rfa-decision-due`: `rfaPacificDate`, `rfaPacificDateTime`.
- Record UR decision dialog: the UR letter is chosen through a styled button or by dropping the PDF, never the
  browser's native file control; the evidence upload uses the same picker.
- Embedded PDF review hides the browser viewer toolbar, whose title came from the PDF metadata or blob URL
  (often "about:blank"); an "Open in new tab" link gives the full viewer.
- A UR response matched from an inbound fax shows Received as the fax's arrival time when the server sends
  `receivedAt` on the document.

### Added
- `BillSubmissionForm` / `ConnectedTreatmentBillForm` prop `linkedAuthorizations`: lines whose procedure code
  matches an approved authorization link to it as they are entered and the treatment authorization number fills
  in (never overwriting a number the biller typed). Helper `linkBillSubmissionAuthorizations`.

## 0.79.3 — @mindbill/react 0.79.3

### Fixed
- `ConnectedBillLifecycle` / `BillReadOnlyForm`: service line totals show Charge, Expected (OMFS), Paid and
  Balance (expected − paid), so the balance is never mistaken for the billed charge. New optional
  `BillReadOnlyForm` prop `expectedAmount`. The bill action bar is opaque.
- RFA decision dialog: a decision read from a date-only UR letter defaults to the start of that day in the
  user's time zone, and never to a time later than now (previously noon Pacific, which could be in the future).

## 0.79.2 — @mindbill/react 0.79.2

### Fixed
- `ConnectedTreatmentBillForm` (and `BillSubmissionForm` with `onQuoteEncounter`): standard lines are submitted
  without the form's estimate-only fee context, so the saved bill is priced exactly as the encounter quote showed.
- When MindBill refuses a line at submission because a coding fact must be confirmed
  (`code_specific_coding_requirements_not_confirmed`, `complete_surgical_package_required`, e.g. 64483), the form
  shows a confirmation on that line instead of a dead-end error; confirming sends the fact with the line.

### Added
- `RfaDashboard` (simple layout, sandbox, `act` permission): **Send** signs the request (with `sign`) and records a
  simulated send in History, so sandbox integrations can test receipt, UR decisions and billing. Nothing is
  faxed or e-mailed; live behavior is unchanged.

## 0.79.1 — @mindbill/react 0.79.1

### Added
- `RfaDashboard` `initialSupportingDocuments`: PDFs (such as a clinical report the host already has) listed as
  supporting documents when the creation form opens; they upload only after the user saves the draft.

### Fixed
- A prepared `initialDraft` on the official form now loads the saved employee date of birth, employer,
  physician specialty and return fax/e-mail, as the selection flow does.

## 0.79.0 — @mindbill/react 0.79.0, @mindbill/browser 0.52.0

### Added
- `ConnectedTreatmentBillForm`: `drafts` adds **Save draft** (saves the bill as entered to
  `/partner/v2/bill-drafts`, never sent); `draftId` resumes a saved draft (its bill and pricing ids), and
  submitting it marks the draft submitted. Also `draftExternalId`, `onDraftSaved`, `onDraftError`.
  `encounter` ids may be partial when resuming (missing ids come from the draft).
- `BillSubmissionForm`: optional `onSaveDraft` / `saveDraftLabel` (secondary "Save draft" action, no
  validation) and `draft: { id, revision }` (forwarded on submission).
- `@mindbill/browser`: `createBillDraftsClient` (`list`, `get`, `create`, `update`, `remove`) and types
  `BillDraft`, `BillDraftReference`, `BillDraftSaveInput`; `BrowserBillSubmissionInput.draft`.

## 0.78.0 — @mindbill/react 0.78.0, @mindbill/browser 0.51.0, @mindbill/angular 0.20.0 (sdk-v2026.10.16.1)

### Added
- `@mindbill/react`: `RfaClaimIndex`, `RelatedAuthorizationRecords` and `BillUrDecisions`, the claim RFA
  index, related bills/authorizations and bill UR decision surfaces used by MindBill
  ([docs/rfa-records.md](docs/rfa-records.md)). Helpers `rfaReference`, `claimRfaLifecycle`, `claimRfaCounts`.
- `@mindbill/browser`: `createRfaRecordsClient` (`listClaimRfas`, `listRelated`, `listBillUrDecisions`,
  `attachBillUrDecisions`, `getRfaDocument`) and `claimRfaSummary`. Requires the MindBill
  `/partner/v2/rfas/related` and `/partner/v2/bills/{id}/ur-decisions` endpoints.
- `@mindbill/react`: `ConnectedTreatmentBillForm`: the treatment bill form with Charge, Expected (OMFS) and
  Difference per line, priced together as one visit through `POST /partner/v2/fee-quotes/encounter`
  ([docs/treatment-billing.md](docs/treatment-billing.md)).
- `@mindbill/browser`: `quoteEncounter` on the bill reference/lifecycle clients, plus `encounterQuoteRequest`,
  `encounterBillFeeQuotes`, `createEncounterQuoter` and `parseEncounterQuote`.
- `@mindbill/browser`: RFA client `previewForm`, `previewDraft`, `readResponse`, `listTemplates`, `saveTemplate`
  and `exportCsv`.
- `RfaDashboard` (official form): when the host does not supply them, form and draft previews open in the
  built-in viewer, UR responses are read with `readResponse`, and saved treatment templates load and save
  through the partner API. Host props still take precedence.

### Changed
- `@mindbill/browser`: `getCreationContext` and `saveProviderSignature` call the canonical
  `/partner/v2/rfas/creation-context` and `/partner/v2/rfas/providers/{id}/signature` routes instead of the
  legacy `/browser/` aliases.

### Breaking (next minor: @mindbill/react 0.78.0, @mindbill/browser 0.51.0, @mindbill/angular 0.20.0)

Older versions remain on npm. Under 0.x semver, `^0.77` ranges do not pick up 0.78.0, so
existing installs are unaffected until you upgrade.

#### Removed

| Package | Removed | Use instead |
|---|---|---|
| `@mindbill/react` | `BillReviewForm`, `buildBillReviewSaveInput`, types `BillReviewFormProps`, `BillReviewDraft` | `BillSubmissionForm` (new bills) and `ConnectedBillLifecycle` (corrections, duplicates, review) |
| `@mindbill/react` | `RfaTrackingPanel`, type `RfaTrackingPanelProps` | `RfaDashboard`; its RFA detail page renders the same tracking cards |
| `@mindbill/browser` | `sanitizeBillReviewSaveInput` | Not needed; it only served `BillReviewForm` |

#### No longer exported (internal helpers with no known consumer)

`@mindbill/react`:
- Bill entry helpers: `applyBillSubmissionEvaluationDiagnoses`, `applyBillSubmissionEvaluationModifiers`,
  `chooseClaimsAdministrator`, `normalizeClaimsAdministratorName`, `submittedClaimsAdministrator`,
  `exactClaimsAdministratorMatch`, `claimsAdministratorRecommendations`, `ensureTrailingBillSubmissionLine`,
  `formatBillSubmissionDate`, `parseBillSubmissionDate`, `prepareBillSubmissionDocuments`,
  `MED_LEGAL_REPORT_TYPE_CODE`, `PSYCH_QME_DEFAULT_DIAGNOSIS`, `BILL_SUBMISSION_DOCUMENT_TYPES`.
  `BillSubmissionForm` applies these itself; use `validateBillSubmission` and
  `BILL_SUBMISSION_REQUIRED_FIELDS` for non-visual checks.
- Catalog constants: `BILL_SUBMISSION_DIAGNOSIS_QUICK_PICKS`, `DEFAULT_BILL_SUBMISSION_MODIFIERS`,
  `DEFAULT_BILL_SUBMISSION_PROCEDURES`, `DEFAULT_BILL_SUBMISSION_TAXONOMIES`
  (`calculateBillSubmissionAllowedAmount` stays).
- Re-exports of `@mindbill/browser` values — import them from `@mindbill/browser` instead:
  `BILL_TASKS_AGING_BUCKETS`, `billTasksAgingBucketIndex`, `SECOND_REVIEW_REASON_TEMPLATE`,
  `SECOND_REVIEW_WINDOW_DAYS`, `secondReviewDeadline`, `reportBillStatusContacts`.
- Lifecycle and dashboard internals: `billActivityEventLabel`, `isBillLifecycleDraft`,
  `visibleBillLifecycleActions`, `billAgingDays`, `billAgingBucket`, `BILL_STATUS_AGING_BUCKETS`,
  `billSubmissionsRibbonDeliveryLabel`, `SECOND_REVIEW_REASON_TEMPLATES`.
- Dialog and RFA internals: `extractSendRouteEmail`, `formatSendRouteFax`, `rfaForwardContactOptions`,
  `applyRfaTemplate`, `rfaTemplateItems`.

`@mindbill/angular` (components keep working; these were implementation details):
`billRejectionIssues`, `billRejectionIssueSummary`, `MINDBILL_BILL_TASKS_TONES`,
`MINDBILL_BILL_TASKS_PILL_BASES`, `mindBillBillTasksTone`, `mindBillBillTasksPillBase`,
`mindBillBillTasksCell`, `MINDBILL_STATUS_AGING_BUCKETS`, `MindBillComboBoxComponent`,
`MindBillDateInputComponent`, `parseMindBillSubmissionDate`, `formatMindBillSubmissionDate`,
`mindBillCustomProcedureOption`. The related types (`MindBillBillTasksCell`,
`MindBillComboOption`, `MindBillProcedureComboOption`, `MindBillStatusAging*`) and
`buildMindBillStatusAgingMatrix` / `buildMindBillStatusAgingCsv` remain exported.

#### Unchanged

No component behavior changes. The deprecated `BillSubmissionForm` props
`onSearchClaimsAdministrators` and `claimsAdministratorHint` remain because
`ConnectedBillLifecycle` still uses them internally; prefer `onListClaimsAdministrators` and
`claimsAdministratorSources` in new code.
