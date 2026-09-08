import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const isSandbox = () => process.env.MINDBILL_MODE === "sandbox";
export const cookieName = "review_starter_session";
export const maxAge = 60 * 60 * 8;
export class RouteError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new RouteError(503, `Set ${name} on the server before using sandbox mode.`);
  return value;
}
export function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function appOrigin(): string {
  const configured = required("APP_ORIGIN");
  const url = new URL(configured);
  if (url.origin !== configured || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new RouteError(503, "APP_ORIGIN must be an exact HTTPS origin or HTTP localhost origin.");
  }
  return configured;
}
export function checkOrigin(request: Request): void {
  if (request.headers.get("origin") !== appOrigin()) throw new RouteError(403, "Origin not allowed.");
}
function signingSecret(): string {
  const secret = required("APP_SESSION_SECRET");
  if (secret.length < 32) throw new RouteError(503, "APP_SESSION_SECRET must contain at least 32 characters.");
  return secret;
}
export function signSession(now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ subject: "starter-admin", expires: now + maxAge * 1000, nonce: randomBytes(16).toString("hex") })).toString("base64url");
  return `${payload}.${createHmac("sha256", signingSecret()).update(payload).digest("base64url")}`;
}
export function validSession(value: string | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return false;
  if (!sameSecret(signature, createHmac("sha256", signingSecret()).update(payload).digest("base64url"))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.subject === "starter-admin" && typeof data.expires === "number" && data.expires > now && data.expires <= now + maxAge * 1000;
  } catch { return false; }
}
export function authorize(request: Request): void {
  if (!isSandbox()) throw new RouteError(404, "Sandbox integration is disabled.");
  const value = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!validSession(value)) throw new RouteError(401, "Sign in to the starter first.");
  // This reference app has ONE trusted administrator and ONE configured organization.
  // For a partner app, replace this with its existing user, tenant, and case authorization.
  required("MINDBILL_ORG_ID");
}
export const noStore = { "Cache-Control": "no-store" };
export function failure(error: unknown): Response {
  // Do not forward upstream bodies: they can include credentials or patient information.
  return Response.json({ error: error instanceof RouteError ? error.message : "The request failed. Check the server configuration and try again." }, { status: error instanceof RouteError ? error.status : 502, headers: noStore });
}
