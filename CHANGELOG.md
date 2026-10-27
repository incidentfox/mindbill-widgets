# Changelog

## 0.86.1 — @mindbill/react 0.86.1 / @mindbill/angular 0.20.1 / @mindbill/browser 0.55.1

### Fixed
- Correct and resubmit, Submit New Bill and Send duplicate now keep the claim's selected payer (subpayor). For a
  claims administrator that administers several payers (for example Intercare), the corrected bill previously
  dropped the payer, so the delivery-route dialog offered only fax and mail and the correction was saved without
  a payer. The route dialog now offers e-bill again whenever the original bill could be e-billed.
- `BillLifecycleData.injury` types the selected payer (`payerKey`, `payerName`) returned by the MindBill API.

## 0.86.0 — @mindbill/react 0.86.0

### Added
- `BillSubmissionForm` / `ConnectedTreatmentBillForm` `showFeeEstimates` (default `true`). With `false`, the treatment
  bill editor shows only the entered charges: no Expected (OMFS) or Difference columns, fee notes, calculation details
  or OMFS drug dose-evidence section. The fee schedule is informational; the entered charge is always what is billed.
  An empty charge is suggested only from the practice's own saved charge, never from the OMFS estimate.

### Changed
- Treatment (professional) bills show the expected OMFS amount only on the Explanation of Review, labeled
  "Expected (OMFS)" (`BillExplanationOfReview` `expectedLabel`), and no longer in the submitted bill's totals.

## 0.85.0 — @mindbill/react 0.85.0

### Fixed
- Treatment bills: the NDC entered on a J-code (physician-administered drug) line now always reaches the claim.
  Previously the NDC was sent only when every OMFS dose-evidence field was also completed (drug name, doses,
  two reference URLs and the documented-circumstances attestation); otherwise it was dropped silently and the
  CMS-1500 showed no NDC.

### Changed
- The injectable drug details ask for the claim facts first: 11-digit NDC (hyphens accepted), NDC quantity and
  unit. Dose evidence for the OMFS drug fee check moves to its own optional section. A partly entered NDC is
  highlighted and blocks preview/submission. Requires a MindBill server that bills J-code lines with NDC claim
  facts at the entered charge.

## 0.84.1 — @mindbill/react 0.84.1

### Fixed
- Post payment: the deposit date is now the shared date field, so a date typed as MM/DD/YYYY (as the field
  suggested) is sent in the YYYY-MM-DD format the API requires. Previously a typed date was sent as written, the
  API rejected the payment, and nothing was posted.
- Post payment: a payment the API rejects now shows its error inside the dialog instead of behind it.

## 0.84.0 — @mindbill/react 0.84.0 / @mindbill/browser 0.55.0

### Added
- Second Review: recommended IBR decisions (favorable determinations on the same code and denial reason, with an
  original DWC PDF) are cited automatically in the pre-filled reason of the lines they support, worded exactly as
  MindBill's own Second Review cites them. Each related decision has a "Cite in the reason and enclose the decision"
  checkbox; unchecking removes the citation line. Cited decisions are sent as `ibrDecisionIds`, and MindBill
  attaches and encloses each original decision PDF in the Second Review packet. Requires a MindBill server that
  accepts `ibrDecisionIds` on the `second_review` action.
- `@mindbill/browser`: `SubmitSecondReviewInput.ibrDecisionIds`, `secondReviewIbrCitationLine`,
  `appendSecondReviewIbrCitations` and `removeSecondReviewIbrCitation`.

## 0.83.0 — @mindbill/react 0.83.0 / @mindbill/browser 0.54.0

### Added
- Second Review: the form pre-fills each service line's reason from the EOR the same way MindBill's own Second
  Review screen does (a saved reason first, otherwise the matching system template with the bill's facts filled
  in), and lists related IBR decisions with their outcome, code, date and a link to the DWC decision. Suggestions
  never overwrite text the reviewer has typed; edited lines are marked, lines without a clear match ask for the
  facts, and the form keeps working with the reason templates if suggestions cannot be loaded.
- `@mindbill/browser`: `getSecondReviewSuggestions(lineItemIds?)` on the bill lifecycle client and the
  `SecondReviewSuggestions` types. `SecondReviewForm` accepts an optional `getSuggestions`.

## 0.82.1 — @mindbill/react 0.82.1

### Fixed
- The procedure picker shows descriptions for G2211 (visit complexity add-on), 64454 (genicular nerve block) and
  64624 (genicular nerve destruction).

## 0.82.0 — @mindbill/react 0.82.0

### Changed
- Treatment bills: the bill's diagnoses are listed A–L (Box 21, up to 12). Each service line toggles up to four of
  them as pointers (any combination, e.g. ABCD, ABCF, ABEG) instead of retyping codes; a code not on the bill can
  still be searched and joins the list. Changing a line's pointers no longer drops the bill's other diagnoses, and
  new lines start pointed at the first four (A–D) instead of only the first.
- Treatment lines: the modifier directory adds the professional CPT and HCPCS modifiers (LT/RT, digits, eyelids,
  coronary, 22/24/50/51/52/53/57/58/62/76–82/91/99, JW/JZ/JA/JB, GA/GC/GT/GX/GY/GZ, KX, Q5/Q6, QW, SA/SB/SH, T1–TA,
  UN–US, AS/AT/CR/CS); 96/97 read as habilitative/rehabilitative. An exact code typed in a code picker is listed first.
- A treatment line with a billed charge entered that the fee schedule cannot estimate shows "Billed at your charge"
  with the reason as a note, and the total counts it separately instead of as needing review.
- Treatment bills default attachments to report type 09 (PR2 Progress Report) unless `defaultAttachmentReportType`
  is set.
- Official DWC RFA form: the first requested treatment starts with the claim's primary diagnosis.

### Fixed
- RFA physician signature setup accepts JPEG as well as PNG; images are converted to PNG in the browser and scaled
  to MindBill's limits. After saving a signature from the send dialog, Send works without reloading the page.

## 0.81.0 — @mindbill/react 0.81.0

### Added
- `BillSubmissionForm` / `ConnectedTreatmentBillForm`: `initialUploads` lists files as attachments when the form
  opens (for example the PR-2 a host already read to prefill the bill). They upload with the bill like files the
  user chooses, keep their document type, report type and description, and can be removed.

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

### Fixed
- RFA decision dialog: the decision date default never precedes the request's send/receipt.

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
