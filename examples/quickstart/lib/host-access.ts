import { CASE_CUSTOMERS, HOST_WORKSPACE_ID } from "./case-identity.ts";
import { RouteError, type HostUser } from "./security.ts";

export function authorizeCase(user: HostUser, caseId: string) {
  if (user.workspaceId !== HOST_WORKSPACE_ID)
    throw new RouteError(403, "Workspace access denied.");
  const customerExternalId = CASE_CUSTOMERS[caseId];
  if (!customerExternalId) throw new RouteError(404, "Case not found.");
  if (!user.administrator && !user.customerExternalIds.includes(customerExternalId))
    throw new RouteError(403, "Case access denied.");
  return { caseId, customerExternalId };
}
