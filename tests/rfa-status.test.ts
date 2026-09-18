import { describe, expect, it } from "vitest";
import { getRfaLifecycleStatus, type RfaRecord } from "../packages/browser/src/index";
const transmission = (changes: Partial<RfaRecord["transmissions"][number]> = {}): RfaRecord["transmissions"][number] => ({
  id: "synthetic_submission", purpose: "submission", direction: "outbound", channel: "fax", status: "sent", destination: null,
  occurredAt: "2026-09-18T12:00:00Z", receivedAt: null, proofDocumentId: null, providerMessageId: null, ...changes,
});
describe("RFA lifecycle presentation", () => {
  it.each(["draft", "ready", "incomplete", "deferred"])("shows unsent %s as incomplete", status => {
    expect(getRfaLifecycleStatus({ status })).toBe("incomplete");
  });
  it.each(["approved", "modified", "denied", "mixed", "closed"])("shows resolved %s as closed", status => {
    expect(getRfaLifecycleStatus({ status, transmissions: [transmission({ status: "failed" })] })).toBe("closed");
  });
  it("prefers the API lifecycle and preserves canceled state", () => {
    expect(getRfaLifecycleStatus({ status: "submitted", lifecycleStatus: "received" })).toBe("received");
    expect(getRfaLifecycleStatus({ status: "canceled", receivedAt: "2026-09-18T12:00:00Z" })).toBe("canceled");
  });
  it("uses only the latest submission and ignores forwarding failures", () => {
    expect(getRfaLifecycleStatus({ status: "submitted", transmissions: [transmission(), transmission({ purpose: "forward", status: "failed", occurredAt: "2026-09-18T13:00:00Z" })] })).toBe("sent");
    expect(getRfaLifecycleStatus({ status: "submitted", receivedAt: "2026-09-18T11:00:00Z", transmissions: [transmission({ id: "old", occurredAt: "2026-09-18T10:00:00Z", receivedAt: "2026-09-18T11:00:00Z" }), transmission({ status: "failed" })] })).toBe("failed");
  });
  it("requires current receipt evidence and recovers a failed attempt when receipt arrives", () => {
    const failed = transmission({ status: "failed" });
    const receipt = transmission({ id: "receipt", direction: "inbound", status: "received", receivedAt: "2026-09-18T12:05:00Z" });
    expect(getRfaLifecycleStatus({ status: "submitted", transmissions: [failed, receipt] })).toBe("received");
    expect(getRfaLifecycleStatus({ status: "submitted", transmissions: [failed, { ...receipt, receivedAt: "2026-09-18T11:00:00Z" }] })).toBe("failed");
    expect(getRfaLifecycleStatus({ status: "submitted", transmissions: [transmission({ status: "delivered" })] })).toBe("sent");
  });
  it("supports older responses without transmission details", () => {
    expect(getRfaLifecycleStatus({ status: "under_review" })).toBe("received");
    expect(getRfaLifecycleStatus({ status: "deferred", submittedAt: "2026-09-18T12:00:00Z" })).toBe("sent");
  });
});
