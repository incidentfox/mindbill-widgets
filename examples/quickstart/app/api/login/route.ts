import { appOrigin, checkOrigin, cookieName, failure, isSandbox, maxAge, noStore, required, RouteError, sameSecret, signSession } from "../../../lib/security";
export const runtime = "nodejs";
// Single-process demo rate limit. Use your identity provider in production.
let failures = 0;
let windowEnds = 0;
export async function POST(request: Request) {
  try {
    if (!isSandbox()) throw new RouteError(404, "Sandbox integration is disabled.");
    checkOrigin(request);
    if (Date.now() > windowEnds) { failures = 0; windowEnds = Date.now() + 60_000; }
    if (failures >= 10) throw new RouteError(429, "Too many attempts. Try again in a minute.");
    const password = required("STARTER_PASSWORD");
    if (password.length < 16) throw new RouteError(503, "STARTER_PASSWORD must contain at least 16 characters.");
    const input = await request.json();
    if (typeof input.password !== "string" || !sameSecret(input.password, password)) {
      failures += 1;
      throw new RouteError(401, "Incorrect starter password.");
    }
    failures = 0;
    return Response.json({ ok: true }, { headers: { ...noStore, "Set-Cookie": `${cookieName}=${signSession()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${appOrigin().startsWith("https:") ? "; Secure" : ""}` } });
  } catch (error) { return failure(error); }
}
