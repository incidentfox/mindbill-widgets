import { mindbill } from "../../../../lib/mindbill";

export async function POST(request: Request) {
  const { billId } = (await request.json()) as { billId?: string };
  if (!billId || billId !== process.env.MINDBILL_SYNTHETIC_BILL_ID) {
    return Response.json({ error: "Bill not found" }, { status: 404 });
  }

  // In your app, authenticate the user and authorize access to billId here.
  const session = await mindbill.createBrowserSession({
    component: "bill-review",
    billId,
    allowedOrigin: process.env.APP_ORIGIN!,
    expiresIn: 900,
  });

  return Response.json({ token: session.token, expiresAt: session.expiresAt });
}
