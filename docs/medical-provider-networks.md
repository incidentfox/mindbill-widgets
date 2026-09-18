# Medical provider networks

`BillSubmissionForm` includes **Medical provider network (optional)** in its claim section. Users can leave it blank, search by network name, applicant name, or MPN ID, select with the keyboard or pointer, and clear a selection. Typing alone never saves an identifier. Only directory records whose status is `Approved` appear; terminated and withdrawn records are excluded.

Connected bill entry loads the directory through the existing short-lived browser session. Hosts using a custom `onSubmit` can pass `onListMedicalProviderNetworks` or configure a session for the reference client. `BillReviewForm` accepts the same loader. `ConnectedBillLifecycle` supplies it for corrections, duplicates, and new bills.

```tsx
import { useMemo, useState } from "react";
import { createBillReferenceClient } from "@mindbill/browser";
import { MedicalProviderNetworkSelect } from "@mindbill/react";

function InjuryNetwork() {
  const [networkId, setNetworkId] = useState("");
  const references = useMemo(() => createBillReferenceClient({
    sessionEndpoint: "/api/mindbill/session",
  }), []);
  return <MedicalProviderNetworkSelect
    value={networkId}
    onChange={setNetworkId}
    loadOptions={references.listMedicalProviderNetworks}
  />;
}
```

Mint short-lived, origin-bound sessions on your server. Never give a browser a permanent API key.

The browser client calls `GET /partner/v2/medical-provider-networks` and expects `{ data: MedicalProviderNetwork[], total: number }`. The endpoint returns the full active directory when no limit is supplied; search is local. Each record contains string `id`, `name`, `applicantName`, and `status`, with optional `applicantType`, `approvalDate`, and `website`. Custom loaders must return the same record shape; the selector also filters their results to `Approved`. Keep loaders stable between renders, for example with `useCallback` or a memoized client.

Bill creation uses `bill.claim.medicalProviderNetworkId`; review saves use `injuryOverrides.medicalProviderNetworkId`. IDs are strings and preserve leading zeros. An omitted update leaves the saved field unchanged; `null` explicitly clears it. The controlled selector uses an empty string for its blank value, and the bill forms translate a cleared value to `null`.

Lifecycle data returns the ID in `injury.medicalProviderNetworkId`. Entry/review hydrate approved IDs to directory names, and read-only details show the MPN ID. A saved historical ID remains visible even when it no longer appears in the approved directory. It is preserved until the user clears or replaces it; inactive entries cannot be newly selected. Directory failures show a retry action and do not make this optional field required.
