import { describe, expect, it } from "vitest";
import { notificationRecipientInvitation, type NotificationRecipientInvitation } from "../packages/react/src/notification-recipients";

describe("arbitrary email invitation boundary", () => {
  it("normalizes recipient email and emits only invitation preferences, never consent or enablement", () => {
    const input = { email: "  Doctor@Example.test ", audience: "assigned_bills", statusUpdates: true,
      agingDays: [90,30,30,17], quietHours: true, enabled: true, consent: true,
      emailVerifiedAt: "2099-01-01", orgId: "other", externalUserId: "other", assignedBillIds: ["other"] };
    expect(notificationRecipientInvitation(input as unknown as NotificationRecipientInvitation, "request-1"))
      .toEqual({ requestId: "request-1", email: "doctor@example.test", audience: "assigned_bills",
        statusUpdates: true, agingDays: [30,90], quietHours: true, reportDigest: "off" });
  });
  it("preserves the host-authorized scope request and receipt without mutating caller arrays", () => {
    const input = { email: "billing@example.test", audience: "practice" as const, statusUpdates: false,
      agingDays: [60,30] as (30|60)[], quietHours: false };
    expect(notificationRecipientInvitation(input, "same-receipt")).toEqual({ ...input, agingDays: [30,60], reportDigest: "off", requestId: "same-receipt" });
    expect(input.agingDays).toEqual([60,30]);
  });
  it.each(["daily", "weekly"] as const)("allows a %s digest alone without inventing consent", reportDigest => {
    expect(notificationRecipientInvitation({ email: "digest@example.test", audience: "practice",
      statusUpdates: false, agingDays: [], quietHours: true, reportDigest }, "receipt"))
      .toEqual({ email: "digest@example.test", audience: "practice", statusUpdates: false,
        agingDays: [], quietHours: true, reportDigest, requestId: "receipt" });
  });
});
