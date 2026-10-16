# Changelog

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
