# California claim fee calculator

`FeeScheduleCalculator` in `@mindbill/react` 0.63.0 uses `quoteClaimFees` in `@mindbill/browser` 0.39.0. It sends all entered services together to `POST /partner/v2/fee-quotes/ca/claim`, so the server can assess same-day edits and calculate fees for the actual service dates. The workspace must have treatment billing enabled.

```tsx
import { useMemo } from 'react';
import { createBillReferenceClient } from '@mindbill/browser';
import { FeeScheduleCalculator } from '@mindbill/react';

export function Calculator() {
  const client = useMemo(() => createBillReferenceClient({
    sessionEndpoint: '/api/mindbill/session',
  }), []);
  return <FeeScheduleCalculator client={client} />;
}
```

The trusted host server supplies an origin-bound, short-lived browser session with `bills:read`. Keep permanent API keys on the server. A bill ID is not needed. Hosts can instead provide `getSession: async () => ({ token })` to the reference client.

## Inputs

The widget accepts multiple procedure lines with independent service dates, modifiers, units, optional charges, service ZIP/county, provider type, place of service, and audio/video or audio-only telehealth context. Physical therapy adds treatment minutes, assistant involvement, and relevant provider context. Enter all services for one patient by one provider or group on the specified dates. The widget treats that scope and documented coding requirements as implicit; it does not add attestation checkboxes.

`initialLines` accepts `CaClaimFeeQuoteInput['lines']`. Host-supplied anesthesia, injectable-drug, and equipment context is preserved. The widget does not currently provide editors for every specialty field; integrations collecting those fields should pass them in initial lines or call `quoteClaimFees` directly. See the existing specialty guides for those input contracts.

`onQuote(result)` receives the server's `CaClaimFeeQuoteResult`. Optional `appearance`, `className`, and `style` customize the container. Changing inputs clears the prior result, and an older in-flight response cannot replace a newer form state.

## Reading results

The result shows each line's status, fee calculation and available RVU/GPCI components, conversion factor, provider adjustment, source files, regulation links and effective dates. Claim edits and review reasons remain visible alongside line-level findings. A source URL is clickable only when it uses HTTPS.

`pricedSubtotalCents` can include reference fees for lines that still need review. Only a non-null `estimatedPayableCents` is displayed as an estimated payable total. Missing data, unsupported context, or an incomplete edit assessment must not be treated as a confirmed allowance. A quote does not submit a bill or change the entered charge. Prices and coverage come from the server; the widget has no local rates or geographic defaults.

## Imaging professional components and sessions

For eligible imaging services billed with modifier `26`, the calculator can send actual imaging-session references and show the server's ranking and professional-component reduction. [California section 9789.17.1](https://www.dir.ca.gov/t8/9789_17_1.html) groups imaging by actual session, patient, service date and physician or physician group. Sharing a date does not establish a shared session.

Enter the services and their actual session and interpretation location in the calculator, or supply those facts through `initialLines`:

```tsx
const lines = ['72148', '72141'].map((code, index) => ({
  id: `imaging-${index + 1}`,
  code,
  dateOfService: '2026-09-17',
  units: 1,
  modifiers: ['26'],
  serviceZip: '90012',
  professionalComponentContext: {
    interpretationLocation: 'same_as_patient_service' as const,
    imagingSessionReference: 'session-1',
    completeSameDayImagingServices: true,
  },
}));
```

The calculator is a full-encounter workflow: include all relevant imaging for this patient, physician or group, and date, including services billed elsewhere. All services must belong to the same physician or group; group membership means the same group NPI. The calculator sends `completeSameDayImagingServices: true` for entered professional-component context unless the host explicitly supplied `false`. An explicit `false` remains incomplete and subject to review after edits.

Direct `quoteClaimFees` and API callers must still supply `completeSameDayImagingServices: true` only when the complete encounter is known, alongside `completeDateOfServiceContext: true`. Omitting either fact or supplying `false` does not establish completeness for the server.

The session reference is an opaque label of 1–64 letters, numbers, periods, underscores, colons or hyphens, starting with a letter or number. Do not put patient identifiers in it. The calculator never derives a session or interpretation location from the service date. Users can edit these facts and add, remove, or change services, then recalculate in the same form. Every edit clears the entire displayed quote and discards pending responses so that the server reassesses all current lines together.

The server currently supports a narrow 2026-and-later professional-component pathway: distinct eligible procedure codes, modifier `26`, one unit, physician services, and interpretation at the same physical location as the patient service. Its date-specific source files and indicators determine eligibility. Missing encounter facts, repeated procedures, mixed components, or unsupported adjustments remain review outcomes. The widget displays the server's calculation, including the highest service at 100% and subsequent eligible services in that actual session at 95%; it does not calculate or rank fees locally.

`BillSubmissionForm` uses individual service estimates and does not allocate imaging session reductions. Multiple same-day professional services remain subject to review there. Use `FeeScheduleCalculator` or `quoteClaimFees` for the complete-encounter calculation. The browser and Node SDKs both expose `CaProfessionalComponentContext` for integrations that collect these facts themselves.

## MRI technical components

For modifier `TC`, the calculator adds four service facts: whether the billing provider or group furnished the service, hospital patient status, supervision level, and the actual imaging session reference. These fields start unspecified. An entirely unspecified context goes to the server for review; a partially completed context must be completed before requesting another estimate. The calculator never assumes that a service was furnished by the group, that the patient was outside a hospital, or that a particular supervision level applied.

The current server pathway covers distinct `70551-TC`, `72141-TC` and `72148-TC`, each with one unit, for physician office services using the reviewed July 2026 RVU edition. It requires services actually furnished by the billing provider or group, a nonhospital patient, documented supervision and session, and an actual service ZIP. The server verifies the applicable source edition and requires review for unsupported dates, other codes, repeated procedures, mixed components, purchased or outsourced services, hospital patients, and cases where the outpatient hospital payment cap would reduce the fee. This is not general technical-component coverage.

Hosts can supply the same documented facts through `initialLines`. Both browser and Node SDKs export `CaTechnicalComponentContext`; all five fields are required when the object is supplied:

```tsx
const technicalLine = {
  id: 'technical-1',
  code: '70551',
  dateOfService: '2026-07-15',
  modifiers: ['TC'],
  units: 1,
  serviceZip: '90001',
  technicalComponentContext: {
    performedByBillingProviderGroup: true,
    patientHospitalStatus: 'not_hospital_patient' as const,
    supervisionLevel: 'general' as const,
    imagingSessionReference: 'session-1',
    completeSameDayImagingServices: true,
  },
};
```

These example values describe a synthetic encounter; integrations must use the actual facts. The full-encounter calculator supplies imaging completeness from its documented scope, while preserving a host-supplied `completeSameDayImagingServices: false` through all edits. Direct API calls still need explicit complete-date and complete-imaging context. Session references follow the same format as professional components and must never contain patient identifiers.

Use `quoteClaimFees` even for a single technical service. The server applies [section 9789.17.1](https://www.dir.ca.gov/t8/9789_17_1.html): the highest eligible technical fee in each actual session is paid at 100%, with subsequent eligible technical components at 50%. The calculator displays the server's session ranking, cap assessment, calculation steps, edit findings and regulation citations; it does not rank or reduce fees locally. Changes to any line or fact clear the entire quote and discard pending responses.

`BillSubmissionForm` preserves host-supplied technical context but does not provide its editor or a claim-level technical allocation. Its individual-line estimates cannot establish the payable technical total; use the claim calculator for that assessment.
