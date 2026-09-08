# Recording and code walkthrough

Open the app around 1440 × 1000. Sign in, browse the three fictional records, and click a source number in the summary. Open **Bill** to show the prefilled form, report, and provider W-9. Choose a claims administrator before submitting. Sandbox requests reach MindBill; this is not an offline simulation.

## 1. The host explicitly chooses the component

Open `app/Billing.tsx`.

“The host app explicitly chooses between the create form and the existing-bill component. Passing null to a lifecycle component does not turn it into a create form.”

`useCaseBill` first requests the authorized case association. While that check is loading or failing, no create form appears. With no bill, the host renders `BillSubmissionForm` using the case's stable `externalId`, provider snapshots, attachments, and persisted creation key. With a bill ID, it renders `ConnectedBillLifecycle`.

## 2. The browser asks its own backend for a session

Open `app/billing/session.ts` and `app/api/mindbill/session/route.ts`.

The browser sends a host `caseId`. The route validates its origin and signed-in host user. `sessionScope` calls `authorizeCase`, obtains the case's customer from the server catalog, and checks its saved bill. Browser-supplied customer IDs, bill IDs, permissions, and resources are rejected by this endpoint.

For a new bill, the token is restricted to `{ customerExternalId }` and can create. For an existing bill, its restriction is `{ customerExternalId, billId }` and it cannot create. MindBill enforces both restrictions. The developer key remains in the backend's `MindBillClient`; only the short-lived browser token reaches the component.

The key belongs to the developer workspace and can be used by your apps. There is no required `MINDBILL_ORG_ID`. Workspace ownership does not replace the host's customer access rules.

## 3. Understand the two references

Open `lib/case-identity.ts` and `lib/case.ts`.

`customerExternalId` means “this customer in our host app.” `externalId` means “this logical case bill in our host app.” Neither is the MindBill bill ID. The backend selects the customer, and the form carries the stable case reference so a missed callback can be recovered.

Patient and claim external IDs are separate host references. Provider, service location, and W-9 data are per-bill snapshots. Shared MindBill profiles are optional and managed only by workspace administrators.

## 4. Save the bill on the backend

Open `app/billing/useCaseBill.ts`, then the case API route and `lib/case-store.ts`.

On submission, the app immediately shows `result.bill.id` and sends it to the host route. The backend fetches that bill from MindBill using its workspace key, verifies its customer and externalId, then links it to the case. An arbitrary ID from the browser is never proof of access.

If saving fails, the ID remains visible with a retry action. Refresh loads the stored association; if it was never saved, the backend searches by customer and stable externalId, verifies the match, and saves it before returning.

## 5. Inspect the teaching database

Open `.data/host-database.json` after visiting Bill, then `lib/mock-database.ts`.

The case exists before its bill. Its row contains the host workspace/customer, stable case reference, creation key, nullable bill ID, and timestamps. The creation key is generated once inside a locked transaction. Concurrent tabs share it. Atomic file replacement avoids partial JSON; unique constraints and transactions reject conflicting case links.

MindBill also reserves customer/externalId before dispatch so different browser users cannot dispatch duplicate bills for the same reference. A conflict prompts recovery, not a new random externalId. Neither callbacks nor recovery substitute for database concurrency control. A deployed host uses its own database and verified webhooks.

## 6. Show the other billing surfaces

Open **Billing dashboard** for workspace bills and **Settings** for optional reusable provider/location details. Their small components live in `app/billing/`. Both routes require the local host administrator; settings gets the separate `organization:manage` session. Customer case sessions never receive that permission.

The app shell, record viewer, login form, and integration components are in separate files so each file explains one responsibility. Implementation notes belong here, outside the product UI.
