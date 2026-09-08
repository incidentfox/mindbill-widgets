/* global document, innerWidth */
// Requires a built app and playwright-core. Uses no real credentials or MindBill account.
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { mkdtemp, readFile, rm, symlink, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { BILL_ID, PAYER, directory, deliveryOptions, initialProfile, makeLifecycle, registry, tasks } from "./browser-fixtures.ts";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const origin = "http://127.0.0.1:3114";
const upstream = "http://127.0.0.1:4332";
const require = createRequire(resolve(process.env.BROWSER_MODULE_ROOT || source, "package.json"));
const { chromium } = require("playwright-core");
// Refuse to touch ports occupied by another recording or developer session.
for (const port of [3114, 4332]) {
  const probe = http.createServer();
  probe.listen(port, "127.0.0.1"); await once(probe, "listening");
  await new Promise(resolve => probe.close(resolve));
}
const temporary = await mkdtemp(join(tmpdir(), "review-desk-browser-"));
const sessions = [], requests = [], created = [];
const state = { lifecycle: null, input: null };
let child, browser, page;
let serverLog = "";
const mock = http.createServer(async (request, response) => {
  const url = new URL(request.url, upstream), path = url.pathname;
  let bytes = ""; for await (const chunk of request) bytes += chunk;
  const body = bytes ? JSON.parse(bytes) : {};
  const send = (value, status = 200) => { response.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization,content-type,idempotency-key,x-mindbill-environment", "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS" }); response.end(JSON.stringify(value)); };
  try {
    if (request.method === "OPTIONS") return send({});
    requests.push(path);
    if (path === "/partner/v2/browser-sessions") {
      assert.equal(request.headers.authorization, "Bearer mbp_sandbox_synthetic_acceptance");
      assert.equal(request.headers["x-mindbill-org-id"], undefined);
      sessions.push(body);
      return send({ ...body, token: Buffer.from(JSON.stringify(body)).toString("base64url"), expiresAt: new Date(Date.now() + 900000).toISOString() });
    }
    const serverKey = request.headers.authorization === "Bearer mbp_sandbox_synthetic_acceptance";
    const scope = serverKey ? null : JSON.parse(Buffer.from(request.headers.authorization?.slice(7) || "", "base64url").toString());
    if (path.startsWith("/partner/v2/organization")) {
      assert.equal(scope?.resource, undefined, "case-scoped tokens must never fetch shared profiles");
      return send({ data: initialProfile() });
    }
    if (path === "/partner/v2/claims-administrators") return send({ results: [PAYER], total: 1 });
    if (path === "/partner/v2/claims-administrators/" + PAYER.id) return send({ data: directory });
    if (path === "/partner/v2/diagnosis-codes") return send({ results: [{ code: "M25.512", description: "Pain in left shoulder" }] });
    if (path === "/partner/v2/procedure-codes") return send({ results: [{ code: "ML201" }], total: 1 });
    if (path === "/partner/v2/postal-codes") return send({ city: "Pasadena", state: "CA" });
    if (path === "/partner/v2/delivery-preview") return send({ data: deliveryOptions });
    if (path === "/partner/v2/bills" && request.method === "POST") {
      assert.equal(scope.resource.customerExternalId, "example-review-customer");
      assert.equal(scope.resource.billId, undefined);
      const row = JSON.parse(await readFile(join(temporary, ".data/host-database.json"), "utf8")).cases[0];
      assert.equal(request.headers["idempotency-key"], row.creationKey);
      assert.equal(body.bill.externalId, row.externalId);
      assert.deepEqual(body.documents.map(document => document.documentType).sort(), ["final_report", "w9"]);
      for (const document of body.documents) assert.equal(Buffer.from(document.contentBase64, "base64").subarray(0, 5).toString(), "%PDF-");
      created.push(body);
      state.input = body.bill; state.lifecycle = makeLifecycle(body.bill, body.documents);
      return send({ data: { id: BILL_ID, externalId: body.bill.externalId, customerExternalId: row.customerExternalId } }, 201);
    }
    if (path === "/partner/v2/bills") {
      assert.ok(serverKey);
      assert.equal(url.searchParams.get("customerExternalId"), "example-review-customer");
      assert.equal(url.searchParams.get("externalId"), "synthetic-review-001");
      return send({ data: state.input ? [{ id: BILL_ID, externalId: state.input.externalId, customerExternalId: "example-review-customer" }] : [], nextCursor: null });
    }
    if (path === "/partner/v2/bills/" + BILL_ID) return send({ id: BILL_ID, externalId: state.input?.externalId, customerExternalId: "example-review-customer" });
    if (path === "/partner/v2/bills/" + BILL_ID + "/lifecycle") {
      assert.deepEqual(scope.resource, { customerExternalId: "example-review-customer", billId: BILL_ID });
      assert.equal(scope.permissions.includes("bills:create"), false);
      return send({ data: state.lifecycle });
    }
    if (path === "/partner/v2/bill-dashboard") return send({ data: registry(state, url.searchParams) });
    if (path === "/partner/v2/bill-tasks") return send({ data: tasks(state) });
    throw new Error("Unexpected synthetic endpoint " + path);
  } catch (error) { console.error(error); send({ error: error.message }, 500); }
});
try {
  mock.listen(4332, "127.0.0.1"); await once(mock, "listening");
  for (const name of [".next", "node_modules", "public"]) await symlink(join(source, name), join(temporary, name));
  await copyFile(join(source, "package.json"), join(temporary, "package.json"));
  child = spawn(process.execPath, [join(source, "node_modules/next/dist/bin/next"), "start", temporary, "--hostname", "127.0.0.1", "-p", "3114"], {
    env: { ...process.env, MINDBILL_API_KEY: "mbp_sandbox_synthetic_acceptance", APP_ORIGIN: origin,
      STARTER_PASSWORD: "synthetic-password-for-acceptance", APP_SESSION_SECRET: "synthetic-signing-secret-for-local-acceptance",
      NODE_OPTIONS: "--import " + join(source, "scripts/browser-upstream.mjs") },
    cwd: temporary, stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", data => { serverLog += data; }); child.stderr.on("data", data => { serverLog += data; });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(serverLog);
    try { if ((await fetch(origin + "/api/config")).ok) break; } catch { /* Wait for local startup. */ }
    if (attempt === 99) throw new Error("App startup timeout: " + serverLog);
    await delay(100);
  }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.hostname === "app.mindbill.org") {
      const reply = await route.fetch({ url: upstream + url.pathname + url.search });
      return route.fulfill({ response: reply });
    }
    return ["127.0.0.1", "localhost"].includes(url.hostname) ? route.continue() : route.abort();
  });
  await page.goto(origin);
  await page.getByLabel("Starter password").fill("synthetic-password-for-acceptance");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "Alex Morgan" }).waitFor();
  await page.locator(".source-link").first().click();
  await page.getByRole("link", { name: "Download .txt" }).waitFor();
  await page.getByRole("tab", { name: "Bill", exact: true }).click();
  await page.getByRole("heading", { name: "Create this case’s first bill" }).waitFor();
  await page.getByRole("combobox", { name: "Claims administrator", exact: true }).click();
  await page.getByRole("option", { name: /Example Claims Administrator/ }).click();
  await page.evaluate(() => globalThis.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/review-desk-creation.png", fullPage: true });
  // Lose the callback deliberately. The next page load must recover from MindBill.
  let allowExistingSession = false;
  await page.route("**/api/mindbill/session", route => created.length && !allowExistingSession
    ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Synthetic session outage" }) })
    : route.continue());
  await page.route("**/api/cases/*/bill", route => route.request().method() === "POST"
    ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Synthetic callback outage" }) })
    : route.continue());
  await page.getByRole("button", { name: "Create sandbox bill", exact: true }).click();
  await page.getByRole("button", { name: "Send Bill", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Your bill was created, but its case link could not be saved." }).waitFor();
  assert.equal(created.length, 1);
  assert.equal(JSON.parse(await readFile(join(temporary, ".data/host-database.json"), "utf8")).cases[0].billId, null);
  allowExistingSession = true;
  await page.reload(); await page.getByRole("tab", { name: "Bill", exact: true }).click();
  await page.getByText("Bill ID: " + BILL_ID, { exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Create this case’s first bill" }).count(), 0);
  const database = JSON.parse(await readFile(join(temporary, ".data/host-database.json"), "utf8"));
  assert.equal(database.cases[0].billId, BILL_ID);
  await page.screenshot({ path: "/tmp/review-desk-existing-bill.png", fullPage: true });
  await page.getByRole("button", { name: "Billing dashboard", exact: true }).click();
  await page.getByRole("heading", { name: "Billing dashboard", exact: true }).waitFor();
  await page.getByRole("button", { name: "Settings", exact: true }).first().click();
  await page.getByRole("heading", { name: "Shared billing profile", exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 1000 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.ok(sessions.some(session => session.permissions.includes("organization:manage") && !session.resource));
  assert.deepEqual(errors, []);
  console.log("PASS: real production app login, source navigation, case-scoped SDK creation, PDF snapshots, stable idempotency header, missed callback recovery, saved association, lifecycle intersection, admin settings and responsive layout.");
} catch (error) {
  console.error("Synthetic upstream requests:", requests, "Sessions:", sessions);
  console.error("Server log:", serverLog);
  if (page) { console.error((await page.locator("body").innerText()).slice(-5000)); await page.screenshot({ path: "/tmp/review-desk-browser-failure.png" }); }
  throw error;
} finally {
  await browser?.close();
  if (child && child.exitCode === null) { child.kill("SIGTERM"); await once(child, "exit"); }
  await new Promise(resolve => mock.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
