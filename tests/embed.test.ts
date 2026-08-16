// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

describe("@mindbill/embed", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.resetModules();
  });

  it("accepts only bounded, known event payloads", async () => {
    const { parseMindBillMessage } = await import("../packages/embed/src/index.js");
    expect(parseMindBillMessage({
      type: "mindbill:event",
      component: "bill-timeline",
      event: "bill.updated",
      billId: "bill_123",
    })).toEqual({ component: "bill-timeline", event: "bill.updated", billId: "bill_123" });
    expect(parseMindBillMessage({
      type: "mindbill:event",
      component: "unknown",
      event: "bill.updated",
    })).toBeNull();
    expect(parseMindBillMessage({
      type: "mindbill:event",
      component: "bill-timeline",
      event: "x".repeat(121),
    })).toBeNull();
  });

  it("creates a sandboxed HTTPS iframe without putting the session token in its URL", async () => {
    await import("../packages/embed/src/index.js");
    const element = document.createElement("mindbill-bill-timeline");
    element.setAttribute("session-token", "secret-token");
    element.setAttribute("embed-url", "https://embed.mindbill.org/v1/bill-timeline");
    (element as HTMLElement & { connectedCallback(): void }).connectedCallback();

    const frame = element.querySelector("iframe");
    expect(frame?.src).toBe("https://embed.mindbill.org/v1/bill-timeline");
    expect(frame?.src).not.toContain("secret-token");
    expect(frame?.referrerPolicy).toBe("no-referrer");
    expect(frame?.sandbox.contains("allow-scripts")).toBe(true);
  });

  it("rejects non-HTTPS, credential-bearing, and non-MindBill embed URLs", async () => {
    await import("../packages/embed/src/index.js");
    const element = document.createElement("mindbill-collections");
    const errors: Array<CustomEvent> = [];
    element.addEventListener("mindbill-error", (event) => errors.push(event as CustomEvent));
    element.setAttribute("session-token", "secret-token");
    element.setAttribute("embed-url", "https://user:pass@example.test/widget");
    (element as HTMLElement & { connectedCallback(): void }).connectedCallback();

    expect(element.querySelector("iframe")).toBeNull();
    expect(errors.at(-1)?.detail.code).toBe("invalid_embed_url");

    element.setAttribute("embed-url", "https://partner.example.test/widget");
    expect(element.querySelector("iframe")).toBeNull();
    expect(errors.at(-1)?.detail.code).toBe("invalid_embed_url");
  });
});
