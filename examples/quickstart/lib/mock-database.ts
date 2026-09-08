// Backend-only JSON database for this local walkthrough. Imported by API routes,
// never by React. Replace this adapter with your application's database in production.
import {
  mkdir,
  readFile,
  rename,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { RouteError } from "./security.ts";

export type CaseScope = {
  workspaceId: string;
  customerExternalId: string;
  caseId: string;
  externalId: string;
};
export type CaseRow = {
  id: string;
  workspaceId: string;
  customerExternalId: string;
  creationKey: string;
  externalId: string;
  billId: string | null;
  createdAt: string;
  updatedAt: string;
};
type Database = { schemaVersion: 1; cases: CaseRow[] };
const nonempty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const matches = (row: CaseRow, scope: CaseScope) =>
  row.workspaceId === scope.workspaceId && row.id === scope.caseId;

function validate(database: Database): void {
  if (database?.schemaVersion !== 1 || !Array.isArray(database.cases)) {
    throw new RouteError(409, "The mock database has an invalid schema.");
  }
  const caseKeys = new Set<string>(),
    externalKeys = new Set<string>(),
    billKeys = new Set<string>();
  for (const row of database.cases) {
    if (
      !row ||
      ![
        row.id,
        row.workspaceId,
        row.customerExternalId,
        row.externalId,
        row.creationKey,
        row.createdAt,
        row.updatedAt,
      ].every(nonempty) ||
      !Number.isFinite(Date.parse(row.createdAt)) ||
      !Number.isFinite(Date.parse(row.updatedAt)) ||
      (row.billId !== null && !nonempty(row.billId))
    ) {
      throw new RouteError(
        409,
        "The mock database contains an invalid case row.",
      );
    }
    // A tenant cannot have two rows for one case, reuse an external reference,
    // or attach the same MindBill bill to two host cases.
    for (const [keys, value] of [
      [caseKeys, row.id],
      [externalKeys, row.externalId],
      [billKeys, row.billId],
    ] as const) {
      if (value === null) continue;
      const key = JSON.stringify([row.workspaceId, value]);
      if (keys.has(key))
        throw new RouteError(
          409,
          "The mock database contains a duplicate case or bill association.",
        );
      keys.add(key);
    }
  }
}

async function removeTemporary(file: string) {
  try { await unlink(file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}

export function createMockDatabase(file: string) {
  async function read(): Promise<Database> {
    let contents: string;
    try {
      contents = await readFile(file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { schemaVersion: 1, cases: [] };
      throw error;
    }
    let database: Database;
    try {
      database = JSON.parse(contents);
    } catch {
      throw new RouteError(409, "The mock database is not valid JSON.");
    }
    validate(database);
    return database;
  }

  // Lock the read/check/write transaction, including across local Node workers.
  // Atomic rename keeps readers from ever seeing a half-written JSON document.
  async function transaction<T>(change: (database: Database) => T): Promise<T> {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    const lock = `${file}.lock`,
      deadline = Date.now() + 5000;
    while (true) {
      try {
        await mkdir(lock, { mode: 0o700 });
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (Date.now() >= deadline)
          throw new RouteError(
            503,
            "The mock database is busy. Retry after the current write finishes.",
          );
        await delay(25);
      }
    }
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      const database = await read();
      const result = change(database);
      validate(database);
      await writeFile(temporary, JSON.stringify(database, null, 2) + "\n", {
        mode: 0o600,
        flag: "wx",
      });
      await rename(temporary, file);
      return result;
    } finally {
      try {
        await removeTemporary(temporary);
      } finally {
        await rmdir(lock);
      }
    }
  }

  function checkScope(scope: CaseScope): void {
    if (![scope.workspaceId, scope.customerExternalId, scope.caseId, scope.externalId].every(nonempty))
      throw new RouteError(400, "A complete case identity is required.");
  }
  function checkExternalId(row: CaseRow, scope: CaseScope): CaseRow {
    if (row.externalId !== scope.externalId || row.customerExternalId !== scope.customerExternalId)
      throw new RouteError(
        409,
        "An existing case's customer or external ID cannot change.",
      );
    return row;
  }

  async function getCase(scope: CaseScope): Promise<CaseRow> {
    checkScope(scope);
    // Seed the fictional host case before any bill exists. In a real app the
    // case already exists in your database from the normal intake workflow.
    return transaction((database) => {
      const raced = database.cases.find((row) => matches(row, scope));
      if (raced) return checkExternalId(raced, scope);
      const now = new Date().toISOString();
      const row: CaseRow = {
        id: scope.caseId,
        workspaceId: scope.workspaceId,
        customerExternalId: scope.customerExternalId,
        externalId: scope.externalId,
        billId: null,
        creationKey: randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      database.cases.push(row);
      return row;
    });
  }

  async function linkBill(scope: CaseScope, billId: string): Promise<void> {
    checkScope(scope);
    if (!nonempty(billId)) throw new RouteError(400, "A bill ID is required.");
    await transaction((database) => {
      const row = database.cases.find((row) => matches(row, scope));
      if (!row) throw new RouteError(404, "The host case does not exist.");
      checkExternalId(row, scope);
      if (row.billId && row.billId !== billId)
        throw new RouteError(409, "This case already has a different bill.");
      if (row.billId === billId) return; // Repeated success callbacks are harmless.
      row.billId = billId;
      row.updatedAt = new Date().toISOString();
    });
  }

  return { getCase, linkBill };
}
