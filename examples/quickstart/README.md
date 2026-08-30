# MindBill React quickstart

This example renders the complete native React lifecycle. The React component creates the bill from known synthetic values. The permanent API key stays on the server; the browser receives a short-lived token scoped to your organization, signed-in user, role permissions, and exact HTTPS origin.

```bash
cp .env.example .env.local
npm install
npm run dev
```

The only integration-specific server logic is in `app/api/mindbill/session/route.ts`: authenticate your user, map their role to permissions, and mint the browser session. The component handles bill creation, review, payer matching, documents, submission, status, EORs, payments, Second Bill Review, correction/resubmission, and close.

This demo uses Next.js only to stay runnable in one folder. The session handler can be Express, Rails, Laravel, .NET, Go, or any server that can keep an API key secret and authenticate a user.
