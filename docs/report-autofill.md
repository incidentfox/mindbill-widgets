# Optional report suggestions

Report autofill is available only by written agreement and operator provisioning. It is hidden unless the host opts in. Provisioning must enable the partner organization's `reportAutofill` capability; mint a dedicated organization-wide browser session with `autofill:run`. Keep this session separate from bill-scoped sessions. Server integrations require `autofill:write`.

```tsx
import { BillSubmissionForm } from "@mindbill/react";

<BillSubmissionForm
  initialBill={draft}
  getSession={getBillSession}
  reportAutofill={{ getSession: getReportSession }}
/>
```

The user uploads a non-empty PDF up to 25 MB, reviews extracted values, source excerpts, confidence, warnings and saved-record matches, then clicks **Apply to empty bill fields**. Existing values and service lines are preserved. Provider identity groups already selected or partially entered are preserved together. A unique server match can select an available saved profile only when that profile group is empty. Ambiguous matches require manual selection. Dates must be valid ISO calendar dates. Patient address fields belong to the patient; the evaluation location identifies the service facility.

Suggestions do not create procedures, infer charges, assign diagnosis pointers, save a document, or submit a bill. Review diagnoses and their service-line assignments. Select the claims administrator from the directory before submission. Add the PDF separately to bill attachments when required. The extraction model is `gpt-5.6-luna`; every result requires human review.

For a custom UI, use `createReportAutofillClient` from `@mindbill/browser`, or `ReportAutofill` and `applyReportAutofill` from `@mindbill/react`:

```tsx
<ReportAutofill
  getSession={getReportSession}
  onApply={(suggestions) => setDraft((current) => applyReportAutofill(current, suggestions, profileOptions))}
/>
```

`ReportAutofill` calls the host's `onApply` only after review. The host must use `applyReportAutofill` (or equivalent preservation rules) to keep existing values unchanged. HTTP 403 displays the server's entitlement or permission error; the widget never provisions access automatically.

The browser client calls `POST /partner/v2/report-autofill` with multipart field `report`. It returns `{ model, requiresReview: true, fields, matches, warnings }`. Each field includes `key`, `value`, `sourceText` and `confidence` (`high` or `medium`). Matches for patient, billing provider, rendering provider and service location include `status` (`matched`, `ambiguous`, `none`), candidate IDs/names and an optional uniquely matched `selectedId`.
