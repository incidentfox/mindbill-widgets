import { authorizeCase } from "../../../../../lib/host-access";
import { linkBill, caseAssociation } from "../../../../../lib/case-store";
import {
  authorize,
  checkOrigin,
  failure,
  noStore,
  RouteError,
} from "../../../../../lib/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ caseId: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const user = authorize(request);
    const { caseId } = await params;
    authorizeCase(user, caseId);
    return Response.json(
      await caseAssociation(caseId),
      { headers: noStore },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const user = authorize(request);
    const { caseId } = await params;
    authorizeCase(user, caseId);
    const { billId } = await request.json();
    if (typeof billId !== "string" || !billId || billId.length > 128)
      throw new RouteError(400, "A bill ID is required.");
    return Response.json(
      { billId: await linkBill(caseId, billId) },
      { headers: noStore },
    );
  } catch (error) {
    return failure(error);
  }
}
