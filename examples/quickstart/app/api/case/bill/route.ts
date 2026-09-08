import { linkBill, recoverBill } from "../../../../lib/case-store";
import { authorize, checkOrigin, failure, noStore, RouteError } from "../../../../lib/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { authorize(request); return Response.json({ billId: await recoverBill() }, { headers: noStore }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request); authorize(request);
    const { billId } = await request.json();
    if (typeof billId !== "string" || !billId || billId.length > 200) throw new RouteError(400, "A bill ID is required.");
    return Response.json({ billId: await linkBill(billId) }, { headers: noStore });
  } catch (error) { return failure(error); }
}
