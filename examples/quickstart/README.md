# Review desk: a MindBill reference app

A small Next.js application with fictional medical records, a handwritten summary, and the real MindBill React billing components. Billing uses your developer workspace's sandbox API. Provider details and the report/W-9 attachments belong to each bill; there is no practice setup step or organization ID to copy.

## Run locally

Use Node 22 or later and pnpm 10. From this directory:

```sh
pnpm install
cp .env.example .env.local
```

Create a **sandbox** API key in the [developer dashboard](https://platform.mindbill.org/settings/api-keys). Set `MINDBILL_API_KEY` in `.env.local`. Keep it on the server. Set your own random `STARTER_PASSWORD` (at least 16 characters) and `APP_SESSION_SECRET` (at least 32 characters). `APP_ORIGIN` must exactly match the address opened in your browser, including the port.

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm start
```

Open http://localhost:3001 and sign in with your `STARTER_PASSWORD`. The app rejects live keys. There is no simulated billing mode or local API branch; only the records, authentication example, and host database are local fixtures. Do not use real patient data in this starter.

The sample uses one local administrator for a short walkthrough. A deployed integration must replace that login with its identity provider and derive user, customer, and case access from its own database. Do not expose this starter publicly with its example authentication.

## Read the integration

Start with [WALKTHROUGH.md](./WALKTHROUGH.md).

| File | Responsibility |
| --- | --- |
| `app/Billing.tsx` | Choose submission or existing-bill component |
| `app/billing/session.ts` | Request a browser session from the host route |
| `app/billing/useCaseBill.ts` | Load the verified association; show and save a created ID |
| `app/api/mindbill/session/route.ts` | Authenticate the host user and mint a scoped token |
| `lib/session-scope.ts` / `lib/host-access.ts` | Derive customer and bill restrictions from authorized host cases |
| `app/api/cases/[caseId]/bill/route.ts` | Read and verify the case-to-bill association |
| `lib/case-store.ts` | Fetch a bill from MindBill, verify customer/case, recover missed callbacks |
| `lib/mock-database.ts` | Backend JSON database with transactions and uniqueness constraints |
| `lib/case.ts` / `lib/documents.ts` | Synthetic case, per-bill provider snapshots, and PDFs |

Shared billing settings and the all-workspace dashboard are separate administrator surfaces. They receive separate unscoped tokens; the case token cannot read shared billing profiles or manage workspace settings.

## Case identity, recovery, and concurrency

`customerExternalId` identifies a customer in **your application**. It is not an API key, organization ID, or email supplied by the browser. The backend derives it from the authenticated user's allowed case. MindBill checks that customer boundary and stamps it on bills created by the customer-scoped token.

`externalId` is your stable reference for this logical bill; here it is the host case ID, `synthetic-review-001`. It is different from the MindBill-generated bill ID. Keep it stable through retries and missed callbacks. If your product intentionally creates several bills for one case, use a separate stable reference for each logical bill.

Before the form appears, the host stores a case row and a random `creationKey` in `.data/host-database.json`. The component sends that same key for retries and tabs. The JSON adapter locks the entire read/check/write transaction and uses atomic replacement. It enforces unique workspace/case, workspace/externalId, and workspace/bill associations and prevents a case's customer from changing.

A browser callback only proposes a bill ID. The backend fetches it with its workspace key, verifies the exact customer and case reference, and then saves it. Every later visit verifies a saved ID or searches MindBill by both customer and externalId before offering creation again. Failed lookups fail closed.

**Recovery and idempotency do not replace database concurrency control.** MindBill reserves the customer/externalId association before dispatch, preventing simultaneous submissions under different browser subjects from dispatching duplicate bills. A losing request can return a conflict; reload the case to recover the winner. Host database uniqueness still prevents conflicting local associations. Production apps should use database transactions and unique constraints plus verified webhook reconciliation for ongoing status updates.

The JSON adapter is a teaching database on one machine, not a distributed database. A process killed during a transaction may leave a lock directory; stop all app workers before inspecting or removing that stale lock. Never delete the database to repeat a recording against the same externalId: reload and recover the existing sandbox bill, or create a new host case with a new stable reference.

## Boundaries and checks

All names, records, identifiers, and PDFs are hand-authored fictional fixtures. The W-9 attachment is explicitly a demonstration placeholder, not an IRS form or signed tax document. Real bills require the actual authorized provider documents.

Backend tests cover user/customer authorization, forged resource requests, verified association recovery, concurrent JSON writes, stable creation keys, uniqueness, restart persistence, and origin/session guards. API and browser acceptance checks use synthetic responses without contacting real accounts. Keep `.env.local` and `.data/` out of git.

For synthetic production-browser acceptance, install `playwright-core` in a separate tools project and run `BROWSER_MODULE_ROOT=/path/to/browser-tools pnpm verify:browser` after building. Set `CHROME_PATH` if Chrome is not at the script's default. The script starts only loopback services, uses an isolated temporary host database, blocks external API calls, and closes its services afterward.
