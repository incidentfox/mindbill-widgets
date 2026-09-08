import assert from "node:assert/strict";
import { test } from "node:test";
import { appOrigin, authorize, checkOrigin, cookieName, failure, maxAge, RouteError, signSession, validSession } from "./security.ts";

test("sandbox sessions require a signed, unexpired cookie and configured organization", () => {
  const previous = { ...process.env };
  try {
    process.env.MINDBILL_MODE = "sandbox";
    process.env.APP_SESSION_SECRET = "synthetic-test-secret-at-least-32-characters";
    process.env.MINDBILL_ORG_ID = "synthetic-organization";
    const now = Date.now();
    const cookie = signSession(now);
    assert.equal(validSession(cookie, now), true);
    assert.equal(validSession(cookie + "tampered", now), false);
    assert.equal(validSession(cookie, now + maxAge * 1000), false);
    assert.equal(validSession(signSession(now + 60_000), now), false);
    assert.throws(() => authorize(new Request("http://localhost:3001")), { status: 401 });
    assert.doesNotThrow(() => authorize(new Request("http://localhost:3001", { headers: { cookie: `${cookieName}=${cookie}` } })));
    process.env.MINDBILL_MODE = "demo";
    assert.throws(() => authorize(new Request("http://localhost:3001", { headers: { cookie: `${cookieName}=${cookie}` } })), { status: 404 });
  } finally { process.env = previous; }
});

test("mutations require the exact configured origin", () => {
  const previous = { ...process.env };
  try {
    process.env.APP_ORIGIN = "http://localhost:3001";
    assert.doesNotThrow(() => checkOrigin(new Request("http://localhost:3001", { headers: { origin: "http://localhost:3001" } })));
    for (const origin of [undefined, "https://example.invalid", "http://localhost:3002", "null"]) {
      assert.throws(() => checkOrigin(new Request("http://localhost:3001", { headers: origin ? { origin } : {} })), { status: 403 });
    }
    process.env.APP_ORIGIN = "http://example.invalid";
    assert.throws(() => appOrigin(), { status: 503 });
    process.env.APP_ORIGIN = "https://example.invalid/path";
    assert.throws(() => appOrigin(), { status: 503 });
  } finally { process.env = previous; }
});

test("unexpected upstream failures never echo their bodies", async () => {
  const response = failure(new Error("synthetic-secret-that-must-not-be-forwarded"));
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes("synthetic-secret"), false);
  assert.equal(failure(new RouteError(401, "Sign in first.")).status, 401);
});
