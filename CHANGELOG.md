# Changelog

## 0.90.0 — @mindbill/react 0.90.0

No server or host code changes are required.

### Changed
- `SendRouteDialog` (and the `BillSubmissionForm` delivery dialog): **Preview packet** is now **View packet** and
  opens the packet PDF directly in a new browser tab, so billers can check it without leaving or cancelling the send
  dialog. The tab is opened from the click itself, so popup blockers allow it; if the browser still refuses (or the
  widget runs in a sandboxed iframe without `allow-popups`), the packet is shown inline in the dialog as before.

## 0.89.0 — @mindbill/react 0.89.0 / @mindbill/browser 0.58.0 / @mindbill/angular 0.23.0

No server changes are required: the composed address still travels as `destination.mailingAddress`.

### Changed
- `SendRouteDialog` (and the `BillSubmissionForm` delivery dialog): the free-text mailing-address box is replaced by
  separate **Address line 1**, **Address line 2** (optional suite/floor/PMB/attention), **City**, **State** and **ZIP**
  fields, prefilled by splitting the address on file, with per-field errors. **Mail Bill** is disabled until the
  address is valid. The fields are sent as `line1[, line2], City, ST ZIP`.
- `OrganizationAdministration` custom claims administrators: the mailing address uses the same fields (still
  optional); a partly entered address must be completed before saving.
- `@mindbill/angular` Send Duplicate by mail uses the same structured fields.

### Added
- `MailingAddressFields` React component.
- `@mindbill/browser` (re-exported by `@mindbill/react`): `parseMailingAddress`, `composeMailingAddress`,
  `validateMailingAddress`, `isMailingAddressValid`, `EMPTY_MAILING_ADDRESS`, and the `MailingAddressParts` type.

## 0.88.1 — @mindbill/react 0.88.1 / @mindbill/browser 0.57.1

### Added
- `BillSubmissionForm` **+ Add new doctor** and **Add / Replace signature** now work with the form's own
  organization-wide `bills:create` session — no `billingSettings` needed. The doctor (and optional signature) is
  saved for future bills, the picker refreshes and the doctor is selected on the bill. `billingSettings` still wins
  when passed. Older servers that refuse the bill session fall back to filling this bill only, with a note.
  A doctor whose NPI is already saved is selected instead of duplicated. Editing saved doctors stays in settings.
- `@mindbill/browser`: `OrganizationClient.addRenderingProvider()` (add-only; `rendering_provider_exists` errors
  carry `existingProviderId`).

## 0.88.0 — @mindbill/react 0.88.0 / @mindbill/browser 0.57.0 / @mindbill/angular 0.22.0

Requires a MindBill server with the rendering-provider signature endpoint (deployed 2026-10-28). No host code
changes are required: bump the package versions. Existing `organization:manage` settings sessions can save
signatures; no new permission is needed.

### Added
- **Several doctors under one practice**: `BillingSettings` / `OrganizationOnboarding` list every saved rendering
  provider with NPI, specialty, an **Inactive** marker and signature status, an **Edit** button on each and an
  obvious **+ Add provider** button (replaces the "Add a rendering provider" dropdown option). A newly added doctor
  stays open so their signature can be added right away. Also exported as `RenderingProvidersSettings`.
- **Doctor signatures on bills**: upload a PNG or JPEG signature per doctor (converted to a PNG ≤512 KB in the
  browser), with a preview of the saved signature and **Replace signature**. Bills created afterwards for that
  doctor (matched by rendering NPI) print the image in CMS-1500 Box 31 — in the packet preview and in the sent
  packet. Without one, Box 31 keeps "Signature on File". `@mindbill/browser`:
  `OrganizationClient.getRenderingProviderSignature()` and `saveRenderingProviderSignature()`; saved rendering
  providers carry response-only `signatureConfigured` and `signatureOnClaimForm`. `signaturePngBase64` is exported.
- `BillSubmissionForm`: the rendering-provider picker reads "Which doctor rendered this service?", lists each
  doctor with NPI and specialty, and the collapsed summary offers **Change doctor**. A note under it says whether
  the chosen doctor's signature prints in Box 31, with an **Add a signature** link.
- `BillSubmissionForm` **+ Add new doctor**: an inline panel under the doctor picker (name, NPI, taxonomy,
  specialty, license number/state, optional signature with preview). With `billingSettings` (an
  `organization:manage` session) the doctor and signature are saved for future bills, the picker refreshes, and the
  doctor is selected on the current bill. Without it, the details fill this bill only, with a note.
