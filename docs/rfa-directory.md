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

When using this standalone destination control, the host owns provider signing, required documents, confirmation of the selected destination, and transmission. For embedded draft editing, signing, packet review, and fax controls use [RfaDashboard](rfa-dashboard.md). Only `method === "fax"` may populate a fax recipient. Email selections do not send email. Download the signed packet, send it through the host email service, and record delivery. `RfaDraftForm.providerFax` remains the provider's return fax, not the recipient.

For API-only workflows, `rfaAuthorizationDestinations(directory)` returns the same eligible choices and `normalizeRfaFax` validates manual input. Never automatically choose the first contact.

### Choose contacts while creating or editing a draft

`RfaDashboard` and `RfaCreateForm` use the client's optional
`searchClaimsAdministrators(query, claimNumber?)` and
`getClaimsAdministratorDirectory(id, injuryState?)` methods for a searchable
claims administrator picker. `createRfaClient` implements both methods using the
existing payer directory endpoints. Custom clients may supply these methods;
standalone `RfaDraftForm` accepts the same callbacks as props.

The injury's claims administrator is initially selected. Search by name, then
choose an authorization office or destination to fill the saved contact. The
picker supports arrow keys, Enter, and Escape. Adjuster-specific instructions and
custom fax/email entry remain available. Additional contact fields are collapsed
under “Edit contact details or enter a custom contact.”

Changing the claim or claims administrator clears the previous contact explicitly
with `authorizationContact: null`. Loading the directory preserves an existing
custom contact while editing. Directory lookup failures and late responses never
select a new destination. Saving this information only changes the unsigned draft;
it does not send an RFA or alter the organization's routing settings.
