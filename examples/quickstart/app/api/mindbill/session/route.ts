import { mindbill } from "../../../../lib/mindbill";
import { recoverBill } from "../../../../lib/case-store";
import { sessionScope } from "../../../../lib/session-scope";
import { appOrigin, authorize, checkOrigin, failure, noStore } from "../../../../lib/security";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = authorize(request);
    const scope = await sessionScope(await request.json(), user, recoverBill);
    const session = await mindbill().createBrowserSession({
      subject: user.subject,
      allowedOrigin: appOrigin(),
      ...scope,
      expiresIn: 900,
    });
    return Response.json({ token: session.token, expiresAt: session.expiresAt }, { headers: noStore });
  } catch (error) { return failure(error); }
}
