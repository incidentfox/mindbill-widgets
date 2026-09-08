import { join } from "node:path";
import type { Bill, ListBillsQuery } from "@mindbill/node";
import { RouteError } from "./security.ts";
import { CASE_CUSTOMERS, HOST_WORKSPACE_ID } from "./case-identity.ts";
import { createMockDatabase } from "./mock-database.ts";

type BillIdentity = Pick<Bill, "id" | "externalId" | "customerExternalId">;
type Dependencies = {
  caseExternalId: string;
  customerExternalId: string;
  client: {
    getBill(id: string): Promise<BillIdentity>;
    listBills(query: ListBillsQuery): Promise<{ data: BillIdentity[]; nextCursor: string | null }>;
  };
  load(): Promise<string | null>;
  save(id: string): Promise<void>;
};

// The workspace API key establishes MindBill ownership. The host then verifies
// both the customer and the stable case reference before trusting any bill ID.
export function createCaseStore({ caseExternalId, customerExternalId, client, load, save }: Dependencies) {
  function verify(bill: BillIdentity, expectedId?: string) {
    if (!bill.id || (expectedId && bill.id !== expectedId) ||
        bill.externalId !== caseExternalId || bill.customerExternalId !== customerExternalId)
      throw new RouteError(409, "This bill does not belong to the expected customer and case.");
    return bill.id;
  }
  async function recoverBill(): Promise<string | null> {
    const saved = await load();
    if (saved) return verify(await client.getBill(saved), saved);
    const page = await client.listBills({ externalId: caseExternalId, customerExternalId, limit: 2 });
    if (page.data.length > 1 || page.nextCursor)
      throw new RouteError(409, "Multiple bills match this case. Resolve the association before continuing.");
    if (!page.data.length) return null;
    const id = verify(page.data[0]);
    await save(id);
    return id;
  }
  async function linkBill(candidateId: string): Promise<string> {
    const id = verify(await client.getBill(candidateId), candidateId);
    const existing = await recoverBill();
    if (existing && existing !== id) throw new RouteError(409, "This case already has a different bill.");
    await save(id); // Unique host database constraints still apply after recovery.
    return id;
  }
  return { recoverBill, linkBill };
}

async function storeFor(caseId: string) {
  const customerExternalId = CASE_CUSTOMERS[caseId];
  if (!customerExternalId) throw new RouteError(404, "Case not found.");
  const { mindbill } = await import("./mindbill");
  const scope = { workspaceId: HOST_WORKSPACE_ID, customerExternalId, caseId, externalId: caseId };
  const database = createMockDatabase(join(process.cwd(), ".data", "host-database.json"));
  const row = await database.getCase(scope); // Persists one creation key before rendering the form.
  const store = createCaseStore({
    caseExternalId: row.externalId, customerExternalId, client: mindbill(),
    load: async () => (await database.getCase(scope)).billId,
    save: (id) => database.linkBill(scope, id),
  });
  return { store, row };
}
export async function caseAssociation(caseId: string) {
  const { store, row } = await storeFor(caseId);
  return { billId: await store.recoverBill(), creationKey: row.creationKey };
}
export async function recoverBill(caseId: string) {
  return (await caseAssociation(caseId)).billId;
}
export async function linkBill(caseId: string, billId: string) {
  return (await storeFor(caseId)).store.linkBill(billId);
}
