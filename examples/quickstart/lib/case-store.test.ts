import assert from "node:assert/strict";
import test from "node:test";
import { createCaseStore } from "./case-store.ts";

const bill = { id: "bill-example", externalId: "case-example", customerExternalId: "customer-example" };
function fixture({ saved = null, bills = [] as typeof bill[], cursor = null as string | null,
  candidate = bill } : { saved?: string | null; bills?: typeof bill[]; cursor?: string | null; candidate?: typeof bill } = {}) {
  const queries: unknown[] = [], writes: string[] = [];
  let stored = saved;
  const store = createCaseStore({
    caseExternalId: bill.externalId, customerExternalId: bill.customerExternalId,
    client: {
      async getBill() { return candidate; },
      async listBills(query) { queries.push(query); return { data: bills, nextCursor: cursor }; },
    },
    async load() { return stored; },
    async save(id) { stored = id; writes.push(id); },
  });
  return { ...store, queries, writes };
}
test("no association or API match allows creation", async () => {
  assert.equal(await fixture().recoverBill(), null);
});
test("missed callback recovers by customer and externalId, then revalidates saved association", async () => {
  const store = fixture({ bills: [bill] });
  assert.equal(await store.recoverBill(), bill.id);
  assert.equal(await store.recoverBill(), bill.id);
  assert.deepEqual(store.queries, [{ externalId: bill.externalId, customerExternalId: bill.customerExternalId, limit: 2 }]);
  assert.deepEqual(store.writes, [bill.id]);
});
test("foreign, unassigned, or wrong-case browser IDs never become associations", async () => {
  for (const candidate of [
    { ...bill, customerExternalId: "other" }, { ...bill, customerExternalId: "" },
    { ...bill, externalId: "other" }, { ...bill, id: "unexpected" },
  ]) {
    const store = fixture({ candidate });
    await assert.rejects(store.linkBill(bill.id), { status: 409 });
    assert.deepEqual(store.writes, []);
  }
});
test("stored IDs are verified and ambiguous recoveries fail closed", async () => {
  await assert.rejects(fixture({ saved: "other-id" }).recoverBill(), { status: 409 });
  await assert.rejects(fixture({ bills: [bill, bill] }).recoverBill(), { status: 409 });
  await assert.rejects(fixture({ bills: [bill], cursor: "more" }).recoverBill(), { status: 409 });
});
test("verified callbacks link without offering creation after a missed save", async () => {
  const store = fixture({ bills: [bill] });
  assert.equal(await store.linkBill(bill.id), bill.id);
  assert.equal(await store.recoverBill(), bill.id);
});