- `BillSubmissionForm` **Add signature / Replace signature** for the selected saved doctor (with `billingSettings`),
  with a preview of the saved signature.
- `BillSubmissionForm` `onManageSettings`: without `billingSettings`, shows a "Manage doctors & signatures" button
  that opens the host's own settings page. Without either, the form says where doctors and signatures are managed.

### Changed
- The bill form's settings button reads "Add or manage doctors, signatures, locations & W-9" and scrolls the
  settings panel into view.
- `saveBillingProfile` never sends the response-only signature status back (also fixes older settings forms that
  echoed it). `@mindbill/angular` 0.22.0 only moves to `@mindbill/browser` 0.57.0.

## 0.87.0 — @mindbill/react 0.87.0 / @mindbill/browser 0.56.0 / @mindbill/angular 0.21.0

Requires a MindBill server with the packet preview endpoint, cumulative trauma fields and the SDK analytics
endpoint (deployed before this release). No host code changes are required: bump the package versions.

### Added
- **Preview packet** in the delivery-route dialog (new bills, Correct and resubmit, Submit New Bill, Send
  duplicate). It shows the complete packet for the selected route exactly as it would be sent: the fax or mail
  cover sheet when the route uses one, the CMS-1500, the report and other attachments in attachment order, then
  the W-9 (the attached W-9 or the saved billing-provider W-9 MindBill adds). Rendered from the unsaved form; it
  never creates, saves or sends a bill. `@mindbill/browser`: `BillSubmissionClient.previewPacket()`;
  `SendRouteDialog` `onPreviewPacket`.
- **Cumulative trauma (CT)**: a "Cumulative trauma (CT)" checkbox in the claim section with CT start and end
  dates. The wire fields are `claim.injuryType: "cumulative"`, `claim.dateOfInjury` (start) and
  `claim.injuryEndDate` (end); the bill uses the end date unless the claims administrator has a different date
  of injury on file. Hosts can pass them in `initialBill`; report suggestions fill both dates from a CT period,
  and corrections carry them over.
- **Payer (subpayor) suggestion**: under a claims administrator that administers several payers, the form
  preselects the administrator's only (or only e-billable) payer, the payer matching the insurance carrier named
  by the host (`insuranceCarrierName`) or the report, or the payer MindBill bills most often for that
  administrator. The choice is labeled as a suggestion and stays editable, and it is used for the delivery
  preview, so e-bill is offered.
- **Privacy-safe SDK analytics**: components report usage events (mount, view, autofill timing, validation
  failure field paths, previews, route dialog, route chosen, submit and resubmit outcomes with error codes) to
  MindBill. Events carry only closed enums, field paths, durations and the SDK version — never PHI, values or
  free text. Opt out with `analytics={false}` (Angular `[analytics]="false"`); `onAnalyticsEvent` receives every
  event. See [SDK analytics](docs/sdk-analytics.md).
- Browser API requests to MindBill carry an `X-MindBill-SDK` header naming the SDK packages and versions.
- `@mindbill/browser`: API errors are `MindBillApiError` (still an `Error`) with `status` and the API `code`.

### Changed
- Medical-legal bills no longer show the QME / AME / Psych QME / Psych AME selector. Each line's modifiers
  (−94 AME, −95 QME, −96 psychiatric, …) are the single source of truth, and an evaluator modifier supplied by the
  host or a report is never replaced. A medical-legal evaluation code chosen without an evaluator modifier still
  starts with −95. `evaluationTypes` is accepted but ignored.
- Medical-legal bills apply every diagnosis to every service line: the form lists the bill's diagnoses (Box 21,
  up to 12) and points each line to the first four, with no per-line picking. Treatment bills keep per-line
  pointers.
- Medical-legal attachments no longer show a "Document purpose" picker: every file is sent as the med-legal
  report supporting document (`OZ:J4`, document type `final_report`; a file named as a W-9 is sent as the W-9).
  A bill whose `billingMode` is unset is treated as medical-legal unless it is a treatment-only bill, so it never
  asks for a report type per attachment.
- Report suggestions propose only the report's primary diagnoses, at most four.

### Fixed
- A host bill with more than 12 diagnoses, or a line pointing to more than 4, now keeps the first 12 diagnoses and
  each line's first 4 pointers and shows a notice, instead of listing every code (for example 23 codes A–W).
- Correct and resubmit, Submit New Bill and Send duplicate show the payer picker preselected with the carried-over
  payer, so it can be changed without re-selecting the claims administrator.

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
