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

Supply documented encounter facts through `initialLines`:

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

Set `completeSameDayImagingServices: true` only when your application has established that the encounter includes all relevant imaging for this patient, physician or group, and date, including services billed elsewhere. Omit it when unknown; `false` indicates incomplete information. The calculator preserves this fact and never infers it from the number of entered lines. All services must belong to the same physician or group; group membership means the same group NPI.

The session reference is an opaque label of 1–64 letters, numbers, periods, underscores, colons or hyphens, starting with a letter or number. Do not put patient identifiers in it. Users can edit the session reference and interpretation location. All session edits clear the complete displayed quote and discard pending responses. Adding, removing, or changing a service's code, date, units or modifiers also clears host-supplied imaging completeness for every line. After obtaining a refreshed authoritative encounter, remount the calculator with a new React `key` and updated `initialLines`.

The server currently supports a narrow 2026-and-later professional-component pathway: distinct eligible procedure codes, modifier `26`, one unit, physician services, and interpretation at the same physical location as the patient service. Its date-specific source files and indicators determine eligibility. Missing encounter facts, repeated procedures, mixed components, or unsupported adjustments remain review outcomes. The widget displays the server's calculation, including the highest service at 100% and subsequent eligible services in that actual session at 95%; it does not calculate or rank fees locally.

`BillSubmissionForm` uses individual service estimates and does not allocate imaging session reductions. Multiple same-day professional services remain subject to review there. Use `FeeScheduleCalculator` or `quoteClaimFees` for the complete-encounter calculation. The browser and Node SDKs both expose `CaProfessionalComponentContext` for integrations that collect these facts themselves.
