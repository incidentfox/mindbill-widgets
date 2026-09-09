# RFA authorization directory

Use `createBillReferenceClient(...).getClaimsAdministratorDirectory(claimsAdminId, injuryState)` with a short-lived embed session authorized for `payers:read`. The client calls `GET /partner/v2/claims-administrators/:id?injuryState=CA`; failed and missing endpoints reject the promise so the host can display a retry/manual-entry state. Clear the previous directory while fetching a different administrator or state, and discard responses from superseded requests.

`authorizationStatus` preserves the directory classification:

| Status | Handling |
| --- | --- |
| `central_fax` | Explicitly select the central fax. |
| `central_email` | Select email; send externally and record delivery. |
| `claim_handling_location_routes` | Select the office handling the claim. |
| `adjuster_specific_required` | Confirm the destination with the handling adjuster. |
| `daisybill_unverified` | No verified directory destination; confirm manually. |
| `profile_not_published` | No current published destination; never reuse an old one automatically. |

`authorizationSource` carries `url` and `observedAt`. This is source observation information, not proof that a payer verified the destination. Contacts expose `location`, `method`, `fax`, `email`, and `phone` separately. A telephone number is never a fax fallback.

```tsx
import { RfaAuthorizationDestination } from "@mindbill/react";

<RfaAuthorizationDestination
  contextKey={`${rfaId}:${claimsAdminId}:${injuryState}`}
  directory={directory}
  loading={directoryLoading}
  error={directoryError}
  onChange={setDestination}
/>
```

The component starts with no destination. `onChange` receives `{method, destination, label, phone?}` or `null`. It resets when request context, routes, loading, or error changes; equivalent data and inline callbacks do not reset a selection. For failed/missing/retired profiles, users can enter a fax confirmed with the handling adjuster. Invalid manual fax values produce `null`.

The host still owns provider signing, required documents, confirmation of the selected destination, and transmission. Only `method === "fax"` may populate a fax recipient. Email selections do not send email. Download the signed packet, send it through the host email service, and record delivery. `RfaDraftForm.providerFax` remains the provider's return fax, not the recipient.

For API-only workflows, `rfaAuthorizationDestinations(directory)` returns the same eligible choices and `normalizeRfaFax` validates manual input. Never automatically choose the first contact.
