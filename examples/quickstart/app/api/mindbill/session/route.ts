import { mindbill } from "../../../../lib/mindbill";

export async function POST(request: Request) {
  // Replace this synthetic identity with your existing authentication and RBAC.
  const user = { id: "synthetic_user_123", role: "billing_specialist" };
  if (user.role !== "billing_specialist") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await mindbill.createBrowserSession({
    subject: user.id,
    allowedOrigin: process.env.APP_ORIGIN ?? new URL(request.url).origin,
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

  return Response.json({ token: session.token, expiresAt: session.expiresAt });
}
