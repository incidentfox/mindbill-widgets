import assert from "node:assert/strict";
import test from "node:test";
import { sessionScope } from "./session-scope.ts";
import { CASE_ID, CASE_CUSTOMERS, HOST_WORKSPACE_ID } from "./case-identity.ts";

const admin = { subject: "admin", workspaceId: HOST_WORKSPACE_ID, administrator: true, customerExternalIds: [] };
test("existing case receives only its verified bill and cannot create another", async () => {
  const scope = await sessionScope({ surface: "case", caseId: CASE_ID }, admin, async (id) => {
    assert.equal(id, CASE_ID); return "verified-bill";
  });
  assert.deepEqual(scope.resource, { customerExternalId: CASE_CUSTOMERS[CASE_ID], billId: "verified-bill" });
  assert.equal(scope.permissions.includes("bills:create"), false);
});
test("new case receives the backend's customer restriction", async () => {
  const scope = await sessionScope({ surface: "case", caseId: CASE_ID }, admin, async () => null);
  assert.deepEqual(scope.resource, { customerExternalId: CASE_CUSTOMERS[CASE_ID] });
  assert.equal(scope.permissions.includes("bills:create"), true);
});
test("browser-selected resources, unknown cases, and unauthorized customers are rejected", async () => {
  const lookup = async () => { assert.fail("Unauthorized requests must not read a bill."); return null; };
  for (const forged of [{ billId: "other" }, { customerExternalId: "other" }, { resource: { billId: "other" } }])
    await assert.rejects(sessionScope({ surface: "case", caseId: CASE_ID, ...forged }, admin, lookup), { status: 400 });
  await assert.rejects(sessionScope({ surface: "case", caseId: "unknown" }, admin, lookup), { status: 404 });
  await assert.rejects(sessionScope({ surface: "case", caseId: CASE_ID }, { ...admin, administrator: false }, lookup), { status: 403 });
  await assert.rejects(sessionScope({ surface: "case", caseId: CASE_ID }, { ...admin, workspaceId: "other" }, lookup), { status: 403 });
});
test("workspace dashboard and shared settings are administrator-only", async () => {
  for (const surface of ["billing", "settings"]) {
    await assert.rejects(sessionScope({ surface }, { ...admin, administrator: false }, async () => null), { status: 403 });
    assert.equal((await sessionScope({ surface }, admin, async () => null)).resource, undefined);
  }
});
