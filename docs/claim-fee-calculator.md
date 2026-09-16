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
