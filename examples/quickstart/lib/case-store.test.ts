import assert from "node:assert/strict";
import test from "node:test";
import { createCaseStore } from "./case-store.ts";
import { RouteError } from "./security.ts";

const externalId = "synthetic-review-001";
const bill = { id: "synthetic-bill-001", externalId };
type Identity = typeof bill;

function setup(options: {
  savedId?: string;
  bills?: Identity[];
  nextCursor?: string;
  getBill?: (id: string) => Promise<Identity>;
  save?: (id: string) => Promise<void>;
} = {}) {
  let savedId = options.savedId ?? null;
  const writes: string[] = [];
  const gets: string[] = [];
  const queries: unknown[] = [];
  const store = createCaseStore({
    client: {
      async getBill(id) {
        gets.push(id);
        return options.getBill ? options.getBill(id) : { ...bill, id };
      },
      async listBills(query) {
        queries.push(query);
        return { data: options.bills ?? [], nextCursor: options.nextCursor ?? null };
      },
    },
    async load() { return savedId; },
    async save(id) {
      if (options.save) await options.save(id);
      savedId = id;
      writes.push(id);
    },
  });
  return { ...store, gets, queries, writes, saved: () => savedId };
}
const conflict = (error: unknown) => error instanceof RouteError && error.status === 409;

test("page load recovers a created bill after a missed browser callback and reuses its saved ID", async () => {
  const store = setup({ bills: [bill] });
  assert.equal(await store.recoverBill(), bill.id);
  assert.equal(store.saved(), bill.id);
  assert.deepEqual(store.queries, [{ externalId, limit: 2 }]);
  assert.deepEqual(store.writes, [bill.id]);
  assert.equal(await store.recoverBill(), bill.id);
  assert.deepEqual(store.gets, [bill.id]);
  assert.equal(store.queries.length, 1, "a saved ID is verified directly without a second search");
  assert.equal(store.writes.length, 1);
});

test("no saved association and no API match leaves the create form available", async () => {
  const store = setup();
  assert.equal(await store.recoverBill(), null);
  assert.deepEqual(store.writes, []);
});

test("ambiguous searches or pagination fail instead of choosing a bill", async () => {
  for (const options of [
    { bills: [bill, { ...bill, id: "synthetic-bill-002" }] },
    { bills: [bill], nextCursor: "another-page" },
    { bills: [], nextCursor: "another-page" },
  ]) {
    const store = setup(options);
    await assert.rejects(store.recoverBill(), conflict);
    assert.deepEqual(store.writes, []);
  }
});

test("search matches must have the exact case external ID", async () => {
  const store = setup({ bills: [{ ...bill, externalId: "another-case" }] });
  await assert.rejects(store.recoverBill(), conflict);
  assert.deepEqual(store.writes, []);
});

test("saved ID reuse verifies both the returned bill ID and the case association", async () => {
  for (const returned of [
    { ...bill, id: "another-bill" },
    { ...bill, externalId: "another-case" },
  ]) {
    const store = setup({ savedId: bill.id, getBill: async () => returned });
    await assert.rejects(store.recoverBill(), conflict);
    assert.deepEqual(store.queries, []);
    assert.deepEqual(store.writes, []);
  }
});

test("callback links only a server-verified bill and supports a repeated callback", async () => {
  const store = setup();
  assert.equal(await store.linkBill(bill.id), bill.id);
  assert.equal(store.saved(), bill.id);
  assert.equal(await store.linkBill(bill.id), bill.id);
  assert.deepEqual(store.queries, [{ externalId, limit: 2 }]);
  assert.deepEqual(store.gets, [bill.id, bill.id, bill.id]);
});

test("callback cannot replace an existing association or accept a mismatched response", async () => {
  const existing = setup({ savedId: bill.id });
  await assert.rejects(existing.linkBill("another-bill"), conflict);
  assert.equal(existing.saved(), bill.id);
  assert.deepEqual(existing.writes, []);
  for (const returned of [
    { ...bill, id: "another-bill" },
    { ...bill, externalId: "another-case" },
  ]) {
    const store = setup({ getBill: async () => returned });
    await assert.rejects(store.linkBill(bill.id), conflict);
    assert.deepEqual(store.writes, []);
  }
});

test("API and persistence failures do not silently recover to an empty case", async () => {
  const apiError = Object.assign(new Error("upstream unavailable"), { code: "ENOENT" });
  const store = setup({ savedId: bill.id, getBill: async () => { throw apiError; } });
  await assert.rejects(store.recoverBill(), error => error === apiError);
  assert.deepEqual(store.queries, []);
  const diskError = new Error("disk unavailable");
  const unsaved = setup({ bills: [bill], save: async () => { throw diskError; } });
  await assert.rejects(unsaved.recoverBill(), error => error === diskError);
  assert.equal(unsaved.saved(), null);
});
