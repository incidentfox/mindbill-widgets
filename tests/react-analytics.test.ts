// @vitest-environment happy-dom
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { pendingMindBillAnalyticsEvents, resetMindBillAnalyticsForTests, type MindBillAnalyticsEvent } from "../packages/browser/src/index";
import { useMindBillAnalytics, type MindBillAnalyticsProps } from "../packages/react/src/analytics";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => resetMindBillAnalyticsForTests());

function Probe(props: MindBillAnalyticsProps) {
  const track = useMindBillAnalytics("AnalyticsProbe", props);
  useEffect(() => { track("route_selected", { route: "fax", errorCode: "Free Text Here" }); }, [track]);
  return null;
}

describe("useMindBillAnalytics", () => {
  it("emits component_mounted and tracked events to the host, respecting opt-out", async () => {
    const events: MindBillAnalyticsEvent[] = [];
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => { root.render(createElement(Probe, { analytics: false, onAnalyticsEvent: (event) => events.push(event) })); });
    expect(events.map((event) => event.name).sort()).toEqual(["component_mounted", "route_selected"]);
    expect(events.find((event) => event.name === "route_selected")).toMatchObject({ component: "AnalyticsProbe", sdkPackage: "@mindbill/react", route: "fax", errorCode: "free_text_here" });
    expect(pendingMindBillAnalyticsEvents()).toHaveLength(0);
    await act(async () => { root.unmount(); });
  });

  it("queues events for MindBill by default", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => { root.render(createElement(Probe)); });
    expect(pendingMindBillAnalyticsEvents().length).toBeGreaterThanOrEqual(2);
    await act(async () => { root.unmount(); });
  });
});
