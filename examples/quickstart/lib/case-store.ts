import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import type { Bill, ListBillsQuery } from "@mindbill/node";
import { required, RouteError } from "./security.ts";

const caseExternalId = "synthetic-review-001";
// A single local process, one organization, one case. Replace this file adapter
// with your own database (unique organizationId + caseId) for a deployed app.
function location() {
  const scope = createHash("sha256").update(required("MINDBILL_ORG_ID")).digest("hex");
  return join(process.cwd(), ".data", `${scope}-${caseExternalId}.json`);
}
async function load(): Promise<string | null> {
  let contents: string;
  try {
    contents = await readFile(location(), "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
  const saved = JSON.parse(contents) as { billId?: unknown };
  if (typeof saved.billId !== "string" || !saved.billId.trim()) {
    throw new RouteError(409, "The stored bill association is invalid.");
  }
  return saved.billId;
}
async function save(billId: string) {
  const path = location();
  await mkdir(join(process.cwd(), ".data"), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify({ billId }), { mode: 0o600 });
  await rename(temporary, path);
}

type BillIdentity = Pick<Bill, "id" | "externalId">;
type CaseStoreDependencies = {
  client: {
    getBill(billId: string): Promise<BillIdentity>;
    listBills(query: ListBillsQuery): Promise<{ data: BillIdentity[]; nextCursor: string | null }>;
  };
  load(): Promise<string | null>;
  save(billId: string): Promise<void>;
};

// Dependencies make the recovery contract testable without a real API key.
export function createCaseStore({ client, load, save }: CaseStoreDependencies) {
  async function recoverBill(): Promise<string | null> {
    const savedId = await load();
    if (savedId) {
      // Verify ownership and case association even for a locally stored ID.
      const bill = await client.getBill(savedId);
      if (bill.id !== savedId || bill.externalId !== caseExternalId) {
        throw new RouteError(409, "The stored bill does not match this case.");
      }
      return bill.id;
    }
    // Recovery also runs on page load: a closed tab or failed success callback
    // must not silently offer to create another bill for the same case.
    const page = await client.listBills({ externalId: caseExternalId, limit: 2 });
    if (page.data.length > 1 || page.nextCursor) {
      throw new RouteError(409, "More than one bill matches this case. Resolve the association before continuing.");
    }
    const bill = page.data[0];
    if (!bill) return null;
    if (!bill.id || bill.externalId !== caseExternalId) throw new RouteError(409, "The returned bill does not match this case.");
    await save(bill.id);
    return bill.id;
  }
  async function linkBill(billId: string): Promise<string> {
    const existing = await recoverBill();
    // This lookup checks the submitted ID using the server key scoped to the
    // configured organization. Browser callback values are not trusted.
    const bill = await client.getBill(billId);
    if (bill.id !== billId || bill.externalId !== caseExternalId) throw new RouteError(409, "This bill belongs to another case.");
    if (existing && existing !== bill.id) throw new RouteError(409, "This case already has a different bill.");
    await save(bill.id);
    return bill.id;
  }
  return { recoverBill, linkBill };
}

async function defaultStore() {
  const { mindbill } = await import("./mindbill");
  return createCaseStore({ client: mindbill(), load, save });
}
export async function recoverBill(): Promise<string | null> {
  return (await defaultStore()).recoverBill();
}
export async function linkBill(billId: string): Promise<string> {
  return (await defaultStore()).linkBill(billId);
}
