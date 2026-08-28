import { MindBillClient } from "@mindbill/node";

const mindbill = new MindBillClient({
  apiKey: process.env.MINDBILL_API_KEY!,
  ...(process.env.MINDBILL_ORG_ID
    ? { organizationId: process.env.MINDBILL_ORG_ID }
    : {}),
});

// Call this only after your server authorizes the signed-in user for this bill.
const session = await mindbill.createBrowserSession({
  component: "bill-review",
  billId: "synthetic_bill_123",
  allowedOrigin: "https://your-product.example",
  expiresIn: 900,
});

// Return only these short-lived values to the browser. Never return the API key.
console.log({
  token: session.token,
  embedUrl: session.embedUrl,
  expiresAt: session.expiresAt,
});
