import { authorize, noStore } from "../../../lib/security";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  let signedIn = false;
  try { authorize(request); signedIn = true; } catch { /* Login is shown until authenticated. */ }
  return Response.json({ signedIn }, { headers: noStore });
}
