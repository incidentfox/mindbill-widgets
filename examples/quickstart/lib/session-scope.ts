import type { BrowserSessionRequest } from "@mindbill/node";
import { HOST_WORKSPACE_ID } from "./case-identity.ts";
import { RouteError, type HostUser } from "./security.ts";

import { authorizeCase } from "./host-access.ts";

const billingPermissions: BrowserSessionRequest["permissions"] = [
  "bills:create", "bills:read", "bills:act", "documents:read", "payers:read", "eors:read",
];

// The browser supplies a host case ID. Only the backend chooses MindBill resources.
export async function sessionScope(
  input: unknown,
  user: HostUser,
  recoverBill: (caseId: string) => Promise<string | null>,
): Promise<Pick<BrowserSessionRequest, "permissions" | "resource">> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new RouteError(400, "Invalid session request.");
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["surface", "caseId"].includes(key)))
    throw new RouteError(400, "Session resources must be selected by the host backend.");
  if (user.workspaceId !== HOST_WORKSPACE_ID)
    throw new RouteError(403, "Workspace access denied.");
  if (body.surface === "case") {
    const caseId = typeof body.caseId === "string" ? body.caseId : "";
    const { customerExternalId } = authorizeCase(user, caseId);
    const billId = await recoverBill(caseId);
    return billId
      ? { permissions: billingPermissions.filter((p) => p !== "bills:create"), resource: { customerExternalId, billId } }
      : { permissions: billingPermissions, resource: { customerExternalId } };
  }
  if (body.caseId !== undefined || !["billing", "settings"].includes(String(body.surface)))
    throw new RouteError(400, "Unknown billing surface.");
  if (!user.administrator) throw new RouteError(403, "Workspace administrator access required.");
  return { permissions: body.surface === "settings" ? ["organization:manage"] : billingPermissions.filter((p) => p !== "bills:create") };
}
