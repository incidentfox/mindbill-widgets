import { MindBillClient } from "@mindbill/node";

const mindbill = new MindBillClient({
  apiKey: process.env.MINDBILL_API_KEY!,
  ...(process.env.MINDBILL_ORG_ID
    ? { organizationId: process.env.MINDBILL_ORG_ID }
    : {}),
});

// Call this only after your server authenticates the user and maps their role.
const session = await mindbill.createBrowserSession({
  subject: "synthetic_user_123",
  allowedOrigin: "https://your-product.example",
  permissions: [
    "bills:create",
    "bills:read",
    "bills:edit",
    "bills:submit",
    "bills:act",
    "documents:read",
    "documents:write",
    "payers:read",
    "eors:read",
  ],
  expiresIn: 900,
});

// Return only these short-lived values to the browser. Never return the API key.
console.log({
  token: session.token,
  expiresAt: session.expiresAt,
});
