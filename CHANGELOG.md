# Changelog

## Unreleased

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
