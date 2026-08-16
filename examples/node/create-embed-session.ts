import { MindBillClient } from "@mindbill/node";

const mindbill = new MindBillClient({
  apiKey: process.env.MINDBILL_API_KEY!,
  ...(process.env.MINDBILL_ORG_ID
    ? { organizationId: process.env.MINDBILL_ORG_ID }
    : {}),
});

// Run only after authenticating and authorizing your own application user.
const session = await mindbill.createEmbedSession({
  component: "bill-timeline",
  billId: "synthetic_bill_123",
  allowedOrigin: "https://your-product.example",
  expiresIn: 900,
});

// Return only these transient values to your browser, never MINDBILL_API_KEY.
console.log({ token: session.token, embedUrl: session.embedUrl, expiresAt: session.expiresAt });
