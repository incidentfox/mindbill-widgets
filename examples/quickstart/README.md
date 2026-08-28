# MindBill Next.js quickstart

This example creates one synthetic bill and renders the complete native React lifecycle. The permanent API key stays on the server; the browser receives a short-lived token scoped to one bill and one exact HTTPS origin.

```bash
cp .env.example .env.local
npm install
set -a; . ./.env.local; set +a
npm run create-bill
```

Copy the printed bill ID into `.env.local`, expose the Next.js server through an HTTPS local tunnel, set `APP_ORIGIN` to that exact origin, then run:

```bash
npm run dev
```

The only integration-specific server logic is in `app/api/mindbill/billing-session/route.ts`: authenticate your user, authorize access to `billId`, and mint the browser session. The component handles review, payer matching, documents, submission, status, EORs, payments, Second Bill Review, correction/resubmission, and close.
