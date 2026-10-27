import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createBillSubmissionClient,
  flushMindBillAnalytics,
  MindBillApiError,
  mindBillApiErrorCode,
  mindBillSdkHeaderValue,
  noteMindBillAnalyticsSession,
  pendingMindBillAnalyticsEvents,
  registerMindBillSdk,
  resetMindBillAnalyticsForTests,
  sanitizeMindBillAnalyticsEvent,
  trackMindBillAnalyticsEvent,
  withMindBillSdkFetch,
  type BrowserBillSubmissionInput,
} from "../packages/browser/src/index";
import { MINDBILL_BROWSER_SDK_VERSION } from "../packages/browser/src/version";
import { MINDBILL_REACT_SDK_VERSION } from "../packages/react/src/version";
import { MINDBILL_ANGULAR_SDK_VERSION } from "../packages/angular/src/lib/version";

const version = (path: string) => (JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as { version: string }).version;
const base = { component: "BillSubmissionForm", sdkPackage: "@mindbill/react" as const, sdkVersion: "0.87.0" };
const okResponse = () => new Response(null, { status: 202 });
const session = { token: "mbes_synthetic_token_1", apiBaseUrl: "https://app.mindbill.org" };

beforeEach(() => { resetMindBillAnalyticsForTests(); vi.useRealTimers(); });
afterEach(() => { resetMindBillAnalyticsForTests(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("SDK versions", () => {
  it("match the published package versions", () => {
    expect(MINDBILL_BROWSER_SDK_VERSION).toBe(version("../packages/browser/package.json"));
    expect(MINDBILL_REACT_SDK_VERSION).toBe(version("../packages/react/package.json"));
    expect(MINDBILL_ANGULAR_SDK_VERSION).toBe(version("../packages/angular/package.json"));
  });

  it("builds the X-MindBill-SDK product tokens with the browser package first", () => {
    registerMindBillSdk("@mindbill/react", "0.87.0");
    registerMindBillSdk("@mindbill/react", "0.87.0");
    registerMindBillSdk("@mindbill/angular", "not a version");
    expect(mindBillSdkHeaderValue()).toBe(`@mindbill/browser/${MINDBILL_BROWSER_SDK_VERSION} @mindbill/react/0.87.0`);
  });
});

describe("analytics sanitization", () => {
  it("keeps only closed enums, counts, durations and field paths", () => {
    const event = sanitizeMindBillAnalyticsEvent({
      ...base, name: "validation_failed", occurredAt: "2026-10-27T10:00:00.000Z", tabSessionId: "tab_synthetic_01",
      durationMs: 12.6, route: "pigeon", billingMode: "med_legal", errorCode: "Claim Not Found!",
      fieldPaths: ["claim.dateOfInjury", "serviceLines[0].code", "Jane Doe <synthetic>", "x".repeat(97)],
      patientName: "Synthetic Patient", message: "free text",
    });
    expect(event).toEqual({
      ...base, name: "validation_failed", occurredAt: "2026-10-27T10:00:00.000Z", tabSessionId: "tab_synthetic_01",
      durationMs: 13, billingMode: "med_legal", errorCode: "claim_not_found_", fieldPaths: ["claim.dateOfInjury", "serviceLines[0].code"],
    });
  });

  it("rejects events with an unknown name or component", () => {
    expect(trackMindBillAnalyticsEvent({ ...base, name: "patient_viewed" as never })).toBeNull();
    expect(trackMindBillAnalyticsEvent({ ...base, component: "Bill Form <x>", name: "form_viewed" })).toBeNull();
    expect(pendingMindBillAnalyticsEvents()).toHaveLength(0);
  });
});

describe("analytics delivery", () => {
  it("queues until a browser session is noted, then sends a keepalive batch", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => okResponse());
    trackMindBillAnalyticsEvent({ ...base, name: "form_viewed" });
    trackMindBillAnalyticsEvent({ ...base, name: "route_selected", route: "ebill" });
    await flushMindBillAnalytics();
    expect(fetcher).not.toHaveBeenCalled();
    expect(pendingMindBillAnalyticsEvents()).toHaveLength(2);

    noteMindBillAnalyticsSession({ ...session, expiresAt: new Date(Date.now() + 600_000).toISOString(), environment: "sandbox" }, fetcher);
    await flushMindBillAnalytics();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://app.mindbill.org/partner/v2/browser/analytics");
    expect(init?.keepalive).toBe(true);
    expect(init?.credentials).toBe("omit");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer mbes_synthetic_token_1");
    // The header rides only after this origin accepted it on an earlier request.
    expect(headers.get("x-mindbill-sdk")).toBeNull();
    const body = JSON.parse(String(init?.body)) as { events: Array<Record<string, unknown>> };
    expect(body.events.map((event) => event.name)).toEqual(["form_viewed", "route_selected"]);
    expect(body.events[1]).toMatchObject({ route: "ebill", component: "BillSubmissionForm", sdkVersion: "0.87.0" });
    expect(body.events.every((event) => !("environment" in event))).toBe(true);
    expect(pendingMindBillAnalyticsEvents()).toHaveLength(0);
  });

  it("sends at most 50 events per request", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => okResponse());
    for (let index = 0; index < 75; index += 1) trackMindBillAnalyticsEvent({ ...base, name: "form_viewed" }, { send: true });
    noteMindBillAnalyticsSession(session, fetcher);
    await flushMindBillAnalytics();
    const sizes = fetcher.mock.calls.map(([, init]) => (JSON.parse(String(init?.body)) as { events: unknown[] }).events.length);
    expect(sizes).toEqual([50, 25]);
  });

  it("opt-out still reports to the host callback and never fetches", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => okResponse());
    const onEvent = vi.fn();
    noteMindBillAnalyticsSession(session, fetcher);
    const event = trackMindBillAnalyticsEvent({ ...base, name: "submit_clicked" }, { send: false, onEvent });
    await flushMindBillAnalytics();
    expect(onEvent).toHaveBeenCalledWith(event);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("stops sending for the page after the server has no analytics endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 404 }));
    noteMindBillAnalyticsSession(session, fetcher);
    trackMindBillAnalyticsEvent({ ...base, name: "form_viewed" });
    await flushMindBillAnalytics();
    trackMindBillAnalyticsEvent({ ...base, name: "form_viewed" });
    await flushMindBillAnalytics();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(pendingMindBillAnalyticsEvents()).toHaveLength(0);
  });

  it("never throws when the host callback or network fails", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => { throw new TypeError("offline"); });
    noteMindBillAnalyticsSession(session, fetcher);
    expect(() => trackMindBillAnalyticsEvent({ ...base, name: "form_viewed" }, { onEvent: () => { throw new Error("host bug"); } })).not.toThrow();
    await expect(flushMindBillAnalytics()).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("X-MindBill-SDK header", () => {
  it("is added to authenticated MindBill requests only", async () => {
    vi.stubGlobal("location", { origin: "https://partner.example" });
    const inner = vi.fn<typeof fetch>(async () => new Response("{}"));
    const fetcher = withMindBillSdkFetch(inner);
    const auth = { headers: { authorization: "Bearer mbes_synthetic_token_2" } };
    await fetcher("https://app.mindbill.org/partner/v2/browser/status", auth);
    await fetcher("/partner/v2/browser/status", auth);
    await fetcher("https://other.example/partner/v2/browser/status", auth);
    await fetcher("/api/mindbill/session", { method: "POST" });
    const sdk = inner.mock.calls.map(([, init]) => new Headers(init?.headers).get("x-mindbill-sdk"));
    expect(sdk[0]).toMatch(/^@mindbill\/browser\/\d+\.\d+\.\d+/);
    expect(sdk[1]).toMatch(/^@mindbill\/browser\//);
    expect(sdk[2]).toBeNull();
    expect(sdk[3]).toBeNull();
  });

  it("rides on submission-client API calls but not on the host session endpoint", async () => {
    const calls: Array<{ url: string; sdk: string | null }> = [];
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      calls.push({ url: String(input), sdk: new Headers(init?.headers).get("x-mindbill-sdk") });
      if (String(input).endsWith("/session")) return Response.json({ token: "mbes_synthetic_token_3" });
      return new Response(new Blob(["%PDF-1.7"]), { headers: { "content-type": "application/pdf" } });
    });
    const client = createBillSubmissionClient({ fetch: fetcher, sessionEndpoint: "https://partner.example/session" });
    await client.previewCms1500({} as BrowserBillSubmissionInput["bill"]);
    expect(calls[0]).toEqual({ url: "https://partner.example/session", sdk: null });
    // A write is never the probe: the header is sent only after a GET to this origin accepted it.
    expect(calls[1]?.sdk).toBeNull();
    const probe = withMindBillSdkFetch(fetcher);
    await probe("https://app.mindbill.org/partner/v2/browser/status", { headers: { authorization: "Bearer mbes_synthetic_token_3" } });
    expect(calls[2]?.sdk).toMatch(/^@mindbill\/browser\//);
    await client.previewCms1500({} as BrowserBillSubmissionInput["bill"]);
    expect(calls.at(-1)?.sdk).toMatch(/^@mindbill\/browser\//);
  });

  it("falls back without the header when an older server's CORS policy rejects it", async () => {
    const inner = vi.fn<typeof fetch>(async (_input, init) => {
      if (new Headers(init?.headers).get("x-mindbill-sdk")) throw new TypeError("Failed to fetch");
      return new Response("{}");
    });
    const fetcher = withMindBillSdkFetch(inner);
    const auth = { headers: { authorization: "Bearer mbes_synthetic_token_5" } };
    const first = await fetcher("https://legacy.mindbill.org/partner/v2/browser/status", auth);
    expect(first.ok).toBe(true);
    await fetcher("https://legacy.mindbill.org/partner/v2/bills", { ...auth, method: "POST", body: "{}" });
    const sent = inner.mock.calls.map(([, init]) => new Headers(init?.headers).get("x-mindbill-sdk"));
    expect(sent[0]).not.toBeNull();
    expect(sent.slice(1)).toEqual([null, null]);
    expect(inner).toHaveBeenCalledTimes(3);
  });
});

describe("packet preview client", () => {
  it("posts the unsaved bill and documents and reads the packet sections", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(new Blob(["%PDF-1.7 synthetic"]), {
      headers: { "content-type": "application/pdf", "x-mindbill-packet-sections": "cover, claim_form,document,w9,Bad Value" },
    }));
    const client = createBillSubmissionClient({ fetch: fetcher, getSession: async () => ({ token: "mbes_synthetic_token_4" }) });
    const documents = [{ filename: "synthetic-report.pdf", documentType: "final_report" as const, contentBase64: "JVBERi0=" }];
    const preview = await client.previewPacket({ bill: { claimForm: "cms1500" } as BrowserBillSubmissionInput["bill"], documents, route: "fax", attention: "  " });
    expect(preview.sections).toEqual(["cover", "claim_form", "document", "w9"]);
    expect(preview.pdf.size).toBeGreaterThan(0);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://app.mindbill.org/partner/v2/bills/preview-packet");
    expect(JSON.parse(String(init?.body))).toEqual({ bill: { claimForm: "cms1500" }, documents, route: "fax" });
  });

  it("reports API errors with their machine code and status", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ error: "invalid_pdf", message: "Document 1 must be a valid PDF." }, { status: 415 }));
    const client = createBillSubmissionClient({ fetch: fetcher, getSession: async () => ({ token: "mbes_synthetic_token_5" }) });
    const error = await client.previewPacket({ bill: {} as BrowserBillSubmissionInput["bill"] }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MindBillApiError);
    expect(error).toMatchObject({ message: "Document 1 must be a valid PDF.", status: 415, code: "invalid_pdf" });
    expect(mindBillApiErrorCode({ type: "https://docs.example/problems/claims_administrator_not_found" })).toBe("claims_administrator_not_found");
    expect(mindBillApiErrorCode({ error: "Not a code" })).toBeUndefined();
  });
});
