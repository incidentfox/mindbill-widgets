import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createMockDatabase } from "./mock-database.ts";

const scope = {
  workspaceId: "test-workspace",
  customerExternalId: "customer-a",
  caseId: "case-001",
  externalId: "case-001",
};
async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const directory = await mkdtemp(join(tmpdir(), "review-database-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "host-database.json");
  return { file, database: createMockDatabase(file) };
}

test("a host case exists before billing and survives opening a new database instance", async (t) => {
  const { file, database } = await fixture(t);
  const before = await database.getCase(scope);
  assert.equal(before.billId, null);
  assert.match(before.creationKey, /^[a-f0-9-]{36}$/);
  assert.equal(before.workspaceId, scope.workspaceId);
  await database.linkBill(scope, "bill-001");
  const reopened = createMockDatabase(file);
  const after = await reopened.getCase(scope);
  assert.equal(after.billId, "bill-001");
  assert.equal(after.createdAt, before.createdAt);
  assert.equal(after.creationKey, before.creationKey);
  assert.ok(after.updatedAt >= before.updatedAt);
  const stored = JSON.parse(await readFile(file, "utf8"));
  assert.equal(stored.schemaVersion, 1);
  assert.equal(stored.cases.length, 1);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
});

test("repeated callbacks are idempotent and cannot replace a saved bill", async (t) => {
  const { database } = await fixture(t);
  await database.getCase(scope);
  await database.linkBill(scope, "bill-001");
  const saved = await database.getCase(scope);
  await database.linkBill(scope, "bill-001");
  assert.deepEqual(await database.getCase(scope), saved);
  await assert.rejects(database.linkBill(scope, "bill-002"), { status: 409 });
  assert.deepEqual(await database.getCase(scope), saved);
});

test("concurrent independent connections preserve unrelated rows and reject conflicting links", async (t) => {
  const { file, database } = await fixture(t);
  const other = createMockDatabase(file);
  const second = { ...scope, caseId: "case-002", externalId: "case-002" };
  const [first, raced] = await Promise.all([
    database.getCase(scope),
    other.getCase(scope),
    other.getCase(second),
  ]);
  assert.equal(first.creationKey, raced.creationKey, "concurrent readers share the reserved creation key");
  const results = await Promise.allSettled([
    database.linkBill(scope, "bill-001"),
    other.linkBill(scope, "bill-002"),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter(
      (result) => result.status === "rejected" && result.reason.status === 409,
    ).length,
    1,
  );
  assert.equal(JSON.parse(await readFile(file, "utf8")).cases.length, 2);
  assert.equal((await database.getCase(second)).billId, null);
});

test("case identity and bill uniqueness are enforced within the host workspace", async (t) => {
  const { database } = await fixture(t);
  const second = { ...scope, caseId: "case-002", externalId: "case-002" };
  await database.getCase(scope);
  await assert.rejects(
    database.getCase({ ...scope, externalId: "changed-reference" }),
    { status: 409 },
  );
  await assert.rejects(database.getCase({ ...scope, caseId: "case-002" }), {
    status: 409,
  });
  await database.getCase(second);
  await database.linkBill(scope, "bill-001");
  await assert.rejects(database.linkBill(second, "bill-001"), { status: 409 });
  assert.equal((await database.getCase(second)).billId, null);
  // The same case/external ID in a different tenant remains independent.
  assert.equal(
    (await database.getCase({ ...scope, workspaceId: "other-org" })).billId,
    null,
  );
});

test("malformed or duplicate data fails closed without replacing the database", async (t) => {
  const { file, database } = await fixture(t);
  for (const invalid of [
    "{broken",
    "{}",
    JSON.stringify({ schemaVersion: 1, cases: [{ billId: "bill-001" }] }),
  ]) {
    await writeFile(file, invalid);
    await assert.rejects(database.getCase(scope), { status: 409 });
    assert.equal(await readFile(file, "utf8"), invalid);
  }
  await rm(file);
  const row = await database.getCase(scope);
  await writeFile(
    file,
    JSON.stringify({ schemaVersion: 1, cases: [row, row] }),
  );
  await assert.rejects(database.getCase(scope), { status: 409 });
});

test("missing host cases cannot be linked directly", async (t) => {
  const { database } = await fixture(t);
  await assert.rejects(database.linkBill(scope, "bill-001"), { status: 404 });
});


test("host customer ownership cannot be reassigned while retaining a case ID", async (t) => {
  const { database } = await fixture(t);
  await database.getCase(scope);
  await assert.rejects(database.getCase({ ...scope, customerExternalId: "other-customer" }), { status: 409 });
});
