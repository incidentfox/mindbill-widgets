# Medical review starter

A small React app showing how MindBill fits into a partner product. Open a fictional case, read its medical records and source-linked summary, create its bill, then visit the billing dashboard and settings. The billing screens use the published MindBill React components.

## Run it

Requires Node 22+ and pnpm 10. No API key is needed for the default demo.

```bash
git clone https://github.com/incidentfox/mindbill-widgets.git
cd mindbill-widgets/examples/quickstart
pnpm install --ignore-workspace --frozen-lockfile
pnpm dev
```

Open http://localhost:3001. Click **Prepare bill**, review the prefilled fictional case, and create a simulated bill. Its lifecycle, dashboard entry, and settings are interactive. **Reset demo** starts over.

Demo mode serves simulated API responses locally. Each browser has separate state, kept in server memory for up to eight hours; restarting the server clears it. No bill is sent to MindBill or a payer. All records and summaries are hand-authored fiction. Use only synthetic files in this app.

## What to copy

| File | What it demonstrates |
| --- | --- |
| `app/Billing.tsx` | Records and summary, create-vs-existing bill, dashboard, settings |
| `lib/case.ts` | Your application's case data and optional bill prefill |
| `app/api/mindbill/session/route.ts` | Server key → short-lived browser session, with separate settings permissions |
| `app/api/case/bill/route.ts` | Authenticated load/save of a case's bill association |
| `lib/case-store.ts` | Server verification, persistence, and recovery after a missed callback |
| `lib/security.ts`, `app/api/login/route.ts` | Small single-administrator login for local sandbox exploration |
| `lib/demo-transport.ts` | Local simulation only; remove when integrating into your app |

Next.js supplies the small backend in the same folder. The component integration is ordinary React; your existing backend can provide the session and case-link routes.

## Where the bill ID comes from

1. The backend loads this case's saved bill ID. With no ID, render `BillSubmissionForm`.
2. The form creates the bill directly in MindBill with a browser session and the stable case `externalId`.
3. `onSubmitted(result)` gives the app `result.bill.id`. Send it to your backend; verify the bill belongs to the configured organization and case before saving it.
4. Render `ConnectedBillLifecycle` with that ID. A null ID is **not** a create mode for the lifecycle component.
5. On reload, load the saved association. If the callback was missed, search MindBill by the case's `externalId` before offering creation again. Multiple matches fail explicitly.

```tsx
return billId ? (
  <ConnectedBillLifecycle billId={billId} getSession={getSession} />
) : (
  <BillSubmissionForm
    initialBill={{ ...caseBill, externalId: caseId }}
    getSession={getSession}
    onSubmitted={({ bill }) => saveAndShowBill(bill.id)}
  />
);
```

The runnable implementation keeps the created bill visible if saving the link fails and provides a retry. The callback helps the UI respond immediately; it is not the only recovery mechanism.

## Connect a real MindBill sandbox

Copy `.env.example` to `.env.local`, set `MINDBILL_MODE=sandbox`, and fill the commented variables with a **sandbox** developer key, its organization ID, the exact app origin, a starter password of at least 16 characters, and a random session secret of at least 32 characters. Restart the app, then sign in with that password. Get a sandbox key from the [developer console](https://platform.mindbill.org/onboarding).

In this mode, requests reach the configured MindBill organization. The app does not determine whether the supplied developer key is live or sandbox: select a sandbox key yourself. The synthetic claims administrator is removed from the prefill; select a supported administrator through the form. Use fictional data only.

The permanent key stays on the server. After authenticating the starter administrator, the session route mints a 15-minute, origin-bound token. Components use that token to call MindBill directly. The separate case-link route uses the developer key on the backend to verify ownership and recover the association. Settings request `organization:manage` through a separate session.

Sandbox associations are stored under gitignored `.data/`, scoped by organization. The local simulation is disabled in sandbox mode.

## Adapting it to your product

This is a reference app for one administrator, one organization, and one fictional case. Before adopting its backend, replace the starter password with your identity provider, authorize each user's tenant and case, and restrict settings to organization administrators. Replace the local file store with your database and enforce a unique tenant/case association.

A stable `externalId` enables lookup; it is not a uniqueness constraint or an idempotency key. Coordinate concurrent creation for the same case on your backend, and use verified webhooks or reconciliation for durable synchronization. The local password throttle and memory/file stores are single-process examples, not distributed infrastructure.

The simulation covers the common walkthrough: create, view, add notes, close/reopen, dashboard filtering, and settings. Fee checks, payer delivery, EORs, payments, and reports are illustrative rather than live calculations or integrations; unsupported operations report an error. It does not generate medical summaries or implement a clinical records system.

## Verify

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

See the [component quickstart](https://docs.mindbill.org/learn/quickstart) for the shorter integration steps.
