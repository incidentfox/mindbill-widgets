import { useCallback, useEffect, useRef } from "react";
import {
  registerMindBillSdk,
  trackMindBillAnalyticsEvent,
  type MindBillAnalyticsBillingMode,
  type MindBillAnalyticsEvent,
  type MindBillAnalyticsEventName,
  type MindBillAnalyticsRoute,
} from "@mindbill/browser";
import { MINDBILL_REACT_SDK_VERSION } from "./version";

registerMindBillSdk("@mindbill/react", MINDBILL_REACT_SDK_VERSION);

/** Props shared by components that report privacy-safe usage analytics. */
export type MindBillAnalyticsProps = {
  /** false stops sending usage events to MindBill. `onAnalyticsEvent` still receives them. Defaults to true. */
  analytics?: boolean;
  /** Receives every usage event (closed enums, durations and field paths only; never values or patient data). */
  onAnalyticsEvent?: (event: MindBillAnalyticsEvent) => void;
};

export type MindBillAnalyticsDetails = {
  durationMs?: number;
  route?: MindBillAnalyticsRoute;
  errorCode?: string;
  fieldPaths?: string[];
  billingMode?: MindBillAnalyticsBillingMode;
};

export type MindBillAnalyticsTracker = (name: MindBillAnalyticsEventName, details?: MindBillAnalyticsDetails) => void;

/** Track one component's usage. The returned callback is stable; it never throws or blocks rendering. */
export function useMindBillAnalytics(component: string, options: MindBillAnalyticsProps = {}): MindBillAnalyticsTracker {
  const latest = useRef({ component, options });
  latest.current = { component, options };
  const track = useCallback<MindBillAnalyticsTracker>((name, details = {}) => {
    const { component: current, options: { analytics, onAnalyticsEvent } } = latest.current;
    trackMindBillAnalyticsEvent(
      { name, component: current, sdkPackage: "@mindbill/react", sdkVersion: MINDBILL_REACT_SDK_VERSION, ...details },
      { send: analytics !== false, ...(onAnalyticsEvent ? { onEvent: onAnalyticsEvent } : {}) },
    );
  }, []);
  useEffect(() => { track("component_mounted"); }, [track]);
  return track;
}
