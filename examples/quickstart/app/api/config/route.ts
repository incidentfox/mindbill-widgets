import { authorize, isSandbox, noStore } from "../../../lib/security";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  let signedIn = !isSandbox();
  if (isSandbox()) { try { authorize(request); signedIn = true; } catch { signedIn = false; } }
  return Response.json({ mode: isSandbox() ? "sandbox" : "demo", signedIn }, { headers: noStore });
}
