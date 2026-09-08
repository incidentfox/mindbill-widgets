import { appOrigin, authorize, checkOrigin, failure, noStore, required, RouteError } from "../../../../lib/security";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    authorize(request);
    const input = await request.json();
    if (input.surface !== "billing" && input.surface !== "settings") throw new RouteError(400, "Unknown billing surface.");
    // The starter login is an organization administrator. In your app, enforce a
    // separate administrator role before minting organization:manage sessions.
    const permissions = input.surface === "settings"
      ? ["organization:manage"]
      : ["bills:create", "bills:read", "bills:act", "documents:read", "payers:read", "eors:read"];
    // Direct endpoint also supports organization:manage, which @mindbill/node
    // 0.13.0's session permission union does not yet expose.
    const response = await fetch("https://app.mindbill.org/partner/v2/browser-sessions", {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${required("MINDBILL_API_KEY")}`, "x-mindbill-org-id": required("MINDBILL_ORG_ID") },
      body: JSON.stringify({ subject: "starter-admin", allowedOrigin: appOrigin(), permissions, expiresIn: 900 }),
    });
    if (!response.ok) throw new RouteError(502, "Could not create a MindBill session. Check your sandbox key, organization, permissions, and allowed origin.");
    const body = await response.json();
    const session = body.data ?? body;
    if (typeof session.token !== "string") throw new RouteError(502, "MindBill returned an invalid session.");
    return Response.json({ token: session.token, expiresAt: session.expiresAt }, { headers: noStore });
  } catch (error) { return failure(error); }
}
