import { describe, expect, it } from "vitest";
import {
  defaultNotificationPreferences,
  notificationSettingsNeedsConsent,
  notificationSettingsUpdate,
} from "../packages/react/src/notification-settings";

describe("notification settings boundary", () => {
  it("starts off with no selected email categories and independent arrays", () => {
    const first = defaultNotificationPreferences();
    first.agingDays.push(30);
    expect(defaultNotificationPreferences()).toEqual({ enabled: false, statusUpdates: false, agingDays: [], quietHours: true, reportDigest: "off" });
  });

  it("only emits preference and explicit consent fields; identity is never in browser mutations", () => {
    const extra = { enabled: true, statusUpdates: true, agingDays: [90, 30, 30, 17], quietHours: true,
      email: "changed@example.test", externalUserId: "somebody-else", audience: "practice", assignedBillIds: ["other-bill"],
      emailVerifiedAt: "2099-01-01", grantedAt: "2099-01-01" };
    expect(notificationSettingsUpdate(extra as unknown as ReturnType<typeof defaultNotificationPreferences>, false))
      .toEqual({ enabled: true, statusUpdates: true, agingDays: [30, 90], quietHours: true, reportDigest: "off", consent: false });
  });

  it("requires consent for initial enablement and every enabled change including quiet hours", () => {
    const enabled = { ...defaultNotificationPreferences(), enabled: true, statusUpdates: true };
    expect(notificationSettingsNeedsConsent(null, enabled)).toBe(true);
    expect(notificationSettingsNeedsConsent(defaultNotificationPreferences(), enabled)).toBe(true);
    expect(notificationSettingsNeedsConsent(enabled, { ...enabled, statusUpdates: false })).toBe(true);
    expect(notificationSettingsNeedsConsent(enabled, { ...enabled, quietHours: false })).toBe(true);
    expect(notificationSettingsNeedsConsent(enabled, { ...enabled, agingDays: [30] })).toBe(true);
    expect(notificationSettingsNeedsConsent(enabled, { ...enabled, reportDigest: "daily" })).toBe(true);
    expect(notificationSettingsNeedsConsent({ ...enabled, reportDigest: "daily" }, { ...enabled, reportDigest: "weekly" })).toBe(true);
    const legacyEnabled = { ...enabled };
    delete legacyEnabled.reportDigest;
    expect(notificationSettingsNeedsConsent(legacyEnabled, { ...enabled, reportDigest: "off" })).toBe(false);
    expect(notificationSettingsNeedsConsent(enabled, { ...enabled, enabled: false })).toBe(false);
    expect(notificationSettingsNeedsConsent(enabled, enabled)).toBe(false);
    expect(notificationSettingsNeedsConsent({ ...enabled, agingDays: [90, 30] }, { ...enabled, agingDays: [30, 90] })).toBe(false);
  });
});
