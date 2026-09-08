import assert from "node:assert/strict";
import { test } from "node:test";
import { handleDemoRequest } from "./demo-transport.ts";
import { exampleBill } from "./case.ts";

const origin = "http://localhost:3001";
const billPath = "/partner/v2/bills/synthetic-bill-001";
async function request(path: string, cookie = "", method = "GET", body?: unknown, requestOrigin: string | null = origin) {
  const headers = new Headers({ cookie, "Content-Type": "application/json" });
  if (requestOrigin !== null) headers.set("Origin", requestOrigin);
  return handleDemoRequest(new Request(`${origin}/api/demo${path}`, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}
async function bootstrap() {
  const response = await request("/state");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { billId: null });
  const setCookie = response.headers.get("Set-Cookie")!;
  assert.match(setCookie, /HttpOnly; SameSite=Strict/);
  return setCookie.split(";")[0]!;
}

// Keep env mutation and requests sequential: these tests exercise one local server module.
test("local demo API", async (t) => {
  const previousMode = process.env.MINDBILL_MODE;
  process.env.MINDBILL_MODE = "demo";
  try {
    await t.test("creates a bill, persists its ID and attachments, updates lifecycle and settings, and resets", async () => {
      const cookie = await bootstrap();
      const pdf = Buffer.from("%PDF-1.4\n% Fictional document for transport test\n%%EOF");
      let response = await request("/partner/v2/bills", cookie, "POST", {
        bill: exampleBill,
        documents: [{ filename: "fictional.pdf", documentType: "medical_report", contentBase64: pdf.toString("base64") }],
      });
      assert.equal(response.status, 201);
      assert.equal((await response.json()).data.id, "synthetic-bill-001");
      assert.equal((await (await request("/state", cookie)).json()).billId, "synthetic-bill-001");
      assert.equal((await (await request("/partner/v2/bill-dashboard", cookie)).json()).data.total, 1);
      assert.equal((await (await request("/partner/v2/bill-dashboard?q=not-present", cookie)).json()).data.total, 0);
      response = await request(`${billPath}/documents/synthetic-document-1`, cookie);
      assert.equal(response.headers.get("Content-Type"), "application/pdf");
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf);
      response = await request(`${billPath}/actions`, cookie, "POST", { action: "add_note", note: "Fictional review completed" });
      assert.equal((await response.json()).data.notes[0].body, "Fictional review completed");
      response = await request(`${billPath}/actions`, cookie, "POST", { action: "close", reason: "Demonstration complete" });
      assert.equal((await response.json()).data.lifecycle.state, "closed");
      assert.equal((await (await request("/partner/v2/bill-tasks", cookie)).json()).data.waiting.grandTotal, 0);
      response = await request(`${billPath}/actions`, cookie, "POST", { action: "reopen", reason: "Demonstration reopened" });
      assert.equal((await response.json()).data.lifecycle.state, "submitted");
      assert.equal((await (await request("/partner/v2/bill-tasks", cookie)).json()).data.waiting.grandTotal, 1);
      response = await request("/partner/v2/organization/billing-profile", cookie, "PUT", { practiceIdentity: { name: "Updated fictional practice" } });
      assert.equal(response.status, 200);
      assert.equal((await (await request("/partner/v2/organization", cookie)).json()).data.practiceIdentity.name, "Updated fictional practice");
      const otherCookie = await bootstrap();
      assert.equal((await (await request("/partner/v2/bill-dashboard", otherCookie)).json()).data.total, 0);
      assert.equal((await (await request("/partner/v2/organization", otherCookie)).json()).data.practiceIdentity.name, "Example Review Practice");
      assert.equal((await request("/reset", cookie, "POST")).status, 200);
      assert.equal((await (await request("/state", cookie)).json()).billId, null);
      assert.equal((await request(`${billPath}/documents/synthetic-document-1`, cookie)).status, 404);
    });
    await t.test("requires a session and same-origin mutations; unsupported routes never fall through", async () => {
      assert.equal((await request("/partner/v2/bill-dashboard")).status, 401);
      const cookie = await bootstrap();
      for (const mutationOrigin of [null, "null", "https://other.example"]) {
        assert.equal((await request("/partner/v2/bills", cookie, "POST", { bill: exampleBill }, mutationOrigin)).status, 403);
        assert.equal((await request("/reset", cookie, "POST", {}, mutationOrigin)).status, 403);
      }
      // Next's internal URL can use localhost while the browser uses 127.0.0.1.
      const proxyRequest = (origin: string) => new Request("http://localhost:3001/api/demo/reset", {
        method: "POST", headers: { host: "127.0.0.1:3001", origin, cookie },
      });
      assert.equal((await handleDemoRequest(proxyRequest("http://127.0.0.1:3001"))).status, 200);
      assert.equal((await handleDemoRequest(proxyRequest("http://localhost:3001"))).status, 403);
      assert.equal((await request("/partner/v2/unimplemented", cookie)).status, 501);
      assert.equal((await (await request("/state", cookie)).json()).billId, null);
    });
    await t.test("bounds request bodies and attachments before creating a bill", async () => {
      const cookie = await bootstrap();
      let response = await request("/partner/v2/bills", cookie, "POST", { bill: exampleBill, documents: [{ filename: "not-pdf.pdf", contentBase64: Buffer.from("not a PDF").toString("base64") }] });
      assert.equal(response.status, 400);
      const tooLargePdf = Buffer.alloc(8 * 1024 * 1024 + 1, 65);
      tooLargePdf.write("%PDF-");
      response = await request("/partner/v2/bills", cookie, "POST", { bill: exampleBill, documents: [{ filename: "too-large.pdf", contentBase64: tooLargePdf.toString("base64") }] });
      assert.equal(response.status, 413);
      // No Content-Length header: the stream itself must be bounded.
      response = await request("/partner/v2/bills", cookie, "POST", { padding: "x".repeat(12 * 1024 * 1024 + 1) });
      assert.equal(response.status, 413);
      assert.equal((await (await request("/state", cookie)).json()).billId, null);
    });
    await t.test("sandbox mode disables bootstrap and all fake API requests", async () => {
      const cookie = await bootstrap();
      process.env.MINDBILL_MODE = "sandbox";
      assert.equal((await request("/state")).status, 404);
      assert.equal((await request("/partner/v2/organization", cookie)).status, 404);
      assert.equal((await request("/partner/v2/bills", cookie, "POST", { bill: exampleBill })).status, 404);
      process.env.MINDBILL_MODE = "demo";
    });
  } finally {
    if (previousMode === undefined) delete process.env.MINDBILL_MODE;
    else process.env.MINDBILL_MODE = previousMode;
  }
});
