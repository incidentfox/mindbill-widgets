# Specialty bill capture

The next coordinated release is `@mindbill/browser` 0.38.0, `@mindbill/node` 0.16.0 and `@mindbill/react` 0.62.0. These versions are prepared; they are not published by this change.

Use `claimForm` when creating a bill: `cms1500` (professional), `ub04` (institutional), `ada` (dental), or `ncpdp` (pharmacy). Omission keeps professional billing compatible. A saved bill's form family cannot be changed by an update.

The browser and Node packages export `BillFormData`, `BillItemFormData`, `InstitutionalFormData`, `DentalFormData`, `PharmacyFormData`, `PharmacyCompound`, and `CompoundIngredient`. React accepts the same data in `BillSubmissionInput`. Supply bill-level data through `formData` and line-level data through `serviceLines[].formData`. Review saves and correction forms preserve these values and `serviceLines[].drug`.

```ts
import type { BillSubmissionInput } from "@mindbill/react";

const pharmacyFields = {
  claimForm: "ncpdp",
  formData: { pharmacy: { pharmacyServiceType: "01" } },
  serviceLines: [{
    code: "", units: 1.23, charge: 12.34,
    formData: { pharmacy: {
      prescriptionNumber: "SYNTHETIC-RX", compoundCode: "2",
      compound: {
        name: "Synthetic compound", metricQuantity: "1.230", unitOfMeasure: "GR",
        ingredients: [{
          ndcNumber: "00000000001", metricQuantity: "1.230", ingredientCost: "12.340",
        }],
      },
    } },
  }],
} satisfies Pick<BillSubmissionInput, "claimForm" | "formData" | "serviceLines">;
```

This fragment demonstrates capture only; the synthetic NDC is not a production drug. Complete patient, injury, provider, prescription, ingredient, and payer-specific requirements before submission. Preserve compound quantities and ingredient costs as decimal strings. Do not round them to two places.

The React submission form displays the form family, accepts explicit specialty charges and fractional units, and avoids med-legal evaluation defaults and professional fee repricing for specialty bills. Blank procedure codes are allowed for revenue-only institutional and pharmacy lines; dental still requires a CDT code. CMS-1500 retains whole-number units. The host application supplies specialty fields through the typed initial bill; the React widget does not yet provide editors for every institutional locator, dental treatment detail, or compound ingredient.

The billing dashboard shows the family for each bill. Missing family values on older responses display CMS-1500.

## Release and live submission

Publish browser before React, then update the consuming dashboard dependency and lockfile. Node declarations bundle the public shared contracts; consumers do not need browser source files. Run `pnpm check` and `pnpm pack:check` before publishing.

These SDK types do not establish clearinghouse acceptance. Specialty electronic submission remains subject to the server's organization feature flag, form-specific validation, provider and payer route support, and production readiness evidence. Keep the release/deployment hold until the main application's live electronic billing verification is complete. A paper preview or a test file is not evidence of a live submission.
